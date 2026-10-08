import type { Transaction } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { SiteAssessmentBudget } from "../agents/adapters/site-assessment-budget";
import { humanDecisionDigest } from "./human-reply-admission";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { browserPendingDecisionKey, type BrowserPending } from "./websiteBrowserPending";
import { advisoryContextDigest } from "./siteAssessmentContext";
import { hydrateAgentEvidence } from "../agents/private-evidence";
import type { AssessmentRecovery } from "./inferenceProgrammeAdmission";

const budgetFor = (captureId: string) => db!.collection("captureCoverageReviews").doc(`budget-${humanDecisionDigest({ capture_id: captureId })}`);
const digest = humanDecisionDigest;
const privacyFor = (request: any) => request?.capture_privacy_source_bound_decision || request?.capture_privacy_screen;
function assertSource(request: any, captureId: string, source: unknown) {
  const privacy = privacyFor(request);
  if (!projectWebsiteCaptureRights(request).derived_scene_generation_allowed || privacy?.proceeded !== true
    || privacy.capture_id !== captureId || digest(privacy.producer_source) !== digest(source)) throw new Error("coverage_budget_source_changed");
}

/** A durable call intent and current claim fence. Money, missing usage and old
 * programme approvals are accounting facts, never customer admission gates. */
export async function reserveCaptureCoverageInference(model: string, metadata: Record<string, unknown> = {},
  provider: "gemini" | "openai" = "gemini", modelRequest?: unknown) {
  const captureId = metadata.capture_id, runId = metadata.assessment_run_id, assessment = typeof runId === "string";
  const reviewId = metadata.review_id, claim = metadata.coverage_claim_token;
  if (!db || typeof captureId !== "string" || !/^[A-Za-z0-9._-]{1,200}$/.test(captureId)
    || (assessment ? !/^[A-Za-z0-9._-]{1,200}$/.test(runId as string)
      : typeof reviewId !== "string" || !/^[a-f0-9]{64}$/.test(reviewId) || typeof claim !== "string" || !claim)) throw new Error("coverage_budget_claim_required");
  const jobRef = assessment ? db.collection("agentRuns").doc(runId as string) : db.collection("captureCoverageReviews").doc(reviewId as string);
  const budgetRef = budgetFor(captureId), token = randomUUID(), callRef = budgetRef.collection("calls").doc(token);
  const budget = new SiteAssessmentBudget(); budget.authorize(provider, model, modelRequest);
  const reserved = budget.calls[0].reserved_usd;
  const check = async (tx: Transaction) => {
    const snap = await tx.get(jobRef);
    const job = assessment && snap.exists ? await hydrateAgentEvidence(snap.data()!, { collection: "agentRuns", id: runId as string }) : snap.data();
    const requestId = assessment ? job?.input?.input?.context?.request_id : job?.requestId;
    if (!job || typeof requestId !== "string" || (assessment ? job.task_kind !== "site_assessment" || job.status !== "running"
      || requestId !== metadata.assessment_request_id || (job.metadata?.capture_id && job.metadata.capture_id !== captureId)
      : job.state !== "running" || job.claim_token !== claim || job.captureId !== captureId)) throw new Error("coverage_budget_claim_changed");
    const [requestSnap, briefSnap] = await Promise.all([tx.get(db!.collection("inboundRequests").doc(requestId)), tx.get(db!.collection("siteTaskBriefs").doc(requestId))]);
    const request = requestSnap.data(), brief = briefSnap.data() ?? null, source = assessment ? metadata.assessment_source : job.binding?.source;
    assertSource(request, captureId, source);
    if (!assessment && (!briefSnap.exists || digest(brief) !== job.binding?.brief_digest)) throw new Error("coverage_budget_source_changed");
    const context = advisoryContextDigest(request!, brief);
    if (assessment && job.input?.input?.context?.advisory_job_id) {
      const advisory = (await tx.get(db!.collection("siteAssessmentJobs").doc(job.input.input.context.advisory_job_id))).data();
      if (advisory?.state !== "running" || advisory.run_id !== runId || advisory.claim_id !== job.input.input.context.advisory_claim_id
        || advisory.request_id !== requestId || advisory.capture_id !== captureId || advisory.source_key !== (source as any)?.key
        || advisory.context_digest !== context) throw new Error("coverage_budget_claim_changed");
    }
    if (assessment && (source as any)?.kind === "browser_pending") {
      const session = (await tx.get(db!.collection("captureUploadSessions").doc(captureId))).data();
      const pending = session?.browser_pending_delivery as BrowserPending | undefined;
      if (!pending || pending.state !== "published" || pending.request_id !== requestId || pending.capture_id !== captureId
        || session?.browser_upload_reservation || session?.browser_stored_upload || browserPendingDecisionKey(pending) !== (source as any).key)
        throw new Error("coverage_budget_source_changed");
    }
    let ownerRunId = assessment ? runId as string : null;
    if (!assessment) {
      const runs = await tx.get(db!.collection("agentRuns").where("session_key", "==", `capture_coverage:${reviewId}`));
      const current = runs.docs.filter(row => row.data().task_kind === "capture_coverage" && row.data().status === "running"
        && row.data().metadata?.capture_id === captureId && row.data().metadata?.review_id === reviewId && row.data().metadata?.coverage_claim_token === claim);
      if (current.length > 1) throw new Error("coverage_budget_claim_changed");
      ownerRunId = current[0]?.id ?? null;
    }
    return { requestId, context, source, ownerRunId };
  };
  const admission = await db.runTransaction(async tx => {
    const binding = await check(tx), state = (await tx.get(budgetRef)).data();
    if (state && (state.capture_id !== captureId || !Number.isFinite(state.exposure_usd) || state.exposure_usd < 0
      || !Number.isSafeInteger(state.calls) || state.calls < 0)) throw new Error("coverage_budget_state_invalid");
    // A terminal historical action cannot turn missing usage into an
    // availability gate for distinct authorized work. Never replay that action.
    let retiredRef: FirebaseFirestore.DocumentReference | null = null;
    if (state?.pending_token) {
      const ref = budgetRef.collection("calls").doc(state.pending_token), prior = (await tx.get(ref)).data();
      const distinct = prior && (assessment ? prior.run_id !== runId : prior.run_id !== null || prior.review_id !== reviewId || prior.claim_token !== claim);
      if (!prior || prior.state !== "admitted" || prior.admission_token !== state.pending_token || prior.capture_id !== captureId
        || prior.request_id !== binding.requestId || !Number.isFinite(prior.reserved_usd) || prior.reserved_usd <= 0 || !distinct)
        throw new Error("coverage_budget_call_in_flight");
      let terminal = false;
      if (prior.run_id) {
        const owner = (await tx.get(db!.collection("agentRuns").doc(prior.run_id))).data();
        terminal = owner?.task_kind === "site_assessment" && ["failed", "cancelled"].includes(owner.status)
          && (owner.metadata?.capture_id === captureId || owner.input?.input?.context?.request_id === prior.request_id);
      } else if (prior.review_id) {
        const owner = (await tx.get(db!.collection("captureCoverageReviews").doc(prior.review_id))).data();
        terminal = owner?.captureId === captureId && owner.requestId === prior.request_id && owner.claim_token === prior.claim_token
          && ["failed", "cancelled"].includes(owner.state);
        {
          // Older intents did not capture their SDK run ID. Reuse the same
          // canonical session query, matching the exact persisted claim.
          const runs = prior.owner_run_id ? [(await tx.get(db!.collection("agentRuns").doc(prior.owner_run_id))).data()]
            : (await tx.get(db!.collection("agentRuns").where("session_key", "==", `capture_coverage:${prior.review_id}`))).docs.map(row => row.data());
          const matching = runs.filter(run => run?.task_kind === "capture_coverage" && run.metadata?.capture_id === captureId
            && run.metadata?.review_id === prior.review_id && run.metadata?.coverage_claim_token === prior.claim_token);
          // A failed review cannot retire a still-running SDK owner. With no
          // captured SDK owner, an exact terminal review is sufficient.
          if (prior.owner_run_id || matching.length) terminal = matching.length === 1 && ["failed", "cancelled"].includes(matching[0]?.status ?? "");
        }
      }
      if (!terminal) throw new Error("coverage_budget_call_in_flight");
      retiredRef = ref;
    }
    const exposure = (state?.exposure_usd ?? 0) + reserved;
    const intent = { schema_version: "capture_inference_call.v1", admission_token: token, capture_id: captureId,
      request_id: binding.requestId, run_id: runId ?? null, owner_run_id: binding.ownerRunId, review_id: reviewId ?? null, claim_token: claim ?? null,
      provider, model, source_digest: digest(binding.source), context_digest: binding.context,
      video_sha256: metadata.assessment_video_sha256 ?? null, reserved_usd: reserved, capture_exposure_usd: exposure,
      state: "admitted", cost_estimate_usd: null, created_at_ms: Date.now() };
    if (retiredRef) tx.set(retiredRef, { state: "unknown", retired_for_distinct_call_token: token, retired_at_ms: Date.now() }, { merge: true });
    tx.set(callRef, intent);
    tx.set(budgetRef, { schema_version: "capture_coverage_inference_budget.v1", capture_id: captureId,
      cap_usd: state?.cap_usd ?? null, exposure_usd: exposure, calls: (state?.calls ?? 0) + 1,
      pending_token: token, ...(state ? {} : { historical_usage_status: "unreconciled" }), last_review_id: reviewId ?? null, last_assessment_run_id: runId ?? null, updated_at_ms: Date.now() }, { merge: true });
    return { ...binding, exposure, cap: state?.cap_usd ?? null };
  });
  return {
    receipt: { provider, cap_usd: admission.cap, spending_gated: false, admission_token: token,
      reserved_usd: reserved, capture_exposure_usd: admission.exposure },
    async assertDispatchAllowed() {
      await db!.runTransaction(async tx => {
        const binding = await check(tx), [state, call] = await Promise.all([tx.get(budgetRef), tx.get(callRef)]);
        if (state.data()?.pending_token !== token || call.data()?.state !== "admitted"
          || binding.context !== admission.context || digest(binding.source) !== digest(admission.source)) throw new Error("coverage_budget_admission_changed");
      });
    },
    async record(usage: unknown) {
      budget.record(provider, model, { usage });
      const priced = budget.calls[0];
      await db!.runTransaction(async tx => {
        const [stateSnap, callSnap] = await Promise.all([tx.get(budgetRef), tx.get(callRef)]);
        const state = stateSnap.data(), call = callSnap.data();
        if (state?.pending_token !== token || call?.state !== "admitted" || call.admission_token !== token) throw new Error("coverage_budget_admission_changed");
        tx.set(callRef, { state: priced.cost_usd === null ? "unknown" : "recorded", raw_usage: usage ?? null,
          cost_estimate_usd: priced.cost_usd, usage_pricing_status: priced.usage_pricing_status, above_estimate: priced.above_estimate ?? false, priced_input_tokens: priced.input_tokens, priced_output_tokens: priced.output_tokens, recorded_at_ms: Date.now() }, { merge: true });
        // A received response with unknown usage ends this action; full unknown
        // exposure remains retained, while distinct authorized work can continue.
        tx.set(budgetRef, { pending_token: null, exposure_usd: state.exposure_usd + Math.max(0, (priced.cost_usd ?? reserved) - reserved), last_usage_estimate_usd: priced.cost_usd, updated_at_ms: Date.now() }, { merge: true });
      });
    },
  };
}

type RecoveryInput = { requestId: string; jobId: string; captureId: string; previousRunId: string; previousClaimId: string | null;
  newRunId: string; retryIdentity: string; sourceKey: string; contextDigest: string; request: Record<string, any>; brief: Record<string, any> | null };
const ASSESSMENT_LEASE_MS = 30 * 60_000;
const callIntentDigest = (call: Record<string, any>) => digest(Object.fromEntries([
  "schema_version", "admission_token", "request_id", "capture_id", "run_id", "owner_run_id", "provider", "model",
  "source_digest", "context_digest", "video_sha256", "reserved_usd", "capture_exposure_usd", "created_at_ms",
].map(key => [key, call[key] ?? null])));
function assertAbandonedCall(call: any, input: Pick<RecoveryInput, "requestId" | "captureId" | "previousRunId" | "sourceKey" | "contextDigest">, token: string) {
  if (!call || call.schema_version !== "capture_inference_call.v1" || call.admission_token !== token
    || call.request_id !== input.requestId || call.capture_id !== input.captureId || call.run_id !== input.previousRunId
    || call.owner_run_id !== input.previousRunId || call.source_digest !== digest({ kind: "browser_pending", key: input.sourceKey })
    || call.context_digest !== input.contextDigest || !/^[a-f0-9]{64}$/.test(call.video_sha256 ?? "")
    || !Number.isFinite(call.reserved_usd) || call.reserved_usd <= 0 || !Number.isFinite(call.capture_exposure_usd)
    || call.capture_exposure_usd < call.reserved_usd || !Number.isSafeInteger(call.created_at_ms)
    || !(call.provider === "openai" && call.model === "gpt-6.1-sol" || call.provider === "gemini" && call.model === "gemini-3.8-flash"))
    throw new Error("advisory_retry_unavailable");
}
/** Retire an expired claim, never retry its uncertain provider action. */
export async function prepareAssessmentAbandonment(tx: Transaction, input: Omit<RecoveryInput, "newRunId" | "retryIdentity"> & { startedAtMs: number }) {
  const runRef = db!.collection("agentRuns").doc(input.previousRunId), runSnap = await tx.get(runRef);
  const run: any = await hydrateAgentEvidence(runSnap.data() ?? {}, { collection: "agentRuns", id: input.previousRunId });
  if (run.status === "completed") return { completed: true as const };
  if (run.status !== "running" || run.task_kind !== "site_assessment" || run.agent_accounting_incomplete || run.mutation_reconciliation_required
    || run.metadata?.capture_id !== input.captureId || run.metadata?.advisory_job_id !== input.jobId || !input.previousClaimId
    || run.input?.input?.context?.request_id !== input.requestId || run.input.input.context.advisory_job_id !== input.jobId
    || run.input.input.context.advisory_claim_id !== input.previousClaimId || !Number.isSafeInteger(input.startedAtMs)
    || input.startedAtMs < 0 || Date.now() - input.startedAtMs < ASSESSMENT_LEASE_MS) throw new Error("advisory_retry_unavailable");
  assertSource(input.request, input.captureId, { kind: "browser_pending", key: input.sourceKey });
  const state = (await tx.get(budgetFor(input.captureId))).data();
  if (!state?.pending_token || state.capture_id !== input.captureId || state.last_assessment_run_id !== input.previousRunId
    || !Number.isSafeInteger(state.calls) || state.calls < 1 || !Number.isFinite(state.exposure_usd) || state.exposure_usd < 0)
    throw new Error("advisory_retry_unavailable");
  const call = (await tx.get(budgetFor(input.captureId).collection("calls").doc(state.pending_token))).data();
  assertAbandonedCall(call, input, state.pending_token);
  if (call!.state !== "admitted" || call!.capture_exposure_usd !== state.exposure_usd) throw new Error("advisory_retry_unavailable");
  const content = { schema_version: "site_assessment_abandonment.v1", request_id: input.requestId, capture_id: input.captureId,
    job_id: input.jobId, run_id: input.previousRunId, claim_id: input.previousClaimId, source_key: input.sourceKey,
    context_digest: input.contextDigest, started_at_ms: input.startedAtMs, lease_ms: ASSESSMENT_LEASE_MS, retired_at_ms: Date.now(),
    admission_token: state.pending_token, call_intent_sha256: callIntentDigest(call!) };
  return { completed: false as const, runRef, runUpdate: { status: "cancelled", error: "site_assessment_process_interrupted",
    cancelled_at: new Date().toISOString(), advisory_abandonment: { ...content, receipt_sha256: digest(content) } } };
}
/** Explicit failed-run recovery preserves the old run and every unknown estimate.
 * No financial programme, provider receipt or remaining spending quota is required. */
export async function prepareAssessmentRecovery(tx: Transaction, input: RecoveryInput) {
  const budgetRef = budgetFor(input.captureId), [budgetSnap, runSnap] = await Promise.all([tx.get(budgetRef), tx.get(db!.collection("agentRuns").doc(input.previousRunId))]);
  const state = budgetSnap.data(), run: any = await hydrateAgentEvidence(runSnap.data() ?? {}, { collection: "agentRuns", id: input.previousRunId });
  let bound = run.artifacts?.source_admission, intent = run.artifacts?.capture_inference_reservations?.at(-1);
  assertSource(input.request, input.captureId, { kind: "browser_pending", key: input.sourceKey });
  let abandoned = false;
  if (run.status === "cancelled" && run.error === "site_assessment_process_interrupted") {
    const receipt = run.advisory_abandonment, { receipt_sha256, ...content } = receipt ?? {};
    if (receipt?.schema_version !== "site_assessment_abandonment.v1" || receipt_sha256 !== digest(content)
      || receipt.request_id !== input.requestId || receipt.capture_id !== input.captureId || receipt.job_id !== input.jobId
      || receipt.run_id !== input.previousRunId || receipt.claim_id !== input.previousClaimId || receipt.source_key !== input.sourceKey
      || receipt.context_digest !== input.contextDigest || receipt.lease_ms !== ASSESSMENT_LEASE_MS
      || !Number.isSafeInteger(receipt.started_at_ms) || receipt.started_at_ms < 0 || !Number.isSafeInteger(receipt.retired_at_ms)
      || receipt.retired_at_ms - receipt.started_at_ms < ASSESSMENT_LEASE_MS || typeof receipt.admission_token !== "string") throw new Error("advisory_retry_unavailable");
    const call = (await tx.get(budgetRef.collection("calls").doc(receipt.admission_token))).data();
    assertAbandonedCall(call, input, receipt.admission_token);
    if (callIntentDigest(call!) !== receipt.call_intent_sha256 || !["admitted", "unknown", "recorded"].includes(call!.state)) throw new Error("advisory_retry_unavailable");
    // The call's hash and source binding were durably captured before dispatch.
    // These are checkpoints, never fabricated provider responses or measurements.
    bound ??= { request_id: input.requestId, capture_id: input.captureId, advisory_job_id: input.jobId,
      source_key: input.sourceKey, context_digest: input.contextDigest, video_sha256: call!.video_sha256 };
    intent ??= { provider: call!.provider, admission_token: receipt.admission_token, reserved_usd: call!.reserved_usd,
      capture_exposure_usd: call!.capture_exposure_usd, cap_usd: state?.cap_usd ?? null };
    abandoned = true;
  }
  if (!(run.status === "failed" || abandoned) || run.task_kind !== "site_assessment" || run.metadata?.capture_id !== input.captureId
    || run.metadata?.advisory_job_id !== input.jobId || run.input?.input?.context?.request_id !== input.requestId
    || !input.previousClaimId || run.input?.input?.context?.advisory_job_id !== input.jobId || run.input?.input?.context?.advisory_claim_id !== input.previousClaimId
    || bound?.request_id !== input.requestId || bound?.capture_id !== input.captureId || bound?.advisory_job_id !== input.jobId
    || bound?.source_key !== input.sourceKey || bound?.context_digest !== input.contextDigest || !/^[a-f0-9]{64}$/.test(bound?.video_sha256 ?? "")
    || advisoryContextDigest(input.request, input.brief) !== input.contextDigest) throw new Error("advisory_retry_unavailable");
  const history: AssessmentRecovery[] = state?.assessment_recoveries ?? [];
  if (!Array.isArray(history) || history.some(row => !validRecovery(row))) throw new Error("advisory_retry_unavailable");
  let token = "none", reserved = 0, provider: "openai" | "gemini" = "openai", model = "gpt-6.1-sol", callRef: FirebaseFirestore.DocumentReference | null = null;
  if (state?.pending_token) {
    if (state.last_assessment_run_id !== input.previousRunId || !intent || intent.capture_exposure_usd !== state.exposure_usd
      || intent.cap_usd !== state.cap_usd || !Number.isFinite(intent.reserved_usd) || intent.reserved_usd <= 0) throw new Error("advisory_retry_unavailable");
    token = state.pending_token; reserved = intent.reserved_usd; provider = intent.provider;
    if (!["openai", "gemini"].includes(provider)) throw new Error("advisory_retry_unavailable");
    model = provider === "openai" ? "gpt-6.1-sol" : "gemini-3.8-flash";
    callRef = budgetRef.collection("calls").doc(token);
    const call = (await tx.get(callRef)).data();
    if (call && (call.state !== "admitted" || call.run_id !== input.previousRunId || call.admission_token !== token
      || call.request_id !== input.requestId || call.capture_id !== input.captureId || call.source_digest !== digest({kind:"browser_pending",key:input.sourceKey})
      || call.context_digest !== input.contextDigest || call.reserved_usd !== reserved)) throw new Error("advisory_retry_unavailable");
    if (!call && intent.admission_token && intent.admission_token !== token) throw new Error("advisory_retry_unavailable");
  }
  const content = { schema_version: "site_assessment_recovery.v2" as const, retry_identity: input.retryIdentity, job_id: input.jobId,
    request_id: input.requestId, capture_id: input.captureId, previous_run_id: input.previousRunId, previous_claim_id: input.previousClaimId!, new_run_id: input.newRunId,
    source_key: input.sourceKey, source_digest: digest({kind:"browser_pending",key:input.sourceKey}), context_digest: input.contextDigest,
    advisory_context_digest: input.contextDigest, video_sha256: bound.video_sha256 ?? "", programme_id: state?.inference_program_id ?? "",
    authority_digest: state?.inference_programme_authority_digest ?? "", slot_id: "", admission_token: token, provider, model,
    reserved_micro_usd: Math.ceil(reserved * 1e6), reserved_call_micro_usd: Math.ceil(reserved * 1e6), capture_calls: state?.calls ?? 0,
    capture_exposure_usd: state?.exposure_usd ?? 0, created_at_ms: Date.now() };
  const receipt: AssessmentRecovery = { ...content, receipt_sha256: digest(content) };
  return { receipt, budgetRef, programmeRef: null, programmeUpdate: {}, callRef,
    callUpdate: { schema_version: "capture_inference_call.v1", admission_token: token, request_id: input.requestId, capture_id: input.captureId, run_id: input.previousRunId, provider, model, source_digest: content.source_digest, context_digest: input.contextDigest, video_sha256: bound.video_sha256, reserved_usd: reserved, cost_estimate_usd: null, state: "unknown", recovery_receipt_sha256: receipt.receipt_sha256, recovered_at_ms: Date.now() },
    budgetUpdate: { ...(state ? {} : {schema_version:"capture_coverage_inference_budget.v1",capture_id:input.captureId,cap_usd:null,exposure_usd:0,calls:0,historical_usage_status:"unreconciled"}),
      pending_token: null, assessment_recoveries: [...history, receipt] } };
}
function validRecovery(row: AssessmentRecovery) {
  if (!row || !["site_assessment_recovery.v1", "site_assessment_recovery.v2"].includes(row.schema_version)) return false;
  const {receipt_sha256, ...content} = row;
  return receipt_sha256 === digest(content);
}
/** Replays still reread current source/access in the caller transaction. */
export async function assertAssessmentRecoveryReplay(tx: Transaction, input: {requestId: string; captureId: string; jobId: string; runId: string;
 sourceKey: string; contextDigest: string; request: Record<string, any>; brief: Record<string, any> | null; receipt: AssessmentRecovery}) {
  const state = (await tx.get(budgetFor(input.captureId))).data();
  assertSource(input.request,input.captureId,{kind:"browser_pending",key:input.sourceKey});
  if (advisoryContextDigest(input.request,input.brief)!==input.contextDigest || !validRecovery(input.receipt)
    || input.receipt.request_id!==input.requestId || input.receipt.capture_id!==input.captureId || input.receipt.job_id!==input.jobId
    || input.receipt.new_run_id!==input.runId || input.receipt.source_key!==input.sourceKey || input.receipt.advisory_context_digest!==input.contextDigest
    || !state?.assessment_recoveries?.some((row:AssessmentRecovery)=>validRecovery(row)&&row.receipt_sha256===input.receipt.receipt_sha256)) throw new Error("advisory_retry_unavailable");
}
