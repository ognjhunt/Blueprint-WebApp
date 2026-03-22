import { z } from "zod";

import type { StructuredTaskDefinition } from "../types";

export const externalHarnessThreadOutputSchema = z.object({
  reply: z.string().min(1).max(4000),
  summary: z.string().min(1).max(1200),
  suggested_actions: z.array(z.string().min(1).max(240)).max(8),
  requires_human_review: z.boolean(),
});

export type ExternalHarnessThreadInput = {
  message: string;
  harness: "codex" | "claude_code" | "claude_agent_sdk" | "custom";
  context?: Record<string, unknown>;
};

export const externalHarnessThreadTask: StructuredTaskDefinition<
  ExternalHarnessThreadInput,
  z.infer<typeof externalHarnessThreadOutputSchema>
> = {
  kind: "external_harness_thread",
  default_provider: "acp_harness",
  model_by_provider: {
    acp_harness:
      process.env.ACP_DEFAULT_HARNESS ||
      "codex",
  },
  output_schema: externalHarnessThreadOutputSchema,
  tool_policy: {
    mode: "external_harness",
    prefer_direct_api: false,
    browser_fallback_allowed: false,
    isolated_runtime_required: true,
  },
  session_policy: {
    dispatch_mode: "collect",
    lane: "external_harness",
    max_concurrent: 1,
  },
  build_prompt(input) {
    return `Route this request to the external ACP harness selected for Blueprint.

Return JSON only with a concise acknowledgement. No markdown.

If startup_context is present, treat it as the approved context package for the external harness session.

Payload:
${JSON.stringify(input, null, 2)}

Return JSON:
{
  "reply": "",
  "summary": "",
  "suggested_actions": [],
  "requires_human_review": false
}`;
  },
};
