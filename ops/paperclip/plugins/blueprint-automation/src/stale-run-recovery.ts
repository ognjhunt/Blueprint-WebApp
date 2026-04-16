/**
 * Generic stale-run recovery for all Paperclip agents.
 *
 * Replaces the agent-specific chief-of-staff-run-recovery.ts with a
 * harness-level mechanism that detects and recovers stale queued and
 * running heartbeat runs for any agent in the company.
 *
 * Stale states detected:
 * - queued runs with no startedAt that have exceeded the idle threshold
 * - running runs with no recent activity that have exceeded the idle threshold
 *
 * Recovery actions:
 * - cancel the stale run via the Paperclip API
 * - reset the agent runtime session so the agent can accept new work
 */

export type HeartbeatRunLike = {
  id: string;
  agentId?: string | null;
  status?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  updatedAt?: string | null;
  contextSnapshot?: Record<string, unknown> | null;
};

export type StaleRunEntry = {
  run: HeartbeatRunLike;
  idleMs: number;
  activityMs: number;
  staleKind: "queued_no_start" | "running_no_activity";
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseTimestamp(value: unknown): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return Number.NaN;
  }
  return Date.parse(value);
}

function latestActivityMs(run: HeartbeatRunLike): number {
  return [
    parseTimestamp(run.updatedAt),
    parseTimestamp(run.startedAt),
    parseTimestamp(run.createdAt),
  ].find((value) => Number.isFinite(value)) ?? Number.NaN;
}

/**
 * Find all stale heartbeat runs across all agents.
 *
 * A run is stale when:
 * - it is "queued" with no startedAt and has been idle beyond the threshold
 * - it is "running" with no recent activity beyond the threshold
 */
export function findStaleHeartbeatRuns(
  runs: HeartbeatRunLike[],
  nowMs: number,
  staleThresholdMs: number,
): StaleRunEntry[] {
  return runs
    .filter((run) => {
      const status = (run.status ?? "").trim().toLowerCase();
      return status === "queued" || status === "running";
    })
    .map((run) => {
      const status = (run.status ?? "").trim().toLowerCase();
      const activityMs = latestActivityMs(run);
      const idleMs = Number.isFinite(activityMs)
        ? Math.max(0, nowMs - activityMs)
        : Number.POSITIVE_INFINITY;

      const hasStartedAt = typeof run.startedAt === "string" && run.startedAt.trim().length > 0;
      const staleKind: StaleRunEntry["staleKind"] =
        status === "queued" && !hasStartedAt
          ? "queued_no_start"
          : "running_no_activity";

      return {
        run,
        idleMs,
        activityMs,
        staleKind,
      };
    })
    .filter((entry) => entry.idleMs >= staleThresholdMs)
    .sort((left, right) => left.idleMs - right.idleMs);
}

/**
 * Find the single oldest stale running heartbeat run (legacy compat).
 */
export function findStaleRunningHeartbeatRun(
  runs: HeartbeatRunLike[],
  nowMs: number,
  staleThresholdMs: number,
) {
  const stale = findStaleHeartbeatRuns(runs, nowMs, staleThresholdMs)
    .filter((entry) => entry.staleKind === "running_no_activity");
  return stale[0] ?? null;
}

export function getHeartbeatRunTaskKey(run: HeartbeatRunLike): string | null {
  const context = asRecord(run.contextSnapshot);
  return (
    asString(context?.taskKey)
    ?? asString(context?.issueId)
    ?? asString(context?.taskId)
  );
}

/**
 * Group stale runs by agentId for batch recovery.
 */
export function groupStaleRunsByAgent(
  staleRuns: StaleRunEntry[],
): Map<string, StaleRunEntry[]> {
  const groups = new Map<string, StaleRunEntry[]>();
  for (const entry of staleRuns) {
    const agentId = asString(entry.run.agentId) ?? "unknown";
    const existing = groups.get(agentId) ?? [];
    existing.push(entry);
    groups.set(agentId, existing);
  }
  return groups;
}
