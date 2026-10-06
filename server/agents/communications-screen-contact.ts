import { createHash } from "node:crypto";
import { z } from "zod";
import { communicationsDigest, RECIPIENT_ROUTES, type CommunicationsRecipient, type RecipientProvenance } from "./communications-contract";
import { addressIsPersonOwn, containsContactName, contactProhibition, extractPublishedAddress, FREE_MAIL_DOMAINS, isLinkedInUrl,
  localPartIsRole } from "./communications-contact-evidence";
import { contactPageText, literalAddressUnsafe, VISIBILITY_BASIS } from "./communications-contact-resolution";
import { CONTACT_RESEARCH_PAGE_LIMIT, contactFetchUrl, type ContactPageReader } from "./communications-contact-fetch";

/** The recipient of one site-screen hypothesis (Pipeline tools/daily_research/screen_admission.py), checked for drafting.
 * Owner decisions 2026-10-05: contact sources, provider lookup and provider-sourced person.
 *
 * The bundle names the recipient in the owner's order: a published person email; a looked-up email for a person a
 * public quote names; a provider-sourced person, corroborated by a public page or not; a published team inbox; a
 * published general inbox. Its address must lie on the operator's own domain, proven in the bundle either by the page
 * whose quote names the operator (basis operator_quote) or, under contact rule v3, by the website answer's domain where
 * site_screen's own read of a page on that domain names the operator (basis website); the bare website answer alone, a
 * directory, data broker, job board, social, map, newswire, government, free-mail or LinkedIn host never counts.
 *
 * A published address is found again on a freshly fetched page of that domain before it is used (admitScreenContact),
 * with the same extraction rules as every hypothesis contact. A looked-up address is never searched for on a page; the operator domain is checked independently. It
 * counts only with its provider check (status valid), on the proven domain, never free mail or a role inbox, for a named
 * person. Every proof is rechecked from its retained page bytes before each draft (verifyScreenContactResolution). */
export const SCREEN_CONTACT_VERSION = "blueprint.screen-contact-resolution.v1" as const;
const SCREEN_CONTACT_QA = "blueprint.screen-contact-qa.v1" as const;
const EXTRACTOR = "blueprint.published-address-text.v1" as const;
const RECIPIENT_VERSION = "blueprint.site-screen-recipient.v1";
/** Founder-facing labels, word for word as the Pipeline writes them in the CRM row. */
export const SCREEN_RECIPIENT_LABELS: Record<(typeof RECIPIENT_ROUTES)[number], string> = {
  published_person_email: "published person email",
  quoted_person_looked_up_email: "looked-up email, quoted person",
  provider_sourced_corroborated: "looked-up email, provider-sourced person, corroborated",
  provider_sourced_uncorroborated: "looked-up email, provider-sourced person, not corroborated",
  published_team_inbox: "published team inbox",
  published_general_inbox: "published general inbox",
};
const screenWords = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/ +/).filter(Boolean);
const screenHasName = (text: string, name: string) => ` ${screenWords(text).join(" ")} `.includes(` ${screenWords(name).join(" ")} `);
/** Same evidence-preserving role comparison as contact_lookup.holds_title (word order and fillers may differ). */
export function screenHoldsTitle(text: string, title: string) {
  const have = new Set(screenWords(text)), filler = new Set(["of", "the", "and", "for", "at", "senior", "sr"]);
  const wanted = screenWords(title).filter(word => !filler.has(word));
  return wanted.length > 0 && wanted.every(word => have.has(word));
}
const SCREEN_TEAM = new Set(["sales", "operations", "ops", "plant", "engineering", "manufacturing", "production", "purchasing", "procurement", "quality", "maintenance", "automation", "innovation", "projects", "service", "orders", "business", "partnerships"]);
const SCREEN_GENERAL = new Set(["info", "contact", "contacts", "hello", "office", "mail", "enquiries", "enquiry", "inquiries", "inquiry", "general", "admin", "reception", "press", "media", "pr", "news", "communications"]);
const SCREEN_REFUSED = new Set(["careers", "career", "jobs", "job", "hr", "recruiting", "recruitment", "talent", "hiring", "legal", "privacy", "support", "help", "helpdesk", "noreply", "donotreply", "billing", "accounts", "invoices", "webmaster", "abuse", "security", "unsubscribe"]);
function screenAddressRole(address: string, person: any) {
  const parts = address.split("@")[0].match(/[a-z]+/g) ?? [], letters = parts.join("");
  for (const [role, vocabulary] of [["refused", SCREEN_REFUSED], ["team", SCREEN_TEAM], ["general", SCREEN_GENERAL]] as const) {
    if (parts.some(word => vocabulary.has(word))) return role;
  }
  return person && screenWords(String(person.name)).some(word => word.length >= 3 && letters.includes(word)) ? "person" : "unknown";
}
function screenFreshDate(value: unknown, checked: string) {
  const parts = /^([0-9]{4})(?:-([0-9]{2}))?(?:-([0-9]{2}))?$/.exec(String(value ?? ""));
  const year = Number(parts?.[1]), month = Number(parts?.[2] ?? "1"), day = Number(parts?.[3] ?? "1");
  const date = parts ? Date.UTC(year, month - 1, day) : NaN, parsed = new Date(date), asOf = Date.parse(checked.slice(0, 10));
  return Number.isFinite(date) && parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    && asOf >= date && asOf - date <= 548 * 86400000;
}
const LOOKUP_ROUTES: readonly string[] = ["quoted_person_looked_up_email", "provider_sourced_corroborated", "provider_sourced_uncorroborated"];
const PROVEN = ["verified_on_page", "in_citation_excerpt"] as const;
// Mirrors tools/daily_research/site_screen.py NOT_OPERATOR_DOMAINS and FREE_MAIL: hosts whose pages never give an
// operator's own domain, and consumer mail.
const NOT_OPERATOR_DOMAINS: ReadonlySet<string> = new Set(["accesswire.com", "adp.com", "apollo.io", "applytojob.com", "bamboohr.com",
  "bbb.org", "bing.com", "bizapedia.com", "bloomberg.com", "breezy.hr", "businesswire.com", "buzzfile.com", "careerbuilder.com",
  "chamberofcommerce.com", "craft.co", "crunchbase.com", "dnb.com", "einpresswire.com", "facebook.com", "glassdoor.com", "globalspec.com",
  "globenewswire.com", "google.com", "greenhouse.io", "icims.com", "indeed.com", "industrynet.com", "instagram.com", "iqsdirectory.com",
  "jazzhr.com", "jobvite.com", "kompass.com", "lever.co", "lusha.com", "macraesbluebook.com", "manta.com", "mapquest.com", "medium.com",
  "monster.com", "myworkdayjobs.com", "opencorporates.com", "owler.com", "paylocity.com", "pinterest.com", "pitchbook.com", "prnewswire.com",
  "recruitee.com", "reddit.com", "rocketreach.co", "signalhire.com", "simplyhired.com", "smartrecruiters.com", "snagajob.com", "superpages.com",
  "taleo.net", "thomasnet.com", "tiktok.com", "twitter.com", "ultipro.com", "wikipedia.org", "workable.com", "workday.com", "x.com",
  "yellowpages.com", "yelp.com", "youtube.com", "ziprecruiter.com", "zoominfo.com", "linkedin.com", "lnkd.in"]);
const SCREEN_FREE_MAIL: ReadonlySet<string> = new Set(["aol.com", "att.net", "bellsouth.net", "charter.net", "comcast.net", "cox.net",
  "earthlink.net", "fastmail.com", "gmail.com", "gmx.com", "gmx.net", "googlemail.com", "hey.com", "hotmail.com", "icloud.com", "live.com",
  "mac.com", "mail.com", "me.com", "msn.com", "outlook.com", "proton.me", "protonmail.com", "sbcglobal.net", "tutanota.com", "verizon.net",
  "yahoo.com", "yandex.com", "ymail.com", "zoho.com"]);
const INVALID = "screen_contact_recipient_invalid";

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const nonblank = (value: unknown, max = 1200): value is string => typeof value === "string" && !!value.trim() && value.length <= max;
const keysAre = (value: unknown, keys: string[]) => !!value && typeof value === "object" && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const fail = (code: string): never => { throw new Error(code); };
function hostOf(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) && url.hostname ? url.hostname.toLowerCase().replace(/\.$/, "") : null;
  } catch { return null; }
}
const publicUrl = (value: unknown) => {
  try {
    const url = new URL(String(value));
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && !isLinkedInUrl(value);
  } catch { return false; }
};
/** The registrable domain of a URL or host, as site_screen.site_domain: its last two labels, or three under a
 * two-letter country code's second level (co.uk). */
export function registrableDomain(value: unknown) {
  const labels = (hostOf(value) ?? "").split(".");
  if (labels.length >= 3 && labels.at(-1)!.length === 2 && ["co", "com", "net", "org", "gov", "ac", "edu"].includes(labels.at(-2)!)) {
    return labels.slice(-3).join(".");
  }
  return labels.length >= 2 && labels.slice(-2).every(Boolean) ? labels.slice(-2).join(".") : null;
}
const governmentHost = (host: string) => /\.(?:gov|mil|fed\.us)$/.test(host) || /\.(?:gov|mil)\.[a-z]{2}$/.test(host)
  || /\.state\.[a-z]{2}\.us$/.test(host);
const onDomain = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
const freeMail = (domain: string) => FREE_MAIL_DOMAINS.has(domain) || SCREEN_FREE_MAIL.has(domain)
  || SCREEN_FREE_MAIL.has(registrableDomain(domain) ?? "") || FREE_MAIL_DOMAINS.has(registrableDomain(domain) ?? "");

/** What the recipient checks read from one bundle result: the recipient, the proving quotes and the website answer. */
export type ScreenRecipientContext = { recipient: any; proofs: any[]; answers: { website?: unknown } };

/** The operator's own domain as the bundle proves it, or a stable refusal. Basis operator_quote: the domain of the
 * page whose proven quote names the operator, bound to that proof. Basis website: the website answer's registrable
 * domain, with the page on it that site_screen read naming the operator. Never a refused host. */
export function screenOperatorDomain(context: ScreenRecipientContext) {
  const proof = context.recipient?.operator_domain;
  if (!keysAre(proof, ["basis", "domain", "text_sha256", "url"]) || !hex(proof.text_sha256) || typeof proof.domain !== "string"
    || proof.domain !== proof.domain.toLowerCase()) fail("screen_contact_operator_domain_invalid");
  const host = hostOf(proof.url);
  if (!host || !onDomain(host, proof.domain) || !publicUrl(proof.url) || NOT_OPERATOR_DOMAINS.has(proof.domain) || freeMail(proof.domain)
    || governmentHost(host) || registrableDomain(proof.domain) !== proof.domain) fail("screen_contact_operator_domain_refused");
  if (proof.basis === "operator_quote") {
    const operator = (Array.isArray(context.proofs) ? context.proofs : []).find(item => item?.claim === "operator");
    if (!operator || operator.url !== proof.url || operator.text_sha256 !== proof.text_sha256
      || registrableDomain(proof.url) !== proof.domain) fail("screen_contact_operator_domain_unproven");
  } else if (proof.basis === "website") {
    if (registrableDomain(context.answers?.website) !== proof.domain) fail("screen_contact_operator_domain_unproven");
  } else fail("screen_contact_operator_domain_invalid");
  return { domain: proof.domain as string, basis: proof.basis as "operator_quote" | "website", url: proof.url as string,
    textSha256: proof.text_sha256 as string };
}

const providerSchema = z.object({ name: z.literal("fullenrich"), status: z.literal("valid"), score: z.number().int().min(0).max(100).nullable(), verification_status: z.literal("DELIVERABLE"), lookup_sha256: z.string().regex(/^[a-f0-9]{64}$/), record_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  checked_at: z.string().datetime({ offset: true }), request_digest: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

/** The person behind a recipient, or null. A public-quote person needs the name in its proven quote, and its role only
 * when the same quote publishes it; a provider-sourced person keeps the provider's title as its role, and is
 * corroborated only by a proven public quote that names them. LinkedIn is never a source. */
export function screenPerson(recipient: any) {
  const person = recipient?.person;
  if (person === null || person === undefined) return null;
  if (person.source === "public_quote") {
    if (!nonblank(person.name, 200) || !nonblank(person.quote) || !screenHasName(person.quote, person.name)
      || !publicUrl(person.url) || !PROVEN.includes(person.level)) fail("screen_contact_person_invalid");
    const role = nonblank(person.title, 200) && screenHoldsTitle(person.quote, person.title) ? person.title.trim() : null;
    return { name: person.name.trim(), role, sourceUrl: person.url as string, quote: person.quote as string, level: person.level as string,
      checkedAt: typeof person.date === "string" && person.date ? person.date : null, source: "public_quote" as const, corroborated: null };
  }
  if (person.source === "provider_sourced" && typeof person.corroborated === "boolean" && nonblank(person.name, 200) && nonblank(person.title, 200)) {
    const employment = person.proof?.current_employment;
    if (person.proof?.source !== "fullenrich_people_search" || !hex(person.proof.request_digest)
      || !employment || !["employment.current.is_current", "employment.current.end_at_absent", "employment.all.is_current"].includes(employment.field)
      || typeof employment.company_domain !== "string" || !onDomain(employment.company_domain, recipient.operator_domain.domain)) fail("screen_contact_person_invalid");
    const proof = person.corroboration;
    if (person.corroborated && !(keysAre(proof, ["level", "quote", "text_sha256", "url"]) && publicUrl(proof.url) && PROVEN.includes(proof.level)
      && nonblank(proof.quote) && screenHasName(proof.quote, person.name) && screenHoldsTitle(proof.quote, person.title) && hex(proof.text_sha256))) fail("screen_contact_person_invalid");
    if (!person.corroborated && proof !== null) fail("screen_contact_person_invalid");
    return { name: person.name.trim(), role: person.title.trim() as string | null, sourceUrl: person.corroborated ? proof.url as string : null,
      quote: person.corroborated ? proof.quote as string : null, level: person.corroborated ? proof.level as string : "provider_record",
      checkedAt: null, source: "provider_sourced" as const, corroborated: person.corroborated as boolean, providerProof: person.proof };
  }
  return fail("screen_contact_person_invalid");
}

/** None for a bundle recipient in exactly the shape the Pipeline makes (screen_admission.recipient_problem), with its
 * operator domain proven, else a stable code. A null recipient is valid: the site has no contact. */
export function screenRecipientProblem(context: ScreenRecipientContext): string | null {
  const r = context.recipient;
  if (r === null) return null;
  try {
    if (!keysAre(r, ["address", "address_source", "label", "operator_domain", "person", "provider", "published", "rank", "route", "schema_version"])
      || r.schema_version !== RECIPIENT_VERSION || !(RECIPIENT_ROUTES as readonly string[]).includes(r.route)
      || r.rank !== RECIPIENT_ROUTES.indexOf(r.route) + 1 || r.label !== SCREEN_RECIPIENT_LABELS[r.route as keyof typeof SCREEN_RECIPIENT_LABELS]
      || typeof r.address !== "string" || r.address !== r.address.toLowerCase() || !z.string().email().safeParse(r.address).success) return INVALID;
    const domain = screenOperatorDomain(context).domain, host = r.address.slice(r.address.lastIndexOf("@") + 1);
    if (!onDomain(host, domain) || freeMail(host)) return INVALID;
    if (LOOKUP_ROUTES.includes(r.route)) {
      if (r.address_source !== "provider_lookup" || r.published !== null || !providerSchema.safeParse(r.provider).success
        || localPartIsRole(r.address) || screenAddressRole(r.address, r.person) !== "person") return INVALID;
      const source = r.person?.source;
      if (r.route === "quoted_person_looked_up_email") {
        if (r.person.current !== true || !screenFreshDate(r.person.date, r.provider.checked_at)
          || !screenHasName(r.person.quote, r.person.name) || !screenHoldsTitle(r.person.quote, r.person.title)) return INVALID;
      }
      if (r.route === "quoted_person_looked_up_email" ? source !== "public_quote" || !hex(r.person.text_sha256)
        : source !== "provider_sourced" || r.person.corroborated !== (r.route === "provider_sourced_corroborated")) return INVALID;
    } else {
      const published = r.published;
      if (r.address_source !== "published" || r.provider !== null || !keysAre(published, ["checked_on", "level", "quote", "text_sha256", "url"])
        || published.level !== "verified_on_page" || !publicUrl(published.url) || typeof published.quote !== "string"
        || !published.quote.toLowerCase().includes(r.address) || !hex(published.text_sha256)
        || !/^\d{4}-\d{2}-\d{2}$/.test(published.checked_on)) return INVALID;
      if (r.person !== null && r.person?.source !== "public_quote") return INVALID;
      const role = ({ published_person_email: "person", published_team_inbox: "team", published_general_inbox: "general" } as Record<string, string>)[r.route];
      if (screenAddressRole(r.address, r.person) !== role) return INVALID;
      if (r.route === "published_person_email" && (!r.person || r.person.current !== true
        || !screenFreshDate(r.person.date, published.checked_on) || !screenHasName(r.person.quote, r.person.name)
        || !screenHoldsTitle(r.person.quote, r.person.title))) return INVALID;
    }
    screenPerson(r);
  } catch (error) {
    return error instanceof Error && /^screen_contact_[a-z_]+$/.test(error.message) ? error.message : INVALID;
  }
  return null;
}

/** What a screen contact proof binds and the recipient checks read from one verified screen source. */
export type ScreenContactSource = {
  screenAdmissionId: string; candidateKey: string; resultDigest: string; sheetsId: string; sheetsProspectId: string;
  candidate: { organization: string; site: string; task: string };
  recipient: any; answers: { website?: unknown }; hypothesis: { provingSources: any[] };
};
const contextOf = (source: ScreenContactSource): ScreenRecipientContext => ({ recipient: source.recipient,
  proofs: source.hypothesis.provingSources, answers: source.answers });
export function screenContactPublication(source: ScreenContactSource, prospectId: string) {
  return { screenAdmissionId: source.screenAdmissionId, siteKey: source.candidateKey, resultDigest: source.resultDigest,
    sourceDigest: communicationsDigest(source), sheetsId: source.sheetsId, sheetsProspectId: source.sheetsProspectId, prospectId };
}

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const pageSchema = z.object({ requestedUrl: z.string().url(), finalUrl: z.string().url(), redirects: z.array(z.string().url()).max(2),
  checkedAt: z.string().datetime(), status: z.literal(200), contentType: z.string().max(200),
  bodyBase64: z.string().max(Math.ceil(CONTACT_RESEARCH_PAGE_LIMIT / 3) * 4), bodyDigest: digest,
  byteCount: z.number().int().positive().max(CONTACT_RESEARCH_PAGE_LIMIT) }).strict();
const screenContactBaseSchema = z.object({
  version: z.literal(SCREEN_CONTACT_VERSION),
  publication: z.object({ screenAdmissionId: digest, siteKey: digest, resultDigest: digest, sourceDigest: digest, sheetsId: z.string().min(1),
    sheetsProspectId: z.string().min(1), prospectId: z.string().min(1) }).strict(),
  route: z.enum(RECIPIENT_ROUTES), label: z.string().min(1).max(200), addressSource: z.enum(["published", "provider_lookup"]),
  operatorDomain: z.object({ domain: z.string().min(1).max(253), basis: z.enum(["operator_quote", "website"]), url: z.string().url(),
    textSha256: digest }).strict(),
  pages: z.array(pageSchema).max(2),
  extraction: z.object({ version: z.literal(EXTRACTOR), pageIndex: z.number().int().min(0).max(1), segmentIndex: z.number().int().nonnegative(),
    quote: z.string().min(1).max(1200), visibleTextDigest: digest, visibilityBasis: z.literal(VISIBILITY_BASIS) }).strict().nullable(),
  provider: z.object({ name: z.string().min(1).max(80), status: z.literal("valid"), score: z.number().int().min(0).max(100).nullable(), verificationStatus: z.literal("DELIVERABLE"), lookupDigest: digest, recordDigest: digest,
    checkedAt: z.string().datetime({ offset: true }), requestDigest: digest }).strict().nullable(),
  person: z.object({ name: z.string().min(1).max(200), role: z.string().min(1).max(200).nullable(), sourceUrl: z.string().url().nullable(),
    quote: z.string().min(1).max(1200).nullable(), level: z.enum([...PROVEN, "provider_record"]), checkedAt: z.string().max(64).nullable(),
    source: z.enum(["public_quote", "provider_sourced"]), corroborated: z.boolean().nullable(), providerProof: z.object({ source: z.literal("fullenrich_people_search"), request_digest: digest,
    current_employment: z.object({ field: z.enum(["employment.current.is_current", "employment.current.end_at_absent", "employment.all.is_current"]),
      company_domain: z.string().min(1), start_at: z.string().nullable() }).strict() }).strict().optional() }).strict().nullable(),
  addressIsPersonal: z.boolean(),
  contact: z.object({ email: z.string().email(), route: z.enum(["named_person", "team_inbox", "general_inbox", "looked_up_person"]),
    scope: z.enum(["site", "organization_business_route"]), organization: z.string().min(1), site: z.string().nullable(),
    status: z.enum(["public_business_contact", "looked_up_business_contact"]), sourceUrl: z.string().url(), sourceCheckedAt: z.string().min(1) }).strict(),
}).strict();
export const screenContactResolutionSchema = screenContactBaseSchema.extend({
  qa: z.object({ version: z.literal(SCREEN_CONTACT_QA), state: z.literal("approved"), reviewedBy: z.literal("blueprint-communications-contact-verifier"),
    reviewedAt: z.string().datetime(), inputDigest: digest }).strict(),
});
export type ScreenContactResolution = z.infer<typeof screenContactResolutionSchema>;
type ScreenPage = z.infer<typeof pageSchema>;

/** The deterministic contact both admitScreenContact and the verifier derive from one source and the retained pages. */
function deriveScreenContact(source: ScreenContactSource, prospectId: string, pages: ScreenPage[]) {
  const recipient = source.recipient;
  if (!recipient) fail("screen_recipient_missing");
  const problem = screenRecipientProblem(contextOf(source));
  if (problem) fail(problem);
  const domain = screenOperatorDomain(contextOf(source)), person = screenPerson(recipient), address: string = recipient.address;
  const organizationUrl = `https://${domain.domain}`;
  const hostUrl = contactFetchUrl(domain.url, organizationUrl).href;
  {
    const hostPage = pages.find(page => page.requestedUrl === hostUrl) ?? fail("screen_contact_operator_page_missing");
    const bytes = Buffer.from(hostPage.bodyBase64, "base64");
    if (hostPage.byteCount !== bytes.length || hostPage.bodyDigest !== sha256(bytes)
      || hostPage.finalUrl !== (hostPage.redirects.at(-1) ?? hostPage.requestedUrl)) fail("contact_resolution_retrieval_changed");
    for (const url of [hostPage.finalUrl, ...hostPage.redirects]) contactFetchUrl(url, organizationUrl);
    const parsed = contactPageText(hostPage);
    if (contactProhibition.test(parsed.restrictionText)) fail("contact_resolution_recipient_restricted");
    if (parsed.visibilityUnverified || !parsed.segments.some(text => containsContactName(text, source.candidate.organization))) {
      fail("screen_contact_operator_domain_unproven");
    }
  }
  let extraction: z.infer<typeof screenContactBaseSchema>["extraction"] = null, contact, addressIsPersonal: boolean;
  if (recipient.address_source === "published") {
    const pageIndex = pages.findIndex(page => page.requestedUrl === contactFetchUrl(recipient.published.url, organizationUrl).href);
    if (pageIndex < 0) fail("screen_contact_page_missing");
    const page = pages[pageIndex], bytes = Buffer.from(page.bodyBase64, "base64");
    if (page.requestedUrl !== contactFetchUrl(recipient.published.url, organizationUrl).href || page.byteCount !== bytes.length
      || page.bodyDigest !== sha256(bytes) || page.finalUrl !== (page.redirects.at(-1) ?? page.requestedUrl)) fail("contact_resolution_retrieval_changed");
    for (const url of [page.finalUrl, ...page.redirects]) contactFetchUrl(url, organizationUrl);
    const parsed = contactPageText(page);
    if (contactProhibition.test(parsed.restrictionText)) fail("contact_resolution_recipient_restricted");
    if (parsed.visibilityUnverified) fail("contact_resolution_visibility_unverified");
    let found = -1;
    for (const [index, quote] of parsed.segments.entries()) {
      if (quote.length > 1200 || literalAddressUnsafe(quote, parsed.joins[index], parsed.edges[index])) continue;
      try {
        if (extractPublishedAddress(quote, { organization_url: organizationUrl }, page.finalUrl).email === address) { found = index; break; }
      } catch (error) {
        if (error instanceof Error && error.message === "contact_source_linkedin_refused") throw error;
      }
    }
    if (found < 0) fail("screen_contact_address_not_on_fresh_page");
    extraction = { version: EXTRACTOR, pageIndex, segmentIndex: found, quote: parsed.segments[found],
      visibleTextDigest: communicationsDigest({ segments: parsed.segments, restrictionText: parsed.restrictionText,
        visibilityUnverified: parsed.visibilityUnverified }), visibilityBasis: VISIBILITY_BASIS };
    // Greeted by name only when the address is the person's own by the same rule as every hypothesis contact.
    addressIsPersonal = recipient.route === "published_person_email" && !localPartIsRole(address) && !!person?.role && addressIsPersonOwn(address, extraction.quote, person.name);
    const scope = containsContactName(extraction.quote, source.candidate.site) ? "site" as const : "organization_business_route" as const;
    contact = { email: address, route: addressIsPersonal ? "named_person" as const : recipient.route === "published_team_inbox" ? "team_inbox" as const
      : "general_inbox" as const, scope, organization: source.candidate.organization, site: scope === "site" ? source.candidate.site : null,
      status: "public_business_contact" as const, sourceUrl: page.finalUrl, sourceCheckedAt: page.checkedAt };
  } else {
    // A looked-up address is never searched for on a page: its provider check is its evidence.
    if (pages.length !== 1) fail("screen_contact_lookup_page_unexpected");
    addressIsPersonal = !!person?.role;
    contact = { email: address, route: "looked_up_person" as const, scope: "organization_business_route" as const,
      organization: source.candidate.organization, site: null, status: "looked_up_business_contact" as const,
      sourceUrl: person?.sourceUrl ?? domain.url, sourceCheckedAt: recipient.provider.checked_at as string };
  }
  const provider = recipient.provider ? { name: recipient.provider.name, status: recipient.provider.status, score: recipient.provider.score,
    checkedAt: recipient.provider.checked_at, requestDigest: recipient.provider.request_digest,
    verificationStatus: recipient.provider.verification_status, lookupDigest: recipient.provider.lookup_sha256, recordDigest: recipient.provider.record_sha256 } : null;
  return { version: SCREEN_CONTACT_VERSION, publication: screenContactPublication(source, prospectId), route: recipient.route,
    label: recipient.label, addressSource: recipient.address_source, operatorDomain: domain, pages, extraction, provider, person,
    addressIsPersonal, contact };
}

/** The draft's recipient and its founder-facing provenance: a named person only for their own address (a published
 * address of that form, or a looked-up one the provider verified for them), else whoever runs the task. */
export function screenRecipient(proof: Pick<ScreenContactResolution, "person" | "addressIsPersonal" | "route" | "label" | "addressSource" | "provider">,
  candidate: { task: string; site: string }): CommunicationsRecipient {
  const person = proof.person;
  const provenance: RecipientProvenance = { route: proof.route, label: proof.label, addressSource: proof.addressSource,
    personSource: person?.source ?? null, corroborated: person?.source === "provider_sourced" ? person.corroborated : null,
    provider: proof.provider ? { ...proof.provider } : null };
  if (proof.addressIsPersonal && person?.role) return { kind: "named_person", name: person.name, role: person.role, sourceUrl: person.sourceUrl, provenance };
  const behind = person?.source === "public_quote" && person.role && person.sourceUrl ? { name: person.name, role: person.role, sourceUrl: person.sourceUrl } : null;
  return { kind: "inbox", addressee: `whoever runs ${candidate.task} at ${candidate.site}`, person: behind, provenance };
}

/** Contact research for one screen hypothesis: one fresh fetch, within 24 seconds, of the published address's page on
 * the operator's domain, or no fetch for a looked-up address. No model, Gmail, send or guess. */
export async function admitScreenContact(source: ScreenContactSource, prospectId: string, readPage: ContactPageReader, now: () => number) {
  const recipient = source.recipient;
  if (!recipient) fail("screen_recipient_missing");
  const problem = screenRecipientProblem(contextOf(source));
  if (problem) fail(problem);
  const pages: ScreenPage[] = [];
  const domain = screenOperatorDomain(contextOf(source)), organizationUrl = `https://${domain.domain}`;
  const urls = [...new Set([domain.url,
    ...(recipient.address_source === "published" ? [recipient.published.url] : [])].map(url => contactFetchUrl(url, organizationUrl).href))];
  const deadline = now() + 24000;
  for (const url of urls) {
    let page;
    try { page = await readPage(url, organizationUrl, deadline); }
    catch (error) {
      if (!(error instanceof Error) || error.message !== "contact_fetch_size_limit") throw error;
      page = await readPage(url, organizationUrl, deadline, { maxBytes: CONTACT_RESEARCH_PAGE_LIMIT });
    }
    if (page.requestedUrl !== url || Date.parse(page.checkedAt) > now() || now() - Date.parse(page.checkedAt) > 60000) {
      fail("contact_resolution_check_date_invalid");
    }
    const bytes = Buffer.from(page.bodyBase64, "base64");
    pages.push({ ...page, byteCount: bytes.length, bodyDigest: sha256(bytes) });
  }
  const base = deriveScreenContact(source, prospectId, pages);
  return screenContactResolutionSchema.parse({ ...base, qa: { version: SCREEN_CONTACT_QA, state: "approved",
    reviewedBy: "blueprint-communications-contact-verifier", reviewedAt: new Date(now()).toISOString(), inputDigest: communicationsDigest(base) } });
}

/** The screen contact proof rechecked from its retained pages and the current source, at admission and before every
 * draft. It grants no send authority: every send path refuses a site-screen brief. */
export function verifyScreenContactResolution(value: unknown, source: ScreenContactSource, prospectId: string) {
  const proof = screenContactResolutionSchema.parse(value), { qa, ...base } = proof;
  if (communicationsDigest(deriveScreenContact(source, prospectId, base.pages)) !== communicationsDigest(base)) fail("screen_contact_resolution_changed");
  if (qa.inputDigest !== communicationsDigest(base)
    || Date.parse(qa.reviewedAt) < Math.max(0, ...base.pages.map(page => Date.parse(page.checkedAt)))) fail("contact_resolution_qa_changed");
  return { email: proof.contact.email, scope: proof.contact.scope, sourceUrl: proof.contact.sourceUrl, sourceCheckedAt: proof.contact.sourceCheckedAt,
    consent: proof.contact.status, evidenceDigest: communicationsDigest(proof), kind: "screen_recipient_resolution" as const,
    resolvedGaps: [] as string[], recipient: screenRecipient(proof, source.candidate), label: proof.label, route: proof.route };
}
