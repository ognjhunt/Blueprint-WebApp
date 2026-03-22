import { z } from "zod";

import type { StructuredTaskDefinition } from "../types";

export const supportTriageOutputSchema = z.object({
  automation_status: z.enum(["completed", "blocked"]),
  block_reason_code: z.string().min(1).max(120).nullable(),
  retryable: z.boolean(),
  category: z.enum([
    "general_support",
    "sales_follow_up",
    "mapping_reschedule",
    "billing_question",
    "technical_issue",
    "qualification_follow_up",
  ]),
  queue: z.string().min(1).max(120),
  priority: z.enum(["low", "normal", "high"]),
  confidence: z.number().min(0).max(1),
  requires_human_review: z.boolean(),
  next_action: z.string().min(1).max(240),
  rationale: z.string().min(1).max(1200),
  internal_summary: z.string().min(1).max(1600),
  suggested_response: z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(4000),
  }),
});

export type SupportTriageInput = {
  id?: string;
  requestSource?: string;
  requesterName?: string;
  email?: string;
  company?: string;
  city?: string;
  state?: string;
  companyWebsite?: string;
  message?: string;
  summary?: string;
};

export const supportTriageTask: StructuredTaskDefinition<
  SupportTriageInput,
  z.infer<typeof supportTriageOutputSchema>
> = {
  kind: "support_triage",
  default_provider: "openai_responses",
  model_by_provider: {
    openai_responses:
      process.env.OPENAI_SUPPORT_TRIAGE_MODEL ||
      process.env.OPENAI_DEFAULT_MODEL ||
      "gpt-5.4",
  },
  output_schema: supportTriageOutputSchema,
  tool_policy: {
    mode: "api",
    prefer_direct_api: true,
  },
  build_prompt(input) {
    return `You are Blueprint's support and ops triage copilot.

Classify the inbound support/contact issue, recommend the right queue and next action, and draft a concise response.

Output JSON only. No markdown. No explanation outside JSON.

Rules:
- Prioritize mapping reschedules and technical blockers.
- Set requires_human_review=true for billing, refund, legal, account-access, or otherwise blocked issues that should stay with an operator.
- Use automation_status="blocked" for billing, refunds, legal, or unclear account issues that must fail closed.
- Keep the suggested response concise and operator-friendly.

Payload:
${JSON.stringify(input, null, 2)}

Return JSON with this exact shape:
{
  "automation_status": "completed" | "blocked",
  "block_reason_code": "string or null",
  "retryable": false,
  "category": "general_support" | "sales_follow_up" | "mapping_reschedule" | "billing_question" | "technical_issue" | "qualification_follow_up",
  "queue": "",
  "priority": "low" | "normal" | "high",
  "confidence": 0.0,
  "requires_human_review": true,
  "next_action": "",
  "rationale": "",
  "internal_summary": "",
  "suggested_response": {
    "subject": "",
    "body": ""
  }
}`;
  },
};
