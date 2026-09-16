import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

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
 * ## The ask
 *
 * Not a call. Self-capture made the smallest useful ask "film this one station
 * for forty-five seconds", which is a far lower bar than a meeting and returns
 * something real: a world and a robot comparison. A booked call is days of
 * calendar latency in front of a fifteen-minute pipeline.
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
      instructions: `You write one cold email to the operator of a specific facility.

Output JSON only. No markdown. No explanation outside JSON.

WHAT THIS EMAIL IS FOR
You are not pitching robotics. You are stating what we believe this facility's repeated task is, and asking the operator to correct it. Being specific and wrong is fine and useful. Being generic is the failure.

SOURCING - THE HARD RULE
Use only the observations provided. Every factual claim about this facility must trace to one of them. Never invent a detail about their building, headcount, equipment, shifts or volumes, however plausible. If the observations do not support a specific opening, set requires_human_review=true and say so in the rationale rather than padding with invention.

THE ASK
Ask them to film the one work area on a phone for about the stated number of seconds. Do not ask for a call, a demo, or a meeting. Do not attach a calendar link. The point is that they get something real back — a 3D reconstruction of their own station and a comparison of which robots can do the job — without talking to anyone first.

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
        requires_human_review: false,
        confidence: 0.0,
        rationale: "",
        internal_summary: "",
      },
      payload: {
        ...input,
        selfCaptureSeconds: input.selfCaptureSeconds ?? 45,
      },
    }),
};
