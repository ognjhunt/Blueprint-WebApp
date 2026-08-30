import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import EvaluationRunSetup from "@/pages/app/EvaluationRunSetup";
import { createEvaluationReadyRun, fetchEvaluationReadySetup } from "@/lib/evaluationReadyRuns";

const navigate = vi.hoisted(() => vi.fn());

vi.mock("wouter", () => ({
  useParams: () => ({ sourceLaunchId: "scene-839873-launch" }),
  useLocation: () => ["/app/packs/scene-839873-launch/evaluate", navigate],
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
  return {
    ...actual,
    fetchEvaluationReadySetup: vi.fn(),
    createEvaluationReadyRun: vi.fn(),
  };
});

const setup = {
  sourceLaunchId: "scene-839873-launch",
  offeringDigest: `sha256:${"a".repeat(64)}`,
  setupDigest: `sha256:${"b".repeat(64)}`,
  sceneLabel: "scene-839873 · v1",
  taskLabel: "rigid-relocation · simple relocation",
  embodimentId: "franka_panda_robotiq_2f85_v1" as const,
  candidateIds: ["pi05_droid", "groot_n17_droid"] as const,
  matrixProfileId: "franka_rigid_relocation_standard_v1" as const,
  defaultPresetId: "quick_10" as const,
  presets: [{
    presetId: "quick_10" as const, label: "Quick test", scenarioCountPerPolicy: 10 as const,
    availability: "available" as const, recommended: true,
    familyCoverage: [["canonical_anchor", 1], ["placement_approach", 2], ["illumination", 1], ["camera_sensor", 1], ["bounded_physics", 1], ["pairwise", 2], ["held_out", 2]].map(([family, scenarioCount]) => ({ family, scenarioCount })) as any,
    episodeCounts: { learnedEpisodeCount: 20, controlEpisodeCount: 20, totalEpisodeCount: 40 },
    estimate: { status: "unavailable" as const },
  }, {
    presetId: "standard_100" as const, label: "Standard", scenarioCountPerPolicy: 100 as const, availability: "coming_later" as const, recommended: false, familyCoverage: [], episodeCounts: { learnedEpisodeCount: 200, controlEpisodeCount: 200, totalEpisodeCount: 400 }, estimate: { status: "unavailable" as const },
  }, {
    presetId: "deep_500" as const, label: "Deep", scenarioCountPerPolicy: 500 as const, availability: "coming_later" as const, recommended: false, familyCoverage: [], episodeCounts: { learnedEpisodeCount: 1000, controlEpisodeCount: 1000, totalEpisodeCount: 2000 }, estimate: { status: "unavailable" as const },
  }],
  notificationRecipient: "friend@example.com",
};

describe("EvaluationRunSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchEvaluationReadySetup).mockResolvedValue(setup);
    vi.mocked(createEvaluationReadyRun).mockImplementation(async ({ input }) => ({
      schema_version: "task_evaluation_policy_run_web_receipt.v1",
      run: { run_id: input.run_id },
    } as any));
  });

  it("submits the locked policy pair and routes the teammate to progress", async () => {
    render(<EvaluationRunSetup />);
    await screen.findByText("Franka + DROID");

    fireEvent.click(screen.getByRole("button", { name: "Review run" }));
    fireEvent.click(screen.getByRole("button", { name: "Start evaluation" }));

    await waitFor(() => expect(createEvaluationReadyRun).toHaveBeenCalledTimes(1));
    expect(createEvaluationReadyRun).toHaveBeenCalledWith(expect.objectContaining({
      sourceLaunchId: "scene-839873-launch",
      input: expect.objectContaining({
        schema_version: "task_evaluation_policy_run_selection.v1",
        offering_digest: setup.offeringDigest,
        preset_id: "quick_10",
      }),
    }));
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/^\/app\/evaluation-runs\/scene-839873-launch-policy-run-/));
    expect(screen.queryByLabelText(/team|email|provider/i)).not.toBeInTheDocument();
  });
});
