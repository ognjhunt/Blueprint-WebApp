import { z } from "zod";
import {
  briefRefreshReasons, communicationsBriefSchema, communicationsDigest,
  verifyCommunicationsHandoff, type CommunicationsBrief, type CommunicationsHandoff,
} from "./communications-contract";
import { researchPublicationSource } from "./communications-research";
import { COMMUNICATIONS_ROOT } from "./communications-store";
import { PUBLIC_CONTACT_PREFIX, sameOperatorUrl } from "./communications-contact-evidence";

const id = z.string().regex(/^[a-zA-Z0-9_.:-]{1,160}$/);
const text = z.string().trim().min(1).max(1200);
const url = z.string().url().max(1000).refine((value) => {
  const parsed = new URL(value);
  return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
});

/** Context a human must review; no facts, QA claims, recipient overrides or grants. */
export const communicationsResearchInputSchema = z.object({
  date: z.string().date(), candidateKey: text,
  context: z.object({
    siteId: id, taskId: id, caseId: id, decision: text, decisionOwner: text.nullable(),
    purpose: text, learningQuestion: text,
    contactSourceEmail: z.string().email().max(254), contactSourceUrl: url,
    contactSourceCheckedAt: z.union([z.string().datetime(), z.string().date()]),
    contactSourceIdentifiesRecipient: z.literal(true),
    consent: z.object({
      status: z.literal("public_business_contact"), sharingBoundary: text,
      sourceRefs: z.array(url).min(1).max(8),
    }).strict(),
    conflicts: z.array(text).max(8),
  }).strict(),
}).strict();
export type CommunicationsResearchInput = z.infer<typeof communicationsResearchInputSchema>;
export type CommunicationsResearchPreview = ReturnType<typeof previewResearchCommunications>;

function canonicalContext(prospect: any, context: CommunicationsResearchInput["context"], sourceId: string) {
  if (prospect?.stage !== "drafted" || typeof prospect.contactEmail !== "string"
    || prospect.contactEmail.toLowerCase() !== context.contactSourceEmail.toLowerCase()
    || (prospect.researchPublicationId && prospect.researchPublicationId !== sourceId)
    || ["siteId", "taskId", "caseId"].some((field) => prospect[field] && prospect[field] !== context[field as "siteId"])) {
    throw new Error("research_adapter_canonical_context_changed");
  }
  // Relationship/capability verification needs its owning review, not a new
  // assertion from this first-touch adapter.
  if (prospect.connectionEvidence || prospect.verifiedCapabilities?.length) throw new Error("research_adapter_relationship_review_required");
  return { facilityName: prospect.facilityName, hypothesisedTask: prospect.hypothesisedTask,
    contactEmail: prospect.contactEmail.toLowerCase(), stage: prospect.stage,
    siteId: context.siteId, taskId: context.taskId, caseId: context.caseId, researchPublicationId: sourceId };
}

/** Derive from durable publication; preview is read-only and never approval. */
export function previewResearchCommunications(snapshot: any, prospectId: string, prospect: any,
  inputValue: unknown, now: number, agentContactEvidenceDigest?: string,
  agentContact?: { kind: "published_evidence" | "public_operator_resolution"; scope: "site" | "organization_business_route"; resolvedGaps: string[] }) {
  const input = communicationsResearchInputSchema.parse(inputValue);
  const origin = { date: input.date, candidateKey: input.candidateKey,
    packetDigest: snapshot?.row?.packet_digest, rawArtifactDigest: snapshot?.row?.raw_output_digest,
    ...(snapshot?.row?.admission_id ? { admissionId: snapshot.row.admission_id } : {}) };
  const source = researchPublicationSource(snapshot, origin);
  const candidate = source.candidate;
  const canonical = canonicalContext(prospect, input.context, source.sheetsProspectId);
  if (candidate.organization !== canonical.facilityName || candidate.task !== canonical.hypothesisedTask) {
    throw new Error("research_adapter_candidate_prospect_mismatch");
  }
  if (!Array.isArray(candidate.evidence) || !candidate.evidence.length || !Array.isArray(candidate.unknowns)
    ) throw new Error("research_adapter_candidate_invalid");
  const facts: CommunicationsBrief["facts"] = candidate.evidence.map((entry: any, index: number) => {
    if (!["fact", "vendor_claim", "hypothesis"].includes(entry.claim_kind)
      || !["operator", "independent", "vendor"].includes(entry.classification)) throw new Error("research_adapter_evidence_invalid");
    return {
      id: `research-fact-${communicationsDigest({ candidateKey: input.candidateKey, index, entry })}`,
      claim: entry.claim, sourceUrl: entry.url,
      evidenceClass: entry.claim_kind === "hypothesis" ? "inference"
        : entry.claim_kind === "vendor_claim" || entry.classification === "vendor" ? "vendor_reported"
        : entry.classification === "operator" ? "operator_stated" : "primary",
      sourceCheckedAt: entry.source_checked_at ?? entry.checked_date,
      assertionScope: entry.assertion_scope ?? "as_of_background",
      publishedAt: entry.source_date ?? null, eventAt: null, consequential: true,
    };
  });
  const observation = candidate.evidence.findIndex((entry: any) => entry.role === "task"
    && entry.classification === "operator" && entry.claim_kind === "fact"
    && entry.origin === "live" && entry.assertion_scope === "current_operational"
    && (!entry.visibility || entry.visibility === "public") && sameOperatorUrl(entry.url, candidate.organization_url)
    && !entry.claim.startsWith(PUBLIC_CONTACT_PREFIX));
  if (observation < 0) throw new Error("research_adapter_public_task_fact_missing");
  const sourceDigest = communicationsDigest(source);
  const proposal = {
    version: "blueprint.communications-brief.v1" as const, briefId: "preview", revision: 1,
    prospectId: id.parse(prospectId), siteId: canonical.siteId, taskId: canonical.taskId, caseId: canonical.caseId,
    teamIds: [], capabilityIds: [], facilityName: canonical.facilityName, boundedJob: candidate.task,
    decision: input.context.decision, decisionOwner: input.context.decisionOwner,
    facts, unknowns: candidate.unknowns, conflicts: input.context.conflicts,
    stage: { interest: "unknown" as const, evidenceIds: [] },
    contact: { email: canonical.contactEmail, purpose: input.context.purpose, learningQuestion: input.context.learningQuestion,
      sourceUrl: input.context.contactSourceUrl, sourceCheckedAt: input.context.contactSourceCheckedAt,
      ...(agentContact ? { scope: agentContact.scope, resolvedMissingContactGaps: agentContact.resolvedGaps } : {}) },
    consent: input.context.consent, priorConversation: null,
    outreachContext: { observations: [{ claim: facts[observation].claim, source: facts[observation].sourceUrl }],
      teamObservations: [], verifiedCapabilities: [], connectionEvidence: null },
    researchOrigin: { ...origin, sourceDigest,
      ...(agentContactEvidenceDigest ? { contactEvidenceDigest: agentContactEvidenceDigest } : {}),
      ...(agentContact ? { contactEvidenceKind: agentContact.kind } : {}) },
  };
  // Parse before previewing: overflow refuses instead of truncating source text.
  const { qualityReview: _review, ...validated } = communicationsBriefSchema.parse({ ...proposal,
    qualityReview: { state: "approved", reviewedBy: "preview-only", reviewedAt: new Date(now).toISOString(),
      sourceRecordUrl: source.sourceRecordUrl ?? `https://www.notion.so/${source.notionReceipt.slice(7).replaceAll("-", "")}` } });
  const blockers = briefRefreshReasons({ ...validated, qualityReview: _review }, now);
  if (communicationsDigest(validated.unknowns) !== communicationsDigest(candidate.unknowns)
    || validated.facts.some((fact, index) => fact.claim !== candidate.evidence[index].claim)) {
    throw new Error("research_adapter_source_text_would_change");
  }
  if (!input.context.consent.sourceRefs.includes(input.context.contactSourceUrl)) blockers.push("contact_permission_source_missing");
  if (blockers.length) throw new Error(`research_adapter_review_required:${blockers.join(",")}`);
  const previewDigest = communicationsDigest({ proposal: validated, canonical, sourceDigest });
  return { proposal: { ...validated, briefId: `research-${previewDigest}` }, source, canonical, previewDigest,
    sourceRecordUrl: _review.sourceRecordUrl, requiresHumanContextApproval: !agentContactEvidenceDigest,
    sent: false as const, gmailDraftCreated: false as const, sessionCreated: false as const };
}

/** Atomic, immutable handoff creation after the exact preview is human approved. */
export async function approveResearchCommunications(db: FirebaseFirestore.Firestore,
  preview: CommunicationsResearchPreview, input: CommunicationsResearchInput, expectedDigest: string,
  reviewedBy: string, now: number) {
  if (!reviewedBy.trim() || expectedDigest !== preview.previewDigest) throw new Error("research_adapter_preview_changed");
  const brief = communicationsBriefSchema.parse({ ...preview.proposal, qualityReview: {
    state: "approved", reviewedBy, reviewedAt: new Date(now).toISOString(), sourceRecordUrl: preview.sourceRecordUrl,
  } });
  const digest = communicationsDigest(brief);
  const handoff: CommunicationsHandoff = { version: "blueprint.communications-handoff.v1", ...brief.qualityReview,
    briefDigest: digest, sheetsReceipt: preview.source.sheetsReceipt, notionReceipt: preview.source.notionReceipt,
    ...(preview.source.recordReceipt ? { recordReceipt: preview.source.recordReceipt } : {}) };
  const root = db.doc(COMMUNICATIONS_ROOT);
  const sourceRef = db.collection("outboundProspects").doc(brief.prospectId);
  const briefRef = root.collection("briefs").doc(brief.briefId);
  const bindingRef = root.collection("researchBindings").doc(communicationsDigest({
    sheetsId: preview.source.sheetsId, sheetsProspectId: preview.source.sheetsProspectId,
  }));
  return db.runTransaction(async (tx) => {
    const [prospect, existing, binding] = await Promise.all([tx.get(sourceRef), tx.get(briefRef), tx.get(bindingRef)]);
    if (binding.exists && (binding.data()?.prospectId !== brief.prospectId
      || binding.data()?.sheetsId !== preview.source.sheetsId
      || binding.data()?.sheetsProspectId !== preview.source.sheetsProspectId)) throw new Error("research_adapter_source_already_bound");
    if (!prospect.exists || communicationsDigest(canonicalContext(prospect.data(), input.context, preview.source.sheetsProspectId))
      !== communicationsDigest(preview.canonical)) throw new Error("research_adapter_canonical_context_changed");
    if (existing.exists) {
      if (!binding.exists) throw new Error("research_adapter_immutable_conflict");
      const saved = communicationsBriefSchema.parse(existing.data());
      const { qualityReview: _quality, ...savedProposal } = saved;
      if (communicationsDigest(savedProposal) !== communicationsDigest(preview.proposal)) throw new Error("research_adapter_immutable_conflict");
      const savedDigest = communicationsDigest(saved);
      const savedHandoff = (await tx.get(root.collection("handoffs").doc(savedDigest))).data();
      const savedSource = (await tx.get(root.collection("researchSources").doc(savedDigest))).data();
      if (!savedSource || savedSource.briefDigest !== savedDigest
        || communicationsDigest(savedSource.source) !== saved.researchOrigin.sourceDigest) throw new Error("research_adapter_immutable_conflict");
      verifyCommunicationsHandoff(savedHandoff, saved);
      return { brief: saved, handoff: savedHandoff, briefDigest: savedDigest, created: false };
    }
    tx.create(briefRef, brief);
    if (!binding.exists) tx.create(bindingRef, { prospectId: brief.prospectId,
      sheetsId: preview.source.sheetsId, sheetsProspectId: preview.source.sheetsProspectId });
    tx.create(root.collection("handoffs").doc(digest), handoff);
    tx.create(root.collection("researchSources").doc(digest), { briefDigest: digest, source: preview.source,
      previewDigest: preview.previewDigest, contactSourceIdentifiesRecipient: input.context.contactSourceIdentifiesRecipient });
    tx.set(sourceRef, { siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId,
      researchPublicationId: preview.source.sheetsProspectId,
      communicationsContextReview: { briefId: brief.briefId, briefDigest: digest, reviewedBy,
        reviewedAt: brief.qualityReview.reviewedAt, previewDigest: preview.previewDigest } }, { merge: true });
    tx.create(sourceRef.collection("communicationsEvents").doc(`research_${preview.previewDigest}`), {
      type: "research_context_approved", briefId: brief.briefId, briefDigest: digest,
      reviewedBy, reviewedAt: brief.qualityReview.reviewedAt, sent: false, sessionCreated: false,
    });
    return { brief, handoff, briefDigest: digest, created: true };
  });
}
