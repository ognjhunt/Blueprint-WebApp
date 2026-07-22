// @vitest-environment node
import { describe, expect, it } from "vitest";

import { parseBenchmarkProjection } from "../utils/benchmarkProjectionContract";

function metric(estimate: number) {
  return {
    estimate,
    confidence_interval_95: [
      Math.max(0, estimate - 0.1),
      Math.min(1, estimate + 0.1),
    ] as [number, number],
    sample_count: 40,
    method: "episode_percentile_bootstrap.v1" as const,
    bootstrap_replicates: 10_000 as const,
  };
}

function metricBundle() {
  return {
    full_task_success: metric(0.75),
    partial_progress: metric(0.82),
    efficiency: metric(0.68),
    safety_interventions: metric(0.05),
    collision_free_rate: metric(0.95),
    evaluator_abstention: metric(0.02),
    coverage: metric(0.98),
    infrastructure_failure_rate: metric(0.01),
  };
}

function completeProjection() {
  const policy = {
    policy_id: "policy-a",
    checkpoint_sha256: "a".repeat(64),
    metrics: metricBundle(),
  };
  return {
    schema_version: "blueprint_webapp_benchmark_projection.v1",
    benchmark_id: "blueprint-drawer",
    benchmark_version: "2026.1",
    benchmark_card_sha256: "b".repeat(64),
    status: "complete",
    split_summary: {
      counts: { train: 2, dev: 2, public_test: 2, hidden_test: 2 },
      generalization_counts: Object.fromEntries(
        ["task", "scene", "object", "camera", "lighting", "embodiment"].map(
          (axis) => [axis, { seen: 4, unseen: 4 }],
        ),
      ),
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
    policy_aggregates: [policy],
    breakdowns: {
      split: { public_test: { "policy-a": metricBundle() } },
      generalization: {
        scene: {
          seen: { "policy-a": metricBundle() },
          unseen: { "policy-a": metricBundle() },
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
    external_rank_fidelity: null,
    hidden_scenario_identifiers_included: false,
    claim_boundary: {
      owner_system_artifacts_required: true,
      different_site_comparison_is_not_site_specific_validation: true,
      public_claim_upgrade_allowed: false,
    },
  };
}

describe("benchmark projection contract", () => {
  it("accepts aggregate and seen/unseen metrics without private identifiers", () => {
    const projection = parseBenchmarkProjection(completeProjection());
    expect(projection.status).toBe("complete");
    expect(projection.policy_aggregates[0].metrics.full_task_success.estimate).toBe(0.75);
    expect(projection.breakdowns.generalization.scene?.unseen?.["policy-a"]).toBeDefined();
  });

  it("rejects malformed uncertainty and unknown data", () => {
    const projection = completeProjection();
    projection.policy_aggregates[0].metrics.full_task_success.confidence_interval_95 = [0.9, 0.2];
    expect(() => parseBenchmarkProjection(projection)).toThrow();
    expect(() =>
      parseBenchmarkProjection({ ...completeProjection(), private_split: { seed: 7 } }),
    ).toThrow(/private benchmark field is forbidden/);
  });
});
