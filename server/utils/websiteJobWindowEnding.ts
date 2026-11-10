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
 * ends in one terminal state and is told once), keyed by the job alone. The key is
 * the outbox document id, so a job can never be sent a second one.
 */
export const WEBSITE_JOB_WINDOW_ENDED_EVENT_ID = "job_window_ended";
export const websiteJobWindowEndedNoticeKey = (requestId: string) =>
  `${requestId.trim()}:scene_outcome:${WEBSITE_JOB_WINDOW_ENDED_EVENT_ID}`;
