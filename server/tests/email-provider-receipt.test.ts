// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({ sendMail: state.sendMail }),
  },
}));
vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  state.sendMail.mockReset();
  process.env = { ...originalEnv };
  delete process.env.SENDGRID_API_KEY;
  delete process.env.SENDGRID_FROM_EMAIL;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe("email provider receipts", () => {
  it("returns SendGrid transport acceptance and x-message-id", async () => {
    process.env.SENDGRID_API_KEY = "sendgrid-test-key";
    process.env.SENDGRID_FROM_EMAIL = "blueprint@example.com";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, {
      status: 202,
      headers: { "x-message-id": "sendgrid-message-1" },
    })));
    const { sendEmail } = await import("../utils/email");

    await expect(sendEmail({
      to: "team@example.com",
      subject: "Canary ready",
      text: "Open the authenticated result.",
    })).resolves.toEqual({
      sent: true,
      provider: "sendgrid",
      messageId: "sendgrid-message-1",
    });
  });

  it("returns SMTP transport acceptance and Nodemailer messageId", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_USER = "blueprint";
    process.env.SMTP_PASS = "test-only";
    state.sendMail.mockResolvedValue({ messageId: "smtp-message-1" });
    const { sendEmail } = await import("../utils/email");

    await expect(sendEmail({
      to: "team@example.com",
      subject: "Canary ready",
      text: "Open the authenticated result.",
    })).resolves.toEqual({
      sent: true,
      provider: "smtp",
      messageId: "smtp-message-1",
    });
  });
});
