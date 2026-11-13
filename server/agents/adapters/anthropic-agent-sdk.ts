import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ZodType } from "zod";

import type { AgentResult, NormalizedAgentTask } from "../types";
import { getCompanyHistoryAccess, openAiResponsesHistoryTools, runOperatorTool } from "../operator-tools";
import {
  ANTHROPIC_API_BASE_URL,
  getAnthropicEffort,
  getAnthropicMaxOutputTokens,
  getAnthropicTimeoutMs,
} from "../provider-config";
import {
  classifyProviderError,
  ProviderOutputTruncatedError,
  ProviderRefusalError,
  type ProviderErrorClassification,
} from "../provider-errors";
import { digest } from "../../research-learning/contract";
import { outputCorrectionEvidence, outputCorrectionPrompt, usageCount } from "./output-correction";

type ContentBlock = Anthropic.Beta.BetaContentBlock;
type MessageParam = Anthropic.Beta.BetaMessageParam;
type StreamParams = Parameters<Anthropic["beta"]["messages"]["stream"]>[0];

const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
const anthropicTimeoutMs = getAnthropicTimeoutMs();

// The key and the host are both passed in code: the SDK then reads neither
// ANTHROPIC_AUTH_TOKEN nor ANTHROPIC_BASE_URL nor a profile from disk, so a
// call cannot be sent to another company by an environment setting.
const client = anthropicApiKey
  ? new Anthropic({
      apiKey: anthropicApiKey,
      baseURL: ANTHROPIC_API_BASE_URL,
      timeout: anthropicTimeoutMs,
      maxRetries: 2,
    })
  : null;

/**
 * What the adapter sends for each model. A model in this table takes adaptive
 * thinking, an explicit effort and a JSON-schema output format. A model not in
 * it gets none of the three (a request that names one it cannot take is a
 * 400), and the output is read from text as before; the run says so.
 */
const MODEL_REQUEST_SHAPE: Record<string, { serverFallback: boolean }> = {
  "claude-opus-5-5": { serverFallback: true },
  "claude-opus-5": { serverFallback: true },
  "claude-sonnet-5-5": { serverFallback: true },
  "claude-fable-5-2": { serverFallback: true },
  "claude-opus-4-8": { serverFallback: false },
  "claude-sonnet-5": { serverFallback: false },
  // No server-side fallback exists for this model: a fallback list is a 400.
  "claude-haiku-5-5": { serverFallback: false },
};

/** On a safety decline the API re-runs the same request on the model it
 * recommends for that decline, inside the same call. */
const SERVER_SIDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";

function requestShapeFor(model: string) {
  return MODEL_REQUEST_SHAPE[model.trim().toLowerCase()] ?? null;
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

function extractText(content: ContentBlock[]) {
  return servedContent(content)
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
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
 * bills each attempt), otherwise the top-level usage. */
function usageEntries(usage: Record<string, unknown>) {
  const iterations = Array.isArray(usage.iterations) ? usage.iterations as Array<Record<string, unknown>> : null;
  return iterations && iterations.length ? iterations : [usage];
}

export async function runAnthropicAgentSdkTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
): Promise<AgentResult<TOutput>> {
  if (!client) {
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: "ANTHROPIC_API_KEY is not configured",
      requires_human_review: true,
      requires_approval: false,
    };
  }

  const shape = requestShapeFor(task.model);
  const effort = getAnthropicEffort(task.kind);
  const format = shape ? outputFormatFor(task.definition.output_schema as ZodType<unknown>) : null;
  const traceLogs: Array<Record<string, unknown>> = [
    {
      event_type: "provider.request.prepared",
      status: "info",
      summary: "Prepared Anthropic message request",
      model: task.model,
      request_shape: shape ? "adaptive_thinking_with_effort" : "model_not_in_request_table",
      effort: shape ? effort : null,
      structured_output: format ? "json_schema" : shape ? "schema_not_representable" : "not_sent",
      refusal_fallback: shape?.serverFallback ? "server_side_default" : "none",
    },
  ];

  const messages: MessageParam[] = [{ role: "user", content: task.definition.build_prompt(task.input) }];
  const historyAccess = await getCompanyHistoryAccess(task);
  const historyTools: Anthropic.Beta.BetaTool[] = historyAccess ? openAiResponsesHistoryTools.map(tool => ({
    name: tool.name, description: tool.description, input_schema: tool.parameters as Anthropic.Beta.BetaTool.InputSchema,
  })) : [];
  const historyCalls: Array<Record<string, unknown>> = [];
  const deadline = Date.now() + anthropicTimeoutMs;
  const receipts: Array<Record<string, unknown>> = [], usageSamples: Array<Record<string, unknown>> = [], providerResponses: Array<Record<string, unknown>> = [];
  const servedModels: string[] = [];
  let providerError: ProviderErrorClassification | null = null;
  let stopDetails: unknown = null;
  let rawText = "", remainingOutput = getAnthropicMaxOutputTokens(), promptTokens = 0, completionTokens = 0, usageComplete = true, cachedTokens = 0, cacheWriteTokens = 0;
  const result = (output?: TOutput, error?: string): AgentResult<TOutput> => ({
    status: error ? "failed" : "completed", provider: task.provider, runtime: task.runtime,
    model: task.model, tool_mode: task.tool_policy.mode, ...(output !== undefined ? { output } : {}),
    raw_output_text: rawText, logs: traceLogs, error: error ?? null,
    requires_human_review: Boolean(error) || inferRequiresHumanReview(output), requires_approval: false,
    artifacts: { output_repairs: receipts, usage_samples: usageSamples, provider_responses: providerResponses, company_history_tool_calls: historyCalls,
      served_models: servedModels,
      ...(providerError ? { provider_error: providerError } : {}),
      ...(stopDetails ? { stop_details: stopDetails } : {}),
      usage: { prompt_tokens: usageComplete ? promptTokens : null, completion_tokens: usageComplete ? completionTokens : null,
        total_tokens: usageComplete ? promptTokens + completionTokens : null,
        prompt_cache_hit_tokens: cachedTokens, cache_write_tokens: cacheWriteTokens }, output_usage_complete: usageComplete },
  });
  const failWith = (error: unknown, code: string) => {
    providerError = classifyProviderError(error);
    traceLogs.push({ event_type: "provider.request.failed", status: "error", code, error_class: providerError.error_class,
      http_status: providerError.status, error_type: providerError.type, error_code: providerError.code });
    return result(undefined, code);
  };
  let correctionAttempts = 0;
  while (true) {
    if (Date.now() >= deadline || remainingOutput <= 0) return result(undefined, "output_correction_budget_exhausted");
    const params: StreamParams = {
      model: task.model,
      max_tokens: remainingOutput,
      messages,
      ...(historyTools.length ? { tools: historyTools } : {}),
      ...(shape ? {
        thinking: { type: "adaptive" as const },
        output_config: { effort, ...(format ? { format } : {}) },
      } : {}),
      ...(shape?.serverFallback ? { betas: [SERVER_SIDE_FALLBACK_BETA], fallbacks: "default" as const } : {}),
    };
    let response: Anthropic.Beta.BetaMessage;
    try {
      // Streamed so a large output ceiling cannot run into an HTTP timeout;
      // finalMessage() returns the same message a non-streamed call would.
      response = await client.beta.messages.stream(params,
        { timeout: Math.max(1, deadline - Date.now()), maxRetries: 0 }).finalMessage();
    } catch (error) { return failWith(error, "anthropic_provider_request_failed"); }
    rawText = extractText(response.content);
    const usage = (response.usage ?? {}) as unknown as Record<string, unknown>;
    usageSamples.push({ response_id: response.id, model: response.model ?? null, ...usage });
    providerResponses.push({ responseId: response.id, model: response.model ?? null, content: response.content, usage, stopReason: response.stop_reason });
    if (typeof response.model === "string" && !servedModels.includes(response.model)) servedModels.push(response.model);
    for (const entry of usageEntries(usage)) {
      const input = usageCount(entry.input_tokens), output = usageCount(entry.output_tokens);
      const cached = entry.cache_read_input_tokens === undefined ? 0 : usageCount(entry.cache_read_input_tokens);
      const written = entry.cache_creation_input_tokens === undefined ? 0 : usageCount(entry.cache_creation_input_tokens);
      if (input === null || output === null || cached === null || written === null) usageComplete = false;
      promptTokens += (input ?? 0) + (cached ?? 0) + (written ?? 0); completionTokens += output ?? 0;
      cachedTokens += cached ?? 0; cacheWriteTokens += written ?? 0;
    }
    const answered = usageCount(usage.output_tokens);
    remainingOutput -= answered ?? remainingOutput;
    traceLogs.push({ event_type: "provider.response.received", status: "info", response_id: response.id,
      served_model: response.model ?? null, stop_reason: response.stop_reason, chars: rawText.length,
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
    if (response.stop_reason === "pause_turn") {
      if (!usageComplete) return result(undefined, "output_correction_usage_unavailable");
      messages.push({ role: "assistant", content: echoContent(response.content) as Anthropic.Beta.BetaContentBlockParam[] });
      continue;
    }

    const calls = servedContent(response.content)
      .filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use");
    if (calls.length) {
      if (!usageComplete) return result(undefined, "output_correction_usage_unavailable");
      if (Date.now() >= deadline || remainingOutput <= 0) return result(undefined, "output_correction_budget_exhausted");
      messages.push({ role: "assistant", content: echoContent(response.content) as Anthropic.Beta.BetaContentBlockParam[] });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const call of calls) {
        let value: unknown, isError = false;
        try {
          if (!historyAccess || !historyTools.some(tool => tool.name === call.name)) throw new Error("company_history_tool_not_allowed");
          if (!call.input || typeof call.input !== "object" || Array.isArray(call.input)) throw new Error("company_history_tool_arguments_invalid");
          value = await runOperatorTool(call.name, call.input as Record<string, unknown>, historyAccess);
          isError = Boolean(value && typeof value === "object" && "ok" in value && value.ok === false);
        } catch {
          isError = true;
          value = { error: "company_history_tool_failed", repair: "Use an advertised read-only history tool and its query/filters/page_size/cursor or record_id schema; access is server-controlled." };
        }
        const retained = structuredClone({ args: call.input ?? null, result: value ?? null });
        historyCalls.push({ tool_call_id: call.id, name: call.name, status: isError ? "error" : "completed",
          result_status: isError ? "error" : "completed", ...retained,
          args_sha256: digest(retained.args), result_sha256: digest(retained.result) });
        results.push({ type: "tool_result", tool_use_id: call.id, content: JSON.stringify(value), ...(isError ? { is_error: true } : {}) });
      }
      messages.push({ role: "user", content: results });
      continue;
    }
    try { return result((task.definition.output_schema as ZodType<TOutput>).parse(extractJsonPayload(rawText))); }
    catch (error) {
      const receipt = { responseId: response.id, ...outputCorrectionEvidence(rawText, error), usage };
      receipts.push(receipt);
      if (correctionAttempts++ === 5) return result(undefined, "output_correction_limit");
      if (!usageComplete) return result(undefined, "output_correction_usage_unavailable");
      const echoed = echoContent(response.content);
      // A user turn, never a prefilled assistant turn, follows: the
      // conversation always ends with the user.
      messages.push({ role: "assistant", content: echoed.length ? echoed as Anthropic.Beta.BetaContentBlockParam[] : rawText || "(empty response)" },
        { role: "user", content: outputCorrectionPrompt(receipt.issues) });
    }
  }
}
