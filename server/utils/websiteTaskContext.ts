import type { SiteTaskBriefRecord } from "./siteTaskBrief";
import { canonicalArtifactDigest } from "./taskCandidateContract";

/** Minimal, current task snapshot. Never forwards owner contact or identity. */
export function projectWebsiteTaskContext(brief: SiteTaskBriefRecord) {
  const value = {
    schema_version: "website_site_task_context.v1",
    request_id: brief.requestId,
    scene_id: `site-${brief.requestId}`,
    capture_id: `walkthrough-${brief.requestId}`,
    description: brief.summary,
    confirmed: Boolean(brief.confirmedAtIso),
    confirmed_at: brief.confirmedAtIso,
    operator_answers: brief.operatorAnswers ?? {},
    unresolved: brief.operatorUnknown ?? brief.unresolved,
  };
  return { ...value, context_digest: canonicalArtifactDigest(value, "context_digest") };
}
