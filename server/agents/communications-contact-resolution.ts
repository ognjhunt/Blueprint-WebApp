import { createHash } from "node:crypto";
import { z } from "zod";
import { communicationsDigest } from "./communications-contract";
import { defaultTreeAdapter, parse, type DefaultTreeAdapterMap } from "parse5";
import { assertContactUnknowns, contactUnknowns, contactProhibition, containsContactName, EMAIL, extractBusinessContact, restrictedContact, sameOperatorUrl, supportedBusinessRoute } from "./communications-contact-evidence";
import { CONTACT_RESEARCH_PAGE_LIMIT, contactFetchUrl, type ContactPage, type ContactPageReader } from "./communications-contact-fetch";
import { contactDiscoverySchema, type ContactDiscovery } from "./communications-contact-research";
import { elementFacts, hidingRules, hidingStyle, matchesHidingRule } from "./communications-contact-visibility";

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

/** Owner decision 2026-10-04: element-level visibility. Page-level presentation (stylesheets,
 * scripts, event handlers, embedded documents, legacy presentation attributes) no longer
 * disqualifies a page. Markup is parsed with browser-equivalent (WHATWG) tree construction,
 * detectably hidden content is excluded, CSS is never rendered, and every proof records that
 * basis. A page that navigates away on load remains unverified. */
export const VISIBILITY_BASIS = "static_text_css_not_rendered" as const;
type HtmlNode = DefaultTreeAdapterMap["node"];
type HtmlElement = DefaultTreeAdapterMap["element"];
const HTML_NS = "http://www.w3.org/1999/xhtml";
// Parser budgets. Real pages nest far less than 256 open elements and create far fewer than
// 60k elements; adversarial nesting and formatting-element rebuilds otherwise cost quadratic
// time and unbounded memory. parse5 also checks each attribute against the tag's earlier ones.
const MAX_OPEN_ELEMENTS = 256, MAX_ELEMENTS = 60_000, MAX_TAG_ATTRIBUTES = 512;
const markupLimit = () => { throw new Error("contact_resolution_markup_limit"); };
/** Linear upper bound on attributes per start tag (separators and assignments outside quoted values). */
function tagAttributesExceeded(markup: string) {
  for (let at = markup.indexOf("<"); at >= 0; at = markup.indexOf("<", at + 1)) {
    if (!/[a-z]/i.test(markup[at + 1] ?? "")) continue;
    let count = 0, i = at + 1;
    while (i < markup.length && markup[i] !== ">") {
      if (markup[i] === "=") {
        count++; i++;
        while (i < markup.length && markup.charCodeAt(i) <= 32) i++;
        if (markup[i] === '"' || markup[i] === "'") { const close = markup.indexOf(markup[i], i + 1); i = close < 0 ? markup.length : close + 1; }
      } else if (markup.charCodeAt(i) <= 32 || markup[i] === "/") {
        count++;
        while (i < markup.length && (markup.charCodeAt(i) <= 32 || markup[i] === "/")) i++;
      } else i++;
      if (count > MAX_TAG_ATTRIBUTES) return true;
    }
    at = i;
  }
  return false;
}
function parseHtml(markup: string) {
  if (tagAttributesExceeded(markup)) markupLimit();
  let open = 0, created = 0;
  return parse(markup, { treeAdapter: { ...defaultTreeAdapter,
    createElement: (tagName, namespaceURI, attrs) => {
      if (++created > MAX_ELEMENTS) markupLimit();
      return defaultTreeAdapter.createElement(tagName, namespaceURI, attrs);
    },
    onItemPush: () => { if (++open > MAX_OPEN_ELEMENTS) markupLimit(); },
    onItemPop: () => { open -= 1; } } });
}
const isElement = (node: HtmlNode): node is HtmlElement => "tagName" in node;
const childNodes = (node: HtmlNode): HtmlNode[] => "childNodes" in node ? node.childNodes : [];
function attributes(element: HtmlElement) {
  const result: Record<string, string> = Object.create(null);
  for (const { name, value } of element.attrs) if (!(name in result)) result[name] = value;
  return result;
}
/** Every element in document order, iteratively. Template contents are a separate inert
 * fragment and are never visited. */
function forEachElement(root: HtmlNode, visit: (element: HtmlElement) => void) {
  const work = [root];
  while (work.length) {
    const node = work.pop()!, children = childNodes(node);
    if (isElement(node)) visit(node);
    for (let i = children.length - 1; i >= 0; i--) work.push(children[i]);
  }
}
function textContent(element: HtmlElement) {
  let text = ""; const work: HtmlNode[] = [element];
  while (work.length) {
    const node = work.pop()!, children = childNodes(node);
    if (node.nodeName === "#text") text += (node as DefaultTreeAdapterMap["textNode"]).value;
    for (let i = children.length - 1; i >= 0; i--) work.push(children[i]);
  }
  return text;
}
// Raw-text, non-rendered and foreign-content containers: their contents are never text.
const CONTAINERS = new Set(["script", "style", "template", "noscript", "noembed", "noframes", "iframe", "object", "canvas",
  "video", "audio", "select", "textarea", "title", "xmp", "plaintext", "datalist", "svg", "math"]);
const STATIC = new Set(["html", "body", "main", "article", "section", "header", "footer", "nav", "div", "p", "span", "address", "a",
  "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "b", "i", "u", "s", "small", "abbr", "cite", "q", "blockquote", "ul", "ol", "li",
  "dl", "dt", "dd", "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "figure", "figcaption", "time", "br", "hr"]);
const BLOCKS = new Set(["p", "div", "section", "article", "li", "address", "h1", "h2", "h3", "h4", "h5", "h6", "br", "hr", "footer",
  "header", "nav", "table", "tr", "td"]);
const JOIN = "\u0001";
/** True when an address in the quote would have to be stitched across an element boundary.
 * Boundary offsets are ascending, so each address needs one binary search. */
export function crossesElementBoundary(quote: string, joins: readonly number[] = []) {
  if (!joins.length) return false;
  for (const match of quote.matchAll(EMAIL)) {
    const start = match.index ?? 0, end = start + match[0].length;
    let low = 0, high = joins.length;
    while (low < high) { const mid = (low + high) >> 1; if (joins[mid] <= start) low = mid + 1; else high = mid; }
    if (low < joins.length && joins[low] < end) return true;
  }
  return false;
}
// Bidirectional controls and marks can display an address in a different order than its text.
const BIDI_CONTROL = /[\u202a-\u202e\u2066-\u2069\u200e\u200f\u061c]/;
/** True when no address in the quote can be read as one literal, left-to-right run of visible text. */
export function literalAddressUnsafe(quote: string, joins: readonly number[] = []) {
  return crossesElementBoundary(quote, joins) || (BIDI_CONTROL.test(quote) && quote.match(EMAIL) !== null);
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
  const document = parseHtml(body), sheets: string[] = [];
  let baseHref: string | undefined, visibilityUnverified = false;
  forEachElement(document, element => {
    const attrs = attributes(element), html = element.namespaceURI === HTML_NS;
    if (element.tagName === "style") sheets.push(textContent(element));
    if (html && element.tagName === "base" && attrs.href && baseHref === undefined) baseHref = attrs.href;
    if (html && element.tagName === "meta" && attrs["http-equiv"]?.trim().toLowerCase() === "refresh") visibilityUnverified = true;
  });
  const sheet = hidingRules(sheets);
  const linkBase = baseHref ? new URL(baseHref, page.finalUrl).href : page.finalUrl;
  const frames: { hidden: boolean; styleHidden: boolean; muted: boolean }[] = [];
  // Text is assembled from parts, tracking only its last character: re-testing a growing
  // string on every append costs quadratic time on pages with many inline elements.
  let parts: string[] = [], textLength = 0, endsWithSpace = false, boundary = false;
  const restriction: string[] = [];
  const flush = () => {
    const value = parts.join("").replace(/\s+/g, " ").trim(); parts = []; textLength = 0; boundary = false;
    const at: number[] = []; let clean = "";
    for (const ch of value) { if (ch === JOIN) at.push(clean.length); else clean += ch; }
    if (clean.trim()) { segments.push(clean); joins.push(at); }
    if (segments.length > 4000) throw new Error("contact_resolution_markup_limit");
  };
  const appendText = (raw: string) => {
    const value = raw.replaceAll(JOIN, ""), frame = frames.at(-1);
    if (frame?.hidden) return;
    restriction.push(value);
    if (frame?.styleHidden || frame?.muted) return;
    if (boundary && textLength && !endsWithSpace && !/^\s/.test(value)) { parts.push(JOIN); textLength += 1; endsWithSpace = false; }
    if (value) { parts.push(value); textLength += value.length; endsWithSpace = /\s$/.test(value); }
    boundary = false;
  };
  // Document-order open/text/close events over the browser-equivalent tree.
  const work: (HtmlNode | { close: string })[] = [document];
  while (work.length) {
    const item = work.pop()!;
    if ("close" in item) { boundary = true; if (BLOCKS.has(item.close)) flush(); frames.pop(); continue; }
    if (item.nodeName === "#text") { appendText((item as DefaultTreeAdapterMap["textNode"]).value); continue; }
    const children = childNodes(item);
    if (!isElement(item)) { for (let i = children.length - 1; i >= 0; i--) work.push(children[i]); continue; }
    const tag = item.tagName, attrs = attributes(item), parent = frames.at(-1);
    const container = item.namespaceURI !== HTML_NS || CONTAINERS.has(tag);
    boundary = true;
    if (BLOCKS.has(tag)) flush();
    // A declarative shadow root replaces what the host renders; its light DOM shows only through
    // slots, which static text cannot resolve, so the host's own children are never read.
    const shadowHost = children.some(child => isElement(child) && child.tagName === "template" && child.namespaceURI === HTML_NS
      && child.attrs.some(({ name }) => name === "shadowrootmode" || name === "shadowroot"));
    const hidden = !!parent?.hidden || container || shadowHost || !STATIC.has(tag)
      || "hidden" in attrs || "popover" in attrs || "inert" in attrs || attrs["aria-hidden"]?.trim().toLowerCase() === "true";
    const styleHidden = !!parent?.styleHidden || hidingStyle(attrs.style ?? "") || matchesHidingRule(sheet, elementFacts(tag, attrs));
    if (tag === "a" && !hidden && !styleHidden) {
      const href = attrs.href;
      if (href) { try { const url = new URL(href, linkBase); if (/contact|inquir|enquir|partnership|leadership|management|teams?|people|operations|technology|about/i.test(url.pathname)) links.push(url.href); } catch { /* untrusted link */ } }
    }
    frames.push({ hidden, styleHidden, muted: !!parent?.muted || tag === "footer" || tag === "nav" });
    work.push({ close: tag });
    if (!container) for (let i = children.length - 1; i >= 0; i--) work.push(children[i]);
  }
  flush(); return { segments, joins, links: [...new Set(links)], restrictionText: restriction.join(" ").replace(/\s+/g, " ").trim(), visibilityUnverified };
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
      if (quote.length > 1200) continue;
      try {
        // A business route whose address only exists across element boundaries is ambiguous, not absent.
        if (literalAddressUnsafe(quote, parsed.joins[segmentIndex])) throw new Error("contact_resolution_spliced_address");
        found.push({ ...extractBusinessContact(quote, source.candidate, false, organizationIdentified), pageIndex, segmentIndex, quote, visibleTextDigest });
      } catch { if (supportedBusinessRoute(quote) && quote.includes("@")
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
    return parsed.segments.flatMap((quote, segmentIndex) => { if (quote.length > 1200 || literalAddressUnsafe(quote, parsed.joins[segmentIndex])) return [];
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
