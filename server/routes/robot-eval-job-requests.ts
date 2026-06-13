import { Router } from "express";
import path from "node:path";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import {
  forwardRobotEvalJobRequestToPipeline,
  robotEvalJobRequestForwardErrorMessage,
  validateRobotEvalJobRequest,
  writeRobotEvalJobRequestInbox,
} from "../utils/robotEvalJobRequests";

const router = Router();
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

router.post("/", async (req, res) => {
  const jobRequest = req.body;
  const validation = validateRobotEvalJobRequest(jobRequest);
  if (!validation.ok) {
    return res.status(400).json({
      error: "Invalid robot_eval_job_request.v1",
      validation_errors: validation.errors,
    });
  }

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
  const record = {
    jobRequest,
    schema_version: jobRequest.schema_version,
    job_id: jobId,
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
      robot_readiness_proven: false,
      robot_policy_execution_proven: false,
      physics_contact_validated: false,
      safety_validated: false,
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
  if (pipelineForward.required && !pipelineForward.performed) {
    return res.status(502).json({
      ok: false,
      status: "pipeline_forward_failed",
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

export default router;
