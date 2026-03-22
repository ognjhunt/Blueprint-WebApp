import { z } from "zod";

import type { StructuredTaskDefinition } from "../types";

export const payoutExceptionOutputSchema = z.object({
  disposition: z.enum([
    "human_review_required",
    "collect_missing_info",
    "stripe_follow_up",
    "treasury_balance_issue",
    "retryable_webhook_issue",
  ]),
  queue: z.string().min(1).max(120),
  confidence: z.number().min(0).max(1),
  requires_human_review: z.boolean(),
  next_action: z.string().min(1).max(240),
  rationale: z.string().min(1).max(1400),
  internal_summary: z.string().min(1).max(1600),
});

export type PayoutExceptionInput = {
  id: string;
  creator_id?: string;
  capture_id?: string;
  status?: string;
  stripe_payout_id?: string | null;
  failure_reason?: string | null;
  qualification_state?: string | null;
  opportunity_state?: string | null;
  recommendation?: Record<string, unknown> | null;
};

export const payoutExceptionTriageTask: StructuredTaskDefinition<
  PayoutExceptionInput,
  z.infer<typeof payoutExceptionOutputSchema>
> = {
  kind: "payout_exception_triage",
  default_provider: "openclaw",
  model_by_provider: {
    openclaw:
      process.env.OPENCLAW_PAYOUT_EXCEPTION_MODEL ||
      process.env.OPENCLAW_DEFAULT_MODEL ||
      "openai/gpt-5.4",
  },
  output_schema: payoutExceptionOutputSchema,
  approval_policy: {
    sensitive_actions: ["payout", "financial", "compliance"],
    allow_preapproval: false,
  },
  tool_policy: {
    mode: "api",
    prefer_direct_api: true,
  },
  build_prompt(input) {
    return `You are Blueprint's payout exception triage copilot.

Analyze the payout exception and recommend the correct ops/finance next step.

Output JSON only. No markdown. No explanation outside JSON.

Rules:
- Never authorize or execute funds movement.
- Use requires_human_review=true by default for payout failures and ambiguous financial states.
- Distinguish treasury balance problems from missing information or Stripe event failures.

Payload:
${JSON.stringify(input, null, 2)}

Return JSON with this exact shape:
{
  "disposition": "human_review_required" | "collect_missing_info" | "stripe_follow_up" | "treasury_balance_issue" | "retryable_webhook_issue",
  "queue": "",
  "confidence": 0.0,
  "requires_human_review": true,
  "next_action": "",
  "rationale": "",
  "internal_summary": ""
}`;
  },
};
