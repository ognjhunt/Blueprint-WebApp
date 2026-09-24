// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  site: null as Record<string, unknown> | null,
  start: vi.fn(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "NOW" } } },
  dbAdmin: { collection: (name: string) => ({ doc: () => ({
    get: async () => ({ exists: name === "inboundRequests" && Boolean(state.site), data: () => state.site }),
    set: async () => undefined,
  }) }) },
}));
vi.mock("../utils/pipelineSyncSecurity", () => ({
  verifyPipelineSyncRequest: () => ({ ok: true }),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../utils/worldReconstruction", () => ({
  startWorldReconstruction: (...args: unknown[]) => state.start(...args),
  advanceWorldReconstruction: vi.fn(),
}));
vi.mock("../utils/captureFootageReview", () => ({
  buildCaptureFootageReviewer: async () => null,
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

let server: Server;
let base: string;
beforeEach(async () => {
  state.site = null;
  state.start.mockReset().mockResolvedValue({
    state: "submitted", operationId: "op-1", worldId: null, model: "worldlabs",
    assets: null, frameSelection: null, blocker: null, failureReason: null,
    updatedAtIso: "2026-09-23T00:00:00Z",
  });
  const { default: router } = await import("../routes/internal-capture-worlds");
  const app = express();
  app.use(express.json());
  app.use(router);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function reconstruct() {
  return fetch(`${base}/creator-captures/cap-1/world/reconstruct`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frames_prefix_uri: "gs://bucket/frames", site_submission_id: "site-1" }),
  });
}

describe("site scene construction gate", () => {
  it("refuses paid reconstruction until the site qualifies and claims an account", async () => {
    state.site = { site_task_triage: { disposition: "qualified" } };
    expect((await reconstruct()).status).toBe(409);
    expect(state.start).not.toHaveBeenCalled();

    state.site = { site_task_triage: { disposition: "not_now" }, account_owner_uid: "uid-1" };
    expect((await reconstruct()).status).toBe(409);
    expect(state.start).not.toHaveBeenCalled();

    state.site = { site_task_triage: { disposition: "qualified" }, account_owner_uid: "uid-1" };
    expect((await reconstruct()).status).toBe(202);
    expect(state.start).toHaveBeenCalledTimes(1);
  });
});
