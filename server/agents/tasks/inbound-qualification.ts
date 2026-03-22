import { z } from "zod";

import type {
  OpportunityState,
  QualificationState,
} from "../../types/inbound-request";
import type { StructuredTaskDefinition } from "../types";

const qualificationStateEnum = z.enum([
  "submitted",
  "capture_requested",
  "qa_passed",
  "needs_more_evidence",
  "in_review",
  "qualified_ready",
  "qualified_risky",
  "needs_refresh",
  "not_ready_yet",
]);

const opportunityStateEnum = z.enum([
  "not_applicable",
  "handoff_ready",
  "escalated_to_geometry",
  "escalated_to_validation",
]);

const buyerFollowUpSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export const inboundQualificationOutputSchema = z.object({
  qualification_state_recommendation: qualificationStateEnum,
  opportunity_state_recommendation: opportunityStateEnum,
  confidence: z.number().min(0).max(1),
  requires_human_review: z.boolean(),
  next_action: z.string().min(1).max(240),
  rationale: z.string().min(1).max(1400),
  internal_summary: z.string().min(1).max(1800),
  missing_information: z.array(z.string().min(1).max(200)).max(12),
  buyer_follow_up: buyerFollowUpSchema,
});

export type InboundQualificationOutput = z.infer<
  typeof inboundQualificationOutputSchema
>;

export type InboundQualificationTaskInput = {
  requestId: string;
  priority: string;
  buyerType: string;
  requestedLanes: string[];
  budgetBucket: string;
  company: string;
  roleTitle?: string;
  siteName: string;
  siteLocation: string;
  taskStatement: string;
  workflowContext?: string | null;
  operatingConstraints?: string | null;
  privacySecurityConstraints?: string | null;
  knownBlockers?: string | null;
  targetRobotTeam?: string | null;
  captureRights?: string | null;
  derivedScenePermission?: string | null;
  datasetLicensingPermission?: string | null;
  payoutEligibility?: string | null;
  details?: string | null;
};

export function deriveInboundHumanReviewFlag(
  result: InboundQualificationOutput,
): boolean {
  return (
    result.requires_human_review ||
    result.qualification_state_recommendation === "qualified_risky" ||
    result.qualification_state_recommendation === "needs_refresh" ||
    result.opportunity_state_recommendation !== "not_applicable"
  );
}

export const inboundQualificationTask: StructuredTaskDefinition<
  InboundQualificationTaskInput,
  InboundQualificationOutput
> = {
  kind: "inbound_qualification",
  default_provider: "openclaw",
  model_by_provider: {
    openclaw:
      process.env.OPENCLAW_INBOUND_QUALIFICATION_MODEL ||
      process.env.OPENCLAW_DEFAULT_MODEL ||
      "openai/gpt-5.4",
  },
  output_schema: inboundQualificationOutputSchema,
  tool_policy: {
    mode: "api",
    prefer_direct_api: true,
  },
  build_prompt(input) {
    return `You are Blueprint's inbound qualification copilot.

You classify new buyer/site requests, summarize what matters, identify missing information, and recommend the next internal action.

Output JSON only. No markdown. No explanation outside JSON.

Rules:
- Do not make binding commercial or legal decisions.
- If the request has rights, licensing, privacy, payout, or unclear evidence concerns, set requires_human_review=true.
- Only recommend "qualified_ready" when the request is unusually clear, low-risk, and already has enough detail to move confidently.
- Prefer "in_review" or "needs_more_evidence" when information is incomplete.
- Keep buyer follow-up specific and concise.

Request:
${JSON.stringify(input, null, 2)}

Return JSON with this exact shape:
{
  "qualification_state_recommendation": "submitted" | "capture_requested" | "qa_passed" | "needs_more_evidence" | "in_review" | "qualified_ready" | "qualified_risky" | "needs_refresh" | "not_ready_yet",
  "opportunity_state_recommendation": "not_applicable" | "handoff_ready" | "escalated_to_geometry" | "escalated_to_validation",
  "confidence": 0.0,
  "requires_human_review": true,
  "next_action": "",
  "rationale": "",
  "internal_summary": "",
  "missing_information": [],
  "buyer_follow_up": {
    "subject": "",
    "body": ""
  }
}`;
  },
};

export type InboundQualificationRecommendation = {
  qualification_state_recommendation: QualificationState;
  opportunity_state_recommendation: OpportunityState;
  confidence: number;
  requires_human_review: boolean;
  next_action: string;
  rationale: string;
  internal_summary: string;
  missing_information: string[];
  buyer_follow_up: {
    subject: string;
    body: string;
  };
};
