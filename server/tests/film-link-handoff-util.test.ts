// @vitest-environment node
/**
 * The shared film-link handoff: who gets it, and how it is sent.
 *
 * Both the capture-page button and the intake "someone else is filming" field
 * run through here, so these pin the gate (only a self-capture in an approved
 * region, with someone actually named) and the channel rules.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const sendEmailMock = vi.fn(async () => ({ sent: true, provider: "sendgrid" as const, messageId: "e1" }));
const sendSmsMock = vi.fn(async () => ({ sent: false, provider: null, messageId: null, reason: "not_configured" as const }));

vi.mock("../utils/email", () => ({ sendEmail: (a: unknown) => sendEmailMock(a as never) }));
vi.mock("../utils/sms", () => ({
  sendSms: (a: unknown) => sendSmsMock(a as never),
  looksLikePhoneNumber: (value: string) => /^\+[1-9]\d{7,14}$/.test(String(value).trim()),
}));

const { inferHandoffChannel, sendFilmLinkHandoff, shouldSendFilmerHandoff } = await import(
  "../utils/filmLinkHandoff"
);

afterEach(() => {
  sendEmailMock.mockClear();
  sendSmsMock.mockClear();
  sendSmsMock.mockResolvedValue({ sent: false, provider: null, messageId: null, reason: "not_configured" });
});

describe("the channel is inferred from the destination", () => {
  it("treats an @ as email and everything else as a phone number", () => {
    expect(inferHandoffChannel("maria@floor.example")).toBe("email");
    expect(inferHandoffChannel("+15551234567")).toBe("sms");
  });
});

describe("intake only hands the link on when it would actually work", () => {
  const ok = {
    filmerContact: "+15551234567",
    buyerType: "site_operator",
    captureMode: "self_capture",
    captureRegion: "us" as const,
  };

  it("sends for a self-capture in an approved region with someone named", () => {
    expect(shouldSendFilmerHandoff(ok)).toBe(true);
  });

  it("does not send when nobody was named", () => {
    expect(shouldSendFilmerHandoff({ ...ok, filmerContact: "  " })).toBe(false);
  });

  it("does not send for a capturer visit", () => {
    expect(shouldSendFilmerHandoff({ ...ok, captureMode: "site_visit" })).toBe(false);
  });

  it("does not send outside an approved region, where the link would wall anyway", () => {
    expect(shouldSendFilmerHandoff({ ...ok, captureRegion: "non_us" })).toBe(false);
    expect(shouldSendFilmerHandoff({ ...ok, captureRegion: null })).toBe(false);
  });
});

describe("sending composes a film-scoped link and reports honestly", () => {
  it("emails the link and returns sent", async () => {
    const result = await sendFilmLinkHandoff({
      requestId: "req-1",
      channel: "email",
      to: "maria@floor.example",
      taskSummary: "Move cartons onto a pallet",
    });
    expect(result.sent).toBe(true);
    expect(result.filmUrl).toMatch(/\/capture-upload\//);
    expect((sendEmailMock.mock.calls[0][0] as { text: string }).text).toContain(result.filmUrl);
  });

  it("refuses a bad email or number before sending", async () => {
    expect((await sendFilmLinkHandoff({ requestId: "r", channel: "email", to: "nope" })).code).toBe("invalid_email");
    expect((await sendFilmLinkHandoff({ requestId: "r", channel: "sms", to: "5551234" })).code).toBe("invalid_number");
    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(sendSmsMock).not.toHaveBeenCalled();
  });

  it("says sms_unavailable when Twilio is off, and returns the link to share", async () => {
    const result = await sendFilmLinkHandoff({ requestId: "r", channel: "sms", to: "+15551234567" });
    expect(result).toMatchObject({ sent: false, code: "sms_unavailable" });
    expect(result.filmUrl).toMatch(/\/capture-upload\//);
  });

  it("texts the link when Twilio is configured", async () => {
    sendSmsMock.mockResolvedValueOnce({ sent: true, provider: "twilio", messageId: "SM1" });
    const result = await sendFilmLinkHandoff({ requestId: "r", channel: "sms", to: "+15551234567" });
    expect(result.sent).toBe(true);
    expect((sendSmsMock.mock.calls[0][0] as { body: string }).body).toContain(result.filmUrl);
  });
});
