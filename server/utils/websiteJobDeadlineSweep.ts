/**
 * Every website job ends by itself at its deadline (`websiteJobDeadline`).
 *
 * Expiry used to be checked only when something called in, so a job whose Pipeline host went
 * silent read "in progress" for good and the site never heard. This sweep, run from the beta ops
 * monitor pass under the ops leader lease, ends each website job whose deadline has passed while
 * the job page still shows it open on our side (`websiteJobProgress`): it writes one small ending
 * record on the job and, in the same transaction, the pending flag for its one email. The outbox
 * pump's reconciler queues that email with a key that names the deadline, and dispatch sends it
 * only while the page still shows the job ended by that window.
 *
 * Only privacy, rights and money stop a job for good: a withdrawn or revoked job is never ended or
 * emailed here, and keeps its own withdrawal wording. A result, a hold or an ending that the page
 * shows is never replaced, and one that arrives after the ending still wins on the page. An
 * extension or renewal moves the deadline, which retires an ending recorded for the older one.
 */
import { createHash } from "node:crypto";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { websiteJobCreatedEpoch, websiteJobDeadline, websiteJobWorkWindow, type WebsiteJobDeadline } from "./websiteSceneSponsorship";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { projectTaskStatus, taskStatusInputFrom, type TaskPreparationStatus } from "./taskStatusProjection";
import { websiteJobEndsAtDeadline, websiteJobProgress, type WebsiteJobProgress } from "./websiteJobProgress";
import { WEBSITE_JOB_WINDOW_DEFAULT_SECONDS } from "./websiteJobWindow";
import { SCENE_EXECUTION_WINDOW_MAX_SECONDS } from "./sceneExecutionWindowExtension";
import { jobDeadlineEndedHeadline, preparationOutcomeV6Schema, projectAtlasPreparationOutcome,
  projectPreparationOutcome } from "./taskPreparationOutcome";
import { publicRobotFit, robotFitSchema } from "./websitePreparationStatus";
import { selectWebsiteAtlasPreview } from "./websiteAtlasPreview";
import { projectWebsiteRunClosure } from "./websiteRunClosure";
import { multiStepTaskHold } from "./siteTaskScope";
import { currentTaskTargetChoiceAnswer } from "./websiteTaskTargetChoice";
import { footageArrivedBeforeAccount, savedWalkthrough, siteWalkthroughIdentity } from "./siteWalkthrough";

export const WEBSITE_JOB_ENDING_FIELD = "website_job_ending";
export const WEBSITE_JOB_ENDING_PENDING_FIELD = "website_job_ending_notification_pending";
const ENDING_SCHEMA = "website_job_ending.v1";
const INBOUND = "inboundRequests";
/** A deadline that passed longer ago than this when the sweep first handles it is recorded, never emailed. */
export const WEBSITE_JOB_ENDING_NOTICE_MAX_LATE_SECONDS = 48 * 3600;
/**
 * The bound on each pass. It reads deadlines that passed at most this long ago (a grant's own
 * expiry plus its at most 7-day extension, plus the 48 hours in which an ending is still emailed),
 * on the indexed grant expiry and job creation fields, and at most WEBSITE_JOB_DEADLINE_SCAN_LIMIT
 * jobs from each per pass, turning through the window across passes. So the first pass after deploy
 * can neither scan nor email the whole history: older jobs are never swept, and the job page still
 * shows them ended by their window.
 */
export const WEBSITE_JOB_DEADLINE_LOOKBACK_SECONDS = SCENE_EXECUTION_WINDOW_MAX_SECONDS + WEBSITE_JOB_ENDING_NOTICE_MAX_LATE_SECONDS;
export const WEBSITE_JOB_DEADLINE_SCAN_LIMIT = 100;

type DatedDeadline = Extract<WebsiteJobDeadline, { deadlineEpoch: number }>;
export type WebsiteJobEnding = {
  schema_version: typeof ENDING_SCHEMA;
  reason: "window_ended";
  deadline_epoch: number;
  deadline_basis: DatedDeadline["basis"];
  /** The email's event id: one per deadline, so a later deadline that also passes is its own ending. */
  event_id: string;
  ended_at_epoch: number;
  /** The progression the page showed when the job was ended. */
  progression: WebsiteJobProgress;
  notice_owed: boolean;
  notice_withheld_reason: "deadline_passed_before_first_sweep" | null;
};

export const websiteJobEndingEventId = (deadlineEpoch: number) =>
  `deadline-${createHash("sha256").update(String(deadlineEpoch)).digest("hex").slice(0, 24)}`;
export const websiteJobEndingNoticeKey = (requestId: string, eventId: string) => `${requestId}:job_window_ended:${eventId}`;

/** The ending recorded for this exact deadline, or null: one for an older deadline no longer counts. */
export function currentWebsiteJobEnding(record: Record<string, any> | undefined, deadline: WebsiteJobDeadline): WebsiteJobEnding | null {
  const ending = record?.[WEBSITE_JOB_ENDING_FIELD];
  return ending?.schema_version === ENDING_SCHEMA && deadline.deadlineEpoch !== null
    && ending.deadline_epoch === deadline.deadlineEpoch && ending.event_id === websiteJobEndingEventId(deadline.deadlineEpoch)
    ? ending as WebsiteJobEnding : null;
}

const PREPARATION_STATES = new Set(["preparing", "awaiting_inputs", "capacity_delayed", "failed_retryable",
  "failed_terminal", "authority_ended", "handed_off"]);

/** The stored preparation status, in the job page's terms, with no Pipeline round trip; null when unreadable. */
function storedPreparationStatus(stored: unknown): TaskPreparationStatus | null {
  const status = (stored as { status?: Record<string, any> } | null | undefined)?.status;
  if (!status || !PREPARATION_STATES.has(status.state)) return null;
  const outcome = preparationOutcomeV6Schema.safeParse(status.outcome);
  const fit = robotFitSchema.safeParse(status.robot_fit);
  return { state: status.state, correlationId: null,
    terminalReason: typeof status.terminal_reason === "string" ? status.terminal_reason : null,
    outcome: outcome.success ? projectPreparationOutcome(outcome.data) : null,
    question: status.question ?? null, robotFit: fit.success ? publicRobotFit(fit.data) : null };
}

/**
 * What the owner's job page shows for this job now, from the same projection and the same stored
 * inputs, and the progression it reads. Throws when an input cannot be read, so an unreadable job
 * is neither ended nor emailed on a guess.
 */
export async function websiteJobPageReading(requestId: string, record: Record<string, any>, nowEpoch = Date.now() / 1000) {
  if (!db) throw new Error("website_job_deadline_store_unavailable");
  const [{ getBrief }, { passMarkForJob }, { loadSceneScreening }, { teamJobAccess }, { readWebsiteSceneProgression },
    { reconstructionIsViewable }] = await Promise.all([import("./siteTaskBrief"), import("./pilotRecommendationEvidence"),
    import("./agentEvalRuns"), import("./teamJobAccess"), import("./websiteSceneProgression"), import("./taskLifecycleNotifications")]);
  const identity = siteWalkthroughIdentity(requestId, record);
  const captureId = identity.captureId;
  const [brief, session, walkthrough] = await Promise.all([getBrief(requestId),
    db.collection("captureUploadSessions").doc(captureId).get(), savedWalkthrough(identity)]);
  // The page answers 503 when it cannot tell whether the video is saved; so does this reading.
  if (!walkthrough) throw new Error("website_job_walkthrough_unavailable");
  const rights = projectWebsiteCaptureRights(record);
  const consentRevoked = rights.consent_revoked;
  const footageBeforeAccount = !consentRevoked && await footageArrivedBeforeAccount(requestId, record) === true;
  const sessionData = session.data();
  const preparationStatus = !footageBeforeAccount && !consentRevoked && sessionData?.website_preparation
    ? storedPreparationStatus(sessionData.website_preparation) : null;
  const sceneProgression = preparationStatus?.state === "handed_off"
    ? await readWebsiteSceneProgression(requestId, captureId) : null;
  const reconstruction = sessionData?.world_reconstruction;
  const preview = rights.derived_scene_generation_allowed ? selectWebsiteAtlasPreview(record, captureId) : null;
  const targetChoiceAnswer = preparationStatus ? currentTaskTargetChoiceAnswer(sessionData,
    { state: preparationStatus.state, question: sessionData?.website_preparation?.status?.question ?? null }) : null;
  const input = taskStatusInputFrom({
    active_capture_id: typeof record.active_capture_id === "string" ? record.active_capture_id : null,
    site_task_brief_confirmed_at: record.site_task_brief_confirmed_at,
    capture_coverage: record.capture_coverage ?? null,
    briefDrafted: Boolean(brief),
    // The same saved-video read as the job page.
    hasStoredCapture: walkthrough.received,
    footageBeforeAccount,
    consentRevoked,
    jobWorkWindow: await websiteJobWorkWindow(record, nowEpoch),
    scenePreviewReady: !consentRevoked && reconstructionIsViewable({ ...reconstruction, worldId: reconstruction?.world_id }),
    visualReconstructionReady: preview?.state === "ready",
    scenePreparationFailed: reconstruction?.state === "failed",
    ownerClosureOutcome: projectWebsiteRunClosure(record, requestId, captureId),
    preparationOutcome: consentRevoked ? null : projectAtlasPreparationOutcome(preview),
    preparationStatus,
    multiStepHold: consentRevoked ? null : multiStepTaskHold(brief),
    targetChoiceAnswer,
    sceneProgression,
    stage: null,
    screening: consentRevoked ? null : await loadSceneScreening(requestId, passMarkForJob(record, brief as never)),
    site_task_triage: record.site_task_triage ?? null,
    site_task_scope: record.site_task_scope ?? null,
    account_owner_uid: typeof record.account_owner_uid === "string" && record.account_owner_uid ? record.account_owner_uid : null,
    capture_owner_uid: record.capture_owner_uid,
    jobAccess: (() => { try { return teamJobAccess(record); } catch { return null; } })(),
    recommended: Boolean(record.pilot_recommendation),
  });
  return { progress: websiteJobProgress(input), status: projectTaskStatus(input), basis: input.jobDeadlineBasis };
}

/**
 * Whether the page shows this job ended at its deadline now: open progression, the projection's own
 * ending marker for the job's basis, and its sentence. The status route never replaces a marked
 * headline, so this is what the owner's page shows.
 */
const endedByWindow = (reading: Awaited<ReturnType<typeof websiteJobPageReading>>) =>
  websiteJobEndsAtDeadline(reading.progress) && reading.basis !== undefined
  && reading.status.endedAtDeadline === reading.basis
  && reading.status.headline === jobDeadlineEndedHeadline(reading.basis);

export type WebsiteJobDeadlineSweepSummary = { examined: number; ended: number; noticesOwed: number; failed: number };

/**
 * A turning scan of one indexed field across [lower, upper], ordered by that field then document id
 * (the automatic single-field index serves both). After a full page the next pass resumes exactly
 * after the last (value, id) pair it read, so a document sharing a value across a page boundary is
 * neither skipped nor read twice; a short page starts the window again.
 */
async function scanWindow(store: FirebaseFirestore.Firestore, field: string, cursorName: string,
  lower: number, upper: number, toQueryValue: (epoch: number) => unknown, epochOf: (value: unknown) => number | null,
  limit: number) {
  const valueAt = (data: Record<string, any>) => field.split(".").reduce<any>((value, key) => value?.[key], data);
  const cursorRef = store.collection("automationCursors").doc(cursorName);
  const cursor = (await cursorRef.get()).data();
  const cursorEpoch = cursor && typeof cursor.last_id === "string" ? epochOf(cursor.last_value) : null;
  let query = store.collection(INBOUND).where(field, ">=", toQueryValue(lower)).where(field, "<=", toQueryValue(upper))
    .orderBy(field).orderBy("__name__");
  if (cursorEpoch !== null && cursorEpoch >= lower && cursorEpoch <= upper) query = query.startAfter(cursor!.last_value, cursor!.last_id);
  const rows = await query.limit(limit).get();
  const last = rows.docs.length >= limit ? rows.docs[rows.docs.length - 1] : null;
  await cursorRef.set(last ? { last_value: valueAt(last.data()), last_id: last.id } : { last_value: null, last_id: null });
  return rows.docs;
}

async function endIfDue(store: FirebaseFirestore.Firestore, requestId: string, record: Record<string, any>,
  nowEpoch: number): Promise<{ ended: boolean; noticeOwed: boolean }> {
  const none = { ended: false, noticeOwed: false };
  const deadline = await websiteJobDeadline(record);
  // Privacy and rights first: a withdrawn or revoked job keeps its own wording and gets nothing here.
  const rights = projectWebsiteCaptureRights(record);
  if (deadline.deadlineEpoch === null || deadline.deadlineEpoch > nowEpoch || rights.consent_revoked
    || !rights.derived_scene_generation_allowed || currentWebsiteJobEnding(record, deadline)) return none;
  const reading = await websiteJobPageReading(requestId, record, nowEpoch);
  if (!endedByWindow(reading)) return none;
  const noticeOwed = nowEpoch - deadline.deadlineEpoch <= WEBSITE_JOB_ENDING_NOTICE_MAX_LATE_SECONDS;
  const ref = store.collection(INBOUND).doc(requestId);
  // Exactly once: re-read inside the transaction; a second pass or a racing process sees the ending and writes nothing.
  return store.runTransaction(async transaction => {
    const current = (await transaction.get(ref)).data();
    const now = await websiteJobDeadline(current, { get: (doc: any) => transaction.get(doc) });
    const currentRights = projectWebsiteCaptureRights(current);
    if (!current || now.deadlineEpoch !== deadline.deadlineEpoch || currentRights.consent_revoked
      || !currentRights.derived_scene_generation_allowed || currentWebsiteJobEnding(current, now)) return none;
    const ending: WebsiteJobEnding = { schema_version: ENDING_SCHEMA, reason: "window_ended",
      deadline_epoch: deadline.deadlineEpoch, deadline_basis: deadline.basis,
      event_id: websiteJobEndingEventId(deadline.deadlineEpoch), ended_at_epoch: nowEpoch,
      progression: reading.progress as WebsiteJobProgress, notice_owed: noticeOwed,
      notice_withheld_reason: noticeOwed ? null : "deadline_passed_before_first_sweep" };
    transaction.set(ref, { [WEBSITE_JOB_ENDING_FIELD]: ending, [WEBSITE_JOB_ENDING_PENDING_FIELD]: noticeOwed }, { merge: true });
    return { ended: true, noticeOwed };
  });
}

/**
 * One pass: end each website job whose deadline has passed and whose page still shows it open.
 * One job that cannot be read or written is logged and left for the next pass.
 */
export async function sweepWebsiteJobDeadlines(options: { nowMs?: number; limit?: number } = {}): Promise<WebsiteJobDeadlineSweepSummary> {
  const summary: WebsiteJobDeadlineSweepSummary = { examined: 0, ended: 0, noticesOwed: 0, failed: 0 };
  if (!db) return summary;
  const store = db;
  const nowEpoch = (options.nowMs ?? Date.now()) / 1000;
  const limit = Math.max(1, Math.min(options.limit ?? WEBSITE_JOB_DEADLINE_SCAN_LIMIT, 500));
  const lower = nowEpoch - WEBSITE_JOB_DEADLINE_LOOKBACK_SECONDS;
  const candidates = new Map<string, Record<string, any>>();
  // Jobs with a grant, by its own expiry (an extension can only move the deadline later, inside the lookback).
  for (const doc of await scanWindow(store, "website_scene_sponsorship.expires_at_epoch", "website_job_deadline_grants",
    lower, nowEpoch, epoch => epoch, value => typeof value === "number" && Number.isFinite(value) ? value : null, limit))
    candidates.set(doc.id, doc.data());
  // Website jobs that never received a grant, by creation time: their deadline is created + the default window.
  const toTimestamp = (epoch: number) => admin.firestore.Timestamp.fromMillis(Math.round(epoch * 1000));
  for (const doc of await scanWindow(store, "createdAt", "website_job_deadline_created",
    lower - WEBSITE_JOB_WINDOW_DEFAULT_SECONDS, nowEpoch - WEBSITE_JOB_WINDOW_DEFAULT_SECONDS, toTimestamp,
    websiteJobCreatedEpoch, limit)) {
    const data = doc.data();
    if (data.request?.buyerType === "site_operator" && !data.website_scene_sponsorship) candidates.set(doc.id, data);
  }
  for (const [requestId, record] of candidates) {
    summary.examined += 1;
    try {
      const result = await endIfDue(store, requestId, record, nowEpoch);
      if (result.ended) summary.ended += 1;
      if (result.noticeOwed) summary.noticesOwed += 1;
    } catch (error) {
      summary.failed += 1;
      logger.warn({ error, requestId }, "Could not check a website job's deadline; the next pass checks it again");
    }
  }
  if (summary.ended) logger.info({ event: "website_job_deadline_sweep", ...summary }, "Ended website jobs whose deadline passed");
  return summary;
}

/**
 * Whether the job page shows the ending a queued notice names: the key names the job's current
 * deadline, the ending for it is recorded, and the page still shows the job ended by that window.
 * Throws when the job cannot be read, which leaves the claim recoverable rather than cancelling or
 * sending it.
 */
export async function websiteJobEndingShown(requestId: string, idempotencyKey: string): Promise<boolean> {
  if (!db) throw new Error("website_job_deadline_store_unavailable");
  const record = (await db.collection(INBOUND).doc(requestId).get()).data();
  if (!record) return false;
  const deadline = await websiteJobDeadline(record);
  const ending = currentWebsiteJobEnding(record, deadline);
  if (!ending || idempotencyKey !== websiteJobEndingNoticeKey(requestId, ending.event_id)) return false;
  return endedByWindow(await websiteJobPageReading(requestId, record));
}

/**
 * Queue each owed ending email once. The flag clears only when its outbox row exists for the
 * ending it was owed for, or once the page no longer shows that ending (nothing is owed then).
 */
export async function reconcileWebsiteJobEndingNotifications(limit = 20): Promise<void> {
  if (!db) return;
  const store = db;
  const [{ enqueueTaskLifecycleNotification }, { CAPTURE_OUTBOX_COLLECTION }] = await Promise.all([
    import("./taskLifecycleNotifications"), import("./captureOutbox")]);
  const query = store.collection(INBOUND).where(WEBSITE_JOB_ENDING_PENDING_FIELD, "==", true);
  let rows = await automationBatch(store, query, "website_job_ending_notifications", limit);
  if (!rows.docs.length) rows = await automationBatch(store, query, "website_job_ending_notifications", limit);
  for (const row of rows.docs) {
    const requestId = row.id;
    const eventId = row.data()?.[WEBSITE_JOB_ENDING_FIELD]?.event_id;
    const deadlineBasis = row.data()?.[WEBSITE_JOB_ENDING_FIELD]?.deadline_basis;
    if (typeof eventId !== "string" || !["grant", "grant_extended", "job_created"].includes(deadlineBasis)) {
      logger.warn({ requestId }, "A website job ending notice is unreadable; it stays pending for review");
      continue;
    }
    try {
      const key = websiteJobEndingNoticeKey(requestId, eventId);
      const shown = await websiteJobEndingShown(requestId, key);
      // Refused while recording permission is withdrawn or no contact is on file: the flag stays.
      // The email says the ending in the sentence for the deadline's basis, as the page does.
      if (shown) await enqueueTaskLifecycleNotification({ requestId, milestone: "job_window_ended", eventId, deadlineBasis });
      const queued = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(key);
      await store.runTransaction(async transaction => {
        const current = (await transaction.get(row.ref)).data();
        const outbox = await transaction.get(queued);
        if (shown && !outbox.exists || current?.[WEBSITE_JOB_ENDING_FIELD]?.event_id !== eventId) return;
        transaction.set(row.ref, { [WEBSITE_JOB_ENDING_PENDING_FIELD]: false }, { merge: true });
      });
    } catch (error) {
      logger.warn({ error, requestId }, "A website job ending notice stays pending for the next pass");
    }
  }
}
