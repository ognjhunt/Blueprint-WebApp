/**
 * The Pipeline's first look (status v8, `website_robot_fit_projection.v2`) in words, for the site's job page
 * and the company's job page. Both call the same function with the same stored status and the same
 * `job_facts`, so the same row reads the same on both.
 *
 * It reads the status the website last stored for the job's current walkthrough (no Pipeline call): the
 * stored row is verified when it is written and re-parsed here. Null when there is no v2 table yet (an
 * older Pipeline answered v7, the table did not run, or nothing is stored): the page then keeps what it
 * showed before.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { firstLookInWords, type FirstLookWords } from "../../client/src/lib/firstLookWords";
import { readJobFacts } from "./jobFacts";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { storedRobotFitV2 } from "./websitePreparationStatus";

export type { FirstLookRowWords, FirstLookWords } from "../../client/src/lib/firstLookWords";

/** Pure: a stored `website_preparation` value and the job's facts, worded; null without a completed v2 table. */
export function firstLookFromStoredPreparation(storedPreparation: unknown, jobRecord: Record<string, unknown> | null | undefined):
  FirstLookWords | null {
  const fit = storedRobotFitV2(storedPreparation);
  if (!fit || fit.status !== "completed") return null;
  return firstLookInWords(fit, readJobFacts(jobRecord));
}

/** The job's first look in words, read from its stored status and its `job_facts`. Pass the job record if you have it. */
export async function loadFirstLookWords(requestId: string, jobRecord?: Record<string, unknown> | null): Promise<FirstLookWords | null> {
  if (!db) return null;
  const record = jobRecord !== undefined ? jobRecord
    : (await db.collection("inboundRequests").doc(requestId).get()).data() as Record<string, unknown> | undefined;
  const { captureId } = siteWalkthroughIdentity(requestId, (record ?? undefined) as { active_capture_id?: unknown } | undefined);
  const session = (await db.collection("captureUploadSessions").doc(captureId).get()).data();
  return firstLookFromStoredPreparation(session?.website_preparation, record ?? null);
}
