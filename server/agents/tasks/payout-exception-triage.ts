import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";

export const payoutExceptionOutputSchema = z.object({
  disposition: z.enum([
    "blocked_for_policy",
    "collect_missing_info",
    "stripe_follow_up",
    "treasury_balance_issue",
    "retryable_webhook_issue",
  ]),
  automation_status: z.enum(["completed", "blocked"]),
  block_reason_code: z.string().min(1).max(120).nullable(),
  retryable: z.boolean(),
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
  default_provider: getStructuredAutomationProvider(),
  model_by_provider: getTaskModelByProvider("payout_exception_triage"),
  output_schema: payoutExceptionOutputSchema,
  tool_policy: {
    mode: "api",
    prefer_direct_api: true,
  },
  build_prompt(input) {
    return `You are Blueprint's payout exception triage specialist.

Analyze the payout exception and recommend the correct ops/finance next step.

Output JSON only. No markdown. No explanation outside JSON.

Rules:
- Never authorize or execute funds movement.
- Always set requires_human_review=true. Finance and payout exceptions must be reviewed by a human operator before any irreversible follow-up.
- Use automation_status="blocked" with disposition="blocked_for_policy" when the payout state must fail closed pending new facts or policy-safe remediation.
- Distinguish treasury balance problems from missing information or Stripe event failures.

Payload:
${JSON.stringify(input, null, 2)}

Return JSON with this exact shape:
{
  "disposition": "blocked_for_policy" | "collect_missing_info" | "stripe_follow_up" | "treasury_balance_issue" | "retryable_webhook_issue",
  "automation_status": "completed" | "blocked",
  "block_reason_code": "string or null",
  "retryable": false,
  "queue": "",
  "confidence": 0.0,
  "requires_human_review": true,
  "next_action": "",
  "rationale": "",
  "internal_summary": ""
}`;
  },
};
