// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("city launch outbound readiness", () => {
  it("blocks when no recipient-backed direct-outreach send exists", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "sg-key");
    vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION", "verified");

    const { assessCityLaunchOutboundReadiness } = await import("../utils/cityLaunchSendExecutor");
    const result = assessCityLaunchOutboundReadiness({
      city: "Sacramento, CA",
      sendActions: [],
    });

    expect(result.status).toBe("blocked");
    expect(result.blockers).toContain(
      "No recipient-backed direct-outreach send actions were seeded for Sacramento, CA.",
    );
  });

  it("blocks when email transport is not configured", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_PORT", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_FROM_EMAIL", "launches@tryblueprint.io");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION", "verified");

    const { assessCityLaunchOutboundReadiness } = await import("../utils/cityLaunchSendExecutor");
    const result = assessCityLaunchOutboundReadiness({
      city: "Sacramento, CA",
      sendActions: [
        {
          id: "send-1",
          city: "Sacramento, CA",
          citySlug: "sacramento-ca",
          launchId: null,
          lane: "warehouse-facility-direct",
          actionType: "direct_outreach",
          channelAccountId: null,
          channelLabel: "warehouse/facility direct outreach lane",
          targetLabel: "Capital Robotics",
          assetKey: "city-opening-first-wave-pack",
          ownerAgent: "city-launch-agent",
          recipientEmail: "taylor@capitalrobotics.com",
          emailSubject: "Subject",
          emailBody: "Body",
          status: "ready_to_send",
          approvalState: "approved",
          responseIngestState: "awaiting_response",
          issueId: null,
          notes: null,
          sentAtIso: null,
          firstResponseAtIso: null,
          createdAtIso: new Date().toISOString(),
          updatedAtIso: new Date().toISOString(),
        },
      ],
    });

    expect(result.status).toBe("blocked");
    expect(result.blockers).toContain(
      "Email transport is not configured for real city-launch sends.",
    );
  });

  it("warns when sender verification cannot be proven programmatically", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "sg-key");
    vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");

    const { assessCityLaunchOutboundReadiness } = await import("../utils/cityLaunchSendExecutor");
    const result = assessCityLaunchOutboundReadiness({
      city: "Sacramento, CA",
      sendActions: [
        {
          id: "send-1",
          city: "Sacramento, CA",
          citySlug: "sacramento-ca",
          launchId: null,
          lane: "warehouse-facility-direct",
          actionType: "direct_outreach",
          channelAccountId: null,
          channelLabel: "warehouse/facility direct outreach lane",
          targetLabel: "Capital Robotics",
          assetKey: "city-opening-first-wave-pack",
          ownerAgent: "city-launch-agent",
          recipientEmail: "taylor@capitalrobotics.com",
          emailSubject: "Subject",
          emailBody: "Body",
          status: "ready_to_send",
          approvalState: "approved",
          responseIngestState: "awaiting_response",
          issueId: null,
          notes: null,
          sentAtIso: null,
          firstResponseAtIso: null,
          createdAtIso: new Date().toISOString(),
          updatedAtIso: new Date().toISOString(),
        },
      ],
    });

    expect(result.status).toBe("warning");
    expect(result.warnings.join("\n")).toContain(
      "Sender verification cannot be proven programmatically from env state.",
    );
  });
});
