import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { Response } from "express";
import { resolveExecutionAccessContext } from "./access-control";
import { withTaskEvaluationLaunchStoreTimeout as storeTimeout } from "./taskEvaluationLaunchStore";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const mapping = z
  .record(z.string(), z.unknown())
  .refine((v) => Object.keys(v).length > 0);
// Structured task inputs the completed-scene factory
// (task_evaluation_completed_scene_attempt_factory._task_and_blockers) requires.
// A description-only destination or success block is refused up-front here so the
// website never stages an intent the factory would reject with
// task_destination_pose_required / task_success_criteria_required.
const finiteNumber = z.number().finite();
const vector3 = z.tuple([finiteNumber, finiteNumber, finiteNumber]);
// (x, y, z, w) with unit norm, so the pose is a valid rotation.
const unitQuaternion = z
  .tuple([finiteNumber, finiteNumber, finiteNumber, finiteNumber])
  .refine(
    (q) =>
      Math.abs(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3] - 1) <=
      1e-6,
    { message: "orientation_xyzw must be a unit quaternion" },
  );
const taskDestination = z
  .object({
    relation: z.enum(["on", "inside"]),
    visible_label: z.string().trim().min(1).max(200),
    position_world_m: vector3,
    orientation_xyzw: unitQuaternion,
  })
  .strict();
const positiveMeasure = z.number().finite().positive();
const taskSuccess = z
  .object({
    control_frequency_hz: positiveMeasure,
    maximum_episode_seconds: positiveMeasure,
    minimum_lift_m: positiveMeasure,
    pregrasp_clearance_m: positiveMeasure,
    minimum_planar_displacement_m: positiveMeasure,
    maximum_final_planar_target_error_m: positiveMeasure,
    maximum_retries: z.literal(0),
    maximum_regrasps: z.literal(0),
  })
  .strict()
  // control_frequency_hz * maximum_episode_seconds must be a whole number of
  // simulation steps.
  .refine(
    (s) => Number.isInteger(s.control_frequency_hz * s.maximum_episode_seconds),
    {
      message:
        "control_frequency_hz * maximum_episode_seconds must be a whole number of steps",
    },
  );
const statusSchema = z
  .object({
    schema_version: z.literal("task_evaluation_scene_intent_status.v1"),
    intent_id: identifier,
    intent_digest: digest,
    request_digest: digest,
    owner: z
      .object({ user_id: z.string(), organization_id: z.string() })
      .strict(),
    status: z.enum([
      "accepted",
      "preparing",
      "awaiting_source",
      "awaiting_execution",
      "running",
      "completed",
      "needs_input",
      "blocked",
      "revoked",
      "expired",
    ]),
    phase: z.string().nullable(),
    blockers: z.array(z.string()),
    attempts: z.array(
      z
        .object({
          attempt_id: identifier,
          source_commit: z.string().regex(/^[0-9a-f]{40}$/),
          runtime_digest: digest,
          input_digest: digest,
          provider: z.string(),
          maximum_spend_usd: z.number(),
          status: z.string(),
        })
        .strict(),
    ),
    result_reference: z
      .object({
        uri: z.string(),
        digest,
        size_bytes: z.number().int().nonnegative(),
      })
      .strict()
      .nullable(),
    provider_mutation_performed_by_status_read: z.literal(false),
    status_digest: digest,
  })
  .strict();
export const sceneIntakeCommand = z
  .object({
    submission_id: identifier,
    source_session_id: identifier,
    collision_source_session_id: identifier.optional(),
    collision_same_frame_confirmed: z.literal(true).optional(),
    task: z
      .object({
        task_id: identifier,
        strategy: z.literal("pick_and_place"),
        subject: mapping,
        support: mapping,
        destination: taskDestination,
        success: taskSuccess,
      })
      .strict(),
    execution: z
      .object({
        max_total_spend_usd: z.number().positive().max(1000),
        max_paid_attempts: z.number().int().min(1).max(32),
        max_retries: z.number().int().min(0).max(3),
        expires_at_epoch: z.number().positive(),
        allowed_providers: z
          .array(z.enum(["vast", "runpod", "openai"]))
          .min(1)
          .max(3)
          .refine((v) => new Set(v).size === v.length),
        policy_candidates: z
          .array(z.object({ id: identifier, artifact_digest: digest }).strict())
          .length(2)
          .refine((v) => v[0].id !== v[1].id),
        claim_scope: z.literal("development_only"),
      })
      .strict(),
    consent: z
      .object({
        rights_reference: z.string().trim().min(1).max(1000).optional(),
        provider_terms_reference: z.string().trim().min(1).max(1000),
        private_processing_authorized: z.literal(true),
        provider_training_authorized: z.literal(false),
        task_confirmed: z.literal(true),
        spend_authorized: z.literal(true),
      })
      .strict(),
  })
  .strict();
export const SCENE_INTAKE_COLLECTION = "taskEvaluationSceneIntakes";
// A provider run can outlive the owner's future-execution authority. Keep
// polling its Pipeline status through a bounded read-only window so a late
// terminal result is delivered without reopening forwarding or spending. At
// the normal one-minute worker cadence this is one hour; exhaustion is an
// explicit terminal blocker rather than an unbounded retry loop.
export const SCENE_TERMINAL_CLOSEOUT_POLL_LIMIT = 60;
const SCENE_STATUS_POLL_STATES = ["accepted", "closeout_pending", "expired", "revoked"] as const;

function isSceneStatusPollState(value: string): value is (typeof SCENE_STATUS_POLL_STATES)[number] {
  return SCENE_STATUS_POLL_STATES.includes(value as (typeof SCENE_STATUS_POLL_STATES)[number]);
}

function storedCloseoutPollCount(record: Record<string, any>): number {
  const value = record.closeout_poll_count;
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
// RFC 8785: ECMAScript number serialization and UTF-16 key ordering. Never
// locale-sort cross-runtime signed packets or hash Python's 20.0 spelling.
export function sceneCanonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map(sceneCanonicalJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${sceneCanonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  if (
    typeof value === "number" &&
    (!Number.isFinite(value) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value)))
  )
    throw new Error("unsafe_json_number");
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error("invalid_json_value");
  return serialized;
}
export const sceneDigest = (value: unknown) =>
  `sha256:${createHash("sha256").update(sceneCanonicalJson(value)).digest("hex")}`;
const sealedDigest = (value: Record<string, unknown>, field: string) =>
  sceneDigest(
    Object.fromEntries(Object.entries(value).filter(([key]) => key !== field)),
  );
export function sceneProviderTerms() {
  const schema = z.record(
    z.enum(["vast", "runpod", "openai"]),
    z
      .object({
        digest,
        label: z.string().min(1).max(200),
        url: z.string().url().startsWith("https://"),
      })
      .strict(),
  );
  try {
    return schema.parse(
      JSON.parse(process.env.TASK_EVALUATION_SCENE_PROVIDER_TERMS_JSON || "{}"),
    );
  } catch {
    return {} as Record<string, { digest: string; label: string; url: string }>;
  }
}
export function validateSceneProviderTerms(
  command: z.infer<typeof sceneIntakeCommand>,
) {
  const terms = sceneProviderTerms();
  if (
    !command.execution.allowed_providers.every(
      (provider) =>
        terms[provider]?.digest === command.consent.provider_terms_reference,
    )
  )
    throw new Error("provider_terms_not_configured_or_changed");
}
export function sceneOwner(user: Record<string, any>) {
  const uid = String(user.uid || "");
  if (!uid) throw new Error("authentication_required");
  return {
    user_id: uid,
    organization_id: String(
      user.tenantId || user.tenant_id || user.firebase?.tenant || `user:${uid}`,
    ),
  };
}
export function nativeSourceInOrganization(
  source: Record<string, any> | undefined,
  owner: ReturnType<typeof sceneOwner>,
) {
  if (!source) return owner.organization_id === `user:${owner.user_id}`;
  return source.organization_id
    ? source.organization_id === owner.organization_id
    : owner.organization_id === `user:${owner.user_id}`;
}
type SceneIntakeRequest = {
  schema_version: "task_evaluation_scene_intake_request.v1";
  submission_id: string;
  owner: ReturnType<typeof sceneOwner>;
  source: { kind: "mesh" | "gaussian_splat" | "capture_bundle"; binding_id: string; content_digest: string;
    collision_mesh?: { binding_id: string; content_digest: string; rights_reference: string; frame_relation: "owner_declared_common_frame" } };
  task: z.infer<typeof sceneIntakeCommand>["task"];
  execution: z.infer<typeof sceneIntakeCommand>["execution"];
  consent: z.infer<typeof sceneIntakeCommand>["consent"] & { rights_reference: string; accepted_by: string; accepted_at_epoch: number };
};

export function buildSceneIntake(
  command: z.infer<typeof sceneIntakeCommand>,
  owner: ReturnType<typeof sceneOwner>,
  source: Record<string, any>,
  now = Date.now() / 1000,
  collisionSource?: Record<string, any>,
): SceneIntakeRequest {
  const native = command.source_session_id.startsWith("native-");
  if (
    (native ? source.creator_id : source.owner_user_id) !== owner.user_id ||
    (native && !nativeSourceInOrganization(source, owner)) ||
    (source.organization_binding_status === "firebase_tenant_verified" &&
      source.organization_id !== owner.organization_id)
  )
    throw new Error("source_not_owned");
  const receipt = source.pipeline_capture_intake_receipt;
  const identity = source.immutable_upload_identity;
  if (native) {
    if (
      !identity ||
      !digest.safeParse(identity.raw_bundle_digest).success ||
      !digest.safeParse(identity.upload_completion_digest).success ||
      !/^gs:\/\/[^/]+\/.+\/manifest\.json$/.test(
        identity.raw_manifest_uri || "",
      ) ||
      ![
        "pending_pipeline_storage_readback",
        "pipeline_storage_bytes_verified",
      ].includes(identity.verification_status)
    )
      throw new Error("source_validation_required");
    if (
      identity.verification_status === "pipeline_storage_bytes_verified" &&
      identity.verified_capture_digest !== identity.raw_bundle_digest
    )
      throw new Error("source_validation_required");
  } else if (
    !receipt ||
    receipt.admission_status !== "accepted" ||
    receipt.malware_content_validation?.status !== "passed" ||
    receipt.proof_boundary?.server_sha256_verified !== true ||
    !digest.safeParse(receipt.capture_digest).success
  )
    throw new Error("source_validation_required");
  if (
    ["revoked", "revocation_in_progress", "cancelled"].includes(
      source.status,
    ) ||
    source.capture_access?.future_processing_allowed === false ||
    source.completed_capture_lifecycle
  )
    throw new Error("source_revoked");
  if (
    command.execution.expires_at_epoch <= now ||
    command.execution.expires_at_epoch > now + 7 * 86400
  )
    throw new Error("consent_expiry_invalid");
  const profile =
    source.request?.capture_authority_profile ||
    source.capture_authority_profile;
  const clearance = source.rights_clearance;
  const nativeReference =
    typeof clearance === "string"
      ? clearance
      : clearance?.reference ||
        clearance?.digest ||
        clearance?.rights_reference ||
        clearance?.receipt_digest;
  const rightsReference = native
    ? typeof nativeReference === "string" && nativeReference
      ? nativeReference
      : `firestore://taskEvaluationSceneIntakes/scene-${sceneDigest({ owner, submission_id: command.submission_id }).slice(7)}`
    : receipt.envelope_digest;
  if (
    typeof rightsReference !== "string" ||
    (!native && !digest.safeParse(rightsReference).success)
  )
    throw new Error("source_rights_binding_required");
  let collisionBinding: SceneIntakeRequest["source"]["collision_mesh"];
  if (command.collision_source_session_id) {
    if (profile !== "provided_scene_splat" || command.collision_same_frame_confirmed !== true ||
        command.collision_source_session_id === command.source_session_id || !collisionSource)
      throw new Error("collision_source_binding_required");
    const { collision_source_session_id, collision_same_frame_confirmed: _confirmed, ...baseCommand } = command;
    const companion = buildSceneIntake({ ...baseCommand, source_session_id: collision_source_session_id }, owner, collisionSource, now);
    if (companion.source.kind !== "mesh") throw new Error("collision_source_mesh_required");
    collisionBinding = { binding_id: companion.source.binding_id, content_digest: companion.source.content_digest,
                         rights_reference: companion.consent.rights_reference,
                         frame_relation: "owner_declared_common_frame" };
  }
  return {
    schema_version: "task_evaluation_scene_intake_request.v1",
    submission_id: command.submission_id,
    owner,
    source: {
      kind: profile === "provided_scene_mesh" ? "mesh" : profile === "provided_scene_splat" ? "gaussian_splat" : "capture_bundle",
      binding_id: command.source_session_id,
      content_digest: native
        ? identity.raw_bundle_digest
        : receipt.capture_digest,
      ...(collisionBinding ? { collision_mesh: collisionBinding } : {}),
    },
    task: command.task,
    execution: command.execution,
    consent: {
      ...command.consent,
      rights_reference: rightsReference,
      accepted_by: owner.user_id,
      accepted_at_epoch: now,
    },
  };
}
export function sceneSourceReference(sourceId: string) {
  return sourceId.startsWith("native-")
    ? { collection: "creatorCaptures", id: sourceId.slice(7) }
    : { collection: "captureUploadSessions", id: sourceId };
}

export async function scenePipelineRequest(
  request: Record<string, any>,
  intentId?: string,
  revokeDigest?: string,
) {
  const configured =
    process.env.TASK_EVALUATION_LAUNCH_URL ||
    process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL;
  const token = process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
  if (!configured || !token)
    throw new Error("pipeline_forwarding_not_configured");
  const url = new URL(configured);
  url.pathname = `/api/live-pipeline/task-evaluation-scene-intents${intentId ? `/${encodeURIComponent(intentId)}${revokeDigest ? "/revoke" : ""}` : ""}`;
  url.search = "";
  url.hash = "";
  const body = revokeDigest
    ? JSON.stringify({ intent_digest: revokeDigest, owner: request.owner })
    : intentId
      ? ""
      : JSON.stringify(request);
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const client = "blueprint-webapp";
  const signature = createHmac("sha256", token)
    .update(`${timestamp}.${client}.${nonce}.${body}`)
    .digest("hex");
  const response = await fetch(url, {
    method: intentId && !revokeDigest ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      "x-blueprint-pipeline-timestamp": timestamp,
      "x-blueprint-pipeline-client-id": client,
      "x-blueprint-pipeline-nonce": nonce,
      "x-blueprint-pipeline-signature": `sha256=${signature}`,
    },
    ...(body ? { body } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`pipeline_intake_http_${response.status}`);
  const raw = await response.json();
  if (revokeDigest) {
    if (
      raw.schema_version !== "task_evaluation_scene_intent_revocation.v1" ||
      raw.intent_id !== intentId ||
      raw.intent_digest !== revokeDigest ||
      sceneCanonicalJson(raw.owner) !== sceneCanonicalJson(request.owner) ||
      raw.status !== "revoked" ||
      raw.scope !== "future_execution" ||
      raw.provider_mutation_performed !== false ||
      raw.receipt_digest !== sealedDigest(raw, "receipt_digest")
    )
      throw new Error("pipeline_revocation_receipt_invalid");
    return raw;
  }
  const value = intentId ? statusSchema.parse(raw) : raw;
  const field = intentId ? "status_digest" : "receipt_digest";
  if (
    value.request_digest !== sceneDigest(request) ||
    value[field] !== sealedDigest(value, field)
  )
    throw new Error("pipeline_receipt_binding_invalid");
  if (
    intentId &&
    (value.intent_id !== intentId ||
      sceneCanonicalJson(value.owner) !== sceneCanonicalJson(request.owner) ||
      value.schema_version !== "task_evaluation_scene_intent_status.v1")
  )
    throw new Error("pipeline_status_owner_invalid");
  if (
    !intentId &&
    (value.schema_version !== "task_evaluation_scene_intake_receipt.v1" ||
      value.status !== "accepted" ||
      !identifier.safeParse(value.intent_id).success ||
      !digest.safeParse(value.intent_digest).success ||
      value.provider_mutation_performed_inside_http_request !== false)
  )
    throw new Error("pipeline_receipt_invalid");
  return value;
}

/** The existing Render launch worker delivers this durable, idempotent outbox. */
export async function processSceneIntakeQueue(limit = 10) {
  if (!db) return;
  for (const state of [
    "revocation_pending",
    "forward_pending",
    "forward_blocked",
    "commercial_authorization_required",
    "accepted",
    "closeout_pending",
    // These states were terminal in older worker versions. Revisit only when
    // the retained Pipeline status proves a paid attempt exists, so historical
    // late results are recoverable without making unissued intents live again.
    "expired",
    "revoked",
  ] as const) {
    const rows = await storeTimeout(
      db
        .collection(SCENE_INTAKE_COLLECTION)
        .where("state", "==", state)
        .where("next_forward_at_ms", "<=", Date.now())
        .orderBy("next_forward_at_ms", "asc")
        .limit(limit)
        .get(),
    );
    for (const row of rows.docs) {
      const claim = randomUUID();
      const now = Date.now();
      const record = await storeTimeout(
        db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(row.ref);
          const value = snapshot.data();
          if (
            !value ||
            value.lease_until_ms > now ||
            value.next_forward_at_ms > now ||
            value.state !== state
          )
            return null;
          transaction.update(row.ref, {
            lease_id: claim,
            lease_until_ms: now + 120000,
          });
          return value;
        }),
      );
      if (!record) continue;
      let patch: Record<string, any>;
      try {
        if (sceneDigest(record.request) !== record.request_digest)
          throw new Error("stored_request_digest_invalid");
        if (state === "revocation_pending") {
          const intentId = record.receipt?.intent_id || row.id;
          const intentDigest =
            record.receipt?.intent_digest ||
            (await scenePipelineRequest(record.request, intentId))
              .intent_digest;
          const revocation = await scenePipelineRequest(
            record.request,
            intentId,
            intentDigest,
          );
          patch = {
            // A revocation closes future admissions, but an already-accepted
            // Pipeline intent may still have a running/retained attempt. Move
            // those records to the read-only status poller; an unissued local
            // cancellation remains terminal and never needs a Pipeline GET.
            state: record.receipt ? "closeout_pending" : "revoked",
            revocation_receipt: revocation,
            ...(record.receipt ? { closeout_poll_count: 0 } : {}),
            blocker: null,
            next_forward_at_ms: now + 60000,
          };
        } else if ((state === "expired" || state === "revoked")
          && (record.closeout_complete === true || !record.receipt?.intent_id)) {
          // A terminal authority state with no accepted Pipeline receipt has no
          // downstream run to discover. Keep it terminal and out of the worker
          // schedule; no status read can create an execution capability.
          patch = {
            state,
            blocker: record.blocker || null,
            closeout_complete: true,
            next_forward_at_ms: Number.MAX_SAFE_INTEGER,
          };
        } else if (isSceneStatusPollState(state)) {
          if (!record.receipt?.intent_id)
            throw new Error("pipeline_status_receipt_missing");
          const status = await scenePipelineRequest(
            record.request,
            record.receipt.intent_id,
          );
          if (status.intent_digest !== record.receipt.intent_digest)
            throw new Error("pipeline_intent_digest_invalid");
          const hasReservedAttempt = Array.isArray(status.attempts) && status.attempts.some(
            (attempt: Record<string, any>) =>
              attempt && typeof attempt === "object"
              && typeof attempt.maximum_spend_usd === "number"
              && Number.isFinite(attempt.maximum_spend_usd)
              && attempt.maximum_spend_usd > 0,
          );
          const authorityEnded = ["expired", "revoked"].includes(status.status)
            || status.blockers?.some((blocker: unknown) =>
              blocker === "scene_intake_authority_expired"
              || blocker === "scene_intake_authority_revoked");
          const terminalFailure = status.status === "blocked"
            && status.phase === "policy_canary_blocked";
          const closeoutPollCount = storedCloseoutPollCount(record);
          const closeoutRequired = authorityEnded && hasReservedAttempt;
          const closeoutExhausted = closeoutRequired
            && closeoutPollCount >= SCENE_TERMINAL_CLOSEOUT_POLL_LIMIT - 1;
          const nextState = status.status === "completed"
            ? "completed"
            : terminalFailure
              ? "blocked"
              : closeoutExhausted
                ? "blocked"
                : closeoutRequired
                  ? "closeout_pending"
                  : ["expired", "revoked"].includes(status.status)
                    ? status.status
                    : "accepted";
          patch = {
            pipeline_status: status,
            state: nextState,
            next_forward_at_ms: ["expired", "revoked"].includes(status.status)
              && !hasReservedAttempt
              ? Number.MAX_SAFE_INTEGER
              : now + 60000,
            blocker: null,
            ...(closeoutRequired ? { closeout_poll_count: closeoutPollCount + 1 } : {}),
            ...(["expired", "revoked"].includes(status.status) && !hasReservedAttempt
              ? { closeout_complete: true }
              : {}),
            ...(closeoutExhausted
              ? { blocker: "terminal_closeout_poll_cap_exhausted" }
              : {}),
          };
        } else {
          if (record.request.execution.expires_at_epoch <= now / 1000)
            throw new Error("consent_expired");
          if (record.forward_attempt_count >= 20)
            throw new Error("transport_retry_cap_exhausted");
          const owner = record.request.owner;
          const access = await resolveExecutionAccessContext({
            locals: {
              firebaseUser: {
                uid: owner.user_id,
                ...(owner.organization_id !== `user:${owner.user_id}`
                  ? { tenantId: owner.organization_id }
                  : {}),
              },
            },
          } as Response);
          if (!access.isOps) {
            patch = {
              state: "commercial_authorization_required",
              blocker: "commercial_authorization_required",
              next_forward_at_ms: now + 60000,
            };
          } else {
            const sourceRef = sceneSourceReference(record.source_session_id);
            const source = await storeTimeout(
              db.collection(sourceRef.collection).doc(sourceRef.id).get(),
            );
            const collisionRef = record.command.collision_source_session_id ? sceneSourceReference(record.command.collision_source_session_id) : null;
            const collision = collisionRef ? await storeTimeout(db.collection(collisionRef.collection).doc(collisionRef.id).get()) : null;
            const rebuilt = buildSceneIntake(
              sceneIntakeCommand.parse(record.command),
              record.request.owner,
              source.data() || {},
              record.request.consent.accepted_at_epoch,
              collision?.data(),
            );
            validateSceneProviderTerms(record.command);
            if (sceneDigest(rebuilt) !== record.request_digest)
              throw new Error("stored_request_digest_invalid");
            await storeTimeout(
              db.runTransaction(async (transaction) => {
                const latest = await transaction.get(row.ref);
                if (
                  latest.data()?.lease_id !== claim ||
                  latest.data()?.revocation_requested
                )
                  throw new Error("revocation_requested_before_delivery");
                transaction.update(row.ref, {
                  forwarding_started: true,
                  forward_attempt_count: record.forward_attempt_count + 1,
                });
              }),
            );
            const receipt = await scenePipelineRequest(record.request);
            patch = {
              state: "accepted",
              receipt,
              blocker: null,
              next_forward_at_ms: now + 60000,
              forward_attempt_count: record.forward_attempt_count + 1,
            };
          }
        }
      } catch (error) {
        const rawCode =
          error instanceof Error ? error.message : "forward_failed";
        const code =
          [
            "consent_expired",
            "transport_retry_cap_exhausted",
            "stored_request_digest_invalid",
            "source_revoked",
            "source_not_owned",
            "source_validation_required",
            "source_rights_binding_required",
            "provider_terms_not_configured_or_changed",
            "pipeline_forwarding_not_configured",
            "pipeline_receipt_binding_invalid",
            "pipeline_status_owner_invalid",
            "pipeline_receipt_invalid",
            "pipeline_revocation_receipt_invalid",
            "pipeline_intent_digest_invalid",
            "pipeline_status_receipt_missing",
            "revocation_requested_before_delivery",
          ].includes(rawCode) || /^pipeline_intake_http_[0-9]{3}$/.test(rawCode)
            ? rawCode
            : "pipeline_transport_failed";
        const terminal = [
          "consent_expired",
          "transport_retry_cap_exhausted",
          "stored_request_digest_invalid",
          "source_revoked",
          "source_not_owned",
          "source_validation_required",
          "source_rights_binding_required",
        ].includes(code);
        const statusPollState = isSceneStatusPollState(state);
        const closeoutPoll = statusPollState && state !== "accepted";
        const closeoutPollCount = storedCloseoutPollCount(record);
        const closeoutPollExhausted = closeoutPoll
          && closeoutPollCount >= SCENE_TERMINAL_CLOSEOUT_POLL_LIMIT - 1;
        const fallbackState = state === "revocation_pending"
          ? "revocation_pending"
          : statusPollState
            ? state === "closeout_pending" || state === "expired" || state === "revoked"
              ? state
              : "accepted"
            : terminal
              ? "blocked"
              : "forward_blocked";
        patch = {
          state: closeoutPollExhausted ? "blocked" : fallbackState,
          blocker: closeoutPollExhausted ? "terminal_closeout_poll_cap_exhausted" : code,
          next_forward_at_ms: now + 60000,
          forward_attempt_count: (record.forward_attempt_count || 0) + 1,
          ...(closeoutPoll ? { closeout_poll_count: closeoutPollCount + 1 } : {}),
        };
      }
      await storeTimeout(
        db.runTransaction(async (transaction) => {
          const latest = await transaction.get(row.ref);
          if (latest.data()?.lease_id === claim)
            transaction.update(row.ref, {
              ...patch,
              ...(latest.data()?.revocation_requested &&
              patch.state !== "revoked" &&
              patch.state !== "closeout_pending" &&
              !isSceneStatusPollState(state)
                ? { state: "revocation_pending", next_forward_at_ms: 0 }
                : {}),
              lease_until_ms: 0,
              updated_at_iso: new Date().toISOString(),
            });
        }),
      );
    }
  }
}
