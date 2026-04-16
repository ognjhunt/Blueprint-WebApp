import { describe, expect, it } from "vitest";
import {
  findStaleHeartbeatRuns,
  findStaleRunningHeartbeatRun,
  getHeartbeatRunTaskKey,
  groupStaleRunsByAgent,
  type HeartbeatRunLike,
} from "./stale-run-recovery.js";

const THRESHOLD_MS = 20 * 60 * 1000;
const NOW = Date.parse("2026-04-16T06:00:00.000Z");

describe("generic stale-run recovery", () => {
  describe("findStaleHeartbeatRuns", () => {
    it("finds stale queued runs with no startedAt", () => {
      const runs: HeartbeatRunLike[] = [
        {
          id: "run-queued-stale",
          agentId: "agent-ops-lead",
          status: "queued",
          createdAt: "2026-04-16T03:00:00.000Z",
          startedAt: null,
          updatedAt: "2026-04-16T03:00:00.000Z",
        },
        {
          id: "run-queued-fresh",
          agentId: "agent-ops-lead",
          status: "queued",
          createdAt: "2026-04-16T05:50:00.000Z",
          startedAt: null,
          updatedAt: "2026-04-16T05:50:00.000Z",
        },
      ];

      const stale = findStaleHeartbeatRuns(runs, NOW, THRESHOLD_MS);
      expect(stale).toHaveLength(1);
      expect(stale[0].run.id).toBe("run-queued-stale");
      expect(stale[0].staleKind).toBe("queued_no_start");
    });

    it("finds stale running runs with no recent activity", () => {
      const runs: HeartbeatRunLike[] = [
        {
          id: "run-running-stale",
          agentId: "agent-chief",
          status: "running",
          createdAt: "2026-04-16T02:00:00.000Z",
          startedAt: "2026-04-16T02:01:00.000Z",
          updatedAt: "2026-04-16T02:05:00.000Z",
        },
        {
          id: "run-running-fresh",
          agentId: "agent-chief",
          status: "running",
          createdAt: "2026-04-16T05:55:00.000Z",
          startedAt: "2026-04-16T05:56:00.000Z",
          updatedAt: "2026-04-16T05:57:00.000Z",
        },
      ];

      const stale = findStaleHeartbeatRuns(runs, NOW, THRESHOLD_MS);
      expect(stale).toHaveLength(1);
      expect(stale[0].run.id).toBe("run-running-stale");
      expect(stale[0].staleKind).toBe("running_no_activity");
    });

    it("finds stale runs across multiple agents", () => {
      const runs: HeartbeatRunLike[] = [
        {
          id: "run-ops-stale",
          agentId: "agent-ops-lead",
          status: "queued",
          createdAt: "2026-04-16T02:00:00.000Z",
          startedAt: null,
          updatedAt: "2026-04-16T02:00:00.000Z",
        },
        {
          id: "run-chief-stale",
          agentId: "agent-chief",
          status: "running",
          createdAt: "2026-04-16T01:00:00.000Z",
          startedAt: "2026-04-16T01:01:00.000Z",
          updatedAt: "2026-04-16T01:05:00.000Z",
        },
        {
          id: "run-analytics-fresh",
          agentId: "agent-analytics",
          status: "running",
          createdAt: "2026-04-16T05:50:00.000Z",
          startedAt: "2026-04-16T05:51:00.000Z",
          updatedAt: "2026-04-16T05:55:00.000Z",
        },
      ];

      const stale = findStaleHeartbeatRuns(runs, NOW, THRESHOLD_MS);
      expect(stale).toHaveLength(2);
      expect(stale.map((s) => s.run.id).sort()).toEqual(["run-chief-stale", "run-ops-stale"]);
    });

    it("ignores succeeded, failed, and cancelled runs", () => {
      const runs: HeartbeatRunLike[] = [
        { id: "run-succeeded", agentId: "a1", status: "succeeded", createdAt: "2026-04-16T01:00:00.000Z" },
        { id: "run-failed", agentId: "a1", status: "failed", createdAt: "2026-04-16T01:00:00.000Z" },
        { id: "run-cancelled", agentId: "a1", status: "cancelled", createdAt: "2026-04-16T01:00:00.000Z" },
        { id: "run-timed-out", agentId: "a1", status: "timed_out", createdAt: "2026-04-16T01:00:00.000Z" },
      ];

      const stale = findStaleHeartbeatRuns(runs, NOW, THRESHOLD_MS);
      expect(stale).toHaveLength(0);
    });

    it("treats runs with no timestamps as infinitely stale", () => {
      const runs: HeartbeatRunLike[] = [
        { id: "run-no-ts", agentId: "a1", status: "queued" },
      ];

      const stale = findStaleHeartbeatRuns(runs, NOW, THRESHOLD_MS);
      expect(stale).toHaveLength(1);
      expect(stale[0].idleMs).toBe(Number.POSITIVE_INFINITY);
    });

    it("classifies queued runs with startedAt as running_no_activity", () => {
      const runs: HeartbeatRunLike[] = [
        {
          id: "run-queued-started",
          agentId: "a1",
          status: "queued",
          createdAt: "2026-04-16T02:00:00.000Z",
          startedAt: "2026-04-16T02:01:00.000Z",
          updatedAt: "2026-04-16T02:01:00.000Z",
        },
      ];

      const stale = findStaleHeartbeatRuns(runs, NOW, THRESHOLD_MS);
      expect(stale).toHaveLength(1);
      expect(stale[0].staleKind).toBe("running_no_activity");
    });
  });

  describe("findStaleRunningHeartbeatRun (legacy compat)", () => {
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
  });

  describe("getHeartbeatRunTaskKey", () => {
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

  describe("groupStaleRunsByAgent", () => {
    it("groups stale runs by agentId", () => {
      const stale = findStaleHeartbeatRuns(
        [
          { id: "r1", agentId: "agent-a", status: "queued", createdAt: "2026-04-16T02:00:00.000Z" },
          { id: "r2", agentId: "agent-a", status: "queued", createdAt: "2026-04-16T02:10:00.000Z" },
          { id: "r3", agentId: "agent-b", status: "running", createdAt: "2026-04-16T01:00:00.000Z", updatedAt: "2026-04-16T01:05:00.000Z" },
        ],
        NOW,
        THRESHOLD_MS,
      );

      const groups = groupStaleRunsByAgent(stale);
      expect(groups.size).toBe(2);
      expect(groups.get("agent-a")?.map((e) => e.run.id).sort()).toEqual(["r1", "r2"]);
      expect(groups.get("agent-b")?.map((e) => e.run.id)).toEqual(["r3"]);
    });

    it("handles runs with no agentId", () => {
      const stale = findStaleHeartbeatRuns(
        [{ id: "r1", status: "queued", createdAt: "2026-04-16T02:00:00.000Z" }],
        NOW,
        THRESHOLD_MS,
      );

      const groups = groupStaleRunsByAgent(stale);
      expect(groups.size).toBe(1);
      expect(groups.get("unknown")?.map((e) => e.run.id)).toEqual(["r1"]);
    });
  });
});
