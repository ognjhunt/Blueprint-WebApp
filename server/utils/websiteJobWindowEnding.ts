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
 */
import { z } from "zod";
import { crossRuntimeArtifactDigest, matchesCrossRuntimeArtifactDigest } from "./crossRuntimeCanonical";

export const WEBSITE_JOB_WINDOW_ENDING_FIELD = "website_job_window_ending";
export const WEBSITE_JOB_WINDOW_ENDING_SCHEMA = "website_job_window_ending.v1";

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
export type WebsiteJobWindowEnding = z.infer<typeof endingSchema>;

/** Seal a new ending. The digest covers every other field. */
export function sealWebsiteJobWindowEnding(value: Omit<WebsiteJobWindowEnding, "schema_version" | "ending_digest">): WebsiteJobWindowEnding {
  const payload = { schema_version: WEBSITE_JOB_WINDOW_ENDING_SCHEMA, ...value } as const;
  return endingSchema.parse({ ...payload, ending_digest: crossRuntimeArtifactDigest(payload, "ending_digest") });
}

/**
 * The ending recorded for the job's current grant, or null: none was recorded,
 * it does not read, or it was recorded for a grant that has since been re-issued.
 */
export function recordedWebsiteJobWindowEnding(record: Record<string, any> | undefined): WebsiteJobWindowEnding | null {
  const parsed = endingSchema.safeParse(record?.[WEBSITE_JOB_WINDOW_ENDING_FIELD]);
  const grant = record?.website_scene_sponsorship;
  if (!parsed.success || !matchesCrossRuntimeArtifactDigest(parsed.data, "ending_digest")
    || parsed.data.request_id !== grant?.request_id || parsed.data.authority_digest !== grant?.authority_digest) return null;
  return parsed.data;
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

/**
 * A job that never received a grant has no window of its own. The same sweep keeps a clock for it
 * on the job's record, started the first time the sweep sees the job waiting with no grant (so a job
 * already waiting when this shipped starts its clock then, never at its creation), and restarted when
 * the wait passes from the site to Blueprint. It runs for the length a grant's window would have
 * (`websiteJobWindowSeconds`), fixed when the clock starts.
 *
 * - `site`: we never received a finished recording, or the job is held for a step only the site can
 *   take (splitting a several-step task, or describing it in one sentence).
 * - `blueprint`: the site has done its part and Blueprint has not issued the grant: our fault or a
 *   money wait. The ops monitor pages before the job ends.
 */
export const WEBSITE_JOB_NO_GRANT_CLOCK_FIELD = "website_job_no_grant_clock";
export const WEBSITE_JOB_NO_GRANT_ENDING_FIELD = "website_job_no_grant_ending";
/** Top-level number so a single-field range query (automatic index) finds a wait due its page; null once paged. */
export const WEBSITE_JOB_NO_GRANT_PAGE_DUE_FIELD = "website_job_no_grant_page_due_at_ms";
export const WEBSITE_JOB_NO_GRANT_WAITS = ["site", "blueprint"] as const;
export type WebsiteJobNoGrantWait = typeof WEBSITE_JOB_NO_GRANT_WAITS[number];

const clockSchema = z.object({
  schema_version: z.literal("website_job_no_grant_clock.v1"),
  request_id: id,
  waiting_on: z.enum(WEBSITE_JOB_NO_GRANT_WAITS),
  since_epoch: z.number().int().positive(),
  window_seconds: z.number().int().positive(),
  /** When the ops monitor paged this wait; absent until it has. */
  paged_at_iso: z.string().datetime().optional(),
}).strict();
export type WebsiteJobNoGrantClock = z.infer<typeof clockSchema>;

/** The job's no-grant clock, or null: none started, it does not read, or it names another job. */
export function websiteJobNoGrantClock(record: Record<string, any> | undefined, requestId: string): WebsiteJobNoGrantClock | null {
  const parsed = clockSchema.safeParse(record?.[WEBSITE_JOB_NO_GRANT_CLOCK_FIELD]);
  return parsed.success && parsed.data.request_id === requestId ? parsed.data : null;
}
export const newWebsiteJobNoGrantClock = (value: Omit<WebsiteJobNoGrantClock, "schema_version">): WebsiteJobNoGrantClock =>
  clockSchema.parse({ schema_version: "website_job_no_grant_clock.v1", ...value });

/** What became of a no-grant ending's one email when the ending was recorded. */
export const WEBSITE_JOB_NO_GRANT_ENDING_NOTICES = [
  "queued",
  "none_no_contact_on_file",
  /**
   * No backfill: when the sweep first saw the job, it had already waited at least one window since
   * its latest site activity, so it would have ended before this change. Recorded, never emailed or paged.
   */
  "none_waited_before_this_change",
  /** No backfill: the job's own stored times could not be read when the sweep first saw it, so it is taken as old. */
  "none_age_unknown",
] as const;
export type WebsiteJobNoGrantEndingNotice = typeof WEBSITE_JOB_NO_GRANT_ENDING_NOTICES[number];

const noGrantEndingSchema = z.object({
  schema_version: z.literal("website_job_no_grant_ending.v1"),
  request_id: id,
  waiting_on: z.enum(WEBSITE_JOB_NO_GRANT_WAITS),
  waiting_since_epoch: z.number().int().positive(),
  ended_at_epoch: z.number().finite().positive(),
  recorded_at_iso: z.string().datetime(),
  notice: z.enum(WEBSITE_JOB_NO_GRANT_ENDING_NOTICES),
  ending_digest: sha,
}).strict();
export type WebsiteJobNoGrantEnding = z.infer<typeof noGrantEndingSchema>;

export function sealWebsiteJobNoGrantEnding(value: Omit<WebsiteJobNoGrantEnding, "schema_version" | "ending_digest">): WebsiteJobNoGrantEnding {
  const payload = { schema_version: "website_job_no_grant_ending.v1", ...value } as const;
  return noGrantEndingSchema.parse({ ...payload, ending_digest: crossRuntimeArtifactDigest(payload, "ending_digest") });
}

/**
 * The no-grant ending recorded for this job, or null: none was recorded, it does not read, or the
 * job has a grant now. The job is named by `requestId`, or by the record's own `requestId` when it
 * carries one. A grant issued later (the owner's fix of the wait) is the job's own window,
 * which the window sweep ends; the no-grant ending then stops speaking for the job.
 */
export function recordedWebsiteJobNoGrantEnding(record: Record<string, any> | undefined,
  requestId: string | undefined = typeof record?.requestId === "string" ? record.requestId : undefined): WebsiteJobNoGrantEnding | null {
  if (!record || record.website_scene_sponsorship) return null;
  const parsed = noGrantEndingSchema.safeParse(record[WEBSITE_JOB_NO_GRANT_ENDING_FIELD]);
  return parsed.success && (requestId === undefined || parsed.data.request_id === requestId)
    && matchesCrossRuntimeArtifactDigest(parsed.data, "ending_digest") ? parsed.data : null;
}

/** The no-grant ending's one email: a job outcome notice under a key fixed by the job alone. */
export const WEBSITE_JOB_NO_GRANT_ENDED_EVENT_ID = "job_no_grant_ended";
export const isWebsiteJobNoGrantEndedEventId = (eventId: unknown): eventId is string => eventId === WEBSITE_JOB_NO_GRANT_ENDED_EVENT_ID;
export const websiteJobNoGrantEndedNoticeKey = (requestId: string) =>
  `${requestId.trim()}:scene_outcome:${WEBSITE_JOB_NO_GRANT_ENDED_EVENT_ID}`;
export const isWebsiteJobNoGrantEndedNoticeKey = (requestId: string, idempotencyKey: string) =>
  idempotencyKey === websiteJobNoGrantEndedNoticeKey(requestId);
