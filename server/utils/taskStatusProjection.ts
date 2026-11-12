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
import { multiStepHoldMessage, taskScopeNotYet } from "./siteTaskScope";
import type { TaskOutcome } from "../../client/src/types/taskOutcome";
import { ANSWER_STAYS_ON_JOB_PAGE, AUTHORITY_ENDED_SENTENCE, FOOTAGE_BEFORE_ACCOUNT_SENTENCE, JOB_WINDOW_ENDED_SENTENCE, JOB_WINDOW_ENDING_MESSAGE,
  jobNoGrantEndingMessage, PREPARATION_ENDED_NEXT, processingFailure, capacityEnded, TASK_NOT_NAMED_SENTENCES, taskNamedOutcome } from "./taskPreparationOutcome";
import { isScreeningHeldOutcome, screeningOutcomeSentenceWithWindow, simulationOutcomeEmailSentence, type ScreeningHeldOutcome, type ScreeningOutcome,
  type ScreeningOutcomeCaveat , simulationHoldSentence, type ScreeningHoldDetail } from "./betaPolicyScreeningContract";
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
  /** Confirmed, and the job is a kind we cannot score in simulation yet. */
  | "not_yet_supported"
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
    ? `. Its median cycle time was ${Math.round(closest.medianCycleSeconds * 10) / 10} s; your target is ${closest.cycleTimeSeconds} s`
    : "";
  return {
    shortfall: `The closest scored evaluation succeeded in ${closest.episodesSucceeded} of ${closest.episodesRun} episodes `
      + `(${percent(closest.episodesSucceeded / closest.episodesRun)}); your pass mark is ${mark}${cycle}.`,
    requirement: `reach ${mark}${closest.cycleTimeSeconds !== null ? ` with a median cycle time of ${closest.cycleTimeSeconds} s or less` : ""}`,
  };
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
 * on our side that may clear; `completed` is a built scene not yet tested;
 * `testing` is a finished scene, task objects in, whose first internal test
 * has started: the point the site is told it is ready (owner decision
 * 2026-10-22). `evaluated` is a finished automatic evaluation whose simulation
 * estimate is the job's result, and `held` one where no candidate can do this
 * kind of job yet (owner decision 2026-10-28). Coarse by design:
 * no Pipeline detail reaches a site. `heldReason` is why a held job has no
 * estimate, and `progressOutcome` a finished evaluation still in our or the
 * owner's hands, or planned again in a newer run. Each outcome is told in the
 * same sentence the run's own summary gives (`screeningOutcomeSentence`, F-03);
 * a measured reason is station-relative, never a task-level verdict (owner
 * decision 2026-10-31). A held job with no reason reads as `held_capability`.
 * `sceneOutcome` is the Pipeline's own outcome for the scene when it sent one
 * (C-04): an ending and its one email say the same sentence, and a wait says
 * what it waits on. It is read here only to pick that sentence.
 */
export interface TaskSceneProgression {
  state: "in_progress" | "waiting" | "ended" | "completed" | "testing" | "evaluated" | "held";
  /** One build attempt failed and the Pipeline keeps trying: a wait, never an ending (review, 2026-11-11). */
  attemptFailed?: true;
  heldReason?: ScreeningHeldOutcome;
  /** `held` only: the hold's detail with words of its own (`simulationHoldSentence`). */
  holdDetail?: ScreeningHoldDetail;
  progressOutcome?: Extract<ScreeningOutcome, "awaiting_spend_approval" | "setup_repair" | "superseded">;
  /** `evaluated` only: what the estimate's sentence adds (`screeningOutcomeCaveat`), as the run's summary and email say it. */
  outcomeCaveat?: ScreeningOutcomeCaveat;
  sceneOutcome?: SceneOutcomeReading;
}

/** An ending the Pipeline decided (C-04), as the job page and its one email both say it; a hold says its own sentence. */
function sceneEndingMessage(progression: TaskSceneProgression | null | undefined): string | null {
  const outcome = progression?.state === "ended" ? progression.sceneOutcome : undefined;
  return outcome?.terminal && isTerminalSceneOutcomeKind(outcome.kind) && outcome.kind !== "held"
    ? sceneOutcomeMessage(outcome.kind) : null;
}

/** The job evaluation outcome a scene's progression states, if any. */
export function sceneProgressionOutcome(progression: TaskSceneProgression | null | undefined): ScreeningOutcome | null {
  if (progression?.state === "evaluated") return "estimate";
  if (progression?.state === "held") return progression.heldReason ?? "held_capability";
  return progression?.progressOutcome ?? null;
}

/**
 * Whether a result stands above a recorded window ending: an evaluation run of any kind, an
 * estimate, or a hold an evaluation reached. A terminal outcome the Pipeline's own scene status
 * carries (`sceneOutcome`, C-04) does not: the sweep leaves a job alone when one is already
 * stored, and one that arrives after the ending is the same ending, whose email is not sent twice.
 */
export function resultOutranksWindowEnding(input: { screening?: SceneScreening | null;
  sceneProgression?: TaskSceneProgression | null }, options: { pastLiveGrace?: boolean } = {}): boolean {
  const runs = input.screening;
  // A run record that says queued or running outranks the window's end only while it can still be live: the Pipeline
  // stops it at the deadline, so past the grace (`LIVE_RUN_GRACE_SECONDS`) it is stale (review, 2026-11-11). A stored
  // scene that says "testing" with no run record is never evidence of a live test.
  const live = options.pastLiveGrace ? 0 : (runs?.queued ?? 0) + (runs?.running ?? 0);
  if (runs && live + runs.reported + runs.noResult > 0) return true;
  const scene = input.sceneProgression;
  return scene?.state === "evaluated" || scene?.state === "held" && !scene.sceneOutcome;
}

/** One sentence per reason the Pipeline can give; an unknown reason adds nothing. */
const ENDED_REASON: Record<string, string> = {
  retry_exhausted: "We tried several times and could not get past a problem on our side.",
  budget_exhausted: "Preparation stopped at a limit on our side.",
  // Every cause the Pipeline sends it for is ours: its disk or staging stayed short, or the job waited for room until
  // its grant ran out. Said without naming either (review, 2026-11-12).
  capacity_blocked: "Nothing you did caused it: we could not start or finish preparing your job in time, for a reason on our side.",
  permanent_invalid: "We could not read this recording.",
  out_of_scope: "This job is outside what the beta can build a scene for.",
};
/**
 * A `capacity_blocked` ending, as the page and its email open: ours, nothing the site did. Whether the video is kept
 * is said only where it is known (the page, from its stored capture); the email asks the site to keep its original.
 */
export const CAPACITY_ENDED_HEADLINE = "We could not start or finish preparing your job in time, for a reason on our side, and we have stopped trying. "
  + "Nothing you did caused it.";
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
  /** Until when Blueprint can keep working on the job (`websiteJobWorkWindow`); absent when unknown. */
  jobWorkUntilEpoch?: number | null;
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
  /** False when no automated footage review runs, so a person reviews it. */
  footageReviewAutomated?: boolean;
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
  /**
   * The current brief names more than one step (`multiStepTaskHold`): held before any spend, so the
   * Pipeline never narrows it to one move. The steps are the ones the screen read.
   */
  multiStepHold?: { steps: string[] } | null;
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

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * Legacy brief review before a recording. Once authorized footage arrives,
 * Blueprint owns automatic preparation and evaluation.
 */
const CONFIRM_BRIEF_ACTION = "Open your job brief, check the summary and answers, correct anything that is wrong, and confirm it.";

/**
 * Project the status. Pure, so the two surfaces cannot diverge.
 */
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
      headline: `${input.hasStoredCapture ? "Your video is saved. " : ""}Recording consent was withdrawn, so we can no longer review the video or show the scene preview.`,
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
  // A job that names several steps gets no grant, reservation or scene intake, so it is held before any
  // spend. Said by name, with the one step that moves it, ahead of whatever the refused preparation reports.
  if (input.multiStepHold && !hasRuns && input.preparationStatus?.state !== "handed_off" && !input.sceneProgression) {
    const held = multiStepHoldMessage(input.multiStepHold.steps);
    return { ...base, decision: "not_yet_supported", stage: null, missingViews: [], headline: held.headline,
      operatorAction: held.action };
  }
  // An explicit rejection supersedes estimates on the guessed object. Keep
  // the footage and the repair with Blueprint; more recording is optional.
  if (input.targetChoiceAnswer === "none_of_these") {
    const outcome: TaskOutcome = { category: "insufficient_evidence", basis: "missing_evidence",
      title: "Object selection needs review",
      reason: "The owner rejected the suggested objects. Earlier results used that selection.",
      scope: "The task object in this job's saved video.",
      nextStep: "The saved video does not yet support an object selection. Blueprint owns the next review; you can also clarify the object in your job details.",
      actionOwner: "blueprint", evidence: [] };
    return { ...base, decision: outcome.category, stage: null, missingViews: [],
      headline: outcome.title, operatorAction: null, outcome, resultSuperseded: true };
  }
  if (input.targetChoiceAnswer === 'other_candidate' && !input.sceneProgression) {
    // A stopped correction shows its stop, not an update that never comes.
    // A still-published question means the Pipeline has not yet consumed the
    // new owner choice. Its prior rejection/failure is not the B attempt's stop.
    const correctionStopped = input.preparationStatus?.question ? null : input.preparationStatus?.outcome
      ?? (input.preparationStatus?.state === "failed_terminal" || input.preparationStatus?.state === "failed_retryable"
        ? processingFailure() : null);
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
  const asked = input.preparationStatus?.outcome
    ?? (!nativeProgress && !input.scenePreviewReady ? input.preparationOutcome : null)
    ?? (input.preparationStatus?.state === "failed_terminal" || input.preparationStatus?.state === "failed_retryable"
      || input.scenePreparationFailed && !nativeProgress
      || input.sceneProgression?.state === "ended" && !sceneEnding ? processingFailure() : null);
  // The Pipeline still asks for the job's sentence, but the site has given it (review, 2026-11-12): we have it and are
  // starting (the Pipeline re-reads the job within the hour). No ask and no form.
  const stopped = asked?.title === TASK_NOT_NAMED_SENTENCES.title && input.siteNamedTask ? taskNamedOutcome() : asked;
  // A `capacity_blocked` ending is said as ours, with no retry or processing step to speak of (`capacityEnded`).
  const capacityEnd = input.preparationStatus?.state === "failed_terminal" && input.preparationStatus.terminalReason === "capacity_blocked"
    && !input.preparationStatus.outcome && stopped ? capacityEnded() : null;
  if (stopped && !hasRuns) {
    const ended = input.preparationStatus?.state === "failed_terminal"
      ? preparationEndedSentence(input.preparationStatus.terminalReason) : "";
    const outcome = capacityEnd ? { ...capacityEnd,
      ...(/^bp-prep-[a-f0-9]{16}$/.test(input.preparationStatus?.correlationId ?? "") ? {reference: input.preparationStatus!.correlationId!} : {}),
      nextStep: input.hasStoredCapture ? capacityEnd.nextStep : capacityEnd.nextStep
        .replace("Your recording is saved;", "Keep your original recording;") } : {...stopped,
      reason: input.preparationStatus?.state === "failed_terminal"
        ? `${stopped.reason} Automatic preparation retries have stopped.${ended ? ` ${ended}` : ""}` : stopped.reason,
      ...(/^bp-prep-[a-f0-9]{16}$/.test(input.preparationStatus?.correlationId ?? "")
        ? {reference: input.preparationStatus!.correlationId!} : {}),
      nextStep: input.hasStoredCapture ? stopped.nextStep : stopped.nextStep
        .replace("Your recording is saved;", "Keep your original recording;")
        .replace("Your recording and findings remain saved.", "The retained findings remain available. Keep your original recording."),
    };
    return { decision: outcome.category, stage: null, headline: outcome.title,
      operatorAction: outcome.actionOwner === "site" ? outcome.nextStep : null,
      missingViews: [], nextUpdateIso: null, outcome };
  }

  if (input.visualReconstructionReady && !nativeProgress && !hasRuns
    && (!input.preparationStatus || input.preparationStatus.state === "unavailable")) {
    return { ...base, decision: "preview_ready", stage: null,
      headline: "Your 3D preview is ready. Blueprint is checking the next processing step.",
      operatorAction: null };
  }

  if (input.taskScope && !observedPreparation && !hasRuns) {
    const notYet = taskScopeNotYet(input.taskScope.reason);
    return {
      ...base,
      decision: "not_yet_supported",
      headline: notYet.headline,
      operatorAction: `${notYet.detail} ${notYet.nextStep}`,
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
      headline: `No evaluation of your job has passed yet. ${runs} finished without passing. ${gap.shortfall ? `${gap.shortfall} ` : ""}To pass, a candidate needs to ${gap.requirement} on your job.${input.openForEvaluations ? " Your job stays open for evaluation, and we email you when another one starts." : ""}`,
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
        ? `${countLabel(screening.ineligible, "run")} could not be scored against your pass mark (for example, a diagnostic run, or a scene not yet ready for scored evaluations)`
        : "",
      screening.noResult > 0 ? `${countLabel(screening.noResult, "run")} ended before any episode was recorded` : "",
    ].filter(Boolean).join(", and ");
    return {
      ...base,
      decision: "no_qualified_evaluation",
      headline: `Evaluations on your job have finished, but none can support a recommendation yet. ${reasons.charAt(0).toUpperCase()}${reasons.slice(1)}, so none counts as a pass or a fail. We email you when a scored evaluation finishes.`,
      operatorAction: null,
    };
  }
  if (screening && screening.reported > 0) {
    const noResult = screening.noResult > 0
      ? ` ${countLabel(screening.noResult, "other run")} ended before any episode was recorded.`
      : "";
    return {
      ...base,
      decision: "results",
      headline: `Results are in from ${countLabel(screening.reported, "screening run")}.${noResult} Each run's episodes are shown separately.`,
      operatorAction: "Review the results.",
    };
  }
  if (screening && screening.noResult > 0) {
    return {
      ...base,
      decision: "results",
      headline: `${countLabel(screening.noResult, "screening run")} ended before any episode was recorded.`,
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

  // Open for evaluation and no requested evaluation has started. Open implies a cleared,
  // confirmed, runnable scene, so no rung below can be truer than this one.
  if (input.openForEvaluations === true && screening && screening.teams === 0) {
    return {
      ...base,
      decision: "awaiting_teams",
      headline: "Your job is open for evaluation. Next, Blueprint tests robots and policies on it in simulation. Approved partners can also ask to have their systems evaluated.",
      operatorAction: null,
    };
  }

  // Source-bound preparation may proceed while commercial questions remain
  // open. Actual progress outranks an older intake-screen hint.
  if (input.disposition === "not_now" && !observedPreparation && !input.hasStoredCapture) {
    return {
      ...base,
      decision: "not_now",
      headline:
        "Not yet. One of your answers means a robot evaluation wouldn't be reliable at this site today, so we aren't building a scene.",
      operatorAction: "Open your job brief to see what is in the way. When it changes, update the brief.",
    };
  }
  if (input.disposition === "needs_conversation" && !observedPreparation && !input.hasStoredCapture) {
    return {
      ...base,
      decision: "call_needed",
      headline:
        "A few operating details still affect the assessment. See the open questions in your job details. You can leave anything you don't know.",
      operatorAction: input.bookingUrl
        ? `You can discuss the remaining questions here: ${input.bookingUrl}`
        : "Answer the open questions in your job details.",
    };
  }

  // Legacy jobs without a retained source owner still need an account claim.
  // A signed guest recording already has its own source authority.
  if (input.disposition === "qualified" && input.claimed === false && !input.sourceOwned && !observedPreparation && !input.footageBeforeAccount) {
    return {
      ...base,
      decision: "save_account",
      headline: input.scenePreparationFailed
        ? "Your job clears our screen. Save it to your account so our team can review the scene preview preparation issue."
        : "Your job clears our screen. Save it to your account and we start building your scene.",
      operatorAction: "Save this site to your account and verify your email.",
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

  // Preparation is its own required-stage observation. A viewable preview
  // cannot settle it, and a source-stage handoff cannot become a robot result.
  const preparation = input.preparationStatus;
  if (preparation && preparation.state !== "handed_off") {
    const reference = /^bp-prep-[a-f0-9]{16}$/.test(preparation.correlationId || "")
      ? ` Reference: ${preparation.correlationId}.` : "";
    // A geometry-only job ends at its robot fit check by design: its result, not a hold.
    const fitCheckEnd = preparation.state === "awaiting_inputs" && preparation.robotFit?.route === "geometry_only";
    // A terminal ending is final; "taking longer" is for a state that can still move.
    const overdue = input.preparationOverdue && preparation.state !== "failed_terminal" && preparation.state !== "unavailable"
      && preparation.state !== "authority_ended"
      && !fitCheckEnd ? " This is taking longer than it should and needs review." : "";
    const ended = preparationEndedSentence(preparation.terminalReason);
    const headlines: Record<Exclude<TaskPreparationStatus["state"], "handed_off">, string> = {
      preparing: "We are preparing your job. Keep your original recording.",
      awaiting_inputs: !fitCheckEnd
        ? "Job preparation needs more information. Keep your original recording; our team needs to review it."
        : preparation.robotFit?.status === "completed"
          ? "Your robot fit check is ready: the robots that fit your job on paper are listed below. It is an estimate from published specs and your video; no robot has been tried on this job."
          : "Blueprint could not check robot fit for this job. The reason is below. Keep your original recording.",
      // One sentence for every capacity wait the Pipeline reports this way (this month's room, disk or staging).
      capacity_delayed: "Your recording is saved and your job is in line for processing on our side; nothing is needed from you. Keep your original recording.",
      failed_retryable: "Job preparation encountered a problem. Keep your original recording; our team needs to review it.",
      failed_terminal: preparation.terminalReason === "capacity_blocked"
        ? `${CAPACITY_ENDED_HEADLINE}${input.hasStoredCapture ? " Your video is kept." : " Keep your original recording."} Nothing more is needed from you.`
        : `Scene preview preparation could not finish, and we have stopped trying.${ended ? ` ${ended}` : ""} Nothing more is needed from you. This needs our team's review. Keep your original recording.`,
      // Final, never a hold: the job's own window says whether its time ran out.
      authority_ended: `${input.jobWindowEnded ? `${JOB_WINDOW_ENDED_SENTENCE} ${ANSWER_STAYS_ON_JOB_PAGE}` : AUTHORITY_ENDED_SENTENCE} ${PREPARATION_ENDED_NEXT}`,
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
  if (input.scenePreparationFailed && !nativeProgress) {
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
      headline: "Your recording is saved. Preparing it is taking longer than it should and needs review. Keep your original recording; you do not need to record it again.",
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
      headline: sceneEnding ?? `${input.scenePreviewReady ? "Your scene preview is ready, but we" : "We"} could not finish preparing your job for robot evaluations, and we have stopped trying. Nothing more is needed from you. This needs our team's review. Keep your original recording.`,
      operatorAction: null,
    };
  }
  const sceneHeld = input.sceneProgression?.state === "held";
  const sceneEvaluated = input.sceneProgression?.state === "evaluated";
  const sceneTesting = sceneEvaluated || sceneHeld || input.sceneProgression?.state === "testing";
  // The run's own summary opens with this same sentence (F-03). A hold is said to the site about the
  // simulation, as its email says it, never "held" about the job: the site has its answer whatever happens here.
  const sceneOutcome = sceneProgressionOutcome(input.sceneProgression);
  const resultHeadline = sceneOutcome ? isScreeningHeldOutcome(sceneOutcome)
    ? `${simulationHoldSentence(sceneOutcome, input.sceneProgression?.holdDetail)} ${ANSWER_STAYS_ON_JOB_PAGE}`
    : screeningOutcomeSentenceWithWindow(sceneOutcome, input.jobWorkUntilEpoch, input.sceneProgression?.outcomeCaveat) : null;
  // A wait the Pipeline named (C-04), in one plain sentence. Older Pipelines name none.
  const sceneWait = input.sceneProgression?.state === "waiting" && input.sceneProgression.sceneOutcome
    ? sceneWaitMessage(input.sceneProgression.sceneOutcome) : null;
  const previewReady = input.scenePreviewReady ? "Your scene preview is ready. " : "";
  // A wait on the site is its one step, so it comes ahead of the optional card below.
  if (sceneWait?.operatorAction) {
    return { ...base, decision: "assessing", headline: `${previewReady}${sceneWait.headline}`, operatorAction: sceneWait.operatorAction };
  }
  if ((input.scenePreviewReady || sceneTesting) && input.listed === false) {
    return {
      ...base,
      decision: "not_listed",
      headline: `${resultHeadline ?? (sceneTesting ? "Your scene is ready, and we are running our first tests on it." : "Your scene preview is ready.")} Your job card is not published, so approved partners cannot see this job in the job library or ask to have their systems evaluated on it.`,
      operatorAction: "To share it with partners approved for the beta, publish its job card from your job page.",
    };
  }

  // Publishing the card above is still the site's own step; this wait is ours.
  if (input.sceneProgression?.state === "waiting") {
    return {
      ...base,
      decision: "assessing",
      headline: `${previewReady}${sceneWait?.headline ?? "Preparing the job for simulation is waiting on our team; nothing is needed from you."}`,
      operatorAction: null,
    };
  }

  // Ready only once the task objects are in and our first test has started.
  // A finished evaluation's outcome is said even when no test executed.
  if (sceneTesting || resultHeadline) {
    return {
      ...base,
      decision: "assessing",
      headline: `${resultHeadline ?? "Your scene is ready, and we are running our first tests on it."} Nothing is needed from you.`,
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

  // Built but not yet tested: still ours to finish, and not yet "ready".
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
        : "We have your recording. Blueprint handles reconstruction and evaluation; the next update will appear in this job.",
      operatorAction: null,
    };
  }

  if (!input.briefConfirmed) {
    return {
      ...base,
      decision: "confirm_brief",
      headline: "Your job brief is ready. Confirm it so we can evaluate your job; you can confirm it before or after you film.",
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
  footageReviewAutomated?: boolean;
  scenePreviewReady?: boolean;
  visualReconstructionReady?: boolean;
  scenePreparationFailed?: boolean;
  preparationOutcome?: TaskOutcome | null;
  ownerClosureOutcome?: TaskOutcome | null;
  preparationStatus?: TaskPreparationStatus | null;
  multiStepHold?: { steps: string[] } | null;
  targetChoiceAnswer?: "confirm_guess" | "other_candidate" | "none_of_these" | null;
  targetChoiceRestoringGuess?: boolean;
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
    ...(record.jobWorkWindow?.untilEpoch ? { jobWorkUntilEpoch: record.jobWorkWindow.untilEpoch } : {}),
    ...(record.jobWorkWindow?.ended === true ? { jobWindowEnded: true } : {}),
    ...(record.jobWorkWindow?.endingRecorded === true ? { jobWindowEndingRecorded: true,
      ...(record.jobWorkWindow.noGrantWaitingOn === "site" || record.jobWorkWindow.noGrantWaitingOn === "blueprint"
        ? { jobNoGrantWaitingOn: record.jobWorkWindow.noGrantWaitingOn,
          ...(record.jobWorkWindow.noGrantReason === "video_over_ingest_limit"
            ? { jobNoGrantReason: "video_over_ingest_limit" as const } : {}) } : {}) } : {}),
    ...(record.footageReviewAutomated === false ? { footageReviewAutomated: false } : {}),
    scenePreviewReady: Boolean(record.scenePreviewReady),
    ...(record.siteNamedTask ? { siteNamedTask: true } : {}),
    visualReconstructionReady: record.visualReconstructionReady === true,
    scenePreparationFailed: record.scenePreparationFailed === true,
    preparationOutcome: record.preparationOutcome ?? null,
    ownerClosureOutcome: record.ownerClosureOutcome ?? null,
    preparationStatus: record.preparationStatus ?? null,
    ...(record.multiStepHold ? { multiStepHold: { steps: [...record.multiStepHold.steps] } } : {}),
    ...(record.targetChoiceAnswer ? { targetChoiceAnswer: record.targetChoiceAnswer } : {}),
    ...(record.targetChoiceRestoringGuess ? {targetChoiceRestoringGuess: true} : {}),
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
