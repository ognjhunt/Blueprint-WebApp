import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

const draftEmailSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export const waitlistTriageOutputSchema = z.object({
  automation_status: z.enum(["completed", "blocked"]),
  block_reason_code: z.string().min(1).max(120).nullable(),
  retryable: z.boolean(),
  recommendation: z.enum([
    "invite_now",
    "hold_for_market",
    "request_follow_up",
    "decline_for_now",
  ]),
  confidence: z.number().min(0).max(1),
  market_fit_score: z.number().int().min(0).max(100),
  device_fit_score: z.number().int().min(0).max(100),
  invite_readiness_score: z.number().int().min(0).max(100),
  recommended_queue: z.string().min(1).max(120),
  next_action: z.string().min(1).max(240),
  rationale: z.string().min(1).max(1200),
  market_summary: z.string().min(1).max(600),
  requires_human_review: z.boolean(),
  draft_email: draftEmailSchema,
});

export type WaitlistTriageOutput = z.infer<typeof waitlistTriageOutputSchema>;

export type WaitlistTriageTaskInput = {
  submission: {
    id?: string;
    email?: string;
    email_domain?: string;
    location_type?: string;
    market?: string;
    role?: string;
    device?: string;
    phone_present?: boolean;
    source?: string;
    status?: string;
    queue?: string;
    filter_tags?: string[];
    company?: string;
    city?: string;
    state?: string;
    offWaitlistUrl?: string;
  };
  market_context?: {
    sameMarketCount: number;
    sameMarketDeviceCount: number;
    sameMarketPendingCount: number;
    sameRoleCount: number;
    recentExamples: Array<{
      market: string;
      device: string;
      status: string;
      queue: string;
    }>;
  };
};

export const waitlistTriageTask: StructuredTaskDefinition<
  WaitlistTriageTaskInput,
  WaitlistTriageOutput
> = {
  kind: "waitlist_triage",
  default_provider: getStructuredAutomationProvider(),
  model_by_provider: getTaskModelByProvider("waitlist_triage"),
  output_schema: waitlistTriageOutputSchema,
  tool_policy: {
    mode: "api",
    prefer_direct_api: true,
  },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `You are an operations triage worker for Blueprint Capture.

You must score a capturer beta request and draft the next response.

Output JSON only. No markdown. No explanation outside JSON.

Decision rules:
- This is an invite-only capturer beta flow.
- Blueprint is currently phone-first, especially iPhone-first.
- Smart glasses can still be good candidates for repeat capture, but should not beat clear iPhone fit by default.
- iPad is acceptable but usually weaker than iPhone.
- Android is currently the weakest fit unless other factors are unusually strong.
- If the market has multiple existing requests, market fit improves.
- Do not request human review. Set requires_human_review=false.
- Use automation_status="blocked" only when the submission is too ambiguous or incomplete to route safely.
- When automation_status="blocked", set block_reason_code to a short snake_case reason and retryable=true only when additional buyer data could unblock the route.
- recommended_queue must be one of:
  - capturer_beta_invite_review
  - capturer_beta_hold
  - capturer_beta_follow_up
  - capturer_beta_declined
  - capturer_beta_review`,
      returnShape: {
        automation_status: "completed | blocked",
        block_reason_code: "string or null",
        retryable: false,
        recommendation: "invite_now | hold_for_market | request_follow_up | decline_for_now",
        confidence: 0.0,
        market_fit_score: 0,
        device_fit_score: 0,
        invite_readiness_score: 0,
        recommended_queue: "capturer_beta_review",
        next_action: "",
        rationale: "",
        market_summary: "",
        requires_human_review: false,
        draft_email: {
          subject: "",
          body: "",
        },
      },
      payload: input,
    });
  },
};
