import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Evaluation from "@/pages/workspace/Evaluation";
import type { EpisodeOutcomeRow, WorkspaceEvaluation } from "@/types/workspace";

const { snapshot } = vi.hoisted(() => ({ snapshot: { evaluations: [] as unknown[] } }));
vi.mock("wouter", async (original) => ({
  ...await original<typeof import("wouter")>(),
  useParams: () => ({ evaluationId: "application-1" }),
}));
vi.mock("@/lib/workspace", async (original) => ({
  ...await original<typeof import("@/lib/workspace")>(),
  useWorkspace: () => ({ data: { role: "robot_team", ...snapshot } }),
}));
vi.mock("@/components/workspace/WorkspaceUI", async (original) => ({
  ...await original<typeof import("@/components/workspace/WorkspaceUI")>(),
  Frame: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/lib/buyerAppData", () => ({ useBuyerAppRunDetail: () => { throw new Error("A free run has no run record."); } }));
vi.mock("@/pages/app/RunDetail", () => ({ RunRecord: () => null }));

const rows = (success: number, failure: number, voided: number): EpisodeOutcomeRow[] => [
  ...Array.from({ length: success }, () => "success" as const),
  ...Array.from({ length: failure }, () => "failure" as const),
  ...Array.from({ length: voided }, () => "void" as const),
].map((outcome, index) => ({ cell_id: `cell-${index}`, family: "illumination", outcome,
  reason: outcome === "success" ? "task_succeeded" : outcome === "void" ? "simulator_failed_during_episode" : "task_not_completed" }));

function show(patch: Partial<WorkspaceEvaluation>) {
  snapshot.evaluations = [{ id: "application-1", teamAlias: "Team A", status: "completed", successRate: 100,
    cycleTimeSeconds: null, sampleCount: 9, evidenceLabel: "Development simulation", targetsMet: null, selected: false,
    runId: "free-run-1", hasRunRecord: false, taskId: "task-1", title: "Pack cartons", siteType: "", location: null,
    setupName: "Arm", terms: { successRate: 90, cycleTimeSeconds: null }, outcome: null, archived: false,
    createdAt: "2026-10-15T00:00:00Z", ...patch }];
  render(<Evaluation />);
}
afterEach(cleanup);

describe("a team's evaluation result", () => {
  it("never calls a run that does not count a target met, and links no run record a free run lacks", () => {
    show({ episodeOutcomes: rows(9, 0, 1), notCountedReason: "Blueprint's simulator did not score it against the job's success contract." });
    expect(screen.getByText(/This run does not count toward a recommendation\. Blueprint's simulator did not score it/)).toBeInTheDocument();
    expect(screen.queryByText("Meets target")).not.toBeInTheDocument();
    expect(screen.getByText(/9 of 9 counted episodes succeeded \(1 not counted/)).toBeInTheDocument();
    expect(screen.getByText("Does not count")).toBeInTheDocument();
    cleanup();

    show({ successRate: null, sampleCount: null, notCountedReason: "It is not a team evaluation." });
    expect(screen.queryByRole("link", { name: "View run record" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Run configuration, evidence/)).not.toBeInTheDocument();
  });

  it("compares a run that counts with the site's target", () => {
    show({ successRate: 95, sampleCount: 200, episodeOutcomes: rows(190, 10, 0), notCountedReason: null });
    expect(screen.getByText("Meets target")).toBeInTheDocument();
    expect(screen.getByText(/190 of 200 counted episodes succeeded/)).toBeInTheDocument();
    expect(screen.queryByText(/does not count/)).not.toBeInTheDocument();
  });
});
