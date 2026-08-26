import { Router, type Request, type Response } from "express";

import {
  readTaskEvaluationLaunchPreparationStatus,
  submitTaskEvaluationLaunchPreparation,
} from "./admin-task-evaluation-launches";
import {
  createTaskEvaluationLaunchSubmissionRateLimiter,
  verifyTaskEvaluationLaunchSubmissionRequest,
} from "../utils/taskEvaluationLaunchSubmissionAuth";

const router = Router();
const rateLimiter = createTaskEvaluationLaunchSubmissionRateLimiter();

function requirePreparationSubmissionSignature(
  req: Request,
  res: Response,
  next: () => void,
) {
  res.set("Cache-Control", "no-store");
  const result = verifyTaskEvaluationLaunchSubmissionRequest(req);
  if (!result.ok) return res.status(result.status).json({
    error: result.message,
    code: result.code,
    provider_mutation_performed_inside_web_request: false,
    catalog_mutation_performed_inside_web_request: false,
    paid_execution_requested: false,
  });
  res.locals.taskEvaluationLaunchPreparationClientId = result.clientId;
  next();
}

function requirePreparationStatusSignature(
  req: Request,
  res: Response,
  next: () => void,
) {
  res.set("Cache-Control", "no-store");
  const result = verifyTaskEvaluationLaunchSubmissionRequest(req, {
    allowEmptyRawBody: true,
  });
  if (!result.ok) return res.status(result.status).json({
    error: result.message,
    code: result.code,
    provider_mutation_performed_by_status_read: false,
  });
  next();
}

router.post("/", rateLimiter, requirePreparationSubmissionSignature, async (req, res) => {
  const idempotencyKey = String(req.header("Idempotency-Key") || "").trim();
  if (!idempotencyKey) return res.status(400).json({
    error: "Task Evaluation preparation submission idempotency key is required.",
    code: "task_evaluation_launch_preparation_idempotency_key_missing",
    provider_mutation_performed_inside_web_request: false,
    catalog_mutation_performed_inside_web_request: false,
    paid_execution_requested: false,
  });
  if (idempotencyKey !== String(req.body?.preparation_id || "")) return res.status(409).json({
    error: "Task Evaluation preparation idempotency key must equal preparation_id.",
    code: "task_evaluation_launch_preparation_idempotency_key_mismatch",
    provider_mutation_performed_inside_web_request: false,
    catalog_mutation_performed_inside_web_request: false,
    paid_execution_requested: false,
  });
  const clientId = String(res.locals.taskEvaluationLaunchPreparationClientId);
  return submitTaskEvaluationLaunchPreparation(req, res, {
    actorId: clientId,
    actorRole: "ops",
    channel: "production_webapp_service_api",
    serviceId: clientId,
    idempotencyKey,
  });
});

router.get(
  "/:preparationId",
  rateLimiter,
  requirePreparationStatusSignature,
  async (req, res) => readTaskEvaluationLaunchPreparationStatus(req.params.preparationId, res),
);

export default router;
