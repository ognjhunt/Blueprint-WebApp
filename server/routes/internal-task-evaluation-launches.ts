import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import {
  parseTaskEvaluationLaunchReceipt,
  parseTaskEvaluationLaunchSupervision,
} from "../utils/taskEvaluationLaunchContract";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();

function requirePipelineSignature(req: Request, res: Response, next: () => void) {
  const result = verifyPipelineSyncRequest(req);
  if (!result.ok) return res.status(result.status).json({
    error: result.message,
    code: result.code,
  });
  next();
}

router.post(
  "/task-evaluation-launches",
  rateLimiter,
  requirePipelineSignature,
  async (req, res) => {
    if (!db) return res.status(503).json({ error: "Task Evaluation launch store is unavailable" });
    const parsed = parseTaskEvaluationLaunchReceipt(req.body);
    if (!parsed.ok) return res.status(400).json({
      error: "Pipeline Task Evaluation launch receipt is invalid",
      blockers: parsed.blockers,
    });
    const receipt = parsed.receipt;
    const ref = db.collection("taskEvaluationLaunches").doc(receipt.launch_id);
    type Outcome = "updated" | "replayed" | "not_found" | "binding_mismatch" | "immutable_conflict";
    let outcome: Outcome;
    try {
      outcome = await db.runTransaction<Outcome>(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists) return "not_found";
        const existing = snapshot.data() as Record<string, any>;
        if (
          existing.request_digest !== receipt.request_digest
          || existing.run_id !== receipt.run_id
        ) return "binding_mismatch";
        if (existing.terminal_receipt) {
          return existing.terminal_receipt.receipt_digest === receipt.receipt_digest
            ? "replayed"
            : "immutable_conflict";
        }
        transaction.set(ref, {
          state: receipt.status,
          terminal_receipt: receipt,
          terminal_receipt_digest: receipt.receipt_digest,
          provider_mutation_observed: receipt.provider_mutation_attempted,
          terminal_updated_at_iso: new Date().toISOString(),
        }, { merge: true });
        return "updated";
      });
    } catch {
      return res.status(503).json({ error: "Task Evaluation launch store is unavailable" });
    }
    if (outcome === "not_found") return res.status(404).json({ error: "Task Evaluation launch not found" });
    if (outcome === "binding_mismatch") return res.status(409).json({ error: "Task Evaluation launch binding mismatch" });
    if (outcome === "immutable_conflict") return res.status(409).json({ error: "Immutable Task Evaluation launch receipt conflict" });
    res.set("Cache-Control", "no-store");
    return res.status(outcome === "replayed" ? 200 : 201).json({
      schema_version: "task_evaluation_launch_web_sync_receipt.v1",
      status: receipt.status,
      already_exists: outcome === "replayed",
      launch_id: receipt.launch_id,
      run_id: receipt.run_id,
      request_digest: receipt.request_digest,
      receipt_digest: receipt.receipt_digest,
    });
  },
);

router.post(
  "/task-evaluation-launch-supervision",
  rateLimiter,
  requirePipelineSignature,
  async (req, res) => {
    if (!db) return res.status(503).json({ error: "Task Evaluation supervision store is unavailable" });
    const parsed = parseTaskEvaluationLaunchSupervision(req.body);
    if (!parsed.ok) return res.status(400).json({
      error: "Pipeline Task Evaluation supervision is invalid",
      blockers: parsed.blockers,
    });
    const supervision = parsed.supervision;
    const recordId = supervision.snapshot_digest.replace("sha256:", "");
    const ref = db.collection("taskEvaluationLaunchSupervision").doc(recordId);
    let alreadyExists = false;
    try {
      await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(ref);
        if (existing.exists) {
          const prior = existing.data() as Record<string, unknown>;
          if (prior.supervision_digest !== supervision.supervision_digest) {
            throw new Error("immutable_supervision_conflict");
          }
          alreadyExists = true;
          return;
        }
        transaction.create(ref, supervision);
      });
    } catch (error) {
      if (error instanceof Error && error.message === "immutable_supervision_conflict") {
        return res.status(409).json({ error: "Immutable launch supervision conflict" });
      }
      return res.status(503).json({ error: "Task Evaluation supervision store is unavailable" });
    }
    await db.collection("taskEvaluationLaunchSupervision").doc("latest").set({
      ...supervision,
      synced_at_iso: new Date().toISOString(),
    });
    return res.status(alreadyExists ? 200 : 201).json({
      schema_version: "task_evaluation_launch_supervision_web_sync_receipt.v1",
      status: "stored",
      already_exists: alreadyExists,
      snapshot_digest: supervision.snapshot_digest,
      supervision_digest: supervision.supervision_digest,
    });
  },
);

export default router;
