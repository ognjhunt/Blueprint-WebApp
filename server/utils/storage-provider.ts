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
