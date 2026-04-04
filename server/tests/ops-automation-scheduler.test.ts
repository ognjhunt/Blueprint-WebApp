// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runWaitlistAutomationLoop = vi.hoisted(() => vi.fn());
const runInboundQualificationLoop = vi.hoisted(() => vi.fn());
const runIntakeStaleScanLoop = vi.hoisted(() => vi.fn());
const runSupportTriageLoop = vi.hoisted(() => vi.fn());
const runPayoutExceptionTriageLoop = vi.hoisted(() => vi.fn());
const runPreviewDiagnosisLoop = vi.hoisted(() => vi.fn());

vi.mock("../agents", () => ({
  runWaitlistAutomationLoop,
  runInboundQualificationLoop,
  runIntakeStaleScanLoop,
  runSupportTriageLoop,
  runPayoutExceptionTriageLoop,
  runPreviewDiagnosisLoop,
}));

beforeEach(() => {
  vi.useFakeTimers();
  runWaitlistAutomationLoop.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  runInboundQualificationLoop.mockResolvedValue({ processedCount: 2, failedCount: 0 });
  runIntakeStaleScanLoop.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  runSupportTriageLoop.mockResolvedValue({ processedCount: 3, failedCount: 0 });
  runPayoutExceptionTriageLoop.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  runPreviewDiagnosisLoop.mockResolvedValue({ processedCount: 1, failedCount: 0 });
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
    vi.stubEnv("BLUEPRINT_SUPPORT_TRIAGE_ENABLED", "1");

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(runWaitlistAutomationLoop).toHaveBeenCalled();
    expect(runInboundQualificationLoop).toHaveBeenCalled();
    expect(runIntakeStaleScanLoop).toHaveBeenCalledWith({ limit: 25, ageHours: 24 });
    expect(runSupportTriageLoop).toHaveBeenCalled();
    expect(runPayoutExceptionTriageLoop).not.toHaveBeenCalled();

    stop();
  });
});
