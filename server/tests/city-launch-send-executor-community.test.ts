// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listCityLaunchSendActions = vi.hoisted(() => vi.fn());
const listCityLaunchChannelAccounts = vi.hoisted(() => vi.fn());
const upsertCityLaunchChannelAccount = vi.hoisted(() => vi.fn());
const upsertCityLaunchSendAction = vi.hoisted(() => vi.fn());
const recordCityLaunchTouch = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", () => ({
  listCityLaunchSendActions,
  listCityLaunchChannelAccounts,
  upsertCityLaunchChannelAccount,
  upsertCityLaunchSendAction,
  recordCityLaunchTouch,
}));

vi.mock("../utils/email", async () => {
  const actual = await vi.importActual("../utils/email");
  return {
    ...actual,
    sendEmail,
  };
});

beforeEach(() => {
  listCityLaunchSendActions.mockReset();
  listCityLaunchChannelAccounts.mockReset();
  upsertCityLaunchChannelAccount.mockReset();
  upsertCityLaunchSendAction.mockReset();
  recordCityLaunchTouch.mockReset();
  sendEmail.mockReset();

  vi.stubEnv("SENDGRID_API_KEY", "sg-key");
  vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");
  vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION", "verified");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("city launch send executor community publication", () => {
  it("does not mark artifact-only community posts as sent", async () => {
    listCityLaunchChannelAccounts.mockResolvedValue([
      {
        id: "san-jose-ca-channel-public-commercial-community",
        city: "San Jose, CA",
        citySlug: "san-jose-ca",
        launchId: "launch-1",
        lane: "public-commercial-community",
        channelClass: "bounded_community_posting",
        accountLabel: "San Jose community lane",
        ownerAgent: "capturer-growth-agent",
        status: "ready_to_create",
        approvalState: "pending_first_send_approval",
        notes: "Prepared lane",
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      },
    ]);
    listCityLaunchSendActions.mockResolvedValue([
      {
        id: "san-jose-ca-send-community-1",
        city: "San Jose, CA",
        citySlug: "san-jose-ca",
        launchId: "launch-1",
        lane: "public-commercial-community",
        actionType: "community_post",
        channelAccountId: "san-jose-ca-channel-public-commercial-community",
        channelLabel: "community lane",
        targetLabel: "Bounded public-commercial post",
        assetKey: "city-opening-first-wave-pack",
        ownerAgent: "capturer-growth-agent",
        recipientEmail: null,
        emailSubject: null,
        emailBody: null,
        status: "ready_to_send",
        approvalState: "approved",
        responseIngestState: "awaiting_response",
        issueId: null,
        notes: "Prepared",
        sentAtIso: null,
        firstResponseAtIso: null,
        createdAtIso: new Date().toISOString(),
        updatedAtIso: new Date().toISOString(),
      },
    ]);
    upsertCityLaunchChannelAccount.mockResolvedValue({});
    upsertCityLaunchSendAction.mockResolvedValue({});

    const { executeCityLaunchSends } = await import("../utils/cityLaunchSendExecutor");
    const result = await executeCityLaunchSends({ city: "San Jose, CA" });

    expect(result.sent).toBe(0);
    expect(upsertCityLaunchSendAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "san-jose-ca-send-community-1",
        status: "blocked",
      }),
    );
    expect(recordCityLaunchTouch).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
