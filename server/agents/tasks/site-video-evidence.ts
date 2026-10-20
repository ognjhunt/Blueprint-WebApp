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
 *
 * ## Estimates, kept apart from observations
 *
 * The site sends its video and nothing else (founder direction, 2026-10-20),
 * so what a robot would need to know and nobody measured is estimated here
 * instead of asked for: the object's size and weight, how far it moves, the two
 * surface heights, the floor in front of the work, the items the clip did not
 * show, and a cycle time when no complete cycle is visible. `job_estimates` is
 * the one block that guesses, and it is walled off: it moves no stance, gate,
 * cycle or footage status, and wherever it is shown it reads "estimated from
 * your video".
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
    /**
     * The gate option the footage plainly supports, when `gateOptions` listed
     * options for the field. Null when it does not settle the question. This
     * is what lets an observation become a proposal in the brief for a gate
     * the operator never answered; it is never taken from the description.
     */
    implied_value: z.string().max(80).nullish(),
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

/**
 * Educated estimates of the job, so the site is never asked to measure.
 *
 * Every field is null when the footage gives no basis. A malformed field reads
 * as null and an extra key is dropped, rather than failing the whole reading:
 * the same reading gates reconstruction, and a bad guess must never block it.
 * The bounds only reject the impossible; they say nothing about any robot.
 */
const estimate = (min: number, max: number) => z.number().finite().min(min).max(max).nullable().catch(null);

export const jobEstimatesSchema = z.object({
  /** The main item the job handles, in a few words. */
  object: z.string().trim().min(1).max(120).nullable().catch(null),
  object_largest_side_m: estimate(0.005, 5),
  object_mass_kg_low: estimate(0.001, 2000),
  object_mass_kg_high: estimate(0.001, 2000),
  object_surface: z.enum(["matte", "shiny", "transparent", "mixed"]).nullable().catch(null),
  /** From where the object is picked up to where it is put down. */
  pick_to_place_m: estimate(0, 50),
  pick_height_m: estimate(0, 4),
  place_height_m: estimate(0, 4),
  /** Open floor in front of the surface the object is picked from. */
  front_clearance_m: estimate(0, 20),
  /** Other items the station probably handles that the clip did not show. */
  other_items_likely: z.array(z.unknown()).catch([]).transform((items) => items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 80)).filter(Boolean).slice(0, 5)),
  /** One full cycle, estimated, when no complete cycle was measured. */
  cycle_seconds: estimate(1, 7200),
  /** What things were sized and weighed against. */
  basis: z.string().trim().min(1).max(600).nullable().catch(null),
});

export type SiteVideoJobEstimatesOutput = z.infer<typeof jobEstimatesSchema>;

/**
 * The `job_estimates` field as the readers' output schemas declare it. Absent
 * on readings made before estimates existed; anything malformed reads as null
 * rather than failing the reading it rides on. Shared with the coverage review
 * (`capture-coverage.ts`), the reader that runs on every uploaded walkthrough.
 */
export const jobEstimatesField = z.any().transform((value): SiteVideoJobEstimatesOutput | null | undefined =>
  value === undefined ? undefined : jobEstimatesSchema.safeParse(value).data ?? null);

/** How to estimate the job, for any reader that watches the site's footage. */
export const JOB_ESTIMATES_INSTRUCTIONS = `Estimating the job (job_estimates):
Blueprint never asks the site to measure anything, so estimate what a robot would need to know from what the footage shows. These are educated estimates and are always shown as estimates. They never change any other field of your answer.
- Size things against references in frame: a standard pallet (1.2 m by 1.0 m), a door (about 2 m tall), a table, bench or counter (about 0.75 to 0.9 m high), a tote, a carton, a floor tile.
- object: the main item the job handles, in a few words. object_largest_side_m: its largest side, in metres.
- object_mass_kg_low and object_mass_kg_high: a plausible weight range from its size, its material, how full it looks and how it is lifted (one hand or two, the effort it takes).
- object_surface: matte, shiny, transparent or mixed, from how it looks.
- pick_to_place_m: how far the object travels from where it is picked up to where it is put down. pick_height_m and place_height_m: the height above the floor of the surface it is picked from and of the one it is put on.
- front_clearance_m: the open floor in front of the surface the object is picked from, where a robot could stand. 0 when there is none.
- other_items_likely: up to five other kinds of item this station probably handles that the clip does not show, such as other sizes or variants of the same product, as plain nouns. Never a brand, company or robot. Empty when nothing suggests any.
- cycle_seconds: your best estimate of one full cycle, from complete or partial cycles and the pace of the motions you saw.
- basis: one or two sentences on what you sized and weighed things against.
- Use the job's description only to know which object and which two spots the job is about, never as a number.
- Give null for any estimate the footage gives no basis for. A wild guess is worse than null.`;

export const JOB_ESTIMATES_RETURN_SHAPE = {
  object: "string or null",
  object_largest_side_m: null,
  object_mass_kg_low: null,
  object_mass_kg_high: null,
  object_surface: "matte | shiny | transparent | mixed | null",
  pick_to_place_m: null,
  pick_height_m: null,
  place_height_m: null,
  front_clearance_m: null,
  other_items_likely: [],
  cycle_seconds: null,
  basis: "string or null",
};

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
    job_estimates: jobEstimatesField,
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
  /**
   * The option values each observable gate can take, as `{fieldId: [{value, label}]}`.
   * Present so `implied_value` can name one of them; absent means the model
   * reports observations without proposing a value.
   */
  gateOptions?: Record<string, { value: string; label: string }[]>;
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
  // Short website walkthroughs previously exhausted agentic navigation's
  // tool-call allowance. The full evidence schema and review gate still apply.
  video_processing_mode: "STATIC",
  video_sampling_fps: 2,
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
        "job_estimates holds educated estimates sized against references in frame, and null where the footage gives no basis.",
      ],
      self_checks: [
        "Could a reviewer scrub to each cited timestamp and see what was claimed?",
        "Is any observation actually an inference from the task description rather than from the footage?",
        "Is every job estimate sized against something in frame rather than taken from the task description?",
      ],
      proof_requirements: ["Timestamps for every observation that is not not_visible."],
      pass_threshold: 0.8,
      bounded_scope: "One piece of site footage.",
      grader_name: "site-video-evidence-grader",
    };
  },
  build_prompt(input) {
    return buildCacheFriendlyPrompt({
      instructions: `You are reading footage of a job at a site that has asked Blueprint whether a robot could do it.
Use "job" in operator-facing explanations for the work the site wants automated. Retain "task" for precise robot actions and technical conditions; never rename schema keys or alter quotations from the operator.

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
- implied_value: when gateOptions lists options for the field and the footage plainly supports one of them, give that option's value. Otherwise null. Never take it from taskDescription, and never guess one to fill the field.

Measuring cycles:
- A cycle runs from the start of one repetition to the start of the next.
- Only mark complete=true for a cycle you saw begin and end.
- median_cycle_seconds and implied_band must be null when no complete cycle is visible. Do not extrapolate from a partial one.

Footage status:
- footage_status="unusable" when the clip is too dark, too short, too shaky or does not show the task. Say so and stop rather than producing observations you cannot support.
- not_evidenced lists what you looked for and could not see. An empty list claims you saw everything; that is rarely true.

${JOB_ESTIMATES_INSTRUCTIONS}
- Here they never change a stance, an implied_value, cycle_measurement or footage_status. The scoring and measuring rules above govern observations and cycle_measurement only; estimating here is expected. The hard limits below still apply. Give cycle_seconds only when cycle_measurement has no complete cycle.

Hard limits:
- Never describe any individual person: no appearance, clothing, role, gender, age, or anything identifying. people_present is a count and a spatial relationship only.
- Set privacy_flag=true if the footage centres on identifiable people rather than on the work. This is an observation, not a hold or a site verdict.
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
            implied_value: "an option value from gateOptions, or null",
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
        job_estimates: JOB_ESTIMATES_RETURN_SHAPE,
      },
      payload: input,
    });
  },
};
