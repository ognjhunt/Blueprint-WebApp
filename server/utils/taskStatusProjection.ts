/**
 * Where a task stands, in one place both surfaces read.
 *
 * ## Two surfaces, one truth
 *
 * A site sees its task in two places that must not disagree: the authenticated
 * workspace at `/app/tasks/:id`, and the account-free page reached from the
 * signed capture link in an email. The first requires a Firebase account; the
 * second is for the person who filmed the walkthrough and never signed up. They
 * are different audiences with different auth, and if they projected status
 * separately they would drift — one showing "we can assess this" while the
 * other still says "in review".
 *
 * So the status projection lives here, once, and both call it.
 *
 * ## What it draws on, and what it does not claim
 *
 * The Tier 2 brief (drafted, confirmed), the readiness ladder, and the coverage
 * finding. Deliberately *not* the pilot or evaluation state, because those are
 * downstream of the Pipeline reporting run outcomes — which it does not yet.
 * Surfacing "we can proceed with candidate evaluation" or "this merits a pilot"
 * would be advertising a loop that does not close, the same objection that kept
 * the robot-team route off equal homepage billing. So this projects the two
 * decisions we can actually stand behind and stops there.
 */

import type { ReadinessStage } from "../../client/src/lib/siteTaskReadiness";

/**
 * The decision, in the operator's terms.
 *
 * A deliberately short ladder. Each rung is something we can say truthfully
 * today, and the two that would need Pipeline outcomes are absent by design.
 */
export type TaskDecision =
  /** We have it and are reading it. Nothing asked of them. */
  | "received"
  /** We drafted a brief and need them to confirm or correct it. */
  | "confirm_brief"
  /** Confirmed. A recording is the next step; some gates may still be open. */
  | "record"
  /** A recording landed. Coverage has not been measured yet — that is ours. */
  | "footage_received"
  /** Footage is short of what a scene needs, and we can name the views. */
  | "add_views"
  /** Confirmed, filmed, covered. As far as we take it before the Pipeline. */
  | "assessing"
  /** Robot teams have runs queued or running against the scene. */
  | "screening"
  /** At least one screening run has concluded, with observations or no result. */
  | "results";

export interface TaskStatus {
  decision: TaskDecision;
  /** The readiness stage this came from, for anyone who wants the finer grain. */
  stage: ReadinessStage | null;
  /** One line: what is happening and what, if anything, we need. */
  headline: string;
  /** The operator's next action, or null when it is ours. */
  operatorAction: string | null;
  /** Views still needed, when coverage measured a shortfall. */
  missingViews: string[];
  /**
   * When we have committed to say something next.
   *
   * The strongest idea from the audit: a promise we can keep even when
   * reconstruction, review and participation are all uncertain. Null until an
   * owner sets it -- a committed time nobody meets is worse than none.
   */
  nextUpdateIso: string | null;
}

/**
 * What the runs against a scene add up to, for the two rungs past `assessing`.
 *
 * Counts only, with no cross-run ranking. `teams` is distinct teams with a
 * queued, running, observed, or no-result run, so a site is told how many
 * parties are looking rather than how many holds exist.
 */
export interface SceneScreening {
  teams: number;
  queued: number;
  running: number;
  reported: number;
  /** Runs that concluded without executing an observable episode. */
  noResult: number;
}

interface TaskStatusInput {
  briefDrafted: boolean;
  briefConfirmed: boolean;
  /** From `assessReadiness`, when it has been run. */
  stage: ReadinessStage | null;
  coversScene: boolean | null;
  missingViews: string[];
  supplementWouldFinish: boolean;
  /** The walkthrough's completion marker exists. Absent on older callers. */
  hasStoredCapture?: boolean;
  /** Runs against the scene, when the caller looked. Absent means it did not. */
  screening?: SceneScreening | null;
  nextUpdateIso: string | null;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Project the status. Pure, so the two surfaces cannot diverge.
 */
export function projectTaskStatus(input: TaskStatusInput): TaskStatus {
  const base = { stage: input.stage, missingViews: input.missingViews, nextUpdateIso: input.nextUpdateIso };

  // Coverage measured a shortfall we can name. This is the most actionable
  // state and it takes priority: it is a specific, cheap thing they can do.
  if (input.coversScene === false && input.missingViews.length) {
    return {
      ...base,
      decision: "add_views",
      headline: input.supplementWouldFinish
        ? "Your footage shows the task. One or two more views would finish the scene."
        : "Your footage needs more coverage before we can build the scene.",
      operatorAction: `Add: ${input.missingViews.join(", ")}.`,
    };
  }

  if (!input.briefDrafted) {
    return {
      ...base,
      decision: "received",
      headline: "We have your task and are reading what you sent.",
      operatorAction: null,
    };
  }

  if (!input.briefConfirmed) {
    return {
      ...base,
      decision: "confirm_brief",
      headline: "We drafted your task brief. Check it and correct anything we got wrong.",
      operatorAction: "Review and confirm the brief.",
    };
  }

  // The two rungs the Pipeline gap used to keep off this ladder. A run only
  // exists against runnable supply, so anything counted here is downstream of
  // every rung below; a reported result outranks a queued one.
  const screening = input.screening;
  if (screening && screening.reported > 0) {
    const noResult = screening.noResult > 0
      ? ` ${countLabel(screening.noResult, "other run")} ended without an observed episode.`
      : "";
    return {
      ...base,
      decision: "results",
      headline: `Results are in from ${countLabel(screening.reported, "screening run")}.${noResult} Review each run's observed episodes separately.`,
      operatorAction: "Review the results.",
    };
  }
  if (screening && screening.noResult > 0) {
    return {
      ...base,
      decision: "results",
      headline: `${countLabel(screening.noResult, "screening run")} ended without an observed episode.`,
      operatorAction: "Review the run status.",
    };
  }
  if (screening && screening.queued + screening.running > 0) {
    return {
      ...base,
      decision: "screening",
      headline: `${countLabel(screening.teams, "robot team")} ${screening.teams === 1 ? "is" : "are"} being screened against your scene.`,
      operatorAction: null,
    };
  }

  // Confirmed. If coverage is measured and sufficient, we are assessing;
  // otherwise the next step is a recording.
  if (input.coversScene === true) {
    return {
      ...base,
      decision: "assessing",
      headline: "We can assess this task. Your capture covers the work area and we are preparing it.",
      operatorAction: null,
    };
  }

  // A recording landed but coverage is not measured yet — the footage review
  // runs downstream, on its own clock. Telling the operator who just saved a
  // video to go and film one was the contradiction this state exists to end:
  // the projection's only other stop here read as though the save had failed.
  if (input.hasStoredCapture) {
    return {
      ...base,
      decision: "footage_received",
      headline: "We have your recording and are checking whether it covers the work area.",
      operatorAction: null,
    };
  }

  return {
    ...base,
    decision: "record",
    headline: "We can assess this task. A recording of the work area is the next step.",
    operatorAction: "Film the work area from your capture link.",
  };
}

/**
 * Pull the raw inputs off a stored request, so callers do not each re-derive
 * where the coverage block or the confirmation timestamp live.
 */
export function taskStatusInputFrom(record: {
  site_task_brief_confirmed_at?: unknown;
  capture_coverage?: {
    covers_scene?: boolean | null;
    missing_coverage?: string[] | null;
    supplement_would_finish?: boolean | null;
  } | null;
  site_task_next_update_iso?: string | null;
  briefDrafted: boolean;
  /** The walkthrough's completion marker exists — footage is in, unreviewed. */
  hasStoredCapture?: boolean;
  stage: ReadinessStage | null;
  screening?: SceneScreening | null;
}): TaskStatusInput {
  const coverage = record.capture_coverage;
  return {
    hasStoredCapture: Boolean(record.hasStoredCapture),
    briefDrafted: record.briefDrafted,
    briefConfirmed: Boolean(record.site_task_brief_confirmed_at),
    stage: record.stage,
    coversScene: typeof coverage?.covers_scene === "boolean" ? coverage.covers_scene : null,
    missingViews: Array.isArray(coverage?.missing_coverage) ? coverage!.missing_coverage! : [],
    supplementWouldFinish: Boolean(coverage?.supplement_would_finish),
    nextUpdateIso: record.site_task_next_update_iso ?? null,
    screening: record.screening ?? null,
  };
}
