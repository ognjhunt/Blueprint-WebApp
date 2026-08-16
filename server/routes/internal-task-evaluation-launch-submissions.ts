import { Router, type Request, type Response } from "express";

import { submitTaskEvaluationLaunch } from "./admin-task-evaluation-launches";
import {
  createTaskEvaluationLaunchSubmissionRateLimiter,
  verifyTaskEvaluationLaunchSubmissionRequest,
} from "../utils/taskEvaluationLaunchSubmissionAuth";

const router = Router();
const rateLimiter = createTaskEvaluationLaunchSubmissionRateLimiter();

function requireLaunchSubmissionSignature(req: Request, res: Response, next: () => void) {
  res.set("Cache-Control", "no-store");
  const result = verifyTaskEvaluationLaunchSubmissionRequest(req);
  if (!result.ok) return res.status(result.status).json({
    error: result.message,
    code: result.code,
    provider_mutation_performed_inside_web_request: false,
  });
  res.locals.taskEvaluationLaunchSubmissionClientId = result.clientId;
  next();
}

router.post("/", rateLimiter, requireLaunchSubmissionSignature, async (req, res) => {
  const idempotencyKey = String(req.header("Idempotency-Key") || "").trim();
  if (!idempotencyKey) return res.status(400).json({
    error: "Task Evaluation launch submission idempotency key is required.",
    code: "task_evaluation_launch_submit_idempotency_key_missing",
    provider_mutation_performed_inside_web_request: false,
  });
  if (idempotencyKey !== String(req.body?.launch_id || "")) return res.status(409).json({
    error: "Task Evaluation launch submission idempotency key must equal launch_id.",
    code: "task_evaluation_launch_submit_idempotency_key_mismatch",
    provider_mutation_performed_inside_web_request: false,
  });
  return submitTaskEvaluationLaunch(req, res, {
    actorId: String(res.locals.taskEvaluationLaunchSubmissionClientId),
    actorRole: "ops",
    channel: "production_webapp_service_api",
    serviceId: String(res.locals.taskEvaluationLaunchSubmissionClientId),
    idempotencyKey,
  });
});

export default router;
