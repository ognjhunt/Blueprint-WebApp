// @vitest-environment node
/**
 * An email to a site is neither lost silently nor sent twice.
 *
 * The provider here behaves as Resend documents its idempotency keys: a key is
 * kept for 24 hours, and a repeat of a request it already accepted returns the
 * first answer without sending again. After 24 hours the key is forgotten and
 * the same request sends a second email. `provider.state.delivered` is every
 * email that really left; no test may leave two for one recipient.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestore as db, sharedFakeFirestoreState as store } from "./helpers/fake-firestore";

const provider = vi.hoisted(() => {
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  const state = {
    delivered: [] as Array<{ to: string; key: string | undefined; atMs: number }>,
    calls: [] as Array<{ to: string; key: string | undefined; atMs: number }>,
    keys: new Map<string, { id: string; atMs: number }>(),
    /** What the provider does with a call: accept, accept_but_lose_answer, error_500, throw, rate_limited, invalid_recipient, unconfigured. */
    behaviour: (_call: { to: string; number: number }): string => "accept",
  };
  const refusal = (failure: string, message: string) => ({ sent: false, provider: "resend", messageId: null,
    outcome: failure === "unknown" ? "unknown" : "not_sent", failure, error: new Error(`Resend rejected email: ${message}`) });
  const send = async (options: { to: string; idempotencyKey?: string }) => {
    const atMs = Date.now();
    state.calls.push({ to: options.to, key: options.idempotencyKey, atMs });
    const behaviour = state.behaviour({ to: options.to, number: state.calls.filter(call => call.to === options.to).length });
    if (behaviour === "rate_limited") return refusal("transient", "Too many requests");
    if (behaviour === "invalid_recipient") return refusal("permanent", "Invalid `to` field");
    if (behaviour === "error_500") return refusal("unknown", "An unexpected error occurred.");
    if (behaviour === "throw") throw new Error("socket hang up");
    // What sendEmail answers when Resend is not configured: nothing sent, no class.
    if (behaviour === "unconfigured") return { sent: false, provider: null, messageId: null };
    const held = options.idempotencyKey ? state.keys.get(options.idempotencyKey) : undefined;
    let id = held && atMs - held.atMs < WINDOW_MS ? held.id : null;
    if (!id) {
      id = `email-${state.delivered.length + 1}`;
      state.delivered.push({ to: options.to, key: options.idempotencyKey, atMs });
      if (options.idempotencyKey) state.keys.set(options.idempotencyKey, { id, atMs });
    }
    if (behaviour === "accept_but_lose_answer") return refusal("unknown", "connection reset after acceptance");
    return { sent: true, provider: "resend", messageId: id };
  };
  return { state, send };
});
const authority = vi.hoisted(() => vi.fn(async (_entry: { idempotencyKey: string }): Promise<"current" | "obsolete" | "review_required"> => "current"));

vi.mock("../../client/src/lib/firebaseAdmin", async () => ({
  default: { firestore: { FieldValue: { serverTimestamp: () => "SERVER_TIMESTAMP" } } },
  dbAdmin: (await import("./helpers/fake-firestore")).sharedFakeFirestore,
  authAdmin: null,
}));
vi.mock("../logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("../utils/email", () => ({ sendEmail: provider.send }));
vi.mock("../utils/robotTeamAccessNotificationAuthority", () => ({ robotTeamAccessNotificationAuthority: authority }));

const { deliverOutbox, enqueueOutbox } = await import("../utils/captureOutbox");
const { MAX_UNDELIVERED_AGE_MS, RESEND_WINDOW_MS, providerIdempotencyKey, retryDelayMs } = await import("../utils/captureOutboxRetry");
const { scanTerminalOutboxFailures, scanUnknownOutboxOutcomes, __resetBetaOpsMonitorForTests } = await import("../utils/betaOpsMonitor");

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const START = Date.parse("2026-11-10T09:00:00Z");

const key = (name: string) => `req-${name}:results_ready`;
const row = (name = "a") => store.docs.get(`captureOutbox/${key(name)}`) as Record<string, any>;
const callsTo = (name = "a") => provider.state.calls.filter(call => call.to === `${name}@site.example`);
const deliveredTo = (name = "a") => provider.state.delivered.filter(email => email.to === `${name}@site.example`);

async function enqueue(name = "a", kind: "results_ready" | "task_received" = "results_ready") {
  store.docs.set(`inboundRequests/req-${name}`, { request: { consent_attestation: {
    granted: true, statement_version: "2026-09-18.v1", recorded_at_iso: "2026-01-01T00:00:00Z" } } });
  await enqueueOutbox({ idempotencyKey: key(name), requestId: `req-${name}`, kind,
    to: `${name}@site.example`, subject: "Your result", body: "The run finished." });
}

/** One pump pass a minute, as the deployed pump runs. */
async function pump(forMs: number, stepMs = MINUTE) {
  const end = Date.now() + forMs;
  while (Date.now() < end) {
    vi.setSystemTime(Date.now() + stepMs);
    await deliverOutbox();
  }
}

/** The ops alerts a monitor pass would raise now. */
async function monitor() {
  const alert = vi.fn(async (_key: string, _text: string) => undefined);
  const email = vi.fn(async () => ({ sent: true }));
  const deps = { store: db as never, alert, email: email as never, now: () => Date.now() };
  return { failed: await scanTerminalOutboxFailures(deps), unknown: await scanUnknownOutboxOutcomes(deps), alert };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
  vi.stubEnv("IS_PULL_REQUEST", "false");
  // The longest wait of every step, so the schedule is exact.
  vi.spyOn(Math, "random").mockReturnValue(1);
  store.docs.clear();
  provider.state.delivered.length = 0;
  provider.state.calls.length = 0;
  provider.state.keys.clear();
  provider.state.behaviour = () => "accept";
  authority.mockReset().mockResolvedValue("current");
  __resetBetaOpsMonitorForTests();
});

afterEach(() => {
  // No email is ever sent twice, in any test.
  const perRecipient = new Map<string, number>();
  for (const email of provider.state.delivered) perRecipient.set(email.to, (perRecipient.get(email.to) ?? 0) + 1);
  expect([...perRecipient.values()].every(count => count === 1), JSON.stringify([...perRecipient])).toBe(true);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("the provider idempotency key", () => {
  it("is derived from the outbox document id alone, and differs per row", async () => {
    await enqueue("a"); await enqueue("b");
    await deliverOutbox();
    expect(callsTo("a")[0].key).toBe(providerIdempotencyKey(key("a")));
    expect(callsTo("b")[0].key).toBe(providerIdempotencyKey(key("b")));
    expect(callsTo("a")[0].key).not.toBe(callsTo("b")[0].key);
    expect(callsTo("a")[0].key).toMatch(/^capture-outbox\/[a-f0-9]{64}$/);
    expect(row("a")).toMatchObject({ status: "sent", deliveryIdempotencyKey: providerIdempotencyKey(key("a")), deliveryKeyAttempt: 1 });
  });

  it("is the same on every re-send of a row", async () => {
    await enqueue();
    provider.state.behaviour = ({ number }) => number <= 3 ? "error_500" : "accept";
    await pump(HOUR);
    expect(callsTo().length).toBe(4);
    expect(new Set(callsTo().map(call => call.key))).toEqual(new Set([providerIdempotencyKey(key("a"))]));
    expect(row()).toMatchObject({ status: "sent", attempts: 4 });
  });
});

describe("an unknown outcome is sent again with the same key inside the provider's window", () => {
  it.each(["error_500", "throw", "accept_but_lose_answer"] as const)("after %s the row is retried and ends sent, delivered once", async first => {
    await enqueue();
    provider.state.behaviour = ({ number }) => number === 1 ? first : "accept";
    await deliverOutbox();
    expect(row()).toMatchObject({ status: "unknown", attempts: 1, lastError: "delivery_outcome_unknown" });
    expect(row().nextAttemptAtMs).toBe(Date.now() + retryDelayMs(1));
    // Not before its backoff.
    await deliverOutbox();
    expect(callsTo()).toHaveLength(1);
    await pump(5 * MINUTE);
    expect(row()).toMatchObject({ status: "sent", attempts: 2, lastError: null });
    expect(callsTo()).toHaveLength(2);
    expect(callsTo()[1].key).toBe(callsTo()[0].key);
    expect(deliveredTo()).toHaveLength(1);
  });

  it("a process that stopped mid-send is retried with the key once its dispatch lease ends", async () => {
    await enqueue();
    // The send reached the provider; the process died before it recorded the answer.
    const original = db.runTransaction.bind(db);
    const spy = vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => original(async (tx: any) => callback({
      ...tx, set: (ref: any, data: any, options: any) => {
        if (data.status === "sent") throw new Error("process stopped before the receipt was written");
        return tx.set(ref, data, options);
      },
    })));
    await deliverOutbox();
    spy.mockRestore();
    expect(row()).toMatchObject({ status: "dispatching", attempts: 1 });
    expect(deliveredTo()).toHaveLength(1);
    await pump(10 * MINUTE);
    expect(row()).toMatchObject({ status: "sent", attempts: 2 });
    expect(callsTo()).toHaveLength(2);
    expect(callsTo()[1].key).toBe(callsTo()[0].key);
    expect(deliveredTo()).toHaveLength(1);
  });

  it("never passes through pending or claimed while its outcome is unknown", async () => {
    await enqueue();
    provider.state.behaviour = ({ number }) => number === 1 ? "error_500" : number === 2 ? "rate_limited" : "accept";
    await deliverOutbox();
    const written: string[] = [];
    const original = db.runTransaction.bind(db);
    vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => original(async (tx: any) => callback({
      ...tx, set: (ref: any, data: any, options: any) => {
        if (ref.path === `captureOutbox/${key("a")}` && data.status) written.push(data.status);
        return tx.set(ref, data, options);
      },
    })));
    await pump(HOUR);
    // A refusal after an unknown outcome does not prove the first try was not delivered.
    expect(written).toEqual(["dispatching", "unknown", "dispatching", "sent"]);
    expect(row()).toMatchObject({ status: "sent", attempts: 3 });
  });

  it("makes one re-send when eight passes overlap as it comes due", async () => {
    await enqueue();
    provider.state.behaviour = ({ number }) => number === 1 ? "accept_but_lose_answer" : "accept";
    await deliverOutbox();
    vi.setSystemTime(Date.now() + 2 * MINUTE);
    await Promise.all(Array.from({ length: 8 }, () => deliverOutbox()));
    expect(callsTo()).toHaveLength(2);
    expect(row()).toMatchObject({ status: "sent", attempts: 2 });
    expect(deliveredTo()).toHaveLength(1);
  });

  it("is due again when a pass stops between claiming the re-send and dispatching it", async () => {
    await enqueue();
    provider.state.behaviour = ({ number }) => number === 1 ? "error_500" : "accept";
    await deliverOutbox();
    vi.setSystemTime(Date.now() + 2 * MINUTE);
    // The process stops after the claim: neither the dispatch marker nor a deferral is written.
    const original = db.runTransaction.bind(db);
    const spy = vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => original(async (tx: any) => callback({
      ...tx, set: (ref: any, data: any, options: any) => {
        if (data.status === "dispatching" || data.deliveryDeferrals) throw new Error("process stopped");
        return tx.set(ref, data, options);
      },
    })));
    await deliverOutbox();
    spy.mockRestore();
    expect(row()).toMatchObject({ status: "unknown", attempts: 1 });
    // Held by the claim until its lease ends, then sent again with the key.
    await deliverOutbox();
    expect(callsTo()).toHaveLength(1);
    await pump(6 * MINUTE);
    expect(row()).toMatchObject({ status: "sent", attempts: 2 });
    expect(callsTo().map(call => call.key)).toEqual(Array(2).fill(providerIdempotencyKey(key("a"))));
  });

  it("stays unknown, spends no attempt and waits when the check before its re-send cannot be read", async () => {
    await enqueue();
    provider.state.behaviour = ({ number }) => number === 1 ? "error_500" : "accept";
    await deliverOutbox();
    authority.mockRejectedValueOnce(new Error("website_preparation_status_unavailable"));
    vi.setSystemTime(Date.now() + 2 * MINUTE);
    await deliverOutbox();
    expect(row()).toMatchObject({ status: "unknown", attempts: 1, deliveryDeferrals: 1, lastError: "delivery_outcome_unknown" });
    expect(row().nextAttemptAtMs).toBe(Date.now() + retryDelayMs(2));
    expect(callsTo()).toHaveLength(1);
    await pump(5 * MINUTE);
    expect(row()).toMatchObject({ status: "sent", attempts: 2 });
  });

  it("backs off between re-sends, up to an hour apart", async () => {
    await enqueue();
    provider.state.behaviour = () => "error_500";
    await pump(6 * HOUR);
    const gaps = callsTo().slice(1).map((call, index) => Math.round((call.atMs - callsTo()[index].atMs) / MINUTE));
    expect(gaps.slice(0, 7)).toEqual([1, 2, 4, 8, 16, 32, 60]);
    expect(gaps.slice(7).every(gap => gap === 60)).toBe(true);
    expect(row()).toMatchObject({ status: "unknown" });
    expect(row().deliveryRetryEnded).toBeUndefined();
  });
});

describe("outside the provider's window an unknown outcome is not sent again", () => {
  it("stops re-sending when the window closes, keeps the row unknown, and alerts once", async () => {
    await enqueue();
    provider.state.behaviour = () => "error_500";
    await pump(30 * HOUR);
    const sentAt = callsTo().map(call => call.atMs);
    expect(sentAt.length).toBeGreaterThan(20);
    expect(Math.max(...sentAt)).toBeLessThan(sentAt[0] + RESEND_WINDOW_MS);
    expect(row()).toMatchObject({ status: "unknown", deliveryRetryEnded: "window_closed",
      lastError: "delivery_outcome_unknown_window_closed", nextAttemptAtMs: null });
    const attempts = row().attempts;
    await pump(30 * HOUR, 10 * MINUTE);
    expect(row().attempts).toBe(attempts);
    expect(callsTo()).toHaveLength(sentAt.length);

    const first = await monitor();
    expect(first.unknown).toEqual({ unknown: 1, needsPerson: 1, newlyAlerted: 1 });
    expect(first.alert).toHaveBeenCalledOnce();
    expect(String(first.alert.mock.calls[0][1])).toMatch(/1 customer email\(s\) may or may not have been sent, and will not be sent again automatically/);
    expect(String(first.alert.mock.calls[0][1])).not.toContain("a@site.example");
    expect((await monitor()).alert).not.toHaveBeenCalled();
  });

  it("does not re-send a row the pump did not reach until after the window closed", async () => {
    await enqueue();
    provider.state.behaviour = ({ number }) => number === 1 ? "accept_but_lose_answer" : "accept";
    await deliverOutbox();
    expect(row().status).toBe("unknown");
    // The pump was down for more than a day. The provider has forgotten the key,
    // so a re-send now would be a second email.
    vi.setSystemTime(Date.now() + 25 * HOUR);
    await pump(2 * HOUR);
    expect(callsTo()).toHaveLength(1);
    expect(deliveredTo()).toHaveLength(1);
    expect(row()).toMatchObject({ status: "unknown", deliveryRetryEnded: "window_closed" });
    expect((await monitor()).unknown.newlyAlerted).toBe(1);
  });

  it("alerts for a row whose window has closed even while the pump is not running", async () => {
    await enqueue();
    provider.state.behaviour = () => "error_500";
    await deliverOutbox();
    expect((await monitor()).unknown).toEqual({ unknown: 1, needsPerson: 0, newlyAlerted: 0 });
    vi.setSystemTime(Date.now() + 24 * HOUR);
    expect((await monitor()).unknown).toEqual({ unknown: 1, needsPerson: 1, newlyAlerted: 1 });
  });
});

describe("rows that were unknown before provider keys existed", () => {
  const legacy = (overrides: Record<string, unknown> = {}) => ({
    idempotencyKey: key("a"), requestId: "req-a", kind: "results_ready", to: "a@site.example", subject: "Your result",
    body: "The run finished.", replyTo: null, status: "unknown", attempts: 1, createdAtIso: new Date(START - HOUR).toISOString(),
    sentAtIso: null, lastError: "delivery_outcome_unknown", deliveryToken: "old-token", deliveryDigest: "old-digest",
    deliveryLeaseUntilMs: START - 50 * MINUTE, ...overrides });

  it("are never sent again, and are reported once", async () => {
    store.docs.set("inboundRequests/req-a", { request: { consent_attestation: { granted: true } } });
    store.docs.set(`captureOutbox/${key("a")}`, legacy());
    const before = structuredClone(row());
    await pump(48 * HOUR, 10 * MINUTE);
    expect(provider.state.calls).toHaveLength(0);
    expect(row()).toEqual(before);
    const first = await monitor();
    expect(first.unknown).toEqual({ unknown: 1, needsPerson: 1, newlyAlerted: 1 });
    expect((await monitor()).unknown.newlyAlerted).toBe(0);
  });

  it("a dispatch in flight without a key when this deploys becomes unknown and is never sent again", async () => {
    store.docs.set("inboundRequests/req-a", { request: { consent_attestation: { granted: true } } });
    store.docs.set(`captureOutbox/${key("a")}`, legacy({ status: "dispatching", lastError: null, deliveryLeaseUntilMs: START + MINUTE }));
    await pump(48 * HOUR, 10 * MINUTE);
    expect(provider.state.calls).toHaveLength(0);
    expect(row()).toMatchObject({ status: "unknown", attempts: 1, lastError: "delivery_outcome_unknown" });
    expect(row().nextAttemptAtMs).toBeUndefined();
  });

  it("a dispatch by an older build after a keyed one is not sent again either", async () => {
    await enqueue();
    provider.state.behaviour = () => "rate_limited";
    await deliverOutbox();
    expect(row()).toMatchObject({ status: "pending", attempts: 1, deliveryKeyAttempt: 1 });
    // An older build, still running during a rolling deploy, sends the pending
    // row without a key and loses the answer.
    Object.assign(row(), { status: "unknown", attempts: 2, lastError: "delivery_outcome_unknown" });
    await pump(48 * HOUR, 10 * MINUTE);
    expect(callsTo()).toHaveLength(1);
    expect(row()).toMatchObject({ status: "unknown", attempts: 2 });
  });
});

describe("a transient refusal backs off for hours", () => {
  it("a 429 waits longer each time, is not spent in minutes, and is delivered when the provider recovers", async () => {
    await enqueue();
    const recoversAt = START + 8 * HOUR;
    provider.state.behaviour = () => Date.now() < recoversAt ? "rate_limited" : "accept";
    await pump(10 * MINUTE);
    expect(callsTo().length).toBeLessThanOrEqual(4);
    expect(row()).toMatchObject({ status: "pending", lastError: "Resend rejected email: Too many requests" });
    await pump(10 * HOUR);
    const gaps = callsTo().slice(1).map((call, index) => Math.round((call.atMs - callsTo()[index].atMs) / MINUTE));
    expect(gaps.slice(0, 7)).toEqual([1, 2, 4, 8, 16, 32, 60]);
    expect(callsTo().length).toBeGreaterThan(6);
    expect(row()).toMatchObject({ status: "sent", lastError: null });
    expect(row().attempts).toBe(callsTo().length);
    expect(deliveredTo()).toHaveLength(1);
    expect((await monitor()).alert).not.toHaveBeenCalled();
  });

  it("spreads rows refused together, by up to half of each step", () => {
    expect(retryDelayMs(1, () => 0)).toBe(30_000);
    expect(retryDelayMs(1, () => 1)).toBe(MINUTE);
    expect(retryDelayMs(4, () => 0.5)).toBe(6 * MINUTE);
    expect(retryDelayMs(40, () => 1)).toBe(HOUR);
  });

  it("fails and alerts once the row is older than the bound, having sent nothing", async () => {
    await enqueue();
    provider.state.behaviour = () => "rate_limited";
    await pump(40 * HOUR, 5 * MINUTE);
    expect(row()).toMatchObject({ status: "failed", nextAttemptAtMs: null });
    expect(row().lastError).toMatch(/^delivery_retry_age_exceeded: Resend rejected email/);
    const last = Math.max(...callsTo().map(call => call.atMs));
    expect(last - START).toBeLessThanOrEqual(MAX_UNDELIVERED_AGE_MS);
    expect(last - START).toBeGreaterThan(MAX_UNDELIVERED_AGE_MS - 2 * HOUR);
    expect(deliveredTo()).toHaveLength(0);
    const { failed, alert } = await monitor();
    expect(failed).toEqual({ failed: 1, newlyAlerted: 1 });
    expect(String(alert.mock.calls[0][1])).toMatch(/1 customer email\(s\) failed permanently/);
  });

  it("an unconfigured transport is retried the same way", async () => {
    await enqueue();
    provider.state.behaviour = ({ number }) => number === 1 ? "unconfigured" : "accept";
    await deliverOutbox();
    expect(row()).toMatchObject({ status: "pending", attempts: 1 });
    await pump(5 * MINUTE);
    expect(row()).toMatchObject({ status: "sent", attempts: 2 });
  });
});

describe("a permanent refusal fails at once", () => {
  it("an invalid recipient is tried once, fails, and alerts", async () => {
    await enqueue();
    provider.state.behaviour = () => "invalid_recipient";
    const summary = await deliverOutbox();
    expect(summary).toMatchObject({ examined: 1, sent: 0, exhausted: 1 });
    expect(row()).toMatchObject({ status: "failed", attempts: 1, lastError: "Resend rejected email: Invalid `to` field" });
    await pump(48 * HOUR, 10 * MINUTE);
    expect(callsTo()).toHaveLength(1);
    const { failed, alert } = await monitor();
    expect(failed).toEqual({ failed: 1, newlyAlerted: 1 });
    expect(alert).toHaveBeenCalledOnce();
  });

  it("a permanent refusal of a re-send leaves the row unknown, ends re-sending, and alerts", async () => {
    await enqueue();
    provider.state.behaviour = ({ number }) => number === 1 ? "error_500" : "invalid_recipient";
    await pump(HOUR);
    expect(callsTo()).toHaveLength(2);
    expect(row()).toMatchObject({ status: "unknown", attempts: 2, deliveryRetryEnded: "provider_refused" });
    expect(row().lastError).toMatch(/^delivery_outcome_unknown_provider_refused: Resend rejected email/);
    await pump(48 * HOUR, 10 * MINUTE);
    expect(callsTo()).toHaveLength(2);
    expect((await monitor()).unknown.newlyAlerted).toBe(1);
  });
});

describe("one row's failure does not stop the rows after it", () => {
  it("delivers the next row in the same pass when a row's check before dispatch throws", async () => {
    await enqueue("a"); await enqueue("b");
    authority.mockImplementation(async entry => {
      if (entry.idempotencyKey === key("a")) throw new Error("website_preparation_status_unavailable");
      return "current";
    });
    const summary = await deliverOutbox();
    expect(summary).toMatchObject({ examined: 2, sent: 1, failed: 1 });
    expect(row("b")).toMatchObject({ status: "sent", attempts: 1 });
    expect(row("a")).toMatchObject({ status: "pending", attempts: 0, deliveryDeferrals: 1, lastError: "delivery_check_unavailable" });
    expect(row("a").nextAttemptAtMs).toBe(Date.now() + retryDelayMs(1));
    expect(callsTo("a")).toHaveLength(0);
  });

  it("defers a row whose check cannot be read with a growing backoff, then delivers it", async () => {
    await enqueue();
    const reachableAt = START + 3 * HOUR;
    const checkedAt: number[] = [];
    authority.mockImplementation(async () => {
      checkedAt.push(Date.now());
      if (Date.now() < reachableAt) throw new Error("website_preparation_status_unavailable");
      return "current";
    });
    await pump(4 * HOUR);
    const gaps = checkedAt.slice(1).map((at, index) => Math.round((at - checkedAt[index]) / MINUTE));
    expect(gaps.slice(0, 6)).toEqual([1, 2, 4, 8, 16, 32]);
    expect(row()).toMatchObject({ status: "sent", attempts: 1 });
    expect(deliveredTo()).toHaveLength(1);
  });

  it("fails and alerts a row whose check has been unreadable for longer than the bound, instead of cycling", async () => {
    await enqueue();
    authority.mockRejectedValue(new Error("website_preparation_status_unavailable"));
    await pump(40 * HOUR, 5 * MINUTE);
    expect(row()).toMatchObject({ status: "failed", attempts: 0 });
    expect(row().lastError).toBe("delivery_retry_age_exceeded: delivery_check_unavailable");
    expect(provider.state.calls).toHaveLength(0);
    expect((await monitor()).failed).toEqual({ failed: 1, newlyAlerted: 1 });
  });

  it("delivers the next row when a row's send throws or its receipt cannot be written", async () => {
    await enqueue("a"); await enqueue("b"); await enqueue("c");
    provider.state.behaviour = ({ to }) => to === "a@site.example" ? "throw" : "accept";
    const original = db.runTransaction.bind(db);
    vi.spyOn(db, "runTransaction").mockImplementation(async (callback: any) => original(async (tx: any) => callback({
      ...tx, set: (ref: any, data: any, options: any) => {
        if (ref.path === `captureOutbox/${key("b")}` && data.status === "sent") throw new Error("receipt write unavailable");
        return tx.set(ref, data, options);
      },
    })));
    await expect(deliverOutbox()).resolves.toMatchObject({ examined: 3, sent: 1 });
    expect(row("a")).toMatchObject({ status: "unknown", attempts: 1 });
    expect(row("b")).toMatchObject({ status: "dispatching", attempts: 1 });
    expect(row("c")).toMatchObject({ status: "sent", attempts: 1 });
  });

  it("reaches a due row behind a full page of rows that are waiting out a backoff", async () => {
    for (const name of ["a", "b", "c"]) await enqueue(name);
    provider.state.behaviour = ({ to }) => ["a@site.example", "b@site.example"].includes(to) ? "rate_limited" : "accept";
    await deliverOutbox({ limit: 3 });
    expect(row("c").status).toBe("sent");
    await enqueue("d");
    // The first page of two is a and b, both waiting.
    await deliverOutbox({ limit: 2 }); await deliverOutbox({ limit: 2 }); await deliverOutbox({ limit: 2 });
    expect(row("d")).toMatchObject({ status: "sent", attempts: 1 });
    expect(callsTo("a")).toHaveLength(1);
  });
});

describe("consent withdrawal still stops the email at dispatch", () => {
  it("cancels a pending result email of a withdrawn job without sending it", async () => {
    await enqueue();
    store.docs.get("inboundRequests/req-a")!.consent_revoked = true;
    await pump(HOUR);
    expect(provider.state.calls).toHaveLength(0);
    expect(row()).toMatchObject({ status: "cancelled", attempts: 0 });
  });

  it("cancels a row that was backing off when the job was withdrawn", async () => {
    await enqueue();
    provider.state.behaviour = () => "rate_limited";
    await deliverOutbox();
    store.docs.get("inboundRequests/req-a")!.consent_revoked = true;
    provider.state.behaviour = () => "accept";
    await pump(HOUR);
    expect(callsTo()).toHaveLength(1);
    expect(deliveredTo()).toHaveLength(0);
    expect(row()).toMatchObject({ status: "cancelled", attempts: 1 });
  });

  it("does not re-send an unknown outcome after withdrawal, and does not recast it as cancelled", async () => {
    await enqueue();
    provider.state.behaviour = ({ number }) => number === 1 ? "error_500" : "accept";
    await deliverOutbox();
    store.docs.get("inboundRequests/req-a")!.consent_revoked = true;
    await pump(30 * HOUR, 5 * MINUTE);
    expect(callsTo()).toHaveLength(1);
    expect(deliveredTo()).toHaveLength(0);
    expect(row()).toMatchObject({ status: "unknown", attempts: 1, deliveryRetryEnded: "notice_not_current",
      lastError: "delivery_outcome_unknown_notice_not_current" });
  });
});
