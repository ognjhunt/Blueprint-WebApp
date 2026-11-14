/**
 * The ops alerts a screening publication raises when it is ingested (owner decision 2026-11-11). Each is
 * one alert per job, recorded beside the job's safety-limit alert and reported by the same pass
 * (`scanOverBudgetWebsiteJobs`). Nothing here refuses a publication or changes what is ingested.
 *
 * - `screening_over_safety_limit`: the Pipeline reported a testing limit or committed total above the
 *   job's safety limit. The publication is accepted and counted in full toward the job's total, which
 *   then refuses further spend; a person needs to look at why.
 * - `screening_job_ceiling`: testing held at least one AI robot back at the job's limit (Pipeline
 *   `website_job_ceiling_insufficient`), so a person can decide whether to raise the job's limit.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { screeningJobCeilingRow, screeningPublicationAboveSafetyLimit, type BetaPolicyScreeningPublication }
  from "./betaPolicyScreeningContract";
import { SCENE_INTAKE_COLLECTION } from "./taskEvaluationSceneIntake";
import { websiteJobCeiling, websiteJobSafetyLimitUsd } from "./websiteJobCeiling";
import { websiteJobAlert } from "./websiteSceneSponsorship";

/** Records the alerts this publication owes, once per job. Returns the kinds it found owed. Throws when the store cannot be used. */
export async function recordScreeningPublicationAlerts(publication: BetaPolicyScreeningPublication) {
  if (!db) throw new Error("screening_store_unavailable");
  const store = db;
  const matches = await store.collection(SCENE_INTAKE_COLLECTION)
    .where("receipt.intent_id", "==", publication.source.scene_intent_id).limit(2).get();
  if (matches.docs.length !== 1) return [];
  const requestId = matches.docs[0].data()?.website_request_id;
  if (typeof requestId !== "string" || !requestId) return [];
  return store.runTransaction(async transaction => {
    const record = (await transaction.get(store.collection("inboundRequests").doc(requestId))).data();
    if (!record) return [];
    const ceiling = websiteJobCeiling({ record, captureId: publication.source.capture_id, requestId });
    const safetyLimitUsd = websiteJobSafetyLimitUsd(ceiling);
    const owed: Array<[Parameters<typeof websiteJobAlert>[3], Record<string, unknown>]> = [];
    const base = { schema_version: "website_screening_publication_alert.v1", campaign_id: publication.campaign_id,
      revision: publication.revision, job_ceiling_usd: ceiling.maximum_cost_usd, safety_limit_usd: safetyLimitUsd,
      ...(publication.budget.limit_usd !== undefined ? { limit_usd: publication.budget.limit_usd } : {}),
      committed_upper_bound_usd: publication.budget.committed_upper_bound_usd,
      recorded_at_epoch: Date.now() / 1000 };
    if (screeningPublicationAboveSafetyLimit(publication.budget, safetyLimitUsd)) owed.push(["screening_over_safety_limit", base]);
    const held = publication.candidates.filter(screeningJobCeilingRow).map(row => row.candidate_id);
    if (held.length) owed.push(["screening_job_ceiling", { ...base, candidate_ids: held.slice(0, 50), candidate_count: held.length }]);
    // Reads first, then writes, as a Firestore transaction requires.
    const writes = await Promise.all(owed.map(([kind, value]) => websiteJobAlert(store, transaction, requestId, kind, value)));
    writes.forEach(write => write());
    return owed.map(([kind]) => kind);
  });
}
