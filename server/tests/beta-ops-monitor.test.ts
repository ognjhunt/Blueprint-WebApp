// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null, authAdmin: null, default: {} }));
vi.mock("../utils/slack", () => ({ sendSlackMessage: vi.fn(async () => ({ sent: true })) }));
vi.mock("../utils/email", () => ({ sendEmail: vi.fn(async () => ({ sent: true })) }));

import { __resetBetaOpsMonitorForTests, scanTerminalOutboxFailures, startBetaOpsMonitor } from "../utils/betaOpsMonitor";

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
