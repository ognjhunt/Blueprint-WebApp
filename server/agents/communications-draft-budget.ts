import { communicationsDigest, COMMUNICATIONS_MODEL } from "./communications-contract";
import { firstContactCalendarDay, FIRST_CONTACT_POLICY } from "./communications-first-contact";
import { COMMUNICATIONS_ROOT, COMMUNICATIONS_JOB_STATES } from "./communications-store";
import type { CommunicationsAgentsAPI, CommunicationsCheckpoint } from "./communications-api";

export const COMMUNICATIONS_DRAFT_BUDGET = Object.freeze({
  version: "blueprint.communications-draft-soft-budget.v1", model: COMMUNICATIONS_MODEL,
  serviceTier: "default", timezone: "America/Chicago",
  maxDailyAdmissions: FIRST_CONTACT_POLICY.maxDailyAttempts,
  rateDate: "2026-10-01", rateSource: "https://developers.openai.com/api/docs/models/gpt-6-luna",
  // Conservatively count uncached input plus cache-write pricing and a 10%
  // regional premium. This is a soft estimate, never an invoice or hard cap.
  inputUsdPerMillion: 0.2475, outputUsdPerMillion: 0.55,
});
export class CommunicationsDraftBudgetError extends Error {
  constructor(readonly code: string) { super(code); }
}

/** The owner-approved target is private server configuration, with no public
 * numeric default. Missing/invalid configuration cannot authorize spending. */
export function configuredCommunicationsDraftBudget(env = process.env) {
  const value = env.BLUEPRINT_COMMUNICATIONS_DRAFT_SOFT_TARGET_USD ?? "";
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(value)) throw new CommunicationsDraftBudgetError("communications_draft_target_not_configured");
  const softTargetUsd = Number(value), micros = Math.round(softTargetUsd * 1000000);
  if (!Number.isSafeInteger(micros) || micros <= 0) throw new CommunicationsDraftBudgetError("communications_draft_target_not_configured");
  return Object.freeze({ ...COMMUNICATIONS_DRAFT_BUDGET, softTargetUsd });
}

export function estimatedDraftMicros(usage: any): number | null {
  if (!usage || ![usage.input_tokens, usage.output_tokens, usage.total_tokens].every(Number.isSafeInteger)
    || usage.input_tokens < 0 || usage.output_tokens < 0 || usage.total_tokens !== usage.input_tokens + usage.output_tokens
    || (usage.input_tokens_details?.cached_tokens !== undefined && (!Number.isSafeInteger(usage.input_tokens_details.cached_tokens)
      || usage.input_tokens_details.cached_tokens < 0 || usage.input_tokens_details.cached_tokens > usage.input_tokens))
    || (usage.output_tokens_details?.reasoning_tokens !== undefined && (!Number.isSafeInteger(usage.output_tokens_details.reasoning_tokens)
      || usage.output_tokens_details.reasoning_tokens < 0 || usage.output_tokens_details.reasoning_tokens > usage.output_tokens))) return null;
  const micros = Math.ceil(usage.input_tokens * COMMUNICATIONS_DRAFT_BUDGET.inputUsdPerMillion
    + usage.output_tokens * COMMUNICATIONS_DRAFT_BUDGET.outputUsdPerMillion);
  return Number.isSafeInteger(micros) && micros >= 0 ? micros : null;
}

/** Serialize fresh paid admissions before POST. An unresolved earlier cost is
 * retained across day changes and blocks other jobs, rather than meaning zero. */
export async function reserveCommunicationsDraft(db: FirebaseFirestore.Firestore, jobId: string, requestDigest: string, now: number) {
  const policy = configuredCommunicationsDraftBudget();
  const root = db.doc(COMMUNICATIONS_ROOT), id = communicationsDigest({ jobId }), day = firstContactCalendarDay(now);
  const ref = root.collection("draftBudgetAdmissions").doc(id), stateRef = root.collection("draftBudgetState").doc("current");
  const dayRef = root.collection("draftBudgetDays").doc(day);
  return db.runTransaction(async tx => {
    const [existing, state, daily] = await Promise.all([tx.get(ref), tx.get(stateRef), tx.get(dayRef)]);
    const row = existing.data(), active = state.data()?.activeAdmissionId;
    if (existing.exists) {
      if (row?.jobId !== jobId || row.requestDigest !== requestDigest || row.policyDigest !== communicationsDigest(policy)
        || row.state !== "reserved" || active !== id) throw new CommunicationsDraftBudgetError("communications_draft_reservation_requires_reconciliation");
      return id; // Same proven pre-create reservation; no second admission.
    }
    if (active) throw new CommunicationsDraftBudgetError("communications_draft_cost_unresolved");
    const unresolved = await tx.get(root.collection("draftBudgetAdmissions").where("state", "in", ["reserved", "usage_unknown"]).limit(1));
    if (!unresolved.empty) throw new CommunicationsDraftBudgetError("communications_draft_cost_unresolved");
    const admissions = daily.data()?.admissions ?? 0, cost = daily.data()?.estimatedModelMicros ?? 0;
    if (!Number.isSafeInteger(admissions) || admissions < 0 || !Number.isSafeInteger(cost) || cost < 0) throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
    if (admissions >= COMMUNICATIONS_DRAFT_BUDGET.maxDailyAdmissions) throw new CommunicationsDraftBudgetError("communications_draft_daily_admission_limit");
    if (cost >= policy.softTargetUsd * 1000000) throw new CommunicationsDraftBudgetError("communications_draft_soft_target_reached");
    tx.create(ref, { version: "blueprint.communications-draft-admission.v1", jobId, requestDigest, day,
      timezone: COMMUNICATIONS_DRAFT_BUDGET.timezone, policy,
      policyDigest: communicationsDigest(policy), state: "reserved", admittedAt: new Date(now).toISOString() });
    tx.set(stateRef, { activeAdmissionId: id });
    tx.set(dayRef, { day, timezone: COMMUNICATIONS_DRAFT_BUDGET.timezone, admissions: admissions + 1,
      estimatedModelMicros: cost, softTargetUsd: policy.softTargetUsd, updatedAt: new Date(now).toISOString() });
    return id;
  });
}

export type CommunicationsRejectedCreateDraftBudgetClaim = {
  jobId: string; originalRequestDigest: string; originalCheckpointDigest: string;
  correctedRequestDigest: string; recoveryDigest: string; ownerDirectionRef: string;
  negativeCoverageDigest: string; originalCreateClaimedAt: string; correctedCreateClaimedAt: string; deadlineMs: number;
};

/** Transaction participant for the trusted same-job rejected-create claim.
 * The caller verifies owner direction, job/context and complete provider absence
 * before entering this transaction. No model-supplied proof grants admission. */
export async function claimCommunicationsRejectedCreateDraftBudget(db: FirebaseFirestore.Firestore,
  tx: FirebaseFirestore.Transaction, input: CommunicationsRejectedCreateDraftBudgetClaim, now: number) {
  const policy = configuredCommunicationsDraftBudget(), start = Date.parse(input.correctedCreateClaimedAt);
  if (!input.jobId || !input.ownerDirectionRef.trim()
    || [input.originalRequestDigest, input.originalCheckpointDigest, input.correctedRequestDigest,
      input.recoveryDigest, input.negativeCoverageDigest].some(value => !/^[a-f0-9]{64}$/.test(value))
    || !Number.isFinite(Date.parse(input.originalCreateClaimedAt)) || !Number.isFinite(start)
    || !Number.isSafeInteger(input.deadlineMs) || input.deadlineMs !== start + 180000 || start > now || now >= input.deadlineMs) {
    throw new CommunicationsDraftBudgetError("communications_rejected_create_budget_binding_invalid");
  }
  const root = db.doc(COMMUNICATIONS_ROOT), id = communicationsDigest({ jobId: input.jobId });
  const ref = root.collection("draftBudgetAdmissions").doc(id), stateRef = root.collection("draftBudgetState").doc("current");
  const day = firstContactCalendarDay(now), dayRef = root.collection("draftBudgetDays").doc(day);
  const [saved, state, daily] = await Promise.all([tx.get(ref), tx.get(stateRef), tx.get(dayRef)]);
  const row = saved.data(), claimDigest = communicationsDigest(input);
  if (!row || row.jobId !== input.jobId || row.requestDigest !== input.originalRequestDigest
    || !row.policy || communicationsDigest(row.policy) !== row.policyDigest || row.policyDigest !== communicationsDigest(policy)
    || !["reserved", "usage_unknown"].includes(row.state) || state.data()?.activeAdmissionId !== id) {
    throw new CommunicationsDraftBudgetError("communications_rejected_create_budget_binding_changed");
  }
  if (row.correctedCreate) {
    if (row.correctedCreate.claimDigest !== claimDigest) throw new CommunicationsDraftBudgetError("communications_rejected_create_budget_already_claimed");
    return { admissionId: id }; // Transaction replay only; it never authorizes another POST.
  }
  const unresolved = await tx.get(root.collection("draftBudgetAdmissions").where("state", "in", ["reserved", "usage_unknown"]).limit(2));
  if (unresolved.docs.some(doc => doc.id !== id)) throw new CommunicationsDraftBudgetError("communications_draft_cost_unresolved");
  const admissions = daily.data()?.admissions ?? 0, cost = daily.data()?.estimatedModelMicros ?? 0;
  if (!Number.isSafeInteger(admissions) || admissions < 0 || !Number.isSafeInteger(cost) || cost < 0) {
    throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
  }
  if (admissions >= COMMUNICATIONS_DRAFT_BUDGET.maxDailyAdmissions) throw new CommunicationsDraftBudgetError("communications_draft_daily_admission_limit");
  if (cost >= policy.softTargetUsd * 1000000) throw new CommunicationsDraftBudgetError("communications_draft_soft_target_reached");
  tx.update(ref, { state: "usage_unknown", usageState: "unresolved", originalUsageState: "unresolved",
    correctedCreate: { version: "blueprint.communications-rejected-create-admission.v1", ...input,
      requestDigest: input.correctedRequestDigest, claimDigest, day, policy, policyDigest: communicationsDigest(policy),
      state: "reserved", usageState: "unresolved", admittedAt: new Date(now).toISOString() } });
  tx.set(dayRef, { day, timezone: policy.timezone, admissions: admissions + 1,
    estimatedModelMicros: cost, softTargetUsd: policy.softTargetUsd, updatedAt: new Date(now).toISOString() });
  return { admissionId: id };
}

/** Only the verified saved root turn supplies usage. Missing or inconsistent
 * accounting holds the admission; a visible draft does not prove its cost. */
export async function recordCommunicationsDraftUsage(db: FirebaseFirestore.Firestore, jobId: string, requestDigest: string, usage: unknown, now: number) {
  const root = db.doc(COMMUNICATIONS_ROOT), id = communicationsDigest({ jobId }), ref = root.collection("draftBudgetAdmissions").doc(id);
  const stateRef = root.collection("draftBudgetState").doc("current");
  return db.runTransaction(async tx => {
    const [saved, state] = await Promise.all([tx.get(ref), tx.get(stateRef)]), row = saved.data();
    if (!saved.exists || row?.jobId !== jobId) throw new CommunicationsDraftBudgetError("communications_draft_usage_binding_changed");
    if (row.correctedCreate?.requestDigest === requestDigest) return writeCorrectedDraftUsage(tx, root, ref, stateRef, id, row, state.data(), usage, now);
    if (row.requestDigest !== requestDigest) throw new CommunicationsDraftBudgetError("communications_draft_usage_binding_changed");
    return writeDraftUsage(tx, root, ref, stateRef, id, row, state.data(), usage, now);
  });
}

/** Shared accounting transaction: monotonic best-effort usage, never a refund
 * or a zero-cost inference from a missing provider response. Reads precede writes. */
async function writeDraftUsage(tx: FirebaseFirestore.Transaction, root: FirebaseFirestore.DocumentReference,
  ref: FirebaseFirestore.DocumentReference, stateRef: FirebaseFirestore.DocumentReference,
  id: string, row: any, state: any, usage: unknown, now: number) {
  const dayRef = root.collection("draftBudgetDays").doc(row.day), daily = (await tx.get(dayRef)).data();
  if (!daily || !Number.isSafeInteger(daily.estimatedModelMicros) || daily.estimatedModelMicros < 0) {
    throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
  }
  const estimate = estimatedDraftMicros(usage);
  if (estimate === null) { tx.update(ref, { state: "usage_unknown", usageState: "unresolved", checkedAt: new Date(now).toISOString() }); return false; }
  const previous = row.estimatedModelMicros ?? 0, retained = Math.max(previous, estimate);
  const total = daily.estimatedModelMicros + retained - previous;
  if (!Number.isSafeInteger(previous) || previous < 0 || daily.estimatedModelMicros < previous || !Number.isSafeInteger(total) || total < 0) {
    throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
  }
  const correctionUnknown = row.correctedCreate && row.correctedCreate.state !== "usage_recorded";
  tx.update(ref, { state: correctionUnknown ? "usage_unknown" : "usage_recorded", usage, estimatedModelMicros: retained,
    usageState: correctionUnknown ? "unresolved" : "best_effort_not_invoice", checkedAt: new Date(now).toISOString(),
    ...(row.correctedCreate ? { originalUsageState: "best_effort_not_invoice",
      knownTotalModelMicros: retained + (row.correctedCreate.estimatedModelMicros ?? 0),
      knownTotalIsComplete: !correctionUnknown } : {}) });
  tx.set(dayRef, { estimatedModelMicros: total, updatedAt: new Date(now).toISOString() }, { merge: true });
  if (!correctionUnknown && state?.activeAdmissionId === id) tx.set(stateRef, { activeAdmissionId: null });
  return !correctionUnknown;
}

async function writeCorrectedDraftUsage(tx: FirebaseFirestore.Transaction, root: FirebaseFirestore.DocumentReference,
  ref: FirebaseFirestore.DocumentReference, stateRef: FirebaseFirestore.DocumentReference, id: string,
  row: any, state: any, usage: unknown, now: number) {
  const correction = row.correctedCreate, dayRef = root.collection("draftBudgetDays").doc(correction.day);
  const daily = (await tx.get(dayRef)).data();
  if (!daily || !Number.isSafeInteger(daily.estimatedModelMicros) || daily.estimatedModelMicros < 0
    || !correction.claimDigest || !correction.policy || communicationsDigest(correction.policy) !== correction.policyDigest) {
    throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
  }
  const estimate = estimatedDraftMicros(usage);
  if (estimate === null) {
    tx.update(ref, { state: "usage_unknown", usageState: "unresolved", correctedCreate: { ...correction,
      state: "usage_unknown", usageState: "unresolved", checkedAt: new Date(now).toISOString() } });
    return false;
  }
  const previous = correction.estimatedModelMicros ?? 0, retained = Math.max(previous, estimate);
  const total = daily.estimatedModelMicros + retained - previous, originalKnown = row.estimatedModelMicros ?? 0;
  if (!Number.isSafeInteger(previous) || previous < 0 || daily.estimatedModelMicros < previous
    || !Number.isSafeInteger(total) || total < 0 || !Number.isSafeInteger(originalKnown) || originalKnown < 0
    || !Number.isSafeInteger(originalKnown + retained)) throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
  // A corrected session's usage says nothing about the rejected original create.
  const originalResolved = row.originalUsageState === "best_effort_not_invoice";
  tx.update(ref, { state: originalResolved ? "usage_recorded" : "usage_unknown",
    usageState: originalResolved ? "best_effort_not_invoice" : "unresolved", knownTotalModelMicros: originalKnown + retained,
    knownTotalIsComplete: originalResolved, correctedCreate: { ...correction, state: "usage_recorded", usage,
      estimatedModelMicros: retained, usageState: "best_effort_not_invoice", checkedAt: new Date(now).toISOString() } });
  tx.set(dayRef, { estimatedModelMicros: total, updatedAt: new Date(now).toISOString() }, { merge: true });
  if (originalResolved && state?.activeAdmissionId === id) tx.set(stateRef, { activeAdmissionId: null });
  return originalResolved; // Without verified original usage the existing active hold remains.
}

export type CommunicationsDraftSessionRecovery = {
  jobId: string; prospectId: string; briefDigest: string; expectedCheckpointDigest: string;
  sessionId: string; requestedBy: string;
};

/** Resolve a claimed unknown create by verifying an existing session, never
 * by repeating POST or declaring a missing session absent. This action only
 * binds the checkpoint and accounts for usage; retry/approval/send stay separate. */
export async function reconcileCommunicationsDraftSession(db: FirebaseFirestore.Firestore,
  api: Pick<CommunicationsAgentsAPI, "verifyExistingDraftSession">, input: CommunicationsDraftSessionRecovery, now: number) {
  if (!input.requestedBy.trim() || !/^[a-f0-9]{64}$/.test(input.expectedCheckpointDigest)
    || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(input.sessionId)) throw new CommunicationsDraftBudgetError("communications_draft_recovery_invalid");
  const root = db.doc(COMMUNICATIONS_ROOT), id = communicationsDigest({ jobId: input.jobId });
  const ref = root.collection("draftBudgetAdmissions").doc(id), jobRef = root.collection("jobs").doc(input.jobId);
  const stateRef = root.collection("draftBudgetState").doc("current");
  const validate = (row: any, job: any, state: any) => {
    // This legacy route can bind only the original attempt. A corrected child
    // must never be projected into its immutable original checkpoint/usage.
    if (row?.correctedCreate || job?.checkpoint?.rejectedCreateRecovery) {
      throw new CommunicationsDraftBudgetError("communications_corrected_create_session_recovery_requires_child");
    }
    if (!row || row.jobId !== input.jobId || !/^[a-f0-9]{64}$/.test(row.requestDigest ?? "")
      || !row.policy || communicationsDigest(row.policy) !== row.policyDigest || !job
      || job.jobId !== input.jobId || job.prospectId !== input.prospectId || job.briefDigest !== input.briefDigest
      || !COMMUNICATIONS_JOB_STATES.includes(job.state) || !Number.isSafeInteger(job.lease?.until ?? 0)
      || (job.lease?.until ?? 0) < 0 || (job.lease?.until ?? 0) > now || !job.checkpoint?.createClaimedAt
      || !Number.isFinite(Date.parse(job.checkpoint.createClaimedAt))
      || (job.checkpoint.sessionId && job.checkpoint.sessionId !== input.sessionId)
      || (job.checkpoint.requestDigest && job.checkpoint.requestDigest !== row.requestDigest)) {
      throw new CommunicationsDraftBudgetError("communications_draft_recovery_binding_changed");
    }
    const checkpointDigest = communicationsDigest(job.checkpoint);
    // An interrupted response or concurrent identical action cannot charge twice
    // or clear a later active admission. Only the saved verified receipt is reused.
    if (checkpointDigest !== input.expectedCheckpointDigest && row.sessionRecovery?.expectedCheckpointDigest === input.expectedCheckpointDigest
      && row.sessionRecovery?.sessionId === input.sessionId && row.sessionRecovery?.requestDigest === row.requestDigest
      && job.checkpoint.sessionId === input.sessionId && job.checkpoint.requestDigest === row.requestDigest
      && ["usage_recorded", "usage_unknown"].includes(row.state)) return true;
    if (checkpointDigest !== input.expectedCheckpointDigest || !["reserved", "usage_unknown"].includes(row.state)
      || state?.activeAdmissionId !== id) throw new CommunicationsDraftBudgetError("communications_draft_recovery_binding_changed");
    return false;
  };
  const [saved, savedJob, savedState] = await Promise.all([ref.get(), jobRef.get(), stateRef.get()]);
  const row = saved.data(), job = savedJob.data();
  const response = (state: string) => ({ state, sessionRecovered: true, costResolved: state === "usage_recorded" });
  if (validate(row, job, savedState.data())) return response(row!.state);
  const checkpoint: CommunicationsCheckpoint = { ...job!.checkpoint, sessionId: input.sessionId, requestDigest: row!.requestDigest };
  const proof = await api.verifyExistingDraftSession(checkpoint, input.jobId, row!.requestDigest);
  if (proof.sessionId !== input.sessionId || proof.requestDigest !== row!.requestDigest
    || (job!.checkpoint.turnId && job!.checkpoint.turnId !== proof.turnId)) throw new CommunicationsDraftBudgetError("communications_draft_recovery_binding_changed");
  return db.runTransaction(async tx => {
    const [current, currentJob, currentState] = await Promise.all([tx.get(ref), tx.get(jobRef), tx.get(stateRef)]);
    const currentRow = current.data(), currentJobRow = currentJob.data();
    if (validate(currentRow, currentJobRow, currentState.data())) return response(currentRow!.state);
    if (currentRow!.requestDigest !== row!.requestDigest || currentRow!.policyDigest !== row!.policyDigest
      || currentRow!.day !== row!.day || currentRow!.admittedAt !== row!.admittedAt || currentJobRow!.state !== job!.state
      || communicationsDigest(currentJobRow!.lease ?? null) !== communicationsDigest(job!.lease ?? null)) {
      throw new CommunicationsDraftBudgetError("communications_draft_recovery_binding_changed");
    }
    const resolved = await writeDraftUsage(tx, root, ref, stateRef, id, currentRow, currentState.data(), proof.usage, now);
    const sessionRecovery = { version: "blueprint.communications-draft-session-recovery.v1", sessionId: input.sessionId,
      requestDigest: row!.requestDigest, expectedCheckpointDigest: input.expectedCheckpointDigest,
      requestedBy: input.requestedBy, reconciledAt: new Date(now).toISOString() };
    tx.update(ref, { sessionRecovery });
    tx.update(jobRef, { checkpoint: { ...currentJobRow!.checkpoint, sessionId: input.sessionId,
      requestDigest: row!.requestDigest, turnId: proof.turnId }, draftSessionRecovery: sessionRecovery,
      ...(currentJobRow!.state === "running" ? { state: "blocked", reason: "communications_session_reconciled_requires_operator_retry" } : {}), updatedAt: now });
    return response(resolved ? "usage_recorded" : "usage_unknown");
  });
}

/** One pending root turn, GET reconciliation only. No new session or input. */
export async function reconcileCommunicationsDraftCost(db: FirebaseFirestore.Firestore,
  api: { reconcileUsage: (checkpoint: any, jobId: string) => Promise<unknown> }, now: number) {
  const root = db.doc(COMMUNICATIONS_ROOT), unresolved = await root.collection("draftBudgetAdmissions").where("state", "in", ["reserved", "usage_unknown"]).limit(1).get();
  if (unresolved.empty) return;
  const row = unresolved.docs[0].data();
  if (!row?.jobId || !row.requestDigest) throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
  const job = (await root.collection("jobs").doc(row.jobId).get()).data();
  if (row.correctedCreate) {
    const checkpoint = job?.checkpoint, recovery = checkpoint?.rejectedCreateRecovery, child = recovery?.checkpoint;
    if (!checkpoint || !child?.sessionId) return;
    if (checkpoint.requestDigest !== row.requestDigest || recovery.originalRequestDigest !== row.requestDigest
      || recovery.correctedRequestDigest !== row.correctedCreate.requestDigest || child.requestDigest !== row.correctedCreate.requestDigest) {
      throw new CommunicationsDraftBudgetError("communications_draft_usage_binding_changed");
    }
    const usage = await api.reconcileUsage(checkpoint, row.jobId);
    await recordCommunicationsDraftUsage(db, row.jobId, row.correctedCreate.requestDigest, usage, now);
    return;
  }
  if (!job?.checkpoint?.sessionId) return;
  if (job.checkpoint.requestDigest && job.checkpoint.requestDigest !== row.requestDigest) {
    throw new CommunicationsDraftBudgetError("communications_draft_usage_binding_changed");
  }
  const usage = await api.reconcileUsage(job.checkpoint, row.jobId);
  await recordCommunicationsDraftUsage(db, row.jobId, row.requestDigest, usage, now);
}
