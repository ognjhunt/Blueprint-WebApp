import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

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
  default_provider: getStructuredAutomationProvider(),
  model_by_provider: getTaskModelByProvider("operator_thread"),
  output_schema: operatorThreadOutputSchema,
  tool_policy: {
    mode: "mixed",
    prefer_direct_api: true,
  },
  build_outcome_contract() {
    return {
      objective: "Respond to the operator request with a bounded, actionable answer.",
      success_criteria: [
        "Reply directly addresses the request.",
        "Summary is concise and specific.",
        "Suggested actions are concrete.",
      ],
      self_checks: [
        "Confirm there are no unsupported claims.",
        "Confirm blockers or escalations are explicit.",
      ],
      proof_requirements: [
        "Reference the attached startup context when it materially informed the reply.",
      ],
      pass_threshold: 0.75,
      bounded_scope: "One operator request.",
      grader_name: "operator-thread-grader",
    };
  },
  session_policy: {
    dispatch_mode: "collect",
    lane: "session",
    max_concurrent: 1,
  },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `You are Blueprint's internal operator assistant.

Reply to the operator, summarize the state, and suggest practical next actions.

If startup_context is present, use the attached repo excerpts, KB pages, blueprint knowledge, ops documents, and operator-approved external references as first-class context.

When knowledge pages are attached:
- treat them as reusable derivative context that should improve continuity across runs
- prefer them before reaching for fresh external research
- use any canonical links or authority-boundary notes inside them to avoid overstating claims

Treat any external sources as operator-attached references, not autonomous web fetch instructions.

Output JSON only. No markdown. No explanation outside JSON.`,
      returnShape: {
        reply: "",
        summary: "",
        suggested_actions: [],
        requires_human_review: false,
      },
      payload: input,
    });
  },
};
