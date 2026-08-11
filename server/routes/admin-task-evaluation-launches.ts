import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { resolveAccessContext } from "../utils/access-control";
import {
  buildTaskEvaluationLaunchRequest,
  forwardTaskEvaluationLaunch,
  resolvePublishedLaunchProfiles,
  taskEvaluationLaunchInputSchema,
} from "../utils/taskEvaluationLaunchContract";
import {
  taskEvaluationLaunchStoreErrorCode,
  withTaskEvaluationLaunchStoreTimeout,
} from "../utils/taskEvaluationLaunchStore";

const router = Router();
const COLLECTION = "taskEvaluationLaunches";

router.use(requireAdminRole);

router.get("/profiles", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  return res.json({
    schema_version: "task_evaluation_launch_profile_catalog.v1",
    profiles: await resolvePublishedLaunchProfiles(),
  });
});

router.post("/", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Task Evaluation launch store is unavailable" });
  const parsed = taskEvaluationLaunchInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({
    error: "Task Evaluation launch request is invalid",
    code: "task_evaluation_launch_input_invalid",
  });
  if (Date.parse(parsed.data.spend.expires_at) <= Date.now()) return res.status(400).json({
    error: "Spend authority has expired",
    code: "task_evaluation_launch_spend_authority_expired",
  });
  const profile = (await resolvePublishedLaunchProfiles()).find((candidate) =>
    candidate.profile_id === parsed.data.profile_id
    && candidate.profile_digest === parsed.data.profile_digest,
  );
  if (!profile) return res.status(409).json({
    error: "Published Pipeline launch profile does not match",
    code: "task_evaluation_launch_profile_not_published",
  });
  const access = await resolveAccessContext(res);
  const actorId = access.uid || access.email;
  if (!actorId) return res.status(401).json({ error: "Authenticated actor identity is missing" });
  const freshRequest = buildTaskEvaluationLaunchRequest({
    input: parsed.data,
    profile,
    actorId,
    actorRole: access.isAdmin ? "admin" : "ops",
    authorizedAt: new Date().toISOString(),
  });
  const ref = db.collection(COLLECTION).doc(parsed.data.launch_id);
  const initialRecord = {
    schema_version: "task_evaluation_launch_web_record.v1",
    launch_id: parsed.data.launch_id,
    run_id: parsed.data.run_id,
    request: freshRequest,
    request_digest: freshRequest.request_digest,
    state: "forward_pending",
    forward_attempt_count: 0,
    provider_mutation_observed: false,
    created_at_iso: new Date().toISOString(),
  };
  let priorRecord: Record<string, any> | null;
  try {
    priorRecord = await withTaskEvaluationLaunchStoreTimeout(db.runTransaction(async (transaction): Promise<Record<string, any> | null> => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) {
        const existing = snapshot.data() as Record<string, any>;
        const originalAuthorizedAt = existing.request?.authorization?.authorized_at;
        if (typeof originalAuthorizedAt !== "string") {
          throw new Error("immutable_launch_conflict");
        }
        const replayRequest = buildTaskEvaluationLaunchRequest({
          input: parsed.data,
          profile,
          actorId,
          actorRole: access.isAdmin ? "admin" : "ops",
          authorizedAt: originalAuthorizedAt,
        });
        if (existing.request_digest !== replayRequest.request_digest) {
          throw new Error("immutable_launch_conflict");
        }
        return existing;
      }
      transaction.create(ref, initialRecord);
      return null;
    }));
  } catch (error) {
    if (error instanceof Error && error.message === "immutable_launch_conflict") {
      return res.status(409).json({
        error: "Immutable Task Evaluation launch conflict",
        code: "task_evaluation_launch_immutable_conflict",
      });
    }
    const code = taskEvaluationLaunchStoreErrorCode(error);
    logger.error({
      code,
      launchId: parsed.data.launch_id,
      runId: parsed.data.run_id,
    }, "Task Evaluation launch authority persistence failed");
    return res.status(503).json({
      error: "Task Evaluation launch store is unavailable",
      code,
      launch_id: parsed.data.launch_id,
      persistence_state: "unknown",
      retryable: true,
      provider_mutation_performed_inside_web_request: false,
    });
  }
  const replayed = priorRecord !== null;
  const request = priorRecord
    ? priorRecord.request as typeof freshRequest
    : freshRequest;

  if (
    replayed
    && priorRecord
    && !["forward_pending", "forward_blocked"].includes(String(priorRecord.state || ""))
  ) {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      schema_version: "task_evaluation_launch_web_receipt.v1",
      status: priorRecord.state,
      already_exists: true,
      launch_id: request.launch_id,
      run_id: request.run_id,
      request_digest: request.request_digest,
      forward: priorRecord.forward || null,
      provider_mutation_performed_inside_web_request: false,
    });
  }
  const priorAttempts = Number(priorRecord?.forward_attempt_count || 0);
  const maxForwardAttempts = Math.min(
    100,
    Math.max(1, Number(process.env.TASK_EVALUATION_LAUNCH_FORWARD_MAX_ATTEMPTS || 20)),
  );
  if (priorAttempts >= maxForwardAttempts) return res.status(409).json({
    error: "Task Evaluation launch forwarding retry cap reached",
    code: "task_evaluation_launch_forward_retry_cap_reached",
  });

  const forwarded = await forwardTaskEvaluationLaunch({ request });
  const state = forwarded.status === "forwarded"
    ? forwarded.pipeline_intake_status === "queued_dispatch_blocked"
      ? "queued_dispatch_blocked"
      : "queued_in_pipeline"
    : "forward_blocked";
  try {
    await withTaskEvaluationLaunchStoreTimeout(ref.set({
      state,
      forward: forwarded,
      forward_attempt_count: priorAttempts + 1,
      forwarded_at_iso: forwarded.status === "forwarded" ? new Date().toISOString() : null,
      updated_at_iso: new Date().toISOString(),
    }, { merge: true }));
  } catch (error) {
    const code = taskEvaluationLaunchStoreErrorCode(error);
    logger.error({ code, launchId: request.launch_id, runId: request.run_id },
      "Task Evaluation launch forward receipt persistence failed");
    return res.status(503).json({
      error: "Task Evaluation launch forward receipt store is unavailable",
      code,
      launch_id: request.launch_id,
      request_digest: request.request_digest,
      persistence_state: "forward_receipt_unknown",
      retryable: true,
      provider_mutation_performed_inside_web_request: false,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(forwarded.status === "forwarded" ? 202 : 503).json({
    schema_version: "task_evaluation_launch_web_receipt.v1",
    status: state,
    already_exists: replayed,
    launch_id: request.launch_id,
    run_id: request.run_id,
    request_digest: request.request_digest,
    forward: forwarded,
    provider_mutation_performed_inside_web_request: false,
  });
});

router.get("/supervision", async (_req, res) => {
  if (!db) return res.status(503).json({ error: "Task Evaluation supervision store is unavailable" });
  let snapshot;
  try {
    snapshot = await withTaskEvaluationLaunchStoreTimeout(
      db.collection("taskEvaluationLaunchSupervision").doc("latest").get(),
    );
  } catch (error) {
    return res.status(503).json({
      error: "Task Evaluation supervision store is unavailable",
      code: taskEvaluationLaunchStoreErrorCode(error),
    });
  }
  res.set("Cache-Control", "no-store");
  return res.json(snapshot.exists ? snapshot.data() : {
    schema_version: "task_evaluation_launch_supervision_status.v1",
    status: "not_observed",
  });
});

router.get("/:launchId", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Task Evaluation launch store is unavailable" });
  let snapshot;
  try {
    snapshot = await withTaskEvaluationLaunchStoreTimeout(
      db.collection(COLLECTION).doc(req.params.launchId).get(),
    );
  } catch (error) {
    return res.status(503).json({
      error: "Task Evaluation launch store is unavailable",
      code: taskEvaluationLaunchStoreErrorCode(error),
      launch_id: req.params.launchId,
      persistence_state: "unknown",
      retryable: true,
    });
  }
  if (!snapshot.exists) return res.status(404).json({ error: "Task Evaluation launch not found" });
  res.set("Cache-Control", "no-store");
  return res.json(snapshot.data());
});

export default router;
