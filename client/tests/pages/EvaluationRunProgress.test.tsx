import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import EvaluationRunProgress from "@/pages/app/EvaluationRunProgress";
import { fetchEvaluationReadyRun } from "@/lib/evaluationReadyRuns";

const identity = vi.hoisted(() => ({ user: { uid: "friend-1" } as {uid:string} | null, runId: "scene-839873-policy-run-001" }));

vi.mock("wouter", () => ({
  useParams: () => ({ runId: identity.runId }),
  Link: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ currentUser: identity.user }),
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

  it("shows the Pipeline-authored canary phase with real episode counts", async () => {
    vi.mocked(fetchEvaluationReadyRun).mockResolvedValue({
      schema_version: "task_evaluation_policy_run_projection.v1",
      run_id: "scene-839873-policy-run-001",
      source_launch_id: "scene-839873-launch",
      offering_digest: digest("a"),
      configuration_digest: digest("b"),
      run_kind: "internal_policy_canary",
      claim_ceiling: "diagnostic_policy_execution",
      result_status: null,
      scene_controls_status: "configured_controls_pending",
      state: "running",
      terminal: false,
      stage: "provider_allocating",
      phase: "provider_allocating",
      progress: { completed_episodes: 0, total_episodes: 20 },
      episode_counts: {
        learned_episode_count: 20,
        control_episode_count: 20,
        total_episode_count: 40,
      },
      completed_learned_episode_count: 0,
      expected_learned_episode_count: 20,
      completed_control_episode_count: 0,
      robot_preset_id: "franka_panda_robotiq_2f85_v1",
      policy_candidate_ids: ["pi05_droid", "groot_n17_droid"],
      episode_plan: null,
      notification_delivery: null,
      result: null,
      error: null,
      warning: "Controls pending — results are unqualified.",
      created_at_iso: "2026-09-02T00:39:00.000Z",
      updated_at_iso: "2026-09-02T00:40:00.000Z",
      proof_boundary: {
        simulation_is_physical_success: false,
        deployment_or_safety_approved: false,
        cross_team_leaderboard_authorized: false,
      },
    });

    render(<EvaluationRunProgress />);

    await waitFor(() => expect(screen.getAllByText("Provider allocating")).toHaveLength(2));
    expect(screen.getByText("0 / 20 episodes")).toBeInTheDocument();
    expect(screen.getAllByText("0/20")).toHaveLength(2);
    expect(screen.getAllByText("Running")).toHaveLength(2);
  });

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

const status = (state = "running", time = "2026-09-07T12:00:00Z"): any => ({
  run_id: identity.runId, state, terminal: state === "results_ready", phase: state,
  updated_at_iso: time, error: null,
});

describe("status recovery", () => {
  beforeEach(() => { vi.resetAllMocks(); vi.useFakeTimers(); identity.user = {uid:"friend-1"}; identity.runId = "run-one"; });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  const tick = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
  it("retains stale status, backs off after failures, recovers and stops at terminal", async () => {
    vi.mocked(fetchEvaluationReadyRun).mockResolvedValueOnce(status())
      .mockRejectedValueOnce(new TypeError("network"))
      .mockRejectedValueOnce(new Error("503"))
      .mockResolvedValueOnce(status("results_ready"));
    render(<EvaluationRunProgress />); await tick(); await tick(8000);
    expect(screen.getByText(/Displayed data may be stale/)).toBeInTheDocument();
    expect(screen.getByText("run-one")).toBeInTheDocument();
    await tick(8000); expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(3);
    await tick(15999); expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(3);
    await tick(1); expect(screen.queryByText(/Displayed data may be stale/)).toBeNull();
    await tick(120000); expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(4);
  });
  it("aborts requests and cancels timers on unmount", async () => {
    vi.mocked(fetchEvaluationReadyRun).mockResolvedValue(status());
    const view = render(<EvaluationRunProgress />); await tick();
    const signal = vi.mocked(fetchEvaluationReadyRun).mock.calls[0][2];
    view.unmount(); expect(signal?.aborted).toBe(true);
    await tick(120000); expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(1);
  });
  it("clears old owner/run data and ignores an outstanding response after logout", async () => {
    let finish!: (value:any) => void;
    vi.mocked(fetchEvaluationReadyRun).mockResolvedValueOnce(status()).mockImplementationOnce(() => new Promise(resolve => {finish=resolve;}));
    const view = render(<EvaluationRunProgress />); await tick();
    identity.runId = "run-two"; view.rerender(<EvaluationRunProgress />); await tick();
    expect(screen.queryByText("run-one")).toBeNull();
    identity.user = null; view.rerender(<EvaluationRunProgress />); await tick();
    await act(async () => finish(status("results_ready")));
    expect(screen.queryByText("run-two", {selector:"p"})).toBeNull();
    await tick(120000); expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(2);
  });
  it("does not replace a newer snapshot with older progress", async () => {
    vi.mocked(fetchEvaluationReadyRun).mockResolvedValueOnce({...status(), phase:"Latest verified phase"})
      .mockResolvedValueOnce(status("queued", "2026-09-07T11:00:00Z"));
    render(<EvaluationRunProgress />); await tick(); await tick(8000);
    expect(screen.getByText("Latest verified phase")).toBeInTheDocument();
    expect(screen.getByText(/older status update was ignored/)).toBeInTheDocument();
  });
  it.each([401,403,404])("clears evidence and stops on HTTP %s", async code => {
    const { EvaluationRunStatusError } = await import('@/lib/evaluationReadyRuns');
    vi.mocked(fetchEvaluationReadyRun).mockResolvedValueOnce(status()).mockRejectedValueOnce(new EvaluationRunStatusError(code));
    render(<EvaluationRunProgress />); await tick(); await tick(8000);
    expect(screen.queryByText("run-one", {selector:"p"})).toBeNull();
    await tick(120000); expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(2);
  });
  it("caps repeated transient retries at sixty seconds", async () => {
    vi.mocked(fetchEvaluationReadyRun).mockRejectedValue(new TypeError("offline"));
    render(<EvaluationRunProgress />); await tick();
    for (const delay of [8000,16000,32000,60000,60000]) await tick(delay);
    expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(6);
    await tick(59999); expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(6);
    await tick(1); expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(7);
  });
  it.each(["blocked","failed","cancelled","abstained","results_ready"])("stops on terminal state %s", async state => {
    vi.mocked(fetchEvaluationReadyRun).mockResolvedValue(status(state));
    render(<EvaluationRunProgress />); await tick(); await tick(120000);
    expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(1);
  });

  it("honors status Retry-After without losing the last verified snapshot", async () => {
    const { EvaluationRunStatusError } = await import('@/lib/evaluationReadyRuns');
    vi.mocked(fetchEvaluationReadyRun).mockResolvedValueOnce(status()).mockRejectedValueOnce(new EvaluationRunStatusError(429,42)).mockResolvedValueOnce(status("results_ready"));
    render(<EvaluationRunProgress />); await tick(); await tick(8000);
    await tick(41999); expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(2);
    expect(screen.getByText("run-one")).toBeInTheDocument();
    await tick(1); expect(fetchEvaluationReadyRun).toHaveBeenCalledTimes(3);
  });

  it("does not present retained blocked execution progress as the phase of a ready result", async () => {
    vi.mocked(fetchEvaluationReadyRun).mockResolvedValue({...status("results_ready"),phase:"blocked"});
    render(<EvaluationRunProgress />); await tick();
    expect(screen.getByText("Current phase").parentElement?.textContent).toContain("Results ready");
    expect(screen.getByText(/Last reported phase:/)).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

});
