import { z } from "zod";
import { communicationsDigest } from "./communications-contract";

export const PUBLIC_CONTACT_PREFIX = "blueprint.public-business-contact.v1:";
export const publishedPublicContactSchema = z.object({
  organization: z.string().min(1).max(200), site: z.string().min(1).max(300),
  email: z.string().email().max(254), purpose: z.literal("business_inquiries"),
  status: z.literal("public_business_contact"),
}).strict();

/** Strip only the conventional leading www label. Never infer a registrable domain. */
export const contactHost = (value: string) => new URL(value).hostname.toLowerCase().replace(/^www\./, "");
export function sameOperatorUrl(value: string, organizationUrl: string) {
  const url = new URL(value), org = new URL(organizationUrl), host = contactHost(value), owner = contactHost(organizationUrl);
  return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
    && ["https:", "http:"].includes(org.protocol) && !org.username && !org.password
    && (host === owner || host.endsWith(`.${owner}`));
}
const emailsIn = (quote: string): string[] => [...new Set((quote.match(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []).map(email => email.toLowerCase()))];
export const restrictedContact = /\b(?:personal only|support only|technical (?:support|assistance)|customer support|careers?|jobs?|press|media|privacy|legal|do not contact|no unsolicited|not for business|unsubscribe|opt.out)\b/i;
export const contactProhibition = /\b(?:(?:do not|don't) (?:contact|e-?mail|message|send|solicit)|no (?:unsolicited|solicitations?|marketing|outreach)|not for business|(?:has|have|is|are|was|were) (?:already )?(?:unsubscribed|opted[ -]?out)|stop (?:emailing|contacting|messaging))\b/i;
const businessRoute = /\b(?:public business contact|business (?:inquiries|enquiries)|commercial (?:inquiries|enquiries)|partnership (?:inquiries|enquiries))\b/i;
// An operator's general inquiry invitation establishes an organization route,
// never a named recipient or site authority. Keep unrelated account/personal routes out.
const generalContactRoute = /\bfor more information,?\s+contact us on\b/i;
const unrelatedGeneralRoute = /\b(?:newsletters?|subscrib(?:e|ing)|subscriptions?|log[ -]?in|sign[ -]?in|passwords?|personal|private)\b/i;
export const supportedBusinessRoute = (quote: string) => businessRoute.test(quote)
  || (generalContactRoute.test(quote) && !unrelatedGeneralRoute.test(quote));
export function containsContactName(quote: string, name: string) {
  const normalized = (text: string) => text.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
  const haystack = normalized(quote), needle = normalized(name);
  if (!needle) return false;
  let position = haystack.indexOf(needle);
  while (position >= 0) {
    if (!/[\p{L}\p{N}]/u.test(haystack[position - 1] ?? "") && !/[\p{L}\p{N}]/u.test(haystack[position + needle.length] ?? "")) return true;
    position = haystack.indexOf(needle, position + 1);
  }
  return false;
}

/** A single segment ties a literal email to a business route. Organization scope
 * establishes neither site control nor permission to share site data. */
export function extractBusinessContact(quote: string, candidate: any, legacySiteAssertion = false, organizationIdentified = false) {
  const emails = emailsIn(quote);
  if (emails.length !== 1 || !z.string().email().safeParse(emails[0]).success || !supportedBusinessRoute(quote)
    || restrictedContact.test(quote) || contactProhibition.test(quote)
    || (!legacySiteAssertion && !organizationIdentified && !containsContactName(quote, candidate.organization))) {
    throw new Error("verified_contact_source_binding_invalid");
  }
  return { email: emails[0], scope: businessRoute.test(quote) && (legacySiteAssertion || containsContactName(quote, candidate.site))
    ? "site" as const : "organization_business_route" as const };
}

/** Consume ordinary source-QA-approved prose. The old prefix is optional. */
export function publishedPublicContact(candidate: any) {
  assertContactUnknowns(candidate);
  const assertions = (candidate.evidence ?? []).filter((entry: any) => typeof entry.claim === "string"
    && (entry.claim.startsWith(PUBLIC_CONTACT_PREFIX) || (entry.classification === "operator" && entry.claim_kind === "fact"
      && entry.origin === "live" && entry.assertion_scope === "current_operational"
      && supportedBusinessRoute(entry.quote ?? "") && emailsIn(entry.quote ?? "").length)));
  if (!assertions.length) throw new Error("verified_public_business_contact_missing");
  const matches = assertions.map((entry: any) => {
    const legacy = entry.claim.startsWith(PUBLIC_CONTACT_PREFIX);
    let value;
    if (legacy) {
      try { value = publishedPublicContactSchema.parse(JSON.parse(entry.claim.slice(PUBLIC_CONTACT_PREFIX.length))); }
      catch { throw new Error("verified_contact_assertion_invalid"); }
    }
    const contact = extractBusinessContact(String(entry.quote ?? ""), candidate, legacy, containsContactName(entry.claim, candidate.organization));
    if ((value && (value.organization !== candidate.organization || value.site !== candidate.site || value.email.toLowerCase() !== contact.email))
      || entry.classification !== "operator" || entry.claim_kind !== "fact" || entry.origin !== "live"
      || entry.assertion_scope !== "current_operational"
      || !sameOperatorUrl(entry.url, candidate.organization_url)) {
      throw new Error("verified_contact_source_binding_invalid");
    }
    return { ...contact, sourceUrl: entry.url, kind: "published_evidence" as const, resolvedGaps: [] as string[],
      sourceCheckedAt: entry.source_checked_at ?? entry.checked_date, evidenceDigest: communicationsDigest(entry) };
  });
  if (new Set(matches.map((value: any) => value.email)).size !== 1) throw new Error("verified_contact_ambiguous");
  return matches[0];
}

/** Preserve site/data-sharing permission unknowns. Recipient prohibitions block;
 * only explicit missing-contact gaps can be resolved with a new sidecar proof. */
export function contactUnknowns(candidate: any) {
  const gaps: string[] = [], blocked: string[] = [];
  for (const unknown of candidate.unknowns ?? []) {
    if (contactProhibition.test(unknown) || /\b(?:unsubscribe|opt(?:ed)?[ ._-]?out)\b/i.test(unknown)) blocked.push(unknown);
    else if (/\b(?:permission|consent)\b/i.test(unknown) && !/\b(?:site|capture|data|sharing|disclos|deployment)\b/i.test(unknown)) blocked.push(unknown);
    else if (/\b(?:contacts?|recipients?|e-?mail|outreach)\b/i.test(unknown)) {
      if (!/\b(?:permission|consent|restriction|prohibit|unavailable|not available|refus)/i.test(unknown)
        && /\b(?:not (?:yet )?(?:identified|researched|verified|established)|no (?:verified |public |business )*contact.*identified|missing|unverified)\b/i.test(unknown)) gaps.push(unknown);
      else blocked.push(unknown);
    }
  }
  return { gaps, blocked };
}
export function assertContactUnknowns(candidate: any, resolvedMissingContacts = false) {
  const { gaps, blocked } = contactUnknowns(candidate);
  if (blocked.length || (!resolvedMissingContacts && gaps.length)) throw new Error("verified_contact_conflicting_unknowns");
}
