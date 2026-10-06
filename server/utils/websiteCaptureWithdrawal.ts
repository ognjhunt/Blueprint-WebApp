/** Durable non-destructive Pipeline handoff. Cleanup proof is never inferred. */
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { canonicalArtifactDigest } from "./taskCandidateContract";
import { signedCaptureLifecycleRequest } from "./captureLifecycleForwarding";
import { logger } from "../logger";

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
        const progress = receipt ? { state: receipt.state, pipelineAcknowledged: true, deletionConfirmed: false,
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
        tx.set(snapshot.ref, { capture_withdrawal: { ...record.capture_withdrawal, ...progress }, captureWithdrawalPending: true,
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
