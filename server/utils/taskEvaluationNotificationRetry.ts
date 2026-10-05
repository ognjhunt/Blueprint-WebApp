import { createHash } from "node:crypto";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { parseVerifiedTaskEvaluationRunPublication } from "./taskEvaluationRunContract";
import { projectWebsiteResultNotification } from "./taskEvaluationResultNotification";
import { evaluationResultWebsiteUrl } from "./evaluationReadyRunContract";
import { dispatchTransactionalEmailNotification } from "./transactional-notifications";

export const MAX_RESULT_NOTIFICATION_ATTEMPTS = 3;
const RETRIES = "taskEvaluationResultNotificationRetries";

export class ResultNotificationRetryError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}

export type ResultNotificationRetryReceipt = {
  schema_version: "task_evaluation_result_notification_retry_receipt.v1";
  record_id: string;
  run_id: string;
  request_id: string;
  run_result_digest: string;
  attempt: number;
  status: "dispatching" | "accepted" | "failed" | "unknown";
};

/** This is an explicit email-only action. Status/result reads never call it. */
export async function retryTaskEvaluationResultNotification(params: {
  db: FirebaseFirestore.Firestore;
  recordId: string;
  requestId: string;
  expectedDigest: string;
  actor: { uid: string; isOps: boolean };
}): Promise<ResultNotificationRetryReceipt> {
  const { db, recordId, requestId, expectedDigest, actor } = params;
  const retryId = createHash("sha256").update(`${recordId}\0${requestId}`).digest("hex");
  const retryRef = db.collection(RETRIES).doc(retryId);
  const resultRef = db.collection("captureTaskEvaluationRuns").doc(recordId);
  const claimed = await db.runTransaction(async (transaction) => {
    const resultSnapshot = await transaction.get(resultRef);
    if (!resultSnapshot.exists) throw new ResultNotificationRetryError(404, "result_not_found");
    const result = resultSnapshot.data()!;
    if (!actor.isOps && result.owner_user_id !== actor.uid) throw new ResultNotificationRetryError(403, "result_notification_owner_required");
    const parsed = parseVerifiedTaskEvaluationRunPublication(publicationFromResultRecord(result));
    if (!parsed.ok || parsed.publication.run_kind !== "internal_policy_canary") throw new ResultNotificationRetryError(409, "result_notification_binding_invalid");
    const publication = parsed.publication as Record<string, any>;
    if (publication.policy_canary_result?.projection_digest !== expectedDigest) throw new ResultNotificationRetryError(409, "result_notification_digest_changed");
    const runRef = db.collection("taskEvaluationPolicyRuns").doc(publication.run_id);
    const [runSnapshot, retrySnapshot] = await Promise.all([transaction.get(runRef), transaction.get(retryRef)]);
    const run = runSnapshot.data();
    const notification = projectWebsiteResultNotification({ ...result, record_id: recordId, publication }, run);
    if (!run || !notification) throw new ResultNotificationRetryError(409, "result_notification_receipt_unbound");
    if (retrySnapshot.exists) {
      const existing = retrySnapshot.data()!;
      if (existing.receipt?.run_result_digest !== expectedDigest || existing.receipt?.request_id !== requestId) throw new ResultNotificationRetryError(409, "result_notification_retry_conflict");
      return { receipt: existing.receipt as ResultNotificationRetryReceipt, send: false as const };
    }
    if (["dispatching", "unknown"].includes(run.notification_retry?.status)) throw new ResultNotificationRetryError(409, "result_notification_retry_requires_reconciliation");
    if (notification.status !== "failed") throw new ResultNotificationRetryError(409, "result_notification_not_failed");
    if (notification.attempts >= MAX_RESULT_NOTIFICATION_ATTEMPTS) throw new ResultNotificationRetryError(429, "result_notification_attempt_limit");
    const recipient = String(run.notification?.email || "");
    if (run.notification_recipient_user_id !== run.owner_user_id || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new ResultNotificationRetryError(409, "result_notification_recipient_unbound");
    const receipt: ResultNotificationRetryReceipt = {
      schema_version: "task_evaluation_result_notification_retry_receipt.v1",
      record_id: recordId, run_id: run.run_id, request_id: requestId,
      run_result_digest: expectedDigest, attempt: notification.attempts + 1, status: "dispatching",
    };
    transaction.create(retryRef, { receipt, owner_user_id: run.owner_user_id, prior_notification: run.notification_delivery, created_at_iso: new Date().toISOString() });
    transaction.set(runRef, { notification_retry: { retry_id: retryId, status: "dispatching", request_id: requestId } }, { merge: true });
    return { receipt, send: true as const, runRef, recipient, owner: run.owner_user_id, terminalState: run.notification_delivery.terminal_state };
  });
  if (!claimed.send) return claimed.receipt;

  let status: "accepted" | "failed" | "unknown" = "unknown";
  let acceptedAt: string | null = null;
  let messageId: string | null = null;
  let failureReason: string | null = null;
  try {
    const resultUrl = evaluationResultWebsiteUrl(recordId);
    const email = await dispatchTransactionalEmailNotification({
      eventType: "evaluation_results_ready", recipientType: "buyer",
      recipientUserId: claimed.owner, recipientEmail: claimed.recipient,
      subjectId: claimed.receipt.run_id, sourceEventId: `result-email-retry:${retryId}`,
      sourceCollection: RETRIES, sourceDocId: retryId,
      title: "Your Blueprint result is available",
      body: "Review the retained diagnostic result and its current score-correction receipts in Blueprint.",
      emailSubject: "Your Blueprint Task Evaluation Run result",
      emailText: `Your retained diagnostic Task Evaluation Run result is available.\n\n${resultUrl}\n\nReview current corrections and evidence in the result. No winner, ranking, deployment, or safety approval is declared.`,
      preferenceKey: "account", data: { record_id: recordId, run_id: claimed.receipt.run_id, run_result_digest: expectedDigest },
    });
    if (email?.status === "sent") {
      status = "accepted"; acceptedAt = email.sent_at; messageId = email.provider_message_id;
    } else if (email && ["failed", "skipped"].includes(email.status)) {
      status = "failed"; failureReason = "notification_delivery_failed";
    }
  } catch { /* An ambiguous send is not automatically retried. */ }
  const receipt = { ...claimed.receipt, status };
  await db.runTransaction(async (transaction) => {
    const [snapshot, resultSnapshot] = await Promise.all([transaction.get(claimed.runRef), transaction.get(resultRef)]);
    const run = snapshot.data();
    const result = resultSnapshot.data();
    if (!run || run.notification_retry?.retry_id !== retryId) throw new ResultNotificationRetryError(409, "result_notification_retry_conflict");
    const notification = {
      terminal_state: claimed.terminalState, status: status === "unknown" ? "failed" : status,
      attempts: receipt.attempt, provider: "website_transactional_email", message_id: messageId,
      accepted_at: acceptedAt, delivered_at: null, failure_reason: status === "unknown" ? "notification_retry_outcome_unknown" : failureReason,
      run_result_digest: expectedDigest,
    };
    transaction.set(retryRef, { receipt, notification, completed_at_iso: new Date().toISOString() }, { merge: true });
    const currentPublication = result ? publicationFromResultRecord(result) : null;
    if (run.owner_user_id !== claimed.owner || result?.owner_user_id !== claimed.owner
      || (currentPublication?.policy_canary_result as Record<string, unknown> | undefined)?.projection_digest !== expectedDigest) {
      // Preserve the send receipt without attaching it to changed ownership or a successor result.
      transaction.set(retryRef, { applied_to_current_run: false }, { merge: true });
      return;
    }
    transaction.set(claimed.runRef, {
      notification_delivery: notification,
      notification_retry: { retry_id: retryId, status, request_id: requestId },
      updated_at_iso: new Date().toISOString(),
    }, { merge: true });
  });
  return receipt;
}

/** Repair the send/receipt crash gap from retained provider acknowledgements.
 * No send occurs here. Without a bound provider id the outcome stays unknown. */
export async function reconcileTaskEvaluationNotificationRetries(db: FirebaseFirestore.Firestore, limit = 20) {
  const { automationBatch } = await import("./automationBatch");
  const rows = await automationBatch(db, db.collection(RETRIES).where("receipt.status", "in", ["dispatching", "unknown"]), "result_notification_reconciliation", limit);
  for (const row of rows.docs) {
    const saved = row.data();
    const receipt = saved.receipt as ResultNotificationRetryReceipt;
    const candidates = await db.collection("transactionalNotifications")
      .where("source_doc_id", "==", row.id).get();
    const acknowledgements = candidates.docs.map(doc => doc.data()).filter(record =>
      record.source_collection === RETRIES && record.source_event_id === `result-email-retry:${row.id}`
      && record.subject_id === receipt.run_id && record.channel === "email"
      && record.event_type === "evaluation_results_ready" && record.status === "sent"
      && record.recipient_user_id === saved.owner_user_id && record.delivery_provider === "resend"
      && typeof record.provider_message_id === "string" && record.provider_message_id.length > 0
      && record.data?.run_result_digest === receipt.run_result_digest);
    if (acknowledgements.length !== 1) continue;
    const evidence = acknowledgements[0];
    await db.runTransaction(async tx => {
      const runRef = db.collection("taskEvaluationPolicyRuns").doc(receipt.run_id);
      const resultRef = db.collection("captureTaskEvaluationRuns").doc(receipt.record_id);
      const [retry, runSnapshot, resultSnapshot] = await Promise.all([tx.get(row.ref), tx.get(runRef), tx.get(resultRef)]);
      const current = retry.data(), run = runSnapshot.data(), result = resultSnapshot.data();
      if (!current || !["dispatching", "unknown"].includes(current.receipt?.status)
        || current.receipt.run_result_digest !== receipt.run_result_digest
        || run?.notification_retry?.retry_id !== row.id || run.owner_user_id !== saved.owner_user_id
        || !result || result.owner_user_id !== saved.owner_user_id
        || (publicationFromResultRecord(result)?.policy_canary_result as Record<string, unknown> | undefined)?.projection_digest !== receipt.run_result_digest) return;
      const notification = { ...saved.prior_notification, status: "accepted", attempts: receipt.attempt,
        provider: "website_transactional_email", message_id: evidence.provider_message_id,
        accepted_at: evidence.sent_at, delivered_at: null, failure_reason: null,
        run_result_digest: receipt.run_result_digest };
      tx.set(row.ref, { receipt: { ...receipt, status: "accepted" }, notification,
        reconciliation: { source_event_id: evidence.source_event_id, provider_message_id: evidence.provider_message_id,
          observed_at_iso: new Date().toISOString() } }, { merge: true });
      tx.set(runRef, { notification_delivery: notification,
        notification_retry: { ...run.notification_retry, status: "accepted" } }, { merge: true });
    });
  }
}
