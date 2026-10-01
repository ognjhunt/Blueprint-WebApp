import { z } from "zod";
import { communicationsDigest } from "./communications-contract";

export const PUBLIC_CONTACT_PREFIX = "blueprint.public-business-contact.v1:";
export const publishedPublicContactSchema = z.object({
  organization: z.string().min(1).max(200), site: z.string().min(1).max(300),
  email: z.string().email().max(254), purpose: z.literal("business_inquiries"),
  status: z.literal("public_business_contact"),
}).strict();

/** This is an assertion already checked by source QA, never email discovery.
 * An address in a quote, CRM cell or vendor claim cannot authorize contact. */
export function publishedPublicContact(candidate: any) {
  assertContactUnknowns(candidate);
  const assertions = (candidate.evidence ?? []).filter((entry: any) => typeof entry.claim === "string"
    && entry.claim.startsWith(PUBLIC_CONTACT_PREFIX));
  if (!assertions.length) throw new Error("verified_public_business_contact_missing");
  const matches = assertions.map((entry: any) => {
    let value;
    try { value = publishedPublicContactSchema.parse(JSON.parse(entry.claim.slice(PUBLIC_CONTACT_PREFIX.length))); }
    catch { throw new Error("verified_contact_assertion_invalid"); }
    const host = new URL(entry.url).hostname.toLowerCase();
    const organizationHost = new URL(candidate.organization_url).hostname.toLowerCase();
    const quoteEmails = String(entry.quote ?? "").match(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? [];
    if (value.organization !== candidate.organization || value.site !== candidate.site
      || entry.classification !== "operator" || entry.claim_kind !== "fact" || entry.origin !== "live"
      || entry.assertion_scope !== "current_operational"
      || !(host === organizationHost || host.endsWith(`.${organizationHost}`))
      || !quoteEmails.some((email) => email.toLowerCase() === value.email.toLowerCase())
      || new Set(quoteEmails.map(email => email.toLowerCase())).size !== 1
      || !/\b(?:public business contact|business inquiries|commercial inquiries|partnership inquiries)\b/i.test(String(entry.quote))
      || /\b(?:personal only|support only|do not contact|no unsolicited|not for business)\b/i.test(String(entry.quote))) {
      throw new Error("verified_contact_source_binding_invalid");
    }
    return { email: value.email.toLowerCase(), sourceUrl: entry.url,
      sourceCheckedAt: entry.source_checked_at ?? entry.checked_date, evidenceDigest: communicationsDigest(entry) };
  });
  if (new Set(matches.map((value: any) => value.email)).size !== 1) throw new Error("verified_contact_ambiguous");
  return matches[0];
}

export function assertContactUnknowns(candidate: any) {
  if (candidate.unknowns?.some((unknown: string) => /\b(?:contacts?|recipients?|e-?mail|permission|consent|unsubscribe|opt.out)\b/i.test(unknown))) {
    throw new Error("verified_contact_conflicting_unknowns");
  }
}
