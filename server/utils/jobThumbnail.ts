/**
 * Every shared job's thumbnail (owner, 2026-11-23: all jobs have thumbnails, a render of the job's simulation or a
 * frame of its video).
 *
 * For now it is one frame of the job's sound-free company clip: the same video approved deployment companies play, so
 * the thumbnail shares exactly what the clip shares, under the same statement, and goes when the clip goes. A render
 * of the job's simulation from the Pipeline takes its place once the Pipeline sends one.
 *
 * The frame: ffmpeg's `thumbnail` filter picks the most representative of the frames from a third of the way into the
 * clip (past an opening of floor or hands), scaled to fit 480 by 300, then re-encoded by `sanitizeTaskThumbnail`, which
 * keeps pixels only. It is stored in `taskThumbnails/{jobId}` with the clip's digest, and its own digest goes on the
 * job's listing (`public_task_listing.thumbnailDigest`), which the job cards and the company job page read
 * (`taskThumbnailUrl`); the image is served only to a viewer who may see the job (`site-worlds.ts`). Made when the
 * Pipeline delivers the clip and caught up by the ops monitor. Never on the public /jobs list.
 */
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import { resolveFfmpegBinary } from "../agents/adapters/video-audio-strip";
import { sanitizeTaskThumbnail } from "./taskThumbnail";
import { fetchCompanyClip, storedCompanyClip, type WebsiteCompanyClip } from "./websiteCompanyClip";
import { siteWalkthroughIdentity } from "./siteWalkthrough";
import { loadCompanyJobAccess } from "./teamJobAccess";
import { JOB_SHARED_LISTING_VERSION } from "./taskListingDetails";

export const JOB_THUMBNAIL_VERSION = "job-thumbnail-v1";
export const JOB_THUMBNAIL_COLLECTION = "taskThumbnails";
/** The stored image's source: a frame of the company clip (a simulation render comes next). */
export type JobThumbnailSource = "company_clip_frame";
export interface StoredJobThumbnail {
  consentVersion: typeof JOB_THUMBNAIL_VERSION;
  source: JobThumbnailSource;
  digest: string;
  pngBase64: string;
  clipDigest: string;
  createdAtIso: string;
}

const FFMPEG_TIMEOUT_MS = 30_000;
const MAX_PNG_BYTES = 2 * 1024 * 1024;

/** Where in the clip to start looking: a third of the way in, at least a second before the end. */
export function frameSearchStart(durationSeconds: number | null | undefined): number {
  if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.max(0, Math.min(durationSeconds / 3, durationSeconds - 1));
}

/** The ffmpeg arguments for one representative frame as a PNG on stdout, fitted inside 480 by 300. */
export function frameArguments(clipPath: string, startSeconds: number): string[] {
  return ["-hide_banner", "-nostdin", "-v", "error", ...(startSeconds > 0 ? ["-ss", startSeconds.toFixed(2)] : []), "-i", clipPath,
    "-vf", "thumbnail=60,scale=480:300:force_original_aspect_ratio=decrease", "-frames:v", "1", "-an",
    "-f", "image2pipe", "-c:v", "png", "pipe:1"];
}

export interface JobThumbnailDeps {
  now: () => Date;
  /** The clip's verified bytes, written to `file`. False when the Pipeline could not give them. */
  downloadClip: (jobId: string, clip: WebsiteCompanyClip, file: string) => Promise<boolean>;
  /** One PNG frame from the clip file, or null. */
  extractFrame: (file: string, startSeconds: number) => Promise<Buffer | null>;
}

async function runFfmpeg(binary: string, args: string[]): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "ignore"] });
    const chunks: Buffer[] = [];
    let size = 0;
    const timer = setTimeout(() => child.kill("SIGKILL"), FFMPEG_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_PNG_BYTES) child.kill("SIGKILL"); else chunks.push(chunk);
    });
    child.on("error", () => { clearTimeout(timer); resolve(null); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 && size > 0 && size <= MAX_PNG_BYTES ? Buffer.concat(chunks) : null);
    });
  });
}

const defaultDeps: JobThumbnailDeps = {
  now: () => new Date(),
  async downloadClip(jobId, clip, file) {
    const read = await fetchCompanyClip(jobId, clip, null);
    if (!read.ok) return false;
    await pipeline(read.body, createWriteStream(file));
    return true;
  },
  async extractFrame(file, startSeconds) {
    const binary = await resolveFfmpegBinary();
    if (!binary) return null;
    // A seek past a short clip's last frame gives nothing; the opening is the fallback.
    return await runFfmpeg(binary, frameArguments(file, startSeconds))
      ?? (startSeconds > 0 ? runFfmpeg(binary, frameArguments(file, 0)) : null);
  },
};

export type JobThumbnailOutcome = "made" | "current" | "not_listed" | "no_clip" | "unavailable";

/**
 * Make the job's thumbnail from its company clip, if the job is listed and its thumbnail is missing or from an older
 * clip. Writes only while the job is still listed and its clip is still the one the frame came from.
 */
export async function makeJobThumbnail(jobId: string, deps: JobThumbnailDeps = defaultDeps): Promise<JobThumbnailOutcome> {
  if (!db) return "unavailable";
  const store = db;
  const { record, access, session } = await loadCompanyJobAccess(jobId);
  if (!record || !access.listed) return "not_listed";
  const { captureId } = siteWalkthroughIdentity(jobId, record as Record<string, any>);
  const clip = storedCompanyClip(session, captureId);
  if (!clip) return "no_clip";
  const imageRef = store.collection(JOB_THUMBNAIL_COLLECTION).doc(jobId);
  const existing = (await imageRef.get()).data() as StoredJobThumbnail | undefined;
  const listedDigest = (record as Record<string, any>).public_task_listing?.thumbnailDigest;
  if (existing?.consentVersion === JOB_THUMBNAIL_VERSION && existing.clipDigest === clip.digest && existing.digest === listedDigest)
    return "current";
  const folder = await mkdtemp(path.join(os.tmpdir(), "job-thumbnail-"));
  try {
    const file = path.join(folder, "clip.mp4");
    if (!await deps.downloadClip(jobId, clip, file)) return "unavailable";
    const png = await deps.extractFrame(file, frameSearchStart(clip.duration_seconds));
    if (!png) return "unavailable";
    const image = sanitizeTaskThumbnail(png.toString("base64"));
    const jobRef = store.collection("inboundRequests").doc(jobId);
    const sessionRef = store.collection("captureUploadSessions").doc(captureId);
    const stored = await store.runTransaction(async (tx) => {
      const [job, currentSession] = await Promise.all([tx.get(jobRef), tx.get(sessionRef)]);
      const listing = job.data()?.public_task_listing;
      // Still shared under the current listing, and still the same clip: a withdrawal or a new clip meanwhile wins.
      if (!listing || listing.consentVersion !== JOB_SHARED_LISTING_VERSION
        || storedCompanyClip(currentSession.data(), captureId)?.digest !== clip.digest) return false;
      const value: StoredJobThumbnail = { consentVersion: JOB_THUMBNAIL_VERSION, source: "company_clip_frame", digest: image.digest,
        pngBase64: image.pngBase64, clipDigest: clip.digest, createdAtIso: deps.now().toISOString() };
      tx.set(imageRef, value);
      tx.set(jobRef, { public_task_listing: { thumbnailDigest: image.digest } }, { merge: true });
      return true;
    });
    return stored ? "made" : "not_listed";
  } catch (error) {
    logger.warn({ error, jobId }, "Could not make the job's thumbnail");
    return "unavailable";
  } finally {
    await rm(folder, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Best effort, when the Pipeline has just delivered a job's clip: never throws. */
export function makeJobThumbnailSoon(jobId: string): void {
  void makeJobThumbnail(jobId).catch((error) => logger.warn({ error, jobId }, "Could not make the job's thumbnail"));
}

const SWEEP_PER_PASS = 3;

/**
 * The ops monitor's catch-up: listed jobs with no thumbnail yet (shared before thumbnails, or whose making failed) get
 * one, at most three a pass. Returns how many were made.
 */
export async function sweepJobThumbnails(deps: JobThumbnailDeps = defaultDeps): Promise<number> {
  if (!db) return 0;
  const { docs } = await db.collection("inboundRequests")
    .where("public_task_listing.consentVersion", "==", JOB_SHARED_LISTING_VERSION).get();
  const missing = docs.filter(doc => !doc.data()?.public_task_listing?.thumbnailDigest).map(doc => doc.id).slice(0, SWEEP_PER_PASS);
  let made = 0;
  for (const id of missing) if (await makeJobThumbnail(id, deps) === "made") made += 1;
  return made;
}

/** Withdrawal deletion: the job's thumbnail goes with its clip. */
export async function deleteJobThumbnail(jobId: string): Promise<void> {
  if (!db) throw new Error("job_thumbnail_store_unavailable");
  const store = db;
  await store.collection(JOB_THUMBNAIL_COLLECTION).doc(jobId).delete();
  const jobRef = store.collection("inboundRequests").doc(jobId);
  if ((await jobRef.get()).data()?.public_task_listing?.thumbnailDigest)
    await jobRef.set({ public_task_listing: { thumbnailDigest: admin.firestore.FieldValue.delete() } }, { merge: true });
}
