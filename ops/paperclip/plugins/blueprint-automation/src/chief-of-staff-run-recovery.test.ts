import { describe, expect, it } from "vitest";
import {
  findStaleRunningHeartbeatRun,
  getHeartbeatRunTaskKey,
} from "./chief-of-staff-run-recovery.js";

describe("chief-of-staff stale run recovery", () => {
  it("finds a running run whose last update exceeded the idle threshold", () => {
    const result = findStaleRunningHeartbeatRun(
      [
        {
          id: "run-stale",
          status: "running",
          createdAt: "2026-04-10T02:06:02.050Z",
          startedAt: "2026-04-10T04:19:04.451Z",
          updatedAt: "2026-04-10T04:19:17.218Z",
        },
        {
          id: "run-fresh",
          status: "running",
          createdAt: "2026-04-10T04:35:41.768Z",
          updatedAt: "2026-04-10T04:35:41.768Z",
        },
      ],
      Date.parse("2026-04-10T04:36:47.000Z"),
      12 * 60 * 1000,
    );

    expect(result?.run.id).toBe("run-stale");
    expect(result?.idleMs).toBeGreaterThanOrEqual(12 * 60 * 1000);
  });

  it("ignores queued runs and active runs with recent updates", () => {
    const result = findStaleRunningHeartbeatRun(
      [
        {
          id: "run-queued",
          status: "queued",
          createdAt: "2026-04-10T04:15:05.745Z",
          updatedAt: "2026-04-10T04:30:06.351Z",
        },
        {
          id: "run-fresh",
          status: "running",
          createdAt: "2026-04-10T04:35:41.768Z",
          updatedAt: "2026-04-10T04:35:41.768Z",
        },
      ],
      Date.parse("2026-04-10T04:36:47.000Z"),
      12 * 60 * 1000,
    );

    expect(result).toBeNull();
  });

  it("derives the runtime-session task key from the run context", () => {
    expect(getHeartbeatRunTaskKey({
      id: "run-1",
      contextSnapshot: {
        taskKey: "task-123",
        issueId: "issue-456",
      },
    })).toBe("task-123");

    expect(getHeartbeatRunTaskKey({
      id: "run-2",
      contextSnapshot: {
        issueId: "issue-456",
      },
    })).toBe("issue-456");
  });
});
