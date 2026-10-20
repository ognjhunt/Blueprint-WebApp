/**
 * Ranking researched robot teams for one site's job, from Blueprint's notes.
 *
 * ## Why a model, and why it reads every note
 *
 * Deciding whether a team's past work suits a job is reading, not arithmetic:
 * "mixed-case palletizing" against "move sealed cartons onto a pallet". The
 * registry's research notes are about 37k tokens in all, so the model reads
 * every one instead of a retrieved subset. A retrieval step could only drop the
 * right team silently. The payload is `{ candidates, job }` and the prompt
 * builder sorts keys, so the shared corpus comes before the job and stays a
 * cacheable prefix across jobs. Revisit with hybrid retrieval past a few
 * hundred teams.
 *
 * ## Every form of robot, judged equally
 *
 * Teams build every form of robot: one arm, two arms, arms on wheeled bases,
 * wheeled and walking humanoids, legged robots and specialised machines. The
 * job's needs decide, never a preferred shape.
 *
 * ## It ranks whom to ask, never whom to recommend
 *
 * A prospect has agreed to nothing, and research notes are not measurements.
 * The output stays with staff. `validateRanking` in `siteRobotFit.ts` keeps a
 * reason only when its quote is found, word for word, in one field of that
 * team's research, and caps a team whose form the rules rate "not a fit".
 * Design: docs/superpowers/specs/2026-10-20-robot-fit-design.md.
 */
import { z } from "zod";

import { TEAM_FITS, type FitVerdict, type RatedForm } from "../../../client/src/data/robotFit";
import { ROBOT_FORMS } from "../../../client/src/types/robotEmbodiment";
import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

const FORM_VALUES = [...ROBOT_FORMS, "unknown"] as const;

const rankedTeamSchema = z
  .object({
    teamId: z.string().min(1).max(200),
    fit: z.enum(TEAM_FITS),
    form: z.enum(FORM_VALUES),
    reasons: z
      .array(z.object({ claim: z.string().min(1).max(400), quote: z.string().min(1).max(600) }).strict())
      .min(1)
      .max(4),
    concerns: z.array(z.string().min(1).max(400)).max(3),
  })
  .strict();

export const robotFitRankingOutputSchema = z
  .object({
    ranked: z.array(rankedTeamSchema).max(12),
  })
  .strict();

export type RobotFitRankingOutput = z.infer<typeof robotFitRankingOutputSchema>;

export type RobotFitRankingInput = {
  /** Every team with a research note, sorted by id: the shared, cacheable part. */
  candidates: Array<{
    teamId: string;
    name: string;
    /** `prospect` means researched, with nothing agreed. */
    status: string;
    /** All three supply agreements are on record. Given, never inferred. */
    agreed: boolean;
    notes: string;
    whatGoesWrong: string | null;
    /** Capability fields with a quotable grade, as "field: value (grade)". */
    recorded: string[];
  }>;
  job: {
    summary: string | null;
    instruction: string | null;
    rated: boolean;
    notRatedReason: string | null;
    needs: string[];
    requirements: Array<{ label: string; value: string; source: string }>;
    unknowns: string[];
    forms: Array<{ id: RatedForm; verdict: FitVerdict }>;
    serviceArea: string | null;
  };
};

export const robotFitRankingTask: StructuredTaskDefinition<RobotFitRankingInput, RobotFitRankingOutput> = {
  kind: "robot_fit_ranking",
  default_provider: getStructuredAutomationProvider("robot_fit_ranking"),
  model_by_provider: getTaskModelByProvider("robot_fit_ranking"),
  output_schema: robotFitRankingOutputSchema,
  tool_policy: { mode: "api", prefer_direct_api: true },
  build_outcome_contract() {
    return {
      objective: "Rank the researched robot teams whose notes show work suited to this site's job, quoting the notes.",
      success_criteria: [
        "Every reason quotes one field of the team's research verbatim.",
        "Every teamId is copied from the candidates.",
        "Every form of robot is judged by the job's needs, not by its shape.",
        "Unknowns and doubts appear in concerns instead of being assumed away.",
      ],
      self_checks: [
        "Could a reviewer find each quote, word for word, in that team's note?",
        "Does any reason rely on knowledge about a company that is not in its research?",
      ],
      proof_requirements: ["A verbatim quote from the team's research for every reason."],
      pass_threshold: 0.8,
      bounded_scope: "One site job and the registry's research notes.",
      grader_name: "robot-fit-ranking-grader",
    };
  },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `You are choosing which robot teams Blueprint should ask to evaluate one site's job, from Blueprint's research notes about each team.

Output JSON only. No markdown.

What you are doing:
- Read the job: its summary, the instruction derived from the site's video, what it needs from a robot, its requirements, its unknowns, and how each form of robot rated against it (fits, possible, not_a_fit).
- Read every candidate's notes, whatGoesWrong and recorded fields.
- Rank up to 10 teams whose robots and past work look most suited to this job, best first. Fewer is fine. An empty list is the right answer when no note supports any team.
- Judge every form of robot by the job's needs: one arm, two arms, an arm on a wheeled base, wheeled or walking humanoids, legged robots and specialised machines. Prefer no shape.
- fit: "strong" when the notes show the same kind of task with a robot that suits the job's needs; "possible" when the task is related or important facts are missing; "weak" only when a team is still worth asking despite clear gaps.
- form: the team's robot as fixed_base_arm (one arm on a fixed stand), bimanual_arm (two arms on a fixed stand), mobile_manipulator (an arm on a wheeled base), wheeled_humanoid, humanoid (walking), legged_manipulator (a legged robot with an arm), other, or unknown when the notes do not say.

Rules that matter more than coverage:
- Every reason quotes one field of the team's research (notes, whatGoesWrong or one recorded line) word for word in quote, at least a full phrase, and the quote must state the fact the claim rests on. If you cannot quote it, you do not have it.
- Use only what is written here. Do not use what you otherwise know about these companies.
- teamId is copied exactly from the candidates. Never invent a team.
- A prospect has agreed to nothing. Never say a team will evaluate, run a pilot, or is available. agreed is given to you; do not infer it.
- Notes and published claims are not measured performance. Put what is unknown in concerns: payload, reach, region, whether the team would run its policy in a simulation.
- A team whose robot form is rated not_a_fit for this job is a weak fit at most; say why in concerns.
- Say in concerns when a team's stated region does not include the site's serviceArea.

You are not recommending anyone to the site. Blueprint uses this list to decide whom to ask, and a person reviews every line.`,
      returnShape: {
        ranked: [
          {
            teamId: "",
            fit: TEAM_FITS.join(" | "),
            form: FORM_VALUES.join(" | "),
            reasons: [{ claim: "", quote: "" }],
            concerns: [""],
          },
        ],
      },
      payload: input,
    });
  },
};
