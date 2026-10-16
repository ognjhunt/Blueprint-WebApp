// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, default: {} }));

import { readWorkerHeartbeat, workerHeartbeatWriterEnabled, writeWorkerHeartbeat } from "../utils/workerHeartbeat";

function memoryStore() {
  const docs = new Map<string, Record<string, unknown>>();
  return {
    docs,
    collection: (collection: string) => ({
      doc: (id: string) => ({
        set: async (data: Record<string, unknown>) => { docs.set(`${collection}/${id}`, { ...docs.get(`${collection}/${id}`), ...data }); },
        get: async () => ({ exists: docs.has(`${collection}/${id}`), data: () => docs.get(`${collection}/${id}`) }),
      }),
    }),
  };
}

describe("worker heartbeat", () => {
  it("reads fresh after a beat, stale after the window, and missing before the first beat", async () => {
    const store = memoryStore();
    const t0 = Date.parse("2026-10-15T12:00:00Z");
    await expect(readWorkerHeartbeat({ store, now: () => t0 })).resolves.toMatchObject({ status: "missing", ageMs: null });
    await writeWorkerHeartbeat({ store, now: () => t0 });
    expect(store.docs.get("opsHeartbeats/blueprint-webapp-worker")).toMatchObject({ beat_at_iso: "2026-10-15T12:00:00.000Z" });
    await expect(readWorkerHeartbeat({ store, now: () => t0 + 60_000, staleAfterMs: 300_000 })).resolves.toMatchObject({ status: "fresh", ageMs: 60_000 });
    await expect(readWorkerHeartbeat({ store, now: () => t0 + 301_000, staleAfterMs: 300_000 })).resolves.toMatchObject({ status: "stale" });
    await expect(readWorkerHeartbeat({ store: null })).resolves.toMatchObject({ status: "unavailable" });
  });

  it("is written only by a deployed production worker, never a preview", () => {
    expect(workerHeartbeatWriterEnabled({ NODE_ENV: "production" })).toBe(true);
    expect(workerHeartbeatWriterEnabled({ NODE_ENV: "production", IS_PULL_REQUEST: "true" })).toBe(false);
    expect(workerHeartbeatWriterEnabled({ NODE_ENV: "production", BLUEPRINT_WORKER_HEARTBEAT_ENABLED: "0" })).toBe(false);
    expect(workerHeartbeatWriterEnabled({ NODE_ENV: "development" })).toBe(false);
  });
});
