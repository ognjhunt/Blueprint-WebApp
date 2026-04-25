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
  });
});
