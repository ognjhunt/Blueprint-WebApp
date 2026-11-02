/**
 * C-04: a website job hears once when its scene intent reaches a terminal outcome.
 *
 * The scene intake worker writes a pending intent on the intake in the same
 * write that stores the status carrying the outcome: a hold (we can't simulate
 * this kind of job yet), a withdrawal, or a setup Blueprint stopped. A wait
 * writes none. The outbox pump queues one `scene_outcome` notice per intent and
 * clears the flag only once the outbox row exists, or once a job evaluation
 * outcome email (F-01) has already told the site where its job stands. Dispatch
 * reads the job page again and cancels a notice whose outcome the page no
 * longer states.
 *
 * The event id is the outcome's kind and its own digest, so the same outcome
 * read again on a later poll is the same email, never a second one.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { isTerminalSceneOutcomeKind, parseSceneOutcomeNoticeIntent } from "./sceneIntentOutcome";

/** Outbox states in which an email may have left, or is leaving. */
const WENT_OUT = new Set(["dispatching", "unknown", "sent"]);

/** Whether a job evaluation outcome email (F-01) went out for this job: it supersedes a scene outcome email. */
export async function screeningOutcomeNoticeSent(requestId: string): Promise<boolean> {
  if (!db) throw new Error("scene_outcome_notification_store_unavailable");
  const { CAPTURE_OUTBOX_COLLECTION } = await import("./captureOutbox");
  const rows = await db.collection(CAPTURE_OUTBOX_COLLECTION).where("requestId", "==", requestId)
    .where("kind", "==", "evaluation_outcome").get();
  return rows.docs.some(row => WENT_OUT.has(String(row.data()?.status ?? "")));
}

/** Queue each pending intent once; the flag clears only when its outbox row exists or none is owed. */
export async function reconcileSceneOutcomeNotifications(limit = 20): Promise<void> {
  if (!db) return;
  const store = db;
  const [{ enqueueTaskLifecycleNotification }, { CAPTURE_OUTBOX_COLLECTION }, { SCENE_INTAKE_COLLECTION }] = await Promise.all([
    import("./taskLifecycleNotifications"), import("./captureOutbox"), import("./taskEvaluationSceneIntake")]);
  const query = store.collection(SCENE_INTAKE_COLLECTION).where("scene_outcome_notification_pending", "==", true);
  let rows = await automationBatch(store, query, "scene_outcome_notifications", limit);
  if (!rows.docs.length) rows = await automationBatch(store, query, "scene_outcome_notifications", limit);
  for (const row of rows.docs) {
    const intent = parseSceneOutcomeNoticeIntent(row.data()?.scene_outcome_notification_intent);
    if (!intent) {
      logger.warn({ intakeId: row.id }, "A scene outcome notice intent is unreadable; it stays pending for review");
      continue;
    }
    try {
      // The site already heard its job's evaluation outcome: no second email.
      const superseded = await screeningOutcomeNoticeSent(intent.request_id);
      // Refused while recording permission is withdrawn or no contact is on file: the intent stays pending.
      if (!superseded) await enqueueTaskLifecycleNotification({ requestId: intent.request_id, milestone: "scene_outcome",
        eventId: intent.event_id, sceneOutcomeKind: intent.kind });
      const queued = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(`${intent.request_id}:scene_outcome:${intent.event_id}`);
      await store.runTransaction(async transaction => {
        const current = await transaction.get(row.ref);
        const outbox = await transaction.get(queued);
        // A duplicate and a failed write look alike to enqueue; only the row clears the flag,
        // and only for the intent it was queued from.
        if (!superseded && !outbox.exists
          || crossRuntimeDigest(current.data()?.scene_outcome_notification_intent ?? null) !== crossRuntimeDigest(intent)) return;
        transaction.set(row.ref, { scene_outcome_notification_pending: false }, { merge: true });
      });
    } catch (error) {
      logger.warn({ error, intakeId: row.id }, "A scene outcome notice stays pending for the next pass");
    }
  }
}

/** The outcome a queued notice's key names, or null. */
function noticeOutcome(requestId: string, idempotencyKey: string) {
  const prefix = `${requestId}:scene_outcome:`;
  if (!idempotencyKey.startsWith(prefix)) return null;
  const match = /^([a-z_]+)-([a-f0-9]{64})$/.exec(idempotencyKey.slice(prefix.length));
  return match && isTerminalSceneOutcomeKind(match[1]) ? { kind: match[1], digest: `sha256:${match[2]}` } : null;
}

/**
 * Whether the job page states the terminal outcome a queued notice names: the
 * same scene progression of the job's current capture that the page reads,
 * and no evaluation outcome email (F-01) went out meanwhile. Throws when it
 * cannot be read, which leaves the claim recoverable rather than cancelling
 * or sending it.
 */
export async function sceneOutcomeShown(requestId: string, idempotencyKey: string): Promise<boolean> {
  const named = noticeOutcome(requestId, idempotencyKey);
  if (!named || !db) return false;
  const record = (await db.collection("inboundRequests").doc(requestId).get()).data();
  if (!record) return false;
  const [{ readWebsiteSceneProgression }, { siteWalkthroughIdentity }] = await Promise.all([
    import("./websiteSceneProgression"), import("./siteWalkthrough")]);
  const shown = (await readWebsiteSceneProgression(requestId, siteWalkthroughIdentity(requestId, record).captureId))?.sceneOutcome;
  if (!shown?.terminal || shown.kind !== named.kind || shown.digest !== named.digest) return false;
  return !(await screeningOutcomeNoticeSent(requestId));
}
