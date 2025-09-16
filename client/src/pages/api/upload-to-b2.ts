import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Request, Response } from "express";
import multer from "multer";
// @ts-ignore - library has no types
import B2 from "backblaze-b2";

import { attachRequestMeta, logger } from "../../../../server/logger";

const MAX_FILE_SIZE_BYTES = Number(process.env.B2_MAX_FILE_SIZE_BYTES ?? 10 * 1024 * 1024);
const AUTH_CACHE_TTL_MS = Number(process.env.B2_AUTH_CACHE_TTL_MS ?? 30 * 60 * 1000);
const UPLOAD_URL_CACHE_TTL_MS = Number(process.env.B2_UPLOAD_URL_CACHE_TTL_MS ?? 10 * 60 * 1000);

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename: (_req, file, cb) => {
      const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${sanitized}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID || "",
  applicationKey: process.env.B2_APP_KEY || "",
});

type UploadTarget = {
  uploadUrl: string;
  authorizationToken: string;
  expiresAt: number;
};

let cachedAuthorizationExpiry = 0;
let cachedUploadTarget: UploadTarget | null = null;

async function ensureAuthorized(): Promise<void> {
  if (Date.now() < cachedAuthorizationExpiry) {
    return;
  }

  await b2.authorize();
  cachedAuthorizationExpiry = Date.now() + AUTH_CACHE_TTL_MS;
  cachedUploadTarget = null;
}

async function getUploadTarget(bucketId: string): Promise<UploadTarget> {
  if (cachedUploadTarget && Date.now() < cachedUploadTarget.expiresAt) {
    return cachedUploadTarget;
  }

  await ensureAuthorized();
  const { data } = await b2.getUploadUrl({ bucketId });
  cachedUploadTarget = {
    uploadUrl: data.uploadUrl,
    authorizationToken: data.authorizationToken,
    expiresAt: Date.now() + UPLOAD_URL_CACHE_TTL_MS,
  };
  return cachedUploadTarget;
}

async function removeFile(filePath: string) {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    logger.warn({ filePath }, "Failed to remove temporary upload file");
  }
}

export default function handler(req: Request, res: Response) {
  upload.single("file")(req, res, async (err: any) => {
    const logContext = attachRequestMeta({
      requestId: res.locals?.requestId,
      route: "upload-to-b2",
      hasFile: Boolean((req as any).file),
    });

    if (err) {
      logger.error({ ...logContext, err }, "Upload middleware failure");
      return res.status(400).json({ error: "File upload failed" });
    }

    const expectedToken = process.env.B2_UPLOAD_TOKEN;
    const authHeader = req.headers.authorization;

    if (!expectedToken) {
      logger.error(logContext, "Missing B2 upload token configuration");
      return res.status(500).json({ error: "Service temporarily unavailable" });
    }

    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      logger.warn(logContext, "Unauthorized upload attempt");
      return res.status(401).json({ error: "Unauthorized" });
    }

    type UploadedFile = {
      path: string;
      mimetype: string;
      size: number;
      filename: string;
    };

    const file = (req as any).file as UploadedFile | undefined;
    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (!process.env.B2_BUCKET_ID || !process.env.B2_BUCKET_NAME) {
      logger.error(logContext, "Missing B2 configuration");
      await removeFile(file.path);
      return res.status(500).json({ error: "Service temporarily unavailable" });
    }

    const folder = (req.body && (req.body as Record<string, unknown>).folder) as string | undefined;
    const safeFolder = folder && /^[\w/-]+$/.test(folder) ? folder : "models";
    const fileName = path.posix.join(safeFolder, file.filename);

    try {
      const target = await getUploadTarget(process.env.B2_BUCKET_ID);

      const fileStream = fs.createReadStream(file.path);
      await b2.uploadFile({
        uploadUrl: target.uploadUrl,
        uploadAuthToken: target.authorizationToken,
        fileName,
        data: fileStream,
        contentType: file.mimetype,
      });

      const publicUrl = `https://f005.backblazeb2.com/file/${process.env.B2_BUCKET_NAME}/${fileName}`;

      logger.info(
        attachRequestMeta({
          ...logContext,
          fileSize: file.size,
          folder: safeFolder,
        }),
        "File uploaded to Backblaze",
      );

      res.status(200).json({ url: publicUrl, fileName });
    } catch (error) {
      logger.error({ ...logContext, err: error }, "Backblaze upload failure");
      res.status(500).json({ error: "Failed to upload to B2" });
    } finally {
      await removeFile(file.path);
    }
  });
}
