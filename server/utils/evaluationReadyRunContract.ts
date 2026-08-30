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

const scenarioCompilerSchema = z.object({
  compiler_id: z.literal("franka_rigid_relocation_nested_prefix"),
  compiler_version: z.literal("v1"),
  selection_rule: z.literal("published_ordered_prefix"),
  outcome_independent: z.literal(true),
  agent_may_select_cells: z.literal(false),
  inventory_seed_digest: digest,
  coverage_recipe_digest: digest,
  cell_seed_rule: z.literal("sha256_inventory_seed_digest_nul_cell_id"),
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
  parent_scenario_set_digest: digest.nullable(),
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
  scenario_compiler: scenarioCompilerSchema,
  scenario_inventory: z.object({
    inventory_count: z.literal(500),
    inventory_digest: digest,
    compilation_proof_digest: digest,
    cells: z.array(setupCellSchema).length(500),
  }).strict(),
  presets: z.tuple([presetSchema, presetSchema, presetSchema]),
  preparation_template: preparationTemplateSchema,
  setup_digest: digest,
}).strict().superRefine((setup, context) => {
  const [quick, standard, deep] = setup.presets;
  const inventory = setup.scenario_inventory.cells;
  const exactPresetFields = [
    [quick, "quick_10", "Quick", 10, "enabled", true, null, 0, null],
    [standard, "standard_100", "Standard", 100, "coming_later", false, "quick_10", 10, quick.scenario_set_digest],
    [deep, "deep_500", "Deep", 500, "coming_later", false, "standard_100", 100, standard.scenario_set_digest],
  ] as const;
  for (const [preset, id, label, count, availability, defaultValue, parent, prefix, parentDigest] of exactPresetFields) {
    if (
      preset.preset_id !== id || preset.label !== label
      || preset.scenario_count_per_policy !== count
      || preset.availability !== availability || preset.default !== defaultValue
      || preset.parent_preset_id !== parent || preset.parent_prefix_count !== prefix
      || preset.parent_scenario_set_digest !== parentDigest
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presets"],
      message: "policy-run preset identity or nesting metadata is invalid",
    });
    const prefixCells = inventory.slice(0, count);
    const familyCountsMatch = POLICY_RUN_VARIATION_FAMILIES.every((family) => (
      preset.family_counts[family]
        === prefixCells.filter((cell) => cell.family === family).length
    ));
    if (
      !familyCountsMatch
      || preset.scenario_set_digest
        !== canonicalArtifactDigest({ ordered_cells: prefixCells }, "scenario_set_digest")
      || preset.nesting_proof_digest !== canonicalArtifactDigest({
        preset_id: preset.preset_id,
        scenario_set_digest: preset.scenario_set_digest,
        parent_preset_id: preset.parent_preset_id,
        parent_prefix_count: preset.parent_prefix_count,
        parent_scenario_set_digest: preset.parent_scenario_set_digest,
        selection_rule: "published_ordered_prefix",
        inventory_digest: setup.scenario_inventory.inventory_digest,
        inventory_seed_digest: setup.scenario_compiler.inventory_seed_digest,
        coverage_recipe_digest: setup.scenario_compiler.coverage_recipe_digest,
        cell_seed_rule: setup.scenario_compiler.cell_seed_rule,
      }, "nesting_proof_digest")
    ) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["presets"],
      message: "policy-run preset prefix, family coverage, or nesting proof is invalid",
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
  const ids = inventory.map((cell) => cell.cell_id);
  if (new Set(ids).size !== ids.length) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["scenario_inventory", "cells"],
    message: "policy-run scenario inventory cell IDs must be unique",
  });
  const expectedQuickCounts = [1, 2, 1, 1, 1, 2, 2];
  if (
    cells.length !== 10
    || cells.some((cell, index) => (
      JSON.stringify(cell) !== JSON.stringify(inventory[index])
    ))
    || POLICY_RUN_VARIATION_FAMILIES.some(
      (family, index) => quick.family_counts[family] !== expectedQuickCounts[index],
    )
  ) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["presets", 0],
    message: "Quick preset must publish the exact balanced ten-scenario coverage",
  });
  if (setup.scenario_inventory.inventory_digest !== canonicalArtifactDigest(
    { ordered_cells: inventory },
    "inventory_digest",
  )) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["scenario_inventory", "inventory_digest"],
    message: "policy-run scenario inventory digest mismatch",
  });
  if (setup.scenario_inventory.compilation_proof_digest !== canonicalArtifactDigest({
    inventory_count: setup.scenario_inventory.inventory_count,
    inventory_digest: setup.scenario_inventory.inventory_digest,
    compiler_id: setup.scenario_compiler.compiler_id,
    compiler_version: setup.scenario_compiler.compiler_version,
    selection_rule: setup.scenario_compiler.selection_rule,
    inventory_seed_digest: setup.scenario_compiler.inventory_seed_digest,
    coverage_recipe_digest: setup.scenario_compiler.coverage_recipe_digest,
    cell_seed_rule: setup.scenario_compiler.cell_seed_rule,
  }, "compilation_proof_digest")) context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["scenario_inventory", "compilation_proof_digest"],
    message: "policy-run scenario inventory compilation proof mismatch",
  });
  for (const [index, cell] of inventory.entries()) {
    const expected = cell.family === "held_out" ? "held_out" : "qualification";
    if (cell.partition !== expected) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scenario_inventory", "cells", index, "partition"],
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
  compiler: scenarioCompilerSchema,
  matrix: z.object({
    profile_id: z.literal(POLICY_RUN_MATRIX_PROFILE_ID),
    preregistration_digest: digest,
    inventory_digest: digest,
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
    retained_prefix_cells_and_seeds_must_match: z.literal(true),
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
  for (const [index, cell] of configuration.matrix.cells.entries()) {
    if (cell.seed !== deterministicSeed([
      configuration.compiler.inventory_seed_digest,
      cell.cell_id,
    ].join("\0"))) context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["matrix", "cells", index, "seed"],
      message: "resolved policy-run cell seed does not match the stable inventory seed rule",
    });
  }
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
      params.setup.scenario_compiler.inventory_seed_digest,
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
      inventory_digest: params.setup.scenario_inventory.inventory_digest,
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
      retained_prefix_cells_and_seeds_must_match: true,
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
      inventory_digest: configuration.matrix.inventory_digest,
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

export function projectEvaluationReadyRun(record: EvaluationReadyRunRecord) {
  const terminal = ["results_ready", "abstained", "blocked", "failed"].includes(record.state);
  const resultRecordId = typeof record.result_record_id === "string"
    && SAFE_RESULT_RECORD_ID.test(record.result_record_id)
    ? record.result_record_id
    : null;
  const resultSummary = evaluationReadyResultSummarySchema.safeParse(record.result_summary);
  const policyRunResult = taskEvaluationPolicyRunResultProjectionSchema.safeParse(
    record.policy_run_result,
  );
  return {
    schema_version: "task_evaluation_policy_run_projection.v1" as const,
    run_id: record.run_id,
    source_launch_id: record.source_launch_id,
    offering_digest: record.offering_digest,
    configuration_digest: record.configuration_digest,
    state: record.state,
    terminal,
    phase: typeof record.phase === "string" ? record.phase : null,
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
