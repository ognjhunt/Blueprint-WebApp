// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

describe("isAutomationLaneEnabled", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("uses the master switch when the lane has no explicit override", async () => {
    process.env.BLUEPRINT_ALL_AUTOMATION_ENABLED = "true";
    delete process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED;

    const { isAutomationLaneEnabled } = await import("../config/env");
    expect(isAutomationLaneEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED")).toBe(true);
  });

  it("returns false when no master switch or lane override is set", async () => {
    delete process.env.BLUEPRINT_ALL_AUTOMATION_ENABLED;
    delete process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED;

    const { isAutomationLaneEnabled } = await import("../config/env");
    expect(isAutomationLaneEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED")).toBe(false);
  });

  it("lets an explicit lane disable override the master switch", async () => {
    process.env.BLUEPRINT_ALL_AUTOMATION_ENABLED = "true";
    process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED = "false";

    const { isAutomationLaneEnabled } = await import("../config/env");
    expect(isAutomationLaneEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED")).toBe(false);
  });

  it("lets an explicit lane enable work without the master switch", async () => {
    process.env.BLUEPRINT_ALL_AUTOMATION_ENABLED = "false";
    process.env.BLUEPRINT_WAITLIST_AUTOMATION_ENABLED = "true";

    const { isAutomationLaneEnabled } = await import("../config/env");
    expect(isAutomationLaneEnabled("BLUEPRINT_WAITLIST_AUTOMATION_ENABLED")).toBe(true);
  });
});
