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
 * readiness ladder, the coverage finding, and the evaluation runs queued or
 * reported against the scene. Deliberately *not* a pilot recommendation: the
 * recommendation is its own card. What this does say is what a waiting job is
 * waiting on: an evaluation that has not started, a job card that is not
 * published so no partner can ask to be evaluated on it, or evaluations that
 * all finished without a pass. Blueprint runs the candidates itself (owner,
 * 2026-10-26), so no headline asks the site to wait on a robot team.
 */

import type { ReadinessStage } from "../../client/src/lib/siteTaskReadiness";
import { taskBriefUnclear, UNCLEAR_BRIEF_ASK } from "./siteTaskScope";
import type { TaskOutcome } from "../../client/src/types/taskOutcome";
import { ANSWER_STAYS_ON_JOB_PAGE, AUTHORITY_ENDED_SENTENCE, FOOTAGE_BEFORE_ACCOUNT_SENTENCE, JOB_WINDOW_ENDED_SENTENCE, JOB_WINDOW_ENDING_MESSAGE,
  jobNoGrantEndingMessage, PREPARATION_ENDED_NEXT, processingFailure, capacityEnded, TASK_NOT_NAMED_SENTENCES, taskNamedOutcome,
  isCompletePreparationOutcome, isProcessingRetrying, isSpendingCapOutcome, processingRetrying } from "./taskPreparationOutcome";
import { simulationHoldSentence, type SceneHoldOutcome, type ScreeningHoldDetail } from "./betaPolicyScreeningContract";
import { isTerminalSceneOutcomeKind, sceneOutcomeMessage, sceneWaitMessage, type SceneOutcomeReading } from "./sceneIntentOutcome";

/**
 * The decision, in the operator's terms.
 *
 * A deliberately short ladder. Each rung is something we can say truthfully
 * today, and the two that would need Pipeline outcomes are absent by design.
 */
export type TaskDecision =
  | "robot_incompatibility"
  | "insufficient_evidence"
  | "processing_failure"
  /** Held before any scene was built: Blueprint cannot simulate this kind of job yet. */
  | "held"
  /** We have it and are reading it. Nothing asked of them. */
  | "received"
  /** We drafted a brief and need them to confirm or correct it. */
  | "confirm_brief"
  /** Confirmed. A recording is the next step; some gates may still be open. */
  | "record"
  /** A recording landed. Coverage has not been measured yet — that is ours. */
  | "footage_received"
  /** A view-only reconstruction is ready; task processing remains Blueprint's. */
  | "preview_ready"
  /** Footage is short of what a scene needs, and we can name the views. */
  | "add_views"
  /** Confirmed, but our screen needs a short call before we fund a scene. */
  | "call_needed"
  /** Confirmed, and an answer only the site can change blocks evaluation. */
  | "not_now"
  /** Confirmed, but the brief gives no sentence about the job: the site is asked for one (`UNCLEAR_BRIEF_ASK`). */
  | "describe_job"
  /** Cleared, and waiting on the operator to save the site to an account. */
  | "save_account"
  /** Confirmed, filmed, covered. As far as we take it before the Pipeline. */
  | "assessing"
  /** Evaluation runs are queued or running against the scene. */
  | "screening"
  /** At least one screening run has concluded, with observations or no result. */
  | "results"
  /** The job is open for evaluation, and no requested evaluation has started yet. */
  | "awaiting_teams"
  /** The job card is not published, so no approved partner can see the job or ask to be evaluated on it. */
  | "not_listed"
  /** Every evaluation so far has finished, none passed, and none is in flight. */
  | "no_team_passed"
  /**
   * Every evaluation so far has finished, and none can support a recommendation
   * either way: diagnostic, unqualified or unscored runs, or runs with no
   * observed episode. Never called a failure (audit A, 2026-10-18).
   */
  | "no_qualified_evaluation"
  /**
   * The video arrived before the job was saved to an account, so the scene
   * cannot be built from it yet and sending it again would not help (owner
   * decision 2026-10-18).
   */
  | "footage_before_account"
  /**
   * The job is over: its work window ran out before Blueprint finished, or it
   * never received a grant and waited as long as a window lasts, and the
   * WebApp's own window sweep recorded the ending (`websiteJobWindowSweep`).
   * Final, so it carries no waiting line and no step for anyone.
   */
  | "ended";

export interface TaskStatus {
  /** Earlier results belong to an object selection the owner has rejected. */
  resultSuperseded?: boolean;
  outcome?: TaskOutcome | null;
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
   * check-in is retired), so there is no next-update time it could keep. The
   * headline says what the job is waiting on. Kept so existing readers keep their shape.
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

/** A fresh, source-bound Pipeline ledger observation; no final robot verdict. */
export interface TaskPreparationStatus {
  outcome?: TaskOutcome | null;
  state: "preparing" | "awaiting_inputs" | "capacity_delayed" | "failed_retryable" | "failed_terminal"
    | "authority_ended" | "handed_off" | "unavailable";
  correlationId: string | null;
  /** Why preparation ended for good; only with `failed_terminal`. */
  terminalReason?: string | null;
  /** The optional question about the guessed object to move (v4); the job never waits on it. */
  question?: { semantic_label: string } | null;
  /** Which robots fit the job by spec sheet (v5). A geometry-only job ends at this check. */
  robotFit?: { route: "full" | "geometry_only"; status: "completed" | "not_run" } | null;
}

/**
 * Where the job's simulation scene stands after the capture was handed off.
 * `ended` is a block the scene cannot leave on its own; `waiting` is a block
 * on our side that may clear; `in_progress` and `completed` are a simulation
 * still being built; `ready` is a built scene whose company simulation package
 * (the scene, the job's object and the success rule) the Pipeline has
 * published. `held` is a scene-stage hold: the Pipeline's own terminal hold
 * outcome, or a blocked hold record it sent (`betaPolicyScreeningHold`), each
 * said in the hold's own sentence (`simulationHoldSentence`). Coarse by design:
 * no Pipeline detail reaches a site. A held scene with no reason reads as
 * `held_capability`. `sceneOutcome` is the Pipeline's own outcome for the
 * scene when it sent one (C-04): an ending and its one email say the same
 * sentence, and a wait says what it waits on. It is read here only to pick
 * that sentence.
 */
export interface TaskSceneProgression {
  state: "in_progress" | "waiting" | "ended" | "completed" | "ready" | "held";
  /** One build attempt failed and the Pipeline keeps trying: a wait, never an ending (review, 2026-11-11). */
  attemptFailed?: true;
  heldReason?: SceneHoldOutcome;
  /** `held` only: the hold's detail with words of its own (`simulationHoldSentence`). */
  holdDetail?: ScreeningHoldDetail;
  sceneOutcome?: SceneOutcomeReading;
}

/** An ending the Pipeline decided (C-04), as the job page and its one email both say it; a hold says its own sentence. */
function sceneEndingMessage(progression: TaskSceneProgression | null | undefined): string | null {
  const outcome = progression?.state === "ended" ? progression.sceneOutcome : undefined;
  return outcome?.terminal && isTerminalSceneOutcomeKind(outcome.kind) && outcome.kind !== "held"
    ? sceneOutcomeMessage(outcome.kind) : null;
}

/** The hold a scene's progression states, if any. */
export function sceneProgressionHold(progression: TaskSceneProgression | null | undefined): SceneHoldOutcome | null {
  return progression?.state === "held" ? progression.heldReason ?? "held_capability" : null;
}

/**
 * Whether a result stands above a recorded window ending: an evaluation run of any kind, a
 * stored scene-stage hold, or a simulation whose package is published (the job's simulation did
 * finish, so "did not finish the simulation in that time" would be false). A terminal outcome the Pipeline's own scene status carries
 * (`sceneOutcome`, C-04) does not: the sweep leaves a job alone when one is already stored, and
 * one that arrives after the ending is the same ending, whose email is not sent twice.
 */
export function resultOutranksWindowEnding(input: { screening?: SceneScreening | null;
  sceneProgression?: TaskSceneProgression | null }, options: { pastLiveGrace?: boolean } = {}): boolean {
  const runs = input.screening;
  // A run record that says queued or running outranks the window's end only while it can still be live: the Pipeline
  // stops it at the deadline, so past the grace (`LIVE_RUN_GRACE_SECONDS`) it is stale (review, 2026-11-11).
  const live = options.pastLiveGrace ? 0 : (runs?.queued ?? 0) + (runs?.running ?? 0);
  if (runs && live + runs.reported + runs.noResult > 0) return true;
  const scene = input.sceneProgression;
  return scene?.state === "ready" || scene?.state === "held" && !scene.sceneOutcome;
}

/** One sentence per reason the Pipeline can give; an unknown reason adds nothing. */
const ENDED_REASON: Record<string, string> = {
  retry_exhausted: "We tried several times and could not get past a problem on our side.",
  budget_exhausted: "Preparation stopped at a limit on our side.",
  // Every cause the Pipeline sends it for is ours: its disk or staging stayed short, or the job waited for room until
  // its grant ran out. Said without naming either (review, 2026-11-12).
  capacity_blocked: "The problem was on our side, not yours.",
  permanent_invalid: "We could not read this video.",
  out_of_scope: "We can't simulate this kind of job yet.",
};
/**
 * A `capacity_blocked` ending, as the page and its email open: ours, nothing the site did. Whether the video is kept
 * is said only where it is known (the page, from its stored capture); the email asks the site to keep its original.
 */
export const CAPACITY_ENDED_HEADLINE = "We couldn't finish preparing your job, and we have stopped trying. "
  + "The problem was on our side, not yours.";
export function preparationEndedSentence(reason: string | null | undefined): string {
  return reason && Object.hasOwn(ENDED_REASON, reason) ? ENDED_REASON[reason] : "";
}

interface TaskStatusInput {
  /** The site's brief holds its own sentence: a "tell us the job" ask from the Pipeline is already answered. */
  siteNamedTask?: boolean;
  briefDrafted: boolean;
  briefConfirmed: boolean;
  /** From `assessReadiness`, when it has been run. */
  stage: ReadinessStage | null;
  coversScene: boolean | null;
  missingViews: string[];
  supplementWouldFinish: boolean;
  /** The walkthrough's completion marker exists. Absent on older callers. */
  hasStoredCapture?: boolean;
  /** The walkthrough arrived before the job was saved to an account (`footageArrivedBeforeAccount`). */
  footageBeforeAccount?: boolean;
  /** Recording withdrawal overrides retained derived evidence on every surface. */
  consentRevoked?: boolean;
  /** The job's work window has passed while its rights still allowed the work. */
  jobWindowEnded?: boolean;
  /**
   * The WebApp's window sweep recorded this job's ending for its current grant, and the window is
   * still past (`websiteJobWorkWindow.endingRecorded`). Stored, so it holds whatever the Pipeline
   * last reported and whether or not it can be reached.
   */
  jobWindowEndingRecorded?: boolean;
  /**
   * With `jobWindowEndingRecorded`: the job never received a grant, and the sweep ended it after
   * this wait (`websiteJobWorkWindow.noGrantWaitingOn`). Said in that ending's own sentence.
   */
  jobNoGrantWaitingOn?: "site" | "blueprint";
  /** With `jobNoGrantWaitingOn`: why the sweep ended it early (`websiteJobWorkWindow.noGrantReason`). */
  jobNoGrantReason?: "video_over_ingest_limit";
  scenePreviewReady?: boolean;
  /** Verified, current-capture visual output only; never runnable or evaluated. */
  visualReconstructionReady?: boolean;
  /** Current persisted preview reconstruction failed; not a robot-run verdict. */
  scenePreparationFailed?: boolean;
  preparationOutcome?: TaskOutcome | null;
  ownerClosureOutcome?: TaskOutcome | null;
  preparationStatus?: TaskPreparationStatus | null;
  /** The site's stored answer to the question this preparation waits on, if any. */
  targetChoiceAnswer?: "confirm_guess" | "other_candidate" | "none_of_these" | null;
  targetChoiceRestoringGuess?: boolean;
  /**
   * The WebApp's own watch says preparation has gone quiet past its bound: no
   * status since the upload, or one state unchanged too long. Our team is
   * alerted by the beta ops monitor at the same bound.
   */
  preparationOverdue?: boolean;
  /** After hand-off: the job's simulation scene, when the caller looked. */
  sceneProgression?: TaskSceneProgression | null;
  /**
   * The job's simulation package is delivered to the website for its current capture (`storedCompanySimulation`): the
   * stored fact the job page's outlook and a company's "Download the simulation" read. A room package counts.
   */
  simulationDelivered?: boolean;
  /** Runs against the scene, when the caller looked. Absent means it did not. */
  screening?: SceneScreening | null;
  /**
   * Our screen's verdict once the brief is confirmed. Blueprint builds a scene
   * only for `qualified`, so the other two must never read as "preparing".
   * Absent on older callers, which keeps their ladder unchanged.
   */
  disposition?: "qualified" | "needs_conversation" | "not_now" | null;
  /**
   * The confirmed brief gives no sentence about the job (`taskBriefUnclear`), so the site is asked for one.
   * No other reading of the job's kind or shape reaches this ladder: an accepted job of any kind is shown
   * what every accepted job is shown.
   */
  briefUnclear?: boolean;
  /** Where the site books the screening call, when one is needed. */
  bookingUrl?: string | null;
  /**
   * Whether the site is saved to an account. A scene is built only for a
   * claimed site. Absent on callers that cannot tell, which skips the rung.
   */
  claimed?: boolean;
  /** Stable source ownership permits guest preparation without an account. */
  sourceOwned?: boolean;
  /** Robot teams may request an evaluation now (`teamJobAccess`). */
  openForEvaluations?: boolean;
  /** False when the job card is not published, so no team can see the job. */
  listed?: boolean;
  /** Whether Blueprint has recorded a recommended pilot. Absent when not read. */
  recommended?: boolean;
}

/**
 * Legacy brief review before a recording. Once authorized footage arrives,
 * Blueprint owns automatic preparation and evaluation.
 */
const CONFIRM_BRIEF_ACTION = "Open your job description, fix anything wrong and confirm it.";

/**
 * Project the status. Pure, so the two surfaces cannot diverge.
 */
/**
 * The outcome the job page states from the Pipeline's verified preparation status, else from the job's own record (a
 * video too large to process, the Atlas preview), before any processing-failure fallback. The one rule for the page
 * and for "your job needs something from you" (`siteActionNeeded.ts`): an outcome whose step is the site's is the ask.
 */
export function pageAskedOutcome(input: Pick<TaskStatusInput, "preparationStatus" | "preparationOutcome" | "scenePreviewReady"
  | "sceneProgression" | "siteNamedTask">): TaskOutcome | null {
  const nativeProgress = input.preparationStatus?.state === "handed_off" || Boolean(input.sceneProgression);
  const asked = input.preparationStatus?.outcome
    ?? (!nativeProgress && (!input.scenePreviewReady || isSpendingCapOutcome(input.preparationOutcome)) ? input.preparationOutcome : null)
    ?? null;
  // The Pipeline still asks for the job's sentence, but the site has given it (review, 2026-11-12): we have it and are
  // starting (the Pipeline re-reads the job within the hour). No ask and no form.
  return asked?.title === TASK_NOT_NAMED_SENTENCES.title && input.siteNamedTask ? taskNamedOutcome() : asked;
}

/**
 * A next step said where no finished video is stored for the job: "Your video is saved" would be untrue there, so it
 * asks the site to keep its original instead. Matches the next steps in `taskPreparationOutcome.ts`.
 */
export function withoutStoredVideo(nextStep: string): string {
  return nextStep
    .replace("Your video is saved;", "Keep your original video;")
    .replace(/Your video (is|stays) saved\.$/, "Keep your original video.")
    .replace(/, and your video is saved\.$/, ". Keep your original video.");
}

/** A world link the page may show: https, with no credentials in it. */
export function safeSceneViewUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

export function projectTaskStatus(input: TaskStatusInput): TaskStatus {
  const base = { stage: input.stage, missingViews: input.missingViews, nextUpdateIso: null };
  // Once footage arrives, reconstruction and evaluation belong to Blueprint.
  // Reviewing the inferred brief remains available in the job details.
  const confirmationAsk = input.briefDrafted && !input.briefConfirmed && !input.hasStoredCapture
    && !input.scenePreviewReady && !input.preparationStatus ? CONFIRM_BRIEF_ACTION : null;
  if (input.consentRevoked) {
    return {
      decision: input.hasStoredCapture ? "footage_received" : "received",
      stage: null,
      headline: "Permission to use your video was withdrawn. Companies can no longer see your job.",
      operatorAction: null,
      missingViews: [],
      nextUpdateIso: null,
    };
  }

  if (input.ownerClosureOutcome) return { ...base, stage: null, missingViews: [], nextUpdateIso: null,
    decision: input.ownerClosureOutcome.category, headline: input.ownerClosureOutcome.title,
    operatorAction: null, outcome: input.ownerClosureOutcome };

  // The window sweep ended this job and, from the cutover on, told the site so once. A withdrawal
  // and an owner closure above say so first. Every waiting, in-progress or needs-review state below
  // would now be untrue, because nothing more runs for a job past its window. Only a result is
  // truer, and each of those has its own email: an estimate or an evaluation's hold, or a run.
  // A recorded ending means the sweep found no live run within the grace, so only a finished result outranks it here.
  if (input.jobWindowEndingRecorded && !resultOutranksWindowEnding(input, { pastLiveGrace: true })) return { ...base, decision: "ended", stage: null,
    missingViews: [], operatorAction: null,
    headline: input.jobNoGrantWaitingOn ? jobNoGrantEndingMessage(input.jobNoGrantWaitingOn, input.jobNoGrantReason)
      : JOB_WINDOW_ENDING_MESSAGE };

  // A preparation stop must not be hidden by an unconfirmed brief or a generic
  // intake gate. Actual evaluation activity/results outrank an older stop.
  // A native handoff supersedes an optional reconstruction preview's failure.
  const hasRuns = input.screening && input.screening.queued + input.screening.running
    + input.screening.reported + input.screening.noResult > 0;
  // An explicit rejection supersedes estimates on the guessed object. Keep
  // the footage and the repair with Blueprint; more recording is optional.
  if (input.targetChoiceAnswer === "none_of_these") {
    const outcome: TaskOutcome = { category: "insufficient_evidence", basis: "missing_evidence",
      title: "None of the suggested objects was right",
      reason: "You told us none of these is the object the job moves. Earlier results used one of them.",
      scope: "",
      nextStep: "Nothing is needed from you. If you like, describe the object in your job description.",
      actionOwner: "blueprint", evidence: [] };
    return { ...base, decision: outcome.category, stage: null, missingViews: [],
      headline: outcome.title, operatorAction: null, outcome, resultSuperseded: true };
  }
  if (input.targetChoiceAnswer === 'other_candidate' && !input.sceneProgression) {
    // A stopped correction shows its stop, not an update that never comes.
    // A still-published question means the Pipeline has not yet consumed the
    // new owner choice. Its prior rejection/failure is not the B attempt's stop.
    const correctionStopped = input.preparationStatus?.question ? null : input.preparationStatus?.outcome
      ?? (input.preparationStatus?.state === "failed_terminal" ? processingFailure()
        : input.preparationStatus?.state === "failed_retryable" ? processingRetrying() : null);
    if (correctionStopped) return {...base, decision: correctionStopped.category, stage: null, missingViews: [],
      headline: correctionStopped.title, operatorAction: null, outcome: correctionStopped, resultSuperseded: true};
    return {...base, decision: 'assessing', stage: null, missingViews: [], operatorAction: null,
      headline: 'Blueprint is updating this job for the corrected object using your saved video.', resultSuperseded: true};
  }
  if (input.targetChoiceRestoringGuess) {
    return {...base, decision: 'assessing', stage: null, missingViews: [], operatorAction: null,
      headline: 'Blueprint is resuming this job with the confirmed object using your saved video.', resultSuperseded: true};
  }
  const nativeProgress = input.preparationStatus?.state === "handed_off" || Boolean(input.sceneProgression);
  const observedPreparation = Boolean(input.scenePreviewReady || nativeProgress
    || input.preparationStatus && input.preparationStatus.state !== "unavailable");
  // The Pipeline's own ending for the scene (C-04) is said in its email's words,
  // with no processing-failure card: a withdrawal is not a processing failure.
  const sceneEnding = sceneEndingMessage(input.sceneProgression);
  if (sceneEnding && !hasRuns) {
    return { ...base, decision: "footage_received", stage: null, missingViews: [], headline: sceneEnding, operatorAction: null };
  }
  // A stop the Pipeline runs again by itself is titled as still being worked on (`processingRetrying`); once the
  // preparation has ended, the same card is said as final.
  const asked = pageAskedOutcome(input);
  const stopped = (input.preparationStatus?.state === "failed_terminal" && isProcessingRetrying(asked) ? processingFailure(asked!.evidence[0]) : asked)
    ?? (input.preparationStatus?.state === "failed_retryable" ? processingRetrying()
      : input.preparationStatus?.state === "failed_terminal" || input.scenePreparationFailed && !nativeProgress
      || input.sceneProgression?.state === "ended" && !sceneEnding ? processingFailure() : null);
  // A `capacity_blocked` ending is said as ours, with no retry or processing step to speak of (`capacityEnded`).
  const capacityEnd = input.preparationStatus?.state === "failed_terminal" && input.preparationStatus.terminalReason === "capacity_blocked"
    && !input.preparationStatus.outcome && stopped ? capacityEnded() : null;
  if (stopped && !hasRuns) {
    const ended = input.preparationStatus?.state === "failed_terminal"
      ? preparationEndedSentence(input.preparationStatus.terminalReason) : "";
    const outcome = capacityEnd ? { ...capacityEnd,
      ...(/^bp-prep-[a-f0-9]{16}$/.test(input.preparationStatus?.correlationId ?? "") ? {reference: input.preparationStatus!.correlationId!} : {}),
      nextStep: input.hasStoredCapture ? capacityEnd.nextStep : withoutStoredVideo(capacityEnd.nextStep) } : {...stopped,
      // The part-6 endings say all there is; nothing is added beside them (review, 2026-11-12).
      reason: input.preparationStatus?.state === "failed_terminal" && !isCompletePreparationOutcome(stopped) && ended
        ? `${stopped.reason} ${ended}` : stopped.reason,
      ...(/^bp-prep-[a-f0-9]{16}$/.test(input.preparationStatus?.correlationId ?? "")
        ? {reference: input.preparationStatus!.correlationId!} : {}),
      nextStep: input.hasStoredCapture ? stopped.nextStep : withoutStoredVideo(stopped.nextStep),
    };
    return { decision: outcome.category, stage: null, headline: outcome.title,
      operatorAction: outcome.actionOwner === "site" ? outcome.nextStep : null,
      missingViews: [], nextUpdateIso: null, outcome };
  }

  if (input.visualReconstructionReady && !nativeProgress && !hasRuns
    && (!input.preparationStatus || input.preparationStatus.state === "unavailable")) {
    return { ...base, decision: "preview_ready", stage: null,
      headline: "A preview of your site is ready. We're working on the next step.",
      operatorAction: null };
  }

  if (input.briefUnclear && !observedPreparation && !hasRuns) {
    return {
      ...base,
      decision: "describe_job",
      headline: UNCLEAR_BRIEF_ASK.headline,
      operatorAction: `${UNCLEAR_BRIEF_ASK.detail} ${UNCLEAR_BRIEF_ASK.nextStep}`,
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

  // Blueprint runs no robot software in the simulation (owner, 2026-11-14), so an older run record is never said as an
  // evaluation, a screening or a result. A run only ever existed against a built, runnable simulation, so the site is
  // told just that.
  const screening = input.screening;
  if (hasRuns) {
    return {
      ...base,
      decision: "assessing",
      headline: "The simulation of your site is ready. Nothing is needed from you.",
      operatorAction: null,
    };
  }

  // Open for evaluation and no requested evaluation has started. Open implies a listed job
  // whose company simulation is stored, so no rung below can be truer than this one.
  if (input.openForEvaluations === true && screening && screening.teams === 0) {
    return {
      ...base,
      decision: "awaiting_teams",
      headline: "Your job is posted for approved deployment companies. Nothing is needed from you.",
      operatorAction: null,
    };
  }

  // Source-bound preparation may proceed while commercial questions remain
  // open. Actual progress outranks an older intake-screen hint.
  if (input.disposition === "not_now" && !observedPreparation && !input.hasStoredCapture) {
    return {
      ...base,
      decision: "not_now",
      headline: "We aren't building a simulation of your site for now, because of one of your answers.",
      operatorAction: "Your job description shows which one. If it changes, update it there.",
    };
  }
  if (input.disposition === "needs_conversation" && !observedPreparation && !input.hasStoredCapture) {
    return {
      ...base,
      decision: "call_needed",
      headline: "A few questions about your site are still open. Answer what you know in your job description; you can leave the rest.",
      // No call is offered: no person stands between a site's video and an introduction.
      operatorAction: "Answer the open questions in your job description.",
    };
  }

  // Legacy jobs without a retained source owner still need an account claim.
  // A signed guest recording already has its own source authority.
  if (input.disposition === "qualified" && input.claimed === false && !input.sourceOwned && !observedPreparation && !input.footageBeforeAccount) {
    return {
      ...base,
      decision: "save_account",
      headline: "Save this job to your account so we can build the simulation of your site.",
      operatorAction: "Save this job to your account and verify your email.",
    };
  }

  // A video sent before the job had an account is born in the Pipeline with no
  // owner, and saving the job afterwards is refused for that capture for good.
  // It outranks only the preparation states below: said plainly instead of an
  // indefinite "preparing" or an unreadable status. Every verdict, evaluation
  // and step of the site's own above stays truer than it, and a scene preview
  // or any run proves otherwise. The notice is sent only while this rung is
  // what the job page shows (`footageBeforeAccountShown`).
  if (input.footageBeforeAccount && !input.sourceOwned && !observedPreparation
      && !(input.screening && input.screening.queued + input.screening.running + input.screening.reported + input.screening.noResult > 0)) {
    return {
      decision: "footage_before_account",
      stage: null,
      headline: FOOTAGE_BEFORE_ACCOUNT_SENTENCE,
      operatorAction: null,
      missingViews: [],
      nextUpdateIso: null,
    };
  }

  // A hold is said to the site about the simulation, as its email says it, never "held" about the job:
  // the site has its answer whatever happens here.
  const sceneHold = sceneProgressionHold(input.sceneProgression);
  const holdHeadline = sceneHold
    ? `${simulationHoldSentence(sceneHold, input.sceneProgression?.holdDetail)} ${ANSWER_STAYS_ON_JOB_PAGE}` : null;
  // A wait the Pipeline named (C-04), in one plain sentence. Older Pipelines name none.
  const sceneWait = input.sceneProgression?.state === "waiting" && input.sceneProgression.sceneOutcome
    ? sceneWaitMessage(input.sceneProgression.sceneOutcome) : null;
  // The simulation of the site is ready once its package is published (the scene's "ready" reads the same stored
  // package) or delivered while a newer build of the scene or its object is still under way. An ending recorded by the
  // preparation or the scene, and a wait on the site's own step, stay ahead of it.
  const preparationEnded = input.preparationStatus?.state === "authority_ended"
    || input.preparationStatus?.state === "awaiting_inputs" && input.preparationStatus.robotFit?.route === "geometry_only";
  const simulationReady = input.sceneProgression?.state === "ready" || input.simulationDelivered === true
    && !preparationEnded && input.sceneProgression?.state !== "ended" && !sceneWait?.operatorAction;

  // A hold, or a simulation whose package is published: nothing is needed from the site either way.
  if (holdHeadline || simulationReady) {
    return {
      ...base,
      decision: "assessing",
      headline: `${holdHeadline ?? "The simulation of your site is ready."} Nothing is needed from you.`,
      operatorAction: null,
    };
  }

  // Preparation is its own required-stage observation. A viewable preview
  // cannot settle it, and a source-stage handoff cannot become a robot result.
  const preparation = input.preparationStatus;
  if (preparation && preparation.state !== "handed_off") {
    // A geometry-only job ends at its robot fit check by design: its result, not a hold.
    const fitCheckEnd = preparation.state === "awaiting_inputs" && preparation.robotFit?.route === "geometry_only";
    // A terminal ending is final; "taking longer" is for a state that can still move.
    const overdue = input.preparationOverdue && preparation.state !== "failed_terminal" && preparation.state !== "unavailable"
      && preparation.state !== "authority_ended"
      && !fitCheckEnd ? " This is taking longer than usual." : "";
    const ended = preparationEndedSentence(preparation.terminalReason);
    const headlines: Record<Exclude<TaskPreparationStatus["state"], "handed_off">, string> = {
      preparing: "We are preparing your job. Nothing is needed from you.",
      awaiting_inputs: !fitCheckEnd
        // Rewritten (review, 2026-11-12): no staff review backs this state when it is shown (the watch alerts after it
        // stays unchanged for a day), so nothing promises one.
        ? "We are still preparing your job. Nothing is needed from you now."
        : preparation.robotFit?.status === "completed"
          ? "Your first look is ready: the robots that could fit your job on paper are listed below. It is an estimate from published specs and your video."
          : "We could not give a first look for this job. The reason is below.",
      // One sentence for every capacity wait the Pipeline reports this way (this month's room, disk or staging).
      capacity_delayed: "Your video is saved and your job is in line for processing on our side. Nothing is needed from you.",
      failed_retryable: "Preparing your job hit a problem on our side. Nothing is needed from you.",
      failed_terminal: preparation.terminalReason === "capacity_blocked"
        ? `${CAPACITY_ENDED_HEADLINE}${input.hasStoredCapture ? " Your video is kept." : " Keep your original video."} Nothing more is needed from you.`
        : `We could not finish building the simulation of your site, and we have stopped trying.${ended ? ` ${ended}` : ""} Nothing more is needed from you.`,
      // Final, never a hold: the job's own window says whether its time ran out.
      // A window ending keeps the job listed, so only a lost permission says to start again.
      authority_ended: input.jobWindowEnded ? `${JOB_WINDOW_ENDED_SENTENCE} ${ANSWER_STAYS_ON_JOB_PAGE}`
        : `${AUTHORITY_ENDED_SENTENCE} ${PREPARATION_ENDED_NEXT}`,
      unavailable: "Your video is saved. We can't show the latest status of your job right now. Check again shortly.",
    };
    const inProgress = preparation.state === "preparing" || preparation.state === "capacity_delayed";
    return {
      ...base,
      decision: inProgress ? "assessing" : "footage_received",
      stage: inProgress ? input.stage : null,
      headline: headlines[preparation.state] + overdue,
      operatorAction: confirmationAsk,
    };
  }

  // A recorded preview failure is distinct from coverage and from robot-run
  // results above. Do not claim ongoing preparation or expose provider errors.
  if (input.scenePreparationFailed && !nativeProgress) {
    return {
      ...base,
      decision: "footage_received",
      stage: null,
      headline: "We could not finish building the simulation of your site. Nothing is needed from you.",
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
      headline: "Your video is saved. Preparing it is taking longer than usual. You don't need to send it again.",
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
      headline: sceneEnding ?? "We could not finish building the simulation of your site, and we have stopped trying. Nothing more is needed from you.",
      operatorAction: null,
    };
  }
  const previewReady = input.scenePreviewReady ? "A preview of your site is ready. " : "";
  // A wait on the site is its one step, so it comes ahead of the optional card below.
  if (sceneWait?.operatorAction) {
    return { ...base, decision: "assessing", headline: `${previewReady}${sceneWait.headline}`, operatorAction: sceneWait.operatorAction };
  }
  // Sharing is the service (2026-11-12): there is no job card for the site to publish, so no status asks for one.
  // This wait is ours.
  if (input.sceneProgression?.state === "waiting") {
    return {
      ...base,
      decision: "assessing",
      headline: `${previewReady}${sceneWait?.headline ?? "We're preparing the simulation of your site. Nothing is needed from you."}`,
      operatorAction: null,
    };
  }

  if (input.scenePreviewReady) {
    return {
      ...base,
      decision: "assessing",
      headline: "A preview of your site is ready. We're preparing the simulation.",
      operatorAction: null,
    };
  }

  // Built, with no package yet: still ours to finish, and not yet "ready".
  if (input.sceneProgression?.state === "completed") {
    return {
      ...base,
      decision: "assessing",
      headline: "We are preparing your job for simulation. Nothing is needed from you.",
      operatorAction: null,
    };
  }

  // Confirmed. If coverage is measured and sufficient, we are assessing;
  // otherwise the next step is a recording.
  if (input.coversScene === true) {
    return {
      ...base,
      decision: "assessing",
      headline: "Your video covers the work area. We're preparing your job.",
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
      // The same words whether or not the footage reader runs: with it off the job still goes on without the site,
      // and no person is set to email the site (journey audit, 2026-11-20).
      headline: "We have your video. Nothing is needed from you now.",
      operatorAction: null,
    };
  }

  if (!input.briefConfirmed) {
    return {
      ...base,
      decision: "confirm_brief",
      headline: "Check your job description and confirm it. You can do this before or after you film.",
      operatorAction: CONFIRM_BRIEF_ACTION,
    };
  }

  return {
    ...base,
    decision: "record",
    headline: "Your job is saved. A video of the job is the next step.",
    operatorAction: "Film the job from your private job link.",
  };
}

/**
 * Pull the raw inputs off a stored request, so callers do not each re-derive
 * where the coverage block or the confirmation timestamp live.
 */
export function taskStatusInputFrom(record: {
  /** The site's brief holds its own sentence (`isPlaceholderSummary` is false), confirmed or not. */
  siteNamedTask?: boolean;
  active_capture_id?: string | null;
  site_task_brief_confirmed_at?: unknown;
  capture_coverage?: {
    capture_id?: string | null;
    covers_scene?: boolean | null;
    missing_coverage?: string[] | null;
    supplement_would_finish?: boolean | null;
  } | null;
  briefDrafted: boolean;
  /** The walkthrough's completion marker exists — footage is in, unreviewed. */
  hasStoredCapture?: boolean;
  /** The walkthrough arrived before the job was saved to an account. */
  footageBeforeAccount?: boolean;
  /** Recording withdrawal overrides retained derived evidence on every surface. */
  consentRevoked?: boolean;
  /** `websiteJobWorkWindow(record)`, when the caller read it. */
  jobWorkWindow?: { untilEpoch: number | null; ended: boolean; endingRecorded?: boolean;
    noGrantWaitingOn?: "site" | "blueprint"; noGrantReason?: "video_over_ingest_limit" } | null;
  scenePreviewReady?: boolean;
  visualReconstructionReady?: boolean;
  scenePreparationFailed?: boolean;
  preparationOutcome?: TaskOutcome | null;
  ownerClosureOutcome?: TaskOutcome | null;
  preparationStatus?: TaskPreparationStatus | null;
  targetChoiceAnswer?: "confirm_guess" | "other_candidate" | "none_of_these" | null;
  targetChoiceRestoringGuess?: boolean;
  preparationOverdue?: boolean;
  sceneProgression?: TaskSceneProgression | null;
  /** `storedCompanySimulation(session, captureId) !== null`, when the caller read the capture's session. */
  simulationDelivered?: boolean;
  stage: ReadinessStage | null;
  screening?: SceneScreening | null;
  site_task_triage?: { disposition?: string | null } | null;
  /** `inboundRequests.site_task_scope`, written when the brief is confirmed. */
  site_task_scope?: { supported?: unknown; reason?: unknown } | null;
  bookingUrl?: string | null;
  /** Pass the owner uid (or null) when the caller read it; omit when it did not. */
  account_owner_uid?: string | null;
  /** Immutable recording owner; does not confer account or workspace access. */
  capture_owner_uid?: string | null;
  /** `teamJobAccess` on the record, when the caller read it. */
  jobAccess?: { evaluationAvailable: boolean; reason: string | null } | null;
  /** Whether a recommended pilot is recorded, when the caller read it. */
  recommended?: boolean;
}): TaskStatusInput {
  const retainedCoverage = record.capture_coverage;
  const coverage = record.active_capture_id && (retainedCoverage?.capture_id
    ? retainedCoverage.capture_id !== record.active_capture_id
    : record.active_capture_id.startsWith("supplement-")) ? null : retainedCoverage;
  return {
    hasStoredCapture: Boolean(record.hasStoredCapture),
    sourceOwned: typeof record.capture_owner_uid === "string" && Boolean(record.capture_owner_uid.trim()),
    ...(record.footageBeforeAccount === true ? { footageBeforeAccount: true } : {}),
    consentRevoked: record.consentRevoked === true,
    ...(record.jobWorkWindow?.ended === true ? { jobWindowEnded: true } : {}),
    ...(record.jobWorkWindow?.endingRecorded === true ? { jobWindowEndingRecorded: true,
      ...(record.jobWorkWindow.noGrantWaitingOn === "site" || record.jobWorkWindow.noGrantWaitingOn === "blueprint"
        ? { jobNoGrantWaitingOn: record.jobWorkWindow.noGrantWaitingOn,
          ...(record.jobWorkWindow.noGrantReason === "video_over_ingest_limit"
            ? { jobNoGrantReason: "video_over_ingest_limit" as const } : {}) } : {}) } : {}),
    scenePreviewReady: Boolean(record.scenePreviewReady),
    ...(record.siteNamedTask ? { siteNamedTask: true } : {}),
    visualReconstructionReady: record.visualReconstructionReady === true,
    scenePreparationFailed: record.scenePreparationFailed === true,
    preparationOutcome: record.preparationOutcome ?? null,
    ownerClosureOutcome: record.ownerClosureOutcome ?? null,
    preparationStatus: record.preparationStatus ?? null,
    ...(record.targetChoiceAnswer ? { targetChoiceAnswer: record.targetChoiceAnswer } : {}),
    ...(record.targetChoiceRestoringGuess ? {targetChoiceRestoringGuess: true} : {}),
    ...(record.preparationOverdue === true ? { preparationOverdue: true } : {}),
    sceneProgression: record.sceneProgression ?? null,
    ...(record.simulationDelivered === true ? { simulationDelivered: true } : {}),
    briefDrafted: record.briefDrafted,
    briefConfirmed: Boolean(record.site_task_brief_confirmed_at),
    stage: record.stage,
    coversScene: typeof coverage?.covers_scene === "boolean" ? coverage.covers_scene : null,
    missingViews: Array.isArray(coverage?.missing_coverage) ? coverage!.missing_coverage! : [],
    supplementWouldFinish: Boolean(coverage?.supplement_would_finish),
    screening: record.screening ?? null,
    disposition: dispositionFrom(record.site_task_triage?.disposition),
    // A job of any kind is shown what every accepted job is shown; only a brief with no sentence about the job asks for one.
    ...(taskBriefUnclear(record.site_task_scope) ? { briefUnclear: true } : {}),
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
