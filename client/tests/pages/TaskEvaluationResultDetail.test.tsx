import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import publicationFixture from "../../../server/tests/fixtures/pipeline-policy-canary-publication.v4.json";
import type { TaskEvaluationResultSiteRecord } from "@/lib/taskEvaluationResults";

const useResult = vi.hoisted(() => vi.fn());
vi.mock("@/lib/taskEvaluationResults", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/taskEvaluationResults")>()),
  useTaskEvaluationResult: useResult,
}));
vi.mock("@/components/blueprint/app/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/blueprint/app/PolicyCanaryResultPortal", () => ({
  PolicyCanaryResultPortal: () => <div>Policy episode evidence</div>,
}));

import TaskEvaluationResultDetail from "@/pages/app/TaskEvaluationResultDetail";

function result(): TaskEvaluationResultSiteRecord {
  return {
    schema_version: "task_evaluation_result_site_record.v1",
    record_id: "capture-run-v25",
    organization_id: "team-841757",
    access_visibility: "organization_members",
    publication: {
      ...structuredClone(publicationFixture),
      result_delivery: {
        ...structuredClone(publicationFixture.result_delivery),
        artifacts: [],
        stages: [],
      },
      policy_canary_result: {
        ...structuredClone(publicationFixture.policy_canary_result),
        task_success_contract: {
          scope: {
            site_id: "interiorgs-841757",
            task_id: "scene-841757-book-to-marked-area",
          },
        },
      },
    },
  } as unknown as TaskEvaluationResultSiteRecord;
}

function withoutDisplayMetadata(value: TaskEvaluationResultSiteRecord) {
  delete value.publication.scene;
  delete value.publication.task;
  if (value.publication.result_delivery?.reproducibility) {
    delete value.publication.result_delivery.reproducibility.scene_id;
    delete value.publication.result_delivery.reproducibility.task_id;
  }
}

function show(value: TaskEvaluationResultSiteRecord) {
  useResult.mockReturnValue({ result: value, currentUser: null, notFound: false, isLoading: false, error: null });
  render(<TaskEvaluationResultDetail />);
}

describe("Task Evaluation Result canary header", () => {
  beforeEach(() => useResult.mockReset());

  it("names the compared policies rather than machine scene and run identifiers", () => {
    const value = result();
    withoutDisplayMetadata(value);
    show(value);
    expect(screen.getByRole("heading", { level: 1, name: "Head-to-head policy test" })).toBeInTheDocument();
    expect(screen.getByText("pi05_droid vs groot_n17_droid · Simulation")).toBeInTheDocument();
    // Scene, task, and run identifiers live in the run details drawer, not the header.
    expect(screen.queryByText(/interiorgs-841757/)).not.toBeInTheDocument();
    expect(screen.queryByText(value.publication.run_id)).not.toBeInTheDocument();
    expect(screen.queryByText(/Scene not specified|Internal policy canary/)).not.toBeInTheDocument();
  });

  it("adds a human task label when the publication carries one", () => {
    const value = result();
    value.publication.scene = { id: "interiorgs-841757", revision_digest: `sha256:${"a".repeat(64)}` };
    value.publication.task = { id: "scene-841757-book-to-marked-area", label: "Place the book in the marked area" };
    show(value);
    expect(screen.getByText("pi05_droid vs groot_n17_droid · Place the book in the marked area · Simulation")).toBeInTheDocument();
  });
});

it("shows pending recorded progress without result evidence and links to the private run", () => {
  useResult.mockReturnValue({ result: null, pending: { run: { run_id: "operator-run", state: "running", phase: "awaiting_operator_results", terminal: false, progress: { completed_episodes: 4, total_episodes: 20 }, href: "/app/evaluation-runs/operator-run" } }, currentUser: { uid: "owner" }, notFound: false, isLoading: false, error: null });
  render(<TaskEvaluationResultDetail />);
  expect(screen.getByRole("heading", { name: "Run registered · results pending" })).toBeInTheDocument();
  expect(screen.getByText("4 of 20 episodes recorded complete.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View run progress" })).toHaveAttribute("href", "/app/evaluation-runs/operator-run");
  expect(screen.queryByText("Policy episode evidence")).not.toBeInTheDocument();
});

it("offers anonymous sign-in without revealing a private pending run", () => {
  useResult.mockReturnValue({ result: null, pending: null, currentUser: null, notFound: true, isLoading: false, error: null });
  render(<TaskEvaluationResultDetail />);
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  expect(screen.queryByText("Run registered · results pending")).not.toBeInTheDocument();
});


it("identifies synthetic development results without implying captured-room evaluation", () => {
  const value = result();
  value.publication.scene = { id: "site-capture-example-development-configured", revision_digest: `sha256:${"a".repeat(64)}` };
  show(value);
  expect(screen.getByText("Development test on an authored surface; captured scene integration pending.")).toBeInTheDocument();
});

it("lays out a task evaluation result plainly: one boundary line, a comparison, and closed episode drawers", () => {
  const video = { artifact_id: "video-1", role: "review_video", content_type: "video/mp4", size_bytes: 1024, relative_path: "episodes/ep-1/overview.mp4" };
  const value = {
    schema_version: "task_evaluation_result_site_record.v1",
    record_id: "result-plain",
    organization_id: "team-1",
    access_visibility: "organization_members",
    publication: {
      run_id: "run-plain-001",
      decision_envelope: { decision_question: "Can the arm move the tote to the tray?" },
      result_delivery: {
        status: "ready",
        delivery_digest: `sha256:${"f".repeat(64)}`,
        blockers: [],
        stages: [{ stage: "episode_packaging", status: "complete" }],
        summary: { episode_count: 2, learned_candidate_episode_count: 1, control_episode_count: 1, successful_episode_count: 1 },
        artifacts: [{ artifact_id: "pack-1", role: "review_pack", content_type: "application/zip", size_bytes: 2048, relative_path: "review.zip" }],
        episodes: [
          { episode_id: "ep-1", episode_kind: "learned_candidate", subject_id: "pi05_droid", policy_candidate_id: "pi05_droid", score: { status: "scored", task_succeeded: true, grader_authority: "deterministic_non_policy_grader" }, evidence: { videos: { overview: video } } },
          { episode_id: "ep-2", episode_kind: "control", subject_id: "zero_action", score: { status: "scored", task_succeeded: false, grader_authority: "deterministic_non_policy_grader" } },
        ],
      },
    },
  } as unknown as TaskEvaluationResultSiteRecord;
  useResult.mockReturnValue({ result: value, currentUser: { uid: "owner" }, notFound: false, isLoading: false, error: null });
  render(<TaskEvaluationResultDetail />);

  expect(screen.getByRole("heading", { level: 1, name: "Can the arm move the tote to the tray?" })).toBeInTheDocument();
  expect(screen.getByText(/Only your team can see this result/)).toBeInTheDocument();
  expect(screen.getAllByText(/Simulation only: it doesn't show real-world performance/)).toHaveLength(1);
  expect(screen.queryByText(/Bounded evidence, not a leaderboard|Sealed Task Evaluation Result|review-only/)).not.toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Candidate comparison" })).toBeInTheDocument();
  expect(screen.getByText("1 of 2 episodes")).toBeInTheDocument();

  // Each episode is a closed drawer with its outcome in the summary.
  const episodes = screen.getByRole("heading", { name: "Episodes" }).closest("section")!;
  const drawers = Array.from(episodes.querySelectorAll("details"));
  expect(drawers).toHaveLength(2);
  expect(drawers.every((drawer) => !drawer.open)).toBe(true);
  expect(within(drawers[0]).getByText("Completed")).toBeInTheDocument();
  expect(within(drawers[0]).getByRole("button", { name: "Load video", hidden: true })).toBeInTheDocument();
  expect(within(drawers[1]).getByText("Not completed")).toBeInTheDocument();

  // Delivery stages and the raw record stay in the run details drawer.
  expect(screen.queryByText("episode_packaging")).not.toBeInTheDocument();
  const details = screen.getByText("Run details", { selector: "summary" }).closest("details")!;
  expect(details.open).toBe(false);
  expect(within(details).getByText("Episode packaging: complete")).toBeInTheDocument();
});
