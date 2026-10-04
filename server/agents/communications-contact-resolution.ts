import { createHash } from "node:crypto";
import { z } from "zod";
import { communicationsDigest } from "./communications-contract";
import { assertContactUnknowns, contactUnknowns, contactProhibition, containsContactName, extractBusinessContact, restrictedContact, sameOperatorUrl, supportedBusinessRoute } from "./communications-contact-evidence";
import { CONTACT_RESEARCH_PAGE_LIMIT, contactFetchUrl, type ContactPage, type ContactPageReader } from "./communications-contact-fetch";
import { contactDiscoverySchema, type ContactDiscovery } from "./communications-contact-research";

const EXTRACTOR = "blueprint.public-contact-text.v2" as const;
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const pageSchema = z.object({ requestedUrl: z.string().url(), finalUrl: z.string().url(), redirects: z.array(z.string().url()).max(2),
  checkedAt: z.string().datetime(), status: z.literal(200), contentType: z.string().max(200),
  bodyBase64: z.string().max(Math.ceil(CONTACT_RESEARCH_PAGE_LIMIT / 3) * 4), bodyDigest: digest, byteCount: z.number().int().positive().max(CONTACT_RESEARCH_PAGE_LIMIT),
}).strict();
const resolutionBaseSchema = z.object({
  version: z.literal("blueprint.contact-resolution.v1"),
  publication: z.object({ date: z.string().date(), runKey: z.string().min(1), candidateKey: z.string().min(1),
    packetDigest: digest, rawArtifactDigest: digest, sourceDigest: digest,
    qaArtifactDigest: digest, researchQaReference: z.string().min(1),
    sheetsId: z.string().min(1), sheetsProspectId: z.string().min(1), prospectId: z.string().min(1) }).strict(),
  pages: z.array(pageSchema).min(1).max(3),
  discovery: contactDiscoverySchema.optional(),
  contact: z.object({ email: z.string().email(), scope: z.enum(["site", "organization_business_route"]),
    organization: z.string().min(1), site: z.string().nullable(), purpose: z.literal("business_inquiries"),
    status: z.literal("public_business_contact"), sourceUrl: z.string().url(), sourceCheckedAt: z.string().datetime() }).strict(),
  extraction: z.object({ version: z.literal(EXTRACTOR), pageIndex: z.number().int().nonnegative(), segmentIndex: z.number().int().nonnegative(),
    quote: z.string().min(1).max(1200), visibleTextDigest: digest, visibilityBasis: z.literal("static_text_css_not_rendered") }).strict(),
  resolvedGaps: z.array(z.string().min(1).max(1200)).max(16),
}).strict();
export const contactResolutionSchema = resolutionBaseSchema.extend({
  qa: z.object({ version: z.literal("blueprint.contact-qa.v1"), state: z.literal("approved"),
    reviewedBy: z.literal("blueprint-communications-contact-verifier"), reviewedAt: z.string().datetime(), inputDigest: digest }).strict(),
});
export type ContactResolution = z.infer<typeof contactResolutionSchema>;

const decode = (value: string) => value.replace(/&(?:#(x[\da-f]+|\d+);?|(?:amp|lt|gt|quot|apos|nbsp|Tab|NewLine);)/gi, (all, number: string) => {
  if (number) { const code = number[0].toLowerCase() === "x" ? parseInt(number.slice(1), 16) : Number(number);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " "; }
  return ({ "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'", "&nbsp;": " ", "&tab;": "\t", "&newline;": "\n" } as Record<string, string>)[all.toLowerCase()] ?? " ";
});
function htmlAttributes(value: string): Record<string, string> {
  let rest = value.startsWith("<") ? value.replace(/^<\s*\/?\s*[a-z][a-z\d-]*/i, "").replace(/>$/, "") : value;
  const result: Record<string, string> = Object.create(null);
  while (rest.trim()) {
    rest = rest.trimStart(); if (rest === "/") break;
    const name = rest.match(/^[^\s=<>\/"'\x60]+/)?.[0];
    if (!name || Object.hasOwn(result, name.toLowerCase())) throw new Error("contact_resolution_markup_unsupported");
    rest = rest.slice(name.length).trimStart(); let raw = "";
    if (rest.startsWith("=")) {
      rest = rest.slice(1).trimStart();
      if (rest[0] === '"' || rest[0] === "'") {
        const end = rest.indexOf(rest[0], 1);
        if (end < 0) throw new Error("contact_resolution_markup_unsupported");
        raw = rest.slice(1, end); rest = rest.slice(end + 1);
      } else {
        const token = rest.match(/^[^\s"'=<>\x60]+/)?.[0];
        if (!token) throw new Error("contact_resolution_markup_unsupported");
        raw = token; rest = rest.slice(token.length);
      }
      if (rest && !/^[\s/]/.test(rest)) throw new Error("contact_resolution_markup_unsupported");
    }
    result[name.toLowerCase()] = decode(raw);
  }
  return result;
}
/** Owner decision 2026-10-04: element-level visibility. Page-level presentation (stylesheets,
 * scripts, event handlers, embedded documents, legacy presentation attributes) no longer
 * disqualifies a page. Detectably hidden content is excluded, CSS is never rendered, and every
 * proof records that basis. A page that navigates away on load remains unverified. */
export const VISIBILITY_BASIS = "static_text_css_not_rendered" as const;
const HIDDEN_CONTAINERS = /<(script|style|template|noscript|svg|math|iframe|object|canvas|video|audio|select|textarea|title|noframes)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HIDING_STYLE = [
  /(?:^|;)\s*display\s*:\s*none\b/i,
  /(?:^|;)\s*visibility\s*:\s*(?:hidden|collapse)\b/i,
  /(?:^|;)\s*opacity\s*:\s*0*(?:\.0+)?\s*(?:!important\s*)?(?:;|$)/i,
  /(?:^|;)\s*(?:font-size|width|height|max-width|max-height)\s*:\s*0*(?:\.0+)?(?:px|em|rem|pt|%|vh|vw)?\s*(?:!important\s*)?(?:;|$)/i,
  /(?:^|;)\s*(?:left|right|top|bottom|text-indent|margin-left|margin-top)\s*:\s*-\s*\d{3,}/i,
  /(?:^|;)\s*clip\s*:\s*rect\(\s*0/i,
  /(?:^|;)\s*clip-path\s*:\s*(?:inset\(\s*(?:50|100)%|circle\(\s*0)/i,
  /(?:^|;)\s*transform\s*:\s*scale\(\s*0*(?:\.0+)?\s*[,)]/i,
];
const hidingStyle = (style: string) => HIDING_STYLE.some(rule => rule.test(style.replace(/\/\*[\s\S]*?\*\//g, "")));
/** Simple `tag`, `*`, `.class`, `#id` and tag-qualified rules in an embedded <style> that hide
 * text. Complex selectors are not evaluated; CSS is never rendered (recorded on each proof). */
function embeddedHidingSelectors(markup: string) {
  const tags = new Set<string>(), classes = new Set<string>(), ids = new Set<string>();
  for (const block of markup.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    for (const rule of block[1].replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!hidingStyle(rule[2])) continue;
      for (const selector of rule[1].split(",")) {
        const simple = selector.trim().match(/^(\*|[a-z][a-z\d-]*)?(?:([.#])([A-Za-z_][\w-]*))?$/i);
        if (!simple || (!simple[1] && !simple[2])) continue;
        if (simple[2]) (simple[2] === "." ? classes : ids).add(simple[3]);
        else tags.add(simple[1].toLowerCase());
      }
    }
  }
  return { tags, classes, ids };
}
const JOIN = "\u0001";
const VOID = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/;
const AUTO_CLOSE_SAME = /^(?:li|p|dt|dd|tr|td|th|option)$/;
const CLOSES_P = /^(?:p|div|section|article|ul|ol|dl|table|h[1-6]|address|blockquote|header|footer|nav|figure|hr|pre)$/;
const EMAIL = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
/** True when an address in the quote would have to be stitched across an element boundary. */
export function crossesElementBoundary(quote: string, joins: readonly number[] = []) {
  for (const match of quote.matchAll(EMAIL)) {
    const start = match.index ?? 0, end = start + match[0].length;
    if (joins.some(at => at > start && at < end)) return true;
  }
  return false;
}

/** Static text extraction; no script execution, CSS rendering or hidden/raw markup contact
 * inference. Separate blocks never supply each other's business labels, and an address must
 * be one literal run of text, never spliced across an element boundary. */
export function contactPageText(page: ContactPage) {
  const bytes = Buffer.from(page.bodyBase64, "base64");
  if (!bytes.length || bytes.length > CONTACT_RESEARCH_PAGE_LIMIT || bytes.toString("base64") !== page.bodyBase64
    || !/^(?:text\/html|text\/plain)(?:;|$)/.test(page.contentType)) throw new Error("contact_resolution_body_invalid");
  const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes), segments: string[] = [], joins: number[][] = [], links: string[] = [];
  if (/^text\/plain(?:;|$)/.test(page.contentType)) {
    const plain = body.split(/\n\s*\n/).map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean);
    return { segments: plain, joins: plain.map(() => [] as number[]), links, restrictionText: body, visibilityUnverified: false };
  }
  const sheet = embeddedHidingSelectors(body);
  // Contents of non-rendered/hidden containers (including inline SVG with self-closing children)
  // are never text; blank them so they cannot break tokenization.
  const markup = body.replace(HIDDEN_CONTAINERS, (_all, tag: string) => `<${tag}></${tag}>`);
  const tokens = markup.match(/<!--[\s\S]*?-->|<(?:[^"'<>]|"[^"]*"|'[^']*')*>|[^<]+|</g) ?? [];
  const baseHref = tokens.filter(tag => /^<base\b/i.test(tag)).map(tag => htmlAttributes(tag).href).find(Boolean);
  const linkBase = baseHref ? new URL(baseHref, page.finalUrl).href : page.finalUrl;
  const stack: { tag: string; hidden: boolean; styleHidden: boolean }[] = [];
  let text = "", restrictionText = "", boundary = false, visibilityUnverified = false;
  const flush = () => {
    const value = text.replace(/\s+/g, " ").trim(); text = ""; boundary = false;
    const at: number[] = []; let clean = "";
    for (const ch of value) { if (ch === JOIN) at.push(clean.length); else clean += ch; }
    if (clean.trim()) { segments.push(clean); joins.push(at); }
  };
  const blocks = /^(?:p|div|section|article|li|address|h[1-6]|br|hr|footer|header|nav|table|tr|td)$/;
  const staticTag = /^(?:html|body|main|article|section|header|footer|nav|div|p|span|address|a|h[1-6]|strong|em|b|i|u|s|small|abbr|cite|q|blockquote|ul|ol|li|dl|dt|dd|table|thead|tbody|tfoot|tr|td|th|caption|figure|figcaption|time|br|hr)$/;
  const appendText = (raw: string) => {
    const value = decode(raw).replaceAll(JOIN, "");
    if (stack.some(x => x.hidden)) return;
    restrictionText += ` ${value}`;
    if (stack.some(x => x.styleHidden || ["footer", "nav"].includes(x.tag))) return;
    if (boundary && text && !/\s$/.test(text) && !/^\s/.test(value)) text += JOIN;
    text += value; boundary = false;
  };
  for (const token of tokens) {
    if (token.startsWith("<!--")) continue;
    const match = token.match(/^<\s*(\/?)\s*([a-z][a-z\d-]*)\b([\s\S]*)>$/i);
    if (!match) {
      if (/^<[!?]/.test(token)) continue;
      appendText(token); continue; // a literal "<" that opens no tag is ordinary text
    }
    boundary = true;
    const [, closing, rawTag, attributes] = match, tag = rawTag.toLowerCase();
    if (blocks.test(tag)) flush();
    if (closing) {
      const at = stack.map(x => x.tag).lastIndexOf(tag);
      if (at >= 0) stack.length = at; // close back to the match; a stray closing tag is ignored
      continue;
    }
    const attrs = htmlAttributes(attributes), voidTag = VOID.test(tag);
    if (tag === "meta" && attrs["http-equiv"]?.trim().toLowerCase() === "refresh") visibilityUnverified = true;
    if (AUTO_CLOSE_SAME.test(tag) && stack.at(-1)?.tag === tag) stack.pop();
    else if (CLOSES_P.test(tag) && stack.at(-1)?.tag === "p") stack.pop();
    const hidden = stack.some(x => x.hidden) || !staticTag.test(tag)
      || Object.hasOwn(attrs, "hidden") || Object.hasOwn(attrs, "popover") || Object.hasOwn(attrs, "inert") || attrs["aria-hidden"]?.toLowerCase() === "true";
    const styleHidden = stack.some(x => x.styleHidden) || hidingStyle(attrs.style ?? "") || sheet.tags.has("*") || sheet.tags.has(tag)
      || (attrs.class ?? "").split(/\s+/).some(name => sheet.classes.has(name)) || (attrs.id !== undefined && sheet.ids.has(attrs.id));
    if (tag === "a" && !hidden && !styleHidden) {
      const href = attrs.href;
      if (href) { try { const url = new URL(href, linkBase); if (/contact|inquir|enquir|partnership|leadership|management|teams?|people|operations|technology|about/i.test(url.pathname)) links.push(url.href); } catch { /* untrusted link */ } }
    }
    // Browsers ignore a self-closing slash on HTML elements, so it still opens the element.
    if (!voidTag) stack.push({ tag, hidden, styleHidden });
    if (stack.length > 128 || segments.length > 4000) throw new Error("contact_resolution_markup_limit");
  }
  flush(); return { segments, joins, links: [...new Set(links)], restrictionText: restrictionText.replace(/\s+/g, " ").trim(), visibilityUnverified };
}

export function contactPublication(source: any, prospectId: string) {
  return { date: source.date, runKey: source.runKey, candidateKey: source.candidate.candidate_key,
    packetDigest: source.packetDigest, rawArtifactDigest: source.rawArtifactDigest, sourceDigest: communicationsDigest(source),
    qaArtifactDigest: source.qaArtifactDigest, researchQaReference: source.researchReview.reviewer_reference,
    sheetsId: source.sheetsId, sheetsProspectId: source.sheetsProspectId, prospectId };
}

/** Rank only contacts that already pass literal public business-route proof.
 * A title or email local part cannot establish a relevant decision maker. */
export function publicContactPriority(quote: string, candidate: any) {
  if (/\b(?:former|formerly|previously|retired|no longer|not responsible|does not (?:lead|manage|oversee)|left (?:the )?company)\b/i.test(quote)) return 3;
  const taskWords = String(candidate.task).normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [];
  const remit = /\b(?:responsible for|oversees|leads|manages|evaluates)\b/i.test(quote)
    && taskWords.some(word => containsContactName(quote, word));
  const role = /\b(?:director|manager|head|vice president|chief)\b/i.test(quote);
  const named = /\b[\p{Lu}][\p{Ll}]+(?:[-’'][\p{L}]+)?\s+[\p{Lu}][\p{Ll}]+(?:[-’'][\p{L}]+)?\s*,\s*(?:[Dd]irector|[Mm]anager|[Hh]ead|[Vv]ice [Pp]resident|[Cc]hief)\b/u.test(quote);
  if (named && role && remit && containsContactName(quote, candidate.site)) return 0;
  if (/\b(?:operations|technology|automation|robotics|procurement|engineering)\s+(?:team|inquiries|enquiries|department)\b/i.test(quote)
    && taskWords.some(word => containsContactName(quote, word))) return 1;
  return 2;
}
function preferredContact<T extends { email: string; quote: string }>(contacts: T[], candidate: any): T {
  contacts = contacts.filter(contact => publicContactPriority(contact.quote, candidate) < 3);
  if (!contacts.length) throw new Error("contact_resolution_missing_or_ambiguous");
  const priority = Math.min(...contacts.map(contact => publicContactPriority(contact.quote, candidate)));
  const preferred = contacts.filter(contact => publicContactPriority(contact.quote, candidate) === priority);
  if (new Set(preferred.map(contact => contact.email)).size !== 1) throw new Error("contact_resolution_missing_or_ambiguous");
  return preferred[0];
}

function checkResolution(value: unknown, source: any, prospectId: string) {
  const base = resolutionBaseSchema.parse(value);
  assertContactUnknowns(source.candidate, true);
  if (communicationsDigest(base.publication) !== communicationsDigest(contactPublication(source, prospectId))
    || communicationsDigest(base.resolvedGaps) !== communicationsDigest(contactUnknowns(source.candidate).gaps)) throw new Error("contact_resolution_source_changed");
  const found: { email: string; scope: "site" | "organization_business_route"; pageIndex: number; segmentIndex: number; quote: string; visibleTextDigest: string }[] = [];
  const reachable = new Set([source.candidate.organization_url, ...source.candidate.evidence.filter((x: any) => x.classification === "operator").map((x: any) => x.url)]
    .filter((x: string) => sameOperatorUrl(x, source.candidate.organization_url)).map((x: string) => { try { return contactFetchUrl(x, source.candidate.organization_url).href; } catch { return ""; } }));
  if (base.pages.reduce((total, page) => total + page.byteCount, 0) > 512 * 1024) throw new Error("contact_resolution_total_size_limit");
  if (base.discovery) {
    if (base.discovery.sourceDigest !== communicationsDigest(source)
      || base.discovery.requestId !== communicationsDigest({ publication: contactPublication(source, prospectId), sourceDigest: communicationsDigest(source) })) throw new Error("contact_research_source_changed");
    for (const s of base.discovery.sources) reachable.add(contactFetchUrl(s.url, source.candidate.organization_url).href);
  }
  for (const [pageIndex, page] of base.pages.entries()) {
    const bytes = Buffer.from(page.bodyBase64, "base64"), requested = contactFetchUrl(page.requestedUrl, source.candidate.organization_url).href;
    if (!reachable.has(requested) || page.byteCount !== bytes.length || page.bodyDigest !== hash(bytes)
      || page.finalUrl !== (page.redirects.at(-1) ?? page.requestedUrl)) throw new Error("contact_resolution_retrieval_changed");
    for (const url of [page.finalUrl, ...page.redirects]) contactFetchUrl(url, source.candidate.organization_url);
    const parsed = contactPageText(page), visibleTextDigest = communicationsDigest({ segments: parsed.segments,
      restrictionText: parsed.restrictionText, visibilityUnverified: parsed.visibilityUnverified });
    if (contactProhibition.test(parsed.restrictionText)) throw new Error("contact_resolution_recipient_restricted");
    const organizationIdentified = parsed.segments.some(segment => containsContactName(segment, source.candidate.organization));
    for (const link of parsed.links) { try { reachable.add(contactFetchUrl(link, source.candidate.organization_url).href); } catch { /* no scope widening */ } }
    if (parsed.visibilityUnverified) continue;
    for (const [segmentIndex, quote] of parsed.segments.entries()) {
      if (quote.length > 1200 || crossesElementBoundary(quote, parsed.joins[segmentIndex])) continue;
      try { found.push({ ...extractBusinessContact(quote, source.candidate, false, organizationIdentified), pageIndex, segmentIndex, quote, visibleTextDigest }); }
      catch { if (supportedBusinessRoute(quote) && quote.includes("@")
        && !restrictedContact.test(quote)) throw new Error("contact_resolution_ambiguous_segment"); }
    }
  }
  const selected = preferredContact(found, source.candidate), page = base.pages[selected.pageIndex];
  if (communicationsDigest(base.extraction) !== communicationsDigest({ version: EXTRACTOR, pageIndex: selected.pageIndex,
    segmentIndex: selected.segmentIndex, quote: selected.quote, visibleTextDigest: selected.visibleTextDigest, visibilityBasis: VISIBILITY_BASIS })
    || base.contact.email !== selected.email || base.contact.scope !== selected.scope
    || base.contact.organization !== source.candidate.organization || base.contact.site !== (selected.scope === "site" ? source.candidate.site : null)
    || base.contact.sourceUrl !== page.finalUrl || base.contact.sourceCheckedAt !== page.checkedAt) throw new Error("contact_resolution_extraction_changed");
  return base;
}

/** Independent deterministic terminal contact QA, also rerun at draft/send gates. */
export function verifyContactResolution(value: unknown, source: any, prospectId: string) {
  const proof = contactResolutionSchema.parse(value), { qa, ...base } = proof;
  checkResolution(base, source, prospectId);
  if (qa.inputDigest !== communicationsDigest(base) || Date.parse(qa.reviewedAt) < Math.max(...proof.pages.map(x => Date.parse(x.checkedAt)))) {
    throw new Error("contact_resolution_qa_changed");
  }
  return { email: proof.contact.email, scope: proof.contact.scope, sourceUrl: proof.contact.sourceUrl,
    sourceCheckedAt: proof.contact.sourceCheckedAt, evidenceDigest: communicationsDigest(proof),
    kind: "public_operator_resolution" as const, resolvedGaps: proof.resolvedGaps };
}

/** Bounded communications-owned research. Only cited pages and discovered operator
 * contact links, three pages/24 seconds; no guessed path/address, model or Gmail. */
export async function resolvePublicContact(source: any, prospectId: string, readPage: ContactPageReader, now: () => number,
  discovery?: ContactDiscovery) {
  assertContactUnknowns(source.candidate, true);
  const queue = [...(discovery?.sources.map(s => s.url) ?? []), source.candidate.organization_url,
    ...source.candidate.evidence.filter((x: any) => x.classification === "operator").map((x: any) => x.url)];
  const visited = new Set<string>(), pages: z.infer<typeof pageSchema>[] = [], deadline = now() + 24000;
  while (queue.length && pages.length < 3 && visited.size < 6 && now() < deadline) {
    let url: string;
    try { url = contactFetchUrl(queue.shift()!, source.candidate.organization_url).href; } catch { continue; }
    if (visited.has(url)) continue; visited.add(url);
    let page: ContactPage;
    try { page = await readPage(url, source.candidate.organization_url, deadline); }
    catch (error) {
      if (error instanceof Error && error.message === "contact_fetch_size_limit") {
        try { page = await readPage(url, source.candidate.organization_url, deadline, { maxBytes: CONTACT_RESEARCH_PAGE_LIMIT }); }
        catch (larger) { if (larger instanceof Error && ["contact_fetch_size_limit", "contact_fetch_page_unavailable"].includes(larger.message)) continue; throw larger; }
      } else if (error instanceof Error && error.message === "contact_fetch_page_unavailable") continue;
      else throw error;
    }
    if (page.requestedUrl !== url || Date.parse(page.checkedAt) > now() || now() - Date.parse(page.checkedAt) > 60000) throw new Error("contact_resolution_check_date_invalid");
    const parsed = contactPageText(page), bytes = Buffer.from(page.bodyBase64, "base64");
    if (bytes.length + pages.reduce((total, p) => total + p.byteCount, 0) > 512 * 1024) continue;
    pages.push({ ...page, byteCount: bytes.length, bodyDigest: hash(bytes) });
    // Discovered contact links take precedence over another general source page.
    queue.unshift(...parsed.links);
  }
  const candidates = pages.flatMap((page, pageIndex) => {
    const parsed = contactPageText(page);
    if (parsed.visibilityUnverified) return [];
    const organizationIdentified = parsed.segments.some(segment => containsContactName(segment, source.candidate.organization));
    return parsed.segments.flatMap((quote, segmentIndex) => { if (crossesElementBoundary(quote, parsed.joins[segmentIndex])) return [];
      try { return [{ ...extractBusinessContact(quote, source.candidate, false, organizationIdentified), pageIndex,
      segmentIndex, quote, visibleTextDigest: communicationsDigest({ segments: parsed.segments,
        restrictionText: parsed.restrictionText, visibilityUnverified: parsed.visibilityUnverified }) }]; } catch { return []; } });
  });
  if (!candidates.length) throw new Error(pages.some(page => contactPageText(page).visibilityUnverified)
    ? "contact_resolution_visibility_unverified" : "contact_resolution_missing_or_ambiguous");
  const selected = preferredContact(candidates, source.candidate), page = pages[selected.pageIndex];
  const base = checkResolution({ version: "blueprint.contact-resolution.v1", publication: contactPublication(source, prospectId), pages,
    ...(discovery ? { discovery } : {}),
    contact: { email: selected.email, scope: selected.scope, organization: source.candidate.organization,
      site: selected.scope === "site" ? source.candidate.site : null, purpose: "business_inquiries", status: "public_business_contact",
      sourceUrl: page.finalUrl, sourceCheckedAt: page.checkedAt },
    extraction: { version: EXTRACTOR, pageIndex: selected.pageIndex, segmentIndex: selected.segmentIndex,
      quote: selected.quote, visibleTextDigest: selected.visibleTextDigest, visibilityBasis: VISIBILITY_BASIS },
    resolvedGaps: contactUnknowns(source.candidate).gaps }, source, prospectId);
  return contactResolutionSchema.parse({ ...base, qa: { version: "blueprint.contact-qa.v1", state: "approved",
    reviewedBy: "blueprint-communications-contact-verifier", reviewedAt: new Date(now()).toISOString(), inputDigest: communicationsDigest(base) } });
}
