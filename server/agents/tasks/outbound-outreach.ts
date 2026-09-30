import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";
import { outreachReviewContractSchema, type OutreachConnectionEvidence, type OutreachCapabilityEvidence } from "../outreach-review";

/**
 * Writing the one email.
 *
 * ## Why an agent writes this and not a template
 *
 * Inbound and outbound are not the same funnel pointed in different
 * directions. A site that fills in the form arrives with motivation, a task in
 * mind, and the willingness to answer six questions about its own operation.
 * A stranger has none of that, so asking them to go and do a motivated buyer's
 * work is the move that does not survive contact.
 *
 * What we have instead is an asymmetry worth using: the gates are questions
 * about observable facts of a facility, and most of them can be answered from
 * outside. So the email does not ask what their task is. It says what we think
 * their task is, from sourced observations, and asks them to correct it.
 *
 * Inbound screens then proposes. Outbound has to propose then screen. A
 * template cannot do that, because the whole value is in the specificity.
 *
 * ## What this agent must never do
 *
 * Invent a fact about a building. Every observation handed in carries a source,
 * and the draft may only use those. A hallucinated detail about a stranger's
 * facility is a claim the recipient can check in one second and will never
 * forget, and `guardProspectSend` refuses to send an unsourced observation at
 * all. This prompt is the second line of that defence, not the first.
 *
 * It also cannot qualify anybody. The inferred gates exist here purely as
 * context for what to ask about; provenance keeps them from ever reaching
 * dispatch, and the agent is told not to imply we have decided anything.
 *
 * First contact asks one easy, non-confidential question. Capture and deeper
 * conversation follow only if the recipient chooses to continue. The contract
 * carries evidence and body anchors for review; it never approves a send.
 */

const observationSchema = z.object({
  claim: z.string().min(1).max(240),
  source: z.string().min(1).max(500),
});

export const outboundOutreachOutputSchema = z.object({
  automation_status: z.enum(["completed", "blocked"]),
  block_reason_code: z.string().min(1).max(120).nullable(),
  retryable: z.boolean(),
  /** Short, specific, and not a subject line about robotics generally. */
  subject: z.string().min(1).max(120),
  /** Plain text. No markdown, no images, no tracking pixels. */
  body: z.string().min(1).max(2200),
  /**
   * The observations the draft actually leaned on, echoed back so a reviewer
   * can check each sentence against a source without rereading the input.
   */
  observations_used: z.array(observationSchema).max(6),
  /** The single thing we want them to do. Phrased as they would say it. */
  primary_ask: z.string().min(1).max(200),
  /**
   * Set when the observations are too thin to say anything specific. A generic
   * pitch is worse than no email: it burns the address and teaches nothing.
   */
  requires_human_review: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(1200),
  internal_summary: z.string().min(1).max(1200),
  outreach_contract: outreachReviewContractSchema.nullable(),
});

export type OutboundOutreachOutput = z.infer<typeof outboundOutreachOutputSchema>;

export type OutboundOutreachInput = {
  prospectId: string;
  facilityName: string;
  facilityAddress: string;
  /** Sourced facts only. The draft may use nothing else. */
  observations: { claim: string; source: string }[];
  /** The task we believe they run, for them to correct. */
  hypothesisedTask: string;
  /** Guessed gate answers, as context for what to ask — never as findings. */
  inferredGates?: Record<string, string>;
  /** Operator-recorded evidence only; a shared community implies no endorsement. */
  connectionEvidence?: OutreachConnectionEvidence | null;
  teamObservations?: { claim: string; source: string }[];
  verifiedCapabilities?: OutreachCapabilityEvidence[];
  /** Where the capture upload link will point, when they say yes. */
  selfCaptureSeconds?: number;
};

export const outboundOutreachTask: StructuredTaskDefinition<
  OutboundOutreachInput,
  OutboundOutreachOutput
> = {
  kind: "outbound_outreach",
  default_provider: getStructuredAutomationProvider("outbound_outreach"),
  model_by_provider: getTaskModelByProvider("outbound_outreach"),
  output_schema: outboundOutreachOutputSchema,
  build_prompt: (input) =>
    buildCacheFriendlyPrompt({
      instructions: `You write one first-contact email to the operator of a specific facility.

Output JSON only. No markdown. No explanation outside JSON.

WHAT THIS EMAIL IS FOR
Offer a useful, bounded observation or task-specific research brief. Label hypotheses as hypotheses. Never present an inference as a verified fact or promise reconstruction, robot fit, or a deployment outcome.

CANONICAL FIRST-CONTACT RULES (docs/outreach-first-touch-policy.md)
1. Start with a verified connection, introduction, or shared community where possible. Use only connectionEvidence supplied by the operator, never invent a relationship or imply community endorsement. Without it, choose a cold opening and record why no verified connection is used.
2. For a cold approach, reference one specific public detail from the provided observations, echo its exact claim/source in outreach_contract, and explain the relevance in the body.
3. Offer one small useful observation or task-specific research brief and state its limits in the body. Be explicit about public evidence, hypotheses, and what the offer cannot establish.
4. Ask exactly one easy, non-confidential question first. No questionnaire, compound ask, meeting/calendar link, video, upload, private operational data, or introduction request by default.
5. Leave the decision about a deeper conversation with the recipient. No pressure, urgency, implied obligation, or automatic follow-up promise.

DISCOVERY AND MATCHING WORKFLOW
Research the site, job, and team jointly. Start discovery from the site/job; assess team feasibility in parallel from teamObservations, or mark it pending. Public feasibility research is not a team's agreement to evaluate or deployment capacity.
Disclose Blueprint identity from the first contact; never invent a sender name. You can say "I'm reaching out from Blueprint."
Keep interest in talking, agreement to evaluation participation, and confirmed deployment capacity separate; do not infer any of them from a reply or public research.
Offer a readiness/learning brief as a bounded learning artifact, separate from the qualified-match fee. Do not imply the brief, reply, or evaluation triggers a match fee or proves a qualified match.
Ask one progressive job-brief question before seeking footage or detailed operational information. Site permission is required before sharing a brief or footage with robot teams. A team must confirm the configuration, support, and timing before Blueprint promises a match. Evaluation claims need evidence; introductions and physical-outcome feedback require the parties' consent. These are later gates, not requests to bundle into first contact.
Never claim Atlas or pipeline capabilities without an exact operator-recorded verifiedCapabilities claim/source. Echo any such claim in capabilityClaims; do not infer functionality from a product name. Prefer to omit internal capability references from the first message.

SOURCING - THE HARD RULE
Use only the observations provided. Every factual claim about this facility must trace to one of them. Never invent a detail about their building, headcount, equipment, shifts or volumes, however plausible. If the observations do not support a specific opening, set requires_human_review=true and say so in the rationale rather than padding with invention.

REVIEW CONTRACT
Return outreach_contract with version="blueprint.outreach.v1" and senderIdentity containing Blueprint. opening is either {kind:"cold", noVerifiedConnectionReason, publicDetail:{claim,source}, relevance} or {kind:"connection"|"introduction"|"shared_community", claim}. For warm openings, kind and claim must exactly match operator connectionEvidence. value is {kind:"observation"|"research_brief", offer, limits}. question and recipientChoice are strings. All senderIdentity/claim/relevance/offer/limits/question/recipientChoice strings must occur verbatim in the body. primary_ask is the same single question. workflow is {phase:"site_led_discovery", briefKind:"readiness_learning", nextStep:"job_brief_question", teamFeasibility:"pending"|"public_research", teamFeasibilitySources:[{claim,source}]}; sources must match teamObservations. capabilityClaims is an array of {name:"Atlas"|"pipeline",claim,source}, normally empty. Keep site/job evidence, team feasibility or its gap, and later permission/participation/capacity gates in internal_summary. This is review metadata, not approval. Always set requires_human_review=true. If blocked, outreach_contract may be null.

DO NOT IMPLY WE HAVE DECIDED ANYTHING
The gate answers in the payload are our guesses, not findings. Never write as if the site is approved, qualified, accepted, or a fit. Ask; do not conclude.

TONE
Short. Plain. Written as one operator to another. No superlatives, no "revolutionary", no "AI-powered". If a sentence would embarrass you in a reply-all, cut it.

LENGTH
Under 150 words of body. They will read the first two lines and decide.

BLOCKING
Use automation_status="blocked" only when there is not enough here to write anything specific at all.`,
      returnShape: {
        automation_status: "completed | blocked",
        block_reason_code: "string or null",
        retryable: false,
        subject: "",
        body: "",
        observations_used: [{ claim: "", source: "" }],
        primary_ask: "",
        requires_human_review: true,
        confidence: 0.0,
        rationale: "",
        internal_summary: "",
        outreach_contract: {
          version: "blueprint.outreach.v1",
          senderIdentity: "I'm reaching out from Blueprint.",
          opening: { kind: "cold", noVerifiedConnectionReason: "", publicDetail: { claim: "", source: "" }, relevance: "" },
          value: { kind: "observation", offer: "", limits: "" },
          question: "",
          recipientChoice: "",
          workflow: { phase: "site_led_discovery", briefKind: "readiness_learning", nextStep: "job_brief_question", teamFeasibility: "pending", teamFeasibilitySources: [] },
          capabilityClaims: [],
        },
      },
      payload: {
        ...input,
        selfCaptureSeconds: input.selfCaptureSeconds ?? 45,
      },
    }),
};
