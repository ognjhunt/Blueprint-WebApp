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
import { createHash } from "node:crypto";
import { OUTLOOK_SENTENCES, proofScoredAnyRobot, type JobOutlook } from "./jobOutlook";
import { captureUploadUrlFor } from "./captureUploadToken";
import { enqueueOutbox, CAPTURE_OUTBOX_COLLECTION, type OutboxKind } from "./captureOutbox";
import { automationBatch } from "./automationBatch";
import { logger } from "../logger";
import { footageArrivedBeforeAccount } from "./siteWalkthrough";
import { decryptFieldValue } from "./field-encryption";
import { finePrint, finePrintLast } from "./emailLayout";
import { taskLifecycleNotificationIsCurrent } from "./taskLifecycleNotificationAuthority";
import { drainPendingWebsitePreparationNotifications } from "./websitePreparationStatus";
import { CAPACITY_ENDED_HEADLINE, preparationEndedSentence } from "./taskStatusProjection";
import { pipelineAsksForSentence, preparationNotPossible, preparationRetriesSpent } from "./taskPreparationOutcome";
import { EARLY_TASK_HOLD_DETAIL, EARLY_TASK_HOLD_SENTENCES, earlyTaskHoldOf, isEarlyTaskHoldReason,
  FOOTAGE_BEFORE_ACCOUNT_SENTENCE, JOB_NO_GRANT_SITE_ENDING_SUBJECT, JOB_WINDOW_ENDING_MESSAGE, JOB_WINDOW_ENDING_SUBJECT, jobNoGrantEndingMessage,
  isRecaptureReason, LARGE_VIDEO_RECAPTURE_SENTENCES, RECAPTURE_SENTENCES, RECAPTURE_TITLE, recaptureReasonOf, TASK_NOT_NAMED_REASON,
  type EarlyTaskHoldReason, type RecaptureReason } from "./taskPreparationOutcome";
import { isWebsiteJobNoGrantEndedEventId, isWebsiteJobWindowEndedEventId } from "./websiteJobWindowEnding";
import { selectWebsiteAtlasPreview } from "./websiteAtlasPreview";
import { isScreeningHeldOutcome, isScreeningResultOutcome, simulationOutcomeEmailSentence, storedScreeningOutcomeCaveat,
  type ScreeningOutcome, type ScreeningOutcomeCaveat , simulationHoldSentence, type ScreeningHoldDetail } from "./betaPolicyScreeningContract";
import { PLAIN_SETUP_CAVEAT, projectSimulationProof, testHeadline, testNotRunLine, testResultOf, testSubLine,
  type SimulationProof } from "../../client/src/lib/simulationProof";
import { isTerminalSceneOutcomeKind, sceneOutcomeMessage, sceneOutcomeSubject,
  type TerminalSceneOutcomeKind } from "./sceneIntentOutcome";
import { FIRST_LOOK_SOURCE, LIMITS_PAPER, LIMITS_TESTED, SURENESS_WORDS, firstLookSentence, type SiteAnswer } from "../../client/src/lib/siteAnswer";
import { sceneScreenGateEnded } from "./sceneScreenGate";
import { COMPANY_RESPONSE_LABELS, isCompanyResponseState, type CompanyResponseState } from "../../client/src/lib/companyResponses";
import { JOB_FACTS_NUDGE } from "../../client/src/lib/jobFacts";

export type TaskLifecycleMilestone = Extract<
  OutboxKind,
  | "task_received"
  | "video_received"
  | "scene_ready"
  | "scene_tests_started"
  | "preparation_needs_attention"
  | "preparation_ended"
  | "preparation_resumed"
  | "listing_live"
  | "job_sent"
  | "company_answered"
  | "introduction_made_site"
  | "screening_not_now"
  | "evaluation_outcome"
  | "scene_outcome"
  | "robot_access_question"
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

/**
 * The account's "Your jobs" list, for a claimed site: it opens the job page with a fresh link, where an emailed
 * link would have expired. The request id is unused: the list holds every job of the account.
 */
export function workspaceTaskUrl(_requestId: string): string {
  const origin = (process.env.VITE_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "https://tryblueprint.io")
    .replace(/\/+$/, "");
  return `${origin}/app`;
}

/**
 * A claimed site opens its job page from its account. The private owner link
 * shows the same job without adding an account step.
 */
function whereRunsAre(url: string, workspaceUrl: string | null, action: string): string {
  return workspaceUrl
    ? `${action === "Open your job" ? action : `${action} on your job page,`} from your account:\n${workspaceUrl}`
    : `${action} on your private job page:\n${url}`;
}

// Bare bones (2026-11-11): each notice says one thing in at most three short lines, then one button
// ("Label:\nURL"); a line the site must read but that is not the news is fine print (`finePrint`).
/**
 * `preparation_ended` for `capacity_blocked` (review, 2026-11-12): every cause the Pipeline sends it for is ours (its
 * disk or staging stayed short, or the job waited for room until its grant ran out), so the email says so, asks the
 * site to keep its original video (it cannot know the stored copy), and offers nothing the page cannot do. Staff see the code in the preparation watch.
 */
const CAPACITY_ENDED_COPY = {
  subject: "We could not prepare your job in time",
  body: (url: string, detail: string) => `${CAPACITY_ENDED_HEADLINE}${detail ? ` ${detail}` : ""}\n\nNothing is needed from you. Keep your original video.\n\nOpen your job:\n${url}`,
};
/** The `listing_live` email (PACKAGE_D D1.3 as amended by PACKAGE_E). */
export const LISTING_LIVE_SUBJECT = "Your job is with deployment companies";
export const LISTING_LIVE_SENTENCES = "Deployment companies we approve can now see your job. We don't share your name, address or "
  + "contact details with a deployment company unless you ask for an introduction to it. Your job page shows any answer.";
/** How a site stops sharing: the withdrawal is on its job page. */
export const HOW_TO_WITHDRAW = "To stop, open your job page, choose Job settings, then Stop using my video. Your job then leaves every company's view at once.";
/** The `job_sent` email's sentence (PACKAGE_E E4): one per job, with the count. */
export const jobSentSentence = (count: number) => Number.isInteger(count) && count > 0
  ? `Your job is with ${count} deployment ${count === 1 ? "company" : "companies"}.` : "Your job is with deployment companies.";
/** The one `job_sent` per job (PACKAGE_E E4): its event id (the company side's `AUTO_SEND_EVENT_ID`). */
export const JOB_SENT_EVENT_ID = "companies";

const copy: Record<TaskLifecycleMilestone, { subject: string; body: (url: string, detail: string, workspaceUrl: string | null) => string }> = {
  // The job that asked for a new video moved on with the one the site sent (review, 2026-11-12). Fixed text.
  preparation_resumed: {
    subject: "No new video is needed",
    body: (url) => `No new video is needed; we are preparing your job.\n\nOpen your job:\n${url}`,
  },
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
  // It promises nothing a company will do (frame of 2026-11-12): it says what we build next and where to look.
  video_received: {
    subject: "We have your video",
    body: (url) => `Your video arrived safely. Next, we build your job packet: a first look and a simulation of your site. Your job page shows where it stands.\n\nOpen your job:\n${url}`,
  },
  scene_ready: {
    subject: "The simulation of your site is ready to view",
    body: (url) => `You can look around the work area you filmed on your job page.\n\nOpen your job:\n${url}`,
  },
  // Owner decision 2026-10-22: "ready" only once the task objects are in and
  // our first internal test has started, never when the room alone is built.
  scene_tests_started: {
    subject: "The simulation of your site is ready",
    body: (url) => `Your work area and its objects are in place. Nothing is needed from you.\n\nOpen your job:\n${url}`,
  },
  // The one email when a site's job first becomes visible to approved deployment companies (sharing is the service,
  // 2026-11-12). Read again at dispatch: sent only while the job is visible.
  listing_live: {
    subject: LISTING_LIVE_SUBJECT,
    body: (url) => `${LISTING_LIVE_SENTENCES}\n\n${HOW_TO_WITHDRAW}\n\nOpen your job:\n${url}`,
  },
  // Once per job (PACKAGE_E E4): when the job is first sent to the approved deployment companies. The detail is only
  // the count, a whole number; read again at dispatch: sent only while the job is visible.
  job_sent: {
    subject: "Your job was sent to deployment companies",
    body: (url, detail) => `${jobSentSentence(Number(detail))} Your job page shows any answer.\n\nOpen your job:\n${url}`,
  },
  // One per company and answer, never the company's name or words: the detail is only a fixed label, and for
  // "Would need something" the one nudge toward the job page's quick questions (PACKAGE_E E1).
  company_answered: {
    subject: "A deployment company answered",
    body: (url, detail) => `A deployment company answered about your job: ${detail}. Your job page has the details.${
      detail === COMPANY_RESPONSE_LABELS.needs_something ? ` ${JOB_FACTS_NUDGE}` : ""}\n\nOpen your job:\n${url}`,
  },
  // The site asked for an introduction (PACKAGE_E E6). Built only by `buildIntroductionMadeSiteNotification`, whose
  // body is the introduced company's details; this entry is its fallback and never names anyone.
  introduction_made_site: {
    subject: "Meet the deployment company",
    body: (url) => `We've given them your details. Reply to them directly.\n\nOpen your job:\n${url}`,
  },
  screening_not_now: {
    subject: "An update on your Blueprint job",
    body: (url) => `Something we need for your job is missing.\n\nYour job page says what, and how to send it. You can also reply to this email.\n\nOpen your job:\n${url}`,
  },
  // One per result outcome of the job's evaluation and scene (F-01). The detail
  // is only the outcome's sentence about the simulation, or for an estimate the
  // job page's own simulation proof, and the results disclaimer, built from typed
  // values, never caller text. A finished trial's subject is its own (`TRIAL_FINISHED_SUBJECT`).
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
  // Once per job, when the site's first look first settles. The detail is only the
  // first look's own sentences (`answerReadyDetail`), built from the composed answer.
  answer_ready: {
    subject: "Your first look is ready",
    body: (url, detail) => `${detail}\n\nOpen your job:\n${url}`,
  },
  pilot_request: {
    subject: "A partner asked to have its system evaluated on your job",
    body: (url) => `An approved partner asked about your job. Nothing is needed from you.\n\nOpen your job:\n${url}`,
  },
};

/**
 * Resolve the owner from the authoritative encrypted request and enqueue one
 * message per request and milestone. Calling this again repairs a missed
 * enqueue while the outbox document id prevents a duplicate delivery intent.
 */
/** Source/context-bound preparation notices: an exact event id and current recipient are required. */
export function isWebsitePreparationNotice(milestone: string): milestone is "preparation_needs_attention" | "preparation_ended" | "preparation_resumed" {
  return milestone === "preparation_needs_attention" || milestone === "preparation_ended" || milestone === "preparation_resumed";
}

export async function enqueueTaskLifecycleNotification(params: {
  requestId: string;
  milestone: TaskLifecycleMilestone;
  /** Distinguishes repeated events of one kind: a run id, a request id. */
  eventId?: string;
  /** One clause of event detail for the body, e.g. "12 of 50 episodes succeeded". */
  detail?: string;
  correlationId?: string;
  /** `preparation_ended` only: the Pipeline's typed reason; unknown values add nothing. */
  terminalReason?: string | null;
  /** Preparation notices: the capture they are about, so an early task hold is told as held. */
  captureId?: string;
  /** `preparation_needs_attention` only: wait until then for the Atlas preview that would name an early task hold. */
  awaitEarlyHoldUntilMs?: number;
  /** `preparation_needs_attention` only: the preparation stop only a new video clears, from the status's outcome. */
  recaptureReason?: RecaptureReason;
  /** `preparation_needs_attention` only: a part-6 ending; the email says the page's own words for it. */
  preparationEnding?: PreparationEnding;
  /** `evaluation_outcome` only: the run's result outcome, and an estimate's counts. */
  screeningOutcome?: ScreeningOutcome;
  screeningCounts?: { ran: number; total: number; scored: number };
  /** `evaluation_outcome` estimate only: what the page's sentence adds (`screeningOutcomeCaveat`). */
  screeningCaveat?: ScreeningOutcomeCaveat;
  /** `evaluation_outcome` set-up hold only: its detail with words of its own. */
  screeningHoldDetail?: ScreeningHoldDetail;
  /** `scene_outcome` only: the terminal outcome's kind; its event id must name it. */
  sceneOutcomeKind?: TerminalSceneOutcomeKind;
  /** `company_answered` only: the company's answer; the email states its fixed label, nothing else of the company. */
  companyAnswerState?: CompanyResponseState;
  /** `job_sent` only: how many approved deployment companies the job was sent to. */
  companyCount?: number;
  /** `answer_ready` only: the settled answer the email states. */
  siteAnswer?: SiteAnswer;
  /** `answer_ready` only: the job's outlook (`jobOutlook`), whose ending sentence the paper-check answer opens with. */
  outlook?: { phase: string; sentence: string | null };
  /** `evaluation_outcome` estimate and `answer_ready`: the job page's simulation proof; read from the job's results when not given. */
  simulationProof?: SimulationProof | null;
  /** `scene_outcome` only: the sweeps' endings (see `buildTaskLifecycleNotification`). */
  jobWindowEnded?: true;
  jobNoGrantEnded?: "site" | "blueprint";
  jobNoGrantReason?: "video_over_ingest_limit";
  /** `answer_ready` only: the reading ran out, so the email says there is no paper check. */
  paperUnread?: true;
}): Promise<{ enqueued: boolean; reason?: "store_unavailable" | "request_missing" | "contact_missing" | "consent_withdrawn"
  | "awaiting_early_hold_preview" | "awaiting_reading" | "awaiting_site_sentence" }> {
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
  // A job the Pipeline holds for its sentence needs the site, not our team: no "needs attention" email, whether the
  // page still asks for it or the site has already given it (the Pipeline re-reads the job within the hour).
  if (params.milestone === "preparation_needs_attention" && (pipelineAsksForSentence(preview as never)
    || await (await import("./jobSentenceWait")).loadJobWaitsForItsSentence(requestId, snapshot.data())))
    return { enqueued: false, reason: "awaiting_site_sentence" };
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
  // An estimate whose results cannot be read yet: whether it scored an AI robot (a result) or none (an ending) is
  // unknown, so nothing is queued; its producer keeps the intent and asks again.
  if (params.milestone === "evaluation_outcome" && params.screeningOutcome === "estimate" && simulationProof?.state !== "done")
    return { enqueued: false, reason: "awaiting_reading" };
  const scoredNone = params.milestone === "evaluation_outcome" && params.screeningOutcome === "estimate" && !proofScoredAnyRobot(simulationProof);
  // With no test result to come, the paper check is the answer: read it for the email that says so. While the video
  // is still being read (or its answer cannot be read), the email waits, bounded by the reading's own limit.
  const wantsPaper = !params.siteAnswer && ((params.milestone === "evaluation_outcome" && (params.screeningOutcome !== "estimate" || scoredNone))
    || params.milestone === "preparation_ended" || (params.milestone === "scene_outcome" && params.sceneOutcomeKind !== "withdrawn"));
  let siteAnswer = params.siteAnswer;
  let paperUnread = false;
  if (wantsPaper) {
    const paper = await paperAnswerForEnding(requestId, waitingSinceIso(snapshot.data(), params));
    if (paper.wait) {
      await holdAnswerNotice(params);
      return { enqueued: false, reason: "awaiting_reading" };
    }
    siteAnswer = paper.answer;
    paperUnread = paper.unread === true;
  }
  return enqueueOutbox(buildTaskLifecycleNotification({ ...notice, simulationProof, ...(siteAnswer ? { siteAnswer } : {}), requestId, to, workspaceUrl,
    ...(paperUnread ? { paperUnread: true as const } : {}), ...(earlyTaskHold ? { earlyTaskHold } : {}), ...(recaptureReason ? { recaptureReason } : {}) }));
}

import { ANSWER_NOTICES_CLOSED_FIELD, ANSWER_NOTICES_WAITING_FIELD, ANSWER_NOTICES_WAITING_PENDING_FIELD, ANSWER_NOTICES_WAITING_SINCE_FIELD, OWED_LIMIT_MS,
  READING_WAIT_LIMIT_MS, mapFields, noticeKeyOf, owedRetryDelayMs, waitingAnswerNoticeFields, waitingMap, waitingSinceIso,
  type WaitingEntry } from "./answerNoticeOwed";
export { ANSWER_NOTICES_CLOSED_FIELD, OWED_LIMIT_MS, ANSWER_NOTICES_WAITING_FIELD, ANSWER_NOTICES_WAITING_PENDING_FIELD, ANSWER_NOTICES_WAITING_SINCE_FIELD,
  READING_WAIT_LIMIT_MS, waitingAnswerNoticeFields } from "./answerNoticeOwed";
type WaitingNoticeParams = Parameters<typeof enqueueTaskLifecycleNotification>[0];
/** Keep an answer email owed on the job, reading and writing the waiting map in one transaction. */
export async function holdAnswerNotice(params: WaitingNoticeParams, extra: Record<string, unknown> = {}): Promise<void> {
  if (!db) throw new Error("answer_notice_store_unavailable");
  const ref = db.collection("inboundRequests").doc(params.requestId);
  await db.runTransaction(async transaction => {
    const record = (await transaction.get(ref)).data();
    if (!record) return;
    transaction.update(ref, { ...waitingAnswerNoticeFields(params, new Date().toISOString(), record), ...extra } as never);
  });
}

/** How one try of an owed email ended: its row exists, it is no longer owed (with why), or it is tried again later. */
type OwedTry = { outcome: "delivered" } | { outcome: "settled"; reason: string } | { outcome: "retry" };
/** Final reasons from the queue: the email is no longer owed (the site ended the job, or there is no one to send to). */
const SETTLED_REASONS: ReadonlySet<string> = new Set(["consent_withdrawn", "request_missing", "contact_missing", "not_due",
  "kept_already_told", "ended_by_site"]);
async function rowExists(key: string): Promise<boolean> {
  return Boolean(db && (await db.collection(CAPTURE_OUTBOX_COLLECTION).doc(key).get()).exists);
}
/** One try of one owed entry. An entry is delivered only when its row exists; a failed create stays owed (N3). */
async function tryOwed(requestId: string, entry: WaitingEntry): Promise<OwedTry> {
  if (entry.params.milestone === "answer_ready") {
    const result = await notifyIfAnswerSettled(requestId, entry.since_iso, { hold: false });
    if (result.key && (result.enqueued || await rowExists(result.key))) return { outcome: "delivered" };
    if (result.reason && SETTLED_REASONS.has(result.reason)) return { outcome: "settled", reason: result.reason };
    return { outcome: "retry" };
  }
  const result = await enqueueTaskLifecycleNotification(entry.params as never);
  if (await rowExists(noticeKeyOf(entry.params))) return { outcome: "delivered" };
  if (result.reason && SETTLED_REASONS.has(result.reason)) return { outcome: "settled", reason: result.reason };
  return { outcome: "retry" };
}

/**
 * The paper check for an ending's email. While the video is still being read, or its answer cannot be read, the email
 * waits (`wait`), up to `READING_WAIT_LIMIT_MS` from when it started waiting; after that it says plainly that there is
 * no paper check (`unread`).
 */
export async function paperAnswerForEnding(requestId: string, waitingSince?: string):
  Promise<{ wait: true } | { wait: false; answer?: SiteAnswer; unread?: true }> {
  let answer: SiteAnswer | null | undefined;
  let unreadable = false;
  try { answer = await (await import("./siteAnswer")).loadSiteAnswer(requestId); }
  catch (error) { unreadable = true; logger.warn({ error, requestId }, "Could not read the answer for an ending's email; it waits"); }
  if (unreadable || answer?.state === "reading") {
    const since = waitingSince ? Date.parse(waitingSince) : NaN;
    if (!Number.isFinite(since) || Date.now() - since < READING_WAIT_LIMIT_MS) return { wait: true };
    return { wait: false, unread: true };
  }
  return { wait: false, ...(answer ? { answer } : {}) };
}

/**
 * Try every due owed entry on one job, by the key its recorder would have used. Idempotent. An entry is removed only
 * when its row exists or it is settled; one that cannot go now is tried again after a back-off, and one still owed
 * past `OWED_LIMIT_MS` is closed with a typed reason and an alert, so every entry has a final outcome.
 */
export async function releaseWaitingAnswerNotices(requestId: string, nowMs = Date.now()): Promise<void> {
  if (!db) return;
  const ref = db.collection("inboundRequests").doc(requestId);
  const waiting = waitingMap((await ref.get()).data());
  const results = new Map<string, { since: string; result: OwedTry | { outcome: "closed"; reason: string } }>();
  for (const [slot, entry] of Object.entries(waiting).sort(([, a], [, b]) => Number(a?.next_ms) - Number(b?.next_ms))) {
    if (!entry?.params || entry.params.requestId !== requestId) { results.set(slot, { since: String(entry?.since_iso), result: { outcome: "settled", reason: "invalid" } }); continue; }
    if (Number(entry.next_ms) > nowMs) continue;
    let result: OwedTry = { outcome: "retry" };
    try { result = await tryOwed(requestId, entry); }
    catch (error) { logger.warn({ error, requestId }, "An owed answer email stays owed for the next pass"); }
    if (result.outcome === "retry" && nowMs - Date.parse(entry.since_iso) >= OWED_LIMIT_MS) {
      logger.error({ requestId, key: noticeKeyOf(entry.params), sinceIso: entry.since_iso },
        "An owed answer email could not be sent within its limit; it is closed and needs a person");
      results.set(slot, { since: entry.since_iso, result: { outcome: "closed", reason: "owed_email_unresolved" } });
    } else results.set(slot, { since: entry.since_iso, result });
  }
  if (!results.size) return;
  // Written to the map as it is now, and only for the entry this pass tried: one written meanwhile stays as written.
  await db.runTransaction(async transaction => {
    const record = (await transaction.get(ref)).data();
    const current = waitingMap(record);
    const closed: Array<Record<string, string>> = Array.isArray(record?.[ANSWER_NOTICES_CLOSED_FIELD]) ? [...record![ANSWER_NOTICES_CLOSED_FIELD]] : [];
    const next: Record<string, WaitingEntry> = {};
    for (const [slot, entry] of Object.entries(current)) {
      const tried = results.get(slot);
      if (!tried || tried.since !== entry?.since_iso) { next[slot] = entry; continue; }
      if (tried.result.outcome === "retry") {
        const attempts = (Number(entry.attempts) || 0) + 1;
        next[slot] = { ...entry, attempts, next_ms: nowMs + owedRetryDelayMs(attempts) };
      } else if (tried.result.outcome === "closed") {
        closed.push({ key: noticeKeyOf(entry.params), reason: tried.result.reason, closed_at_iso: new Date(nowMs).toISOString() });
      }
    }
    // mergeFields replaces each named field whole, so a removed entry is gone (a plain merge would keep it).
    transaction.set(ref, { ...mapFields(next), [ANSWER_NOTICES_CLOSED_FIELD]: closed } as never,
      { mergeFields: [ANSWER_NOTICES_WAITING_FIELD, ANSWER_NOTICES_WAITING_PENDING_FIELD, ANSWER_NOTICES_WAITING_SINCE_FIELD, ANSWER_NOTICES_CLOSED_FIELD] });
  });
}

/** The outbox pump's pass over owed answer emails: the jobs whose next try is due, earliest first. */
export async function reconcileWaitingAnswerNotices(limit = 20, nowMs = Date.now()): Promise<void> {
  if (!db) return;
  const rows = await db.collection("inboundRequests").where(ANSWER_NOTICES_WAITING_SINCE_FIELD, ">", 0)
    .where(ANSWER_NOTICES_WAITING_SINCE_FIELD, "<=", nowMs).orderBy(ANSWER_NOTICES_WAITING_SINCE_FIELD).limit(limit).get();
  for (const row of rows.docs) await releaseWaitingAnswerNotices(row.id, nowMs).catch(error =>
    logger.warn({ error, requestId: row.id }, "Could not release an owed answer email"));
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
  screeningHoldDetail?: ScreeningHoldDetail;
  /** `scene_outcome` only: the terminal outcome's kind; its event id must name it. */
  sceneOutcomeKind?: TerminalSceneOutcomeKind;
  /** `robot_access_question` only: how many chairs and stools the proposal moves; its event id is the proposal digest. */
  robotAccessCounts?: RobotAccessCounts;
  /** `preparation_needs_attention` only: the early task hold the job page states; the notice is then the held one. */
  earlyTaskHold?: EarlyTaskHoldReason;
  /** `preparation_needs_attention` only: the new-video ask the job page states; the notice is then that ask. */
  recaptureReason?: RecaptureReason;
  /** `preparation_needs_attention` only: a part-6 ending the job page states; the notice says the same. */
  preparationEnding?: PreparationEnding;
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
  /** `company_answered` only: the company's answer; the email states its fixed label, nothing else of the company. */
  companyAnswerState?: CompanyResponseState;
  /** `job_sent` only: how many approved deployment companies the job was sent to. */
  companyCount?: number;
  /** `answer_ready` only: the settled answer the email states. */
  siteAnswer?: SiteAnswer;
  /** `answer_ready` only: the job's outlook (`jobOutlook`), whose ending sentence the paper-check answer opens with. */
  outlook?: { phase: string; sentence: string | null };
  /** `evaluation_outcome` estimate and `answer_ready`: the job page's simulation proof, or null when it could not be read. */
  simulationProof?: SimulationProof | null;
  /** With `jobNoGrantEnded`: why the sweep ended it early, said in the ending's own sentence. */
  jobNoGrantReason?: "video_over_ingest_limit";
  /** An ending's email whose video could not be read in time: it says plainly that there is no paper check. */
  paperUnread?: true;
}): Parameters<typeof enqueueOutbox>[0] {
  const requestId = params.requestId.trim();
  if (isWebsitePreparationNotice(params.milestone) && !/^sha256:[a-f0-9]{64}$/.test(params.eventId || "")) {
    throw new Error("website_preparation_event_invalid");
  }
  if (params.milestone === "company_answered" && !isCompanyResponseState(params.companyAnswerState)) {
    throw new Error("company_answer_state_invalid");
  }
  const outcomeDetail = params.milestone === "evaluation_outcome" ? evaluationOutcomeDetail(params)
    : params.milestone === "scene_outcome"
      // An ending of the simulation (held, never built, its window ran out): its reason, then the paper check as the
      // one answer, by the same composer as the no-test email. A withdrawal is the site's own ending: no answer.
      ? params.sceneOutcomeKind === "withdrawn" ? sceneOutcomeDetail(params)
        : withPaperAnswer(params.jobNoGrantEnded ? jobNoGrantEndedDetail(params)
          : params.jobWindowEnded ? jobWindowEndedDetail(params) : sceneOutcomeDetail(params),
          paperLine(params.siteAnswer, { hold: params.sceneOutcomeKind === "held" && !params.jobWindowEnded && !params.jobNoGrantEnded,
            unread: params.paperUnread }))
    : params.milestone === "robot_access_question" ? robotAccessQuestionDetail(params)
    : params.milestone === "answer_ready" ? answerReadyDetail(params.siteAnswer, params.outlook, params.paperUnread === true) : "";
  const held = params.milestone === "preparation_needs_attention" && isEarlyTaskHoldReason(params.earlyTaskHold)
    ? params.earlyTaskHold : null;
  const recapture = !held && params.milestone === "preparation_needs_attention" && isRecaptureReason(params.recaptureReason)
    ? params.recaptureReason : null;
  const capacityEnded = params.milestone === "preparation_ended" && params.terminalReason === "capacity_blocked";
  const ending = !held && !recapture && params.milestone === "preparation_needs_attention" ? preparationEndingCopy(params.preparationEnding) : null;
  const message = held ? earlyTaskHoldCopy(held) : recapture ? recaptureCopy(recapture) : ending ?? (capacityEnded ? CAPACITY_ENDED_COPY : copy[params.milestone]);
  const url = params.captureUrl ?? captureUploadUrlFor(requestId, "owner");
  const eventId = params.eventId?.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  // Preparation notices never carry caller text: only a validated reference and,
  // for an ending, the fixed sentence for its reason.
  const reference = /^bp-prep-[a-f0-9]{16}$/.test(params.correlationId || "") ? `Reference: ${params.correlationId}.` : "";
  // A stopped simulation means no test result will come: the paper check, when there is one, is the answer.
  const preparationDetail = params.milestone === "preparation_ended"
    ? [capacityEnded ? "" : preparationEndedSentence(params.terminalReason), paperLine(params.siteAnswer, { hold: false, unread: params.paperUnread }), reference]
      .filter(Boolean).join(" ") : reference;
  // A finished test that scored no AI robot is an ending, so its email takes the paper slot (review, 2026-11-11).
  const scoredNone = params.milestone === "evaluation_outcome" && params.screeningOutcome === "estimate" && !proofScoredAnyRobot(params.simulationProof);
  return {
    idempotencyKey: `${requestId}:${params.milestone}${eventId ? `:${eventId}` : ""}`,
    requestId,
    kind: params.milestone,
    ...(isWebsitePreparationNotice(params.milestone) ? {preparationEventId: params.eventId} : {}),
    ...(scoredNone ? { answerSlot: "paper" as const } : {}),
    to: params.to,
    subject: params.milestone === "evaluation_outcome" && params.screeningOutcome === "estimate" && !scoredNone
      ? TRIAL_FINISHED_SUBJECT
      : params.milestone === "evaluation_outcome" && paperAnswerLine(params.siteAnswer) ? PAPER_ANSWER_SUBJECT
      : params.milestone === "scene_outcome" && params.jobNoGrantEnded === "site" ? JOB_NO_GRANT_SITE_ENDING_SUBJECT
      : params.milestone === "scene_outcome" && (params.jobWindowEnded || params.jobNoGrantEnded) ? JOB_WINDOW_ENDING_SUBJECT
      : params.milestone === "scene_outcome" && params.sceneOutcomeKind ? sceneOutcomeSubject(params.sceneOutcomeKind)
      : params.milestone === "answer_ready" && params.siteAnswer?.state === "cannot_assess" ? "An update on your Blueprint job"
      : message.subject,
    body: finePrintLast(`${message.body(url, isWebsitePreparationNotice(params.milestone) ? preparationDetail
      : params.milestone === "company_answered" ? COMPANY_RESPONSE_LABELS[params.companyAnswerState!]
      : params.milestone === "job_sent" ? String(params.companyCount ?? "")
      : params.milestone === "evaluation_outcome" || params.milestone === "scene_outcome"
        || params.milestone === "robot_access_question" || params.milestone === "answer_ready" ? outcomeDetail
      : params.detail?.trim() ?? "", params.workspaceUrl ?? null)}`),
    replyTo: "hello@tryblueprint.io",
  };
}

/** One line of a company's details for an email: no line breaks, bounded. */
function detailLine(value: unknown, max = 200): string {
  return typeof value === "string" ? value.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max) : "";
}

/** The `introduction_made_site` email's subject and body (PACKAGE_E E6): the introduced company's own details, nothing else. */
export function introductionMadeSiteCopy(company: { name: string; contactName?: string | null; email: string; website?: string | null },
  url: string, answerLabel?: string | null): { subject: string; body: string } {
  const name = detailLine(company.name, 120) || "the deployment company";
  // The company's own stored answer, in its fixed label (review M2); with none, no answer is claimed.
  const label = detailLine(answerLabel, 60);
  const lines = [
    label ? `${name} answered ${label} about your job, and you asked us to introduce you.` : `You asked us to introduce you to ${name}.`,
    "",
    ...(detailLine(company.contactName) ? [`Contact: ${detailLine(company.contactName)}`] : []),
    `Email: ${detailLine(company.email)}`,
    ...(detailLine(company.website) ? [`Website: ${detailLine(company.website)}`] : []),
    "",
    "We've given them your details. Reply to them directly.",
    "",
    `Open your job:\n${url}`,
  ];
  return { subject: `Meet ${name}`, body: lines.join("\n") };
}

/**
 * The site's email when it asked for an introduction (PACKAGE_E E6), for `requestIntroduction` to queue inside its
 * transaction. One per company and job; read again at dispatch (`taskLifecycleNotificationAuthority.ts`): sent only
 * while the job is visible to companies and the introduction is on record.
 */
export function buildIntroductionMadeSiteNotification(params: { requestId: string; to: string; companyId: string;
  company: { name: string; contactName?: string | null; email: string; website?: string | null }; captureUrl?: string;
  answerLabel?: string | null }): Parameters<typeof enqueueOutbox>[0] {
  const requestId = params.requestId.trim();
  const companyId = params.companyId.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  if (!companyId) throw new Error("introduction_company_invalid");
  const url = params.captureUrl ?? captureUploadUrlFor(requestId, "owner");
  const { subject, body } = introductionMadeSiteCopy(params.company, url, params.answerLabel);
  const companyEmail = detailLine(params.company.email);
  return { idempotencyKey: `${requestId}:introduction_made_site:${companyId}`, requestId, kind: "introduction_made_site",
    to: params.to, subject, body,
    // "Reply to them directly": a reply goes to the company.
    replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail) ? companyEmail : "hello@tryblueprint.io" };
}

/** A new-video ask's one email: the job page's title, reason and next step, in place of the needs-attention notice. */
export type PreparationEnding = {reason: "website_preparation_not_possible" | "website_preparation_retries_spent"; cause?: string};
/**
 * A part-6 ending's one email (review, 2026-11-12): the job page's own title and sentences for it (the same
 * constants), never a review promise. When it fires is unchanged; only what it says.
 */
function preparationEndingCopy(ending: PreparationEnding | undefined): (typeof copy)[TaskLifecycleMilestone] | null {
  const outcome = ending?.reason === "website_preparation_not_possible" ? preparationNotPossible(ending.cause, ZERO_DIGEST)
    : ending?.reason === "website_preparation_retries_spent" ? preparationRetriesSpent(ZERO_DIGEST) : null;
  if (!outcome) return null;
  return { subject: outcome.title,
    body: (url, detail) => `${outcome.reason} ${outcome.nextStep}${detail ? `\n\n${finePrint(detail)}` : ""}\n\nOpen your job:\n${url}` };
}
const ZERO_DIGEST = `sha256:${"0".repeat(64)}`;

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

/** The subject of the email that gives the first look when no trial result will come. */
const PAPER_ANSWER_SUBJECT = "Your first look is ready";
const SIMULATION_DISCLAIMER = "A simulation is not a physical test, and it never certifies physical performance or safety.";
/** An estimate's email when the job's results could not be read: true whatever they show. */
const SIMULATION_FINISHED = "Our early trial on your job has finished. Your job page shows how each robot did.";
/** The page's own headline when a stored caveat is all that can be read: it is only ever set when none finished. */
const NONE_FINISHED_HEADLINE = "No robot finished the job in our trial.";

/** The test result the job page leads with, once the simulation has finished. */
const finishedResult = (proof: SimulationProof | null | undefined) => {
  const result = proof?.state === "done" ? testResultOf(proof) : null;
  return result && result.kind !== "testing" ? result : null;
};

/** One subject for every finished trial, whatever it found: a zero is a valid result of the trial. */
const TRIAL_FINISHED_SUBJECT = "Our early trial on your job has finished";
/** The trial email's first line: whose trial it was, and whose robot it was not. */
export const TRIAL_EMAIL_OPENING = "This was our own trial of openly available robot software, not a deployment company's robot.";

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
  return `${TRIAL_EMAIL_OPENING} ${said.filter(Boolean).join(" ")} Nothing is needed from you.`;
}

/** The job's composed answer, for an email that gives the paper check as the answer; undefined when it cannot be read. */
export async function loadPaperAnswer(requestId: string): Promise<SiteAnswer | undefined> {
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
  screeningHoldDetail?: ScreeningHoldDetail;
  simulationProof?: SimulationProof | null; siteAnswer?: SiteAnswer; paperUnread?: true }): string {
  const outcome = params.screeningOutcome;
  const counts = params.screeningCounts;
  if (!isScreeningResultOutcome(outcome) || !new RegExp(`^${outcome}-[a-f0-9]{24}$`).test(params.eventId ?? "")
    || (outcome === "estimate") !== Boolean(counts)
    || (counts && ![counts.ran, counts.total, counts.scored].every(value => Number.isSafeInteger(value) && value >= 0))) {
    throw new Error("evaluation_outcome_notice_invalid");
  }
  // An estimate that scored an AI robot is the page's test result, under the page's tested limits line.
  if (outcome === "estimate" && proofScoredAnyRobot(params.simulationProof)) {
    return `${estimateDetail(params.simulationProof, storedScreeningOutcomeCaveat(params.screeningCaveat))}\n\n${finePrint(LIMITS_TESTED)}`;
  }
  // No test result (a hold, another stop, or a finished test that scored no AI robot): why, then the paper check as
  // the answer. Only a hold can still be followed by a test result, so only its email says one would be emailed.
  const why = outcome === "estimate"
    ? [testNotRunLine(params.simulationProof) ?? OUTLOOK_SENTENCES.no_ai_robot_scored,
      params.simulationProof?.options.setupFlag || storedScreeningOutcomeCaveat(params.screeningCaveat) ? PLAIN_SETUP_CAVEAT : null]
      .filter(Boolean).join(" ")
    : testNotRunLine(params.simulationProof) ?? simulationHoldSentence(outcome, params.screeningHoldDetail);
  const paper = paperLine(params.siteAnswer, { hold: isScreeningHeldOutcome(outcome), unread: params.paperUnread });
  return paperAnswerLine(params.siteAnswer) ? `${why} ${paper}\n\n${finePrint(LIMITS_PAPER)}`
    : `${why} ${paper} Nothing is needed from you.\n\n${finePrint(SIMULATION_DISCLAIMER)}`;
}

/** An ending's own reason, then its paper-check line. */
function withPaperAnswer(reason: string, paper: string): string {
  return `${reason} ${paper}`;
}

/** The first look in the job page's own sentence, or null when it names no robot. */
function paperAnswerLine(answer: SiteAnswer | null | undefined, hold = false): string | null {
  return answer?.state === "ready" && answer.pick
    ? `${firstLookSentence(answer.pick)} ${FIRST_LOOK_SOURCE}${answer.sceneNote ? ` ${answer.sceneNote}` : ""}${hold ? ` ${PAPER_LATER}` : ""}`
    : null;
}
/**
 * An ending email's line about the paper check (review, 2026-11-11): the paper check as the answer when there is one,
 * else a plain statement that there is none, and why when the reader said why. "If a test result comes later" is said
 * only after a hold, the one ending after which a test can still come.
 */
function paperLine(answer: SiteAnswer | null | undefined, options: { hold: boolean; unread?: boolean }): string {
  if (options.unread) return NO_PAPER_UNREAD;
  const paper = paperAnswerLine(answer, options.hold);
  if (paper) return paper;
  const why = answer?.state === "cannot_assess" && answer.reason ? ` ${answer.reason}` : "";
  return `${NO_PAPER_CHECK}${why}`;
}
/** A hold's first look ends with this: a trial result may still come. */
export const PAPER_LATER = "If our early trial gives a result later, we'll email it.";
export const NO_PAPER_CHECK = "There is no first look for this job.";
export const NO_PAPER_UNREAD = "We could not finish reading your video, so there is no first look for this job.";

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

/** The endings whose only email is `answer_ready`: each recorded by the code that calls `notifyIfAnswerSettled`. */
const ANSWER_READY_ENDINGS: ReadonlySet<string> = new Set(["unsized", "robot_fit_only", "run_ended", "authority_ended", "job_ended",
  "window_ended_during_test", "kept_on_file"]);

/**
 * The paper-check answer for an ending that has no email of its own: the video reader's final "cannot size this
 * job" (the coverage review records it), the robot-fit-only end (the preparation status), and a run that ended with
 * no publication (the evaluation ingest). Each is final, so the email never says a test result may follow.
 */
function answerReadyDetail(answer: SiteAnswer | undefined, outlook: JobOutlookView | null | undefined, unread = false): string {
  // The video's reading ran out: the ending's reason, and plainly that there is no paper check.
  if (unread && outlook && endingEmailDue(outlook)) return `${outlook.sentence ?? ""} ${NO_PAPER_UNREAD}`.trim();
  if (!answerEmailDue(answer, outlook)) throw new Error("answer_ready_notice_invalid");
  // Kept on file: its own sentence, then plainly whether there is a paper check, with the reader's reason.
  // Sharing is the service (2026-11-12): there is no share step to point to.
  const share = "";
  if (outlook!.reason === "kept_on_file") return `${outlook!.sentence} ${paperLine(answer, { hold: false })}${share}`;
  if (answer.state === "cannot_assess") return `${answer.headline}\n\n${answer.reason}`;
  return `${outlook!.sentence ?? "Our early trial has not run on your job."} ${paperLine(answer, { hold: false })}${share}\n\n${finePrint(LIMITS_PAPER)}`;
}
type JobOutlookView = { phase: string; reason?: string | null; sentence: string | null };

/** The answer email is due: the outlook is one of its recorded endings, and the answer is read. */
export function answerEmailDue(answer: SiteAnswer | null | undefined, outlook: JobOutlookView | null | undefined): answer is SiteAnswer {
  if (!answer || !outlook || answer.state === "reading" || !endingEmailDue(outlook)) return false;
  return answer.state === "cannot_assess" ? Boolean(answer.reason) : Boolean(answer.pick) || answer.state === "ready";
}

/** The ending is one this email carries. */
const endingEmailDue = (outlook: JobOutlookView) =>
  (outlook.phase === "no_test" || (outlook.phase === "cannot_match" && outlook.reason === "kept_on_file"))
  && ANSWER_READY_ENDINGS.has(String(outlook.reason));

/**
 * Queue the paper-check answer for one of `ANSWER_READY_ENDINGS`, called by the code that records it, in the same
 * step. Never from a page read or a status poll. When the outlook cannot be read for certain, or the video is still
 * being read, the email waits on the job (`releaseWaitingAnswerNotices`) and is queued once both are known.
 */
export async function notifyIfAnswerSettled(requestId: string, waitingSince?: string, options: { hold?: boolean } = {}):
  Promise<{ enqueued: boolean; reason?: string; key?: string }> {
  const [{ loadSiteAnswer }, { loadJobOutlookDecision }, { keptOnFileAlreadyTold }] = await Promise.all([import("./siteAnswer"),
    import("./jobOutlook"), import("./taskLifecycleNotificationAuthority")]);
  const answer = await loadSiteAnswer(requestId).catch(() => undefined);
  const decision = await loadJobOutlookDecision(requestId).catch(() => null);
  // Owed, not sent: written durably unless the caller is the reconcile, which keeps the entry it is trying.
  const owe = async () => { if (options.hold !== false) await holdAnswerNotice({ requestId, milestone: "answer_ready" }).catch(() => undefined);
    return { enqueued: false, reason: "awaiting_reading" }; };
  if (!decision) return owe();
  // The site's own ending: no answer email (checked on every branch, the reading-limit one included).
  if (decision.outlook.phase === "ended_by_site") return { enqueued: false, reason: "ended_by_site" };
  // A result may exist when the results could not be read: "result unknown" is never "no result" for an email.
  if (decision.resultUnknown) return owe();
  const queue = async (outlook: JobOutlook, extra: { siteAnswer?: SiteAnswer; paperUnread?: true }) => {
    // Kept on file, after the start form's notice for the same reason already went out: not a second time.
    if (outlook.reason === "kept_on_file" && await keptOnFileAlreadyTold(requestId)) return { enqueued: false, reason: "kept_already_told" };
    // One row per ending (its reason in the key): a later, different ending is never blocked by an earlier row.
    const result = await enqueueTaskLifecycleNotification({ requestId, milestone: "answer_ready", eventId: String(outlook.reason),
      outlook, ...extra });
    return { ...result, key: `${requestId}:answer_ready:${outlook.reason}` };
  };
  if (answer === undefined || answer?.state === "reading") {
    // The reading has its limit: past it, the recorded ending's email goes, saying there is no paper check.
    const since = Date.parse(waitingSince ?? "");
    const ending = decision.ending;
    if (ending && endingEmailDue(ending) && Number.isFinite(since) && Date.now() - since >= READING_WAIT_LIMIT_MS)
      return queue(ending, { paperUnread: true });
    return owe();
  }
  if (!decision.certain) return owe();
  if (!answerEmailDue(answer, decision.outlook)) return { enqueued: false, reason: "not_due" };
  return queue(decision.outlook, { siteAnswer: answer });
}

/**
 * Read again at dispatch: true while the outlook still calls for this email, for the ending its key names. Only a
 * recorded fact cancels the row: when the outlook cannot be read for certain, or the results cannot be read, this
 * throws and the row stays queued for a later pass.
 */
export async function answerReadyShown(requestId: string, idempotencyKey?: string): Promise<boolean> {
  const [{ loadSiteAnswer }, { loadJobOutlookDecision }, { keptOnFileAlreadyTold }] = await Promise.all([import("./siteAnswer"),
    import("./jobOutlook"), import("./taskLifecycleNotificationAuthority")]);
  const decision = await loadJobOutlookDecision(requestId);
  if (decision.outlook.phase === "ended_by_site") return false;
  if (decision.resultUnknown) throw new Error("answer_ready_result_unknown");
  const keyed = idempotencyKey?.startsWith(`${requestId}:answer_ready:`) ? idempotencyKey.slice(`${requestId}:answer_ready:`.length) : null;
  const matches = (outlook: JobOutlook | null) => Boolean(outlook && (!keyed || outlook.reason === keyed));
  let unreadable = false;
  const answer = await loadSiteAnswer(requestId).catch(() => { unreadable = true; return undefined; });
  // An answer that cannot be read is treated as one still being read: the email stands while the job's recorded ending
  // is one it carries and its key names. With no such ending the failure is unknown, never a cancel: it throws, and
  // the row stays queued.
  if (unreadable) {
    const ending = decision.ending;
    if (!ending || !endingEmailDue(ending) || !matches(ending)) throw new Error("answer_ready_answer_unreadable");
    return !(ending.reason === "kept_on_file" && await keptOnFileAlreadyTold(requestId));
  }
  // An email queued after the reading ran out stands while its recorded ending does.
  if (answer?.state === "reading") {
    const ending = decision.ending;
    if (!ending || !endingEmailDue(ending) || !matches(ending)) return false;
    return !(ending.reason === "kept_on_file" && await keptOnFileAlreadyTold(requestId));
  }
  if (!decision.certain) throw new Error("answer_ready_outlook_unknown");
  if (!matches(decision.outlook)) return false;
  if (decision.outlook.reason === "kept_on_file" && await keptOnFileAlreadyTold(requestId)) return false;
  return answerEmailDue(answer, decision.outlook);
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
    import("./websiteCaptureRights"), import("./taskStatusProjection")]);
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
    // A job carrying the 2026-11-11 marker is built whatever the screen says: no screen sentence in its status.
    site_task_triage: sceneScreenGateEnded(record, requestId) ? null : record.site_task_triage ?? null,
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
/**
 * "Your job summary is shared" (frame of 2026-11-12): sent once, at the first moment the summary is visible to approved
 * deployment companies, never before and never twice. A card that goes live marks the notice owed
 * (`SUMMARY_SHARED_OWED`); this sends it when `teamJobAccess` says the card is listed, which may be at once or later
 * (a card that went live while paused, or under a rights hold, becomes visible when that lifts). Each attempt has its
 * own key; one that went out, or may have, settles it for good, and the dispatch check cancels an attempt that is no
 * longer true (hidden again before it went out), after which a later attempt is made when it is visible again.
 */
export const SUMMARY_SHARED_OWED = { owed: true } as const;
export const summarySharedNoticeKey = (requestId: string, attempt: number) => `${requestId}:listing_live:summary-${attempt}`;

export async function notifySummarySharedIfVisible(requestId: string): Promise<{ enqueued: boolean; reason?: string }> {
  if (!db) return { enqueued: false, reason: "unavailable" };
  const ref = db.collection("inboundRequests").doc(requestId);
  const record = (await ref.get()).data();
  const notice = record?.summary_shared_notice as { owed?: boolean; attempts?: number } | undefined;
  if (!record || notice?.owed !== true) return { enqueued: false, reason: "not_owed" };
  const attempts = Number.isSafeInteger(notice.attempts) && notice.attempts! > 0 ? notice.attempts! : 0;
  const { OUTBOX_WENT_OUT } = await import("./outboxWentOut");
  const rows = await Promise.all(Array.from({ length: attempts }, (_, index) =>
    db!.collection(CAPTURE_OUTBOX_COLLECTION).doc(summarySharedNoticeKey(requestId, index + 1)).get().then(doc => doc.data())));
  // One went out, or may have: never a second.
  if (rows.some(row => row && OUTBOX_WENT_OUT.has(String(row.status)))) {
    await ref.set({ summary_shared_notice: { owed: false } }, { merge: true });
    return { enqueued: false, reason: "already_sent" };
  }
  // One is waiting to go out: let it.
  if (rows.some(row => row && !["cancelled", "failed"].includes(String(row.status)))) return { enqueued: false, reason: "queued" };
  // Never visible again: the site withdrew its permission, or closed the job (a closed job takes no further decision).
  // Settled as not owed, with the reason, so it never holds a place in the sweep. Only not visible right now (a rights
  // hold, a pause, a card awaiting review) stays owed.
  const settled = await summarySharedNoticeSettledReason(record);
  if (settled) {
    await ref.set({ summary_shared_notice: { owed: false, settled_reason: settled, settled_at_iso: new Date().toISOString() } }, { merge: true });
    return { enqueued: false, reason: settled };
  }
  // The whole rule a company's own reads use (review M1), so this never says companies can see a job they cannot.
  const { loadCompanyJobAccess } = await import("./teamJobAccess");
  if (!(await loadCompanyJobAccess(requestId, record)).access.listed) return { enqueued: false, reason: "not_visible" };
  const attempt = attempts + 1;
  await ref.set({ summary_shared_notice: { owed: true, attempts: attempt } }, { merge: true });
  const result = await enqueueTaskLifecycleNotification({ requestId, milestone: "listing_live", eventId: `summary-${attempt}` });
  return { enqueued: Boolean(result.enqueued) };
}

/** Why an owed "summary is shared" notice can never be sent, or null while it still may be. */
export async function summarySharedNoticeSettledReason(record: Record<string, any>): Promise<"permission_withdrawn" | "job_closed" | null> {
  const { projectWebsiteCaptureRights } = await import("./websiteCaptureRights");
  if (projectWebsiteCaptureRights(record).consent_revoked) return "permission_withdrawn";
  if (record.workspace_task?.archived === true) return "job_closed";
  return null;
}

/** Where the sweep below continues from; stored so every owed row is reached across passes and restarts. */
export const SUMMARY_SHARED_SWEEP_CURSOR = "outboxSweepState/summary_shared_notice";

/**
 * The owed "summary is shared" notices, tried each outbox pass (a card's visibility can change on any write). Pages
 * through every owed row in document-id order, at most `limit` per pass, continuing after the last row it read and
 * starting over once it reaches the end, so no set of rows that are not visible yet can hide another.
 */
export async function reconcileSummarySharedNotices(limit = 20): Promise<void> {
  if (!db) return;
  const cursorRef = db.doc(SUMMARY_SHARED_SWEEP_CURSOR);
  const stored = (await cursorRef.get()).data()?.after;
  const cursor = typeof stored === "string" && stored ? stored : null;
  let query = db.collection("inboundRequests").where("summary_shared_notice.owed", "==", true).orderBy("__name__").limit(limit);
  if (cursor) query = query.startAfter(cursor);
  const owed = await query.get();
  for (const doc of owed.docs) {
    try { await notifySummarySharedIfVisible(doc.id); }
    catch (error) { logger.warn({ error, requestId: doc.id }, "Could not settle a summary-shared notice"); }
  }
  // A short page is the end of the list: the next pass starts from the beginning. Written only when it changes (a
  // missing document reads as null), so a pass with nothing owed writes nothing.
  const next = owed.docs.length < limit ? null : owed.docs[owed.docs.length - 1].id;
  if (next !== cursor) await cursorRef.set({ after: next }, { merge: true });
}

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
