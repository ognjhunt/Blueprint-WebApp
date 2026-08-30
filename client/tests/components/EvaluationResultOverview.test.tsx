import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EvaluationResultOverview } from "@/components/blueprint/app/EvaluationResultOverview";
import type { TaskEvaluationResultEpisode } from "@/lib/taskEvaluationResults";

function episode(
  id: string,
  candidate: "pi05_droid" | "groot_n17_droid",
  family: string,
  succeeded: boolean,
): TaskEvaluationResultEpisode {
  const artifact = {
    artifact_id: "a".repeat(32),
    role: "artifact",
    relative_path: "artifact.json",
    sha256: `sha256:${"b".repeat(64)}`,
    size_bytes: 10,
    content_type: "application/json",
  };
  return {
    episode_id: id,
    episode_kind: "learned_candidate",
    subject_id: candidate,
    score: {
      status: "scored",
      task_succeeded: succeeded,
      grader_authority: "deterministic_task_state",
    },
    variation: { cell_id: `${family}-cell`, family_id: family, label: family.replaceAll("_", " "), seed: 4 },
    metrics: { contact_count: candidate === "pi05_droid" ? 2 : 1 },
    failure: succeeded ? null : { code: "missed_target", phase: "contact" },
    evidence: { complete: true },
    artifacts: {
      receipt: artifact,
      frame_manifest: artifact,
      videos: { external: artifact, wrist: artifact, overview: artifact },
    },
  };
}

describe("EvaluationResultOverview", () => {
  it("shows candidate comparison, per-variation results, contacts, failures, and evidence coverage", () => {
    render(<EvaluationResultOverview episodes={[
      episode("pi-canonical", "pi05_droid", "canonical_anchor", true),
      episode("groot-canonical", "groot_n17_droid", "canonical_anchor", false),
      episode("pi-light", "pi05_droid", "illumination", false),
      episode("groot-light", "groot_n17_droid", "illumination", true),
    ]} />);

    const comparison = screen.getByRole("table", { name: "Candidate comparison" });
    expect(within(comparison).getByText("π0.5 DROID")).toBeInTheDocument();
    expect(within(comparison).getByText("GR00T N1.7 DROID")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Per-variation results" })).toBeInTheDocument();
    expect(screen.getByText("Failure modes")).toBeInTheDocument();
    expect(screen.getByText("Paired outcomes")).toBeInTheDocument();
    expect(screen.getAllByText(/Δ canonical/).length).toBeGreaterThan(0);
    expect(screen.getByText(/missed target/)).toBeInTheDocument();
    expect(screen.getAllByText("Evidence complete")).toHaveLength(2);
  });
});
