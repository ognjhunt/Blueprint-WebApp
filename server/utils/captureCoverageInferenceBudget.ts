import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { SiteAssessmentBudget } from "../agents/adapters/site-assessment-budget";
import { humanDecisionDigest } from "./human-reply-admission";
import { hasCurrentRecordingConsent } from "./recordingConsent";

/** Each traversal and correction shares one durable capture allowance. Brief
 * changes, queue retries and restarts never reset already reserved exposure.
 * Reuse the existing internal inference policy; the customer supplies no cap. */
export async function reserveCaptureCoverageInference(model: string, metadata: Record<string, unknown> = {}) {
  const captureId = metadata.capture_id, reviewId = metadata.review_id, claimToken = metadata.coverage_claim_token;
  if (!db || typeof captureId !== "string" || !/^[A-Za-z0-9._-]{1,200}$/.test(captureId)
    || typeof reviewId !== "string" || !/^[a-f0-9]{64}$/.test(reviewId)
    || typeof claimToken !== "string" || !claimToken) throw new Error("coverage_budget_claim_required");
  const jobRef = db.collection("captureCoverageReviews").doc(reviewId);
  const budgetRef = db.collection("captureCoverageReviews").doc(`budget-${humanDecisionDigest({ capture_id: captureId })}`);
  const token = randomUUID();
  const admission = await db.runTransaction(async tx => {
    const [jobSnap, budgetSnap] = await Promise.all([tx.get(jobRef), tx.get(budgetRef)]);
    const job = jobSnap.data(), state = budgetSnap.data();
    if (!job || job.state !== "running" || job.claim_token !== claimToken || job.captureId !== captureId
      || typeof job.requestId !== "string") throw new Error("coverage_budget_claim_changed");
    const [requestSnap, briefSnap] = await Promise.all([tx.get(db!.collection("inboundRequests").doc(job.requestId)),
      tx.get(db!.collection("siteTaskBriefs").doc(job.requestId))]);
    const request = requestSnap.data(), privacy = request?.capture_privacy_source_bound_decision || request?.capture_privacy_screen;
    if (!hasCurrentRecordingConsent(request?.request?.consent_attestation) || privacy?.proceeded !== true
      || privacy.capture_id !== captureId || humanDecisionDigest(privacy.producer_source) !== humanDecisionDigest(job.binding?.source)
      || !briefSnap.exists || humanDecisionDigest(briefSnap.data()) !== job.binding?.brief_digest) throw new Error("coverage_budget_source_changed");
    if (state && (state.capture_id !== captureId || !Number.isFinite(state.exposure_usd) || state.exposure_usd < 0
      || !Number.isSafeInteger(state.calls) || state.calls < 1)) throw new Error("coverage_budget_state_invalid");
    if (!state) {
      const [prior, runs] = await Promise.all([
        tx.get(db!.collection("captureCoverageReviews").where("captureId", "==", captureId).limit(100)),
        tx.get(db!.collection("agentRuns").where("metadata.capture_id", "==", captureId).limit(100)),
      ]);
      const coverageRuns = runs.docs.filter(row => row.data().task_kind === "capture_coverage");
      const currentRuns = coverageRuns.filter(row => row.data().status === "running"
        && row.data().metadata?.review_id === reviewId && row.data().metadata?.coverage_claim_token === claimToken);
      // Never reinterpret pre-budget attempts as free. Their provider exposure
      // requires reconciliation before this new policy can admit another call.
      if (job.attempts !== 1 || prior.docs.length >= 100 || runs.docs.length >= 100
        || currentRuns.length > 1 || coverageRuns.length !== currentRuns.length || prior.docs.some(row => row.id !== reviewId && (row.data().attempts ?? 0) > 0)) {
        throw new Error("coverage_budget_historical_exposure_unresolved");
      }
    }
    if (state?.pending_token) throw new Error("coverage_budget_cost_unresolved");
    const budget = new SiteAssessmentBudget(state?.exposure_usd ?? 0);
    if (state && state.cap_usd !== budget.cap) throw new Error("coverage_budget_policy_changed");
    budget.authorize("gemini", model);
    const reserved = budget.calls[0].reserved_usd;
    const exposure = (state?.exposure_usd ?? 0) + reserved;
    tx.set(budgetRef, { schema_version: "capture_coverage_inference_budget.v1", capture_id: captureId,
      cap_usd: budget.cap, exposure_usd: exposure, calls: (state?.calls ?? 0) + 1,
      pending_token: token, last_review_id: reviewId, updated_at_ms: Date.now() }, { merge: true });
    return { budget, exposure, reserved };
  });
  return {
    receipt: { cap_usd: admission.budget.cap, reserved_usd: admission.reserved, capture_exposure_usd: admission.exposure },
    async record(usage: unknown) {
      admission.budget.record("gemini", model, { usage });
      // Unknown usage retains both the reservation and pending state. Known
      // usage clears the pending call, but never releases reserved exposure.
      if (admission.budget.calls[0].cost_usd === null) return;
      await db!.runTransaction(async tx => {
        const state = (await tx.get(budgetRef)).data();
        if (state?.pending_token !== token) throw new Error("coverage_budget_admission_changed");
        tx.set(budgetRef, { pending_token: null, last_usage_estimate_usd: admission.budget.calls[0].cost_usd,
          updated_at_ms: Date.now() }, { merge: true });
      });
    },
  };
}
