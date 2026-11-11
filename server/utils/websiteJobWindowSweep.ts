/**
 * The WebApp's own timer for a website job.
 *
 * A job's waiting states used to end only when the Pipeline said so. When the
 * Pipeline went quiet (its host down, a job stranded, a stage that refused),
 * the job waited for ever and the site stopped hearing. The job's work window
 * is the limit that already exists (`websiteJobWindow.ts`): after it the
 * Pipeline starts nothing more for the job, with or without an operator. This
 * sweep reads that window on the job's own record and, once it has passed with
 * no result, hold, withdrawal or ending on record, ends the job itself:
 *
 * - one transaction writes the stored ending (`websiteJobWindowEnding.ts`) that
 *   the job pages show, and creates the one outcome email in the existing
 *   outbox under a document id fixed by the job, so it can never be sent twice.
 *   If that email was cancelled unsent because an extension reopened the window,
 *   the later ending queues one under the id naming its own window end;
 * - the email is cancelled at dispatch like every capture notice when recording
 *   permission is withdrawn, and when the ending no longer speaks for the job;
 * - no backfill: a window that ended before the cutover gets the stored ending
 *   and no email.
 *
 * It never ends a job that already has an outcome on record (an estimate, a
 * hold, an ending the site was told, an evaluation run), a withdrawal (finished
 * or in progress), an owner closure, or a window an extension moved into the
 * future. It reads and writes no money record: grants, reservations, ledgers
 * and scene intakes are untouched.
 *
 * A job that never received a grant has no window, so the same pass keeps a clock for it on its own
 * record (`websiteJobWindowEnding.ts`), started the first time the pass sees it waiting. No
 * backfill: a job that had already waited a whole window since its latest site activity when the pass
 * first sees it (or whose stored times cannot be read) is ended then, with no email and no page. Only
 * website jobs count (`isWebsiteJobRecord` and a task brief); nothing is written for any other request. The clock
 * runs as long as a grant's window would (`websiteJobWindowSeconds`). A job waiting on the site
 * (no finished recording, or a held job's one step) then ends with the truth: we did not receive
 * what was needed. A job waiting on Blueprint (the site did its part, no grant came) ends held, and
 * the ops monitor pages before that (`scanWebsiteJobsWaitingOnGrant`). Each ending has one email
 * under a key fixed by the job, through the same outbox and the same dispatch checks. A job whose
 * grant arrives later is the window sweep's again.
 */
import { OUTBOX_WENT_OUT } from "./outboxWentOut";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { createAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";
import { sponsorshipExecutionWindowUntil, sponsorshipWindowIntake } from "./sceneExecutionWindowExtension";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { buildTaskLifecycleNotification, paperAnswerForEnding, waitingAnswerNoticeFields, workspaceTaskUrl } from "./taskLifecycleNotifications";
import { earlyTaskHoldOf } from "./taskPreparationOutcome";
import { resultOutranksWindowEnding } from "./taskStatusProjection";
import { selectWebsiteAtlasPreview } from "./websiteAtlasPreview";
import { isWebsiteJobWindowEndedNoticeKey, recordedWebsiteJobWindowEnding, sealWebsiteJobWindowEnding,
  websiteJobWindowEndedEventId, websiteJobWindowEndedNoticeKey, WEBSITE_JOB_WINDOW_ENDING_FIELD,
  WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH, type WebsiteJobWindowEndingNotice } from "./websiteJobWindowEnding";
import { websiteRunClosure } from "./websiteRunClosure";
import { sponsorshipValidUntil, websiteJobWindowSeconds } from "./websiteSceneSponsorship";
import { TASK_BRIEFS_COLLECTION } from "./siteTaskBrief";
import { multiStepTaskHold } from "./siteTaskScope";
import { savedWalkthrough } from "./siteWalkthrough";
import { stuckAlertMs } from "./websitePreparationWatch";
import { isApprovedCaptureRegion } from "../../client/src/data/captureResidency";
import { hasCurrentDescriptionAuthority } from "./descriptionAuthority";
import { isWebsiteJobNoGrantEndedNoticeKey, newWebsiteJobNoGrantClock, recordedWebsiteJobNoGrantEnding,
  sealWebsiteJobNoGrantEnding, websiteJobNoGrantClock, websiteJobNoGrantEndedNoticeKey, WEBSITE_JOB_NO_GRANT_CLOCK_FIELD,
  WEBSITE_JOB_NO_GRANT_ENDED_EVENT_ID, WEBSITE_JOB_NO_GRANT_ENDING_FIELD, WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD,
  type WebsiteJobNoGrantClock, type WebsiteJobNoGrantEndingNotice, type WebsiteJobNoGrantWait } from "./websiteJobWindowEnding";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { largeVideoIngestBlock } from "./websiteLargeVideoBlock";
import { newWebsiteLargeVideoAsk, websiteLargeVideoAsk, websiteLargeVideoAskEventId, websiteLargeVideoAskNoticeKey,
  WEBSITE_LARGE_VIDEO_ASK_FIELD, type WebsiteLargeVideoAsk } from "./websiteJobWindowEnding";

const JOBS = "inboundRequests";
const SESSIONS = "captureUploadSessions";
const CURSOR = "website_job_window_sweep";
const NO_GRANT_CURSOR = "website_job_no_grant_sweep";
const GRANT_SCHEMA = "website_scene_sponsorship.v1";
const DEFAULT_BATCH = 25;
/**
 * A contact address that cannot be decrypted may be a passing key-service failure. The ending
 * waits this long after the window for it to read, so the site still gets its email; after
 * that the job is ended anyway and recorded as having nobody to email.
 */
const CONTACT_READ_GRACE_SECONDS = 24 * 3600;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Outbox states in which an email may have left, or is leaving. */
const WENT_OUT = OUTBOX_WENT_OUT;

/** Why the sweep leaves a job as it is. */
export type JobWindowSweepSkip =
  /** No readable grant, so no window to read. */
  | "no_window"
  /** The window, with any verified extension, has not passed. */
  | "window_open"
  /** The ending for this grant is already recorded. */
  | "ending_recorded"
  /** Recording permission was withdrawn, or a withdrawal is in progress: that is the job's ending. */
  | "withdrawn"
  /** The owner closed the run. */
  | "owner_closed"
  /** An estimate, an evaluation's hold or an evaluation run is on record. */
  | "result_recorded"
  /** A hold or an ending the site is told in its own notice is on record. */
  | "outcome_told"
  /** The contact address did not decrypt; tried again while the grace period lasts. */
  | "contact_unreadable"
  /** The job changed between the read and the write; the next pass reads it again. */
  | "changed";
export type JobWindowSweepResult = JobWindowSweepSkip | "ended_notice_queued" | "ended_no_notice";

/**
 * What the job record alone rules out, cheapest first. `raw` is the grant's own expiry: the
 * verified extension, which needs the bound scene intake, is read by the caller.
 */
function recordSkip(record: Record<string, any> | undefined, requestId: string, nowEpoch: number): JobWindowSweepSkip | null {
  const grant = record?.website_scene_sponsorship;
  if (!grant || grant.request_id !== requestId || typeof grant.authority_digest !== "string"
    || typeof grant.expires_at_epoch !== "number" || !Number.isFinite(grant.expires_at_epoch)) return "no_window";
  if (grant.expires_at_epoch > nowEpoch) return "window_open";
  if (record!.capture_withdrawal || projectWebsiteCaptureRights(record).consent_revoked) return "withdrawn";
  if (websiteRunClosure(record, requestId, siteWalkthroughIdentity(requestId, record).captureId)) return "owner_closed";
  return null;
}

/**
 * When the job's window ended: the grant's expiry, or the end of its verified extension. Throws
 * when the extension's scene intake cannot be read.
 */
async function windowEnd(record: Record<string, any>, reader: { get: (ref: any) => Promise<any> }): Promise<number> {
  const grant = record.website_scene_sponsorship;
  return sponsorshipValidUntil(grant, record.website_scene_sponsorship_execution_window
    ? sponsorshipExecutionWindowUntil(grant, record, await sponsorshipWindowIntake(reader, record)) : undefined);
}
const plainReader = { get: (ref: any) => ref.get() };

/**
 * An ending already recorded for this grant settles the job only while it is for the same window
 * end. An extension that reopened the window and has since passed is a new ending: its email may
 * have been cancelled unsent when the window reopened, so the sweep reconciles it below.
 */
function recordedForWindow(record: Record<string, any> | undefined, windowEndedAt: number): boolean {
  return recordedWebsiteJobWindowEnding(record)?.window_ended_at_epoch === windowEndedAt;
}

/**
 * An outcome already on record for the job, read from stored data only (the Pipeline may be
 * unreachable, which is when this sweep matters most). Throws when it cannot be read, so the
 * job is left for the next pass rather than ended on a guess.
 */
async function storedOutcome(requestId: string, record: Record<string, any>): Promise<JobWindowSweepSkip | null> {
  const captureId = siteWalkthroughIdentity(requestId, record).captureId;
  const [{ readWebsiteSceneProgression }, { loadSceneScreening }] = await Promise.all([
    import("./websiteSceneProgression"), import("./agentEvalRuns")]);
  const sceneProgression = await readWebsiteSceneProgression(requestId, captureId);
  const screening = await loadSceneScreening(requestId);
  if (resultOutranksWindowEnding({ screening, sceneProgression })) return "result_recorded";
  // The Pipeline's own terminal outcome for the scene (C-04) has its own one email.
  if (sceneProgression?.sceneOutcome?.terminal) return "outcome_told";
  const status = (await db!.collection(SESSIONS).doc(captureId).get()).data()?.website_preparation?.status;
  // Preparation that ended for good was told with its reason (`preparation_ended`).
  if (status?.state === "failed_terminal") return "outcome_told";
  // A robot fit hold, and a geometry-only job's finished robot fit table, are the job's result.
  if (status?.state === "awaiting_inputs" && (status.outcome?.reason === "robot_fit_none"
    || status.robot_fit?.route === "geometry_only" && status.robot_fit?.status === "completed")) return "result_recorded";
  // An early task hold (we can't simulate this kind of job yet), unless the scene moved on past it.
  const movedOn = status?.state === "handed_off" || Boolean(sceneProgression);
  if (!movedOn && earlyTaskHoldOf(selectWebsiteAtlasPreview(record, captureId))) return "outcome_told";
  return null;
}

/**
 * Ends one job when its window has passed and nothing on record speaks for it. `observed` is the
 * job record when the caller has just read it; the write reads it again in its transaction.
 */
export async function sweepWebsiteJobWindow(requestId: string, nowMs = Date.now(),
  observed?: Record<string, any>): Promise<JobWindowSweepResult> {
  if (!db) throw new Error("website_job_window_sweep_store_unavailable");
  const store = db;
  const nowEpoch = nowMs / 1000;
  const jobRef = store.collection(JOBS).doc(requestId);
  observed ??= (await jobRef.get()).data();
  const early = recordSkip(observed, requestId, nowEpoch);
  if (early) return early;
  if (recordedWebsiteJobWindowEnding(observed)) {
    const observedEnd = await windowEnd(observed!, plainReader);
    if (!(observedEnd <= nowEpoch)) return "window_open";
    if (recordedForWindow(observed, observedEnd)) return "ending_recorded";
  }
  const outcome = await storedOutcome(requestId, observed!);
  if (outcome) return outcome;
  const observedGrant = observed!.website_scene_sponsorship.authority_digest;
  const firstKey = websiteJobWindowEndedNoticeKey(requestId);
  return store.runTransaction<JobWindowSweepResult>(async transaction => {
    // Every read comes before the writes. The record is read again here, so a withdrawal, a
    // closure, a re-issued grant or an extension that landed since the first read still counts.
    const record = (await transaction.get(jobRef)).data();
    const skip = recordSkip(record, requestId, nowEpoch);
    if (skip) return skip;
    const grant = record!.website_scene_sponsorship;
    if (grant.authority_digest !== observedGrant) return "changed";
    const windowEndedAt = await windowEnd(record!, transaction);
    if (!(windowEndedAt <= nowEpoch)) return "window_open";
    if (recordedForWindow(record, windowEndedAt)) return "ending_recorded";
    // No backfill: only a window that ended at or after the cutover owes the site an email.
    const owed = windowEndedAt >= WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH;
    // Every window-ended email this job ever had. One that went out, or still can, is the job's
    // one email: never a second. Only when each was cancelled unsent is another queued, under
    // the key that names this window end.
    const earlier: Array<{ id: string; data: () => Record<string, any> | undefined }> = owed
      ? (await transaction.get(store.collection(CAPTURE_OUTBOX_COLLECTION).where("requestId", "==", requestId))).docs
        .filter((row: { id: string }) => isWebsiteJobWindowEndedNoticeKey(requestId, row.id)) : [];
    const stillOwedByAnEarlierOne = earlier.some(row => row.data()?.status !== "cancelled");
    const first = !earlier.some(row => row.id === firstKey);
    const outboxRef = store.collection(CAPTURE_OUTBOX_COLLECTION)
      .doc(first ? firstKey : websiteJobWindowEndedNoticeKey(requestId, windowEndedAt));
    let notice: WebsiteJobWindowEndingNotice = "none_window_ended_before_cutover";
    let entry: ReturnType<typeof buildOutboxEntry> | null = null;
    let waiting: Record<string, unknown> = {};
    if (stillOwedByAnEarlierOne) notice = "queued";
    else if (owed && earlier.some(row => row.id === outboxRef.id)) notice = "none_cancelled_before_sending";
    else if (owed) {
      let to: string;
      try { to = String(await decryptFieldValue(record!.contact?.email ?? "")).trim(); }
      catch {
        if (nowEpoch - windowEndedAt < CONTACT_READ_GRACE_SECONDS) return "contact_unreadable";
        to = "";
      }
      if (EMAIL.test(to)) {
        // The window ran out before a test result: the paper check, when there is one, is the job's one answer. While
        // the video is still being read the email waits on the job, beside the ending, and is queued once it is read.
        const eventId = websiteJobWindowEndedEventId(first ? undefined : windowEndedAt);
        const paper = await paperAnswerForEnding(requestId);
        if (paper.wait) waiting = waitingAnswerNoticeFields({ requestId, milestone: "scene_outcome", eventId, jobWindowEnded: true },
          new Date(nowMs).toISOString(), record);
        else {
          const message = buildTaskLifecycleNotification({ requestId, milestone: "scene_outcome", to, eventId, jobWindowEnded: true,
            ...(paper.answer ? { siteAnswer: paper.answer } : {}),
            workspaceUrl: typeof record!.account_owner_uid === "string" && record!.account_owner_uid
              ? workspaceTaskUrl(requestId) : null });
          if (message.idempotencyKey !== outboxRef.id) throw new Error("website_job_window_ended_notice_key_mismatch");
          entry = buildOutboxEntry(message);
        }
        notice = "queued";
      } else {
        notice = "none_no_contact_on_file";
        logger.warn({ requestId }, "A job's window ended with no usable contact address; the job page still says so");
      }
    }
    transaction.update(jobRef, { ...waiting, [WEBSITE_JOB_WINDOW_ENDING_FIELD]: sealWebsiteJobWindowEnding({ request_id: requestId,
      authority_digest: grant.authority_digest, window_ended_at_epoch: windowEndedAt,
      recorded_at_iso: new Date(nowMs).toISOString(), notice }) });
    if (entry) transaction.create(outboxRef, entry);
    return entry || Object.keys(waiting).length ? "ended_notice_queued" : "ended_no_notice";
  });
}

/** Why the sweep leaves a job with no grant as it is, or what it did. */
export type JobNoGrantSweepResult =
  /** The job has a grant (the window sweep's), or is not there. */
  | "has_grant"
  /** Not a website job (`isWebsiteJobRecord`): nothing is ever written for it. */
  | "not_a_job"
  /** The no-grant ending is already recorded. */
  | "ending_recorded"
  | "withdrawn"
  | "owner_closed"
  | "result_recorded"
  | "outcome_told"
  /** The site was told its job stays on file until Blueprint can evaluate its kind (`taskScopeNotYet`). */
  | "kept_on_file"
  /** The pass saw this wait for the first time (or the wait moved from the site to Blueprint): its clock starts now. */
  | "clock_started"
  /** The clock has not run as long as a grant's window would. */
  | "waiting"
  /** The new-video ask for a video too large to process was recorded, emailed or cleared; the job waits on. */
  | "video_ask_updated"
  | "contact_unreadable"
  | "changed"
  | "ended_notice_queued"
  | "ended_no_notice";

/** Task-scope reasons whose next step is the site's own (`taskScopeNotYet`); any other kind is kept on file. */
const SITE_STEP_SCOPE_REASONS = new Set(["multi_step", "unclear"]);

/**
 * What makes a request a website job for this sweep, from the record: a site operator's request
 * (`request.buyerType`) that was given a capture link, by the same rule the intake uses to issue one
 * (`siteCaptureUrl`: an approved capture region, or the site's current description authority). The
 * other half is its task brief (`siteTaskBriefs/{requestId}`), read by `noGrantJobBrief`.
 */
function isWebsiteJobRecord(record: Record<string, any>): boolean {
  return record.request?.buyerType === "site_operator" && (isApprovedCaptureRegion(record.request?.capture_region)
    || hasCurrentDescriptionAuthority(record.request?.description_authority));
}

/** The job's task brief, or null when it has none: a request with no brief is not a website job. */
async function noGrantJobBrief(requestId: string): Promise<Record<string, any> | null> {
  const brief = await db!.collection(TASK_BRIEFS_COLLECTION).doc(requestId).get();
  return brief.exists ? brief.data() ?? {} : null;
}

/** An ISO string, a number of milliseconds, or a Firestore timestamp, as epoch seconds; null when unreadable. */
function storedEpoch(value: unknown): number | null {
  const ms = typeof value === "string" ? Date.parse(value) : typeof value === "number" ? value
    : typeof (value as { toMillis?: unknown })?.toMillis === "function" ? (value as { toMillis: () => number }).toMillis()
    : typeof (value as { seconds?: unknown })?.seconds === "number" ? (value as { seconds: number }).seconds * 1000
    : typeof (value as { _seconds?: unknown })?._seconds === "number" ? (value as { _seconds: number })._seconds * 1000 : NaN;
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : null;
}

/**
 * When the site last did something on the job, from the job's own stored times: its creation, then
 * any later brief confirmation, save to an account, or recording received (the durable
 * `video_received` notice). Null when the creation time cannot be read: the job is then taken as old.
 */
async function latestSiteActivityEpoch(requestId: string, record: Record<string, any>): Promise<number | null> {
  const created = storedEpoch(record.createdAt);
  if (created === null) return null;
  const received = (await db!.collection(CAPTURE_OUTBOX_COLLECTION).doc(`${requestId}:video_received`).get()).data()?.createdAtIso;
  return Math.max(created, ...[record.site_task_brief_confirmed_at, record.claimed_at_iso, received]
    .map(storedEpoch).filter((epoch): epoch is number => epoch !== null));
}

/** What the job record alone settles for a job with no grant, cheapest first. */
function noGrantSkip(record: Record<string, any> | undefined, requestId: string): JobNoGrantSweepResult | null {
  if (!record || record.website_scene_sponsorship) return "has_grant";
  if (!isWebsiteJobRecord(record)) return "not_a_job";
  if (recordedWebsiteJobNoGrantEnding(record, requestId)) return "ending_recorded";
  if (record.capture_withdrawal || projectWebsiteCaptureRights(record).consent_revoked) return "withdrawn";
  if (websiteRunClosure(record, requestId, siteWalkthroughIdentity(requestId, record).captureId)) return "owner_closed";
  if (websiteJobKeptOnFile(record)) return "kept_on_file";
  return null;
}

/**
 * A job of a kind we can't simulate yet, with no grant: kept on file, a recorded ending (review, 2026-11-11). Its one
 * email is the "can't simulate this kind of job yet" one, queued where the job's scope is recorded.
 */
export function websiteJobKeptOnFile(record: Record<string, any> | undefined): boolean {
  const scope = record?.site_task_scope;
  return Boolean(record && !record.website_scene_sponsorship && scope?.supported === false
    && !SITE_STEP_SCOPE_REASONS.has(String(scope.reason ?? "")));
}

/**
 * Whose step the job waits on, read as the job pages read it: the site's until a finished recording
 * is saved, or while the job is held for a step only the site can take; Blueprint's after that.
 * Throws when the recording's status cannot be read, so no job is ended on a guess.
 */
async function noGrantWaitingOn(requestId: string, record: Record<string, any>,
  brief: Record<string, any>): Promise<WebsiteJobNoGrantWait> {
  if (record.site_task_scope?.supported === false) return "site";
  if (multiStepTaskHold(brief as never)) return "site";
  const walkthrough = await savedWalkthrough(siteWalkthroughIdentity(requestId, record));
  if (!walkthrough) throw new Error("website_job_no_grant_recording_status_unavailable");
  return walkthrough.received ? "blueprint" : "site";
}

const sameClock = (a: WebsiteJobNoGrantClock | null, b: WebsiteJobNoGrantClock | null) => JSON.stringify(a) === JSON.stringify(b);
/** When the ops monitor pages a wait on Blueprint: the existing stuck bound, and never later than half the window. */
const noGrantPageDueMs = (clock: WebsiteJobNoGrantClock) =>
  clock.since_epoch * 1000 + Math.min(stuckAlertMs(), clock.window_seconds * 500);

/**
 * Keeps the clock of one job that never received a grant, and ends the job once the clock has run as
 * long as a grant's window would. `observed` is the job record when the caller has just read it.
 *
 * A job whose active capture's video was too large for frame extraction (`websiteLargeVideoBlock.ts`)
 * gets no hand-off, so no grant will come for that video. The pass records the new-video ask for it
 * (`WEBSITE_LARGE_VIDEO_ASK_FIELD`), which the job page shows, queues its one email, and counts the
 * wait as the site's: the site's own clock bounds it, with no page. A replacement recording that
 * becomes active is another capture, so the ask stops speaking for the job and the wait is Blueprint's
 * again, from the replacement.
 */
export async function sweepWebsiteJobNoGrant(requestId: string, nowMs = Date.now(),
  observed?: Record<string, any>): Promise<JobNoGrantSweepResult> {
  if (!db) throw new Error("website_job_window_sweep_store_unavailable");
  const store = db;
  const nowEpoch = Math.floor(nowMs / 1000);
  const jobRef = store.collection(JOBS).doc(requestId);
  observed ??= (await jobRef.get()).data();
  const early = noGrantSkip(observed, requestId);
  // Kept on file is a recorded ending (review, 2026-11-11): the pass that marks it queues its one paper-slot email,
  // idempotently, with the reader's reason. A "can't simulate this kind of job yet" email already sent fills the slot.
  if (early === "kept_on_file") {
    const { notifyIfAnswerSettled } = await import("./taskLifecycleNotifications");
    await notifyIfAnswerSettled(requestId).catch(error => logger.warn({ error, requestId }, "Could not queue the kept-on-file email"));
  }
  if (early) return early;
  const brief = await noGrantJobBrief(requestId);
  if (!brief) return "not_a_job";
  const outcome = await storedOutcome(requestId, observed!);
  if (outcome) return outcome as JobNoGrantSweepResult;
  const identity = siteWalkthroughIdentity(requestId, observed!);
  const recordingWait = await noGrantWaitingOn(requestId, observed!, brief);
  // Only a saved recording can be too large; an unreadable marker leaves the ordinary path.
  const block = recordingWait === "blueprint" ? await largeVideoIngestBlock(identity) : null;
  const ask = block ? newWebsiteLargeVideoAsk({ request_id: requestId, capture_id: identity.captureId,
    raw_video_object: block.raw_video_object, raw_video_size_bytes: block.raw_video_size_bytes,
    recorded_at_iso: new Date(nowMs).toISOString() }) : null;
  const waitingOn: WebsiteJobNoGrantWait = ask ? "site" : recordingWait;
  const recordedAsk = websiteLargeVideoAsk(observed, requestId, identity.captureId);
  const staleAsk = Boolean(observed![WEBSITE_LARGE_VIDEO_ASK_FIELD]) && (!ask || recordedAsk?.ask_digest !== ask.ask_digest);
  const askRef = ask ? store.collection(CAPTURE_OUTBOX_COLLECTION).doc(websiteLargeVideoAskNoticeKey(requestId, ask)) : null;
  const askEmailOwed = Boolean(askRef) && !(await askRef!.get()).exists;
  const observedClock = websiteJobNoGrantClock(observed, requestId);
  // A replacement recording is new site activity: the wait restarts from it, like a change of whose step it is.
  const restart = !observedClock || observedClock.waiting_on !== waitingOn
    || (observedClock.capture_id !== undefined && observedClock.capture_id !== identity.captureId);
  const askWrite = Boolean(ask && recordedAsk?.ask_digest !== ask.ask_digest) || staleAsk || askEmailOwed;
  if (!askWrite && !restart && observedClock!.since_epoch + observedClock!.window_seconds > nowEpoch) return "waiting";
  // No backfill. The first time the sweep sees a job, a job that had already waited a whole window
  // since its latest site activity would have ended before this change: it is ended now, with no
  // email and no page. A job whose stored times cannot be read is taken as old, never as new.
  const windowSeconds = websiteJobWindowSeconds();
  const latestActivity = observedClock ? undefined : await latestSiteActivityEpoch(requestId, observed!);
  const backfill: WebsiteJobNoGrantEndingNotice | null = latestActivity === undefined ? null
    : latestActivity === null ? "none_age_unknown"
    : nowEpoch - latestActivity >= windowSeconds ? "none_waited_before_this_change" : null;
  const reason = ask ? { reason: "video_over_ingest_limit" as const } : {};
  const noticeRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(websiteJobNoGrantEndedNoticeKey(requestId));
  return store.runTransaction<JobNoGrantSweepResult>(async transaction => {
    // Every read comes before the writes; a grant, withdrawal or closure that landed since still counts.
    const record = (await transaction.get(jobRef)).data();
    const skip = noGrantSkip(record, requestId);
    if (skip) return skip;
    // The marker was read for one capture: a replacement that became active since is another video.
    if (siteWalkthroughIdentity(requestId, record!).captureId !== identity.captureId) return "changed";
    if (!sameClock(websiteJobNoGrantClock(record, requestId), observedClock)) return "changed";
    if (JSON.stringify(record![WEBSITE_LARGE_VIDEO_ASK_FIELD] ?? null) !== JSON.stringify(observed![WEBSITE_LARGE_VIDEO_ASK_FIELD] ?? null))
      return "changed";
    if (backfill) {
      transaction.update(jobRef, { [WEBSITE_JOB_NO_GRANT_ENDING_FIELD]: sealWebsiteJobNoGrantEnding({ request_id: requestId,
        waiting_on: waitingOn, ...reason, waiting_since_epoch: latestActivity ?? nowEpoch, ended_at_epoch: nowEpoch,
        recorded_at_iso: new Date(nowMs).toISOString(), notice: backfill }), [WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD]: null });
      return "ended_no_notice";
    }
    // The ask, its one email and its clearing. The email is keyed by the capture and blocked video, so a
    // later pass, a retry or a second sweep queues nothing more; an unreadable address is tried next pass.
    const updates: Record<string, any> = {};
    let askEntry: ReturnType<typeof buildOutboxEntry> | null = null;
    if (ask) {
      const kept: WebsiteLargeVideoAsk = recordedAsk?.ask_digest === ask.ask_digest ? recordedAsk : ask;
      if (kept !== recordedAsk) updates[WEBSITE_LARGE_VIDEO_ASK_FIELD] = kept;
      if (!(await transaction.get(askRef!)).exists) {
        let to = "";
        try { to = String(await decryptFieldValue(record!.contact?.email ?? "")).trim(); }
        catch { logger.warn({ requestId }, "Could not read the contact address for a new-video ask; the next pass tries again"); }
        if (EMAIL.test(to)) {
          const message = buildTaskLifecycleNotification({ requestId, milestone: "video_too_large", to,
            eventId: websiteLargeVideoAskEventId(kept) });
          if (message.idempotencyKey !== askRef!.id) throw new Error("website_large_video_ask_notice_key_mismatch");
          askEntry = buildOutboxEntry(message);
        }
      }
    } else if (staleAsk) updates[WEBSITE_LARGE_VIDEO_ASK_FIELD] = null;
    const commit = (result: JobNoGrantSweepResult) => {
      if (Object.keys(updates).length) transaction.update(jobRef, updates);
      if (askEntry) transaction.create(askRef!, askEntry);
      return result;
    };
    if (restart) {
      const clock = newWebsiteJobNoGrantClock({ request_id: requestId, waiting_on: waitingOn, since_epoch: nowEpoch,
        window_seconds: windowSeconds, capture_id: identity.captureId });
      updates[WEBSITE_JOB_NO_GRANT_CLOCK_FIELD] = clock;
      updates[WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD] = waitingOn === "blueprint" ? noGrantPageDueMs(clock) : null;
      return commit("clock_started");
    }
    const clock = observedClock!;
    if (clock.since_epoch + clock.window_seconds > nowEpoch) return commit("video_ask_updated");
    // The key is fixed by the job: an email already in the outbox, in any state, is never queued again.
    const already = (await transaction.get(noticeRef)).exists;
    let entry: ReturnType<typeof buildOutboxEntry> | null = null;
    let waiting: Record<string, unknown> = {};
    let notice: WebsiteJobNoGrantEndingNotice = "queued";
    if (!already) {
      let to: string;
      try { to = String(await decryptFieldValue(record!.contact?.email ?? "")).trim(); }
      catch {
        if (nowEpoch - (clock.since_epoch + clock.window_seconds) < CONTACT_READ_GRACE_SECONDS) return "contact_unreadable";
        to = "";
      }
      if (EMAIL.test(to)) {
        // No simulation was ever built: the paper check, when there is one, is the job's one answer (for another kind
        // of job, the reader's reason). While the video is still being read the email waits on the job.
        const paper = await paperAnswerForEnding(requestId);
        const ending = { requestId, milestone: "scene_outcome" as const, eventId: WEBSITE_JOB_NO_GRANT_ENDED_EVENT_ID,
          jobNoGrantEnded: clock.waiting_on, ...(ask ? { jobNoGrantReason: "video_over_ingest_limit" as const } : {}) };
        if (paper.wait) waiting = waitingAnswerNoticeFields(ending, new Date(nowMs).toISOString(), record);
        else {
          const message = buildTaskLifecycleNotification({ ...ending, to, ...(paper.answer ? { siteAnswer: paper.answer } : {}),
            workspaceUrl: typeof record!.account_owner_uid === "string" && record!.account_owner_uid
              ? workspaceTaskUrl(requestId) : null });
          if (message.idempotencyKey !== noticeRef.id) throw new Error("website_job_no_grant_ended_notice_key_mismatch");
          entry = buildOutboxEntry(message);
        }
      } else {
        notice = "none_no_contact_on_file";
        logger.warn({ requestId }, "A job with no grant ended with no usable contact address; the job page still says so");
      }
    }
    // The ending supersedes an unsent ask email: its own email says where the job stands.
    askEntry = null;
    transaction.update(jobRef, { ...updates, ...waiting, [WEBSITE_JOB_NO_GRANT_ENDING_FIELD]: sealWebsiteJobNoGrantEnding({ request_id: requestId,
      waiting_on: clock.waiting_on, ...reason, waiting_since_epoch: clock.since_epoch, ended_at_epoch: nowEpoch,
      recorded_at_iso: new Date(nowMs).toISOString(), notice }), [WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD]: null });
    if (entry) transaction.create(noticeRef, entry);
    return entry || Object.keys(waiting).length ? "ended_notice_queued" : "ended_no_notice";
  });
}

/**
 * Whether a queued new-video ask email still says what the job page says, read again at dispatch: the
 * job has no grant and no ending, and its recorded ask names the active capture and this exact email.
 */
export async function largeVideoAskShown(requestId: string, idempotencyKey: string,
  record: Record<string, any> | undefined): Promise<boolean> {
  if (!record || record.website_scene_sponsorship || record.capture_withdrawal
    || recordedWebsiteJobNoGrantEnding(record, requestId)) return false;
  const captureId = siteWalkthroughIdentity(requestId, record).captureId;
  if (websiteRunClosure(record, requestId, captureId)) return false;
  const ask = websiteLargeVideoAsk(record, requestId, captureId);
  return Boolean(ask) && websiteLargeVideoAskNoticeKey(requestId, ask!) === idempotencyKey;
}

export type JobWindowSweepSummary = { examined: number; ended: number; noticesQueued: number; failed: number };

/**
 * One pass: a few granted jobs, in turn, then a few site jobs with no grant. The durable rotating cursor (`automationBatch`) is the
 * same one the other reconcilers use, so a job that cannot be read never starves the rest, and
 * every granted job is looked at again each rotation. One equality filter ordered by document
 * id, which the automatic single-field index serves: no composite index.
 */
export async function sweepWebsiteJobWindows(options: { limit?: number; now?: () => number } = {}): Promise<JobWindowSweepSummary> {
  const summary: JobWindowSweepSummary = { examined: 0, ended: 0, noticesQueued: 0, failed: 0 };
  if (!db) return summary;
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_BATCH, 100));
  const query = db.collection(JOBS).where("website_scene_sponsorship.schema_version", "==", GRANT_SCHEMA);
  let rows = await automationBatch(db, query, CURSOR, limit);
  if (!rows.docs.length) rows = await automationBatch(db, query, CURSOR, limit);
  for (const row of rows.docs) {
    summary.examined += 1;
    try {
      const result = await sweepWebsiteJobWindow(row.id, (options.now ?? Date.now)(), row.data());
      if (result === "ended_notice_queued" || result === "ended_no_notice") {
        summary.ended += 1;
        if (result === "ended_notice_queued") summary.noticesQueued += 1;
        logger.info({ requestId: row.id, result }, "A job's window ended with no outcome; the job was ended");
      }
    } catch (error) {
      summary.failed += 1;
      logger.warn({ err: error, requestId: row.id }, "A job's window could not be checked; the next rotation reads it again");
    }
  }
  // The same pass, over the site jobs that have no grant: its own rotating cursor over one plaintext
  // equality filter (automatic index). A job with a grant is the turn above's and is not counted here.
  const sites = db.collection(JOBS).where("request.buyerType", "==", "site_operator");
  let waiting = await automationBatch(db, sites, NO_GRANT_CURSOR, limit);
  if (!waiting.docs.length) waiting = await automationBatch(db, sites, NO_GRANT_CURSOR, limit);
  for (const row of waiting.docs) {
    if (row.data()?.website_scene_sponsorship) continue;
    summary.examined += 1;
    try {
      const result = await sweepWebsiteJobNoGrant(row.id, (options.now ?? Date.now)(), row.data());
      if (result === "ended_notice_queued" || result === "ended_no_notice") {
        summary.ended += 1;
        if (result === "ended_notice_queued") summary.noticesQueued += 1;
        logger.info({ requestId: row.id, result }, "A job that never received a grant waited as long as a window lasts; the job was ended");
      }
    } catch (error) {
      summary.failed += 1;
      logger.warn({ err: error, requestId: row.id }, "A job with no grant could not be checked; the next rotation reads it again");
    }
  }
  return summary;
}

/**
 * Whether the ending on a job record stands: recorded for the current grant, with the window
 * still past. Unlike the job page's reader it throws when an extension cannot be read, so a
 * passing store failure never decides whether an email is sent.
 */
async function endingStands(record: Record<string, any>, nowEpoch = Date.now() / 1000): Promise<boolean> {
  return Boolean(recordedWebsiteJobWindowEnding(record)) && await windowEnd(record, plainReader) <= nowEpoch;
}

/** Whether the job's ending is on record for its current grant and still stands (its window is still past). */
export async function websiteJobWindowEndingRecorded(requestId: string): Promise<boolean> {
  if (!db) throw new Error("website_job_window_sweep_store_unavailable");
  const record = (await db.collection(JOBS).doc(requestId).get()).data();
  return Boolean(record) && await endingStands(record!);
}

/** Whether an outbox key is one of a job's window-ended emails. */
export const isWebsiteJobWindowEndedNotice = isWebsiteJobWindowEndedNoticeKey;

/**
 * Whether a queued window-ended email still says what the job page says, read again at
 * dispatch: the ending stands for the current grant, no withdrawal or closure came since, no
 * result outranks it, and no other outcome email (an earlier window-ended one included) has
 * told the site where its job stands. Throws when it cannot be read, which leaves the claim
 * recoverable rather than cancelling or sending it.
 */
export async function websiteJobWindowEndingShown(requestId: string, idempotencyKey: string): Promise<boolean> {
  if (!db) return false;
  const record = (await db.collection(JOBS).doc(requestId).get()).data();
  if (!record || record.capture_withdrawal || projectWebsiteCaptureRights(record).consent_revoked) return false;
  if (!(await endingStands(record))) return false;
  const captureId = siteWalkthroughIdentity(requestId, record).captureId;
  if (websiteRunClosure(record, requestId, captureId)) return false;
  const [{ readWebsiteSceneProgression }, { loadSceneScreening }] = await Promise.all([
    import("./websiteSceneProgression"), import("./agentEvalRuns")]);
  if (resultOutranksWindowEnding({ screening: await loadSceneScreening(requestId),
    sceneProgression: await readWebsiteSceneProgression(requestId, captureId) })) return false;
  const told = await db.collection(CAPTURE_OUTBOX_COLLECTION).where("requestId", "==", requestId).get();
  return !told.docs.some(row => row.id !== idempotencyKey
    && ["evaluation_outcome", "scene_outcome"].includes(String(row.data()?.kind ?? ""))
    && WENT_OUT.has(String(row.data()?.status ?? "")));
}

/** Whether an outbox key is a job's no-grant ending email. */
export const isWebsiteJobNoGrantEndedNotice = isWebsiteJobNoGrantEndedNoticeKey;

/**
 * Whether a queued no-grant ending email still says what the job page says, read again at dispatch:
 * the job still has no grant and its no-grant ending stands, no withdrawal or closure came since, no
 * result outranks it, and no other outcome email has told the site where its job stands. Throws when
 * it cannot be read, which leaves the claim recoverable rather than cancelling or sending it.
 */
export async function websiteJobNoGrantEndingShown(requestId: string, idempotencyKey: string): Promise<boolean> {
  if (!db) return false;
  const record = (await db.collection(JOBS).doc(requestId).get()).data();
  if (!record || record.capture_withdrawal || projectWebsiteCaptureRights(record).consent_revoked) return false;
  if (!recordedWebsiteJobNoGrantEnding(record, requestId)) return false;
  const captureId = siteWalkthroughIdentity(requestId, record).captureId;
  if (websiteRunClosure(record, requestId, captureId)) return false;
  const [{ readWebsiteSceneProgression }, { loadSceneScreening }] = await Promise.all([
    import("./websiteSceneProgression"), import("./agentEvalRuns")]);
  if (resultOutranksWindowEnding({ screening: await loadSceneScreening(requestId),
    sceneProgression: await readWebsiteSceneProgression(requestId, captureId) })) return false;
  const told = await db.collection(CAPTURE_OUTBOX_COLLECTION).where("requestId", "==", requestId).get();
  return !told.docs.some(row => row.id !== idempotencyKey
    && ["evaluation_outcome", "scene_outcome"].includes(String(row.data()?.kind ?? ""))
    && WENT_OUT.has(String(row.data()?.status ?? "")));
}

/**
 * Runs in the worker in every mode, launch-forward-only included, under its own leader lease,
 * so two processes never run a pass at once. The write is safe without the lease too: it is
 * one transaction, and the email's document id is fixed by the job.
 */
export function startWebsiteJobWindowSweepWorker(options: { intervalMs?: number; lease?: AutomationLeaderLease } = {}) {
  // A pull request preview shares the production store and must never end a customer's job.
  if (process.env.IS_PULL_REQUEST?.trim().toLowerCase() === "true") return () => undefined;
  const lease = options.lease ?? createAutomationLeaderLease({ leaseName: "website-job-window-sweep-leader" });
  lease.start();
  let stopped = false, running = false, timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (stopped) return;
    if (!running && lease.isLeader()) {
      running = true;
      try { await sweepWebsiteJobWindows(); }
      catch (error) { logger.error({ err: error }, "Website job window sweep pass failed; it will retry"); }
      finally { running = false; }
    }
    if (!stopped) { timer = setTimeout(run, options.intervalMs ?? 60_000); timer.unref?.(); }
  };
  timer = setTimeout(run, 15_000); timer.unref?.();
  return () => { stopped = true; if (timer) clearTimeout(timer); void lease.stop(); };
}
