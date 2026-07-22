import { z } from "zod";

export const BENCHMARK_PROJECTION_SCHEMA_VERSION =
  "blueprint_webapp_benchmark_projection.v1" as const;

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const finiteNumber = z.number().finite();

const confidenceIntervalSchema = z
  .tuple([finiteNumber.nullable(), finiteNumber.nullable()])
  .superRefine(([lower, upper], context) => {
    if (lower !== null && upper !== null && lower > upper) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confidence interval lower bound exceeds upper bound",
      });
    }
  });

const aggregateMetricSchema = z
  .object({
    estimate: finiteNumber.nullable(),
    confidence_interval_95: confidenceIntervalSchema,
    sample_count: z.number().int().nonnegative(),
    method: z.literal("episode_percentile_bootstrap.v1"),
    bootstrap_replicates: z.literal(10_000),
  })
  .strict();

const externalMetricSchema = z
  .object({
    estimate: finiteNumber.nullable(),
    confidence_interval_95: confidenceIntervalSchema,
    sample_count: z.number().int().nonnegative(),
    method: z.literal("exact_checkpoint_policy_bootstrap.v1"),
    bootstrap_replicates: z.literal(10_000),
  })
  .strict();

const aggregateMetricsSchema = z
  .object({
    full_task_success: aggregateMetricSchema,
    partial_progress: aggregateMetricSchema,
    efficiency: aggregateMetricSchema,
    safety_interventions: aggregateMetricSchema,
    collision_free_rate: aggregateMetricSchema,
    evaluator_abstention: aggregateMetricSchema,
    coverage: aggregateMetricSchema,
    infrastructure_failure_rate: aggregateMetricSchema,
  })
  .strict();

const externalMetricsSchema = z
  .object({
    pearson: externalMetricSchema.optional(),
    spearman: externalMetricSchema.optional(),
    kendall_tau_b: externalMetricSchema.optional(),
    pairwise_ordering_accuracy: externalMetricSchema.optional(),
    mmrv: externalMetricSchema.optional(),
  })
  .strict();

const policyAggregateSchema = z
  .object({
    policy_id: z.string().trim().min(1).max(200),
    checkpoint_sha256: sha256Schema,
    metrics: aggregateMetricsSchema,
  })
  .strict();

const aggregateByPolicySchema = z.record(
  z.string().trim().min(1).max(200),
  aggregateMetricsSchema,
);

const visibilityBreakdownSchema = z
  .object({
    seen: aggregateByPolicySchema.optional(),
    unseen: aggregateByPolicySchema.optional(),
  })
  .strict();

const benchmarkBreakdownsSchema = z
  .object({
    split: z
      .object({
        public_test: aggregateByPolicySchema.optional(),
        hidden_test: aggregateByPolicySchema.optional(),
      })
      .strict(),
    generalization: z
      .object({
        task: visibilityBreakdownSchema.optional(),
        scene: visibilityBreakdownSchema.optional(),
        object: visibilityBreakdownSchema.optional(),
        camera: visibilityBreakdownSchema.optional(),
        lighting: visibilityBreakdownSchema.optional(),
        embodiment: visibilityBreakdownSchema.optional(),
      })
      .strict(),
  })
  .strict();

const evidenceSummarySchema = z
  .object({
    attempt_count: z.number().int().nonnegative(),
    video_count: z.number().int().nonnegative(),
    action_trace_count: z.number().int().nonnegative(),
    evaluator_output_count: z.number().int().nonnegative(),
    all_attempts_digest_bound: z.boolean(),
  })
  .strict()
  .superRefine((summary, context) => {
    for (const field of ["video_count", "action_trace_count", "evaluator_output_count"] as const) {
      if (summary[field] > summary.attempt_count) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} cannot exceed attempt_count`,
        });
      }
    }
  });

const countByVisibilitySchema = z
  .object({
    seen: z.number().int().nonnegative(),
    unseen: z.number().int().nonnegative(),
  })
  .strict();

const splitSummarySchema = z
  .object({
    counts: z
      .object({
        train: z.number().int().nonnegative(),
        dev: z.number().int().nonnegative(),
        public_test: z.number().int().nonnegative(),
        hidden_test: z.number().int().positive(),
      })
      .strict(),
    generalization_counts: z
      .object({
        task: countByVisibilitySchema,
        scene: countByVisibilitySchema,
        object: countByVisibilitySchema,
        camera: countByVisibilitySchema,
        lighting: countByVisibilitySchema,
        embodiment: countByVisibilitySchema,
      })
      .strict(),
    hidden_test_identifiers_redacted: z.literal(true),
    hidden_test_content_digest_committed: z.literal(true),
  })
  .strict();

const rolloutProtocolSchema = z
  .object({
    fixed_rollouts_per_scenario_policy: z.number().int().positive(),
    cherry_picking_prohibited: z.literal(true),
    result_replacement_prohibited: z.literal(true),
    infrastructure_retries_scored_as_new_attempts: z.literal(true),
  })
  .strict();

const scoringSchema = z
  .object({
    metrics: z.array(z.string().trim().min(1)).min(5),
    confidence_intervals_required: z.literal(true),
    bootstrap_replicates: z.literal(10_000),
  })
  .strict();

const environmentSummarySchema = z
  .object({
    site_id: z.string().trim().min(1).max(200),
    representation_type: z.enum([
      "captured_3dgs_site_memory",
      "simready_usd",
      "hybrid",
      "other",
    ]),
    physics_authority: z.enum(["none", "mujoco", "isaac", "newton", "real_robot"]),
    same_site_capture: z.boolean(),
    environment_sha256: sha256Schema,
  })
  .strict();

const evaluatorRuntimeSummarySchema = z
  .object({
    evaluator_id: z.string().trim().min(1).max(200),
    evaluator_version: z.string().trim().min(1).max(100),
    evaluator_runtime_sha256: sha256Schema,
  })
  .strict();

const matchedPolicySchema = z
  .object({
    policy_id: z.string().trim().min(1).max(200),
    checkpoint_sha256: sha256Schema,
    blueprint_score: finiteNumber,
    external_score: finiteNumber,
  })
  .strict();

const externalRankFidelitySchema = z
  .object({
    schema_version: z.literal("blueprint_external_rank_fidelity_report.v1"),
    status: z.enum(["measured", "blocked"]),
    measurement_scope: z.enum([
      "same_site_real_robot_rank_fidelity",
      "cross_site_real_robot_rank_concordance",
      "cross_evaluator_concordance",
    ]),
    reference_id: z.string().trim().min(1).max(300).nullable().optional(),
    reference_type: z.enum(["real_robot", "simulator", "world_model"]),
    site_alignment: z.enum(["same_site", "different_site", "aggregate_only"]),
    independently_accepted: z.boolean(),
    source_uri: z.string().trim().min(1).max(2_048).nullable().optional(),
    source_artifact_sha256: z.union([sha256Schema, z.literal("")]),
    task_mapping_sha256: z.union([sha256Schema, z.literal("")]),
    matched_policies: z.array(matchedPolicySchema),
    metrics: externalMetricsSchema,
    blockers: z.array(z.string().trim().min(1).max(300)),
    claim_boundary: z
      .object({
        different_site_comparison_is_not_site_specific_validation: z.boolean(),
        simulator_agreement_is_not_real_world_validation: z.boolean(),
        exact_checkpoint_matching_required: z.literal(true),
        public_claim_upgrade_allowed: z.literal(false),
        scoped_external_comparison_measured: z.boolean().optional().default(false),
        rank_fidelity_result_proven: z.boolean(),
        cross_site_rank_concordance_proven: z.boolean().optional().default(false),
      })
      .strict(),
  })
  .strict()
  .superRefine((external, context) => {
    const claim = external.claim_boundary;
    if (external.status === "measured") {
      if (
        external.source_artifact_sha256.length !== 64 ||
        external.task_mapping_sha256.length !== 64 ||
        external.independently_accepted !== true ||
        external.blockers.length > 0 ||
        claim.scoped_external_comparison_measured !== true
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "measured external comparison requires accepted digest-bound evidence and no blockers",
        });
      }
    }
    if (claim.rank_fidelity_result_proven) {
      if (
        external.status !== "measured" ||
        external.measurement_scope !== "same_site_real_robot_rank_fidelity"
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["claim_boundary", "rank_fidelity_result_proven"],
          message: "rank fidelity proof requires a measured same-site real-robot scope",
        });
      }
    }
    if (
      claim.cross_site_rank_concordance_proven &&
      (external.status !== "measured" ||
        external.measurement_scope !== "cross_site_real_robot_rank_concordance")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["claim_boundary", "cross_site_rank_concordance_proven"],
        message: "cross-site concordance proof requires a measured cross-site scope",
      });
    }
  });

export const benchmarkProjectionSchema = z
  .object({
    schema_version: z.literal(BENCHMARK_PROJECTION_SCHEMA_VERSION),
    benchmark_id: z.string().trim().min(1).max(200),
    benchmark_version: z.string().trim().min(1).max(100),
    benchmark_card_sha256: sha256Schema,
    status: z.enum(["planned", "complete", "blocked"]),
    split_summary: splitSummarySchema,
    rollout_protocol: rolloutProtocolSchema,
    scoring: scoringSchema,
    environment_summary: environmentSummarySchema.optional(),
    evaluator_runtime_summary: evaluatorRuntimeSummarySchema.optional(),
    policy_aggregates: z.array(policyAggregateSchema),
    breakdowns: benchmarkBreakdownsSchema,
    evidence_summary: evidenceSummarySchema.nullable().optional(),
    evidence_index_sha256: sha256Schema.nullable().optional(),
    external_rank_fidelity: externalRankFidelitySchema.nullable().optional(),
    hidden_scenario_identifiers_included: z.literal(false),
    claim_boundary: z
      .object({
        owner_system_artifacts_required: z.literal(true),
        different_site_comparison_is_not_site_specific_validation: z.literal(true),
        public_claim_upgrade_allowed: z.literal(false),
      })
      .strict(),
  })
  .strict()
  .superRefine((projection, context) => {
    if (projection.status === "planned" && projection.policy_aggregates.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["policy_aggregates"],
        message: "planned projections cannot include computed policy aggregates",
      });
    }
    if (
      projection.external_rank_fidelity?.status === "measured" &&
      projection.external_rank_fidelity.matched_policies.length < 3
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["external_rank_fidelity", "matched_policies"],
        message: "measured rank fidelity requires at least three exact checkpoints",
      });
    }
  });

export type BenchmarkProjection = z.infer<typeof benchmarkProjectionSchema>;

const PRIVATE_FIELD_PATTERN =
  /(^|_)(scenario(_id|_ids|s)?|seed|initial_condition|private_split|execution_plan)($|_)/i;
const SAFE_SCENARIO_SUMMARY_FIELDS = new Set([
  "fixed_rollouts_per_scenario_policy",
  "hidden_scenario_identifiers_included",
]);

function privateFieldPath(value: unknown, path: string[] = []): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = privateFieldPath(value[index], [...path, String(index)]);
      if (match) return match;
    }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = [...path, key];
    if (
      !SAFE_SCENARIO_SUMMARY_FIELDS.has(key) &&
      PRIVATE_FIELD_PATTERN.test(key)
    ) {
      return nextPath.join(".");
    }
    const match = privateFieldPath(nested, nextPath);
    if (match) return match;
  }
  return null;
}

export function parseBenchmarkProjection(value: unknown): BenchmarkProjection {
  const privatePath = privateFieldPath(value);
  if (privatePath) {
    throw new Error(`private benchmark field is forbidden: ${privatePath}`);
  }
  return benchmarkProjectionSchema.parse(value);
}
