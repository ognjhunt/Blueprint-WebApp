export type MaintenanceStateLike = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  lastResult: Record<string, unknown> | null;
};

export const ROUTING_MAINTENANCE_STALE_MS = 15 * 60 * 1000;

function toTimestamp(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function normalizeMaintenanceState(
  state: MaintenanceStateLike,
  nowIso: string,
) {
  if (!state.running) {
    return { state, changed: false };
  }

  const startedAtMs = toTimestamp(state.startedAt);
  const nowMs = toTimestamp(nowIso);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(nowMs)) {
    return { state, changed: false };
  }

  if (nowMs - startedAtMs < ROUTING_MAINTENANCE_STALE_MS) {
    return { state, changed: false };
  }

  return {
    changed: true,
    state: {
      ...state,
      running: false,
      finishedAt: nowIso,
      lastError: state.lastError ?? "Recovered stale routing-maintenance lock after exceeding the max runtime window.",
    },
  };
}
