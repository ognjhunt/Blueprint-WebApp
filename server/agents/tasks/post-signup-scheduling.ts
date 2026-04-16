import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";

const draftSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export const postSignupSchedulingOutputSchema = z.object({
  automation_status: z.enum(["completed", "blocked"]),
  block_reason_code: z.string().min(1).max(120).nullable(),
  retryable: z.boolean(),
  confidence: z.number().min(0).max(1),
  requires_human_review: z.boolean(),
  next_action: z.string().min(1).max(240),
  schedule_summary: z.string().min(1).max(1200),
  contact_lookup_plan: z.array(z.string().min(1).max(200)).max(8),
  confirmations: z.object({
    email: draftSchema,
    slack: z.string().min(1).max(1200),
  }),
  action_plan: z.object({
    resolve_contact: z.boolean(),
    create_calendar_event: z.boolean(),
    send_confirmation_email: z.boolean(),
    send_slack_notification: z.boolean(),
    update_google_sheet: z.boolean(),
    calendar_title: z.string().min(1).max(200),
    calendar_description: z.string().min(1).max(2000),
    sheet_status_note: z.string().min(1).max(400),
  }),
});

export type PostSignupSchedulingOutput = z.infer<
  typeof postSignupSchedulingOutputSchema
>;

export type PostSignupSchedulingTaskInput = {
  blueprintId: string;
  userId?: string;
  companyName: string;
  address: string;
  companyUrl?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  locationType?: string;
  squareFootage?: number | null;
  onboardingGoal?: string;
  audienceType?: string;
  mappingDate?: string | null;
  mappingTime?: string | null;
  demoDate?: string | null;
  demoTime?: string | null;
};

export const postSignupSchedulingTask: StructuredTaskDefinition<
  PostSignupSchedulingTaskInput,
  PostSignupSchedulingOutput
> = {
  kind: "post_signup_scheduling",
  default_provider: getStructuredAutomationProvider(),
  model_by_provider: getTaskModelByProvider("post_signup_scheduling"),
  output_schema: postSignupSchedulingOutputSchema,
  tool_policy: {
    mode: "mcp",
    prefer_direct_api: true,
    browser_fallback_allowed: false,
  },
  build_prompt(input) {
    return `You are Blueprint's post-signup scheduling specialist.

You turn a new blueprint signup into a structured coordination plan for scheduling, reminder drafting, CRM contact lookup, and Slack/email handoff.

Output JSON only. No markdown. No explanation outside JSON.

Rules:
- Prefer MCP/direct API style actions conceptually over browser automation.
- Set requires_human_review=true when automation_status="blocked" or when the plan is missing the contact or schedule needed to complete execution cleanly.
- If contact or scheduling data is incomplete, use automation_status="blocked" with a short snake_case block_reason_code.
- Do not claim that external actions have already been executed.
- Draft communications should be ready for an ops reviewer to send.

Request:
${JSON.stringify(input, null, 2)}

Return JSON with this exact shape:
{
  "automation_status": "completed" | "blocked",
  "block_reason_code": "string or null",
  "retryable": false,
  "confidence": 0.0,
  "requires_human_review": true,
  "next_action": "",
  "schedule_summary": "",
  "contact_lookup_plan": [],
  "confirmations": {
    "email": {
      "subject": "",
      "body": ""
    },
    "slack": ""
  },
  "action_plan": {
    "resolve_contact": true,
    "create_calendar_event": false,
    "send_confirmation_email": true,
    "send_slack_notification": true,
    "update_google_sheet": false,
    "calendar_title": "",
    "calendar_description": "",
    "sheet_status_note": ""
  }
}`;
  },
};
