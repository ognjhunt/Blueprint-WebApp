import { Request, Response, Router } from "express";
import path from "node:path";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken";
import {
  forwardRobotEvalJobRequestToPipeline,
  robotEvalJobRequestForwardErrorMessage,
  validateRobotEvalJobRequest,
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
  return tokens;
}

function requestedEntitlementId(jobRequest: Record<string, unknown>) {
  const entitlement = asObject(jobRequest.entitlement);
  return stringValue(
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

  const entitlement = {
    ...parsed,
    id: stringValue(parsed.id || parsed.entitlement_id) || "local-robot-eval-route-proof",
    buyer_user_id: stringValue(parsed.buyer_user_id || parsed.buyerUserId) || params.buyerUserId,
    access_state: stringValue(parsed.access_state) || "provisioned",
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

// P1-D: durable buyer-facing run summary. Every field is read from the stored
// robotEvalJobRequests record (written by the POST intake path or the
// pipeline-status callback) — nothing is synthesized for display.
function buyerRunSummary(jobId: string, data: Record<string, unknown>) {
  const entitlementProof = asObject(data.entitlement_proof);
  return {
    job_id: jobId,
    status: String(data.status || "unknown"),
    pipeline_status: data.pipeline_status || null,
    site_slug: stringValue(data.site_slug) || null,
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
  return {
    ok: true,
    job_id: jobId,
    status: String(data.status || "unknown"),
    pipeline_status: data.pipeline_status || pipelineResult.status || null,
    result_artifacts: data.result_artifacts || pipelineResult.result_artifacts || {},
    proof_boundary: data.proof_boundary || pipelineResult.proof_boundary || {},
    error: data.error || pipelineResult.error || null,
    updated_at_iso: data.updated_at_iso || null,
    created_at_iso: data.created_at_iso || null,
    pipeline_forward: data.pipeline_forward || null,
  };
}

// WEB-02: require an authenticated buyer to submit an eval job. Previously
// unauthenticated, which let anyone inject robot_eval_job_request records and
// trigger pipeline forwarding. The buyer's uid is attributed to the record so the
// status route can enforce ownership. (The machine-only /:jobId/pipeline-status
// callback keeps its HMAC guard instead of a Firebase token.)
router.post("/", verifyFirebaseToken, async (req, res) => {
  const submittedJobRequest = req.body;
  const validation = validateRobotEvalJobRequest(submittedJobRequest);
  if (!validation.ok) {
    return res.status(400).json({
      error: "Invalid robot_eval_job_request.v1",
      validation_errors: validation.errors,
    });
  }

  const buyerUserId = String(
    (res.locals.firebaseUser as { uid?: string } | undefined)?.uid || "",
  ).trim();

  // Beta cohort policy applies to buyer intake exactly like capture intake:
  // a denial must happen before any inbox record, Firestore write, or
  // Pipeline forwarding is created. The credential-free local route-proof
  // identity (non-production only, see verifyFirebaseToken) exercises
  // forwarding mechanics and is exempt the same way it uses a local
  // entitlement proof instead of Firestore entitlements.
  const isLocalRouteProof = Boolean(
    (res.locals.firebaseUser as { localRouteProof?: boolean } | undefined)?.localRouteProof,
  );
  const betaCohortDecision = isLocalRouteProof
    ? null
    : await evaluateBetaCohortGate({
        gate: "robot_eval_request",
        creatorId: buyerUserId || null,
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

  const entitlementCheck = await verifyRobotEvalEntitlement({
    buyerUserId,
    jobRequest: submittedJobRequest,
  });
  if (!entitlementCheck.ok) {
    return res.status(entitlementCheck.status).json({
      ok: false,
      status: "robot_eval_entitlement_verification_failed",
      code: entitlementCheck.code,
      error: entitlementCheck.error,
    });
  }

  const jobRequest = entitlementCheck.jobRequest;
  const entitlementProof = publicEntitlementProof(entitlementCheck.entitlement);
  const jobId = String(jobRequest.job_id || "").trim();
  const buyerRequestId = String(jobRequest.buyer_request_id || "").trim();

  const queuedAt = new Date().toISOString();
  const inbox = await writeRobotEvalJobRequestInbox({
    rootDir: process.env.ROBOT_EVAL_JOB_REQUEST_INBOX_DIR || DEFAULT_INBOX_DIR,
    jobRequest,
    queuedAt,
  });
  const pipelineForward = await forwardRobotEvalJobRequestToPipeline({
    jobRequest,
    queuedAt,
  });
  const pipelineForwardBlocksAcceptance =
    pipelineForward.required === true && pipelineForward.performed !== true;
  const recordStatus = pipelineForwardBlocksAcceptance
    ? "pipeline_forward_failed"
    : "queued_for_pipeline";
  const record = {
    jobRequest,
    schema_version: jobRequest.schema_version,
    job_id: jobId,
    buyer_user_id: buyerUserId,
    buyer_request_id: buyerRequestId,
    site_slug:
      typeof jobRequest.site_package === "object" && jobRequest.site_package !== null
        ? String((jobRequest.site_package as Record<string, unknown>).site_slug || "")
        : "",
    site_submission_id:
      typeof jobRequest.site_package === "object" && jobRequest.site_package !== null
        ? String((jobRequest.site_package as Record<string, unknown>).site_submission_id || "")
        : "",
    capture_job_id:
      typeof jobRequest.site_package === "object" && jobRequest.site_package !== null
        ? String((jobRequest.site_package as Record<string, unknown>).capture_job_id || "")
        : "",
    capture_id:
      typeof jobRequest.site_package === "object" && jobRequest.site_package !== null
        ? String((jobRequest.site_package as Record<string, unknown>).capture_id || "")
        : "",
    status: recordStatus,
    error: pipelineForwardBlocksAcceptance
      ? robotEvalJobRequestForwardErrorMessage(pipelineForward)
      : null,
    pipeline_command: "blueprint-run-robot-eval-job",
    pipeline_inbox: inbox,
    pipeline_forward: pipelineForward,
    entitlement_proof: entitlementProof,
    created_at_iso: queuedAt,
    updated_at_iso: queuedAt,
    proof_boundary: {
      simulator_execution_proven: false,
      rank_fidelity_result_proven: false,
      robot_policy_execution_proven: false,
      physics_contact_validated: false,
      non_ranking_operational_claim_validated: false,
      public_claim_upgrade_allowed: false,
    },
  };

  const firestoreWriteDisabled = truthy(
    process.env.ROBOT_EVAL_JOB_REQUEST_DISABLE_FIRESTORE_WRITE,
  );
  let firestoreWritePerformed = false;
  if (db && !firestoreWriteDisabled) {
    await db.collection("robotEvalJobRequests").doc(jobId).set(
      {
        ...record,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    firestoreWritePerformed = true;
  }

  if (betaCohortDecision) {
    await recordBetaCohortAdmission({
      gate: "robot_eval_request",
      admissionId: `robot_eval:${jobId}`,
      decision: betaCohortDecision,
      creatorId: buyerUserId || null,
      source: "robot_eval_job_request_intake",
    });
  }

  const durableStore = buildDurableStoreProof({
    firestoreWritePerformed,
    firestoreWriteDisabled,
    firestoreCollection: "robotEvalJobRequests",
    firestoreDocId: jobId,
    inbox,
    pipelineForward,
  });
  if (pipelineForwardBlocksAcceptance) {
    await recordBetaOpsFailureSignal({
      kind: "intake_forwarding_failure",
      scopeId: jobId || buyerRequestId || "robot-eval-job-request",
      severity: "critical",
      summary: "Robot eval job request forwarding to Pipeline failed while forwarding was required.",
      details: {
        job_id: jobId,
        buyer_request_id: buyerRequestId,
        pipeline_forward: pipelineForward,
        durable_store: durableStore,
      },
    });
    return res.status(502).json({
      ok: false,
      status: "pipeline_forward_failed",
      error: robotEvalJobRequestForwardErrorMessage(pipelineForward),
      durableStore,
      pipelineInbox: inbox,
      pipelineForward,
      entitlementProof,
      jobRequest,
    });
  }

  // Paid self-serve entitlements (sku "<siteSlug>-robot-eval-run") cover exactly
  // one accepted run. Consume them here — after acceptance, never on the 502
  // forward-failure path above — so one $-per-run purchase cannot be replayed
  // into unlimited runs. Back-office/site-package/hosted-session entitlements
  // are untouched.
  const verifiedEntitlement = entitlementCheck.entitlement;
  const verifiedEntitlementId = stringValue(verifiedEntitlement.id);
  const verifiedEntitlementSku = normalizedToken(verifiedEntitlement.sku);
  const isFirestoreBackedEntitlement = !stringValue(verifiedEntitlement.proof_source);
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
        consumed_by_job_id: jobId,
        updated_at: queuedAt,
      },
      { merge: true },
    );
  }

  return res.status(202).json({
    ok: true,
    status: "queued_for_pipeline",
    durableStore,
    pipelineInbox: inbox,
    pipelineForward,
    entitlementProof,
    jobRequest,
  });
});

// P1-D: buyer-scoped run list. Records are keyed to the buyer by the
// buyer_user_id field the authenticated POST intake path writes, so the query
// can only ever return the caller's own job requests.
router.get("/", verifyFirebaseToken, async (_req, res) => {
  if (!db) {
    return res.status(503).json({
      error: "Robot eval job status store is not configured.",
      code: "robot_eval_status_store_not_configured",
    });
  }

  const callerUid = String(
    (res.locals.firebaseUser as { uid?: string } | undefined)?.uid || "",
  ).trim();
  if (!callerUid) {
    return res.status(401).json({
      error: "Missing authenticated buyer.",
      code: "robot_eval_missing_authenticated_buyer",
    });
  }

  const snapshot = await db
    .collection("robotEvalJobRequests")
    .where("buyer_user_id", "==", callerUid)
    .limit(BUYER_RUN_LIST_LIMIT)
    .get();

  // Sort newest-first in memory (single equality filter keeps the query free
  // of composite-index requirements).
  const jobRequests = (snapshot.docs || [])
    .map((doc) => buyerRunSummary(doc.id, (doc.data() || {}) as Record<string, unknown>))
    .sort((a, b) => {
      const left = a.created_at_iso || "";
      const right = b.created_at_iso || "";
      return left < right ? 1 : left > right ? -1 : 0;
    });

  return res.json({
    ok: true,
    count: jobRequests.length,
    job_requests: jobRequests,
  });
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

  // P1-D: include the stored run summary fields (site/task labels, entitlement
  // linkage) so the buyer run detail page can render without a second lookup.
  // statusResponse spreads last so its status/error fallbacks win.
  return res.json({
    ...buyerRunSummary(jobId, data),
    ...statusResponse(jobId, data),
  });
});

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
  const bodyJobId = String(body.job_id || jobId).trim();
  if (!jobId || bodyJobId !== jobId) {
    return res.status(400).json({
      error: "Pipeline status job_id does not match route job_id.",
      code: "robot_eval_job_id_mismatch",
    });
  }

  const artifactViolations = validatePipelineArtifactUris({
    artifacts: asObject(body.result_artifacts || body.artifacts),
  });
  if (artifactViolations.length > 0) {
    return res.status(400).json({
      error: "Pipeline status artifact URIs are outside the allowed storage boundary.",
      code: "invalid_pipeline_artifact_uri",
      violations: artifactViolations,
    });
  }

  const nowIso = new Date().toISOString();
  const pipelineStatus = String(body.pipeline_status || body.status || "").trim();
  const nextStatus =
    pipelineStatus === "completed" || pipelineStatus === "succeeded"
      ? "completed"
      : pipelineStatus === "failed" || pipelineStatus === "blocked"
        ? "failed"
        : pipelineStatus || "pipeline_running";
  const update = {
    status: nextStatus,
    pipeline_status: pipelineStatus || nextStatus,
    result_artifacts: asObject(body.result_artifacts || body.artifacts),
    pipeline_result: {
      ...body,
      received_at_iso: nowIso,
    },
    ...(body.proof_boundary ? { proof_boundary: body.proof_boundary } : {}),
    ...(body.error ? { error: body.error } : {}),
    updated_at_iso: nowIso,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.collection("robotEvalJobRequests").doc(jobId).set(update, { merge: true });
  return res.json(statusResponse(jobId, update));
  },
);

export default router;
