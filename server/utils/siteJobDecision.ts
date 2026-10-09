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

export function projectCurrentSiteJobDecision(record: Record<string, any>, brief: unknown, assessment: unknown, _compatibleAssessments: readonly unknown[] = []) {
  const decision = record.customer_decision;
  if (decision?.schemaVersion !== "site_job_decision.v1" || typeof decision.reviewedBy !== "string"
    || !decision.reviewedBy || !Number.isFinite(Date.parse(decision.reviewedAtIso))
    // A reduced presentation hash is not approval authority. Keep the fourth
    // argument source-compatible, but never treat a supplied alias as authority.
    || decision.sourceDigest !== siteJobDecisionSourceDigest(record, brief, assessment)) return null;
  return { recommendation: decision.recommendation, why: decision.why,
    decisiveUncertainty: decision.decisiveUncertainty, nextAction: decision.nextAction,
    question: decision.question ?? null, reviewedAtIso: decision.reviewedAtIso };
}
