import { describe, expect, it } from "vitest";
import { verifyDispatchWake } from "./execution-dispatch-verification.js";

describe("execution dispatch verification", () => {
  it("accepts a wake result with a run id", () => {
    expect(
      verifyDispatchWake({
        wakeRunId: "run-1",
        expectedAssigneeKey: "webapp-codex",
        dispatchedAt: "2026-04-09T16:00:00.000Z",
      }),
    ).toEqual({
      verified: true,
      evidence: "wake_run",
    });
  });

  it("accepts an execution lock on the issue for the expected assignee", () => {
    expect(
      verifyDispatchWake({
        wakeRunId: null,
        expectedAssigneeKey: "webapp-codex",
        issueExecutionRunId: "run-2",
        issueExecutionAgentNameKey: "webapp-codex",
        dispatchedAt: "2026-04-09T16:00:00.000Z",
      }),
    ).toEqual({
      verified: true,
      evidence: "issue_execution_lock",
    });
  });

  it("accepts a fresh runtime session for the expected lane", () => {
    expect(
      verifyDispatchWake({
        wakeRunId: null,
        expectedAssigneeKey: "webapp-review",
        runtimeSession: {
          agentKey: "webapp-review",
          status: "starting",
          updatedAt: "2026-04-09T16:00:02.000Z",
        },
        dispatchedAt: "2026-04-09T16:00:00.000Z",
      }),
    ).toEqual({
      verified: true,
      evidence: "runtime_session",
    });
  });

  it("rejects a wakeup without any execution proof", () => {
    expect(
      verifyDispatchWake({
        wakeRunId: null,
        expectedAssigneeKey: "webapp-review",
        runtimeSession: {
          agentKey: "webapp-review",
          status: "starting",
          updatedAt: "2026-04-09T15:59:59.000Z",
        },
        dispatchedAt: "2026-04-09T16:00:00.000Z",
      }),
    ).toEqual({
      verified: false,
      evidence: "missing_execution_proof",
    });
  });
});
