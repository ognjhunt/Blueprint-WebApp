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

import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { logger } from "../logger";
import {
  selfCaptureObjectPath,
  verifyCaptureUploadToken,
} from "../utils/captureUploadToken";

const router = Router();

/**
 * Container formats a phone actually produces. Everything else is rejected at
 * the door rather than discovered by ffmpeg three minutes later.
 */
const ALLOWED_EXTENSIONS = new Set(["mov", "mp4", "m4v"]);

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

function extensionOf(fileName: string) {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

function storageBucketName() {
  return process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
}

/**
 * What the link opens to: enough for the page to tell someone what to film.
 *
 * Returns nothing about the site or the buyer. A link that leaks who a customer
 * is to anyone who receives it forwarded is a worse problem than a link that is
 * slightly less helpful.
 */
router.get("/:token", async (req: Request, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({ error: "This upload link is not valid or has expired." });
  }

  return res.json({
    ok: true,
    captureId: payload.captureId,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    accepts: [...ALLOWED_EXTENSIONS],
  });
});

router.post("/:token", upload.single("video"), async (req: UploadRequest, res: Response) => {
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload) {
    return res.status(404).json({ error: "This upload link is not valid or has expired." });
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

  // The destination comes from the signed token, never from the request body,
  // so a caller cannot aim someone else's capture prefix at their own file.
  const objectPath = selfCaptureObjectPath({
    sceneId: payload.sceneId,
    captureId: payload.captureId,
    extension,
  });

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

  // Nothing is triggered from here. Writing the object is the trigger: the
  // extractFrames function fires on it, and the rest of the chain follows.
  return res.status(201).json({
    ok: true,
    captureId: payload.captureId,
    message: "Got it. We'll build the scene and come back to you.",
  });
});

export default router;
