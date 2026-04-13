// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getProfileMock = vi.hoisted(() => vi.fn());

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        setCredentials: vi.fn(),
      })),
    },
    gmail: vi.fn(() => ({
      users: {
        getProfile: getProfileMock,
      },
    })),
  },
}));

describe("human reply gmail status", () => {
  beforeEach(() => {
    getProfileMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("fails closed when oauth env is missing", async () => {
    const { getHumanReplyGmailStatus } = await import("../utils/human-reply-gmail");
    const status = await getHumanReplyGmailStatus();

    expect(status.configured).toBe(false);
    expect(status.reason).toContain("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID");
  });

  it("fails closed when the mailbox identity is not approved", async () => {
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID", "client-id");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN", "refresh-token");
    getProfileMock.mockResolvedValue({
      data: { emailAddress: "hlfabhunt@gmail.com" },
    });

    const { getHumanReplyGmailStatus } = await import("../utils/human-reply-gmail");
    const status = await getHumanReplyGmailStatus();

    expect(status.configured).toBe(false);
    expect(status.mailbox_email).toBe("hlfabhunt@gmail.com");
    expect(status.reason).toContain("does not match approved identity");
  });

  it("fails closed when the approved identity is explicitly disallowed", async () => {
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_APPROVED_EMAIL", "hlfabhunt@gmail.com");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID", "client-id");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN", "refresh-token");

    const { getHumanReplyGmailStatus } = await import("../utils/human-reply-gmail");
    const status = await getHumanReplyGmailStatus();

    expect(status.configured).toBe(false);
    expect(status.reason).toContain("cannot be set to hlfabhunt@gmail.com");
  });

  it("accepts the approved mailbox identity", async () => {
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID", "client-id");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN", "refresh-token");
    getProfileMock.mockResolvedValue({
      data: { emailAddress: "ohstnhunt@gmail.com" },
    });

    const { getHumanReplyGmailStatus } = await import("../utils/human-reply-gmail");
    const status = await getHumanReplyGmailStatus();

    expect(status.configured).toBe(true);
    expect(status.mailbox_email).toBe("ohstnhunt@gmail.com");
    expect(status.reason).toBeNull();
  });

  it("treats oauth publishing state as unknown unless explicitly marked production", async () => {
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID", "client-id");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN", "refresh-token");
    getProfileMock.mockResolvedValue({
      data: { emailAddress: "ohstnhunt@gmail.com" },
    });

    const { getHumanReplyGmailDurabilityStatus } = await import("../utils/human-reply-gmail");
    const status = await getHumanReplyGmailDurabilityStatus();

    expect(status.production_ready).toBe(false);
    expect(status.oauth_publishing_status).toBe("unknown");
    expect(status.risk).toBe("unknown_oauth_state");
  });

  it("marks testing oauth state as risky and production state as ready", async () => {
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID", "client-id");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN", "refresh-token");
    getProfileMock.mockResolvedValue({
      data: { emailAddress: "ohstnhunt@gmail.com" },
    });

    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS", "testing");
    let module = await import("../utils/human-reply-gmail");
    let status = await module.getHumanReplyGmailDurabilityStatus();
    expect(status.production_ready).toBe(false);
    expect(status.risk).toBe("testing_only");

    vi.resetModules();
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_ID", "client-id");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_REFRESH_TOKEN", "refresh-token");
    vi.stubEnv("BLUEPRINT_HUMAN_REPLY_GMAIL_OAUTH_PUBLISHING_STATUS", "production");
    getProfileMock.mockResolvedValue({
      data: { emailAddress: "ohstnhunt@gmail.com" },
    });
    module = await import("../utils/human-reply-gmail");
    status = await module.getHumanReplyGmailDurabilityStatus();
    expect(status.production_ready).toBe(true);
    expect(status.risk).toBeNull();
  });
});
