/** The existing immutable browser manifest and compatibility metadata parser. */
import type { VideoProbe } from "./selfCaptureMediaMetadata";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { websiteCaptureRetention } from "./websiteCaptureRetention";

/** Retained manifest metadata; new uploads are measured locally by the server. */
export type BrowserVideoMetadata = {
  widthPx: number;
  heightPx: number;
  fps: number;
  durationSeconds: number;
  recordedAtEpochMs: number;
  captureStartBasis?: "server_upload_received";
  probe?: VideoProbe;
};

export function parseVideoMetadata(input: unknown): BrowserVideoMetadata | null {
  if (!input || typeof input !== "object") return null;
  const source = input as Record<string, unknown>;

  const positive = (value: unknown) => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const widthPx = positive(source.widthPx);
  const heightPx = positive(source.heightPx);
  const fps = positive(source.fps);
  const durationSeconds = positive(source.durationSeconds);
  const recordedAtEpochMs = positive(source.recordedAtEpochMs);

  if (!widthPx || !heightPx || !fps || !durationSeconds || !recordedAtEpochMs) {
    return null;
  }

  return { widthPx, heightPx, fps, durationSeconds, recordedAtEpochMs };
}

/**
 * The raw-bundle manifest for a capture with no ARKit behind it.
 *
 * Deliberately a v1 manifest: declaring `schema_version: "v3"` would pull in
 * `coordinate_frame_session_id`, `capture_profile_id` and the rest of the
 * on-device contract, none of which exists for a video someone filmed in a
 * browser. Claiming that shape would be describing a capture we did not make.
 *
 * `has_lidar: false` and an unrecognised `capture_source` are both honest:
 * `normalizeCaptureSource` maps anything it does not know to `unknown`, and the
 * extractor already handles pose-free video that way.
 */
export function buildBrowserCaptureManifest(input: {
  payload: { sceneId: string; captureId: string; requestId: string };
  objectPath: string;
  video: BrowserVideoMetadata | null;
  sizeBytes: number;
  taskContext?: { description: string; confirmed: boolean; confirmed_at: string | null };
  captureRights?: ReturnType<typeof projectWebsiteCaptureRights>;
  firstReceivedAtIso?: string;
}): Record<string, unknown> {
  return {
    schema_version: "v1",
    scene_id: input.payload.sceneId,
    capture_id: input.payload.captureId,
    // The extractor blocks a capture that cannot name the submission behind it,
    // and rightly: a walkthrough nobody can trace to a request is an orphan.
    // Self-capture does have one, so it carries it. What it has no equivalent
    // of is `capture_job_id` -- nobody was dispatched and nobody is owed -- and
    // the extractor treats that absence as a warning for this source rather
    // than demanding a job that never existed.
    site_submission_id: input.payload.requestId,
    request_id: input.payload.requestId,
    ...(input.taskContext ? { site_task_context: {
      schema_version: "website_site_task_context.v1",
      request_id: input.payload.requestId,
      ...input.taskContext,
    } } : {}),
    video_uri: input.objectPath,
    // Not a device we ever saw. Naming it for what it is beats inventing a
    // handset model to satisfy a required string.
    device_model: "browser_self_capture",
    os_version: "unknown",
    capture_source: "browser_self_capture",
    capture_rights: input.captureRights ?? projectWebsiteCaptureRights(undefined),
    retention: websiteCaptureRetention(input.firstReceivedAtIso ?? null),
    capture_tier_hint: "video_only",
    has_lidar: false,
    ...(input.video ? { fps_source: input.video.fps,
    width: input.video.widthPx, height: input.video.heightPx,
    capture_start_epoch_ms: input.video.recordedAtEpochMs,
    duration_seconds: input.video.durationSeconds } : { media_probe_pending: true }),
    ...(input.video?.probe ? { video_metadata_provenance: input.video.probe,
      capture_start_epoch_ms_basis: input.video.captureStartBasis,
      recording_time_known: false } : {}),
    size_bytes: input.sizeBytes,
  };
}
