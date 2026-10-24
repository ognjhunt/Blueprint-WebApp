import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

import type { AgentResult, NormalizedAgentTask } from "../types";
import { getCompanyHistoryAccess, openAiResponsesHistoryTools, runOperatorTool } from "../operator-tools";
import { digest } from "../../research-learning/contract";
import { outputCorrectionEvidence, outputCorrectionPrompt, usageCount } from "./output-correction";
import { ANTHROPIC_BASE_URL, HAIKU_MODEL, haikuUsageCost, isNativeAnthropicConfigured } from "../../utils/anthropicHaikuPricing";
import { getAnthropicTimeoutMs } from "../provider-config";

const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
const anthropicTimeoutMs = getAnthropicTimeoutMs();

const client = anthropicApiKey
  ? new Anthropic({
      apiKey: anthropicApiKey,
      timeout: anthropicTimeoutMs,
      maxRetries: 2,
    })
  : null;

function extractText(content: Anthropic.Messages.ContentBlock[]) {
  return content
    .map((block) => ("text" in block ? block.text : ""))
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

export async function runAnthropicAgentSdkTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
): Promise<AgentResult<TOutput>> {
  const haiku = task.model === HAIKU_MODEL;
  if (!client || (haiku && !isNativeAnthropicConfigured())) {
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: haiku ? "Native Anthropic credentials or endpoint are not configured" : "ANTHROPIC_API_KEY is not configured",
      requires_human_review: true,
      requires_approval: false,
    };
  }

  const traceLogs: Array<Record<string, unknown>> = [
    {
      event_type: "provider.request.prepared",
      status: "info",
      summary: "Prepared Anthropic message request",
      model: task.model,
    },
  ];

  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: task.definition.build_prompt(task.input) }];
  const historyAccess = await getCompanyHistoryAccess(task);
  const historyTools: Anthropic.Messages.Tool[] = historyAccess ? openAiResponsesHistoryTools.map(tool => ({
    name: tool.name, description: tool.description, input_schema: tool.parameters,
  })) : [];
  const historyCalls: Array<Record<string, unknown>> = [];
  const requestClient = haiku ? new Anthropic({ apiKey: anthropicApiKey!, baseURL: ANTHROPIC_BASE_URL,
    timeout: getAnthropicTimeoutMs(task.model), maxRetries: 0,
    fetch: (url, options) => fetch(url, { ...options, redirect: "error" }) }) : client;
  const deadline = Date.now() + getAnthropicTimeoutMs(task.model);
  const receipts: Array<Record<string, unknown>> = [], usageSamples: Array<Record<string, unknown>> = [], providerResponses: Array<Record<string, unknown>> = [];
  let rawText = "", remainingOutput = haiku ? 16_000 : 4000, promptTokens = 0, completionTokens = 0, usageComplete = true, cachedTokens = 0, cacheWriteTokens = 0;
  let costComplete = true, reservedCost = 0, uncachedInputCost = 0, cachedReadCost = 0, cacheWriteCost = 0, outputCost = 0;
  const projectedMaxCost = (100_000 * 0.5 + 16_000 * 2.5) * 1.1 / 1_000_000;
  let unknownCalls = 0;
  let withoutCachingCost = 0;
  const maximumCost = 5;
  const result = (output?: TOutput, error?: string): AgentResult<TOutput> => ({
    status: error ? "failed" : "completed", provider: task.provider, runtime: task.runtime,
    model: task.model, tool_mode: task.tool_policy.mode, ...(output !== undefined ? { output } : {}),
    raw_output_text: rawText, logs: traceLogs, error: error ?? null,
    requires_human_review: Boolean(error) || inferRequiresHumanReview(output), requires_approval: false,
    artifacts: { output_repairs: receipts, usage_samples: usageSamples, provider_responses: providerResponses, company_history_tool_calls: historyCalls,
      usage: { prompt_tokens: usageComplete ? promptTokens : null, completion_tokens: usageComplete ? completionTokens : null,
        total_tokens: usageComplete ? promptTokens + completionTokens : null,
        prompt_cache_hit_tokens: cachedTokens, cache_write_tokens: cacheWriteTokens,
        ...(haiku ? { estimated_total_cost_usd: costComplete ? uncachedInputCost + cachedReadCost + cacheWriteCost + outputCost : null,
          uncached_input_cost_usd: costComplete ? uncachedInputCost : null, cached_read_cost_usd: costComplete ? cachedReadCost : null,
          cache_write_cost_usd: costComplete ? cacheWriteCost : null, output_cost_usd: costComplete ? outputCost : null,
          estimated_cost_without_caching_usd: costComplete ? withoutCachingCost : null,
          estimated_savings_usd: costComplete ? withoutCachingCost - uncachedInputCost - cachedReadCost - cacheWriteCost - outputCost : null,
          cost_status: costComplete ? "model_pricing_estimate_not_official_billing" : "provider_usage_unknown" } : {}) },
      ...(haiku ? { inference_budget: { maximum_cost_usd: maximumCost, reserved_cost_usd: reservedCost,
        maximum_input_tokens_per_call: 100_000, maximum_output_tokens_total: 16_000 },
        known_usage_subtotals: { estimated_total_cost_usd: uncachedInputCost + cachedReadCost + cacheWriteCost + outputCost },
        inference_reservation: { reconciled_cost_status: "includes_worst_case_reservations",
          known_reported_cost_usd: uncachedInputCost + cachedReadCost + cacheWriteCost + outputCost,
          unknown_usage_reserved_cost_usd: unknownCalls * projectedMaxCost,
          projected_max_cost_per_call_usd: projectedMaxCost,
          reconciled_cost_usd: uncachedInputCost + cachedReadCost + cacheWriteCost + outputCost + unknownCalls * projectedMaxCost } } : {}), output_usage_complete: usageComplete },
  });
  let correctionAttempts = 0;
  while (true) {
    if (Date.now() >= deadline || remainingOutput <= 0) return result(undefined, "output_correction_budget_exhausted");
    if (haiku) {
      // UTF-8 bytes plus framing margin are deliberately conservative for text/tools.
      const inputBound = Buffer.byteLength(JSON.stringify({ messages, tools: historyTools }), "utf8") + 8192;
      if (inputBound > 100_000) return result(undefined, "anthropic_input_budget_exhausted");
      const quote = projectedMaxCost;
      if (reservedCost + quote > maximumCost) return result(undefined, "anthropic_cost_budget_exhausted");
      reservedCost += quote;
    }
    let response;
    try {
      response = await requestClient.messages.create({ model: task.model, max_tokens: remainingOutput, messages,
        ...(haiku ? { output_config: { effort: task.kind === "inbound_qualification" ? "max" : "medium" } } : {}),
        ...(historyTools.length ? { tools: historyTools } : {}) },
        { timeout: Math.max(1, deadline - Date.now()), maxRetries: 0 });
    } catch {
      if (haiku) {
        costComplete = false; usageComplete = false; unknownCalls++;
        usageSamples.push({ estimated_total_cost_usd: null, request_status: "request_attempted_response_unreceived" });
        providerResponses.push({ responseId: null, usage: null, request_status: "request_attempted_response_unreceived" });
      }
      return result(undefined, "anthropic_provider_request_failed");
    }
    const validContent = Array.isArray(response.content) && response.content.every(block => block && typeof block === "object"
      && ["text", "thinking", "redacted_thinking", "tool_use"].includes(block.type));
    rawText = validContent ? extractText(response.content) : "";
    const usage = (response.usage ?? {}) as unknown as Record<string, unknown>;
    const withinBounds = typeof usage.input_tokens === "number" && typeof usage.output_tokens === "number"
      && usage.input_tokens + Number(usage.cache_read_input_tokens ?? 0) + Number(usage.cache_creation_input_tokens ?? 0) <= 100_000
      && usage.output_tokens <= remainingOutput;
    const cost = haiku && response.model === HAIKU_MODEL && withinBounds ? haikuUsageCost(usage) : null;
    if (haiku && !cost) { costComplete = false; unknownCalls++; }
    if (cost) { uncachedInputCost += cost.uncachedInputCost; cachedReadCost += cost.cachedReadCost;
      cacheWriteCost += cost.cacheWriteCost; outputCost += cost.outputCost; withoutCachingCost += cost.withoutCachingCost; }
    usageSamples.push({ response_id: response.id, ...usage, ...(haiku ? { estimated_total_cost_usd: cost?.totalCost ?? null } : {}) });
    providerResponses.push({ responseId: response.id, content: response.content, usage, stopReason: response.stop_reason });
    const input = usageCount(usage.input_tokens), output = usageCount(usage.output_tokens);
    const cached = usage.cache_read_input_tokens === undefined ? 0 : usageCount(usage.cache_read_input_tokens);
    const written = usage.cache_creation_input_tokens === undefined ? 0 : usageCount(usage.cache_creation_input_tokens);
    if (input === null || output === null || cached === null || written === null) usageComplete = false;
    promptTokens += (input ?? 0) + (cached ?? 0) + (written ?? 0); completionTokens += output ?? 0;
    cachedTokens += cached ?? 0; cacheWriteTokens += written ?? 0;
    remainingOutput -= output ?? remainingOutput;
    if (haiku && !validContent) return result(undefined, "anthropic_response_content_invalid");
    if (haiku && response.model !== HAIKU_MODEL) { costComplete = false; return result(undefined, "anthropic_response_model_mismatch"); }
    if (haiku && ((input ?? 0) + (cached ?? 0) + (written ?? 0) > 100_000 || remainingOutput < 0)) {
      costComplete = false;
      return result(undefined, "anthropic_usage_exceeds_budget");
    }
    if (haiku && !["end_turn", "tool_use"].includes(String(response.stop_reason))) return result(undefined, "anthropic_response_incomplete");
    if (haiku && (!costComplete || !usageComplete)) return result(undefined, "anthropic_usage_unavailable");
    traceLogs.push({ event_type: "provider.response.received", status: "info", response_id: response.id, stop_reason: response.stop_reason, chars: rawText.length });
    const calls = response.content.filter((block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use");
    if (haiku && ((response.stop_reason === "tool_use") !== (calls.length > 0)
        || new Set(calls.map(call => call.id)).size !== calls.length || calls.some(call => !call.id))) {
      return result(undefined, "anthropic_tool_identity_invalid");
    }
    if (calls.length) {
      if (!usageComplete) return result(undefined, "output_correction_usage_unavailable");
      if (Date.now() >= deadline || remainingOutput <= 0) return result(undefined, "output_correction_budget_exhausted");
      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.Messages.ToolResultBlockParam[] = [];
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
      messages.push({ role: "assistant", content: response.content.length ? response.content : rawText || "(empty response)" },
        { role: "user", content: outputCorrectionPrompt(receipt.issues) });
    }
  }
}
