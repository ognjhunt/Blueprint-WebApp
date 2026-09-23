// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe("email provider receipts", () => {
  it("returns a Resend acceptance ID and passes sender, reply-to, and correlation tags", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "noreply@tryblueprint.io";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email-123" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await import("../utils/email");

    await expect(sendEmail({
      to: "team@example.com",
      subject: "Canary ready",
      text: "Open the authenticated result.",
      replyTo: "hello@tryblueprint.io",
      sendGridCategories: ["transactional"],
      sendGridCustomArgs: { bp_campaign_id: "campaign-123" },
    })).resolves.toEqual({
      sent: true,
      provider: "resend",
      messageId: "email-123",
    });
    const [url, request] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(JSON.parse(String(request.body))).toMatchObject({
      from: "Blueprint <noreply@tryblueprint.io>",
      to: "team@example.com",
      reply_to: "hello@tryblueprint.io",
      tags: [
        { name: "category", value: "transactional" },
        { name: "bp_campaign_id", value: "campaign-123" },
      ],
    });
  });

  it("does not use legacy SMTP credentials when Resend is unavailable", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "legacy";
    process.env.SMTP_PASS = "legacy";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail, getEmailTransportStatus } = await import("../utils/email");

    expect(getEmailTransportStatus().configured).toBe(false);
    await expect(sendEmail({
      to: "team@example.com", subject: "Canary ready", text: "Test",
    })).resolves.toMatchObject({ sent: false, provider: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
