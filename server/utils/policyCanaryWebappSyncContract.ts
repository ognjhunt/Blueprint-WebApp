import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const nonEmpty = z.string().trim().min(1).max(512);

const pipelineArtifactSchema = z.object({
  digest,
  size_bytes: z.number().int().positive(),
  artifact_id: identifier,
  provider_zero_verified: z.boolean().optional(),
}).strict();

const pipelineNotificationSchema = z.object({
  terminal_state: z.enum(["completed", "blocked", "cancelled"]),
  status: z.enum(["pending", "delivered", "failed"]),
  attempts: z.number().int().nonnegative(),
  provider: z.string().trim().min(1).max(128),
  message_id: z.string().trim().max(512).nullable(),
  delivered_at: z.string().datetime({ offset: true }).nullable(),
  run_result_digest: digest,
}).strict();

const pipelineEpisodeEvidenceSchema = z.object({
  checkpoint_digest: digest,
  runtime_identity_digest: digest,
  reset_state_digest: digest,
  reset_state: pipelineArtifactSchema.nullable(),
  frame_manifest: pipelineArtifactSchema.nullable(),
  review_video: pipelineArtifactSchema.nullable(),
  policy_query_receipt: pipelineArtifactSchema.nullable(),
  action_sequence: pipelineArtifactSchema.nullable(),
  action_delivery_readback: pipelineArtifactSchema.nullable(),
  state_trace: pipelineArtifactSchema.nullable(),
  contact_force_trace: pipelineArtifactSchema.nullable(),
  task_object_trajectory: pipelineArtifactSchema.nullable(),
  score_receipt: pipelineArtifactSchema.nullable(),
  evidence_gaps: z.array(z.string().trim().min(1).max(128)),
  typed_media_gap: z.string().trim().min(1).max(512).optional(),
}).strict();

export const pipelinePolicyCanaryResultProjectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_result_projection.v1"),
  run_id: identifier,
  request_digest: digest,
  configuration_digest: digest,
  result_delivery_digest: digest,
  matrix_digest: digest.nullable().optional(),
  reproducibility: z.object({
    scene_revision_digest: digest,
    runtime_container_digest: digest.nullable(),
    scoring_version: z.string().trim().min(1).max(128).nullable(),
    observation_schema_id: z.string().trim().min(1).max(192).nullable(),
    action_schema_id: z.string().trim().min(1).max(192).nullable(),
    evidence_manifest: pipelineArtifactSchema,
    billing_receipt: pipelineArtifactSchema,
    teardown_receipt: pipelineArtifactSchema,
    provider_zero_receipt: pipelineArtifactSchema,
    official_total_usd: z.number().nonnegative().nullable(),
    started_at_iso: z.string().datetime({ offset: true }).nullable(),
    completed_at_iso: z.string().datetime({ offset: true }).nullable(),
    duration_seconds: z.number().nonnegative().nullable(),
    provider: z.string().trim().min(1).max(64).nullable(),
    provider_instance_ids: z.array(z.number().int().positive()).max(1).nullable(),
  }).strict().optional(),
  run_kind: z.literal("internal_policy_canary"),
  claim_ceiling: z.literal("diagnostic_policy_execution"),
  scene_controls_status: z.literal("configured_controls_pending"),
  result_status: z.enum(["completed_unqualified", "blocked", "cancelled"]),
  warning: z.literal("Controls pending — results are unqualified."),
  counts: z.object({
    policy_count: z.literal(2),
    episodes_per_policy: z.literal(10),
    learned_policy_rollout_count: z.literal(20),
    completed_learned_policy_rollout_count: z.number().int().min(0).max(20),
    diagnostic_control_rollout_count: z.number().int().min(0).max(20),
    completed_diagnostic_control_rollout_count: z.number().int().min(0).max(20),
  }).strict(),
  candidate_ids: z.tuple([z.literal("pi05_droid"), z.literal("groot_n17_droid")]),
  candidate_results: z.tuple([
    z.object({
      candidate_id: z.literal("pi05_droid"),
      episodes_completed: z.number().int().min(0).max(10),
      interpretable_episode_count: z.number().int().min(0).max(10),
      actions_delivered_episode_count: z.number().int().min(0).max(10),
      metrics: z.record(z.string(), z.unknown()),
      failure_counts: z.record(z.string(), z.number().int().nonnegative()),
    }).strict(),
    z.object({
      candidate_id: z.literal("groot_n17_droid"),
      episodes_completed: z.number().int().min(0).max(10),
      interpretable_episode_count: z.number().int().min(0).max(10),
      actions_delivered_episode_count: z.number().int().min(0).max(10),
      metrics: z.record(z.string(), z.unknown()),
      failure_counts: z.record(z.string(), z.number().int().nonnegative()),
    }).strict(),
  ]),
  episodes: z.array(z.object({
    episode_id: identifier,
    candidate_id: z.enum(["pi05_droid", "groot_n17_droid"]),
    cell_id: identifier,
    seed: z.number().int().min(0).max(2_147_483_647),
    terminal_state: z.enum(["completed", "failed", "blocked", "cancelled"]),
    candidate_policy_queried: z.boolean(),
    actions_reached_robot: z.boolean(),
    arm_moved: z.boolean(),
    policy_outcome_interpretable: z.boolean(),
    failure_taxonomy: z.string().trim().max(128).nullable(),
    evidence: pipelineEpisodeEvidenceSchema,
  }).strict()).max(20),
  comparison: z.object({
    matched_cell_count: z.number().int().min(0).max(10),
    winner_declared: z.literal(false),
    official_ranking_contribution: z.literal(false),
  }).strict(),
  report: z.object({
    result_digest: digest,
    permanent_result_path: z.string().regex(/^\/[^\s]*$/),
    machine_readable_report: pipelineArtifactSchema,
    evidence_manifest: pipelineArtifactSchema,
  }).strict(),
  closure: z.object({
    billing: pipelineArtifactSchema,
    teardown: pipelineArtifactSchema,
    provider_zero: pipelineArtifactSchema.extend({
      provider_zero_verified: z.literal(true),
    }).strict(),
  }).strict(),
  notification_delivery: pipelineNotificationSchema,
  blockers: z.array(nonEmpty).max(128),
  projection_digest: digest,
}).strict();

export const pipelinePolicyCanaryResultDeliverySchema = z.object({
  schema_version: z.literal("task_evaluation_result_delivery.v2"),
  run_id: identifier,
  result_status: z.enum(["completed_unqualified", "blocked", "cancelled"]),
  claim_ceiling: z.literal("diagnostic_policy_execution"),
  delivery_digest: digest,
}).passthrough();

export const pipelinePolicyCanaryPublicationSchema = z.object({
  schema_version: z.literal("task_evaluation_run_publication.v4"),
  capture_session_id: identifier,
  intake_id: identifier,
  run_id: identifier,
  request_digest: digest,
  configuration_digest: digest,
  run_kind: z.literal("internal_policy_canary"),
  claim_ceiling: z.literal("diagnostic_policy_execution"),
  result_status: z.enum(["completed_unqualified", "blocked", "cancelled"]),
  scene_controls_status: z.literal("configured_controls_pending"),
  warning: z.literal("Controls pending — results are unqualified."),
  result_delivery: pipelinePolicyCanaryResultDeliverySchema,
  policy_canary_result: pipelinePolicyCanaryResultProjectionSchema,
  proof_boundary: z.object({
    scene_promotion_authorized: z.literal(false),
    official_policy_ranking_authorized: z.literal(false),
    winner_selection_authorized: z.literal(false),
    simulation_is_physical_success: z.literal(false),
    deployment_or_safety_approved: z.literal(false),
  }).strict(),
}).strict();

export const pipelinePolicyCanaryPreproviderBlockedSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_preprovider_blocked.v1"),
  activation_id: identifier,
  capture_session_id: identifier,
  intake_id: identifier,
  request_digest: digest,
  run_kind: z.literal("internal_policy_canary"),
  claim_ceiling: z.literal("diagnostic_policy_execution"),
  result_status: z.literal("blocked"),
  provider_allocation_performed: z.literal(false),
  automatic_retry_performed: z.literal(false),
  blockers: z.array(nonEmpty).min(1).max(128),
  payload_digest: digest,
}).strict();

function sensitivePaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((child, index) => sensitivePaths(child, `${prefix}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const forbidden = /(^|_)(secret|token|password|private_key|api_key|credential)($|_)/i.test(key)
      && child !== null && child !== "" && child !== false;
    return [...(forbidden ? [path] : []), ...sensitivePaths(child, path)];
  });
}

export function parsePipelinePolicyCanaryPublication(value: unknown) {
  const parsed = pipelinePolicyCanaryPublicationSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, blockers: ["policy_canary_publication_schema_invalid"] };
  const publication = parsed.data;
  const projection = publication.policy_canary_result;
  const delivery = publication.result_delivery;
  const blockers: string[] = [];
  if (canonicalArtifactDigest(delivery, "delivery_digest") !== delivery.delivery_digest) {
    blockers.push("policy_canary_delivery_digest_mismatch");
  }
  if (canonicalArtifactDigest(projection, "projection_digest") !== projection.projection_digest) {
    blockers.push("policy_canary_projection_digest_mismatch");
  }
  if (
    delivery.run_id !== publication.run_id
    || delivery.result_status !== publication.result_status
    || projection.run_id !== publication.run_id
    || projection.request_digest !== publication.request_digest
    || projection.configuration_digest !== publication.configuration_digest
    || projection.result_delivery_digest !== delivery.delivery_digest
    || projection.result_status !== publication.result_status
    || projection.notification_delivery.run_result_digest !== projection.report.result_digest
  ) blockers.push("policy_canary_publication_binding_mismatch");
  if (sensitivePaths(publication).length) blockers.push("policy_canary_publication_secret_value_forbidden");
  return blockers.length
    ? { ok: false as const, blockers: [...new Set(blockers)].sort() }
    : { ok: true as const, publication };
}

export function parsePipelinePolicyCanaryPreproviderBlocked(value: unknown) {
  const parsed = pipelinePolicyCanaryPreproviderBlockedSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, blockers: ["policy_canary_preprovider_blocked_schema_invalid"] };
  const payload = parsed.data;
  const blockers: string[] = [];
  if (canonicalArtifactDigest(payload, "payload_digest") !== payload.payload_digest) {
    blockers.push("policy_canary_preprovider_blocked_digest_mismatch");
  }
  if (sensitivePaths(payload).length) blockers.push("policy_canary_preprovider_blocked_secret_value_forbidden");
  return blockers.length
    ? { ok: false as const, blockers }
    : { ok: true as const, payload };
}

export type PipelinePolicyCanaryPublication = z.infer<typeof pipelinePolicyCanaryPublicationSchema>;
export type PipelinePolicyCanaryPreproviderBlocked = z.infer<typeof pipelinePolicyCanaryPreproviderBlockedSchema>;
