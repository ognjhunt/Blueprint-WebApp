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
 *   the job pages show. No email goes with it (owner, 2026-11-19): the job page
 *   states the ending.
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
 * what was needed. A job the site sent with its description only, saying what the job is, waits on
 * nobody: it is complete without a video and gets no clock (`descriptionOnlyJobComplete`). A job waiting on Blueprint (the site did its part, no grant came) ends held, and
 * the ops monitor pages before that (`scanWebsiteJobsWaitingOnGrant`). A job whose grant arrives later is the
 * window sweep's again.
 */
import { LIVE_RUN_GRACE_SECONDS } from "./jobOutlook";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { createAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { notifySiteActionNeeded } from "./siteActionNeeded";
import { sponsorshipExecutionWindowUntil, sponsorshipWindowIntake } from "./sceneExecutionWindowExtension";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { earlyTaskHoldOf } from "./taskPreparationOutcome";
import { resultOutranksWindowEnding } from "./taskStatusProjection";
import { retainedTrialResultOutranksEnding } from "./websiteJobWindowRetainedTrial";
import { selectWebsiteAtlasPreview } from "./websiteAtlasPreview";
import { recordedWebsiteJobWindowEnding, sealWebsiteJobWindowEnding, WEBSITE_JOB_WINDOW_ENDING_FIELD } from "./websiteJobWindowEnding";
import { websiteRunClosure } from "./websiteRunClosure";
import { sponsorshipValidUntil, websiteJobWindowSeconds } from "./websiteSceneSponsorship";
import { TASK_BRIEFS_COLLECTION } from "./siteTaskBrief";
import { taskBriefUnclear } from "./siteTaskScope";
import { savedWalkthrough } from "./siteWalkthrough";
import { stuckAlertMs } from "./websitePreparationWatch";
import { isApprovedCaptureRegion } from "../../client/src/data/captureResidency";
import { hasCurrentDescriptionAuthority } from "./descriptionAuthority";
import { descriptionOnlyJobComplete, newWebsiteJobNoGrantClock, recordedWebsiteJobNoGrantEnding,
  sealWebsiteJobNoGrantEnding, websiteJobNoGrantClock, WEBSITE_JOB_NO_GRANT_CLOCK_FIELD,
  WEBSITE_JOB_NO_GRANT_ENDING_FIELD, WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD,
  type WebsiteJobNoGrantClock, type WebsiteJobNoGrantEndingNotice, type WebsiteJobNoGrantWait } from "./websiteJobWindowEnding";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { largeVideoIngestBlock } from "./websiteLargeVideoBlock";
import { newWebsiteLargeVideoAsk, websiteLargeVideoAsk, WEBSITE_LARGE_VIDEO_ASK_FIELD, type WebsiteLargeVideoAsk } from "./websiteJobWindowEnding";

const JOBS = "inboundRequests";
const SESSIONS = "captureUploadSessions";
const CURSOR = "website_job_window_sweep";
const NO_GRANT_CURSOR = "website_job_no_grant_sweep";
const GRANT_SCHEMA = "website_scene_sponsorship.v1";
const DEFAULT_BATCH = 25;

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
  /** A hold or an ending the job page states is on record. */
  | "outcome_told"
  /** The job changed between the read and the write; the next pass reads it again. */
  | "changed";
export type JobWindowSweepResult = JobWindowSweepSkip | "ended_no_notice";

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
 * end. An extension that reopened the window and has since passed is a new ending, recorded below.
 */
function recordedForWindow(record: Record<string, any> | undefined, windowEndedAt: number): boolean {
  return recordedWebsiteJobWindowEnding(record)?.window_ended_at_epoch === windowEndedAt;
}

/**
 * An outcome already on record for the job, read from stored data only (the Pipeline may be
 * unreachable, which is when this sweep matters most). Throws when it cannot be read, so the
 * job is left for the next pass rather than ended on a guess.
 */
async function storedOutcome(requestId: string, record: Record<string, any>, pastLiveGrace = false): Promise<JobWindowSweepSkip | null> {
  const captureId = siteWalkthroughIdentity(requestId, record).captureId;
  const [{ readWebsiteSceneProgression }, { loadSceneScreening }] = await Promise.all([
    import("./websiteSceneProgression"), import("./sceneScreening")]);
  const sceneProgression = await readWebsiteSceneProgression(requestId, captureId);
  const screening = await loadSceneScreening(requestId);
  if (resultOutranksWindowEnding({ screening, sceneProgression }, { pastLiveGrace })) return "result_recorded";
  // Protects old jobs from a late ending; not a status (`websiteJobWindowRetainedTrial`).
  if (await retainedTrialResultOutranksEnding(requestId, captureId)) return "result_recorded";
  // The Pipeline's own terminal outcome for the scene (C-04) is on the job page.
  if (sceneProgression?.sceneOutcome?.terminal) return "outcome_told";
  const status = (await db!.collection(SESSIONS).doc(captureId).get()).data()?.website_preparation?.status;
  // Preparation that ended for good is on the job page with its reason.
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
  // Past the window plus the grace the Pipeline takes to stop a run, a run record that still says running is stale.
  const ended = await windowEnd(observed!, plainReader).catch(() => NaN);
  const outcome = await storedOutcome(requestId, observed!,
    Number.isFinite(ended) && nowEpoch > ended + LIVE_RUN_GRACE_SECONDS);
  if (outcome) return outcome;
  const observedGrant = observed!.website_scene_sponsorship.authority_digest;
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
    // No email: the job page states the ending (owner, 2026-11-19).
    transaction.update(jobRef, { [WEBSITE_JOB_WINDOW_ENDING_FIELD]: sealWebsiteJobWindowEnding({ request_id: requestId,
      authority_digest: grant.authority_digest, window_ended_at_epoch: windowEndedAt,
      recorded_at_iso: new Date(nowMs).toISOString(), notice: "none_emails_retired" }) });
    return "ended_no_notice";
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
  /**
   * The site sent the job with its description only and said what the job is: the job is complete without a video,
   * listed for companies, and waits on nobody (`descriptionOnlyJobComplete`). No clock, no ending.
   */
  | "description_only"
  | "withdrawn"
  | "owner_closed"
  | "result_recorded"
  | "outcome_told"
  /** The pass saw this wait for the first time (or the wait moved from the site to Blueprint): its clock starts now. */
  | "clock_started"
  /** The clock has not run as long as a grant's window would. */
  | "waiting"
  /** The new-video ask for a video too large to process was recorded or cleared; the job waits on. */
  | "video_ask_updated"
  | "changed"
  | "ended_no_notice";

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
 * `video_received` notice row, which jobs from before 2026-11-19 have). Null when the creation time cannot be read: the job is then taken as old.
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
  if (descriptionOnlyJobComplete(record)) return "description_only";
  if (recordedWebsiteJobNoGrantEnding(record, requestId)) return "ending_recorded";
  if (record.capture_withdrawal || projectWebsiteCaptureRights(record).consent_revoked) return "withdrawn";
  if (websiteRunClosure(record, requestId, siteWalkthroughIdentity(requestId, record).captureId)) return "owner_closed";
  return null;
}

/**
 * When an earlier release kept a job of a kind we did not score on file, with no grant (its answer email marked
 * owed). No job is kept on file now: every job with no grant waits on the no-grant clock, whatever its kind. Read
 * only so that such a job's wait starts at the pass that first sees it, never backfilled.
 */
export const KEPT_ON_FILE_OWED_FIELD = "kept_on_file_answer_owed_at_iso";

/**
 * Whose step the job waits on, read as the job pages read it: the site's until a finished recording
 * is saved, or while its brief gives no sentence about the job; Blueprint's after that.
 * Throws when the recording's status cannot be read, so no job is ended on a guess.
 */
async function noGrantWaitingOn(requestId: string, record: Record<string, any>): Promise<WebsiteJobNoGrantWait> {
  // A brief with no sentence about the job waits on the site's sentence; a job of any kind waits as any other.
  if (taskBriefUnclear(record.site_task_scope)) return "site";
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
 * (`WEBSITE_LARGE_VIDEO_ASK_FIELD`), which the job page shows, and counts the wait as the site's: the site's own clock bounds it, with no page. A replacement recording that
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
  if (early) return early;
  const brief = await noGrantJobBrief(requestId);
  if (!brief) return "not_a_job";
  const outcome = await storedOutcome(requestId, observed!);
  if (outcome) return outcome as JobNoGrantSweepResult;
  const identity = siteWalkthroughIdentity(requestId, observed!);
  const recordingWait = await noGrantWaitingOn(requestId, observed!);
  // Only a saved recording can be too large; an unreadable marker leaves the ordinary path.
  const block = recordingWait === "blueprint" ? await largeVideoIngestBlock(identity) : null;
  const ask = block ? newWebsiteLargeVideoAsk({ request_id: requestId, capture_id: identity.captureId,
    raw_video_object: block.raw_video_object, raw_video_size_bytes: block.raw_video_size_bytes,
    recorded_at_iso: new Date(nowMs).toISOString() }) : null;
  const waitingOn: WebsiteJobNoGrantWait = ask ? "site" : recordingWait;
  const recordedAsk = websiteLargeVideoAsk(observed, requestId, identity.captureId);
  const staleAsk = Boolean(observed![WEBSITE_LARGE_VIDEO_ASK_FIELD]) && (!ask || recordedAsk?.ask_digest !== ask.ask_digest);
  const observedClock = websiteJobNoGrantClock(observed, requestId);
  // A job of a kind we do not score that an earlier release kept on file had no clock running (or one frozen from
  // before it was kept on file), and so does one it would have kept on file but had not seen yet: its wait starts at
  // the pass that first sees it now, as a job of a kind we score started at its first sighting, and is never
  // backfilled. Once started, its clock postdates the kept-on-file mark.
  const keptOnFileAt = storedEpoch(observed![KEPT_ON_FILE_OWED_FIELD]);
  const newlyClocked = keptOnFileAt !== null ? !observedClock || observedClock.since_epoch < keptOnFileAt
    : !observedClock && observed!.site_task_scope?.supported === false;
  // A replacement recording is new site activity: the wait restarts from it, like a change of whose step it is.
  const restart = newlyClocked || !observedClock || observedClock.waiting_on !== waitingOn
    || (observedClock.capture_id !== undefined && observedClock.capture_id !== identity.captureId);
  const askWrite = Boolean(ask && recordedAsk?.ask_digest !== ask.ask_digest) || staleAsk;
  if (!askWrite && !restart && observedClock!.since_epoch + observedClock!.window_seconds > nowEpoch) return "waiting";
  // No backfill. The first time the sweep sees a job, a job that had already waited a whole window
  // since its latest site activity would have ended before this change: it is ended now, with no
  // email and no page. A job whose stored times cannot be read is taken as old, never as new.
  const windowSeconds = websiteJobWindowSeconds();
  const latestActivity = observedClock || newlyClocked ? undefined : await latestSiteActivityEpoch(requestId, observed!);
  const backfill: WebsiteJobNoGrantEndingNotice | null = latestActivity === undefined ? null
    : latestActivity === null ? "none_age_unknown"
    : nowEpoch - latestActivity >= windowSeconds ? "none_waited_before_this_change" : null;
  const reason = ask ? { reason: "video_over_ingest_limit" as const } : {};
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
    // The ask, which the job page shows, and its clearing. No email (owner, 2026-11-19).
    const updates: Record<string, any> = {};
    if (ask) {
      const kept: WebsiteLargeVideoAsk = recordedAsk?.ask_digest === ask.ask_digest ? recordedAsk : ask;
      if (kept !== recordedAsk) updates[WEBSITE_LARGE_VIDEO_ASK_FIELD] = kept;
    } else if (staleAsk) updates[WEBSITE_LARGE_VIDEO_ASK_FIELD] = null;
    const commit = (result: JobNoGrantSweepResult) => {
      if (Object.keys(updates).length) transaction.update(jobRef, updates);
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
    // No email: the job page states the ending (owner, 2026-11-19).
    transaction.update(jobRef, { ...updates, [WEBSITE_JOB_NO_GRANT_ENDING_FIELD]: sealWebsiteJobNoGrantEnding({ request_id: requestId,
      waiting_on: clock.waiting_on, ...reason, waiting_since_epoch: clock.since_epoch, ended_at_epoch: nowEpoch,
      recorded_at_iso: new Date(nowMs).toISOString(), notice: "none_emails_retired" }), [WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD]: null });
    return "ended_no_notice";
  });
}

export type JobWindowSweepSummary = { examined: number; ended: number; failed: number };

/**
 * One pass: a few granted jobs, in turn, then a few site jobs with no grant. The durable rotating cursor (`automationBatch`) is the
 * same one the other reconcilers use, so a job that cannot be read never starves the rest, and
 * every granted job is looked at again each rotation. One equality filter ordered by document
 * id, which the automatic single-field index serves: no composite index.
 */
export async function sweepWebsiteJobWindows(options: { limit?: number; now?: () => number } = {}): Promise<JobWindowSweepSummary> {
  const summary: JobWindowSweepSummary = { examined: 0, ended: 0, failed: 0 };
  if (!db) return summary;
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_BATCH, 100));
  const query = db.collection(JOBS).where("website_scene_sponsorship.schema_version", "==", GRANT_SCHEMA);
  let rows = await automationBatch(db, query, CURSOR, limit);
  if (!rows.docs.length) rows = await automationBatch(db, query, CURSOR, limit);
  for (const row of rows.docs) {
    summary.examined += 1;
    try {
      const result = await sweepWebsiteJobWindow(row.id, (options.now ?? Date.now)(), row.data());
      if (result === "ended_no_notice") {
        summary.ended += 1;
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
    // Whatever the clock says: a job that cannot continue without the site is told once per ask (`siteActionNeeded.ts`).
    await notifySiteActionNeeded(row.id, row.data())
      .catch(error => logger.warn({ err: error, requestId: row.id }, "Could not read a site job's ask; the next rotation tries again"));
    if (row.data()?.website_scene_sponsorship) continue;
    summary.examined += 1;
    try {
      const result = await sweepWebsiteJobNoGrant(row.id, (options.now ?? Date.now)(), row.data());
      if (result === "ended_no_notice") {
        summary.ended += 1;
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
