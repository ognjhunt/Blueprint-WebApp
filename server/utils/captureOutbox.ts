import { jobAlertIsCurrent, resumeNewJobFanout, type JobAlertContext } from "./newJobAlerts";
import { enqueueDueTaskStatusUpdates, acknowledgeTaskStatusUpdate, taskStatusUpdateIsCurrent } from "./taskStatusUpdates";
/**
 * Durable delivery for site lifecycle and evaluation notices once enqueued.
 *
 * The document id deduplicates notification intent. A transactional claim
 * fences concurrent request, scheduler and pump callers; a separate dispatch
 * marker consumes an attempt before the provider call. Expired pre-dispatch
 * claims can recover.
 *
 * Every send carries a provider idempotency key derived from the document id,
 * so the provider sends one row at most once however often it is asked inside
 * its 24-hour window (captureOutboxRetry.ts). What happens after a try:
 *
 * | Outcome of the try                          | Row afterwards                          |
 * | ------------------------------------------- | --------------------------------------- |
 * | accepted                                    | `sent`                                  |
 * | unknown (5xx, timeout, restart mid-send)    | `unknown`, sent again with the same key |
 * |                                             | after a backoff until confirmed; once   |
 * |                                             | the window closes it is not sent again  |
 * |                                             | and the monitor alerts                  |
 * | transient refusal (429, account at fault)   | `pending`, retried after a backoff for  |
 * |                                             | up to 36 hours, then `failed`           |
 * | permanent refusal (bad recipient, payload)  | `failed` at once                        |
 * | the check before dispatch could not be read | `pending`, deferred with the same       |
 * |                                             | backoff and age bound; nothing was sent |
 *
 * A row that has had an unknown outcome stays `unknown` until a send is
 * confirmed: it is never recast as pending, failed or cancelled, because the
 * site may already have the email. A row left `unknown` by a dispatch that
 * carried no key (every such row from before keys existed) is never sent again.
 *
 * This does not make producer state changes atomic with enqueueOutbox: callers
 * must retain their own pending intent for recovery, and enqueueOutbox still
 * reports both duplicate intent and storage failure as enqueued:false.
 */

import { createHash, randomUUID } from "node:crypto";
import { automationBatch } from "./automationBatch";
import { taskLifecycleNotificationIsCurrent } from "./taskLifecycleNotificationAuthority";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { sendEmail } from "./email";
import { brandedEmail, CUSTOMER_JOB_EMAIL_IDENTITY } from "./emailLayout";
import { getOpsAutomationLeaderLease } from "./automationLeaderLease";
import { accountNoticeDigest, accountNoticeDispatchBlocker, type AccountNoticeContext } from "./accountNotice";
import { robotTeamAccessNotificationAuthority, type RobotTeamAccessNoticeContext } from "./robotTeamAccessNotificationAuthority";
import { attemptIsDue, MAX_UNDELIVERED_AGE_MS, providerIdempotencyKey, RESEND_WINDOW_MS, retryDelayMs,
  undeliveredAgeMs, unknownRowState } from "./captureOutboxRetry";

export const CAPTURE_OUTBOX_COLLECTION = "captureOutbox";

/** What the message is about. Drives nothing here; for the record and metrics. */
export type OutboxKind =
  /** Reviewed account/service notices, including Terms and policy updates. */
  | "account_notice"
  /** Retired: the timed check-in. Kept so stored rows still type-check. */
  | "progress_update"
  | "task_received"
  | "video_received"
  | "scene_ready"
  /** The job's scene is ready, task objects in, and its first internal test started (owner decision 2026-10-22). */
  | "scene_tests_started"
  | "preparation_needs_attention"
  /** Website scene preparation ended for good (website_preparation_status.v2 failed_terminal). */
  | "preparation_ended"
  | "listing_live"
  | "screening_cleared"
  | "screening_not_now"
  | "screening_started"
  | "results_ready"
  | "run_no_result"
  /** The job's evaluation reached a result outcome: once per outcome and scene (F-01). */
  | "evaluation_outcome"
  /** The job's scene intent reached a terminal outcome: once per outcome digest (C-04). */
  | "scene_outcome"
  /** The owner's job page asks whether to move chairs out of the robot's way in the simulation: once per proposal digest. */
  | "robot_access_question"
  /** Robot teams can now request an evaluation, and none has yet. */
  | "awaiting_evaluations"
  /** Every evaluation so far finished, none passed, none is in flight. */
  | "no_team_passed"
  /** Every evaluation so far finished, and none can support a recommendation either way. */
  | "no_qualified_evaluation"
  /** The job's video arrived before it was saved to an account (owner decision 2026-10-18). */
  | "footage_before_account"
  | "pilot_request"
  /** Retired with the pilot recommendation and booking flow. Kept so stored rows still type-check; never sent. */
  | "pilot_recommended"
  | "pilot_booked"
  | "pilot_scheduled"
  | "brief_confirmed"
  | "coverage_shortfall"
  | "assessment_ready"
  | "input_needed"
  /** A fresh private task link, asked for from an expired one. */
  | "fresh_link"
  /** To the robot team that bought a run, when it reports. */
  | "team_run_result"
  | "team_run_no_result"
  /** Retired with the pilot recommendation and booking flow. Kept so stored rows still type-check; never sent. */
  | "team_pilot_recommended"
  | "team_pilot_booked"
  | "team_pilot_scheduled"
  /** A robot team's early-access application, received and decided. */
  | "robot_team_access_received"
  | "robot_team_access_approved"
  | "robot_team_access_not_yet"
  /** To approved robot teams, when a site lists a new task card. */
  | "robot_team_new_task";

export type OutboxStatus = "pending" | "claimed" | "dispatching" | "unknown" | "sent" | "failed" | "cancelled" | "review_required";

export interface OutboxEntry {
  idempotencyKey: string;
  requestId: string;
  kind: OutboxKind;
  to: string;
  subject: string;
  body: string;
  replyTo?: string | null;
  /** Exact source/context event identity for preparation dispatch authority. */
  preparationEventId?: string;
  jobAlert?: JobAlertContext;
  accountNotice?: AccountNoticeContext;
  robotTeamAccessNotice?: RobotTeamAccessNoticeContext;
  status: OutboxStatus;
  attempts: number;
  createdAtIso: string;
  sentAtIso: string | null;
  lastError: string | null;
  /** Earliest time of the next automatic try. Absent or null: due now. */
  nextAttemptAtMs?: number | null;
  /** Times the check before dispatch could not be evaluated. Nothing was sent on those passes. */
  deliveryDeferrals?: number;
  /** The provider idempotency key of this row's dispatches (providerIdempotencyKey of the document id). */
  deliveryIdempotencyKey?: string;
  /** When the first dispatch that carried the key was marked: the start of the provider's window. */
  deliveryKeyFirstUsedAtMs?: number;
  /** `attempts` as of the latest dispatch that carried the key. An `unknown` row is sent again only while this equals `attempts`. */
  deliveryKeyAttempt?: number;
  /** Why an `unknown` row is no longer sent automatically. Such a row needs a person. */
  deliveryRetryEnded?: string;
}

/** Kinds whose feature is gone. A stored row of one is cancelled at dispatch, never sent. */
const RETIRED_KINDS: ReadonlySet<string> = new Set(["pilot_recommended", "pilot_booked", "pilot_scheduled",
  "team_pilot_recommended", "team_pilot_booked", "team_pilot_scheduled"]);

const DELIVERY_LEASE_MS = 5 * 60 * 1000;

// Render previews inherit the application's bindings, but must never consume
// shared customer delivery intents, including through opportunistic callers.
function isPullRequestPreview(): boolean {
  return process.env.IS_PULL_REQUEST?.trim().toLowerCase() === "true";
}

function deliveryRuntime() {
  const revision = process.env.RENDER_GIT_COMMIT;
  const serviceId = process.env.RENDER_SERVICE_ID;
  const instanceId = process.env.RENDER_INSTANCE_ID;
  return {
    revision: revision && /^[a-f0-9]{40}$/.test(revision) ? revision : null,
    serviceId: serviceId && /^srv-[a-z0-9]+$/.test(serviceId) ? serviceId : null,
    instanceId: instanceId && /^[a-zA-Z0-9_-]{1,160}$/.test(instanceId) ? instanceId : null,
  };
}

// Bind the claim to the exact message, including the private owner link.
function messageDigest(entry: OutboxEntry): string {
  const fields = [
    entry.idempotencyKey, entry.requestId, entry.kind, entry.to,
    entry.subject, entry.body, entry.replyTo ?? null,
  ];
  // Preserve the exact historical tuple for every existing retained lease.
  if (entry.preparationEventId !== undefined) fields.push(entry.preparationEventId);
  if (entry.jobAlert !== undefined) fields.push(JSON.stringify(entry.jobAlert));
  if (entry.accountNotice !== undefined) fields.push(accountNoticeDigest(entry.accountNotice));
  if (entry.robotTeamAccessNotice !== undefined) fields.push(JSON.stringify(entry.robotTeamAccessNotice));
  return createHash("sha256").update(JSON.stringify(fields)).digest("hex");
}

type Row = Record<string, unknown>;

/** Tries and deferrals so far: the step of the backoff. */
const failuresOf = (row: Row) => (Number(row.attempts) || 0) + (Number(row.deliveryDeferrals) || 0);

/** An `unknown` row that is not sent again automatically. It keeps its status: the site may have the email. */
function retryEnded(reason: string) {
  return { status: "unknown" as const, deliveryRetryEnded: reason,
    lastError: `delivery_outcome_unknown_${reason}`, nextAttemptAtMs: null };
}

/** After a dispatch whose outcome is unknown: the next try with the same key, or the end of automatic sending. */
function unknownOutcomeFields(row: Row, nowMs: number) {
  const state = unknownRowState(row, nowMs);
  // Dispatched without a provider key (before keys existed, or by an older build): never sent again.
  if (state === "needs_person") return { status: "unknown" as const, lastError: "delivery_outcome_unknown" };
  const next = nowMs + retryDelayMs(failuresOf(row));
  if (state === "window_closed" || next >= Number(row.deliveryKeyFirstUsedAtMs) + RESEND_WINDOW_MS) return retryEnded("window_closed");
  return { status: "unknown" as const, lastError: "delivery_outcome_unknown", nextAttemptAtMs: next };
}

/** After a try that sent nothing and can be repeated: wait, or fail once the row is too old. */
function retryLaterFields(row: Row, nowMs: number, lastError: string) {
  const next = nowMs + retryDelayMs(failuresOf(row));
  return undeliveredAgeMs(row, next) > MAX_UNDELIVERED_AGE_MS
    ? { status: "failed" as const, lastError: `delivery_retry_age_exceeded: ${lastError}`, nextAttemptAtMs: null }
    : { status: "pending" as const, lastError, nextAttemptAtMs: next };
}

/** Expiry permits another claim only before the durable dispatch marker.
 * Once dispatch could have happened the outcome is unknown: a dispatch that
 * carried the provider key is sent again with it, any other is left alone. */
export async function reconcileOutboxDeliveries(limit = 20): Promise<void> {
  if (!db) return;
  for (const status of ["claimed", "dispatching"] as const) {
    const rows = await automationBatch(db, db.collection(CAPTURE_OUTBOX_COLLECTION)
      .where("status", "==", status), `capture_outbox_${status}`, limit);
    for (const row of rows.docs) {
      try {
        await db.runTransaction(async tx => {
          const current = (await tx.get(row.ref)).data();
          if (current?.status !== status || !(current.deliveryLeaseUntilMs <= Date.now())) return;
          tx.set(row.ref, status === "claimed"
            ? { status: "pending", lastError: "delivery_claim_expired_before_dispatch" }
            : unknownOutcomeFields(current, Date.now()), { merge: true });
        });
      } catch (error) {
        logger.warn({ error, key: row.id }, "Could not reconcile an expired outbox claim; it stays for a later pass");
      }
    }
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
  "idempotencyKey" | "requestId" | "kind" | "to" | "subject" | "body" | "replyTo" | "preparationEventId" | "jobAlert" | "accountNotice" | "robotTeamAccessNotice">;

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
  /** Rows that were due on this pass. */
  examined: number;
  sent: number;
  /** Rows tried or deferred without a delivery, and due again later. */
  failed: number;
  /** Rows that are not tried again automatically: failed, or unknown with re-sending ended. */
  exhausted: number;
}

/**
 * Send what is due, and retry what was not delivered.
 *
 * A transactional claim fences overlapping passes. The dispatch marker and its
 * attempt are persisted before the send, and the send carries the row's
 * provider idempotency key. What each outcome does to the row is the table at
 * the top of this file. One row's failure never stops the rows after it.
 */
export async function deliverOutbox(params?: { limit?: number }): Promise<OutboxDeliverySummary> {
  const summary: OutboxDeliverySummary = { examined: 0, sent: 0, failed: 0, exhausted: 0 };
  if (isPullRequestPreview()) return summary;
  if (!db) return summary;

  const runtime = deliveryRuntime();

  const limit = Math.max(1, Math.min(params?.limit ?? 20, 100));
  try { await enqueueDueTaskStatusUpdates(limit); }
  catch (error) { logger.warn({ error }, "Could not enqueue due task updates"); }
  try {
    const { reconcileSceneReadyNotifications } = await import("./taskLifecycleNotifications");
    await reconcileSceneReadyNotifications(limit);
  } catch (error) { logger.warn({ error }, "Could not reconcile scene-ready notices"); }
  try {
    const { reconcileWebsitePreparationNotifications } = await import("./taskLifecycleNotifications");
    await reconcileWebsitePreparationNotifications(Math.min(limit, 1));
  } catch { logger.warn({ code: "website_preparation_reconcile_unavailable" }, "Could not reconcile preparation notices"); }
  try {
    const { reconcileFootageBeforeAccountNotices } = await import("./taskLifecycleNotifications");
    await reconcileFootageBeforeAccountNotices(Math.min(limit, 5));
  } catch (error) { logger.warn({ error }, "Could not reconcile footage-before-account notices"); }
  try {
    const { reconcileSceneTestsStartedNotices } = await import("./taskLifecycleNotifications");
    await reconcileSceneTestsStartedNotices(Math.min(limit, 5));
  } catch (error) { logger.warn({ error }, "Could not reconcile scene-tests notices"); }
  try {
    const { reconcileAgentRunResultNotifications } = await import("./agentRunResultNotifications");
    await reconcileAgentRunResultNotifications(limit);
  } catch (error) { logger.warn({ error }, "Could not reconcile evaluation-result notices"); }
  try {
    const { reconcileScreeningOutcomeNotifications } = await import("./screeningOutcomeNotifications");
    await reconcileScreeningOutcomeNotifications(limit);
  } catch (error) { logger.warn({ error }, "Could not reconcile evaluation-outcome notices"); }
  try {
    const { reconcileSceneOutcomeNotifications } = await import("./sceneOutcomeNotifications");
    await reconcileSceneOutcomeNotifications(limit);
  } catch (error) { logger.warn({ error }, "Could not reconcile scene-outcome notices"); }
  try {
    const { reconcileTaskEvaluationNotificationRetries } = await import("./taskEvaluationNotificationRetry");
    await reconcileTaskEvaluationNotificationRetries(db, limit);
  } catch (error) { logger.warn({ error }, "Could not reconcile notification acknowledgements"); }
  try { await resumeNewJobFanout(limit); }
  catch (error) { logger.warn({ error }, "New-job fanout will resume on a later tick"); }
  await reconcileOutboxDeliveries(limit);
  const nowMs = Date.now();
  const rows = await dueRows("pending", limit, nowMs);
  // Re-sends come after first sends, and a failure to read them stops neither.
  try { rows.push(...await dueRows("unknown", limit, nowMs)); }
  catch (error) { logger.warn({ error }, "Could not read the outbox rows that await a re-send"); }
  for (const doc of rows) {
    summary.examined += 1;
    try {
      await deliverRow(doc, runtime, summary);
    } catch (error) {
      // Whatever this row durably recorded (a claim, a dispatch marker) is
      // reconciled on a later pass. The rows after it are still delivered now.
      logger.warn({ error, key: doc.id }, "Outbox row was not delivered on this pass");
    }
  }

  return summary;
}

/**
 * Rows of one status whose next try is due. Reads the first page; when that
 * page is full and holds rows that are not due, also reads the next page of a
 * durable rotating scan, so waiting rows cannot starve the rows behind them.
 */
async function dueRows(status: "pending" | "unknown", limit: number, nowMs: number) {
  const query = db!.collection(CAPTURE_OUTBOX_COLLECTION).where("status", "==", status);
  const due = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const row = doc.data();
    if (status === "pending") return attemptIsDue(row, nowMs);
    const state = unknownRowState(row, nowMs);
    // A closed window is due at once: the pass records that sending has ended.
    return state === "window_closed" || (state === "retrying" && attemptIsDue(row, nowMs));
  };
  const head = await query.limit(limit).get();
  const rows = head.docs.filter(due);
  if (head.docs.length < limit || rows.length === head.docs.length) return rows;
  const seen = new Set(rows.map(doc => doc.id));
  const rotated = await automationBatch(db!, query, `capture_outbox_${status}_waiting`, limit);
  return [...rows, ...rotated.docs.filter(doc => !seen.has(doc.id) && due(doc))];
}

type DeliveryOutcome = "sent" | "transient" | "permanent" | "unknown";

/** Read a provider answer as one of the outcomes in the table at the top of this file. */
function deliveryOutcome(result: Awaited<ReturnType<typeof sendEmail>>): DeliveryOutcome {
  if (result.sent) return "sent";
  if (result.outcome === "unknown" || result.failure === "unknown") return "unknown";
  if (result.failure) return result.failure;
  // An adapter that answered without saying what happened may have sent it.
  if (result.provider !== null && result.outcome !== "not_sent") return "unknown";
  // Nothing was sent and nothing says why (for example no transport configured): try again later.
  return "transient";
}

async function deliverRow(doc: FirebaseFirestore.QueryDocumentSnapshot,
  runtime: ReturnType<typeof deliveryRuntime>, summary: OutboxDeliverySummary): Promise<void> {
  const store = db!;
  const token = randomUUID();
  const claim = await store.runTransaction(async tx => {
    const current = (await tx.get(doc.ref)).data() as OutboxEntry | undefined;
    const nowMs = Date.now();
    if (current?.status === "pending") {
      if (!attemptIsDue(current, nowMs)) return null;
      tx.set(doc.ref, { status: "claimed", deliveryToken: token,
        deliveryDigest: messageDigest(current), deliveryLeaseUntilMs: nowMs + DELIVERY_LEASE_MS }, { merge: true });
      return { entry: current, uncertain: false };
    }
    if (current?.status !== "unknown") return null;
    const state = unknownRowState(current, nowMs);
    if (state === "window_closed") {
      tx.set(doc.ref, retryEnded("window_closed"), { merge: true });
      return { entry: current, ended: true };
    }
    if (state !== "retrying" || !attemptIsDue(current, nowMs)) return null;
    // An earlier dispatch may have reached the site, so the row stays `unknown`
    // while claimed: nothing that reads `pending` or `claimed` (an older build
    // included) can send it without the key. Until the lease ends no other
    // pass takes it; if this pass dies first, it is due again then.
    tx.set(doc.ref, { deliveryToken: token, deliveryDigest: messageDigest(current),
      deliveryLeaseUntilMs: nowMs + DELIVERY_LEASE_MS, nextAttemptAtMs: nowMs + DELIVERY_LEASE_MS }, { merge: true });
    return { entry: current, uncertain: true };
  });
  if (!claim) return;
  const { entry } = claim;
  if ("ended" in claim) {
    summary.exhausted += 1;
    logger.error({ key: doc.id, requestId: entry.requestId, attempts: entry.attempts },
      "Outbox message with an unknown outcome is past the provider's idempotency window; it will not be sent again");
    return;
  }
  const { uncertain } = claim;
  const claimedStatus = uncertain ? "unknown" : "claimed";
  const idempotencyKey = providerIdempotencyKey(doc.id);
  const message = brandedEmail({ subject: entry.subject, text: entry.body });
  let dispatched: boolean;
  try {
    const currentNotice = await taskStatusUpdateIsCurrent(entry);
    dispatched = await store.runTransaction(async tx => {
      const current = (await tx.get(doc.ref)).data();
      if (current?.status !== claimedStatus || current.deliveryToken !== token
        || current.deliveryLeaseUntilMs <= Date.now()) return false;
      if (messageDigest(current as OutboxEntry) !== messageDigest(entry)) {
        tx.set(doc.ref, uncertain ? { nextAttemptAtMs: null }
          : { status: "pending", lastError: "delivery_message_changed" }, { merge: true });
        return false;
      }
      // A row whose earlier dispatch may have reached the site is not recast as
      // held or cancelled: it stays `unknown` and is not sent again.
      const stop = (fields: Row, reason: string) => {
        tx.set(doc.ref, uncertain ? retryEnded(reason) : fields, { merge: true });
        return false;
      };
      const accountBlocker = await accountNoticeDispatchBlocker(entry);
      if (accountBlocker) return stop({ status: "review_required", lastError: accountBlocker }, accountBlocker);
      const accessNotice = await robotTeamAccessNotificationAuthority(entry, tx);
      if (accessNotice === "review_required") return stop({ status: "review_required",
        lastError: "robot_team_access_notice_revision_unverified" }, "robot_team_access_notice_revision_unverified");
      // A retired notice is cancelled without consuming a send attempt.
      const retired = RETIRED_KINDS.has(entry.kind);
      // Withdrawal can race a retained producer or a claim. Read its current
      // authority before the durable dispatch marker; in-flight receipts below
      // still describe the provider effect and are never recast as cancelled.
      const currentCaptureNotice = await taskLifecycleNotificationIsCurrent(entry, tx);
      const currentJobAlert = await jobAlertIsCurrent(entry, tx);
      if (accessNotice === "obsolete" || !currentNotice || retired || !currentCaptureNotice || !currentJobAlert)
        return stop({ status: "cancelled" }, "notice_not_current");
      const nowMs = Date.now();
      tx.set(doc.ref, { status: "dispatching", attempts: entry.attempts + 1,
        deliveryRuntime: runtime, requestedSender: CUSTOMER_JOB_EMAIL_IDENTITY,
        deliveryLeaseUntilMs: nowMs + DELIVERY_LEASE_MS,
        // The key this dispatch carries, and the attempt it belongs to. The
        // first use starts the provider's window and is never moved later.
        deliveryIdempotencyKey: idempotencyKey, deliveryKeyAttempt: entry.attempts + 1,
        deliveryKeyFirstUsedAtMs: typeof current.deliveryKeyFirstUsedAtMs === "number"
          ? current.deliveryKeyFirstUsedAtMs : nowMs }, { merge: true });
      return true;
    });
  } catch (error) {
    // The check could not be evaluated (for example the Pipeline is
    // unreachable). Nothing was dispatched. Defer the row with a backoff
    // instead of holding its claim until the lease expires and trying again.
    logger.warn({ error, key: doc.id }, "Outbox dispatch check could not be evaluated; the row is deferred");
    await store.runTransaction(async tx => {
      const current = (await tx.get(doc.ref)).data();
      if (current?.status !== claimedStatus || current.deliveryToken !== token) return;
      const deferred = { ...current, deliveryDeferrals: (Number(current.deliveryDeferrals) || 0) + 1 };
      tx.set(doc.ref, { deliveryDeferrals: deferred.deliveryDeferrals, ...(uncertain
        ? unknownOutcomeFields(deferred, Date.now())
        : retryLaterFields(deferred, Date.now(), "delivery_check_unavailable")) }, { merge: true });
    });
    summary.failed += 1;
    return;
  }
  if (!dispatched) return;
  let result: Awaited<ReturnType<typeof sendEmail>>;
  try {
    result = await sendEmail({ to: entry.to, subject: entry.subject,
      text: message.text, html: message.html, ...CUSTOMER_JOB_EMAIL_IDENTITY, idempotencyKey });
    // Provider adapters cross an untrusted response boundary. A truthy
    // acceptance without a usable provider receipt is not a completed send.
    // Keep that possible effect unknown rather than allowing malformed/null
    // output to strand an unobserved dispatch exception.
    if (!result || typeof result.sent !== "boolean"
      || (result.sent && (typeof result.provider !== "string" || !result.provider.trim()
        || typeof result.messageId !== "string" || !result.messageId.trim()))) {
      result = { sent: false, provider: null, messageId: null,
        outcome: "unknown", error: new Error("delivery_provider_receipt_invalid") };
    }
  } catch (error) {
    result = { sent: false, provider: null, messageId: null, error, outcome: "unknown" };
  }
  const attempts = entry.attempts + 1;
  const outcome = deliveryOutcome(result);
  const refusal = result.error instanceof Error ? result.error.message : String(result.error ?? "send failed");
  const applied = await store.runTransaction(async tx => {
    const current = (await tx.get(doc.ref)).data();
    // Keep the old effect's receipt even if a successor changed the message.
    // The digest binds private bytes without copying them into the receipt.
    tx.set(doc.ref.collection("deliveryReceipts").doc(token), {
      token, messageDigest: messageDigest(entry), attempt: attempts, outcome,
      status: outcome === "sent" ? "sent" : outcome === "unknown" ? "unknown" : outcome === "permanent" ? "failed" : "pending",
      provider: result.provider, messageId: result.messageId, idempotencyKey,
      runtime, requestedSender: CUSTOMER_JOB_EMAIL_IDENTITY,
      observedAtIso: nowIso(),
    });
    if (!current || !["dispatching", "unknown"].includes(current.status)
      || current.deliveryToken !== token || current.deliveryDigest !== messageDigest(entry)
      || messageDigest(current as OutboxEntry) !== messageDigest(entry)) return null;
    const nowMs = Date.now();
    const next: Row = outcome === "sent" ? { status: "sent", lastError: null, nextAttemptAtMs: null }
      // Once any dispatch of this row had an unknown outcome, a later refusal
      // does not prove the earlier one was not delivered.
      : outcome === "unknown" || (uncertain && outcome === "transient") ? unknownOutcomeFields(current, nowMs)
        : uncertain ? { ...retryEnded("provider_refused"), lastError: `delivery_outcome_unknown_provider_refused: ${refusal}` }
          : outcome === "permanent" ? { status: "failed", lastError: refusal, nextAttemptAtMs: null }
            : retryLaterFields(current, nowMs, refusal);
    tx.set(doc.ref, { ...next, sentAtIso: outcome === "sent" ? nowIso() : null,
      deliveryProvider: result.provider, deliveryMessageId: result.messageId }, { merge: true });
    return next;
  });
  if (!applied) return;
  if (applied.status === "sent") {
    try { await acknowledgeTaskStatusUpdate(entry); }
    catch (error) { logger.warn({ error }, "Status deadline will advance on the next reconciliation"); }
    summary.sent += 1;
  } else if (applied.status === "failed" || applied.deliveryRetryEnded) {
    summary.exhausted += 1;
    logger.error({ key: entry.idempotencyKey, requestId: entry.requestId, attempts, status: applied.status },
      "Outbox message will not be retried automatically");
  } else {
    summary.failed += 1;
  }
}

/** Brief reviews per pump pass. Each claim may call a model, so it stays small. */
export const PUMP_BRIEF_REVIEW_BATCH = 2;

/**
 * One pump pass: deliver waiting notices, then drain pending brief reviews.
 *
 * `recoverCaptureReviews` claims each row in a transaction with a persisted
 * 30-minute lease and at most three attempts, so a scheduler lane that also
 * runs it (BLUEPRINT_RUN_OPS_AUTOMATION_IN_WEB=1, or a worker outside
 * launch-forward-only mode) cannot double-process a row; the leader lease in
 * startOutboxPump additionally keeps two pumps from running at once. The
 * model gate (BLUEPRINT_SITE_TASK_BRIEF_READING_ENABLED) is applied inside
 * the recovery itself, exactly as on the scheduler lane.
 */
export async function runOutboxPumpPass(): Promise<OutboxDeliverySummary> {
  const summary = await deliverOutbox({ limit: 25 }).catch((error) => {
    logger.warn({ error }, "Outbox pump pass failed");
    return { examined: 0, sent: 0, failed: 0, exhausted: 0 };
  });
  if (isPullRequestPreview()) return summary;
  try {
    const { recoverCaptureReviews } = await import("./captureReviewRecovery");
    await recoverCaptureReviews({ limit: PUMP_BRIEF_REVIEW_BATCH });
  } catch (error) {
    logger.warn({ error }, "Capture reviews will retry on the next pump pass");
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
 * automation leader lease keeps two processes from delivering at once. For the
 * same reason the pump also drains pending brief reviews and ticks the
 * coverage queue (which applies BLUEPRINT_SITE_VIDEO_EVIDENCE_ENABLED itself).
 */
export function startOutboxPump(intervalMs = 60_000): () => void {
  if (isPullRequestPreview()) {
    logger.info({ event: "preview_outbox_disabled" }, "Customer outbox pump disabled in pull request preview");
    return () => undefined;
  }
  const lease = getOpsAutomationLeaderLease();
  lease.start();
  let running = false;
  const timer = setInterval(() => {
    if (running || !lease.isLeader()) return;
    void import("./captureCoverageQueue").then(module => module.tickCoverageReviews());
    running = true;
    void runOutboxPumpPass()
      .catch((error) => logger.warn({ error }, "Outbox pump pass failed"))
      .finally(() => { running = false; });
  }, Math.max(10_000, intervalMs));
  timer.unref?.();
  return () => clearInterval(timer);
}
