// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { sharedFakeFirestore as store, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore } = await import("./helpers/fake-firestore");
  return { dbAdmin: sharedFakeFirestore, storageAdmin: null, default: { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } } };
});
vi.mock("../middleware/requireAdminRole", () => ({ requireAdminRole: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const enqueue = vi.hoisted(() => vi.fn(async () => ({ enqueued: true })));
vi.mock("../utils/taskLifecycleNotifications", async importOriginal => ({ ...(await importOriginal<typeof import("../utils/taskLifecycleNotifications")>()), enqueueTaskLifecycleNotification: enqueue }));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail }));
const { deliverOutbox, enqueueOutbox } = await import("../utils/captureOutbox");
const router = (await import("../routes/admin-robot-teams")).default;
const listingRouter = (await import("../routes/task-listings")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");

const { accessRecordId } = await import("../utils/robotTeamEarlyAccess");
const plan = {
  purpose: "Test carton palletizing at line 3", siteProvides: "One escort", teamProvides: "Robot and operation",
  pilotCost: "$18,000", window: "November",
};

describe("recording Blueprint's recommended pilot", () => {
  let server: Server; let base: string;
  beforeEach(async () => {
    state.docs.clear(); sendEmail.mockReset(); sendEmail.mockResolvedValue({ sent: true, provider: "fixture", messageId: "fixture-receipt" }); enqueue.mockReset(); enqueue.mockResolvedValue({ enqueued: true });
    state.docs.set("inboundRequests/req1", { requestId: "req1", contact: { email: "owner@example.test" } } as never);
    state.docs.set("robotTeams/engaged", { id: "engaged", name: "Acme Robotics", status: "engaged", contactEmail: "team@example.test" } as never);
    state.docs.set("robotTeams/prospect", { id: "prospect", name: "Unknown Co", status: "prospect" } as never);
    state.docs.set(`robotTeamAccess/${accessRecordId("team@example.test")}`, { status: "approved" });
    const app = express(); app.use(express.json()); app.use(router); app.use(listingRouter);
    server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  afterEach(async () => { vi.restoreAllMocks(); await new Promise<void>(resolve => server.close(() => resolve())); });
  const post = (body: unknown) => fetch(`${base}/recommendations/req1`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const doc = () => state.docs.get("inboundRequests/req1") as { pilot_recommendation?: { teamName: string; teamId: string } };

  it("names only a registered team we have talked to, by its registry name", async () => {
    expect((await post({ ...plan, teamId: "missing" })).status).toBe(400);
    expect((await post({ ...plan, teamId: "prospect" })).status).toBe(400);
    expect((await post({ ...plan, teamName: "Typed Name", teamId: "engaged" })).status).toBe(400);
    expect(doc().pilot_recommendation).toBeUndefined();

    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
    expect(doc().pilot_recommendation).toMatchObject({ teamId: "engaged", teamName: "Acme Robotics" });
    expect([...state.docs.keys()].filter(key => key.startsWith("captureOutbox/req1:pilot_recommended:"))).toHaveLength(1);
  });

  it("does not replace a booked pilot", async () => {
    state.docs.set("inboundRequests/req1", { requestId: "req1", pilot_booking: { recommendationId: "rec_1" } } as never);
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(409);
    expect(doc().pilot_recommendation).toBeUndefined();
  });

  it("refuses stale owner booking after recommendations are replaced in the same millisecond", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.now());
    const first = await post({ ...plan, teamId: "engaged" });
    expect(first.status).toBe(200);
    const previous = await first.json() as { id: string };
    const replacement = await post({ ...plan, pilotCost: "$24,000", window: "December", teamId: "engaged" });
    expect(replacement.status).toBe(200);
    const current = await replacement.json() as { id: string };
    const token = createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope: "owner" });
    const book = (recommendationId: string) => fetch(`${base}/owner/${token}/book`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recommendationId, authorized: true }),
    });

    expect((await book(previous.id)).status).toBe(409);
    expect(state.docs.get("inboundRequests/req1")?.pilot_booking).toBeUndefined();
    expect(current.id).not.toBe(previous.id);
    expect((await book(current.id)).status).toBe(200);
    expect(state.docs.get("inboundRequests/req1")?.pilot_booking).toMatchObject({ recommendationId: current.id, amountUsd: 0 });
  });

  it("keeps an exact durable notification even when post-commit enqueue is unavailable", async () => {
    enqueue.mockRejectedValueOnce(new Error("queue unavailable") as never);
    const response = await post({ ...plan, teamId: "engaged" });
    expect(response.status).toBe(200);
    const { id } = await response.json() as { id: string };
    const intents = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/req1:pilot_recommended:"));
    expect(intents).toHaveLength(1);
    expect(intents[0][0]).toContain(id);
    expect(intents[0][1]).toMatchObject({ to: "owner@example.test", kind: "pilot_recommended", status: "pending" });
  });

  it("reuses the current recommendation and intent on an identical request retry", async () => {
    const first = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    expect(retry.id).toBe(first.id);
    expect([...state.docs.keys()].filter(key => key.startsWith("captureOutbox/") && key.split("/").length === 2)).toHaveLength(1);
  });


  it("rolls back the recommendation when atomic notification creation fails", async () => {
    const run = store.runTransaction.bind(store);
    vi.spyOn(store, "runTransaction").mockImplementationOnce(callback => run(async tx => callback({ ...tx,
      create: () => { throw new Error("outbox write unavailable"); },
    })));
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(503);
    expect(doc().pilot_recommendation).toBeUndefined();
    expect([...state.docs.keys()].filter(key => key.startsWith("captureOutbox/") && key.split("/").length === 2)).toHaveLength(0);
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
  });

  it("reads before writes and reuses exact durable bytes across transaction callback retries", async () => {
    const run = store.runTransaction.bind(store);
    const proposals: unknown[] = [];
    const intents: unknown[] = [];
    vi.spyOn(store, "runTransaction").mockImplementationOnce(callback => run(async tx => {
      for (const commit of [false, true]) {
        let wrote = false;
        const result = await callback({ ...tx,
          get: async ref => {
            if (wrote) throw new Error("Firestore requires all reads before writes");
            return tx.get(ref);
          },
          update: (ref, value) => { wrote = true; proposals.push(value); if (commit) tx.update(ref, value); },
          create: (ref, value) => { wrote = true; intents.push(value); if (commit) tx.create(ref, value); },
        });
        if (commit) return result;
      }
      throw new Error("unreachable");
    }));
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
    expect(proposals).toHaveLength(2);
    expect(proposals[0]).toEqual(proposals[1]);
    expect(intents).toHaveLength(2);
    expect(intents[0]).toEqual(intents[1]);
  });

  it("requires a usable recipient before committing and binds authorized retries to a changed recipient", async () => {
    state.docs.set("inboundRequests/req1", { requestId: "req1" });
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(409);
    expect(doc().pilot_recommendation).toBeUndefined();
    state.docs.set("inboundRequests/req1", { requestId: "req1", contact: { email: "first@example.test" } });
    const first = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "second@example.test" } });
    const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    expect(retry.id).toBe(first.id);
    const intents = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"));
    expect(intents).toHaveLength(2);
    expect(new Set(intents.map(([, value]) => value.to))).toEqual(new Set(["first@example.test", "second@example.test"]));
  });


  it("does not reset delivery history when an acknowledged recommendation is retried", async () => {
    const first = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    const [key, intent] = [...state.docs.entries()].find(([key]) => key.startsWith("captureOutbox/"))!;
    const sent = { ...intent, status: "sent", attempts: 1, sentAtIso: "2026-10-07T00:00:00Z" };
    state.docs.set(key, sent);
    const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    expect(retry.id).toBe(first.id);
    expect(state.docs.get(key)).toEqual(sent);
  });


  it("recovers committed notifications through the real pump and suppresses a superseded recommendation", async () => {
    const first = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    const second = await (await post({ ...plan, purpose: "Test a different exact task", teamId: "engaged" })).json() as { id: string };
    // Simulate a process boundary: only persisted store bytes reach the pump.
    // It uses the real source guard and a no-send provider stub.
    await deliverOutbox();
    const rows = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"));
    expect(rows.find(([key]) => key.includes(first.id))?.[1]).toMatchObject({ status: "cancelled", attempts: 0 });
    expect(rows.find(([key]) => key.includes(second.id))?.[1]).toMatchObject({ status: "sent", attempts: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@example.test", text: expect.stringContaining("different exact task") }));
  });

  it("never sends a retained old-recipient intent after the authoritative contact changes", async () => {
    await post({ ...plan, teamId: "engaged" });
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "updated@example.test" } });
    await post({ ...plan, teamId: "engaged" });
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "updated@example.test" }));
    const rows = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"));
    expect(rows.find(([, row]) => row.to === "owner@example.test")?.[1]).toMatchObject({ status: "cancelled", attempts: 0 });
  });


  async function seedLegacyIntent(status: string) {
    const { id } = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    const [key, intent] = [...state.docs.entries()].find(([key]) => key.startsWith("captureOutbox/"))!;
    state.docs.delete(key);
    const legacyKey = `req1:pilot_recommended:${id}`;
    const legacy = { ...intent, idempotencyKey: legacyKey, status,
      attempts: status === "pending" || status === "claimed" ? 0 : 1,
      deliveryLeaseUntilMs: Date.now() + 600000, deliveryToken: "legacy-claim-token" };
    state.docs.set(`captureOutbox/${legacyKey}`, legacy);
    return { id, path: `captureOutbox/${legacyKey}`, legacy };
  }

  it.each(["pending", "sent", "unknown", "claimed", "dispatching", "cancelled"])(
    "reuses historical %s recommendation intent without creating a second email",
    async status => {
      const historical = await seedLegacyIntent(status);
      const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
      expect(retry.id).toBe(historical.id);
      expect([...state.docs.keys()].filter(key => key.startsWith("captureOutbox/") && key.split("/").length === 2)).toHaveLength(1);
      expect(state.docs.get(historical.path)).toEqual(historical.legacy);
      await deliverOutbox();
      expect(sendEmail).toHaveBeenCalledTimes(status === "pending" ? 1 : 0);
    },
  );

  it("creates a current-recipient intent while cancelling a historical different-recipient intent", async () => {
    const historical = await seedLegacyIntent("pending");
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "updated@example.test" } });
    const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    expect(retry.id).toBe(historical.id);
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "updated@example.test" }));
    expect(state.docs.get(historical.path)).toMatchObject({ status: "cancelled", attempts: 0 });
  });

  it("rearms only a zero-attempt cancelled intent when an explicit retry restores its current recipient", async () => {
    await post({ ...plan, teamId: "engaged" });
    const [key] = [...state.docs.entries()].find(([key]) => key.startsWith("captureOutbox/"))!;
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "temporary@example.test" } });
    await deliverOutbox();
    expect(state.docs.get(key)).toMatchObject({ status: "cancelled", attempts: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "owner@example.test" } });
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
    expect(state.docs.get(key)).toMatchObject({ status: "pending", attempts: 0 });
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });


  it("reserves the old writer's key when repairing its committed recommendation before delayed enqueue", async () => {
    const { id } = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    const [savedKey, savedIntent] = [...state.docs.entries()].find(([key]) => key.startsWith("captureOutbox/"))!;
    // The old handler has committed this exact recommendation but is paused
    // before its separate enqueue. Keep only that committed source state.
    state.docs.delete(savedKey);
    let resumeOldWriter!: () => void;
    const oldWriter = new Promise<void>(resolve => { resumeOldWriter = resolve; }).then(() => enqueueOutbox({
      idempotencyKey: `req1:pilot_recommended:${id}`, requestId: "req1", kind: "pilot_recommended",
      to: "owner@example.test", subject: String(savedIntent.subject), body: String(savedIntent.body),
    }));
    const retry = await (await post({ ...plan, teamId: "engaged" })).json() as { id: string };
    expect(retry.id).toBe(id);
    resumeOldWriter();
    await oldWriter;
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect([...state.docs.keys()].filter(key => key.startsWith("captureOutbox/") && key.split("/").length === 2)).toHaveLength(1);
  });

  it("does not alias a changed recipient onto an occupied old-writer key", async () => {
    const old = await seedLegacyIntent("pending");
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "corrected@example.test" } });
    await post({ ...plan, teamId: "engaged" });
    await enqueueOutbox({ idempotencyKey: `req1:pilot_recommended:${old.id}`, requestId: "req1", kind: "pilot_recommended",
      to: "corrected@example.test", subject: "Late old writer", body: "Late old writer" });
    expect(state.docs.get(old.path)?.to).toBe("owner@example.test");
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "corrected@example.test" }));
  });


  it("uses the transaction retry's current recipient when the reserved legacy key is unchanged", async () => {
    const run = store.runTransaction.bind(store);
    vi.spyOn(store, "runTransaction").mockImplementationOnce(callback => run(async tx => {
      await callback({ ...tx, update: () => undefined, create: () => undefined });
      state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "retry-recipient@example.test" } });
      return callback(tx);
    }));
    expect((await post({ ...plan, teamId: "engaged" })).status).toBe(200);
    const intents = [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/"));
    expect(intents).toHaveLength(1);
    expect(intents[0][1].to).toBe("retry-recipient@example.test");
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "retry-recipient@example.test" }));
  });

});
