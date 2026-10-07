import { enqueueDueTaskStatusUpdates, acknowledgeTaskStatusUpdate, taskStatusUpdateIsCurrent } from "./taskStatusUpdates";
/**
 * Durable delivery for site lifecycle and evaluation notices once enqueued.
 *
 * The document id deduplicates notification intent. A transactional claim
 * fences concurrent request, scheduler and pump callers; a separate dispatch
 * marker consumes an attempt before the provider call. Expired pre-dispatch
 * claims can recover, but missing provider acknowledgements remain unknown
 * until evidence reconciles them. Expiry alone never authorizes another send.
 *
 * This does not make producer state changes atomic with enqueueOutbox: callers
 * must retain their own pending intent for recovery, and enqueueOutbox still
 * reports both duplicate intent and storage failure as enqueued:false.
 */

import { createHash, randomUUID } from "node:crypto";
import { automationBatch } from "./automationBatch";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { sendEmail } from "./email";
import { brandedEmail } from "./emailLayout";
import { getOpsAutomationLeaderLease } from "./automationLeaderLease";

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
  /** Blueprint's one recommended pilot, and the site booking it. */
  | "pilot_recommended"
  | "pilot_booked"
  | "brief_confirmed"
  | "coverage_shortfall"
  | "assessment_ready"
  | "input_needed"
  /** A fresh private task link, asked for from an expired one. */
  | "fresh_link"
  /** To the robot team that bought a run, when it reports. */
  | "team_run_result"
  | "team_run_no_result"
  /** A robot team's early-access application, received and decided. */
  | "robot_team_access_received"
  | "robot_team_access_approved"
  | "robot_team_access_not_yet"
  /** To approved robot teams, when a site lists a new task card. */
  | "robot_team_new_task";

export type OutboxStatus = "pending" | "claimed" | "dispatching" | "unknown" | "sent" | "failed" | "cancelled";

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
const DELIVERY_LEASE_MS = 5 * 60 * 1000;

// Bind the claim to the exact message, including the private owner link.
function messageDigest(entry: OutboxEntry): string {
  return createHash("sha256").update(JSON.stringify([
    entry.idempotencyKey, entry.requestId, entry.kind, entry.to,
    entry.subject, entry.body, entry.replyTo ?? null,
  ])).digest("hex");
}

/** Expiry permits another claim only before the durable dispatch marker.
 * Once dispatch could have happened, missing acknowledgement stays unknown. */
export async function reconcileOutboxDeliveries(limit = 20): Promise<void> {
  if (!db) return;
  for (const status of ["claimed", "dispatching"] as const) {
    const rows = await automationBatch(db, db.collection(CAPTURE_OUTBOX_COLLECTION)
      .where("status", "==", status), `capture_outbox_${status}`, limit);
    for (const row of rows.docs) await db.runTransaction(async tx => {
      const current = (await tx.get(row.ref)).data();
      if (current?.status !== status || !(current.deliveryLeaseUntilMs <= Date.now())) return;
      tx.set(row.ref, { status: status === "claimed" ? "pending" : "unknown",
        lastError: status === "claimed" ? "delivery_claim_expired_before_dispatch" : "delivery_outcome_unknown" }, { merge: true });
    });
  }
}

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
export type OutboxInput = Pick<OutboxEntry,
  "idempotencyKey" | "requestId" | "kind" | "to" | "subject" | "body" | "replyTo">;

/** Build a durable intent for an owning business transaction. This function
 * performs no I/O; callers create the row atomically with their state change. */
export function buildOutboxEntry(entry: OutboxInput): OutboxEntry & {
  createdAt: FirebaseFirestore.FieldValue;
} {
  return {
    ...entry,
    replyTo: entry.replyTo ?? null,
    status: "pending",
    attempts: 0,
    createdAtIso: nowIso(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sentAtIso: null,
    lastError: null,
  };
}

export async function enqueueOutbox(entry: OutboxInput): Promise<{ enqueued: boolean }> {
  if (!db) return { enqueued: false };

  const ref = db.collection(CAPTURE_OUTBOX_COLLECTION).doc(entry.idempotencyKey);

  // `create` fails if the doc exists, which is the dedup: a retried enqueue of
  // the same event is a no-op rather than a second row and eventually a second
  // email.
  try {
    await ref.create(buildOutboxEntry(entry));
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
 * A transactional claim fences overlapping passes. Persist dispatch and its
 * attempt before sending; a missing provider acknowledgement is quarantined,
 * never treated as permission to send again.
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
  try {
    const { reconcileAgentRunResultNotifications } = await import("./agentRunResultNotifications");
    await reconcileAgentRunResultNotifications(limit);
  } catch (error) { logger.warn({ error }, "Could not reconcile evaluation-result notices"); }
  try {
    const { reconcileTaskEvaluationNotificationRetries } = await import("./taskEvaluationNotificationRetry");
    await reconcileTaskEvaluationNotificationRetries(db, limit);
  } catch (error) { logger.warn({ error }, "Could not reconcile notification acknowledgements"); }
  await reconcileOutboxDeliveries(limit);
  const snapshot = await db
    .collection(CAPTURE_OUTBOX_COLLECTION)
    .where("status", "==", "pending")
    .limit(limit)
    .get();

  for (const doc of snapshot.docs) {
    summary.examined += 1;
    const token = randomUUID();
    const entry = await db.runTransaction(async tx => {
      const current = (await tx.get(doc.ref)).data() as OutboxEntry | undefined;
      if (!current || current.status !== "pending") return null;
      if (current.attempts >= MAX_ATTEMPTS) {
        tx.set(doc.ref, { status: "failed", lastError: "delivery_attempt_budget_exhausted" }, { merge: true });
        return null;
      }
      tx.set(doc.ref, { status: "claimed", deliveryToken: token,
        deliveryDigest: messageDigest(current), deliveryLeaseUntilMs: Date.now() + DELIVERY_LEASE_MS }, { merge: true });
      return current;
    });
    if (!entry) continue;
    const currentNotice = await taskStatusUpdateIsCurrent(entry);
    const message = brandedEmail({ subject: entry.subject, text: entry.body });
    const dispatched = await db.runTransaction(async tx => {
      const current = (await tx.get(doc.ref)).data();
      if (current?.status !== "claimed" || current.deliveryToken !== token
        || current.deliveryLeaseUntilMs <= Date.now()) return false;
      if (messageDigest(current as OutboxEntry) !== messageDigest(entry)) {
        tx.set(doc.ref, { status: "pending", lastError: "delivery_message_changed" }, { merge: true });
        return false;
      }
      if (!currentNotice) {
        tx.set(doc.ref, { status: "cancelled" }, { merge: true });
        return false;
      }
      tx.set(doc.ref, { status: "dispatching", attempts: entry.attempts + 1,
        deliveryLeaseUntilMs: Date.now() + DELIVERY_LEASE_MS }, { merge: true });
      return true;
    });
    if (!dispatched) continue;
    let result: Awaited<ReturnType<typeof sendEmail>>;
    try {
      result = await sendEmail({ to: entry.to, subject: entry.subject,
        text: message.text, html: message.html, replyTo: entry.replyTo ?? undefined });
    } catch (error) {
      result = { sent: false, provider: null, messageId: null, error, outcome: "unknown" };
    }
    const attempts = entry.attempts + 1;
    const unknown = !result.sent && (result.outcome === "unknown"
      || (result.provider !== null && result.outcome !== "not_sent"));
    const status = result.sent ? "sent" : unknown ? "unknown"
      : attempts >= MAX_ATTEMPTS ? "failed" : "pending";
    const lastError = result.sent ? null : unknown ? "delivery_outcome_unknown"
      : result.error instanceof Error ? result.error.message : String(result.error ?? "send failed");
    const applied = await db.runTransaction(async tx => {
      const current = (await tx.get(doc.ref)).data();
      // Keep the old effect's receipt even if a successor changed the message.
      // The digest binds private bytes without copying them into the receipt.
      tx.set(doc.ref.collection("deliveryReceipts").doc(token), {
        token, messageDigest: messageDigest(entry), attempt: attempts,
        status, provider: result.provider, messageId: result.messageId,
        observedAtIso: nowIso(),
      });
      if (!current || !["dispatching", "unknown"].includes(current.status)
        || current.deliveryToken !== token || current.deliveryDigest !== messageDigest(entry)
        || messageDigest(current as OutboxEntry) !== messageDigest(entry)) return false;
      tx.set(doc.ref, { status, lastError, sentAtIso: result.sent ? nowIso() : null,
        deliveryProvider: result.provider, deliveryMessageId: result.messageId }, { merge: true });
      return true;
    });
    if (!applied) continue;
    if (result.sent) {
      try { await acknowledgeTaskStatusUpdate(entry); }
      catch (error) { logger.warn({ error }, "Status deadline will advance on the next reconciliation"); }
      summary.sent += 1;
    } else if (status === "failed") {
      summary.exhausted += 1;
      logger.error({ key: entry.idempotencyKey, requestId: entry.requestId, attempts },
        "Outbox message exhausted its retries");
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}

/**
 * Deliver the outbox on a timer from the web process.
 *
 * The scheduler lane above only runs where the ops scheduler runs, and the
 * deployed topology runs it in neither the web process (opt-in) nor the
 * launch-forward worker. Without this, a message waited for someone to reopen
 * a capture page, and a robot team's result email waited forever. The shared
 * automation leader lease keeps two processes from delivering at once.
 */
export function startOutboxPump(intervalMs = 60_000): () => void {
  const lease = getOpsAutomationLeaderLease();
  lease.start();
  let running = false;
  const timer = setInterval(() => {
    if (running || !lease.isLeader()) return;
    void import("./captureCoverageQueue").then(module => module.tickCoverageReviews());
    running = true;
    void deliverOutbox({ limit: 25 })
      .catch((error) => logger.warn({ error }, "Outbox pump pass failed"))
      .finally(() => { running = false; });
  }, Math.max(10_000, intervalMs));
  timer.unref?.();
  return () => clearInterval(timer);
}
