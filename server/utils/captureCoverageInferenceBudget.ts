import { admitInferenceProgramme, hasInferenceProgramme, inferenceProgrammeId, inferenceProgrammeContextDigest, validateInferenceProgramme, inferenceProgrammeAuthorityDigest } from "./inferenceProgrammeAdmission";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { SiteAssessmentBudget } from "../agents/adapters/site-assessment-budget";
import { humanDecisionDigest } from "./human-reply-admission";
import { hasCurrentRecordingConsent } from "./recordingConsent";
import { hydrateAgentEvidence } from "../agents/private-evidence";

/** SDK assessment, each traversal and correction share one durable capture allowance. Brief
 * changes, queue retries and restarts never reset already reserved exposure.
 * Reuse the existing internal inference policy; the customer supplies no cap. */
export async function reserveCaptureCoverageInference(model: string, metadata: Record<string, unknown> = {},
  provider: "gemini" | "openai" = "gemini", modelRequest?: unknown) {
  const captureId = metadata.capture_id, reviewId = metadata.review_id, claimToken = metadata.coverage_claim_token;
  const assessmentRunId = metadata.assessment_run_id, assessment = typeof assessmentRunId === "string";
  if (!db || typeof captureId !== "string" || !/^[A-Za-z0-9._-]{1,200}$/.test(captureId)
    || (assessment ? !/^[A-Za-z0-9._-]{1,200}$/.test(assessmentRunId as string)
      : typeof reviewId !== "string" || !/^[a-f0-9]{64}$/.test(reviewId) || typeof claimToken !== "string" || !claimToken)) throw new Error("coverage_budget_claim_required");
  const jobRef = assessment ? db.collection("agentRuns").doc(assessmentRunId as string)
    : db.collection("captureCoverageReviews").doc(reviewId as string);
  const budgetRef = db.collection("captureCoverageReviews").doc(`budget-${humanDecisionDigest({ capture_id: captureId })}`);
  const token = randomUUID();
  const admission = await db.runTransaction(async tx => {
    const [jobSnap, budgetSnap] = await Promise.all([tx.get(jobRef), tx.get(budgetRef)]);
    const job = assessment && jobSnap.exists
      ? await hydrateAgentEvidence(jobSnap.data()!, { collection: "agentRuns", id: assessmentRunId as string })
      : jobSnap.data();
    const state = budgetSnap.data();
    const requestId = assessment ? job?.input?.input?.context?.request_id : job?.requestId;
    if (!job || (assessment ? job.task_kind !== "site_assessment" || job.status !== "running"
      || requestId !== metadata.assessment_request_id
      : job.state !== "running" || job.claim_token !== claimToken || job.captureId !== captureId)
      || typeof requestId !== "string") throw new Error("coverage_budget_claim_changed");
    const [requestSnap, briefSnap] = await Promise.all([tx.get(db!.collection("inboundRequests").doc(requestId)),
      tx.get(db!.collection("siteTaskBriefs").doc(requestId))]);
    const request = requestSnap.data(), privacy = request?.capture_privacy_source_bound_decision || request?.capture_privacy_screen;
    if (!hasCurrentRecordingConsent(request?.request?.consent_attestation) || privacy?.proceeded !== true
      || privacy.capture_id !== captureId || humanDecisionDigest(privacy.producer_source) !== humanDecisionDigest(assessment ? metadata.assessment_source : job.binding?.source)
      || (!assessment && (!briefSnap.exists || humanDecisionDigest(briefSnap.data()) !== job.binding?.brief_digest))) throw new Error("coverage_budget_source_changed");
    if (hasInferenceProgramme(request) && !assessment) throw new Error("inference_programme_coverage_deferred");
    if (state?.inference_program_id && (!hasInferenceProgramme(request) || request?.inference_program_id !== state.inference_program_id))
      throw new Error("inference_programme_binding_changed");
    const programmeId = hasInferenceProgramme(request) ? inferenceProgrammeId(request!) : null;
    // All authority reads precede writes in this same capture admission transaction.
    const programmeRef = programmeId ? db!.collection("inferencePrograms").doc(programmeId) : null;
    const programme = programmeRef ? (await tx.get(programmeRef)).data() : null;
    if (state?.inference_program_id) {
      if (state.inference_programme_authority_digest !== inferenceProgrammeAuthorityDigest(programme))
        throw new Error("inference_programme_authority_changed");
      const eligible = state.inference_programme_eligible_slot_ids, admitted = state.inference_programme_admitted_slot_ids;
      if (!Array.isArray(eligible) || !Array.isArray(admitted) || new Set(eligible).size !== eligible.length
        || new Set(admitted).size !== admitted.length || eligible.some(id => typeof id !== "string" || !/^[A-Za-z0-9._-]{1,120}$/.test(id)
          || !validateInferenceProgramme(programme).slots.some(row => row.id === id))
        || admitted.some(id => !eligible.includes(id))) throw new Error("inference_programme_state_invalid");
    }
    if (state && (state.capture_id !== captureId || !Number.isFinite(state.exposure_usd) || state.exposure_usd < 0
      || !Number.isSafeInteger(state.calls) || state.calls < 1)) throw new Error("coverage_budget_state_invalid");
    if (!state) {
      const [prior, runs, assessments] = await Promise.all([
        tx.get(db!.collection("captureCoverageReviews").where("captureId", "==", captureId).limit(100)),
        tx.get(db!.collection("agentRuns").where("metadata.capture_id", "==", captureId).limit(100)),
        // Input can be offloaded to immutable private evidence. Do not treat
        // an absent queryable input as proof that a prior paid run is absent.
        tx.get(db!.collection("agentRuns").where("task_kind", "==", "site_assessment").limit(100)),
      ]);
      const coverageRuns = await Promise.all(runs.docs.filter(row => row.data().task_kind === "capture_coverage")
        .map(async row => ({ id: row.id, data: await hydrateAgentEvidence(row.data(), { collection: "agentRuns", id: row.id }) })));
      const assessmentRuns = await Promise.all(assessments.docs.map(async row => ({ id: row.id,
        data: await hydrateAgentEvidence(row.data(), { collection: "agentRuns", id: row.id }) })));
      const currentRuns = coverageRuns.filter(row => row.data.status === "running"
        && row.data.metadata?.review_id === reviewId && row.data.metadata?.coverage_claim_token === claimToken);
      // Never reinterpret pre-budget attempts as free. Their provider exposure
      // requires reconciliation before this new policy can admit another call.
      if ((!assessment && job.attempts !== 1) || prior.docs.length >= 100 || runs.docs.length >= 100 || assessments.docs.length >= 100
        || assessmentRuns.some(row => row.id !== assessmentRunId
          && row.data.input?.input?.context?.request_id === requestId)
        || currentRuns.length > 1 || coverageRuns.length !== currentRuns.length || prior.docs.some(row => (assessment || row.id !== reviewId) && (row.data().attempts ?? 0) > 0)) {
        throw new Error("coverage_budget_historical_exposure_unresolved");
      }
    }
    if (state?.pending_token) throw new Error("coverage_budget_cost_unresolved");
    const budget = new SiteAssessmentBudget(state?.exposure_usd ?? 0);
    if (state && state.cap_usd !== budget.cap) throw new Error("coverage_budget_policy_changed");
    budget.authorize(provider, model, modelRequest);
    const reserved = budget.calls[0].reserved_usd;
    const exposure = (state?.exposure_usd ?? 0) + reserved;
    const programmeAdmission = programmeRef ? admitInferenceProgramme(programme, { requestId, captureId,
      contextDigest: inferenceProgrammeContextDigest(request!, briefSnap.data() ?? null), videoSha256: metadata.assessment_video_sha256,
      sourceDigest: humanDecisionDigest(privacy.producer_source), provider, model,
      reservedMicroUsd: Math.ceil(reserved * 1e6), token, runId: assessmentRunId as string,
      eligibleSlotIds: state?.inference_programme_eligible_slot_ids, admittedSlotIds: state?.inference_programme_admitted_slot_ids }) : null;
    if (programmeRef && programmeAdmission) tx.set(programmeRef, { slots: programmeAdmission.slots,
      producer_source_digest: programmeAdmission.producer_source_digest }, { merge: true });
    tx.set(budgetRef, { schema_version: "capture_coverage_inference_budget.v1", capture_id: captureId,
      cap_usd: budget.cap, exposure_usd: exposure, calls: (state?.calls ?? 0) + 1,
      pending_token: token, ...(programmeId && programmeAdmission ? { inference_program_id: programmeId,
        inference_programme_authority_digest: programmeAdmission.authorityDigest,
        inference_programme_eligible_slot_ids: state?.inference_programme_eligible_slot_ids
          ?? validateInferenceProgramme(programme).slots.filter(row => row.state === "held").map(row => row.id).sort(),
        inference_programme_admitted_slot_ids: [...(state?.inference_programme_admitted_slot_ids ?? []), programmeAdmission.slotId].sort(),
      } : {}), last_review_id: reviewId ?? null, last_assessment_run_id: assessmentRunId ?? null, updated_at_ms: Date.now() }, { merge: true });
    return { budget, exposure, reserved, programmeRef, programmeAdmission, programmeId, requestId,
      historyDigest: programmeAdmission ? humanDecisionDigest({ eligible: state?.inference_programme_eligible_slot_ids
        ?? validateInferenceProgramme(programme).slots.filter(row => row.state === "held").map(row => row.id).sort(),
        admitted: [...(state?.inference_programme_admitted_slot_ids ?? []), programmeAdmission.slotId].sort() }) : null };
  });
  return {
    receipt: { provider, cap_usd: admission.budget.cap, reserved_usd: admission.reserved, capture_exposure_usd: admission.exposure },
    /** Recheck operator authority immediately before dispatch. Refusal never refunds or clears uncertainty. */
    async assertDispatchAllowed() {
      if (!admission.programmeRef || !admission.programmeAdmission) return;
      await db!.runTransaction(async tx => {
        const [budgetSnap, programmeSnap, requestSnap, briefSnap] = await Promise.all([
          tx.get(budgetRef), tx.get(admission.programmeRef!),
          tx.get(db!.collection("inboundRequests").doc(admission.requestId)),
          tx.get(db!.collection("siteTaskBriefs").doc(admission.requestId)),
        ]);
        const state = budgetSnap.data(), request = requestSnap.data();
        const programme = validateInferenceProgramme(programmeSnap.data());
        if (programme.expires_at_ms <= Date.now()) throw new Error("inference_programme_expired");
        const privacy = request?.capture_privacy_source_bound_decision || request?.capture_privacy_screen;
        const slot = programme.slots.find(row => row.id === admission.programmeAdmission!.slotId);
        if (state?.pending_token !== token || state.capture_id !== captureId || state.inference_program_id !== admission.programmeId
          || state.inference_programme_authority_digest !== admission.programmeAdmission!.authorityDigest
          || humanDecisionDigest({ eligible: state.inference_programme_eligible_slot_ids,
            admitted: state.inference_programme_admitted_slot_ids }) !== admission.historyDigest
          || inferenceProgrammeAuthorityDigest(programme) !== admission.programmeAdmission!.authorityDigest
          || request?.inference_program_id !== admission.programmeId || programme.request_id !== admission.requestId
          || programme.capture_id !== captureId || programme.video_sha256 !== metadata.assessment_video_sha256
          || programme.context_digest !== inferenceProgrammeContextDigest(request!, briefSnap.data() ?? null)
          || !projectWebsiteCaptureRights(request).derived_scene_generation_allowed || privacy?.proceeded !== true
          || privacy.capture_id !== captureId || humanDecisionDigest(privacy.producer_source) !== programme.producer_source_digest
          || humanDecisionDigest(metadata.assessment_source) !== programme.producer_source_digest
          || slot?.state !== "admitted" || slot.admission_token !== token || slot.run_id !== assessmentRunId
          || slot.provider !== provider || slot.model !== model || slot.reserved_micro_usd !== admission.programmeAdmission!.slotReservation
          || slot.reserved_call_micro_usd !== Math.ceil(admission.reserved * 1e6))
          throw new Error("inference_programme_dispatch_changed");
      });
    },
    async record(usage: unknown) {
      admission.budget.record(provider, model, { usage });
      // Unknown usage retains both the reservation and pending state. Known
      // usage clears the pending call, but never releases reserved exposure.
      if (admission.budget.calls[0].cost_usd === null) return;
      await db!.runTransaction(async tx => {
        const state = (await tx.get(budgetRef)).data();
        if (state?.pending_token !== token) throw new Error("coverage_budget_admission_changed");
        if (admission.programmeRef && admission.programmeAdmission) {
          const programme = validateInferenceProgramme((await tx.get(admission.programmeRef)).data(), false);
          const slot = programme.slots.find(row => row.id === admission.programmeAdmission!.slotId);
          if (state.inference_programme_authority_digest !== admission.programmeAdmission.authorityDigest
            || inferenceProgrammeAuthorityDigest(programme) !== admission.programmeAdmission.authorityDigest
            || programme.producer_source_digest !== admission.programmeAdmission.producer_source_digest
            || slot?.state !== "admitted" || slot.admission_token !== token || slot.run_id !== assessmentRunId
            || slot.provider !== provider || slot.model !== model || slot.reserved_micro_usd !== admission.programmeAdmission.slotReservation
            || slot.reserved_call_micro_usd !== Math.ceil(admission.reserved * 1e6))
            throw new Error("inference_programme_admission_changed");
          tx.set(admission.programmeRef, { slots: programme.slots.map(row => row.id === slot.id ? { ...row, state: "recorded",
            usage_estimate_micro_usd: Math.ceil(admission.budget.calls[0].cost_usd! * 1e6) } : row) }, { merge: true });
        }
        tx.set(budgetRef, { pending_token: null, last_usage_estimate_usd: admission.budget.calls[0].cost_usd,
          updated_at_ms: Date.now() }, { merge: true });
      });
    },
  };
}
