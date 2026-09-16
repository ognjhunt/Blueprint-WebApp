import { z } from "zod";

import { getStructuredAutomationProvider, getTaskModelByProvider } from "../provider-config";
import type { StructuredTaskDefinition } from "../types";
import { buildCacheFriendlyPrompt } from "./prompt-cache";

/**
 * The agent that stands in for the person who used to open a qualified
 * submission and write the capture job.
 *
 * ## What it is allowed to decide
 *
 * Nothing about whether the site qualifies. That was settled deterministically
 * by `gateTriage` and narrowed, never widened, by `inbound_qualification`.
 * `decideCaptureDispatch` then decides whether capture starts at all, from
 * enums, with no model involved.
 *
 * This task runs *after* all of that and does the one thing rules genuinely
 * cannot: turn a sentence a site typed — "we move totes off the line onto
 * pallets" — into the task object everything downstream is measured against.
 * That is a writing job, which is why it was a person's job, and it is the
 * part of step 6 that was never really review.
 *
 * ## Why the output shape is what it is
 *
 * The pass mark is the load-bearing field. An evaluation compares candidates
 * against a number, and if that number is invented later, by someone reading
 * results, then the comparison is unfalsifiable. Writing it before any episode
 * runs is what makes the result a test rather than a story.
 *
 * `exceptions` matters for the opposite reason: a task whose exceptions are
 * most of the cycles is not a bounded task, and the model listing them is the
 * cheapest way to notice that a site answered the bounded-task gate optimistically.
 * That is why `requires_human_review` exists here at all — not to second-guess
 * the gates, but to flag a task statement that cannot be turned into a testable
 * object.
 */

const captureBriefSchema = z.object({
  /**
   * What the person holding the phone should film. Written for a site employee
   * who has never done this, because under self-capture that is exactly who it
   * is.
   */
  what_to_film: z.string().min(1).max(900),
  /** The one work area, named the way the site would name it. */
  work_area: z.string().min(1).max(200),
  /** Roughly how long the walkthrough needs to be. Short is the goal. */
  suggested_duration_seconds: z.number().int().min(15).max(180),
  /** Things that would make the footage unusable, in plain language. */
  avoid: z.array(z.string().min(1).max(200)).max(6),
});

const taskObjectSchema = z.object({
  /** The things handled, enumerated. The known-objects gate in concrete form. */
  objects: z.array(z.string().min(1).max(160)).min(1).max(25),
  /** One cycle of the job, start to finish, as observable steps. */
  cycle: z.array(z.string().min(1).max(240)).min(1).max(15),
  /** Known departures from the cycle. A long list here is itself a finding. */
  exceptions: z.array(z.string().min(1).max(240)).max(15),
  /**
   * What counts as success, as something countable. Written before any episode
   * runs, on purpose.
   */
  pass_mark: z.string().min(1).max(400),
  /** The surface or fixture the work happens on or into, when there is one. */
  surface_target: z.string().min(1).max(200).nullable(),
});

export const captureDispatchOutputSchema = z.object({
  automation_status: z.enum(["completed", "blocked"]),
  block_reason_code: z.string().min(1).max(120).nullable(),
  retryable: z.boolean(),
  task_object: taskObjectSchema,
  capture_brief: captureBriefSchema,
  /**
   * Set when the task statement cannot be turned into a testable object — a
   * description covering several jobs, or one with no observable success
   * condition. This routes to a person; it never blocks on its own.
   */
  requires_human_review: z.boolean(),
  confidence: z.number().min(0).max(1),
  next_action: z.string().min(1).max(240),
  rationale: z.string().min(1).max(1400),
  internal_summary: z.string().min(1).max(1800),
});

export type CaptureDispatchOutput = z.infer<typeof captureDispatchOutputSchema>;

export type CaptureDispatchInput = {
  requestId: string;
  /** What the site typed, verbatim. The whole input to the writing job. */
  taskStatement: string;
  /** Enum gate answers, for context only — they are already scored. */
  gateAnswers?: Record<string, string | undefined>;
  /** `self_capture` or `site_visit`. Changes who the brief is written for. */
  captureMode: string;
  /** Free-text site description, when given. */
  siteContext?: string | null;
};

export const captureDispatchTask: StructuredTaskDefinition<
  CaptureDispatchInput,
  CaptureDispatchOutput
> = {
  kind: "capture_dispatch",
  default_provider: getStructuredAutomationProvider("capture_dispatch"),
  model_by_provider: getTaskModelByProvider("capture_dispatch"),
  output_schema: captureDispatchOutputSchema,
  build_prompt: (input) =>
    buildCacheFriendlyPrompt({
      instructions: `You turn a site's description of one repeated job into the task object a robot evaluation is measured against.

Output JSON only. No markdown. No explanation outside JSON.

You are NOT deciding whether the site qualifies. That was already settled from enum answers by deterministic rules, and nothing you write can change it. Do not comment on eligibility, location, or fit.

Task object rules:
- objects: every distinct thing handled. If the site named a category, enumerate what is plausibly in it and say so in the rationale.
- cycle: one full repetition, as steps an observer could tick off.
- exceptions: known departures from that cycle.
- pass_mark: a countable success condition, checkable by watching one cycle. Never write one that depends on already knowing the result.
- surface_target: what the work places onto or into, or null.

Capture brief rules:
- Written for whoever holds the phone. Under capture_mode=self_capture that is a site employee who has never filmed for a reconstruction, so be plain and concrete.
- One work area, not a building tour. Keep suggested_duration_seconds short.

- Set requires_human_review=true when the statement describes more than one job, has no observable success condition, or when the exceptions you listed would be most of the cycles. Those are writing problems, not eligibility problems.
- Use automation_status="blocked" only when there is not enough here to write any task object at all.`,
      returnShape: {
        automation_status: "completed | blocked",
        block_reason_code: "string or null",
        retryable: false,
        task_object: {
          objects: [""],
          cycle: [""],
          exceptions: [""],
          pass_mark: "",
          surface_target: "string or null",
        },
        capture_brief: {
          what_to_film: "",
          work_area: "",
          suggested_duration_seconds: 45,
          avoid: [""],
        },
        requires_human_review: false,
        confidence: 0.0,
        next_action: "",
        rationale: "",
        internal_summary: "",
      },
      payload: input,
    }),
};
