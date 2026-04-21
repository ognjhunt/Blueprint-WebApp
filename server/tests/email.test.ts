// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("city launch sender operational state", () => {
  it("returns ready when transport and sender verification are both ready", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "sg-key");
    vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION", "verified");

    const { getCityLaunchSenderOperationalState } = await import("../utils/email");
    const state = getCityLaunchSenderOperationalState();

    expect(state.capability).toBe("ready");
    expect(state.blockers).toEqual([]);
    expect(state.warnings).toEqual([]);
  });

  it("returns warning when sender verification cannot be proven programmatically", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "sg-key");
    vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION", "");

    const { getCityLaunchSenderOperationalState } = await import("../utils/email");
    const state = getCityLaunchSenderOperationalState();

    expect(state.capability).toBe("warning");
    expect(state.warnings.join("\n")).toContain(
      "Sender verification cannot be proven programmatically from env state.",
    );
  });

  it("returns blocked when transport or sender verification is explicitly invalid", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION", "unverified");

    const { getCityLaunchSenderOperationalState } = await import("../utils/email");
    const state = getCityLaunchSenderOperationalState();

    expect(state.capability).toBe("blocked");
    expect(state.blockers.join("\n")).toContain("Email transport is not configured for real city-launch sends.");
    expect(state.blockers.join("\n")).toContain("City-launch sender launches@tryblueprint.io is explicitly marked unverified");
  });
});
