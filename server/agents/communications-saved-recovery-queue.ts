import type { Firestore } from "firebase-admin/firestore";
import { communicationsDigest } from "./communications-contract";
import { communicationsInprocessRecoverySchema, type CommunicationsInprocessRecoveryInput } from "./communications-inprocess-recovery";
import { COMMUNICATIONS_ROOT, type CommunicationsJobRecord } from "./communications-store";
import { assertCommunicationsRecoveryHeadroom, COMMUNICATIONS_RECOVERY_HEADROOM_BYTES, type CommunicationsRecoveryMemorySample } from "./communications-recovery-memory";

export const SAVED_RECOVERY_REQUESTS = `${COMMUNICATIONS_ROOT}/savedRecoveryRequests`;
export const SAVED_RECOVERY_WORKER = `${COMMUNICATIONS_ROOT}/intakeState/savedRecoveryWorker`;
export const SAVED_RECOVERY_FRESH_MS = 45000;
export const SAVED_RECOVERY_WINDOW_MS = 5 * 60000;
export const SAVED_RECOVERY_CONTROLS = ["BLUEPRINT_COMMUNICATIONS_WORKER_ENABLED", "BLUEPRINT_DAILY_RESEARCH_WORKER_ENABLED",
  "BLUEPRINT_COMMUNICATIONS_SEND_ENABLED", "BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED"] as const;
export type SavedRecoveryReadiness = {
  version: "existing-worker-saved-recovery-v1"; executionPlacement: "existing_background_worker"; sourceCommit: string | null;
  serviceId: string | null; ownerUid: string | null; observedAtMs: number; providerKeyConfigured: boolean; founderBindingConfigured: boolean;
  controls: Record<string, "literal_off" | "missing" | "other">; outreachControlsOff: boolean; headroomAvailable: boolean;
  headroomReserveBytes: number; memory: CommunicationsRecoveryMemorySample;
};
export type SavedRecoveryRequest = {
  version: "owner-saved-recovery-request-v1"; input: CommunicationsInprocessRecoveryInput; actorUid: string; requestDigest: string;
  generation: number; requestedAtMs: number; expiresAtMs: number; state: "queued" | "running" | "completed" | "failed" | "cancelled";
  cancelRequested: boolean; executionToken: string | null; executionServiceId: string | null;
  result?: { state: string; ledgerId: string | null; sent: false; gmailDraftCreated: false; sessionCreated: false };
  error?: string; settledAtMs?: number;
};
function fail(code: string): never { throw new Error(`communications_saved_recovery_${code}`); }
export function assertSavedRecoveryWorker(readiness: SavedRecoveryReadiness | undefined, sourceCommit: string, actorUid: string, now: number) {
  if (!readiness || readiness.version !== "existing-worker-saved-recovery-v1" || readiness.executionPlacement !== "existing_background_worker"
    || !readiness.serviceId || readiness.sourceCommit !== sourceCommit || readiness.ownerUid !== actorUid
    || !Number.isSafeInteger(readiness.observedAtMs) || readiness.observedAtMs > now || now - readiness.observedAtMs > SAVED_RECOVERY_FRESH_MS
    || !readiness.providerKeyConfigured || !readiness.founderBindingConfigured || !readiness.outreachControlsOff
    || SAVED_RECOVERY_CONTROLS.some(key => readiness.controls?.[key] !== "literal_off")) fail("worker_unavailable");
  assertCommunicationsRecoveryHeadroom(readiness.memory);
  if (!readiness.headroomAvailable || readiness.headroomReserveBytes !== COMMUNICATIONS_RECOVERY_HEADROOM_BYTES) fail("worker_unavailable");
}
export function assertSavedRecoveryRequest(record: SavedRecoveryRequest | undefined, expected: SavedRecoveryRequest, token: string, now: number) {
  if (!record || record.version !== "owner-saved-recovery-request-v1" || !Number.isSafeInteger(record.generation) || record.generation < 1
    || !Number.isSafeInteger(record.requestedAtMs) || record.requestedAtMs > now || record.expiresAtMs !== record.requestedAtMs + SAVED_RECOVERY_WINDOW_MS
    || record.version !== expected.version || record.generation !== expected.generation || record.requestDigest !== expected.requestDigest
    || record.actorUid !== expected.actorUid || communicationsDigest(record.input) !== communicationsDigest(expected.input)
    || record.requestDigest !== communicationsDigest({ input: record.input, actorUid: record.actorUid })
    || record.state !== "running" || record.executionToken !== token || record.executionServiceId !== expected.executionServiceId
    || record.cancelRequested || record.expiresAtMs !== expected.expiresAtMs || now >= record.expiresAtMs) fail("intent_changed_or_cancelled");
}
function assertOriginalJob(job: CommunicationsJobRecord | undefined, input: CommunicationsInprocessRecoveryInput, actorUid: string, now: number) {
  if (!job || job.jobId !== input.jobId || job.prospectId !== input.prospectId || job.briefDigest !== input.briefDigest
    || job.checkpoint.sessionId !== input.sessionId) fail("binding_changed");
  const pin = job.savedOutputRecovery, owner = pin?.ownerAction;
  const owned = owner?.actorUid === actorUid && owner.sourceCommit === input.expectedSourceCommit
    && owner.originalJobDigest === input.expectedJobDigest && owner.requestDigest === communicationsDigest(input)
    && pin?.rawOutputSha256 === input.rawOutputSha256 && pin.checkpointDigest === communicationsDigest(job.checkpoint);
  if (owned && job.state === "pending_approval" && job.outputSource?.rawOutputSha256 === input.rawOutputSha256) return;
  if (!owned && (communicationsDigest(job) !== input.expectedJobDigest || communicationsDigest(job.checkpoint) !== input.expectedCheckpointDigest)) fail("binding_changed");
  if (!Number.isSafeInteger(job.lease?.until) || job.lease!.until < 0 || job.lease!.until > now || job.attempts >= 3
    || !["blocked", "queued", "running", "retry", "pending_approval"].includes(job.state) || (!owned && job.state !== "blocked")) fail("record_changed");
}
/** Owner auth/CSRF and existing compose consent precede this transaction in Web.
 * It admits one immutable saved-session intent, never a generic worker job. */
export async function enqueueSavedRecovery(db: Firestore, input: CommunicationsInprocessRecoveryInput, actorUid: string, now: number) {
  communicationsInprocessRecoverySchema.parse(Object.fromEntries(Object.entries(input).filter(([key]) => !["prospectId", "jobId"].includes(key))));
  if (!actorUid || !/^[a-f0-9]{64}$/.test(input.jobId) || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(input.prospectId)
    || input.expectedSourceCommit !== process.env.RENDER_GIT_COMMIT) fail("source_or_identity_changed");
  const ref = db.doc(`${SAVED_RECOVERY_REQUESTS}/${input.jobId}`);
  return db.runTransaction(async tx => {
    const [workerSnap, jobSnap, priorSnap] = await Promise.all([tx.get(db.doc(SAVED_RECOVERY_WORKER)), tx.get(db.doc(`${COMMUNICATIONS_ROOT}/jobs/${input.jobId}`)), tx.get(ref)]);
    assertSavedRecoveryWorker(workerSnap.data() as SavedRecoveryReadiness | undefined, input.expectedSourceCommit, actorUid, now);
    assertOriginalJob(jobSnap.data() as CommunicationsJobRecord | undefined, input, actorUid, now);
    const prior = priorSnap.data() as SavedRecoveryRequest | undefined;
    const requestDigest = communicationsDigest({ input, actorUid });
    if (prior) {
      if (prior.requestDigest !== requestDigest || communicationsDigest(prior.input) !== communicationsDigest(input) || prior.actorUid !== actorUid) fail("intent_binding_changed");
      if (["queued", "running", "completed"].includes(prior.state)) return prior;
      if (!Number.isSafeInteger(prior.generation) || prior.generation < 1 || !prior.settledAtMs) fail("intent_unsettled");
      // Retain the preceding exact generation before an explicit owner retry.
      tx.create(ref.collection("attempts").doc(String(prior.generation)), prior);
    }
    const request: SavedRecoveryRequest = { version: "owner-saved-recovery-request-v1", input, actorUid, requestDigest,
      generation: (prior?.generation ?? 0) + 1, requestedAtMs: now, expiresAtMs: now + SAVED_RECOVERY_WINDOW_MS,
      state: "queued", cancelRequested: false, executionToken: null, executionServiceId: null };
    tx.set(ref, request);
    return request;
  });
}
export async function cancelSavedRecovery(db: Firestore, jobId: string, actorUid: string, generation: number, requestDigest: string, now: number) {
  const ref = db.doc(`${SAVED_RECOVERY_REQUESTS}/${jobId}`);
  return db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data() as SavedRecoveryRequest | undefined;
    if (!record || record.actorUid !== actorUid || record.generation !== generation || record.requestDigest !== requestDigest) fail("intent_binding_changed");
    if (["completed", "failed", "cancelled"].includes(record.state)) return record;
    const next = { ...record, cancelRequested: true, ...(record.state === "queued" ? { state: "cancelled" as const, settledAtMs: now } : {}) };
    tx.set(ref, next); return next;
  });
}
