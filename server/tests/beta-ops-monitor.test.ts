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
  startBetaOpsMonitor,
} from "../utils/betaOpsMonitor";

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
    expect(first).toEqual({ failed: 1, unknown: 0, newlyAlerted: 1 });
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
    await expect(scanTerminalOutboxFailures({ store: null })).resolves.toEqual({ failed: 0, unknown: 0, newlyAlerted: 0 });
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

  it("alerts once per email whose send outcome is unknown, says it was not resent, and leaves the row as it is", async () => {
    const nowMs = Date.parse("2026-11-10T12:00:00Z");
    const settled = { status: "unknown", requestId: "req-3", kind: "scene_outcome", to: "site@example.com", body: "secret body",
      lastError: "delivery_outcome_unknown", deliveryLeaseUntilMs: nowMs - 20 * 60_000 };
    const entries = [
      { id: "req-3:scene_outcome:x", data: settled },
      // Its lease only just ran out: a late provider receipt may still land, so it waits for a later pass.
      { id: "req-4:video_received", data: { ...settled, requestId: "req-4", deliveryLeaseUntilMs: nowMs - 60_000 } },
    ];
    const store = outboxStore(entries);
    const alert = vi.fn(async () => undefined);
    const email = vi.fn(async () => ({ sent: true }));
    const first = await scanTerminalOutboxFailures({ store: store as never, alert, email: email as never, now: () => nowMs });
    expect(first).toEqual({ failed: 0, unknown: 2, newlyAlerted: 1 });
    const text = String(alert.mock.calls[0][1]);
    expect(alert.mock.calls[0][0]).toBe("capture_outbox_unknown:req-3:scene_outcome:x");
    expect(text).toMatch(/unknown send outcome and were not resent/);
    expect(text).toContain("/admin/leads/req-3");
    expect(text).not.toContain("req-4");
    expect(`${text} ${JSON.stringify(email.mock.calls)}`).not.toMatch(/site@example\.com|secret body/);
    expect(email.mock.calls[0][0].subject).toMatch(/unknown send outcome and were not resent/);
    expect(store.markers.get("req-3:scene_outcome:x")).toMatchObject({ outbox_status: "unknown" });
    expect(entries[0].data.status).toBe("unknown");

    // Same marker collection as a failed row: a fresh process never alerts it again.
    __resetBetaOpsMonitorForTests();
    const later = await scanTerminalOutboxFailures({ store: store as never, alert, email: email as never, now: () => nowMs + 30 * 60_000 });
    expect(later.newlyAlerted).toBe(1);
    expect(String(alert.mock.calls[1][1])).toContain("req-4");
    expect(alert).toHaveBeenCalledTimes(2);
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
    expect(results).toHaveLength(7);
    expect(results[6]).toMatchObject({ status: "rejected" });
    // The outbox failure scan in the same pass still ran (no store here, so it settles with nothing to do).
    expect(results[1]).toMatchObject({ status: "fulfilled" });
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ step: "website_job_deadline_sweep" }),
      "Beta ops monitor step failed");
  });
});
