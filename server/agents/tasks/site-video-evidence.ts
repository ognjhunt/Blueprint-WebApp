/**
 * Site task footage, read as evidence about the screening gates.
 *
 * ## Why this exists
 *
 * Three of the four conditions in `client/src/data/qualifyingEnvironments.ts`
 * are directly observable in thirty seconds of footage — whether the scene
 * stays put, whether the handled objects can be enumerated, whether untrained
 * people are in the space — and a fourth thing the intake can only ask about,
 * cycle time, is *measurable* from timestamps rather than self-reported from a
 * dropdown. Until now the footage link reached the qualification model as a
 * bare string with the prompt explicitly forbidding it to infer anything
 * (`inbound-qualification.ts`: "You cannot watch it"). This task is the thing
 * that actually watches it.
 *
 * ## Shaped on the ADP episode contract, not invented
 *
 * `server/agents/adp-contract.ts` already defines how this company lets a model
 * report on video: an outcome enum, timestamped `events[]` each carrying its
 * own confidence and evidence references, and an explicit
 * `possible_missed_events[]` so the absence of an observation is recorded
 * rather than silently read as a negative. That contract was built for robot
 * episode review. The questions here are different but the epistemics are
 * identical, so the shape is reused deliberately — a reviewer who can read one
 * can read the other, and the honesty properties come along for free.
 *
 * ## Corroborates, contradicts, or says nothing
 *
 * Each observation is scored against what the operator already told us rather
 * than in the abstract. That is what makes the result safe to fold into a
 * verdict: `contradicts` is actionable, `corroborates` deliberately changes
 * nothing, and `not_visible` is the honest and most common answer. A model that
 * decides a blocked site looks wonderful cannot move anything, because
 * `applyVideoEvidence` in `client/src/lib/gateTriage.ts` only reads
 * `contradicts`. See the one-way-door note there.
 *
 * ## Observables, never identities
 *
 * The schema has no field in which a person could be described, and the prompt
 * forbids it. `/governance` promises that footage of identifiable people is
 * handled under a consent record; this lane reads links a site chose to share
 * and retains custody of, so the only safe thing to extract is what the *work*
 * looks like. `people_present` counts and says where they are relative to the
 * work — that is the clear-window gate — and stops there.
 */
import { z } from "zod";

import { getGeminiVideoModel } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

/**
 * The gate and spec fields footage can bear on.
 *
 * Deliberately a closed list, and deliberately a subset. `serviceArea` and
 * `deploymentTimeline` are facts about a business, not about a room — no video
 * evidences them, so the model is given no way to claim it did.
 */
export const VIDEO_OBSERVABLE_FIELD_IDS = [
  "sceneStability",
  "taskShape",
  "objectVariety",
  "accessWindow",
  "humanProximity",
  "cycleTime",
  "lighting",
] as const;

export type VideoObservableFieldId = (typeof VIDEO_OBSERVABLE_FIELD_IDS)[number];

const observableFieldEnum = z.enum(VIDEO_OBSERVABLE_FIELD_IDS);

/**
 * A timestamped moment supporting one observation.
 *
 * Mirrors `episodeRef` in the ADP contract: an observation with no time on it
 * is an opinion, and a reviewer who wants to check the model's work needs to
 * know where to scrub to.
 */
const momentSchema = z
  .object({
    at_seconds: z.number().finite().nonnegative(),
    note: z.string().min(1).max(400),
  })
  .strict();

/**
 * One reading of one field.
 *
 * `stance` is scored against the operator's own answer, which is supplied in
 * the input. That framing is what keeps the output foldable: the downstream
 * consumer never has to decide what a free-form observation implies.
 */
const observationSchema = z
  .object({
    field_id: observableFieldEnum,
    /** What the operator told us, echoed so the comparison is auditable. */
    operator_answer: z.string().max(200).nullable(),
    stance: z.enum(["corroborates", "contradicts", "not_visible"]),
    /** Plain description of what the footage shows. No people described. */
    observation: z.string().min(1).max(1200),
    confidence: z.number().finite().min(0).max(1),
    moments: z.array(momentSchema).max(12),
  })
  .strict();

/**
 * Cycle timing measured off the footage.
 *
 * The one place this task produces a number the intake could not ask for. A
 * dropdown gives a band the operator guessed; timestamps give what the work
 * actually took. `cycles` may be empty when no complete cycle is visible, which
 * is a real and common outcome, not a failure.
 */
const cycleMeasurementSchema = z
  .object({
    cycles: z
      .array(
        z
          .object({
            start_seconds: z.number().finite().nonnegative(),
            end_seconds: z.number().finite().nonnegative(),
            complete: z.boolean(),
          })
          .strict(),
      )
      .max(60),
    median_cycle_seconds: z.number().finite().nonnegative().nullable(),
    /** Which `cycleTime` band the measurement lands in, or null when unmeasurable. */
    implied_band: z
      .enum(["under_30s", "thirty_to_two_min", "two_to_ten_min", "over_ten_min", "varies"])
      .nullable(),
    note: z.string().max(600),
  })
  .strict();

export const siteVideoEvidenceOutputSchema = z
  .object({
    /**
     * Whether the footage was usable at all. `unusable` is a first-class answer
     * — a dark ten-second clip of a corridor should say so rather than produce
     * seven low-confidence observations.
     */
    footage_status: z.enum(["usable", "partially_usable", "unusable"]),
    /** Why, when not fully usable. Null when `usable`. */
    footage_status_reason: z.string().min(1).max(600).nullable(),
    summary: z.string().min(1).max(2000),
    observations: z.array(observationSchema).max(VIDEO_OBSERVABLE_FIELD_IDS.length),
    cycle_measurement: cycleMeasurementSchema,
    /**
     * People visible in frame, as a count and a relationship to the work. This
     * is the clear-window gate and nothing else: no description of any person.
     */
    people_present: z
      .object({
        max_visible_at_once: z.number().finite().int().nonnegative(),
        relationship_to_work: z.enum([
          "none_visible",
          "passing_nearby",
          "working_in_the_space",
          "performing_the_task",
        ]),
        note: z.string().max(600),
      })
      .strict(),
    /**
     * What the model looked for and could not see. Borrowed from
     * `possible_missed_events` in the ADP contract: recording the gap is what
     * stops a silent absence from reading as a clean bill of health.
     */
    not_evidenced: z.array(z.string().min(1).max(300)).max(12),
    /**
     * Set when the footage appears to show identifiable people in a way the
     * intake's "film the work, not the worker" guidance asks sites to avoid.
     * Routes to a human rather than changing any verdict.
     */
    privacy_flag: z.boolean(),
  })
  .strict();

export type SiteVideoEvidenceOutput = z.infer<typeof siteVideoEvidenceOutputSchema>;

export type SiteVideoEvidenceInput = {
  requestId: string;
  /** The shared link, exactly as the site gave it. */
  taskVideoUrl: string;
  /** The task in the operator's words, so the model knows what a cycle is. */
  taskDescription?: string | null;
  whatGoesWrong?: string | null;
  /** The operator's own gate answers, as `{fieldId: label}` — what to check against. */
  operatorAnswers: Record<string, string>;
};

export const siteVideoEvidenceTask: StructuredTaskDefinition<
  SiteVideoEvidenceInput,
  SiteVideoEvidenceOutput
> = {
  kind: "site_video_evidence",
  // Pinned rather than resolved from `getStructuredAutomationProvider()`: every
  // other structured provider in this repo takes text. This lane is only
  // meaningful on a provider whose API ingests video natively.
  default_provider: "gemini_video",
  model_by_provider: { gemini_video: getGeminiVideoModel() },
  output_schema: siteVideoEvidenceOutputSchema,
  tool_policy: {
    mode: "api",
    prefer_direct_api: true,
  },
  build_outcome_contract() {
    return {
      objective:
        "Report what the footage shows about the screening gates, and nothing it does not show.",
      success_criteria: [
        "Every observation names the field it bears on and cites at least one timestamp.",
        "Anything not visible is reported as not_visible rather than inferred.",
        "No individual person is described.",
      ],
      self_checks: [
        "Could a reviewer scrub to each cited timestamp and see what was claimed?",
        "Is any observation actually an inference from the task description rather than from the footage?",
      ],
      proof_requirements: ["Timestamps for every observation that is not not_visible."],
      pass_threshold: 0.8,
      bounded_scope: "One piece of site footage.",
      grader_name: "site-video-evidence-grader",
    };
  },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `You are reading footage of a work task at a site that has asked Blueprint whether a robot could do it.

Report only what the footage shows. Output JSON only. No markdown.

What you are checking, and nothing else:
- sceneStability — do fixtures, stations and pallet positions stay put across the clip, or does the layout move?
- taskShape — is this one repeated job, or several different jobs?
- objectVariety — could the handled items be enumerated in advance, or is the variety open-ended?
- accessWindow — is the work area clear of untrained people while the task runs?
- humanProximity — do people work alongside the station, pass nearby, or stay out?
- cycleTime — how long one complete cycle actually takes, measured from the timestamps.
- lighting — consistent artificial, mixed, daylight-driven and changing, or low.

Scoring each observation:
- operatorAnswers contains what the site told us. Score each observation against it.
- stance="contradicts" only when the footage plainly shows something the operator's answer denies. Cite the moment. This is the finding worth the most and the only one that changes anything downstream.
- stance="corroborates" when the footage agrees. This deliberately changes nothing; say it plainly rather than inflating it.
- stance="not_visible" when the clip does not settle the question. This is the honest answer most of the time. Prefer it over a low-confidence guess.
- Emit an observation only for fields you actually considered. Omitting a field entirely and reporting it as not_visible mean the same thing; do not pad.

Measuring cycles:
- A cycle runs from the start of one repetition to the start of the next.
- Only mark complete=true for a cycle you saw begin and end.
- median_cycle_seconds and implied_band must be null when no complete cycle is visible. Do not extrapolate from a partial one.

Footage status:
- footage_status="unusable" when the clip is too dark, too short, too shaky or does not show the task. Say so and stop rather than producing observations you cannot support.
- not_evidenced lists what you looked for and could not see. An empty list claims you saw everything; that is rarely true.

Hard limits:
- Never describe any individual person: no appearance, clothing, role, gender, age, or anything identifying. people_present is a count and a spatial relationship only.
- Set privacy_flag=true if the footage centres on identifiable people rather than on the work. That routes it to a human; it does not change the site's verdict.
- Never infer from taskDescription. If prose says one thing and you did not see it, that is not_visible.
- You are not deciding whether the site qualifies. You are reporting observables. Something else combines them.`,
      returnShape: {
        footage_status: "usable | partially_usable | unusable",
        footage_status_reason: "string or null",
        summary: "",
        observations: [
          {
            field_id:
              "sceneStability | taskShape | objectVariety | accessWindow | humanProximity | cycleTime | lighting",
            operator_answer: "string or null",
            stance: "corroborates | contradicts | not_visible",
            observation: "",
            confidence: 0.0,
            moments: [{ at_seconds: 0, note: "" }],
          },
        ],
        cycle_measurement: {
          cycles: [{ start_seconds: 0, end_seconds: 0, complete: false }],
          median_cycle_seconds: null,
          implied_band:
            "under_30s | thirty_to_two_min | two_to_ten_min | over_ten_min | varies | null",
          note: "",
        },
        people_present: {
          max_visible_at_once: 0,
          relationship_to_work:
            "none_visible | passing_nearby | working_in_the_space | performing_the_task",
          note: "",
        },
        not_evidenced: [],
        privacy_flag: false,
      },
      payload: input,
    });
  },
};
