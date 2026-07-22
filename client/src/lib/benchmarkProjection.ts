export type BenchmarkMetric = {
  estimate: number | null;
  confidence_interval_95: [number | null, number | null];
  sample_count: number;
  method: string;
  bootstrap_replicates: number;
};

export type BenchmarkMetricBundle = {
  full_task_success: BenchmarkMetric;
  partial_progress: BenchmarkMetric;
  efficiency: BenchmarkMetric;
  safety_interventions: BenchmarkMetric;
  collision_free_rate: BenchmarkMetric;
  evaluator_abstention: BenchmarkMetric;
  coverage: BenchmarkMetric;
  infrastructure_failure_rate: BenchmarkMetric;
};

export type BenchmarkPolicyAggregate = {
  policy_id: string;
  checkpoint_sha256: string;
  metrics: BenchmarkMetricBundle;
};

export type ExternalRankFidelity = {
  schema_version: "blueprint_external_rank_fidelity_report.v1";
  status: "measured" | "blocked";
  measurement_scope:
    | "same_site_real_robot_rank_fidelity"
    | "cross_site_real_robot_rank_concordance"
    | "cross_evaluator_concordance";
  reference_type: "real_robot" | "simulator" | "world_model";
  site_alignment: "same_site" | "different_site" | "aggregate_only";
  matched_policies: Array<{
    policy_id: string;
    checkpoint_sha256: string;
    blueprint_score: number;
    external_score: number;
  }>;
  metrics: Partial<
    Record<
      "pearson" | "spearman" | "kendall_tau_b" | "pairwise_ordering_accuracy" | "mmrv",
      BenchmarkMetric
    >
  >;
  blockers: string[];
  claim_boundary: {
    different_site_comparison_is_not_site_specific_validation: boolean;
    simulator_agreement_is_not_real_world_validation: boolean;
    exact_checkpoint_matching_required: true;
    public_claim_upgrade_allowed: false;
    scoped_external_comparison_measured: boolean;
    rank_fidelity_result_proven: boolean;
    cross_site_rank_concordance_proven: boolean;
  };
};

export type BenchmarkProjection = {
  schema_version: "blueprint_webapp_benchmark_projection.v1";
  benchmark_id: string;
  benchmark_version: string;
  benchmark_card_sha256: string;
  status: "planned" | "complete" | "blocked";
  split_summary: {
    counts: Record<"train" | "dev" | "public_test" | "hidden_test", number>;
    generalization_counts: Record<
      "task" | "scene" | "object" | "camera" | "lighting" | "embodiment",
      { seen: number; unseen: number }
    >;
    hidden_test_identifiers_redacted: true;
    hidden_test_content_digest_committed: true;
  };
  rollout_protocol: {
    fixed_rollouts_per_scenario_policy: number;
    cherry_picking_prohibited: true;
    result_replacement_prohibited: true;
    infrastructure_retries_scored_as_new_attempts: true;
  };
  scoring: {
    metrics: string[];
    confidence_intervals_required: true;
    bootstrap_replicates: 10_000;
  };
  environment_summary?: {
    site_id: string;
    representation_type:
      | "captured_3dgs_site_memory"
      | "simready_usd"
      | "hybrid"
      | "other";
    physics_authority: "none" | "mujoco" | "isaac" | "newton" | "real_robot";
    same_site_capture: boolean;
    environment_sha256: string;
  };
  evaluator_runtime_summary?: {
    evaluator_id: string;
    evaluator_version: string;
    evaluator_runtime_sha256: string;
  };
  policy_aggregates: BenchmarkPolicyAggregate[];
  breakdowns: {
    split: Partial<Record<"public_test" | "hidden_test", Record<string, BenchmarkMetricBundle>>>;
    generalization: Partial<
      Record<
        "task" | "scene" | "object" | "camera" | "lighting" | "embodiment",
        Partial<Record<"seen" | "unseen", Record<string, BenchmarkMetricBundle>>>
      >
    >;
  };
  evidence_summary?: {
    attempt_count: number;
    video_count: number;
    action_trace_count: number;
    evaluator_output_count: number;
    all_attempts_digest_bound: boolean;
  } | null;
  evidence_index_sha256?: string | null;
  external_rank_fidelity?: ExternalRankFidelity | null;
  hidden_scenario_identifiers_included: false;
  claim_boundary: {
    owner_system_artifacts_required: true;
    different_site_comparison_is_not_site_specific_validation: true;
    public_claim_upgrade_allowed: false;
  };
};

export function formatBenchmarkMetric(metric: BenchmarkMetric, options?: { count?: boolean }) {
  if (metric.estimate === null) return "Not measured";
  const count = options?.count === true;
  const format = (value: number | null) => {
    if (value === null) return "—";
    return count ? value.toFixed(2) : `${(value * 100).toFixed(1)}%`;
  };
  const [lower, upper] = metric.confidence_interval_95;
  return `${format(metric.estimate)} (95% CI ${format(lower)}–${format(upper)})`;
}

export function externalScopeLabel(scope: ExternalRankFidelity["measurement_scope"]) {
  if (scope === "same_site_real_robot_rank_fidelity") {
    return "Same-site real-robot rank fidelity";
  }
  if (scope === "cross_site_real_robot_rank_concordance") {
    return "Cross-site real-robot rank concordance";
  }
  return "Cross-evaluator concordance";
}
