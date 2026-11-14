import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { crossRuntimeCanonicalJson as sceneCanonicalJson, crossRuntimeDigest as sceneDigest } from "./crossRuntimeCanonical";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type { Response } from "express";
import { resolveExecutionAccessContext } from "./access-control";
import { withTaskEvaluationLaunchStoreTimeout as storeTimeout } from "./taskEvaluationLaunchStore";
import { logger } from "../logger";
import { loadWebsiteSceneSponsorship, validateWebsiteSponsoredIntake,
  validateWebsiteSponsoredProviderTerms, currentWebsiteSceneContext } from "./websiteSceneSponsorship";
import { assertWebsiteCaptureBindingInTransaction, resolveWebsiteCaptureBinding } from "./websiteCaptureBinding";
import type { SiteTaskBriefRecord } from "./siteTaskBrief";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import { familyNativePreparationReference, familyPreparationMatchesTask, isTaskFamilyStrategy, taskFamilyIntakeTask } from "./taskFamilySceneIntake";
import { isNavigationStrategy, navigationPreparationMatchesTask, navigationPreparationReference,
  NAVIGATION_PREPARED_PHASE } from "./navigationSceneIntake";
import { effectiveSceneExecutionExpiry } from "./sceneExecutionWindowExtension";
import { isKnownSceneIntentOutcomeKind, sceneIntentOutcomeBinds, sceneIntentOutcomeSchema, sceneOutcomeNoticeIntent } from "./sceneIntentOutcome";
import { sendRateLimitedOpsAlert } from "./opsProcessAlerts";
import { loadWebsiteCaptureRights } from "./websiteTaskContext";

export { sceneCanonicalJson, sceneDigest };

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
// A destination on another surface than the subject's (floor to desk) names
// that surface, in the same frame and shape as task.support. The Pipeline binds
// it to the reconstructed collider; the website only checks its form.
const taskDestinationSupport = z
  .object({
    description: z.string().trim().min(1).max(200),
    aabb_min_xyz: vector3,
    aabb_max_xyz: vector3,
  })
  .strict()
  // A reconstructed surface can be exactly flat; the Pipeline checks the rest.
  .refine((s) => s.aabb_min_xyz.every((v, i) => v <= s.aabb_max_xyz[i]), {
    message: "aabb_min_xyz must not exceed aabb_max_xyz on any axis",
  });
const taskDestination = z
  .object({
    relation: z.enum(["on", "inside"]),
    mode: z.literal("existing_support_surface").optional(),
    basis: z.enum(["registered_estimated_visible_bounds_and_collider_contact", "registered_estimated_visible_bounds"]).optional(),
    visible_label: z.string().trim().min(1).max(200),
    position_world_m: vector3,
    orientation_xyzw: unitQuaternion,
    kind: z.literal("green_region").optional(),
    radius_m: z.number().finite().positive().max(0.5).optional(),
    support: taskDestinationSupport.optional(),
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
// An articulated open/close task keeps the moving part inside its assembly:
// no destination pose exists. The mechanism block carries the estimated
// travel and front direction; the numeric opening threshold is frozen by
// Pipeline from the qualified asset's joint limit before any episode.
const articulationJointType = z.enum(["prismatic", "revolute"]);
// Evidence that the rebuilt assembly was covered as a whole object (every
// observed part and state, body depth seen), not only the surfaces that fell
// in the depth-sampling frames. Required for hinged doors; drawers follow once
// every Pipeline deploy produces it.
const wholeObjectCoverage = z
  .object({
    schema_version: z.literal("website_assembly_coverage.v1"),
    status: z.literal("complete"),
    digest,
    reference_frame_count: z.number().int().min(1),
  })
  .strict();
const taskArticulation = z
  .object({
    assembly_label: z.string().trim().min(1).max(200),
    part_label: z.string().trim().min(1).max(200),
    joint_type: articulationJointType,
    estimated_usable_stroke_m: positiveMeasure.max(2).optional(),
    estimated_usable_swing_rad: positiveMeasure.max(Math.PI).optional(),
    travel_authority: z.string().trim().min(1).max(200),
    estimated_front_normal_world: vector3,
    front_normal_basis: z.string().trim().min(1).max(200).optional(),
    lock_status: z.enum(["unknown", "locked", "unlocked"]),
    part_observed_open_in_footage: z.boolean(),
    whole_object_coverage: wholeObjectCoverage.optional(),
    gravity_response: z.object({
      mode: z.enum(["counterbalanced", "gravity_loaded", "unknown"]),
      reason: z.string().trim().min(1),
    }).strict().optional(),
    observation_timestamps_seconds: z.array(z.number().finite().nonnegative()).max(2000).optional(),
    physical_measurement_proven: z.literal(false),
  })
  .strict()
  .superRefine((value, context) => {
    const travel = value.joint_type === "prismatic" ? value.estimated_usable_stroke_m : value.estimated_usable_swing_rad;
    if (travel === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ["joint_type"],
      message: "articulation travel estimate must match the joint type" });
    if (value.joint_type === "revolute" && !value.whole_object_coverage)
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["whole_object_coverage"],
        message: "a hinged assembly requires whole-object coverage evidence" });
    if (value.gravity_response?.mode === "counterbalanced" && value.joint_type !== "revolute")
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["gravity_response"],
        message: "counterbalance approximation requires a revolute joint" });
  });
const articulatedTaskSuccess = z
  .object({
    control_frequency_hz: positiveMeasure,
    maximum_episode_seconds: positiveMeasure,
    minimum_opening_fraction_of_estimated_stroke: z.number().finite().gt(0).lte(1),
    minimum_hold_seconds: positiveMeasure,
    maximum_retries: z.literal(0),
  })
  .strict()
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
          // A row the Pipeline settled after a terminal attempt reads
          // `cancelled_before_execution` but keeps a hold: what its reservation
          // still counts, and why. Optional so older Pipelines still parse.
          retained_spend_usd: z.number().finite().nonnegative().optional(),
          retained_spend_basis: z.string().regex(/^[a-z][a-z0-9_]{0,127}$/).optional(),
        })
        .strict()
        .refine((attempt) => (attempt.retained_spend_usd === undefined) === (attempt.retained_spend_basis === undefined)),
    ),
    result_reference: z.union([familyNativePreparationReference, navigationPreparationReference, z.object({
        uri: z.string(),
        digest,
        size_bytes: z.number().int().nonnegative(),
      })
      .strict()]).nullable(),
    result_run_id: identifier.optional(),
    effective_execution_budget: z.object({
      max_total_spend_usd: z.number().finite().positive().max(1000),
      max_paid_attempts: z.number().int().min(1).max(100),
      extension_digest: digest.nullable(),
      extension_count: z.number().int().nonnegative(),
    }).strict().optional(),
    // C-04: the intent's one outcome, sent only once there is one. Optional so
    // older Pipelines still parse; strict so a malformed one is refused.
    outcome: sceneIntentOutcomeSchema.optional(),
    provider_mutation_performed_by_status_read: z.literal(false),
    status_digest: digest,
  })
  .strict();
const scenePolicyCandidate = z.object({ id: identifier, artifact_digest: digest }).strict();
export const sceneEvaluationPolicyCandidates = z.array(scenePolicyCandidate).length(2)
  .refine((value) => value.length === 2 && value[0].id !== value[1].id);
const sceneExecutionFields = {
  purpose: z.literal("scene_preparation").optional(),
  max_total_spend_usd: z.number().positive().max(1000),
  max_paid_attempts: z.number().int().min(1).max(32),
  max_retries: z.number().int().min(0).max(3),
  expires_at_epoch: z.number().positive(),
  allowed_providers: z
    .array(z.enum(["vast", "runpod", "openai", "anthropic"]))
    .min(1)
    .max(4)
    .refine((v) => new Set(v).size === v.length),
  policy_candidates: z.array(scenePolicyCandidate).max(2),
  claim_scope: z.literal("development_only"),
};
function scenePolicyCandidatesMatchPurpose(value: { purpose?: "scene_preparation";
  policy_candidates: Array<z.infer<typeof scenePolicyCandidate>> }, context: z.RefinementCtx) {
  const valid = value.purpose === "scene_preparation"
    ? value.policy_candidates.length === 0
    : sceneEvaluationPolicyCandidates.safeParse(value.policy_candidates).success;
  if (!valid) context.addIssue({ code: z.ZodIssueCode.custom, path: ["policy_candidates"],
    message: "Scene preparation has no robot policies; evaluation requires two distinct candidates." });
}
const sceneExecution = z.object(sceneExecutionFields).strict().superRefine(scenePolicyCandidatesMatchPurpose);
/** A Website sponsored intent's execution. It alone may name `automatic_budget_extension`,
 * and only when its grant does (validateWebsiteSponsoredIntake); no other intake can claim it. */
export const websiteSceneExecution = z.object({ ...sceneExecutionFields,
  automatic_budget_extension: z.literal(true).optional() }).strict().superRefine(scenePolicyCandidatesMatchPurpose);

export const sceneIntakeCommand = z
  .object({
    submission_id: identifier,
    source_session_id: identifier,
    collision_source_session_id: identifier.optional(),
    collision_same_frame_confirmed: z.literal(true).optional(),
    task: z.discriminatedUnion("strategy", [
      taskFamilyIntakeTask,
      z
        .object({
          task_id: identifier,
          strategy: z.literal("pick_and_place"),
          subject: mapping,
          support: mapping,
          destination: taskDestination,
          success: taskSuccess,
        })
        .strict(),
      z
        .object({
          task_id: identifier,
          strategy: z.literal("articulated_open_close"),
          subject: mapping,
          support: mapping,
          articulation: taskArticulation,
          success: articulatedTaskSuccess,
        })
        .strict(),
    ]),
    execution: sceneExecution,
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

/** A Pipeline status that shows an attempt with money reserved for it. */
function hasReservedSceneAttempt(status: Record<string, any> | undefined): boolean {
  return Array.isArray(status?.attempts) && status!.attempts.some(
    (attempt: Record<string, any>) =>
      attempt && typeof attempt === "object"
      && typeof attempt.maximum_spend_usd === "number"
      && Number.isFinite(attempt.maximum_spend_usd)
      && attempt.maximum_spend_usd > 0,
  );
}

/**
 * How long a forward that failed waits before its next try: one minute, doubling, at
 * most fifteen, with jitter (half to all of the step) so intakes that failed together
 * do not retry together. There is no retry count to run out: a Pipeline outage or
 * deploy must not end a job, so the intake's own window is the only give-up timer.
 */
export const SCENE_FORWARD_RETRY_BASE_MS = 60_000;
export const SCENE_FORWARD_RETRY_MAX_MS = 15 * 60_000;
export function sceneForwardRetryDelayMs(consecutiveFailures: number, random: () => number = Math.random): number {
  const doublings = Math.min(Math.max(Math.floor(consecutiveFailures) - 1, 0), 10);
  const step = Math.min(SCENE_FORWARD_RETRY_MAX_MS, SCENE_FORWARD_RETRY_BASE_MS * 2 ** doublings);
  const jitter = Math.min(Math.max(random(), 0), 1);
  return Math.round(step / 2 + (step / 2) * jitter);
}

function storedForwardFailureCount(record: Record<string, any>): number {
  const value = record.forward_failure_count;
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/**
 * Why a website grant read fails, sorted by what the worker may do about it.
 *
 * These revoke the accepted Pipeline intent at once, as they always have, and a revoke
 * cannot be undone: the site's rights or consent ended (`source_revoked`), or the job is
 * no longer the one the grant covers (its brief is gone or not confirmed, or the capture
 * is not the bound one; a `website_capture_binding_` failure is the same cause).
 */
const GRANT_REVOKING_CODES: ReadonlySet<string> = new Set(["source_revoked", "website_task_context_not_confirmed",
  "task_brief_missing", "task_context_capture_mismatch", "supplement_not_requested"]);
/**
 * Blueprint's own configuration or record cannot be read: the grant policy
 * (BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON) is unset or does not parse in this process, or
 * the job's stored grant is absent. Nothing about the site's rights changed, so nothing is
 * revoked. The same failed read refuses every new grant, reservation and forward, so no new
 * money is admitted while it lasts. Our team is alerted and the read is tried again next tick.
 */
const GRANT_UNREADABLE_CODES: ReadonlySet<string> = new Set(["website_scene_sponsorship_not_configured",
  "website_scene_sponsorship_missing"]);
/**
 * `website_scene_sponsorship_changed` is raised when the stored grant does not hash to the
 * policy this process holds, and also when the grant no longer covers the job's task. The
 * first happens for a few minutes whenever the web and worker services hold different
 * policy values (a deploy, or one Render variable edited before the other), so one read
 * proves nothing. It ends the intent only after it was read on consecutive ticks, at least
 * this many times and for at least this long.
 */
export const SPONSORSHIP_CHANGED_CONFIRM_MS = 15 * 60_000;
export const SPONSORSHIP_CHANGED_CONFIRM_OBSERVATIONS = 3;
const SPONSORSHIP_CHANGED = "website_scene_sponsorship_changed";
const SPONSORSHIP_CHANGED_FIELD = "sponsorship_changed_observation";

/** This tick's reading of a changed grant, counted with the consecutive ticks before it. */
function observeSponsorshipChanged(record: Record<string, any>, nowMs: number) {
  const prior = record[SPONSORSHIP_CHANGED_FIELD];
  const kept = prior && Number.isSafeInteger(prior.count) && prior.count > 0
    && Number.isFinite(prior.first_seen_at_ms) && prior.first_seen_at_ms <= nowMs;
  const value = kept ? { first_seen_at_ms: prior.first_seen_at_ms as number, count: prior.count + 1 }
    : { first_seen_at_ms: nowMs, count: 1 };
  return { value, confirmed: value.count >= SPONSORSHIP_CHANGED_CONFIRM_OBSERVATIONS
    && nowMs - value.first_seen_at_ms >= SPONSORSHIP_CHANGED_CONFIRM_MS };
}

type SceneIntakeQueueDeps = {
  /** The ops alert path (Slack, rate-limited per key). */
  alert?: (key: string, message: string) => Promise<unknown>;
  /** Jitter source for the forward retry delay. */
  random?: () => number;
};

/** One alert per tick for every grant read our own configuration broke; the alerter keeps it to one per window. */
async function alertGrantReadIssues(issues: Map<string, Set<string>>, alert: NonNullable<SceneIntakeQueueDeps["alert"]>) {
  if (issues.size === 0) return;
  const count = (code: string) => issues.get(code)?.size ?? 0;
  const jobs = (n: number) => `${n} website job${n === 1 ? "" : "s"}`;
  const lines = [":warning: Blueprint worker: a website job's grant could not be read. Nothing was revoked."];
  if (count("website_scene_sponsorship_not_configured")) lines.push(
    `- ${jobs(count("website_scene_sponsorship_not_configured"))}: the grant policy (BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON) `
    + "is unset or does not parse in this process. Jobs in flight are kept as they are; no new grant, reservation or "
    + "forward is admitted until it reads again. Fix the variable on the web and worker services.");
  if (count("website_scene_sponsorship_missing")) lines.push(
    `- ${jobs(count("website_scene_sponsorship_missing"))}: the job record has a scene intent but no stored grant. `
    + "The intent is kept as it is; look at the job record.");
  if (count(SPONSORSHIP_CHANGED)) lines.push(
    `- ${jobs(count(SPONSORSHIP_CHANGED))}: the stored grant does not match the policy this process holds, or the job's task. `
    + `If that is still read after ${SPONSORSHIP_CHANGED_CONFIRM_MS / 60_000} minutes the intent is ended for good. `
    + "If the policy was edited, give the web and worker services the same value.");
  lines.push("- The worker checks again every minute.");
  try { await alert("website_scene_grant_read", lines.join("\n")); }
  catch (error) { logger.error({ err: error }, "Could not raise the website grant read alert"); }
}
const sealedDigest = (value: Record<string, unknown>, field: string) =>
  sceneDigest(
    Object.fromEntries(Object.entries(value).filter(([key]) => key !== field)),
  );
export function sceneProviderTerms() {
  const schema = z.partialRecord(
    z.enum(["vast", "runpod", "openai", "anthropic", "meta", "world_labs", "world_labs_atlas", "google"]),
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
  command: Pick<z.infer<typeof sceneIntakeCommand>, "execution" | "consent">,
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
  source: { kind: "mesh" | "gaussian_splat" | "capture_bundle" | "public_scene"; binding_id: string; content_digest: string;
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
  if (command.source_session_id.startsWith("public-")) {
    if (source.schema_version !== "task_evaluation_public_scene_source_choice.v1" ||
        source.source_kind !== "public_scene" || source.binding_id !== command.source_session_id ||
        source.choice_digest !== sealedDigest(source, "choice_digest") ||
        !digest.safeParse(source.source_content_digest).success ||
        !digest.safeParse(source.rights_reference).success || source.claim_scope !== "development_only")
      throw new Error("source_validation_required");
    if (command.collision_source_session_id || sceneDigest(command.task) !== source.task_proposal_digest ||
        sceneDigest(source.task_proposal) !== source.task_proposal_digest)
      throw new Error("public_scene_task_selection_changed");
    if (sceneCanonicalJson(source.required_providers) !== sceneCanonicalJson(["vast", "openai"]) ||
        !source.required_providers.every((p: string) => command.execution.allowed_providers.includes(p as "vast" | "openai")))
      throw new Error("public_scene_required_provider_missing");
    if (command.execution.expires_at_epoch <= now || command.execution.expires_at_epoch > now + 7 * 86400)
      throw new Error("consent_expiry_invalid");
    return { schema_version: "task_evaluation_scene_intake_request.v1", submission_id: command.submission_id,
      owner, source: { kind: "public_scene", binding_id: source.binding_id, content_digest: source.source_content_digest },
      task: command.task, execution: command.execution,
      consent: { ...command.consent, rights_reference: source.rights_reference,
        accepted_by: owner.user_id, accepted_at_epoch: now } };
  }
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

/** Read registered publisher choices from the owning Pipeline; no fabricated capture receipt. */
export async function scenePublicSourceCatalog(): Promise<Array<Record<string, any>>> {
  const configured = process.env.TASK_EVALUATION_LAUNCH_URL || process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL;
  const token = process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
  if (!configured || !token) return [];
  const url = new URL(configured);
  url.pathname = "/api/live-pipeline/task-evaluation-public-scene-sources";
  url.search = ""; url.hash = "";
  const timestamp = new Date().toISOString(), nonce = randomUUID(), client = "blueprint-webapp";
  const signature = createHmac("sha256", token).update(`${timestamp}.${client}.${nonce}.`).digest("hex");
  const response = await fetch(url, { method: "GET", headers: {
    "x-blueprint-pipeline-timestamp": timestamp, "x-blueprint-pipeline-client-id": client,
    "x-blueprint-pipeline-nonce": nonce, "x-blueprint-pipeline-signature": `sha256=${signature}`,
  }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error("public_scene_catalog_unavailable");
  const value = await response.json();
  if (value.schema_version !== "task_evaluation_public_scene_catalog.v1" ||
      value.provider_mutation_performed !== false || !Array.isArray(value.sources) || value.sources.length > 32 ||
      value.catalog_digest !== sealedDigest(value, "catalog_digest") ||
      value.sources.some((row: Record<string, any>) => row.choice_digest !== sealedDigest(row, "choice_digest")))
    throw new Error("public_scene_catalog_invalid");
  return value.sources;
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
  // A request that did not reach the Pipeline, timed out, or came back unreadable is a
  // transport failure and is named here, where it happens. Every other error keeps its own code.
  const transport = (error: unknown) => new Error("pipeline_transport_failed", { cause: error });
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(url, {
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
  } catch (error) { throw transport(error); }
  if (!response.ok) throw new Error(`pipeline_intake_http_${response.status}`);
  let raw: any;
  try { raw = await response.json(); } catch (error) { throw transport(error); }
  // A body that is not an object is a malformed receipt, never a local error.
  const isObject = Boolean(raw) && typeof raw === "object";
  if (revokeDigest) {
    if (
      !isObject ||
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
  const status = intentId ? statusSchema.safeParse(raw) : null;
  if (status && !status.success) throw new Error("pipeline_status_receipt_invalid");
  if (!isObject) throw new Error("pipeline_receipt_invalid");
  const value = status?.success ? status.data : raw;
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
  // The outcome is the Pipeline's own sealed record for this exact intent; the
  // email it may send is keyed by that seal.
  if (intentId && value.outcome !== undefined && !sceneIntentOutcomeBinds(value.outcome, value))
    throw new Error("pipeline_status_receipt_invalid");
  if (intentId && (value.phase === "family_native_prepared" || familyNativePreparationReference.safeParse(value.result_reference).success
      || isTaskFamilyStrategy(request.task?.strategy) && value.status === "completed")
    && (value.status !== "completed" || value.phase !== "family_native_prepared"
      || request.execution?.purpose !== "scene_preparation" || request.execution?.policy_candidates?.length !== 0
      || !familyPreparationMatchesTask(value.result_reference, request.task)))
    throw new Error("pipeline_family_preparation_binding_invalid");
  // A navigation intent completes without paid configuration: only its own phase and the
  // reference naming exactly this request's record digests (navigationSceneIntake).
  if (intentId && (value.phase === NAVIGATION_PREPARED_PHASE || navigationPreparationReference.safeParse(value.result_reference).success
      || isNavigationStrategy(request.task?.strategy) && value.status === "completed")
    && (value.status !== "completed" || value.phase !== NAVIGATION_PREPARED_PHASE
      || request.execution?.purpose !== "scene_preparation" || request.execution?.policy_candidates?.length !== 0
      || !navigationPreparationMatchesTask(value.result_reference, request.task)))
    throw new Error("pipeline_navigation_preparation_binding_invalid");
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
export async function processSceneIntakeQueue(limit = 10, deps: SceneIntakeQueueDeps = {}) {
  if (!db) return;
  // Grant reads our own configuration broke this tick, by code and job: one alert for all of them.
  const grantReadIssues = new Map<string, Set<string>>();
  const noteGrantReadIssue = (code: string, requestId: string) =>
    grantReadIssues.set(code, (grantReadIssues.get(code) ?? new Set<string>()).add(requestId));
  try {
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
      let deliveryReserved = false;
      // The intake's own window (an owner-approved extension included) has passed. The Pipeline
      // starts nothing more for it, so the forward stops and the status poll does too, apart from
      // the bounded read-only closeout of an attempt that already had money reserved.
      const expiry = effectiveSceneExecutionExpiry(record);
      const windowEnded = typeof expiry === "number" && expiry <= now / 1000;
      // This tick's consecutive reading of a changed grant: a value to store, null to clear
      // what an earlier tick stored, undefined when nothing is stored and nothing was read.
      let changedObservation: { first_seen_at_ms: number; count: number } | null | undefined =
        record[SPONSORSHIP_CHANGED_FIELD] ? null : undefined;
      try {
        if (sceneDigest(record.request) !== record.request_digest)
          throw new Error("stored_request_digest_invalid");
        // Why the WebApp itself revokes a website intent. A revocation receipt
        // carries no reason, so only `source_revoked` later reads as the site's
        // own withdrawal (C-04); any other cause is Blueprint's.
        let sponsorshipRevoked: string | null = null;
        if (record.website_request_id && state === "accepted") {
          try { await loadWebsiteSceneSponsorship(record.website_request_id, false, record.source_session_id); }
          catch (error) {
            const code = error instanceof Error ? error.message : "";
            if (GRANT_REVOKING_CODES.has(code) || code.startsWith("website_capture_binding_")) sponsorshipRevoked = code;
            else if (GRANT_UNREADABLE_CODES.has(code) || code === SPONSORSHIP_CHANGED) {
              const observed = code === SPONSORSHIP_CHANGED ? observeSponsorshipChanged(record, now) : null;
              // These reads can fail before they reach the site's rights, so the rights are read on
              // their own: a withdrawal still revokes at once, whatever our configuration says.
              if (!(await loadWebsiteCaptureRights(record.website_request_id)).derived_scene_generation_allowed)
                sponsorshipRevoked = "source_revoked";
              else if (observed?.confirmed) sponsorshipRevoked = code;
              else {
                // Blueprint's own configuration, never the site's rights: the intent is kept and polled.
                if (observed) changedObservation = observed.value;
                noteGrantReadIssue(code, record.website_request_id);
              }
            } else if (code !== "consent_expired") throw error;
          }
        }
        if (state === "revocation_pending" || sponsorshipRevoked) {
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
            ...(sponsorshipRevoked ? { revocation_cause: sponsorshipRevoked } : {}),
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
          if (state === "accepted" && windowEnded && !hasReservedSceneAttempt(record.pipeline_status)) {
            // The forward branch's expiry rule, for the poll: no further Pipeline request. The
            // budget stays held in full (no `closeout_complete`): only the Pipeline's own word
            // releases it. A later verified extension reopens an `expired` intake.
            patch = {
              state: "expired",
              blocker: "consent_expired",
              next_forward_at_ms: Number.MAX_SAFE_INTEGER,
            };
          } else {
          const status = await scenePipelineRequest(
            record.request,
            record.receipt.intent_id,
          );
          if (status.intent_digest !== record.receipt.intent_digest)
            throw new Error("pipeline_intent_digest_invalid");
          const hasReservedAttempt = hasReservedSceneAttempt(status);
          // The local window counts as an ended authority even while the Pipeline has not
          // said so yet: a reserved attempt gets the bounded closeout, anything else stops.
          const authorityEnded = windowEnded || ["expired", "revoked"].includes(status.status)
            || status.blockers?.some((blocker: unknown) =>
              blocker === "scene_intake_authority_expired"
              || blocker === "scene_intake_authority_revoked");
          const terminalFailure = status.status === "blocked"
            && status.phase === "policy_canary_blocked";
          // C-04: a terminal outcome is the intent's one ending; the Pipeline
          // starts nothing more for it, so neither does this poll. The
          // read-only closeout of a reserved attempt below still runs.
          const terminalOutcome = status.status !== "completed" && status.outcome?.terminal === true;
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
                    : terminalOutcome
                      ? "blocked"
                      : windowEnded
                        ? "expired"
                        : "accepted";
          patch = {
            pipeline_status: status,
            state: nextState,
            next_forward_at_ms: (windowEnded || ["expired", "revoked"].includes(status.status))
              && !hasReservedAttempt
              || terminalOutcome && !closeoutRequired
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
          }
        } else {
          // An owner-approved, time-only extension moves only this expiry (raw + 7 days at most).
          // It is also the only limit on retries: a forward that keeps failing is tried again,
          // with backoff, until this window ends.
          if (effectiveSceneExecutionExpiry(record) <= now / 1000)
            throw new Error("consent_expired");
          const owner = record.request.owner;
          let sponsored = false;
          let sponsoredAuthority: Awaited<ReturnType<typeof loadWebsiteSceneSponsorship>> | null = null;
          if (record.website_request_id) {
            const authority = await loadWebsiteSceneSponsorship(record.website_request_id, false, record.source_session_id);
            const rootDigest = authority.assessment_parent_authority_digest
              ?? authority.continuation_parent_authority_digest ?? authority.authority_digest;
            // A fresh advisory proposal cannot renew or replace the immutable
            // source/task/provider/owner allowance. Validate the existing exact
            // request below and retain the root binding across proposal refreshes.
            if (record.root_sponsorship_digest !== undefined && record.root_sponsorship_digest !== rootDigest
              || record.sponsorship_digest !== authority.authority_digest
              && (record.root_sponsorship_digest ?? record.sponsorship_digest) !== rootDigest)
              throw new Error("website_scene_sponsorship_binding_invalid");
            validateWebsiteSponsoredIntake(record.request, authority);
            sponsored = true;
            sponsoredAuthority = authority;
          }
          const access = sponsored ? null : await resolveExecutionAccessContext({
            locals: {
              firebaseUser: {
                uid: owner.user_id,
                ...(owner.organization_id !== `user:${owner.user_id}`
                  ? { tenantId: owner.organization_id }
                  : {}),
              },
            },
          } as Response);
          if (!sponsored && !access?.isOps) {
            patch = {
              state: "commercial_authorization_required",
              blocker: "commercial_authorization_required",
              next_forward_at_ms: now + 60000,
            };
          } else {
            if (record.request.task?.evaluation_source) {
              throw new Error("stored_request_digest_invalid");
            } else if (!sponsored) {
              const sourceRef = sceneSourceReference(record.source_session_id);
              const publicChoice = record.source_session_id.startsWith("public-")
                ? (await scenePublicSourceCatalog()).find((row) => row.binding_id === record.source_session_id)
                : undefined;
              if (record.source_session_id.startsWith("public-") && !publicChoice)
                throw new Error("source_validation_required");
              const source = publicChoice ? undefined : await storeTimeout(
                db.collection(sourceRef.collection).doc(sourceRef.id).get(),
              );
              const collisionRef = record.command.collision_source_session_id ? sceneSourceReference(record.command.collision_source_session_id) : null;
              const collision = collisionRef ? await storeTimeout(db.collection(collisionRef.collection).doc(collisionRef.id).get()) : null;
              const rebuilt = buildSceneIntake(
                sceneIntakeCommand.parse(record.command),
                record.request.owner,
                publicChoice || source?.data() || {},
                record.request.consent.accepted_at_epoch,
                collision?.data(),
              );
              if (sceneDigest(rebuilt) !== record.request_digest)
                throw new Error("stored_request_digest_invalid");
            }
            if (sponsoredAuthority) validateWebsiteSponsoredProviderTerms(record.command, sponsoredAuthority);
            else validateSceneProviderTerms(record.command);
            const captureBinding = record.website_request_id
              ? await resolveWebsiteCaptureBinding(record.website_request_id, `site-${record.website_request_id}`, record.source_session_id) : undefined;
            // Count a possibly dispatched POST, not a failed local precheck or
            // a read-only status poll. Reservation failures stay conservative.
            deliveryReserved = true;
            await storeTimeout(
              db.runTransaction(async (transaction) => {
                const latest = await transaction.get(row.ref);
                if (
                  latest.data()?.lease_id !== claim ||
                  latest.data()?.revocation_requested
                )
                  throw new Error("revocation_requested_before_delivery");
                if (record.website_request_id) {
                  const request = (await transaction.get(db!.collection("inboundRequests").doc(record.website_request_id))).data();
                  const brief = (await transaction.get(db!.collection("siteTaskBriefs").doc(record.website_request_id))).data() as SiteTaskBriefRecord;
                  const inventory = (await transaction.get(db!.collection("siteTaskItemInventories").doc(record.website_request_id))).data() as TaskItemInventoryRecord | undefined;
                  await assertWebsiteCaptureBindingInTransaction(transaction, record.website_request_id, captureBinding);
                  const rootDigest = sponsoredAuthority?.assessment_parent_authority_digest
                    ?? sponsoredAuthority?.continuation_parent_authority_digest ?? sponsoredAuthority?.authority_digest;
                  if (request?.website_scene_sponsorship?.authority_digest !== rootDigest || !brief
                    || currentWebsiteSceneContext({requestId: record.website_request_id, brief, record: request ?? {}, inventory,
                      captureId: record.source_session_id, captureBinding}).context_digest !== sponsoredAuthority?.task_context_digest)
                    throw new Error("website_scene_sponsorship_binding_invalid");
                }
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
              forward_failure_count: 0,
            };
          }
        }
      } catch (error) {
        const rawCode =
          error instanceof Error ? error.message : "forward_failed";
        const code =
          [
            "saved_execution_setup_required",
            "saved_setup_unreadable",
            "evaluation_selection_changed",
            "evaluation_policy_selection_changed",
            "evaluation_context_binding_invalid",
            "evaluation_context_unavailable",
            "consent_expired",
            "stored_request_digest_invalid",
            "source_revoked",
            "source_not_owned",
            "source_validation_required",
            "source_rights_binding_required",
            "provider_terms_not_configured_or_changed",
            "pipeline_forwarding_not_configured",
            "pipeline_transport_failed",
            "pipeline_receipt_binding_invalid",
            "pipeline_status_owner_invalid",
            "pipeline_receipt_invalid",
            "pipeline_revocation_receipt_invalid",
            "pipeline_intent_digest_invalid",
            "pipeline_status_receipt_missing",
            "pipeline_status_receipt_invalid",
            "website_scene_development_test_not_authorized",
            "revocation_requested_before_delivery",
          ].includes(rawCode) || /^pipeline_intake_http_[0-9]{3}$/.test(rawCode) || rawCode.startsWith("website_scene_sponsorship_")
            ? rawCode
            // Not a Pipeline answer and not a failed request: an error raised on this side that has
            // no code of its own (a store read, a parse). The request itself names a transport failure.
            : "scene_intake_local_error";
        if (code === "scene_intake_local_error")
          logger.warn({ err: error, intakeId: row.id, state }, "Scene intake tick failed on this side; it will be tried again");
        const statusPollState = isSceneStatusPollState(state);
        // The forward branch: nothing was accepted yet, so a failure is retried or ends the intake.
        const forwardBranch = !statusPollState && state !== "revocation_pending";
        let terminal = [
          "consent_expired",
          "stored_request_digest_invalid",
          "source_revoked",
          "source_not_owned",
          "source_validation_required",
          "source_rights_binding_required",
          "website_scene_sponsorship_changed",
          "website_scene_sponsorship_binding_invalid",
        ].includes(code);
        if (forwardBranch && GRANT_UNREADABLE_CODES.has(code) && record.website_request_id)
          noteGrantReadIssue(code, record.website_request_id);
        if (forwardBranch && code === SPONSORSHIP_CHANGED) {
          // A deploy can make this read for a few minutes: it ends the intake only once confirmed.
          const observed = observeSponsorshipChanged(record, now);
          if (!observed.confirmed) {
            terminal = false;
            changedObservation = observed.value;
            if (record.website_request_id) noteGrantReadIssue(code, record.website_request_id);
          }
        }
        // A poll past the intake's window is the read-only closeout, bounded like any other.
        const closeoutPoll = statusPollState && (state !== "accepted" || windowEnded);
        const closeoutPollCount = storedCloseoutPollCount(record);
        const closeoutPollExhausted = closeoutPoll
          && closeoutPollCount >= SCENE_TERMINAL_CLOSEOUT_POLL_LIMIT - 1;
        const fallbackState = state === "revocation_pending"
          ? "revocation_pending"
          : statusPollState
            ? state === "closeout_pending" || state === "expired" || state === "revoked"
              ? state
              : windowEnded
                ? "closeout_pending"
                : "accepted"
            : terminal
              ? "blocked"
              : "forward_blocked";
        // Consecutive failed forwards set the backoff; a poll or a revocation keeps its one-minute tick.
        const forwardFailures = forwardBranch && !terminal ? storedForwardFailureCount(record) + 1 : null;
        patch = {
          state: closeoutPollExhausted ? "blocked" : fallbackState,
          blocker: closeoutPollExhausted ? "terminal_closeout_poll_cap_exhausted" : code,
          next_forward_at_ms: now + (forwardFailures === null ? 60000 : sceneForwardRetryDelayMs(forwardFailures, deps.random)),
          forward_attempt_count: (record.forward_attempt_count || 0) + Number(deliveryReserved),
          ...(forwardFailures === null ? {} : { forward_failure_count: forwardFailures }),
          ...(closeoutPoll ? { closeout_poll_count: closeoutPollCount + 1 } : {}),
        };
      }
      if (changedObservation !== undefined) patch[SPONSORSHIP_CHANGED_FIELD] = changedObservation;
      // A terminal outcome owes the website job one email (C-04). The intent is
      // written with the status that carried it and queued by the outbox
      // reconciler; the same outcome read again writes nothing new.
      const notice = record.website_request_id ? sceneOutcomeNoticeIntent(row.id, { ...record, ...patch }) : null;
      // An outcome kind this release does not know is not adopted; staff hear once per job and code.
      const sentKind = ({ ...record, ...patch } as Record<string, any>).pipeline_status?.outcome?.kind;
      // Only when this outcome is first stored: the 60-second poll that reads it again writes nothing.
      const unknownKind = record.website_request_id && typeof sentKind === "string" && !isKnownSceneIntentOutcomeKind(sentKind)
        && JSON.stringify(record.pipeline_status?.outcome ?? null) !== JSON.stringify(({ ...record, ...patch } as Record<string, any>).pipeline_status?.outcome ?? null)
        ? sentKind : null;
      await storeTimeout(
        db.runTransaction(async (transaction) => {
          const latest = await transaction.get(row.ref);
          if (latest.data()?.lease_id === claim)
            transaction.update(row.ref, {
              ...patch,
              ...(notice && latest.data()?.scene_outcome_notification_intent?.event_id !== notice.event_id
                ? { scene_outcome_notification_pending: true, scene_outcome_notification_intent: notice } : {}),
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
      // After the status is stored: a failed write has alerted no one.
      if (unknownKind) void import("./unknownPipelineCode").then(({ noteUnknownPipelineCode }) =>
        noteUnknownPipelineCode(record.website_request_id, "scene_outcome.kind", unknownKind));
      // A status poll can be when the site's first test on its scene started.
      // The outbox tick repairs a missed enqueue; this only makes it prompt.
      if (record.website_request_id && patch.pipeline_status) {
        try {
          const { notifyIfSceneTestsStarted } = await import("./taskLifecycleNotifications");
          await notifyIfSceneTestsStarted(record.website_request_id);
        } catch (error) {
          logger.warn({ error, requestId: record.website_request_id }, "Could not queue the scene-tests notice");
        }
      }
    }
  }
  } finally {
    await alertGrantReadIssues(grantReadIssues, deps.alert ?? sendRateLimitedOpsAlert);
  }
}
