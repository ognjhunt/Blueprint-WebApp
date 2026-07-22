import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BenchmarkReportPanel } from "@/components/blueprint/app/BenchmarkReportPanel";
import type {
  BenchmarkMetric,
  BenchmarkMetricBundle,
  BenchmarkProjection,
} from "@/lib/benchmarkProjection";

function metric(estimate: number): BenchmarkMetric {
  return {
    estimate,
    confidence_interval_95: [estimate - 0.1, estimate + 0.1],
    sample_count: 40,
    method: "episode_percentile_bootstrap.v1",
    bootstrap_replicates: 10_000,
  };
}

function metrics(): BenchmarkMetricBundle {
  return {
    full_task_success: metric(0.7),
    partial_progress: metric(0.8),
    efficiency: metric(0.6),
    safety_interventions: metric(0.05),
    collision_free_rate: metric(0.95),
    evaluator_abstention: metric(0.02),
    coverage: metric(0.98),
    infrastructure_failure_rate: metric(0.01),
  };
}

function projection(): BenchmarkProjection {
  const policyMetrics = metrics();
  return {
    schema_version: "blueprint_webapp_benchmark_projection.v1",
    benchmark_id: "blueprint-drawer",
    benchmark_version: "2026.1",
    benchmark_card_sha256: "a".repeat(64),
    status: "complete",
    split_summary: {
      counts: { train: 2, dev: 2, public_test: 2, hidden_test: 2 },
      generalization_counts: {
        task: { seen: 4, unseen: 4 },
        scene: { seen: 4, unseen: 4 },
        object: { seen: 4, unseen: 4 },
        camera: { seen: 4, unseen: 4 },
        lighting: { seen: 4, unseen: 4 },
        embodiment: { seen: 4, unseen: 4 },
      },
      hidden_test_identifiers_redacted: true,
      hidden_test_content_digest_committed: true,
    },
    rollout_protocol: {
      fixed_rollouts_per_scenario_policy: 20,
      cherry_picking_prohibited: true,
      result_replacement_prohibited: true,
      infrastructure_retries_scored_as_new_attempts: true,
    },
    scoring: {
      metrics: [
        "full_task_success",
        "partial_progress",
        "efficiency",
        "safety_interventions",
        "evaluator_abstention",
      ],
      confidence_intervals_required: true,
      bootstrap_replicates: 10_000,
    },
    environment_summary: {
      site_id: "captured-site-drawer",
      representation_type: "captured_3dgs_site_memory",
      physics_authority: "mujoco",
      same_site_capture: true,
      environment_sha256: "f".repeat(64),
    },
    evaluator_runtime_summary: {
      evaluator_id: "blueprint-wam-runtime",
      evaluator_version: "2026.1",
      evaluator_runtime_sha256: "9".repeat(64),
    },
    policy_aggregates: [
      {
        policy_id: "policy-a",
        checkpoint_sha256: "b".repeat(64),
        metrics: policyMetrics,
      },
    ],
    breakdowns: {
      split: { public_test: { "policy-a": policyMetrics } },
      generalization: {
        scene: {
          seen: { "policy-a": policyMetrics },
          unseen: { "policy-a": policyMetrics },
        },
      },
    },
    evidence_summary: {
      attempt_count: 40,
      video_count: 40,
      action_trace_count: 40,
      evaluator_output_count: 40,
      all_attempts_digest_bound: true,
    },
    evidence_index_sha256: "c".repeat(64),
    external_rank_fidelity: {
      schema_version: "blueprint_external_rank_fidelity_report.v1",
      status: "measured",
      measurement_scope: "cross_site_real_robot_rank_concordance",
      reference_type: "real_robot",
      site_alignment: "different_site",
      matched_policies: [
        {
          policy_id: "policy-a",
          checkpoint_sha256: "b".repeat(64),
          blueprint_score: 0.7,
          external_score: 0.6,
        },
        {
          policy_id: "policy-b",
          checkpoint_sha256: "d".repeat(64),
          blueprint_score: 0.6,
          external_score: 0.5,
        },
        {
          policy_id: "policy-c",
          checkpoint_sha256: "e".repeat(64),
          blueprint_score: 0.5,
          external_score: 0.4,
        },
      ],
      metrics: { spearman: metric(0.8) },
      blockers: [],
      claim_boundary: {
        different_site_comparison_is_not_site_specific_validation: true,
        simulator_agreement_is_not_real_world_validation: false,
        exact_checkpoint_matching_required: true,
        public_claim_upgrade_allowed: false,
        scoped_external_comparison_measured: true,
        rank_fidelity_result_proven: false,
        cross_site_rank_concordance_proven: true,
      },
    },
    hidden_scenario_identifiers_included: false,
    claim_boundary: {
      owner_system_artifacts_required: true,
      different_site_comparison_is_not_site_specific_validation: true,
      public_claim_upgrade_allowed: false,
    },
  };
}

describe("BenchmarkReportPanel", () => {
  it("renders uncertainty, seen/unseen coverage, and the cross-site boundary", () => {
    render(<BenchmarkReportPanel benchmark={projection()} />);

    expect(screen.getByText("Benchmark-grade evaluation")).toBeInTheDocument();
    expect(
      screen.getAllByText(/70.0% \(95% CI 60.0%–80.0%\)/).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Seen / unseen generalization")).toBeInTheDocument();
    expect(screen.getByText("Environment binding")).toBeInTheDocument();
    expect(screen.getByText(/3DGS supplies site\/observation context/i)).toBeInTheDocument();
    expect(screen.getByText(/40 videos · 40 action traces/i)).toBeInTheDocument();
    expect(screen.getByText("Cross-site real-robot rank concordance")).toBeInTheDocument();
    expect(
      screen.getByText(/It is not validation of the captured target site/i),
    ).toBeInTheDocument();
    expect(screen.queryByText("secret-scenario-id")).not.toBeInTheDocument();
  });
});
