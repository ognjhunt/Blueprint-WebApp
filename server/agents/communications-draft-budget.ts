import { createHash } from "node:crypto";
import { resolveBundleStorage } from "../utils/siteCaptureBundleStorage";
import { communicationsDigest, COMMUNICATIONS_MODEL } from "./communications-contract";
import { firstContactCalendarDay } from "./communications-first-contact";
import { COMMUNICATIONS_ROOT, COMMUNICATIONS_JOB_STATES } from "./communications-store";
import type { CommunicationsAgentsAPI, CommunicationsCheckpoint, CommunicationsCancelledContinuation } from "./communications-api";
import { hydrateAgentEvidence } from "./private-evidence";
import { outputTextDigest } from "./communications-output";
import type { CommunicationsJobRecord } from "./communications-store";

/** A fully retained validation rejection establishes no accepted session, not
 * a zero invoice. Retire only its active slot while keeping its whole exposure.
 * The owner regeneration and this classification commit in one transaction. */
export async function prepareRejectedBoundedDraftRegeneration(db: FirebaseFirestore.Firestore,
  tx: FirebaseFirestore.Transaction, parent: CommunicationsJobRecord, replacementJobId: string,
  actorUid: string, now: number) {
  const limit = parent.checkpoint.sessionSpendLimitCents;
  const checkpoint = parent.checkpoint, failure = checkpoint.httpFailure, binding = failure?.binding;
  const fail = () => new CommunicationsDraftBudgetError("communications_rejected_create_reconciliation_required");
  if (parent.state !== "blocked" || parent.reason !== "agents_api_http_400"
    || (parent.lease?.until ?? 0) > now || parent.output || parent.cancelledContinuation
    || checkpoint.rejectedCreateRecovery || !checkpoint.createClaimedAt || checkpoint.sessionId || checkpoint.turnId
    || checkpoint.draftProfile !== "outreach-ready-hypothesis-v1" || checkpoint.sessionSpendLimitCents !== limit
    || !/^[a-f0-9]{64}$/.test(checkpoint.sessionSpendRequestBaseDigest ?? "")
    || checkpoint.requestDigest !== communicationsDigest({ requestBaseDigest: checkpoint.sessionSpendRequestBaseDigest,
      sessionSpendLimitCents: limit })
    || parent.manualDraftRequest?.actorUid !== actorUid || parent.manualDraftRequest.state !== "failed"
    || parent.manualDraftRequest.sessionSpendLimitCents !== limit || !Number.isSafeInteger(limit) || limit === undefined || limit < 1
    || !failure || failure.retention !== "retained" || failure.status !== 400 || failure.method !== "POST"
    || failure.capture !== "complete" || !binding || binding.jobId !== parent.jobId
    || binding.requestDigest !== checkpoint.requestDigest || binding.createClaimedAt !== checkpoint.createClaimedAt
    || binding.sessionId !== null || binding.turnId !== null || !/^[a-f0-9]{64}$/.test(binding.inputDigest ?? "")
    || !checkpoint.httpEvidence) throw fail();
  const hydrated = await hydrateAgentEvidence(checkpoint.httpEvidence, { collection: "agentCheckpoints",
    id: `communications-http:${parent.jobId}:${communicationsDigest(binding)}` });
  const snapshot = hydrated.snapshot as any, response = snapshot?.response;
  if (snapshot?.version !== 1 || communicationsDigest(snapshot.binding) !== communicationsDigest(binding)
    || response?.status !== 400 || response.method !== "POST" || response.path !== "/agents/sessions"
    || response.capture !== "complete" || response.bytes !== failure.bytes || response.bodyDigest !== failure.bodyDigest
    || typeof response.bodyBase64 !== "string" || outputTextDigest(response.bodyBase64) !== failure.bodyDigest
    || Buffer.from(response.bodyBase64, "base64").byteLength !== failure.bytes || !response.requestId) throw fail();
  let error;
  try { error = JSON.parse(Buffer.from(response.bodyBase64, "base64").toString("utf8")).error; } catch { throw fail(); }
  // Deliberately exact: timeout/transport loss, partial capture, 5xx and other
  // 400 errors do not establish this pre-create validation rejection.
  if (error?.type !== "invalid_request_error" || error.code !== "invalid_request_error" || error.param !== "spend_control"
    || error.message !== "Session budget configuration is not enabled") throw fail();
  const root = db.doc(COMMUNICATIONS_ROOT), id = communicationsDigest({ jobId: parent.jobId });
  const ref = root.collection("draftBudgetAdmissions").doc(id), stateRef = root.collection("draftBudgetState").doc("current");
  const [saved, state] = await Promise.all([tx.get(ref), tx.get(stateRef)]), row = saved.data(), control = state.data();
  const reservation = limit * 10000, retained = control?.retainedSessionReservationsMicros;
  if (!row || row.jobId !== parent.jobId || row.requestDigest !== checkpoint.requestDigest || !row.recurringDirection
    || row.sessionSpendLimitCents !== limit || row.sessionReservationMicros !== reservation
    || !Number.isSafeInteger(reservation) || !Number.isSafeInteger(retained) || retained < reservation
    || !row.policy || communicationsDigest(row.policy) !== row.policyDigest || row.correctedCreate || row.sessionRecovery
    || row.rejectedCreateClassification || row.state !== "reserved" || control?.recurringActiveAdmissionId !== id) throw fail();
  const classification = { version: "bounded-create-rejection-v1", replacementJobId, actorUid,
    originalCheckpointDigest: communicationsDigest(checkpoint), requestDigest: checkpoint.requestDigest,
    responseBodyDigest: failure.bodyDigest, providerRequestId: response.requestId,
    classification: "definitive_pre_create_validation_rejection", classifiedAt: new Date(now).toISOString(),
    retainedExposureMicros: reservation, accountingComplete: false, invoiceVerified: false };
  return () => {
    tx.update(ref, { state: "create_rejected", usageState: "unresolved", rejectedCreateClassification: classification });
    tx.set(stateRef, { recurringActiveAdmissionId: null }, { merge: true });
  };
}

export type CommunicationsRecurringBudgetDirection = {
  version: "blueprint.communications-recurring-budget-direction.v1"; owner: "Nijel Hunt"; approvedAt: string; expiresAt: string;
  expiryBasis: "operator_boundary_no_later_than_existing_history_scope";
  direction: { spending: { kind: "direct_current_chat_human_reply"; questionItemId: [string, string, number]; answer: "$10 per day" };
    unattended: { kind: "verified_prior_human_instruction"; text: string; sourceRef: string } };
  allocation: { timezone: "America/Chicago"; maxCombinedDailyUsd: 10; researchReservationUsd: 5; communicationsReservationUsd: 5 };
  scope: { draftOnly: true; sendsAuthorized: false; gmailCopiesAuthorized: false; accessChangesAuthorized: false;
    newDraftSessionsAuthorized: true; recurringWorkersAuthorized: true };
  liability: { admissionId: string; jobId: string; originalRequestDigest: string; originalCheckpointDigest: string;
    originalPolicyDigest: string; reservedExposureUsd: 1 };
};
type DirectionRef = { uri: string; generation: string; sha256: string };

/** Private server root selects an immutable company receipt. Model inputs and
 * the narrower manual-continuation grant cannot activate recurring admission. */
async function recurringBudgetDirection(db: FirebaseFirestore.Firestore, clock: () => number) {
  const ref: DirectionRef | undefined = (await db.doc(COMMUNICATIONS_ROOT).get()).data()?.recurringDraftBudgetDirection;
  if (!ref) return null;
  const storage = resolveBundleStorage(), match = /^gs:\/\/blueprint-8c1ca\.appspot\.com\/(operations\/recovery\/[^\s]+\/agent-e2e-recurring-budget-owner-direction\.json)$/.exec(ref.uri ?? "");
  const fail = () => new CommunicationsDraftBudgetError("communications_recurring_direction_invalid");
  if (!storage || storage.bucketName !== "blueprint-8c1ca.appspot.com" || !match || !/^[0-9]+$/.test(ref.generation)
    || !/^[a-f0-9]{64}$/.test(ref.sha256)) throw fail();
  const info = await storage.info(match[1]);
  if (!info || info.generation !== ref.generation || !Number.isSafeInteger(info.size) || info.size < 1 || info.size > 32000) throw fail();
  const raw = await storage.readText(match[1]), after = await storage.info(match[1]);
  if (raw === null || Buffer.byteLength(raw) !== info.size || after?.generation !== ref.generation
    || createHash("sha256").update(raw).digest("hex") !== ref.sha256) throw fail();
  let a: CommunicationsRecurringBudgetDirection;
  try { a = JSON.parse(raw); } catch { throw fail(); }
  const now = clock();
  const hashes = [a?.liability?.admissionId, a?.liability?.jobId, a?.liability?.originalRequestDigest,
    a?.liability?.originalCheckpointDigest, a?.liability?.originalPolicyDigest];
  if (a?.version !== "blueprint.communications-recurring-budget-direction.v1" || a.owner !== "Nijel Hunt"
    || !Number.isFinite(Date.parse(a.approvedAt)) || Date.parse(a.approvedAt) > now
    || !Number.isFinite(Date.parse(a.expiresAt)) || Date.parse(a.expiresAt) <= now
    || a.expiryBasis !== "operator_boundary_no_later_than_existing_history_scope"
    || a.direction?.spending?.kind !== "direct_current_chat_human_reply" || a.direction.spending.answer !== "$10 per day"
    || !Array.isArray(a.direction.spending.questionItemId) || a.direction.spending.questionItemId.length !== 3
    || a.direction.spending.questionItemId[0] !== "request_user_input_async" || !/^call_[A-Za-z0-9]+$/.test(a.direction.spending.questionItemId[1])
    || a.direction.spending.questionItemId[2] !== 0 || a.direction.unattended?.kind !== "verified_prior_human_instruction"
    || typeof a.direction.unattended.text !== "string" || !a.direction.unattended.text.trim()
    || !/^gs:\/\/blueprint-8c1ca\.appspot\.com\/operations\/recovery\//.test(a.direction.unattended.sourceRef)
    || a.scope?.draftOnly !== true || a.scope.sendsAuthorized !== false || a.scope.gmailCopiesAuthorized !== false
    || a.scope.accessChangesAuthorized !== false || a.scope.newDraftSessionsAuthorized !== true || a.scope.recurringWorkersAuthorized !== true
    || hashes.some(hash => typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) || a.liability.reservedExposureUsd !== 1
    || communicationsDigest({ jobId: a.liability.jobId }) !== a.liability.admissionId) throw fail();
  return { authority: a, ref, digest: communicationsDigest(a) };
}

export const COMMUNICATIONS_DRAFT_BUDGET = Object.freeze({
  version: "blueprint.communications-draft-accounting.v1", model: COMMUNICATIONS_MODEL,
  serviceTier: "default", timezone: "America/Chicago",
  rateDate: "2026-10-01", rateSource: "https://developers.openai.com/api/docs/models/gpt-6-luna",
  // Conservatively count uncached input plus cache-write pricing and a 10%
  // regional premium. This is a soft estimate, never an invoice or hard cap.
  inputUsdPerMillion: 0.2475, outputUsdPerMillion: 0.55,
});
export class CommunicationsDraftBudgetError extends Error {
  constructor(readonly code: string) { super(code); }
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

/** Record per-job admission and usage provenance without a Blueprint spend
 * ceiling. Historical holds remain untouched; the job/create claim prevents
 * duplicate provider effects independently of cost reporting. */
export async function reserveCommunicationsDraft(db: FirebaseFirestore.Firestore, jobId: string, requestDigest: string, now: number,
  sessionSpendLimitCents?: number) {
  const started = performance.now(), clock = () => now + Math.max(0, performance.now() - started);
  const recurring = await recurringBudgetDirection(db, clock);
  const policy = COMMUNICATIONS_DRAFT_BUDGET;
  const root = db.doc(COMMUNICATIONS_ROOT), id = communicationsDigest({ jobId }), day = firstContactCalendarDay(now);
  const ref = root.collection("draftBudgetAdmissions").doc(id), dayRef = root.collection("draftBudgetDays").doc(day);
  const stateRef = root.collection("draftBudgetState").doc("current");
  return db.runTransaction(async tx => {
    const [existing, daily, state, control] = await Promise.all([tx.get(ref), tx.get(dayRef), tx.get(stateRef), tx.get(root)]);
    if (communicationsDigest(control.data()?.recurringDraftBudgetDirection ?? null) !== communicationsDigest(recurring?.ref ?? null)) {
      throw new CommunicationsDraftBudgetError("communications_recurring_budget_binding_changed");
    }
    if (recurring) {
      const a = recurring.authority, liability = a.liability;
      const [held, heldJob, research] = await Promise.all([tx.get(root.collection("draftBudgetAdmissions").doc(liability.admissionId)),
        tx.get(root.collection("jobs").doc(liability.jobId)), tx.get(db.doc("blueprintDailyResearch/sites-first"))]);
      const old = held.data(), original = heldJob.data(), phase = original?.cancelledContinuation;
      if (Date.parse(a.expiresAt) <= clock() || state.data()?.activeAdmissionId !== liability.admissionId
        || !old || old.jobId !== liability.jobId || old.requestDigest !== liability.originalRequestDigest
        || old.state !== "usage_unknown" || old.originalUsageState !== "unresolved"
        || !old.policy || old.policyDigest !== liability.originalPolicyDigest || communicationsDigest(old.policy) !== liability.originalPolicyDigest
        || !original || communicationsDigest(original.checkpoint) !== liability.originalCheckpointDigest
        || (original.lease?.until ?? 0) > clock() || !phase || phase.checkpoint.finalRepairSettled !== true
        || !phase.turnId || old.cancelledContinuation?.intentDigest !== phase.intentDigest
        || old.cancelledContinuation.usageState !== "best_effort_not_invoice"
        || old.correctedCreate?.usageState !== "best_effort_not_invoice" || old.correctedCreate.state !== "usage_recorded"
        || typeof research.data()?.config?.recurring_budget_authority_reference !== "string"
        || !research.data()?.config?.recurring_budget_authority_reference.trim()
        || process.env.BLUEPRINT_COMMUNICATIONS_AUTOMATIC_FIRST_CONTACT_ENABLED === "true") {
        throw new CommunicationsDraftBudgetError("communications_recurring_budget_binding_changed");
      }
    }
    const row = existing.data();
    if (existing.exists) {
      if (row?.jobId !== jobId || row.requestDigest !== requestDigest || !row.policy
        || communicationsDigest(row.policy) !== row.policyDigest || row.state !== "reserved"
        || row.sessionSpendLimitCents !== sessionSpendLimitCents
        || (recurring && (row.recurringDirection?.digest !== recurring.digest
          || communicationsDigest(row.recurringDirection?.ref ?? null) !== communicationsDigest(recurring.ref)))) {
        throw new CommunicationsDraftBudgetError("communications_draft_reservation_requires_reconciliation");
      }
      return id;
    }
    // A frozen historical bounded request must be reconciled, never silently
    // relabelled or recreated with different provider configuration.
    if (sessionSpendLimitCents !== undefined) throw new CommunicationsDraftBudgetError("communications_historical_bounded_request_requires_reconciliation");
    const admissions = daily.data()?.admissions ?? 0, cost = daily.data()?.estimatedModelMicros ?? 0;
    if (!Number.isSafeInteger(admissions) || admissions < 0 || !Number.isSafeInteger(admissions + 1)
      || !Number.isSafeInteger(cost) || cost < 0) throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
    tx.create(ref, { version: "blueprint.communications-draft-admission.v1", jobId, requestDigest, day,
      timezone: policy.timezone, policy, policyDigest: communicationsDigest(policy), accountingOnly: true, ...(recurring ? { recurringDirection: { ref: recurring.ref, digest: recurring.digest, expiresAt: recurring.authority.expiresAt } } : {}), state: "reserved", admittedAt: new Date(now).toISOString() });
    // A reporting pointer is optional and never overwrites a historical hold.
    if (!state.data()?.activeAdmissionId) tx.set(stateRef, { activeAdmissionId: id }, { merge: true });
    tx.set(dayRef, { day, timezone: policy.timezone, admissions: admissions + 1,
      estimatedModelMicros: cost, updatedAt: new Date(now).toISOString() }, { merge: true });
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
  const start = Date.parse(input.correctedCreateClaimedAt);
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
    || !row.policy || communicationsDigest(row.policy) !== row.policyDigest
    || !["reserved", "usage_unknown"].includes(row.state) || (!row.accountingOnly && state.data()?.activeAdmissionId !== id)) {
    throw new CommunicationsDraftBudgetError("communications_rejected_create_budget_binding_changed");
  }
  if (row.correctedCreate) {
    if (row.correctedCreate.claimDigest !== claimDigest) throw new CommunicationsDraftBudgetError("communications_rejected_create_budget_already_claimed");
    return { admissionId: id }; // Transaction replay only; it never authorizes another POST.
  }
  const admissions = daily.data()?.admissions ?? 0, cost = daily.data()?.estimatedModelMicros ?? 0;
  const retained = state.data()?.retainedSessionReservationsMicros ?? 0;
  if (!Number.isSafeInteger(admissions) || admissions < 0 || !Number.isSafeInteger(cost) || cost < 0
    || !Number.isSafeInteger(retained) || retained < 0) {
    throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
  }
  const policy = COMMUNICATIONS_DRAFT_BUDGET;
  tx.update(ref, { state: "usage_unknown", usageState: "unresolved", originalUsageState: "unresolved",
    correctedCreate: { version: "blueprint.communications-rejected-create-admission.v1", ...input,
      requestDigest: input.correctedRequestDigest, claimDigest, day, policy, policyDigest: communicationsDigest(policy),
      state: "reserved", usageState: "unresolved", admittedAt: new Date(now).toISOString() } });
  tx.set(dayRef, { day, timezone: policy.timezone, admissions: admissions + 1,
    estimatedModelMicros: cost, updatedAt: new Date(now).toISOString() }, { merge: true });
  return { admissionId: id };
}

/** Reserve the explicitly authorized phase inside the EXISTING active hold.
 * The old unknown $1 policy exposure is a reservation, never measured spend or
 * a refund. Research keeps its $5 reservation. This is soft admission only;
 * provider usage and the rejected create's invoice remain incomplete. */
export async function claimCommunicationsCancelledContinuationBudget(db: FirebaseFirestore.Firestore,
  tx: FirebaseFirestore.Transaction, phase: CommunicationsCancelledContinuation, now: number) {
  const a = phase.intent.authority, b = a.binding, root = db.doc(COMMUNICATIONS_ROOT);
  const id = communicationsDigest({ jobId: b.jobId }), ref = root.collection("draftBudgetAdmissions").doc(id);
  const day = firstContactCalendarDay(now), dayRef = root.collection("draftBudgetDays").doc(day);
  const [saved, state, daily, research] = await Promise.all([tx.get(ref), tx.get(root.collection("draftBudgetState").doc("current")),
    tx.get(dayRef), tx.get(db.doc("blueprintDailyResearch/sites-first"))]);
  const row = saved.data(), known = daily.data()?.estimatedModelMicros, admissions = daily.data()?.admissions;
  const retained = state.data()?.retainedSessionReservationsMicros ?? 0;
  const normal = research.data(), correction = row?.correctedCreate;
  if (!row || row.jobId !== b.jobId || row.requestDigest !== b.originalRequestDigest
    || state.data()?.activeAdmissionId !== id || row.state !== "usage_unknown" || row.originalUsageState !== "unresolved"
    || !row.policy || communicationsDigest(row.policy) !== row.policyDigest
    || row.policy.softTargetUsd !== a.allocation.originalUnknownPolicyReservationUsd
    || !correction || correction.requestDigest !== b.correctedRequestDigest || correction.day !== day
    || !correction.policy || communicationsDigest(correction.policy) !== correction.policyDigest
    || !Number.isSafeInteger(known) || known < 0 || !Number.isSafeInteger(admissions) || admissions < 0
    || !Number.isSafeInteger(retained) || retained < 0
    || !Number.isSafeInteger(correction.estimatedModelMicros) || correction.estimatedModelMicros < 0
    || normal?.enabled !== false || normal.config?.enabled !== false
    || typeof normal.config?.recurring_budget_authority_reference !== "string" || !normal.config.recurring_budget_authority_reference.trim()
    || Date.parse(phase.intent.window.deadlineAt) <= now || Date.parse(a.expiresAt) <= now) {
    throw new CommunicationsDraftBudgetError("communications_continuation_budget_binding_changed");
  }
  if (row.cancelledContinuation) {
    if (row.cancelledContinuation.intentDigest !== phase.intentDigest) throw new CommunicationsDraftBudgetError("communications_continuation_budget_already_claimed");
    return { admissionId: id }; // Reconnect only, never permission for another user-input POST.
  }
  if (correction.usageState !== "best_effort_not_invoice" || correction.estimatedModelMicros !== a.allocation.correctedKnownModelMicros
    || known < correction.estimatedModelMicros
    || a.allocation.researchReservationUsd + a.allocation.communicationsReservationUsd !== a.allocation.maxCombinedDailyUsd
    || a.allocation.maxCombinedDailyUsd !== 10 || a.allocation.communicationsReservationUsd !== 5) {
    throw new CommunicationsDraftBudgetError("communications_continuation_budget_binding_changed");
  }
  tx.update(ref, { cancelledContinuation: { version: "owner-cancelled-continuation-v1", intentDigest: phase.intentDigest,
    authorityRef: phase.intent.authorityRef, authorityDigest: phase.intent.authorityDigest, day,
    baselineModelMicros: correction.estimatedModelMicros, knownDailyAtClaimMicros: known, originalUnknownPolicyReservationUsd: a.allocation.originalUnknownPolicyReservationUsd,
    researchReservationUsd: a.allocation.researchReservationUsd, accountingComplete: false, invoiceVerified: false,
    admittedAt: new Date(now).toISOString() } });
  tx.set(dayRef, { admissions: admissions + 1, updatedAt: new Date(now).toISOString() }, { merge: true });
  return { admissionId: id };
}

export async function assertCommunicationsContinuationBudget(db: FirebaseFirestore.Firestore,
  phase: CommunicationsCancelledContinuation, now: number) {
  // Reuse the same validation/reads without altering the existing reservation.
  return db.runTransaction(tx => claimCommunicationsCancelledContinuationBudget(db, tx, phase, now));
}

/** Only the verified saved root turn supplies usage. Missing or inconsistent
 * accounting holds the admission; a visible draft does not prove its cost. */
export async function recordCommunicationsDraftUsage(db: FirebaseFirestore.Firestore, jobId: string, requestDigest: string, usage: unknown, now: number) {
  const root = db.doc(COMMUNICATIONS_ROOT), id = communicationsDigest({ jobId }), ref = root.collection("draftBudgetAdmissions").doc(id);
  const stateRef = root.collection("draftBudgetState").doc("current");
  return db.runTransaction(async tx => {
    const [saved, state] = await Promise.all([tx.get(ref), tx.get(stateRef)]), row = saved.data();
    if (!saved.exists || row?.jobId !== jobId) throw new CommunicationsDraftBudgetError("communications_draft_usage_binding_changed");
    if (row.rejectedCreateClassification) throw new CommunicationsDraftBudgetError("communications_rejected_create_invoice_unresolved");
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
  if (!correctionUnknown) clearOwnedDraftBudgetPointer(tx, stateRef, id, row, state);
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
      estimatedModelMicros: retained, usageState: "best_effort_not_invoice", checkedAt: new Date(now).toISOString() },
    ...(row.cancelledContinuation ? { cancelledContinuation: { ...row.cancelledContinuation,
      cumulativeAcceptedSessionModelMicros: retained, additionalEstimatedModelMicros: Math.max(0, retained - row.cancelledContinuation.baselineModelMicros),
      usageState: "best_effort_not_invoice", accountingComplete: false, invoiceVerified: false } } : {}) });
  tx.set(dayRef, { estimatedModelMicros: total, updatedAt: new Date(now).toISOString() }, { merge: true });
  if (originalResolved) clearOwnedDraftBudgetPointer(tx, stateRef, id, row, state);
  return originalResolved; // Without verified original usage the existing active hold remains.
}

function clearOwnedDraftBudgetPointer(tx: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference,
  id: string, row: any, state: any) {
  const field = row.recurringDirection ? "recurringActiveAdmissionId" : "activeAdmissionId";
  if (state?.[field] === id) tx.set(ref, { [field]: null }, { merge: true });
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
      || (!row.accountingOnly && state?.[row.recurringDirection ? "recurringActiveAdmissionId" : "activeAdmissionId"] !== id)) throw new CommunicationsDraftBudgetError("communications_draft_recovery_binding_changed");
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
  api: Pick<CommunicationsAgentsAPI, "reconcileUsage"> & Partial<Pick<CommunicationsAgentsAPI, "reconcileCancelledContinuationUsage">>, now: number) {
  const root = db.doc(COMMUNICATIONS_ROOT), state = (await root.collection("draftBudgetState").doc("current").get()).data();
  const pointer = state?.recurringActiveAdmissionId;
  if (pointer && (typeof pointer !== "string" || !/^[a-f0-9]{64}$/.test(pointer))) throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
  // The one newly active draft is observed first. The immutable old liability
  // cannot starve its usage reconciliation or cause it to be read as that job.
  const unresolved = pointer ? await root.collection("draftBudgetAdmissions").doc(pointer).get()
    : (await root.collection("draftBudgetAdmissions").where("state", "in", ["reserved", "usage_unknown"]).limit(1).get()).docs[0];
  if (!unresolved) return;
  const row = unresolved.data();
  if (!row?.jobId || !row.requestDigest) throw new CommunicationsDraftBudgetError("communications_draft_budget_state_invalid");
  const job = (await root.collection("jobs").doc(row.jobId).get()).data();
  if (row.correctedCreate) {
    const checkpoint = job?.checkpoint, recovery = checkpoint?.rejectedCreateRecovery, child = recovery?.checkpoint;
    if (!checkpoint || !child?.sessionId) return;
    if (checkpoint.requestDigest !== row.requestDigest || recovery.originalRequestDigest !== row.requestDigest
      || recovery.correctedRequestDigest !== row.correctedCreate.requestDigest || child.requestDigest !== row.correctedCreate.requestDigest) {
      throw new CommunicationsDraftBudgetError("communications_draft_usage_binding_changed");
    }
    if (job.cancelledContinuation && !api.reconcileCancelledContinuationUsage) return; // Never fall back to the old single-root child.
    const usage = job.cancelledContinuation ? await api.reconcileCancelledContinuationUsage!(checkpoint, job.cancelledContinuation, row.jobId)
      : await api.reconcileUsage(checkpoint, row.jobId);
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
