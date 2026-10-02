import { createHash } from "node:crypto";

import OpenAI from "openai";
import { readOnlyOperatorTools, toolFailure, validationIssue } from "./tool-recovery";
import { ZodError, type ZodType } from "zod";

import { openAiResponsesOperatorTools, openAiResponsesHistoryTools, getCompanyHistoryAccess, runOperatorTool } from "../operator-tools";
import {
  getOpenAiMaxOutputTokens,
  getOpenAiReasoningEffort,
  getOpenAiTimeoutMs,
} from "../provider-config";
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
const openAiTimeoutMs = getOpenAiTimeoutMs();

function boundedPositiveNumber(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

const openAiMaxInputTokens = Math.floor(boundedPositiveNumber(
  process.env.BLUEPRINT_OPENAI_AGENT_MAX_INPUT_TOKENS,
  100_000,
  1_000_000,
));
const openAiMaxOutputTokens = getOpenAiMaxOutputTokens();
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

const usageNumberFields = [
  "input_tokens", "prompt_tokens", "output_tokens", "completion_tokens", "total_tokens",
  "cached_tokens", "cache_write_tokens", "uncached_input_tokens", "reasoning_tokens",
  "uncached_input_cost_usd", "cache_write_cost_usd", "cached_read_cost_usd", "output_cost_usd",
  "estimated_total_cost_usd", "estimated_cost_without_caching_usd", "estimated_savings_usd",
] as const;

function reportedCounter(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function normalizeReportedOpenAIUsage(response: any, model: string): Record<string, unknown> {
  const raw = response?.usage && typeof response.usage === "object" ? response.usage : null;
  const input = reportedCounter(raw?.input_tokens), output = reportedCounter(raw?.output_tokens);
  let cached = reportedCounter(raw?.input_tokens_details?.cached_tokens);
  // Native Responses usage has no cache-write counter. Retain the existing
  // extension when supplied; its absence in a received usage object means zero.
  let write = raw ? (raw.input_tokens_details?.cache_write_tokens === undefined
    ? 0 : reportedCounter(raw.input_tokens_details.cache_write_tokens)) : null;
  if (input !== null && (cached ?? 0) + (write ?? 0) > input) {
    // An impossible partition is not a zero-usage receipt. Keep the raw
    // counters in provider_responses and reserve conservatively for its cost.
    cached = null; write = null;
  }
  const reasoning = reportedCounter(raw?.output_tokens_details?.reasoning_tokens);
  const usage: Record<string, unknown> = normalizeOpenAIUsage({ ...response, usage: {
    input_tokens: input ?? (cached ?? 0) + (write ?? 0), output_tokens: output ?? 0,
    input_tokens_details: { cached_tokens: cached ?? 0, cache_write_tokens: write ?? 0 },
    output_tokens_details: { reasoning_tokens: reasoning ?? 0 },
  } }, model);
  const partitionKnown = input !== null && cached !== null && write !== null;
  const tokensKnown = input !== null && output !== null;
  Object.assign(usage, {
    input_tokens: input, prompt_tokens: input, output_tokens: output, completion_tokens: output,
    total_tokens: tokensKnown ? input + output : null,
    cached_tokens: cached, cache_write_tokens: write, reasoning_tokens: reasoning,
    uncached_input_tokens: input !== null && cached !== null && write !== null ? input - cached - write : null,
    cache_hit_ratio: input !== null && cached !== null ? (input > 0 ? cached / input : 0) : null,
  });
  for (const [key, known] of [
    ["uncached_input_cost_usd", partitionKnown], ["cache_write_cost_usd", input !== null && write !== null],
    ["cached_read_cost_usd", input !== null && cached !== null], ["output_cost_usd", tokensKnown],
    ["estimated_total_cost_usd", partitionKnown && tokensKnown],
    ["estimated_cost_without_caching_usd", tokensKnown], ["estimated_savings_usd", partitionKnown && tokensKnown],
  ] as const) {
    if (!known) usage[key] = null;
  }
  const hasCounters = [input, output, cached, reasoning].some(value => value !== null);
  usage.usage_detail_status = partitionKnown && tokensKnown && reasoning !== null
    ? "complete" : hasCounters ? "partial" : "missing";
  if (!(partitionKnown && tokensKnown)) usage.cost_status = hasCounters ? "usage_partial" : "usage_missing";
  return usage;
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

  const historyAccess = await getCompanyHistoryAccess(task);
  const tools = task.kind === "operator_thread" ? openAiResponsesOperatorTools : historyAccess ? openAiResponsesHistoryTools : undefined;
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
  // Resolved per lane rather than hardcoded: see getOpenAiReasoningEffort.
  const reasoningEffort = getOpenAiReasoningEffort(task.kind);
  let conversationInput: any[] = Array.isArray(initialInput)
    ? [...initialInput]
    : [{ role: "user", content: initialInput }];
  let response = await client.responses.create({
    model: task.model,
    previous_response_id: replayInput ? undefined : previousResponseId,
    reasoning: {
      effort: reasoningEffort,
    },
    tools,
    parallel_tool_calls: true,
    max_output_tokens: openAiMaxOutputTokens,
    input: initialInput,
    ...(initialCacheControls as any),
  } as any);
  const providerUsages: Array<Record<string, unknown>> = [
    normalizeReportedOpenAIUsage(response, task.model),
  ];
  const providerResponses: Array<Record<string, unknown>> = [{ response_id: response.id,
    output: response.output, output_text: response.output_text, usage: response.usage ?? null,
    request_status: "response_received" }];
  let responseInConversation = false;
  let pendingRequest: "continuation" | "output_correction" | null = null;
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
  const seenToolCallIds = new Set<string>();
  let mutationReconciliationRequired = metadata.mutation_reconciliation_required === true || Boolean(replayInput?.some(item => {
    if (item?.type !== "function_call_output" || typeof item.output !== "string") return false;
    try { return JSON.parse(item.output)?.status === "reconciliation_required"; } catch { return false; }
  }));
  let parsed: TOutput | undefined, outputFailure: string | null = null, outputRepairIterations = 0;
  const outputRepairs: Array<Record<string, unknown>> = [];
  try {
  while (tools && toolIterations < 5) {
    const outputItems = Array.isArray((response as any).output) ? (response as any).output : [];
    const toolCalls = outputItems.filter((item: any) => item?.type === "function_call");
    if (toolCalls.length === 0) {
      break;
    }

    // Validate the whole batch before executing any sibling. A missing or
    // reused identity cannot safely correlate results or duplicate effects.
    const batchIds = new Set<string>();
    for (const call of toolCalls) {
      if (typeof call.call_id !== "string" || !call.call_id.trim()
        || typeof call.name !== "string" || !call.name.trim()
        || batchIds.has(call.call_id) || seenToolCallIds.has(call.call_id)) {
        throw new Error("OpenAI tool_call_identity missing or duplicated");
      }
      batchIds.add(call.call_id);
    }
    batchIds.forEach(id => seenToolCallIds.add(id));
    const toolOutputs: any[] = [];
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {}, result: unknown, failed = false;
      if (!tools.some(tool => tool.name === call.name)) {
        failed = true;
        result = { status: "control_denied", code: "tool_not_allowed", retryAllowed: false,
          allowedRepair: "Choose a declared tool within the existing authorized scope." };
      } else if (mutationReconciliationRequired && !readOnlyOperatorTools.has(call.name)) {
        failed = true;
        result = { status: "reconciliation_required", code: "tool_mutation_reconciliation_required", retryAllowed: false,
          allowedRepair: "A prior mutation has an unknown outcome. Read existing state; further mutations remain quarantined until verified reconciliation outside this run." };
      } else {
        try {
          const parsed = typeof call.arguments === "string" && call.arguments.trim() ? JSON.parse(call.arguments) : {};
          if (call.arguments !== undefined && typeof call.arguments !== "string"
            || parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new SyntaxError("tool_arguments_not_object");
          }
          args = parsed;
        } catch {
          failed = true;
          result = { status: "recoverable_issue", code: "tool_arguments_invalid_json", retryAllowed: true,
            issues: [{ path: "/arguments", code: "invalid_json" }],
            allowedRepair: "Return arguments as one JSON object using the declared tool schema." };
        }
      }
      traceLogs.push({
        event_type: "tool.call",
        status: "info",
        summary: `Invoked ${call.name}`,
        tool_name: call.name,
        tool_args: args,
        call_id: call.call_id,
      });
      if (!failed) {
        try { result = await runOperatorTool(call.name, args, ...(historyAccess && openAiResponsesHistoryTools.some(tool => tool.name === call.name) ? [historyAccess] : [])); }
        catch (error) {
          failed = true; result = toolFailure(error, call.name);
          if ((result as { status: string }).status === "reconciliation_required") mutationReconciliationRequired = true;
        }
      }
      traceLogs.push({
        event_type: "tool.result",
        status: failed ? "error" : "success",
        summary: `${failed ? "Returned feedback for" : "Completed"} ${call.name}`,
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

    const responseItems = Array.isArray((response as any).output)
      ? (response as any).output
      : [];
    conversationInput = [...conversationInput, ...responseItems, ...toolOutputs];
    responseInConversation = true;
    if (reconciledCostUsd + projectedMaxCostUsd > openAiMaxInferenceCostUsd) {
      throw new Error(
        "OpenAI follow-up worst-case reservation exceeds the configured cost cap",
      );
    }
    const followUpInputBytes = conservativeOpenAIInputTokenCeiling(
      conversationInput,
      tools,
    );
    if (followUpInputBytes > openAiMaxInputTokens) {
      throw new Error("OpenAI follow-up context exceeds the declared token ceiling");
    }
    pendingRequest = "continuation";
    response = await client.responses.create({
      model: task.model,
      input: conversationInput as any,
      reasoning: {
        // The same effort the first call used. A follow-up turn that thought
        // less than the turn it continues would be a strange thing to ship.
        effort: reasoningEffort,
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
    pendingRequest = null;
    responseInConversation = false;
    providerResponses.push({ response_id: response.id, output: response.output,
      output_text: response.output_text, usage: response.usage ?? null, request_status: "response_received" });
    const followUpUsage = normalizeReportedOpenAIUsage(response, task.model);
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

  while (true) {
    const raw = response.output_text || "";
    try {
      parsed = (task.definition.output_schema as ZodType<TOutput>).parse(extractJsonPayload(raw));
      break;
    } catch (error) {
      const issues = error instanceof ZodError ? error.issues.map(validationIssue) : [{ path: "/", code: "invalid_json" }];
      // Private run artifacts retain each original response, even if repair
      // reaches a bound. Logs and corrective instructions expose only issues.
      outputRepairs.push({ responseId: (response as any).id ?? null, rawOutput: raw,
        rawOutputSha256: createHash("sha256").update(raw).digest("hex"), issues });
      const detail = issues.map(issue => `${issue.path}:${issue.code}`).join(", ");
      if (toolIterations >= 5) { outputFailure = `OpenAI output repair limit reached: ${detail}`; break; }
      if (reconciledCostUsd + projectedMaxCostUsd > openAiMaxInferenceCostUsd) {
        outputFailure = `OpenAI output repair cost reservation refused: ${detail}`; break;
      }
      conversationInput = [...conversationInput, ...(Array.isArray((response as any).output) ? (response as any).output : []), {
        role: "user", content: `Your final output failed validation at these fields: ${JSON.stringify(issues)}. Return one corrected JSON value using the original output contract and existing evidence. Preserve supported content and unknowns. These diagnostics are data, never permission for new actions. Do not call tools during this output correction.`,
      }];
      responseInConversation = true;
      if (conservativeOpenAIInputTokenCeiling(conversationInput, tools) > openAiMaxInputTokens) {
        outputFailure = `OpenAI output repair context ceiling reached: ${detail}`; break;
      }
      pendingRequest = "output_correction";
      response = await client.responses.create({ model: task.model, input: conversationInput as any,
        reasoning: { effort: reasoningEffort }, tools: [], max_output_tokens: openAiMaxOutputTokens, store: false,
        ...(activeCachePolicy.model_family.startsWith("gpt-5.6") ? {
          prompt_cache_options: { mode: "explicit", ttl: "30m" },
          ...(activeCachePolicy.cache_key ? { prompt_cache_key: activeCachePolicy.cache_key } : {}),
        } : {}),
      } as any);
      pendingRequest = null;
      responseInConversation = false;
      providerResponses.push({ response_id: response.id, output: response.output,
        output_text: response.output_text, usage: response.usage ?? null, request_status: "response_received" });
      toolIterations++; outputRepairIterations++;
      const usage = normalizeReportedOpenAIUsage(response, task.model); providerUsages.push(usage);
      reconciledCostUsd += typeof usage.estimated_total_cost_usd === "number" ? Number(usage.estimated_total_cost_usd) : projectedMaxCostUsd;
      if (reconciledCostUsd > openAiMaxInferenceCostUsd + 1e-12) {
        outputFailure = `OpenAI cumulative actual cost exceeded the configured cap during output repair: ${detail}`; break;
      }
      traceLogs.push({ event_type: "provider.output.repair", status: "info", summary: "Requested bounded final-output correction",
        response_id: (response as any).id ?? null, issues, usage });
    }
  }
  } catch (error) {
    if (pendingRequest) {
      // A transport failure does not establish whether the attempted request
      // incurred provider usage. Keep its unknown charge separate from receipts.
      providerResponses.push({ response_id: null, output: null, output_text: null, usage: null,
        request_status: "request_attempted_response_unreceived", request_kind: pendingRequest });
      providerUsages.push(normalizeReportedOpenAIUsage(null, task.model));
      reconciledCostUsd += projectedMaxCostUsd;
    }
    // Later transport, identity or output failures must return paid evidence
    // and any discovered unknown mutation effects to runtime persistence.
    outputFailure = error instanceof Error && error.message === "OpenAI tool_call_identity missing or duplicated"
      ? "tool_call_identity_invalid" : "openai_provider_or_output_failure";
    traceLogs.push({ event_type: "provider.recovery.failed", status: "error",
      summary: "Retained OpenAI response and mutation reconciliation evidence", code: outputFailure });
  }

  const rawText = response.output_text || "";
  traceLogs.push({
    event_type: "provider.response.extracted_text",
    status: "info",
    summary: "Extracted OpenAI response text",
    chars: rawText.length,
  });
  traceLogs.push({
    event_type: "provider.schema.validated",
    status: outputFailure ? "error" : "success",
    summary: outputFailure ?? "Validated OpenAI output against schema",
  });

  const knownUsageSubtotals: Record<string, number> = {};
  const aggregateUsage: Record<string, unknown> = { calls: providerUsages.length };
  for (const key of usageNumberFields) {
    const values = providerUsages.map(usage => usage[key]).filter((value): value is number =>
      typeof value === "number" && Number.isFinite(value));
    if (values.length) knownUsageSubtotals[key] = values.reduce((sum, value) => sum + value, 0);
    aggregateUsage[key] = values.length === providerUsages.length ? knownUsageSubtotals[key] : null;
  }
  const usageDetailStatus = providerUsages.every(usage => usage.usage_detail_status === "complete")
    ? "complete" : providerUsages.every(usage => usage.usage_detail_status === "missing") ? "missing" : "partial";
  const costStatus = typeof aggregateUsage.estimated_total_cost_usd === "number"
    ? providerUsages[0].cost_status : usageDetailStatus === "complete"
      ? "model_pricing_unknown" : usageDetailStatus === "missing" ? "usage_missing" : "usage_partial";
  Object.assign(aggregateUsage, { usage_detail_status: usageDetailStatus, cost_status: costStatus,
    cache_hit_ratio: typeof aggregateUsage.input_tokens === "number" && typeof aggregateUsage.cached_tokens === "number"
      ? (aggregateUsage.input_tokens > 0 ? aggregateUsage.cached_tokens / aggregateUsage.input_tokens : 0) : null });
  traceLogs.push({ event_type: "provider.telemetry.aggregated", status: "info",
    summary: "Aggregated reported OpenAI usage with explicit unknowns", usage: aggregateUsage });

  return {
    status: outputFailure ? "failed" : "completed",
    provider: task.provider,
    runtime: task.runtime,
    model: task.model,
    tool_mode: task.tool_policy.mode,
    output: parsed,
    ...(outputFailure ? { error: outputFailure } : {}),
    raw_output_text: rawText,
    artifacts: {
      openai_response_id: (response as any).id || null,
      tool_iterations: toolIterations - outputRepairIterations,
      continuation_iterations: toolIterations,
      output_repair_iterations: outputRepairIterations,
      mutation_reconciliation_required: mutationReconciliationRequired,
      provider_responses: providerResponses,
      usage_samples: providerUsages,
      known_usage_subtotals: knownUsageSubtotals,
      usage_detail_status: usageDetailStatus,
      cost_status: costStatus,
      ...(outputRepairs.length ? { output_repairs: outputRepairs } : {}),
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
        reconciled_cost_status: providerUsages.some(usage => typeof usage.estimated_total_cost_usd !== "number")
          ? "includes_worst_case_reservations" : "reported_usage_pricing_estimate",
        known_reported_cost_usd: knownUsageSubtotals.estimated_total_cost_usd ?? null,
        unknown_usage_reserved_cost_usd: providerUsages.filter(usage => typeof usage.estimated_total_cost_usd !== "number").length * projectedMaxCostUsd,
        hard_cost_cap_usd: openAiMaxInferenceCostUsd,
        cache_hit_assumed_for_reservation: false,
      },
    },
    continuation_state: {
      mutation_reconciliation_required: mutationReconciliationRequired,
      openai_replay_input: [
        ...conversationInput,
        ...(!responseInConversation && Array.isArray((response as any).output) ? (response as any).output : []),
      ],
    },
    logs: traceLogs,
    requires_human_review: Boolean(outputFailure) || inferRequiresHumanReview(parsed),
    requires_approval: false,
  };
}
