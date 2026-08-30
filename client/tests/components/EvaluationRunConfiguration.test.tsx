import { fireEvent, render, screen } from "@testing-library/react";
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
  matrixProfileId: "franka_rigid_relocation_standard_v1",
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
  it("keeps robot, candidates, controls, and cells locked while exposing only depth presets", () => {
    render(<EvaluationRunConfiguration setup={setup} submitting={false} onSubmit={vi.fn()} />);

    expect(screen.getByText("Franka + DROID")).toBeInTheDocument();
    expect(screen.getByText("π0.5 DROID")).toBeInTheDocument();
    expect(screen.getByText("GR00T N1.7 DROID")).toBeInTheDocument();
    expect(screen.getByText(/zero-action \+ scripted-positive per cell/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /quick test/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /standard/i })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /deep/i })).toBeDisabled();
    expect(screen.getByText(/10 cells means 20 learned-policy episodes \+ 20 control episodes = 40 total/i)).toBeInTheDocument();
    expect(screen.getByText(/outcome-independent compiler/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /pay|checkout/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/credit card|provider choice/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });

  it("reviews the transparent 10-scenario episode count and server estimate before submit", () => {
    const onSubmit = vi.fn();
    render(<EvaluationRunConfiguration setup={setup} submitting={false} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: "Review run" }));
    expect(screen.getAllByText("20")).toHaveLength(2);
    expect(screen.getByText("learned-policy episodes")).toBeInTheDocument();
    expect(screen.getByText("control episodes")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
    expect(screen.getByText("total episodes")).toBeInTheDocument();
    expect(screen.getByText("18–25 min")).toBeInTheDocument();
    expect(screen.getByText("$2.00–$4.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Start evaluation" }));
    expect(onSubmit).toHaveBeenCalledWith({ presetId: "quick_10" });
  });
});
