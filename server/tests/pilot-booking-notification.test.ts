// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { sharedFakeFirestore as store, sharedFakeFirestoreState as state } from "./helpers/fake-firestore";
vi.mock("../../client/src/lib/firebaseAdmin", async () => ({ dbAdmin: store, default: { firestore: { FieldValue: { serverTimestamp: () => "server-time" } } } }));
vi.mock("express-rate-limit", () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
const sendEmail = vi.hoisted(() => vi.fn());
vi.mock("../utils/email", () => ({ sendEmail }));
const enqueue = vi.hoisted(() => vi.fn(async () => ({ enqueued: true })));
vi.mock("../utils/taskLifecycleNotifications", async importOriginal => ({ ...(await importOriginal<typeof import("../utils/taskLifecycleNotifications")>()), enqueueTaskLifecycleNotification: enqueue }));
const router = (await import("../routes/task-listings")).default;
const { createCaptureUploadToken } = await import("../utils/captureUploadToken");
const { deliverOutbox, enqueueOutbox } = await import("../utils/captureOutbox");
const { TERMS_VERSION } = await import("../../client/src/lib/legalAcceptance");

let server: Server; let base: string;
const input = { recommendationId: "rec_book", authorized: true };
const doc = () => state.docs.get("inboundRequests/req1")!;
const rows = () => [...state.docs.entries()].filter(([key]) => key.startsWith("captureOutbox/") && key.split("/").length === 2);
const token = (scope: "owner" | "film" = "owner") => createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope });
const post = (body: unknown = input, scope: "owner" | "film" = "owner") => fetch(`${base}/owner/${token(scope)}/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(async () => {
  state.docs.clear(); enqueue.mockReset(); enqueue.mockResolvedValue({ enqueued: true });
  sendEmail.mockReset(); sendEmail.mockResolvedValue({ sent: true, provider: "fixture", messageId: "fixture-receipt" });
  state.docs.set("inboundRequests/req1", { requestId: "req1", contact: { email: "owner@example.test" }, pilot_recommendation: { id: "rec_book", teamName: "Fixture team" } });
  const app = express(); app.use(express.json()); app.use(router);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => { vi.restoreAllMocks(); await new Promise<void>(resolve => server.close(() => resolve())); });

describe("durable pilot booking confirmation", () => {
  it("commits booking and confirmation together without relying on post-commit enqueue", async () => {
    enqueue.mockRejectedValueOnce(new Error("queue unavailable") as never);
    expect((await post()).status).toBe(200);
    expect(doc().pilot_booking).toMatchObject({ recommendationId: "rec_book", amountUsd: 2500, termsVersion: TERMS_VERSION });
    expect(rows()).toHaveLength(1);
    expect(rows()[0][1]).toMatchObject({ kind: "pilot_booked", status: "pending", to: "owner@example.test" });
    expect(enqueue).not.toHaveBeenCalled();
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("rolls back a booking if its confirmation cannot be persisted", async () => {
    const run = store.runTransaction.bind(store);
    vi.spyOn(store, "runTransaction").mockImplementationOnce(callback => run(tx => callback({ ...tx,
      create: () => { throw new Error("outbox unavailable"); },
    })));
    expect((await post()).status).toBe(503);
    expect(doc().pilot_booking).toBeUndefined();
    expect(rows()).toHaveLength(0);
    expect((await post()).status).toBe(200);
  });

  it("preserves booking identity and confirmation history after a lost response retry", async () => {
    const run = store.runTransaction.bind(store);
    vi.spyOn(store, "runTransaction").mockImplementationOnce(async callback => {
      await run(callback);
      throw new Error("transaction committed but acknowledgement was lost");
    });
    expect((await post()).status).toBe(503);
    const booking = doc().pilot_booking;
    const committed = rows();
    expect(booking).toMatchObject({ recommendationId: "rec_book", amountUsd: 2500 });
    expect(committed).toHaveLength(1);
    expect(committed[0][1]).toMatchObject({ status: "pending", attempts: 0 });
    expect((await post()).status).toBe(200);
    expect(doc().pilot_booking).toEqual(booking);
    expect(rows()).toEqual(committed);
    await deliverOutbox();
    const sent = rows();
    expect((await post()).status).toBe(200);
    expect(rows()).toEqual(sent);
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it.each(["pending", "sent", "unknown", "claimed", "dispatching", "cancelled"])("preserves legacy %s confirmation instead of duplicating it", async status => {
    const legacyKey = "req1:pilot_booked:rec_book";
    const booking = { recommendationId: "rec_book", amountUsd: 2500, termsVersion: TERMS_VERSION, bookedAtIso: "2026-10-01T00:00:00Z", bookedBy: "signed_owner_link" };
    state.docs.set("inboundRequests/req1", { ...doc(), pilot_booking: booking });
    const legacy = { idempotencyKey: legacyKey, requestId: "req1", kind: "pilot_booked", to: "owner@example.test", subject: "Your pilot is booked", body: "Historical confirmation", replyTo: null, status,
      attempts: status === "pending" || status === "claimed" ? 0 : 1, createdAtIso: "2026-10-01T00:00:00Z", sentAtIso: null, lastError: null, deliveryLeaseUntilMs: Date.now() + 600000, deliveryToken: "legacy-token" };
    state.docs.set(`captureOutbox/${legacyKey}`, legacy);
    expect((await post()).status).toBe(200);
    expect(rows()).toEqual([[`captureOutbox/${legacyKey}`, legacy]]);
    expect(doc().pilot_booking).toEqual(booking);
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(status === "pending" ? 1 : 0);
  });

  it("retains owner scope, explicit authority, current recommendation and server-owned price", async () => {
    expect((await post(input, "film")).status).toBe(403);
    expect((await post({ ...input, authorized: false })).status).toBe(400);
    expect((await post({ ...input, amountUsd: 0 })).status).toBe(400);
    expect((await post({ ...input, recommendationId: "stale" })).status).toBe(409);
    expect(doc().pilot_booking).toBeUndefined();
    expect(rows()).toHaveLength(0);
    expect((await post()).status).toBe(200);
    expect(doc().pilot_booking).toMatchObject({ amountUsd: 2500 });
  });

  it("requires a valid current recipient and suppresses old-recipient confirmation at dispatch", async () => {
    state.docs.set("inboundRequests/req1", { ...doc(), contact: {} });
    expect((await post()).status).toBe(409);
    expect(doc().pilot_booking).toBeUndefined();
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "owner@example.test" } });
    await post();
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "corrected@example.test" } });
    await post();
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "corrected@example.test" }));
    expect(rows().find(([, row]) => row.to === "owner@example.test")?.[1]).toMatchObject({ status: "cancelled", attempts: 0 });
  });

  it("does not deliver a confirmation without the exact authoritative booking", async () => {
    await post();
    state.docs.set("inboundRequests/req1", { ...doc(), pilot_booking: { recommendationId: "other" } });
    await deliverOutbox();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(rows()[0][1]).toMatchObject({ status: "cancelled", attempts: 0 });
  });

  it("retries transaction callbacks with stable booking bytes and all reads before writes", async () => {
    const run = store.runTransaction.bind(store);
    const bookings: unknown[] = []; const intents: unknown[] = [];
    vi.spyOn(store, "runTransaction").mockImplementationOnce(callback => run(async tx => {
      for (const commit of [false, true]) {
        let wrote = false;
        const result = await callback({ ...tx,
          get: async ref => { if (wrote) throw new Error("Firestore read after write"); return tx.get(ref); },
          update: (ref, value) => { wrote = true; bookings.push(value); if (commit) tx.update(ref, value); },
          create: (ref, value) => { wrote = true; intents.push(value); if (commit) tx.create(ref, value); },
        });
        if (commit) return result;
      }
      throw new Error("unreachable");
    }));
    expect((await post()).status).toBe(200);
    expect(bookings).toHaveLength(2); expect(bookings[0]).toEqual(bookings[1]);
    expect(intents).toHaveLength(2); expect(intents[0]).toEqual(intents[1]);
  });

  it("rejects an invalid signed link before any booking or intent write", async () => {
    const response = await fetch(`${base}/owner/invalid-token/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    expect(response.status).toBe(403);
    expect(doc().pilot_booking).toBeUndefined();
    expect(rows()).toHaveLength(0);
  });

  it("allows an explicit owner retry to restore a zero-attempt notice after A→B→A contact correction", async () => {
    await post();
    const booking = doc().pilot_booking;
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "temporary@example.test" } });
    await deliverOutbox();
    expect(rows()[0][1]).toMatchObject({ status: "cancelled", attempts: 0 });
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "owner@example.test" } });
    await post();
    expect(doc().pilot_booking).toEqual(booking);
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });


  it("rejects an expired correctly signed owner link without writes", async () => {
    const expired = createCaptureUploadToken({ requestId: "req1", sceneId: "site-req1", captureId: "walkthrough-req1", scope: "owner", ttlSeconds: -1 });
    const response = await fetch(`${base}/owner/${expired}/book`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    expect(response.status).toBe(403);
    expect(doc().pilot_booking).toBeUndefined();
    expect(rows()).toHaveLength(0);
  });


  it.each([true, false])("deduplicates delayed old booking enqueue (old state committed first: %s)", async oldCommittedFirst => {
    if (oldCommittedFirst) state.docs.set("inboundRequests/req1", { ...doc(), pilot_booking: {
      recommendationId: "rec_book", amountUsd: 2500, termsVersion: TERMS_VERSION,
      bookedAtIso: "2026-10-01T00:00:00Z", bookedBy: "signed_owner_link",
    } });
    let resumeOldWriter!: () => void;
    const oldWriter = new Promise<void>(resolve => { resumeOldWriter = resolve; }).then(() => enqueueOutbox({
      idempotencyKey: "req1:pilot_booked:rec_book", requestId: "req1", kind: "pilot_booked",
      to: "owner@example.test", subject: "Your pilot is booked", body: "Legacy confirmation",
    }));
    expect((await post()).status).toBe(200);
    resumeOldWriter();
    await oldWriter;
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(1);
  });

  it("preserves the old recipient's reserved key while a corrected booking recipient gets its own intent", async () => {
    await post();
    const [key, original] = rows()[0];
    state.docs.delete(key);
    const legacyKey = "req1:pilot_booked:rec_book";
    state.docs.set(`captureOutbox/${legacyKey}`, { ...original, idempotencyKey: legacyKey });
    state.docs.set("inboundRequests/req1", { ...doc(), contact: { email: "corrected@example.test" } });
    await post();
    await enqueueOutbox({ idempotencyKey: legacyKey, requestId: "req1", kind: "pilot_booked",
      to: "corrected@example.test", subject: "Late old writer", body: "Late old writer" });
    expect(state.docs.get(`captureOutbox/${legacyKey}`)?.to).toBe("owner@example.test");
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
    expect((await post()).status).toBe(200);
    const intents = rows();
    expect(intents).toHaveLength(1);
    expect(intents[0][1].to).toBe("retry-recipient@example.test");
    await deliverOutbox();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "retry-recipient@example.test" }));
  });

});
