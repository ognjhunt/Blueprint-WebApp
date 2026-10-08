import type { Transaction } from "firebase-admin/firestore";
import { admitInferenceProgramme, hasInferenceProgramme, inferenceProgrammeId, inferenceProgrammeContextDigest, validateInferenceProgramme, inferenceProgrammeAuthorityDigest, acceptsReconciledCaptureHistory, validatedAssessmentRecoveries, assertInferenceProgrammeClock, INFERENCE_TECHNICAL_WINDOW_MS, type AssessmentRecovery } from "./inferenceProgrammeAdmission";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { SiteAssessmentBudget } from "../agents/adapters/site-assessment-budget";
import { humanDecisionDigest } from "./human-reply-admission";
import { hasCurrentRecordingConsent } from "./recordingConsent";
import { hydrateAgentEvidence } from "../agents/private-evidence";

/** Accepted zero-provider review history never authorizes a second or unknown SDK run. */
async function assertReconciledRunHistory(tx: Transaction, captureId: string, runId: string, requestId: string,
  state?: Record<string, any>, programme?: any) {
  const receipts = programme && state ? validatedAssessmentRecoveries(state, programme) : [];
  const accounted = async (id: string, raw: Record<string, any>) => {
    const receipt = receipts.find(row => row.previous_run_id === id);
    if (!receipt) return false;
    const run: any = await hydrateAgentEvidence(raw, { collection: "agentRuns", id });
    const job = (await tx.get(db!.collection("siteAssessmentJobs").doc(receipt.job_id))).data();
    const bound = run.artifacts?.source_admission, intent = run.artifacts?.capture_inference_reservations?.at(-1);
    return run.task_kind === "site_assessment" && run.status === "failed" && run.metadata?.capture_id === captureId
      && run.metadata?.advisory_job_id === receipt.job_id && run.input?.input?.context?.request_id === requestId
      && run.input?.input?.context?.advisory_job_id === receipt.job_id
      && run.input?.input?.context?.advisory_claim_id === receipt.previous_claim_id
      && bound?.request_id === requestId && bound?.capture_id === captureId && bound?.advisory_job_id === receipt.job_id
      && bound?.source_key === receipt.source_key && bound?.context_digest === receipt.advisory_context_digest
      && bound?.video_sha256 === receipt.video_sha256
      && intent?.provider === receipt.provider && Math.ceil(intent?.reserved_usd * 1e6) === receipt.reserved_call_micro_usd
      && intent?.capture_exposure_usd === receipt.capture_exposure_usd && intent?.cap_usd === state?.cap_usd
      && job?.run_id === runId
      && job?.source_key === receipt.source_key && job?.context_digest === receipt.advisory_context_digest
      && humanDecisionDigest(job.retry_history) === humanDecisionDigest(receipts);
  };
  const [runs, assessments] = await Promise.all([
    tx.get(db!.collection("agentRuns").where("metadata.capture_id", "==", captureId).limit(100)),
    tx.get(db!.collection("agentRuns").where("task_kind", "==", "site_assessment").limit(100)),
  ]);
  const unrelatedRuns = await Promise.all(runs.docs.filter(row => row.id !== runId).map(async row => !(await accounted(row.id, row.data()))));
  if (runs.docs.length >= 100 || assessments.docs.length >= 100 || unrelatedRuns.some(Boolean))
    throw new Error("coverage_budget_historical_exposure_unresolved");
  const otherAssessments = await Promise.all(assessments.docs.filter(row => row.id !== runId).map(async row => ({ id: row.id,
    data: await hydrateAgentEvidence(row.data(), { collection: "agentRuns", id: row.id }), raw: row.data() })));
  const uncovered = await Promise.all(otherAssessments.filter(row => row.data.input?.input?.context?.request_id === requestId)
    .map(async row => !(await accounted(row.id, row.raw))));
  if (uncovered.some(Boolean))
    throw new Error("coverage_budget_historical_exposure_unresolved");
}

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
    if (state && (programme?.capture_history_reconciliation || state.assessment_recoveries))
      await assertReconciledRunHistory(tx, captureId, assessmentRunId as string, requestId, state, programme);
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
      const reconciledHistory = assessment && programmeRef && programme?.capture_history_reconciliation
        ? acceptsReconciledCaptureHistory(programme, requestId, captureId, prior.docs.map(row => ({ id: row.id, data: row.data() }))) : false;
      // Never reinterpret pre-budget attempts as free. Their provider exposure
      // requires reconciliation before this new policy can admit another call.
      if ((!assessment && job.attempts !== 1) || prior.docs.length >= 100 || runs.docs.length >= 100 || assessments.docs.length >= 100
        || assessmentRuns.some(row => row.id !== assessmentRunId
          && row.data.input?.input?.context?.request_id === requestId)
        || currentRuns.length > 1 || coverageRuns.length !== currentRuns.length
        || (programme?.capture_history_reconciliation && (!reconciledHistory || runs.docs.some(row => row.id !== assessmentRunId)))
        || (prior.docs.some(row => (assessment || row.id !== reviewId) && (row.data().attempts ?? 0) > 0)
          && !reconciledHistory)) {
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
      eligibleSlotIds: state?.inference_programme_eligible_slot_ids, admittedSlotIds: state?.inference_programme_admitted_slot_ids, captureState: state }) : null;
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
        assertInferenceProgrammeClock(programme, state, admission.programmeAdmission!.slotId);
        const privacy = request?.capture_privacy_source_bound_decision || request?.capture_privacy_screen;
        if (programme.capture_history_reconciliation || state?.assessment_recoveries) {
          await assertReconciledRunHistory(tx, captureId, assessmentRunId as string, admission.requestId, state, programme);
        }
        if (programme.capture_history_reconciliation) {
          const history = await tx.get(db!.collection("captureCoverageReviews").where("captureId", "==", captureId).limit(100));
          if (!acceptsReconciledCaptureHistory(programme, admission.requestId, captureId,
            history.docs.map(row => ({ id: row.id, data: row.data() })))) throw new Error("inference_programme_history_changed");
        }
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

/** Read/validate before any retry writes. Only a full-reserve unknown disposition is prepared. */
export async function prepareAssessmentRecovery(tx: Transaction, input: {
  requestId: string; jobId: string; captureId: string; previousRunId: string; previousClaimId: string | null; newRunId: string; retryIdentity: string;
  sourceKey: string; contextDigest: string; request: Record<string, any>; brief: Record<string, any> | null;
}) {
  const budgetRef = db!.collection("captureCoverageReviews").doc(`budget-${humanDecisionDigest({ capture_id: input.captureId })}`);
  const programmeId = inferenceProgrammeId(input.request);
  const programmeRef = db!.collection("inferencePrograms").doc(programmeId);
  const [budgetSnap, programmeSnap, runSnap] = await Promise.all([tx.get(budgetRef), tx.get(programmeRef),
    tx.get(db!.collection("agentRuns").doc(input.previousRunId))]);
  const state = budgetSnap.data(), programme = validateInferenceProgramme(programmeSnap.data());
  const run: any = await hydrateAgentEvidence(runSnap.data() ?? {}, { collection: "agentRuns", id: input.previousRunId });
  const bound = run.artifacts?.source_admission, intent = run.artifacts?.capture_inference_reservations?.at(-1);
  const slot = programme.slots.find(row => row.admission_token === state?.pending_token);
  if (!state || state.schema_version !== "capture_coverage_inference_budget.v1" || state.capture_id !== input.captureId || state.inference_program_id !== programmeId
    || state.inference_programme_authority_digest !== inferenceProgrammeAuthorityDigest(programme)
    || state.last_assessment_run_id !== input.previousRunId || !state.pending_token
    || !Number.isFinite(state.exposure_usd) || state.exposure_usd <= 0 || !Number.isSafeInteger(state.calls) || state.calls < 1
    || state.cap_usd !== new SiteAssessmentBudget().cap || state.exposure_usd > state.cap_usd
    || programme.request_id !== input.requestId || programme.capture_id !== input.captureId
    || programme.context_digest !== inferenceProgrammeContextDigest(input.request, input.brief)
    || programme.producer_source_digest !== humanDecisionDigest(input.request.capture_privacy_source_bound_decision?.producer_source)
    || run.status !== "failed" || run.task_kind !== "site_assessment" || run.metadata?.capture_id !== input.captureId
    || run.metadata?.advisory_job_id !== input.jobId || run.input?.input?.context?.request_id !== input.requestId
    || !input.previousClaimId || run.input?.input?.context?.advisory_job_id !== input.jobId
    || run.input?.input?.context?.advisory_claim_id !== input.previousClaimId
    || bound?.request_id !== input.requestId || bound?.capture_id !== input.captureId || bound?.advisory_job_id !== input.jobId
    || bound?.source_key !== input.sourceKey || bound?.context_digest !== input.contextDigest || bound?.video_sha256 !== programme.video_sha256
    || programme.slots.filter(row => row.admission_token === state?.pending_token).length !== 1
    || slot?.state !== "admitted" || slot.run_id !== input.previousRunId || !slot.admission_token
    || intent?.provider !== slot.provider || Math.ceil(intent?.reserved_usd * 1e6) !== slot.reserved_call_micro_usd
    || intent?.capture_exposure_usd !== state.exposure_usd || intent?.cap_usd !== state.cap_usd
    || !Number.isSafeInteger(slot.reserved_call_micro_usd) || slot.reserved_call_micro_usd! <= 0 || slot.reserved_call_micro_usd! > slot.reserved_micro_usd
    || !Array.isArray(state.inference_programme_eligible_slot_ids) || !Array.isArray(state.inference_programme_admitted_slot_ids)
    || new Set(state.inference_programme_eligible_slot_ids).size !== state.inference_programme_eligible_slot_ids.length
    || new Set(state.inference_programme_admitted_slot_ids).size !== state.inference_programme_admitted_slot_ids.length
    || state.inference_programme_eligible_slot_ids.some((id: unknown) => typeof id !== "string" || !programme.slots.some(row => row.id === id))
    || state.inference_programme_admitted_slot_ids.some((id: unknown) => !state.inference_programme_eligible_slot_ids.includes(id))
    || !state.inference_programme_admitted_slot_ids.includes(slot.id)) throw new Error("advisory_retry_unavailable");
  assertInferenceProgrammeClock(programme, state);
  const history = validatedAssessmentRecoveries(state, programme);
  await assertReconciledRunHistory(tx, input.captureId, input.previousRunId, input.requestId, state, programme);
  if (programme.capture_history_reconciliation) {
    const rows = await tx.get(db!.collection("captureCoverageReviews").where("captureId", "==", input.captureId).limit(100));
    if (!acceptsReconciledCaptureHistory(programme, input.requestId, input.captureId,
      rows.docs.map(row => ({ id: row.id, data: row.data() })))) throw new Error("advisory_retry_unavailable");
  }
  const budget = new SiteAssessmentBudget(state.exposure_usd); budget.authorize("openai", "gpt-6.1-sol", {});
  const sol = Math.ceil(budget.calls[0].reserved_usd * 1e6);
  const gemBudget = new SiteAssessmentBudget(); gemBudget.authorize("gemini", "gemini-3.8-flash");
  const gem = Math.ceil(gemBudget.calls[0].reserved_usd * 1e6);
  const held = programme.slots.filter(row => row.state === "held" && state.inference_programme_eligible_slot_ids.includes(row.id)
    && !state.inference_programme_admitted_slot_ids.includes(row.id));
  if (held.filter(row => row.provider === "openai" && row.model === "gpt-6.1-sol" && row.reserved_micro_usd >= sol).length < 2
    || !held.some(row => row.provider === "gemini" && row.model === "gemini-3.8-flash" && row.reserved_micro_usd >= gem)
    || state.exposure_usd + (sol * 2 + gem) / 1e6 > state.cap_usd) throw new Error("advisory_retry_unavailable");
  const content = { schema_version: "site_assessment_recovery.v1" as const, retry_identity: input.retryIdentity, job_id: input.jobId,
    request_id: input.requestId, capture_id: input.captureId, previous_run_id: input.previousRunId, previous_claim_id: input.previousClaimId!, new_run_id: input.newRunId,
    source_key: input.sourceKey, source_digest: programme.producer_source_digest!, context_digest: programme.context_digest,
    advisory_context_digest: input.contextDigest, video_sha256: programme.video_sha256, programme_id: programmeId,
    authority_digest: state.inference_programme_authority_digest, slot_id: slot.id, admission_token: slot.admission_token,
    provider: slot.provider, model: slot.model, reserved_micro_usd: slot.reserved_micro_usd,
    reserved_call_micro_usd: slot.reserved_call_micro_usd!, capture_calls: state.calls,
    capture_exposure_usd: state.exposure_usd, created_at_ms: Date.now() };
  const receipt: AssessmentRecovery = { ...content, receipt_sha256: humanDecisionDigest(content) };
  return { receipt, budgetRef, programmeRef, budgetUpdate: { pending_token: null, assessment_recoveries: [...history, receipt] },
    programmeUpdate: { slots: programme.slots.map(row => row.id === slot.id ? { ...row, state: "unknown" } : row) } };
}

/** Identity replay remains a fresh authority read, never a cached access grant. */
export async function assertAssessmentRecoveryReplay(tx: Transaction, input: { requestId: string; captureId: string;
  jobId: string; runId: string; sourceKey: string; contextDigest: string; request: Record<string, any>; brief: Record<string, any> | null;
  receipt: AssessmentRecovery }) {
  const [budgetSnap, programmeSnap] = await Promise.all([
    tx.get(db!.collection("captureCoverageReviews").doc(`budget-${humanDecisionDigest({ capture_id: input.captureId })}`)),
    tx.get(db!.collection("inferencePrograms").doc(inferenceProgrammeId(input.request))),
  ]);
  const state = budgetSnap.data(), programme = validateInferenceProgramme(programmeSnap.data());
  if (programme.request_id !== input.requestId || programme.capture_id !== input.captureId
    || programme.context_digest !== inferenceProgrammeContextDigest(input.request, input.brief)
    || programme.producer_source_digest !== humanDecisionDigest(input.request.capture_privacy_source_bound_decision?.producer_source)
    || !validatedAssessmentRecoveries(state, programme).some(row => row.receipt_sha256 === input.receipt.receipt_sha256
      && row.job_id === input.jobId && row.new_run_id === input.runId && row.source_key === input.sourceKey
      && row.advisory_context_digest === input.contextDigest)) throw new Error("advisory_retry_unavailable");
  assertInferenceProgrammeClock(programme, state);
  await assertReconciledRunHistory(tx, input.captureId, input.runId, input.requestId, state, programme);
  if (programme.capture_history_reconciliation) {
    const history = await tx.get(db!.collection("captureCoverageReviews").where("captureId", "==", input.captureId).limit(100));
    if (!acceptsReconciledCaptureHistory(programme, input.requestId, input.captureId,
      history.docs.map(row => ({ id: row.id, data: row.data() })))) throw new Error("advisory_retry_unavailable");
  }
}

/** Explicit trusted-operator invocation only; no customer endpoint or automatic renewal. */
export async function grantInferenceProgrammeTechnicalContinuation(input: { programmeId: string; expectedAuthorityDigest: string;
  continuationIdentity: string; authorityRef: string; operatorRef: string; effectiveExpiresAtMs: number }) {
  if (!db || !/^[A-Za-z0-9._-]{1,120}$/.test(input.programmeId) || !/^[A-Za-z0-9._-]{1,120}$/.test(input.continuationIdentity)
    || typeof input.operatorRef !== "string" || !input.operatorRef.trim() || input.operatorRef.length > 500)
    throw new Error("inference_programme_continuation_invalid");
  return db.runTransaction(async tx => {
    const ref = db!.collection("inferencePrograms").doc(input.programmeId), programme = validateInferenceProgramme((await tx.get(ref)).data());
    const digest = inferenceProgrammeAuthorityDigest(programme);
    const [budgetSnap, requestSnap, briefSnap] = await Promise.all([
      tx.get(db!.collection("captureCoverageReviews").doc(`budget-${humanDecisionDigest({ capture_id: programme.capture_id })}`)),
      tx.get(db!.collection("inboundRequests").doc(programme.request_id)), tx.get(db!.collection("siteTaskBriefs").doc(programme.request_id))]);
    const state = budgetSnap.data(), request = requestSnap.data();
    if (digest !== input.expectedAuthorityDigest || input.authorityRef !== programme.authority_ref
      || !state || state.inference_program_id !== input.programmeId || state.inference_programme_authority_digest !== digest
      || state.capture_id !== programme.capture_id || request?.inference_program_id !== input.programmeId
      || !projectWebsiteCaptureRights(request).derived_scene_generation_allowed
      || request?.capture_privacy_source_bound_decision?.proceeded !== true
      || request.capture_privacy_source_bound_decision.capture_id !== programme.capture_id
      || programme.context_digest !== inferenceProgrammeContextDigest(request!, briefSnap.data() ?? null)
      || programme.producer_source_digest !== humanDecisionDigest(request?.capture_privacy_source_bound_decision?.producer_source)
      || !Number.isSafeInteger(state.calls) || state.calls < 1 || !Number.isFinite(state.exposure_usd) || state.exposure_usd <= 0
      || state.cap_usd !== new SiteAssessmentBudget().cap || state.exposure_usd > state.cap_usd)
      throw new Error("inference_programme_continuation_invalid");
    if (programme.technical_continuations !== undefined) {
      assertInferenceProgrammeClock(programme, state);
      const prior = programme.technical_continuations[0];
      if (prior.identity !== input.continuationIdentity || prior.operator_ref !== input.operatorRef
        || prior.effective_expires_at_ms !== input.effectiveExpiresAtMs) throw new Error("inference_programme_continuation_invalid");
      return prior;
    }
    const now = Date.now();
    if (!Number.isSafeInteger(input.effectiveExpiresAtMs) || input.effectiveExpiresAtMs <= Math.max(now, programme.expires_at_ms)
      || input.effectiveExpiresAtMs - now > INFERENCE_TECHNICAL_WINDOW_MS) throw new Error("inference_programme_continuation_invalid");
    const eligible = state.inference_programme_eligible_slot_ids, admitted = state.inference_programme_admitted_slot_ids;
    if (!Array.isArray(eligible) || !Array.isArray(admitted) || new Set(eligible).size !== eligible.length || new Set(admitted).size !== admitted.length
      || eligible.some(id => !programme.slots.some(slot => slot.id === id)) || admitted.some(id => !eligible.includes(id)))
      throw new Error("inference_programme_continuation_invalid");
    validatedAssessmentRecoveries(state, programme);
    if (programme.capture_history_reconciliation || state.assessment_recoveries) {
      if (typeof state.last_assessment_run_id !== "string") throw new Error("inference_programme_continuation_invalid");
      await assertReconciledRunHistory(tx, programme.capture_id, state.last_assessment_run_id, programme.request_id, state, programme);
    }
    if (programme.capture_history_reconciliation) {
      const history = await tx.get(db!.collection("captureCoverageReviews").where("captureId", "==", programme.capture_id).limit(100));
      if (!acceptsReconciledCaptureHistory(programme, programme.request_id, programme.capture_id,
        history.docs.map(row => ({ id: row.id, data: row.data() })))) throw new Error("inference_programme_continuation_invalid");
    }
    const content = { schema_version: "inference_programme_technical_continuation.v1", identity: input.continuationIdentity,
      operator_ref: input.operatorRef, authority_ref: input.authorityRef, programme_id: input.programmeId,
      original_authority_digest: digest, original_expires_at_ms: programme.expires_at_ms,
      request_id: programme.request_id, capture_id: programme.capture_id, context_digest: programme.context_digest,
      video_sha256: programme.video_sha256, source_digest: programme.producer_source_digest, ledger_sha256: programme.ledger_sha256,
      cap_micro_usd: programme.cap_micro_usd, granted_at_ms: now, effective_expires_at_ms: input.effectiveExpiresAtMs,
      remaining_slot_ids: programme.slots.filter(slot => slot.state === "held" && eligible.includes(slot.id) && !admitted.includes(slot.id)).map(slot => slot.id).sort(),
      slot_snapshot: programme.slots.map(slot => ({ id: slot.id, state: slot.state, admission_token: slot.admission_token ?? null,
        run_id: slot.run_id ?? null, reserved_call_micro_usd: slot.reserved_call_micro_usd ?? null })),
      capture_snapshot: { calls: state.calls, exposure_usd: state.exposure_usd, cap_usd: state.cap_usd,
        eligible_slot_ids: eligible, admitted_slot_ids: admitted, recovery_digests: (state.assessment_recoveries ?? []).map((row: AssessmentRecovery) => row.receipt_sha256) } };
    const receipt = { ...content, receipt_sha256: humanDecisionDigest(content) };
    assertInferenceProgrammeClock({ ...programme, technical_continuations: [receipt] }, state);
    tx.set(ref, { technical_continuations: [receipt] }, { merge: true });
    return receipt;
  });
}
