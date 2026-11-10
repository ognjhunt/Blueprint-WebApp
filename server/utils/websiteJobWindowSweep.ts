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
 *   outbox under a document id fixed by the job, so it can never be sent twice;
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
 * A job that never received a grant has no window, so this sweep does not end
 * it: there is no stored limit to read for it.
 */
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { createAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { decryptFieldValue } from "./field-encryption";
import { sponsorshipExecutionWindowUntil, sponsorshipWindowIntake } from "./sceneExecutionWindowExtension";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { buildTaskLifecycleNotification, workspaceTaskUrl } from "./taskLifecycleNotifications";
import { earlyTaskHoldOf } from "./taskPreparationOutcome";
import { resultOutranksWindowEnding } from "./taskStatusProjection";
import { selectWebsiteAtlasPreview } from "./websiteAtlasPreview";
import { recordedWebsiteJobWindowEnding, sealWebsiteJobWindowEnding, websiteJobWindowEndedNoticeKey,
  WEBSITE_JOB_WINDOW_ENDED_EVENT_ID, WEBSITE_JOB_WINDOW_ENDING_FIELD, WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH,
  type WebsiteJobWindowEndingNotice } from "./websiteJobWindowEnding";
import { websiteRunClosure } from "./websiteRunClosure";
import { sponsorshipValidUntil } from "./websiteSceneSponsorship";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

const JOBS = "inboundRequests";
const SESSIONS = "captureUploadSessions";
const CURSOR = "website_job_window_sweep";
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
const WENT_OUT = new Set(["dispatching", "unknown", "sent"]);

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
  if (recordedWebsiteJobWindowEnding(record)) return "ending_recorded";
  if (record!.capture_withdrawal || projectWebsiteCaptureRights(record).consent_revoked) return "withdrawn";
  if (websiteRunClosure(record, requestId, siteWalkthroughIdentity(requestId, record).captureId)) return "owner_closed";
  return null;
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
  const outcome = await storedOutcome(requestId, observed!);
  if (outcome) return outcome;
  const observedGrant = observed!.website_scene_sponsorship.authority_digest;
  const outboxRef = store.collection(CAPTURE_OUTBOX_COLLECTION).doc(websiteJobWindowEndedNoticeKey(requestId));
  return store.runTransaction<JobWindowSweepResult>(async transaction => {
    // Every read comes before the writes. The record is read again here, so a withdrawal, a
    // closure, a re-issued grant or an extension that landed since the first read still counts.
    const record = (await transaction.get(jobRef)).data();
    const skip = recordSkip(record, requestId, nowEpoch);
    if (skip) return skip;
    const grant = record!.website_scene_sponsorship;
    if (grant.authority_digest !== observedGrant) return "changed";
    const extendedUntil = record!.website_scene_sponsorship_execution_window
      ? sponsorshipExecutionWindowUntil(grant, record, await sponsorshipWindowIntake(transaction, record)) : undefined;
    const windowEndedAt = sponsorshipValidUntil(grant, extendedUntil);
    if (!(windowEndedAt <= nowEpoch)) return "window_open";
    // No backfill: only a window that ended at or after the cutover owes the site an email.
    const owed = windowEndedAt >= WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH;
    const alreadyQueued = owed && (await transaction.get(outboxRef)).exists;
    let notice: WebsiteJobWindowEndingNotice = "none_window_ended_before_cutover";
    let entry: ReturnType<typeof buildOutboxEntry> | null = null;
    if (alreadyQueued) notice = "queued";
    else if (owed) {
      let to: string;
      try { to = String(await decryptFieldValue(record!.contact?.email ?? "")).trim(); }
      catch {
        if (nowEpoch - windowEndedAt < CONTACT_READ_GRACE_SECONDS) return "contact_unreadable";
        to = "";
      }
      if (EMAIL.test(to)) {
        const message = buildTaskLifecycleNotification({ requestId, milestone: "scene_outcome", to,
          eventId: WEBSITE_JOB_WINDOW_ENDED_EVENT_ID, jobWindowEnded: true,
          workspaceUrl: typeof record!.account_owner_uid === "string" && record!.account_owner_uid
            ? workspaceTaskUrl(requestId) : null });
        if (message.idempotencyKey !== outboxRef.id) throw new Error("website_job_window_ended_notice_key_mismatch");
        entry = buildOutboxEntry(message);
        notice = "queued";
      } else {
        notice = "none_no_contact_on_file";
        logger.warn({ requestId }, "A job's window ended with no usable contact address; the job page still says so");
      }
    }
    transaction.update(jobRef, { [WEBSITE_JOB_WINDOW_ENDING_FIELD]: sealWebsiteJobWindowEnding({ request_id: requestId,
      authority_digest: grant.authority_digest, window_ended_at_epoch: windowEndedAt,
      recorded_at_iso: new Date(nowMs).toISOString(), notice }) });
    if (entry) transaction.create(outboxRef, entry);
    return entry ? "ended_notice_queued" : "ended_no_notice";
  });
}

export type JobWindowSweepSummary = { examined: number; ended: number; noticesQueued: number; failed: number };

/**
 * One pass: a few granted jobs, in turn. The durable rotating cursor (`automationBatch`) is the
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
  return summary;
}

/**
 * Whether the ending on a job record stands: recorded for the current grant, with the window
 * still past. Unlike the job page's reader it throws when an extension cannot be read, so a
 * passing store failure never decides whether an email is sent.
 */
async function endingStands(record: Record<string, any>, nowEpoch = Date.now() / 1000): Promise<boolean> {
  if (!recordedWebsiteJobWindowEnding(record)) return false;
  const grant = record.website_scene_sponsorship;
  const extendedUntil = record.website_scene_sponsorship_execution_window
    ? sponsorshipExecutionWindowUntil(grant, record, await sponsorshipWindowIntake({ get: (ref: any) => ref.get() }, record))
    : undefined;
  return sponsorshipValidUntil(grant, extendedUntil) <= nowEpoch;
}

/** Whether the job's ending is on record for its current grant and still stands (its window is still past). */
export async function websiteJobWindowEndingRecorded(requestId: string): Promise<boolean> {
  if (!db) throw new Error("website_job_window_sweep_store_unavailable");
  const record = (await db.collection(JOBS).doc(requestId).get()).data();
  return Boolean(record) && await endingStands(record!);
}

/** Whether an outbox key is a job's window-ended email. */
export const isWebsiteJobWindowEndedNotice = (requestId: string, idempotencyKey: string) =>
  idempotencyKey === websiteJobWindowEndedNoticeKey(requestId);

/**
 * Whether a queued window-ended email still says what the job page says, read again at
 * dispatch: the ending stands for the current grant, no withdrawal or closure came since, no
 * result outranks it, and no other outcome email has told the site where its job stands.
 * Throws when it cannot be read, which leaves the claim recoverable rather than cancelling
 * or sending it.
 */
export async function websiteJobWindowEndingShown(requestId: string): Promise<boolean> {
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
  return !told.docs.some(row => row.id !== websiteJobWindowEndedNoticeKey(requestId)
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
