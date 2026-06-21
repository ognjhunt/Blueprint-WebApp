// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../logger", () => ({
  logger: loggerMock,
}));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  loggerMock.info.mockReset();
  loggerMock.warn.mockReset();
  loggerMock.error.mockReset();
  process.env = { ...originalEnv };
  delete process.env.SENDGRID_API_KEY;
  delete process.env.SENDGRID_FROM_EMAIL;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("email logging", () => {
  it("logs unconfigured transport without raw recipients or message bodies", async () => {
    const { sendEmail } = await import("../utils/email");

    const result = await sendEmail({
      to: "ada@example.com",
      subject: "Confidential buyer request",
      text: "This includes a private deployment site and phone number.",
      replyTo: "founder@example.com",
    });

    expect(result.sent).toBe(false);

    const infoCall = loggerMock.info.mock.calls.find(
      ([, message]) => message === "Email transport not configured; message not sent",
    );
    expect(infoCall).toBeDefined();

    const [context] = infoCall ?? [];
    expect(context).toMatchObject({
      event: "email_transport_unconfigured",
      provider: "none",
      recipientDomain: "example.com",
      replyToDomain: "example.com",
      hasText: true,
      hasHtml: false,
      attachmentCount: 0,
    });
    expect(context).toHaveProperty("subjectLength", "Confidential buyer request".length);

    const serializedContext = JSON.stringify(context);
    expect(serializedContext).not.toContain("ada@example.com");
    expect(serializedContext).not.toContain("founder@example.com");
    expect(serializedContext).not.toContain("private deployment site");
  });
});
