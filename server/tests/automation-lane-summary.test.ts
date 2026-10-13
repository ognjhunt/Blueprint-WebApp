// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), fatal: vi.fn() }));
vi.mock("../logger", () => ({ logger }));
vi.mock("../utils/slack", () => ({ sendSlackMessage: vi.fn(async () => ({ sent: true })) }));

import { AUTONOMOUS_LANES, announceAutonomousLanesAtBoot, describeAutonomousLanes } from "../utils/automationLaneSummary";

afterEach(() => {
  vi.unstubAllEnvs();
  Object.values(logger).forEach((fn) => fn.mockReset());
});

function clearLanes() {
  vi.stubEnv("BLUEPRINT_ALL_AUTOMATION_ENABLED", "");
  for (const lane of AUTONOMOUS_LANES) vi.stubEnv(lane.key, "");
}

describe("autonomous lane visibility", () => {
  it("lists what the all-automation switch turns on, except lanes explicitly set to 0", async () => {
    clearLanes();
    vi.stubEnv("BLUEPRINT_ALL_AUTOMATION_ENABLED", "1");
    vi.stubEnv("BLUEPRINT_PAYOUT_TRIAGE_ENABLED", "0");
    const summary = describeAutonomousLanes({ schedulerRunsHere: false });
    expect(summary.allAutomation).toBe(true);
    expect(summary.enabled).not.toContain("BLUEPRINT_PAYOUT_TRIAGE_ENABLED");
    expect(summary.enabledViaAll).toContain("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED");
    // Without the scheduler only request-path lanes actually run here.
    expect(summary.active).toEqual(["BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED"]);
    expect(summary.flaggedButIdle).toContain("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED");

    const alert = vi.fn(async () => undefined);
    const result = await announceAutonomousLanesAtBoot({ processName: "web", schedulerRunsHere: false, alert });
    expect(result.alerted).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "all_automation_enabled" }), expect.stringContaining("BLUEPRINT_ALL_AUTOMATION_ENABLED is on"));
    expect(alert).toHaveBeenCalledWith("autonomous_lanes_boot:web", expect.stringContaining("BLUEPRINT_ALL_AUTOMATION_ENABLED is ON"));
  });

  it("reports scheduler lanes as active only where the scheduler runs", () => {
    clearLanes();
    vi.stubEnv("BLUEPRINT_SUPPORT_TRIAGE_ENABLED", "1");
    expect(describeAutonomousLanes({ schedulerRunsHere: true }).active).toEqual(["BLUEPRINT_SUPPORT_TRIAGE_ENABLED"]);
    expect(describeAutonomousLanes({ schedulerRunsHere: false }).active).toEqual([]);
  });

  it("stays quiet (no Slack) when every lane is off", async () => {
    clearLanes();
    const alert = vi.fn(async () => undefined);
    const result = await announceAutonomousLanesAtBoot({ processName: "worker", schedulerRunsHere: true, alert });
    expect(result.alerted).toBe(false);
    expect(alert).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
