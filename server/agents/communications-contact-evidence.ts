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
/** The one literal-address pattern shared by extraction and element-boundary checks. An address
 * starts and ends at a Unicode word edge, so it is never cut out of a longer visible word (next
 * to a non-ASCII letter, a soft hyphen, a zero-width or other invisible character). */
export const EMAIL = /(?<![\p{L}\p{N}\p{M}\p{Cf}\x00-\x08\x0e-\x1f\x7f-\x9f])[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?![\p{L}\p{N}\p{M}\p{Cf}\x00-\x08\x0e-\x1f\x7f-\x9f])/gu;
const emailsIn = (quote: string): string[] => [...new Set((quote.match(EMAIL) ?? []).map(email => email.toLowerCase()))];
export const restrictedContact = /\b(?:personal only|support only|technical (?:support|assistance)|customer support|careers?|jobs?|press|media|privacy|legal|do not contact|no unsolicited|not for business|unsubscribe|opt.out)\b/i;
export const contactProhibition = /\b(?:(?:do not|don['’]t) (?:contact|e-?mail|message|send|solicit|follow[ -]?up)|no (?:unsolicited|solicitations?|marketing|outreach)|no (?:more |further )?follow[ -]?ups?|not for business|(?:has|have|is|are|was|were) (?:already )?(?:unsubscribed|opted[ -]?out)|stop (?:emailing|contacting|messaging))\b/i;
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

// Missing prior-contact history is evidence uncertainty, not a recipient
// restriction. Remove only that phrase from classification; retain every
// original unknown and inspect the remaining text for consequential limits.
const priorContactUncertainty = /\b(?:(?:prior|previous)[ -]+contact(?:[ -]+history)?(?:\s+(?:is|remains?))?\s+(?:unknown|unverified|not (?:yet )?(?:known|checked|verified|established))|(?:unknown|unverified)\s+(?:prior|previous)[ -]+contact(?:[ -]+history)?)\b/gi;

/** Preserve site/data-sharing permission unknowns. Recipient prohibitions block;
 * only explicit missing-contact gaps can be resolved with a new sidecar proof. */
export function contactUnknowns(candidate: any) {
  const gaps: string[] = [], blocked: string[] = [];
  for (const unknown of candidate.unknowns ?? []) {
    if (contactProhibition.test(unknown) || /\b(?:unsubscribe|opt(?:ed)?[ ._-]?out)\b/i.test(unknown)) blocked.push(unknown);
    else if (/\b(?:permission|consent)\b/i.test(unknown) && !/\b(?:site|capture|data|sharing|disclos|deployment)\b/i.test(unknown)) blocked.push(unknown);
    else if (/\b(?:contacts?|recipients?|e-?mail|outreach)\b/i.test(unknown)) {
      const remaining = unknown.replace(priorContactUncertainty, "");
      const restricted = /\b(?:permission|consent|restriction|prohibit|unavailable|not available|refus)/i.test(remaining);
      if (!restricted && !/\b(?:contact(?:s|ed|ing)?|recipients?|e-?mail(?:ed)?|outreach)\b/i.test(remaining)) continue;
      if (!restricted
        && /\b(?:not (?:yet )?(?:identified|researched|verified|established)|no (?:verified |public |business )*contact.*identified|missing|unverified)\b/i.test(remaining)) gaps.push(unknown);
      else blocked.push(unknown);
    }
  }
  return { gaps, blocked };
}
export function assertContactUnknowns(candidate: any, resolvedMissingContacts = false) {
  const { gaps, blocked } = contactUnknowns(candidate);
  if (blocked.length || (!resolvedMissingContacts && gaps.length)) throw new Error("verified_contact_conflicting_unknowns");
}

// ---------------------------------------------------------------------------------------------
// Owner decision 2026-10-05 (contact sources), for outreach-ready hypotheses only
// (blueprint.contact-resolution.v2). Verified-lead contacts above are unchanged.

/** Consumer and free-mail providers: never an operator's own published business address. */
export const FREE_MAIL_DOMAINS: ReadonlySet<string> = new Set(["gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "ymail.com",
  "rocketmail.com", "outlook.com", "hotmail.com", "hotmail.co.uk", "live.com", "msn.com", "aol.com", "icloud.com", "me.com", "mac.com",
  "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net", "gmx.de", "mail.com", "zoho.com", "zohomail.com", "yandex.com", "yandex.ru",
  "fastmail.com", "hey.com", "tutanota.com", "tuta.io", "qq.com", "163.com", "126.com", "comcast.net", "verizon.net", "att.net",
  "sbcglobal.net", "bellsouth.net", "cox.net", "charter.net", "earthlink.net"]);

/** LinkedIn is never evidence for a person or an address: any linkedin.com or lnkd.in host. */
export function isLinkedInUrl(value: unknown) {
  try {
    const host = new URL(String(value)).hostname.toLowerCase().replace(/\.$/, "");
    return ["linkedin.com", "lnkd.in"].some(name => host === name || host.endsWith(`.${name}`));
  } catch { return false; }
}

// Careers, jobs, legal, privacy and support routes stay refused. Unlike restrictedContact, a press
// or media route is not refused: it ranks as a general inbox.
const restrictedPublishedRoute = /\b(?:personal only|support only|technical (?:support|assistance)|customer (?:support|service|care)|careers?|jobs?|recruit(?:ing|ment|ers?)?|hiring|privacy|legal|do not contact|no unsolicited|not for business|unsubscribe|opt.out)\b/i;
const restrictedLocalPart = /^(?:careers?|jobs?|recruit(?:ing|ment|ers?)?|hiring|talent|hr|legal|counsel|privacy|dpo|gdpr|data[._-]?protection|support|help|helpdesk|customer[._-]?(?:support|service|care)|tech[._-]?support|no[._-]?reply|do[._-]?not[._-]?reply|unsubscribe|abuse|postmaster|webmaster)(?:[._+-].*)?$/i;
const pressLocalPart = /^(?:press|media|pr|news(?:room)?|communications?)(?:[._+-].*)?$/i;

/** An address the operator itself publishes, verbatim and exactly once, in one visible segment of a
 * page on its own domain. The address's domain must be the operator's host or a subdomain of it: it
 * is never guessed, never derived from a name pattern and never taken from another organization.
 * Free-mail addresses and careers, jobs, legal, privacy and support routes are refused. A press
 * route is allowed and ranks as a general inbox. */
export function extractPublishedAddress(quote: string, candidate: any, pageUrl: string) {
  if (isLinkedInUrl(candidate?.organization_url) || isLinkedInUrl(pageUrl)) throw new Error("contact_source_linkedin_refused");
  let operatorPage = false;
  try { operatorPage = sameOperatorUrl(pageUrl, candidate.organization_url); } catch { operatorPage = false; }
  if (!operatorPage) throw new Error("contact_address_page_not_operator_domain");
  const emails = emailsIn(quote);
  if (emails.length !== 1 || !z.string().email().safeParse(emails[0]).success) throw new Error("contact_address_not_published_once");
  const email = emails[0], at = email.lastIndexOf("@"), local = email.slice(0, at), domain = email.slice(at + 1);
  if (FREE_MAIL_DOMAINS.has(domain)) throw new Error("contact_address_free_mail_refused");
  const owner = contactHost(candidate.organization_url);
  if (domain !== owner && !domain.endsWith(`.${owner}`)) throw new Error("contact_address_other_domain_refused");
  if (restrictedLocalPart.test(local) || restrictedPublishedRoute.test(quote) || contactProhibition.test(quote)) {
    throw new Error("contact_address_restricted_route");
  }
  return { email, press: pressLocalPart.test(local) || /\b(?:press|media)\b/i.test(quote) };
}

// A person's name: two capitalized words, with an optional middle initial ("Jane Q. Doe", "Mary-Kate
// O'Neil", "McDonald"). The role must carry a title word; it is kept exactly as published.
const NAME_WORD = "\\p{Lu}(?:\\p{Ll}+|['’]\\p{Lu}\\p{Ll}+)(?:\\p{Lu}\\p{Ll}+)?(?:-\\p{Lu}\\p{Ll}+)?";
const PERSON = new RegExp(`(?<![\\p{L}\\p{N}])(${NAME_WORD}(?: \\p{Lu}\\.)? ${NAME_WORD}),\\s+`, "gu");
const ROLE = /^[^,;:.()\n@]{2,120}?(?=\s*(?:[,;:.()\n]|$)|\s+(?:at|said|says|who|and|with|told|from|in)\b)/;
const TITLE = /\b(?:director|manager|head|lead|supervisor|superintendent|coordinator|officer|president|chief|owner|founder|engineer|planner|foreman|administrator|executive|principal)\b/i;
/** Every "Name, role" pair a quote publishes, verbatim. Anything else names no one. */
export function publishedPeople(quote: string) {
  const people: { name: string; role: string }[] = [];
  for (const match of quote.matchAll(PERSON)) {
    const role = ROLE.exec(quote.slice((match.index ?? 0) + match[0].length))?.[0].trim();
    if (role && TITLE.test(role) && role.split(/\s+/).length <= 10) people.push({ name: match[1], role });
  }
  return people;
}
// Words a shared or role inbox is named for. A local part with one of them is never one person's own,
// even when it is also a form of their name (sales@ for "Jordan Sales").
const ROLE_LOCAL_WORDS: ReadonlySet<string> = new Set(["accounts", "accounting", "admin", "administration", "all", "billing", "booking",
  "bookings", "business", "careers", "ceo", "compliance", "contact", "contacts", "contactus", "customer", "customers", "customercare",
  "customerservice", "director", "dispatch", "distribution", "engineering", "enquiries", "enquiry", "events", "facilities", "finance",
  "fleet", "founder", "frontdesk", "fulfillment", "fulfilment", "general", "hello", "help", "helpdesk", "hiring", "hr", "info",
  "information", "inquiries", "inquiry", "invoices", "it", "jobs", "legal", "logistics", "mail", "maintenance", "management", "manager",
  "marketing", "media", "news", "newsroom", "noreply", "office", "operations", "ops", "orders", "owner", "partners", "partnerships",
  "people", "planning", "plant", "postmaster", "pr", "president", "press", "privacy", "procurement", "production", "purchasing", "quality",
  "reception", "receiving", "recruiting", "recruitment", "returns", "safety", "sales", "security", "service", "services", "shipping", "site",
  "staff", "store", "support", "team", "tech", "warehouse", "webmaster", "welcome"]);
const foldName = (value: string) => value.normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
/** The address is this person's own: it is published in the same segment as their name, and its local
 * part is exactly one form of that name: first, last, first and last either way round, initial and
 * last either way round, or first and last initial, with any middle initials, joined by ".", "_", "-"
 * or nothing, with optional trailing digits. Part of a longer word never counts ("Ann" in planning@,
 * "Mark" in marketing@, "Ian" in compliance@), nor does a role word. This checks a published address;
 * it never builds one. */
export function addressIsPersonOwn(email: string, segment: string, name: string) {
  if (!containsContactName(segment, name)) return false;
  const tokens = foldName(email.slice(0, email.lastIndexOf("@"))).replace(/\d+$/, "").split(/[._-]/);
  if (tokens.some(token => !/^\p{L}+$/u.test(token) || ROLE_LOCAL_WORDS.has(token))) return false;
  const words = foldName(name).split(/\s+/).map(word => word.replace(/[^\p{L}-]+/gu, "").replace(/^-+|-+$/g, "")).filter(Boolean);
  if (words.length < 2) return false;
  // A hyphenated first or last name also counts by each of its parts ("Mary-Kate": marykate, mary, kate).
  const variants = (word: string) => [...new Set([word.replaceAll("-", ""), ...word.split("-").filter(Boolean)])];
  const middle = words.slice(1, -1).map(word => word[0]).join(""), forms = new Set<string>();
  for (const first of variants(words[0])) for (const last of variants(words.at(-1)!)) {
    for (const form of [first, last, first + last, last + first, first[0] + last, last + first[0], first + last[0]]) forms.add(form);
    if (middle) for (const form of [first + middle + last, first[0] + middle + last]) forms.add(form);
  }
  return forms.has(tokens.join(""));
}
