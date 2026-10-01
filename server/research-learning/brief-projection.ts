import type { CommunicationsBrief } from "../agents/communications-contract";
import { digest } from "./contract";
import { publicUrl, safeText } from "./prior-research";

/** Called only after the owning brief/source/handoff verifier. No contact,
 * mailbox, artifact bytes, model instructions or approval authority escapes. */
export function projectBriefResearch(brief: CommunicationsBrief) {
  let omitted = false;
  const text = (value: string) => { const parsed = safeText(1200).safeParse(value); if (!parsed.success) omitted = true; return parsed.success ? parsed.data : null; };
  const facts = brief.facts.flatMap(fact => {
    const statement = text(fact.claim), source = publicUrl.safeParse(fact.sourceUrl);
    if (!statement || !source.success) { omitted = true; return []; }
    return [{ factId: fact.id, sourceHash: digest(fact), statement, sourceUrl: source.data, grade: fact.evidenceClass,
      sourceCheckedAt: fact.sourceCheckedAt, publishedAt: fact.publishedAt, eventAt: fact.eventAt,
      assertionScope: fact.assertionScope ?? "as_of_background", consequential: fact.consequential }];
  });
  const boundedTask = text(brief.boundedJob), boundedQuestion = text(brief.contact.learningQuestion), decision = text(brief.decision);
  const unknowns = brief.unknowns.flatMap(value => { const projected = text(value); return projected ? [projected] : []; });
  const conflicts = brief.conflicts.flatMap(value => { const projected = text(value); return projected ? [projected] : []; });
  return { version: "blueprint.prior-brief-research.v1", prospectId: brief.prospectId, briefId: brief.briefId,
    revision: brief.revision, briefHash: digest(brief), recordRef: `blueprintCommunications/default/briefs/${brief.briefId}`,
    siteId: brief.siteId, taskId: brief.taskId, caseId: brief.caseId, teamIds: brief.teamIds, capabilityIds: brief.capabilityIds,
    reviewedAt: brief.qualityReview.reviewedAt, boundedTask, boundedQuestion, decision, facts, unknowns, conflicts,
    contactOrDecisionOwnerAuthorityVerified: false, ...(omitted ? { privacyOmissions: "private_or_nonpublic_fields_omitted" } : {}) };
}
