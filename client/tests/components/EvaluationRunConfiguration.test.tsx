import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EvaluationRunConfiguration } from "@/components/blueprint/app/EvaluationRunConfiguration";
import type { EvaluationReadySetupView } from "@/lib/evaluationReadyRuns";

const setup: EvaluationReadySetupView = {
  sourceLaunchId: "scene-839873-launch",
  offeringDigest: `sha256:${"a".repeat(64)}`,
  setupDigest: `sha256:${"b".repeat(64)}`,
  sceneLabel: "Scene 839873",
  taskLabel: "Mug relocation",
  embodimentId: "franka_panda_robotiq_2f85_v1",
  candidateIds: ["pi05_droid", "groot_n17_droid"],
  matrixProfileId: "franka_rigid_relocation_nested_v1",
  defaultPresetId: "quick_10",
  presets: [
    {
      presetId: "quick_10", label: "Quick test", scenarioCountPerPolicy: 10, availability: "available", recommended: true,
      familyCoverage: [
        ["canonical_anchor", 1], ["placement_approach", 2], ["illumination", 1], ["camera_sensor", 1],
        ["bounded_physics", 1], ["pairwise", 2], ["held_out", 2],
      ].map(([family, scenarioCount]) => ({ family, scenarioCount })) as EvaluationReadySetupView["presets"][number]["familyCoverage"],
      episodeCounts: { learnedEpisodeCount: 20, controlEpisodeCount: 20, totalEpisodeCount: 40 },
      estimate: { status: "estimated", durationMinutes: { minimum: 18, maximum: 25 }, costUsd: { minimum: 2, maximum: 4 }, basisDigest: `sha256:${"e".repeat(64)}`, asOf: "2026-08-30T12:00:00Z" },
    },
    { presetId: "standard_100", label: "Standard", scenarioCountPerPolicy: 100, availability: "coming_later", recommended: false, familyCoverage: [], episodeCounts: { learnedEpisodeCount: 200, controlEpisodeCount: 200, totalEpisodeCount: 400 }, estimate: { status: "unavailable" } },
    { presetId: "deep_500", label: "Deep", scenarioCountPerPolicy: 500, availability: "coming_later", recommended: false, familyCoverage: [], episodeCounts: { learnedEpisodeCount: 1000, controlEpisodeCount: 1000, totalEpisodeCount: 2000 }, estimate: { status: "unavailable" } },
  ],
  notificationRecipient: "n•••@example.com",
};

describe("EvaluationRunConfiguration", () => {
  it("shows the fixed robot and policies and offers only a depth choice", () => {
    render(<EvaluationRunConfiguration setup={setup} submitting={false} onSubmit={vi.fn()} />);

    expect(screen.getByText("Franka Panda + Robotiq 2F-85")).toBeInTheDocument();
    expect(screen.getByText("π0.5 DROID and GR00T N1.7 DROID")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /quick test/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /standard/i })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /deep/i })).toBeDisabled();
    expect(screen.getByText(/20 policy episodes \+ 20 control\s+episodes = 40 total\./)).toBeInTheDocument();

    // How scenarios are chosen and what the controls do sits in a closed drawer, in plain words.
    const coverage = screen.getByText("What the scenarios cover", { selector: "summary" }).closest("details")!;
    expect(coverage.open).toBe(false);
    expect(within(coverage).getByText("Placement and approach: 2")).toBeInTheDocument();
    expect(within(coverage).getByText(/fixed rule before anything runs, never from results/)).toBeInTheDocument();
    expect(within(coverage).getByText(/a robot that does nothing, which must fail/)).toBeInTheDocument();
    expect(screen.queryByText(/preregistered|nested subset|outcome-independent compiler|Provider execution remains false/i)).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /pay|checkout/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/credit card|provider choice/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("shows the server estimate on the same page and starts the chosen depth", () => {
    const onSubmit = vi.fn();
    render(<EvaluationRunConfiguration setup={setup} submitting={false} onSubmit={onSubmit} />);

    expect(screen.getByText("18–25 min")).toBeInTheDocument();
    expect(screen.getByText("$2.00–$4.00")).toBeInTheDocument();
    expect(screen.getByText(/We'll email n•••@example\.com when the results are ready\./)).toBeInTheDocument();
    const details = screen.getByText("Setup details", { selector: "summary" }).closest("details")!;
    expect(within(details).getByText(`sha256:${"b".repeat(64)}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start evaluation" }));
    expect(onSubmit).toHaveBeenCalledWith({ presetId: "quick_10" });
  });
});
