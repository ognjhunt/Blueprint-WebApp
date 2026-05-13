import OpenAI from "openai";
import type { ZodType } from "zod";

import { chatCompletionOperatorTools, runOperatorTool } from "../operator-tools";
import type { AgentResult, AgentTaskKind, NormalizedAgentTask } from "../types";

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const OPENROUTER_BASE_URL_PATTERN = /openrouter\.ai/i;
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_DEEPSEEK_MAX_TOKENS = 2000;
const DEFAULT_OPENROUTER_PROVIDER_ORDER = [
  "deepseek",
  "atlas-cloud/fp8",
  "novita",
  "siliconflow/fp8",
] as const;
const DEFAULT_OPENROUTER_PROVIDER_IGNORE = [
  "parasail",
  "parasail/fp8",
  "akashml",
  "akashml/fp8",
  "deepinfra",
  "deepinfra/fp4",
] as const;
const DEEPSEEK_STRUCTURED_SYSTEM_PROMPT =
  "You are Blueprint's structured agent runtime. Return only valid JSON matching the requested schema. Keep outputs concise. Keep stable instructions in this system message so DeepSeek context caching can reuse common prefixes.";

const deepSeekApiKey = process.env.DEEPSEEK_API_KEY?.trim();
const deepSeekBaseUrl =
  process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_DEEPSEEK_BASE_URL;
const deepSeekTimeoutMs = Number(process.env.DEEPSEEK_TIMEOUT_MS ?? 120_000);
const deepSeekMaxTokens = Number(
  process.env.DEEPSEEK_MAX_TOKENS ?? DEFAULT_DEEPSEEK_MAX_TOKENS,
);

const client = deepSeekApiKey
  ? new OpenAI({
      apiKey: deepSeekApiKey,
      baseURL: deepSeekBaseUrl,
      maxRetries: 2,
      timeout: deepSeekTimeoutMs,
    })
  : null;

function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("DeepSeek returned an empty response");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("DeepSeek returned non-JSON output");
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

function defaultThinkingForTask(kind: AgentTaskKind) {
  return kind === "operator_thread" || kind === "external_harness_thread" ? "enabled" : "disabled";
}

function defaultReasoningEffortForTask(kind: AgentTaskKind) {
  if (kind === "operator_thread" || kind === "external_harness_thread") return "max";
  if (kind === "preview_diagnosis" || kind === "payout_exception_triage") return "high";
  return "low";
}

function deepSeekThinkingType(kind: AgentTaskKind) {
  const configured = String(process.env.DEEPSEEK_THINKING ?? defaultThinkingForTask(kind))
    .trim()
    .toLowerCase();
  return configured === "0" ||
    configured === "false" ||
    configured === "no" ||
    configured === "off" ||
    configured === "disabled"
    ? "disabled"
    : "enabled";
}

function deepSeekReasoningEffort(kind: AgentTaskKind) {
  const configured = String(process.env.DEEPSEEK_REASONING_EFFORT ?? defaultReasoningEffortForTask(kind))
    .trim()
    .toLowerCase();
  if (configured === "xhigh") return "max";
  if (configured === "low" || configured === "medium" || configured === "high" || configured === "max") {
    return configured;
  }
  return defaultReasoningEffortForTask(kind);
}

function extractRawText(message: unknown) {
  const content = (message as { content?: unknown } | null)?.content;
  return typeof content === "string" ? content.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function usageNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function usageNumberOrNull(value: unknown) {
  return usageNumber(value);
}

function isOpenRouterRoute() {
  return OPENROUTER_BASE_URL_PATTERN.test(deepSeekBaseUrl);
}

function parseEnvList(envKey: string, fallback: readonly string[]) {
  const raw = process.env[envKey];
  if (!raw || raw.trim().length === 0) return [...fallback];
  const parsed = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? parsed : [...fallback];
}

function parseEnvBoolean(envKey: string, fallback: boolean) {
  const raw = process.env[envKey];
  if (!raw || raw.trim().length === 0) return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

function inferRoute(model: string, response?: unknown) {
  if (isOpenRouterRoute()) return "deepseek_via_openrouter";
  const responseModel = asRecord(response)?.model;
  const modelValue = typeof responseModel === "string" ? responseModel : model;
  if (/^deepseek\//i.test(modelValue)) return "deepseek_via_openrouter";
  return "deepseek_official_direct";
}

function openRouterProviderPreferences(model: string) {
  const route = inferRoute(model);
  if (route !== "deepseek_via_openrouter") return null;
  const order = parseEnvList("DEEPSEEK_OPENROUTER_PROVIDER_ORDER", DEFAULT_OPENROUTER_PROVIDER_ORDER);
  return {
    only: parseEnvList("DEEPSEEK_OPENROUTER_PROVIDER_ONLY", order),
    order,
    ignore: parseEnvList("DEEPSEEK_OPENROUTER_PROVIDER_IGNORE", DEFAULT_OPENROUTER_PROVIDER_IGNORE),
    allow_fallbacks: parseEnvBoolean("DEEPSEEK_OPENROUTER_ALLOW_FALLBACKS", false),
  };
}

function extractProviderMetadata(response: unknown) {
  const record = asRecord(response) || {};
  return {
    model: typeof record.model === "string" ? record.model : null,
    provider: typeof record.provider === "string" ? record.provider : null,
    provider_routing: asRecord(record.provider_routing) || asRecord(record.providerRouting),
    provider_metadata:
      asRecord(record.provider_metadata) ||
      asRecord(record.providerMetadata) ||
      asRecord(record.provider),
  };
}

function extractUsage(response: unknown) {
  const usage = asRecord((response as { usage?: unknown } | null)?.usage);
  if (!usage || typeof usage !== "object") {
    return null;
  }
  const promptTokensDetails = asRecord(usage.prompt_tokens_details);
  const completionTokensDetails = asRecord(usage.completion_tokens_details);
  const costDetails = asRecord(usage.cost_details);
  const promptTokens = usageNumberOrNull(usage.prompt_tokens);
  const cachedTokens = usageNumberOrNull(
    promptTokensDetails?.cached_tokens ?? usage.cached_tokens ?? usage.cached_input_tokens,
  );
  const directHitTokens = usageNumberOrNull(usage.prompt_cache_hit_tokens);
  const directMissTokens = usageNumberOrNull(usage.prompt_cache_miss_tokens);
  const completionTokens = usageNumberOrNull(usage.completion_tokens);
  const reasoningTokens = usageNumberOrNull(
    completionTokensDetails?.reasoning_tokens ?? usage.reasoning_tokens,
  );
  const totalTokens = usageNumberOrNull(usage.total_tokens);
  const costUsd = usageNumberOrNull(usage.cost ?? usage.cost_usd ?? usage.costUsd);
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    prompt_cache_hit_tokens: directHitTokens,
    prompt_cache_miss_tokens: directMissTokens,
    cached_tokens: cachedTokens,
    cache_write_tokens: usageNumberOrNull(
      promptTokensDetails?.cache_write_tokens ?? usage.cache_write_tokens,
    ),
    reasoning_tokens: reasoningTokens,
    cost_usd: costUsd,
    prompt_tokens_details: promptTokensDetails,
    completion_tokens_details: completionTokensDetails,
    cost_details: costDetails,
  };
}

function promptCacheHitRatio(usage: ReturnType<typeof extractUsage>) {
  const hit = usageNumber(usage?.cached_tokens ?? usage?.prompt_cache_hit_tokens);
  const miss = usageNumber(usage?.prompt_cache_miss_tokens);
  const promptTokens = usageNumber(usage?.prompt_tokens);
  if (hit !== null && promptTokens !== null && promptTokens > 0) {
    return hit / promptTokens;
  }
  if (hit === null || miss === null) return null;
  const total = hit + miss;
  return total > 0 ? hit / total : null;
}

type ExtractedUsage = NonNullable<ReturnType<typeof extractUsage>>;

function sumNullable(values: Array<number | null | undefined>) {
  const finiteValues = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finiteValues.length === 0) return null;
  const sum = finiteValues.reduce((total, value) => total + value, 0);
  return Number(sum.toFixed(12));
}

function aggregateUsage(usages: ExtractedUsage[]) {
  const promptTokens = sumNullable(usages.map((usage) => usage.prompt_tokens));
  const completionTokens = sumNullable(usages.map((usage) => usage.completion_tokens));
  const totalTokens =
    sumNullable(usages.map((usage) => usage.total_tokens)) ??
    (promptTokens !== null || completionTokens !== null
      ? (promptTokens || 0) + (completionTokens || 0)
      : null);
  const cachedTokens = sumNullable(
    usages.map((usage) => usage.cached_tokens ?? usage.prompt_cache_hit_tokens),
  );
  const promptCacheMissTokens = sumNullable(usages.map((usage) => usage.prompt_cache_miss_tokens));
  const cacheWriteTokens = sumNullable(usages.map((usage) => usage.cache_write_tokens));
  const reasoningTokens = sumNullable(usages.map((usage) => usage.reasoning_tokens));
  const costUsd = sumNullable(usages.map((usage) => usage.cost_usd));
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    prompt_cache_hit_tokens: cachedTokens,
    prompt_cache_miss_tokens: promptCacheMissTokens,
    cached_tokens: cachedTokens,
    cache_write_tokens: cacheWriteTokens,
    reasoning_tokens: reasoningTokens,
    cost_usd: costUsd,
    prompt_cache_hit_ratio:
      cachedTokens !== null && promptTokens !== null && promptTokens > 0
        ? cachedTokens / promptTokens
        : promptCacheHitRatio({
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
            prompt_cache_hit_tokens: cachedTokens,
            prompt_cache_miss_tokens: promptCacheMissTokens,
            cached_tokens: cachedTokens,
            cache_write_tokens: cacheWriteTokens,
            reasoning_tokens: reasoningTokens,
            cost_usd: costUsd,
            prompt_tokens_details: null,
            completion_tokens_details: null,
            cost_details: null,
          }),
    calls: usages.length,
  };
}

async function createDeepSeekCompletion(params: {
  model: string;
  messages: any[];
  tools?: any[];
  taskKind: AgentTaskKind;
}) {
  if (!client) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }
  const providerPreferences = openRouterProviderPreferences(params.model);

  return (client.chat.completions.create as any)({
    model: params.model || DEFAULT_DEEPSEEK_MODEL,
    messages: params.messages,
    tools: params.tools,
    tool_choice: params.tools ? "auto" : undefined,
    response_format: {
      type: "json_object",
    },
    max_tokens: deepSeekMaxTokens,
    extra_body: {
      thinking: {
        type: deepSeekThinkingType(params.taskKind),
      },
    },
    reasoning_effort: deepSeekReasoningEffort(params.taskKind),
    ...(providerPreferences ? { provider: providerPreferences } : {}),
    stream: false,
  });
}

export async function runDeepSeekChatTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
): Promise<AgentResult<TOutput>> {
  if (!client) {
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: "DEEPSEEK_API_KEY is not configured",
      requires_human_review: true,
      requires_approval: false,
    };
  }

  const tools = task.kind === "operator_thread" ? chatCompletionOperatorTools : undefined;
  const messages: any[] = [
    {
      role: "system",
      content: DEEPSEEK_STRUCTURED_SYSTEM_PROMPT,
    },
    {
      role: "user",
      content: task.definition.build_prompt(task.input),
    },
  ];
  const providerPreferences = openRouterProviderPreferences(task.model);
  const traceLogs: Array<Record<string, unknown>> = [
    {
      event_type: "provider.request.prepared",
      status: "info",
      summary: "Prepared DeepSeek Chat Completions request",
      provider: task.provider,
      model: task.model,
      base_url: deepSeekBaseUrl,
      route: inferRoute(task.model),
      response_cache_policy: "not_enabled_for_live_runtime",
      max_tokens: deepSeekMaxTokens,
      thinking: deepSeekThinkingType(task.kind),
      reasoning_effort: deepSeekReasoningEffort(task.kind),
      openrouter_provider_preferences: providerPreferences,
    },
  ];

  const usageSamples: ExtractedUsage[] = [];
  const generationIds: string[] = [];
  let response = await createDeepSeekCompletion({
    model: task.model,
    messages,
    tools,
    taskKind: task.kind,
  });
  const initialUsage = extractUsage(response);
  if (initialUsage) usageSamples.push(initialUsage);
  if ((response as any).id) generationIds.push((response as any).id);
  traceLogs.push({
    event_type: "provider.response.created",
    status: "info",
    summary: "Created DeepSeek response",
    response_id: (response as any).id || null,
    route: inferRoute(task.model, response),
    provider_metadata: extractProviderMetadata(response),
    usage: initialUsage,
  });

  let toolIterations = 0;
  while (tools && toolIterations < 5) {
    const message = response.choices?.[0]?.message;
    const toolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
    if (toolCalls.length === 0) {
      break;
    }

    messages.push(message);
    for (const call of toolCalls) {
      const toolName = call.function?.name;
      if (!toolName) {
        throw new Error("DeepSeek returned a tool call without a function name");
      }
      const args =
        typeof call.function?.arguments === "string" &&
        call.function.arguments.trim().length > 0
          ? JSON.parse(call.function.arguments)
          : {};
      traceLogs.push({
        event_type: "tool.call",
        status: "info",
        summary: `Invoked ${toolName}`,
        tool_name: toolName,
        tool_args: args,
        call_id: call.id,
      });
      const result = await runOperatorTool(toolName, args);
      traceLogs.push({
        event_type: "tool.result",
        status: "success",
        summary: `Completed ${toolName}`,
        tool_name: toolName,
        call_id: call.id,
        tool_result: result,
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }

    response = await createDeepSeekCompletion({
      model: task.model,
      messages,
      tools,
      taskKind: task.kind,
    });
    const followUpUsage = extractUsage(response);
    if (followUpUsage) usageSamples.push(followUpUsage);
    if ((response as any).id) generationIds.push((response as any).id);
    traceLogs.push({
      event_type: "provider.response.created",
      status: "info",
      summary: "Created follow-up DeepSeek response",
      response_id: (response as any).id || null,
      iteration: toolIterations + 1,
      route: inferRoute(task.model, response),
      provider_metadata: extractProviderMetadata(response),
      usage: followUpUsage,
    });
    toolIterations += 1;
  }

  const rawText = extractRawText(response.choices?.[0]?.message);
  const finalUsage = extractUsage(response);
  const aggregate = aggregateUsage(usageSamples);
  const providerMetadata = extractProviderMetadata(response);
  const route = inferRoute(task.model, response);
  traceLogs.push({
    event_type: "provider.telemetry.aggregated",
    status: "info",
    summary: "Aggregated DeepSeek usage telemetry",
    route,
    generation_ids: generationIds,
    usage: aggregate,
  });
  traceLogs.push({
    event_type: "provider.response.extracted_text",
    status: "info",
    summary: "Extracted DeepSeek response text",
    chars: rawText.length,
  });
  const payload = extractJsonPayload(rawText);
  traceLogs.push({
    event_type: "provider.response.parsed",
    status: "success",
    summary: "Parsed DeepSeek JSON payload",
  });
  const parsed = (task.definition.output_schema as ZodType<TOutput>).parse(
    payload,
  );
  traceLogs.push({
    event_type: "provider.schema.validated",
    status: "success",
    summary: "Validated DeepSeek output against schema",
  });

  return {
    status: "completed",
    provider: task.provider,
    runtime: task.runtime,
    model: task.model,
    tool_mode: task.tool_policy.mode,
    output: parsed,
    raw_output_text: rawText,
    artifacts: {
      provider: task.provider,
      model: task.model,
      route,
      generation_id: (response as any).id || null,
      deepseek_response_id: (response as any).id || null,
      openrouter_generation_id: route === "deepseek_via_openrouter" ? (response as any).id || null : null,
      openrouter_model: route === "deepseek_via_openrouter" ? providerMetadata.model : null,
      openrouter_provider: route === "deepseek_via_openrouter" ? providerMetadata.provider : null,
      openrouter_provider_routing:
        route === "deepseek_via_openrouter" ? providerMetadata.provider_routing : null,
      openrouter_provider_preferences:
        route === "deepseek_via_openrouter" ? providerPreferences : null,
      deepseek_base_url: deepSeekBaseUrl,
      max_tokens: deepSeekMaxTokens,
      thinking: deepSeekThinkingType(task.kind),
      reasoning_effort: deepSeekReasoningEffort(task.kind),
      prompt_tokens: aggregate.prompt_tokens ?? finalUsage?.prompt_tokens ?? null,
      completion_tokens: aggregate.completion_tokens ?? finalUsage?.completion_tokens ?? null,
      total_tokens: aggregate.total_tokens ?? finalUsage?.total_tokens ?? null,
      prompt_cache_hit_tokens: aggregate.prompt_cache_hit_tokens ?? finalUsage?.prompt_cache_hit_tokens ?? null,
      prompt_cache_miss_tokens:
        aggregate.prompt_cache_miss_tokens ?? finalUsage?.prompt_cache_miss_tokens ?? null,
      cached_tokens: aggregate.cached_tokens ?? finalUsage?.cached_tokens ?? null,
      cache_write_tokens: aggregate.cache_write_tokens ?? finalUsage?.cache_write_tokens ?? null,
      reasoning_tokens: aggregate.reasoning_tokens ?? finalUsage?.reasoning_tokens ?? null,
      cost_usd: aggregate.cost_usd ?? finalUsage?.cost_usd ?? null,
      cost_details: finalUsage?.cost_details ?? null,
      prompt_tokens_details: finalUsage?.prompt_tokens_details ?? null,
      completion_tokens_details: finalUsage?.completion_tokens_details ?? null,
      prompt_cache_hit_ratio: aggregate.prompt_cache_hit_ratio,
      calls: aggregate.calls,
      tool_iterations: toolIterations,
      response_cache: {
        enabled: false,
        reason: "X-OpenRouter-Cache is intentionally not enabled for live structured-agent runs.",
      },
    },
    logs: traceLogs,
    requires_human_review: inferRequiresHumanReview(parsed),
    requires_approval: false,
  };
}
