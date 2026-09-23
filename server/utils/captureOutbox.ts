import { enqueueDueTaskStatusUpdates, acknowledgeTaskStatusUpdate, taskStatusUpdateIsCurrent } from "./taskStatusUpdates";
/**
 * A message that is not lost because the request that triggered it succeeded.
 *
 * ## The failure this closes
 *
 * Every automation on the intake path is fire-and-forget: pushed into an
 * `automationPromises[]` array and never awaited for durability. So the shape
 * the audit named is live -- the Firestore write lands, the process dies or the
 * email provider times out, and the notification is gone with nothing to retry
 * from. A site confirms a brief, hears nothing, and has no way to know whether
 * we saw it.
 *
 * The fix is the transactional-outbox pattern: the intent to notify is written
 * durably, in the same place as the state change, and delivery is a separate
 * pass that retries until it succeeds. A crash between the write and the send
 * costs latency, not the message.
 *
 * ## Delivery runs on a caller's path, not only a scheduler
 *
 * Same reasoning as `reconcileTeamHolds`: the scheduler lane in this repo is
 * off unless a flag is set, and a notification system that only works when a
 * background job is enabled is one that silently does nothing in a deployment
 * that forgot to enable it. So `deliverOutbox` is called opportunistically from
 * request paths, and a scheduler is an optimisation on top rather than the only
 * thing that makes it work.
 *
 * ## Dedup is the document id
 *
 * The idempotency key is the id, so enqueuing the same event twice -- a retried
 * request, a double-fired workflow -- is one row, and delivering it twice is
 * prevented by the status transition rather than by hoping the send is
 * idempotent (it is not; a second email is a second email).
 */

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { sendEmail } from "./email";

export const CAPTURE_OUTBOX_COLLECTION = "captureOutbox";

/** What the message is about. Drives nothing here; for the record and metrics. */
export type OutboxKind =
  /** Retired: the timed check-in. Kept so stored rows still type-check. */
  | "progress_update"
  | "task_received"
  | "video_received"
  | "scene_ready"
  | "listing_live"
  | "screening_cleared"
  | "screening_not_now"
  | "screening_started"
  | "results_ready"
  | "run_no_result"
  | "pilot_request"
  | "brief_confirmed"
  | "coverage_shortfall"
  | "assessment_ready"
  | "input_needed";

export type OutboxStatus = "pending" | "sent" | "failed" | "cancelled";

export interface OutboxEntry {
  idempotencyKey: string;
  requestId: string;
  kind: OutboxKind;
  to: string;
  subject: string;
  body: string;
  replyTo?: string | null;
  status: OutboxStatus;
  attempts: number;
  createdAtIso: string;
  sentAtIso: string | null;
  lastError: string | null;
}

/** Give up sending after this many tries, and say so rather than retrying forever. */
const MAX_ATTEMPTS = 6;

function nowIso() {
  return new Date().toISOString();
}

/**
 * Write the intent to notify, durably, before anything is sent.
 *
 * Returns whether a *new* entry was written. A duplicate key is not an error --
 * it means the event was already recorded, and the caller has done its job by
 * asking. Delivery retries use the same durable intent.
 */
export async function enqueueOutbox(entry: {
  idempotencyKey: string;
  requestId: string;
  kind: OutboxKind;
  to: string;
  subject: string;
  body: string;
  replyTo?: string | null;
}): Promise<{ enqueued: boolean }> {
  if (!db) return { enqueued: false };

  const ref = db.collection(CAPTURE_OUTBOX_COLLECTION).doc(entry.idempotencyKey);

  // `create` fails if the doc exists, which is the dedup: a retried enqueue of
  // the same event is a no-op rather than a second row and eventually a second
  // email.
  try {
    await ref.create({
      ...entry,
      replyTo: entry.replyTo ?? null,
      status: "pending",
      attempts: 0,
      createdAtIso: nowIso(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      sentAtIso: null,
      lastError: null,
    });
    return { enqueued: true };
  } catch (error) {
    // Already queued. The only expected error, and not one worth surfacing.
    // Firestore reports it as gRPC code 6; some clients as the string
    // "already-exists". Either is the dedup working, not a failure.
    const code = (error as { code?: number | string }).code;
    if (code === 6 || code === "already-exists") return { enqueued: false };
    logger.warn({ error, key: entry.idempotencyKey }, "Could not enqueue an outbox message");
    return { enqueued: false };
  }
}

export interface OutboxDeliverySummary {
  examined: number;
  sent: number;
  failed: number;
  exhausted: number;
}

/**
 * Send what is pending, and retry what failed.
 *
 * Reads the small set of undelivered entries and sends each. A send that fails
 * increments the attempt count and stays pending until the count is spent, at
 * which point it is marked `failed` and stops -- an unsendable address should
 * not be retried into the heat death of the universe.
 *
 * Delivery is at-least-once: a provider success followed by a failed status
 * write, or overlapping delivery passes, can resend an email. The document
 * id deduplicates enqueue intents, not non-transactional provider delivery.
 */
export async function deliverOutbox(params?: { limit?: number }): Promise<OutboxDeliverySummary> {
  const summary: OutboxDeliverySummary = { examined: 0, sent: 0, failed: 0, exhausted: 0 };
  if (!db) return summary;

  const limit = Math.max(1, Math.min(params?.limit ?? 20, 100));
  try { await enqueueDueTaskStatusUpdates(limit); }
  catch (error) { logger.warn({ error }, "Could not enqueue due task updates"); }
  try {
    const { reconcileSceneReadyNotifications } = await import("./taskLifecycleNotifications");
    await reconcileSceneReadyNotifications(limit);
  } catch (error) { logger.warn({ error }, "Could not reconcile scene-ready notices"); }
  const snapshot = await db
    .collection(CAPTURE_OUTBOX_COLLECTION)
    .where("status", "==", "pending")
    .limit(limit)
    .get();

  for (const doc of snapshot.docs) {
    const entry = doc.data() as OutboxEntry;
    summary.examined += 1;

    if (!(await taskStatusUpdateIsCurrent(entry))) {
      await doc.ref.set({ status: "cancelled" }, { merge: true });
      continue;
    }
    let result: Awaited<ReturnType<typeof sendEmail>>;
    try {
      result = await sendEmail({
        to: entry.to,
        subject: entry.subject,
        text: entry.body,
        replyTo: entry.replyTo ?? undefined,
      });
    } catch (error) {
      result = { sent: false, provider: null, messageId: null, error };
    }

    if (result.sent) {
      await doc.ref.set(
        { status: "sent", sentAtIso: nowIso(), attempts: entry.attempts + 1, lastError: null },
        { merge: true },
      );
      try { await acknowledgeTaskStatusUpdate(entry); }
      catch (error) { logger.warn({ error }, "Status deadline will advance on the next reconciliation"); }
      summary.sent += 1;
      continue;
    }

    const attempts = entry.attempts + 1;
    const lastError = result.error instanceof Error ? result.error.message : String(result.error ?? "send failed");
    if (attempts >= MAX_ATTEMPTS) {
      await doc.ref.set({ status: "failed", attempts, lastError }, { merge: true });
      summary.exhausted += 1;
      logger.error(
        { key: entry.idempotencyKey, requestId: entry.requestId, attempts },
        "Outbox message exhausted its retries",
      );
    } else {
      await doc.ref.set({ attempts, lastError }, { merge: true });
      summary.failed += 1;
    }
  }

  return summary;
}
