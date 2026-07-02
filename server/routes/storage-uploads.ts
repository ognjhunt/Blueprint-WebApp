import { Router, type Request, type Response } from "express";
import multer from "multer";

import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { attachRequestMeta, logger } from "../logger";
import {
  isClientWritableStoragePath,
  resolveStorageProviderName,
  safeStorageFileName,
  sanitizeStorageObjectPath,
  uploadToBackblaze,
} from "../utils/storage-provider";

const router = Router();

type UploadedFile = {
  originalname: string;
  buffer: Buffer;
  mimetype?: string;
  size: number;
};

type StorageUploadRequest = Request & {
  file?: UploadedFile;
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(
      process.env.STORAGE_UPLOAD_MAX_FILE_SIZE_BYTES ??
        process.env.B2_MAX_FILE_SIZE_BYTES ??
        100 * 1024 * 1024,
    ),
  },
});

function isAdminUser(firebaseUser: Record<string, unknown> | undefined) {
  if (!firebaseUser) {
    return false;
  }
  if (firebaseUser.admin === true || firebaseUser.role === "admin") {
    return true;
  }
  return Array.isArray(firebaseUser.roles) && firebaseUser.roles.includes("admin");
}

async function ownsBlueprintPath(uid: string, blueprintId: string) {
  if (!db || !blueprintId) {
    return false;
  }
  const snapshot = await db.collection("blueprints").doc(blueprintId).get();
  if (!snapshot.exists) {
    return false;
  }
  const data = (snapshot.data() || {}) as Record<string, unknown>;
  return [data.host, data.ownerId, data.createdBy, data.userId].some(
    (value) => value === uid,
  );
}

async function canWriteObjectPath(params: {
  uid: string;
  admin: boolean;
  objectPath: string;
}) {
  if (params.admin) {
    return true;
  }

  const segments = params.objectPath.split("/");
  const [root, ownerOrId] = segments;
  if (!root || !ownerOrId) {
    return false;
  }

  if (root === "menus") {
    return true;
  }

  if (root === "blueprints") {
    return ownsBlueprintPath(params.uid, ownerOrId);
  }

  if (["users", "accounts", "captures", "capture-artifacts"].includes(root)) {
    return ownerOrId === params.uid;
  }

  return false;
}

function getRequestedObjectPath(req: Request, fallbackFileName: string) {
  const rawPath = String((req.body as Record<string, unknown> | undefined)?.path || "");
  const rawFolder = String((req.body as Record<string, unknown> | undefined)?.folder || "");
  const requestedPath =
    rawPath ||
    (rawFolder ? `${rawFolder.replace(/\/+$/, "")}/${fallbackFileName}` : fallbackFileName);
  return sanitizeStorageObjectPath(requestedPath);
}

router.post("/", upload.single("file"), async (req: StorageUploadRequest, res: Response) => {
  const firebaseUser = res.locals.firebaseUser as
    | { uid?: string; email?: string; admin?: boolean; role?: string; roles?: string[] }
    | undefined;
  const uid = String(firebaseUser?.uid || "").trim();
  const provider = resolveStorageProviderName();
  const file = req.file;
  const logContext = attachRequestMeta({
    requestId: res.locals?.requestId,
    route: "storage-uploads",
    provider,
    uid,
    hasFile: Boolean(file),
  });

  if (!uid) {
    return res.status(401).json({ error: "Missing authenticated user" });
  }
  if (!file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const fileName = safeStorageFileName(file.originalname);
  const objectPath = getRequestedObjectPath(req, fileName);
  if (!objectPath || !isClientWritableStoragePath(objectPath)) {
    logger.warn({ ...logContext, objectPath }, "Rejected storage upload path");
    return res.status(400).json({ error: "Unsupported storage object path" });
  }

  const permitted = await canWriteObjectPath({
    uid,
    admin: isAdminUser(firebaseUser),
    objectPath,
  });
  if (!permitted) {
    logger.warn({ ...logContext, objectPath }, "Denied storage upload path");
    return res.status(403).json({ error: "Storage path access denied" });
  }

  if (provider !== "backblaze") {
    return res.status(409).json({
      error: "Server storage provider is not Backblaze.",
      provider,
    });
  }

  try {
    const result = await uploadToBackblaze({
      objectPath,
      data: file.buffer,
      contentType: file.mimetype || "application/octet-stream",
    });

    logger.info(
      {
        ...logContext,
        objectPath,
        fileSize: file.size,
      },
      "Storage upload completed",
    );

    return res.status(200).json(result);
  } catch (error) {
    logger.error({ ...logContext, objectPath, err: error }, "Storage upload failed");
    return res.status(500).json({ error: "Storage upload failed" });
  }
});

export default router;
