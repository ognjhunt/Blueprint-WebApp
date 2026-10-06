// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null, default: {} };
});
vi.mock("../middleware/requireAdminRole", () => ({ requireAdminRole: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const enqueue = vi.hoisted(() => vi.fn(async () => ({ enqueued: true })));
vi.mock("../utils/taskLifecycleNotifications", () => ({ enqueueTaskLifecycleNotification: enqueue }));
const router = (await import("../routes/admin-robot-teams")).default;

const plan = {
  purpose: "Test carton palletizing at line 3", siteProvides: "One escort", teamProvides: "Robot and operation",
  pilotCost: "$18,000", window: "November",
};

describe("recording Blueprint's recommended pilot", () => {
  let server: Server; let base: string;
  beforeEach(async () => {
    state.docs.clear(); enqueue.mockClear();
    state.docs.set("inboundRequests/req1", { requestId: "req1" } as never);
    state.docs.set("robotTeams/engaged", { id: "engaged", name: "Acme Robotics", status: "engaged" } as never);
    state.docs.set("robotTeams/prospect", { id: "prospect", name: "Unknown Co", status: "prospect" } as never);
    const app = express(); app.use(express.json()); app.use(router);
    server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(async () => { await new Promise<void>(resolve => server.close(() => resolve())); });
  const post = (body: unknown) => fetch(`${base}/recommendations/req1`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const doc = () => state.docs.get("inboundRequests/req1") as { pilot_recommendation?: { teamName: string; teamId: string } };

  it("names only a registered team we have talked to, by its registry name", async () => {
    expect((await post({ ...plan, teamId: "missing" })).status).toBe(400);
    expect((await post({ ...plan, teamId: "prospect" })).status).toBe(400);
    expect((await post({ ...plan, teamName: "Typed Name", teamId: "engaged" })).status).toBe(400);
    expect(doc().pilot_recommendation).toBeUndefined();

    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
    expect(doc().pilot_recommendation).toMatchObject({ teamId: "engaged", teamName: "Acme Robotics" });
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ milestone: "pilot_recommended" }));
  });

  it("does not replace a booked pilot", async () => {
    state.docs.set("inboundRequests/req1", { requestId: "req1", pilot_booking: { recommendationId: "rec_1" } } as never);
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(409);
    expect(doc().pilot_recommendation).toBeUndefined();
  });
});
