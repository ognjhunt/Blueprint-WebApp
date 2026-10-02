import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

import type { AgentResult, NormalizedAgentTask } from "../types";
import { outputCorrectionEvidence, outputCorrectionPrompt, usageCount } from "./output-correction";

const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
const anthropicTimeoutMs = Number(process.env.ANTHROPIC_TIMEOUT_MS ?? 20_000);

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

  const traceLogs: Array<Record<string, unknown>> = [
    {
      event_type: "provider.request.prepared",
      status: "info",
      summary: "Prepared Anthropic message request",
      model: task.model,
    },
  ];

  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: task.definition.build_prompt(task.input) }];
  const deadline = Date.now() + anthropicTimeoutMs;
  const receipts: Array<Record<string, unknown>> = [], usageSamples: Array<Record<string, unknown>> = [], providerResponses: Array<Record<string, unknown>> = [];
  let rawText = "", remainingOutput = 4000, promptTokens = 0, completionTokens = 0, usageComplete = true, cachedTokens = 0, cacheWriteTokens = 0;
  const result = (output?: TOutput, error?: string): AgentResult<TOutput> => ({
    status: error ? "failed" : "completed", provider: task.provider, runtime: task.runtime,
    model: task.model, tool_mode: task.tool_policy.mode, ...(output !== undefined ? { output } : {}),
    raw_output_text: rawText, logs: traceLogs, error: error ?? null,
    requires_human_review: Boolean(error) || inferRequiresHumanReview(output), requires_approval: false,
    artifacts: { output_repairs: receipts, usage_samples: usageSamples, provider_responses: providerResponses,
      usage: { prompt_tokens: usageComplete ? promptTokens : null, completion_tokens: usageComplete ? completionTokens : null,
        total_tokens: usageComplete ? promptTokens + completionTokens : null,
        prompt_cache_hit_tokens: cachedTokens, cache_write_tokens: cacheWriteTokens }, output_usage_complete: usageComplete },
  });
  for (let attempt = 0; attempt <= 5; attempt++) {
    if (Date.now() >= deadline || remainingOutput <= 0) return result(undefined, "output_correction_budget_exhausted");
    let response;
    try {
      response = await client.messages.create({ model: task.model, max_tokens: remainingOutput, messages },
        { timeout: Math.max(1, deadline - Date.now()), maxRetries: 0 });
    } catch { return result(undefined, "anthropic_provider_request_failed"); }
    rawText = extractText(response.content);
    const usage = response.usage as unknown as Record<string, unknown>;
    usageSamples.push({ response_id: response.id, ...usage });
    providerResponses.push({ responseId: response.id, content: response.content, usage, stopReason: response.stop_reason });
    const input = usageCount(usage.input_tokens), output = usageCount(usage.output_tokens);
    const cached = usage.cache_read_input_tokens === undefined ? 0 : usageCount(usage.cache_read_input_tokens);
    const written = usage.cache_creation_input_tokens === undefined ? 0 : usageCount(usage.cache_creation_input_tokens);
    if (input === null || output === null || cached === null || written === null) usageComplete = false;
    promptTokens += (input ?? 0) + (cached ?? 0) + (written ?? 0); completionTokens += output ?? 0;
    cachedTokens += cached ?? 0; cacheWriteTokens += written ?? 0;
    remainingOutput -= output ?? remainingOutput;
    traceLogs.push({ event_type: "provider.response.received", status: "info", response_id: response.id, stop_reason: response.stop_reason, chars: rawText.length });
    try { return result((task.definition.output_schema as ZodType<TOutput>).parse(extractJsonPayload(rawText))); }
    catch (error) {
      const receipt = { responseId: response.id, ...outputCorrectionEvidence(rawText, error), usage };
      receipts.push(receipt);
      if (attempt === 5) return result(undefined, "output_correction_limit");
      if (!usageComplete) return result(undefined, "output_correction_usage_unavailable");
      messages.push({ role: "assistant", content: rawText || "(empty response)" },
        { role: "user", content: outputCorrectionPrompt(receipt.issues) });
    }
  }
  return result(undefined, "output_correction_limit");
}
