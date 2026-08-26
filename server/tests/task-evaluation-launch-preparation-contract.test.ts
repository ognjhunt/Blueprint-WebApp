// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import {
  forwardTaskEvaluationLaunchPreparation,
  resolveTaskEvaluationLaunchPreparationUrl,
} from "../utils/taskEvaluationLaunchPreparationContract";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function request() {
  return {
    preparation_id: "prep-001",
    run_id: "run-001",
    team_namespace: "robot-team-001",
    expected_production_commit: "a".repeat(40),
  } as any;
}

function receipt(extra: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = {
    schema_version: "task_evaluation_launch_preparation_intake_receipt.v1",
    status: "queued_for_no_spend_preparation",
    accepted: true,
    already_exists: false,
    preparation_id: "prep-001",
    run_id: "run-001",
    team_namespace: "robot-team-001",
    expected_production_commit: "a".repeat(40),
    request_digest: canonicalArtifactDigest(request(), "request_digest"),
    provider_mutation_performed_inside_http_request: false,
    catalog_mutation_performed_inside_http_request: false,
    paid_execution_requested: false,
    canonical_allocator_required_for_later_execution: true,
    ...extra,
    receipt_digest: "",
  };
  value.receipt_digest = canonicalArtifactDigest(value, "receipt_digest");
  return value;
}

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.TASK_EVALUATION_LAUNCH_URL;
});

describe("Task Evaluation launch preparation forwarding", () => {
  it("derives the preparation endpoint from the configured launch service", () => {
    process.env.TASK_EVALUATION_LAUNCH_URL = "https://pipeline.example/api/live-pipeline/task-evaluation-launches";
    expect(resolveTaskEvaluationLaunchPreparationUrl()).toBe(
      "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
    );
    expect(resolveTaskEvaluationLaunchPreparationUrl("prep-001")).toBe(
      "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations/prep-001",
    );
  });

  it("accepts only a digest-bound sanitized no-spend receipt", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(receipt()), {
      status: 202, headers: { "content-type": "application/json" },
    }));
    await expect(forwardTaskEvaluationLaunchPreparation({
      request: request(), endpointUrl: "https://pipeline.example/preparations", token: "secret",
    })).resolves.toMatchObject({ status: "forwarded", performed: true });
  });

  it("fails closed if Pipeline exposes an internal queue path", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(receipt({
      queue_path: "/var/lib/blueprint/task-evaluation-launch-preparations/pending/prep-001.json",
    })), { status: 202, headers: { "content-type": "application/json" } }));
    await expect(forwardTaskEvaluationLaunchPreparation({
      request: request(), endpointUrl: "https://pipeline.example/preparations", token: "secret",
    })).resolves.toMatchObject({
      status: "blocked",
      performed: false,
      blocker: "pipeline_task_evaluation_launch_preparation_receipt_invalid",
    });
  });
});
