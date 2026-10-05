import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { humanDecisionDigest } from "./human-reply-admission";
import { getBrief } from "./siteTaskBrief";
import { isSiteVideoEvidenceEnabled } from "../config/env";
import { reviewCaptureCoverage } from "./captureCoverageReview";
import { logger } from "../logger";
import { findPriorFootageReview } from "./captureFootageReview";
import { mergeFootageIntoBrief } from "./siteTaskBriefReading";
import { authorizeCaptureUpload } from "./captureUploadAuthorization";

let activePass: Promise<void> | null = null;
/** Existing scheduler/pump owns the tick; durable intent owns restart recovery. */
export function tickCoverageReviews(limit = 10) {
  if (!activePass) activePass = reconcileCoverageReviews(limit)
    .catch(error => logger.warn({ error }, "Coverage reconciliation will resume on the next tick"))
    .finally(() => { activePass = null; });
}

export async function enqueueCoverageReview(params: { requestId: string; sceneId: string; captureId: string }) {
  if (!db) throw new Error("coverage_store_unavailable");
  const ref = db.collection("inboundRequests").doc(params.requestId);
  await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    const privacy = current?.capture_privacy_source_bound_decision || current?.capture_privacy_screen;
    if (privacy?.capture_id && privacy.capture_id !== params.captureId) return;
    tx.set(ref, { capture_coverage_pending: true, capture_coverage_request: params }, { merge: true });
  });
}

/** Reuses the existing coverage agent; delayed briefs stay pending without model calls. */
export async function reconcileCoverageReviews(limit = 10) {
  if (!db || !isSiteVideoEvidenceEnabled()) return;
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
    const binding = { source: privacy.producer_source, brief_digest: humanDecisionDigest(brief), capture_id: params.captureId };
    const id = humanDecisionDigest({ request_id: request.id, ...binding });
    const jobRef = db.collection("captureCoverageReviews").doc(id);
    const claim = await db.runTransaction(async tx => {
      const row = await tx.get(jobRef);
      const job = row.data();
      if (job?.state === "completed") return "completed";
      if (job?.state === "running" && Date.now() - job.started_at < 30 * 60_000) return null;
      if ((job?.attempts || 0) >= 3) return "exhausted";
      tx.set(jobRef, { ...params, binding, state: "running", started_at: Date.now(), attempts: (job?.attempts || 0) + 1 }, { merge: true });
      return "claimed";
    });
    if (!claim) continue;
    try {
      if (claim !== "completed" && claim !== "exhausted") {
        const finding = await reviewCaptureCoverage({ ...params, binding, reviewId: id });
        if (!finding) { await jobRef.set({ state: "waiting_prerequisite" }, { merge: true }); continue; }
        await jobRef.set({ state: "completed", finding }, { merge: true });
      }
      await db.runTransaction(async tx => {
        const [current, currentBrief] = await Promise.all([tx.get(request.ref), tx.get(db!.collection("siteTaskBriefs").doc(request.id))]);
        const data = current.data();
        const source = data?.capture_privacy_source_bound_decision || data?.capture_privacy_screen;
        if (humanDecisionDigest(source?.producer_source || null) !== humanDecisionDigest(binding.source)
          || humanDecisionDigest(currentBrief.data()) !== binding.brief_digest) return;
        tx.set(request.ref, { capture_coverage_pending: false,
          capture_coverage_review: { review_id: id, state: claim === "exhausted" ? "review_required" : "completed",
            reason: claim === "exhausted" ? "automatic_review_attempts_exhausted" : null } }, { merge: true });
      });
    } catch (error) {
      await jobRef.set({ state: "failed", reason: "coverage_review_failed" }, { merge: true });
      logger.warn({ error, requestId: request.id }, "Coverage review remains pending");
    }
  }
}
