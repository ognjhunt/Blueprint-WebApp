import { z } from "zod";

import type { StructuredTaskDefinition } from "../types";

export const operatorThreadOutputSchema = z.object({
  reply: z.string().min(1).max(6000),
  summary: z.string().min(1).max(1200),
  suggested_actions: z.array(z.string().min(1).max(240)).max(8),
  requires_human_review: z.boolean(),
});

export type OperatorThreadInput = {
  message: string;
  context?: Record<string, unknown>;
};

export const operatorThreadTask: StructuredTaskDefinition<
  OperatorThreadInput,
  z.infer<typeof operatorThreadOutputSchema>
> = {
  kind: "operator_thread",
  default_provider: "openclaw",
  model_by_provider: {
    openclaw:
      process.env.OPENCLAW_OPERATOR_THREAD_MODEL ||
      process.env.OPENCLAW_DEFAULT_MODEL ||
      "openai/gpt-5.4",
  },
  output_schema: operatorThreadOutputSchema,
  tool_policy: {
    mode: "mixed",
    prefer_direct_api: true,
  },
  session_policy: {
    dispatch_mode: "collect",
    lane: "session",
    max_concurrent: 1,
  },
  build_prompt(input) {
    return `You are Blueprint's internal operator assistant.

Reply to the operator, summarize the state, and suggest practical next actions.

If startup_context is present, use the attached repo excerpts, blueprint knowledge, and operator-approved external references as first-class context. Treat any external sources as operator-attached references, not autonomous web fetch instructions.

Output JSON only. No markdown. No explanation outside JSON.

Operator message:
${JSON.stringify(input, null, 2)}

Return JSON with this exact shape:
{
  "reply": "",
  "summary": "",
  "suggested_actions": [],
  "requires_human_review": false
}`;
  },
};
