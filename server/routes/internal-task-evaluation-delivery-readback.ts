import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import {
  readTaskEvaluationDelivery,
  TaskEvaluationDeliveryReadbackError,
  taskEvaluationDeliveryReadbackRequestSchema,
} from "../utils/taskEvaluationDeliveryReadback";

const router = Router();
const rateLimiter = createPipelineSyncRateLimiter();

router.post("/capture-task-evaluation-runs/readback", rateLimiter, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const authentication = verifyPipelineSyncRequest(req);
  if (!authentication.ok) {
    return res.status(authentication.status).json({ error: authentication.message, code: authentication.code });
  }
  // This endpoint returns bearer download capabilities, so legacy unsigned
  // token authentication cannot replace the explicitly signed request body.
  if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature")) {
    return res.status(401).json({ error: "Signed readback request required", code: "missing_pipeline_sync_signature" });
  }
  const parsed = taskEvaluationDeliveryReadbackRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid delivery readback request", code: "delivery_readback_request_invalid" });
  if (!db) return res.status(503).json({ error: "Result store unavailable", code: "delivery_readback_store_unavailable" });
  try {
    return res.status(200).json(await readTaskEvaluationDelivery(db, parsed.data));
  } catch (error) {
    if (error instanceof TaskEvaluationDeliveryReadbackError) {
      return res.status(error.status).json({ error: error.code, code: error.code });
    }
    return res.status(503).json({ error: "Result readback unavailable", code: "delivery_readback_store_unavailable" });
  }
});

export default router;
