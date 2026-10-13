/** Durable non-destructive Pipeline handoff. Cleanup proof is never inferred. */
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { canonicalArtifactDigest } from "./taskCandidateContract";
import { signedCaptureLifecycleRequest } from "./captureLifecycleForwarding";
import { logger } from "../logger";

/** The explicit confirmation the signed owner link must send to withdraw. */
export const OWNER_WITHDRAWAL_CONFIRMATION = "withdraw_recording_permission" as const;

/** WebApp-owned storage deletion progress for one withdrawal. */
export type WebappDeletionPhase = "pending" | "awaiting_late_upload_sweep" | "deleted";

/**
 * The one place the WebApp's withdrawal state is derived.
 *
 * The forwarder (Pipeline acknowledgement) and the deletion worker (WebApp
 * storage) each write their own facts; both re-derive `state` and
 * `deletionConfirmed` from those facts, so neither can overwrite the other's
 * progress. `deletionConfirmed` is true only once the WebApp deletion receipt
 * covers every owned object, including uploads that could still land on an
 * outstanding native target, AND Pipeline acknowledged the tombstone, AND no
 * legal hold applies. Pipeline-side cleanup of its own copies is reported
 * separately and never inferred.
 */
export function deriveWebsiteWithdrawalState(withdrawal: Record<string, any>): {
  state: string; deletionConfirmed: boolean;
} {
  const phase = withdrawal?.webappDeletion?.phase as WebappDeletionPhase | undefined;
  if (withdrawal?.legalHold === true) return { state: phase === "deleted" || phase === "awaiting_late_upload_sweep"
    ? "storage_deleted_pipeline_legal_hold" : "cleanup_retained_legal_hold", deletionConfirmed: false };
  if (phase === "deleted") return withdrawal.pipelineAcknowledged === true
    ? { state: "deletion_confirmed", deletionConfirmed: true }
    : { state: "storage_deleted_pipeline_ack_pending", deletionConfirmed: false };
  if (phase === "awaiting_late_upload_sweep") return { state: "storage_deleted_late_upload_check_pending", deletionConfirmed: false };
  return { state: withdrawal?.pipelineAcknowledged === true
    ? String(withdrawal.pipelineState || "pipeline_acknowledged_cleanup_pending")
    : "uploads_stopped_cleanup_pending", deletionConfirmed: false };
}

/** What a withdrawal route reports. Every value is a recorded fact. */
export function projectWebsiteCaptureWithdrawal(withdrawal: Record<string, any>) {
  const derived = deriveWebsiteWithdrawalState(withdrawal);
  const deletion = withdrawal?.webappDeletion || {};
  return {
    state: derived.state,
    requestedAtIso: withdrawal.requestedAtIso ?? null,
    uploadsStopped: true,
    taskPaused: true,
    queuedRunsCancellationRequested: true,
    pipelineAcknowledged: withdrawal.pipelineAcknowledged === true,
    pipelineAcknowledgementTimedOut: deletion.pipelineAckState === "pending_after_timeout",
    pipelineCleanupVerified: withdrawal.localCleanupVerified === true && withdrawal.cloudObjectAbsenceVerified === true,
    storageDeletion: {
      state: deletion.phase === "deleted" ? "deleted"
        : deletion.phase === "awaiting_late_upload_sweep" ? "deleted_late_upload_check_pending"
          : deletion.lastError ? "retrying" : "pending",
      deletedObjectCount: Number(deletion.deletedObjectCount || 0),
      failedObjectCount: Number(deletion.failedObjectCount || 0),
      lateUploadCheckAtIso: deletion.lateSweepAtMs ? new Date(deletion.lateSweepAtMs).toISOString() : null,
      completedAtIso: deletion.completedAtIso ?? null,
      receiptIds: Array.isArray(deletion.receiptIds) ? deletion.receiptIds : [],
    },
    deletionConfirmed: derived.deletionConfirmed,
    legalHold: withdrawal.legalHold === true,
    retainedAuditRecords: true,
  };
}

/**
 * The one withdrawal effect, shared by the account route and the signed owner
 * link so their semantics cannot drift: consent revoked, uploads stop, the
 * task pauses, pending reviews stop, queued runs are asked to cancel, and a
 * durable record queues the Pipeline handoff and WebApp storage deletion.
 * Idempotent: a repeated call returns the first withdrawal unchanged.
 */
export async function recordWebsiteCaptureWithdrawal(params: {
  requestId: string;
  requestedBy: string;
  authorize: (record: Record<string, any> | undefined) => void;
}): Promise<{ withdrawal: Record<string, any>; created: boolean }> {
  if (!db) throw Object.assign(new Error("Withdrawal storage is unavailable."), { status: 503 });
  const ref = db.collection("inboundRequests").doc(params.requestId);
  return db.runTransaction(async transaction => {
    const record = (await transaction.get(ref)).data();
    const runs = await transaction.get(db!.collection("evaluationRuns").where("sceneId", "==", params.requestId));
    params.authorize(record);
    if (record?.capture_withdrawal) return { withdrawal: record.capture_withdrawal, created: false };
    const withdrawal = { state: "uploads_stopped_cleanup_pending", requestedAtIso: new Date().toISOString(),
      requestedBy: params.requestedBy, requestId: params.requestId,
      sceneId: `site-${params.requestId}`, captureId: `walkthrough-${params.requestId}`,
      deletionConfirmed: false, pipelineAcknowledged: false, localCleanupVerified: false,
      providerAcknowledgement: "unknown", retainedAuditRecords: true,
      webappDeletion: { phase: "pending", attempts: 0, nextAttemptAtMs: 0, leaseUntilMs: 0 } };
    transaction.set(ref, { consent_revoked: true, future_processing_allowed: false,
      request: { consent_attestation: { granted: false, revoked_at_iso: withdrawal.requestedAtIso } },
      workspace_task: { paused: true }, briefReviewPending: false,
      capture_coverage_pending: false, coverageReviewPending: false,
      capture_withdrawal: withdrawal, captureWithdrawalPending: true, captureDeletionPending: true }, { merge: true });
    for (const run of runs.docs) if (run.data().state === "requested") transaction.set(run.ref, {
      cancellationRequested: true, dispatchPending: false,
      cancellationReason: "site_recording_consent_withdrawn", settlementDueAtMs: 0,
    }, { merge: true });
    return { withdrawal, created: true };
  });
}

export function websiteWithdrawalCommand(requestId: string, receipt: Record<string, any>) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(requestId)
    || receipt.requestId !== requestId || receipt.sceneId !== `site-${requestId}`
    || receipt.captureId !== `walkthrough-${requestId}` || !Number.isFinite(Date.parse(receipt.requestedAtIso)))
    throw new Error("website_withdrawal_binding_invalid");
  return { schema_version: "website_capture_withdrawal.v1", request_id: requestId, scene_id: receipt.sceneId,
    capture_id: receipt.captureId, withdrawal_id: `withdrawal-${canonicalArtifactDigest({ requestId,
      requestedAtIso: receipt.requestedAtIso }, "digest").slice(7)}`, requested_at_iso: receipt.requestedAtIso };
}

const digest = z.string().regex(/^sha256:[a-f0-9]{64}$/);
export const websiteWithdrawalReceipt = z.object({ schema_version: z.literal("website_capture_withdrawal_receipt.v1"),
  request_id: z.string(), scene_id: z.string(), capture_id: z.string(), withdrawal_id: z.string(),
  command_digest: digest, tombstone_digest: digest, digest,
  state: z.enum(["pipeline_acknowledged_cleanup_pending", "cleanup_retained_legal_hold", "local_cleanup_verified_external_pending"]),
  pipeline_acknowledged: z.literal(true), serve_allowed: z.literal(false), future_processing_allowed: z.literal(false),
  local_cleanup_verified: z.boolean(), local_cleanup_receipt_digest: digest.nullable(), deletion_confirmed: z.literal(false),
  provider_acknowledgement: z.literal("unknown"), cloud_storage_cleanup_verified: z.literal(false),
  delivered_copy_cleanup_verified: z.literal(false), retained_audit_records: z.literal(true), legal_hold: z.boolean(),
  cloud_object_absence_verified: z.boolean().optional(), cloud_object_cleanup_receipt_digest: digest.nullable().optional(),
  cloud_object_current_absence_status: z.enum(["unknown", "verified"]).optional(),
  cloud_object_absence_observed_at_iso: z.string().datetime({ offset: true }).nullable().optional(),
  cleanup_scope: z.literal("server_mapped_site_local_files"), external_cleanup_required: z.literal(true),
}).strict();

export function verifyWebsiteWithdrawalReceipt(command: ReturnType<typeof websiteWithdrawalCommand>, value: unknown) {
  const receipt = websiteWithdrawalReceipt.parse(value);
  if (receipt.digest !== canonicalArtifactDigest(receipt, "digest")
    || receipt.command_digest !== canonicalArtifactDigest(command, "digest")
    || (["request_id", "scene_id", "capture_id", "withdrawal_id"] as const).some(key => receipt[key] !== command[key])
    || receipt.local_cleanup_verified !== Boolean(receipt.local_cleanup_receipt_digest)
    || (receipt.cloud_object_absence_verified === true && (!receipt.cloud_object_cleanup_receipt_digest
      || receipt.cloud_object_current_absence_status !== "verified"))
    || (receipt.cloud_object_current_absence_status === "verified" && receipt.cloud_object_absence_verified !== true)
    || Boolean(receipt.cloud_object_cleanup_receipt_digest) !== Boolean(receipt.cloud_object_absence_observed_at_iso)
    || (receipt.state === "local_cleanup_verified_external_pending" && (!receipt.local_cleanup_verified || receipt.legal_hold))
    || (receipt.state === "cleanup_retained_legal_hold" && !receipt.legal_hold))
    throw new Error("website_withdrawal_receipt_binding_invalid");
  return receipt;
}

let withdrawalCursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
export async function forwardWebsiteCaptureWithdrawals() {
  if (!db) return;
  let query = db.collection("inboundRequests").where("captureWithdrawalPending", "==", true).limit(25);
  if (withdrawalCursor) query = query.startAfter(withdrawalCursor);
  const pending = await query.get();
  // Acknowledged but externally pending receipts cannot starve later sites.
  withdrawalCursor = pending.docs.length === 25 ? pending.docs.at(-1) : undefined;
  for (const snapshot of pending.docs) {
    try {
      const lease = randomUUID(), now = Date.now();
      const command = await db.runTransaction(async tx => {
        const record = (await tx.get(snapshot.ref)).data();
        const outbox = record?.captureWithdrawalOutbox;
        if (!record?.capture_withdrawal || record.captureWithdrawalPending !== true || record.consent_revoked !== true
          || (outbox?.nextAttemptAtMs ?? 0) > now || (outbox?.leaseUntilMs ?? 0) > now) return null;
        const command = websiteWithdrawalCommand(snapshot.id, record.capture_withdrawal);
        tx.set(snapshot.ref, { captureWithdrawalOutbox: { lease, leaseUntilMs: now + 120_000,
          attemptCount: (outbox?.attemptCount ?? 0) + 1, commandDigest: canonicalArtifactDigest(command, "digest") } }, { merge: true });
        return command;
      });
      if (!command) continue;
      // Exact idempotent denial handoff. Never sends a cleanup/delete command.
      const result = await signedCaptureLifecycleRequest({ path: "/website-capture-withdrawals", method: "POST", body: command,
        schema: websiteWithdrawalReceipt, blocker: "website_withdrawal_pipeline_acknowledgement_pending" });
      let receipt: z.infer<typeof websiteWithdrawalReceipt> | undefined;
      if (result.value) {
        try { receipt = verifyWebsiteWithdrawalReceipt(command, result.value); }
        catch { /* Unknown or mismatched acknowledgement remains pending. */ }
      }
      await db.runTransaction(async tx => {
        const record = (await tx.get(snapshot.ref)).data();
        if (record?.captureWithdrawalOutbox?.lease !== lease
          || canonicalArtifactDigest(websiteWithdrawalCommand(snapshot.id, record.capture_withdrawal), "digest") !== canonicalArtifactDigest(command, "digest")) return;
        const progress = receipt ? { pipelineState: receipt.state, pipelineAcknowledged: true,
          acknowledgementBlocker: null,
          localCleanupVerified: receipt.local_cleanup_verified, localCleanupReceiptDigest: receipt.local_cleanup_receipt_digest,
          providerAcknowledgement: receipt.provider_acknowledgement, cloudStorageCleanupVerified: false,
          cloudObjectAbsenceVerified: receipt.cloud_object_absence_verified ?? false,
          cloudObjectCleanupReceiptDigest: receipt.cloud_object_cleanup_receipt_digest ?? null,
          cloudObjectCurrentAbsenceStatus: receipt.cloud_object_current_absence_status ?? "unknown",
          cloudObjectAbsenceObservedAtIso: receipt.cloud_object_absence_observed_at_iso ?? null,
          deliveredCopyCleanupVerified: false, retainedAuditRecords: true, legalHold: receipt.legal_hold,
          pipelineReceiptDigest: receipt.digest, pipelineTombstoneDigest: receipt.tombstone_digest,
          lastAcknowledgedAtIso: new Date().toISOString() } : { acknowledgementBlocker: result.blocker ?? "website_withdrawal_receipt_invalid" };
        // State and deletionConfirmed are derived, so this acknowledgement
        // cannot regress WebApp deletion progress recorded by the other worker.
        const next = { ...record.capture_withdrawal, ...progress };
        tx.set(snapshot.ref, { capture_withdrawal: { ...next, ...deriveWebsiteWithdrawalState(next) }, captureWithdrawalPending: true,
          captureWithdrawalOutbox: { lease: null, leaseUntilMs: 0, nextAttemptAtMs: Date.now() + (receipt ? 3_600_000 : 60_000),
            lastTransportStatus: result.status } }, { merge: true });
      });
    } catch (error) {
      // An invalid historical command or interrupted lease stays pending. It
      // must not prevent other owners' denial handoffs in the same batch.
      logger.error({ error, requestId: snapshot.id }, "Website withdrawal acknowledgement remains pending");
    }
  }
}

export function startWebsiteCaptureWithdrawalWorker() {
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (stopped) return;
    try { await forwardWebsiteCaptureWithdrawals(); }
    catch (error) { logger.error({ error }, "Website withdrawal handoff remains pending"); }
    if (!stopped) { timer = setTimeout(run, 60_000); timer.unref(); }
  };
  timer = setTimeout(run, 5_000); timer.unref();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
