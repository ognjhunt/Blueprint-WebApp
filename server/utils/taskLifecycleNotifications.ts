import { noResultObservationText, type NoResultObservation } from "./runNoResultObservation";
/**
 * Durable, deduplicated notices for every real event on a site's task.
 *
 * The site hears from us when something happens, not on a timer: its task
 * was received, its footage landed, its scene was built, its card went live,
 * an evaluation started, a result came in, a partner asked about a pilot.
 * Blueprint runs the candidates itself (owner, 2026-10-26), so the notices
 * speak of evaluations and candidates, not of robot teams picking a job up.
 * The scheduled check-in that used to fill the gaps between these is retired.
 * Waiting is an event too: the job opening for evaluation, and every
 * evaluation so far finishing without a pass, each send their own notice.
 * Per-run and per-request events carry an `eventId`, so each one is its own
 * email and a retry of the same event is not.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { captureUploadUrlFor } from "./captureUploadToken";
import { enqueueOutbox, CAPTURE_OUTBOX_COLLECTION, type OutboxKind } from "./captureOutbox";
import { automationBatch } from "./automationBatch";
import { logger } from "../logger";
import { footageArrivedBeforeAccount } from "./siteWalkthrough";
import { decryptFieldValue } from "./field-encryption";
import { finePrint, finePrintLast } from "./emailLayout";
import { taskLifecycleNotificationIsCurrent } from "./taskLifecycleNotificationAuthority";
import { drainPendingWebsitePreparationNotifications } from "./websitePreparationStatus";
import { preparationEndedSentence } from "./taskStatusProjection";
import { EARLY_TASK_HOLD_DETAIL, EARLY_TASK_HOLD_SENTENCES, earlyTaskHoldOf, isEarlyTaskHoldReason,
  FOOTAGE_BEFORE_ACCOUNT_SENTENCE, JOB_NO_GRANT_SITE_ENDING_SUBJECT, JOB_WINDOW_ENDING_MESSAGE, JOB_WINDOW_ENDING_SUBJECT, jobNoGrantEndingMessage,
  isRecaptureReason, LARGE_VIDEO_RECAPTURE_SENTENCES, RECAPTURE_SENTENCES, RECAPTURE_TITLE, recaptureReasonOf,
  type EarlyTaskHoldReason, type RecaptureReason } from "./taskPreparationOutcome";
import { isWebsiteJobNoGrantEndedEventId, isWebsiteJobWindowEndedEventId } from "./websiteJobWindowEnding";
import { selectWebsiteAtlasPreview } from "./websiteAtlasPreview";
import { isScreeningResultOutcome, simulationOutcomeEmailSentence, storedScreeningOutcomeCaveat,
  type ScreeningOutcome, type ScreeningOutcomeCaveat } from "./betaPolicyScreeningContract";
import { PLAIN_SETUP_CAVEAT, projectSimulationProof, testHeadline, testNotRunLine, testResultOf, testSubLine,
  type SimulationProof } from "../../client/src/lib/simulationProof";
import { isTerminalSceneOutcomeKind, sceneOutcomeMessage, sceneOutcomeSubject,
  type TerminalSceneOutcomeKind } from "./sceneIntentOutcome";
import { LIMITS_PAPER, LIMITS_TESTED, SURENESS_WORDS, type SiteAnswer } from "../../client/src/lib/siteAnswer";
import { REASON_UNSIZED as ANSWER_UNSIZED_REASON } from "./siteAnswer";

export type TaskLifecycleMilestone = Extract<
  OutboxKind,
  | "task_received"
  | "video_received"
  | "scene_ready"
  | "scene_tests_started"
  | "preparation_needs_attention"
  | "preparation_ended"
  | "listing_live"
  | "screening_not_now"
  | "results_ready"
  | "run_no_result"
  | "evaluation_outcome"
  | "scene_outcome"
  | "robot_access_question"
  | "awaiting_evaluations"
  | "no_team_passed"
  | "no_qualified_evaluation"
  | "footage_before_account"
  | "video_too_large"
  | "pilot_request"
  | "answer_ready"
>;

/** A ready label without viewable assets is not a scene-ready milestone. */
export function reconstructionIsViewable(record: {
  state?: string | null;
  worldId?: string | null;
  assets?: {
    launchUrl?: string | null;
    panoUrl?: string | null;
    thumbnailUrl?: string | null;
    spzUrlsByDetail?: Record<string, string> | null;
  } | null;
}): boolean {
  if (record.state !== "ready" || !record.worldId || !record.assets) return false;
  return [record.assets.launchUrl, record.assets.panoUrl].some(value => {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch { return false; }
  });
}

/** The site's job in its workspace, where run results open once the site is claimed. */
export function workspaceTaskUrl(requestId: string): string {
  const origin = (process.env.VITE_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "https://tryblueprint.io")
    .replace(/\/+$/, "");
  return `${origin}/app/tasks/${encodeURIComponent(requestId)}`;
}

/**
 * A claimed site may use its workspace. The private owner link shows the
 * same job results without adding an account step.
 */
function whereRunsAre(url: string, workspaceUrl: string | null, action: string): string {
  return workspaceUrl
    ? `${action} in your workspace:\n${workspaceUrl}`
    : `${action} on your private job page:\n${url}`;
}

// Bare bones (2026-11-11): each notice says one thing in at most three short lines, then one button
// ("Label:\nURL"); a line the site must read but that is not the news is fine print (`finePrint`).
const copy: Record<TaskLifecycleMilestone, { subject: string; body: (url: string, detail: string, workspaceUrl: string | null) => string }> = {
  preparation_needs_attention: {
    subject: "An update on your Blueprint job preparation",
    body: (url, detail) => `Building the simulation of your site needs our team's review. Keep your original video; nothing else is needed from you.${detail ? `\n\n${finePrint(detail)}` : ""}\n\nOpen your job:\n${url}`,
  },
  // One per terminal transition. The detail is only a fixed reason sentence and a reference.
  preparation_ended: {
    subject: "We stopped building the simulation of your site",
    body: (url, detail) => `We could not finish building the simulation of your site, and we have stopped trying.${detail ? ` ${detail}` : ""}\n\nNothing is needed from you. Keep your original video.\n\nOpen your job:\n${url}`,
  },
  task_received: {
    subject: "Your Blueprint job link",
    body: (url) => `We have your job.\n\nIf you haven't sent the video yet, send it from your job page. This link opens your job without a password, so please don't forward it.\n\nOpen your job:\n${url}`,
  },
  // The first email after upload is a receipt (owner, 2026-11-11): what happens next, true whichever way the job goes.
  // It never gives an answer; the one answer email is the test result, or, when no test can run, the paper check.
  video_received: {
    subject: "We have your video",
    body: (url) => `Your video arrived safely. Next, we build a simulation of your site and test AI robots on your job in it. We'll email you the result, or, if a test can't run, why not and what we found on paper.\n\nOpen your job:\n${url}`,
  },
  scene_ready: {
    subject: "Your 3D view of the work area is ready",
    body: (url) => `You can look around the work area you filmed on your job page.\n\nOpen your job:\n${url}`,
  },
  // Owner decision 2026-10-22: "ready" only once the task objects are in and
  // our first internal test has started, never when the room alone is built.
  scene_tests_started: {
    subject: "The simulation of your site is ready",
    body: (url) => `Your work area and its objects are in place. We are running our first tests on it now.\n\nNothing is needed from you. We will email you at the next step.\n\nOpen your job:\n${url}`,
  },
  listing_live: {
    subject: "Your job card is now shared",
    // The link below is the owner's job page, which carries the listing control.
    // A site that came in by link alone may have no account, so the account
    // workspace is not the way to hide it.
    body: (url) => `Approved companies can now see the job card you approved, without your name. Your video, address and contacts stay private.\n\nTo stop sharing it, open your job and untick "Show this card in the job library". If the link has expired, the page sends you a fresh one.\n\nOpen your job:\n${url}`,
  },
  screening_not_now: {
    subject: "An update on your Blueprint job",
    body: (url) => `Something we need for your job is missing.\n\nYour job page says what, and how to send it. You can also reply to this email.\n\nOpen your job:\n${url}`,
  },
  results_ready: {
    subject: "Results are in from an evaluation of your job",
    body: (url, detail, workspaceUrl) => `An evaluation run of one candidate in the simulation of your site has finished${detail ? `: ${detail}` : ""}.\n\n${whereRunsAre(url, workspaceUrl, "See the run")}\n\n${finePrint("This is a simulation estimate for that one candidate, not a physical test. It never certifies physical performance or safety.")}`,
  },
  // One per result outcome of the job's evaluation and scene (F-01). The detail
  // is only the outcome's sentence about the simulation, or for an estimate the
  // job page's own simulation proof, and the results disclaimer, built from typed
  // values, never caller text. An estimate's subject is its own (`estimateSubject`).
  evaluation_outcome: {
    subject: "An update on the simulation of your job",
    body: (url, detail, workspaceUrl) => `${detail}\n\n${whereRunsAre(url, workspaceUrl, "See the result")}`,
  },
  // One per terminal outcome of the job's scene intent (C-04). The subject is the
  // ending's own, and the detail is only the job page's sentence for it.
  scene_outcome: {
    subject: "An update on your Blueprint job",
    body: (url, detail, workspaceUrl) => `${detail}\n\n${whereRunsAre(url, workspaceUrl, "Open your job")}`,
  },
  // One per robot access proposal the owner's job page asks about. The detail
  // is only the page's own words for it, built from typed counts, never caller text.
  robot_access_question: {
    subject: "The simulation of your site needs one decision",
    body: (url, detail) => `${detail}\n\nChoose on your job page:\n${url}`,
  },
  run_no_result: {
    subject: "An evaluation run ended without a result",
    body: (url, detail, workspaceUrl) => `An evaluation run in the simulation of your site ended without a complete scored result. ${detail || noResultObservationText()}\n\n${whereRunsAre(url, workspaceUrl, "Review the run")}`,
  },
  awaiting_evaluations: {
    subject: "Your job is ready for evaluation",
    body: (url) => `Your job is ready for evaluation in a simplified simulation of your task, informed by your footage. Nothing is needed from you.\n\nOpen your job:\n${url}`,
  },
  no_team_passed: {
    subject: "No evaluation of your job has passed yet",
    // `detail` is what would change that (`qualifiedGap`), as /beta promises.
    body: (url, detail, workspaceUrl) => `Every simulation evaluation of your job so far has finished, and none passed. ${detail || "We need stronger evidence for this tested configuration."} Nothing is needed from you.\n\n${whereRunsAre(url, workspaceUrl, "See each run")}`,
  },
  no_qualified_evaluation: {
    subject: "Your job's evaluations finished, with no result that counts yet",
    // Never a failure: diagnostic, unqualified or unscored runs count neither way.
    body: (url, _detail, workspaceUrl) => `The evaluations of your job so far have finished, but none can support a recommendation yet, so none counts as a pass or a fail. Nothing is needed from you. We email you when a scored evaluation finishes.\n\n${whereRunsAre(url, workspaceUrl, "See each run")}`,
  },
  video_too_large: {
    // The job page's new-video ask, said the same way (`LARGE_VIDEO_RECAPTURE_SENTENCES`).
    subject: RECAPTURE_TITLE,
    body: (url) => `${LARGE_VIDEO_RECAPTURE_SENTENCES.reason} ${LARGE_VIDEO_RECAPTURE_SENTENCES.nextStep}\n\nSend a new video:\n${url}`,
  },
  footage_before_account: {
    subject: "About your video",
    // Owner decision 2026-10-18: said once, plainly. A re-upload cannot help on
    // Pipeline main, so it is never asked for.
    // No later email follows this one, so it promises none.
    body: (url, _detail, workspaceUrl) => `${FOOTAGE_BEFORE_ACCOUNT_SENTENCE}\n\nFollow the same job:\n${workspaceUrl || url}`,
  },
  // Once per job, when the site's answer first settles. The detail is only the
  // answer's own sentences (`answerReadyDetail`), built from the composed answer.
  answer_ready: {
    subject: "Your job's paper check is ready",
    body: (url, detail) => `${detail}\n\nOpen your job:\n${url}`,
  },
  pilot_request: {
    subject: "A partner asked to have its system evaluated on your job",
    body: (url) => `An approved partner asked to have its system evaluated on your job for a possible pilot. Your details stay private, and nothing is needed from you.\n\nYou and a deployment company agree any physical pilot directly.\n\nOpen your job:\n${url}`,
  },
};

/**
 * Resolve the owner from the authoritative encrypted request and enqueue one
 * message per request and milestone. Calling this again repairs a missed
 * enqueue while the outbox document id prevents a duplicate delivery intent.
 */
/** Source/context-bound preparation notices: an exact event id and current recipient are required. */
export function isWebsitePreparationNotice(milestone: string): milestone is "preparation_needs_attention" | "preparation_ended" {
  return milestone === "preparation_needs_attention" || milestone === "preparation_ended";
}

export async function enqueueTaskLifecycleNotification(params: {
  requestId: string;
  milestone: TaskLifecycleMilestone;
  /** Distinguishes repeated events of one kind: a run id, a request id. */
  eventId?: string;
  /** One clause of event detail for the body, e.g. "12 of 50 episodes succeeded". */
  detail?: string;
  correlationId?: string;
  runProgress?: NoResultObservation;
  /** `preparation_ended` only: the Pipeline's typed reason; unknown values add nothing. */
  terminalReason?: string | null;
  /** Preparation notices: the capture they are about, so an early task hold is told as held. */
  captureId?: string;
  /** `preparation_needs_attention` only: wait until then for the Atlas preview that would name an early task hold. */
  awaitEarlyHoldUntilMs?: number;
  /** `preparation_needs_attention` only: the preparation stop only a new video clears, from the status's outcome. */
  recaptureReason?: RecaptureReason;
  /** `evaluation_outcome` only: the run's result outcome, and an estimate's counts. */
  screeningOutcome?: ScreeningOutcome;
  screeningCounts?: { ran: number; total: number; scored: number };
  /** `evaluation_outcome` estimate only: what the page's sentence adds (`screeningOutcomeCaveat`). */
  screeningCaveat?: ScreeningOutcomeCaveat;
  /** `scene_outcome` only: the terminal outcome's kind; its event id must name it. */
  sceneOutcomeKind?: TerminalSceneOutcomeKind;
  /** `answer_ready` only: the settled answer the email states. */
  siteAnswer?: SiteAnswer;
  /** `evaluation_outcome` estimate and `answer_ready`: the job page's simulation proof; read from the job's results when not given. */
  simulationProof?: SimulationProof | null;
}): Promise<{ enqueued: boolean; reason?: "store_unavailable" | "request_missing" | "contact_missing" | "consent_withdrawn"
  | "awaiting_early_hold_preview" }> {
  if (!db) return { enqueued: false, reason: "store_unavailable" };
  const requestId = params.requestId.trim();
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  if (!snapshot.exists) return { enqueued: false, reason: "request_missing" };
  // New private-link notices bind recipient admission as well as source.
  // Older notice kinds retain their existing ordering and authority behavior.
  let preparationRecipient: string | undefined;
  if (isWebsitePreparationNotice(params.milestone)) {
    try { preparationRecipient = String(await decryptFieldValue(snapshot.data()?.contact?.email ?? "")).trim(); }
    catch { throw new Error("website_preparation_recipient_unavailable"); }
  }
  if (!(await taskLifecycleNotificationIsCurrent({ requestId, kind: params.milestone,
    ...(isWebsitePreparationNotice(params.milestone) ? {preparationEventId: params.eventId, to: preparationRecipient} : {}) }))) {
    return { enqueued: false, reason: "consent_withdrawn" };
  }
  const to = preparationRecipient ?? String(await decryptFieldValue(snapshot.data()?.contact?.email ?? "")).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { enqueued: false, reason: "contact_missing" };
  }
  // Run results open in the site's account; only a claimed site has one.
  const workspaceUrl = typeof snapshot.data()?.account_owner_uid === "string" && snapshot.data()?.account_owner_uid
    ? workspaceTaskUrl(requestId) : null;
  // The job page reads the same verified preview of the same capture for its held sentence.
  const preview = params.milestone === "preparation_needs_attention" && params.captureId
    ? selectWebsiteAtlasPreview(snapshot.data(), params.captureId) : null;
  const earlyTaskHold = earlyTaskHoldOf(preview);
  // The Pipeline delivers the preview separately and can be late: until it says how this capture's Atlas lane
  // ended, or the wait runs out, owe the notice rather than send a generic one the page would contradict.
  if (!earlyTaskHold && params.awaitEarlyHoldUntilMs !== undefined && Date.now() < params.awaitEarlyHoldUntilMs
    && (!preview || preview.state === "processing")) return { enqueued: false, reason: "awaiting_early_hold_preview" };
  // A stop only a new video clears (the preview's own, or the preparation status's): the page asks the site to
  // film again, so the notice says the same, never that the job waits for our team.
  const recaptureReason = earlyTaskHold ? null : recaptureReasonOf(preview)
    ?? (isRecaptureReason(params.recaptureReason) ? params.recaptureReason : null);
  const { captureId: _captureId, awaitEarlyHoldUntilMs: _wait, recaptureReason: _recapture, ...notice } = params;
  const simulationProof = (params.milestone === "evaluation_outcome" || params.milestone === "answer_ready")
    && params.simulationProof === undefined ? await loadSimulationProof(requestId) : params.simulationProof;
  // With no test result to come, the paper check is the answer: read it for the email that says so.
  const siteAnswer = params.siteAnswer ?? ((params.milestone === "evaluation_outcome" && params.screeningOutcome !== "estimate")
    || params.milestone === "preparation_ended" ? await loadPaperAnswer(requestId) : undefined);
  return enqueueOutbox(buildTaskLifecycleNotification({ ...notice, simulationProof, ...(siteAnswer ? { siteAnswer } : {}), requestId, to, workspaceUrl,
    ...(earlyTaskHold ? { earlyTaskHold } : {}), ...(recaptureReason ? { recaptureReason } : {}) }));
}

/** Build the existing notice without a database write or delivery. Atomic
 * request writers can put this intent beside their business mutation. Supply
 * captureUrl when a transaction retry must reuse the exact signed link. */
export function buildTaskLifecycleNotification(params: {
  requestId: string;
  milestone: TaskLifecycleMilestone;
  to: string;
  eventId?: string;
  detail?: string;
  correlationId?: string;
  captureUrl?: string;
  runProgress?: NoResultObservation;
  /** `preparation_ended` only: rendered through a fixed sentence per known reason. */
  terminalReason?: string | null;
  /** The job in the site's workspace, when the site is claimed. Run notices send it there. */
  workspaceUrl?: string | null;
  /** `evaluation_outcome` only: the run's result outcome; its event id must name it. */
  screeningOutcome?: ScreeningOutcome;
  /** `evaluation_outcome` estimate only: candidates that ran, of all, and episodes scored. */
  screeningCounts?: { ran: number; total: number; scored: number };
  /** `evaluation_outcome` estimate only: what the page's sentence adds (`screeningOutcomeCaveat`). */
  screeningCaveat?: ScreeningOutcomeCaveat;
  /** `scene_outcome` only: the terminal outcome's kind; its event id must name it. */
  sceneOutcomeKind?: TerminalSceneOutcomeKind;
  /** `robot_access_question` only: how many chairs and stools the proposal moves; its event id is the proposal digest. */
  robotAccessCounts?: RobotAccessCounts;
  /** `preparation_needs_attention` only: the early task hold the job page states; the notice is then the held one. */
  earlyTaskHold?: EarlyTaskHoldReason;
  /** `preparation_needs_attention` only: the new-video ask the job page states; the notice is then that ask. */
  recaptureReason?: RecaptureReason;
  /**
   * `scene_outcome` only: the job's window ran out and the WebApp's sweep ended it
   * (`websiteJobWindowSweep`). Its event id is the job's fixed one, or the one naming a later window end.
   */
  jobWindowEnded?: true;
  /**
   * `scene_outcome` only: a job that never received a grant, ended by the same sweep, and whose wait
   * it was. Its event id is the job's fixed no-grant one.
   */
  jobNoGrantEnded?: "site" | "blueprint";
  /** `answer_ready` only: the settled answer the email states. */
  siteAnswer?: SiteAnswer;
  /** `evaluation_outcome` estimate and `answer_ready`: the job page's simulation proof, or null when it could not be read. */
  simulationProof?: SimulationProof | null;
  /** With `jobNoGrantEnded`: why the sweep ended it early, said in the ending's own sentence. */
  jobNoGrantReason?: "video_over_ingest_limit";
}): Parameters<typeof enqueueOutbox>[0] {
  const requestId = params.requestId.trim();
  if (isWebsitePreparationNotice(params.milestone) && !/^sha256:[a-f0-9]{64}$/.test(params.eventId || "")) {
    throw new Error("website_preparation_event_invalid");
  }
  const outcomeDetail = params.milestone === "evaluation_outcome" ? evaluationOutcomeDetail(params)
    : params.milestone === "scene_outcome"
      ? params.jobNoGrantEnded ? jobNoGrantEndedDetail(params)
        : params.jobWindowEnded ? jobWindowEndedDetail(params) : sceneOutcomeDetail(params)
    : params.milestone === "robot_access_question" ? robotAccessQuestionDetail(params)
    : params.milestone === "answer_ready" ? answerReadyDetail(params.siteAnswer) : "";
  const held = params.milestone === "preparation_needs_attention" && isEarlyTaskHoldReason(params.earlyTaskHold)
    ? params.earlyTaskHold : null;
  const recapture = !held && params.milestone === "preparation_needs_attention" && isRecaptureReason(params.recaptureReason)
    ? params.recaptureReason : null;
  const message = held ? earlyTaskHoldCopy(held) : recapture ? recaptureCopy(recapture) : copy[params.milestone];
  const url = params.captureUrl ?? captureUploadUrlFor(requestId, "owner");
  const eventId = params.eventId?.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  // Preparation notices never carry caller text: only a validated reference and,
  // for an ending, the fixed sentence for its reason.
  const reference = /^bp-prep-[a-f0-9]{16}$/.test(params.correlationId || "") ? `Reference: ${params.correlationId}.` : "";
  // A stopped simulation means no test result will come: the paper check, when there is one, is the answer.
  const preparationDetail = params.milestone === "preparation_ended"
    ? [preparationEndedSentence(params.terminalReason), paperAnswerLine(params.siteAnswer), reference].filter(Boolean).join(" ") : reference;
  return {
    idempotencyKey: `${requestId}:${params.milestone}${eventId ? `:${eventId}` : ""}`,
    requestId,
    kind: params.milestone,
    ...(isWebsitePreparationNotice(params.milestone) ? {preparationEventId: params.eventId} : {}),
    to: params.to,
    subject: params.milestone === "evaluation_outcome" && params.screeningOutcome === "estimate"
      ? estimateSubject(params.simulationProof)
      : params.milestone === "evaluation_outcome" && paperAnswerLine(params.siteAnswer) ? PAPER_ANSWER_SUBJECT
      : params.milestone === "scene_outcome" && params.jobNoGrantEnded === "site" ? JOB_NO_GRANT_SITE_ENDING_SUBJECT
      : params.milestone === "scene_outcome" && (params.jobWindowEnded || params.jobNoGrantEnded) ? JOB_WINDOW_ENDING_SUBJECT
      : params.milestone === "scene_outcome" && params.sceneOutcomeKind ? sceneOutcomeSubject(params.sceneOutcomeKind)
      : params.milestone === "answer_ready" && params.siteAnswer?.state === "cannot_assess" ? "An update on your Blueprint job"
      : message.subject,
    body: finePrintLast(`${message.body(url, params.milestone === "run_no_result" ? noResultObservationText(params.runProgress)
      : isWebsitePreparationNotice(params.milestone) ? preparationDetail
      : params.milestone === "evaluation_outcome" || params.milestone === "scene_outcome"
        || params.milestone === "robot_access_question" || params.milestone === "answer_ready" ? outcomeDetail
      : params.detail?.trim() ?? "", params.workspaceUrl ?? null)}`),
    replyTo: "hello@tryblueprint.io",
  };
}

/** A new-video ask's one email: the job page's title, reason and next step, in place of the needs-attention notice. */
function recaptureCopy(reason: RecaptureReason): (typeof copy)[TaskLifecycleMilestone] {
  return {
    subject: RECAPTURE_TITLE,
    body: (url, detail) => `${RECAPTURE_SENTENCES[reason].reason} ${RECAPTURE_SENTENCES[reason].nextStep}${detail ? `\n\n${finePrint(detail)}` : ""}\n\nSend a new video:\n${url}`,
  };
}

/** An early task hold's one email: the job page's held sentence, sent in place of the needs-attention notice. */
function earlyTaskHoldCopy(reason: EarlyTaskHoldReason): (typeof copy)[TaskLifecycleMilestone] {
  return {
    subject: "The simulation of your job is on hold",
    body: (url, detail) => `${EARLY_TASK_HOLD_SENTENCES[reason]} ${EARLY_TASK_HOLD_DETAIL}\n\nNothing is needed from you. Keep your original video.${detail ? `\n\n${finePrint(detail)}` : ""}\n\nOpen your job:\n${url}`,
  };
}

/** The subject of the one answer email when no test result will come: the paper check is the answer. */
const PAPER_ANSWER_SUBJECT = "Your job's paper check is ready";
const SIMULATION_DISCLAIMER = "A simulation is not a physical test, and it never certifies physical performance or safety.";
/** An estimate's email when the job's results could not be read: true whatever they show. */
const SIMULATION_FINISHED = "The simulation test of your job has finished. Your job page shows how each AI robot did.";
/** The page's own headline when a stored caveat is all that can be read: it is only ever set when none finished. */
const NONE_FINISHED_HEADLINE = "No AI robot finished your job.";

/** The test result the job page leads with, once the simulation has finished. */
const finishedResult = (proof: SimulationProof | null | undefined) => {
  const result = proof?.state === "done" ? testResultOf(proof) : null;
  return result && result.kind !== "testing" ? result : null;
};

/** "A result" when some AI robot finished the job, as on the page; otherwise the test has simply finished. */
function estimateSubject(proof: SimulationProof | null | undefined): string {
  const result = finishedResult(proof);
  return result && result.kind !== "none_finished" ? "Your simulation test has a result" : "The simulation test of your job has finished";
}

/**
 * A finished simulation, in the job page's own words (`projectSimulationProof`, `testResultOf`, `testHeadline`):
 * the headline the page leads with, its line under it, and the set-up notice when a flag says our simulation may have shaped it. One
 * idea; the ranked list and how far to trust it are on the page.
 */
function estimateDetail(proof: SimulationProof | null | undefined, caveat: ScreeningOutcomeCaveat | null): string {
  const result = finishedResult(proof);
  const said = result ? [testHeadline(result), testSubLine(result), result.setupFlag ? PLAIN_SETUP_CAVEAT : null]
    // No option to name: the page's own line for why, or, unread, what a stored caveat still shows.
    : proof?.state === "done" && testNotRunLine(proof)
      ? [testNotRunLine(proof), proof.options.setupFlag || caveat ? PLAIN_SETUP_CAVEAT : null]
    : caveat ? [NONE_FINISHED_HEADLINE, PLAIN_SETUP_CAVEAT] : [SIMULATION_FINISHED];
  return `${said.filter(Boolean).join(" ")} Nothing is needed from you.`;
}

/** The job's composed answer, for an email that gives the paper check as the answer; undefined when it cannot be read. */
async function loadPaperAnswer(requestId: string): Promise<SiteAnswer | undefined> {
  try {
    const { loadSiteAnswer } = await import("./siteAnswer");
    return (await loadSiteAnswer(requestId)) ?? undefined;
  } catch (error) {
    logger.warn({ error, requestId }, "Could not read the answer for an email; it says only what holds without it");
    return undefined;
  }
}

/** The job's simulation proof as its page shows it, or null when the results cannot be read. Never fails the notice. */
async function loadSimulationProof(requestId: string): Promise<SimulationProof | null> {
  try {
    const { readSiteManagedEvidence } = await import("./siteManagedEvidence");
    const { managedEvidence } = await readSiteManagedEvidence(requestId);
    return projectSimulationProof({ evaluation: managedEvidence as never, pick: null });
  } catch (error) {
    logger.warn({ error, requestId }, "Could not read the simulation result for an email; it says only what holds without it");
    return null;
  }
}

/**
 * The outcome's sentence about the simulation, or for an estimate the job page's simulation proof,
 * and the results disclaimer. The event id must name the same outcome, so the dispatch check reads
 * back exactly what the body says (F-01).
 */
function evaluationOutcomeDetail(params: { eventId?: string; screeningOutcome?: ScreeningOutcome;
  screeningCounts?: { ran: number; total: number; scored: number }; screeningCaveat?: ScreeningOutcomeCaveat;
  simulationProof?: SimulationProof | null; siteAnswer?: SiteAnswer }): string {
  const outcome = params.screeningOutcome;
  const counts = params.screeningCounts;
  if (!isScreeningResultOutcome(outcome) || !new RegExp(`^${outcome}-[a-f0-9]{24}$`).test(params.eventId ?? "")
    || (outcome === "estimate") !== Boolean(counts)
    || (counts && ![counts.ran, counts.total, counts.scored].every(value => Number.isSafeInteger(value) && value >= 0))) {
    throw new Error("evaluation_outcome_notice_invalid");
  }
  // An estimate is the page's test result, under the page's tested limits line; the other outcomes keep theirs.
  if (outcome === "estimate") {
    return `${estimateDetail(params.simulationProof, storedScreeningOutcomeCaveat(params.screeningCaveat))}\n\n${finePrint(LIMITS_TESTED)}`;
  }
  // No test result: the page's own line for why, then the paper check as the answer (the one answer email).
  const why = testNotRunLine(params.simulationProof) ?? simulationOutcomeEmailSentence(outcome);
  const paper = paperAnswerLine(params.siteAnswer);
  return paper ? `${why} ${paper}\n\n${finePrint(LIMITS_PAPER)}`
    : `${why} Nothing is needed from you.\n\n${finePrint(SIMULATION_DISCLAIMER)}`;
}

/** The paper check said as the answer, when no test result will come: the composer's own headline. */
function paperAnswerLine(answer: SiteAnswer | null | undefined): string | null {
  return answer?.state === "ready" && answer.pick
    ? `So the paper check is your answer. ${answer.headline}${answer.sceneNote ? ` ${answer.sceneNote}` : ""}` : null;
}

/**
 * The job page's own sentence for a terminal scene outcome and its closing
 * (C-04). The event id must name the same kind and an outcome digest, so the
 * dispatch check reads back exactly the outcome the body states.
 */
function sceneOutcomeDetail(params: { eventId?: string; sceneOutcomeKind?: TerminalSceneOutcomeKind }): string {
  const kind = params.sceneOutcomeKind;
  if (!isTerminalSceneOutcomeKind(kind) || !new RegExp(`^${kind}-[a-f0-9]{64}$`).test(params.eventId ?? "")) {
    throw new Error("scene_outcome_notice_invalid");
  }
  return sceneOutcomeMessage(kind);
}

/**
 * The job page's own sentence for a job the window sweep ended. Fixed text, and only under a
 * window-ended event id and with no scene outcome kind, so no other notice can carry it.
 */
function jobWindowEndedDetail(params: { eventId?: string; sceneOutcomeKind?: TerminalSceneOutcomeKind }): string {
  if (!isWebsiteJobWindowEndedEventId(params.eventId) || params.sceneOutcomeKind !== undefined) {
    throw new Error("job_window_ended_notice_invalid");
  }
  return JOB_WINDOW_ENDING_MESSAGE;
}

/** The job page's own sentence for a job that never received a grant, ended by the same sweep. Fixed text. */
function jobNoGrantEndedDetail(params: { eventId?: string; sceneOutcomeKind?: TerminalSceneOutcomeKind;
  jobWindowEnded?: true; jobNoGrantEnded?: "site" | "blueprint"; jobNoGrantReason?: "video_over_ingest_limit" }): string {
  if (!isWebsiteJobNoGrantEndedEventId(params.eventId) || params.sceneOutcomeKind !== undefined || params.jobWindowEnded
    || (params.jobNoGrantEnded !== "site" && params.jobNoGrantEnded !== "blueprint")) {
    throw new Error("job_no_grant_ended_notice_invalid");
  }
  if (params.jobNoGrantReason !== undefined && params.jobNoGrantReason !== "video_over_ingest_limit") {
    throw new Error("job_no_grant_ended_notice_invalid");
  }
  return jobNoGrantEndingMessage(params.jobNoGrantEnded, params.jobNoGrantReason);
}

/**
 * Whether an answer is one the site is emailed about: a ready answer, or one
 * that cannot be given because the job is another kind. A video that simply did
 * not show the job clearly is not: the job page already asks the site, in one
 * line, what the robot should do, and no second email is added on top of that.
 */
export function answerIsSettled(answer: SiteAnswer | null | undefined): answer is SiteAnswer {
  if (!answer) return false;
  if (answer.state === "ready") return true;
  return answer.state === "cannot_assess" && Boolean(answer.reason) && answer.reason !== ANSWER_UNSIZED_REASON;
}

/**
 * The answer email for a job of another kind: the composer's headline and its reason. That is the job's one answer,
 * since no test can run on it. A ready answer is never emailed here (owner, 2026-11-11): the site has its receipt
 * (`video_received`), and its one answer email is the test result, or the paper check when no test can run
 * (`evaluation_outcome`, `preparation_ended`).
 */
function answerReadyDetail(answer: SiteAnswer | undefined): string {
  if (!answerEmailDue(answer)) throw new Error("answer_ready_notice_invalid");
  return `${answer.headline}\n\n${answer.reason}`;
}

/** The answer is one this email gives: a job of another kind, which no test can run on. */
export function answerEmailDue(answer: SiteAnswer | null | undefined): answer is SiteAnswer {
  return answerIsSettled(answer) && answer.state === "cannot_assess";
}

/**
 * Tell the site, once, that its answer has settled. Called right after the
 * coverage review stores the video's estimates; the outbox key keeps it to one
 * email per job, and dispatch reads the answer again.
 */
export async function notifyIfAnswerSettled(requestId: string): Promise<{ enqueued: boolean }> {
  const { loadSiteAnswer } = await import("./siteAnswer");
  const answer = await loadSiteAnswer(requestId);
  if (!answerEmailDue(answer)) return { enqueued: false };
  return enqueueTaskLifecycleNotification({ requestId, milestone: "answer_ready", siteAnswer: answer });
}

/** True while the job's answer is still one this email gives. Read again at dispatch, so an older queued email for a
 * ready answer is cancelled rather than sent. */
export async function answerReadyShown(requestId: string): Promise<boolean> {
  const { loadSiteAnswer } = await import("./siteAnswer");
  return answerEmailDue(await loadSiteAnswer(requestId));
}

/** How many of each kind of movable furniture a robot access proposal moves. */
export type RobotAccessCounts = { chair: number; stool: number };

/**
 * The owner's one question about the simulation of their site, in the job
 * page's own words (`describeRobotAccessProposal`): how many chairs or stools
 * keep the robot arm from standing within reach, and the page's two choices.
 * Built from typed counts only, so no cost or budget step can reach it:
 * measuring the furniture is Blueprint's own preparation. The event id must be
 * the proposal digest, so one proposal is one email.
 */
function robotAccessQuestionDetail(params: { eventId?: string; robotAccessCounts?: RobotAccessCounts }): string {
  const counts = params.robotAccessCounts;
  const rows = counts ? ([["chair", counts.chair], ["stool", counts.stool]] as const) : [];
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  if (!/^[a-f0-9]{64}$/.test(params.eventId ?? "") || !rows.length
    || !rows.every(([, count]) => Number.isSafeInteger(count) && count >= 0) || total < 1 || total > 4) {
    throw new Error("robot_access_question_notice_invalid");
  }
  const what = rows.filter(([, count]) => count > 0).map(([kind, count]) => `${count} ${kind}${count === 1 ? "" : "s"}`)
    .join(" and ");
  const one = total === 1;
  return `In the simulation, the robot arm can't stand close enough to reach the job because ${what} ${one ? "is" : "are"} in the way.\n\n`
    + `We can move ${one ? "it" : "them"}, in the simulation only. Your site and your video stay as they are.\n\n`
    + `On your job page, choose "${one ? "Move it in the simulation" : "Move them in the simulation"}" or `
    + `"${one ? "Keep it where it is" : "Keep them where they are"}". Nothing changes until you answer.\n\n`
    + finePrint("Results stay estimates, not a physical test.");
}

/**
 * Tell the site, once, that its job is open for evaluation and no evaluation
 * has been requested yet. Read from the stored record by the same predicate the job
 * library uses, so it is sent only when it is true. Callers that may have just
 * opened a job (a Pipeline sync, a published card) call this; it is a no-op
 * otherwise, and the outbox key keeps it to one email per job.
 */
export async function notifyIfOpenForEvaluations(requestId: string): Promise<{ enqueued: boolean }> {
  if (!(await openAndAwaitingEvaluations(requestId))) return { enqueued: false };
  return enqueueTaskLifecycleNotification({ requestId, milestone: "awaiting_evaluations" });
}

/** True while the job is open to evaluation requests and no team has requested one. Read again at dispatch. */
export async function openAndAwaitingEvaluations(requestId: string): Promise<boolean> {
  if (!db) return false;
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  const { teamJobAccess } = await import("./teamJobAccess");
  if (!snapshot.exists || !teamJobAccess(snapshot.data()).evaluationAvailable) return false;
  const { loadSceneScreening } = await import("./agentEvalRuns");
  return (await loadSceneScreening(requestId)).teams === 0;
}

/**
 * After a site evaluation concludes, when nothing is in flight, nothing passed
 * the job's pass mark and no pilot is recommended:
 *
 * - every concluded run qualified and fell short: tell the site no team has
 *   passed yet, and what would change that (the closest run's gap). Keyed by
 *   the run that concluded, so each run is at most one;
 * - no reported run can count either way (diagnostic, unqualified or
 *   unscored): tell the site once that none can support a recommendation yet.
 *   Never "no team passed": that would call it a failure.
 */
export async function notifyIfNoTeamPassed(requestId: string, concludedRunId: string): Promise<{ enqueued: boolean }> {
  const settled = await settledWithoutPass(requestId);
  if (settled?.state === "no_team_passed") {
    const { qualifiedGap } = await import("./taskStatusProjection");
    const gap = qualifiedGap(settled.screening.closestQualified);
    return enqueueTaskLifecycleNotification({ requestId, milestone: "no_team_passed", eventId: concludedRunId,
      detail: gap.shortfall ? `${gap.shortfall} To pass in this simulation, a candidate needs to ${gap.requirement}.` : undefined });
  }
  if (settled?.state === "no_qualified_evaluation") {
    return enqueueTaskLifecycleNotification({ requestId, milestone: "no_qualified_evaluation" });
  }
  return { enqueued: false };
}

/** The job's runs against its own pass mark, or null while a recommendation stands or the job is missing. */
async function settledScreening(requestId: string) {
  if (!db) return null;
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  const record = snapshot.data();
  if (!snapshot.exists || !record || record.pilot_recommendation) return null;
  const [{ getBrief }, { passMarkForJob }, { loadSceneScreening }] = await Promise.all([
    import("./siteTaskBrief"), import("./pilotRecommendationEvidence"), import("./agentEvalRuns")]);
  return loadSceneScreening(requestId, passMarkForJob(record, await getBrief(requestId) as never));
}

/** Which settled state the job is in, if any. The same rules as the job page (`projectTaskStatus`). */
async function settledWithoutPass(requestId: string) {
  const screening = await settledScreening(requestId);
  if (!screening || screening.queued + screening.running > 0 || screening.passed !== 0) return null;
  const ineligible = screening.ineligible ?? 0;
  if (screening.reported > 0 && screening.noResult === 0 && ineligible === 0)
    return { state: "no_team_passed" as const, screening };
  // Runs that only ended without an observed episode each sent their own
  // run_no_result notice; the page still shows this state for them.
  if (ineligible > 0 && screening.reported - ineligible === 0)
    return { state: "no_qualified_evaluation" as const, screening };
  return null;
}

/** True while every site evaluation has concluded, none passed and no pilot is recommended. Read again at dispatch. */
export async function noTeamHasPassed(requestId: string): Promise<boolean> {
  return (await settledWithoutPass(requestId))?.state === "no_team_passed";
}

/** True while every site evaluation has concluded and none can support a recommendation. Read again at dispatch. */
export async function noQualifiedEvaluationYet(requestId: string): Promise<boolean> {
  return (await settledWithoutPass(requestId))?.state === "no_qualified_evaluation";
}

/** Existing outbox tick repairs a lost enqueue; fresh readback gates dispatch again. */
export async function reconcileWebsitePreparationNotifications(limit = 1): Promise<void> {
  if (!db) return;
  const store = db;
  await drainPendingWebsitePreparationNotifications(async intent => {
    const result = await enqueueTaskLifecycleNotification({...intent, milestone: intent.milestone});
    if (result.enqueued) return "enqueued";
    const key = `${intent.requestId}:${intent.milestone}:${intent.eventId.replace(/[^A-Za-z0-9._-]/g, "_")}`;
    return (await store.collection(CAPTURE_OUTBOX_COLLECTION).doc(key).get()).exists ? "duplicate" : "unavailable";
  }, undefined, Math.max(1, Math.min(limit, 1)));
}


/**
 * Whether the job page shows `footage_before_account` right now, from the same
 * projection and the same inputs the job pages use (owner decision
 * 2026-10-18). The notice is queued and sent only while this holds, so it
 * never tells a site its video cannot be used once a scope verdict, a step of
 * its own, a scene preview or an evaluation says something truer.
 */
export async function footageBeforeAccountShown(requestId: string): Promise<boolean> {
  if (!db) return false;
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  const record = snapshot.data();
  if (!snapshot.exists || !record || await footageArrivedBeforeAccount(requestId, record) !== true) return false;
  const [{ getBrief }, { passMarkForJob }, { loadSceneScreening }, { teamJobAccess }, { projectWebsiteCaptureRights },
    { projectTaskStatus, taskStatusInputFrom }] = await Promise.all([
    import("./siteTaskBrief"), import("./pilotRecommendationEvidence"), import("./agentEvalRuns"), import("./teamJobAccess"),
    import("./websiteTaskContext"), import("./taskStatusProjection")]);
  const [brief, session] = await Promise.all([getBrief(requestId),
    db.collection("captureUploadSessions").doc(`walkthrough-${requestId}`).get()]);
  const consentRevoked = projectWebsiteCaptureRights(record).consent_revoked;
  const reconstruction = session.data()?.world_reconstruction;
  const status = projectTaskStatus(taskStatusInputFrom({
    active_capture_id: typeof record.active_capture_id === "string" ? record.active_capture_id : null,
    site_task_brief_confirmed_at: record.site_task_brief_confirmed_at,
    capture_coverage: record.capture_coverage ?? null,
    briefDrafted: Boolean(brief),
    // The `video_received` notice footageArrivedBeforeAccount read is the receipt.
    hasStoredCapture: true,
    footageBeforeAccount: true,
    consentRevoked,
    scenePreviewReady: !consentRevoked && reconstructionIsViewable({ ...reconstruction, worldId: reconstruction?.world_id }),
    scenePreparationFailed: reconstruction?.state === "failed",
    // The job pages never read preparation for this capture, which cannot be prepared.
    preparationStatus: null,
    stage: null,
    screening: consentRevoked ? null
      : await loadSceneScreening(requestId, passMarkForJob(record as never, brief as never)).catch(() => null),
    site_task_triage: record.site_task_triage ?? null,
    site_task_scope: record.site_task_scope ?? null,
    account_owner_uid: typeof record.account_owner_uid === "string" && record.account_owner_uid ? record.account_owner_uid : null,
    jobAccess: teamJobAccess(record),
    recommended: Boolean(record.pilot_recommendation),
  }));
  return status.decision === "footage_before_account";
}

/**
 * One honest email for each job whose video arrived before it was saved to an
 * account (owner decision 2026-10-18), including jobs saved before this
 * existed. Footage now waits for a saved job, so no new job joins them; the
 * scan turns through the footage notices a few at a time and queues only
 * while the job page shows `footage_before_account` (re-checked at dispatch),
 * and the outbox key keeps it to one email per job.
 */
export async function reconcileFootageBeforeAccountNotices(limit = 5): Promise<void> {
  if (!db) return;
  const store = db;
  const query = store.collection(CAPTURE_OUTBOX_COLLECTION).where("kind", "==", "video_received");
  let rows = await automationBatch(store, query, "footage_before_account_notices", limit);
  if (!rows.docs.length) rows = await automationBatch(store, query, "footage_before_account_notices", limit);
  for (const row of rows.docs) {
    const requestId = String(row.data()?.requestId ?? "").trim();
    if (!requestId) continue;
    try {
      if ((await store.collection(CAPTURE_OUTBOX_COLLECTION).doc(`${requestId}:footage_before_account`).get()).exists) continue;
      if (!(await footageBeforeAccountShown(requestId))) continue;
      await enqueueTaskLifecycleNotification({ requestId, milestone: "footage_before_account" });
    } catch (error) {
      logger.warn({ error, requestId }, "Could not queue the footage-before-account notice");
    }
  }
}

/**
 * Tell the site, once, that its scene is ready and our first test on it has
 * started. Read from the same progression the job page shows, so it is sent
 * only when the page says so; dispatch reads it again, and the outbox key keeps
 * it to one email per job. Callers that may have just started a test (a scene
 * status poll, an accepted policy run) call this; it is a no-op otherwise.
 */
export async function notifyIfSceneTestsStarted(requestId: string): Promise<{ enqueued: boolean }> {
  if (!(await sceneTestsStarted(requestId))) return { enqueued: false };
  return enqueueTaskLifecycleNotification({ requestId, milestone: "scene_tests_started" });
}

/** True while the job page shows its scene ready and under its first tests. Read again at dispatch. */
export async function sceneTestsStarted(requestId: string): Promise<boolean> {
  const [{ readWebsiteSceneProgression }, { siteWalkthroughIdentity }] = await Promise.all([
    import("./websiteSceneProgression"), import("./siteWalkthrough")]);
  return (await readWebsiteSceneProgression(requestId, siteWalkthroughIdentity(requestId).captureId))?.state === "testing";
}

/**
 * Repair a lost `scene_tests_started` enqueue: turn through finished website
 * scene intakes a few at a time and queue only what the job page shows.
 */
export async function reconcileSceneTestsStartedNotices(limit = 5): Promise<void> {
  if (!db) return;
  const store = db;
  const { SCENE_INTAKE_COLLECTION } = await import("./taskEvaluationSceneIntake");
  const query = store.collection(SCENE_INTAKE_COLLECTION).where("state", "==", "completed");
  let rows = await automationBatch(store, query, "scene_tests_started_notices", limit);
  if (!rows.docs.length) rows = await automationBatch(store, query, "scene_tests_started_notices", limit);
  for (const row of rows.docs) {
    const requestId = String(row.data()?.website_request_id ?? "").trim();
    if (!requestId) continue;
    try {
      if ((await store.collection(CAPTURE_OUTBOX_COLLECTION).doc(`${requestId}:scene_tests_started`).get()).exists) continue;
      await notifyIfSceneTestsStarted(requestId);
    } catch (error) {
      logger.warn({ error, requestId }, "Could not queue the scene-tests notice");
    }
  }
}

/**
 * The website job whose configured scene a policy run used, if any: the
 * launch's task is a website scene intake's task, in the same team.
 */
export async function notifySceneTestsStartedForLaunch(launchId: string): Promise<void> {
  if (!db) return;
  const launch = (await db.collection("taskEvaluationLaunches").doc(launchId).get()).data();
  const offering = launch?.configured_scene_offering;
  const taskId = offering?.task?.identity?.id;
  if (typeof taskId !== "string" || !/^website-[a-f0-9]{20}(?:-development)?$/.test(taskId)) return;
  const [{ SCENE_INTAKE_COLLECTION }, { queryPages }] = await Promise.all([
    import("./taskEvaluationSceneIntake"), import("./websiteSceneProgression")]);
  const requestIds = new Set<string>();
  for await (const rows of queryPages(db.collection(SCENE_INTAKE_COLLECTION).where("request.task.task_id", "==", taskId))) {
    for (const row of rows.map(value => value.data())) {
      if (row?.request?.owner?.organization_id === offering.team_namespace && typeof row.website_request_id === "string")
        requestIds.add(row.website_request_id);
    }
  }
  for (const requestId of requestIds) await notifyIfSceneTestsStarted(requestId);
}

/** Recover scene notices even when the controller stops polling a ready world. */
export async function reconcileSceneReadyNotifications(limit = 20): Promise<void> {
  if (!db) return;
  const pending = await db.collection("captureUploadSessions")
    .where("scene_notification_pending", "==", true).limit(limit).get();
  for (const session of pending.docs) {
    const record = session.data();
    const requestId = String(record.notification_request_id ?? "").trim();
    const world = record.world_reconstruction;
    if (!requestId || !reconstructionIsViewable({ ...world, worldId: world?.world_id })) continue;
    await enqueueTaskLifecycleNotification({ requestId, milestone: "scene_ready" });
    // enqueueOutbox reports a duplicate and a transient failure as false. Only
    // durable existence allows clearing the pending marker.
    const intent = await db.collection(CAPTURE_OUTBOX_COLLECTION).doc(`${requestId}:scene_ready`).get();
    if (intent.exists) await session.ref.set({ scene_notification_pending: false }, { merge: true });
  }
}
