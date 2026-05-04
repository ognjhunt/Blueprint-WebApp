import OpenAI from "openai";
import type { ZodType } from "zod";

import { chatCompletionOperatorTools, runOperatorTool } from "../operator-tools";
import type { AgentResult, NormalizedAgentTask } from "../types";

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const DEFAULT_DEEPSEEK_MAX_TOKENS = 2000;
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

function deepSeekThinkingType() {
  const configured = String(process.env.DEEPSEEK_THINKING ?? "enabled")
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

function deepSeekReasoningEffort() {
  const configured = String(process.env.DEEPSEEK_REASONING_EFFORT ?? "max")
    .trim()
    .toLowerCase();
  if (configured === "xhigh") return "max";
  if (configured === "high" || configured === "max") return configured;
  return "high";
}

function extractRawText(message: unknown) {
  const content = (message as { content?: unknown } | null)?.content;
  return typeof content === "string" ? content.trim() : "";
}

function extractUsage(response: unknown) {
  const usage = (response as { usage?: Record<string, unknown> } | null)?.usage;
  if (!usage || typeof usage !== "object") {
    return null;
  }
  return {
    prompt_tokens: usage.prompt_tokens ?? null,
    completion_tokens: usage.completion_tokens ?? null,
    total_tokens: usage.total_tokens ?? null,
    prompt_cache_hit_tokens: usage.prompt_cache_hit_tokens ?? null,
    prompt_cache_miss_tokens: usage.prompt_cache_miss_tokens ?? null,
  };
}

function usageNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function promptCacheHitRatio(usage: ReturnType<typeof extractUsage>) {
  const hit = usageNumber(usage?.prompt_cache_hit_tokens);
  const miss = usageNumber(usage?.prompt_cache_miss_tokens);
  if (hit === null || miss === null) return null;
  const total = hit + miss;
  return total > 0 ? hit / total : null;
}

async function createDeepSeekCompletion(params: {
  model: string;
  messages: any[];
  tools?: any[];
}) {
  if (!client) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }

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
        type: deepSeekThinkingType(),
      },
    },
    reasoning_effort: deepSeekReasoningEffort(),
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
  const traceLogs: Array<Record<string, unknown>> = [
    {
      event_type: "provider.request.prepared",
      status: "info",
      summary: "Prepared DeepSeek Chat Completions request",
      provider: task.provider,
      model: task.model,
      base_url: deepSeekBaseUrl,
      max_tokens: deepSeekMaxTokens,
      thinking: deepSeekThinkingType(),
      reasoning_effort: deepSeekReasoningEffort(),
    },
  ];

  let response = await createDeepSeekCompletion({
    model: task.model,
    messages,
    tools,
  });
  traceLogs.push({
    event_type: "provider.response.created",
    status: "info",
    summary: "Created DeepSeek response",
    response_id: (response as any).id || null,
    usage: extractUsage(response),
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
    });
    traceLogs.push({
      event_type: "provider.response.created",
      status: "info",
      summary: "Created follow-up DeepSeek response",
      response_id: (response as any).id || null,
      iteration: toolIterations + 1,
      usage: extractUsage(response),
    });
    toolIterations += 1;
  }

  const rawText = extractRawText(response.choices?.[0]?.message);
  const finalUsage = extractUsage(response);
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
      deepseek_response_id: (response as any).id || null,
      deepseek_base_url: deepSeekBaseUrl,
      max_tokens: deepSeekMaxTokens,
      prompt_tokens: finalUsage?.prompt_tokens ?? null,
      completion_tokens: finalUsage?.completion_tokens ?? null,
      total_tokens: finalUsage?.total_tokens ?? null,
      prompt_cache_hit_tokens: finalUsage?.prompt_cache_hit_tokens ?? null,
      prompt_cache_miss_tokens: finalUsage?.prompt_cache_miss_tokens ?? null,
      prompt_cache_hit_ratio: promptCacheHitRatio(finalUsage),
      tool_iterations: toolIterations,
    },
    logs: traceLogs,
    requires_human_review: inferRequiresHumanReview(parsed),
    requires_approval: false,
  };
}
