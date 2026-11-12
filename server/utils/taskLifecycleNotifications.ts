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
import { preparationEndedSentence } from "./taskStatusProjection";
import { EARLY_TASK_HOLD_DETAIL, EARLY_TASK_HOLD_SENTENCES, earlyTaskHoldOf, isEarlyTaskHoldReason,
  FOOTAGE_BEFORE_ACCOUNT_SENTENCE, JOB_NO_GRANT_SITE_ENDING_SUBJECT, JOB_WINDOW_ENDING_MESSAGE, JOB_WINDOW_ENDING_SUBJECT, jobNoGrantEndingMessage,
  isRecaptureReason, LARGE_VIDEO_RECAPTURE_SENTENCES, RECAPTURE_SENTENCES, RECAPTURE_TITLE, recaptureReasonOf, TASK_NOT_NAMED_REASON,
  type EarlyTaskHoldReason, type RecaptureReason } from "./taskPreparationOutcome";
import { isWebsiteJobNoGrantEndedEventId, isWebsiteJobWindowEndedEventId } from "./websiteJobWindowEnding";
import { selectWebsiteAtlasPreview } from "./websiteAtlasPreview";
import { isScreeningHeldOutcome, isScreeningResultOutcome, simulationOutcomeEmailSentence, storedScreeningOutcomeCaveat,
  type ScreeningOutcome, type ScreeningOutcomeCaveat } from "./betaPolicyScreeningContract";
import { PLAIN_SETUP_CAVEAT, projectSimulationProof, testHeadline, testNotRunLine, testResultOf, testSubLine,
  type SimulationProof } from "../../client/src/lib/simulationProof";
import { isTerminalSceneOutcomeKind, sceneOutcomeMessage, sceneOutcomeSubject,
  type TerminalSceneOutcomeKind } from "./sceneIntentOutcome";
import { LIMITS_PAPER, LIMITS_TESTED, SURENESS_WORDS, type SiteAnswer } from "../../client/src/lib/siteAnswer";
import { sceneScreenGateEnded } from "./sceneScreenGate";

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
  // A job waiting for its sentence needs the site, not our team: no "needs attention" email; the page asks for it.
  if (params.milestone === "preparation_needs_attention"
    && (await import("./jobSentenceWait")).jobWaitsForItsSentence({ requestId, record: snapshot.data() }))
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
  const message = held ? earlyTaskHoldCopy(held) : recapture ? recaptureCopy(recapture) : copy[params.milestone];
  const url = params.captureUrl ?? captureUploadUrlFor(requestId, "owner");
  const eventId = params.eventId?.trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 120);
  // Preparation notices never carry caller text: only a validated reference and,
  // for an ending, the fixed sentence for its reason.
  const reference = /^bp-prep-[a-f0-9]{16}$/.test(params.correlationId || "") ? `Reference: ${params.correlationId}.` : "";
  // A stopped simulation means no test result will come: the paper check, when there is one, is the answer.
  const preparationDetail = params.milestone === "preparation_ended"
    ? [preparationEndedSentence(params.terminalReason), paperLine(params.siteAnswer, { hold: false, unread: params.paperUnread }), reference]
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
    : testNotRunLine(params.simulationProof) ?? simulationOutcomeEmailSentence(outcome);
  const paper = paperLine(params.siteAnswer, { hold: isScreeningHeldOutcome(outcome), unread: params.paperUnread });
  return paperAnswerLine(params.siteAnswer) ? `${why} ${paper}\n\n${finePrint(LIMITS_PAPER)}`
    : `${why} ${paper} Nothing is needed from you.\n\n${finePrint(SIMULATION_DISCLAIMER)}`;
}

/** An ending's own reason, then its paper-check line. */
function withPaperAnswer(reason: string, paper: string): string {
  return `${reason} ${paper}`;
}

/** The paper check said as the answer, or null when there is none: the composer's own headline. */
function paperAnswerLine(answer: SiteAnswer | null | undefined, hold = false): string | null {
  return answer?.state === "ready" && answer.pick
    ? `So ${hold ? "for now " : ""}the paper check is your answer. ${answer.headline}${answer.sceneNote ? ` ${answer.sceneNote}` : ""}${hold ? ` ${PAPER_LATER}` : ""}`
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
/** A hold's paper-check answer ends with this: a test result may still come. */
export const PAPER_LATER = "If a test result comes later, we'll email it.";
export const NO_PAPER_CHECK = "There is no paper check for this job.";
export const NO_PAPER_UNREAD = "We could not finish reading your video, so there is no paper check for this job.";

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
  if (outlook!.reason === "kept_on_file") return `${outlook!.sentence} ${paperLine(answer, { hold: false })}`;
  if (answer.state === "cannot_assess") return `${answer.headline}\n\n${answer.reason}`;
  return `${outlook!.sentence ?? "A simulation test has not run on your job."} ${paperLine(answer, { hold: false })}\n\n${finePrint(LIMITS_PAPER)}`;
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
