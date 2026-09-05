import { z } from "zod";
import { controlsStatusSchema, controlsWarningSchema, policyCanaryControlFields, controlsProjectionBlockers } from "./policyCanaryControls";

import { canonicalArtifactDigest } from "./taskCandidateContract";
import { confirmedRigidTaskSuccessContractSchema } from "./rigidTaskSuccessContract";

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const nonEmpty = z.string().trim().min(1).max(512);

const pipelineArtifactSchema = z.object({
  digest,
  size_bytes: z.number().int().positive(),
  artifact_id: identifier,
  provider_zero_verified: z.boolean().optional(),
}).strict();

export const pipelineEpisodeInterpretationSchema = z.object({
  status: z.enum(["completed", "abstained"]),
  abstention_reason: z.string().trim().min(1).max(128).nullable(),
  episode_outcome: z.enum(["appears_complete", "appears_incomplete", "unclear"]),
  summary: z.string().trim().min(1).max(8_000),
  events: z.array(z.unknown()).max(200),
  possible_missed_events: z.array(z.unknown()).max(100),
  contract_considerations: z.array(z.string().trim().min(1).max(2_000)).max(100),
  confidence: z.number().min(0).max(1),
  deterministic_agreement: z.enum(["agrees", "disagrees", "abstains"]),
  receipt: pipelineArtifactSchema,
  learned_interpretation_only: z.literal(true),
  authoritative_task_success_unchanged: z.literal(true),
  ranking_or_promotion_effect: z.literal("none"),
}).strict();

export const pipelineEpisodeInterpretationSummarySchema = z.object({
  schema_version: z.literal("policy_canary_episode_interpretation_closeout.v1"),
  status: z.enum(["completed", "partial", "abstained"]),
  episode_count: z.number().int().min(0).max(20),
  receipt_count: z.number().int().min(0).max(20),
  completed_count: z.number().int().min(0).max(20),
  abstained_count: z.number().int().min(0).max(20),
  disagreement_count: z.number().int().min(0).max(20),
  reused_receipt_count: z.number().int().min(0).max(20),
  provider_call_count: z.number().int().min(0).max(20),
  provider_invocation_attempt_count: z.number().int().min(0).max(20),
  input_bundle_unavailable_count: z.number().int().min(0).max(20),
  interpreter: z.record(z.string(), z.unknown()).nullable().optional(),
  interpreter_profile_digest: digest.nullable().optional(),
  official_cost_completion_error_type: z.string().trim().min(1).max(256).nullable().optional(),
  closeout_error_type: z.string().trim().min(1).max(256).nullable().optional(),
  authoritative_deterministic_result_unchanged: z.literal(true),
  score_overwrite_performed: z.literal(false),
  ranking_or_promotion_effect: z.literal("none"),
  summary_digest: digest,
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
  task_success_contract: confirmedRigidTaskSuccessContractSchema.optional(),
  task_success_contract_digest: digest.optional(),
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
  scene_controls_status: controlsStatusSchema,
  result_status: z.enum(["completed_unqualified", "blocked", "cancelled"]),
  warning: controlsWarningSchema,
  ...policyCanaryControlFields,
  counts: z.object({
    policy_count: z.literal(2),
    episodes_per_policy: z.literal(10),
    learned_policy_rollout_count: z.literal(20),
    completed_learned_policy_rollout_count: z.number().int().min(0).max(20),
    diagnostic_control_rollout_count: z.number().int().min(0).max(20),
    completed_diagnostic_control_rollout_count: z.number().int().min(0).max(20),
  }).strict(),
  episode_interpretation: pipelineEpisodeInterpretationSummarySchema.optional(),
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
    interpretation: pipelineEpisodeInterpretationSchema.nullable().optional(),
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
    controls_csv: pipelineArtifactSchema.optional(),
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
}).strict().superRefine((projection, context) => {
  for (const message of controlsProjectionBlockers(projection)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["controls"], message });
  if (
    Boolean(projection.task_success_contract)
      !== Boolean(projection.task_success_contract_digest)
    || (projection.task_success_contract
      && projection.task_success_contract_digest
        !== projection.task_success_contract.contract_digest)
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["task_success_contract_digest"],
    message: "task success contract digest mismatch",
  });
});

export const pipelinePolicyCanaryResultDeliverySchema = z.object({
  schema_version: z.literal("task_evaluation_result_delivery.v2"),
  run_id: identifier,
  result_status: z.enum(["completed_unqualified", "blocked", "cancelled"]),
  claim_ceiling: z.literal("diagnostic_policy_execution"),
  delivery_digest: digest,
  scene_controls_status: controlsStatusSchema.optional(),
  warning: controlsWarningSchema.optional(),
  ...policyCanaryControlFields,
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
  scene_controls_status: controlsStatusSchema,
  warning: controlsWarningSchema,
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
    || projection.scene_controls_status !== publication.scene_controls_status
    || projection.warning !== publication.warning
    || projection.notification_delivery.run_result_digest !== projection.report.result_digest
  ) blockers.push("policy_canary_publication_binding_mismatch");
  if (projection.controls) {
    for (const key of ["controls", "controls_summary", "controls_gate", "strict_paired_gate", "paired_delivery", "strict_gate_blockers"] as const) {
      if (canonicalArtifactDigest({ value: projection[key] }, "comparison_digest") !== canonicalArtifactDigest({ value: delivery[key] }, "comparison_digest")) blockers.push("policy_canary_controls_delivery_mismatch");
    }
    if (delivery.scene_controls_status !== projection.scene_controls_status || delivery.warning !== projection.warning) blockers.push("policy_canary_controls_delivery_mismatch");
    const inventory = Array.isArray(delivery.artifacts) ? delivery.artifacts as Array<Record<string, unknown>> : [];
    const controlsCsv = projection.report.controls_csv;
    if (!controlsCsv || !inventory.some((artifact) => artifact.artifact_id === controlsCsv.artifact_id && artifact.digest === controlsCsv.digest && artifact.size_bytes === controlsCsv.size_bytes)) blockers.push("policy_canary_controls_csv_unbound");
    for (const control of projection.controls) {
      for (const ref of [control.receipt, control.cell_receipt, ...Object.values(control.videos), ...control.artifacts]) {
        if (inventory.filter((artifact) => artifact.artifact_id === ref.artifact_id && artifact.digest === ref.digest && artifact.size_bytes === ref.size_bytes).length !== 1) blockers.push("policy_canary_control_artifact_unbound");
      }
    }
  }
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
