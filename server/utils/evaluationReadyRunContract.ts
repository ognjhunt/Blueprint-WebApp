import { pipelinePolicyCanaryResultProjectionSchema } from "./policyCanaryWebappSyncContract";
import { controlsWarnings } from "./policyCanaryControls";
import { createHash } from "node:crypto";

import { z } from "zod";

import { canonicalArtifactDigest } from "./taskCandidateContract";
import { taskEvaluationPolicyRunResultProjectionSchema } from "./taskEvaluationRunContract";

export const FRANKA_DROID_EMBODIMENT_ID = "franka_panda_robotiq_2f85_v1" as const;
export const CANONICAL_POLICY_CANDIDATE_IDS = [
  "pi05_droid",
  "groot_n17_droid",
] as const;
export const POLICY_RUN_MATRIX_PROFILE_ID =
  "franka_rigid_relocation_nested_v1" as const;
export const POLICY_RUN_PRESET_IDS = [
  "quick_10",
  "standard_100",
  "deep_500",
] as const;

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$/);
const digest = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const immutableReference = z.object({
  uri: z.string().regex(/^(?:gs|s3|https):\/\/[^\s]+$/),
  digest,
  size_bytes: z.number().int().positive(),
}).strict();

export const POLICY_RUN_VARIATION_FAMILIES = [
  "canonical_anchor",
  "placement_approach",
  "illumination",
  "camera_sensor",
  "bounded_physics",
  "pairwise",
  "held_out",
] as const;

const variationFamily = z.enum(POLICY_RUN_VARIATION_FAMILIES);
const setupCellSchema = z.object({
  cell_id: identifier,
  family: variationFamily,
  partition: z.enum(["qualification", "held_out"]),
  scored: z.literal(true),
  cell_spec_digest: digest,
}).strict();

const familyCountsSchema = z.object({
  canonical_anchor: z.number().int().positive(),
  placement_approach: z.number().int().positive(),
  illumination: z.number().int().positive(),
  camera_sensor: z.number().int().positive(),
  bounded_physics: z.number().int().positive(),
  pairwise: z.number().int().positive(),
  held_out: z.number().int().positive(),
}).strict();

const estimateSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("unavailable") }).strict(),
  z.object({
    status: z.literal("estimated"),
    duration_minutes: z.object({
      minimum: z.number().nonnegative(),
      maximum: z.number().nonnegative(),
    }).strict(),
    cost_usd: z.object({
      minimum: z.number().nonnegative(),
      maximum: z.number().nonnegative(),
    }).strict(),
    basis_digest: digest,
    as_of: z.string().datetime({ offset: true }),
  }).strict(),
]);

const presetSchema = z.object({
  preset_id: z.enum(POLICY_RUN_PRESET_IDS),
  label: z.enum(["Quick", "Standard", "Deep"]),
  scenario_count_per_policy: z.union([z.literal(10), z.literal(100), z.literal(500)]),
  availability: z.enum(["enabled", "coming_later"]),
  default: z.boolean(),
  family_counts: familyCountsSchema,
  scenario_set_digest: digest,
  parent_preset_id: z.enum(POLICY_RUN_PRESET_IDS).nullable(),
  parent_prefix_count: z.number().int().nonnegative(),
  nesting_proof_digest: digest,
  estimate: estimateSchema,
  cells: z.array(setupCellSchema).min(1).max(500).optional(),
}).strict();

const preparationTemplateSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_preparation_template.v1"),
  template_digest: digest,
}).passthrough().superRefine((template, context) => {
  for (const field of [
    "expected_production_commit",
    "preparation_id",
    "team_namespace",
    "run_id",
    "run_mode",
    "policy_run_configuration",
    "policy_run_setup",
    "policy_run_selection",
  ]) if (field in template) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: [field],
    message: `policy-run preparation template cannot contain dynamic field ${field}`,
  });
  const publication = template.publication;
  if (
    publication && typeof publication === "object"
    && "input_namespace" in publication
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["publication", "input_namespace"],
    message: "policy-run preparation template cannot bind a team namespace",
  });
  if (
    canonicalArtifactDigest(
      template as unknown as Record<string, unknown>,
      "template_digest",
    ) !== template.template_digest
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["template_digest"],
    message: "policy-run preparation template digest mismatch",
  });
});

export const evaluationReadyPolicyRunSetupSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_setup.v1"),
  source_launch_id: identifier,
  offering_digest: digest,
  embodiment_id: z.literal(FRANKA_DROID_EMBODIMENT_ID),
  candidate_ids: z.tuple([
    z.literal(CANONICAL_POLICY_CANDIDATE_IDS[0]),
    z.literal(CANONICAL_POLICY_CANDIDATE_IDS[1]),
  ]),
  matrix_profile_id: z.literal(POLICY_RUN_MATRIX_PROFILE_ID),
  preregistration: immutableReference,
  scenario_compiler: z.object({
    compiler_id: z.literal("franka_rigid_relocation_nested_prefix"),
    compiler_version: z.literal("v1"),
    selection_rule: z.literal("published_ordered_prefix"),
    outcome_independent: z.literal(true),
    agent_may_select_cells: z.literal(false),
  }).strict(),
  presets: z.tuple([presetSchema, presetSchema, presetSchema]),
  preparation_template: preparationTemplateSchema,
  setup_digest: digest,
}).strict().superRefine((setup, context) => {
  const [quick, standard, deep] = setup.presets;
  const exactPresetFields = [
    [quick, "quick_10", "Quick", 10, "enabled", true, null, 0],
    [standard, "standard_100", "Standard", 100, "coming_later", false, "quick_10", 10],
    [deep, "deep_500", "Deep", 500, "coming_later", false, "standard_100", 100],
  ] as const;
  for (const [preset, id, label, count, availability, defaultValue, parent, prefix] of exactPresetFields) {
    if (
      preset.preset_id !== id || preset.label !== label
      || preset.scenario_count_per_policy !== count
      || preset.availability !== availability || preset.default !== defaultValue
      || preset.parent_preset_id !== parent || preset.parent_prefix_count !== prefix
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presets"],
      message: "policy-run preset identity or nesting metadata is invalid",
    });
    if (
      Object.values(preset.family_counts).reduce((sum, value) => sum + value, 0)
        !== preset.scenario_count_per_policy
      || preset.nesting_proof_digest !== canonicalArtifactDigest({
        preset_id: preset.preset_id,
        scenario_set_digest: preset.scenario_set_digest,
        parent_preset_id: preset.parent_preset_id,
        parent_prefix_count: preset.parent_prefix_count,
        selection_rule: "published_ordered_prefix",
      }, "nesting_proof_digest")
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presets"],
      message: "policy-run preset family total or nesting proof is invalid",
    });
    if (preset.estimate.status === "estimated" && (
      preset.estimate.duration_minutes.minimum > preset.estimate.duration_minutes.maximum
      || preset.estimate.cost_usd.minimum > preset.estimate.cost_usd.maximum
    )) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presets"],
      message: "policy-run preset estimate range is invalid",
    });
  }
  if (!quick.cells || standard.cells || deep.cells) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["presets"],
    message: "only the enabled Quick preset may publish compiled cells",
  });
  const cells = quick.cells || [];
  const ids = cells.map((cell) => cell.cell_id);
  if (new Set(ids).size !== ids.length) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["presets", 0, "cells"],
    message: "policy-run setup cell IDs must be unique",
  });
  for (const family of POLICY_RUN_VARIATION_FAMILIES) {
    const count = cells.filter((cell) => cell.family === family).length;
    if (count !== quick.family_counts[family]) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presets", 0, "family_counts", family],
      message: "Quick preset family counts must match its compiled cells",
    });
  }
  const expectedQuickCounts = [1, 2, 1, 1, 1, 2, 2];
  if (
    cells.length !== 10
    || POLICY_RUN_VARIATION_FAMILIES.some(
      (family, index) => quick.family_counts[family] !== expectedQuickCounts[index],
    )
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["presets", 0],
    message: "Quick preset must publish the exact balanced ten-scenario coverage",
  });
  if (
    quick.scenario_set_digest
      !== canonicalArtifactDigest({ ordered_cells: cells }, "scenario_set_digest")
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["presets", 0, "scenario_set_digest"],
    message: "Quick scenario-set digest must bind the exact ordered cells",
  });
  for (const [index, cell] of cells.entries()) {
    const expected = cell.family === "held_out" ? "held_out" : "qualification";
    if (cell.partition !== expected) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presets", 0, "cells", index, "partition"],
      message: "policy-run setup family and partition do not match",
    });
  }
  if (
    canonicalArtifactDigest(
      setup as unknown as Record<string, unknown>,
      "setup_digest",
    ) !== setup.setup_digest
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["setup_digest"],
    message: "policy-run setup digest mismatch",
  });
});

export type EvaluationReadyPolicyRunSetup = z.infer<
  typeof evaluationReadyPolicyRunSetupSchema
>;

export const evaluationReadyRunInputSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_selection.v1"),
  run_id: identifier,
  offering_digest: digest,
  preset_id: z.enum(POLICY_RUN_PRESET_IDS),
}).strict();

export const resolvedPolicyRunSelectionSchema = evaluationReadyRunInputSchema.extend({
  source_launch_id: identifier,
  setup_digest: digest,
}).strict();

export type EvaluationReadyRunInput = z.infer<typeof evaluationReadyRunInputSchema>;

const resolvedCellSchema = setupCellSchema.extend({
  seed: z.number().int().min(0).max(2_147_483_647),
}).strict();

export const resolvedPolicyRunConfigurationSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_configuration.v1"),
  run_id: identifier,
  source_launch_id: identifier,
  offering_digest: digest,
  setup_digest: digest,
  embodiment_id: z.literal(FRANKA_DROID_EMBODIMENT_ID),
  candidate_ids: z.tuple([
    z.literal(CANONICAL_POLICY_CANDIDATE_IDS[0]),
    z.literal(CANONICAL_POLICY_CANDIDATE_IDS[1]),
  ]),
  preset_id: z.enum(POLICY_RUN_PRESET_IDS),
  scenario_count_per_policy: z.union([z.literal(10), z.literal(100), z.literal(500)]),
  compiler: z.object({
    compiler_id: z.literal("franka_rigid_relocation_nested_prefix"),
    compiler_version: z.literal("v1"),
    selection_rule: z.literal("published_ordered_prefix"),
    outcome_independent: z.literal(true),
    agent_may_select_cells: z.literal(false),
  }).strict(),
  matrix: z.object({
    profile_id: z.literal(POLICY_RUN_MATRIX_PROFILE_ID),
    preregistration_digest: digest,
    scenario_set_digest: digest,
    cells: z.array(resolvedCellSchema).min(10).max(500),
  }).strict(),
  counts: z.object({
    learned_episode_count: z.number().int().positive(),
    control_episode_count: z.number().int().positive(),
    total_episode_count: z.number().int().positive(),
  }).strict(),
  execution_guards: z.object({
    candidate_cells_and_seeds_must_match: z.literal(true),
    policy_specific_scenario_changes_prohibited: z.literal(true),
    zero_action_negative_every_scored_cell: z.literal(true),
    deterministic_scripted_positive_every_scored_cell: z.literal(true),
    retry_cap: z.literal(0),
  }).strict(),
  evidence_requirements: z.object({
    lossless_policy_input_frames_required: z.literal(true),
    digest_bound_frame_manifest_required: z.literal(true),
    derived_review_video_required: z.literal(true),
    typed_media_gap_before_first_observation_required: z.literal(true),
    grader_authority: z.literal("deterministic_simulator_state"),
    policy_self_grading_forbidden: z.literal(true),
  }).strict(),
  configuration_digest: digest,
}).strict().superRefine((configuration, context) => {
  const seeds = configuration.matrix.cells.map((cell) => cell.seed);
  if (new Set(seeds).size !== seeds.length) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["matrix", "cells"],
    message: "resolved policy-run seeds must be globally unique",
  });
  const count = configuration.scenario_count_per_policy;
  if (
    configuration.matrix.cells.length !== count
    || configuration.counts.learned_episode_count !== count * 2
    || configuration.counts.control_episode_count !== count * 2
    || configuration.counts.total_episode_count !== count * 4
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["counts"],
    message: "policy-run episode counts must be exactly four episodes per scenario cell",
  });
  if (
    canonicalArtifactDigest(
      configuration as unknown as Record<string, unknown>,
      "configuration_digest",
    ) !== configuration.configuration_digest
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["configuration_digest"],
    message: "resolved policy-run configuration digest mismatch",
  });
});

export type ResolvedPolicyRunConfiguration = z.infer<
  typeof resolvedPolicyRunConfigurationSchema
>;

function deterministicSeed(material: string) {
  const bytes = createHash("sha256").update(material).digest();
  return bytes.readUInt32BE(0) & 0x7fffffff;
}

export function policyRunSetupDigest(setup: EvaluationReadyPolicyRunSetup) {
  return setup.setup_digest;
}

export function buildResolvedPolicyRunConfiguration(params: {
  sourceLaunchId: string;
  offeringDigest: string;
  runId: string;
  setup: EvaluationReadyPolicyRunSetup;
  presetId: typeof POLICY_RUN_PRESET_IDS[number];
}): ResolvedPolicyRunConfiguration {
  const preset = params.setup.presets.find((candidate) => (
    candidate.preset_id === params.presetId
  ));
  if (!preset || preset.availability !== "enabled" || !preset.cells) {
    throw new Error("policy_run_preset_not_enabled");
  }
  const cells = preset.cells.map((cell) => ({
    ...cell,
    seed: deterministicSeed([
      params.setup.setup_digest,
      params.runId,
      params.presetId,
      cell.cell_id,
    ].join("\0")),
  }));
  if (new Set(cells.map((cell) => cell.seed)).size !== cells.length) {
    throw new Error("policy_run_configuration_seed_collision");
  }
  const count = preset.scenario_count_per_policy;
  const configuration: Record<string, unknown> = {
    schema_version: "task_evaluation_policy_run_configuration.v1",
    run_id: params.runId,
    source_launch_id: params.sourceLaunchId,
    offering_digest: params.offeringDigest,
    setup_digest: params.setup.setup_digest,
    embodiment_id: FRANKA_DROID_EMBODIMENT_ID,
    candidate_ids: [...CANONICAL_POLICY_CANDIDATE_IDS],
    preset_id: preset.preset_id,
    scenario_count_per_policy: count,
    compiler: params.setup.scenario_compiler,
    matrix: {
      profile_id: POLICY_RUN_MATRIX_PROFILE_ID,
      preregistration_digest: params.setup.preregistration.digest,
      scenario_set_digest: preset.scenario_set_digest,
      cells,
    },
    counts: {
      learned_episode_count: count * 2,
      control_episode_count: count * 2,
      total_episode_count: count * 4,
    },
    execution_guards: {
      candidate_cells_and_seeds_must_match: true,
      policy_specific_scenario_changes_prohibited: true,
      zero_action_negative_every_scored_cell: true,
      deterministic_scripted_positive_every_scored_cell: true,
      retry_cap: 0,
    },
    evidence_requirements: {
      lossless_policy_input_frames_required: true,
      digest_bound_frame_manifest_required: true,
      derived_review_video_required: true,
      typed_media_gap_before_first_observation_required: true,
      grader_authority: "deterministic_simulator_state",
      policy_self_grading_forbidden: true,
    },
    configuration_digest: "",
  };
  configuration.configuration_digest = canonicalArtifactDigest(
    configuration,
    "configuration_digest",
  );
  return resolvedPolicyRunConfigurationSchema.parse(configuration);
}

export function projectPolicyRunConfiguration(
  configuration: ResolvedPolicyRunConfiguration,
) {
  return {
    schema_version: configuration.schema_version,
    run_id: configuration.run_id,
    source_launch_id: configuration.source_launch_id,
    offering_digest: configuration.offering_digest,
    setup_digest: configuration.setup_digest,
    configuration_digest: configuration.configuration_digest,
    embodiment_id: configuration.embodiment_id,
    candidate_ids: configuration.candidate_ids,
    preset_id: configuration.preset_id,
    scenario_count_per_policy: configuration.scenario_count_per_policy,
    compiler: configuration.compiler,
    matrix: {
      profile_id: configuration.matrix.profile_id,
      preregistration_digest: configuration.matrix.preregistration_digest,
      scenario_set_digest: configuration.matrix.scenario_set_digest,
      cells: configuration.matrix.cells,
    },
    counts: configuration.counts,
    execution_guards: configuration.execution_guards,
    evidence_requirements: configuration.evidence_requirements,
  };
}

export const EVALUATION_READY_RUN_STATES = [
  "queued_for_preparation",
  "preparing",
  "ready_to_activate",
  "queued",
  "running",
  "aggregating",
  "results_ready",
  "abstained",
  "blocked",
  "failed",
  "cancelled",
] as const;

export const evaluationReadyRunStatusProjectionSchema = z.object({
  schema_version: z.literal("task_evaluation_policy_run_status_projection.v1"),
  run_id: identifier,
  source_launch_id: identifier,
  offering_digest: digest,
  configuration_digest: digest,
  state: z.enum(EVALUATION_READY_RUN_STATES),
  phase: z.string().trim().min(1).max(120).nullable(),
  progress: z.object({
    completed_episodes: z.number().int().nonnegative(),
    total_episodes: z.number().int().positive(),
  }).strict().nullable(),
  result_record_id: identifier.nullable().optional(),
  result_summary: z.unknown().optional(),
  delivery_digest: digest.nullable().optional(),
  error: z.object({
    code: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(500),
  }).strict().nullable().optional(),
  observed_at_iso: z.string().datetime({ offset: true }),
}).strict().superRefine((projection, context) => {
  if (
    projection.progress
    && projection.progress.completed_episodes > projection.progress.total_episodes
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["progress"],
    message: "completed episodes cannot exceed total episodes",
  });
  const resultTerminal = projection.state === "results_ready"
    || projection.state === "abstained";
  if (
    resultTerminal
    && (!projection.result_record_id || !projection.delivery_digest)
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["result_record_id"],
    message: "result terminal requires a digest-bound result record",
  });
  if (
    ["blocked", "failed"].includes(projection.state)
    && !projection.error
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["error"],
    message: "blocked or failed policy run requires a bounded error",
  });
});

const boundedMetricSchema = z.object({
  attempts: z.number().int().nonnegative(),
  successes: z.number().int().nonnegative(),
  success_rate: z.number().min(0).max(1),
}).strict();

export const evaluationReadyResultSummarySchema = z.object({
  canonical: z.record(z.enum(CANONICAL_POLICY_CANDIDATE_IDS), boundedMetricSchema),
  per_family: z.record(
    variationFamily,
    z.record(z.enum(CANONICAL_POLICY_CANDIDATE_IDS), boundedMetricSchema),
  ),
  paired: z.object({
    comparable_pairs: z.number().int().nonnegative(),
    discordant_pairs: z.number().int().nonnegative(),
    summary: z.string().trim().min(1).max(1_000),
  }).strict(),
  degradation: z.array(z.object({
    candidate_id: z.enum(CANONICAL_POLICY_CANDIDATE_IDS),
    family: variationFamily,
    delta_from_canonical: z.number().min(-1).max(1),
  }).strict()).max(256),
  failures: z.array(z.object({
    candidate_id: z.enum(CANONICAL_POLICY_CANDIDATE_IDS),
    family: variationFamily,
    count: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(500),
  }).strict()).max(256),
  contacts: z.object({
    event_count: z.number().int().nonnegative(),
    summary: z.string().trim().min(1).max(1_000),
  }).strict(),
  evidence_completeness: z.object({
    complete_episode_count: z.number().int().nonnegative(),
    invalid_episode_count: z.number().int().nonnegative(),
    all_policy_inputs_retained: z.boolean(),
    all_frame_manifests_retained: z.boolean(),
    all_review_videos_retained: z.boolean(),
  }).strict(),
}).strict();

export type EvaluationReadyRunRecord = {
  schema_version: "task_evaluation_policy_run_web_record.v1";
  run_id: string;
  source_launch_id: string;
  offering_digest: string;
  owner_user_id: string;
  team_namespace: string;
  state: typeof EVALUATION_READY_RUN_STATES[number];
  configuration_digest: string;
  created_at_iso: string;
  updated_at_iso: string;
  phase?: string | null;
  progress?: { completed_episodes: number; total_episodes: number } | null;
  pipeline_progress?: {
    phase: string;
    phase_status?: string;
    observed_at_iso?: string;
    elapsed_seconds?: number;
    provider?: {
      instance_state: string;
      instance_age_seconds: number | null;
      estimated_cost_usd: number | null;
    };
  } | null;
  episode_counts?: {
    learned_episode_count: number;
    control_episode_count: number;
    total_episode_count: number;
  };
  result_record_id?: string | null;
  result_summary?: z.infer<typeof evaluationReadyResultSummarySchema> | null;
  policy_run_result?: z.infer<typeof taskEvaluationPolicyRunResultProjectionSchema> | null;
  error?: { code: string; message: string } | null;
  [key: string]: unknown;
};

const SAFE_RESULT_RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const POLICY_CANARY_STAGE_ORDER = [
  "queued",
  "preparing",
  "provider_allocating",
  "runtime_starting",
  "policy_a_running",
  "policy_b_running",
  "artifacts_syncing",
  "report_generating",
  "billing_teardown",
  "terminal",
] as const;

type PolicyCanaryStage = typeof POLICY_CANARY_STAGE_ORDER[number];

function lifecycleProgress(record: EvaluationReadyRunRecord) {
  if (
    record.pipeline_progress
    && typeof record.pipeline_progress === "object"
    && typeof record.pipeline_progress.phase === "string"
  ) return record.pipeline_progress;
  // Before lifecycle observations gained their own field, the progress route
  // overwrote episode counters. Read those records without perpetuating the
  // collision for new writes.
  const legacy = record.progress as unknown;
  if (
    legacy
    && typeof legacy === "object"
    && "phase" in legacy
    && typeof (legacy as { phase?: unknown }).phase === "string"
  ) return legacy as EvaluationReadyRunRecord["pipeline_progress"];
  return null;
}

function canaryStageForPhase(phase: string | null): PolicyCanaryStage | null {
  if (!phase) return null;
  if ((POLICY_CANARY_STAGE_ORDER as readonly string[]).includes(phase)) {
    return phase as PolicyCanaryStage;
  }
  if (phase === "intake_webapp_record_binding" || phase === "starting") return "queued";
  if (phase.startsWith("policy_pi05_droid")) return "policy_a_running";
  if (phase.startsWith("policy_groot_n17_droid")) return "policy_b_running";
  if (phase.startsWith("vast_instance_teardown") || phase.startsWith("awaiting_official_billing")) {
    return "billing_teardown";
  }
  if (
    phase.startsWith("vast_heartbeat")
    || phase.startsWith("vast_gpu_sanity")
    || phase.startsWith("vast_isaac_smoke")
    || phase.startsWith("vast_blueprint_bundle")
  ) return "runtime_starting";
  if (phase.startsWith("vast_")) return "provider_allocating";
  if (["completed_unqualified", "blocked", "cancelled"].includes(phase)) return "terminal";
  return null;
}

function furthestCanaryStage(
  stored: unknown,
  observed: PolicyCanaryStage | null,
): PolicyCanaryStage {
  const storedStage = typeof stored === "string"
    && (POLICY_CANARY_STAGE_ORDER as readonly string[]).includes(stored)
    ? stored as PolicyCanaryStage
    : "queued";
  if (!observed) return storedStage;
  return POLICY_CANARY_STAGE_ORDER.indexOf(observed)
    > POLICY_CANARY_STAGE_ORDER.indexOf(storedStage)
    ? observed
    : storedStage;
}

export function projectEvaluationReadyRun(record: EvaluationReadyRunRecord) {
  const internalPolicyCanary = record.run_kind === "internal_policy_canary";
  const terminal = ["results_ready", "abstained", "blocked", "failed", "cancelled"].includes(record.state);
  const pipelineProgress = lifecycleProgress(record);
  const observedPhase = typeof pipelineProgress?.phase === "string"
    ? pipelineProgress.phase
    : null;
  const resultRecordId = typeof record.result_record_id === "string"
    && SAFE_RESULT_RECORD_ID.test(record.result_record_id)
    ? record.result_record_id
    : null;
  const resultSummary = evaluationReadyResultSummarySchema.safeParse(record.result_summary);
  const policyRunResult = taskEvaluationPolicyRunResultProjectionSchema.safeParse(
    record.policy_run_result,
  );
  const projection = {
    schema_version: "task_evaluation_policy_run_projection.v1" as const,
    run_id: record.run_id,
    source_launch_id: record.source_launch_id,
    offering_digest: record.offering_digest,
    configuration_digest: record.configuration_digest,
    state: record.state,
    terminal,
    phase: observedPhase || (typeof record.phase === "string" ? record.phase : null),
    progress: record.progress && Number.isInteger(record.progress.completed_episodes)
      && Number.isInteger(record.progress.total_episodes)
      ? {
          completed_episodes: Math.max(0, record.progress.completed_episodes),
          total_episodes: Math.max(0, record.progress.total_episodes),
        }
      : null,
    episode_counts: record.episode_counts
      && Number.isInteger(record.episode_counts.learned_episode_count)
      && Number.isInteger(record.episode_counts.control_episode_count)
      && Number.isInteger(record.episode_counts.total_episode_count)
      ? record.episode_counts
      : null,
    result: resultRecordId ? {
      record_id: resultRecordId,
      href: `/app/results/${encodeURIComponent(resultRecordId)}`,
      api_href: `/api/task-evaluation-results/${encodeURIComponent(resultRecordId)}`,
    } : null,
    result_summary: resultSummary.success ? resultSummary.data : null,
    policy_run_result: policyRunResult.success ? policyRunResult.data : null,
    error: record.error && typeof record.error.code === "string"
      && typeof record.error.message === "string"
      ? { code: record.error.code.slice(0, 120), message: record.error.message.slice(0, 500) }
      : null,
    created_at_iso: record.created_at_iso,
    updated_at_iso: record.updated_at_iso,
    proof_boundary: {
      simulation_is_physical_success: false,
      deployment_or_safety_approved: false,
      cross_team_leaderboard_authorized: false,
    },
  };
  if (!internalPolicyCanary) return projection;
  const stage = terminal
    ? furthestCanaryStage(record.stage, "terminal")
    : furthestCanaryStage(record.stage, canaryStageForPhase(observedPhase));
  const stageIndex = POLICY_CANARY_STAGE_ORDER.indexOf(stage);
  const state = terminal
    ? record.state
    : stageIndex >= POLICY_CANARY_STAGE_ORDER.indexOf("artifacts_syncing")
      ? "aggregating"
      : stageIndex >= POLICY_CANARY_STAGE_ORDER.indexOf("provider_allocating")
        ? "running"
        : record.state;
  const countProgress = record.progress
    && Number.isInteger(record.progress.completed_episodes)
    && Number.isInteger(record.progress.total_episodes)
    ? {
        completed_episodes: Math.max(0, record.progress.completed_episodes),
        total_episodes: Math.max(0, record.progress.total_episodes),
      }
    : {
        completed_episodes: Number.isInteger(record.completed_learned_episode_count)
          ? Math.max(0, Number(record.completed_learned_episode_count))
          : 0,
        total_episodes: 20,
      };
  const controlProjection = pipelinePolicyCanaryResultProjectionSchema.safeParse(record.policy_run_result_projection);
  const controlsStatus = controlProjection.success ? controlProjection.data.scene_controls_status : "configured_controls_pending";
  return {
    ...projection,
    state,
    progress: countProgress,
    run_kind: "internal_policy_canary" as const,
    claim_ceiling: "diagnostic_policy_execution" as const,
    result_status: record.result_status === "completed_unqualified"
      || record.result_status === "blocked"
      || record.result_status === "cancelled"
      ? record.result_status
      : null,
    scene_controls_status: controlsStatus,
    stage,
    request_digest: typeof record.request_digest === "string"
      ? record.request_digest
      : record.configuration_digest,
    setup_digest: typeof record.setup_digest === "string" ? record.setup_digest : null,
    scene_revision_digest: typeof record.scene_revision_digest === "string"
      ? record.scene_revision_digest
      : null,
    robot_preset_id: typeof record.robot_preset_id === "string"
      ? record.robot_preset_id
      : null,
    policy_candidate_ids: Array.isArray(record.policy_candidate_ids)
      ? record.policy_candidate_ids.filter((value): value is string => typeof value === "string").slice(0, 2)
      : [],
    episode_plan: record.episode_plan && typeof record.episode_plan === "object"
      ? record.episode_plan
      : null,
    completed_learned_episode_count: Number.isInteger(record.completed_learned_episode_count)
      ? Math.max(0, Number(record.completed_learned_episode_count))
      : record.progress?.completed_episodes || 0,
    expected_learned_episode_count: 20 as const,
    completed_control_episode_count: Number.isInteger(record.completed_control_episode_count)
      ? Math.max(0, Number(record.completed_control_episode_count))
      : 0,
    policy_run_result_projection:
      record.policy_run_result_projection && typeof record.policy_run_result_projection === "object"
        ? record.policy_run_result_projection
        : null,
    notification_delivery:
      record.notification_delivery && typeof record.notification_delivery === "object"
        ? record.notification_delivery
        : null,
    warning: controlsWarnings[controlsStatus],
    proof_boundary: {
      simulation_is_physical_success: false as const,
      deployment_or_safety_approved: false as const,
      cross_team_leaderboard_authorized: false as const,
      controls_qualification_bypassed: false as const,
      result_is_unqualified: true as const,
      official_ranking_permitted: false as const,
      scene_promotion_permitted: false as const,
    },
  };
}

export function evaluationResultWebsiteUrl(recordId: string) {
  const path = `/app/results/${encodeURIComponent(recordId)}`;
  const configured = String(
    process.env.APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://tryblueprint.io",
  ).trim();
  try {
    const origin = new URL(configured);
    if (
      origin.protocol !== "https:"
      && !(process.env.NODE_ENV !== "production" && origin.hostname === "localhost")
    ) return `https://tryblueprint.io${path}`;
    origin.pathname = path;
    origin.search = "";
    origin.hash = "";
    return origin.toString();
  } catch {
    return `https://tryblueprint.io${path}`;
  }
}
