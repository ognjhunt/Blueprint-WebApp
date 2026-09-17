/**
 * Sending one SMS when Twilio is configured, and doing nothing safely when it is not.
 *
 * ## Why a REST call and not the Twilio SDK
 *
 * The `twilio` package is not a dependency of this repo, and the `TWILIO_*` env
 * vars are defined but unwired — there is no live SMS path today. Adding a
 * package to send one templated message is more surface than it earns, so this
 * posts to Twilio's Messages endpoint directly. No new dependency, and the whole
 * integration is small enough to read in one screen.
 *
 * ## Why it fails closed and silent
 *
 * The same shape as `sendEmail`: with no credentials it returns
 * `{ sent: false, reason: "not_configured" }` rather than throwing, so a caller
 * offering SMS as one channel degrades to "we could not text it — here is the
 * link to forward" instead of erroring. Turning SMS on is a deliberate act — set
 * the three `TWILIO_*` vars — and, because SMS is not part of this repo's
 * approved primary stack, enabling it live is a decision to make on purpose, not
 * a default that ships hot.
 *
 * The body is always caller-templated and never taken from an end user, so this
 * cannot be driven into sending arbitrary content; only the destination is
 * caller-supplied, and the route above it bounds how many times that can happen.
 */

export interface SendSmsResult {
  sent: boolean;
  provider: "twilio" | null;
  messageId: string | null;
  reason?: "not_configured" | "invalid_number" | "send_failed";
  error?: unknown;
}

/**
 * A leading `+` and 8–15 digits.
 *
 * Enough to reject a typo or a domestic-format number that would silently fail
 * at Twilio, not a claim that the number is reachable. We want E.164 because a
 * bare "5551234" has no country and Twilio would reject it after we had already
 * told the operator we sent it.
 */
export function looksLikePhoneNumber(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value.trim());
}

export async function sendSms(params: { to: string; body: string }): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const fromNumber = process.env.TWILIO_PHONE_NUMBER?.trim() || "";

  // No credentials means no live SMS path. The honest answer is "not configured",
  // so the caller can fall back to email or to handing over the link.
  if (!accountSid || !authToken || !fromNumber) {
    return { sent: false, provider: null, messageId: null, reason: "not_configured" };
  }

  const to = params.to.trim();
  if (!looksLikePhoneNumber(to)) {
    return { sent: false, provider: "twilio", messageId: null, reason: "invalid_number" };
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: fromNumber, Body: params.body }).toString(),
      },
    );

    if (!response.ok) {
      return { sent: false, provider: "twilio", messageId: null, reason: "send_failed" };
    }
    const data = (await response.json().catch(() => ({}))) as { sid?: string };
    return { sent: true, provider: "twilio", messageId: data.sid ?? null };
  } catch (error) {
    return { sent: false, provider: "twilio", messageId: null, reason: "send_failed", error };
  }
}
