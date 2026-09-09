import { randomUUID } from "node:crypto";
import { open, unlink } from "node:fs/promises";
import os from "node:os";
import type { NextFunction, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { parseTaskVideoLinks, TASK_VIDEO_MAX_BYTES, TASK_VIDEO_MAX_FILES, TASK_VIDEO_TYPES } from "../../client/src/lib/taskVideos";
import { isValidEmailAddress } from "../utils/validation";
import { logger } from "../logger";
import contactHandler from "./contact";

type LocalVideo = { path: string; originalname: string; mimetype: string; size: number };
export type ContactTaskVideo = { name: string; contentType: string; sizeBytes: number; storageUri: string; reviewUrl: string; reviewUrlExpiresAt: string };

const upload = multer({
  storage: multer.diskStorage({
    destination: os.tmpdir(),
    filename: (_req, _file, callback) => callback(null, `blueprint-task-video-${randomUUID()}`),
  }),
  limits: { files: TASK_VIDEO_MAX_FILES, fileSize: TASK_VIDEO_MAX_BYTES, fields: 16, fieldSize: 16384, parts: 20 },
  fileFilter: (_req, file, callback) => {
    if (!(TASK_VIDEO_TYPES as readonly string[]).includes(file.mimetype)) return callback(new Error("Unsupported video type"));
    callback(null, true);
  },
}).array("taskVideos", TASK_VIDEO_MAX_FILES);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many video submissions. Please try again in 15 minutes or send a video link." },
});

// Bound concurrent multipart work as well as bytes per file. Stream to temporary
// disk and Cloud Storage rather than buffering multiple videos in process memory.
let activeUploads = 0;

async function validateVideo(file: LocalVideo) {
  const handle = await open(file.path, "r");
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const isWebm = header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const isMp4OrMov = header.toString("ascii", 4, 8) === "ftyp";
    if (bytesRead < 12 || file.size === 0 || (file.mimetype === "video/webm" ? !isWebm : !isMp4OrMov)) throw new Error("Upload a valid MP4, MOV, or WebM video.");
  } finally { await handle.close(); }
}

async function receiveInquiry(req: Request, res: Response, next: NextFunction) {
  const files = (Array.isArray((req as Request & { files?: LocalVideo[] }).files) ? (req as Request & { files: LocalVideo[] }).files : []);
  const storedPaths: string[] = [];
  let bucket: ReturnType<NonNullable<typeof storageAdmin>["bucket"]> | undefined;
  try {
    const links = parseTaskVideoLinks(req.body?.taskVideoLinks);
    const uploads: ContactTaskVideo[] = [];
    if (files.length) {
      if (req.body?.requestSource !== "website-contact-form" || !["name", "email", "company", "message"].every((key) => typeof req.body?.[key] === "string" && req.body[key].trim()) || !isValidEmailAddress(req.body.email.trim())) {
        res.status(400).json({ error: "Complete your contact details and task description before uploading videos." });
        return;
      }
      if (!storageAdmin) { res.status(503).json({ error: "Video uploads are temporarily unavailable. Please use a video link instead." }); return; }
      for (const file of files) await validateVideo(file);
      bucket = storageAdmin.bucket();
      const submissionId = randomUUID();
      for (const file of files) {
        const name = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "task-video";
        const objectPath = `contact-task-videos/${submissionId}/${randomUUID()}-${name}`;
        // Track before upload: a provider failure can occur after object creation.
        storedPaths.push(objectPath);
        await bucket.upload(file.path, { destination: objectPath, resumable: false, metadata: { contentType: file.mimetype, cacheControl: "private, no-store", contentDisposition: `attachment; filename="${name}"`, metadata: { source: "website-contact-form", mediaRole: "task-demonstration" } } });
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const [reviewUrl] = await bucket.file(objectPath).getSignedUrl({ version: "v4", action: "read", expires });
        uploads.push({ name, contentType: file.mimetype, sizeBytes: file.size, storageUri: `gs://${bucket.name}/${objectPath}`, reviewUrl, reviewUrlExpiresAt: expires.toISOString() });
      }
    }
    // Only server-produced upload metadata is admitted; caller-supplied storage
    // paths are never used for reads, writes, cleanup, or trusted attachments.
    res.locals.contactTaskMedia = { links, uploads };
    if (links.length || uploads.length) {
      req.body.message = [String(req.body.message || ""), links.length ? `Task video links:\n${links.join("\n")}` : "", uploads.length ? `Uploaded task videos (private review links expire in 7 days):\n${uploads.map((video) => `${video.name}: ${video.reviewUrl}\nRetained file: ${video.storageUri}`).join("\n\n")}` : ""].filter(Boolean).join("\n\n");
    }
    await contactHandler(req, res);
  } catch (error) {
    if (!res.headersSent) {
      if (error instanceof SyntaxError || (error instanceof Error && /^(Use a complete|Add up to|Upload a valid)/.test(error.message))) {
        res.status(400).json({ error: error instanceof SyntaxError ? "Use a complete video link, one per line." : (error as Error).message });
      } else {
        logger.error({ event: "contact_task_media_failed", requestId: res.locals.requestId }, "Task video submission failed");
        res.status(503).json({ error: "We couldn’t save your inquiry and videos. Please try again or use a video link." });
      }
    } else next(error);
  } finally {
    if (!res.locals.contactRequestPersisted && bucket) {
      const cleanup = await Promise.allSettled(storedPaths.map((objectPath) => bucket!.file(objectPath).delete({ ignoreNotFound: true })));
      if (cleanup.some((result) => result.status === "rejected")) logger.warn({ event: "contact_task_media_cleanup_failed", requestId: res.locals.requestId, uploadGroupId: storedPaths[0]?.split("/")[1] }, "Unbound task videos require storage cleanup");
    }
    await Promise.allSettled(files.map((file) => unlink(file.path)));
  }
}

export default function contactTaskMediaHandler(req: Request, res: Response, next: NextFunction) {
  if (!req.is("multipart/form-data")) { void receiveInquiry(req, res, next); return; }
  uploadLimiter(req, res, () => {
    if (activeUploads >= 2) { res.status(429).json({ error: "Video uploads are busy. Please try again shortly or send a video link." }); return; }
    activeUploads++;
    upload(req, res, async (error) => {
      try {
        if (error) {
          await Promise.allSettled(((Array.isArray((req as Request & { files?: LocalVideo[] }).files) ? (req as Request & { files: LocalVideo[] }).files : [])).map((file) => unlink(file.path)));
          res.status(400).json({ error: "Upload up to 3 MP4, MOV, or WebM videos, no larger than 50 MB each." });
          return;
        }
        await receiveInquiry(req, res, next);
      } finally { activeUploads--; }
    });
  });
}
