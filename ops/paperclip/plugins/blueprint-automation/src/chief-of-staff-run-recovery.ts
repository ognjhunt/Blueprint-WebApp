type HeartbeatRunContext = Record<string, unknown> | null | undefined;

export type HeartbeatRunLike = {
  id: string;
  status?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  updatedAt?: string | null;
  contextSnapshot?: HeartbeatRunContext;
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

export function findStaleRunningHeartbeatRun(
  runs: HeartbeatRunLike[],
  nowMs: number,
  staleThresholdMs: number,
) {
  const staleRuns = runs
    .filter((run) => (run.status ?? "").trim().toLowerCase() === "running")
    .map((run) => {
      const activityMs = latestActivityMs(run);
      return {
        run,
        activityMs,
        idleMs: Number.isFinite(activityMs) ? Math.max(0, nowMs - activityMs) : Number.POSITIVE_INFINITY,
      };
    })
    .filter((entry) => entry.idleMs >= staleThresholdMs)
    .sort((left, right) => left.idleMs - right.idleMs);

  return staleRuns[0] ?? null;
}

export function getHeartbeatRunTaskKey(run: HeartbeatRunLike): string | null {
  const context = asRecord(run.contextSnapshot);
  return (
    asString(context?.taskKey)
    ?? asString(context?.issueId)
    ?? asString(context?.taskId)
  );
}
