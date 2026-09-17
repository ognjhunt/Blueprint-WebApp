/**
 * A site uploading its own walkthrough, from a browser.
 *
 * The person on the other end of this route has no account and no app. They
 * are a site employee who filmed one work area on their phone because the link
 * we emailed told them to. So the route is deliberately small: the link is the
 * credential, the video is the payload, and there is nothing to configure.
 *
 * The upload lands at the canonical capture path, which is what makes this
 * cheap rather than a second pipeline: `extractFrames` already watches that
 * prefix, so a browser upload produces frames, a World Labs world, and a
 * Pipeline handoff by exactly the same route an app capture does. Nothing
 * downstream knows or needs to know which way the video arrived.
 */

import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  composeParts,
  discardParts,
  savePart,
  storedPartIndices,
} from "../utils/captureParts";
import { z } from "zod";

import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  selfCaptureObjectPath,
  verifyCaptureUploadToken,
} from "../utils/captureUploadToken";
import { authorizeCaptureUpload } from "../utils/captureUploadAuthorization";
import { screenCaptureForPrivacy } from "../utils/capturePrivacyScreen";
import { resumeHeldPrivacyScreen } from "../utils/capturePrivacyResume";
import { reviewCaptureCoverage } from "../utils/captureCoverageReview";
import { recordCapturePrivacyScreen } from "../utils/capturePrivacyRecord";

const router = Router();

/**
 * Container formats a phone actually produces **and the extractor recognises**.
 *
 * `m4v` used to be here and was silent data loss: the upload succeeded, the
 * object landed, and `captureObjectKind` in `cloud/extract-frames` matches only
 * `walkthrough.mov` and `walkthrough.mp4`, so the file was ignored forever
 * while the site was told we had it. This list is the extractor's list, and if
 * one grows the other has to.
 */
export const ALLOWED_EXTENSIONS = new Set(["mov", "mp4"]);

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.SELF_CAPTURE_MAX_UPLOAD_BYTES ?? DEFAULT_MAX_BYTES),
  },
});

type UploadRequest = Request & {
  file?: { originalname: string; buffer: Buffer; mimetype?: string; size: number };
};

function safeJsonParse(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extensionOf(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

function storageBucketName() {
  return process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
}

/**
 * What the page measured about the video, as opposed to what it assumed.
 *
 * `validateManifest` in `cloud/extract-frames` requires width, height,
 * `fps_source` and `capture_start_epoch_ms`, and a capture whose manifest fails
 * validation produces a blocked report rather than a scene. None of those four
 * can be read from the file server-side — this deployment has no ffprobe — so
 * the browser reads them off a `<video>` element and sends them here.
 *
 * Every one is a measurement. Nothing is defaulted to a plausible number,
 * because a fabricated frame rate would ride along in the capture record as
 * though somebody had observed it.
 */
export type BrowserVideoMetadata = {
  widthPx: number;
  heightPx: number;
  fps: number;
  durationSeconds: number;
  recordedAtEpochMs: number;
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
  video: BrowserVideoMetadata;
  sizeBytes: number;
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
    video_uri: input.objectPath,
    // Not a device we ever saw. Naming it for what it is beats inventing a
    // handset model to satisfy a required string.
    device_model: "browser_self_capture",
    os_version: "unknown",
    capture_source: "browser_self_capture",
    capture_tier_hint: "video_only",
    has_lidar: false,
    fps_source: input.video.fps,
    width: input.video.widthPx,
    height: input.video.heightPx,
    capture_start_epoch_ms: input.video.recordedAtEpochMs,
    duration_seconds: input.video.durationSeconds,
    size_bytes: input.sizeBytes,
  };
}

/**
 * What the link opens to: enough for the page to tell someone what to film, or
 * why they cannot yet.
 *
 * Returns nothing about the site or the buyer. A link that leaks who a customer
 * is to anyone who receives it forwarded is a worse problem than a link that is
 * slightly less helpful. The hold reasons below are the site's own answers read
 * back to it, which is not a leak: it already knows what it told us.
 *
 * `state` is read live rather than baked into the token, so the same URL is a
 * status page while something is in the way and an upload page the moment it
 * is not. Nobody has to send a second link.
 */
/**
 * Find the video a capture already uploaded.
 *
 * The signed token carries the scene and capture ids but not the file
 * extension, and the retry path needs the real object path to name in the
 * marker. Rather than guess, this asks storage what is actually there -- the
 * manifest is written beside the video before the privacy screen runs, so for
 * any capture that can be held, both exist.
 */
async function resolveStoredObjectPath(
  sceneId: string,
  captureId: string,
): Promise<{ rawPrefix: string; objectPath: string } | null> {
  if (!storageAdmin) return null;
  for (const extension of ALLOWED_EXTENSIONS) {
    const objectPath = selfCaptureObjectPath({ sceneId, captureId, extension });
    try {
      const [exists] = await storageAdmin
        .bucket(storageBucketName())
        .file(objectPath)
        .exists();
      if (exists) {
        return { rawPrefix: objectPath.slice(0, objectPath.lastIndexOf("/")), objectPath };
      }
    } catch {
      // A storage error on one candidate extension is not a reason to stop
      // looking at the others.
    }
  }
  return null;
}

/**
 * The marker that starts extraction.
 *
 * Extracted because two paths write it now: the upload itself, and a retry that
 * finally got an answer out of the privacy screen. One implementation, because
 * the extractor checks `raw_prefix` against the object's own path and a second
 * copy of that contract would be a second chance to get it wrong.
 */
async function writeCompletionMarker(params: {
  sceneId: string;
  captureId: string;
  rawPrefix: string;
  objectPath: string;
}): Promise<void> {
  if (!storageAdmin) throw new Error("Storage is unavailable");
  await storageAdmin
    .bucket(storageBucketName())
    .file(`${params.rawPrefix}/capture_upload_complete.json`)
    .save(
      JSON.stringify(
        {
          schema_version: "v1",
          scene_id: params.sceneId,
          capture_id: params.captureId,
          // Checked against the object's own path by the extractor. Stated
          // here so a marker copied to the wrong prefix is caught rather than
          // silently processed against another capture's video.
          raw_prefix: params.rawPrefix,
          capture_source: "browser_self_capture",
          video_uri: params.objectPath,
          completed_at_iso: new Date().toISOString(),
        },
        null,
        2,
      ),
      { contentType: "application/json" },
    );
}

/**
 * Everything that happens once the bytes are in the bucket.
 *
 * Extracted because there are two ways in now -- a single POST and a composed
 * set of resumable parts -- and only one of them may exist as code. The
 * sequence it owns is load-bearing in two places:
 *
 * - **Manifest before marker.** The marker starts extraction and extraction
 *   reads the manifest, so the reverse order produces a blocked report rather
 *   than a scene.
 * - **Privacy screen between them.** This is the only moment the video is in
 *   hand and nothing has been derived from it. A parts route that wrote its own
 *   marker would bypass the screen, and no later gate can un-copy the frames
 *   that would follow.
 */
async function finishStoredCapture(params: {
  payload: { requestId: string; sceneId: string; captureId: string };
  objectPath: string;
  rawPrefix: string;
  videoMetadata: BrowserVideoMetadata;
  sizeBytes: number;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const { payload, objectPath, rawPrefix } = params;

  if (!storageAdmin) {
    return {
      status: 503,
      body: { error: "Uploads are unavailable right now. Try again shortly." },
    };
  }
  const bucket = storageAdmin.bucket(storageBucketName());

  const manifest = buildBrowserCaptureManifest({
    payload: payload as never,
    objectPath,
    video: params.videoMetadata,
    sizeBytes: params.sizeBytes,
  });

  try {
    await bucket
      .file(`${rawPrefix}/manifest.json`)
      .save(JSON.stringify(manifest, null, 2), { contentType: "application/json" });
  } catch (error) {
    logger.error(
      { error, captureId: payload.captureId },
      "Self-capture video stored but the manifest failed",
    );
    return {
      status: 502,
      body: {
        error: "Your video reached us but we could not start processing it. We have been alerted.",
      },
    };
  }

  const privacy = await screenCaptureForPrivacy({
    requestId: payload.requestId,
    sceneId: payload.sceneId,
    captureId: payload.captureId,
  });

  await recordCapturePrivacyScreen({
    requestId: payload.requestId,
    captureId: payload.captureId,
    result: privacy,
  });

  if (!privacy.proceed) {
    // 200 and `ok: true`, because the upload genuinely succeeded. Accepting
    // fails open; only deriving fails closed. Telling someone their video
    // failed when we are holding it would send them off to re-film something
    // we already have.
    //
    // The two cases read differently to whoever is looking at them.
    // `rejected` needs a person and asking again will not change it.
    // `pending` is our problem and retries on its own.
    return {
      status: 200,
      body: {
        ok: true,
        captureId: payload.captureId,
        state: "held",
        eligibility: privacy.eligibility,
        retryable: privacy.retryable ?? false,
        code:
          privacy.eligibility === "pending"
            ? "capture_review_unavailable"
            : "capture_privacy_review",
        message: privacy.detail,
      },
    };
  }

  try {
    await writeCompletionMarker({
      sceneId: payload.sceneId,
      captureId: payload.captureId,
      rawPrefix,
      objectPath,
    });
  } catch (error) {
    // The video is already stored, so this is recoverable by rewriting the
    // marker rather than re-uploading hundreds of megabytes. Say so plainly
    // instead of reporting a success that will never produce a scene.
    logger.error(
      { error, captureId: payload.captureId, sceneId: payload.sceneId },
      "Self-capture video stored but completion marker failed; capture will not extract",
    );
    return {
      status: 502,
      body: {
        error: "Your video reached us but we could not start processing it. We have been alerted.",
      },
    };
  }

  // The coverage read, and the reason it is here rather than awaited: the
  // operator is standing in a warehouse holding a phone, and a model
  // traversing a two-minute video is not something to make them wait on. The
  // finding is stored on the request, so the task page and the supply query
  // both pick it up whenever it lands.
  //
  // Deliberately after the privacy screen. Coverage is a question about the
  // footage and privacy is a question about whether we may read the footage at
  // all -- asking the second one second would be the ordering mistake Tier 3
  // exists to fix.
  void reviewCaptureCoverage({
    requestId: payload.requestId,
    sceneId: payload.sceneId,
    captureId: payload.captureId,
  }).catch((error) => {
    // Never fails the upload. A missing coverage finding means we do not know
    // which views are short, which is worse than knowing and much better than
    // telling somebody their capture failed when it did not.
    logger.warn(
      { error, captureId: payload.captureId },
      "Coverage review could not be started for a stored capture",
    );
  });

  return {
    status: 201,
    body: {
      ok: true,
      captureId: payload.captureId,
      eligibility: privacy.eligibility,
      message: "Got it. We'll build the scene and come back to you.",
    },
  };
}

router.get("/:token", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({ error: "This upload link is not valid or has expired." });
  }

  // The cheap half of the promise that nothing gets stranded. The screen holds
  // when it cannot get an answer, so something has to ask again -- and the
  // caller who cares is here, asking how their upload is doing. Recovery does
  // not wait on a scheduler being switched on in this deployment.
  let resumed: Awaited<ReturnType<typeof resumeHeldPrivacyScreen>> | null = null;
  try {
    resumed = await resumeHeldPrivacyScreen({
      requestId: payload.requestId,
      captureId: payload.captureId,
      sceneId: payload.sceneId,
    });

    if (resumed.action === "cleared") {
      // It cleared on retry, so the thing that was missing is the marker. The
      // extension is not on the token, so it comes from the stored manifest
      // path -- see `resolveStoredObjectPath`.
      const stored = await resolveStoredObjectPath(payload.sceneId, payload.captureId);
      if (stored) {
        await writeCompletionMarker({
          sceneId: payload.sceneId,
          captureId: payload.captureId,
          rawPrefix: stored.rawPrefix,
          objectPath: stored.objectPath,
        });
      } else {
        logger.error(
          { requestId: payload.requestId, captureId: payload.captureId },
          "Privacy screen cleared on retry but the stored video could not be located",
        );
      }
    }
  } catch (error) {
    // Never fail a status check over a retry. The site asked a question; the
    // answer is still available whether or not the retry worked.
    logger.warn(
      { error, requestId: payload.requestId, captureId: payload.captureId },
      "Could not resume a held privacy screen on status poll",
    );
  }

  const authorization = await authorizeCaptureUpload(payload.requestId);

  return res.json({
    ok: true,
    captureId: payload.captureId,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    accepts: [...ALLOWED_EXTENSIONS],
    state: authorization.allowed ? "ready" : "held",
    holdReason: authorization.holdReason,
    detail: authorization.detail,
    blockers: authorization.blockers,
    openQuestions: authorization.openQuestions,
    // Present only when something was actually being held, so an ordinary
    // status check does not grow a field that reads as a problem.
    ...(resumed && resumed.action !== "nothing_held"
      ? { review: { action: resumed.action } }
      : {}),
  });
});

router.post("/:token", upload.single("video"), async (req: UploadRequest, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({ error: "This upload link is not valid or has expired." });
  }

  // Before anything else about the file. A token now reaches sites that have
  // not cleared the screen -- that is what makes the link worth issuing at
  // submit -- so holding one is no longer the same as being allowed to use it.
  // Checking here rather than only in the page is the whole security boundary:
  // the page is a convenience, this is the rule.
  const authorization = await authorizeCaptureUpload(payload.requestId);
  if (!authorization.allowed) {
    return res.status(409).json({
      error: authorization.detail || "This capture cannot start yet.",
      code: authorization.holdReason || "capture_held",
      blockers: authorization.blockers,
    });
  }

  const file = req.file;
  if (!file || !file.size) {
    return res.status(400).json({ error: "No video was attached." });
  }

  const extension = extensionOf(file.originalname);
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return res.status(415).json({
      error: "Upload a video straight from your phone — .mov or .mp4.",
    });
  }

  if (!storageAdmin) {
    logger.error({ captureId: payload.captureId }, "Self-capture upload attempted without storage");
    return res.status(503).json({ error: "Uploads are unavailable right now. Try again shortly." });
  }

  // Refused before the bytes are stored rather than after. Without these the
  // manifest cannot validate, and an invalid manifest means the extractor
  // writes a blocked report instead of a scene -- which would look, from the
  // site's side, exactly like a successful upload.
  const videoMetadata = parseVideoMetadata(safeJsonParse(req.body?.metadata));
  if (!videoMetadata) {
    return res.status(400).json({
      error: "We could not read this video's dimensions. Try recording in your phone's camera app.",
      code: "video_metadata_missing",
    });
  }

  // The destination comes from the signed token, never from the request body,
  // so a caller cannot aim someone else's capture prefix at their own file.
  const objectPath = selfCaptureObjectPath({
    sceneId: payload.sceneId,
    captureId: payload.captureId,
    extension,
  });
  const rawPrefix = objectPath.slice(0, objectPath.lastIndexOf("/"));

  try {
    await storageAdmin
      .bucket(storageBucketName())
      .file(objectPath)
      .save(file.buffer, {
        contentType: file.mimetype || "video/quicktime",
        resumable: false,
        metadata: {
          metadata: {
            capture_id: payload.captureId,
            scene_id: payload.sceneId,
            request_id: payload.requestId,
            capture_mode: "self_capture",
          },
        },
      });
  } catch (error) {
    logger.error(
      { error, captureId: payload.captureId },
      "Self-capture upload failed to write to storage",
    );
    return res.status(502).json({ error: "The upload did not finish. Try again." });
  }

  logger.info(
    { captureId: payload.captureId, sceneId: payload.sceneId, bytes: file.size },
    "Self-capture walkthrough uploaded",
  );

  // The video alone triggers nothing. `extractFrames` fires on the object, sees
  // `objectKind === "walkthrough"` outside the legacy `targets/` layout, and
  // returns immediately -- "Skipping walkthrough trigger until upload
  // completion marker arrives". The iOS uploader writes a whole raw bundle and
  // ends with that marker; a browser upload has to do the same two files or the
  // capture sits in the bucket forever while the site is told we have it.
  //
  // Order is load-bearing. The manifest must exist before the marker, because
  // the marker is what starts extraction and extraction reads the manifest.
  const manifest = buildBrowserCaptureManifest({
    payload,
    objectPath,
    video: videoMetadata,
    sizeBytes: file.size,
  });

  // One path from here, shared with the resumable parts route. A composed
  // capture must go through the same manifest, the same privacy screen and the
  // same marker -- a second implementation of this sequence would be a second
  // chance to skip the screen, which is exactly what Tier 3 exists to prevent.
  const outcome = await finishStoredCapture({
    payload,
    objectPath,
    rawPrefix,
    videoMetadata,
    sizeBytes: file.size,
  });

  return res.status(outcome.status).json(outcome.body);
});


/* ----------------------------------------------- resumable parts */

/**
 * The same upload, in pieces that survive a dropped connection.
 *
 * A site employee is standing in a warehouse on site wifi holding a recording
 * they cannot make again without walking back to the pallet. The single POST
 * loses all of a 200MB upload when the connection drops at 80%, and the second
 * attempt is a second favour asked of somebody who already did us one.
 *
 * Three calls: ask what is already stored, send what is missing, finish. The
 * finish goes through `finishStoredCapture`, so a composed capture gets the
 * same manifest, the same privacy screen and the same marker as a single POST.
 */

/** A part is bounded well below the whole-file limit; this is per part. */
const DEFAULT_MAX_PART_BYTES = 32 * 1024 * 1024;

const partUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.SELF_CAPTURE_MAX_PART_BYTES ?? DEFAULT_MAX_PART_BYTES),
  },
});

/** Resolve the destination for a token, without trusting the request body. */
function partsDestination(
  payload: { sceneId: string; captureId: string },
  extension: string,
): { objectPath: string; rawPrefix: string } {
  const objectPath = selfCaptureObjectPath({
    sceneId: payload.sceneId,
    captureId: payload.captureId,
    extension,
  });
  return { objectPath, rawPrefix: objectPath.slice(0, objectPath.lastIndexOf("/")) };
}

router.get("/:token/parts", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({ error: "This upload link is not valid or has expired." });
  }
  if (!storageAdmin) {
    return res.status(503).json({ error: "Uploads are unavailable right now." });
  }

  const extension = String(req.query.extension || "mp4").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return res.status(415).json({ error: "Record as .mov or .mp4." });
  }

  const { rawPrefix } = partsDestination(payload, extension);

  try {
    const stored = await storedPartIndices(
      storageAdmin.bucket(storageBucketName()) as never,
      rawPrefix,
    );
    return res.json({
      ok: true,
      captureId: payload.captureId,
      stored,
      maxPartBytes: Number(process.env.SELF_CAPTURE_MAX_PART_BYTES ?? DEFAULT_MAX_PART_BYTES),
    });
  } catch (error) {
    logger.error({ error, captureId: payload.captureId }, "Could not list capture parts");
    return res.status(503).json({ error: "We could not check what has uploaded so far." });
  }
});

router.put(
  "/:token/parts/:index",
  partUpload.single("part"),
  async (req: UploadRequest, res: Response) => {
    const payload = verifyCaptureUploadToken(String(req.params.token || ""));
    if (!payload) {
      return res.status(404).json({ error: "This upload link is not valid or has expired." });
    }

    // Re-read permission per part rather than once at the start. A submission
    // parked by a person mid-upload should stop accepting bytes, and a token
    // issued before that is not an argument for continuing.
    const authorization = await authorizeCaptureUpload(payload.requestId);
    if (!authorization.allowed) {
      return res.status(409).json({
        error: authorization.detail,
        code: authorization.holdReason,
      });
    }

    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index > 100_000) {
      return res.status(400).json({ error: "That part number is not valid." });
    }

    const extension = String(req.query.extension || "mp4").toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return res.status(415).json({ error: "Record as .mov or .mp4." });
    }

    const part = req.file;
    if (!part || !part.size) {
      return res.status(400).json({ error: "That part was empty." });
    }
    if (!storageAdmin) {
      return res.status(503).json({ error: "Uploads are unavailable right now." });
    }

    const { rawPrefix } = partsDestination(payload, extension);

    try {
      await savePart({
        bucket: storageAdmin.bucket(storageBucketName()) as never,
        rawPrefix,
        index,
        body: part.buffer,
      });
    } catch (error) {
      logger.error(
        { error, captureId: payload.captureId, index },
        "Could not store a capture part",
      );
      // 503 rather than 400: the client should retry this part, not give up on
      // the recording.
      return res.status(503).json({ error: "That part did not save. It will be retried." });
    }

    return res.json({ ok: true, index, bytes: part.size });
  },
);

const completeSchema = z
  .object({
    parts: z.number().int().min(1).max(100_000),
    extension: z.string().trim().min(1).max(8),
    metadata: z.unknown(),
    sizeBytes: z.number().int().min(1),
  })
  .strict();

router.post("/:token/parts/complete", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({ error: "This upload link is not valid or has expired." });
  }

  const authorization = await authorizeCaptureUpload(payload.requestId);
  if (!authorization.allowed) {
    return res.status(409).json({ error: authorization.detail, code: authorization.holdReason });
  }

  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "We could not read that upload's details." });
  }

  const extension = parsed.data.extension.toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return res.status(415).json({ error: "Record as .mov or .mp4." });
  }

  // Same refusal as the single POST, and for the same reason: without these the
  // manifest cannot validate, and an invalid manifest means the extractor
  // writes a blocked report instead of a scene -- which looks, from the site's
  // side, exactly like a successful upload.
  const videoMetadata = parseVideoMetadata(parsed.data.metadata);
  if (!videoMetadata) {
    return res.status(400).json({
      error: "We could not read this video's dimensions.",
      code: "video_metadata_missing",
    });
  }

  if (!storageAdmin) {
    return res.status(503).json({ error: "Uploads are unavailable right now." });
  }

  const { objectPath, rawPrefix } = partsDestination(payload, extension);
  const bucket = storageAdmin.bucket(storageBucketName()) as never;

  let composition: Awaited<ReturnType<typeof composeParts>>;
  try {
    composition = await composeParts({
      bucket,
      rawPrefix,
      objectPath,
      expectedParts: parsed.data.parts,
    });
  } catch (error) {
    logger.error(
      { error, captureId: payload.captureId },
      "Could not compose capture parts into the walkthrough",
    );
    return res.status(503).json({ error: "We could not assemble your upload. Please retry." });
  }

  if (!composition.ok) {
    // Named rather than generic, because the client can act on it: send the
    // missing parts and call complete again. Composing around a gap would
    // produce a video that is shorter than it should be and still decodes,
    // which is the worst failure available here.
    return res.status(409).json({
      error:
        composition.reason === "no_parts"
          ? "We have none of your upload yet."
          : "Some of your upload is still missing.",
      code: composition.reason,
      missing: composition.missing,
    });
  }

  const outcome = await finishStoredCapture({
    payload,
    objectPath,
    rawPrefix,
    videoMetadata,
    sizeBytes: parsed.data.sizeBytes,
  });

  // After the capture exists, never before: a failure to tidy up costs storage,
  // and a failure to tidy up early costs the recording.
  await discardParts(bucket, rawPrefix);

  return res.status(outcome.status).json(outcome.body);
});

export default router;
