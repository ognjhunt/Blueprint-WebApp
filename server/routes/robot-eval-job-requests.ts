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

const router = Router();
const pipelineSyncRateLimiter = createPipelineSyncRateLimiter();
const DEFAULT_INBOX_DIR = path.resolve(
  process.cwd(),
  "output/pipeline/robot_eval_job_requests/inbox",
);

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

function normalizeIdentifier(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

// Mirror marketplaceSkuFromPipeline (server/routes/internal-pipeline.ts): the
// pipeline publishes captured-site packages under robot-eval-<slug(id)>.
function robotEvalSkuFromIdentifier(identifier: string): string {
  const raw = identifier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `robot-eval-${raw || "package"}`;
}

// R030: prove server-side that this authenticated buyer holds a provisioned,
// non-revoked marketplace entitlement for the requested site BEFORE we persist or
// forward the job. Client-supplied entitlement.approved is never trusted; rights
// are derived from the returned record. Matching mirrors the two existing linkage
// idioms in this repo (server/utils/robot-agent-commerce.ts
// findProvisionedHostedSessionEntitlement and server/utils/consentRevocationTakedown.ts):
//   - by minted sku (robot-eval-<slug>, site-world-package-<id>, hosted-session-<id>)
//   - by a direct capture_id/scene_id/site_submission_id/... field on the entitlement
async function findProvisionedEntitlementForSite(params: {
  buyerUserId: string;
  sitePackage: Record<string, unknown>;
}): Promise<Record<string, unknown> | null> {
  if (!db || !params.buyerUserId) {
    return null;
  }
  const sitePackage = params.sitePackage;
  const siteIdentifiers = new Set(
    [
      sitePackage.site_slug,
      sitePackage.site_id,
      sitePackage.site_submission_id,
      sitePackage.capture_job_id,
      sitePackage.capture_id,
      sitePackage.scene_id,
    ]
      .map(normalizeIdentifier)
      .filter(Boolean),
  );
  if (siteIdentifiers.size === 0) {
    return null;
  }

  const candidateSkus = new Set<string>();
  for (const identifier of siteIdentifiers) {
    candidateSkus.add(identifier);
    candidateSkus.add(robotEvalSkuFromIdentifier(identifier));
    candidateSkus.add(`site-world-package-${identifier}`);
    candidateSkus.add(`hosted-session-${identifier}`);
  }

  const directLinkFields = [
    "capture_id",
    "scene_id",
    "site_submission_id",
    "site_world_id",
    "site_slug",
    "site_id",
    "capture_job_id",
  ];

  const snapshot = await db
    .collection("marketplaceEntitlements")
    .where("buyer_user_id", "==", params.buyerUserId)
    .get();

  for (const doc of snapshot.docs || []) {
    const data = (doc.data() || {}) as Record<string, unknown>;
    // Only a provisioned entitlement grants rights; this also excludes "revoked"
    // (consent takedown) and "manual_review_required".
    if (normalizeIdentifier(data.access_state) !== "provisioned") {
      continue;
    }
    const skuMatch = candidateSkus.has(normalizeIdentifier(data.sku));
    const directMatch = directLinkFields.some((field) =>
      siteIdentifiers.has(normalizeIdentifier(data[field])),
    );
    if (skuMatch || directMatch) {
      return { id: doc.id || String(data.id || ""), ...data };
    }
  }
  return null;
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
  const jobRequest = req.body;
  const validation = validateRobotEvalJobRequest(jobRequest);
  if (!validation.ok) {
    return res.status(400).json({
      error: "Invalid robot_eval_job_request.v1",
      validation_errors: validation.errors,
    });
  }

  const firebaseUser = res.locals.firebaseUser as
    | { uid?: string; admin?: boolean; role?: string; localRouteProof?: boolean }
    | undefined;
  const buyerUserId = String(firebaseUser?.uid || "").trim();
  const jobId = String(jobRequest.job_id || "").trim();
  const buyerRequestId = String(jobRequest.buyer_request_id || "").trim();

  // R030: enforce a real marketplace entitlement for buyer-originated requests.
  // Previously the handler took req.body verbatim, so any authenticated user could
  // submit an eval job for any site by claiming entitlement.approved=true.
  //
  // Internal/owner-agent principals (the verifyFirebaseToken localRouteProof route
  // proof identity and admins, mirroring the /:jobId/status admin bypass) run
  // trusted first-party flows and are exempt. External buyers must present a
  // provisioned, non-revoked marketplace entitlement for the requested site. The
  // check only runs when Firestore is available; without it we cannot query and
  // fall back to the route's existing db-not-configured tolerance.
  const isInternalPrincipal =
    firebaseUser?.localRouteProof === true ||
    firebaseUser?.role === "local_route_proof" ||
    firebaseUser?.admin === true ||
    firebaseUser?.role === "admin";
  if (db && !isInternalPrincipal) {
    const entitlement = await findProvisionedEntitlementForSite({
      buyerUserId,
      sitePackage: asObject(jobRequest.site_package),
    });
    if (!entitlement) {
      return res.status(403).json({
        error:
          "No provisioned marketplace entitlement was found for this buyer and site.",
        code: "no_entitlement_for_site",
      });
    }
    // Derive rights server-side: overwrite the entitlement block from the verified
    // record and never trust the client-supplied entitlement.approved.
    jobRequest.entitlement = {
      access_state: String(entitlement.access_state || "provisioned"),
      entitlement_id:
        String(
          (entitlement.id as string) || (entitlement.entitlement_id as string) || "",
        ) || null,
      approved: true,
      buyer_user_id: buyerUserId,
      sku: String((entitlement.sku as string) || "") || null,
      verified_by: "server_marketplace_entitlement_check",
    };
  }

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
    status: "queued_for_pipeline",
    pipeline_command: "blueprint-run-robot-eval-job",
    pipeline_inbox: inbox,
    pipeline_forward: pipelineForward,
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

  const durableStore = buildDurableStoreProof({
    firestoreWritePerformed,
    firestoreWriteDisabled,
    firestoreCollection: "robotEvalJobRequests",
    firestoreDocId: jobId,
    inbox,
    pipelineForward,
  });
  // R028: A request that never reaches the Pipeline is silent data loss. In
  // production we must fail loudly (5xx) whenever forwarding was not actually
  // performed (not_configured / blocked / failed), regardless of the
  // FORWARD_REQUIRED flag. Outside production we preserve the lenient behavior
  // gated on the operator's required flag so local/dev/test keep working.
  const isProductionRuntime = process.env.NODE_ENV === "production";
  const forwardReachedPipeline = pipelineForward.performed === true;
  const forwardMustSucceed =
    pipelineForward.required === true || isProductionRuntime;
  if (forwardMustSucceed && !forwardReachedPipeline) {
    // not_configured is a WebApp misconfiguration (no endpoint) -> 503; a blocked
    // or downstream-failed forward is a bad-gateway condition -> 502.
    const httpStatus = pipelineForward.status === "not_configured" ? 503 : 502;
    return res.status(httpStatus).json({
      ok: false,
      status: "pipeline_forward_failed",
      code: `pipeline_forward_${pipelineForward.status}`,
      error: robotEvalJobRequestForwardErrorMessage(pipelineForward),
      durableStore,
      pipelineInbox: inbox,
      pipelineForward,
      jobRequest,
    });
  }

  return res.status(202).json({
    ok: true,
    status: "queued_for_pipeline",
    durableStore,
    pipelineInbox: inbox,
    pipelineForward,
    jobRequest,
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

  return res.json(statusResponse(jobId, data));
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
