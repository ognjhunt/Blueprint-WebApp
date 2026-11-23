import { randomUUID } from "node:crypto";
import { hasCurrentRecordingConsent } from "./recordingConsent";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { humanDecisionDigest } from "./human-reply-admission";
import { getBrief } from "./siteTaskBrief";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import { reviewCaptureCoverage, type CoverageWaitReason } from "./captureCoverageReview";
import { logger } from "../logger";
import { findPriorFootageReview } from "./captureFootageReview";
import { mergeFootageIntoBrief } from "./siteTaskBriefReading";
import { authorizeCaptureUpload } from "./captureUploadAuthorization";
import { modelReviewHeadroom } from "./betaAbuseCaps";
import { GEMINI_VIDEO_CALL_RESERVATION_USD } from "../agents/adapters/site-assessment-budget";
import { providerOutageRetryDelayMs, type ProviderOutage } from "./providerOutage";
import { closeProviderOutageAlerts, noteProviderOutage } from "./providerOutageAlerts";
import { WEBSITE_JOB_WINDOW_ENDING_FIELD } from "./websiteJobWindowEnding";

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

/** Real failed reads before the review is handed to a person. Waiting for another call never counts toward it. */
export const COVERAGE_REVIEW_MAX_ATTEMPTS = 3;
/**
 * How long a read may keep waiting for another call on the same capture (the site assessment, today) before the wait
 * itself counts as a failed attempt with its typed reason: the same 30 minutes a running claim is trusted for.
 */
export const COVERAGE_REVIEW_WAIT_LIMIT_MS = 30 * 60_000;
/** The short delay before a read that waited is tried again. */
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
      if (attempts >= COVERAGE_REVIEW_MAX_ATTEMPTS) return "exhausted";
      // A read that waited for another call on this capture tries again after a short delay, not at once.
      if (job?.state === "waiting_prerequisite" && typeof job.retry_after_ms === "number" && job.retry_after_ms > Date.now()) return null;
      // A read the provider refused or did not answer waits out its back-off, and is not tried once the job's window has ended.
      if (job?.state === "waiting_provider" && ((typeof job.retry_after_ms === "number" && job.retry_after_ms > Date.now())
        || current?.[WEBSITE_JOB_WINDOW_ENDING_FIELD])) return null;
      tx.set(jobRef, { ...params, binding, state: "running", claim_token: claimToken, started_at: Date.now(), attempts: attempts + 1,
        first_claimed_at_ms: typeof job?.first_claimed_at_ms === "number" ? job.first_claimed_at_ms : Date.now() }, { merge: true });
      return "claimed";
    });
    if (!claim) continue;
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
        const finding = await reviewCaptureCoverage({ ...params, binding, reviewId: id, claimToken, notifyOwner: options.notifyOwner,
          onWaiting: reason => { waited = reason; }, onProviderOutage: found => { outage = found; } });
        if (!finding) {
          const patch = waited ? await waitPatch(jobRef, waited) : outage ? await outagePatch(jobRef, outage) : { state: "waiting_prerequisite" };
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
            // Since provider outages stopped using attempts, only readings that went wrong park a job.
            ...(claim === "exhausted" ? { provider_outages_excluded: true } : {}) } }, { merge: true });
      });
    } catch (error) {
      await finish({ state: "failed", reason: "coverage_review_failed" });
      logger.warn({ error, requestId: request.id }, "Coverage review remains pending");
    }
  }
}

/**
 * A read that ended because another call for the same capture was in flight is not an attempt: its attempt is
 * given back and it is tried again after a short delay. Only once the wait has lasted longer than
 * COVERAGE_REVIEW_WAIT_LIMIT_MS from the first claim does it count, as a failed attempt with its typed reason.
 */
async function waitPatch(jobRef: FirebaseFirestore.DocumentReference, reason: CoverageWaitReason): Promise<Record<string, unknown>> {
  const job = (await jobRef.get()).data();
  const firstClaimed = typeof job?.first_claimed_at_ms === "number" ? job.first_claimed_at_ms : Date.now();
  if (Date.now() - firstClaimed >= COVERAGE_REVIEW_WAIT_LIMIT_MS) {
    return { state: "waiting_prerequisite", wait_reason: reason, wait_counted: true };
  }
  const attempts = typeof job?.attempts === "number" && job.attempts > 0 ? job.attempts - 1 : 0;
  return { state: "waiting_prerequisite", attempts, wait_reason: reason, retry_after_ms: Date.now() + COVERAGE_REVIEW_WAIT_RETRY_MS };
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
 * Readings parked for a person before provider outages stopped using attempts get their attempts back from the queue
 * itself, a few per pass, through the same requeue the owner's door uses (its clearance, rights, in-flight call and
 * lifetime bound all apply). Not a reading whose window has ended, nor one parked by readings that went wrong.
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
      || value[WEBSITE_JOB_WINDOW_ENDING_FIELD] || value.capture_coverage) continue;
    try {
      const result = await requeueExhaustedCoverageReview(row.id, { apply: true, automatic: true });
      logger.info({ requestId: row.id, outcome: result.outcome, reason: result.reason }, "Parked coverage reading recovery");
    } catch (error) {
      logger.warn({ error, requestId: row.id }, "Parked coverage reading recovery will try again on a later pass");
    }
  }
}
