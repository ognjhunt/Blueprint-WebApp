// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ fatal: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }));
vi.mock("../logger", () => ({ logger }));
vi.mock("../utils/slack", () => ({ sendSlackMessage: vi.fn(async () => ({ sent: true })) }));

import {
  __resetOpsProcessAlertsForTests,
  createRateLimitedAlerter,
  createServerErrorRateMonitor,
  installProcessErrorHandlers,
} from "../utils/opsProcessAlerts";

afterEach(() => {
  __resetOpsProcessAlertsForTests();
  vi.restoreAllMocks();
  Object.values(logger).forEach((fn) => fn.mockReset());
});

describe("rate-limited ops alerter", () => {
  it("sends once per key per window and reports what was suppressed", async () => {
    let now = 0;
    const send = vi.fn(async () => ({ sent: true }));
    const alert = createRateLimitedAlerter({ minIntervalMs: 1000, now: () => now, send });
    await alert("k", "first");
    await alert("k", "second");
    await alert("other", "independent");
    now = 1500;
    await alert("k", "third");
    expect(send.mock.calls.map(([text]) => text)).toEqual([
      "first",
      "independent",
      "third\n- (1 similar alert(s) suppressed in the previous window)",
    ]);
  });

  it("logs at error when the alert channel itself is down", async () => {
    const alert = createRateLimitedAlerter({ send: async () => ({ sent: false }) });
    await alert("k", "x");
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "ops_alert_undelivered" }), expect.any(String));
  });
});

describe("5xx error-rate monitor", () => {
  it("alerts when 5xx in the window reach the threshold and ratio, not before", () => {
    let now = 0;
    const alert = vi.fn(async () => undefined);
    const monitor = createServerErrorRateMonitor({ windowMs: 60_000, threshold: 3, minRatio: 0.1, now: () => now, alert });
    for (let i = 0; i < 5; i += 1) monitor.record(200);
    expect(monitor.record(500, "/api/a")).toBe(false);
    expect(monitor.record(502, "/api/b")).toBe(false);
    expect(monitor.record(503, "/api/c")).toBe(true);
    expect(alert).toHaveBeenCalledWith("server_5xx_rate", expect.stringContaining("3 server errors"));
    now = 120_000;
    expect(monitor.record(500)).toBe(false);
    expect(monitor.snapshot().errors).toBe(1);
  });

  it("ignores a handful of errors buried in heavy healthy traffic", () => {
    const alert = vi.fn(async () => undefined);
    const monitor = createServerErrorRateMonitor({ windowMs: 60_000, threshold: 2, minRatio: 0.5, now: () => 1, alert });
    for (let i = 0; i < 100; i += 1) monitor.record(200);
    monitor.record(500);
    monitor.record(500);
    expect(alert).not.toHaveBeenCalled();
  });
});

describe("process error handlers", () => {
  function captureHandlers() {
    const handlers: Record<string, (...args: unknown[]) => void> = {};
    vi.spyOn(process, "on").mockImplementation(((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
      return process;
    }) as never);
    return handlers;
  }

  it("logs fatal and alerts on an unhandled rejection without exiting", async () => {
    const handlers = captureHandlers();
    const alert = vi.fn(async () => undefined);
    const exit = vi.fn();
    expect(installProcessErrorHandlers({ processName: "web", alert, exit })).toBe(true);
    expect(installProcessErrorHandlers({ processName: "web", alert, exit })).toBe(false);
    handlers.unhandledRejection(new Error("stray promise"));
    await Promise.resolve();
    expect(logger.fatal).toHaveBeenCalledWith(expect.objectContaining({ event: "unhandled_rejection" }), expect.any(String));
    expect(alert).toHaveBeenCalledWith("unhandled_rejection:web", expect.stringContaining("stray promise"));
    expect(exit).not.toHaveBeenCalled();
  });

  it("logs fatal, alerts, then exits non-zero on an uncaught exception", async () => {
    const handlers = captureHandlers();
    const alert = vi.fn(async () => undefined);
    const exit = vi.fn();
    installProcessErrorHandlers({ processName: "worker", alert, exit, exitDelayMs: 50 });
    handlers.uncaughtException(new Error("boom"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(logger.fatal).toHaveBeenCalledWith(expect.objectContaining({ event: "uncaught_exception" }), expect.any(String));
    expect(alert).toHaveBeenCalledWith("uncaught_exception:worker", expect.stringContaining("boom"));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("still exits when the alert hangs", async () => {
    const handlers = captureHandlers();
    const exit = vi.fn();
    installProcessErrorHandlers({ processName: "web", alert: () => new Promise(() => undefined), exit, exitDelayMs: 20 });
    handlers.uncaughtException(new Error("boom"));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(exit).toHaveBeenCalledWith(1);
  });
});
