import { COMPANY_POSTAL_LINE } from "../../client/src/data/company";
import { appendCommercialEmailFooter } from "../utils/email-suppression";

/** Owner-configured server-only outreach identity. No address is published in
 * source code or substituted from the general company footer. */
export function firstContactPostalLine() {
  const line = process.env.BLUEPRINT_COMMUNICATIONS_FIRST_CONTACT_POSTAL_LINE?.trim();
  return line && line.startsWith("Blueprint Robotics, Inc. · ") && line.length <= 300
    && !/[\x00-\x1f\x7f<>@]/.test(line) && !/https?:|placeholder|example|fake/i.test(line)
    && /\b[A-Z]{2} \d{5}(?:-\d{4})?$/.test(line) ? line : null;
}

/** Friendly business outreach retains a reply opt-out without subscription language.
 * The canonical suppression URL remains separately recorded by the caller. */
export function appendCommunicationsFooter(text: string, email: string, scope = "growth_campaign") {
  const footer = appendCommercialEmailFooter({ text: "", email, scope })
    .replace(/^Privacy: (.+)\/privacy$/m, "Blueprint: $1")
    .replace(/^Unsubscribe from .+ emails: .+$/m, "If you’d rather I don’t follow up, just let me know.");
  return text.trimEnd() + footer;
}

export function appendFirstContactFooter(text: string, email: string, savedPostalLine?: string, legacy = false) {
  // Build the footer separately: model/source text containing unsubscribe or
  // privacy words cannot suppress it or replace its approved postal line.
  const footer = legacy ? appendCommercialEmailFooter({ text: "", email, scope: "all" })
    : appendCommunicationsFooter("", email, "all");
  const postalLine = savedPostalLine ?? firstContactPostalLine();
  if (!postalLine || !footer.includes(COMPANY_POSTAL_LINE)) throw new Error("first_contact_postal_footer_unavailable");
  return text.trimEnd() + footer.replace(COMPANY_POSTAL_LINE, postalLine);
}

/** Unsent commercial drafts can be sent manually, so their delivery bytes use
 * the same approved runtime identity and a plain reply opt-out. */
export function appendUnsentDraftFooter(text: string, email: string, savedPostalLine?: string) {
  return text.trimEnd() + appendFirstContactFooter("", email, savedPostalLine).replace(
    "If you’d rather I don’t follow up, just let me know.",
    "Commercial outreach. Reply “no thanks” to stop all marketing emails from Blueprint.");
}
