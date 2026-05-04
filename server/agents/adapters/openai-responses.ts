import OpenAI from "openai";
import type { ZodType } from "zod";

import { openAiResponsesOperatorTools, runOperatorTool } from "../operator-tools";
import type { AgentResult, NormalizedAgentTask } from "../types";

const openAiApiKey = process.env.OPENAI_API_KEY?.trim();
const openAiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS ?? 20_000);

const client = openAiApiKey
  ? new OpenAI({
      apiKey: openAiApiKey,
      maxRetries: 2,
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

  let response = await client.responses.create({
    model: task.model,
    input: task.definition.build_prompt(task.input),
    previous_response_id: previousResponseId,
    reasoning: {
      effort: "medium",
    },
    tools,
  });
  traceLogs.push({
    event_type: "provider.request.prepared",
    status: "info",
    summary: "Prepared OpenAI Responses request",
    model: task.model,
  });
  traceLogs.push({
    event_type: "provider.response.created",
    status: "info",
    summary: "Created OpenAI response",
    response_id: (response as any).id || null,
    previous_response_id: previousResponseId || null,
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

    response = await client.responses.create({
      model: task.model,
      previous_response_id: response.id,
      input: toolOutputs as any,
      reasoning: {
        effort: "medium",
      },
      tools,
    });
    traceLogs.push({
      event_type: "provider.response.created",
      status: "info",
      summary: "Created follow-up OpenAI response",
      response_id: (response as any).id || null,
      iteration: toolIterations + 1,
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
    },
    logs: traceLogs,
    requires_human_review: inferRequiresHumanReview(parsed),
    requires_approval: false,
  };
}
