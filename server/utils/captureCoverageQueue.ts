import { randomUUID } from "node:crypto";
import { hasCurrentRecordingConsent } from "./recordingConsent";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { humanDecisionDigest } from "./human-reply-admission";
import { getBrief } from "./siteTaskBrief";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import { reviewCaptureCoverage, type CoverageFailureReason, type CoverageWaitReason } from "./captureCoverageReview";
import { logger } from "../logger";
import { findPriorFootageReview } from "./captureFootageReview";
import { mergeFootageIntoBrief } from "./siteTaskBriefReading";
import { authorizeCaptureUpload } from "./captureUploadAuthorization";
import { modelReviewHeadroom } from "./betaAbuseCaps";
import { GEMINI_VIDEO_CALL_RESERVATION_USD } from "../agents/adapters/site-assessment-budget";
import { providerOutageRetryDelayMs, type ProviderOutage } from "./providerOutage";
import { closeProviderOutageAlerts, noteProviderOutage } from "./providerOutageAlerts";

/** The reservation's refusal at the job's $40 cap (`captureCoverageInferenceBudget.ts`), as the reading reports it. */
const COVERAGE_JOB_CAP_REACHED = "coverage_budget_job_cap_reached";

/**
 * Whether the job's own work window has ended, as the job pages read it (`websiteJobWorkWindow`): the sweep's ending
 * is recorded for the job's current grant and that grant's effective window (its verified extension included) is
 * still past, or the no-grant wait's ending is recorded. The job page then says the job's time ran out. An extension
 * granted afterwards reopens the window. A read that fails is not an ending.
 */
async function jobWindowEnded(record: Record<string, any> | undefined): Promise<boolean> {
  try {
    const { websiteJobWorkWindow } = await import("./websiteSceneSponsorship");
    return (await websiteJobWorkWindow(record)).endingRecorded === true;
  } catch (error) {
    logger.warn({ error }, "Coverage review could not read the job's window; it stays open for this pass");
    return false;
  }
}

/**
 * Whether the brief now on file is the one a review read: the brief it was bound to, or the one
 * that review's own draft of the job's name made from it (`capture_task_statement_draft`). Naming
 * the job from the video is the review's own output, never a reason to read the same video again;
 * any other change to the brief, such as the site's own sentence, still needs a fresh review.
 */
function briefStillReviewed(request: Record<string, any> | undefined, currentBriefDigest: string, boundDigest: string,
  captureId: string): boolean {
  if (currentBriefDigest === boundDigest) return true;
  const draft = request?.capture_task_statement_draft;
  return draft?.state === "drafted" && draft.capture_id === captureId && draft.from_brief_digest === boundDigest
    && draft.drafted_brief_digest === currentBriefDigest;
}

/** Why a reading bound to `binding` may not read the video now. */
export type CoverageClearanceRefusal = "recording_consent_not_current" | "privacy_decision_not_proceeded"
  | "capture_changed" | "source_changed" | "brief_changed";

/**
 * The current-clearance checks a reading must pass, read inside the same transaction that claims it: the site's
 * recording consent is current, the privacy decision proceeded for this capture, and the source and the brief are the
 * ones the reading was bound to. Null when it may read; otherwise the first reason it may not. The queue's claim and
 * the owner's requeue both use this one function.
 */
export function coverageClearanceRefusal(request: Record<string, any> | undefined, brief: unknown,
  binding: { source: unknown; brief_digest: string }, captureId: string): CoverageClearanceRefusal | null {
  const privacy = request?.capture_privacy_source_bound_decision || request?.capture_privacy_screen;
  if (!hasCurrentRecordingConsent(request?.request?.consent_attestation)) return "recording_consent_not_current";
  if (privacy?.proceeded !== true) return "privacy_decision_not_proceeded";
  if (privacy.capture_id !== captureId) return "capture_changed";
  if (!privacy.producer_source?.key || humanDecisionDigest(privacy.producer_source) !== humanDecisionDigest(binding.source))
    return "source_changed";
  if (humanDecisionDigest(brief) !== binding.brief_digest) return "brief_changed";
  return null;
}

/**
 * Real failed reads before the review is handed to a person. A wait for something the read needs (`CoverageWaitReason`)
 * and a provider outage never count toward it: a wait lasts until what it needs arrives or the job's window ends.
 */
export const COVERAGE_REVIEW_MAX_ATTEMPTS = 3;
/** The short delay before a read that waited, or failed, is tried again. Checking again costs no paid call. */
export const COVERAGE_REVIEW_WAIT_RETRY_MS = 60_000;

let activePass: Promise<void> | null = null;
/** Admission defers another same-capture traversal while this worker is busy. */
export function isCoverageReviewActive() { return activePass !== null; }
/** Existing scheduler/pump owns the tick; durable intent owns restart recovery. */
export function tickCoverageReviews(limit = 10, options: { notifyOwner?: boolean } = {}) {
  if (!activePass) activePass = reconcileCoverageReviews(limit, options)
    .catch(error => logger.warn({ error }, "Coverage reconciliation will resume on the next tick"))
    .finally(() => { activePass = null; });
}

export async function enqueueCoverageReview(params: { requestId: string; sceneId: string; captureId: string }) {
  if (!db) throw new Error("coverage_store_unavailable");
  const ref = db.collection("inboundRequests").doc(params.requestId);
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    const privacy = current?.capture_privacy_source_bound_decision || current?.capture_privacy_screen;
    if (!hasCurrentRecordingConsent(current?.request?.consent_attestation)
      || privacy?.capture_id !== params.captureId || privacy.proceeded !== true || !privacy.producer_source?.key)
      throw new Error("capture_review_current_clearance_required");
    tx.set(ref, { capture_coverage_pending: true, capture_coverage_request: params }, { merge: true });
  });
}

/** Reuses the existing coverage agent; delayed briefs stay pending without model calls. */
export async function reconcileCoverageReviews(limit = 10, options: { notifyOwner?: boolean } = {}) {
  if (!db || !isSiteVideoEvidenceEnabled()) return;
  await recoverParkedCoverageReviews(Math.min(limit, 2));
  // Adopt an older pending flag without starting a second coverage executor.
  // Retain attempts and lease so an interrupted rollout never resets spend.
  const legacy = await db.collection("inboundRequests").where("coverageReviewPending", "==", true).limit(limit).get();
  for (const row of legacy.docs) await db.runTransaction(async tx => {
    const current = (await tx.get(row.ref)).data();
    const work = current?.coverageReviewWork;
    if (!current?.coverageReviewPending || !work) return;
    const privacy = current.capture_privacy_source_bound_decision || current.capture_privacy_screen;
    // A newer canonical request owns its own identity. Stale legacy work must
    // never overwrite that identity or authorize a review of a replacement.
    if (current.capture_coverage_pending || privacy?.producer_source?.key !== work.sourceKey
      || privacy?.capture_id !== work.captureId) {
      const sameSource = privacy?.producer_source?.key === work.sourceKey && privacy?.capture_id === work.captureId;
      tx.set(row.ref, { coverageReviewPending: false,
        ...(sameSource ? { capture_coverage_legacy_budget: {
          source_key: work.sourceKey, attempts: work.attempts || 0, due_at_ms: work.dueAtMs || 0,
        } } : {}),
      }, { merge: true });
      return;
    }
    tx.set(row.ref, { coverageReviewPending: false, capture_coverage_pending: true,
      capture_coverage_request: { requestId: row.id, sceneId: work.sceneId, captureId: work.captureId },
      capture_coverage_legacy_budget: { source_key: work.sourceKey, attempts: work.attempts || 0, due_at_ms: work.dueAtMs || 0 },
    }, { merge: true });
  });
  const cursorRef = db.collection("automationCursors").doc("capture_coverage");
  const cursor = (await cursorRef.get()).data()?.last_id;
  let query = db.collection("inboundRequests").where("capture_coverage_pending", "==", true).orderBy("__name__").limit(limit);
  if (cursor) query = query.startAfter(cursor);
  const pending = await query.get();
  await cursorRef.set({ last_id: pending.docs.length ? pending.docs[pending.docs.length - 1].id : null });
  for (const request of pending.docs) {
    const value = request.data();
    const params = value.capture_coverage_request;
    const privacy = value.capture_privacy_source_bound_decision || value.capture_privacy_screen;
    if (!hasCurrentRecordingConsent(value.request?.consent_attestation)) continue;
    if (!params || params.requestId !== request.id || privacy?.capture_id !== params.captureId
      || !privacy.proceeded || !privacy.producer_source?.key) continue;
    if (!(await authorizeCaptureUpload(request.id)).allowed) continue;
    let brief = await getBrief(request.id);
    if (!brief) continue;
    const footage = await findPriorFootageReview(params.captureId);
    if (footage.state === "completed") {
      await mergeFootageIntoBrief({ requestId: request.id, captureId: params.captureId,
        evidence: footage.output, briefDigest: humanDecisionDigest(brief) });
      brief = await getBrief(request.id);
      if (!brief) continue;
    }
    // Without room in today's model budget the review stays pending and keeps
    // its attempts; claiming it now would only spend an attempt on a refusal.
    const headroom = await modelReviewHeadroom(GEMINI_VIDEO_CALL_RESERVATION_USD);
    if (!headroom.available) {
      logger.warn({ requestId: request.id, reason: headroom.reason }, "Coverage review waits for model budget");
      continue;
    }
    const windowEnded = await jobWindowEnded(value);
    const binding = { source: privacy.producer_source, brief_digest: humanDecisionDigest(brief), capture_id: params.captureId };
    const id = humanDecisionDigest({ request_id: request.id, ...binding });
    const jobRef = db.collection("captureCoverageReviews").doc(id);
    const claimToken = randomUUID();
    const claim = await db.runTransaction(async tx => {
      const [row, currentRequest, currentBrief] = await Promise.all([tx.get(jobRef), tx.get(request.ref), tx.get(db!.collection("siteTaskBriefs").doc(request.id))]);
      const current = currentRequest.data();
      if (coverageClearanceRefusal(current, currentBrief.data(), binding, params.captureId)) return null;
      const job = row.data();
      const legacyBudget = current?.capture_coverage_legacy_budget;
      const inherited = legacyBudget?.source_key === privacy.producer_source.key ? legacyBudget : null;
      if (!job && inherited?.due_at_ms > Date.now()) return null;
      const attempts = job?.attempts ?? inherited?.attempts ?? 0;
      if (job?.state === "completed") return "completed";
      if (job?.state === "running" && Date.now() - job.started_at < 30 * 60_000) return null;
      // Once the job's own window has ended nothing more is read: a wait or a retry ends here, said as it is.
      if (windowEnded) return "window_ended";
      if (attempts >= COVERAGE_REVIEW_MAX_ATTEMPTS) return "exhausted";
      // A read that waited, failed or met an outage tries again after its delay, not at once.
      if (typeof job?.retry_after_ms === "number" && job.retry_after_ms > Date.now()) return null;
      tx.set(jobRef, { ...params, binding, state: "running", claim_token: claimToken, started_at: Date.now(), attempts: attempts + 1,
        first_claimed_at_ms: typeof job?.first_claimed_at_ms === "number" ? job.first_claimed_at_ms : Date.now() }, { merge: true });
      return "claimed";
    });
    if (!claim) continue;
    if (claim === "window_ended") {
      await endCoverageReview(request.ref, id, binding, params.captureId, "job_window_ended");
      continue;
    }
    const finish = async (patch: Record<string, unknown>) => db!.runTransaction(async tx => {
      const current = (await tx.get(jobRef)).data();
      if (current?.claim_token !== claimToken) return false;
      tx.set(jobRef, patch, { merge: true });
      return true;
    });
    try {
      if (claim !== "completed" && claim !== "exhausted") {
        let waited = null as CoverageWaitReason | null;
        let outage = null as ProviderOutage | null;
        let failed = null as CoverageFailureReason | null;
        const finding = await reviewCaptureCoverage({ ...params, binding, reviewId: id, claimToken, notifyOwner: options.notifyOwner,
          onWaiting: reason => { waited = reason; }, onProviderOutage: found => { outage = found; }, onFailed: reason => { failed = reason; } });
        if (!finding) {
          if (failed === COVERAGE_JOB_CAP_REACHED) {
            // The job's $40 cap leaves no room for another paid read: it ships what it has, and the reading ends.
            if (await finish({ state: "ended", reason: COVERAGE_JOB_CAP_REACHED, retry_after_ms: null }))
              await endCoverageReview(request.ref, id, binding, params.captureId, "job_spend_cap_reached");
            continue;
          }
          const patch = waited ? await waitPatch(jobRef, waited) : outage ? await outagePatch(jobRef, outage)
            // A read that was tried and failed keeps its attempt, with its reason, and is tried again after a delay.
            : { state: "failed", reason: failed ?? "coverage_review_returned_nothing", retry_after_ms: Date.now() + COVERAGE_REVIEW_WAIT_RETRY_MS };
          if ((await finish(patch)) && outage) await noteProviderOutage(outage);
          continue;
        }
        if (!(await finish({ state: "completed", finding, provider_outage: null, retry_after_ms: null }))) continue;
        await closeProviderOutageAlerts("gemini");
      }
      await db.runTransaction(async tx => {
        const [current, currentBrief] = await Promise.all([tx.get(request.ref), tx.get(db!.collection("siteTaskBriefs").doc(request.id))]);
        const data = current.data();
        const source = data?.capture_privacy_source_bound_decision || data?.capture_privacy_screen;
        if (!hasCurrentRecordingConsent(data?.request?.consent_attestation) || source?.proceeded !== true
          || source.capture_id !== params.captureId
          || humanDecisionDigest(source?.producer_source || null) !== humanDecisionDigest(binding.source)
          || !briefStillReviewed(data, humanDecisionDigest(currentBrief.data()), binding.brief_digest, params.captureId)) return;
        tx.set(request.ref, { capture_coverage_pending: false,
          capture_coverage_review: { review_id: id, state: claim === "exhausted" ? "review_required" : "completed",
            reason: claim === "exhausted" ? "automatic_review_attempts_exhausted" : null,
            // Since waits and provider outages stopped using attempts, only readings that went wrong park a job.
            ...(claim === "exhausted" ? { waits_and_outages_excluded: true } : {}) } }, { merge: true });
      });
    } catch (error) {
      await finish({ state: "failed", reason: "coverage_review_failed", retry_after_ms: Date.now() + COVERAGE_REVIEW_WAIT_RETRY_MS });
      logger.warn({ error, requestId: request.id }, "Coverage review remains pending");
    }
  }
}

/**
 * A read that ended because something it needs is not there yet (`CoverageWaitReason`) is not an attempt: its attempt
 * is given back and it is checked again after a short delay, for as long as it takes, until what it needs arrives or
 * the job's window ends. A wait never parks a job.
 */
async function waitPatch(jobRef: FirebaseFirestore.DocumentReference, reason: CoverageWaitReason): Promise<Record<string, unknown>> {
  const job = (await jobRef.get()).data();
  const attempts = typeof job?.attempts === "number" && job.attempts > 0 ? job.attempts - 1 : 0;
  return { state: "waiting_prerequisite", attempts, wait_reason: reason, retry_after_ms: Date.now() + COVERAGE_REVIEW_WAIT_RETRY_MS,
    first_waited_at_ms: typeof job?.first_waited_at_ms === "number" ? job.first_waited_at_ms : Date.now() };
}

/**
 * The reading ends where nothing more will happen: the job's window ended, or the job's spending cap leaves no room for
 * a paid read. The request stops being scanned and records why, under the same consent and source checks as a finding.
 */
async function endCoverageReview(requestRef: FirebaseFirestore.DocumentReference, reviewId: string,
  binding: { source: unknown; brief_digest: string }, captureId: string, reason: "job_window_ended" | "job_spend_cap_reached") {
  await db!.runTransaction(async tx => {
    const jobRef = db!.collection("captureCoverageReviews").doc(reviewId);
    const [current, job] = await Promise.all([tx.get(requestRef), tx.get(jobRef)]);
    const data = current.data();
    const source = data?.capture_privacy_source_bound_decision || data?.capture_privacy_screen;
    if (source?.capture_id !== captureId || humanDecisionDigest(source?.producer_source || null) !== humanDecisionDigest(binding.source)) return;
    if (job.exists && job.data()?.state !== "completed" && job.data()?.state !== "ended")
      tx.set(jobRef, { state: "ended", reason, retry_after_ms: null }, { merge: true });
    tx.set(requestRef, { capture_coverage_pending: false,
      capture_coverage_review: { review_id: reviewId, state: "ended", reason } }, { merge: true });
  });
}

/**
 * A read the provider refused or did not answer (`providerOutage.ts`) is not an attempt: its attempt is given back and
 * it is tried again on a back-off of 2 minutes doubling to an hour, for as long as the job's window is open. The call
 * was never answered, so a retry pays for no answer twice; each retry is admitted by the same budget checks as any read.
 */
async function outagePatch(jobRef: FirebaseFirestore.DocumentReference, outage: ProviderOutage): Promise<Record<string, unknown>> {
  const job = (await jobRef.get()).data();
  const prior = job?.provider_outage;
  const retries = typeof prior?.retries === "number" ? prior.retries : 0;
  const attempts = typeof job?.attempts === "number" && job.attempts > 0 ? job.attempts - 1 : 0;
  return { state: "waiting_provider", attempts, retry_after_ms: Date.now() + providerOutageRetryDelayMs(retries),
    provider_outage: { ...outage, retries: retries + 1,
      first_seen_at_ms: typeof prior?.first_seen_at_ms === "number" ? prior.first_seen_at_ms : Date.now(), last_seen_at_ms: Date.now() } };
}

/**
 * Readings parked for a person before waits and provider outages stopped using attempts (each wait and each refusal
 * counted, and three in a few minutes parked the job) get their attempts back from the queue itself, a few per pass,
 * through the same requeue the owner's door uses (its clearance, rights and in-flight call checks all apply). This
 * recovery happens at most once per reading and never uses the owner's two requeues. Not a reading whose window has
 * ended, nor one parked since this change (only readings that went wrong park now).
 */
async function recoverParkedCoverageReviews(limit: number) {
  if (!db || limit <= 0) return;
  const cursorRef = db.collection("automationCursors").doc("capture_coverage_recovery");
  const cursor = (await cursorRef.get()).data()?.last_id;
  let query = db.collection("inboundRequests").where("capture_coverage_review.state", "==", "review_required")
    .orderBy("__name__").limit(limit);
  if (cursor) query = query.startAfter(cursor);
  const parked = await query.get();
  await cursorRef.set({ last_id: parked.docs.length ? parked.docs[parked.docs.length - 1].id : null });
  const { requeueExhaustedCoverageReview } = await import("./captureCoverageRequeue");
  for (const row of parked.docs) {
    const value = row.data();
    const review = value.capture_coverage_review;
    if (review?.reason !== "automatic_review_attempts_exhausted" || review.provider_outages_excluded === true
      || review.waits_and_outages_excluded === true || value.capture_coverage || await jobWindowEnded(value)) continue;
    try {
      const result = await requeueExhaustedCoverageReview(row.id, { apply: true, automatic: true });
      logger.info({ requestId: row.id, outcome: result.outcome, reason: result.reason }, "Parked coverage reading recovery");
    } catch (error) {
      logger.warn({ error, requestId: row.id }, "Parked coverage reading recovery will try again on a later pass");
    }
  }
}
