import { z } from "zod";
import { communicationsDigest } from "./communications-contract";
import { contactProhibition, contactUnknowns, sameOperatorUrl, publishedPublicContact } from "./communications-contact-evidence";

const text = z.string().trim().min(1).max(1200);
export const RESEARCH_RECIPIENT_GUIDANCE = "Prefer a verified introduction when available, then a current relevant named professional contact. Use a general inbox only after a real search. Assess who owns this task/question, their actual department/remit, decision authority or credible routing ability; a name or senior title alone is insufficient. Record sources, actual searches and limits, and disclose inferred authority. Never guess email patterns or mutual relationships; exclude private personal data and restricted routes. A named address or consumer email provider is not by itself a reason to reject a public professional contact.";
/** Judgment is recorded with its evidence, not encoded as magic contact words.
 * Only the authenticated admission service writes this into protected sources. */
export const sourceAssessmentSchema = z.object({
  rationale: text,
  contact: z.object({ evidenceIndex: z.number().int().nonnegative(), email: z.string().email(),
    scope: z.enum(["site", "organization_business_route"]), purpose: z.literal("business_inquiries"), rationale: text,
    selection: z.object({ kind: z.enum(["verified_introduction", "professional_person", "general_inbox"]),
      role: text, relevance: text, authorityBasis: z.enum(["operator_stated_remit", "inferred_routing"]),
      searchSummary: text, sourceRefs: z.array(z.string().url()).max(16) }).strict(),
  }).strict(),
  geography: z.object({ evidenceIndex: z.number().int().nonnegative(), countryCode: z.literal("US"),
    address: text, rationale: text }).strict(),
  resolvedGaps: z.array(z.object({ unknown: text, rationale: text }).strict()).max(16),
  conflicts: z.array(text).max(8),
}).strict();
export type SourceAssessment = z.infer<typeof sourceAssessmentSchema>;

export const qualifiedSourceContact = (source: any) => source.assessment
  ? assessedPublicContact(source.candidate, source.assessment) : publishedPublicContact(source.candidate);

function operatorEvidence(candidate: any, index: number, role: string) {
  const entry = candidate.evidence?.[index];
  if (!entry || entry.role !== role || entry.classification !== "operator" || entry.claim_kind !== "fact"
    || entry.origin !== "live" || entry.assertion_scope !== "current_operational"
    || entry.visibility !== "public" || !["rendered", "static", "operator_document"].includes(entry.retrieval)
    || !sameOperatorUrl(entry.url, candidate.organization_url)) throw new Error("source_assessment_operator_evidence_invalid");
  return entry;
}

export function assessedPublicContact(candidate: any, value: unknown) {
  const assessment = sourceAssessmentSchema.parse(value), selected = assessment.contact;
  const entry = operatorEvidence(candidate, selected.evidenceIndex, "contact");
  const emails = (entry.quote.match(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []).map((x: string) => x.toLowerCase());
  // Purpose belongs to this visible excerpt and route, not the email's domain.
  if (!emails.includes(selected.email.toLowerCase()) || new Set(emails).size !== 1
    || /\b(?:support only|technical support only|customer support only|personal only|(?:careers?|jobs?|press|media|privacy|legal)(?: inquiries)? only)\b/i.test(entry.quote)
    || /\/(?:careers?|jobs?|privacy|legal|support)(?:[\/_.-]|$)/i.test(new URL(entry.url).pathname)
    || assessment.conflicts.length || candidate.evidence.some((item: any) => contactProhibition.test(`${item.claim} ${item.quote}`))) {
    throw new Error("source_assessment_contact_restricted_or_conflicting");
  }
  const resolved = assessment.resolvedGaps.map(x => x.unknown), unknowns = contactUnknowns(candidate);
  if (new Set(resolved).size !== resolved.length || resolved.some(x => !unknowns.gaps.includes(x))
    || unknowns.blocked.length || unknowns.gaps.some(x => !resolved.includes(x))) throw new Error("verified_contact_conflicting_unknowns");
  return { email: selected.email.toLowerCase(), scope: selected.scope, sourceUrl: entry.url,
    sourceCheckedAt: entry.source_checked_at ?? entry.checked_date,
    evidenceDigest: communicationsDigest({ entry, assessment }), kind: "published_evidence" as const, resolvedGaps: resolved };
}

export function assessedSiteGeography(candidate: any, value: unknown) {
  const assessment = sourceAssessmentSchema.parse(value);
  const entry = operatorEvidence(candidate, assessment.geography.evidenceIndex, "geography");
  // The exact site/address relationship is reviewed. A headquarters or another
  // facility cannot supply the positive evidence for this site's geography.
  const normalize = (x: string) => x.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const address = normalize(assessment.geography.address);
  if (!address || !normalize(entry.quote).includes(address) || normalize(candidate.location) !== address
    || /\b(?:not located|outside (?:the )?(?:US|USA|United States))\b/i.test(entry.quote)
    || assessment.conflicts.length) throw new Error("source_assessment_site_geography_invalid");
  return { countryCode: "US", sourceUrl: entry.url, sourceCheckedAt: entry.source_checked_at ?? entry.checked_date,
    claim: entry.claim, evidenceDigest: communicationsDigest({ entry, assessment }), scope: "published_business_site" };
}
