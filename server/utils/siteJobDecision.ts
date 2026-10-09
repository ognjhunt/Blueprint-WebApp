import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { humanDecisionDigest } from "./human-reply-admission";

/** Bind a named review to the current job evidence, not to a processing stage.
 * Saving the decision or accepting its proposal does not change that evidence. */
export function siteJobDecisionSourceDigest(record: Record<string, any>, brief: unknown, assessment: unknown) {
  return humanDecisionDigest({ request: record.request ?? null, brief: brief ?? null,
    rights: projectWebsiteCaptureRights(record), advisory: record.site_advisory ?? null, assessment: assessment ?? null,
    customerStatements: record.customerConversation ?? [], clarification: record.site_task_clarification ?? null,
    proposal: record.pilot_recommendation ?? null });
}

/** Only the same CURRENT, source-rich private basis can preserve a v1 review.
 * Reduced DTOs never recorded an independent immutable evidence identity. */
function currentLegacyBasis(assessment: unknown): unknown | null {
  const value = assessment as Record<string, any> | null;
  const binding = value?.decisionEvidence;
  if (binding?.schemaVersion !== "site_decision_evidence.v1" || binding.legacyReviewCompatible !== true
    || !/^[a-f0-9]{64}$/.test(binding.packetSha256) || !/^[a-f0-9]{64}$/.test(binding.qualificationSha256)
    || value?.state !== "ready" || !Array.isArray(value.sections)
    || !value.sections.some((section: any) => Array.isArray(section.claims)
      && section.claims.some((claim: any) => claim.verificationStatus === "source_bound"))) return null;
  const { decisionEvidence: _binding, ...legacy } = value;
  return legacy;
}

export function projectCurrentSiteJobDecision(record: Record<string, any>, brief: unknown, assessment: unknown, _compatibleAssessments: readonly unknown[] = []) {
  const decision = record.customer_decision;
  const legacy = currentLegacyBasis(assessment);
  if (decision?.schemaVersion !== "site_job_decision.v1" || typeof decision.reviewedBy !== "string"
    || !decision.reviewedBy || !Number.isFinite(Date.parse(decision.reviewedAtIso))
    // A reduced presentation hash is not approval authority. Keep the fourth
    // argument source-compatible, but never treat a supplied alias as authority.
    || decision.sourceDigest !== siteJobDecisionSourceDigest(record, brief, assessment)
      && (!legacy || decision.sourceDigest !== siteJobDecisionSourceDigest(record, brief, legacy))) return null;
  return { recommendation: decision.recommendation, why: decision.why,
    decisiveUncertainty: decision.decisiveUncertainty, nextAction: decision.nextAction,
    question: decision.question ?? null, reviewedAtIso: decision.reviewedAtIso };
}
