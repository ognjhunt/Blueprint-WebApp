// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runWaitlistAutomationLoop = vi.hoisted(() => vi.fn());
const runInboundQualificationLoop = vi.hoisted(() => vi.fn());
const runSupportTriageLoop = vi.hoisted(() => vi.fn());
const runPreviewDiagnosisLoop = vi.hoisted(() => vi.fn());
const runGapClosureLoop = vi.hoisted(() => vi.fn());
const runHumanReplyEmailWatcher = vi.hoisted(() => vi.fn());
const runOperatingGraphProjectionLoop = vi.hoisted(() => vi.fn());
const deliverOutbox = vi.hoisted(() =>
  vi.fn(async () => ({ examined: 0, sent: 0, failed: 0, exhausted: 0 })),
);
const sendSlackMessage = vi.hoisted(() => vi.fn());
const tickBrowserCaptureProcessing = vi.hoisted(() => vi.fn());
const workerStatusSetMock = vi.hoisted(() => vi.fn());
const workerFailureAlertState = vi.hoisted(() => new Map<string, string>());
const maybeAlertOnWorkerStatusTransition = vi.hoisted(() =>
  vi.fn(async (params: {
    workerKey: string;
    previousStatus: string | null;
    nextStatus: string;
    intervalMs: number;
    batchSize: number;
    runNumber: number;
    processedCount?: number | null;
    failedCount?: number | null;
    error?: string | null;
  }) => {
    const humanizedWorkerKey = params.workerKey.replace(/_/g, " ");

    if (params.nextStatus === "failed" && params.previousStatus !== "failed") {
      workerFailureAlertState.set(params.workerKey, "failed");
      await sendSlackMessage(
        [
          `:rotating_light: Blueprint worker failure: ${humanizedWorkerKey}`,
          `- Run: #${params.runNumber}`,
          `- Interval: ${params.intervalMs} ms`,
          `- Batch: ${params.batchSize}`,
          params.error ? `- Error: ${params.error}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      return;
    }

    if (
      params.previousStatus === "failed" &&
      params.nextStatus !== "failed" &&
      workerFailureAlertState.get(params.workerKey) === "failed"
    ) {
      workerFailureAlertState.set(params.workerKey, "recovered");
      await sendSlackMessage(
        [
          `:white_check_mark: Blueprint worker recovered: ${humanizedWorkerKey}`,
          `- Run: #${params.runNumber}`,
          params.processedCount !== undefined && params.processedCount !== null
            ? `- Processed: ${params.processedCount}`
            : null,
          params.failedCount !== undefined && params.failedCount !== null
            ? `- Failed: ${params.failedCount}`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    }
  }),
);

vi.mock("../utils/ops-alerts", () => ({
  maybeAlertOnWorkerStatusTransition,
}));

vi.mock("../utils/captureOutbox", () => ({
  deliverOutbox,
}));

vi.mock("../utils/browserCaptureRecovery", () => ({
  tickBrowserCaptureProcessing,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  authAdmin: null,
  dbAdmin: {
    collection: vi.fn((collectionName: string) => ({
      doc: vi.fn((docId: string) => ({
        set: (payload: Record<string, unknown>, options: Record<string, unknown>) =>
          workerStatusSetMock(collectionName, docId, payload, options),
      })),
    })),
  },
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => ({ mocked: true }),
      },
    },
  },
}));

vi.mock("../agents", () => ({
  runWaitlistAutomationLoop,
  runInboundQualificationLoop,
  runSupportTriageLoop,
  runPreviewDiagnosisLoop,
}));

vi.mock("../utils/gap-closure", () => ({
  runGapClosureLoop,
}));

vi.mock("../utils/human-reply-worker", () => ({
  runHumanReplyEmailWatcher,
}));

vi.mock("../utils/operatingGraphEvidenceProjectors", () => ({
  runOperatingGraphProjectionLoop,
}));

vi.mock("../utils/slack", () => ({
  sendSlackMessage,
}));

beforeEach(() => {
  vi.useFakeTimers();
  workerStatusSetMock.mockReset();
  workerFailureAlertState.clear();
  deliverOutbox.mockClear();
  tickBrowserCaptureProcessing.mockClear();
  runWaitlistAutomationLoop.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  runInboundQualificationLoop.mockResolvedValue({ processedCount: 2, failedCount: 0 });
  runSupportTriageLoop.mockResolvedValue({ processedCount: 3, failedCount: 0 });
  runPreviewDiagnosisLoop.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  runGapClosureLoop.mockResolvedValue({
    processedCount: 1,
    failedCount: 0,
    activeFindingCount: 0,
  });
  runHumanReplyEmailWatcher.mockResolvedValue({
    processedCount: 0,
    failedCount: 0,
    blockedCount: 0,
    reason: null,
  });
  runOperatingGraphProjectionLoop.mockResolvedValue({
    processedCount: 2,
    failedCount: 0,
  });
  sendSlackMessage.mockResolvedValue({ sent: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("ops automation scheduler", () => {
  it("starts enabled workers and triggers their loops", async () => {
    vi.stubEnv("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_INBOUND_AUTOMATION_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_CAPTURER_REMINDER_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_SUPPORT_TRIAGE_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_PAYOUT_TRIAGE_ENABLED", "0");

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(runInboundQualificationLoop).toHaveBeenCalled();
    expect(runSupportTriageLoop).toHaveBeenCalled();
    // The capturer and field-ops lanes are retired and deleted (2026-11-11):
    // their flags are set above and start nothing.
    expect(runWaitlistAutomationLoop).not.toHaveBeenCalled();

    stop();
  });

  it("runs gap closure when enabled", async () => {
    vi.stubEnv("BLUEPRINT_GAP_CLOSURE_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_GAP_CLOSURE_STARTUP_DELAY_MS", "0");

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(runGapClosureLoop).toHaveBeenCalledWith({ limit: 100 });

    stop();
  });

  it("runs the human reply gmail watcher when enabled", async () => {
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_STARTUP_DELAY_MS", "0");

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(runHumanReplyEmailWatcher).toHaveBeenCalledWith({ limit: 25 });

    stop();
  });

  it("persists blocked worker metadata when the human reply watcher fails closed", async () => {
    const reason =
      "Gmail OAuth refresh token was rejected with invalid_grant. Rotate BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN.";
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_STARTUP_DELAY_MS", "0");
    runHumanReplyEmailWatcher.mockResolvedValueOnce({
      processedCount: 0,
      failedCount: 0,
      blockedCount: 0,
      reason,
    });

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(60_000);

    const blockedStatusCall = workerStatusSetMock.mock.calls.find(
      ([collectionName, docId, payload]) =>
        collectionName === "opsAutomationWorkerStatus"
        && docId === "human_reply_email"
        && payload?.status === "blocked",
    );
    expect(blockedStatusCall).toBeTruthy();
    expect(blockedStatusCall?.[2]).toEqual(
      expect.objectContaining({
        status: "blocked",
        last_processed_count: 0,
        last_failed_count: 0,
        last_blocked_count: 0,
        last_result_reason: reason,
        last_error: null,
      }),
    );
    expect(maybeAlertOnWorkerStatusTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        workerKey: "human_reply_email",
        nextStatus: "blocked",
        failedCount: 0,
      }),
    );

    stop();
  });

  it("runs the operating graph projection worker when enabled", async () => {
    vi.stubEnv("BLUEPRINT_OPERATING_GRAPH_PROJECTION_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_OPERATING_GRAPH_PROJECTION_STARTUP_DELAY_MS", "0");

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(runOperatingGraphProjectionLoop).toHaveBeenCalledWith({ limit: 500 });

    stop();
  });

  it("alerts when a worker fails and again when it recovers", async () => {
    vi.stubEnv("BLUEPRINT_GAP_CLOSURE_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_GAP_CLOSURE_STARTUP_DELAY_MS", "0");
    vi.stubEnv("BLUEPRINT_GAP_CLOSURE_INTERVAL_MS", "30000");
    // The capture-outbox lane is on by default and would add its own status
    // transitions to the alert count; this test is about the worker it drives
    // into failure, so the unrelated lane stays out of the assertion.
    vi.stubEnv("BLUEPRINT_CAPTURE_OUTBOX_ENABLED", "0");

    runGapClosureLoop
      .mockRejectedValueOnce(new Error("Gap registry unavailable"))
      .mockResolvedValueOnce({ processedCount: 1, failedCount: 0, activeFindingCount: 0 });

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(31_000);
    await vi.advanceTimersByTimeAsync(31_000);

    expect(sendSlackMessage).toHaveBeenCalledTimes(2);
    expect(sendSlackMessage.mock.calls[0]?.[0]).toContain("Blueprint worker failure");
    expect(sendSlackMessage.mock.calls[1]?.[0]).toContain("Blueprint worker recovered");

    stop();
  });

  it("runs the capture outbox by default, without the global automation flag", async () => {
    // Delivery of queued operator emails is not an optimisation: the
    // request-path opportunist pass misses a site that never re-opens the
    // link, so the lane is on even where every other lane needs a flag.
    vi.stubEnv("BLUEPRINT_CAPTURE_OUTBOX_STARTUP_DELAY_MS", "0");
    expect(process.env.BLUEPRINT_ALL_AUTOMATION_ENABLED).toBeUndefined();

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(31_000);

    expect(deliverOutbox).toHaveBeenCalled();
    expect(tickBrowserCaptureProcessing).toHaveBeenCalledTimes(1);

    stop();
  });

  it("still lets an explicit opt-out disable the capture outbox", async () => {
    vi.stubEnv("BLUEPRINT_CAPTURE_OUTBOX_ENABLED", "0");
    vi.stubEnv("BLUEPRINT_CAPTURE_OUTBOX_STARTUP_DELAY_MS", "0");

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(31_000);

    expect(deliverOutbox).not.toHaveBeenCalled();
    expect(tickBrowserCaptureProcessing).not.toHaveBeenCalled();

    stop();
  });
});
