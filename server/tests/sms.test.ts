// @vitest-environment node
/**
 * One SMS, only when Twilio is configured, and nothing (safely) when it is not.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { looksLikePhoneNumber, sendSms } from "../utils/sms";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configureTwilio() {
  vi.stubEnv("TWILIO_ACCOUNT_SID", "ACtest");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "secret");
  vi.stubEnv("TWILIO_PHONE_NUMBER", "+15550000000");
}

describe("a number has to look like E.164", () => {
  it("accepts a full international number and rejects the rest", () => {
    expect(looksLikePhoneNumber("+15551234567")).toBe(true);
    expect(looksLikePhoneNumber("5551234567")).toBe(false); // no country code
    expect(looksLikePhoneNumber("+1 555 123 4567")).toBe(false); // spaces
    expect(looksLikePhoneNumber("not a number")).toBe(false);
  });
});

describe("sending fails closed when Twilio is off", () => {
  it("returns not_configured with no credentials, and never calls out", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("TWILIO_ACCOUNT_SID", "");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");
    vi.stubEnv("TWILIO_PHONE_NUMBER", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendSms({ to: "+15551234567", body: "hi" });
    expect(result).toMatchObject({ sent: false, reason: "not_configured", provider: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects a bad number before calling Twilio, even when configured", async () => {
    configureTwilio();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendSms({ to: "5551234567", body: "hi" });
    expect(result).toMatchObject({ sent: false, reason: "invalid_number" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("sending, when configured", () => {
  it("posts a form-encoded message to Twilio with basic auth and returns the sid", async () => {
    configureTwilio();
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      json: async () => ({ sid: "SMxyz" }),
    }));
    vi.stubGlobal("fetch", fetchSpy);

    const result = await sendSms({ to: "+15551234567", body: "your link: https://x" });
    expect(result).toMatchObject({ sent: true, provider: "twilio", messageId: "SMxyz" });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/Accounts/ACtest/Messages.json");
    expect((init.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
    const body = String(init.body);
    expect(body).toContain("To=%2B15551234567");
    expect(body).toContain("From=%2B15550000000");
    expect(body).toContain("Body=");
  });

  it("reports send_failed when Twilio rejects the request", async () => {
    configureTwilio();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    const result = await sendSms({ to: "+15551234567", body: "hi" });
    expect(result).toMatchObject({ sent: false, reason: "send_failed" });
  });
});
