import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

import type { AgentResult, NormalizedAgentTask } from "../types";
import {
  ACCOUNTING_ONLY_TASK_KINDS,
  ANTHROPIC_API_BASE_URL,
  getAgentMaxInferenceCostUsd,
  getAgentMaxInputTokens,
  getAnthropicConfigurationIssue,
  getAnthropicEffort,
  getAnthropicMaxOutputTokens,
  getAnthropicTimeoutMs,
} from "../provider-config";
import { anthropicRequestShapeFor } from "../anthropic-models";
import {
  classifyProviderError,
  ProviderOutputTruncatedError,
  ProviderRefusalError,
  ProviderUnexpectedStopError,
  type ProviderErrorClassification,
} from "../provider-errors";
import { logger } from "../../logger";
import {
  ANTHROPIC_COST_FIELDS,
  anthropicDearestRequestCost,
  anthropicPricingForModel,
  anthropicRequestCost,
  anthropicWorstCaseRequestUsd,
} from "../../utils/anthropicPricing";
import { conservativeOpenAIInputTokenCeiling } from "../../utils/openaiPromptCache";
import { outputCorrectionEvidence, outputCorrectionPrompt, usageCount } from "./output-correction";

type ContentBlock = Anthropic.Beta.BetaContentBlock;
type MessageParam = Anthropic.Beta.BetaMessageParam;
type StreamParams = Parameters<Anthropic["beta"]["messages"]["stream"]>[0];
type CostField = (typeof ANTHROPIC_COST_FIELDS)[number];

const anthropicTimeoutMs = getAnthropicTimeoutMs();
const configurationIssue = getAnthropicConfigurationIssue();
if (configurationIssue === "anthropic_base_url_names_another_host") {
  // The reason only, never the value.
  logger.warn({ reason: configurationIssue },
    "Anthropic adapter not configured: ANTHROPIC_BASE_URL names a host other than Anthropic's; no request and no key is sent");
}

/** Header names `ANTHROPIC_CUSTOM_HEADERS` would add, read the way the SDK reads them. */
function environmentHeaderNames(): string[] {
  return String(process.env.ANTHROPIC_CUSTOM_HEADERS || "").split("\n")
    .map(line => line.indexOf(":") >= 0 ? line.slice(0, line.indexOf(":")).trim() : "")
    .filter(Boolean);
}

// The key and the host are both passed in code: the SDK then reads neither
// ANTHROPIC_AUTH_TOKEN nor ANTHROPIC_BASE_URL nor a profile from disk. Its log
// level and its tracing are fixed here too, so ANTHROPIC_LOG cannot make it log
// a request body and no OpenTelemetry setting can put content into spans; every
// header ANTHROPIC_CUSTOM_HEADERS would add is removed (a null default header
// wins over the environment's, and the request's own beta header is set per
// request).
const client = configurationIssue === null
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!.trim(),
      baseURL: ANTHROPIC_API_BASE_URL,
      timeout: anthropicTimeoutMs,
      maxRetries: 2,
      logLevel: "warn",
      // No spans and no trace context on the requests.
      openTelemetry: { traces: false, propagation: false },
      defaultHeaders: Object.fromEntries(environmentHeaderNames().map(name => [name, null])),
    })
  : null;

// What the adapter sends for each model lives in ../anthropic-models, so lane
// routing can tell a supported model without building a client.
export { anthropicRequestModels } from "../anthropic-models";

/**
 * On a safety decline the API re-runs the same request on the named model,
 * inside the same call. The model is named (not "default") so the per-run cap
 * can reserve what that second attempt could cost at its list price.
 */
const SERVER_SIDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";

/** The stop reasons that end a turn normally; any other, or none, is a typed failure. */
const ACCEPTED_STOP_REASONS = new Set(["end_turn", "tool_use", "pause_turn"]);

function requestShapeFor(model: string) {
  return anthropicRequestShapeFor(model);
}

function outputFormatFor(schema: ZodType<unknown>) {
  try {
    const format = zodOutputFormat(schema as never);
    // Only the schema goes out. The adapter parses the text itself, so a
    // failed parse keeps the response for the bounded correction below.
    if ((format.schema as Record<string, unknown>).type !== "object") return null;
    return { type: "json_schema" as const, schema: format.schema };
  } catch {
    return null;
  }
}

/**
 * After a fallback inside one response, thinking and tool calls written before
 * the last `fallback` block belong to the model that declined: they are not
 * sent back and not run. The `fallback` block stays where it was.
 */
function lastFallbackIndex(content: ContentBlock[]) {
  for (let index = content.length - 1; index >= 0; index -= 1) {
    if (content[index].type === "fallback") return index;
  }
  return -1;
}

const DROPPED_BEFORE_FALLBACK = new Set(["thinking", "redacted_thinking", "tool_use", "server_tool_use"]);

function echoContent(content: ContentBlock[]): ContentBlock[] {
  const boundary = lastFallbackIndex(content);
  if (boundary < 0) return content;
  return content.filter((block, index) => index >= boundary || !DROPPED_BEFORE_FALLBACK.has(block.type));
}

function servedContent(content: ContentBlock[]) {
  return content.slice(lastFallbackIndex(content) + 1);
}

/**
 * The answer's text. On a stream, a fallback model "continues from the partial
 * output" (Refusals and fallback, "When the decline occurs mid-output"), so the
 * text on either side of a `fallback` block is one answer and is joined with
 * nothing between; text blocks within one model's part are joined by lines.
 */
function extractText(content: ContentBlock[]) {
  const segments: string[][] = [[]];
  for (const block of content) {
    if (block.type === "fallback") segments.push([]);
    else if (block.type === "text" && block.text) segments[segments.length - 1].push(block.text);
  }
  return segments.map(segment => segment.join("\n")).join("").trim();
}

function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("Anthropic returned an empty response");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Anthropic returned non-JSON output");
  }
}

function inferRequiresHumanReview<TOutput>(output: TOutput) {
  return Boolean(
    output
    && typeof output === "object"
    && "requires_human_review" in (output as Record<string, unknown>)
    && (output as Record<string, unknown>).requires_human_review === true,
  );
}

/** Per-attempt usage when the response carries it (a fallback inside the call
 * bills each attempt, at the rates of the model that ran it), otherwise the
 * top-level usage. */
function usageEntries(usage: Record<string, unknown>) {
  const iterations = Array.isArray(usage.iterations) ? usage.iterations as Array<Record<string, unknown>> : null;
  return iterations && iterations.length ? iterations : [usage];
}

/** A failed request that may still have been billed: the stream had opened, or
 * no HTTP error status came back (a dropped connection, a timeout). */
function mayHaveBeenBilled(error: unknown, opened: boolean) {
  return opened || classifyProviderError(error, "anthropic_agent_sdk").status === null;
}

export async function runAnthropicAgentSdkTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
): Promise<AgentResult<TOutput>> {
  const notConfigured = (error: string): AgentResult<TOutput> => ({
    status: "failed",
    provider: task.provider,
    runtime: task.runtime,
    model: task.model,
    tool_mode: task.tool_policy.mode,
    error,
    requires_human_review: true,
    requires_approval: false,
    artifacts: { inference_not_invoked: true },
  });
  if (!client) {
    return notConfigured(configurationIssue === "anthropic_base_url_names_another_host"
      ? configurationIssue : "ANTHROPIC_API_KEY is not configured");
  }

  const shape = requestShapeFor(task.model);
  // A model without a request shape and a list price is never sent: its cost
  // could be neither reserved nor counted.
  if (!shape || !anthropicPricingForModel(task.model)
    || (shape.fallbackModel && !anthropicPricingForModel(shape.fallbackModel))) {
    return notConfigured("anthropic_model_not_supported");
  }
  const effort = getAnthropicEffort(task.kind);
  const format = outputFormatFor(task.definition.output_schema as ZodType<unknown>);
  // The same per-run cap and input ceiling as the OpenAI adapter, read from
  // the same settings, and the same lanes exempt from them.
  const accountingOnly = ACCOUNTING_ONLY_TASK_KINDS.has(task.kind);
  const maxInferenceCostUsd = getAgentMaxInferenceCostUsd();
  const maxInputTokens = getAgentMaxInputTokens();
  const traceLogs: Array<Record<string, unknown>> = [
    {
      event_type: "provider.request.prepared",
      status: "info",
      summary: "Prepared Anthropic message request",
      model: task.model,
      effort,
      structured_output: format ? "json_schema" : "schema_not_representable",
      refusal_fallback: shape.fallbackModel ?? "none",
      hard_cost_cap_usd: accountingOnly ? null : maxInferenceCostUsd,
      input_token_ceiling: maxInputTokens,
      spending_gated: !accountingOnly,
    },
  ];

  const messages: MessageParam[] = [{ role: "user", content: task.definition.build_prompt(task.input) }];
  const deadline = Date.now() + anthropicTimeoutMs;
  const receipts: Array<Record<string, unknown>> = [], usageSamples: Array<Record<string, unknown>> = [], providerResponses: Array<Record<string, unknown>> = [];
  const servedModels: string[] = [];
  let providerError: ProviderErrorClassification | null = null;
  // Each request is costed from its own counters at the rate of the model that
  // served each attempt, and the costs are added: a price tier that depends on
  // one prompt's size never applies to a sum. A request whose cost is not
  // known counts at its full reservation, never as zero.
  const costTotals = Object.fromEntries(ANTHROPIC_COST_FIELDS.map(field => [field, 0])) as Record<CostField, number>;
  let knownCostUsd = 0, unknownReservedUsd = 0, maxUnknownReservationUsd = 0, unknownRequests = 0;
  let stopDetails: unknown = null;
  // A lane's own output ceiling applies when it is the smaller one.
  let rawText = "", remainingOutput = Math.min(getAnthropicMaxOutputTokens(),
      task.definition.max_output_tokens_ceiling ?? Infinity), promptTokens = 0, completionTokens = 0, usageComplete = true, cachedTokens = 0, cacheWriteTokens = 0;
  const reconciledCostUsd = () => knownCostUsd + unknownReservedUsd;
  const round = (value: number) => Number(value.toFixed(12));
  const reserveUnknown = (sample: Record<string, unknown>, reservation: number) => {
    unknownRequests += 1; unknownReservedUsd += reservation;
    maxUnknownReservationUsd = Math.max(maxUnknownReservationUsd, reservation);
    usageSamples.push({ ...sample, reserved_max_cost_usd: reservation });
  };
  const result = (output?: TOutput, error?: string): AgentResult<TOutput> => {
    const costKnown = unknownRequests === 0 && usageComplete && usageSamples.length > 0;
    return {
      status: error ? "failed" : "completed", provider: task.provider, runtime: task.runtime,
      model: task.model, tool_mode: task.tool_policy.mode, ...(output !== undefined ? { output } : {}),
      raw_output_text: rawText, logs: traceLogs, error: error ?? null,
      requires_human_review: Boolean(error) || inferRequiresHumanReview(output), requires_approval: false,
      artifacts: { output_repairs: receipts, usage_samples: usageSamples, provider_responses: providerResponses,
        served_models: servedModels,
        ...(providerError ? { provider_error: providerError } : {}),
        ...(stopDetails ? { stop_details: stopDetails } : {}),
        known_usage_subtotals: { estimated_total_cost_usd: round(knownCostUsd) },
        inference_reservation: {
          input_token_ceiling: maxInputTokens, hard_cost_cap_usd: accountingOnly ? null : maxInferenceCostUsd,
          spending_gated: !accountingOnly, cache_hit_assumed_for_reservation: false,
          reconciled_cost_usd: round(reconciledCostUsd()), known_reported_cost_usd: round(knownCostUsd),
          unknown_usage_reserved_cost_usd: round(unknownReservedUsd),
          projected_max_cost_per_call_usd: unknownRequests ? round(maxUnknownReservationUsd) : null,
          reconciled_cost_status: unknownRequests ? "includes_worst_case_reservations" : "reported_usage_pricing_estimate",
        },
        usage: { prompt_tokens: usageComplete ? promptTokens : null, completion_tokens: usageComplete ? completionTokens : null,
          total_tokens: usageComplete ? promptTokens + completionTokens : null,
          prompt_cache_hit_tokens: cachedTokens, cache_write_tokens: cacheWriteTokens,
          ...(costKnown
            ? { ...Object.fromEntries(ANTHROPIC_COST_FIELDS.map(field => [field, round(costTotals[field])])),
                cost_status: "model_pricing_estimate_not_official_billing" }
            : usageSamples.length
              ? { ...Object.fromEntries(ANTHROPIC_COST_FIELDS.map(field => [field, null])),
                  cost_status: usageComplete ? "model_pricing_unknown" : "usage_partial" }
              : {}) },
        output_usage_complete: usageComplete },
    };
  };
  const failWith = (error: unknown, code: string) => {
    providerError = classifyProviderError(error, "anthropic_agent_sdk");
    traceLogs.push({ event_type: "provider.request.failed", status: "error", code, error_class: providerError.error_class,
      http_status: providerError.status, error_type: providerError.type, error_code: providerError.code });
    return result(undefined, code);
  };
  let correctionAttempts = 0;
  while (true) {
    if (Date.now() >= deadline || remainingOutput <= 0) return result(undefined, "output_correction_budget_exhausted");
    // Reserve before every request: the input ceiling, then the most this
    // request (and a fallback attempt inside it) could cost at list price. The
    // input side is the larger of the ceiling, where a lane has one, and this
    // request's own conservative size (the bytes of the messages, the tools
    // and the output schema), so a lane exempt from the ceiling is never
    // reserved below its real input.
    const estimatedInputTokens = conservativeOpenAIInputTokenCeiling(messages, [])
      + (format ? Buffer.byteLength(JSON.stringify(format), "utf8") : 0);
    if (!accountingOnly && estimatedInputTokens > maxInputTokens) {
      return result(undefined, "inference_input_ceiling_exceeded");
    }
    const reservationUsd = (inputTokens: number) => anthropicWorstCaseRequestUsd(task.model, inputTokens, remainingOutput)!
      + (shape.fallbackModel ? anthropicWorstCaseRequestUsd(shape.fallbackModel, inputTokens, remainingOutput)! : 0);
    const reservedInputTokens = Math.max(accountingOnly ? 0 : maxInputTokens, estimatedInputTokens);
    const projectedCostUsd = reservationUsd(reservedInputTokens);
    // A request whose cost is unknown is reserved with the largest input any
    // source reported for it.
    const unknownReservationUsd = (reportedInputTokens: number) => reservationUsd(Math.max(reservedInputTokens, reportedInputTokens));
    if (!accountingOnly && reconciledCostUsd() + projectedCostUsd > maxInferenceCostUsd) {
      traceLogs.push({ event_type: "provider.request.skipped", status: "warning", code: "inference_cost_cap_refused",
        projected_max_cost_usd: projectedCostUsd, reconciled_cost_usd: reconciledCostUsd(), hard_cost_cap_usd: maxInferenceCostUsd });
      return result(undefined, "inference_cost_cap_refused");
    }
    const params: StreamParams = {
      model: task.model,
      max_tokens: remainingOutput,
      messages,
      thinking: { type: "adaptive" as const },
      output_config: { effort, ...(format ? { format } : {}) },
      ...(shape.fallbackModel ? { betas: [SERVER_SIDE_FALLBACK_BETA], fallbacks: [{ model: shape.fallbackModel }] } : {}),
    };
    let response: Anthropic.Beta.BetaMessage;
    // Streamed so a large output ceiling cannot run into an HTTP timeout;
    // finalMessage() returns the same message a non-streamed call would.
    const stream = client.beta.messages.stream(params, { timeout: Math.max(1, deadline - Date.now()), maxRetries: 0 });
    try {
      response = await stream.finalMessage();
    } catch (error) {
      const partial = (stream as { currentMessage?: Anthropic.Beta.BetaMessage }).currentMessage;
      if (mayHaveBeenBilled(error, Boolean(partial))) {
        // Usage seen so far, marked incomplete, at the full reservation.
        usageComplete = false;
        const seen = partial?.usage as unknown as Record<string, unknown> | undefined;
        const seenInput = (usageCount(seen?.input_tokens) ?? 0) + (usageCount(seen?.cache_read_input_tokens) ?? 0)
          + (usageCount(seen?.cache_creation_input_tokens) ?? 0);
        reserveUnknown({ response_id: partial?.id ?? null, model: partial?.model ?? null,
          request_status: partial ? "stream_failed_after_open" : "request_attempted_response_unreceived",
          usage_complete: false, ...(partial?.usage ? { partial_usage: partial.usage } : {}) }, unknownReservationUsd(seenInput));
      }
      return failWith(error, "anthropic_provider_request_failed");
    }
    rawText = extractText(response.content);
    const usage = (response.usage ?? {}) as unknown as Record<string, unknown>;
    providerResponses.push({ responseId: response.id, model: response.model ?? null, content: response.content, usage, stopReason: response.stop_reason });
    // The model that served: on a fallback inside the stream the message keeps
    // the declined model's name, and the serving attempt names its own.
    const servingAttempt = usageEntries(usage).find(entry => entry.type === "fallback_message" && typeof entry.model === "string");
    const servedModel = typeof servingAttempt?.model === "string" ? servingAttempt.model
      : typeof response.model === "string" ? response.model : null;
    if (servedModel && !servedModels.includes(servedModel)) servedModels.push(servedModel);
    let requestCostUsd = 0, requestCostKnown = true, requestOutput: number | null = 0, reportedInputTokens = 0;
    for (const entry of usageEntries(usage)) {
      const input = usageCount(entry.input_tokens), output = usageCount(entry.output_tokens);
      const cached = entry.cache_read_input_tokens === undefined ? 0 : usageCount(entry.cache_read_input_tokens);
      const written = entry.cache_creation_input_tokens === undefined ? 0 : usageCount(entry.cache_creation_input_tokens);
      if (input === null || output === null || cached === null || written === null) {
        usageComplete = false; requestCostKnown = false; requestOutput = null;
      } else {
        reportedInputTokens += input + cached + written;
        const counters = { input_tokens: input, output_tokens: output, cache_read_input_tokens: cached, cache_creation_input_tokens: written };
        // An attempt that names its model is priced at that model's rate; one
        // that names none (a declined attempt may not) at the dearer of the
        // requested and the fallback model's rates, never the cheaper.
        const cost = typeof entry.model === "string"
          ? anthropicRequestCost(entry.model, counters)
          : entry === usage
            // Top-level usage: one attempt, the one the message names.
            ? anthropicRequestCost(typeof response.model === "string" ? response.model : task.model, counters)
            : anthropicDearestRequestCost([task.model, ...(shape.fallbackModel ? [shape.fallbackModel] : [])], counters);
        if (!cost) requestCostKnown = false;
        else {
          for (const field of ANTHROPIC_COST_FIELDS) costTotals[field] += cost[field];
          requestCostUsd += cost.estimated_total_cost_usd;
        }
        if (requestOutput !== null) requestOutput += output;
      }
      promptTokens += (input ?? 0) + (cached ?? 0) + (written ?? 0); completionTokens += output ?? 0;
      cachedTokens += cached ?? 0; cacheWriteTokens += written ?? 0;
    }
    const sample = { response_id: response.id, model: response.model ?? null, ...usage };
    if (requestCostKnown) {
      knownCostUsd += requestCostUsd;
      usageSamples.push({ ...sample, estimated_total_cost_usd: round(requestCostUsd) });
    } else {
      reserveUnknown(sample, unknownReservationUsd(reportedInputTokens));
    }
    if (!accountingOnly && reconciledCostUsd() > maxInferenceCostUsd + 1e-12) {
      traceLogs.push({ event_type: "provider.cost.exceeded", status: "error", code: "inference_cost_cap_exceeded",
        reconciled_cost_usd: reconciledCostUsd(), hard_cost_cap_usd: maxInferenceCostUsd });
      return result(undefined, "inference_cost_cap_exceeded");
    }
    // Every attempt's output counts against the task's output room.
    remainingOutput -= requestOutput ?? remainingOutput;
    traceLogs.push({ event_type: "provider.response.received", status: "info", response_id: response.id,
      served_model: servedModel, stop_reason: response.stop_reason, chars: rawText.length,
      fallback_ran: lastFallbackIndex(response.content) >= 0 });

    // The stop reason is read before the content. A refusal's partial output is
    // discarded and its tool calls are never run.
    if (response.stop_reason === "refusal") {
      stopDetails = response.stop_details ?? null;
      rawText = "";
      return failWith(new ProviderRefusalError(response.stop_details?.category ?? null, response.id), "anthropic_refused");
    }
    if (response.stop_reason === "max_tokens" || response.stop_reason === "model_context_window_exceeded") {
      return failWith(new ProviderOutputTruncatedError(response.id), "anthropic_output_truncated");
    }
    if (!ACCEPTED_STOP_REASONS.has(String(response.stop_reason))) {
      return failWith(new ProviderUnexpectedStopError(response.stop_reason ?? null, response.id), "anthropic_unexpected_stop_reason");
    }
    if (response.stop_reason === "pause_turn") {
      if (!usageComplete) return result(undefined, "output_correction_usage_unavailable");
      messages.push({ role: "assistant", content: echoContent(response.content) as Anthropic.Beta.BetaContentBlockParam[] });
      continue;
    }

    try { return result((task.definition.output_schema as ZodType<TOutput>).parse(extractJsonPayload(rawText))); }
    catch (error) {
      const receipt = { responseId: response.id, ...outputCorrectionEvidence(rawText, error), usage };
      receipts.push(receipt);
      if (correctionAttempts++ >= (task.definition.max_output_corrections ?? 5)) return result(undefined, "output_correction_limit");
      if (!usageComplete) return result(undefined, "output_correction_usage_unavailable");
      const echoed = echoContent(response.content);
      // A user turn, never a prefilled assistant turn, follows: the
      // conversation always ends with the user.
      messages.push({ role: "assistant", content: echoed.length ? echoed as Anthropic.Beta.BetaContentBlockParam[] : rawText || "(empty response)" },
        { role: "user", content: outputCorrectionPrompt(receipt.issues) });
    }
  }
}
