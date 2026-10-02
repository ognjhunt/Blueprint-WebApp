import { createHash } from "node:crypto";
import { z } from "zod";
import { communicationsDigest } from "./communications-contract";
import { assertContactUnknowns, contactUnknowns, contactProhibition, containsContactName, extractBusinessContact, restrictedContact, sameOperatorUrl, supportedBusinessRoute } from "./communications-contact-evidence";
import { CONTACT_PAGE_LIMIT, contactFetchUrl, type ContactPage, type ContactPageReader } from "./communications-contact-fetch";

const EXTRACTOR = "blueprint.public-contact-text.v1" as const;
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const pageSchema = z.object({ requestedUrl: z.string().url(), finalUrl: z.string().url(), redirects: z.array(z.string().url()).max(2),
  checkedAt: z.string().datetime(), status: z.literal(200), contentType: z.string().max(200),
  bodyBase64: z.string().max(Math.ceil(CONTACT_PAGE_LIMIT / 3) * 4), bodyDigest: digest, byteCount: z.number().int().positive().max(CONTACT_PAGE_LIMIT),
}).strict();
const resolutionBaseSchema = z.object({
  version: z.literal("blueprint.contact-resolution.v1"),
  publication: z.object({ date: z.string().date(), runKey: z.string().min(1), candidateKey: z.string().min(1),
    packetDigest: digest, rawArtifactDigest: digest, sourceDigest: digest,
    qaArtifactDigest: digest, researchQaReference: z.string().min(1),
    sheetsId: z.string().min(1), sheetsProspectId: z.string().min(1), prospectId: z.string().min(1) }).strict(),
  pages: z.array(pageSchema).min(1).max(3),
  contact: z.object({ email: z.string().email(), scope: z.enum(["site", "organization_business_route"]),
    organization: z.string().min(1), site: z.string().nullable(), purpose: z.literal("business_inquiries"),
    status: z.literal("public_business_contact"), sourceUrl: z.string().url(), sourceCheckedAt: z.string().datetime() }).strict(),
  extraction: z.object({ version: z.literal(EXTRACTOR), pageIndex: z.number().int().nonnegative(), segmentIndex: z.number().int().nonnegative(),
    quote: z.string().min(1).max(1200), visibleTextDigest: digest }).strict(),
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
/** Conservative static text extraction; no script execution or hidden/raw markup
 * contact inference. Separate blocks never supply each other's business labels. */
export function contactPageText(page: ContactPage) {
  const bytes = Buffer.from(page.bodyBase64, "base64");
  if (!bytes.length || bytes.length > CONTACT_PAGE_LIMIT || bytes.toString("base64") !== page.bodyBase64
    || !/^(?:text\/html|text\/plain)(?:;|$)/.test(page.contentType)) throw new Error("contact_resolution_body_invalid");
  const body = new TextDecoder("utf-8", { fatal: true }).decode(bytes), segments: string[] = [], links: string[] = [];
  if (/^text\/plain(?:;|$)/.test(page.contentType)) return { segments: body.split(/\n\s*\n/).map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean), links, restrictionText: body, visibilityUnverified: false };
  const markup = body;
  const tokens = markup.match(/<!--[\s\S]*?-->|<(?:[^"'<>]|"[^"]*"|'[^']*')*>|[^<]+/g) ?? [];
  if (tokens.join("") !== markup) throw new Error("contact_resolution_markup_unsupported");
  // Static extraction cannot establish stylesheet visibility. Such pages may
  // supply links/restrictions, but never positive contact proof. No CSS/browser runtime.
  const opening = tokens.filter(tag => /^<[a-z]/i.test(tag));
  const visibilityUnverified = /<style\b[^>]*>[\s\S]*?\S[\s\S]*?<\/style\s*>/i.test(markup)
    || opening.some(tag => {
      const attrs = htmlAttributes(tag);
      return /^<(?:script|iframe|object|embed|frameset)\b/i.test(tag) || Object.keys(attrs).some(key => key.startsWith("on"))
        || Object.keys(attrs).some(key => ["text", "color", "bgcolor", "background"].includes(key))
        || (/^<link\b/i.test(tag) && attrs.rel?.toLowerCase().split(/\s+/).includes("stylesheet"))
        || (/^<meta\b/i.test(tag) && attrs["http-equiv"]?.toLowerCase() === "refresh");
    });
  const baseHref = tokens.filter(tag => /^<base\b/i.test(tag)).map(tag => htmlAttributes(tag).href).find(Boolean);
  const linkBase = baseHref ? new URL(baseHref, page.finalUrl).href : page.finalUrl;
  const stack: { tag: string; hidden: boolean; inlineStyle: boolean }[] = [];
  let text = "", restrictionText = "", blockVisibilityUnverified = false;
  const flush = () => { const value = text.replace(/\s+/g, " ").trim(); if (value && !blockVisibilityUnverified) segments.push(value);
    text = ""; blockVisibilityUnverified = false; };
  const blocks = /^(?:p|div|section|article|li|address|h[1-6]|br|hr|footer|header|nav|table|tr|td)$/;
  for (const token of tokens) {
    if (token.startsWith("<!--")) continue;
    if (!token.startsWith("<")) {
      if (stack.some(x => x.inlineStyle)) blockVisibilityUnverified = true;
      if (!stack.some(x => x.hidden)) restrictionText += ` ${decode(token)}`;
      if (!stack.some(x => x.hidden || x.inlineStyle || ["footer", "nav"].includes(x.tag))) text += decode(token); continue;
    }
    const match = token.match(/^<\s*(\/?)\s*([a-z][a-z\d-]*)\b([\s\S]*)>$/i);
    if (!match) { if (!/^<!doctype/i.test(token)) throw new Error("contact_resolution_markup_unsupported"); continue; }
    const [, closing, rawTag, attributes] = match, tag = rawTag.toLowerCase();
    if (blocks.test(tag)) flush();
    if (closing) {
      if (stack.at(-1)?.tag !== tag) throw new Error("contact_resolution_markup_unsupported");
      stack.pop(); continue;
    }
    const attrs = htmlAttributes(attributes), voidTag = /^(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag);
    if (!voidTag && /\/\s*>$/.test(token)) throw new Error("contact_resolution_markup_unsupported");
    const staticTag = /^(?:html|body|main|article|section|header|footer|nav|div|p|span|address|a|h[1-6]|strong|em|b|i|u|s|small|abbr|cite|q|blockquote|ul|ol|li|dl|dt|dd|table|thead|tbody|tfoot|tr|td|th|caption|figure|figcaption|time|br|hr)$/;
    const hidden = stack.some(x => x.hidden) || !staticTag.test(tag)
      || Object.hasOwn(attrs, "hidden") || Object.hasOwn(attrs, "popover") || Object.hasOwn(attrs, "inert") || attrs["aria-hidden"]?.toLowerCase() === "true";
    if (Object.hasOwn(attrs, "style")) blockVisibilityUnverified = true;
    if (tag === "a" && !hidden) {
      const href = attrs.href;
      if (href) { try { const url = new URL(href, linkBase); if (/contact|inquir|enquir|partnership/i.test(url.pathname)) links.push(url.href); } catch { /* untrusted link */ } }
    }
    if (!voidTag) stack.push({ tag, hidden, inlineStyle: Object.hasOwn(attrs, "style") });
    if (stack.length > 128 || segments.length > 4000) throw new Error("contact_resolution_markup_limit");
  }
  if (stack.length) throw new Error("contact_resolution_markup_unsupported");
  flush(); return { segments, links: [...new Set(links)], restrictionText: restrictionText.replace(/\s+/g, " ").trim(), visibilityUnverified };
}

export function contactPublication(source: any, prospectId: string) {
  return { date: source.date, runKey: source.runKey, candidateKey: source.candidate.candidate_key,
    packetDigest: source.packetDigest, rawArtifactDigest: source.rawArtifactDigest, sourceDigest: communicationsDigest(source),
    qaArtifactDigest: source.qaArtifactDigest, researchQaReference: source.researchReview.reviewer_reference,
    sheetsId: source.sheetsId, sheetsProspectId: source.sheetsProspectId, prospectId };
}

function checkResolution(value: unknown, source: any, prospectId: string) {
  const base = resolutionBaseSchema.parse(value);
  assertContactUnknowns(source.candidate, true);
  if (communicationsDigest(base.publication) !== communicationsDigest(contactPublication(source, prospectId))
    || communicationsDigest(base.resolvedGaps) !== communicationsDigest(contactUnknowns(source.candidate).gaps)) throw new Error("contact_resolution_source_changed");
  const found: { email: string; scope: "site" | "organization_business_route"; pageIndex: number; segmentIndex: number; quote: string; visibleTextDigest: string }[] = [];
  const reachable = new Set([source.candidate.organization_url, ...source.candidate.evidence.filter((x: any) => x.classification === "operator").map((x: any) => x.url)]
    .filter((x: string) => sameOperatorUrl(x, source.candidate.organization_url)).map((x: string) => { try { return contactFetchUrl(x, source.candidate.organization_url).href; } catch { return ""; } }));
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
      try { found.push({ ...extractBusinessContact(quote, source.candidate, false, organizationIdentified), pageIndex, segmentIndex, quote, visibleTextDigest }); }
      catch { if (supportedBusinessRoute(quote) && quote.includes("@")
        && !restrictedContact.test(quote)) throw new Error("contact_resolution_ambiguous_segment"); }
    }
  }
  if (!found.length || new Set(found.map(x => x.email)).size !== 1) throw new Error("contact_resolution_missing_or_ambiguous");
  const selected = found[0], page = base.pages[selected.pageIndex];
  if (communicationsDigest(base.extraction) !== communicationsDigest({ version: EXTRACTOR, pageIndex: selected.pageIndex,
    segmentIndex: selected.segmentIndex, quote: selected.quote, visibleTextDigest: selected.visibleTextDigest })
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
export async function resolvePublicContact(source: any, prospectId: string, readPage: ContactPageReader, now: () => number) {
  assertContactUnknowns(source.candidate, true);
  const queue = [source.candidate.organization_url, ...source.candidate.evidence.filter((x: any) => x.classification === "operator").map((x: any) => x.url)];
  const visited = new Set<string>(), pages: z.infer<typeof pageSchema>[] = [], deadline = now() + 24000;
  while (queue.length && pages.length < 3 && visited.size < 6 && now() < deadline) {
    let url: string;
    try { url = contactFetchUrl(queue.shift()!, source.candidate.organization_url).href; } catch { continue; }
    if (visited.has(url)) continue; visited.add(url);
    let page: ContactPage;
    try { page = await readPage(url, source.candidate.organization_url, deadline); }
    catch (error) { if (error instanceof Error && error.message === "contact_fetch_page_unavailable") continue; throw error; }
    if (page.requestedUrl !== url || Date.parse(page.checkedAt) > now() || now() - Date.parse(page.checkedAt) > 60000) throw new Error("contact_resolution_check_date_invalid");
    const parsed = contactPageText(page), bytes = Buffer.from(page.bodyBase64, "base64");
    pages.push({ ...page, byteCount: bytes.length, bodyDigest: hash(bytes) });
    // Discovered contact links take precedence over another general source page.
    queue.unshift(...parsed.links);
  }
  const candidates = pages.flatMap((page, pageIndex) => {
    const parsed = contactPageText(page);
    if (parsed.visibilityUnverified) return [];
    const organizationIdentified = parsed.segments.some(segment => containsContactName(segment, source.candidate.organization));
    return parsed.segments.flatMap((quote, segmentIndex) => { try { return [{ ...extractBusinessContact(quote, source.candidate, false, organizationIdentified), pageIndex,
      segmentIndex, quote, visibleTextDigest: communicationsDigest({ segments: parsed.segments,
        restrictionText: parsed.restrictionText, visibilityUnverified: parsed.visibilityUnverified }) }]; } catch { return []; } });
  });
  if (!candidates.length) throw new Error(pages.some(page => contactPageText(page).visibilityUnverified)
    ? "contact_resolution_visibility_unverified" : "contact_resolution_missing_or_ambiguous");
  const selected = candidates[0], page = pages[selected.pageIndex];
  const base = checkResolution({ version: "blueprint.contact-resolution.v1", publication: contactPublication(source, prospectId), pages,
    contact: { email: selected.email, scope: selected.scope, organization: source.candidate.organization,
      site: selected.scope === "site" ? source.candidate.site : null, purpose: "business_inquiries", status: "public_business_contact",
      sourceUrl: page.finalUrl, sourceCheckedAt: page.checkedAt },
    extraction: { version: EXTRACTOR, pageIndex: selected.pageIndex, segmentIndex: selected.segmentIndex,
      quote: selected.quote, visibleTextDigest: selected.visibleTextDigest }, resolvedGaps: contactUnknowns(source.candidate).gaps }, source, prospectId);
  return contactResolutionSchema.parse({ ...base, qa: { version: "blueprint.contact-qa.v1", state: "approved",
    reviewedBy: "blueprint-communications-contact-verifier", reviewedAt: new Date(now()).toISOString(), inputDigest: communicationsDigest(base) } });
}
