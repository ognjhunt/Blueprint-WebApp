// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, default: {} }));
vi.mock("../utils/slack", () => ({ sendSlackMessage: vi.fn(async () => ({ sent: true })) }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true })) }));
const deadlineSweep = vi.hoisted(() => vi.fn(async () => ({ examined: 0, ended: 0, noticesOwed: 0, failed: 0 })));
vi.mock("../utils/websiteJobDeadlineSweep", () => ({ sweepWebsiteJobDeadlines: deadlineSweep }));
const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock("../logger", () => ({ logger: log }));
// The pass's other steps, reduced to no-ops so the pass itself is what is under test.
vi.mock("../utils/intakeOpsNotice", async importOriginal => ({
  ...await importOriginal<typeof import("../utils/intakeOpsNotice")>(), sweepIntakeOpsNotices: vi.fn(async () => undefined) }));
vi.mock("../utils/launch-readiness", () => ({ buildLaunchReadinessSnapshot: vi.fn(() => ({})) }));
vi.mock("../utils/ops-alerts", () => ({ maybeAlertOnLaunchReadinessTransition: vi.fn(async () => undefined) }));
vi.mock("../utils/websitePreparationOpsAlerts", () => ({ backfillWebsitePreparationWatches: vi.fn(async () => 0),
  scanWebsitePreparationWatch: vi.fn(async () => 0), scanEndedWebsiteSceneIntakes: vi.fn(async () => 0),
  scanHeldOwnerSuccessThresholds: vi.fn(async () => 0), scanHeldWebsiteEvaluations: vi.fn(async () => 0) }));

import {
  __resetBetaOpsMonitorForTests,
  checkWorkerHeartbeat,
  runBetaOpsMonitorPass,
  scanOutboxBacklog,
  scanTerminalOutboxFailures,
  scanUnknownOutboxOutcomes,
  startBetaOpsMonitor,
} from "../utils/betaOpsMonitor";
import { readOutboxStall } from "../utils/captureOutboxHealth";

function outboxStore(entries: Array<{ id: string; data: Record<string, unknown> }>) {
  const markers = new Map<string, Record<string, unknown>>();
  const reads = { query: 0 };
  return {
    markers,
    reads,
    collection: (name: string) => ({
      where: (_field: string, _op: string, value: unknown) => ({
        limit: (n: number) => ({
          get: async () => {
            reads.query += 1;
            return { docs: entries.filter((entry) => entry.data.status === value).slice(0, n).map((entry) => ({ id: entry.id, data: () => entry.data })) };
          },
        }),
      }),
      doc: (id: string) => ({
        get: async () => ({ exists: name === "opsOutboxFailureAlerts" && markers.has(id) }),
        create: async (data: Record<string, unknown>) => {
          if (markers.has(id)) throw Object.assign(new Error("exists"), { code: 6 });
          markers.set(id, data);
        },
      }),
    }),
  };
}

afterEach(() => {
  __resetBetaOpsMonitorForTests();
  vi.useRealTimers();
});

describe("terminal outbox failure scan", () => {
  it("alerts once per failed entry, link-only, and never writes the outbox", async () => {
    const entries = [
      { id: "req-1:task_received", data: { status: "failed", requestId: "req-1", kind: "task_received", to: "site@example.com", body: "secret body", lastError: "Resend rejected email" } },
      { id: "req-2:result", data: { status: "sent", requestId: "req-2", kind: "result", to: "x@example.com" } },
    ];
    const store = outboxStore(entries);
    const alert = vi.fn(async () => undefined);
    const email = vi.fn(async () => ({ sent: true }));
    const first = await scanTerminalOutboxFailures({ store: store as never, alert, email: email as never });
    expect(first).toEqual({ failed: 1, newlyAlerted: 1 });
    const text = String(alert.mock.calls[0][1]);
    expect(text).toContain("req-1");
    expect(text).toContain("/admin/leads/req-1");
    expect(text).not.toContain("site@example.com");
    expect(text).not.toContain("secret body");
    expect(JSON.stringify(email.mock.calls)).not.toContain("site@example.com");
    expect(store.markers.has("req-1:task_received")).toBe(true);

    const second = await scanTerminalOutboxFailures({ store: store as never, alert, email: email as never });
    expect(second.newlyAlerted).toBe(0);
    expect(alert).toHaveBeenCalledTimes(1);

    // A fresh process (empty cache) still does not re-alert: the marker is durable.
    __resetBetaOpsMonitorForTests();
    const third = await scanTerminalOutboxFailures({ store: store as never, alert, email: email as never });
    expect(third.newlyAlerted).toBe(0);
    expect(alert).toHaveBeenCalledTimes(1);
  });

  it("is a no-op without Firestore", async () => {
    await expect(scanTerminalOutboxFailures({ store: null })).resolves.toEqual({ failed: 0, newlyAlerted: 0 });
  });

  it("identifies the exact account-notice intent and receipts without a nonexistent lead link", async () => {
    const entry = { idempotencyKey: "account_notice:synthetic-notice-v1:recipient-digest", requestId: "account-notice:synthetic-notice-v1",
      kind: "account_notice", to: "account@example.invalid", subject: "Synthetic account update", body: "Private synthetic copy" };
    const store = outboxStore([{ id: entry.idempotencyKey, data: { ...entry, status: "failed", lastError: "delivery_attempt_budget_exhausted" } }]);
    const alert = vi.fn(async () => undefined);
    const email = vi.fn(async () => ({ sent: true }));
    await scanTerminalOutboxFailures({ store: store as never, alert, email: email as never });
    for (const text of [String(alert.mock.calls[0][1]), email.mock.calls[0][0].text]) {
      expect(text).toContain(`Firestore: captureOutbox/${entry.idempotencyKey} (inspect deliveryReceipts)`);
      expect(text).not.toContain("/admin/leads/");
      expect(text).not.toContain(entry.to);
      expect(text).not.toContain(entry.body);
    }
    await scanTerminalOutboxFailures({ store: store as never, alert, email: email as never });
    expect(alert).toHaveBeenCalledOnce();
    expect(email).toHaveBeenCalledOnce();
    expect(store.markers.get(entry.idempotencyKey)).toMatchObject({ outbox_key: entry.idempotencyKey, request_id: entry.requestId });
  });
});

describe("outbox delivery visibility", () => {
  const minutes = (n: number) => n * 60_000;
  const hours = (n: number) => n * 60 * 60_000;
  const now = Date.parse("2026-11-10T12:00:00Z");
  const ago = (ms: number) => new Date(now - ms).toISOString();
  const entries = () => [
    { id: "req-1:task_received", data: { status: "pending", createdAtIso: ago(minutes(5)), to: "one@site.example" } },
    // Refused by the provider and waiting out its backoff: still owed a delivery.
    { id: "req-2:results_ready", data: { status: "pending", attempts: 5, nextAttemptAtMs: now + minutes(20), createdAtIso: ago(minutes(50)) } },
    // Unknown outcome, being sent again with its provider key inside the window.
    { id: "req-3:results_ready", data: { status: "unknown", attempts: 2, deliveryKeyAttempt: 2, deliveryKeyFirstUsedAtMs: now - hours(2),
      nextAttemptAtMs: now + minutes(1), createdAtIso: ago(hours(2)), requestId: "req-3", kind: "results_ready", to: "three@site.example", lastError: "delivery_outcome_unknown" } },
    // Unknown since before provider keys existed: never sent again.
    { id: "req-4:results_ready", data: { status: "unknown", attempts: 1, createdAtIso: ago(hours(120)), requestId: "req-4", kind: "results_ready",
      to: "four@site.example", body: "private body", lastError: "delivery_outcome_unknown" } },
    // Unknown, and its idempotency window has closed.
    { id: "req-5:scene_outcome", data: { status: "unknown", attempts: 9, deliveryKeyAttempt: 9, deliveryKeyFirstUsedAtMs: now - hours(40),
      deliveryRetryEnded: "window_closed", createdAtIso: ago(hours(40)), requestId: "req-5", kind: "scene_outcome", lastError: "delivery_outcome_unknown_window_closed" } },
    { id: "req-6:task_received", data: { status: "failed", createdAtIso: ago(hours(60)), requestId: "req-6", kind: "task_received", lastError: "Resend rejected email: Invalid `to` field" } },
    { id: "req-7:task_received", data: { status: "sent", createdAtIso: ago(hours(90)) } },
  ];

  it("reports unknown and failed counts and the oldest undelivered age, and alerts past the threshold", async () => {
    const store = outboxStore(entries());
    const alert = vi.fn(async (_key: string, _text: string) => undefined);
    const email = vi.fn(async () => ({ sent: true }));
    const deps = { store: store as never, alert, email: email as never, now: () => now };

    const backlog = await scanOutboxBacklog({ ...deps, maxPending: 50, maxAgeMs: minutes(30) });
    expect(backlog).toEqual({ pending: 2, undelivered: 3, oldestUndeliveredAgeMs: hours(2), unknownRetrying: 1, unknownNeedsPerson: 2, alerting: true });
    expect(String(alert.mock.calls[0][1])).toMatch(/3 waiting \(1 after an unknown outcome, sent again with the same provider key\), the oldest for 120 min/);

    const unknown = await scanUnknownOutboxOutcomes(deps);
    expect(unknown).toEqual({ unknown: 3, needsPerson: 2, newlyAlerted: 2 });
    const text = String(alert.mock.calls[1][1]);
    expect(text).toMatch(/2 customer email\(s\) may or may not have been sent, and will not be sent again automatically/);
    expect(text).toContain("results_ready for req-4 (delivery_outcome_unknown)");
    expect(text).toContain("scene_outcome for req-5 (delivery_outcome_unknown_window_closed)");
    expect(text).toContain("Look each one up in Resend before sending it again by hand");
    // The row still being re-sent is not reported as needing a person, and no recipient or body is.
    expect(text).not.toContain("req-3");
    expect(text).not.toMatch(/site\.example|private body/);

    expect(await scanTerminalOutboxFailures(deps)).toEqual({ failed: 1, newlyAlerted: 1 });
    // Each row is reported once, across passes and across the two scans.
    expect(await scanUnknownOutboxOutcomes(deps)).toEqual({ unknown: 3, needsPerson: 2, newlyAlerted: 0 });
    expect(await scanTerminalOutboxFailures(deps)).toEqual({ failed: 1, newlyAlerted: 0 });
    expect(alert).toHaveBeenCalledTimes(3);
  });

  it("reports a re-sent row as needing a person once its idempotency window has closed", async () => {
    const store = outboxStore(entries().filter((entry) => entry.id === "req-3:results_ready"));
    const alert = vi.fn(async () => undefined);
    const email = vi.fn(async () => ({ sent: true }));
    const scan = (at: number) => scanUnknownOutboxOutcomes({ store: store as never, alert, email: email as never, now: () => at });
    expect(await scan(now)).toEqual({ unknown: 1, needsPerson: 0, newlyAlerted: 0 });
    expect(await scan(now + hours(22))).toEqual({ unknown: 1, needsPerson: 1, newlyAlerted: 1 });
  });

  it("does not count rows that only a person can settle as a backlog", async () => {
    const settled = entries().filter((entry) => ["req-4:results_ready", "req-5:scene_outcome", "req-6:task_received", "req-7:task_received"].includes(entry.id));
    const alert = vi.fn(async () => undefined);
    const backlog = await scanOutboxBacklog({ store: outboxStore(settled) as never, alert, email: vi.fn() as never, now: () => now, maxPending: 50, maxAgeMs: minutes(30) });
    expect(backlog).toEqual({ pending: 0, undelivered: 0, oldestUndeliveredAgeMs: null, unknownRetrying: 0, unknownNeedsPerson: 2, alerting: false });
    expect(alert).not.toHaveBeenCalled();
  });

  it("answers the health endpoint from the oldest undelivered age alone", async () => {
    const store = outboxStore(entries());
    expect(await readOutboxStall({ store: store as never, now: () => now })).toEqual({ status: "stalled", oldestUndeliveredAgeMs: hours(2), stalledAfterMs: hours(2) });
    expect(await readOutboxStall({ store: store as never, now: () => now - minutes(1) })).toMatchObject({ status: "moving" });
    expect(await readOutboxStall({ store: outboxStore([]) as never, now: () => now })).toEqual({ status: "moving", oldestUndeliveredAgeMs: null, stalledAfterMs: hours(2) });
    expect(await readOutboxStall({ store: null })).toMatchObject({ status: "unavailable" });
    const broken = { collection: () => { throw new Error("firestore unavailable"); } };
    expect(await readOutboxStall({ store: broken as never })).toMatchObject({ status: "unavailable", oldestUndeliveredAgeMs: null });
  });
});

describe("ongoing conditions", () => {
  const minutes = (n: number) => n * 60_000;
  const start = Date.parse("2026-10-15T12:00:00Z");

  it("alerts once when customer email waits too long, reminds hourly on Slack only, and reports the drain", async () => {
    const pending = [{ id: "a", data: { status: "pending", createdAtIso: new Date(start - minutes(45)).toISOString() } }];
    const store = outboxStore(pending);
    const alert = vi.fn(async () => undefined);
    const email = vi.fn(async () => ({ sent: true }));
    const scan = (offset: number) => scanOutboxBacklog({ store: store as never, alert, email: email as never, now: () => start + offset, maxPending: 50, maxAgeMs: minutes(30) });

    expect(await scan(0)).toMatchObject({ pending: 1, alerting: true });
    expect(String(alert.mock.calls[0][1])).toMatch(/1 waiting, the oldest for 45 min/);
    await scan(minutes(5));
    expect(alert).toHaveBeenCalledTimes(1);
    await scan(minutes(61));
    expect(alert).toHaveBeenCalledTimes(2);
    expect(email).toHaveBeenCalledTimes(1);

    pending.length = 0;
    expect(await scan(minutes(62))).toMatchObject({ pending: 0, alerting: false });
    expect(alert).toHaveBeenLastCalledWith("capture_outbox_backlog:recovered", expect.stringMatching(/moving again/));
  });

  it("alerts when the worker heartbeat is stale or missing, and not for an unreadable store", async () => {
    const alert = vi.fn(async () => undefined);
    const email = vi.fn(async () => ({ sent: true }));
    const reading = (status: "fresh" | "stale" | "missing" | "unavailable", ageMs: number | null) =>
      async () => ({ status, ageMs, staleAfterMs: minutes(5), beatAtIso: null, revision: null });

    await checkWorkerHeartbeat({ read: reading("unavailable", null), alert, email: email as never });
    await checkWorkerHeartbeat({ read: reading("fresh", minutes(1)), alert, email: email as never });
    expect(alert).not.toHaveBeenCalled();
    await checkWorkerHeartbeat({ read: reading("stale", minutes(12)), alert, email: email as never });
    expect(String(alert.mock.calls[0][1])).toMatch(/last heartbeat was 12 min ago/);
    expect(email).toHaveBeenCalledOnce();

    __resetBetaOpsMonitorForTests();
    await checkWorkerHeartbeat({ read: reading("missing", null), alert, email: email as never });
    expect(String(alert.mock.calls[1][1])).toMatch(/no heartbeat on record/);
  });
});

describe("beta ops monitor loop", () => {
  it("runs passes only while this instance holds the leader lease, one at a time", async () => {
    vi.useFakeTimers();
    let leader = false;
    const lease = { instanceId: "i", isLeader: () => leader, tick: async () => leader, start: vi.fn(), stop: async () => undefined };
    let release: () => void = () => undefined;
    const pass = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const stop = startBetaOpsMonitor({ intervalMs: 30_000, lease, pass });
    expect(lease.start).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(pass).not.toHaveBeenCalled();
    leader = true;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(pass).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(pass).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(pass).toHaveBeenCalledTimes(2);
    stop();
  });

  it("stays off in pull request previews and when explicitly disabled", () => {
    const lease = { instanceId: "i", isLeader: () => true, tick: async () => true, start: vi.fn(), stop: async () => undefined };
    process.env.IS_PULL_REQUEST = "true";
    startBetaOpsMonitor({ lease })();
    delete process.env.IS_PULL_REQUEST;
    process.env.BLUEPRINT_BETA_OPS_MONITOR_ENABLED = "0";
    startBetaOpsMonitor({ lease })();
    delete process.env.BLUEPRINT_BETA_OPS_MONITOR_ENABLED;
    expect(lease.start).not.toHaveBeenCalled();
  });
});

describe("website job deadline sweep step", () => {
  it("runs in every monitor pass, and a failure in it is logged without stopping the other steps", async () => {
    deadlineSweep.mockRejectedValueOnce(new Error("sweep down"));
    const results = await runBetaOpsMonitorPass();
    expect(deadlineSweep).toHaveBeenCalledOnce();
    expect(results).toHaveLength(8);
    expect(results[7]).toMatchObject({ status: "rejected" });
    // The outbox failure scan in the same pass still ran (no store here, so it settles with nothing to do).
    expect(results[1]).toMatchObject({ status: "fulfilled" });
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ step: "website_job_deadline_sweep" }),
      "Beta ops monitor step failed");
  });
});
