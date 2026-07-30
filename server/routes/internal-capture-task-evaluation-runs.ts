import { createHash } from "node:crypto";

import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { parseVerifiedTaskEvaluationRunPublication } from "../utils/taskEvaluationRunContract";
import { stableJson } from "../utils/taskCandidateContract";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();

function requirePipelineSignature(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) return res.status(result.status).json({ error: result.message, code: result.code });
  next();
}

router.post("/capture-task-evaluation-runs", rateLimiter, requirePipelineSignature, async (req, res) => {
  if (!db) return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  const verified = parseVerifiedTaskEvaluationRunPublication(req.body);
  if (!verified.ok) return res.status(400).json({ error: "Pipeline run publication is invalid", blockers: verified.blockers });
  const publication = verified.publication;
  const sessionRef = db.collection("captureUploadSessions").doc(publication.capture_session_id);
  const recordId = `capture-run-${createHash("sha256").update(`${publication.capture_session_id}\0${publication.run_id}`).digest("hex").slice(0, 32)}`;
  const runRef = db.collection("captureTaskEvaluationRuns").doc(recordId);
  type Outcome = "created" | "replayed" | "not_found" | "intake_mismatch" | "testbed_mismatch" | "immutable_conflict";
  let outcome: Outcome;
  try {
    outcome = await db.runTransaction<Outcome>(async (transaction) => {
      const sessionSnapshot = await transaction.get(sessionRef);
      const runSnapshot = await transaction.get(runRef);
      if (!sessionSnapshot.exists) return "not_found";
      const session = sessionSnapshot.data() as Record<string, any>;
      if (session.request?.intake_id !== publication.intake_id) return "intake_mismatch";
      if (session.pipeline_site_task_testbed?.testbed_digest !== publication.testbed_digest) return "testbed_mismatch";
      const record = {
        schema_version: "capture_task_evaluation_run_record.v1",
        publication,
      };
      if (runSnapshot.exists && stableJson(runSnapshot.data()) !== stableJson(record)) return "immutable_conflict";
      if (!runSnapshot.exists) transaction.create(runRef, record);
      transaction.set(sessionRef, {
        pipeline_task_evaluation_run: record,
        pipeline_run_state: publication.state,
        pipeline_run_projection_updated_at_iso: new Date().toISOString(),
      }, { merge: true });
      return runSnapshot.exists ? "replayed" : "created";
    });
  } catch {
    return res.status(503).json({ error: "Task Evaluation Run store is unavailable" });
  }
  if (outcome === "not_found") return res.status(404).json({ error: "Capture upload not found" });
  if (outcome === "intake_mismatch") return res.status(409).json({ error: "Capture intake binding mismatch" });
  if (outcome === "testbed_mismatch") return res.status(409).json({ error: "Current testbed digest mismatch" });
  if (outcome === "immutable_conflict") return res.status(409).json({ error: "Immutable Task Evaluation Run conflict" });
  res.set("Cache-Control", "no-store");
  return res.status(outcome === "replayed" ? 200 : 201).json({
    schema_version: "capture_task_evaluation_run_publication_receipt.v1",
    status: publication.state,
    already_exists: outcome === "replayed",
    capture_session_id: publication.capture_session_id,
    intake_id: publication.intake_id,
    run_id: publication.run_id,
    testbed_digest: publication.testbed_digest,
    request_digest: publication.request_digest,
    plan_digest: publication.plan_digest,
    decision_envelope_digest: publication.decision_envelope.decision_envelope_digest,
    proof_boundary: publication.proof_boundary,
  });
});

export default router;
