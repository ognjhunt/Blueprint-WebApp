import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
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

describe("Task Evaluation Result bound scene label", () => {
  beforeEach(() => useResult.mockReset());

  it("uses the V25 scoring contract scope when compact publication labels are absent", () => {
    const value = result();
    withoutDisplayMetadata(value);
    show(value);
    expect(screen.getByText("interiorgs-841757 · scene-841757-book-to-marked-area · simulation")).toBeInTheDocument();
    expect(screen.queryByText(/Scene 839873/)).not.toBeInTheDocument();
  });

  it("preserves explicit publication display labels", () => {
    const value = result();
    value.publication.scene = { id: "interiorgs-841757", revision_digest: `sha256:${"a".repeat(64)}` };
    value.publication.task = { id: "scene-841757-book-to-marked-area", label: "Place the book in the marked area" };
    show(value);
    expect(screen.getByText("interiorgs-841757 · Place the book in the marked area · simulation")).toBeInTheDocument();
  });

  it("does not invent a scene when all bound scene identifiers are absent", () => {
    const value = result();
    withoutDisplayMetadata(value);
    delete value.publication.policy_canary_result!.task_success_contract;
    show(value);
    expect(screen.getByText("Scene not specified · Policy canary · simulation")).toBeInTheDocument();
    expect(screen.queryByText(/Scene 839873/)).not.toBeInTheDocument();
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
