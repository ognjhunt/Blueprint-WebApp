import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";
import {
  maintainedSiteTaskTestbedSchema,
  nativeDecisionEvidenceRequestSchema,
} from "./siteTaskTestbedContract";
import { parsePipelinePolicyCanaryPublication } from "./policyCanaryWebappSyncContract";

const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const nonEmpty = z.string().trim().min(1);

export const nativeEvidencePlanSchema = z.object({
  schema_version: z.literal("evidence_plan.v1"),
  plan_id: identifier,
  request_id: identifier,
  decision_id: identifier,
  request_digest: digest,
  testbed_id: identifier,
  testbed_version: identifier,
  testbed_digest: digest,
  claim_plans: z.array(z.record(z.string(), z.unknown())).min(1),
  execution_order: z.array(nonEmpty),
  physical_evidence_requests: z.array(z.record(z.string(), z.unknown())),
  budget_status: z.record(z.string(), z.unknown()),
  router_policy: z.object({
    deterministic: z.literal(true),
    provider_identity_is_qualification: z.literal(false),
    visual_realism_is_qualification: z.literal(false),
    agreement_is_independence: z.literal(false),
    uncalibrated_methods_are_debug_only: z.literal(true),
    cross_domain_transfer_enabled: z.literal(false),
    policy_ranking_thesis_verdict: z.literal("thesis_not_supported"),
  }).passthrough(),
  plan_digest: digest,
}).passthrough();

export const nativeDecisionEnvelopeSchema = z.object({
  schema_version: z.literal("decision_envelope.v1"),
  decision_id: identifier,
  request_id: identifier,
  request_digest: digest,
  plan_digest: digest,
  testbed_digest: digest,
  decision_question: nonEmpty,
  overall_outcome: z.enum(["decision", "partial_decision", "abstention"]),
  per_claim_verdicts: z.array(z.object({
    claim_id: identifier,
    claim_type: nonEmpty,
    verdict: z.enum(["supported", "not_supported", "abstention"]),
    rationale: nonEmpty,
    accepted_result_digests: z.array(digest),
    claim_ceiling: z.object({
      physical_success: z.boolean(),
      deployment_readiness: z.literal(false),
      safety_certification: z.literal(false),
    }).passthrough(),
  }).passthrough()).min(1),
  evidence_accepted: z.array(digest),
  evidence_rejected: z.array(z.record(z.string(), z.unknown())),
  validation_envelope: z.record(z.string(), z.unknown()),
  unsupported_conditions: z.array(nonEmpty),
  uncertainty: z.object({
    maximum: z.number().min(0).max(1),
    ranking_science_boundary: z.literal("thesis_not_supported"),
  }).strict(),
  cross_method_disagreements: z.array(z.record(z.string(), z.unknown())),
  shared_dependency_warnings: z.array(z.record(z.string(), z.unknown())),
  claim_ceiling: z.object({
    deployment_readiness: z.literal(false),
    safety_certification: z.literal(false),
    generated_artifact_upgrades_raw_or_physical_claim: z.literal(false),
  }).passthrough(),
  next_cheapest_experiment: nonEmpty,
  physical_evidence_still_required: z.array(z.record(z.string(), z.unknown())),
  deployment_approval: z.literal(false),
  safety_certification: z.literal(false),
  raw_policy_values_persisted: z.literal(false),
  raw_secret_values_persisted: z.literal(false),
  decision_envelope_digest: digest,
}).passthrough();

const resultArtifactSchema = z.object({
  artifact_id: z.string().regex(/^[0-9a-f]{32}$/),
  role: nonEmpty,
  relative_path: nonEmpty,
  sha256: digest,
  size_bytes: z.number().int().nonnegative(),
  content_type: nonEmpty,
  media_type: nonEmpty.optional(),
  retention_status: z.enum(["retained", "expires", "expired", "not_reported"]).optional(),
  retention_expires_at_iso: z.string().datetime({ offset: true }).nullable().optional(),
  access_mode: z.enum(["authenticated_ticket", "inline", "restricted", "not_reported"]).optional(),
}).strict();

export const taskEvaluationResultDeliverySchema = z.object({
  schema_version: z.literal("task_evaluation_result_delivery.v1"),
  run_id: identifier,
  state: z.enum(["decided", "partially_decided", "abstained"]),
  status: z.enum(["ready", "blocked"]),
  claim_class: z.enum(["development_only", "evaluation"]),
  decision_envelope_digest: digest,
  episode_evidence_index_digest: digest.optional(),
  stages: z.array(z.object({
    stage: z.enum(["validate", "seal", "project", "package", "publish"]),
    status: z.enum(["complete", "ready", "blocked", "waiting"]),
  }).strict()).length(5),
  blockers: z.array(nonEmpty),
  summary: z.object({
    episode_count: z.number().int().nonnegative(),
    learned_candidate_episode_count: z.number().int().nonnegative(),
    control_episode_count: z.number().int().nonnegative(),
    successful_episode_count: z.number().int().nonnegative(),
  }).strict(),
  episodes: z.array(z.object({
    episode_id: identifier,
    episode_kind: z.enum(["control", "learned_candidate"]),
    subject_id: nonEmpty,
    score: z.object({
      status: nonEmpty,
      outcome: z.unknown().optional(),
      task_succeeded: z.boolean().nullable().optional(),
      outcome_rank: z.unknown().optional(),
      grader_authority: nonEmpty,
    }).passthrough(),
    artifacts: z.object({
      receipt: resultArtifactSchema,
      frame_manifest: resultArtifactSchema,
      videos: z.object({
        external: resultArtifactSchema,
        wrist: resultArtifactSchema,
        overview: resultArtifactSchema,
      }).strict(),
    }).strict(),
  }).strict()),
  artifacts: z.array(resultArtifactSchema),
  proof_boundary: z.object({
    review_video_is_authoritative_evidence: z.literal(false),
    simulation_is_physical_success: z.literal(false),
    cross_team_leaderboard_authorized: z.literal(false),
  }).strict(),
  delivery_digest: digest,
}).strict();

const policyCanaryEpisodeSchema = z.object({
  episode_id: identifier,
  episode_kind: z.enum(["control", "learned_candidate"]),
  subject_id: nonEmpty,
  policy_candidate_id: identifier.nullable(),
  policy_checkpoint_digest: digest.nullable(),
  robot_preset_id: identifier,
  runtime_identity: nonEmpty,
  variation: z.object({
    cell_id: identifier,
    family_id: nonEmpty,
    seed: z.number().int().nonnegative(),
    partition: z.enum(["canonical", "stress", "held_out"]),
  }).strict(),
  reset_state_digest: digest,
  policy_query: z.object({
    candidate_policy_queried: z.boolean(),
    receipt: resultArtifactSchema.nullable(),
  }).strict(),
  action_delivery: z.object({
    actions_reached_robot: z.boolean(),
    arm_moved: z.boolean(),
    returned_action_sequence: resultArtifactSchema.nullable(),
    delivery_readback: resultArtifactSchema.nullable(),
    harness_failure_code: identifier.nullable(),
  }).strict(),
  traces: z.object({
    state: resultArtifactSchema.nullable(),
    contact_force: resultArtifactSchema.nullable(),
    task_object_trajectory: resultArtifactSchema.nullable(),
  }).strict(),
  score: z.object({
    status: nonEmpty,
    task_succeeded: z.boolean().nullable(),
    progress_score: z.number().nullable(),
    destination_error: z.number().nonnegative().nullable(),
    contact_maintenance_rate: z.number().min(0).max(1).nullable(),
    collision: z.boolean().nullable(),
    grader_authority: z.literal("deterministic_simulator_state"),
    policy_outcome_interpretable: z.boolean(),
  }).strict(),
  failure: z.object({
    code: identifier,
    phase: nonEmpty.nullable(),
    summary: nonEmpty,
  }).strict().nullable(),
  evidence: z.object({
    complete: z.boolean(),
    lossless_policy_inputs: resultArtifactSchema.nullable(),
    frame_manifest: resultArtifactSchema.nullable(),
    videos: z.record(z.string(), resultArtifactSchema),
    typed_media_gap: z.object({ code: identifier, explanation: nonEmpty }).strict().nullable(),
    episode_json: resultArtifactSchema.nullable().optional(),
    indexed_mcap_rosbag: resultArtifactSchema.nullable().optional(),
  }).strict(),
  wall_time_seconds: z.number().nonnegative(),
  provider_attribution: nonEmpty,
  timing: z.object({
    started_at_iso: z.string().datetime({ offset: true }),
    completed_at_iso: z.string().datetime({ offset: true }),
    duration_seconds: z.number().nonnegative(),
  }).strict().optional(),
  timeline: z.array(z.object({
    time_seconds: z.number().nonnegative(),
    action: z.string().trim().max(500).nullable(),
    joint_pose: z.string().trim().max(500).nullable(),
    task_object_pose: z.string().trim().max(500).nullable(),
    contact_state: z.string().trim().max(500).nullable(),
    force_newtons: z.number().nullable(),
    scoring_state: z.string().trim().max(500).nullable(),
  }).strict()).max(10_000).optional(),
  telemetry: z.object({
    policy_query_count: z.number().int().nonnegative().nullable(),
    policy_latency_ms: z.object({
      p50: z.number().nonnegative().nullable(),
      p95: z.number().nonnegative().nullable(),
      maximum: z.number().nonnegative().nullable(),
    }).strict(),
    gpu_utilization_percent: z.number().min(0).max(100).nullable(),
    gpu_memory_bytes: z.number().int().nonnegative().nullable(),
    cpu_utilization_percent: z.number().min(0).max(100).nullable(),
    memory_bytes: z.number().int().nonnegative().nullable(),
    network_received_bytes: z.number().int().nonnegative().nullable(),
    network_transmitted_bytes: z.number().int().nonnegative().nullable(),
    disk_read_bytes: z.number().int().nonnegative().nullable(),
    disk_written_bytes: z.number().int().nonnegative().nullable(),
  }).strict().optional(),
  video_timebase_offsets_seconds: z.record(
    z.string().trim().min(1),
    z.number().finite(),
  ).optional(),
}).strict().superRefine((episode, context) => {
  if (episode.episode_kind === "learned_candidate" && !episode.policy_candidate_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["policy_candidate_id"], message: "learned episode requires policy identity" });
  }
  if (
    episode.policy_query.candidate_policy_queried
    && !episode.policy_query.receipt
  ) context.addIssue({ code: z.ZodIssueCode.custom, path: ["policy_query", "receipt"], message: "queried policy requires receipt" });
  if (!episode.evidence.frame_manifest && !episode.evidence.typed_media_gap) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["evidence"], message: "episode requires frame manifest or typed media gap" });
  }
});

export const policyCanaryResultDeliverySchema = z.object({
  schema_version: z.literal("task_evaluation_result_delivery.v2"),
  run_id: identifier,
  result_status: z.enum(["completed_unqualified", "blocked", "cancelled"]),
  status: z.enum(["ready", "blocked"]),
  claim_ceiling: z.literal("diagnostic_policy_execution"),
  stages: z.array(z.object({
    stage: z.enum(["validate", "seal", "project", "package", "publish"]),
    status: z.enum(["complete", "ready", "blocked", "waiting"]),
  }).strict()).length(5),
  blockers: z.array(nonEmpty),
  summary: z.object({
    episode_count: z.number().int().nonnegative(),
    learned_candidate_episode_count: z.number().int().nonnegative(),
    control_episode_count: z.number().int().nonnegative(),
    successful_episode_count: z.number().int().nonnegative(),
    interpretable_episode_count: z.number().int().nonnegative(),
  }).strict(),
  episodes: z.array(policyCanaryEpisodeSchema),
  artifacts: z.array(resultArtifactSchema),
  proof_boundary: z.object({
    review_video_is_authoritative_evidence: z.literal(false),
    simulation_is_physical_success: z.literal(false),
    cross_team_leaderboard_authorized: z.literal(false),
    result_is_unqualified: z.literal(true),
    official_ranking_contribution: z.literal(false),
  }).strict(),
  delivery_digest: digest,
}).strict();

export const policyCanaryResultProjectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_canary_result_projection.v1"),
  run_id: identifier,
  request_digest: digest,
  configuration_digest: digest,
  matrix_digest: digest,
  candidate_results: z.array(z.object({
    candidate_id: identifier,
    display_name: nonEmpty,
    checkpoint_digest: digest,
    episodes_completed: z.number().int().min(0).max(10),
    interpretable_episode_count: z.number().int().min(0).max(10),
    success_count: z.number().int().min(0).max(10),
    success_rate: z.number().min(0).max(1).nullable(),
    progress_score: z.number().nullable(),
    mean_destination_error: z.number().nonnegative().nullable(),
    contact_maintenance_rate: z.number().min(0).max(1).nullable(),
    collision_rate: z.number().min(0).max(1).nullable(),
    action_delivery_rate: z.number().min(0).max(1),
  }).strict()).length(2),
  failure_analysis: z.array(z.object({
    code: identifier,
    count: z.number().int().nonnegative(),
    representative_episode_ids: z.array(identifier).max(20),
  }).strict()),
  coverage_gaps: z.array(z.object({
    family: nonEmpty,
    code: identifier,
    explanation: nonEmpty,
    deterministic_fallback_family: nonEmpty,
  }).strict()).optional(),
  runtime_system_telemetry: z.object({
    gpu_utilization_percent: z.number().min(0).max(100).nullable(),
    gpu_memory_bytes: z.number().int().nonnegative().nullable(),
    cpu_utilization_percent: z.number().min(0).max(100).nullable(),
    memory_bytes: z.number().int().nonnegative().nullable(),
    network_received_bytes: z.number().int().nonnegative().nullable(),
    network_transmitted_bytes: z.number().int().nonnegative().nullable(),
    disk_read_bytes: z.number().int().nonnegative().nullable(),
    disk_written_bytes: z.number().int().nonnegative().nullable(),
    policy_query_count: z.number().int().nonnegative().nullable(),
    policy_latency_ms: z.object({
      p50: z.number().nonnegative().nullable(),
      p95: z.number().nonnegative().nullable(),
      maximum: z.number().nonnegative().nullable(),
    }).strict(),
    episode_wall_time_seconds: z.object({
      minimum: z.number().nonnegative().nullable(),
      median: z.number().nonnegative().nullable(),
      maximum: z.number().nonnegative().nullable(),
    }).strict(),
  }).strict().optional(),
  reproducibility: z.object({
    scene_revision_digest: digest,
    runtime_container_digest: digest,
    scoring_version: nonEmpty,
    observation_schema_id: identifier.optional(),
    action_schema_id: identifier.optional(),
    calibration_digest: digest.optional(),
    timebase: z.object({
      clock_id: nonEmpty,
      frequency_hz: z.number().positive().nullable(),
      synchronized: z.boolean(),
    }).strict().optional(),
    evidence_manifest: resultArtifactSchema,
    billing_receipt: resultArtifactSchema,
    teardown_receipt: resultArtifactSchema,
    provider_zero_receipt: resultArtifactSchema,
  }).strict(),
  winner_declared: z.literal(false),
  official_ranking_contribution: z.literal(false),
  projection_digest: digest,
}).strict();

const policyCanaryRunPublicationSchema = z.object({
  schema_version: z.literal("task_evaluation_run_publication.v4"),
  run_id: identifier,
  source_launch_id: identifier,
  offering_digest: digest,
  request_digest: digest,
  configuration_digest: digest,
  run_kind: z.literal("internal_policy_canary"),
  claim_ceiling: z.literal("diagnostic_policy_execution"),
  result_status: z.enum(["completed_unqualified", "blocked", "cancelled"]),
  scene_controls_status: z.literal("configured_controls_pending"),
  warning: z.literal("Controls pending — results are unqualified."),
  scene: z.object({ id: identifier, revision_digest: digest }).strict(),
  task: z.object({ id: identifier, label: nonEmpty }).strict(),
  robot: z.object({ preset_id: identifier, display_name: nonEmpty }).strict(),
  policy_candidates: z.array(z.object({
    candidate_id: identifier,
    display_name: nonEmpty,
    checkpoint_digest: digest,
  }).strict()).length(2),
  submitted_by: z.object({ actor_id: identifier, actor_role: nonEmpty }).strict().optional(),
  team_namespace: identifier.optional(),
  access_visibility: z.enum(["owner_only", "organization_members"]).optional(),
  started_at_iso: z.string().datetime({ offset: true }).optional(),
  completed_at_iso: z.string().datetime({ offset: true }).optional(),
  duration_seconds: z.number().nonnegative().optional(),
  notification_delivery: z.object({
    status: z.enum(["pending", "accepted", "delivered", "failed"]),
    provider: nonEmpty.nullable(),
    message_id: nonEmpty.nullable(),
    attempts: z.number().int().nonnegative(),
    accepted_at_iso: z.string().datetime({ offset: true }).nullable().optional(),
    delivered_at_iso: z.string().datetime({ offset: true }).nullable(),
    failure_reason: nonEmpty.nullable(),
    receipt: resultArtifactSchema.nullable().optional(),
  }).strict().optional(),
  result_delivery: policyCanaryResultDeliverySchema,
  policy_canary_result: policyCanaryResultProjectionSchema,
  proof_boundary: z.object({
    result_is_unqualified: z.literal(true),
    controls_pending: z.literal(true),
    winner_declared: z.literal(false),
    official_ranking_contribution: z.literal(false),
    scene_promotion_permitted: z.literal(false),
    simulation_is_physical_success: z.literal(false),
  }).strict(),
  publication_digest: digest,
}).strict();

const policyVariationFamilies = [
  "canonical_anchor",
  "placement_approach",
  "illumination",
  "camera_sensor",
  "bounded_physics",
  "pairwise",
  "held_out",
] as const;
const policyFamilyMetric = z.object({
  attempted: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  success_rate: z.number().min(0).max(1),
  degradation_from_canonical: z.number().min(-1).max(1),
}).strict();
const policyCandidateResultBase = z.object({
  episodes_completed: z.number().int().min(0).max(500),
  family_metrics: z.record(z.enum(policyVariationFamilies), policyFamilyMetric),
  failures: z.array(z.object({
    code: identifier,
    count: z.number().int().positive(),
  }).strict()).max(500),
  contacts: z.object({
    contact_count: z.number().int().nonnegative(),
    violation_count: z.number().int().nonnegative(),
  }).strict(),
  evidence: z.object({
    lossless_frame_manifest_count: z.number().int().nonnegative(),
    review_video_count: z.number().int().nonnegative(),
    typed_media_gap_count: z.number().int().nonnegative(),
  }).strict(),
});

export const taskEvaluationPolicyRunResultProjectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_result_projection.v1"),
  run_id: identifier,
  source_launch_id: identifier,
  offering_digest: digest,
  configuration_digest: digest,
  plan_digest: digest,
  embodiment_id: z.literal("franka_panda_robotiq_2f85_v1"),
  candidate_ids: z.tuple([z.literal("pi05_droid"), z.literal("groot_n17_droid")]),
  state: z.enum(["decided", "partially_decided", "abstained"]),
  matrix: z.object({
    scored_cell_count: z.union([z.literal(10), z.literal(100), z.literal(500)]),
    candidate_episode_count: z.number().int().min(20).max(1_000),
    control_episode_count: z.number().int().min(20).max(1_000),
    expected_episode_count: z.number().int().min(40).max(2_000),
    completed_episode_count: z.number().int().min(0).max(2_000),
    identical_candidate_cells_and_seeds: z.literal(true),
    controls_complete: z.boolean(),
  }).strict(),
  candidate_results: z.tuple([
    policyCandidateResultBase.extend({ candidate_id: z.literal("pi05_droid") }).strict(),
    policyCandidateResultBase.extend({ candidate_id: z.literal("groot_n17_droid") }).strict(),
  ]),
  paired_comparison: z.object({
    matched_episode_pairs: z.number().int().min(0).max(500),
    decision: z.enum(["pi05_droid", "groot_n17_droid", "tie", "abstain"]),
    deterministic_non_policy_scoring: z.literal(true),
  }).strict(),
  result_delivery_digest: digest,
  blockers: z.array(z.string().trim().min(1).max(512)).max(128),
  proof_boundary: z.object({
    simulation_is_physical_success: z.literal(false),
    review_video_is_authoritative_evidence: z.literal(false),
    policy_can_grade_itself: z.literal(false),
    cross_team_leaderboard_authorized: z.literal(false),
  }).strict(),
  projection_digest: digest,
}).strict();

const taskEvaluationRunPublicationBaseSchema = z.object({
  capture_session_id: identifier,
  intake_id: identifier,
  run_id: identifier,
  testbed_digest: digest,
  request_digest: digest,
  plan_digest: digest,
  state: z.enum(["decided", "partially_decided", "abstained"]),
  evidence_plan: nativeEvidencePlanSchema,
  decision_envelope: nativeDecisionEnvelopeSchema,
  proof_boundary: z.object({
    simulation_is_physical_success: z.literal(false),
    deployment_or_safety_approved: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).passthrough(),
});

export const taskEvaluationRunPublicationSchema = z.discriminatedUnion("schema_version", [
  taskEvaluationRunPublicationBaseSchema.extend({
    schema_version: z.literal("task_evaluation_run_publication.v1"),
  }).strict(),
  taskEvaluationRunPublicationBaseSchema.extend({
    schema_version: z.literal("task_evaluation_run_publication.v2"),
    result_delivery: taskEvaluationResultDeliverySchema,
  }).strict(),
  taskEvaluationRunPublicationBaseSchema.extend({
    schema_version: z.literal("task_evaluation_run_publication.v3"),
    result_delivery: taskEvaluationResultDeliverySchema,
    policy_run_result: taskEvaluationPolicyRunResultProjectionSchema,
  }).strict(),
  policyCanaryRunPublicationSchema,
]);

export const taskEvaluationRunPreparationSchema = z.object({
  schema_version: z.literal("task_evaluation_run_preparation.v1"),
  run_id: identifier,
  capture_session_id: identifier,
  intake_id: identifier,
  state: z.literal("authorization_required"),
  request: nativeDecisionEvidenceRequestSchema,
  evidence_plan: nativeEvidencePlanSchema,
  method_catalog: z.object({
    catalog_id: identifier,
    version: identifier,
    catalog_digest: digest,
    pipeline_owned: z.literal(true),
  }).strict(),
  authorization_candidates: z.array(z.object({
    adapter_reference: nonEmpty,
    method_id: identifier,
    method_version: identifier,
    method_profile_digest: digest,
    method_family: nonEmpty,
    expected_cost_usd: z.number().min(0),
    proof_tier: nonEmpty,
    execution_authorized: z.literal(false),
  }).strict()),
  execution_started: z.literal(false),
  proof_boundary: z.object({
    state_is_scientific_verdict: z.literal(false),
    simulation_is_physical_success: z.literal(false),
    deployment_or_safety_approved: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).passthrough(),
}).passthrough();

export const taskEvaluationRunAuthorizationSchema = z.object({
  schema_version: z.literal("task_evaluation_run_execution_authorization.v1"),
  run_id: identifier,
  plan_digest: digest,
  authorized_adapter_references: z.array(nonEmpty),
  actor: z.record(z.string(), z.unknown()),
  idempotency_key: identifier,
  live_provider_execution: z.literal(false),
  paid_compute_authorized: z.literal(false),
  physical_robot_run_authorized: z.literal(false),
  proof_boundary: z.object({
    authorization_is_method_qualification: z.literal(false),
    simulation_is_physical_success: z.literal(false),
    comparative_policy_ranking_verdict: z.literal("thesis_not_supported"),
  }).passthrough(),
  authorization_digest: digest,
}).strict();

export const taskEvaluationRunExecutionResultSchema = z.object({
  schema_version: z.literal("task_evaluation_run_execution_result.v1"),
  run_id: identifier,
  state: z.enum(["decided", "partially_decided", "abstained"]),
  already_exists: z.boolean(),
  decision_envelope: nativeDecisionEnvelopeSchema,
  execution_manifest: z.record(z.string(), z.unknown()).optional(),
  evidence_results: z.array(z.record(z.string(), z.unknown())).optional(),
  webapp_sync: z.record(z.string(), z.unknown()),
}).passthrough();

function sensitivePaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => sensitivePaths(child, `${prefix}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const lowered = key.toLowerCase();
    const sensitive = /(^|_)(secret|token|password|private_key|api_key|credential)($|_)/i.test(lowered)
      && child !== null && child !== "" && child !== false;
    return [...(sensitive ? [path] : []), ...sensitivePaths(child, path)];
  });
}

export function parseVerifiedTaskEvaluationRunPublication(value: unknown):
  | { ok: false; blockers: string[] }
  | { ok: true; publication: Record<string, any> } {
  if (
    value
    && typeof value === "object"
    && (value as Record<string, unknown>).schema_version
      === "task_evaluation_run_publication.v4"
  ) {
    const canary = parsePipelinePolicyCanaryPublication(value);
    return canary.ok
      ? { ok: true, publication: canary.publication }
      : canary;
  }
  const parsed = taskEvaluationRunPublicationSchema.safeParse(value);
  if (!parsed.success) return { ok: false as const, blockers: ["run_publication_schema_invalid"] };
  const publication = parsed.data;
  const blockers: string[] = [];
  if (publication.schema_version === "task_evaluation_run_publication.v4") {
    const delivery = publication.result_delivery;
    const result = publication.policy_canary_result;
    if (
      canonicalArtifactDigest(publication, "publication_digest")
        !== publication.publication_digest
    ) blockers.push("run_publication_digest_mismatch");
    if (
      canonicalArtifactDigest(delivery, "delivery_digest")
        !== delivery.delivery_digest
    ) blockers.push("result_delivery_digest_mismatch");
    if (
      canonicalArtifactDigest(result, "projection_digest")
        !== result.projection_digest
    ) blockers.push("policy_canary_result_projection_digest_mismatch");
    if (
      delivery.run_id !== publication.run_id
      || delivery.result_status !== publication.result_status
      || delivery.claim_ceiling !== publication.claim_ceiling
      || delivery.summary.episode_count !== delivery.episodes.length
      || result.run_id !== publication.run_id
      || result.request_digest !== publication.request_digest
      || result.configuration_digest !== publication.configuration_digest
      || result.reproducibility.scene_revision_digest
        !== publication.scene.revision_digest
      || publication.policy_candidates.some((candidate, index) => (
        result.candidate_results[index]?.candidate_id !== candidate.candidate_id
        || result.candidate_results[index]?.checkpoint_digest
          !== candidate.checkpoint_digest
      ))
      || (publication.result_status === "completed_unqualified"
        && (delivery.status !== "ready" || delivery.blockers.length > 0))
      || (publication.result_status !== "completed_unqualified"
        && delivery.status !== "blocked")
    ) blockers.push("policy_canary_result_binding_mismatch");
    const artifactIds = delivery.artifacts.map((artifact) => artifact.artifact_id);
    if (new Set(artifactIds).size !== artifactIds.length) {
      blockers.push("result_delivery_artifact_duplicate");
    }
    const admittedIds = new Set(artifactIds);
    for (const episode of delivery.episodes) {
      const references = [
        episode.policy_query.receipt,
        episode.action_delivery.returned_action_sequence,
        episode.action_delivery.delivery_readback,
        episode.traces.state,
        episode.traces.contact_force,
        episode.traces.task_object_trajectory,
        episode.evidence.lossless_policy_inputs,
        episode.evidence.frame_manifest,
        episode.evidence.episode_json,
        episode.evidence.indexed_mcap_rosbag,
        ...Object.values(episode.evidence.videos),
      ].filter((artifact): artifact is z.infer<typeof resultArtifactSchema> => Boolean(artifact));
      if (references.some((artifact) => !admittedIds.has(artifact.artifact_id))) {
        blockers.push("result_delivery_episode_artifact_not_admitted");
      }
    }
    const operationalReferences = [
      result.reproducibility.evidence_manifest,
      result.reproducibility.billing_receipt,
      result.reproducibility.teardown_receipt,
      result.reproducibility.provider_zero_receipt,
      publication.notification_delivery?.receipt,
    ].filter((artifact): artifact is z.infer<typeof resultArtifactSchema> => Boolean(artifact));
    if (operationalReferences.some((artifact) => !admittedIds.has(artifact.artifact_id))) {
      blockers.push("result_delivery_operational_artifact_not_admitted");
    }
    if (sensitivePaths(publication).length) {
      blockers.push("run_publication_secret_value_forbidden");
    }
    return blockers.length
      ? { ok: false as const, blockers: [...new Set(blockers)].sort() }
      : { ok: true as const, publication };
  }
  if (canonicalArtifactDigest(publication.evidence_plan, "plan_digest") !== publication.evidence_plan.plan_digest) {
    blockers.push("evidence_plan_digest_mismatch");
  }
  if (canonicalArtifactDigest(publication.decision_envelope, "decision_envelope_digest") !== publication.decision_envelope.decision_envelope_digest) {
    blockers.push("decision_envelope_digest_mismatch");
  }
  if (
    publication.plan_digest !== publication.evidence_plan.plan_digest ||
    publication.plan_digest !== publication.decision_envelope.plan_digest ||
    publication.request_digest !== publication.evidence_plan.request_digest ||
    publication.request_digest !== publication.decision_envelope.request_digest ||
    publication.testbed_digest !== publication.evidence_plan.testbed_digest ||
    publication.testbed_digest !== publication.decision_envelope.testbed_digest
  ) blockers.push("run_publication_binding_mismatch");
  const expectedState = publication.decision_envelope.overall_outcome === "decision"
    ? "decided"
    : publication.decision_envelope.overall_outcome === "partial_decision"
      ? "partially_decided"
      : "abstained";
  if (publication.state !== expectedState) blockers.push("run_publication_state_mismatch");
  if (
    publication.schema_version === "task_evaluation_run_publication.v2"
    || publication.schema_version === "task_evaluation_run_publication.v3"
  ) {
    const delivery = publication.result_delivery;
    if (canonicalArtifactDigest(delivery, "delivery_digest") !== delivery.delivery_digest) {
      blockers.push("result_delivery_digest_mismatch");
    }
    if (
      delivery.run_id !== publication.run_id ||
      delivery.state !== publication.state ||
      delivery.decision_envelope_digest !== publication.decision_envelope.decision_envelope_digest ||
      delivery.summary.episode_count !== delivery.episodes.length ||
      (delivery.status === "ready" && (delivery.blockers.length > 0 || delivery.artifacts.length === 0)) ||
      (delivery.status === "blocked" && delivery.blockers.length === 0)
    ) blockers.push("result_delivery_binding_mismatch");
    const artifactIds = delivery.artifacts.map((artifact) => artifact.artifact_id);
    if (new Set(artifactIds).size !== artifactIds.length) blockers.push("result_delivery_artifact_duplicate");
    const admittedIds = new Set(artifactIds);
    for (const episode of delivery.episodes) {
      const referenced = [
        episode.artifacts.receipt,
        episode.artifacts.frame_manifest,
        ...Object.values(episode.artifacts.videos),
      ];
      if (referenced.some((artifact) => !admittedIds.has(artifact.artifact_id))) {
        blockers.push("result_delivery_episode_artifact_not_admitted");
      }
    }
  }
  if (publication.schema_version === "task_evaluation_run_publication.v3") {
    const policyResult = publication.policy_run_result;
    if (
      canonicalArtifactDigest(policyResult, "projection_digest")
        !== policyResult.projection_digest
    ) blockers.push("policy_run_projection_digest_mismatch");
    if (
      policyResult.run_id !== publication.run_id
      || policyResult.state !== publication.state
      || policyResult.plan_digest !== publication.plan_digest
      || policyResult.result_delivery_digest !== publication.result_delivery.delivery_digest
      || policyResult.matrix.candidate_episode_count
        !== policyResult.matrix.scored_cell_count * 2
      || policyResult.matrix.control_episode_count
        !== policyResult.matrix.scored_cell_count * 2
      || policyResult.matrix.expected_episode_count
        !== policyResult.matrix.scored_cell_count * 4
    ) blockers.push("policy_run_result_binding_mismatch");
    for (const result of policyResult.candidate_results) {
      const families = Object.keys(result.family_metrics);
      if (
        families.length !== policyVariationFamilies.length
        || policyVariationFamilies.some((family) => !families.includes(family))
      ) blockers.push("policy_run_result_family_coverage_invalid");
      const perCandidate = policyResult.matrix.candidate_episode_count / 2;
      const metrics = Object.values(result.family_metrics);
      if (
        metrics.some((metric) => (
          metric.succeeded > metric.attempted
          || metric.attempted > 0
            && Math.abs(metric.success_rate - metric.succeeded / metric.attempted) > 1e-9
        ))
        || metrics.reduce((sum, metric) => sum + metric.attempted, 0) !== perCandidate
        || result.episodes_completed > perCandidate
        || result.evidence.lossless_frame_manifest_count > result.episodes_completed
        || result.evidence.review_video_count > result.episodes_completed
      ) blockers.push("policy_run_result_metric_or_evidence_invalid");
    }
    const perCandidate = policyResult.matrix.candidate_episode_count / 2;
    if (policyResult.state === "decided") {
      if (
        policyResult.blockers.length > 0
        || policyResult.matrix.completed_episode_count
          !== policyResult.matrix.expected_episode_count
        || !policyResult.matrix.controls_complete
        || policyResult.candidate_results.some((result) => (
          result.episodes_completed !== perCandidate
          || result.evidence.lossless_frame_manifest_count !== perCandidate
          || result.evidence.review_video_count !== perCandidate
          || result.evidence.typed_media_gap_count !== 0
        ))
        || policyResult.paired_comparison.matched_episode_pairs !== perCandidate
      ) blockers.push("policy_run_result_decision_evidence_incomplete");
    } else if (policyResult.blockers.length === 0) {
      blockers.push("policy_run_result_nondecision_blocker_missing");
    }
  }
  if (sensitivePaths(publication).length) blockers.push("run_publication_secret_value_forbidden");
  return blockers.length
    ? { ok: false as const, blockers: [...new Set(blockers)].sort() }
    : { ok: true as const, publication };
}

export function parseVerifiedTaskEvaluationRunPreparation(params: {
  value: unknown;
  expectedCaptureSessionId: string;
  expectedIntakeId: string;
  expectedRunId: string;
  expectedRequestDigest: string;
  expectedTestbed: unknown;
}) {
  const parsed = taskEvaluationRunPreparationSchema.safeParse(params.value);
  if (!parsed.success) return { ok: false as const, blockers: ["run_preparation_schema_invalid"] };
  const preparation = parsed.data;
  const testbed = maintainedSiteTaskTestbedSchema.safeParse(params.expectedTestbed);
  if (!testbed.success) return { ok: false as const, blockers: ["run_preparation_testbed_invalid"] };
  const blockers: string[] = [];
  if (canonicalArtifactDigest(preparation.evidence_plan, "plan_digest") !== preparation.evidence_plan.plan_digest) {
    blockers.push("run_preparation_plan_digest_mismatch");
  }
  if (
    preparation.capture_session_id !== params.expectedCaptureSessionId ||
    preparation.intake_id !== params.expectedIntakeId ||
    preparation.run_id !== params.expectedRunId ||
    preparation.request.request_digest !== params.expectedRequestDigest ||
    preparation.evidence_plan.request_digest !== params.expectedRequestDigest ||
    preparation.request.testbed_digest !== testbed.data.testbed_digest ||
    preparation.evidence_plan.testbed_digest !== testbed.data.testbed_digest ||
    preparation.evidence_plan.plan_id.length === 0
  ) blockers.push("run_preparation_binding_mismatch");
  if (sensitivePaths(preparation).length) blockers.push("run_preparation_secret_value_forbidden");
  return blockers.length
    ? { ok: false as const, blockers: [...new Set(blockers)].sort() }
    : { ok: true as const, preparation };
}

export function parseVerifiedTaskEvaluationRunAuthorization(params: {
  value: unknown;
  expectedRunId: string;
  expectedPlanDigest: string;
  expectedAdapterReferences: string[];
  expectedActorRole: string;
  expectedActorIdentity: string;
}) {
  const parsed = taskEvaluationRunAuthorizationSchema.safeParse(params.value);
  if (!parsed.success) return { ok: false as const, blockers: ["run_authorization_schema_invalid"] };
  const authorization = parsed.data;
  const blockers: string[] = [];
  if (canonicalArtifactDigest(authorization, "authorization_digest") !== authorization.authorization_digest) {
    blockers.push("run_authorization_digest_mismatch");
  }
  if (
    authorization.run_id !== params.expectedRunId ||
    authorization.plan_digest !== params.expectedPlanDigest ||
    String(authorization.actor.role || "") !== params.expectedActorRole ||
    String(authorization.actor.identity || "") !== params.expectedActorIdentity ||
    JSON.stringify([...authorization.authorized_adapter_references].sort()) !==
      JSON.stringify([...params.expectedAdapterReferences].sort())
  ) blockers.push("run_authorization_binding_mismatch");
  if (sensitivePaths(authorization).length) blockers.push("run_authorization_secret_value_forbidden");
  return blockers.length
    ? { ok: false as const, blockers: [...new Set(blockers)].sort() }
    : { ok: true as const, authorization };
}

export function parseVerifiedTaskEvaluationRunExecutionResult(params: {
  value: unknown;
  expectedRunId: string;
  expectedPlanDigest: string;
  expectedRequestDigest: string;
  expectedTestbedDigest: string;
}) {
  const parsed = taskEvaluationRunExecutionResultSchema.safeParse(params.value);
  if (!parsed.success) return { ok: false as const, blockers: ["run_execution_result_schema_invalid"] };
  const result = parsed.data;
  const envelope = result.decision_envelope;
  const blockers: string[] = [];
  if (canonicalArtifactDigest(envelope, "decision_envelope_digest") !== envelope.decision_envelope_digest) {
    blockers.push("run_execution_decision_envelope_digest_mismatch");
  }
  const expectedState = envelope.overall_outcome === "decision"
    ? "decided"
    : envelope.overall_outcome === "partial_decision"
      ? "partially_decided"
      : "abstained";
  if (
    result.run_id !== params.expectedRunId ||
    result.state !== expectedState ||
    envelope.plan_digest !== params.expectedPlanDigest ||
    envelope.request_digest !== params.expectedRequestDigest ||
    envelope.testbed_digest !== params.expectedTestbedDigest
  ) blockers.push("run_execution_result_binding_mismatch");
  if (sensitivePaths(result).length) blockers.push("run_execution_result_secret_value_forbidden");
  return blockers.length
    ? { ok: false as const, blockers: [...new Set(blockers)].sort() }
    : { ok: true as const, result };
}
