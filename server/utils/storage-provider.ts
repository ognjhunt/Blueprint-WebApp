import fs from "node:fs";
import path from "node:path";

// @ts-ignore - library has no types
import B2 from "backblaze-b2";

export type StorageProviderName = "firebase" | "backblaze";

export type StorageUploadInput = {
  objectPath: string;
  data: Buffer;
  contentType: string;
};

export type StorageUploadResult = {
  provider: StorageProviderName;
  objectPath: string;
  url: string;
  bucketName: string | null;
};

export type ResumableCaptureUpload = {
  provider: "backblaze";
  fileId: string;
  objectPath: string;
  bucketName: string;
  storageUri: string;
};

export type ResumableCapturePartAuthorization = {
  provider: "backblaze";
  fileId: string;
  uploadUrl: string;
  authorizationToken: string;
  expiresAtIso: string;
};

export type StoredCapturePart = {
  partNumber: number;
  contentLength: number;
  contentSha1: string;
};

export type CaptureDownloadGrant = {
  provider: "backblaze";
  url: string;
  authorizationToken: string;
  expiresAtIso: string;
};

type UploadTarget = {
  uploadUrl: string;
  authorizationToken: string;
  expiresAt: number;
};

let b2Client: any | null = null;
let cachedAuthorizationExpiry = 0;
let cachedUploadTarget: UploadTarget | null = null;

function normalizeProviderName(value: string | undefined): StorageProviderName {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "backblaze" || normalized === "b2" || normalized === "backblaze-b2") {
    return "backblaze";
  }
  return "firebase";
}

export function resolveStorageProviderName(): StorageProviderName {
  return normalizeProviderName(
    process.env.BLUEPRINT_STORAGE_PROVIDER ||
      process.env.STORAGE_PROVIDER ||
      process.env.APP_STORAGE_PROVIDER,
  );
}

export function readSecretFromEnv(names: string[]): string {
  for (const name of names) {
    const directValue = process.env[name]?.trim();
    if (directValue) {
      return directValue;
    }

    const filePath = process.env[`${name}_FILE`]?.trim();
    if (filePath) {
      try {
        const fileValue = fs.readFileSync(filePath, "utf8").trim();
        if (fileValue) {
          return fileValue;
        }
      } catch {
        return "";
      }
    }
  }
  return "";
}

function getBackblazeConfig() {
  return {
    keyId: readSecretFromEnv(["BACKBLAZE_B2_KEY_ID", "B2_KEY_ID"]),
    applicationKey: readSecretFromEnv([
      "BACKBLAZE_B2_APPLICATION_KEY",
      "B2_APP_KEY",
      "B2_APPLICATION_KEY",
    ]),
    bucketId: readSecretFromEnv(["BACKBLAZE_B2_BUCKET_ID", "B2_BUCKET_ID"]),
    bucketName: readSecretFromEnv(["BACKBLAZE_B2_BUCKET_NAME", "B2_BUCKET_NAME"]),
    publicBaseUrl:
      process.env.BACKBLAZE_B2_PUBLIC_BASE_URL?.trim() ||
      process.env.B2_PUBLIC_BASE_URL?.trim() ||
      "",
  };
}

function getBackblazeClient() {
  const config = getBackblazeConfig();
  if (!config.keyId || !config.applicationKey) {
    throw new Error("Backblaze B2 credentials are not configured.");
  }
  if (!b2Client) {
    b2Client = new B2({
      applicationKeyId: config.keyId,
      applicationKey: config.applicationKey,
    });
  }
  return b2Client;
}

async function ensureBackblazeAuthorized(): Promise<void> {
  const authCacheTtlMs = Number(process.env.B2_AUTH_CACHE_TTL_MS ?? 30 * 60 * 1000);
  if (Date.now() < cachedAuthorizationExpiry) {
    return;
  }

  await getBackblazeClient().authorize();
  cachedAuthorizationExpiry = Date.now() + authCacheTtlMs;
  cachedUploadTarget = null;
}

async function getBackblazeUploadTarget(bucketId: string): Promise<UploadTarget> {
  const uploadUrlCacheTtlMs = Number(process.env.B2_UPLOAD_URL_CACHE_TTL_MS ?? 10 * 60 * 1000);
  if (cachedUploadTarget && Date.now() < cachedUploadTarget.expiresAt) {
    return cachedUploadTarget;
  }

  await ensureBackblazeAuthorized();
  const { data } = await getBackblazeClient().getUploadUrl({ bucketId });
  cachedUploadTarget = {
    uploadUrl: data.uploadUrl,
    authorizationToken: data.authorizationToken,
    expiresAt: Date.now() + uploadUrlCacheTtlMs,
  };
  return cachedUploadTarget;
}

function buildBackblazePublicUrl(bucketName: string, objectPath: string) {
  const config = getBackblazeConfig();
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  if (config.publicBaseUrl) {
    return `${config.publicBaseUrl.replace(/\/+$/, "")}/${encodedPath}`;
  }
  return `https://f005.backblazeb2.com/file/${encodeURIComponent(bucketName)}/${encodedPath}`;
}

function buildBackblazeAuthorizedDownloadUrl(bucketName: string, objectPath: string) {
  const client = getBackblazeClient();
  const base = String(client.downloadUrl || "").trim();
  if (!base.startsWith("https://")) {
    throw new Error("Backblaze B2 did not provide a secure download endpoint.");
  }
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${base.replace(/\/+$/, "")}/file/${encodeURIComponent(bucketName)}/${encodedPath}`;
}

export function sanitizeStorageObjectPath(value: string): string | null {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.length > 512 ||
    normalized.includes("//") ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return null;
  }

  return normalized;
}

export function safeStorageFileName(value: string): string {
  const baseName = path.basename(value || "upload.bin");
  return baseName.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.bin";
}

export function isClientWritableStoragePath(objectPath: string): boolean {
  return [
    "blueprints/",
    "menus/",
    "users/",
    "accounts/",
    "captures/",
    "capture-artifacts/",
  ].some((prefix) => objectPath.startsWith(prefix));
}

export async function uploadToBackblaze(
  input: StorageUploadInput,
): Promise<StorageUploadResult> {
  const config = getBackblazeConfig();
  if (!config.bucketId || !config.bucketName) {
    throw new Error("Backblaze B2 bucket configuration is not complete.");
  }

  const target = await getBackblazeUploadTarget(config.bucketId);
  await getBackblazeClient().uploadFile({
    uploadUrl: target.uploadUrl,
    uploadAuthToken: target.authorizationToken,
    fileName: input.objectPath,
    data: input.data,
    contentType: input.contentType,
  });

  return {
    provider: "backblaze",
    objectPath: input.objectPath,
    bucketName: config.bucketName,
    url: buildBackblazePublicUrl(config.bucketName, input.objectPath),
  };
}

export async function startBackblazeResumableCapture(input: {
  objectPath: string;
  contentType: string;
}): Promise<ResumableCaptureUpload> {
  const config = getBackblazeConfig();
  if (!config.bucketId || !config.bucketName) {
    throw new Error("Backblaze B2 bucket configuration is not complete.");
  }
  await ensureBackblazeAuthorized();
  const response = await getBackblazeClient().startLargeFile({
    bucketId: config.bucketId,
    fileName: input.objectPath,
    contentType: input.contentType || "application/octet-stream",
  });
  const fileId = String(response?.data?.fileId || "").trim();
  if (!fileId) {
    throw new Error("Backblaze B2 did not return a large-file id.");
  }
  return {
    provider: "backblaze",
    fileId,
    objectPath: input.objectPath,
    bucketName: config.bucketName,
    storageUri: `b2://${config.bucketName}/${input.objectPath}`,
  };
}

export async function authorizeBackblazeCapturePart(
  fileId: string,
): Promise<ResumableCapturePartAuthorization> {
  await ensureBackblazeAuthorized();
  const response = await getBackblazeClient().getUploadPartUrl({ fileId });
  const uploadUrl = String(response?.data?.uploadUrl || "").trim();
  const authorizationToken = String(
    response?.data?.authorizationToken || "",
  ).trim();
  if (!uploadUrl || !authorizationToken) {
    throw new Error("Backblaze B2 did not return a part upload authorization.");
  }
  return {
    provider: "backblaze",
    fileId,
    uploadUrl,
    authorizationToken,
    // B2 documents a 24-hour validity. Keep the client refresh boundary
    // conservative so a resumed browser does not depend on the final hour.
    expiresAtIso: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
  };
}

export async function listBackblazeCaptureParts(
  fileId: string,
): Promise<StoredCapturePart[]> {
  await ensureBackblazeAuthorized();
  const parts: StoredCapturePart[] = [];
  let startPartNumber = 1;
  for (let page = 0; page < 10; page += 1) {
    const response = await getBackblazeClient().listParts({
      fileId,
      startPartNumber,
      maxPartCount: 1000,
    });
    const rows = Array.isArray(response?.data?.parts) ? response.data.parts : [];
    for (const row of rows) {
      parts.push({
        partNumber: Number(row.partNumber),
        contentLength: Number(row.contentLength),
        contentSha1: String(row.contentSha1 || "").toLowerCase(),
      });
    }
    const next = Number(response?.data?.nextPartNumber || 0);
    if (!Number.isInteger(next) || next <= 0) {
      return parts;
    }
    startPartNumber = next;
  }
  throw new Error("Backblaze B2 part listing exceeded the supported page limit.");
}

export async function finishBackblazeResumableCapture(input: {
  fileId: string;
  partSha1Array: string[];
}): Promise<void> {
  await ensureBackblazeAuthorized();
  await getBackblazeClient().finishLargeFile({
    fileId: input.fileId,
    partSha1Array: input.partSha1Array,
  });
}

export async function getBackblazeCaptureFileInfo(fileId: string): Promise<{
  fileId: string;
  fileName: string;
  contentLength: number;
  action: string;
}> {
  await ensureBackblazeAuthorized();
  const response = await getBackblazeClient().getFileInfo(fileId);
  return {
    fileId: String(response?.data?.fileId || ""),
    fileName: String(response?.data?.fileName || ""),
    contentLength: Number(response?.data?.contentLength || 0),
    action: String(response?.data?.action || ""),
  };
}

export async function createBackblazeCaptureDownloadGrant(input: {
  objectPath: string;
  validDurationSeconds?: number;
}): Promise<CaptureDownloadGrant> {
  const config = getBackblazeConfig();
  if (!config.bucketId || !config.bucketName) {
    throw new Error("Backblaze B2 bucket configuration is not complete.");
  }
  await ensureBackblazeAuthorized();
  const validDurationSeconds = Math.max(
    60,
    Math.min(Number(input.validDurationSeconds || 15 * 60), 60 * 60),
  );
  const response = await getBackblazeClient().getDownloadAuthorization({
    bucketId: config.bucketId,
    fileNamePrefix: input.objectPath,
    validDurationInSeconds: validDurationSeconds,
  });
  const authorizationToken = String(
    response?.data?.authorizationToken || "",
  ).trim();
  if (!authorizationToken) {
    throw new Error("Backblaze B2 did not return a download authorization.");
  }
  return {
    provider: "backblaze",
    url: buildBackblazeAuthorizedDownloadUrl(config.bucketName, input.objectPath),
    authorizationToken,
    expiresAtIso: new Date(Date.now() + validDurationSeconds * 1000).toISOString(),
  };
}

export async function cancelBackblazeResumableCapture(fileId: string): Promise<void> {
  await ensureBackblazeAuthorized();
  await getBackblazeClient().cancelLargeFile({ fileId });
}
