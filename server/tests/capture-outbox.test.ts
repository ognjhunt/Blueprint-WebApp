// @vitest-environment node
/**
 * A message that is not lost because the request that triggered it succeeded.
 *
 * Every automation on the intake path is fire-and-forget, so the failure the
 * audit named is live: the state write lands, the send is lost, and there is
 * nothing to retry from. The outbox writes the intent durably and delivers
 * separately. These tests pin the two properties that make it worth having:
 * enqueuing twice is one message, and a failed send retries until it is spent
 * rather than forever or never.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestore as db, sharedFakeFirestoreState } from "./helpers/fake-firestore";

const sendEmailMock = vi.fn();
const recommendationIsCurrent = vi.hoisted(() => vi.fn(async (_entry: unknown, _transaction: FirebaseFirestore.Transaction) => true));
vi.mock("../utils/pilotRecommendationNotifications", () => ({
  pilotRecommendationNotificationIsCurrent: recommendationIsCurrent,
}));

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/email", () => ({ sendEmail: sendEmailMock }));

const { deliverOutbox, enqueueOutbox, reconcileOutboxDeliveries } = await import("../utils/captureOutbox");

function entry(overrides: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "req-1:brief_confirmed",
    requestId: "req-1",
    kind: "brief_confirmed" as const,
    to: "ops@acme.example",
    subject: "s",
    body: "b",
    ...overrides,
  };
}

afterEach(() => { vi.restoreAllMocks(); });

beforeEach(() => {
  sharedFakeFirestoreState.docs.clear();
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { request: { consent_attestation: {
    granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-01-01T00:00:00Z",
  } } });
  sendEmailMock.mockReset();
  recommendationIsCurrent.mockReset().mockResolvedValue(true);
});

describe("enqueuing is idempotent", () => {
  it("writes one row for the same key, however many times it is asked", async () => {
    expect((await enqueueOutbox(entry())).enqueued).toBe(true);
    expect((await enqueueOutbox(entry())).enqueued).toBe(false);
    expect((await enqueueOutbox(entry())).enqueued).toBe(false);

    const rows = [...sharedFakeFirestoreState.docs.keys()].filter((key) =>
      key.startsWith("captureOutbox/"),
    );
    expect(rows).toHaveLength(1);
  });

  it("keeps different events for one request as separate rows", async () => {
    await enqueueOutbox(entry({ idempotencyKey: "req-1:brief_confirmed", kind: "brief_confirmed" }));
    await enqueueOutbox(entry({ idempotencyKey: "req-1:coverage_shortfall", kind: "coverage_shortfall" }));

    const rows = [...sharedFakeFirestoreState.docs.keys()].filter((key) =>
      key.startsWith("captureOutbox/"),
    );
    expect(rows).toHaveLength(2);
  });
});

describe("delivery sends what is pending, once", () => {
  it("admits one sender when request and worker passes overlap", async () => {
    await enqueueOutbox(entry());
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    sendEmailMock.mockImplementation(async () => {
      await held;
      return { sent: true, provider: "resend", messageId: "accepted" };
    });
    const passes = [deliverOutbox(), deliverOutbox()];
    const completed = Promise.allSettled(passes);
    try {
      await vi.waitFor(() => expect(sendEmailMock).toHaveBeenCalled(), { timeout: 10_000, interval: 10 });
    } finally {
      release();
      await completed;
    }
    for (const result of await completed) if (result.status === "rejected") throw result.reason;
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
  it("sends a pending message and marks it sent", async () => {
    sendEmailMock.mockResolvedValue({ sent: true, provider: "smtp", messageId: "m1" });
    await enqueueOutbox(entry());

    const summary = await deliverOutbox();

    expect(summary.sent).toBe(1);
    expect(sendEmailMock).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ops@acme.example", subject: "s" }),
    );
    // Every message leaves in the branded layout, text and HTML alike.
    const sent = sendEmailMock.mock.calls[0][0];
    expect(sent.text).toMatch(/^b\n\n--\nBlueprint Robotics, Inc\. · 1005 Crete St/);
    expect(sent.html).toContain("Blueprint Robotics, Inc. · 1005 Crete St, Durham, NC 27707");
  });

  it("does not send a message it already sent", async () => {
    sendEmailMock.mockResolvedValue({ sent: true, provider: "smtp", messageId: "m1" });
    await enqueueOutbox(entry());

    await deliverOutbox();
    const second = await deliverOutbox();

    // Marked `sent`, so the second pass finds nothing pending.
    expect(second.examined).toBe(0);
    expect(sendEmailMock).toHaveBeenCalledOnce();
  });
});

describe("a failed send retries, then gives up", () => {
  it("stays pending and counts the attempt when a send fails", async () => {
    sendEmailMock.mockResolvedValue({ sent: false, provider: null, messageId: null, error: new Error("smtp down") });
    await enqueueOutbox(entry());

    const summary = await deliverOutbox();

    expect(summary.failed).toBe(1);
    const doc = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:brief_confirmed") as Record<string, unknown>;
    expect(doc.status).toBe("pending");
    expect(doc.attempts).toBe(1);
    expect(doc.lastError).toMatch(/smtp down/);
  });

  it("marks the message failed once its retries are spent, and stops", async () => {
    sendEmailMock.mockResolvedValue({ sent: false, provider: null, messageId: null, error: new Error("bad address") });
    await enqueueOutbox(entry());

    // Six attempts is the cap. Deliver until it is exhausted.
    let exhausted = false;
    for (let i = 0; i < 8 && !exhausted; i += 1) {
      const summary = await deliverOutbox();
      exhausted = summary.exhausted > 0;
    }

    const doc = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:brief_confirmed") as Record<string, unknown>;
    expect(doc.status).toBe("failed");
    // And a further pass does not keep trying a failed message.
    const after = await deliverOutbox();
    expect(after.examined).toBe(0);
  });

  it("recovers a message that fails once and then succeeds", async () => {
    sendEmailMock
      .mockResolvedValueOnce({ sent: false, provider: null, messageId: null, error: new Error("transient") })
      .mockResolvedValueOnce({ sent: true, provider: "smtp", messageId: "m2" });
    await enqueueOutbox(entry());

    await deliverOutbox();
    const second = await deliverOutbox();

    expect(second.sent).toBe(1);
    const doc = sharedFakeFirestoreState.docs.get("captureOutbox/req-1:brief_confirmed") as Record<string, unknown>;
    expect(doc.status).toBe("sent");
  });
});

const row = () => sharedFakeFirestoreState.docs.get("captureOutbox/req-1:brief_confirmed") as any;
const microtasks = async (count: number) => { for (let i = 0; i < count; i++) await Promise.resolve(); };

describe("delivery recovery never replays an ambiguous effect", () => {
  it.each(["unknown", "throw"])("quarantines %s without another send", async mode => {
    await enqueueOutbox(entry());
    sendEmailMock.mockImplementation(async () => {
      if (mode === "throw") throw new Error("connection lost");
      return { sent: false, provider: "resend", messageId: null, outcome: "unknown" };
    });
    await deliverOutbox(); await deliverOutbox();
    expect(row()).toMatchObject({ status: "unknown", attempts: 1 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("preserves dispatch uncertainty when the acceptance write fails", async () => {
    await enqueueOutbox(entry());
    const original = db.runTransaction.bind(db);
    const spy = vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => original(async (tx: any) => callback({
      ...tx, set: (ref: any, data: any, options: any) => {
        if (data.status === "sent") throw new Error("acknowledgement write unavailable");
        return tx.set(ref, data, options);
      },
    })));
    sendEmailMock.mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
    await expect(deliverOutbox()).rejects.toThrow("acknowledgement write unavailable");
    spy.mockRestore();
    expect(row()).toMatchObject({ status: "dispatching", attempts: 1 });
    row().deliveryLeaseUntilMs = Date.now() - 1;
    await deliverOutbox(); await deliverOutbox();
    expect(row().status).toBe("unknown");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("recovers a crash before dispatch without spending an attempt", async () => {
    await enqueueOutbox(entry());
    const original = db.runTransaction.bind(db);
    const spy = vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => original(async (tx: any) => callback({
      ...tx, set: (ref: any, data: any, options: any) => {
        if (data.status === "dispatching") throw new Error("crash before dispatch");
        return tx.set(ref, data, options);
      },
    })));
    await expect(deliverOutbox()).rejects.toThrow("crash before dispatch");
    spy.mockRestore();
    expect(row()).toMatchObject({ status: "claimed", attempts: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();
    row().deliveryLeaseUntilMs = Date.now() - 1;
    sendEmailMock.mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
    await deliverOutbox();
    expect(row()).toMatchObject({ status: "sent", attempts: 1 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("accepts a late bound receipt after lease expiry without replay", async () => {
    await enqueueOutbox(entry());
    let release!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    sendEmailMock.mockImplementation(async () => { await held; return { sent: true, provider: "resend", messageId: "late" }; });
    const first = deliverOutbox();
    const completed = Promise.allSettled([first]);
    try {
      await vi.waitFor(() => expect(sendEmailMock).toHaveBeenCalled(), { timeout: 10_000, interval: 10 });
      row().deliveryLeaseUntilMs = Date.now() - 1;
      await deliverOutbox();
      expect(row().status).toBe("unknown");
    } finally {
      release();
      await completed;
    }
    for (const result of await completed) if (result.status === "rejected") throw result.reason;
    expect(row()).toMatchObject({ status: "sent", deliveryMessageId: "late", attempts: 1 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it.each(["to", "body", "subject", "replyTo", "deliveryToken"])("does not attach acceptance to changed %s", async field => {
    await enqueueOutbox(entry());
    sendEmailMock.mockImplementation(async () => {
      row()[field] = "successor-value";
      return { sent: true, provider: "resend", messageId: "old-acceptance" };
    });
    await deliverOutbox();
    expect(row().status).toBe("dispatching");
    expect(row().deliveryMessageId).toBeUndefined();
    const receipts = [...sharedFakeFirestoreState.docs.entries()].filter(([key]) => key.includes("/deliveryReceipts/"));
    expect(receipts).toHaveLength(1);
    expect(receipts[0][1]).toMatchObject({ status: "sent", messageId: "old-acceptance" });
    row().deliveryLeaseUntilMs = Date.now() - 1;
    await deliverOutbox();
    expect(row().status).toBe("unknown");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("reentering each transaction callback does not duplicate dispatch", async () => {
    await enqueueOutbox(entry());
    const original = db.runTransaction.bind(db);
    vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => {
      // Retry the callback with discarded writes before its committed execution.
      await callback({ get: (ref: any) => ref.get(), set: () => undefined });
      return original(callback);
    });
    sendEmailMock.mockResolvedValue({ sent: true, provider: "resend", messageId: "accepted" });
    await deliverOutbox();
    expect(row()).toMatchObject({ status: "sent", attempts: 1 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("rotates recovery past 101 active claims to an expired claim", async () => {
    for (let i = 0; i < 102; i++) sharedFakeFirestoreState.docs.set(`captureOutbox/${String(i).padStart(3, "0")}`, {
      status: "claimed", deliveryLeaseUntilMs: i === 101 ? 0 : Date.now() + 600000,
    });
    await reconcileOutboxDeliveries(100);
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/101")?.status).toBe("claimed");
    await reconcileOutboxDeliveries(100);
    expect(sharedFakeFirestoreState.docs.get("captureOutbox/101")?.status).toBe("pending");
  });
});


describe("seeded concurrent delivery schedules", () => {
  it("checks 640 distinct schedules with eight callers, bounded attempts and unknown effects", async () => {
    const actor = new AsyncLocalStorage<number>();
    const original = db.runTransaction.bind(db);
    const traces = new Set<string>();
    const start = performance.now();
    const baselineRssKiB = Math.round(process.memoryUsage().rss / 1024);
    const cpuStart = process.cpuUsage();
    let providerCalls = 0;
    for (let seed = 1; seed <= 640; seed++) {
      sharedFakeFirestoreState.docs.clear();
      sharedFakeFirestoreState.docs.set("inboundRequests/req-1", { request: { consent_attestation: {
        granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-01-01T00:00:00Z",
      } } });
      sendEmailMock.mockReset();
      let random = seed;
      const next = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random; };
      const trace: string[] = [];
      const phases = new Map<number, number>();
      const spy = vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => {
        const id = actor.getStore() ?? -1;
        const phase = (phases.get(id) ?? 0) + 1;
        phases.set(id, phase);
        await microtasks(next() % 29);
        trace.push(`${id}:${phase}`);
        return original(callback);
      });
      await enqueueOutbox(entry());
      row().attempts = seed % 6;
      const initialAttempts = row().attempts;
      let calls = 0;
      const mode = seed % 5;
      sendEmailMock.mockImplementation(async () => {
        calls++; providerCalls++;
        await microtasks(next() % 23);
        if (mode === 1) return { sent: false, provider: "resend", messageId: null, outcome: "unknown" };
        if (mode === 2) throw new Error("lost provider response");
        if (mode === 3 && calls === 1) return { sent: false, provider: "resend", messageId: null, outcome: "not_sent" };
        if (mode === 4) {
          row().deliveryLeaseUntilMs = Date.now() - 1;
          await reconcileOutboxDeliveries();
        }
        return { sent: true, provider: "resend", messageId: `ack-${seed}` };
      });
      try {
        await Promise.all(Array.from({ length: 8 }, (_, id) => actor.run(id, async () => {
          await microtasks(next() % 37);
          await deliverOutbox();
          await microtasks(next() % 19);
          await deliverOutbox();
        })));
        expect(calls, `seed ${seed}`).toBeGreaterThan(0);
        expect(calls, `seed ${seed}`).toBeLessThanOrEqual(mode === 3 ? 2 : 1);
        expect(row().attempts, `seed ${seed}`).toBe(initialAttempts + calls);
        expect(row().attempts, `seed ${seed}`).toBeLessThanOrEqual(6);
        expect(row().status, `seed ${seed}`).toBe(mode === 1 || mode === 2 ? "unknown"
          : mode === 3 && initialAttempts === 5 ? "failed" : "sent");
        traces.add(createHash("sha256").update(trace.join(",")).digest("hex"));
      } finally { spy.mockRestore(); }
    }
    expect(traces.size).toBeGreaterThan(500);
    console.log(JSON.stringify({ runner: "capture-outbox-seeded-scheduler-v1", seeds: 640,
      distinctTransactionSchedules: traces.size, callersPerSeed: 8, providerCalls,
      warmRecoveryElapsedMs: Math.round(performance.now() - start), baselineRssKiB,
      finalRssKiB: Math.round(process.memoryUsage().rss / 1024), cpuMicros: process.cpuUsage(cpuStart),
      processLifetimeMaxRssKiB: process.resourceUsage().maxRSS,
      limitation: "In-memory serialized Firestore fake; no live provider/database or process RSS isolation." }));
  });
});


describe("recommendation authority at dispatch", () => {
  it("cancels an obsolete recommendation before attempting a send", async () => {
    await enqueueOutbox(entry({ kind: "pilot_recommended" }));
    recommendationIsCurrent.mockResolvedValue(false);
    await deliverOutbox(); await deliverOutbox();
    expect(row()).toMatchObject({ status: "cancelled", attempts: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("checks authority with the dispatch transaction before its first write", async () => {
    await enqueueOutbox(entry({ kind: "pilot_recommended" }));
    const original = db.runTransaction.bind(db);
    let guarded = false;
    const transactions = new WeakMap<object, { wrote: boolean }>();
    vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => original(async (tx: any) => {
      const state = { wrote: false };
      const wrapped = { ...tx, set: (...args: any[]) => { state.wrote = true; return tx.set(...args); } };
      transactions.set(wrapped, state);
      return callback(wrapped);
    }));
    recommendationIsCurrent.mockImplementation(async (_entry: any, tx: any) => {
      expect(transactions.get(tx)?.wrote).toBe(false);
      expect((await tx.get(db.collection("captureOutbox").doc("req-1:brief_confirmed"))).data()?.status).toBe("claimed");
      guarded = true;
      return true;
    });
    sendEmailMock.mockImplementation(async () => {
      expect(guarded).toBe(true);
      return { sent: true, provider: "resend", messageId: "authorized" };
    });
    await deliverOutbox();
    expect(row()).toMatchObject({ status: "sent", attempts: 1 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("recovers a source-check outage only by checking current authority again", async () => {
    await enqueueOutbox(entry({ kind: "pilot_recommended" }));
    recommendationIsCurrent.mockRejectedValueOnce(new Error("source unavailable"));
    await expect(deliverOutbox()).rejects.toThrow("source unavailable");
    expect(row()).toMatchObject({ status: "claimed", attempts: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();
    row().deliveryLeaseUntilMs = Date.now() - 1;
    recommendationIsCurrent.mockResolvedValue(false);
    await deliverOutbox();
    expect(row()).toMatchObject({ status: "cancelled", attempts: 0 });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
