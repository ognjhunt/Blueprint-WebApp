/**
 * Whether a job is waiting for the site to name it in one sentence (review, 2026-11-12): ONE decision, from the same
 * signals and the same capture identity, for the job outlook, the page's naming form (`taskStatementNeeded`), the
 * "needs attention" email it suppresses, and the answer screen. The signals: the Pipeline's preparation status for the
 * job's current capture carries `website_task_not_named`, or its verified Atlas preview is `needs_input` with that
 * reason. Once the site has confirmed its brief, it is no longer waiting on the site.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { jobAwaitsItsSentence } from "./taskPreparationOutcome";

/** The site's brief as far as this decision reads it: whether it holds the site's own sentence yet. */
export type SentenceBrief = { summary?: string | null; confirmedAtIso?: string | null } | null | undefined;

/**
 * Waiting only while the Pipeline says so AND the site has not given its sentence (review, 2026-11-12): once the brief
 * holds a real sentence (named, even if not confirmed) or is confirmed, nothing waits on the site. The Pipeline
 * re-reads the job within the hour.
 */
export function jobWaitsForItsSentence(input: { requestId: string; record: Record<string, any> | null | undefined;
  brief: SentenceBrief; preparationTaskNotNamed?: boolean; isPlaceholder: (summary: string | null | undefined) => boolean }): boolean {
  const { record, brief } = input;
  if (!record || record.site_task_brief_confirmed_at || brief?.confirmedAtIso) return false;
  if (brief && !input.isPlaceholder(brief.summary)) return false;
  const { captureId } = siteWalkthroughIdentity(input.requestId, record);
  return input.preparationTaskNotNamed === true || jobAwaitsItsSentence(record, captureId);
}

/** The same decision for a caller that holds only the job record: it reads the brief and the current capture's status. */
export async function loadJobWaitsForItsSentence(requestId: string, record: Record<string, any> | null | undefined,
  knownBrief?: SentenceBrief): Promise<boolean> {
  if (!record || record.site_task_brief_confirmed_at) return false;
  const { getBrief, isPlaceholderSummary } = await import("./siteTaskBrief");
  let brief: SentenceBrief = knownBrief;
  if (brief === undefined) {
    try { brief = await getBrief(requestId); } catch { return false; }
  }
  if (brief && (brief.confirmedAtIso || !isPlaceholderSummary(brief.summary))) return false;
  let preparationTaskNotNamed = false;
  try {
    const { captureId } = siteWalkthroughIdentity(requestId, record);
    const session = db ? (await db.collection("captureUploadSessions").doc(captureId).get()).data() : undefined;
    if (session?.website_preparation) {
      const { loadCurrentWebsitePreparationStatus } = await import("./websitePreparationStatus");
      preparationTaskNotNamed = (await loadCurrentWebsitePreparationStatus(requestId, captureId)).taskNotNamed === true;
    }
  } catch { preparationTaskNotNamed = false; }
  return jobWaitsForItsSentence({ requestId, record, brief, preparationTaskNotNamed, isPlaceholder: isPlaceholderSummary });
}
