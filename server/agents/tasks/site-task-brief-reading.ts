/**
 * Reading a site's task description into brief proposals.
 *
 * ## What the model is for here
 *
 * The screening rules are deterministic and stay that way: an enum answer is
 * scored by `gateTriage`, never by a model. What a model is good at is the
 * step before that -- reading "we move about six carton sizes off the line
 * between shifts" and noticing it answers two gates. This task does only that,
 * and hands back proposals the operator confirms or corrects.
 *
 * ## It quotes or it guesses
 *
 * A proposal with basis `description` must carry the operator's own words in
 * `quote`. Without one it is an `assumption`, which the brief shows as a
 * question. That is enforced again in code (`proposalsFromReading`), so the
 * prompt asking for it is a courtesy to the model, not the guarantee.
 */
import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

export interface SiteTaskBriefReadingInput {
  requestId: string;
  taskStatement: string;
  whatGoesWrong: string | null;
  /** The gates the model may speak about, each with the only values it may use. */
  gates: { id: string; question: string; options: { value: string; label: string }[] }[];
}

const proposalSchema = z
  .object({
    field_id: z.string().trim().min(1).max(60),
    /** One of the gate's option values. Validated again by the caller. */
    value: z.string().trim().min(1).max(80),
    basis: z.enum(["description", "assumption"]),
    /** The operator's words, verbatim, when basis is description. */
    quote: z.string().trim().max(400).nullable(),
    /** One line the operator can disagree with. */
    reading: z.string().trim().min(1).max(400),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const siteTaskBriefReadingOutputSchema = z
  .object({
    /** The job in one line, in the operator's terms. No facts they did not give. */
    summary: z.string().trim().min(1).max(300),
    proposals: z.array(proposalSchema).max(12),
    /** Gates the text says nothing about. Recorded so silence is not read as an answer. */
    not_stated: z.array(z.string().trim().min(1).max(60)).max(12),
  })
  .strict();

export type SiteTaskBriefReadingOutput = z.infer<typeof siteTaskBriefReadingOutputSchema>;

export const siteTaskBriefReadingTask: StructuredTaskDefinition<
  SiteTaskBriefReadingInput,
  SiteTaskBriefReadingOutput
> = {
  kind: "site_task_brief_reading",
  default_provider: getStructuredAutomationProvider("site_task_brief_reading"),
  model_by_provider: getTaskModelByProvider("site_task_brief_reading"),
  output_schema: siteTaskBriefReadingOutputSchema,
  tool_policy: { mode: "api", prefer_direct_api: true },
  build_outcome_contract() {
    return {
      objective:
        "Turn the operator's description of one task into gate proposals that quote the words they rest on.",
      success_criteria: [
        "Every description-basis proposal quotes the operator's text verbatim.",
        "Every value is one of the listed options for its gate.",
        "Gates the text does not settle are listed in not_stated, not guessed.",
      ],
      self_checks: [
        "Could the operator find each quote in what they wrote?",
        "Is any proposal an inference dressed as a statement?",
      ],
      proof_requirements: ["A verbatim quote for every description-basis proposal."],
      pass_threshold: 0.8,
      bounded_scope: "One task description and one what-goes-wrong note.",
      grader_name: "site-task-brief-reading-grader",
    };
  },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `You are reading what a site operator wrote about one repetitive job, so Blueprint can draft the task brief they will confirm.

Output JSON only. No markdown.

The gates are listed in the payload with the only values you may use. For each gate:
- If the text states the answer, propose it with basis="description" and put the operator's exact words in quote. The quote must appear verbatim in taskStatement or whatGoesWrong.
- If the text only suggests an answer, propose it with basis="assumption" and quote=null. It will be shown to the operator as a question, never as an answer.
- If the text says nothing about it, do not propose anything; list the gate id in not_stated.

Rules:
- value must be exactly one of the listed option values for that gate.
- reading is one plain sentence the operator can disagree with.
- confidence is how sure you are that the text supports the value. Be conservative.
- summary restates the job in one line in the operator's own terms. Add no facts they did not give.
- Never describe a person. Never infer the site's location, timeline or budget from the type of business.
- Do not pad. Fewer proposals with quotes beat more proposals without.`,
      returnShape: {
        summary: "",
        proposals: [
          {
            field_id: "a gate id from the payload",
            value: "one of that gate's option values",
            basis: "description | assumption",
            quote: "the operator's exact words, or null",
            reading: "",
            confidence: 0.0,
          },
        ],
        not_stated: ["gate ids the text does not settle"],
      },
      payload: input,
    });
  },
};
