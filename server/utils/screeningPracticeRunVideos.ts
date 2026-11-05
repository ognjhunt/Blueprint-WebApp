/**
 * View-only practice-run videos of a job's simulation evaluation.
 *
 * The Pipeline keeps each completed candidate's episode review videos beside the
 * capture they render, and publishes their digests with the run
 * (`review_videos`). They show the customer's own site, so they follow the
 * capture's privacy rules exactly as the 3D preview does (`websiteAtlasPreviewView`):
 * the job's owner asks for a 15-minute ticket for one practice run, the page's
 * video player fetches each video from a same-origin route, and that route
 * re-reads the job's consent and owner on every request. The bytes are fetched
 * once through the signed Pipeline read, checked against the published digest
 * and size, and served inline and uncached. No download is offered and no link
 * lasts.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { parseBetaPolicyScreeningPublication, screeningReviewVideos, SCREENING_REVIEW_VIDEO_MAX_BYTES } from "./betaPolicyScreeningContract";
import { publicationFromResultRecord } from "./taskEvaluationRunPublicationStorage";
import { createSignedDownloadTicket, verifySignedDownloadTicket } from "./taskEvaluationResultDownloadTicket";
import { signedWebsitePipelineRequest } from "./websitePipelineSignedRequest";

const TICKET_DOMAIN = "screening_practice_run_video_view";
export const SCREENING_PRACTICE_RUN_VIDEO_ROUTE = "/api/screening-practice-run-videos";
export const SCREENING_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
export const SCREENING_VIDEO_ID = /^[a-f0-9]{64}$/;
const JOB_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

/** The job's account owner. A ticket is bound to it, so a changed owner ends every ticket. */
export function practiceRunVideoOwner(record: Record<string, any> | undefined): string | null {
  const owner = record?.account_owner_uid;
  return typeof owner === "string" && owner.length > 0 && owner.length <= 128 ? owner : null;
}

export type PublishedPracticeRunVideo = { captureId: string; digest: string; sizeBytes: number };

/**
 * The videos the job's own accepted screening publication names for one
 * candidate, by video id (sha256 hex), read again on every ticket and view:
 * the run must be this job's beta screening run and its stored publication
 * must verify. Empty otherwise.
 */
export async function publishedPracticeRunVideos(requestId: string, runId: string,
  candidateId: string): Promise<Map<string, PublishedPracticeRunVideo>> {
  const found = new Map<string, PublishedPracticeRunVideo>();
  if (!db || !JOB_ID.test(requestId) || !SCREENING_IDENTIFIER.test(runId) || !SCREENING_IDENTIFIER.test(candidateId)) return found;
  const run = (await db.collection("taskEvaluationPolicyRuns").doc(runId).get()).data();
  if (!run || run.run_kind !== "beta_policy_screening" || run.run_id !== runId
    || run.job_evidence_binding?.job_id !== requestId || typeof run.result_record_id !== "string") return found;
  const result = (await db.collection("captureTaskEvaluationRuns").doc(run.result_record_id).get()).data();
  if (!result || result.record_id !== run.result_record_id) return found;
  const publication = parseBetaPolicyScreeningPublication(publicationFromResultRecord(result));
  if (!publication || publication.campaign_id !== runId || publication.site_id !== `site-${requestId}`
    || publication.publication_digest !== run.publication_digest) return found;
  const entry = screeningReviewVideos(publication).find(row => row.candidate_id === candidateId);
  for (const video of entry?.practice_runs.flatMap(row => row.videos) ?? [])
    found.set(video.sha256.slice(7), { captureId: publication.source.capture_id, digest: video.sha256, sizeBytes: video.size_bytes });
  return found;
}

export async function publishedPracticeRunVideo(requestId: string, runId: string, candidateId: string, videoId: string) {
  return SCREENING_VIDEO_ID.test(videoId)
    ? (await publishedPracticeRunVideos(requestId, runId, candidateId)).get(videoId) ?? null : null;
}

const ticketFields = (requestId: string, runId: string, candidateId: string, videoId: string, owner: string) =>
  [TICKET_DOMAIN, requestId, runId, candidateId, videoId, owner];

/** The player's same-origin URL for one video, with a 15-minute ticket bound to the job's current owner. */
export function practiceRunVideoUrl(requestId: string, runId: string, candidateId: string, videoId: string,
  owner: string, nowSeconds?: number) {
  const ticket = createSignedDownloadTicket(ticketFields(requestId, runId, candidateId, videoId, owner), nowSeconds);
  if (!ticket) return null;
  const query = new URLSearchParams({ expires: String(ticket.expires), signature: ticket.signature });
  return `${SCREENING_PRACTICE_RUN_VIDEO_ROUTE}/${[requestId, runId, candidateId].map(encodeURIComponent).join("/")}/${videoId}.mp4?${query}`;
}

export function verifyPracticeRunVideoTicket(requestId: string, runId: string, candidateId: string, videoId: string,
  owner: string, expires: unknown, signature: unknown, nowSeconds?: number) {
  return verifySignedDownloadTicket(ticketFields(requestId, runId, candidateId, videoId, owner), expires, signature, nowSeconds);
}

const CACHE_DIRECTORY = path.join(tmpdir(), "blueprint-screening-practice-run-videos");
export const practiceRunVideoCachePath = (videoId: string) => path.join(CACHE_DIRECTORY, `${videoId}.mp4`);
const fetching = new Map<string, Promise<string>>();

/** Drop a cached copy, as when the job's consent no longer stands. */
export async function forgetPracticeRunVideo(videoId: string) {
  if (SCREENING_VIDEO_ID.test(videoId)) await rm(practiceRunVideoCachePath(videoId), { force: true });
}

/**
 * A local copy of the video, fetched once through the signed Pipeline read and
 * checked against the published digest and size before it is ever served.
 */
export async function practiceRunVideoFile(requestId: string, video: PublishedPracticeRunVideo) {
  const digestHex = /^sha256:([a-f0-9]{64})$/.exec(video.digest)?.[1];
  if (!digestHex || !(video.sizeBytes > 0 && video.sizeBytes <= SCREENING_REVIEW_VIDEO_MAX_BYTES))
    throw new Error("screening_practice_run_video_invalid");
  const file = practiceRunVideoCachePath(digestHex);
  if ((await stat(file).catch(() => null))?.size === video.sizeBytes) return file;
  const pending = fetching.get(digestHex);
  if (pending) return pending;
  const job = fetchVideo(requestId, video, digestHex, file).finally(() => fetching.delete(digestHex));
  fetching.set(digestHex, job);
  return job;
}

async function fetchVideo(requestId: string, video: PublishedPracticeRunVideo, digestHex: string, file: string) {
  let origin: ReturnType<typeof signedWebsitePipelineRequest> = null;
  try {
    origin = signedWebsitePipelineRequest(`/api/live-pipeline/beta-screening-review-videos/${digestHex}`, "",
      { request_id: requestId, capture_id: video.captureId });
  } catch { origin = null; }
  if (!origin) throw new Error("screening_practice_run_video_delivery_not_configured");
  const response = await fetch(origin.url, { headers: origin.headers, redirect: "error" });
  if (!response.ok) throw new Error("screening_practice_run_video_unavailable");
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared !== video.sizeBytes) throw new Error("screening_practice_run_video_mismatch");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== video.sizeBytes || createHash("sha256").update(bytes).digest("hex") !== digestHex)
    throw new Error("screening_practice_run_video_mismatch");
  await mkdir(CACHE_DIRECTORY, { recursive: true, mode: 0o700 });
  const partial = `${file}.${randomUUID()}.partial`;
  await writeFile(partial, bytes, { mode: 0o600 });
  await rename(partial, file);
  return file;
}

/** One `bytes=` range of a file of `size` bytes, or null for the whole file; `"invalid"` is answered 416. */
export function videoByteRange(header: string | undefined, size: number): { start: number; end: number } | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return "invalid";
  let start: number, end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!(suffix > 0)) return "invalid";
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  }
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end && start < size ? { start, end } : "invalid";
}
