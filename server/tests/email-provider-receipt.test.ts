// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("../logger", () => ({ logger }));

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...originalEnv };
  delete process.env.RESEND_API_KEY;
  delete process.env.RESEND_FROM_EMAIL;
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...originalEnv };
});

describe("email provider receipts", () => {
  it.each(["returned_error", "missing_id"])("logs a safe failure event for %s", async mode => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "noreply@tryblueprint.io";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(mode === "returned_error"
      ? { statusCode: 422, name: "validation_error", message: "PRIVATE_PROVIDER_DETAIL recipient@example.invalid PRIVATE_BODY" }
      : {}), { status: mode === "returned_error" ? 422 : 200 })));
    const { sendEmail } = await import("../utils/email");
    const result = await sendEmail({ to: "recipient@example.invalid", subject: "PRIVATE_SUBJECT", text: "PRIVATE_BODY" });
    expect(result).toMatchObject({ sent: false, outcome: mode === "returned_error" ? "not_sent" : "unknown" });
    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "email_dispatch_failed", provider: "resend" }),
      "Failed to send email via Resend");
    expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/recipient@example|PRIVATE_PROVIDER_DETAIL|PRIVATE_BODY|PRIVATE_SUBJECT/);
  });
  it.each([
    ["network rejection", "throw", "unknown"],
    ["accepted but invalid JSON", "invalid", "unknown"],
    ["accepted without ID", "missing", "unknown"],
    ["untyped rejection", "untyped", "unknown"],
    ["server failure", 500, "unknown"],
    ["timeout", 408, "unknown"],
    ["rate limit", 429, "not_sent"],
    ["validation rejection", 422, "not_sent"],
  ])("classifies %s using the installed SDK", async (_name, mode, outcome) => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "noreply@tryblueprint.io";
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (mode === "throw") throw new Error("accepted then connection lost");
      return new Response(mode === "invalid" ? "not json" : JSON.stringify(
        mode === "missing" ? {} : mode === "untyped" ? { message: "rejected" }
          : { message: "rejected", name: "application_error", statusCode: mode }),
      { status: typeof mode === "number" ? mode : mode === "untyped" ? 400 : 200 });
    }));
    const { sendEmail } = await import("../utils/email");
    expect(await sendEmail({ to: "team@example.com", subject: "s", text: "b" }))
      .toMatchObject({ sent: false, provider: "resend", messageId: null, outcome });
  });
  it.each([
    // The rows of RESEND_FAILURE_TABLE, by Resend's documented error bodies.
    [429, "rate_limit_exceeded", "Too many requests.", "transient", "not_sent"],
    [429, "daily_quota_exceeded", "You have exceeded your daily email sending quota.", "transient", "not_sent"],
    [401, "validation_error", "API key is invalid", "transient", "not_sent"],
    [400, "validation_error", "API key is invalid", "transient", "not_sent"],
    [403, "validation_error", "The example.com domain is not verified.", "transient", "not_sent"],
    [409, "resource_locked", "Another request is already updating this resource.", "transient", "not_sent"],
    [422, "validation_error", "Invalid `to` field.", "permanent", "not_sent"],
    [400, "validation_error", "An error was found with one or more fields in the request.", "permanent", "not_sent"],
    [404, "not_found", "The requested endpoint does not exist.", "permanent", "not_sent"],
    [409, "invalid_idempotent_request", "the request body was modified and doesn't match the original request.", "permanent", "not_sent"],
    [409, "concurrent_idempotent_requests", "There is another request in progress with the same idempotency key.", "unknown", "unknown"],
    [408, "application_error", "timeout", "unknown", "unknown"],
    [500, "application_error", "An unexpected error occurred.", "unknown", "unknown"],
    [503, "service_unavailable", "API is temporarily unavailable", "unknown", "unknown"],
  ])("classifies Resend %i %s (%s) as %s", async (statusCode, name, message, failure, outcome) => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "noreply@tryblueprint.io";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ statusCode, name, message }), { status: statusCode })));
    const { sendEmail, classifyResendFailure } = await import("../utils/email");
    expect(classifyResendFailure({ statusCode, name, message })).toBe(failure);
    expect(await sendEmail({ to: "team@example.com", subject: "s", text: "b" }))
      .toMatchObject({ sent: false, provider: "resend", messageId: null, failure, outcome });
  });
  it("classifies an answer with no status, and a thrown transport error, as unknown", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "noreply@tryblueprint.io";
    const { sendEmail, classifyResendFailure } = await import("../utils/email");
    expect(classifyResendFailure(null)).toBe("unknown");
    expect(classifyResendFailure({ message: "rejected" })).toBe("unknown");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("connection reset"); }));
    expect(await sendEmail({ to: "team@example.com", subject: "s", text: "b" })).toMatchObject({ sent: false, failure: "unknown", outcome: "unknown" });
  });
  it("sends an idempotency key as Resend's Idempotency-Key header, outside the message body, and none unless asked", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "noreply@tryblueprint.io";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "email-123" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendEmail } = await import("../utils/email");
    const message = { to: "team@example.com", subject: "Result ready", text: "Open your result." };
    await sendEmail({ ...message, idempotencyKey: "capture-outbox/abc123" });
    await sendEmail({ ...message, idempotencyKey: "capture-outbox/abc123" });
    await sendEmail(message);
    const requests = fetchMock.mock.calls.map(call => (call as unknown as [string, RequestInit])[1]);
    expect(requests.map(request => new Headers(request.headers).get("Idempotency-Key")))
      .toEqual(["capture-outbox/abc123", "capture-outbox/abc123", null]);
    // Resend refuses a repeated key whose body differs, so the key must never change the body.
    expect(requests[0].body).toBe(requests[2].body);
    expect(String(requests[0].body)).not.toContain("abc123");
  });
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
