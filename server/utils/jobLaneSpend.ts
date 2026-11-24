/**
 * The job's small model lanes inside its one $40 cap (owner decision 2026-11-19; a review of PR #1437, 2026-11-24: the
 * model pass over free text started paid calls for a job that had already used its allowance, since it checked only
 * its own pass counter and the account's rolling spend).
 *
 * Every call such a lane makes for a job reserves, before the provider is asked, the most that one call can cost, in the
 * same transaction that checks the job's cap (`checkWebsiteJobCeiling`, the check every other paid row of the job
 * passes); a refusal starts no call and records nothing. The row is then settled at the cost the run reports, or kept
 * at its full reservation when that cost cannot be read. `websiteJobSpend` counts these rows as one more of the job's
 * ledgers, each at its settlement where known and otherwise at its hold, exactly as a preparation reservation is
 * counted, so every other admission of the job (a preparation reservation, a scene intake, a video reading) sees them.
 *
 * The lanes held here, each with its job's id: the model pass over free text (`free_text_redaction`,
 * `freeTextScreening.ts`) and the follow-up picker (`site_task_follow_up`, `siteTaskFollowUp.ts`).
 *
 * Why a ledger of its own (`inboundRequests/{job}/modelLaneReservations`), with the preparation rows' shape
 * (`admission.maximum_cost_usd`, `settlement.actual_cost_usd`), rather than rows in `website_preparation_reservations`:
 * that map is the Pipeline's preparation ledger. Its rows are parsed strictly and summarised to the Pipeline
 * (`websitePreparationAccounting`, at most 128 rows), and each row's `request_count` counts against the native
 * preparation's paid-request limit, so lane rows there would break the Pipeline's accounting and eat its limit.
 *
 * Per-run cost caps and the rolling spend stop still apply on top (`server/agents/runtime.ts`).
 */
import { randomUUID } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { anthropicRequestShapeFor } from "../agents/anthropic-models";
import type { AgentTaskKind } from "../agents/types";
import { anthropicWorstCaseRequestUsd } from "./anthropicPricing";
import { GPT56_LONG_CONTEXT_THRESHOLD_TOKENS, pricingForOpenAIModel } from "./openaiPromptCache";
import { checkWebsiteJobCeiling, JOB_LANE_RESERVATIONS_COLLECTION, transactionJobLedgerReader } from "./websiteJobCeiling";

export { JOB_LANE_RESERVATIONS_COLLECTION };
export const JOB_LANE_RESERVATION_SCHEMA = "job_model_lane_reservation.v1";

/** Tokens the adapters add around a lane's prompt (system text, the output schema, message framing), generously. */
const PROMPT_OVERHEAD_TOKENS = 4_096;
/** The OpenAI adapter's own price for a model it has no row for (`worstCaseOpenAIReservationUsd`). */
const UNKNOWN_OPENAI_PRICE = { input: 5, output: 30 };

/**
 * The most one call can cost for a prompt of `promptBytes` UTF-8 bytes, as the adapters themselves reserve and settle
 * it: each reserves a request at the input ceiling (`getAgentMaxInputTokens`, the larger of it and the request's own
 * size) and, when the provider's answer carries no usage, settles it at that reservation (`unknown_usage_reserved_cost_usd`
 * in `inference_reservation.reconciled_cost_usd`). So the input side is the larger of `inputTokenCeiling` and the prompt
 * (a byte-level tokenizer makes at most one token of each byte, plus the adapters' framing), and a hold priced on the
 * prompt alone could be settled above itself (a review of PR #1438, 2026-11-24). The output side is the lane's own
 * ceiling (thinking included). Priced at the dearest model the lane may be sent to among OpenAI and Anthropic (cache
 * writes at their rate, the dearest input, OpenAI's long-context rates past its threshold as the adapter prices them;
 * on Anthropic, the request's server-side fallback model added, as the adapter reserves it), one request (the lane
 * allows no correction round, and a switch after "no funds" happens only when the first provider charged nothing).
 * Null when the lane could be sent to a model with no price (it is then not called).
 */
export function laneCallMaximumUsd(input: { promptBytes: number; outputTokenCeiling: number; inputTokenCeiling: number;
  models: { openai_responses?: string | null; anthropic_agent_sdk?: string | null } }): number | null {
  const inputTokens = Math.max(Math.max(0, Math.ceil(input.inputTokenCeiling)),
    Math.max(0, Math.ceil(input.promptBytes)) + PROMPT_OVERHEAD_TOKENS);
  const outputTokens = Math.max(0, Math.ceil(input.outputTokenCeiling));
  const costs: number[] = [];
  if (input.models.openai_responses) {
    const price = pricingForOpenAIModel(input.models.openai_responses);
    const inputRate = price ? Math.max(price.uncachedInputPerMillionUsd, price.cacheWritePerMillionUsd) : UNKNOWN_OPENAI_PRICE.input;
    // The adapter's long-context rates (`worstCaseOpenAIReservationUsd`): a priced model past the threshold.
    const longContext = Boolean(price && inputTokens > GPT56_LONG_CONTEXT_THRESHOLD_TOKENS);
    costs.push((inputTokens * inputRate * (longContext ? 2 : 1)
      + outputTokens * (price ? price.outputPerMillionUsd : UNKNOWN_OPENAI_PRICE.output) * (longContext ? 1.5 : 1)) / 1e6);
  }
  if (input.models.anthropic_agent_sdk) {
    // The adapter's own reservation for one request: the model, plus the fallback model a refusal moves it to inside
    // the same request (`anthropic-agent-sdk.ts`). A model with no request shape or no price is never sent.
    const model = input.models.anthropic_agent_sdk, shape = anthropicRequestShapeFor(model);
    const cost = shape ? anthropicWorstCaseRequestUsd(model, inputTokens, outputTokens) : null;
    const fallback = shape?.fallbackModel ? anthropicWorstCaseRequestUsd(shape.fallbackModel, inputTokens, outputTokens) : 0;
    if (cost === null || fallback === null) return null;
    costs.push(cost + fallback);
  }
  if (!costs.length) return null;
  // Rounded up to the micro-dollar the ledger counts in.
  return Math.ceil(Math.max(...costs) * 1_000_000) / 1_000_000;
}

/**
 * The models a lane's call may reach now, by provider: the provider it starts on (the first of
 * `getStructuredProviderOrder`), and every provider a switch after "no funds" may go to. A switch goes only to a
 * provider that enforces the per-run cap (`chooseFailoverProvider`), from the order the Privacy version of the job the
 * run is bound to allows, so each such provider any known version allows is priced: for a job started under 2026-11-13.1
 * or later that adds Anthropic, which the strictest table alone leaves out. Null when the lane may not be called, or
 * starts on a provider that does not enforce the per-run cap and is not priced here: no call is admitted for it.
 */
export async function laneModels(kind: AgentTaskKind): Promise<{ openai_responses?: string; anthropic_agent_sdk?: string } | null> {
  const [{ getStructuredProviderOrder, getTaskModelByProvider, RUN_CAP_ENFORCING_PROVIDERS }, { PRIVACY_POLICY_PROVIDER_ROWS }] =
    await Promise.all([import("../agents/provider-config"), import("../agents/provider-privacy")]);
  const order = getStructuredProviderOrder(kind);
  if (!order.length || !RUN_CAP_ENFORCING_PROVIDERS.has(order[0])) return null;
  const switchable = [undefined, ...Object.keys(PRIVACY_POLICY_PROVIDER_ROWS)]
    .flatMap(version => getStructuredProviderOrder(kind, version)).filter(provider => RUN_CAP_ENFORCING_PROVIDERS.has(provider));
  const reachable = new Set([order[0], ...switchable]);
  const models = getTaskModelByProvider(kind);
  return { ...(reachable.has("openai_responses") ? { openai_responses: models.openai_responses } : {}),
    ...(reachable.has("anthropic_agent_sdk") ? { anthropic_agent_sdk: models.anthropic_agent_sdk } : {}) };
}

/**
 * The most one run of `kind` can cost for a prompt of `promptBytes` UTF-8 bytes, or null when no call is admitted for
 * the lane (`laneModels`). Both adapters a lane may reach refuse, before each request, any request that could take the
 * run past the per-run inference cost cap (`getAgentMaxInferenceCostUsd`, $5 unless set), so no run passes it. A lane
 * of one request (its own output ceiling, no correction round) is bounded tighter by one request (`laneCallMaximumUsd`).
 * A lane that may send correction rounds (up to five more requests, each up to the input ceiling, with the conversation
 * so far) is held at the cap. `scripted` (unit tests, the local harness): the call is held as the lane's default OpenAI
 * model would be.
 */
export async function laneRunMaximumUsd(kind: AgentTaskKind, promptBytes: number, options: { scripted?: boolean } = {}):
  Promise<number | null> {
  const [{ getAgentMaxInferenceCostUsd, getAgentMaxInputTokens, getTaskModelByProvider }, { getTaskDefinition }] =
    await Promise.all([import("../agents/provider-config"), import("../agents/tasks")]);
  const models = options.scripted ? { openai_responses: getTaskModelByProvider(kind).openai_responses } : await laneModels(kind);
  if (!models) return null;
  const cap = getAgentMaxInferenceCostUsd(), definition = getTaskDefinition(kind);
  if (definition.max_output_corrections !== 0 || definition.max_output_tokens_ceiling === undefined) return cap;
  const call = laneCallMaximumUsd({ promptBytes, outputTokenCeiling: definition.max_output_tokens_ceiling,
    inputTokenCeiling: getAgentMaxInputTokens(), models });
  return call === null ? null : Math.min(call, cap);
}

export type LaneReservation = { lane: AgentTaskKind; reservationId: string; maximumUsd: number };

/**
 * Inside the caller's transaction (all reads first, as Firestore requires): whether this call fits under the job's cap,
 * with the job's every ledger counted; when it does, `write` records the hold. "cap": no call may start, and nothing is
 * written. "no_job": the job does not exist.
 */
export async function planJobLaneReservation(tx: FirebaseFirestore.Transaction, requestId: string, reservation: LaneReservation):
  Promise<{ state: "fits"; write: (tx: FirebaseFirestore.Transaction) => void } | { state: "cap" | "no_job" }> {
  const store = db!;
  const jobRef = store.collection("inboundRequests").doc(requestId);
  const record = (await tx.get(jobRef)).data();
  if (!record) return { state: "no_job" };
  const job = await checkWebsiteJobCeiling({ record, reader: transactionJobLedgerReader(store, tx, requestId),
    additionalCostUsd: reservation.maximumUsd });
  if (job.exceeded) return { state: "cap" };
  const ref = jobRef.collection(JOB_LANE_RESERVATIONS_COLLECTION).doc(reservation.reservationId);
  return { state: "fits", write: write => write.set(ref, { schema_version: JOB_LANE_RESERVATION_SCHEMA, request_id: requestId,
    lane: reservation.lane, admission: { maximum_cost_usd: reservation.maximumUsd, reserved_at_iso: new Date().toISOString() } }) };
}

/** A job's id as the store keeps it: one path segment. */
const JOB_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;

export type JobLaneHold = { state: "held"; reservationId: string } | { state: "cap" | "no_job" | "unavailable" };

/**
 * For a lane with no transaction of its own: in one transaction, hold `maximumUsd` for one call against the job's one
 * cap (`planJobLaneReservation`). "held": the call may start, and its hold is settled when it ends (`settleJobLaneRun`).
 * Anything else starts no call and writes nothing: "cap" (the job's cap leaves no room), "no_job" (no such job), or
 * "unavailable" (no store, or an id that is not a job's). A store that fails throws; the caller treats it as no room.
 */
export async function holdJobLaneSpend(requestId: string, lane: AgentTaskKind, maximumUsd: number): Promise<JobLaneHold> {
  if (!db || !JOB_ID.test(requestId)) return { state: "unavailable" };
  const store = db, reservationId = `${lane}-${randomUUID()}`;
  return store.runTransaction(async (tx): Promise<JobLaneHold> => {
    const hold = await planJobLaneReservation(tx, requestId, { lane, reservationId, maximumUsd });
    if (hold.state !== "fits") return { state: hold.state };
    hold.write(tx);
    return { state: "held", reservationId };
  });
}

/**
 * What a finished (or failed) run cost, as its adapter reported it (`inference_reservation.reconciled_cost_usd`: priced
 * usage, and the worst case for any request whose usage is unknown); 0 when the runtime made no provider request
 * (`inference_not_invoked`, or a run refused before the call); null when it cannot be told (the hold then stays whole).
 */
export function runCostUsd(result: { artifacts?: Record<string, unknown> | null } | null | undefined): number | null {
  const artifacts = (result?.artifacts ?? {}) as Record<string, any>;
  const reconciled = artifacts.inference_reservation?.reconciled_cost_usd;
  if (typeof reconciled === "number" && Number.isFinite(reconciled) && reconciled >= 0) return reconciled;
  if (artifacts.inference_not_invoked === true) return 0;
  return null;
}

/**
 * Settle a hold: at `actualUsd` when known, else at its full reservation (an unknown cost counts in full). Written once;
 * a cost above the hold is recorded as reported, flagged, never trimmed to it.
 */
export async function settleJobLaneSpend(requestId: string, reservationId: string, actualUsd: number | null,
  basis: "reported_usage" | "no_provider_request" | "unknown_counts_in_full" | "scripted") {
  if (!db) return;
  const store = db;
  const ref = store.collection("inboundRequests").doc(requestId).collection(JOB_LANE_RESERVATIONS_COLLECTION).doc(reservationId);
  await store.runTransaction(async tx => {
    const row = (await tx.get(ref)).data();
    if (!row || row.settlement) return;
    const held = Number(row.admission?.maximum_cost_usd);
    const actual = actualUsd === null ? held : actualUsd;
    tx.set(ref, { settlement: { actual_cost_usd: actual, status: "settled", basis: actualUsd === null ? "unknown_counts_in_full" : basis,
      settled_at_iso: new Date().toISOString(), ...(actual > held ? { above_reservation: true } : {}) } }, { merge: true });
  });
}

/**
 * Settle a lane run's hold from what the run returned (`runCostUsd`): its reported cost, 0 when no provider request was
 * made, and its full hold when the run threw (null) or its cost cannot be told.
 */
export async function settleJobLaneRun(requestId: string, reservationId: string,
  result: { artifacts?: Record<string, unknown> | null } | null | undefined) {
  const cost = runCostUsd(result);
  await settleJobLaneSpend(requestId, reservationId, cost, cost === 0 ? "no_provider_request" : "reported_usage");
}
