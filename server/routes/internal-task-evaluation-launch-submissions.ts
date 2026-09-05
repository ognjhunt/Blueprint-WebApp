import { Router, type Request, type Response } from "express";

import {
  preflightTaskEvaluationLaunch,
  submitTaskEvaluationLaunch,
} from "./admin-task-evaluation-launches";
import {
  createTaskEvaluationLaunchSubmissionRateLimiter,
  verifyTaskEvaluationLaunchSubmissionRequest,
} from "../utils/taskEvaluationLaunchSubmissionAuth";
import {
  internalPolicyCanarySelectionSchema,
  policyCanaryError,
} from "../utils/internalPolicyCanaryContract";
import {
  loadConfiguredSceneOffering,
  submitPolicyCanaryRun,
} from "../utils/policyCanaryRunSubmission";

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

router.post("/preflight", rateLimiter, requireLaunchSubmissionSignature, async (req, res) => {
  const idempotencyKey = String(req.header("Idempotency-Key") || "").trim();
  if (!idempotencyKey) return res.status(400).json({
    error: "Task Evaluation launch preflight idempotency key is required.",
    code: "task_evaluation_launch_preflight_idempotency_key_missing",
    provider_mutation_performed_inside_web_request: false,
  });
  if (idempotencyKey !== String(req.body?.launch_id || "")) return res.status(409).json({
    error: "Task Evaluation launch preflight idempotency key must equal launch_id.",
    code: "task_evaluation_launch_preflight_idempotency_key_mismatch",
    provider_mutation_performed_inside_web_request: false,
  });
  return preflightTaskEvaluationLaunch(req, res, {
    actorId: String(res.locals.taskEvaluationLaunchSubmissionClientId),
    actorRole: "ops",
    channel: "production_webapp_service_api",
    serviceId: String(res.locals.taskEvaluationLaunchSubmissionClientId),
    idempotencyKey,
  });
});

// The progression worker hands a passing controls pair into the Quick-10
// canary without a browser session. It sends the same immutable selection the
// offering page sends, signed as the production runner, which acts as ops;
// the pipeline receives the byte-identical request either way.
router.post(
  "/policy-canary-runs/:launchId",
  rateLimiter,
  requireLaunchSubmissionSignature,
  async (req: Request, res: Response) => {
    const parsed = internalPolicyCanarySelectionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(422).json(policyCanaryError(
      "POLICY_CANARY_CONFIGURATION_INVALID",
      "Policy canary configuration is invalid.",
      {
        violations: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    ));
    const selection = parsed.data;
    const idempotencyKey = String(req.header("Idempotency-Key") || "").trim();
    if (!idempotencyKey || idempotencyKey !== selection.run_id) {
      return res.status(409).json(policyCanaryError(
        "POLICY_CANARY_IDEMPOTENCY_CONFLICT",
        "Idempotency-Key must equal the immutable run_id.",
      ));
    }
    let loaded;
    try {
      loaded = await loadConfiguredSceneOffering(req.params.launchId);
    } catch {
      return res.status(503).json(policyCanaryError(
        "CONFIGURED_SCENE_STORE_UNAVAILABLE",
        "Configured scene offering store is unavailable.",
      ));
    }
    if (!loaded) return res.status(404).json(policyCanaryError(
      "CONFIGURED_SCENE_NOT_FOUND",
      "Configured scene offering was not found.",
    ));
    if (loaded.offering.status !== "configured_controls_pending") {
      return res.status(409).json(policyCanaryError(
        "POLICY_CANARY_REQUIRES_CONTROLS_PENDING_SCENE",
        "This channel starts internal controls-pending canaries only.",
        { offering_status: loaded.offering.status },
      ));
    }
    const clientId = String(res.locals.taskEvaluationLaunchSubmissionClientId);
    return submitPolicyCanaryRun({
      launchId: req.params.launchId,
      offering: loaded.offering,
      selection,
      access: { uid: clientId, email: null, isAdmin: false, isOps: true },
      res,
      submissionChannel: "production_webapp_service_api",
    });
  },
);

export default router;
