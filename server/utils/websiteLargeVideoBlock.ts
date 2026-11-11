/**
 * Whether the job's current video was too large for frame extraction.
 *
 * The WebApp accepts an upload up to `SELF_CAPTURE_MAX_UPLOAD_BYTES` (2 GiB by default), while
 * BlueprintCapture's `extractFrames` extracts frames only from a video up to its own inline limit
 * (1,000,000,000 bytes by default, overridable in its deployment). A larger video gets no frames, no
 * delivery record and no hand-off, so the Pipeline never hears of the job and no grant is ever
 * requested. What `extractFrames` leaves is one marker beside the capture,
 * `scenes/<scene>/captures/<capture>/large_video_ingest_blocked.json`
 * (`extract_frames_large_video_block.v1`). The marker is the authority: this module reads no
 * configured limit of its own, because the deployed one is not known here.
 *
 * The marker counts only for the video still stored under the name it records, with the size it
 * records: a later, smaller upload under the same name is not blocked by an old marker. Anything
 * that does not read, or does not match, is "not blocked", which leaves the job to the sweep's
 * ordinary path; it never ends a job on a guess.
 */
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";

export const LARGE_VIDEO_BLOCK_SCHEMA = "extract_frames_large_video_block.v1";
export const LARGE_VIDEO_BLOCK_CODE = "blocked_large_video_requires_segmented_ingest";
const MAX_MARKER_BYTES = 64 * 1024;

type BucketLike = {
  file(name: string): {
    exists(): Promise<[boolean]>;
    download(): Promise<[Buffer]>;
    getMetadata(): Promise<[Record<string, unknown>]>;
  };
};

const storageBucketName = () => process.env.FIREBASE_STORAGE_BUCKET?.trim() || "blueprint-8c1ca.appspot.com";
const wholeBytes = (value: unknown): number | null => {
  const parsed = typeof value === "string" && /^[0-9]+$/.test(value) ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

export type LargeVideoBlock = { raw_video_object: string; raw_video_size_bytes: number };

/** The block for the capture's current video, or null (none, unreadable, or about another video). */
export async function largeVideoIngestBlock(identity: { sceneId: string; captureId: string },
  bucket: BucketLike | null = storageAdmin ? storageAdmin.bucket(storageBucketName()) as unknown as BucketLike : null,
): Promise<LargeVideoBlock | null> {
  if (!bucket) return null;
  const prefix = `scenes/${identity.sceneId}/captures/${identity.captureId}`;
  try {
    const marker = bucket.file(`${prefix}/large_video_ingest_blocked.json`);
    const [exists] = await marker.exists();
    if (!exists) return null;
    const [bytes] = await marker.download();
    if (bytes.length > MAX_MARKER_BYTES) return null;
    const report = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
    const size = wholeBytes(report.raw_video_size_bytes);
    const limit = wholeBytes(report.max_inline_video_bytes);
    const object = typeof report.raw_video_object === "string" ? report.raw_video_object : "";
    if (report.schema_version !== LARGE_VIDEO_BLOCK_SCHEMA || report.status !== "blocked"
      || report.block_code !== LARGE_VIDEO_BLOCK_CODE || report.scene_id !== identity.sceneId
      || report.capture_id !== identity.captureId || size === null || limit === null || !(size > limit)
      || !object.startsWith(`${prefix}/raw/`) || object.includes("..")) return null;
    // The video the marker names must still be the stored one, at the size it recorded.
    const video = bucket.file(object);
    const [videoExists] = await video.exists();
    if (!videoExists) return null;
    const [metadata] = await video.getMetadata();
    if (wholeBytes(metadata.size) !== size) return null;
    return { raw_video_object: object, raw_video_size_bytes: size };
  } catch (error) {
    logger.warn({ err: error, captureId: identity.captureId }, "Could not read a large-video block marker; the job keeps its ordinary path");
    return null;
  }
}
