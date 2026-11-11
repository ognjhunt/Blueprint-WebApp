/**
 * Whether we can send to an email address, the same rule in the browser and on the server. The start form checks it
 * before anything is sent; `server/routes/inbound-request.ts` checks it again and answers with the reason code, and
 * `server/utils/validation.ts` uses the same options for its other callers.
 *
 * Only the `isEmail` part of the validator package is imported, so the browser bundle does not carry the whole package.
 */
import isEmail from "validator/lib/isEmail.js";

export interface EmailCheckOptions {
  allow_display_name: boolean;
  allow_ip_domain: boolean;
  allow_utf8_local_part: boolean;
  /** Applies a provider's own rule; for Gmail, the name before @gmail.com has 6 to 30 letters or numbers. */
  domain_specific_validation: boolean;
  require_tld: boolean;
}

export const EMAIL_VALIDATION_OPTIONS: EmailCheckOptions = {
  allow_display_name: false,
  allow_ip_domain: false,
  allow_utf8_local_part: false,
  domain_specific_validation: true,
  require_tld: true,
};

/** Throwaway-address services: mail sent there is gone within minutes, so the private job link would be lost. */
export const TEMPORARY_EMAIL_DOMAINS: readonly string[] = [
  "mailinator.com",
  "tempmail.com",
  "throwaway.email",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
];

export type EmailRefusal = "gmail_name_length" | "temporary_address" | "invalid";

/** The sentence a site reads under the email field, for each reason. */
export const EMAIL_REFUSAL_SENTENCES: Record<EmailRefusal, string> = {
  gmail_name_length: "Gmail addresses have 6 to 30 letters or numbers before @gmail.com. Check yours.",
  temporary_address: "We can't send to a temporary email address. Use one you check.",
  invalid: "Check your email address.",
};

export function isEmailRefusal(value: unknown): value is EmailRefusal {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(EMAIL_REFUSAL_SENTENCES, value);
}

/** The format check alone, with the shared options. Callers pass the address as they hold it. */
export function isDeliverableEmailFormat(email: string): boolean {
  return typeof email === "string" && isEmail(email, EMAIL_VALIDATION_OPTIONS);
}

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Check an address as the start form sends it (trimmed, lower case). `ok: false` carries the reason; a Gmail name of
 * the wrong length is told apart from other faults so the site reads the rule it broke.
 */
export function checkEmail(raw: string): { ok: true; email: string } | { ok: false; email: string; reason: EmailRefusal } {
  const email = String(raw ?? "").trim().toLowerCase();
  if (!isDeliverableEmailFormat(email)) {
    const at = email.lastIndexOf("@");
    const domain = at >= 0 ? email.slice(at + 1) : "";
    const name = (at >= 0 ? email.slice(0, at) : "").split("+")[0].replace(/\./g, "");
    const lengthOnly = GMAIL_DOMAINS.has(domain) && (name.length < 6 || name.length > 30)
      && isEmail(email, { ...EMAIL_VALIDATION_OPTIONS, domain_specific_validation: false });
    return { ok: false, email, reason: lengthOnly ? "gmail_name_length" : "invalid" };
  }
  const domain = email.split("@").pop() ?? "";
  if (TEMPORARY_EMAIL_DOMAINS.includes(domain)) return { ok: false, email, reason: "temporary_address" };
  return { ok: true, email };
}
