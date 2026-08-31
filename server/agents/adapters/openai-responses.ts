import { createHash } from "node:crypto";

import OpenAI from "openai";
import type { ZodType } from "zod";

import { openAiResponsesOperatorTools, runOperatorTool } from "../operator-tools";
import type { AgentResult, NormalizedAgentTask } from "../types";
import {
  buildExplicitOpenAIRequest,
  cachePolicyEvidence,
  conservativeOpenAIInputTokenCeiling,
  normalizeOpenAIUsage,
  stableAgentDeveloperPrefix,
  worstCaseOpenAIReservationUsd,
} from "../../utils/openaiPromptCache";

function countPromptCacheBreakpoints(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + countPromptCacheBreakpoints(item), 0);
  }
  if (!value || typeof value !== "object") return 0;
  return Object.entries(value as Record<string, unknown>).reduce(
    (sum, [key, item]) => sum + (key === "prompt_cache_breakpoint" ? 1 : 0)
      + countPromptCacheBreakpoints(item),
    0,
  );
}

function replayInputMatchesPolicy(input: unknown[], taskKind: string, enabled: boolean) {
  if (!enabled || input.length === 0 || countPromptCacheBreakpoints(input) !== 1) return false;
  const first = input[0] as Record<string, unknown> | undefined;
  if (!first || first.role !== "developer" || !Array.isArray(first.content)) return false;
  if (first.content.length !== 1) return false;
  const content = first.content[0] as Record<string, unknown> | undefined;
  return Boolean(
    content
    && content.type === "input_text"
    && content.text === stableAgentDeveloperPrefix(taskKind)
    && (content.prompt_cache_breakpoint as Record<string, unknown> | undefined)?.mode === "explicit",
  );
}

const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
const openAiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 20_000);

function boundedPositiveNumber(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

const openAiMaxInputTokens = Math.floor(boundedPositiveNumber(
  process.env.BLUEPRINT_OPENAI_AGENT_MAX_INPUT_TOKENS,
  100_000,
  1_000_000,
));
const openAiMaxOutputTokens = Math.floor(boundedPositiveNumber(
  process.env.BLUEPRINT_OPENAI_AGENT_MAX_OUTPUT_TOKENS,
  4_000,
  128_000,
));
const openAiMaxInferenceCostUsd = boundedPositiveNumber(
  process.env.BLUEPRINT_OPENAI_AGENT_MAX_INFERENCE_COST_USD,
  5,
  100,
);

const client = openAiApiKey
  ? new OpenAI({
      apiKey: openAiApiKey,
      maxRetries: 0,
      timeout: openAiTimeoutMs,
    })
  : null;

function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("OpenAI returned an empty response");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("OpenAI returned non-JSON output");
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

export async function runOpenAIResponsesTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
): Promise<AgentResult<TOutput>> {
  if (!client) {
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: "OPENAI_API_KEY is not configured",
      requires_human_review: true,
      requires_approval: false,
    };
  }

  const tools = task.kind === "operator_thread" ? openAiResponsesOperatorTools : undefined;
  const traceLogs: Array<Record<string, unknown>> = [];
  const previousResponseId =
    task.session_policy.lane === "session" &&
    task.metadata &&
    typeof task.metadata === "object" &&
    typeof (task.metadata as Record<string, unknown>).previous_response_id === "string"
      ? String((task.metadata as Record<string, unknown>).previous_response_id)
      : undefined;

  const dynamicPrompt = task.definition.build_prompt(task.input);
  const metadata = task.metadata && typeof task.metadata === "object"
    ? task.metadata as Record<string, unknown>
    : {};
  const declaredReuseCount = Number(metadata.expected_prompt_cache_reuse_count ?? 0);
  const declaredReuseProbability = Number(
    metadata.expected_prompt_cache_reuse_probability ?? 0,
  );
  const expectedReuseCount = Number.isInteger(declaredReuseCount) && declaredReuseCount > 0
    ? Math.min(declaredReuseCount, 20)
    : 0;
  const expectedReuseProbability = Number.isFinite(declaredReuseProbability)
    && declaredReuseProbability >= 0
    && declaredReuseProbability <= 1
    ? declaredReuseProbability
    : 0;
  const { policy: cachePolicy, request: cacheRequest } = buildExplicitOpenAIRequest({
    model: task.model,
    taskKind: task.kind,
    dynamicPrompt,
    tools,
    expectedReuseCount,
    expectedReuseProbability,
  });
  const replayInput = Array.isArray(metadata.openai_replay_input)
    ? metadata.openai_replay_input as any[]
    : null;
  if (replayInput && !replayInputMatchesPolicy(
    replayInput,
    task.kind,
    cachePolicy.status === "enabled",
  )) {
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: "OpenAI replay state is stale or violates the explicit breakpoint contract",
      requires_human_review: true,
      requires_approval: false,
    };
  }
  if (
    previousResponseId
    && !replayInput
    && cachePolicy.model_family.startsWith("gpt-5.6")
  ) {
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: "Legacy previous_response_id session requires a fresh store-false replay session",
      requires_human_review: true,
      requires_approval: false,
    };
  }
  const activeCachePolicy = cachePolicy;
  const cacheInput = cacheRequest.input;
  const initialInput: any = replayInput
    ? [...replayInput, { role: "user", content: dynamicPrompt }]
    : cacheInput;
  const { input: _unusedCacheInput, ...baseCacheControls } = cacheRequest;
  const initialCacheControls = baseCacheControls;
  const actualInputBytes = conservativeOpenAIInputTokenCeiling(initialInput, tools);
  if (actualInputBytes > openAiMaxInputTokens) {
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: "OpenAI input exceeds the declared conservative token ceiling",
      requires_human_review: true,
      requires_approval: false,
    };
  }
  const projectedMaxCostUsd = worstCaseOpenAIReservationUsd({
    model: task.model,
    inputTokenCeiling: openAiMaxInputTokens,
    maxOutputTokens: openAiMaxOutputTokens,
    policy: activeCachePolicy,
  });
  if (projectedMaxCostUsd > openAiMaxInferenceCostUsd) {
    return {
      status: "failed",
      provider: task.provider,
      runtime: task.runtime,
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: "OpenAI worst-case inference reservation exceeds the configured cost cap",
      requires_human_review: true,
      requires_approval: false,
    };
  }
  let conversationInput: any[] = Array.isArray(initialInput)
    ? [...initialInput]
    : [{ role: "user", content: initialInput }];
  let response = await client.responses.create({
    model: task.model,
    previous_response_id: replayInput ? undefined : previousResponseId,
    reasoning: {
      effort: "medium",
    },
    tools,
    parallel_tool_calls: true,
    max_output_tokens: openAiMaxOutputTokens,
    input: initialInput,
    ...(initialCacheControls as any),
  } as any);
  const providerUsages: Array<Record<string, unknown>> = [
    normalizeOpenAIUsage(response, task.model),
  ];
  let reconciledCostUsd = typeof providerUsages[0].estimated_total_cost_usd === "number"
    ? Number(providerUsages[0].estimated_total_cost_usd)
    : projectedMaxCostUsd;
  if (
    reconciledCostUsd > projectedMaxCostUsd + 1e-12
    || reconciledCostUsd > openAiMaxInferenceCostUsd
  ) {
    throw new Error("OpenAI actual cost exceeded the reserved maximum");
  }
  traceLogs.push({
    event_type: "provider.request.prepared",
    status: "info",
    summary: "Prepared OpenAI Responses request",
    model: task.model,
    cache_family: activeCachePolicy.family,
    cache_policy_status: activeCachePolicy.status,
    prompt_contract_version: activeCachePolicy.contract_version,
    cache_key_digest: activeCachePolicy.cache_key
      ? `sha256:${createHash("sha256").update(activeCachePolicy.cache_key).digest("hex")}`
      : null,
    continuation_mode: replayInput
      ? "manual_store_false_replay"
      : "new_context",
    projected_max_cost_usd: projectedMaxCostUsd,
    hard_cost_cap_usd: openAiMaxInferenceCostUsd,
  });
  traceLogs.push({
    event_type: "provider.response.created",
    status: "info",
    summary: "Created OpenAI response",
    response_id: (response as any).id || null,
    previous_response_id: previousResponseId || null,
    usage: providerUsages[0],
  });

  let toolIterations = 0;
  while (tools && toolIterations < 5) {
    const outputItems = Array.isArray((response as any).output) ? (response as any).output : [];
    const toolCalls = outputItems.filter((item: any) => item?.type === "function_call");
    if (toolCalls.length === 0) {
      break;
    }

    const toolOutputs: any[] = [];
    for (const call of toolCalls) {
      const args =
        typeof call.arguments === "string" && call.arguments.trim().length > 0
          ? JSON.parse(call.arguments)
          : {};
      traceLogs.push({
        event_type: "tool.call",
        status: "info",
        summary: `Invoked ${call.name}`,
        tool_name: call.name,
        tool_args: args,
        call_id: call.call_id,
      });
      const result = await runOperatorTool(call.name, args);
      traceLogs.push({
        event_type: "tool.result",
        status: "success",
        summary: `Completed ${call.name}`,
        tool_name: call.name,
        call_id: call.call_id,
        tool_result: result,
      });
      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }

    if (reconciledCostUsd + projectedMaxCostUsd > openAiMaxInferenceCostUsd) {
      throw new Error(
        "OpenAI follow-up worst-case reservation exceeds the configured cost cap",
      );
    }
    const responseItems = Array.isArray((response as any).output)
      ? (response as any).output
      : [];
    conversationInput = [...conversationInput, ...responseItems, ...toolOutputs];
    const followUpInputBytes = conservativeOpenAIInputTokenCeiling(
      conversationInput,
      tools,
    );
    if (followUpInputBytes > openAiMaxInputTokens) {
      throw new Error("OpenAI follow-up context exceeds the declared token ceiling");
    }
    response = await client.responses.create({
      model: task.model,
      input: conversationInput as any,
      reasoning: {
        effort: "medium",
      },
      tools,
      parallel_tool_calls: true,
      max_output_tokens: openAiMaxOutputTokens,
      store: false,
      ...(activeCachePolicy.model_family.startsWith("gpt-5.6")
        ? {
            prompt_cache_options: { mode: "explicit", ttl: "30m" },
            ...(activeCachePolicy.cache_key
              ? { prompt_cache_key: activeCachePolicy.cache_key }
              : {}),
          }
        : {}),
    } as any);
    const followUpUsage = normalizeOpenAIUsage(response, task.model);
    providerUsages.push(followUpUsage);
    reconciledCostUsd += typeof followUpUsage.estimated_total_cost_usd === "number"
      ? Number(followUpUsage.estimated_total_cost_usd)
      : projectedMaxCostUsd;
    if (reconciledCostUsd > openAiMaxInferenceCostUsd + 1e-12) {
      throw new Error("OpenAI cumulative actual cost exceeded the configured cap");
    }
    traceLogs.push({
      event_type: "provider.response.created",
      status: "info",
      summary: "Created follow-up OpenAI response",
      response_id: (response as any).id || null,
      iteration: toolIterations + 1,
      usage: followUpUsage,
    });

    toolIterations += 1;
  }

  const rawText = response.output_text || "";
  traceLogs.push({
    event_type: "provider.response.extracted_text",
    status: "info",
    summary: "Extracted OpenAI response text",
    chars: rawText.length,
  });
  const payload = extractJsonPayload(rawText);
  traceLogs.push({
    event_type: "provider.response.parsed",
    status: "success",
    summary: "Parsed OpenAI JSON payload",
  });
  const parsed = (task.definition.output_schema as ZodType<TOutput>).parse(
    payload,
  );
  traceLogs.push({
    event_type: "provider.schema.validated",
    status: "success",
    summary: "Validated OpenAI output against schema",
  });

  const aggregateUsage = providerUsages.reduce<Record<string, number>>(
    (total, usage) => {
      for (const key of [
        "input_tokens",
        "prompt_tokens",
        "output_tokens",
        "completion_tokens",
        "total_tokens",
        "cached_tokens",
        "cache_write_tokens",
        "uncached_input_tokens",
        "reasoning_tokens",
        "uncached_input_cost_usd",
        "cache_write_cost_usd",
        "cached_read_cost_usd",
        "output_cost_usd",
        "estimated_total_cost_usd",
        "estimated_cost_without_caching_usd",
        "estimated_savings_usd",
      ]) {
        const value = usage[key];
        if (typeof value === "number" && Number.isFinite(value)) {
          total[key] = (total[key] ?? 0) + value;
        }
      }
      return total;
    },
    {},
  );
  aggregateUsage.cache_hit_ratio = aggregateUsage.input_tokens > 0
    ? aggregateUsage.cached_tokens / aggregateUsage.input_tokens
    : 0;

  return {
    status: "completed",
    provider: task.provider,
    runtime: task.runtime,
    model: task.model,
    tool_mode: task.tool_policy.mode,
    output: parsed,
    raw_output_text: rawText,
    artifacts: {
      openai_response_id: (response as any).id || null,
      tool_iterations: toolIterations,
      usage: aggregateUsage,
      cache_policy: cachePolicyEvidence(activeCachePolicy),
      cache_family: activeCachePolicy.family,
      prompt_contract_version: activeCachePolicy.contract_version,
      stable_prefix_digest: activeCachePolicy.stable_prefix_digest,
      cache_key_digest: activeCachePolicy.cache_key
        ? `sha256:${createHash("sha256").update(activeCachePolicy.cache_key).digest("hex")}`
        : null,
      privacy_scope: activeCachePolicy.privacy_scope,
      processing_region: activeCachePolicy.processing_region,
      cache_decision: activeCachePolicy.status === "enabled" ? "reusable" : "one_off",
      cache_decision_reason: activeCachePolicy.decision_reason,
      reusable_prefix_tokens: activeCachePolicy.economics.stable_prefix_tokens,
      inference_reservation: {
        input_token_ceiling: openAiMaxInputTokens,
        max_output_tokens: openAiMaxOutputTokens,
        projected_max_cost_per_call_usd: projectedMaxCostUsd,
        reconciled_cost_usd: reconciledCostUsd,
        hard_cost_cap_usd: openAiMaxInferenceCostUsd,
        cache_hit_assumed_for_reservation: false,
      },
    },
    continuation_state: {
      openai_replay_input: [
        ...conversationInput,
        ...(Array.isArray((response as any).output) ? (response as any).output : []),
      ],
    },
    logs: traceLogs,
    requires_human_review: inferRequiresHumanReview(parsed),
    requires_approval: false,
  };
}
