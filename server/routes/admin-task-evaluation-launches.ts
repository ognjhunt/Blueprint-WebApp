import { Router, type Request, type Response } from "express";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { resolveAccessContext } from "../utils/access-control";
import {
  buildTaskEvaluationLaunchRequest,
  buildTaskEvaluationTerminalResourceReleaseRequest,
  forwardTaskEvaluationLaunch,
  parseTaskEvaluationLaunchWebPreflightReceipt,
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
import {
  fetchTaskEvaluationLaunchPreparationStatus,
  forwardTaskEvaluationLaunchPreparation,
  taskEvaluationLaunchPreparationInputSchema,
  taskEvaluationLaunchPreparationRequestDigest,
} from "../utils/taskEvaluationLaunchPreparationContract";

const router = Router();
const COLLECTION = "taskEvaluationLaunches";
const PREPARATION_COLLECTION = "taskEvaluationLaunchPreparations";

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

export interface TaskEvaluationLaunchSubmissionContext {
  actorId: string;
  actorRole: "admin" | "ops";
  channel: "production_webapp_browser" | "production_webapp_service_api";
  serviceId: string | null;
  idempotencyKey: string;
}

async function resolveTaskEvaluationLaunchInput(
  body: unknown,
  options: { requireAuthorizationIssuedAt?: boolean } = {},
) {
  const parsed = taskEvaluationLaunchInputSchema.safeParse(body);
  if (!parsed.success) return {
    ok: false as const,
    status: 400,
    payload: {
      error: "Task Evaluation launch request is invalid",
      code: "task_evaluation_launch_input_invalid",
      provider_mutation_performed_inside_web_request: false,
    },
  };
  if (Date.parse(parsed.data.spend.expires_at) <= Date.now()) return {
    ok: false as const,
    status: 400,
    payload: {
      error: "Spend authority has expired",
      code: "task_evaluation_launch_spend_authority_expired",
      provider_mutation_performed_inside_web_request: false,
    },
  };
  const authorizationIssuedAt = parsed.data.authorization_issued_at;
  if (options.requireAuthorizationIssuedAt && !authorizationIssuedAt) return {
    ok: false as const,
    status: 400,
    payload: {
      error: "Task Evaluation preflight requires an immutable authorization timestamp",
      code: "task_evaluation_launch_authorization_timestamp_required",
      provider_mutation_performed_inside_web_request: false,
    },
  };
  const authorizationIssuedAtMs = authorizationIssuedAt
    ? Date.parse(authorizationIssuedAt)
    : null;
  if (
    authorizationIssuedAt
    && (
      authorizationIssuedAtMs! > Date.now()
      || authorizationIssuedAtMs! >= Date.parse(parsed.data.spend.expires_at)
    )
  ) return {
    ok: false as const,
    status: 400,
    payload: {
      error: "Task Evaluation authorization timestamp is invalid",
      code: "task_evaluation_launch_authorization_timestamp_invalid",
      provider_mutation_performed_inside_web_request: false,
    },
  };
  const catalog = await resolvePublishedLaunchProfileCatalog();
  if (catalog.blocker) return {
    ok: false as const,
    status: 503,
    payload: {
      error: "Published Pipeline launch profiles are unavailable",
      code: catalog.blocker,
      provider_mutation_performed_inside_web_request: false,
    },
  };
  const profile = catalog.profiles.find((candidate) =>
    candidate.profile_id === parsed.data.profile_id
    && candidate.profile_digest === parsed.data.profile_digest,
  );
  if (!profile) return {
    ok: false as const,
    status: 409,
    payload: {
      error: "Published Pipeline launch profile does not match",
      code: "task_evaluation_launch_profile_not_published",
      provider_mutation_performed_inside_web_request: false,
    },
  };
  return { ok: true as const, input: parsed.data, profile };
}

export async function preflightTaskEvaluationLaunch(
  req: Request,
  res: Response,
  context: TaskEvaluationLaunchSubmissionContext,
) {
  if (!db) return res.status(503).json({
    error: "Task Evaluation launch store is unavailable",
    code: "task_evaluation_launch_store_unavailable",
    provider_mutation_performed_inside_web_request: false,
  });
  const resolved = await resolveTaskEvaluationLaunchInput(req.body, {
    requireAuthorizationIssuedAt: true,
  });
  if (!resolved.ok) return res.status(resolved.status).json(resolved.payload);
  const candidateRequest = buildTaskEvaluationLaunchRequest({
    input: resolved.input,
    profile: resolved.profile,
    actorId: context.actorId,
    actorRole: context.actorRole,
    authorizedAt: resolved.input.authorization_issued_at!,
  });
  const receipt = {
    schema_version: "task_evaluation_launch_web_preflight_receipt.v1",
    status: "ready",
    launch_id: resolved.input.launch_id,
    run_id: resolved.input.run_id,
    profile_id: resolved.input.profile_id,
    profile_digest: resolved.input.profile_digest,
    authorization_issued_at: resolved.input.authorization_issued_at!,
    candidate_request_digest: candidateRequest.request_digest,
    authenticated_client_id: context.serviceId,
    submission_channel: context.channel,
    webapp_store_available: true,
    webapp_record_persisted: false,
    pipeline_request_forwarded: false,
    pipeline_queue_created: false,
    provider_mutation_performed_inside_web_request: false,
    preflight_is_not_execution: true,
    receipt_digest: "",
  };
  receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
  const parsedReceipt = parseTaskEvaluationLaunchWebPreflightReceipt(receipt);
  if (!parsedReceipt.ok) {
    logger.error({ blockers: parsedReceipt.blockers },
      "Task Evaluation launch preflight receipt validation failed");
    return res.status(500).json({
      error: "Task Evaluation launch preflight receipt is invalid",
      code: "task_evaluation_launch_web_preflight_receipt_invalid",
      provider_mutation_performed_inside_web_request: false,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(200).json(parsedReceipt.receipt);
}

export async function submitTaskEvaluationLaunch(
  req: Request,
  res: Response,
  context: TaskEvaluationLaunchSubmissionContext,
) {
  if (!db) return res.status(503).json({ error: "Task Evaluation launch store is unavailable" });
  const resolved = await resolveTaskEvaluationLaunchInput(req.body);
  if (!resolved.ok) return res.status(resolved.status).json(resolved.payload);
  const parsed = { data: resolved.input };
  const profile = resolved.profile;
  const freshRequest = buildTaskEvaluationLaunchRequest({
    input: parsed.data,
    profile,
    actorId: context.actorId,
    actorRole: context.actorRole,
    authorizedAt: parsed.data.authorization_issued_at || new Date().toISOString(),
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
    submission: {
      channel: context.channel,
      service_id: context.serviceId,
      idempotency_key: context.idempotencyKey,
    },
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
          actorId: context.actorId,
          actorRole: context.actorRole,
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
      submission_channel: priorRecord.submission?.channel || "production_webapp_browser",
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
    submission_channel: priorRecord?.submission?.channel || initialRecord.submission.channel,
  });
}

// Input preparation is deliberately separate from launch authority. It may
// validate and materialize immutable customer inputs, but it cannot publish a
// launch profile, allocate a provider, or request paid execution.
router.post("/preparations", async (req, res) => {
  if (!db) return res.status(503).json({
    error: "Task Evaluation preparation store is unavailable",
    code: "task_evaluation_launch_preparation_store_unavailable",
    provider_mutation_performed_inside_web_request: false,
  });
  const parsed = taskEvaluationLaunchPreparationInputSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({
    error: "Task Evaluation launch preparation request is invalid",
    code: "task_evaluation_launch_preparation_input_invalid",
    provider_mutation_performed_inside_web_request: false,
    paid_execution_requested: false,
  });
  const access = await resolveAccessContext(res);
  const actorId = access.uid || access.email;
  if (!actorId) return res.status(401).json({ error: "Authenticated actor identity is missing" });
  const request = parsed.data;
  const requestDigest = taskEvaluationLaunchPreparationRequestDigest(request);
  const ref = db.collection(PREPARATION_COLLECTION).doc(request.preparation_id);
  const now = new Date().toISOString();
  const initialRecord = {
    schema_version: "task_evaluation_launch_preparation_web_record.v1",
    preparation_id: request.preparation_id,
    run_id: request.run_id,
    team_namespace: request.team_namespace,
    expected_production_commit: request.expected_production_commit,
    request,
    request_digest: requestDigest,
    state: "forward_pending",
    forward_attempt_count: 0,
    provider_mutation_observed: false,
    catalog_mutation_observed: false,
    paid_execution_requested: false,
    submission: {
      channel: "production_webapp_browser",
      actor_id: actorId,
      actor_role: access.isAdmin ? "admin" : "ops",
    },
    created_at_iso: now,
  };
  let priorRecord: Record<string, any> | null;
  try {
    priorRecord = await withTaskEvaluationLaunchStoreTimeout(db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) {
        const existing = snapshot.data() as Record<string, any>;
        if (existing.request_digest !== requestDigest) throw new Error("immutable_preparation_conflict");
        return existing;
      }
      transaction.create(ref, initialRecord);
      return null;
    }));
  } catch (error) {
    if (error instanceof Error && error.message === "immutable_preparation_conflict") return res.status(409).json({
      error: "Immutable Task Evaluation preparation conflict",
      code: "task_evaluation_launch_preparation_immutable_conflict",
      preparation_id: request.preparation_id,
      provider_mutation_performed_inside_web_request: false,
      paid_execution_requested: false,
    });
    const code = taskEvaluationLaunchStoreErrorCode(error);
    logger.error({ code, preparationId: request.preparation_id },
      "Task Evaluation launch preparation persistence failed");
    return res.status(503).json({
      error: "Task Evaluation preparation store is unavailable",
      code,
      preparation_id: request.preparation_id,
      persistence_state: "unknown",
      retryable: true,
      provider_mutation_performed_inside_web_request: false,
      paid_execution_requested: false,
    });
  }
  if (priorRecord && !["forward_pending", "forward_blocked"].includes(String(priorRecord.state))) {
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      schema_version: "task_evaluation_launch_preparation_web_receipt.v1",
      status: priorRecord.state,
      already_exists: true,
      preparation_id: request.preparation_id,
      run_id: request.run_id,
      team_namespace: request.team_namespace,
      request_digest: requestDigest,
      expected_production_commit: request.expected_production_commit,
      pipeline: priorRecord.pipeline || null,
      provider_mutation_performed_inside_web_request: false,
      catalog_mutation_performed_inside_web_request: false,
      paid_execution_requested: false,
      preparation_is_not_execution: true,
    });
  }
  const priorAttempts = Number(priorRecord?.forward_attempt_count || 0);
  if (priorAttempts >= 20) return res.status(409).json({
    error: "Task Evaluation preparation forwarding retry cap reached",
    code: "task_evaluation_launch_preparation_forward_retry_cap_reached",
  });
  const forwarded = await forwardTaskEvaluationLaunchPreparation({ request });
  const state = forwarded.status === "forwarded"
    ? "queued_for_no_spend_preparation"
    : "forward_blocked";
  try {
    await withTaskEvaluationLaunchStoreTimeout(ref.set({
      state,
      pipeline: forwarded,
      forward_attempt_count: priorAttempts + 1,
      forwarded_at_iso: forwarded.status === "forwarded" ? new Date().toISOString() : null,
      updated_at_iso: new Date().toISOString(),
    }, { merge: true }));
  } catch (error) {
    const code = taskEvaluationLaunchStoreErrorCode(error);
    return res.status(503).json({
      error: "Task Evaluation preparation forward receipt store is unavailable",
      code,
      preparation_id: request.preparation_id,
      persistence_state: "forward_receipt_unknown",
      retryable: true,
      provider_mutation_performed_inside_web_request: false,
      paid_execution_requested: false,
    });
  }
  res.set("Cache-Control", "no-store");
  return res.status(forwarded.status === "forwarded" ? 202 : 503).json({
    schema_version: "task_evaluation_launch_preparation_web_receipt.v1",
    status: state,
    already_exists: priorRecord !== null,
    preparation_id: request.preparation_id,
    run_id: request.run_id,
    team_namespace: request.team_namespace,
    request_digest: requestDigest,
    expected_production_commit: request.expected_production_commit,
    pipeline: forwarded,
    provider_mutation_performed_inside_web_request: false,
    catalog_mutation_performed_inside_web_request: false,
    paid_execution_requested: false,
    preparation_is_not_execution: true,
  });
});

router.get("/preparations/:preparationId", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Task Evaluation preparation store is unavailable" });
  const preparationId = String(req.params.preparationId || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/.test(preparationId)) return res.status(400).json({
    error: "Task Evaluation preparation ID is invalid",
    code: "task_evaluation_launch_preparation_id_invalid",
  });
  const ref = db.collection(PREPARATION_COLLECTION).doc(preparationId);
  let record: Record<string, any>;
  try {
    const snapshot = await withTaskEvaluationLaunchStoreTimeout(ref.get());
    if (!snapshot.exists) return res.status(404).json({ error: "Task Evaluation preparation not found" });
    record = snapshot.data() as Record<string, any>;
  } catch (error) {
    const code = taskEvaluationLaunchStoreErrorCode(error);
    return res.status(503).json({ error: "Task Evaluation preparation store is unavailable", code });
  }
  const pipeline = await fetchTaskEvaluationLaunchPreparationStatus({
    preparationId,
  });
  if (!pipeline.ok) return res.status(pipeline.status).json({
    error: "Pipeline Task Evaluation preparation status is unavailable",
    code: pipeline.blocker,
    preparation_id: preparationId,
    webapp_state: record.state,
    provider_mutation_performed_by_status_read: false,
  });
  if (
    pipeline.preparationStatus.status !== "not_found"
    && (
      pipeline.preparationStatus.request_digest !== record.request_digest
      || pipeline.preparationStatus.run_id !== record.run_id
      || pipeline.preparationStatus.team_namespace !== record.team_namespace
      || pipeline.preparationStatus.expected_production_commit !== record.expected_production_commit
    )
  ) return res.status(409).json({
    error: "Pipeline Task Evaluation preparation status identity mismatch",
    code: "task_evaluation_launch_preparation_status_identity_mismatch",
    preparation_id: preparationId,
    provider_mutation_performed_by_status_read: false,
  });
  try {
    await withTaskEvaluationLaunchStoreTimeout(ref.set({
      state: pipeline.preparationStatus.status,
      pipeline_status: pipeline.preparationStatus,
      updated_at_iso: new Date().toISOString(),
    }, { merge: true }));
  } catch (error) {
    const code = taskEvaluationLaunchStoreErrorCode(error);
    return res.status(503).json({ error: "Task Evaluation preparation status store is unavailable", code });
  }
  res.set("Cache-Control", "no-store");
  return res.json({
    schema_version: "task_evaluation_launch_preparation_web_status.v1",
    preparation_id: preparationId,
    run_id: record.run_id,
    team_namespace: record.team_namespace,
    request_digest: record.request_digest,
    expected_production_commit: record.expected_production_commit,
    state: pipeline.preparationStatus.status,
    pipeline: pipeline.preparationStatus,
    provider_mutation_performed_by_status_read: false,
    paid_execution_requested: false,
    preparation_is_not_execution: true,
  });
});

router.post("/", async (req, res) => {
  const access = await resolveAccessContext(res);
  const actorId = access.uid || access.email;
  if (!actorId) return res.status(401).json({ error: "Authenticated actor identity is missing" });
  return submitTaskEvaluationLaunch(req, res, {
    actorId,
    actorRole: access.isAdmin ? "admin" : "ops",
    channel: "production_webapp_browser",
    serviceId: null,
    idempotencyKey: String(req.body?.launch_id || ""),
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
  // A queued release is not a finished one. The WebApp never observes the
  // Pipeline's outcome for a release, so returning the stored forward receipt
  // here echoed the first attempt forever: a release that blocked
  // Pipeline-side became permanently unretryable and stranded the provider
  // record it named. Forward again and let the Pipeline decide -- it re-arms
  // only when its retained receipt proves the provider was never contacted,
  // and refuses with a typed blocker otherwise. The attempt cap below bounds
  // this, and the forwarded request stays byte-identical, so an already
  // completed release is still refused downstream rather than repeated.
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
