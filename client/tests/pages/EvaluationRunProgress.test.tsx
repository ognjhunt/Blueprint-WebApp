import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EvaluationRunProgress from "@/pages/app/EvaluationRunProgress";
import { fetchEvaluationReadyRun } from "@/lib/evaluationReadyRuns";

vi.mock("wouter", () => ({
  useParams: () => ({ runId: "scene-839873-policy-run-001" }),
  Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: { uid: "friend-1" } }),
}));

vi.mock("@/components/blueprint/app/AppShell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

vi.mock("@/lib/evaluationReadyRuns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/evaluationReadyRuns")>();
  return { ...actual, fetchEvaluationReadyRun: vi.fn() };
});

const digest = (character: string) => `sha256:${character.repeat(64)}`;
const familyMetrics = (successRate: number, degradation = 0) => ({
  canonical_anchor: { attempted: 3, succeeded: Math.round(successRate * 3), success_rate: successRate, degradation_from_canonical: 0 },
  placement_approach: { attempted: 2, succeeded: Math.round(successRate * 2), success_rate: successRate, degradation_from_canonical: degradation },
  illumination: { attempted: 1, succeeded: Math.round(successRate), success_rate: successRate, degradation_from_canonical: degradation },
  camera_sensor: { attempted: 1, succeeded: Math.round(successRate), success_rate: successRate, degradation_from_canonical: degradation },
  bounded_physics: { attempted: 1, succeeded: Math.round(successRate), success_rate: successRate, degradation_from_canonical: degradation },
  pairwise: { attempted: 1, succeeded: Math.round(successRate), success_rate: successRate, degradation_from_canonical: degradation },
  held_out: { attempted: 1, succeeded: Math.round(successRate), success_rate: successRate, degradation_from_canonical: degradation },
});

describe("EvaluationRunProgress", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a terminal paired comparison and the private result link", async () => {
    vi.mocked(fetchEvaluationReadyRun).mockResolvedValue({
      schema_version: "task_evaluation_policy_run_projection.v1",
      run_id: "scene-839873-policy-run-001",
      source_launch_id: "scene-839873-launch",
      offering_digest: digest("a"),
      configuration_digest: digest("b"),
      state: "results_ready",
      terminal: true,
      phase: "Results sealed",
      progress: { completed_episodes: 40, total_episodes: 40 },
      episode_counts: { learned_episode_count: 20, control_episode_count: 20, total_episode_count: 40 },
      result: { record_id: "result-001", href: "/app/results/result-001", api_href: "/api/task-evaluation-results/result-001" },
      result_summary: {
        canonical: {
          pi05_droid: { attempts: 3, successes: 2, success_rate: 2 / 3 },
          groot_n17_droid: { attempts: 3, successes: 1, success_rate: 1 / 3 },
        },
        per_family: {},
        paired: { comparable_pairs: 28, discordant_pairs: 9, summary: "Paired outcomes are available by variation." },
        degradation: [],
        failures: [],
        contacts: { event_count: 4, summary: "Four bounded contact events." },
        evidence_completeness: { complete_episode_count: 40, invalid_episode_count: 0, all_policy_inputs_retained: true, all_frame_manifests_retained: true, all_review_videos_retained: true },
      },
      policy_run_result: {
        schema_version: "task_evaluation_policy_run_result_projection.v1",
        run_id: "scene-839873-policy-run-001",
        source_launch_id: "scene-839873-launch",
        offering_digest: digest("a"),
        configuration_digest: digest("b"),
        plan_digest: digest("c"),
        embodiment_id: "franka_panda_robotiq_2f85_v1",
        candidate_ids: ["pi05_droid", "groot_n17_droid"],
        state: "decided",
        matrix: { scored_cell_count: 10, candidate_episode_count: 20, control_episode_count: 20, expected_episode_count: 40, completed_episode_count: 40, identical_candidate_cells_and_seeds: true, controls_complete: true },
        candidate_results: [
          { candidate_id: "pi05_droid", episodes_completed: 10, family_metrics: familyMetrics(2 / 3, -0.1), failures: [{ code: "missed_target", count: 2 }], contacts: { contact_count: 4, violation_count: 0 }, evidence: { lossless_frame_manifest_count: 10, review_video_count: 10, typed_media_gap_count: 0 } },
          { candidate_id: "groot_n17_droid", episodes_completed: 10, family_metrics: familyMetrics(1 / 3, -0.2), failures: [{ code: "no_contact", count: 3 }], contacts: { contact_count: 3, violation_count: 1 }, evidence: { lossless_frame_manifest_count: 10, review_video_count: 10, typed_media_gap_count: 0 } },
        ],
        paired_comparison: { matched_episode_pairs: 10, decision: "pi05_droid", deterministic_non_policy_scoring: true },
        result_delivery_digest: digest("d"),
        blockers: [],
        proof_boundary: { simulation_is_physical_success: false, review_video_is_authoritative_evidence: false, policy_can_grade_itself: false, cross_team_leaderboard_authorized: false },
        projection_digest: digest("e"),
      },
      error: null,
      created_at_iso: "2026-08-30T12:00:00.000Z",
      updated_at_iso: "2026-08-30T12:30:00.000Z",
      proof_boundary: { simulation_is_physical_success: false, deployment_or_safety_approved: false, cross_team_leaderboard_authorized: false },
    });

    render(<EvaluationRunProgress />);

    await waitFor(() => expect(screen.getByText("Results sealed")).toBeInTheDocument());
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Per-family policy results" })).toBeInTheDocument();
    expect(screen.getByText(/π0.5 DROID selected/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open complete results/i })).toHaveAttribute("href", "/app/results/result-001");
    expect(screen.getByText(/simulation results are not physical success/i)).toBeInTheDocument();
  });
});
