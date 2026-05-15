// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const getHumanReplyGmailDurabilityStatus = vi.hoisted(() => vi.fn());

vi.mock("../utils/human-reply-gmail", () => ({
  getHumanReplyGmailDurabilityStatus,
}));

function gmailReady() {
  return {
    enabled: true,
    configured: true,
    approved_identity: "ohstnhunt@gmail.com",
    mailbox_email: "ohstnhunt@gmail.com",
    oauth_publishing_status: "production",
    production_ready: true,
    risk: null,
    reason: null,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  getHumanReplyGmailDurabilityStatus.mockReset();
  vi.resetModules();
});

describe("outbound reply durability", () => {
  it("blocks production proof when sender verification and reply watcher env are missing", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "sg-key");
    vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");
    getHumanReplyGmailDurabilityStatus.mockResolvedValue(gmailReady());

    const { buildOutboundReplyDurabilityStatus } = await import(
      "../utils/outbound-reply-durability"
    );
    const status = await buildOutboundReplyDurabilityStatus();

    expect(status.ok).toBe(false);
    expect(status.status).toBe("blocked");
    expect(status.missingEnv).toEqual(
      expect.arrayContaining([
        "BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified",
        "BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN",
        "BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL=ohstnhunt@gmail.com",
        "BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1",
      ]),
    );
    expect(status.blockerPackets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          blockerId: "human-blocker:city-launch-sender-verification",
          owner: "blueprint-chief-of-staff",
          requiredInputs: expect.arrayContaining([
            "BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION=verified",
          ]),
          safeProofCommand: "npm run human-replies:audit-durability -- --allow-not-ready",
          retryCondition: expect.stringContaining("Rerun the safe audit"),
          disallowedWorkaround: expect.stringContaining("dry-run sends"),
        }),
        expect.objectContaining({
          blockerId: "human-blocker:approved-reply-identity",
          exactAsk: expect.stringContaining("BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL"),
          disallowedWorkaround: expect.stringContaining("hlfabhunt@gmail.com"),
        }),
        expect.objectContaining({
          blockerId: "human-blocker:gmail-watcher-scheduler",
          requiredInputs: ["BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED=1"],
        }),
      ]),
    );
  });

  it("marks durability ready only when sender, ingest, identity, watcher, and Gmail OAuth are proven", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "sg-key");
    vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION", "verified");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN", "token");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL", "ohstnhunt@gmail.com");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED", "1");
    getHumanReplyGmailDurabilityStatus.mockResolvedValue(gmailReady());

    const { buildOutboundReplyDurabilityStatus } = await import(
      "../utils/outbound-reply-durability"
    );
    const status = await buildOutboundReplyDurabilityStatus();

    expect(status.ok).toBe(true);
    expect(status.status).toBe("ready");
    expect(status.sender.productionProven).toBe(true);
    expect(status.humanReply.watcherEnabled).toBe(true);
    expect(status.missingEnv).toEqual([]);
    expect(status.blockerPackets).toEqual([]);
  });

  it("turns Gmail OAuth failures into exact founder asks without allowing disallowed identities", async () => {
    vi.stubEnv("SENDGRID_API_KEY", "sg-key");
    vi.stubEnv("SENDGRID_FROM_EMAIL", "launches@tryblueprint.io");
    vi.stubEnv("BLUEPRINT_CITY_LAUNCH_SENDER_VERIFICATION", "verified");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN", "token");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL", "ohstnhunt@gmail.com");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_WATCHER_ENABLED", "1");
    getHumanReplyGmailDurabilityStatus.mockResolvedValue({
      enabled: true,
      configured: false,
      approved_identity: "ohstnhunt@gmail.com",
      mailbox_email: "hlfabhunt@gmail.com",
      oauth_publishing_status: "production",
      production_ready: false,
      risk: "wrong_mailbox",
      reason:
        "Authenticated Gmail mailbox hlfabhunt@gmail.com does not match approved identity ohstnhunt@gmail.com.",
    });

    const { buildOutboundReplyDurabilityStatus } = await import(
      "../utils/outbound-reply-durability"
    );
    const status = await buildOutboundReplyDurabilityStatus();

    expect(status.ok).toBe(false);
    expect(status.blockerPackets).toContainEqual(
      expect.objectContaining({
        blockerId: "human-blocker:gmail-oauth-wrong_mailbox",
        exactAsk: expect.stringContaining("ohstnhunt@gmail.com"),
        disallowedWorkaround: expect.stringContaining("hlfabhunt@gmail.com"),
        resumeTarget: expect.stringContaining("only after the safe audit reports ready"),
      }),
    );
  });
});
