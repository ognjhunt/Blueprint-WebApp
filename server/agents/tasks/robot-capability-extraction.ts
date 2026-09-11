/**
 * Reading public material about a robot team into structured proposals.
 *
 * ## This is where a model earns its place, and the only place
 *
 * The match itself is arithmetic over declared bands and no model touches it.
 * But getting a band declared in the first place — reading a product page, a
 * spec sheet, a paper — is exactly what a model is good at and what a person
 * is slow at. Same split as the footage reader: the model produces evidence,
 * code and people decide.
 *
 * ## It proposes. It never writes.
 *
 * Output is a list of proposals, each naming the field, the value, the source
 * it came from, and what the registry currently holds. `applyProposal` requires
 * a reviewer id, and there is no code path that accepts one automatically. That
 * is deliberate: an inferred figure that auto-applied would be indistinguishable
 * from a fact within a week, and `CLAUDE.md` is explicit that a public figure
 * without a primary source does not ship.
 *
 * ## It must abstain, and abstaining is the common answer
 *
 * A product page that says "heavy payloads" is not a payload band. The prompt
 * pushes hard toward emitting nothing rather than a plausible guess, because a
 * plausible guess is exactly the failure this whole registry is built to avoid:
 * it looks like knowledge, it survives review by being unremarkable, and it
 * ends up in a sentence a site operator acts on.
 */
import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

/** The fields a model may propose. Numeric envelope fields are excluded: they
 *  come from specs and runs, and a model reading marketing copy for a reach in
 *  metres is guessing with extra steps. */
export const EXTRACTABLE_FIELDS = [
  "payloadCapacity",
  "humanProximity",
  "cycleTime",
  "dutyCycle",
  "demonstratedSuccessRate",
  "lighting",
  "budgetBand",
  "objectHandling",
  "taskFamily",
  "embodiment",
  "deploymentGeography",
] as const;

const proposalSchema = z
  .object({
    field: z.enum(EXTRACTABLE_FIELDS),
    /** Must be one of the enum values for that field. Validated by the caller. */
    value: z.string().min(1).max(80),
    /**
     * `published` when a named primary source states it outright; `inferred`
     * when the model is reading between lines. Anything inferred is barred from
     * reaching a site operator, so grading honestly costs nothing and grading
     * generously costs a claim.
     */
    grade: z.enum(["published", "inferred"]),
    /** The specific URL or document the claim rests on. Not the company's homepage. */
    source: z.string().min(1).max(2000),
    /** The sentence or spec line it came from, quoted. */
    quote: z.string().min(1).max(600),
    rationale: z.string().min(1).max(600),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const robotCapabilityExtractionOutputSchema = z
  .object({
    teamName: z.string().min(1).max(200),
    proposals: z.array(proposalSchema).max(EXTRACTABLE_FIELDS.length),
    /**
     * Fields the model looked for and could not support. Recorded so a
     * reviewer can tell "not stated anywhere" from "not looked at", which is
     * the same distinction `not_evidenced` draws for footage.
     */
    notFound: z.array(z.enum(EXTRACTABLE_FIELDS)).max(EXTRACTABLE_FIELDS.length),
    summary: z.string().min(1).max(1600),
  })
  .strict();

export type RobotCapabilityExtractionOutput = z.infer<
  typeof robotCapabilityExtractionOutputSchema
>;

export type RobotCapabilityExtractionInput = {
  robotTeamId: string;
  teamName: string;
  /** What the registry already holds, so the model proposes changes, not restatements. */
  currentCapability: Record<string, string | number | null | undefined>;
  /** Public material, already fetched. The task does no browsing of its own. */
  sources: Array<{ url: string; title?: string | null; text: string }>;
  /** The exact allowed values per field, so a proposal cannot invent a band. */
  allowedValues: Record<string, string[]>;
};

export const robotCapabilityExtractionTask: StructuredTaskDefinition<
  RobotCapabilityExtractionInput,
  RobotCapabilityExtractionOutput
> = {
  kind: "robot_capability_extraction",
  default_provider: getStructuredAutomationProvider("robot_capability_extraction"),
  model_by_provider: getTaskModelByProvider("robot_capability_extraction"),
  output_schema: robotCapabilityExtractionOutputSchema,
  tool_policy: { mode: "api", prefer_direct_api: true },
  build_outcome_contract() {
    return {
      objective:
        "Propose structured capability values that a named source actually states, and abstain otherwise.",
      success_criteria: [
        "Every proposal quotes the line it rests on.",
        "Every proposed value is one of the allowed values for that field.",
        "Fields the sources do not address appear in notFound rather than as low-confidence proposals.",
      ],
      self_checks: [
        "Could a reviewer open the source and find the quoted line?",
        "Is any proposal an inference dressed as a published figure?",
      ],
      proof_requirements: ["A source URL and a verbatim quote for every proposal."],
      pass_threshold: 0.8,
      bounded_scope: "One robot team's public material.",
      grader_name: "robot-capability-extraction-grader",
    };
  },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `You are reading public material about a robotics company to fill in a capability registry.

Output JSON only. No markdown.

What you are doing:
- For each field in allowedValues, decide whether the sources actually state it.
- If they do, emit a proposal whose value is EXACTLY one of the allowed values for that field.
- If they do not, put the field in notFound. This will be most fields most of the time and that is the correct outcome.

Rules that matter more than coverage:
- Never propose a value that is not in allowedValues for that field. A near-miss is a wrong answer, not a close one.
- Quote the line your proposal rests on, verbatim, in quote. If you cannot quote it, you do not have it.
- source must be the specific page or document the quote is on, not the company's homepage.
- grade="published" only when a named source states the figure outright. Everything else is grade="inferred".
- "Heavy payloads", "industrial strength", "fast cycle times" are marketing, not figures. They support nothing.
- A capability demonstrated in a lab video is not a deployed capability. Say so in rationale and grade it inferred.
- Do not restate what currentCapability already holds unless a source contradicts it — in which case propose the change and say what contradicts it.
- confidence is about whether the source supports the value, not about whether the company seems impressive.

You are not deciding whether this team is a good match for anyone. You are recording what is on the record, and a person reviews every line of it before it counts.`,
      returnShape: {
        teamName: "",
        proposals: [
          {
            field: EXTRACTABLE_FIELDS.join(" | "),
            value: "",
            grade: "published | inferred",
            source: "",
            quote: "",
            rationale: "",
            confidence: 0.0,
          },
        ],
        notFound: [],
        summary: "",
      },
      payload: input,
    });
  },
};
