import { z } from "zod";

import type {
  OpportunityState,
  QualificationState,
} from "../../types/inbound-request";
import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

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

const proofPathPreferenceEnum = z.enum([
  "exact_site_required",
  "adjacent_site_acceptable",
  "need_guidance",
]);

/**
 * The only thing the model is asked to say about the free-text description.
 *
 * The structured gate answers are scored by deterministic rules in
 * `client/src/lib/siteTaskTriage.ts` before this task ever runs, and that
 * verdict is authoritative. The model's job here is narrower and is the thing
 * rules genuinely cannot do: read the prose against the dropdowns and say
 * whether they agree. The highest-value finding is `contradicts_structured` —
 * a submission that ticks "one task, done the same way" and then describes
 * picking, sorting, and palletising.
 *
 * `applyNarrativeReview` folds this in monotonically: it can lower a
 * disposition and can never raise one.
 */
const narrativeReviewSchema = z.object({
  finding: z.enum(["consistent", "needs_detail", "contradicts_structured"]),
  note: z.string().min(1).max(600),
});

export const inboundQualificationOutputSchema = z.object({
  automation_status: z.enum(["completed", "blocked"]),
  block_reason_code: z.string().min(1).max(120).nullable(),
  retryable: z.boolean(),
  qualification_state_recommendation: qualificationStateEnum,
  opportunity_state_recommendation: opportunityStateEnum,
  confidence: z.number().min(0).max(1),
  requires_human_review: z.boolean(),
  next_action: z.string().min(1).max(240),
  rationale: z.string().min(1).max(1400),
  internal_summary: z.string().min(1).max(1800),
  missing_information: z.array(z.string().min(1).max(200)).max(12),
  buyer_follow_up: buyerFollowUpSchema,
  /** Null when the submission carried no structured gate answers to compare against. */
  narrative_review: narrativeReviewSchema.nullable().optional(),
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
  targetSiteType?: string | null;
  proofPathPreference?: z.infer<typeof proofPathPreferenceEnum> | null;
  existingStackReviewWorkflow?: string | null;
  humanGateTopics?: string | null;
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
  /** Raw gate answers from the structured intake, keyed by field id. */
  siteTaskGates?: Record<string, string> | null;
  /**
   * The deterministic verdict, computed before this task runs. Authoritative:
   * the model is told it may not contradict this upward.
   */
  gateDisposition?: "qualified" | "needs_conversation" | "not_now" | null;
  /** Human-readable blocking reasons, already resolved by the rules. */
  gateBlockers?: string[] | null;
  /** Marginal answers a form cannot settle — the agenda for a call. */
  gateOpenQuestions?: string[] | null;
  /** The free-text task description. This is what narrative_review reads. */
  taskDescription?: string | null;
  /** What goes wrong today, where the useful edge cases live. */
  whatGoesWrong?: string | null;
};

export const inboundQualificationTask: StructuredTaskDefinition<
  InboundQualificationTaskInput,
  InboundQualificationOutput
> = {
  kind: "inbound_qualification",
  default_provider: getStructuredAutomationProvider(),
  model_by_provider: getTaskModelByProvider("inbound_qualification"),
  output_schema: inboundQualificationOutputSchema,
  tool_policy: {
    mode: "api",
    prefer_direct_api: true,
  },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `You are Blueprint's inbound qualification specialist.

You classify new buyer/site requests, summarize what matters, identify missing information, and recommend the next internal action.

Output JSON only. No markdown. No explanation outside JSON.

Rules:
- Do not make binding commercial or legal decisions.
- Set requires_human_review=true when automation_status="blocked".
- Set requires_human_review=true when recommending "qualified_ready" or "qualified_risky" because those recommendations can change buyer-facing commitments.
- Treat roleTitle as the buyer role when it is present.
- Confirm the buyer role, targetSiteType, immediate workflow question, and proofPathPreference before recommending a fast proof path.
- If proofPathPreference="exact_site_required" and the request does not yet identify usable exact-site evidence, do not recommend "qualified_ready".
- If targetSiteType or proofPathPreference is missing for a robot-team request, list that in missing_information.
- Existing stack or review workflow constraints should shape the buyer follow-up so the next reply fits the buyer's current tooling.
- If the request has rights, licensing, privacy, payout, delivery-scope, commercial, or unclear evidence concerns, use automation_status="blocked".
- When automation_status="blocked", set block_reason_code to a short snake_case reason and retryable=true only when new buyer evidence could unblock the request.
- Only recommend "qualified_ready" when the request is unusually clear, low-risk, and already has enough detail to move confidently.
- Prefer "in_review" or "needs_more_evidence" when information is incomplete.
 - Keep buyer follow-up specific and concise.

Structured gate answers:
- gateDisposition is produced by deterministic rules from the site's own dropdown answers. It is authoritative and you must not contradict it upward.
- If gateDisposition="not_now", never recommend "qualified_ready" or "qualified_risky". The site failed a screening condition; gateBlockers says which.
- If gateDisposition="needs_conversation", gateOpenQuestions is the agenda. Put those items in missing_information rather than inventing your own.
- Do not re-score the dropdowns. Whether the site is in the service area, whether the scene is stable, and whether there is an idle window are settled facts by the time you see them.

narrative_review — the one judgement asked of you:
- Compare taskDescription (and whatGoesWrong) against the structured gate answers.
- finding="contradicts_structured" when the prose describes something the dropdowns deny. The common case is several distinct jobs described under "one task, done the same way"; another is arbitrary items described where the operator said the item list was short and enumerable. Quote the specific conflict in note.
- finding="needs_detail" when the description is too thin to tell whether the task is genuinely one bounded job.
- finding="consistent" when prose and dropdowns agree. Say so plainly rather than manufacturing a concern.
- Set narrative_review to null when siteTaskGates is absent — there is nothing to compare against.
- narrative_review can only lead to more human scrutiny, never less. Do not use finding="consistent" as a reason to raise confidence or to recommend a faster path.`,
      returnShape: {
        automation_status: "completed | blocked",
        block_reason_code: "string or null",
        retryable: false,
        qualification_state_recommendation:
          "submitted | capture_requested | qa_passed | needs_more_evidence | in_review | qualified_ready | qualified_risky | needs_refresh | not_ready_yet",
        opportunity_state_recommendation:
          "not_applicable | handoff_ready | escalated_to_geometry | escalated_to_validation",
        confidence: 0.0,
        requires_human_review: true,
        next_action: "",
        rationale: "",
        internal_summary: "",
        missing_information: [],
        buyer_follow_up: {
          subject: "",
          body: "",
        },
        narrative_review: {
          finding: "consistent | needs_detail | contradicts_structured",
          note: "",
        },
      },
      payload: input,
    });
  },
};

export type InboundQualificationRecommendation = {
  automation_status: "completed" | "blocked";
  block_reason_code: string | null;
  retryable: boolean;
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
  narrative_review?: {
    finding: "consistent" | "needs_detail" | "contradicts_structured";
    note: string;
  } | null;
};
