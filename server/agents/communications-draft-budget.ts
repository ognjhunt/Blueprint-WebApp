import { communicationsDigest, COMMUNICATIONS_MODEL } from "./communications-contract";
import { firstContactCalendarDay, FIRST_CONTACT_POLICY } from "./communications-first-contact";
import { COMMUNICATIONS_ROOT } from "./communications-store";

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

/** Only the verified saved root turn supplies usage. Missing or inconsistent
 * accounting holds the admission; a visible draft does not prove its cost. */
export async function recordCommunicationsDraftUsage(db: FirebaseFirestore.Firestore, jobId: string, requestDigest: string, usage: unknown, now: number) {
  const root = db.doc(COMMUNICATIONS_ROOT), id = communicationsDigest({ jobId }), ref = root.collection("draftBudgetAdmissions").doc(id);
  const stateRef = root.collection("draftBudgetState").doc("current"), estimate = estimatedDraftMicros(usage);
  return db.runTransaction(async tx => {
    const [saved, state] = await Promise.all([tx.get(ref), tx.get(stateRef)]), row = saved.data();
    if (!saved.exists || row?.jobId !== jobId || row.requestDigest !== requestDigest) throw new CommunicationsDraftBudgetError("communications_draft_usage_binding_changed");
    const dayRef = root.collection("draftBudgetDays").doc(row.day), daily = (await tx.get(dayRef)).data();
    if (!daily || !Number.isSafeInteger(daily.estimatedModelMicros)) throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
    if (estimate === null) { tx.update(ref, { state: "usage_unknown", usageState: "unresolved", checkedAt: new Date(now).toISOString() }); return false; }
    const previous = row.estimatedModelMicros ?? 0, retained = Math.max(previous, estimate);
    if (!Number.isSafeInteger(previous) || previous < 0) throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
    tx.update(ref, { state: "usage_recorded", usage, estimatedModelMicros: retained,
      usageState: "best_effort_not_invoice", checkedAt: new Date(now).toISOString() });
    tx.set(dayRef, { estimatedModelMicros: daily.estimatedModelMicros + retained - previous, updatedAt: new Date(now).toISOString() }, { merge: true });
    if (state.data()?.activeAdmissionId === id) tx.set(stateRef, { activeAdmissionId: null });
    return true;
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
  if (!job?.checkpoint?.sessionId) return;
  const usage = await api.reconcileUsage(job.checkpoint, row.jobId);
  await recordCommunicationsDraftUsage(db, row.jobId, row.requestDigest, usage, now);
}
