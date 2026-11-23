/**
 * Every shared job's thumbnail (owner, 2026-11-23: all jobs have thumbnails, a render of the job's simulation or a
 * frame of its video).
 *
 * A render of the job's simulation when the Pipeline has sent one (`recordJobThumbnailRender`: the scene preview
 * companies open, from the viewer's start view), otherwise one frame of the job's sound-free company clip. Both share
 * only what the job already shares with approved deployment companies, under the same statement, and go when it goes.
 *
 * The frame: ffmpeg's `thumbnail` filter picks the most representative of the frames from a third of the way into the
 * clip (past an opening of floor or hands), scaled to fit 480 by 300, then re-encoded by `sanitizeTaskThumbnail`, which
 * keeps pixels only. It is stored in `taskThumbnails/{jobId}` with the clip's digest, and its own digest goes on the
 * job's listing (`public_task_listing.thumbnailDigest`), which the job cards and the company job page read
 * (`taskThumbnailUrl`); the image is served only to a viewer who may see the job (`site-worlds.ts`). Made when the
 * Pipeline delivers the clip and caught up by the ops monitor. Never on the public /jobs list.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
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
import { z } from "zod";
import { WEBSITE_ATLAS_CAPTURE_ID, WEBSITE_ATLAS_REQUEST_ID } from "./websiteAtlasPreview";
import { assertWebsiteCaptureBindingInTransaction, resolveWebsiteCaptureBinding } from "./websiteCaptureBinding";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";
import { storedWebsiteScenePreview } from "./websiteScenePreview";

export const JOB_THUMBNAIL_VERSION = "job-thumbnail-v1";
export const JOB_THUMBNAIL_COLLECTION = "taskThumbnails";
/** The stored image's source: a render of the job's simulation, or a frame of its company clip. */
export type JobThumbnailSource = "simulation_render" | "company_clip_frame";
export interface StoredJobThumbnail {
  consentVersion: typeof JOB_THUMBNAIL_VERSION;
  source: JobThumbnailSource;
  digest: string;
  pngBase64: string;
  /** A frame: the clip it came from. */
  clipDigest?: string;
  /** A render: the scene preview it was rendered from, and the Pipeline's own digest of the PNG it sent. */
  scenePreviewDigest?: string;
  sourceDigest?: string;
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
  // A render of the simulation outranks a frame: kept, and named on the listing again if a re-share cleared it.
  if (existing?.consentVersion === JOB_THUMBNAIL_VERSION && existing.source === "simulation_render") {
    if (existing.digest !== listedDigest)
      await store.collection("inboundRequests").doc(jobId).set({ public_task_listing: { thumbnailDigest: existing.digest,
        thumbnailSource: existing.source } }, { merge: true });
    return "current";
  }
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
      const [job, currentSession, currentImage] = await Promise.all([tx.get(jobRef), tx.get(sessionRef), tx.get(imageRef)]);
      const listing = job.data()?.public_task_listing;
      // Still shared under the current listing, and still the same clip: a withdrawal or a new clip meanwhile wins.
      if (!listing || listing.consentVersion !== JOB_SHARED_LISTING_VERSION
        || storedCompanyClip(currentSession.data(), captureId)?.digest !== clip.digest) return false;
      // A render that arrived meanwhile wins.
      if ((currentImage.data() as StoredJobThumbnail | undefined)?.source === "simulation_render") return false;
      const value: StoredJobThumbnail = { consentVersion: JOB_THUMBNAIL_VERSION, source: "company_clip_frame", digest: image.digest,
        pngBase64: image.pngBase64, clipDigest: clip.digest, createdAtIso: deps.now().toISOString() };
      tx.set(imageRef, value);
      tx.set(jobRef, { public_task_listing: { thumbnailDigest: image.digest, thumbnailSource: value.source } }, { merge: true });
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

const SWEEP_ATTEMPTS_PER_PASS = 3;
/** A job whose thumbnail could not be made is tried again after this long, so it never holds up the others. */
export const JOB_THUMBNAIL_RETRY_AFTER_MS = 6 * 60 * 60 * 1000;
export const JOB_THUMBNAIL_ATTEMPTS_COLLECTION = "taskThumbnailAttempts";

/**
 * The ops monitor's catch-up: listed jobs with no thumbnail yet (shared before thumbnails, or whose making failed) get
 * one. Every candidate is looked at: one not listed or without a clip costs no read of a video and is passed over;
 * at most three a pass read a video; one that failed waits six hours before it is tried again. Returns how many were made.
 */
export async function sweepJobThumbnails(deps: JobThumbnailDeps = defaultDeps,
  make: (jobId: string) => Promise<JobThumbnailOutcome> = (jobId) => makeJobThumbnail(jobId, deps)): Promise<number> {
  if (!db) return 0;
  const store = db;
  const { docs } = await store.collection("inboundRequests")
    .where("public_task_listing.consentVersion", "==", JOB_SHARED_LISTING_VERSION).get();
  const nowMs = deps.now().getTime();
  let attempts = 0, made = 0;
  for (const doc of docs) {
    if (attempts >= SWEEP_ATTEMPTS_PER_PASS) break;
    if (doc.data()?.public_task_listing?.thumbnailDigest) continue;
    const attemptRef = store.collection(JOB_THUMBNAIL_ATTEMPTS_COLLECTION).doc(doc.id);
    const last = Date.parse(String((await attemptRef.get()).data()?.failedAtIso ?? ""));
    if (Number.isFinite(last) && nowMs - last < JOB_THUMBNAIL_RETRY_AFTER_MS) continue;
    const outcome = await make(doc.id);
    if (outcome === "made") { made += 1; attempts += 1; await attemptRef.delete().catch(() => undefined); }
    else if (outcome === "unavailable") { attempts += 1; await attemptRef.set({ failedAtIso: deps.now().toISOString() }); }
  }
  return made;
}

/** Withdrawal deletion: the job's thumbnail goes with its clip. */
export async function deleteJobThumbnail(jobId: string): Promise<void> {
  if (!db) throw new Error("job_thumbnail_store_unavailable");
  const store = db;
  await store.collection(JOB_THUMBNAIL_COLLECTION).doc(jobId).delete();
  const jobRef = store.collection("inboundRequests").doc(jobId);
  if ((await jobRef.get()).data()?.public_task_listing?.thumbnailDigest)
    await jobRef.set({ public_task_listing: { thumbnailDigest: admin.firestore.FieldValue.delete(),
      thumbnailSource: admin.firestore.FieldValue.delete() } }, { merge: true });
}

/* ----------------------------------------------------------------------------------------- the simulation render */

/** What the Pipeline sends: one PNG of the job's scene preview from the viewer's start view (thumbnails step 2). */
export const websiteJobThumbnailSchema = z.object({
  schema_version: z.literal("website_job_thumbnail.v1"),
  capture_id: z.string().regex(WEBSITE_ATLAS_CAPTURE_ID),
  source: z.literal("simulation_render"),
  camera: z.literal("scene_preview_start_view"),
  scene_preview_digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  width: z.number().int().min(1).max(480),
  height: z.number().int().min(1).max(300),
  png_base64: z.string().min(1).max(800_000),
  digest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
}).strict();
export type WebsiteJobThumbnail = z.infer<typeof websiteJobThumbnailSchema>;

/**
 * Keep the Pipeline's render as the job's thumbnail, in place of a frame: only while the site's rights still allow
 * scenes from its video, the PNG matches its digest and passes the same sanitizer as a frame, and it was rendered from
 * the capture's current scene preview. The same render sent twice is accepted once. Named on the listing when the job
 * is shared; a job shared later picks it up from the store (`makeJobThumbnail`).
 */
export async function recordJobThumbnailRender(requestId: string, sceneId: string, captureId: string,
  thumbnail: WebsiteJobThumbnail, now: () => Date = () => new Date()) {
  if (!db) throw new Error("job_thumbnail_store_unavailable");
  const store = db;
  if (!WEBSITE_ATLAS_REQUEST_ID.test(requestId) || sceneId !== `site-${requestId}` || thumbnail.capture_id !== captureId)
    throw new Error("task_context_capture_mismatch");
  const bytes = Buffer.from(thumbnail.png_base64, "base64");
  if (`sha256:${createHash("sha256").update(bytes).digest("hex")}` !== thumbnail.digest)
    throw new Error("website_job_thumbnail_digest_invalid");
  let image: { pngBase64: string; digest: string };
  try { image = sanitizeTaskThumbnail(thumbnail.png_base64); } catch { throw new Error("website_job_thumbnail_invalid"); }
  const binding = await resolveWebsiteCaptureBinding(requestId, sceneId, captureId);
  const acceptance = { schema_version: "website_job_thumbnail_acceptance.v1", accepted: true as const, digest: thumbnail.digest };
  return store.runTransaction(async (tx) => {
    const jobRef = store.collection("inboundRequests").doc(requestId);
    const sessionRef = store.collection("captureUploadSessions").doc(captureId);
    const imageRef = store.collection(JOB_THUMBNAIL_COLLECTION).doc(requestId);
    const [job, session, prior] = await Promise.all([tx.get(jobRef), tx.get(sessionRef), tx.get(imageRef)]);
    await assertWebsiteCaptureBindingInTransaction(tx, requestId, binding);
    const record = job.data();
    if (!job.exists || !record) throw new Error("website_job_thumbnail_request_missing");
    if (!projectWebsiteCaptureRights(record).derived_scene_generation_allowed) throw new Error("source_revoked");
    const preview = storedWebsiteScenePreview(session.data(), captureId);
    if (!preview || preview.preview_digest !== thumbnail.scene_preview_digest) throw new Error("website_job_thumbnail_stale");
    const stored = prior.data() as StoredJobThumbnail | undefined;
    if (stored?.source === "simulation_render" && stored.sourceDigest === thumbnail.digest) return acceptance;
    const value: StoredJobThumbnail = { consentVersion: JOB_THUMBNAIL_VERSION, source: "simulation_render", digest: image.digest,
      pngBase64: image.pngBase64, scenePreviewDigest: thumbnail.scene_preview_digest, sourceDigest: thumbnail.digest,
      createdAtIso: now().toISOString() };
    tx.set(imageRef, value);
    if (record.public_task_listing?.consentVersion === JOB_SHARED_LISTING_VERSION)
      tx.set(jobRef, { public_task_listing: { thumbnailDigest: image.digest, thumbnailSource: value.source } }, { merge: true });
    return acceptance;
  });
}
