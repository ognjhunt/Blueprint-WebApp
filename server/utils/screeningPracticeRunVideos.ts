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
import { mkdir, open, readdir, rename, rm, rmdir, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

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

export type PublishedPracticeRunVideo = { captureId: string; digest: string; sizeBytes: number; manifestDigest: string };

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
    found.set(video.sha256.slice(7), { captureId: publication.source.capture_id, digest: video.sha256,
      sizeBytes: video.size_bytes, manifestDigest: entry!.manifest_digest });
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
/** `jobs/<jobId>/<videoId>`: which job each cached copy was fetched for, so a job's copies can all go at once. */
const JOBS_DIRECTORY = path.join(CACHE_DIRECTORY, "jobs");
/** A cached copy lasts no longer unused than a view ticket (15 minutes); each view renews it. */
export const PRACTICE_RUN_VIDEO_IDLE_MS = 15 * 60 * 1000;
/** All cached copies together on this instance; the least recently viewed go first. */
export const PRACTICE_RUN_VIDEO_CACHE_BYTES = 512 * 1024 * 1024;
/** Pipeline reads at once, server-wide; the rest wait their turn. */
export const PRACTICE_RUN_VIDEO_FETCHES = 2;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const CACHED = /^[a-f0-9]{64}\.mp4$/;
export const practiceRunVideoCachePath = (videoId: string) => path.join(CACHE_DIRECTORY, `${videoId}.mp4`);
export const practiceRunVideoMarkerPath = (requestId: string, videoId: string) => path.join(JOBS_DIRECTORY, requestId, videoId);
const fetching = new Map<string, Promise<string>>();

/** Drop every cached copy of this job's videos on this instance: consent or ownership no longer stands. */
export async function forgetPracticeRunVideos(requestId: string) {
  if (!JOB_ID.test(requestId)) return;
  const markers = path.join(JOBS_DIRECTORY, requestId);
  const videoIds = await readdir(markers).catch(() => [] as string[]);
  await Promise.all(videoIds.filter(videoId => SCREENING_VIDEO_ID.test(videoId))
    .map(videoId => rm(practiceRunVideoCachePath(videoId), { force: true })));
  await rm(markers, { recursive: true, force: true });
}

/**
 * Drop copies unused for longer than a ticket lasts and, newest first, every copy
 * past the size cap; then partial fetches as old. A job's marker goes with the copy
 * this sweep drops, or once it is itself unused that long with no fetch of its video
 * under way: a marker written for a fetch in flight or queued is never dropped, so a
 * purge of that job still finds the copy when it lands.
 */
export async function sweepPracticeRunVideoCache(now = Date.now(), keep?: string) {
  const names = await readdir(CACHE_DIRECTORY).catch(() => [] as string[]);
  const entries = (await Promise.all(names.map(async name => {
    const file = path.join(CACHE_DIRECTORY, name), info = await stat(file).catch(() => null);
    return info?.isFile() ? { name, file, size: info.size, used: info.mtimeMs } : null;
  }))).filter(entry => entry !== null);
  let total = 0;
  const dropped = new Set<string>();
  for (const entry of entries.filter(entry => CACHED.test(entry.name)).sort((a, b) => b.used - a.used)) {
    if (entry.file !== keep && (now - entry.used > PRACTICE_RUN_VIDEO_IDLE_MS || total + entry.size > PRACTICE_RUN_VIDEO_CACHE_BYTES)) {
      await rm(entry.file, { force: true });
      dropped.add(entry.name.slice(0, -".mp4".length));
      continue;
    }
    total += entry.size;
  }
  await Promise.all(entries.filter(entry => entry.name.endsWith(".partial") && now - entry.used > PRACTICE_RUN_VIDEO_IDLE_MS)
    .map(entry => rm(entry.file, { force: true })));
  for (const job of await readdir(JOBS_DIRECTORY).catch(() => [] as string[])) {
    const markers = path.join(JOBS_DIRECTORY, job);
    for (const videoId of await readdir(markers).catch(() => [] as string[])) {
      if (fetching.has(videoId)) continue;
      const marker = path.join(markers, videoId);
      if (!dropped.has(videoId)) {
        if ((await stat(practiceRunVideoCachePath(videoId)).catch(() => null))?.isFile()) continue;
        const written = await stat(marker).catch(() => null);
        if (!written || now - written.mtimeMs <= PRACTICE_RUN_VIDEO_IDLE_MS) continue;
      }
      await rm(marker, { force: true });
    }
    // Only an empty directory goes: a marker written meanwhile keeps it.
    await rmdir(markers).catch(() => undefined);
  }
}

let sweeping: ReturnType<typeof setInterval> | null = null;
/** Sweep now and every five minutes; from start-up, so copies left before a restart go without waiting for a view. */
export function keepSweeping() {
  if (sweeping) return;
  void sweepPracticeRunVideoCache().catch(() => undefined);
  sweeping = setInterval(() => void sweepPracticeRunVideoCache().catch(() => undefined), SWEEP_INTERVAL_MS);
  sweeping.unref?.();
}

let active = 0;
const waiting: Array<() => void> = [];
async function withFetchSlot<T>(task: () => Promise<T>): Promise<T> {
  while (active >= PRACTICE_RUN_VIDEO_FETCHES) await new Promise<void>(resolve => waiting.push(resolve));
  active += 1;
  try {
    return await task();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

/**
 * A local copy of the video, fetched once through the signed Pipeline read and
 * checked against the published digest and size before it is ever served. Each
 * view renews it; `screening_practice_run_video_not_kept` when the Pipeline no
 * longer keeps it (a retired or deleted capture). A copy whose job was forgotten
 * while it was fetched (consent or the owner lapsed) is deleted, never served:
 * `screening_practice_run_video_forgotten`.
 */
export async function practiceRunVideoFile(requestId: string, video: PublishedPracticeRunVideo) {
  const file = await cachedPracticeRunVideo(requestId, video);
  if (!(await stat(practiceRunVideoMarkerPath(requestId, path.basename(file, ".mp4"))).catch(() => null))) {
    await rm(file, { force: true });
    throw new Error("screening_practice_run_video_forgotten");
  }
  return file;
}

async function cachedPracticeRunVideo(requestId: string, video: PublishedPracticeRunVideo) {
  const digestHex = /^sha256:([a-f0-9]{64})$/.exec(video.digest)?.[1];
  if (!JOB_ID.test(requestId) || !digestHex || !(video.sizeBytes > 0 && video.sizeBytes <= SCREENING_REVIEW_VIDEO_MAX_BYTES))
    throw new Error("screening_practice_run_video_invalid");
  keepSweeping();
  const file = practiceRunVideoCachePath(digestHex);
  // The marker comes first, so a purge for this job never misses a copy being fetched for it.
  await mkdir(path.join(JOBS_DIRECTORY, requestId), { recursive: true, mode: 0o700 });
  await writeFile(practiceRunVideoMarkerPath(requestId, digestHex), "", { mode: 0o600 });
  if ((await stat(file).catch(() => null))?.size === video.sizeBytes) {
    const now = new Date();
    await utimes(file, now, now).catch(() => undefined);
    return file;
  }
  const pending = fetching.get(digestHex);
  if (pending) return pending;
  const job = withFetchSlot(() => fetchVideo(requestId, video, digestHex, file))
    .then(async fetched => { await sweepPracticeRunVideoCache(Date.now(), fetched).catch(() => undefined); return fetched; })
    .finally(() => fetching.delete(digestHex));
  fetching.set(digestHex, job);
  return job;
}

async function fetchVideo(requestId: string, video: PublishedPracticeRunVideo, digestHex: string, file: string) {
  let origin: ReturnType<typeof signedWebsitePipelineRequest> = null;
  try {
    origin = signedWebsitePipelineRequest(`/api/live-pipeline/beta-screening-review-videos/${digestHex}`, "",
      { request_id: requestId, capture_id: video.captureId, manifest_digest: video.manifestDigest });
  } catch { origin = null; }
  if (!origin) throw new Error("screening_practice_run_video_delivery_not_configured");
  const response = await fetch(origin.url, { headers: origin.headers, redirect: "error" });
  if (response.status === 404) throw new Error("screening_practice_run_video_not_kept");
  if (!response.ok || !response.body) throw new Error("screening_practice_run_video_unavailable");
  // A chunked response (a proxy may send one) states no length; its bytes are counted and hashed below.
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) !== video.sizeBytes) throw new Error("screening_practice_run_video_mismatch");
  await mkdir(CACHE_DIRECTORY, { recursive: true, mode: 0o700 });
  // Streamed to disk while hashed: a video is never held whole in memory.
  const partial = `${file}.${randomUUID()}.partial`, hash = createHash("sha256");
  const handle = await open(partial, "wx", 0o600);
  let received = 0;
  try {
    for await (const chunk of Readable.fromWeb(response.body as unknown as NodeReadableStream<Uint8Array>)) {
      received += chunk.length;
      if (received > video.sizeBytes) throw new Error("screening_practice_run_video_mismatch");
      hash.update(chunk);
      await handle.write(chunk);
    }
    await handle.close();
    if (received !== video.sizeBytes || hash.digest("hex") !== digestHex) throw new Error("screening_practice_run_video_mismatch");
    await rename(partial, file);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(partial, { force: true });
    throw error;
  }
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
