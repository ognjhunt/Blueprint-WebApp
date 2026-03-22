import OpenAI from "openai";
import type { ZodType } from "zod";

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

  const response = await client.responses.create({
    model: task.model,
    input: task.definition.build_prompt(task.input),
    reasoning: {
      effort: "medium",
    },
  });

  const rawText = response.output_text || "";
  const parsed = (task.definition.output_schema as ZodType<TOutput>).parse(
    extractJsonPayload(rawText),
  );

  return {
    status: "completed",
    provider: task.provider,
    runtime: task.runtime,
    model: task.model,
    tool_mode: task.tool_policy.mode,
    output: parsed,
    raw_output_text: rawText,
    requires_human_review: false,
    requires_approval: false,
  };
}
