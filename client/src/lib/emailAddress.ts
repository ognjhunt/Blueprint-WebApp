/**
 * Whether we can send the job link to an email address, the same rule in the browser and on the server. The start form
 * checks it before anything is sent; `server/routes/inbound-request.ts` checks it again and answers with the reason.
 *
 * Three outcomes (owner, 2026-11-11: refuse only what we know is wrong):
 * - accepted: any well-formed address;
 * - accepted with a hint: well formed, but a Gmail name outside Google's stated 6 to 30 characters. Likely a typo, not
 *   a known one (older addresses may differ), so the form says so under the field and still sends;
 * - refused: not a well-formed address, or a throwaway-address domain (each job costs money to build).
 *
 * Only the `isEmail` part of the validator package is imported, so the browser bundle does not carry the whole package.
 */
import isEmail from "validator/lib/isEmail.js";

export interface EmailCheckOptions {
  allow_display_name: boolean;
  allow_ip_domain: boolean;
  allow_utf8_local_part: boolean;
  /** Applies a provider's own rule; for Gmail, the validator package's reading of Google's username rule. */
  domain_specific_validation: boolean;
  require_tld: boolean;
}

/** The well-formed check the start form and its route use to accept or refuse. */
export const EMAIL_SYNTAX_OPTIONS: EmailCheckOptions = {
  allow_display_name: false,
  allow_ip_domain: false,
  allow_utf8_local_part: false,
  domain_specific_validation: false,
  require_tld: true,
};

/** The stricter check other callers keep (`server/utils/validation.ts` `isValidEmailAddress`): adds the Gmail rule. */
export const EMAIL_VALIDATION_OPTIONS: EmailCheckOptions = { ...EMAIL_SYNTAX_OPTIONS, domain_specific_validation: true };

/** Throwaway-address services: mail sent there is gone within minutes, so the private job link would be lost. */
export const TEMPORARY_EMAIL_DOMAINS: readonly string[] = [
  "mailinator.com",
  "tempmail.com",
  "throwaway.email",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
];

export type EmailRefusal = "temporary_address" | "invalid";
export type EmailHint = "gmail_name_length";

/** The sentence a site reads under the email field, in the field's error style, for each refusal. */
export const EMAIL_REFUSAL_SENTENCES: Record<EmailRefusal, string> = {
  temporary_address: "We can't send to a temporary email address. Use one you check.",
  invalid: "Check your email address.",
};

/** The sentence under the field, in the helper style, for an address we accept but that is likely mistyped. */
export const EMAIL_HINT_SENTENCES: Record<EmailHint, string> = {
  gmail_name_length: "Gmail names are usually 6 to 30 characters. Check it's right; we send your job link there.",
};

export function isEmailRefusal(value: unknown): value is EmailRefusal {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EMAIL_REFUSAL_SENTENCES, value);
}

/** The stricter format check with the Gmail rule, for callers outside the start form. */
export function isDeliverableEmailFormat(email: string): boolean {
  return typeof email === "string" && isEmail(email, EMAIL_VALIDATION_OPTIONS);
}

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export type EmailCheck =
  | { ok: true; email: string; hint: EmailHint | null }
  | { ok: false; email: string; reason: EmailRefusal };

/**
 * Check an address as the start form sends it (trimmed, lower case). The Gmail hint counts every character of the name
 * before any "+tag", periods included, as Google's own help page states the rule ("Create a username": 6 to 30
 * characters; letters, numbers and periods).
 */
export function checkEmail(raw: string): EmailCheck {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!isEmail(email, EMAIL_SYNTAX_OPTIONS)) return { ok: false, email, reason: "invalid" };
  const at = email.lastIndexOf("@");
  const domain = email.slice(at + 1);
  if (TEMPORARY_EMAIL_DOMAINS.includes(domain)) return { ok: false, email, reason: "temporary_address" };
  const name = email.slice(0, at).split("+")[0];
  const hint = GMAIL_DOMAINS.has(domain) && (name.length < 6 || name.length > 30) ? "gmail_name_length" : null;
  return { ok: true, email, hint };
}
