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
 * The Tier 2 brief (drafted, confirmed), our screen's verdict on it, the
 * readiness ladder, the coverage finding, and the robot-team runs queued or
 * reported against the scene. Deliberately *not* a pilot recommendation:
 * nothing produces one yet, and surfacing "this merits a pilot" would be
 * advertising a loop that does not close.
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
  /** Confirmed, but our screen needs a short call before we fund a scene. */
  | "call_needed"
  /** Confirmed, and an answer only the site can change blocks evaluation. */
  | "not_now"
  /** Cleared, and waiting on the operator to save the site to an account. */
  | "save_account"
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
  /** False when no automated footage review runs, so a person reviews it. */
  footageReviewAutomated?: boolean;
  scenePreviewReady?: boolean;
  /** Runs against the scene, when the caller looked. Absent means it did not. */
  screening?: SceneScreening | null;
  /**
   * Our screen's verdict once the brief is confirmed. Blueprint builds a scene
   * only for `qualified`, so the other two must never read as "preparing".
   * Absent on older callers, which keeps their ladder unchanged.
   */
  disposition?: "qualified" | "needs_conversation" | "not_now" | null;
  /** Where the site books the screening call, when one is needed. */
  bookingUrl?: string | null;
  /**
   * Whether the site is saved to an account. A scene is built only for a
   * claimed site. Absent on callers that cannot tell, which skips the rung.
   */
  claimed?: boolean;
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

  // No scene is built for a site our screen has not cleared, so neither of
  // these may fall through to a rung that says we are preparing one.
  if (input.disposition === "not_now") {
    return {
      ...base,
      decision: "not_now",
      headline:
        "Not yet. One of your answers means a robot evaluation would not hold up at this site today, so we are not building a scene.",
      operatorAction: "Open your task brief to see what is in the way. When it changes, update the brief.",
    };
  }
  if (input.disposition === "needs_conversation") {
    return {
      ...base,
      decision: "call_needed",
      headline:
        "A short call settles the last questions before we build your scene. The agenda is already written.",
      operatorAction: input.bookingUrl
        ? `Book a 30-minute call: ${input.bookingUrl}`
        : "We will reach out to book a 30-minute call.",
    };
  }

  // Cleared, but Blueprint builds the scene only for a site saved to an
  // account. Until then "we are preparing it" would not be true.
  if (input.disposition === "qualified" && input.claimed === false && !input.scenePreviewReady) {
    return {
      ...base,
      decision: "save_account",
      headline: "Your task clears our screen. Save it to your account and we start building your scene.",
      operatorAction: "Save this site to your account and verify your email.",
    };
  }

  if (input.scenePreviewReady) {
    return {
      ...base,
      decision: "assessing",
      headline: "Your scene preview is ready. We are preparing the task for simulation.",
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
      // Only claim an automated check that runs. With the footage review lane
      // off, a person reviews it, and that is what the site is told.
      headline: input.footageReviewAutomated === false
        ? "We have your recording. Our team reviews it and emails you with the next step."
        : "We have your recording and are checking whether it covers the work area.",
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
  footageReviewAutomated?: boolean;
  scenePreviewReady?: boolean;
  stage: ReadinessStage | null;
  screening?: SceneScreening | null;
  site_task_triage?: { disposition?: string | null } | null;
  bookingUrl?: string | null;
  /** Pass the owner uid (or null) when the caller read it; omit when it did not. */
  account_owner_uid?: string | null;
}): TaskStatusInput {
  const coverage = record.capture_coverage;
  return {
    hasStoredCapture: Boolean(record.hasStoredCapture),
    ...(record.footageReviewAutomated === false ? { footageReviewAutomated: false } : {}),
    scenePreviewReady: Boolean(record.scenePreviewReady),
    briefDrafted: record.briefDrafted,
    briefConfirmed: Boolean(record.site_task_brief_confirmed_at),
    stage: record.stage,
    coversScene: typeof coverage?.covers_scene === "boolean" ? coverage.covers_scene : null,
    missingViews: Array.isArray(coverage?.missing_coverage) ? coverage!.missing_coverage! : [],
    supplementWouldFinish: Boolean(coverage?.supplement_would_finish),
    nextUpdateIso: record.site_task_next_update_iso ?? null,
    screening: record.screening ?? null,
    disposition: dispositionFrom(record.site_task_triage?.disposition),
    bookingUrl: record.bookingUrl ?? null,
    ...("account_owner_uid" in record ? { claimed: Boolean(record.account_owner_uid) } : {}),
  };
}

function dispositionFrom(value: unknown): TaskStatusInput["disposition"] {
  return value === "qualified" || value === "needs_conversation" || value === "not_now" ? value : null;
}
