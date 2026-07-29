import { Request, Response, Router } from "express";
import path from "node:path";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import { csrfProtection } from "../middleware/csrf";
import {
  forwardRobotEvalJobRequestToPipeline,
  robotEvalJobRequestForwardErrorMessage,
  writeRobotEvalJobRequestInbox,
} from "../utils/robotEvalJobRequests";
import {
  createPipelineSyncRateLimiter,
  validatePipelineArtifactUris,
  verifyPipelineSyncRequest,
} from "../utils/pipelineSyncSecurity";
import { recordBetaOpsFailureSignal } from "../utils/ops-alerts";
import {
  betaDecisionForResponse,
  evaluateBetaCohortGate,
  recordBetaCohortAdmission,
} from "../utils/beta-cohort-policy";
import {
  parseBenchmarkProjection,
  type BenchmarkProjection,
} from "../utils/benchmarkProjectionContract";
import {
  DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION,
  decisionRequestIdentity,
  normalizeDecisionEvidenceRequest,
  physicalOutcomeJoinSchema,
  projectDecisionEnvelope,
} from "../utils/decisionEvidenceContract";

const router = Router();
const pipelineSyncRateLimiter = createPipelineSyncRateLimiter();
const DEFAULT_INBOX_DIR = path.resolve(
  process.cwd(),
  "output/pipeline/robot_eval_job_requests/inbox",
);
const LOCAL_ENTITLEMENT_PROOF_ENV = "BLUEPRINT_LOCAL_ROBOT_EVAL_ENTITLEMENT_PROOF_JSON";
const ENTITLEMENT_MATCH_FIELDS = [
  "sku",
  "site_slug",
  "siteSlug",
  "site_id",
  "siteId",
  "site_submission_id",
  "siteSubmissionId",
  "capture_job_id",
  "captureJobId",
  "capture_id",
  "captureId",
  "scene_id",
  "sceneId",
  "listing_id",
  "listingId",
  "marketplace_listing_id",
  "marketplaceListingId",
  "site_world_id",
  "siteWorldId",
];

function truthy(value: string | undefined) {
  return String(value || "").trim().toLowerCase() === "true";
}

function buildDurableStoreProof(params: {
  firestoreWritePerformed: boolean;
  firestoreWriteDisabled: boolean;
  firestoreCollection: string;
  firestoreDocId: string;
  inbox: Record<string, unknown>;
  pipelineForward: Record<string, unknown>;
}) {
  const inboxStored = Boolean(params.inbox.job_request_path);
  const pipelineForwardPerformed = params.pipelineForward.performed === true;
  return {
    status: params.firestoreWritePerformed ? "stored" : "pipeline_inbox_only",
    performed: params.firestoreWritePerformed,
    firestore: {
      status: params.firestoreWritePerformed
        ? "stored"
        : params.firestoreWriteDisabled
          ? "disabled"
          : "not_configured",
      performed: params.firestoreWritePerformed,
      collection: params.firestoreCollection,
      doc_id: params.firestoreDocId,
    },
    pipeline_inbox: {
      status: inboxStored ? "stored" : "not_stored",
      performed: inboxStored,
      queue_contract: params.inbox.queue_contract || null,
      job_request_path: params.inbox.job_request_path || null,
    },
    pipeline_forward: {
      status: params.pipelineForward.status || "not_configured",
      performed: pipelineForwardPerformed,
      accepted: params.pipelineForward.accepted === true,
      required: params.pipelineForward.required === true,
      pipeline_status: params.pipelineForward.pipeline_status || null,
    },
  };
}

function requirePipelineSync(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) {
    return res.status(result.status).json({
      error: result.message,
      code: result.code,
    });
  }
  next();
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedToken(value: unknown) {
  return stringValue(value).toLowerCase();
}

function robotEvalSiteTokens(jobRequest: Record<string, unknown>) {
  const sitePackage = asObject(jobRequest.site_package);
  const testbed = asObject(jobRequest.testbed);
  const siteTask = asObject(jobRequest.site_task);
  const tokens = new Set<string>();
  for (const field of [
    "site_slug",
    "site_id",
    "site_submission_id",
    "capture_job_id",
    "capture_id",
  ]) {
    const token = normalizedToken(sitePackage[field]);
    if (token) {
      tokens.add(token);
    }
  }
  for (const value of [
    testbed.testbed_id,
    siteTask.site_id,
    siteTask.site_name,
    siteTask.task_id,
  ]) {
    const token = normalizedToken(value);
    if (token) {
      tokens.add(token);
    }
  }
  return tokens;
}

function robotEvalBetaScope(jobRequest: Record<string, unknown>) {
  const sitePackage = asObject(jobRequest.site_package);
  const siteTask = asObject(jobRequest.site_task);
  return {
    market:
      stringValue(siteTask.market) ||
      stringValue(siteTask.site_name) ||
      stringValue(siteTask.site_id) ||
      stringValue(sitePackage.market) ||
      stringValue(sitePackage.region_id) ||
      stringValue(sitePackage.regionId) ||
      stringValue(sitePackage.city) ||
      stringValue(sitePackage.site_slug) ||
      null,
    siteType:
      stringValue(siteTask.site_type) ||
      stringValue(sitePackage.site_type) ||
      stringValue(sitePackage.siteType) ||
      stringValue(sitePackage.location_type) ||
      stringValue(sitePackage.locationType) ||
      stringValue(sitePackage.item_type) ||
      stringValue(sitePackage.itemType) ||
      "robot_eval",
  };
}

function requestedEntitlementId(jobRequest: Record<string, unknown>) {
  const entitlement = asObject(jobRequest.entitlement);
  const authorization = asObject(jobRequest.authorization);
  return stringValue(
    authorization.entitlement_id ||
      entitlement.entitlement_id ||
      entitlement.entitlementId ||
      jobRequest.entitlement_id ||
      jobRequest.entitlementId,
  );
}

function entitlementMatchesRobotEvalRequest(
  entitlement: Record<string, unknown>,
  jobRequest: Record<string, unknown>,
) {
  const siteTokens = robotEvalSiteTokens(jobRequest);
  if (siteTokens.size === 0) {
    return false;
  }

  for (const field of ENTITLEMENT_MATCH_FIELDS) {
    const entitlementToken = normalizedToken(entitlement[field]);
    if (!entitlementToken) {
      continue;
    }
    for (const siteToken of siteTokens) {
      if (
        entitlementToken === siteToken ||
        entitlementToken.startsWith(`${siteToken}-`) ||
        entitlementToken === `site-world-package-${siteToken}` ||
        entitlementToken === `hosted-session-${siteToken}`
      ) {
        return true;
      }
    }
  }

  return false;
}

function publicEntitlementProof(entitlement: Record<string, unknown>) {
  return {
    entitlement_id: stringValue(entitlement.id),
    sku: stringValue(entitlement.sku),
    access_state: stringValue(entitlement.access_state),
    source: stringValue(entitlement.proof_source) || "marketplaceEntitlements",
  };
}

function jobRequestWithServerVerifiedEntitlement(
  jobRequest: Record<string, unknown>,
  entitlement: Record<string, unknown>,
) {
  const entitlementId = stringValue(entitlement.id);
  if (jobRequest.schema_version === DECISION_EVIDENCE_REQUEST_SCHEMA_VERSION) {
    return {
      ...jobRequest,
      authorization: {
        ...asObject(jobRequest.authorization),
        entitlement_id: entitlementId,
        access_state: "provisioned",
        verified_by: "server_marketplace_entitlement",
      },
    };
  }
  const rightsPrivacyScope = asObject(jobRequest.rights_privacy_scope);
  const submittedEntitlement = asObject(jobRequest.entitlement);
  return {
    ...jobRequest,
    entitlement: {
      ...submittedEntitlement,
      entitlement_id: entitlementId,
      access_state: "provisioned",
      approved: true,
      verified_by: "server_marketplace_entitlement",
    },
    rights_privacy_scope: {
      ...rightsPrivacyScope,
      status: "cleared_for_robot_eval",
      external_use_allowed: true,
      entitlement_verified: true,
      entitlement_id: entitlementId,
      verification_source: "server_marketplace_entitlement",
      privacy_scope:
        stringValue(rightsPrivacyScope.privacy_scope) || "derived_deidentified_environment",
    },
  };
}

function localRobotEvalEntitlementProof(params: {
  buyerUserId: string;
  jobRequest: Record<string, unknown>;
}):
  | {
      ok: true;
      entitlement: Record<string, unknown>;
      jobRequest: Record<string, unknown>;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
    }
  | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }
  const raw = String(process.env[LOCAL_ENTITLEMENT_PROOF_ENV] || "").trim();
  if (!raw) {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    const value = JSON.parse(raw);
    parsed = asObject(value);
  } catch {
    return {
      ok: false,
      status: 503,
      code: "invalid_local_robot_eval_entitlement_proof",
      error: `${LOCAL_ENTITLEMENT_PROOF_ENV} must be valid JSON.`,
    };
  }

  const accessState = stringValue(parsed.access_state);
  if (!accessState) {
    return {
      ok: false,
      status: 503,
      code: "invalid_local_robot_eval_entitlement_proof",
      error: `${LOCAL_ENTITLEMENT_PROOF_ENV} must explicitly include access_state.`,
    };
  }

  const entitlement = {
    ...parsed,
    id: stringValue(parsed.id || parsed.entitlement_id) || "local-robot-eval-route-proof",
    buyer_user_id: stringValue(parsed.buyer_user_id || parsed.buyerUserId) || params.buyerUserId,
    access_state: accessState,
    proof_source: "local_robot_eval_route_proof_entitlement",
  };
  if (stringValue(entitlement.buyer_user_id) !== stringValue(params.buyerUserId)) {
    return {
      ok: false,
      status: 403,
      code: "local_robot_eval_entitlement_buyer_mismatch",
      error: "Local robot eval entitlement proof does not belong to the authenticated buyer.",
    };
  }
  if (stringValue(entitlement.access_state) !== "provisioned") {
    return {
      ok: false,
      status: 403,
      code: "local_robot_eval_entitlement_not_provisioned",
      error: "Local robot eval entitlement proof is not provisioned.",
    };
  }
  if (!entitlementMatchesRobotEvalRequest(entitlement, params.jobRequest)) {
    return {
      ok: false,
      status: 403,
      code: "local_robot_eval_entitlement_site_mismatch",
      error: "Local robot eval entitlement proof does not match this site.",
    };
  }

  return {
    ok: true,
    entitlement,
    jobRequest: jobRequestWithServerVerifiedEntitlement(params.jobRequest, entitlement),
  };
}

async function verifyRobotEvalEntitlement(params: {
  buyerUserId: string;
  jobRequest: Record<string, unknown>;
}): Promise<
  | {
      ok: true;
      entitlement: Record<string, unknown>;
      jobRequest: Record<string, unknown>;
    }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
    }
> {
  const localProof = localRobotEvalEntitlementProof(params);
  if (localProof) {
    return localProof;
  }

  if (!db) {
    return {
      ok: false,
      status: 503,
      code: "robot_eval_entitlement_store_not_configured",
      error: "Robot eval entitlement verification store is not configured.",
    };
  }

  const buyerUserId = stringValue(params.buyerUserId);
  if (!buyerUserId) {
    return {
      ok: false,
      status: 401,
      code: "robot_eval_missing_authenticated_buyer",
      error: "Missing authenticated buyer for robot eval entitlement verification.",
    };
  }

  const requestedId = requestedEntitlementId(params.jobRequest);
  const candidates: Record<string, unknown>[] = [];
  if (requestedId) {
    const snapshot = await db.collection("marketplaceEntitlements").doc(requestedId).get();
    if (snapshot.exists) {
      candidates.push({
        id: snapshot.id || requestedId,
        ...((snapshot.data() || {}) as Record<string, unknown>),
      });
    }
  } else {
    const snapshot = await db
      .collection("marketplaceEntitlements")
      .where("buyer_user_id", "==", buyerUserId)
      .limit(50)
      .get();
    for (const doc of snapshot.docs || []) {
      candidates.push({
        id: doc.id || "",
        ...((doc.data() || {}) as Record<string, unknown>),
      });
    }
  }

  const entitlement = candidates.find((candidate) => {
    if (stringValue(candidate.buyer_user_id || candidate.buyerUserId) !== buyerUserId) {
      return false;
    }
    if (stringValue(candidate.access_state) !== "provisioned") {
      return false;
    }
    return entitlementMatchesRobotEvalRequest(candidate, params.jobRequest);
  });

  if (!entitlement) {
    return {
      ok: false,
      status: 403,
      code: "robot_eval_provisioned_entitlement_not_found",
      error:
        "A provisioned marketplace entitlement for this buyer and site is required before queuing robot eval.",
    };
  }

  return {
    ok: true,
    entitlement,
    jobRequest: jobRequestWithServerVerifiedEntitlement(params.jobRequest, entitlement),
  };
}

const BUYER_RUN_LIST_LIMIT = 200;

// Every field in this buyer-facing summary comes from the stored owner-scoped
// robotEvalJobRequests record. Nothing is synthesized for display.
function buyerRunSummary(jobId: string, data: Record<string, unknown>) {
  const entitlementProof = asObject(data.entitlement_proof);
  const decisionRequest = asObject(data.decision_request || data.jobRequest);
  const identity = decisionRequestIdentity(decisionRequest);
  const testbed = asObject(decisionRequest.testbed);
  const siteTask = asObject(decisionRequest.site_task);
  return {
    job_id: jobId,
    request_id: identity.requestId || jobId,
    decision_id: identity.decisionId || null,
    contract_schema_version: stringValue(decisionRequest.schema_version) || null,
    status: stringValue(data.status) || null,
    pipeline_status: data.pipeline_status || null,
    site_slug:
      stringValue(data.site_slug) ||
      stringValue(siteTask.site_name) ||
      stringValue(siteTask.site_id) ||
      null,
    testbed_id: stringValue(testbed.testbed_id) || null,
    testbed_version: stringValue(testbed.version) || null,
    decision_question: stringValue(decisionRequest.decision_question) || null,
    site_submission_id: stringValue(data.site_submission_id) || null,
    capture_job_id: stringValue(data.capture_job_id) || null,
    capture_id: stringValue(data.capture_id) || null,
    error: data.error || null,
    entitlement_id: stringValue(entitlementProof.entitlement_id) || null,
    entitlement_sku: stringValue(entitlementProof.sku) || null,
    created_at_iso: stringValue(data.created_at_iso) || null,
    updated_at_iso: stringValue(data.updated_at_iso) || null,
  };
}

function statusResponse(jobId: string, data: Record<string, unknown>) {
  const pipelineResult = asObject(data.pipeline_result);
  const jobRequest = asObject(data.decision_request || data.jobRequest);
  const decisionEnvelopeValue =
    data.decision_envelope || pipelineResult.decision_envelope || null;
  const decisionProjection = decisionEnvelopeValue
    ? projectDecisionEnvelope(decisionEnvelopeValue)
    : null;
  const sitePackage = asObject(jobRequest.site_package);
  const robotProfile = asObject(jobRequest.robot_profile);
  const requestedTasks = Array.isArray(jobRequest.requested_tasks)
    ? jobRequest.requested_tasks.map(asObject).map((task) => ({
        task_id: stringValue(task.task_id),
        label: stringValue(task.label),
      }))
    : [];
  return {
    ok: true,
    job_id: jobId,
    status: stringValue(data.status) || null,
    pipeline_status: data.pipeline_status || pipelineResult.status || null,
    result_artifacts: data.result_artifacts || pipelineResult.result_artifacts || {},
    decision_projection: decisionProjection,
    proof_boundary: data.proof_boundary || pipelineResult.proof_boundary || {},
    error: data.error || pipelineResult.error || null,
    updated_at_iso: data.updated_at_iso || null,
    created_at_iso: data.created_at_iso || null,
    pipeline_forward: data.pipeline_forward || null,
    benchmark: data.benchmark_projection || pipelineResult.benchmark_projection || null,
    request_summary: {
      request_id:
        stringValue(data.request_id) || stringValue(jobRequest.request_id) || jobId,
      decision_id:
        stringValue(data.decision_id) || stringValue(jobRequest.decision_id) || null,
      decision_question: stringValue(jobRequest.decision_question) || null,
      testbed: jobRequest.testbed || null,
      site_task: jobRequest.site_task || null,
      candidates: Array.isArray(jobRequest.candidates) ? jobRequest.candidates : [],
      claims: Array.isArray(jobRequest.claims) ? jobRequest.claims : [],
      thresholds: Array.isArray(jobRequest.thresholds) ? jobRequest.thresholds : [],
      buyer_request_id:
        stringValue(data.buyer_request_id) || stringValue(jobRequest.buyer_request_id),
      site_slug: stringValue(data.site_slug) || stringValue(sitePackage.site_slug),
      site_name: stringValue(sitePackage.site_name),
      site_type: stringValue(sitePackage.site_type),
      robot_name: stringValue(robotProfile.robot_name),
      operation: stringValue(jobRequest.operation) || "evaluate_only",
      requested_tasks: requestedTasks,
    },
  };
}

// WEB-02: require an authenticated buyer to submit an eval job. Previously
// unauthenticated, which let anyone inject robot_eval_job_request records and
// trigger pipeline forwarding. The buyer's uid is attributed to the record so the
// status route can enforce ownership. (The machine-only /:jobId/pipeline-status
// callback keeps its HMAC guard instead of a Firebase token.)
router.post("/", csrfProtection, verifyFirebaseToken, async (req, res) => {
  const submittedJobRequest = req.body;
  const buyerUserId = String(
    (res.locals.firebaseUser as { uid?: string } | undefined)?.uid || "",
  ).trim();
  const firebaseUser = res.locals.firebaseUser as
    | { uid?: string; tenantId?: string; tenant_id?: string; localRouteProof?: boolean }
    | undefined;
  const receivedAtIso = new Date().toISOString();
  const normalizedRequest = normalizeDecisionEvidenceRequest({
    value: submittedJobRequest,
    authenticatedUserId: buyerUserId,
    authenticatedTenantId: stringValue(
      firebaseUser?.tenantId || firebaseUser?.tenant_id,
    ) || null,
    sourceRoute: req.baseUrl || "/api/task-evaluation-runs",
    receivedAtIso,
  });
  if (!normalizedRequest.ok) {
    return res.status(400).json({
      ok: false,
      status: "blocked",
      code: normalizedRequest.code,
      error: "Task Evaluation Run request could not be accepted.",
      migration_errors: normalizedRequest.errors,
    });
  }

  const decisionRequest = normalizedRequest.request as unknown as Record<string, unknown>;
  const identity = decisionRequestIdentity(decisionRequest);
  const betaScope = robotEvalBetaScope(decisionRequest);

  // Beta cohort policy applies to buyer intake exactly like capture intake:
  // a denial must happen before any inbox record, Firestore write, or
  // Pipeline forwarding is created. The credential-free local route-proof
  // identity (non-production only, see verifyFirebaseToken) exercises
  // forwarding mechanics and is exempt the same way it uses a local
  // entitlement proof instead of Firestore entitlements.
  const isLocalRouteProof = Boolean(
    firebaseUser?.localRouteProof,
  );
  const betaCohortDecision = isLocalRouteProof
    ? null
    : await evaluateBetaCohortGate({
        gate: "robot_eval_request",
        creatorId: buyerUserId || null,
        market: betaScope.market,
        siteType: betaScope.siteType,
        source: "robot_eval_job_request_intake",
      });
  if (betaCohortDecision && !betaCohortDecision.allowed) {
    return res.status(betaCohortDecision.statusCode).json({
      ok: false,
      status: "beta_cohort_denied",
      code: betaCohortDecision.reason,
      error: betaCohortDecision.message,
      beta_cohort_policy: betaDecisionForResponse(betaCohortDecision),
    });
  }

  const requestId = identity.requestId;
  const decisionId = identity.decisionId;
  const idempotency = asObject(decisionRequest.idempotency);
  const idempotencyKey = stringValue(idempotency.key);
  if (db) {
    const existingSnapshot = await db
      .collection("robotEvalJobRequests")
      .doc(requestId)
      .get();
    if (existingSnapshot.exists) {
      const existing = (existingSnapshot.data() || {}) as Record<string, unknown>;
      const existingRequest = asObject(existing.decision_request || existing.jobRequest);
      const existingKey = stringValue(
        existing.idempotency_key || asObject(existingRequest.idempotency).key,
      );
      if (stringValue(existing.buyer_user_id) !== buyerUserId) {
        return res.status(409).json({
          ok: false,
          status: "blocked",
          code: "decision_request_id_conflict",
          error: "The request id is already in use.",
        });
      }
      if (existingKey && existingKey !== idempotencyKey) {
        return res.status(409).json({
          ok: false,
          status: "blocked",
          code: "decision_request_idempotency_conflict",
          error: "The request id was already submitted with a different idempotency key.",
        });
      }
      return res.status(200).json({
        ...statusResponse(requestId, existing),
        ok: true,
        already_exists: true,
        idempotency_key: existingKey || idempotencyKey,
      });
    }
  }

  let jobRequest = decisionRequest;
  let verifiedEntitlement: Record<string, unknown> | null = null;
  let entitlementProof: Record<string, unknown> | null = null;
  const entitlementRequested = Boolean(requestedEntitlementId(decisionRequest));
  if (entitlementRequested) {
    const entitlementCheck = await verifyRobotEvalEntitlement({
      buyerUserId,
      jobRequest: decisionRequest,
    });
    if (!entitlementCheck.ok) {
      return res.status(entitlementCheck.status).json({
        ok: false,
        status: "awaiting_authorization",
        code: entitlementCheck.code,
        error: entitlementCheck.error,
      });
    }
    jobRequest = entitlementCheck.jobRequest;
    verifiedEntitlement = entitlementCheck.entitlement;
    entitlementProof = publicEntitlementProof(entitlementCheck.entitlement);
  }

  const queuedAt = receivedAtIso;
  const inbox = await writeRobotEvalJobRequestInbox({
    rootDir: process.env.ROBOT_EVAL_JOB_REQUEST_INBOX_DIR || DEFAULT_INBOX_DIR,
    jobRequest,
    queuedAt,
  });
  const pipelineForward = verifiedEntitlement
    ? await forwardRobotEvalJobRequestToPipeline({ jobRequest, queuedAt })
    : {
        status: "blocked" as const,
        performed: false,
        endpoint_configured: Boolean(
          String(process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL || "").trim(),
        ),
        required: false,
        blockers: ["authorization_required_before_pipeline_submission"],
      };
  const pipelineForwardBlocksAcceptance =
    Boolean(verifiedEntitlement) &&
    pipelineForward.required === true &&
    pipelineForward.performed !== true;
  const recordStatus = !verifiedEntitlement
    ? "awaiting_authorization"
    : pipelineForwardBlocksAcceptance
      ? "blocked"
      : "submitted";
  const siteTask = asObject(jobRequest.site_task);
  const testbed = asObject(jobRequest.testbed);
  const record = {
    decision_request: jobRequest,
    legacy_job_request: null,
    compatibility: normalizedRequest.compatibility,
    schema_version: jobRequest.schema_version,
    job_id: requestId,
    request_id: requestId,
    decision_id: decisionId,
    idempotency_key: idempotencyKey,
    buyer_user_id: buyerUserId,
    buyer_request_id: decisionId,
    site_slug: stringValue(siteTask.site_name) || stringValue(siteTask.site_id),
    testbed_id: stringValue(testbed.testbed_id),
    testbed_version: stringValue(testbed.version),
    status: recordStatus,
    error: pipelineForwardBlocksAcceptance
      ? robotEvalJobRequestForwardErrorMessage(pipelineForward)
      : null,
    pipeline_command: "blueprint-route-decision-evidence",
    pipeline_inbox: inbox,
    pipeline_forward: pipelineForward,
    entitlement_proof: entitlementProof,
    created_at_iso: queuedAt,
    updated_at_iso: queuedAt,
    proof_boundary: {
      decision_proven: false,
      physical_evidence_proven: false,
      training_performed: false,
      policy_improved: false,
      public_claim_upgrade_allowed: false,
    },
  };

  const firestoreWriteDisabled = truthy(
    process.env.ROBOT_EVAL_JOB_REQUEST_DISABLE_FIRESTORE_WRITE,
  );
  let firestoreWritePerformed = false;
  if (db && !firestoreWriteDisabled) {
    await db.collection("robotEvalJobRequests").doc(requestId).set(
      {
        ...record,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    firestoreWritePerformed = true;
  }

  const durableStore = buildDurableStoreProof({
    firestoreWritePerformed,
    firestoreWriteDisabled,
    firestoreCollection: "robotEvalJobRequests",
    firestoreDocId: requestId,
    inbox,
    pipelineForward,
  });
  if (pipelineForwardBlocksAcceptance) {
    await recordBetaOpsFailureSignal({
      kind: "intake_forwarding_failure",
      scopeId: requestId || decisionId || "task-evaluation-run-request",
      severity: "critical",
      summary: "Robot eval job request forwarding to Pipeline failed while forwarding was required.",
      details: {
        request_id: requestId,
        decision_id: decisionId,
        pipeline_forward: pipelineForward,
        durable_store: durableStore,
      },
    });
    return res.status(502).json({
      ok: false,
      status: "blocked",
      error: robotEvalJobRequestForwardErrorMessage(pipelineForward),
      durableStore,
      pipelineInbox: inbox,
      pipelineForward,
      entitlementProof,
      decisionRequest: jobRequest,
    });
  }

  // Paid self-serve entitlements (sku "<siteSlug>-robot-eval-run") cover exactly
  // one accepted run. Consume them here — after acceptance, never on the 502
  // forward-failure path above — so one $-per-run purchase cannot be replayed
  // into unlimited runs. Back-office/site-package/hosted-session entitlements
  // are untouched.
  const verifiedEntitlementId = stringValue(verifiedEntitlement?.id);
  const verifiedEntitlementSku = normalizedToken(verifiedEntitlement?.sku);
  const isFirestoreBackedEntitlement =
    Boolean(verifiedEntitlement) && !stringValue(verifiedEntitlement?.proof_source);
  if (
    db &&
    isFirestoreBackedEntitlement &&
    verifiedEntitlementId &&
    verifiedEntitlementSku.endsWith("-robot-eval-run")
  ) {
    await db.collection("marketplaceEntitlements").doc(verifiedEntitlementId).set(
      {
        access_state: "consumed",
        consumed_at: queuedAt,
        consumed_by_job_id: requestId,
        updated_at: queuedAt,
      },
      { merge: true },
    );
  }

  if (betaCohortDecision) {
    await recordBetaCohortAdmission({
      gate: "robot_eval_request",
      admissionId: `task-evaluation-run:${requestId}`,
      decision: betaCohortDecision,
      creatorId: buyerUserId,
      market: betaScope.market,
      siteType: betaScope.siteType,
      source: "task_evaluation_run_request",
    });
  }

  return res.status(202).json({
    ok: true,
    status: recordStatus,
    durableStore,
    pipelineInbox: inbox,
    pipelineForward,
    entitlementProof,
    decisionRequest: jobRequest,
  });
});

// Restore persisted buyer run history without requiring a composite Firestore
// index. The owner query is bounded; recency ordering happens in application code.
router.get("/", verifyFirebaseToken, async (_req, res) => {
  if (!db) {
    return res.status(503).json({
      error: "Robot eval job status store is not configured.",
      code: "robot_eval_status_store_not_configured",
    });
  }

  const buyerUserId = String(
    (res.locals.firebaseUser as { uid?: string } | undefined)?.uid || "",
  ).trim();
  if (!buyerUserId) {
    return res.status(401).json({
      error: "Authenticated buyer identity is required.",
      code: "robot_eval_missing_authenticated_buyer",
    });
  }

  const snapshot = await db
    .collection("robotEvalJobRequests")
    .where("buyer_user_id", "==", buyerUserId)
    .limit(BUYER_RUN_LIST_LIMIT)
    .get();
  const jobRequests = (snapshot.docs || [])
    .map((doc) => buyerRunSummary(doc.id, (doc.data() || {}) as Record<string, unknown>))
    .sort((left, right) => {
      const leftTimestamp = String(left.updated_at_iso || left.created_at_iso || "");
      const rightTimestamp = String(right.updated_at_iso || right.created_at_iso || "");
      return leftTimestamp < rightTimestamp ? 1 : leftTimestamp > rightTimestamp ? -1 : 0;
    });

  return res.json({ ok: true, job_requests: jobRequests, count: jobRequests.length });
});

// WEB-02: require auth + ownership. Previously unauthenticated, which leaked
// result_artifacts and proof_boundary of any job to anyone who knew a jobId.
router.get("/:jobId/status", verifyFirebaseToken, async (req, res) => {
  if (!db) {
    return res.status(503).json({
      error: "Robot eval job status store is not configured.",
      code: "robot_eval_status_store_not_configured",
    });
  }

  const jobId = String(req.params.jobId || "").trim();
  if (!jobId) {
    return res.status(400).json({ error: "job_id is required" });
  }

  const snapshot = await db.collection("robotEvalJobRequests").doc(jobId).get();
  if (!snapshot.exists) {
    return res.status(404).json({
      error: "Robot eval job request was not found.",
      code: "robot_eval_job_not_found",
    });
  }

  const data = (snapshot.data() || {}) as Record<string, unknown>;
  const firebaseUser = res.locals.firebaseUser as
    | { uid?: string; admin?: boolean; role?: string }
    | undefined;
  const callerUid = String(firebaseUser?.uid || "");
  const ownerUid = String(data.buyer_user_id || "");
  const isAdmin = firebaseUser?.admin === true || firebaseUser?.role === "admin";
  if (!isAdmin && (!ownerUid || ownerUid !== callerUid)) {
    return res.status(403).json({
      error: "You do not have access to this robot eval job request.",
      code: "robot_eval_job_forbidden",
    });
  }

  return res.json({
    ...buyerRunSummary(jobId, data),
    ...statusResponse(jobId, data),
  });
});

router.post(
  "/:jobId/physical-outcomes",
  pipelineSyncRateLimiter,
  requirePipelineSync,
  async (req, res) => {
    if (!db) {
      return res.status(503).json({
        error: "Task Evaluation Run status store is not configured.",
        code: "task_evaluation_run_store_not_configured",
      });
    }
    const requestId = String(req.params.jobId || "").trim();
    const parsed = physicalOutcomeJoinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Physical outcome join is invalid or lacks authoritative evidence.",
        code: "invalid_physical_outcome_join",
        violations: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }
    if (parsed.data.request_id !== requestId) {
      return res.status(400).json({
        error: "Physical outcome request_id does not match route request id.",
        code: "physical_outcome_request_id_mismatch",
      });
    }
    const artifactViolations = validatePipelineArtifactUris({
      artifacts: [parsed.data.physical_artifact],
    });
    if (artifactViolations.length) {
      return res.status(400).json({
        error: "Physical outcome artifact is outside the allowed storage boundary.",
        code: "invalid_pipeline_artifact_uri",
        violations: artifactViolations,
      });
    }
    const snapshot = await db.collection("robotEvalJobRequests").doc(requestId).get();
    if (!snapshot.exists) {
      return res.status(404).json({
        error: "Task Evaluation Run request was not found.",
        code: "task_evaluation_run_not_found",
      });
    }
    const record = (snapshot.data() || {}) as Record<string, unknown>;
    const storedRequest = asObject(record.decision_request || record.jobRequest);
    const storedTestbed = asObject(storedRequest.testbed);
    if (
      stringValue(record.decision_id) !== parsed.data.decision_id ||
      stringValue(storedTestbed.testbed_id) !== parsed.data.testbed.testbed_id ||
      stringValue(storedTestbed.version) !== parsed.data.testbed.version ||
      stringValue(storedTestbed.digest_sha256) !== parsed.data.testbed.digest_sha256
    ) {
      return res.status(409).json({
        error: "Physical outcome join identifiers do not match the stored decision and testbed.",
        code: "physical_outcome_join_identity_mismatch",
      });
    }
    const existingJoins = Array.isArray(record.physical_outcome_joins)
      ? record.physical_outcome_joins
      : [];
    const joins = [
      ...existingJoins.filter(
        (join) => asObject(join).join_id !== parsed.data.join_id,
      ),
      parsed.data,
    ];
    await db.collection("robotEvalJobRequests").doc(requestId).set(
      {
        physical_outcome_joins: joins,
        physical_outcome_join_count: joins.length,
        physical_outcomes_are_observations_only: true,
        method_recalibration_performed_by_webapp: false,
        updated_at_iso: new Date().toISOString(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return res.status(202).json({
      ok: true,
      request_id: requestId,
      join_id: parsed.data.join_id,
      status: "recorded_for_pipeline_review",
      method_recalibration_performed: false,
    });
  },
);

router.post(
  "/:jobId/pipeline-status",
  pipelineSyncRateLimiter,
  requirePipelineSync,
  async (req, res) => {
  if (!db) {
    return res.status(503).json({
      error: "Robot eval job status store is not configured.",
      code: "robot_eval_status_store_not_configured",
    });
  }

  const jobId = String(req.params.jobId || "").trim();
  const body = asObject(req.body);
  const bodyJobId = String(body.request_id || body.job_id || jobId).trim();
  if (!jobId || bodyJobId !== jobId) {
    return res.status(400).json({
      error: "Pipeline status job_id does not match route job_id.",
      code: "robot_eval_job_id_mismatch",
    });
  }

  const suppliedDecisionEnvelope = body.decision_envelope;
  const decisionProjection = suppliedDecisionEnvelope
    ? projectDecisionEnvelope(suppliedDecisionEnvelope)
    : null;
  if (decisionProjection && !decisionProjection.supported) {
    return res.status(400).json({
      error: decisionProjection.reason,
      code: "unsupported_decision_envelope",
      raw_state: decisionProjection.raw_state,
    });
  }
  if (decisionProjection?.supported && decisionProjection.envelope.request_id !== jobId) {
    return res.status(400).json({
      error: "Decision envelope request_id does not match route request id.",
      code: "decision_envelope_request_id_mismatch",
    });
  }

  const artifactPayload = decisionProjection?.supported
    ? decisionProjection.envelope.artifacts
    : asObject(body.result_artifacts || body.artifacts);
  const artifactViolations = validatePipelineArtifactUris({ artifacts: artifactPayload });
  if (artifactViolations.length > 0) {
    return res.status(400).json({
      error: "Pipeline status artifact URIs are outside the allowed storage boundary.",
      code: "invalid_pipeline_artifact_uri",
      violations: artifactViolations,
    });
  }

  const suppliedBenchmarkProjection =
    body.benchmark_projection ?? body.webapp_benchmark_projection;
  let benchmarkProjection: BenchmarkProjection | null = null;
  if (suppliedBenchmarkProjection !== undefined) {
    try {
      benchmarkProjection = parseBenchmarkProjection(suppliedBenchmarkProjection);
    } catch (error) {
      return res.status(400).json({
        error: "Pipeline status benchmark projection is invalid or contains private fields.",
        code: "invalid_benchmark_projection",
        detail: error instanceof Error ? error.message : "invalid benchmark projection",
      });
    }
  }

  const nowIso = new Date().toISOString();
  const pipelineStatus = String(body.pipeline_status || body.status || "").trim();
  const legacyStateMap: Record<string, string> = {
    queued_for_pipeline: "submitted",
    accepted: "accepted",
    planning: "planning",
    pipeline_running: "running",
    running: "running",
    aggregating: "aggregating",
    failed: "failed",
    blocked: "blocked",
  };
  const nextStatus = decisionProjection?.supported
    ? decisionProjection.envelope.state
    : legacyStateMap[pipelineStatus] || "blocked";
  if (!decisionProjection && pipelineStatus && !legacyStateMap[pipelineStatus]) {
    return res.status(400).json({
      error:
        "Pipeline status is unsupported without a blueprint.decision_envelope.v1 result.",
      code: "unsupported_pipeline_state",
      raw_state: pipelineStatus,
    });
  }
  const existingSnapshot = await db
    .collection("robotEvalJobRequests")
    .doc(jobId)
    .get();
  if (!existingSnapshot.exists) {
    return res.status(404).json({
      error: "Task Evaluation Run request was not found.",
      code: "task_evaluation_run_not_found",
    });
  }
  const existingData = (existingSnapshot.data() || {}) as Record<string, unknown>;
  if (
    decisionProjection?.supported &&
    stringValue(existingData.decision_id) &&
    decisionProjection.envelope.decision_id !== stringValue(existingData.decision_id)
  ) {
    return res.status(400).json({
      error: "Decision envelope decision_id does not match the stored request.",
      code: "decision_envelope_decision_id_mismatch",
    });
  }
  const update = {
    status: nextStatus,
    pipeline_status: pipelineStatus || nextStatus,
    result_artifacts: decisionProjection?.supported
      ? decisionProjection.envelope.artifacts
      : asObject(body.result_artifacts || body.artifacts),
    ...(decisionProjection?.supported
      ? { decision_envelope: decisionProjection.envelope }
      : {}),
    pipeline_result: {
      job_id: bodyJobId,
      pipeline_status: pipelineStatus || nextStatus,
      result_artifacts: decisionProjection?.supported
        ? decisionProjection.envelope.artifacts
        : asObject(body.result_artifacts || body.artifacts),
      ...(decisionProjection?.supported
        ? { decision_envelope: decisionProjection.envelope }
        : {}),
      ...(body.proof_boundary ? { proof_boundary: asObject(body.proof_boundary) } : {}),
      ...(body.error ? { error: "Pipeline reported a blocked or failed run." } : {}),
      ...(benchmarkProjection ? { benchmark_projection: benchmarkProjection } : {}),
      received_at_iso: nowIso,
    },
    ...(benchmarkProjection ? { benchmark_projection: benchmarkProjection } : {}),
    ...(body.proof_boundary ? { proof_boundary: body.proof_boundary } : {}),
    ...(body.error ? { error: "Pipeline reported a blocked or failed run." } : {}),
    updated_at_iso: nowIso,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("robotEvalJobRequests").doc(jobId).set(update, { merge: true });
  return res.json(statusResponse(jobId, update));
  },
);

export default router;
