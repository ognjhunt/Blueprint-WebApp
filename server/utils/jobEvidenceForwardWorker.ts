/** Durable delivery for the existing, read-only job-evidence bridge.
 * Paid policy launches retain their separate allocator and reconciliation path.
 */
import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { crossRuntimeArtifactDigest } from "./crossRuntimeCanonical";
import { captureUploadIntakeReceiptSchema } from "./captureUploadForwarding";
import { savedWalkthrough, siteWalkthroughIdentity } from "./siteWalkthrough";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { forwardJobEvidence, jobEvidenceCaptureSessionId, jobEvidenceRequestSchema,
  scientificBriefDigest, scientificContext, type JobEvidenceRequest } from "./jobEvidenceContract";
import { acceptJobEvidencePublication } from "./jobEvidenceStore";
import { JobMarketplaceError } from "./jobMarketplaceWorkflow";
import { withTaskEvaluationLaunchStoreTimeout as storeTimeout } from "./taskEvaluationLaunchStore";
import type { TaskItemInventoryRecord } from "./taskItemInventory";
import type { Response } from "express";
import { resolveExecutionAccessContext } from "./access-control";

type Action = "submit" | "refresh" | "execute" | "cancel";
type Forwarder = typeof forwardJobEvidence;
const ACTIVE = ["pending", "retry_pending", "delivering"];
const ATTEMPTS = 8;
const LEASE_MS = 90_000;

export function jobEvidenceDeliveryIntent(action: Action, actor: string, now = Date.now(), tenantId?: string) {
  return { deliveryId: randomUUID(), deliveryAction: action, deliveryActor: actor, deliveryState: "pending",
    deliveryActorTenantId: tenantId || null,
    deliveryAttempts: 0, deliveryCreatedAtMs: now, deliveryNextAtMs: now, deliveryLeaseId: null,
    deliveryLeaseUntilMs: 0, forwardingReason: null, ...(action === "cancel" ? { cancellationRequested: true } : {}) };
}

export const jobEvidenceQueueMarker = (deliveryId: string, now = Date.now()) => ({
  job_evidence_forward_pending: true, job_evidence_forward_revision: deliveryId, job_evidence_forward_next_at_ms: now,
});

/** Native intake receipts and browser receipts both prove retained bytes, never a preallocated ID. */
export async function assertJobEvidenceVideo(jobId: string, record: Record<string, any>,
  brief: Record<string, any>, session?: Record<string, any> | null, inventory?: TaskItemInventoryRecord | null) {
  const walkthrough = await savedWalkthrough(siteWalkthroughIdentity(jobId));
  if (walkthrough?.received === true) return;
  const receipt = captureUploadIntakeReceiptSchema.safeParse(session?.pipeline_capture_intake_receipt);
  const binding = record.job_evidence_source;
  const retained = session && receipt.success && binding?.job_id === jobId
    && session?.session_id === binding.capture_session_id && receipt.data.capture_session_id === session.session_id
    && receipt.data.intake_id === binding.intake_id && receipt.data.intake_id === session.request?.intake_id
    && receipt.data.capture_digest === binding.source_capture_digest
    && receipt.data.size_bytes === session.request?.original_file?.size_bytes
    && receipt.data.artifact_reference.envelope_digest === receipt.data.envelope_digest
    && session?.content_addressing?.sha256 === receipt.data.capture_digest
    && session?.content_addressing?.raw_input_content_addressed === true
    && String(session?.request?.original_file?.media_type ?? "").startsWith("video/")
    && scientificContext(session, { brief, record, inventory }) !== null;
  if (retained) return;
  throw new JobMarketplaceError(walkthrough === null ? "capture_status_unavailable" : "video_required",
    walkthrough === null ? "We could not verify the retained recording. Try again before continuing assessment."
      : "Upload or record the work before assessing this job.", walkthrough === null ? 503 : 409);
}

export async function queueJobEvidenceAction(jobId: string, requestId: string, action: Action, actor: string, tenantId?: string) {
  if (!db) throw new JobMarketplaceError("store_unavailable", "Job evidence storage is unavailable.", 503);
  const jobRef = db.collection("inboundRequests").doc(jobId);
  const ref = jobRef.collection("jobEvidenceRequests").doc(requestId);
  await storeTimeout(db.runTransaction(async tx => {
    const saved = await tx.get(ref);
    if (!saved.exists) throw new JobMarketplaceError("evidence_request_not_found", "Evidence request not found.", 404);
    const current = saved.data()!;
    if (current.cancellationRequested && action !== "cancel") {
      throw new JobMarketplaceError("evidence_cancelled", "This evidence request was cancelled. Prepare a new question for any further work.");
    }
    // Retrying the same pending action does not replace its lease or reset its cap.
    if (ACTIVE.includes(current.deliveryState) && current.deliveryAction === action) return;
    const intent = jobEvidenceDeliveryIntent(action, actor, Date.now(), tenantId);
    tx.update(ref, intent);
    tx.update(jobRef, jobEvidenceQueueMarker(intent.deliveryId, intent.deliveryCreatedAtMs));
  }));
}

function retryPatch(attempts: number, now: number, reason: string, terminal = false) {
  const exhausted = terminal || attempts >= ATTEMPTS;
  return { deliveryState: exhausted ? "terminal_blocked" : "retry_pending", deliveryLeaseId: null,
    deliveryLeaseUntilMs: 0, deliveryNextAtMs: exhausted ? Number.MAX_SAFE_INTEGER
      : now + Math.min(900_000, 30_000 * 2 ** Math.min(attempts - 1, 5)), forwardingReason: reason };
}

async function currentScope(request: JobEvidenceRequest) {
  const jobRef = db!.collection("inboundRequests").doc(request.job_id);
  const [job, brief, inventory] = await Promise.all([jobRef.get(), db!.collection("siteTaskBriefs").doc(request.job_id).get(),
    db!.collection("siteTaskItemInventories").doc(request.job_id).get()]);
  const record = job.data();
  if (!record || record.request?.buyerType !== "site_operator") throw new JobMarketplaceError("job_not_found", "The saved job is unavailable.");
  if (!projectWebsiteCaptureRights(record).derived_scene_generation_allowed) {
    throw new JobMarketplaceError("capture_processing_not_authorized", "Recording permission is missing or was withdrawn. No further evidence work was sent.");
  }
  if (!brief.exists || !brief.data()!.confirmedAtIso || scientificBriefDigest(brief.data()!) !== request.brief_digest) {
    throw new JobMarketplaceError("evidence_scope_changed", "The job changed. Prepare the question against its current brief.");
  }
  const session = await db!.collection("captureUploadSessions").doc(jobEvidenceCaptureSessionId(request.job_id, record)).get();
  const sessionValue = session.exists ? session.data()! : null;
  await assertJobEvidenceVideo(request.job_id, record, brief.data()!, sessionValue, inventory.exists ? inventory.data() as any : null);
  if (request.testbed && scientificContext(sessionValue, { brief: brief.data()!, record,
    inventory: inventory.exists ? inventory.data() as any : null })?.testbed.testbed_digest !== request.testbed.testbed_digest) {
    throw new JobMarketplaceError("evidence_scope_changed", "The task, source or its permission changed. Prepare the current evidence question.");
  }
}

async function currentExecutionActor(claimed: Record<string, any>) {
  const access = await resolveExecutionAccessContext({ locals: { firebaseUser: { uid: claimed.deliveryActor,
    ...(claimed.deliveryActorTenantId ? { tenantId: claimed.deliveryActorTenantId } : {}) } } } as Response);
  if (!access.isOps || access.uid !== claimed.deliveryActor) throw new JobMarketplaceError("evidence_actor_authority_ended",
    "The operator's execution authority is no longer active. An authorized operator can review the saved question.", 403);
}

export async function deliverJobEvidenceRequest(jobId: string, requestId: string,
  options: { forwarder?: Forwarder; nowMs?: number } = {}) {
  if (!db) return false;
  const now = options.nowMs ?? Date.now();
  const forward = options.forwarder ?? forwardJobEvidence;
  const ref = db.collection("inboundRequests").doc(jobId).collection("jobEvidenceRequests").doc(requestId);
  const lease = randomUUID();
  const claimed = await storeTimeout(db.runTransaction(async tx => {
    const saved = await tx.get(ref);
    const value = saved.data();
    if (!value || !ACTIVE.includes(value.deliveryState) || value.deliveryNextAtMs > now
      || (value.deliveryState === "delivering" && value.deliveryLeaseUntilMs > now)) return null;
    if (!Number.isInteger(value.deliveryAttempts) || value.deliveryAttempts >= ATTEMPTS) {
      tx.update(ref, retryPatch(ATTEMPTS, now, "Evidence delivery reached its retry limit. Blueprint can review and retry this saved question.", true));
      return null;
    }
    tx.update(ref, { deliveryState: "delivering", deliveryLeaseId: lease,
      deliveryLeaseUntilMs: now + LEASE_MS, deliveryNextAtMs: now + LEASE_MS, deliveryAttempts: value.deliveryAttempts + 1 });
    return value;
  }));
  if (!claimed) return false;
  const attempts = claimed.deliveryAttempts + 1;
  let patch: Record<string, any>;
  try {
    const request = jobEvidenceRequestSchema.parse(claimed.request);
    if (request.job_id !== jobId || request.request_id !== requestId
      || crossRuntimeArtifactDigest(request, "request_digest") !== request.request_digest) throw new Error("evidence_request_binding_invalid");
    const action = claimed.deliveryAction as Action;
    if (!["submit", "refresh", "execute", "cancel"].includes(action) || !claimed.deliveryActor) throw new Error("evidence_delivery_action_invalid");
    if (claimed.cancellationRequested && action !== "cancel") throw new JobMarketplaceError("evidence_cancelled", "The evidence request was cancelled.");
    if (action !== "cancel") await currentScope(request);
    if (action === "execute") await currentExecutionActor(claimed);
    if (now - claimed.deliveryCreatedAtMs > (action === "execute" ? 600_000 : 86_400_000)) {
      throw new JobMarketplaceError("evidence_action_expired", "This saved evidence action expired. Blueprint can review the current scope before retrying.");
    }
    const suffix = `/${encodeURIComponent(requestId)}`;
    // Always reconcile an ambiguous delivery first. The submit identity is
    // immutable. The execute action is ONLY the bridge's read-only local
    // adapters; this replay rule must never be reused for paid policy launches.
    let result = claimed.deliveryAttempts > 0 || action !== "submit" ? await forward({}, suffix, "GET") : null;
    if (result?.ok) {
      if (action !== "cancel" || result.publication.state === "cancelled") await acceptJobEvidencePublication(result.publication);
      if ((action === "execute" && !["decision", "partial_decision", "abstention", "failed", "cancelled"].includes(result.publication.state))
        || (action === "cancel" && result.publication.state !== "cancelled")) result = null;
    } else if (result && result.status !== 404) {
      // An unavailable GET cannot establish whether the previous effect landed.
      patch = retryPatch(attempts, now, result.reason, Boolean(result.status && result.status >= 400 && result.status < 500 && ![408, 429].includes(result.status)));
      return await finish(patch);
    } else result = null;
    if (!result) {
      const latest = (await storeTimeout(ref.get())).data();
      if (!latest || latest.deliveryId !== claimed.deliveryId || latest.deliveryLeaseId !== lease) return false;
      if (action !== "cancel") await currentScope(request);
      if (action === "execute") await currentExecutionActor(claimed);
      const payload = action === "execute" ? { request_digest: request.request_digest, authorized_by: { role: "human", identity: claimed.deliveryActor } }
        : action === "cancel" ? { request_digest: request.request_digest, cancelled_by: claimed.deliveryActor } : request;
      // A cancellation for a request never accepted by Pipeline needs no new submit.
      result = await forward(payload, action === "execute" || action === "cancel" ? `${suffix}/${action}` : "");
      if (result.ok) await acceptJobEvidencePublication(result.publication);
    }
    patch = result.ok ? { deliveryState: "delivered", deliveryLeaseId: null, deliveryLeaseUntilMs: 0,
      deliveryNextAtMs: Number.MAX_SAFE_INTEGER, forwardingReason: null }
      : retryPatch(attempts, now, result.reason, Boolean(result.status && result.status >= 400 && result.status < 500 && ![408, 429].includes(result.status)));
  } catch (error) {
    patch = retryPatch(attempts, now, error instanceof JobMarketplaceError ? error.message
      : "The saved evidence action could not be verified. Blueprint must review the retained request before retrying.",
    !(error instanceof JobMarketplaceError && error.status >= 500));
  }
  return await finish(patch);

  async function finish(next: Record<string, any>) {
    return storeTimeout(db!.runTransaction(async tx => {
      const current = (await tx.get(ref)).data();
      // Cancellation or a new explicit action supersedes any in-flight response.
      if (!current || current.deliveryId !== claimed!.deliveryId || current.deliveryLeaseId !== lease) return false;
      tx.update(ref, next);
      return true;
    }));
  }
}

/** Use the existing jobs and request subcollection; a parent marker makes the queue discoverable. */
export async function processJobEvidenceForwardQueue(limit = 10, options: { forwarder?: Forwarder; nowMs?: number } = {}) {
  if (!db) return { processed: 0 };
  const now = options.nowMs ?? Date.now();
  const jobs = await storeTimeout(db.collection("inboundRequests").where("job_evidence_forward_next_at_ms", "<=", now).limit(limit).get());
  let processed = 0;
  for (const job of jobs.docs) {
    const revision = job.data().job_evidence_forward_revision;
    const requests = job.ref.collection("jobEvidenceRequests");
    // The due-time field alone uses Firestore's existing single-field index.
    // Backoff on an older request must not hide another ready request.
    const pending = await storeTimeout(requests.where("deliveryNextAtMs", "<=", now).limit(limit).get());
    for (const request of pending.docs) {
      if (await deliverJobEvidenceRequest(job.id, request.id, options)) processed += 1;
    }
    const remaining = await storeTimeout(requests.where("deliveryNextAtMs", "<", Number.MAX_SAFE_INTEGER).orderBy("deliveryNextAtMs", "asc").limit(1).get());
    await storeTimeout(db.runTransaction(async tx => {
      const current = (await tx.get(job.ref)).data();
      if (current?.job_evidence_forward_revision === revision) tx.update(job.ref, {
        job_evidence_forward_pending: !remaining.empty,
        job_evidence_forward_next_at_ms: remaining.empty ? Number.MAX_SAFE_INTEGER : remaining.docs[0].data().deliveryNextAtMs,
      });
    }));
  }
  return { processed };
}
