import { describe, expect, it } from "vitest";
import {
  normalizeMaintenanceState,
  ROUTING_MAINTENANCE_STALE_MS,
} from "./maintenance-guard.js";

describe("maintenance guard", () => {
  it("leaves fresh running maintenance locks alone", () => {
    const startedAt = "2026-04-09T20:00:00.000Z";
    const result = normalizeMaintenanceState(
      {
        running: true,
        startedAt,
        finishedAt: null,
        lastError: null,
        lastResult: null,
      },
      new Date(Date.parse(startedAt) + ROUTING_MAINTENANCE_STALE_MS - 1000).toISOString(),
    );

    expect(result.changed).toBe(false);
    expect(result.state.running).toBe(true);
  });

  it("recovers stale running maintenance locks", () => {
    const startedAt = "2026-04-09T20:00:00.000Z";
    const nowIso = new Date(Date.parse(startedAt) + ROUTING_MAINTENANCE_STALE_MS + 1000).toISOString();
    const result = normalizeMaintenanceState(
      {
        running: true,
        startedAt,
        finishedAt: null,
        lastError: null,
        lastResult: null,
      },
      nowIso,
    );

    expect(result.changed).toBe(true);
    expect(result.state.running).toBe(false);
    expect(result.state.finishedAt).toBe(nowIso);
    expect(result.state.lastError).toContain("Recovered stale routing-maintenance lock");
  });
});
