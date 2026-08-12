import { Router } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { resolveAccessContext } from "../utils/access-control";
import {
  buildTaskEvaluationLaunchRequest,
  buildTaskEvaluationTerminalResourceReleaseRequest,
  forwardTaskEvaluationLaunch,
  forwardTaskEvaluationTerminalResourceRelease,
  resolvePublishedLaunchProfileCatalog,
  taskEvaluationLaunchInputSchema,
  taskEvaluationTerminalResourceReleaseInputSchema,
} from "../utils/taskEvaluationLaunchContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  taskEvaluationLaunchStoreErrorCode,
  withTaskEvaluationLaunchStoreTimeout,
} from "../utils/taskEvaluationLaunchStore";

const router = Router();
const COLLECTION = "taskEvaluationLaunches";

router.use(requireAdminRole);

router.get("/profiles", async (_req, res) => {
  const catalog = await resolvePublishedLaunchProfileCatalog();
  res.set("Cache-Control", "no-store");
  if (catalog.blocker) return res.status(503).json({
    schema_version: "task_evaluation_launch_profile_catalog.v1",
    error: "Published Pipeline launch profiles are unavailable",
    code: catalog.blocker,
    profiles: [],
  });
  return res.json({
    schema_version: "task_evaluation_launch_profile_catalog.v1",
    profiles: catalog.profiles,
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
  const catalog = await resolvePublishedLaunchProfileCatalog();
  if (catalog.blocker) return res.status(503).json({
    error: "Published Pipeline launch profiles are unavailable",
    code: catalog.blocker,
    provider_mutation_performed_inside_web_request: false,
  });
  const profile = catalog.profiles.find((candidate) =>
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

// This recovery channel is intentionally narrower than a launch: a human must
// name one retained, stopped provider record on an already terminal-blocked
// website launch.  The WebApp only records and forwards the request; Pipeline's
// canonical allocator owns the eventual inspect/delete operation.
router.post("/:launchId/terminal-resource-releases", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Task Evaluation launch store is unavailable" });
  const parsed = taskEvaluationTerminalResourceReleaseInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({
    error: "Terminal resource release request is invalid",
    code: "task_evaluation_terminal_resource_release_input_invalid",
  });
  const access = await resolveAccessContext(res);
  const actorId = access.uid || access.email;
  if (!actorId) return res.status(401).json({ error: "Authenticated actor identity is missing" });
  const ref = db.collection(COLLECTION).doc(req.params.launchId);
  let persisted: {
    request: Record<string, any>;
    release: Record<string, any>;
    replayed: boolean;
  };
  try {
    persisted = await withTaskEvaluationLaunchStoreTimeout(db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("terminal_resource_release_launch_not_found");
      const launchRecord = snapshot.data() as Record<string, any>;
      if (launchRecord.launch_id !== req.params.launchId) {
        throw new Error("immutable_terminal_resource_release_conflict");
      }
      const existing = launchRecord.terminal_resource_release as Record<string, any> | undefined;
      if (existing) {
        const request = existing.request as Record<string, any> | undefined;
        if (
          !request
          || request.provider !== parsed.data.provider
          || request.instance_id !== parsed.data.instance_id
          || request.expected_label !== parsed.data.expected_label
          || request.launch_id !== launchRecord.launch_id
          || request.run_id !== launchRecord.run_id
          || request.request_digest !== launchRecord.request_digest
          || request.terminal_resource_release_digest
            !== canonicalArtifactDigest(request, "terminal_resource_release_digest")
        ) throw new Error("immutable_terminal_resource_release_conflict");
        return { request, release: existing, replayed: true };
      }
      const request = buildTaskEvaluationTerminalResourceReleaseRequest({
        launchRecord,
        input: parsed.data,
        actorId,
        actorRole: access.isAdmin ? "admin" : "ops",
        authorizedAt: new Date().toISOString(),
      });
      const release = {
        schema_version: "task_evaluation_terminal_resource_release_web_record.v1",
        state: "forward_pending",
        request,
        terminal_resource_release_digest: request.terminal_resource_release_digest,
        forward_attempt_count: 0,
        provider_mutation_observed: false,
        automatic_retry_performed: false,
        created_at_iso: new Date().toISOString(),
      };
      transaction.set(ref, { terminal_resource_release: release }, { merge: true });
      return { request, release, replayed: false };
    }));
  } catch (error) {
    if (error instanceof Error && error.message === "terminal_resource_release_launch_not_found") {
      return res.status(404).json({ error: "Task Evaluation launch not found" });
    }
    if (error instanceof Error && (
      error.message === "terminal_resource_release_launch_not_eligible"
      || error.message === "immutable_terminal_resource_release_conflict"
    )) return res.status(409).json({
      error: "Terminal resource release is not eligible for this immutable launch",
      code: error.message,
    });
    const code = taskEvaluationLaunchStoreErrorCode(error);
    logger.error({ code, launchId: req.params.launchId },
      "Task Evaluation terminal resource release persistence failed");
    return res.status(503).json({
      error: "Task Evaluation terminal resource release store is unavailable",
      code,
      launch_id: req.params.launchId,
      persistence_state: "unknown",
      retryable: true,
      provider_mutation_performed_inside_web_request: false,
    });
  }
  const priorState = String(persisted.release.state || "");
  if (priorState === "queued_in_pipeline") {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      schema_version: "task_evaluation_terminal_resource_release_web_receipt.v1",
      status: priorState,
      already_exists: true,
      launch_id: persisted.request.launch_id,
      release_id: persisted.request.release_id,
      terminal_resource_release_digest: persisted.request.terminal_resource_release_digest,
      forward: persisted.release.forward || null,
      provider_mutation_performed_inside_web_request: false,
      automatic_retry_performed: false,
    });
  }
  const priorAttempts = Number(persisted.release.forward_attempt_count || 0);
  const maxForwardAttempts = Math.min(
    20,
    Math.max(1, Number(process.env.TASK_EVALUATION_TERMINAL_RESOURCE_RELEASE_FORWARD_MAX_ATTEMPTS || 5)),
  );
  if (priorAttempts >= maxForwardAttempts) return res.status(409).json({
    error: "Terminal resource release forwarding retry cap reached",
    code: "task_evaluation_terminal_resource_release_forward_retry_cap_reached",
  });
  const forwarded = await forwardTaskEvaluationTerminalResourceRelease({ request: persisted.request });
  const state = forwarded.status === "forwarded" ? "queued_in_pipeline" : "forward_blocked";
  try {
    await withTaskEvaluationLaunchStoreTimeout(ref.set({
      terminal_resource_release: {
        ...persisted.release,
        state,
        forward: forwarded,
        forward_attempt_count: priorAttempts + 1,
        forwarded_at_iso: forwarded.status === "forwarded" ? new Date().toISOString() : null,
        updated_at_iso: new Date().toISOString(),
      },
    }, { merge: true }));
  } catch (error) {
    const code = taskEvaluationLaunchStoreErrorCode(error);
    logger.error({ code, launchId: persisted.request.launch_id, releaseId: persisted.request.release_id },
      "Task Evaluation terminal resource release forward receipt persistence failed");
    return res.status(503).json({
      error: "Task Evaluation terminal resource release forward receipt store is unavailable",
      code,
      launch_id: persisted.request.launch_id,
      release_id: persisted.request.release_id,
      persistence_state: "forward_receipt_unknown",
      retryable: true,
      provider_mutation_performed_inside_web_request: false,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(forwarded.status === "forwarded" ? 202 : 503).json({
    schema_version: "task_evaluation_terminal_resource_release_web_receipt.v1",
    status: state,
    already_exists: persisted.replayed,
    launch_id: persisted.request.launch_id,
    release_id: persisted.request.release_id,
    terminal_resource_release_digest: persisted.request.terminal_resource_release_digest,
    forward: forwarded,
    provider_mutation_performed_inside_web_request: false,
    automatic_retry_performed: false,
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
