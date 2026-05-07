// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listCityLaunchSendActions = vi.hoisted(() => vi.fn());
const readCityLaunchSendAction = vi.hoisted(() => vi.fn());
const listCityLaunchChannelAccounts = vi.hoisted(() => vi.fn());
const upsertCityLaunchChannelAccount = vi.hoisted(() => vi.fn());
const upsertCityLaunchSendAction = vi.hoisted(() => vi.fn());
const recordCityLaunchTouch = vi.hoisted(() => vi.fn());
const sendEmail = vi.hoisted(() => vi.fn());
const buildOutboundReplyDurabilityStatus = vi.hoisted(() => vi.fn());

vi.mock("../utils/cityLaunchLedgers", () => ({
  listCityLaunchSendActions,
  readCityLaunchSendAction,
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

vi.mock("../utils/outbound-reply-durability", () => ({
  buildOutboundReplyDurabilityStatus,
}));

beforeEach(() => {
  listCityLaunchSendActions.mockReset();
  readCityLaunchSendAction.mockReset();
  listCityLaunchChannelAccounts.mockReset();
  upsertCityLaunchChannelAccount.mockReset();
  upsertCityLaunchSendAction.mockReset();
  recordCityLaunchTouch.mockReset();
  sendEmail.mockReset();
  buildOutboundReplyDurabilityStatus.mockReset();
  buildOutboundReplyDurabilityStatus.mockResolvedValue({
    ok: true,
    status: "ready",
    blockers: [],
    warnings: [],
    missingEnv: [],
    proofCommands: [],
  });

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

  it("blocks live direct outreach when reply durability is not production-ready", async () => {
    listCityLaunchChannelAccounts.mockResolvedValue([]);
    listCityLaunchSendActions.mockResolvedValue([
      {
        id: "durham-nc-send-buyer-linked-1",
        city: "Durham, NC",
        citySlug: "durham-nc",
        launchId: "launch-1",
        lane: "buyer-linked-site",
        actionType: "direct_outreach",
        channelAccountId: null,
        channelLabel: "buyer linked site",
        targetLabel: "BotBuilt",
        assetKey: "city-opening-first-wave-pack",
        ownerAgent: "city-launch-agent",
        recipientEmail: "ops@botbuilt.com",
        emailSubject: "Subject",
        emailBody: "Body long enough for a proof-led outreach draft.",
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
    ]);
    buildOutboundReplyDurabilityStatus.mockResolvedValue({
      ok: false,
      status: "blocked",
      blockers: ["Gmail human-reply watcher is not enabled for the production scheduler."],
      warnings: [],
      missingEnv: ["BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1"],
      proofCommands: ["npm run human-replies:audit-durability"],
    });
    sendEmail.mockResolvedValue({ sent: true });

    const { executeCityLaunchSends } = await import("../utils/cityLaunchSendExecutor");
    const result = await executeCityLaunchSends({ city: "Durham, NC" });

    expect(result.sent).toBe(0);
    expect(result.totalEligible).toBe(1);
    expect(result.errors.join("\n")).toContain("Outbound reply durability is blocked");
    expect(result.errors.join("\n")).toContain("BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1");
    expect(sendEmail).not.toHaveBeenCalled();
    expect(recordCityLaunchTouch).not.toHaveBeenCalled();
  });

  it("does not dry-run send direct outreach with a reserved recipient email", async () => {
    listCityLaunchChannelAccounts.mockResolvedValue([]);
    listCityLaunchSendActions.mockResolvedValue([
      {
        id: "durham-nc-send-buyer-linked-1",
        city: "Durham, NC",
        citySlug: "durham-nc",
        launchId: "launch-1",
        lane: "buyer-linked-site",
        actionType: "direct_outreach",
        channelAccountId: null,
        channelLabel: "buyer linked site",
        targetLabel: "BotBuilt",
        assetKey: "city-opening-first-wave-pack",
        ownerAgent: "city-launch-agent",
        recipientEmail: "ops@botbuilt.example",
        emailSubject: "Subject",
        emailBody: "Body long enough for a proof-led outreach draft.",
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
    ]);

    const { executeCityLaunchSends } = await import("../utils/cityLaunchSendExecutor");
    const result = await executeCityLaunchSends({ city: "Durham, NC", dryRun: true });

    expect(result.totalEligible).toBe(0);
    expect(result.sent).toBe(0);
    expect(result.skippedNoRecipient).toBe(1);
    expect(sendEmail).not.toHaveBeenCalled();
    expect(recordCityLaunchTouch).not.toHaveBeenCalled();
  });

  it("blocks approval for direct outreach with a reserved recipient email", async () => {
    const action = {
      id: "durham-nc-send-buyer-linked-1",
      city: "Durham, NC",
      citySlug: "durham-nc",
      launchId: "launch-1",
      lane: "buyer-linked-site",
      actionType: "direct_outreach",
      channelAccountId: null,
      channelLabel: "buyer linked site",
      targetLabel: "BotBuilt",
      assetKey: "city-opening-first-wave-pack",
      ownerAgent: "city-launch-agent",
      recipientEmail: "ops@botbuilt.example",
      emailSubject: "Subject",
      emailBody: "Body long enough for a proof-led outreach draft.",
      status: "ready_to_send",
      approvalState: "pending_first_send_approval",
      responseIngestState: "awaiting_response",
      issueId: null,
      notes: "Prepared",
      sentAtIso: null,
      firstResponseAtIso: null,
      createdAtIso: new Date().toISOString(),
      updatedAtIso: new Date().toISOString(),
    };
    readCityLaunchSendAction.mockResolvedValue(action);
    upsertCityLaunchSendAction.mockResolvedValue({});

    const { approveCityLaunchSendAction } = await import("../utils/cityLaunchSendExecutor");
    const result = await approveCityLaunchSendAction({
      actionId: action.id,
      approverRole: "founder",
    });

    expect(result.approved).toBe(false);
    expect(upsertCityLaunchSendAction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: action.id,
        status: "blocked",
        approvalState: "blocked",
      }),
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
