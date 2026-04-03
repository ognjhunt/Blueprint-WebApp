// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runWaitlistAutomationLoop = vi.hoisted(() => vi.fn());
const runInboundQualificationLoop = vi.hoisted(() => vi.fn());
const runSupportTriageLoop = vi.hoisted(() => vi.fn());
const runPayoutExceptionTriageLoop = vi.hoisted(() => vi.fn());
const runPreviewDiagnosisLoop = vi.hoisted(() => vi.fn());
const runCapturerReminderLoop = vi.hoisted(() => vi.fn());
const flagOverdueSiteAccessReviews = vi.hoisted(() => vi.fn());
const flagOverdueFinanceReviews = vi.hoisted(() => vi.fn());
const runBuyerLifecycleCheck = vi.hoisted(() => vi.fn());
const runExperimentAutorollout = vi.hoisted(() => vi.fn());
const runAutonomousResearchOutboundLoop = vi.hoisted(() => vi.fn());
const runCreativeAssetFactoryLoop = vi.hoisted(() => vi.fn());
const sendSlackMessage = vi.hoisted(() => vi.fn());

vi.mock("../agents", () => ({
  runWaitlistAutomationLoop,
  runInboundQualificationLoop,
  runSupportTriageLoop,
  runPayoutExceptionTriageLoop,
  runPreviewDiagnosisLoop,
}));

vi.mock("../utils/field-ops-automation", () => ({
  runCapturerReminderLoop,
  flagOverdueSiteAccessReviews,
  flagOverdueFinanceReviews,
}));

vi.mock("../utils/growth-ops", () => ({
  runBuyerLifecycleCheck,
}));

vi.mock("../utils/experiment-ops", () => ({
  runExperimentAutorollout,
}));

vi.mock("../utils/autonomous-growth", () => ({
  runAutonomousResearchOutboundLoop,
}));

vi.mock("../utils/creative-factory", () => ({
  runCreativeAssetFactoryLoop,
}));

vi.mock("../utils/slack", () => ({
  sendSlackMessage,
}));

beforeEach(() => {
  vi.useFakeTimers();
  runWaitlistAutomationLoop.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  runInboundQualificationLoop.mockResolvedValue({ processedCount: 2, failedCount: 0 });
  runSupportTriageLoop.mockResolvedValue({ processedCount: 3, failedCount: 0 });
  runPayoutExceptionTriageLoop.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  runPreviewDiagnosisLoop.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  runCapturerReminderLoop.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  flagOverdueSiteAccessReviews.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  flagOverdueFinanceReviews.mockResolvedValue({ processedCount: 1, failedCount: 0 });
  runBuyerLifecycleCheck.mockResolvedValue({ count: 2, results: [] });
  runExperimentAutorollout.mockResolvedValue({ count: 1, evaluations: [] });
  runAutonomousResearchOutboundLoop.mockResolvedValue({ count: 1, results: [] });
  runCreativeAssetFactoryLoop.mockResolvedValue({ status: "assets_generated" });
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
    vi.stubEnv("BLUEPRINT_SUPPORT_TRIAGE_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_EXPERIMENT_AUTOROLLOUT_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_EXPERIMENT_AUTOROLLOUT_STARTUP_DELAY_MS", "0");
    vi.stubEnv("BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_AUTONOMOUS_RESEARCH_OUTBOUND_STARTUP_DELAY_MS", "0");
    vi.stubEnv("BLUEPRINT_CREATIVE_FACTORY_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_CREATIVE_FACTORY_STARTUP_DELAY_MS", "0");
    vi.stubEnv("BLUEPRINT_BUYER_LIFECYCLE_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_BUYER_LIFECYCLE_STARTUP_DELAY_MS", "0");
    vi.stubEnv("BLUEPRINT_SITE_ACCESS_OVERDUE_WATCHDOG_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_FINANCE_REVIEW_OVERDUE_WATCHDOG_ENABLED", "1");

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(runWaitlistAutomationLoop).toHaveBeenCalled();
    expect(runInboundQualificationLoop).toHaveBeenCalled();
    expect(runSupportTriageLoop).toHaveBeenCalled();
    expect(runExperimentAutorollout).toHaveBeenCalledWith({
      limit: 5000,
      lookbackDays: 30,
      minExposuresPerVariant: 50,
      minRelativeLift: 0.1,
    });
    expect(runAutonomousResearchOutboundLoop).toHaveBeenCalled();
    expect(runCreativeAssetFactoryLoop).toHaveBeenCalled();
    expect(runBuyerLifecycleCheck).toHaveBeenCalledWith({
      daysSinceGrant: 30,
      limit: 25,
    });
    expect(flagOverdueSiteAccessReviews).toHaveBeenCalledWith({ limit: 50 });
    expect(flagOverdueFinanceReviews).toHaveBeenCalledWith({ limit: 50 });
    expect(runPayoutExceptionTriageLoop).not.toHaveBeenCalled();

    stop();
  });

  it("alerts when a worker fails and again when it recovers", async () => {
    vi.stubEnv("BLUEPRINT_CREATIVE_FACTORY_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_CREATIVE_FACTORY_STARTUP_DELAY_MS", "0");
    vi.stubEnv("BLUEPRINT_CREATIVE_FACTORY_INTERVAL_MS", "30000");

    runCreativeAssetFactoryLoop
      .mockRejectedValueOnce(new Error("Runway unavailable"))
      .mockResolvedValueOnce({ status: "assets_generated" });

    const { startOpsAutomationScheduler } = await import("../utils/opsAutomationScheduler");
    const stop = startOpsAutomationScheduler();

    await vi.advanceTimersByTimeAsync(31_000);
    await vi.advanceTimersByTimeAsync(31_000);

    expect(sendSlackMessage).toHaveBeenCalledTimes(2);
    expect(sendSlackMessage.mock.calls[0]?.[0]).toContain("Blueprint worker failure");
    expect(sendSlackMessage.mock.calls[1]?.[0]).toContain("Blueprint worker recovered");

    stop();
  });
});
