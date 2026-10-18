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
 * reported against the scene. Deliberately *not* a pilot recommendation: the
 * recommendation is its own card. What this does say is what a waiting job is
 * waiting on: robot teams that can evaluate it but have not, a job card that is
 * not published so no team can, or evaluations that all finished without a
 * pass.
 */

import type { ReadinessStage } from "../../client/src/lib/siteTaskReadiness";
import { taskScopeNotYet } from "./siteTaskScope";

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
  /** Confirmed, and the job is a kind we cannot score in simulation yet. */
  | "not_yet_supported"
  /** Cleared, and waiting on the operator to save the site to an account. */
  | "save_account"
  /** Confirmed, filmed, covered. As far as we take it before the Pipeline. */
  | "assessing"
  /** Robot teams have runs queued or running against the scene. */
  | "screening"
  /** At least one screening run has concluded, with observations or no result. */
  | "results"
  /** Robot teams can request an evaluation of the job, and none has yet. */
  | "awaiting_teams"
  /** The job card is not published, so no robot team can see or evaluate the job. */
  | "not_listed"
  /** Every evaluation so far has finished, none passed, and none is in flight. */
  | "no_team_passed"
  /**
   * Every evaluation so far has finished, and none can support a recommendation
   * either way: diagnostic, unqualified or unscored runs, or runs with no
   * observed episode. Never called a failure (audit A, 2026-10-18).
   */
  | "no_qualified_evaluation";

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
   * Always null. Blueprint runs no timed review of a waiting job (the timed
   * check-in is retired, `taskStatusUpdates.ts`), so there is no next-update
   * time it could keep. Updates follow events by email, and the headline says
   * what the job is waiting on. Kept so existing readers keep their shape.
   */
  nextUpdateIso: null;
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
  /**
   * Reported runs whose result meets the job's pass mark, when the caller
   * supplied one. Absent when not counted, and then nothing says no team passed.
   */
  passed?: number;
  /** Reported runs whose evidence cannot establish a qualified pass or failure. */
  ineligible?: number;
  /**
   * The qualified run that came closest to the job's pass mark, when qualified
   * runs reported and none passed: what would change the outcome. Absent when
   * not counted.
   */
  closestQualified?: ClosestQualifiedRun | null;
}

/** A qualified evaluation that did not pass, against the job's own pass mark. */
export interface ClosestQualifiedRun {
  episodesRun: number;
  episodesSucceeded: number;
  medianCycleSeconds: number | null;
  /** The job's pass mark, as a fraction. */
  passMarkRate: number;
  /** The job's cycle-time target, when it set one. */
  cycleTimeSeconds: number | null;
  belowPassMark: boolean;
  cycleTimeMissed: boolean;
}

function percent(fraction: number): string {
  return `${Math.round(fraction * 1000) / 10}%`;
}

/**
 * How far the closest qualified evaluation fell short, and what a pass needs,
 * in the site's terms. One wording for the job page and the email, as /beta
 * promises: "we tell you so and what would change that".
 */
export function qualifiedGap(closest: ClosestQualifiedRun | null | undefined): { shortfall: string; requirement: string } {
  if (!closest || closest.episodesRun <= 0) return { shortfall: "", requirement: "pass" };
  const mark = percent(closest.passMarkRate);
  const cycle = closest.cycleTimeMissed && closest.medianCycleSeconds !== null && closest.cycleTimeSeconds !== null
    ? `, and its median cycle time was ${Math.round(closest.medianCycleSeconds * 10) / 10} s against your target of ${closest.cycleTimeSeconds} s`
    : "";
  return {
    shortfall: `The closest qualified evaluation succeeded in ${closest.episodesSucceeded} of ${closest.episodesRun} episodes `
      + `(${percent(closest.episodesSucceeded / closest.episodesRun)}), against your pass mark of ${mark}${cycle}.`,
    requirement: `reach ${mark}${closest.cycleTimeSeconds !== null ? ` with a median cycle time of ${closest.cycleTimeSeconds} s or less` : ""}`,
  };
}

/** A fresh, source-bound Pipeline ledger observation; no final robot verdict. */
export interface TaskPreparationStatus {
  state: "preparing" | "awaiting_inputs" | "capacity_delayed" | "failed_retryable" | "failed_terminal"
    | "authority_ended" | "handed_off" | "unavailable";
  correlationId: string | null;
  /** Why preparation ended for good; only with `failed_terminal`. */
  terminalReason?: string | null;
}

/**
 * Where the job's simulation scene stands after the capture was handed off.
 * `ended` is a block the scene cannot leave on its own; `waiting` is a block
 * on our side that may clear. Coarse by design: no Pipeline detail reaches a site.
 */
export interface TaskSceneProgression {
  state: "in_progress" | "waiting" | "ended" | "completed";
}

/** One sentence per reason the Pipeline can give; an unknown reason adds nothing. */
const ENDED_REASON: Record<string, string> = {
  retry_exhausted: "We tried several times and could not get past a problem on our side.",
  budget_exhausted: "Your scene needed more processing than the free beta provides for one job.",
  capacity_blocked: "Our processing capacity stayed full for too long.",
  permanent_invalid: "We could not read this recording.",
  out_of_scope: "This job is outside what the beta can build a scene for.",
};
export function preparationEndedSentence(reason: string | null | undefined): string {
  return reason && Object.hasOwn(ENDED_REASON, reason) ? ENDED_REASON[reason] : "";
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
  /** Recording withdrawal overrides retained derived evidence on every surface. */
  consentRevoked?: boolean;
  /** False when no automated footage review runs, so a person reviews it. */
  footageReviewAutomated?: boolean;
  scenePreviewReady?: boolean;
  /** Current persisted preview reconstruction failed; not a robot-run verdict. */
  scenePreparationFailed?: boolean;
  preparationStatus?: TaskPreparationStatus | null;
  /**
   * The WebApp's own watch says preparation has gone quiet past its bound: no
   * status since the upload, or one state unchanged too long. Our team is
   * alerted by the beta ops monitor at the same bound.
   */
  preparationOverdue?: boolean;
  /** After hand-off: the job's simulation scene, when the caller looked. */
  sceneProgression?: TaskSceneProgression | null;
  /** Runs against the scene, when the caller looked. Absent means it did not. */
  screening?: SceneScreening | null;
  /**
   * Our screen's verdict once the brief is confirmed. Blueprint builds a scene
   * only for `qualified`, so the other two must never read as "preparing".
   * Absent on older callers, which keeps their ladder unchanged.
   */
  disposition?: "qualified" | "needs_conversation" | "not_now" | null;
  /**
   * The confirmed job's scope screen, when it found a kind we cannot score.
   * Such a job is not opened to robot teams, so no later rung is true for it.
   */
  taskScope?: { supported: false; reason: string | null } | null;
  /** Where the site books the screening call, when one is needed. */
  bookingUrl?: string | null;
  /**
   * Whether the site is saved to an account. A scene is built only for a
   * claimed site. Absent on callers that cannot tell, which skips the rung.
   */
  claimed?: boolean;
  /** Robot teams may request an evaluation now (`teamJobAccess`). */
  openForEvaluations?: boolean;
  /** False when the job card is not published, so no team can see the job. */
  listed?: boolean;
  /** Whether Blueprint has recorded a recommended pilot. Absent when not read. */
  recommended?: boolean;
}

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * What the site does about an unconfirmed brief. Robot teams can evaluate only
 * a confirmed job (`teamJobAccess` → `isRunnableTask`), so this is never optional.
 */
const CONFIRM_BRIEF_ACTION = "Open your job brief, check the summary and answers, correct anything that is wrong, and confirm it.";

/**
 * Project the status. Pure, so the two surfaces cannot diverge.
 */
export function projectTaskStatus(input: TaskStatusInput): TaskStatus {
  const base = { stage: input.stage, missingViews: input.missingViews, nextUpdateIso: null };
  // A drafted brief the site has not confirmed. Where a rung's headline is
  // ours to resolve (a preparation problem), the confirmation rides with it.
  const confirmationAsk = input.briefDrafted && !input.briefConfirmed ? CONFIRM_BRIEF_ACTION : null;
  if (input.consentRevoked) {
    return {
      decision: input.hasStoredCapture ? "footage_received" : "received",
      stage: null,
      headline: `${input.hasStoredCapture ? "Your video is saved. " : ""}Recording consent was withdrawn. Capture-derived review and the scene preview are unavailable.`,
      operatorAction: null,
      missingViews: [],
      nextUpdateIso: null,
    };
  }

  if (input.taskScope) {
    const notYet = taskScopeNotYet(input.taskScope.reason);
    return {
      ...base,
      decision: "not_yet_supported",
      headline: notYet.headline,
      operatorAction: `${notYet.detail} ${notYet.nextStep}`,
    };
  }

  // Coverage measured a shortfall we can name. This is the most actionable
  // state and it takes priority: it is a specific, cheap thing they can do.
  if (input.coversScene === false && input.missingViews.length) {
    return {
      ...base,
      decision: "add_views",
      headline: input.supplementWouldFinish
        ? "Your footage shows the job. One or two more views would finish the scene."
        : "Your footage needs more coverage before we can build the scene.",
      operatorAction: `Add: ${input.missingViews.join(", ")}.`,
    };
  }

  if (!input.briefDrafted) {
    return {
      ...base,
      decision: "received",
      headline: "We have your job and are reading what you sent.",
      operatorAction: null,
    };
  }

  // The two rungs the Pipeline gap used to keep off this ladder. A run only
  // exists against runnable supply, so anything counted here is downstream of
  // every rung below; a reported result outranks a queued one.
  const screening = input.screening;
  // Settled and no pass: say so, rather than leave "results are in" standing
  // as if a recommendation might follow from them. Only when the caller counted
  // passes against the job's pass mark and read the recommendation.
  if (screening && screening.queued + screening.running === 0 && screening.reported > 0 && screening.noResult === 0
    && screening.passed === 0 && (screening.ineligible ?? 0) === 0 && input.recommended === false) {
    const runs = countLabel(screening.reported + screening.noResult, "evaluation run");
    const gap = qualifiedGap(screening.closestQualified);
    return {
      ...base,
      decision: "no_team_passed",
      headline: `No team's evaluation has passed yet. ${runs} on your job finished without passing, so there is no recommended pilot. ${gap.shortfall ? `${gap.shortfall} ` : ""}A recommendation needs one team's evaluation to ${gap.requirement}${input.openForEvaluations ? "; your job is still open to robot teams, and we email you when one starts an evaluation" : ""}.`,
      operatorAction: null,
    };
  }
  // Settled with nothing that can count either way: diagnostic, unqualified or
  // unscored runs, or runs with no observed episode. Saying "no team passed"
  // would call them failures; saying nothing left the site with no next step.
  if (screening && screening.passed === 0 && screening.ineligible !== undefined
    && screening.queued + screening.running === 0 && screening.reported + screening.noResult > 0
    && screening.reported - screening.ineligible === 0 && input.recommended === false) {
    const reasons = [
      screening.ineligible > 0
        ? `${countLabel(screening.ineligible, "run")} could not be scored against your job's pass mark (for example, a diagnostic run, or a scene not yet qualified for scored evaluations)`
        : "",
      screening.noResult > 0 ? `${countLabel(screening.noResult, "run")} ended without an observed episode` : "",
    ].filter(Boolean).join(", and ");
    return {
      ...base,
      decision: "no_qualified_evaluation",
      headline: `Evaluations on your job have finished, but none can support a recommendation yet: ${reasons}, so none counts as a pass or a failure. We email you when a qualified evaluation finishes.`,
      operatorAction: null,
    };
  }
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
      headline: screening.running === 0
        ? "Robot screening has not started. Results are not available yet."
        : "Robot screening is in progress. Results are not available yet.",
      operatorAction: null,
    };
  }

  // Open to robot teams and nobody has asked yet. Open implies a cleared,
  // confirmed, runnable scene, so no rung below can be truer than this one.
  if (input.openForEvaluations === true && screening && screening.teams === 0) {
    return {
      ...base,
      decision: "awaiting_teams",
      headline: "Your job is open to robot teams approved for the beta. No team has started an evaluation yet; we email you when one does.",
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
      operatorAction: "Open your job brief to see what is in the way. When it changes, update the brief.",
    };
  }
  if (input.disposition === "needs_conversation") {
    return {
      ...base,
      decision: "call_needed",
      headline:
        "Some operating details still affect the assessment. Review the specific open questions in your job details; facts you cannot establish can remain unknown.",
      operatorAction: input.bookingUrl
        ? `You can discuss the remaining questions here: ${input.bookingUrl}`
        : "Answer the consequential questions in your job details.",
    };
  }

  // Filmed, and the brief we drafted is still unconfirmed: the one step left
  // that is the site's own. No later waiting rung may stand in for it. "We
  // are checking your footage" or "your preview is ready" read as though
  // nothing were asked of the site, and the job waited unopened. A
  // preparation problem keeps its own headline below and carries the ask.
  // Waiting for our capacity is preparation in progress, not a problem.
  const preparationProblem = input.scenePreparationFailed === true || Boolean(input.preparationStatus
    && input.preparationStatus.state !== "preparing" && input.preparationStatus.state !== "capacity_delayed"
    && input.preparationStatus.state !== "handed_off");
  if (confirmationAsk && !preparationProblem
    && (input.hasStoredCapture || input.scenePreviewReady || input.coversScene === true)) {
    return {
      ...base,
      decision: "confirm_brief",
      headline: "We have your recording. Next, confirm your job brief: robot teams can evaluate your job only after you confirm it.",
      operatorAction: confirmationAsk,
    };
  }

  // Cleared, but Blueprint builds the scene only for a site saved to an
  // account. Until then "we are preparing it" would not be true.
  if (input.disposition === "qualified" && input.claimed === false && !input.scenePreviewReady) {
    return {
      ...base,
      decision: "save_account",
      headline: input.scenePreparationFailed
        ? "Your job clears our screen. Save it to your account so our team can review the scene preview preparation issue."
        : "Your job clears our screen. Save it to your account and we start building your scene.",
      operatorAction: "Save this site to your account and verify your email.",
    };
  }

  // Preparation is its own required-stage observation. A viewable preview
  // cannot settle it, and a source-stage handoff cannot become a robot result.
  const preparation = input.preparationStatus;
  if (preparation && preparation.state !== "handed_off") {
    const reference = /^bp-prep-[a-f0-9]{16}$/.test(preparation.correlationId || "")
      ? ` Reference: ${preparation.correlationId}.` : "";
    // A terminal ending is final; "taking longer" is for a state that can still move.
    const overdue = input.preparationOverdue && preparation.state !== "failed_terminal" && preparation.state !== "unavailable"
      ? " This is taking longer than it should, and our team has been told." : "";
    const ended = preparationEndedSentence(preparation.terminalReason);
    const headlines: Record<Exclude<TaskPreparationStatus["state"], "handed_off">, string> = {
      preparing: "We are preparing your job. Keep your original recording.",
      awaiting_inputs: "Job preparation needs more information. Keep your original recording; our team needs to review it.",
      capacity_delayed: "Your recording is saved and queued. Preparation is waiting for processing capacity on our side; nothing is needed from you. Keep your original recording.",
      failed_retryable: "Job preparation encountered a problem. Keep your original recording; our team needs to review it.",
      failed_terminal: `Scene preview preparation could not finish, and we have stopped trying.${ended ? ` ${ended}` : ""} Nothing more is needed from you, and our team has been told. Keep your original recording.`,
      authority_ended: "Processing is on hold while our team checks its authorization. Keep your original recording.",
      unavailable: "Your recording is saved. We could not verify the latest preparation status. Keep your original recording and check again shortly.",
    };
    const inProgress = preparation.state === "preparing" || preparation.state === "capacity_delayed";
    return {
      ...base,
      decision: inProgress ? "assessing" : "footage_received",
      stage: inProgress ? input.stage : null,
      headline: headlines[preparation.state] + overdue + reference,
      operatorAction: confirmationAsk,
    };
  }

  // A recorded preview failure is distinct from coverage and from robot-run
  // results above. Do not claim ongoing preparation or expose provider errors.
  if (input.scenePreparationFailed) {
    return {
      ...base,
      decision: "footage_received",
      stage: null,
      headline: "Scene preview preparation could not finish. Our team needs to review it. Keep your original recording.",
      operatorAction: confirmationAsk,
    };
  }

  // No preparation status has reached us since the upload, past the watch's
  // bound. Say so rather than let a later rung claim we are preparing it.
  if (!preparation && input.preparationOverdue) {
    return {
      ...base,
      decision: "footage_received",
      stage: null,
      headline: "Your recording is saved. Preparing it is taking longer than it should, and our team has been told. Keep your original recording; you do not need to record it again.",
      operatorAction: null,
    };
  }

  // After hand-off the job's simulation scene has its own progress. A block it
  // cannot leave is stated plainly; a wait on our side is not a site step.
  if (input.sceneProgression?.state === "ended") {
    return {
      ...base,
      decision: "footage_received",
      stage: null,
      headline: `${input.scenePreviewReady ? "Your scene preview is ready, but we" : "We"} could not finish preparing your job for robot evaluations, and we have stopped trying. Nothing more is needed from you, and our team has been told. Keep your original recording.`,
      operatorAction: null,
    };
  }
  if (input.scenePreviewReady && input.listed === false) {
    return {
      ...base,
      decision: "not_listed",
      headline: "Your scene preview is ready. Your job card is not published, so robot teams cannot see or evaluate this job, and it cannot lead to a recommended pilot.",
      operatorAction: "To open it to robot teams approved for the beta, publish its job card from your job page.",
    };
  }

  // Publishing the card above is still the site's own step; this wait is ours.
  if (input.sceneProgression?.state === "waiting") {
    return {
      ...base,
      decision: "assessing",
      headline: `${input.scenePreviewReady ? "Your scene preview is ready. " : ""}Preparing the job for simulation is waiting on our team; nothing is needed from you.`,
      operatorAction: null,
    };
  }

  if (input.scenePreviewReady) {
    return {
      ...base,
      decision: "assessing",
      headline: "Your scene preview is ready. We are preparing the job for simulation.",
      operatorAction: null,
    };
  }

  // Confirmed. If coverage is measured and sufficient, we are assessing;
  // otherwise the next step is a recording.
  if (input.coversScene === true) {
    return {
      ...base,
      decision: "assessing",
      headline: "We can assess this job. Your capture covers the work area and we are preparing it.",
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

  if (!input.briefConfirmed) {
    return {
      ...base,
      decision: "confirm_brief",
      headline: "Your job brief is ready. Confirm it so robot teams can evaluate your job; you can confirm it before or after you film.",
      operatorAction: CONFIRM_BRIEF_ACTION,
    };
  }

  return {
    ...base,
    decision: "record",
    headline: "We can assess this job. A recording of the work area is the next step.",
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
  briefDrafted: boolean;
  /** The walkthrough's completion marker exists — footage is in, unreviewed. */
  hasStoredCapture?: boolean;
  /** Recording withdrawal overrides retained derived evidence on every surface. */
  consentRevoked?: boolean;
  footageReviewAutomated?: boolean;
  scenePreviewReady?: boolean;
  scenePreparationFailed?: boolean;
  preparationStatus?: TaskPreparationStatus | null;
  preparationOverdue?: boolean;
  sceneProgression?: TaskSceneProgression | null;
  stage: ReadinessStage | null;
  screening?: SceneScreening | null;
  site_task_triage?: { disposition?: string | null } | null;
  /** `inboundRequests.site_task_scope`, written when the brief is confirmed. */
  site_task_scope?: { supported?: unknown; reason?: unknown } | null;
  bookingUrl?: string | null;
  /** Pass the owner uid (or null) when the caller read it; omit when it did not. */
  account_owner_uid?: string | null;
  /** `teamJobAccess` on the record, when the caller read it. */
  jobAccess?: { evaluationAvailable: boolean; reason: string | null } | null;
  /** Whether a recommended pilot is recorded, when the caller read it. */
  recommended?: boolean;
}): TaskStatusInput {
  const coverage = record.capture_coverage;
  return {
    hasStoredCapture: Boolean(record.hasStoredCapture),
    consentRevoked: record.consentRevoked === true,
    ...(record.footageReviewAutomated === false ? { footageReviewAutomated: false } : {}),
    scenePreviewReady: Boolean(record.scenePreviewReady),
    scenePreparationFailed: record.scenePreparationFailed === true,
    preparationStatus: record.preparationStatus ?? null,
    ...(record.preparationOverdue === true ? { preparationOverdue: true } : {}),
    sceneProgression: record.sceneProgression ?? null,
    briefDrafted: record.briefDrafted,
    briefConfirmed: Boolean(record.site_task_brief_confirmed_at),
    stage: record.stage,
    coversScene: typeof coverage?.covers_scene === "boolean" ? coverage.covers_scene : null,
    missingViews: Array.isArray(coverage?.missing_coverage) ? coverage!.missing_coverage! : [],
    supplementWouldFinish: Boolean(coverage?.supplement_would_finish),
    screening: record.screening ?? null,
    disposition: dispositionFrom(record.site_task_triage?.disposition),
    taskScope: record.site_task_scope?.supported === false
      ? { supported: false, reason: typeof record.site_task_scope.reason === "string" ? record.site_task_scope.reason : null }
      : null,
    bookingUrl: record.bookingUrl ?? null,
    ...("account_owner_uid" in record ? { claimed: Boolean(record.account_owner_uid) } : {}),
    ...(record.jobAccess ? { openForEvaluations: record.jobAccess.evaluationAvailable,
      listed: record.jobAccess.reason !== "not_listed" } : {}),
    ...(typeof record.recommended === "boolean" ? { recommended: record.recommended } : {}),
  };
}

function dispositionFrom(value: unknown): TaskStatusInput["disposition"] {
  return value === "qualified" || value === "needs_conversation" || value === "not_now" ? value : null;
}
