/**
 * The stored ending of a website job whose work window ran out.
 *
 * Only the window sweep writes it (`websiteJobWindowSweep`), on the job's own
 * record, beside the grant whose window passed. This module is the record and
 * its reading, and is pure, so the grant reader and the job pages can use it
 * without importing the sweep.
 *
 * The ending binds the job and the exact grant. A grant the owner re-issues
 * later (`renewExpiredWebsiteSceneSponsorship`) is a new window, so an ending
 * recorded for the old one stops speaking for the job; the job pages also show
 * it only while the window is still in the past (`websiteJobWorkWindow`), so an
 * owner-approved extension granted afterwards is honoured.
 *
 * A job whose video arrived but which never received a grant ends the same way
 * (v2, basis `video_received_no_grant`): bound to the job, the instant the video
 * arrived, the instant the clock started (the site waiting on Blueprint) and the
 * window end counted from it (`websiteJobDeadlineWithoutGrant`).
 * It speaks for the job only while the job still has no grant, and while it does
 * the first grant is refused (`loadWebsiteSceneSponsorship`), so no work starts
 * after the site was told none will. v1 records read exactly as before.
 */
import { z } from "zod";
import { crossRuntimeArtifactDigest, matchesCrossRuntimeArtifactDigest } from "./crossRuntimeCanonical";

export const WEBSITE_JOB_WINDOW_ENDING_FIELD = "website_job_window_ending";
export const WEBSITE_JOB_WINDOW_ENDING_SCHEMA = "website_job_window_ending.v1";
export const WEBSITE_JOB_WINDOW_ENDING_WITHOUT_GRANT_SCHEMA = "website_job_window_ending.v2";
/** The basis of a v2 ending: the video arrived, no grant was ever issued, and the deadline counted from it passed. */
export const WEBSITE_JOB_WINDOW_ENDING_WITHOUT_GRANT_BASIS = "video_received_no_grant";

/**
 * No backfill: a job whose window ended before this instant gets the stored
 * ending and no email. The one place the cutover is written.
 */
export const WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_ISO = "2026-11-11T00:00:00Z";
export const WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_EPOCH = Date.parse(WEBSITE_JOB_WINDOW_ENDING_NOTICE_CUTOVER_ISO) / 1000;

/** What became of the ending's one email when the ending was recorded. */
export const WEBSITE_JOB_WINDOW_ENDING_NOTICES = [
  /** The email is in the outbox (this write queued it, or an earlier ending of the same job did). */
  "queued",
  /** The window ended before the cutover: recorded, never emailed. */
  "none_window_ended_before_cutover",
  /** No usable contact address is on file, so there is nobody to email. */
  "none_no_contact_on_file",
  /** The email for this exact window end was cancelled before it was sent; nothing more can be queued for it. */
  "none_cancelled_before_sending",
] as const;
export type WebsiteJobWindowEndingNotice = typeof WEBSITE_JOB_WINDOW_ENDING_NOTICES[number];

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/);
const sha = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const endingSchema = z.object({
  schema_version: z.literal(WEBSITE_JOB_WINDOW_ENDING_SCHEMA),
  request_id: id,
  /** The grant whose window ran out. */
  authority_digest: sha,
  /** When that window ended: the grant's expiry, or the end of its verified extension. */
  window_ended_at_epoch: z.number().finite().positive(),
  recorded_at_iso: z.string().datetime(),
  notice: z.enum(WEBSITE_JOB_WINDOW_ENDING_NOTICES),
  ending_digest: sha,
}).strict();
const endingWithoutGrantSchema = z.object({
  schema_version: z.literal(WEBSITE_JOB_WINDOW_ENDING_WITHOUT_GRANT_SCHEMA),
  basis: z.literal(WEBSITE_JOB_WINDOW_ENDING_WITHOUT_GRANT_BASIS),
  request_id: id,
  /**
   * When the video first arrived, as stored: the job's `video_received` notice's `createdAtIso`
   * when that notice exists; otherwise the walkthrough upload session's finished-upload stamp
   * (`browser_pending_delivery.completed_at_iso`, `browser_stored_upload.completed_at_iso`, or an
   * app bundle's `site_capture_bundle.recorded_at_iso`).
   */
  video_received_at_iso: z.string().datetime(),
  /**
   * When the clock started: the later of the arrival and the last release of the sweep's hold
   * marker (the last moment something spoke for the job or its page asked the site for a step).
   */
  waiting_since_iso: z.string().datetime(),
  /** The window length the deadline was counted with (`websiteJobWindowSeconds`). */
  window_seconds: z.number().int().positive(),
  /** The deadline: the clock's start plus that length. */
  window_ended_at_epoch: z.number().finite().positive(),
  recorded_at_iso: z.string().datetime(),
  notice: z.enum(WEBSITE_JOB_WINDOW_ENDING_NOTICES),
  ending_digest: sha,
}).strict();
export type WebsiteJobWindowGrantEnding = z.infer<typeof endingSchema>;
export type WebsiteJobWindowEndingWithoutGrant = z.infer<typeof endingWithoutGrantSchema>;
export type WebsiteJobWindowEnding = WebsiteJobWindowGrantEnding | WebsiteJobWindowEndingWithoutGrant;

/** Seal a new ending for a grant's window. The digest covers every other field. */
export function sealWebsiteJobWindowEnding(value: Omit<WebsiteJobWindowGrantEnding, "schema_version" | "ending_digest">): WebsiteJobWindowGrantEnding {
  const payload = { schema_version: WEBSITE_JOB_WINDOW_ENDING_SCHEMA, ...value } as const;
  return endingSchema.parse({ ...payload, ending_digest: crossRuntimeArtifactDigest(payload, "ending_digest") });
}

/** Seal a new ending for a job that never received a grant. The digest covers every other field. */
export function sealWebsiteJobWindowEndingWithoutGrant(value: Omit<WebsiteJobWindowEndingWithoutGrant,
  "schema_version" | "basis" | "ending_digest">): WebsiteJobWindowEndingWithoutGrant {
  const payload = { schema_version: WEBSITE_JOB_WINDOW_ENDING_WITHOUT_GRANT_SCHEMA,
    basis: WEBSITE_JOB_WINDOW_ENDING_WITHOUT_GRANT_BASIS, ...value } as const;
  return endingWithoutGrantSchema.parse({ ...payload, ending_digest: crossRuntimeArtifactDigest(payload, "ending_digest") });
}

/** Whether a recorded ending is the one for a job that never received a grant. */
export const isWebsiteJobWindowEndingWithoutGrant = (ending: WebsiteJobWindowEnding | null | undefined):
  ending is WebsiteJobWindowEndingWithoutGrant => ending?.schema_version === WEBSITE_JOB_WINDOW_ENDING_WITHOUT_GRANT_SCHEMA;

/**
 * The ending that speaks for the job now, or null: none was recorded, it does not read, it was
 * recorded for a grant that has since been re-issued, or it was recorded for a job with no grant
 * that has one now. `requestId`, when the caller knows it, must be the one the ending names.
 */
export function recordedWebsiteJobWindowEnding(record: Record<string, any> | undefined,
  requestId?: string): WebsiteJobWindowEnding | null {
  const raw = record?.[WEBSITE_JOB_WINDOW_ENDING_FIELD];
  const grant = record?.website_scene_sponsorship;
  if (raw?.schema_version === WEBSITE_JOB_WINDOW_ENDING_WITHOUT_GRANT_SCHEMA) {
    const parsed = endingWithoutGrantSchema.safeParse(raw);
    // Any grant on the job, readable or not, means it is no longer a job without one.
    if (!parsed.success || !matchesCrossRuntimeArtifactDigest(parsed.data, "ending_digest")
      || grant !== undefined && grant !== null || requestId !== undefined && parsed.data.request_id !== requestId) return null;
    return parsed.data;
  }
  const parsed = endingSchema.safeParse(raw);
  if (!parsed.success || !matchesCrossRuntimeArtifactDigest(parsed.data, "ending_digest")
    || parsed.data.request_id !== grant?.request_id || parsed.data.authority_digest !== grant?.authority_digest
    || requestId !== undefined && parsed.data.request_id !== requestId) return null;
  return parsed.data;
}

/** The recorded ending of a job that never received a grant, while it still has none; else null. */
export function recordedWebsiteJobWindowEndingWithoutGrant(record: Record<string, any> | undefined,
  requestId?: string): WebsiteJobWindowEndingWithoutGrant | null {
  const ending = recordedWebsiteJobWindowEnding(record, requestId);
  return isWebsiteJobWindowEndingWithoutGrant(ending) ? ending : null;
}

/**
 * The ending's one email is a job outcome notice (`scene_outcome`, C-04: every job
 * ends in one terminal state and is told once). The key is the outbox document id.
 * A job's first ending uses the key fixed by the job alone. A later key exists only
 * for an ending whose every earlier email was cancelled before it was sent (the
 * window was reopened first): it names the window end it is for, so it is as
 * deterministic as the first, and the sweep queues it only while no earlier one
 * went out or still can.
 */
export const WEBSITE_JOB_WINDOW_ENDED_EVENT_ID = "job_window_ended";
const WINDOW_ENDED_EVENT = /^job_window_ended(?:-[0-9]{1,12})?$/;
export const isWebsiteJobWindowEndedEventId = (eventId: unknown): eventId is string =>
  typeof eventId === "string" && WINDOW_ENDED_EVENT.test(eventId);
export const websiteJobWindowEndedEventId = (windowEndedAtEpoch?: number) => windowEndedAtEpoch === undefined
  ? WEBSITE_JOB_WINDOW_ENDED_EVENT_ID : `${WEBSITE_JOB_WINDOW_ENDED_EVENT_ID}-${Math.round(windowEndedAtEpoch)}`;
export const websiteJobWindowEndedNoticeKey = (requestId: string, windowEndedAtEpoch?: number) =>
  `${requestId.trim()}:scene_outcome:${websiteJobWindowEndedEventId(windowEndedAtEpoch)}`;
/** Whether an outbox key is one of this job's window-ended emails. */
export function isWebsiteJobWindowEndedNoticeKey(requestId: string, idempotencyKey: string): boolean {
  const prefix = `${requestId.trim()}:scene_outcome:`;
  return idempotencyKey.startsWith(prefix) && WINDOW_ENDED_EVENT.test(idempotencyKey.slice(prefix.length));
}
