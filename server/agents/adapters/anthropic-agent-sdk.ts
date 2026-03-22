import Anthropic from "@anthropic-ai/sdk";
import type { ZodType } from "zod";

import type { AgentResult, NormalizedAgentTask } from "../types";

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

  const response = await client.messages.create({
    model: task.model,
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: task.definition.build_prompt(task.input),
      },
    ],
  });

  const rawText = extractText(response.content);
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
    requires_human_review: inferRequiresHumanReview(parsed),
    requires_approval: false,
  };
}
