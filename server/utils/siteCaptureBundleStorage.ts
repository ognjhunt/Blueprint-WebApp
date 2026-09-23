/**
 * Storage for capture-link bundle uploads.
 *
 * Every write here is create-only (`ifGenerationMatch: 0`). A raw capture file
 * is never overwritten or deleted: a retry that finds its object already there
 * reads it back instead of replacing it. Device files never pass through this
 * server — they go straight to Cloud Storage on URLs signed for one object, one
 * MD5 and create-only — so a bundle of a few thousand depth maps costs a
 * handful of API calls here, not a few thousand.
 */

import { storageAdmin } from "../../client/src/lib/firebaseAdmin";

export interface BundleObjectInfo {
  name: string;
  size: number;
  /** Base64 MD5 as Cloud Storage reports it; absent for composite objects. */
  md5Hash: string | null;
}

export interface SignedPutTarget {
  url: string;
  headers: Record<string, string>;
  expiresAtIso: string;
}

export interface BundleStorage {
  readonly bucketName: string;
  /** Objects whose name starts with `prefix`; all of them unless `maxResults` is set. */
  list(prefix: string, options?: { maxResults?: number }): Promise<BundleObjectInfo[]>;
  info(name: string): Promise<BundleObjectInfo | null>;
  readText(name: string): Promise<string | null>;
  /** Create-only. Reports `exists` rather than overwriting. */
  createOnly(name: string, content: string, contentType: string): Promise<"created" | "exists">;
  signedPut(name: string, options: { md5: string; contentType: string; expiresAtMs: number }): Promise<SignedPutTarget>;
  /** A server-initiated resumable session for one object, create-only. */
  resumableSession(name: string, options: { md5: string; contentType: string; bytes: number }): Promise<string>;
}

export function captureStorageBucketName(): string {
  return process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
}

function isPreconditionFailure(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return code === 412 || code === "412";
}

function isNotFound(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code;
  return code === 404 || code === "404";
}

type AdminFile = {
  name: string;
  metadata?: Record<string, unknown>;
  getMetadata(): Promise<[Record<string, unknown>, ...unknown[]]>;
  download(): Promise<[Buffer, ...unknown[]]>;
  save(content: string | Buffer, options: Record<string, unknown>): Promise<unknown>;
  getSignedUrl(config: Record<string, unknown>): Promise<[string, ...unknown[]]>;
  createResumableUpload(options: Record<string, unknown>): Promise<[string, ...unknown[]]>;
};

type AdminBucket = {
  file(name: string): AdminFile;
  getFiles(options: Record<string, unknown>): Promise<[AdminFile[], ...unknown[]]>;
};

function objectInfo(name: string, metadata: Record<string, unknown> | undefined): BundleObjectInfo {
  const size = Number(metadata?.size ?? 0);
  const md5 = metadata?.md5Hash;
  return {
    name,
    size: Number.isFinite(size) ? size : 0,
    md5Hash: typeof md5 === "string" && md5 ? md5 : null,
  };
}

export function bundleStorageForBucket(bucket: AdminBucket, bucketName: string): BundleStorage {
  return {
    bucketName,
    async list(prefix, options) {
      const [files] = await bucket.getFiles(
        options?.maxResults
          ? { prefix, maxResults: options.maxResults, autoPaginate: false }
          : { prefix, autoPaginate: true },
      );
      return files.map((file) => objectInfo(file.name, file.metadata));
    },
    async info(name) {
      try {
        const [metadata] = await bucket.file(name).getMetadata();
        return objectInfo(name, metadata);
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async readText(name) {
      try {
        const [content] = await bucket.file(name).download();
        return content.toString("utf8");
      } catch (error) {
        if (isNotFound(error)) return null;
        throw error;
      }
    },
    async createOnly(name, content, contentType) {
      try {
        await bucket.file(name).save(content, {
          contentType,
          resumable: false,
          preconditionOpts: { ifGenerationMatch: 0 },
        });
        return "created";
      } catch (error) {
        if (isPreconditionFailure(error)) return "exists";
        throw error;
      }
    },
    async signedPut(name, options) {
      const [url] = await bucket.file(name).getSignedUrl({
        version: "v4",
        action: "write",
        expires: options.expiresAtMs,
        contentType: options.contentType,
        contentMd5: options.md5,
        extensionHeaders: { "x-goog-if-generation-match": "0" },
      });
      return {
        url,
        headers: {
          "Content-Type": options.contentType,
          "Content-MD5": options.md5,
          "x-goog-if-generation-match": "0",
        },
        expiresAtIso: new Date(options.expiresAtMs).toISOString(),
      };
    },
    async resumableSession(name, options) {
      const [uri] = await bucket.file(name).createResumableUpload({
        metadata: { contentType: options.contentType, md5Hash: options.md5 },
        preconditionOpts: { ifGenerationMatch: 0 },
      });
      return uri;
    },
  };
}

/** The deployment's capture bucket, or null when storage is not configured. */
export function resolveBundleStorage(): BundleStorage | null {
  if (!storageAdmin) return null;
  const bucketName = captureStorageBucketName();
  return bundleStorageForBucket(storageAdmin.bucket(bucketName) as unknown as AdminBucket, bucketName);
}

/** Content type for a planned object, which the signed URL binds. */
export function bundleContentType(path: string): string {
  if (path.endsWith(".mov")) return "video/quicktime";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".jsonl")) return "application/x-ndjson";
  if (path.endsWith(".obj")) return "text/plain";
  return "application/octet-stream";
}
