/**
 * The outcome notice intent the screening ingest and the holds route write beside a run's outcome
 * (`outcome_notification_intent`), and the one email that still goes from it: a stored hold's
 * (`run_kind: beta_policy_screening_hold`), telling the site its job is held at the scene stage. Blueprint's own
 * early trial is no longer told (2026-11-14): a campaign's intent stays stored and is never queued, and a queued
 * notice that names a trial outcome is cancelled at dispatch (`evaluationOutcomeShown`).
 *
 * The event id is the outcome and the scene intent, so the same hold on the same scene is one email. Dispatch reads
 * the job page again and cancels a notice whose hold the page no longer states.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { isScreeningResultOutcome, screeningCandidateRows, screeningOutcome, screeningOutcomeCaveat, SCREENING_OUTCOME_CAVEATS,
  type BetaPolicyScreeningPublication, type ScreeningOutcome , SCREENING_HOLD_DETAILS, type ScreeningHoldDetail } from "./betaPolicyScreeningContract";

export const SCREENING_OUTCOME_NOTICE_SCHEMA = "screening_outcome_notification.v1";
const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const count = z.number().int().min(0).max(1_000_000);
const intentSchema = z.object({
  schema_version: z.literal(SCREENING_OUTCOME_NOTICE_SCHEMA), request_id: identifier, run_id: identifier,
  outcome: z.enum(["estimate", "reference_only", "held_capability", "held_unprepared", "infeasible", "no_match",
    "held_setup", "held_budget", "held_scene_check"]),
  event_id: z.string().regex(/^[a-z_]+-[a-f0-9]{24}$/),
  counts: z.object({ ran: count, total: count, scored: count }).strict().optional(),
  /** What the estimate's sentence adds; absent on intents written before it existed and on every other outcome. */
  caveat: z.enum(SCREENING_OUTCOME_CAVEATS).optional(),
  /** A hold's detail with words of its own (`screeningHoldDetail`); only on a set-up hold. */
  hold_detail: z.enum(SCREENING_HOLD_DETAILS).optional(),
}).strict().refine(value => value.event_id.startsWith(`${value.outcome}-`) && (value.outcome === "estimate") === Boolean(value.counts)
  && (value.caveat === undefined || value.outcome === "estimate") && (value.hold_detail === undefined || value.outcome === "held_setup"));
export type ScreeningOutcomeNoticeIntent = z.infer<typeof intentSchema>;

/** The same outcome on the same scene is one email, whichever campaign reached it. */
export const screeningOutcomeNoticeEventId = (outcome: string, sceneIntentId: string) =>
  `${outcome}-${createHash("sha256").update(sceneIntentId).digest("hex").slice(0, 24)}`;

/** The notice a run with a result outcome owes its site, or null. Pure: ingest writes it beside the outcome. */
export function screeningOutcomeNoticeIntent(publication: BetaPolicyScreeningPublication, requestId: string): ScreeningOutcomeNoticeIntent | null {
  const outcome = screeningOutcome(publication);
  if (!isScreeningResultOutcome(outcome)) return null;
  const caveat = screeningOutcomeCaveat(publication);
  // Counts of candidates: the known-good control is a check, not one of them.
  const rows = screeningCandidateRows(publication.candidates);
  return { schema_version: SCREENING_OUTCOME_NOTICE_SCHEMA, request_id: requestId, run_id: publication.campaign_id, outcome,
    event_id: screeningOutcomeNoticeEventId(outcome, publication.source.scene_intent_id),
    ...(outcome === "estimate" ? { counts: { ran: rows.filter(row => row.status === "completed").length,
      total: rows.length, scored: rows.reduce((sum, row) => sum + row.episodes_scored, 0) } } : {}),
    ...(caveat ? { caveat } : {}) };
}

/** The notice a Pipeline hold owes its site (no campaign started), or null. Same key as a run's: one email per outcome and scene. */
export function heldOutcomeNoticeIntent(outcome: ScreeningOutcome | null, requestId: string, runId: string,
  sceneIntentId: string, holdDetail: ScreeningHoldDetail | null = null): ScreeningOutcomeNoticeIntent | null {
  if (!isScreeningResultOutcome(outcome) || outcome === "estimate") return null;
  return parseScreeningOutcomeNoticeIntent({ schema_version: SCREENING_OUTCOME_NOTICE_SCHEMA, request_id: requestId, run_id: runId,
    outcome, event_id: screeningOutcomeNoticeEventId(outcome, sceneIntentId),
    ...(holdDetail && outcome === "held_setup" ? { hold_detail: holdDetail } : {}) });
}

export function parseScreeningOutcomeNoticeIntent(value: unknown): ScreeningOutcomeNoticeIntent | null {
  const parsed = intentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The run kind the holds route stores (`betaPolicyScreeningHold.ts`). */
const HOLD_RUN_KIND = "beta_policy_screening_hold";
/** A hold's outcome: told by email. An estimate, reference-only, out-of-reach or no-match outcome was the trial's. */
export const isHoldNoticeOutcome = (outcome: unknown): outcome is ScreeningOutcome =>
  typeof outcome === "string" && outcome.startsWith("held_") && isScreeningResultOutcome(outcome);

/** Queue each pending intent once; the flag clears only when its outbox row exists. */
export async function reconcileScreeningOutcomeNotifications(limit = 20): Promise<void> {
  if (!db) return;
  const store = db;
  const [{ enqueueTaskLifecycleNotification }, { CAPTURE_OUTBOX_COLLECTION }] = await Promise.all([
    import("./taskLifecycleNotifications"), import("./captureOutbox")]);
  // Only a stored hold (`ingestBetaPolicyScreeningHold`) is told: Blueprint's own early trial no longer is (2026-11-14).
  const query = store.collection("taskEvaluationPolicyRuns").where("outcome_notification_pending", "==", true)
    .where("run_kind", "==", HOLD_RUN_KIND);
  let rows = await automationBatch(store, query, "screening_outcome_notifications", limit);
  if (!rows.docs.length) rows = await automationBatch(store, query, "screening_outcome_notifications", limit);
  for (const row of rows.docs) {
    if (row.data()?.run_kind !== HOLD_RUN_KIND) continue;
    const intent = parseScreeningOutcomeNoticeIntent(row.data()?.outcome_notification_intent);
    if (!intent || !isHoldNoticeOutcome(intent.outcome)) {
      logger.warn({ runId: row.id }, "An evaluation outcome notice intent is unreadable; it stays pending for review");
      continue;
    }
    try {
      // Refused while recording permission is withdrawn or no contact is on file: the intent stays pending.
      await enqueueTaskLifecycleNotification({ requestId: intent.request_id, milestone: "evaluation_outcome",
        eventId: intent.event_id, screeningOutcome: intent.outcome,
        ...(intent.hold_detail ? { screeningHoldDetail: intent.hold_detail } : {}) });
      const queued = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(`${intent.request_id}:evaluation_outcome:${intent.event_id}`);
      await store.runTransaction(async transaction => {
        const current = await transaction.get(row.ref);
        const outbox = await transaction.get(queued);
        // A duplicate and a failed write look alike to enqueue; only the row clears the flag,
        // and only for the intent it was queued from.
        if (!outbox.exists || crossRuntimeDigest(current.data()?.outcome_notification_intent ?? null) !== crossRuntimeDigest(intent)) return;
        transaction.set(row.ref, { outcome_notification_pending: false }, { merge: true });
      });
    } catch (error) {
      logger.warn({ error, runId: row.id }, "An evaluation outcome notice stays pending for the next pass");
    }
  }
}

/** The result outcome a queued notice's key names, or null. */
function noticeOutcome(requestId: string, idempotencyKey: string) {
  const prefix = `${requestId}:evaluation_outcome:`;
  if (!idempotencyKey.startsWith(prefix)) return null;
  const outcome = /^([a-z_]+)-[a-f0-9]{24}$/.exec(idempotencyKey.slice(prefix.length))?.[1];
  return isScreeningResultOutcome(outcome) ? outcome : null;
}

/**
 * Whether the job page states the outcome a queued notice names: the same scene
 * progression of the job's current capture that the page and the
 * `scene_tests_started` check read. A hold the scene's own outcome states (C-04)
 * is that outcome's to tell, in its own one email, not an evaluation's. Throws
 * when it cannot be read, which leaves the claim recoverable rather than
 * cancelling or sending it.
 */
export async function evaluationOutcomeShown(requestId: string, idempotencyKey: string): Promise<boolean> {
  const outcome = noticeOutcome(requestId, idempotencyKey);
  if (!outcome || !isHoldNoticeOutcome(outcome) || !db) return false;
  const record = (await db.collection("inboundRequests").doc(requestId).get()).data();
  if (!record) return false;
  const [{ readWebsiteSceneProgression }, { siteWalkthroughIdentity }, { sceneProgressionOutcome }] = await Promise.all([
    import("./websiteSceneProgression"), import("./siteWalkthrough"), import("./taskStatusProjection")]);
  const progression = await readWebsiteSceneProgression(requestId, siteWalkthroughIdentity(requestId, record).captureId);
  return !progression?.sceneOutcome && sceneProgressionOutcome(progression) === outcome;
}
