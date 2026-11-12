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

export function jobWaitsForItsSentence(input: { requestId: string; record: Record<string, any> | null | undefined;
  preparationTaskNotNamed?: boolean }): boolean {
  const { record } = input;
  if (!record || record.site_task_brief_confirmed_at) return false;
  const { captureId } = siteWalkthroughIdentity(input.requestId, record);
  return input.preparationTaskNotNamed === true || jobAwaitsItsSentence(record, captureId);
}

/** The same decision for a caller that holds only the job record: it reads the current capture's preparation status. */
export async function loadJobWaitsForItsSentence(requestId: string, record: Record<string, any> | null | undefined): Promise<boolean> {
  if (!record || record.site_task_brief_confirmed_at) return false;
  let preparationTaskNotNamed = false;
  try {
    const { captureId } = siteWalkthroughIdentity(requestId, record);
    const session = db ? (await db.collection("captureUploadSessions").doc(captureId).get()).data() : undefined;
    if (session?.website_preparation) {
      const { loadCurrentWebsitePreparationStatus } = await import("./websitePreparationStatus");
      preparationTaskNotNamed = (await loadCurrentWebsitePreparationStatus(requestId, captureId)).taskNotNamed === true;
    }
  } catch { preparationTaskNotNamed = false; }
  return jobWaitsForItsSentence({ requestId, record, preparationTaskNotNamed });
}
