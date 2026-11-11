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
 * Every job whose video has arrived has a deadline. With a grant it is the
 * grant's window, above. A site's job whose video arrived but which never
 * received a grant (the Pipeline was down, the handoff was lost, the grant was
 * refused) gets the same length of time, counted only while the site was
 * waiting on Blueprint: from the later of the video's arrival (its
 * `video_received` notice, or else the walkthrough upload session's own
 * finished-upload stamp) and the last moment the job stopped being held
 * (`websiteJobDeadlineWithoutGrant`). A job is held while something on record
 * speaks for it (every exclusion above) or while its own page, projected from
 * stored data only, asks the site to do something. A second pass in the same
 * tick visits these jobs, keeps a small hold marker on each
 * (`website_job_no_grant_hold`, written only when held starts or ends), never
 * ends a held job, and ends one that has waited the whole window the same way:
 * one stored ending (basis `video_received_no_grant`), one email under the
 * same key, never twice. Once that ending is recorded the first grant is
 * refused (`loadWebsiteSceneSponsorship`), so no work starts after the site
 * was told none will.
 *
 * A site's job with no video yet is never ended, at any age: nothing is running
 * for it and the site is not waiting on Blueprint. Its page already tells the
 * site its next step (confirm the brief, film, give consent), and ending it would
 * stop a site that simply has not filmed yet.
 */
import { z } from "zod";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { automationBatch } from "./automationBatch";
import { createAutomationLeaderLease, type AutomationLeaderLease } from "./automationLeaderLease";
import { buildOutboxEntry, CAPTURE_OUTBOX_COLLECTION } from "./captureOutbox";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { decryptFieldValue } from "./field-encryption";
import { isSiteJobRecord } from "./jobConsoleData";
import { sponsorshipExecutionWindowUntil, sponsorshipWindowIntake } from "./sceneExecutionWindowExtension";
import { getBrief } from "./siteTaskBrief";
import { multiStepTaskHold } from "./siteTaskScope";
import { footageArrivedBeforeAccount, siteWalkthroughIdentity } from "./siteWalkthrough";
import { buildTaskLifecycleNotification, workspaceTaskUrl } from "./taskLifecycleNotifications";
import { earlyTaskHoldOf, projectAtlasPreparationOutcome } from "./taskPreparationOutcome";
import { projectTaskStatus, resultOutranksWindowEnding, taskStatusInputFrom,
  type TaskPreparationStatus } from "./taskStatusProjection";
import { teamJobAccess } from "./teamJobAccess";
import { selectWebsiteAtlasPreview } from "./websiteAtlasPreview";
import { websiteJobDeadlineWithoutGrant } from "./websiteJobWindow";
import { isWebsiteJobWindowEndedNoticeKey, isWebsiteJobWindowEndingWithoutGrant, recordedWebsiteJobWindowEnding,
  recordedWebsiteJobWindowEndingWithoutGrant, sealWebsiteJobWindowEnding, sealWebsiteJobWindowEndingWithoutGrant,
  websiteJobWindowEndedEventId, websiteJobWindowEndedNoticeKey, WEBSITE_JOB_WINDOW_ENDING_FIELD,
  WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH, type WebsiteJobWindowEnding,
  type WebsiteJobWindowEndingNotice } from "./websiteJobWindowEnding";
import { websitePreparationOverdue } from "./websitePreparationWatch";
import { websiteRunClosure } from "./websiteRunClosure";
import { sponsorshipValidUntil, websiteJobWindowSeconds } from "./websiteSceneSponsorship";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

const JOBS = "inboundRequests";
const SESSIONS = "captureUploadSessions";
const CURSOR = "website_job_window_sweep";
/** The second pass's own rotating cursor: site jobs with no grant. */
const NO_GRANT_CURSOR = "website_job_window_sweep_no_grant";
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
  | "changed"
  /** Not a site's own website job (no site operator, or a workspace evaluation). */
  | "not_site_job"
  /** The job has a grant: the granted pass owns it. */
  | "granted"
  /** No video has arrived: nothing runs for the job, and the site is not waiting on Blueprint. */
  | "no_video"
  /** The job's own page asks the site to do something, so the site is not waiting on Blueprint. */
  | "site_step_pending";
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
type StoredReads = { sceneProgression?: Awaited<ReturnType<typeof import("./websiteSceneProgression").readWebsiteSceneProgression>>;
  screening?: Awaited<ReturnType<typeof import("./agentEvalRuns").loadSceneScreening>>; session?: Record<string, any> };
async function storedOutcome(requestId: string, record: Record<string, any>,
  seen: StoredReads = {}): Promise<JobWindowSweepSkip | null> {
  const captureId = siteWalkthroughIdentity(requestId, record).captureId;
  const [{ readWebsiteSceneProgression }, { loadSceneScreening }] = await Promise.all([
    import("./websiteSceneProgression"), import("./agentEvalRuns")]);
  const sceneProgression = seen.sceneProgression = await readWebsiteSceneProgression(requestId, captureId);
  const screening = seen.screening = await loadSceneScreening(requestId);
  if (resultOutranksWindowEnding({ screening, sceneProgression })) return "result_recorded";
  // The Pipeline's own terminal outcome for the scene (C-04) has its own one email.
  if (sceneProgression?.sceneOutcome?.terminal) return "outcome_told";
  seen.session = (await db!.collection(SESSIONS).doc(captureId).get()).data();
  const status = seen.session?.website_preparation?.status;
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
 * job record when the caller has just read it; the write reads it again in its transaction. A job
 * with no grant at all is read by its own rule (`sweepWebsiteJobWithoutGrant`).
 */
export async function sweepWebsiteJobWindow(requestId: string, nowMs = Date.now(),
  observed?: Record<string, any>): Promise<JobWindowSweepResult> {
  if (!db) throw new Error("website_job_window_sweep_store_unavailable");
  const store = db;
  const nowEpoch = nowMs / 1000;
  const jobRef = store.collection(JOBS).doc(requestId);
  observed ??= (await jobRef.get()).data();
  if (observed && (observed.website_scene_sponsorship === undefined || observed.website_scene_sponsorship === null))
    return sweepWebsiteJobWithoutGrant(requestId, nowMs, observed);
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
    return recordEnding({ transaction, jobRef, record: record!, requestId, windowEndedAt, nowMs, withoutGrant: false,
      seal: notice => sealWebsiteJobWindowEnding({ request_id: requestId, authority_digest: grant.authority_digest,
        window_ended_at_epoch: windowEndedAt, recorded_at_iso: new Date(nowMs).toISOString(), notice }) });
  });
}

/**
 * The ending's one write, in the caller's transaction after its own reads: the stored ending and,
 * when one is owed, the one email under the job's fixed key. The same for both bases; only the
 * sealed ending and the email's first sentence differ.
 */
async function recordEnding(input: { transaction: FirebaseFirestore.Transaction; jobRef: FirebaseFirestore.DocumentReference;
  record: Record<string, any>; requestId: string; windowEndedAt: number; nowMs: number; withoutGrant: boolean;
  seal: (notice: WebsiteJobWindowEndingNotice) => WebsiteJobWindowEnding }): Promise<JobWindowSweepResult> {
  const { transaction, jobRef, record, requestId, windowEndedAt } = input;
  const store = db!;
  const nowEpoch = input.nowMs / 1000;
  const firstKey = websiteJobWindowEndedNoticeKey(requestId);
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
  if (stillOwedByAnEarlierOne) notice = "queued";
  else if (owed && earlier.some(row => row.id === outboxRef.id)) notice = "none_cancelled_before_sending";
  else if (owed) {
    let to: string;
    try { to = String(await decryptFieldValue(record.contact?.email ?? "")).trim(); }
    catch {
      if (nowEpoch - windowEndedAt < CONTACT_READ_GRACE_SECONDS) return "contact_unreadable";
      to = "";
    }
    if (EMAIL.test(to)) {
      const message = buildTaskLifecycleNotification({ requestId, milestone: "scene_outcome", to,
        eventId: websiteJobWindowEndedEventId(first ? undefined : windowEndedAt), jobWindowEnded: true,
        ...(input.withoutGrant ? { jobWindowEndedWithoutGrant: true as const } : {}),
        workspaceUrl: typeof record.account_owner_uid === "string" && record.account_owner_uid
          ? workspaceTaskUrl(requestId) : null });
      if (message.idempotencyKey !== outboxRef.id) throw new Error("website_job_window_ended_notice_key_mismatch");
      entry = buildOutboxEntry(message);
      notice = "queued";
    } else {
      notice = "none_no_contact_on_file";
      logger.warn({ requestId }, "A job's window ended with no usable contact address; the job page still says so");
    }
  }
  transaction.update(jobRef, { [WEBSITE_JOB_WINDOW_ENDING_FIELD]: input.seal(notice) });
  if (entry) transaction.create(outboxRef, entry);
  return entry ? "ended_notice_queued" : "ended_no_notice";
}

/**
 * What the job record alone rules out for a job with no grant, cheapest first. A site's job only;
 * any grant, readable or not, belongs to the granted pass.
 */
function recordSkipWithoutGrant(record: Record<string, any> | undefined, requestId: string): JobWindowSweepSkip | null {
  if (!isSiteJobRecord(record)) return "not_site_job";
  if (record!.website_scene_sponsorship !== undefined && record!.website_scene_sponsorship !== null) return "granted";
  if (record!.capture_withdrawal || projectWebsiteCaptureRights(record).consent_revoked) return "withdrawn";
  if (websiteRunClosure(record, requestId, siteWalkthroughIdentity(requestId, record).captureId)) return "owner_closed";
  if (recordedWebsiteJobWindowEndingWithoutGrant(record, requestId)) return "ending_recorded";
  return null;
}

/**
 * The moment the job's footage first landed, as stored. The job's durable `video_received` notice
 * comes first: it is what the job page treats as "footage first landed", and the outbox is never
 * pruned. That notice is written only when a contact address is on file, rights allowed processing
 * and the enqueue succeeded, so without it the walkthrough upload session's own finished-upload
 * stamp is used: the browser upload's pending record (`browser_pending_delivery.completed_at_iso`,
 * kept), its stored-upload journal while that record is not yet written
 * (`browser_stored_upload.completed_at_iso`, the same instant), or an app bundle's
 * `site_capture_bundle.recorded_at_iso`. Never `website_preparation_watch.since_iso`, which moves
 * with every status. Null when there is none: no video. Throws when one exists but cannot be read,
 * so the job is left for the next pass.
 */
async function videoReceivedAtIso(requestId: string): Promise<string | null> {
  const row = await db!.collection(CAPTURE_OUTBOX_COLLECTION).doc(`${requestId}:video_received`).get();
  if (row.exists) {
    const iso = row.data()?.createdAtIso;
    if (typeof iso !== "string") throw new Error("website_job_video_received_unreadable");
    return iso;
  }
  const captureId = `walkthrough-${requestId}`;
  const session = (await db!.collection(SESSIONS).doc(captureId).get()).data();
  const stamps: Array<[unknown, unknown]> = [
    [session?.browser_pending_delivery, session?.browser_pending_delivery?.completed_at_iso],
    [session?.browser_stored_upload, session?.browser_stored_upload?.completed_at_iso],
    [session?.site_capture_bundle, session?.site_capture_bundle?.recorded_at_iso],
  ];
  for (const [owner, iso] of stamps) {
    if (owner === undefined || owner === null) continue;
    const bound = owner as Record<string, unknown>;
    if (bound.request_id !== requestId || bound.capture_id !== captureId || typeof iso !== "string"
      || !Number.isFinite(Date.parse(iso))) throw new Error("website_job_video_received_unreadable");
    return iso;
  }
  return null;
}

/**
 * The no-grant pass's hold marker on the job: whether the job was last seen held (something on
 * record spoke for it, or its page asked the site for a step) and, once released, when. The clock
 * of a job with no grant counts only from its last release (`websiteJobDeadlineWithoutGrant`).
 * Written only on a transition, so a job held for ever is written once.
 */
export const WEBSITE_JOB_NO_GRANT_HOLD_FIELD = "website_job_no_grant_hold";
const HOLD_SCHEMA = "website_job_no_grant_hold.v1";
const holdId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);
const holdSchema = z.discriminatedUnion("held", [
  z.object({ schema_version: z.literal(HOLD_SCHEMA), request_id: holdId, held: z.literal(true) }).strict(),
  z.object({ schema_version: z.literal(HOLD_SCHEMA), request_id: holdId, held: z.literal(false),
    released_at_iso: z.string().datetime() }).strict(),
]);
type NoGrantHold = z.infer<typeof holdSchema>;
/** The marker, null when none was ever written. Throws when one is there but does not read. */
function noGrantHold(record: Record<string, any>, requestId: string): NoGrantHold | null {
  const raw = record[WEBSITE_JOB_NO_GRANT_HOLD_FIELD];
  if (raw === undefined || raw === null) return null;
  const parsed = holdSchema.safeParse(raw);
  if (!parsed.success || parsed.data.request_id !== requestId) throw new Error("website_job_no_grant_hold_unreadable");
  return parsed.data;
}
const sameHold = (record: Record<string, any> | undefined, observed: Record<string, any>) =>
  crossRuntimeDigest(record?.[WEBSITE_JOB_NO_GRANT_HOLD_FIELD] ?? null)
    === crossRuntimeDigest(observed[WEBSITE_JOB_NO_GRANT_HOLD_FIELD] ?? null);

/**
 * Write the marker's one transition in its own small transaction on the job: only while the job is
 * still a site's job with no grant, no withdrawal, closure or ending, and the marker is as read.
 * Returns why it did not write, or null when it did.
 */
async function writeNoGrantHold(requestId: string, observed: Record<string, any>,
  next: NoGrantHold): Promise<JobWindowSweepSkip | null> {
  const store = db!;
  const jobRef = store.collection(JOBS).doc(requestId);
  return store.runTransaction<JobWindowSweepSkip | null>(async transaction => {
    const record = (await transaction.get(jobRef)).data();
    const skip = recordSkipWithoutGrant(record, requestId);
    if (skip) return skip;
    if (!sameHold(record, observed)) return "changed";
    transaction.update(jobRef, { [WEBSITE_JOB_NO_GRANT_HOLD_FIELD]: next });
    return null;
  });
}

const PREPARATION_STATES = new Set<string>(["preparing", "awaiting_inputs", "capacity_delayed", "failed_retryable",
  "failed_terminal", "authority_ended", "handed_off", "unavailable"]);
const viewableUrl = (value: unknown) => {
  try { const url = new URL(String(value || "")); return url.protocol === "https:" && !url.username && !url.password; }
  catch { return false; }
};

/**
 * Whether the job's own page asks the site to do something, decided by the projection both job
 * pages use (`projectTaskStatus`), from stored data only: the sweep must work when the Pipeline is
 * unreachable. The client names the site as the owner of the next step when the status has an
 * `operatorAction` or asks it to confirm its brief (`SelfCaptureUpload`), so this reads the same.
 * Inputs are what the owner's private page reads, with two stored stand-ins: the last stored
 * preparation state for the live one, and the job's `video_received` notice for "filmed". Neither
 * stand-in can name a step of the site's own (no preparation state or outcome does). `seen` is
 * what `storedOutcome` just read. Throws when the brief cannot be read.
 */
async function siteStepPending(requestId: string, record: Record<string, any>, seen: StoredReads,
  nowMs: number): Promise<boolean> {
  const captureId = siteWalkthroughIdentity(requestId, record).captureId;
  const brief = await getBrief(requestId);
  // The page reads this as `=== true`; an unreadable answer can only add a step, never remove one.
  const footageBeforeAccount = await footageArrivedBeforeAccount(requestId, record) === true;
  const preview = projectWebsiteCaptureRights(record).derived_scene_generation_allowed
    ? selectWebsiteAtlasPreview(record, captureId) : null;
  const session = seen.session;
  const stored = session?.website_preparation;
  const storedState = stored?.status?.state;
  const preparationStatus: TaskPreparationStatus | null = !footageBeforeAccount && stored
    ? { state: PREPARATION_STATES.has(storedState) ? storedState : "unavailable", correlationId: null } : null;
  const reconstruction = session?.world_reconstruction;
  const status = projectTaskStatus(taskStatusInputFrom({
    active_capture_id: typeof record.active_capture_id === "string" ? record.active_capture_id : null,
    site_task_brief_confirmed_at: record.site_task_brief_confirmed_at,
    capture_coverage: record.capture_coverage ?? null,
    briefDrafted: Boolean(brief),
    hasStoredCapture: true,
    footageBeforeAccount,
    consentRevoked: false,
    jobWorkWindow: null,
    scenePreviewReady: reconstruction?.state === "ready"
      && [reconstruction?.assets?.launchUrl, reconstruction?.assets?.panoUrl].some(viewableUrl),
    visualReconstructionReady: preview?.state === "ready",
    scenePreparationFailed: reconstruction?.state === "failed",
    preparationOutcome: projectAtlasPreparationOutcome(preview),
    preparationStatus,
    multiStepHold: multiStepTaskHold(brief),
    preparationOverdue: websitePreparationOverdue(session?.website_preparation_watch, nowMs),
    sceneProgression: storedState === "handed_off" ? seen.sceneProgression ?? null : null,
    stage: null,
    screening: seen.screening ?? null,
    site_task_triage: record.site_task_triage ?? null,
    site_task_scope: record.site_task_scope ?? null,
    account_owner_uid: typeof record.account_owner_uid === "string" && record.account_owner_uid ? record.account_owner_uid : null,
    capture_owner_uid: record.capture_owner_uid,
    jobAccess: (() => { try { return teamJobAccess(record); } catch { return null; } })(),
    recommended: Boolean(record.pilot_recommendation),
  }));
  return Boolean(status.operatorAction) || status.decision === "confirm_brief";
}

/**
 * Visits one site's job that never received a grant and ends it once it has waited on Blueprint
 * for the job window with nothing on record speaking for it. On every visit of a job with a video
 * it decides whether the job is held (an outcome on record, or its page asking the site for a
 * step) and records only a change of that in the hold marker; a held job is never ended, and a
 * released one counts its window from the release. The job record decides first, so a withdrawn,
 * closed or already-ended job costs no read and gets no marker write. `observed` is the job record
 * when the caller has just read it.
 */
export async function sweepWebsiteJobWithoutGrant(requestId: string, nowMs = Date.now(),
  observed?: Record<string, any>): Promise<JobWindowSweepResult> {
  if (!db) throw new Error("website_job_window_sweep_store_unavailable");
  const store = db;
  const nowEpoch = nowMs / 1000;
  const jobRef = store.collection(JOBS).doc(requestId);
  observed ??= (await jobRef.get()).data();
  const early = recordSkipWithoutGrant(observed, requestId);
  if (early) return early;
  const job = observed!;
  // Before any other read: an unreadable marker leaves the job for the next pass.
  const hold = noGrantHold(job, requestId);
  const receivedAtIso = await videoReceivedAtIso(requestId);
  if (!receivedAtIso) return "no_video";
  const seen: StoredReads = {};
  const held = await storedOutcome(requestId, job, seen)
    ?? (await siteStepPending(requestId, job, seen, nowMs) ? "site_step_pending" as const : null);
  if (held) {
    if (hold?.held === true) return held;
    return await writeNoGrantHold(requestId, job, { schema_version: HOLD_SCHEMA, request_id: requestId, held: true }) ?? held;
  }
  if (hold?.held === true) {
    // Released now: the clock starts again from this moment, so the window is open.
    return await writeNoGrantHold(requestId, job, { schema_version: HOLD_SCHEMA, request_id: requestId, held: false,
      released_at_iso: new Date(nowMs).toISOString() }) ?? "window_open";
  }
  const windowSeconds = websiteJobWindowSeconds();
  const clock = websiteJobDeadlineWithoutGrant({ videoReceivedAtIso: receivedAtIso,
    ...(hold ? { releasedAtIso: hold.released_at_iso } : {}) }, windowSeconds);
  if (clock === null) throw new Error("website_job_video_received_unreadable");
  const windowEndedAt = clock.deadlineEpoch;
  if (!(windowEndedAt <= nowEpoch)) return "window_open";
  return store.runTransaction<JobWindowSweepResult>(async transaction => {
    // Read again here: a grant issued since (the granted pass then owns the job), a withdrawal, a
    // closure, an ending recorded by another pass, or a marker another visit moved still counts.
    // The issuing transaction reads this ending, so whichever of the two commits first decides.
    const record = (await transaction.get(jobRef)).data();
    const skip = recordSkipWithoutGrant(record, requestId);
    if (skip) return skip;
    if (!sameHold(record, job)) return "changed";
    return recordEnding({ transaction, jobRef, record: record!, requestId, windowEndedAt, nowMs, withoutGrant: true,
      seal: notice => sealWebsiteJobWindowEndingWithoutGrant({ request_id: requestId, video_received_at_iso: receivedAtIso,
        waiting_since_iso: clock.waitingSinceIso, window_seconds: windowSeconds, window_ended_at_epoch: windowEndedAt,
        recorded_at_iso: new Date(nowMs).toISOString(), notice }) });
  });
}

export type JobWindowSweepSummary = { examined: number; ended: number; noticesQueued: number; failed: number };

/**
 * One pass: a few granted jobs, in turn, then a few site jobs for the jobs with no grant. Each has
 * its own durable rotating cursor (`automationBatch`), the same one the other reconcilers use, so a
 * job that cannot be read never starves the rest, and every job is looked at again each rotation.
 * Each is one equality filter ordered by document id, which the automatic single-field index
 * serves: no composite index. `request.buyerType` is stored in plaintext. A failure of one pass
 * does not stop the other; it is raised after both ran.
 */
export async function sweepWebsiteJobWindows(options: { limit?: number; now?: () => number } = {}): Promise<JobWindowSweepSummary> {
  const summary: JobWindowSweepSummary = { examined: 0, ended: 0, noticesQueued: 0, failed: 0 };
  if (!db) return summary;
  const store = db;
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_BATCH, 100));
  const pass = async (query: FirebaseFirestore.Query, cursor: string,
    sweepOne: (row: { id: string; data: () => Record<string, any> }) => Promise<JobWindowSweepResult> | null) => {
    let rows = await automationBatch(store, query, cursor, limit);
    if (!rows.docs.length) rows = await automationBatch(store, query, cursor, limit);
    for (const row of rows.docs) {
      try {
        const swept = sweepOne(row);
        if (!swept) continue;
        summary.examined += 1;
        const result = await swept;
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
  };
  const failures: unknown[] = [];
  await pass(store.collection(JOBS).where("website_scene_sponsorship.schema_version", "==", GRANT_SCHEMA), CURSOR,
    row => sweepWebsiteJobWindow(row.id, (options.now ?? Date.now)(), row.data())).catch(error => failures.push(error));
  // A job with a grant belongs to the pass above, and a job that is not a site's own is no website
  // job: both are skipped here without a read.
  await pass(store.collection(JOBS).where("request.buyerType", "==", "site_operator"), NO_GRANT_CURSOR, row => {
    const record = row.data();
    if (!isSiteJobRecord(record) || record.website_scene_sponsorship !== undefined && record.website_scene_sponsorship !== null) return null;
    return sweepWebsiteJobWithoutGrant(row.id, (options.now ?? Date.now)(), record);
  }).catch(error => failures.push(error));
  if (failures.length) throw failures[0];
  return summary;
}

/**
 * Whether the ending on a job record stands: recorded for the current grant, with the window
 * still past, or recorded for a job with no grant that still has none. Unlike the job page's reader it throws when an extension cannot be read, so a
 * passing store failure never decides whether an email is sent.
 */
async function endingStands(record: Record<string, any>, requestId: string, nowEpoch = Date.now() / 1000): Promise<boolean> {
  const ending = recordedWebsiteJobWindowEnding(record, requestId);
  if (!ending) return false;
  // A job ended with no grant has no window to reopen: its ending stands while it still has no grant.
  if (isWebsiteJobWindowEndingWithoutGrant(ending)) return true;
  return await windowEnd(record, plainReader) <= nowEpoch;
}

/**
 * Whether the job's ending is on record and still stands: for its current grant with the window
 * still past, or, for a job that never received a grant, while it still has none.
 */
export async function websiteJobWindowEndingRecorded(requestId: string): Promise<boolean> {
  if (!db) throw new Error("website_job_window_sweep_store_unavailable");
  const record = (await db.collection(JOBS).doc(requestId).get()).data();
  return Boolean(record) && await endingStands(record!, requestId);
}

/** Whether an outbox key is one of a job's window-ended emails. */
export const isWebsiteJobWindowEndedNotice = isWebsiteJobWindowEndedNoticeKey;

/**
 * Whether a queued window-ended email still says what the job page says, read again at
 * dispatch: the ending stands (for the current grant, or with still no grant), no withdrawal or closure came since, no
 * result outranks it, and no other outcome email (an earlier window-ended one included) has
 * told the site where its job stands. Throws when it cannot be read, which leaves the claim
 * recoverable rather than cancelling or sending it.
 */
export async function websiteJobWindowEndingShown(requestId: string, idempotencyKey: string): Promise<boolean> {
  if (!db) return false;
  const record = (await db.collection(JOBS).doc(requestId).get()).data();
  if (!record || record.capture_withdrawal || projectWebsiteCaptureRights(record).consent_revoked) return false;
  if (!(await endingStands(record, requestId))) return false;
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
