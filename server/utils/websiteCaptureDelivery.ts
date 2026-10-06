/** Immutable server-side proof of one browser upload's completed Storage writes. */
import { createHash } from "node:crypto";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";

const generationPattern = /^[1-9][0-9]{0,19}$/;
const shaPattern = /^sha256:[a-f0-9]{64}$/;

export type WrittenObject = {
  object_name: string;
  generation: string;
  size_bytes: number;
  crc32c: string;
};

export type WrittenManifest = WrittenObject & { sha256: string };

function sha256(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function validGeneration(value: unknown): value is string {
  return typeof value === "string" && generationPattern.test(value);
}

function validWrittenObject(value: WrittenObject): boolean {
  return typeof value.object_name === "string"
    && Buffer.byteLength(value.object_name, "utf8") <= 4096
    && validGeneration(value.generation)
    && Number.isSafeInteger(value.size_bytes) && value.size_bytes > 0
    && typeof value.crc32c === "string"
    && /^[A-Za-z0-9+/]{6}==$/.test(value.crc32c);
}

type WriteIdentityField = "object_name" | "generation" | "size" | "crc32c";
class CaptureWriteIdentityError extends Error {
  constructor(readonly identityField: WriteIdentityField) {
    super("capture_write_identity_unavailable");
  }
}

export type CaptureWriteStage = "task_context_read" | "capture_rights_read" | "manifest_build"
  | "stored_upload_record" | "stored_video_verify" | "manifest_generation_read"
  | "manifest_write" | "manifest_identity" | "pending_record";
const safeWriteErrors = new Set([
  "capture_write_identity_unavailable", "browser_manifest_write_unverified", "browser_delivery_source_changed",
  "browser_pending_unavailable", "browser_pending_bundle_conflict", "browser_pending_changed",
  "browser_pending_invalid", "browser_pending_conflict", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
]);

/** Log only fixed stages and known codes; SDK messages/objects can contain private data. */
export function captureWriteFailureDiagnostic(stage: CaptureWriteStage, error: unknown): {
  stage: CaptureWriteStage; code: string | number; identityField?: WriteIdentityField;
} {
  let suppliedCode: unknown;
  let suppliedMessage: unknown;
  try {
    if (error instanceof CaptureWriteIdentityError) {
      const identityField = error.identityField;
      if (identityField === "object_name" || identityField === "generation" || identityField === "size" || identityField === "crc32c")
        return { stage, code: "capture_write_identity_unavailable", identityField };
    }
    if (error && typeof error === "object") {
      const candidate = error as { code?: unknown; message?: unknown };
      // Snapshot unknown accessors once; diagnostics must not break the response.
      suppliedCode = candidate.code;
      suppliedMessage = candidate.message;
    }
  } catch {
    return { stage, code: "unknown" };
  }
  const code = typeof suppliedCode === "number" && Number.isInteger(suppliedCode)
    && (suppliedCode >= 1 && suppliedCode <= 16 || suppliedCode >= 100 && suppliedCode <= 599)
    ? suppliedCode
    : typeof suppliedCode === "string" && safeWriteErrors.has(suppliedCode) ? suppliedCode
      : typeof suppliedMessage === "string" && safeWriteErrors.has(suppliedMessage) ? suppliedMessage : "unknown";
  return { stage, code };
}

/** `metadata` is the response attached to this File by its completed write. */
export function capturedWriteIdentity(objectName: string, metadata: unknown): WrittenObject {
  const value = metadata && typeof metadata === "object"
    ? metadata as Record<string, unknown> : {};
  // Storage 7.21 resumable writes turn JSON size into a number before attaching
  // File.metadata; simple writes and metadata reads preserve the decimal string.
  // Byte counts are safe integers. Object generations remain exact strings.
  const size = typeof value.size === "string" && /^(0|[1-9][0-9]*)$/.test(value.size)
    ? Number(value.size) : typeof value.size === "number" ? value.size : NaN;
  if (value.name !== objectName) throw new CaptureWriteIdentityError("object_name");
  if (!validGeneration(value.generation)) throw new CaptureWriteIdentityError("generation");
  if (!Number.isSafeInteger(size) || size <= 0) throw new CaptureWriteIdentityError("size");
  if (typeof value.crc32c !== "string" || !/^[A-Za-z0-9+/]{6}==$/.test(value.crc32c))
    throw new CaptureWriteIdentityError("crc32c");
  return { object_name: objectName, generation: value.generation,
    size_bytes: size, crc32c: value.crc32c };
}

export interface BrowserDeliveryRecord {
  schema_version: "website_browser_capture_delivery.v1";
  request_id: string;
  scene_id: string;
  capture_id: string;
  raw_prefix: string;
  delivery_key: string;
  raw_video: WrittenObject;
  manifest: WrittenManifest;
  marker_json: string;
  marker_sha256: string;
  completed_at_iso: string;
}

export interface BrowserDelivery {
  objectName: string;
  markerBytes: Buffer;
  record: BrowserDeliveryRecord;
  recordBytes: Buffer;
}

/** Build marker bytes once; subsequent retries may only replay these bytes. */
export function buildBrowserDelivery(input: {
  requestId: string; sceneId: string; captureId: string; rawPrefix: string;
  video: WrittenObject; manifest: WrittenManifest; completedAtIso: string;
}): BrowserDelivery {
  const expected = `scenes/${input.sceneId}/captures/${input.captureId}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(input.requestId)
      || input.sceneId !== `site-${input.requestId}`
      || input.captureId !== `walkthrough-${input.requestId}`
      || input.rawPrefix !== `${expected}/raw`
      || !input.video.object_name.startsWith(`${input.rawPrefix}/walkthrough.`)
      || !/\.(mov|mp4)$/.test(input.video.object_name)
      || input.manifest.object_name !== `${input.rawPrefix}/manifest.json`
      || !validWrittenObject(input.video)
      || !validWrittenObject(input.manifest)
      || !shaPattern.test(input.manifest.sha256)
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input.completedAtIso)
      || !Number.isFinite(Date.parse(input.completedAtIso))
      || new Date(input.completedAtIso).toISOString() !== input.completedAtIso) {
    throw new Error("browser_delivery_input_invalid");
  }
  const objectName = `${expected}/upload/producer_deliveries/browser-video-${input.video.generation}.json`;
  const deliveryKey = crossRuntimeDigest({
    request_id: input.requestId, scene_id: input.sceneId,
    capture_id: input.captureId, raw_video: input.video, manifest: input.manifest,
  });
  const markerBytes = Buffer.from(JSON.stringify({
    schema_version: "v1",
    scene_id: input.sceneId,
    capture_id: input.captureId,
    raw_prefix: input.rawPrefix,
    capture_source: "browser_self_capture",
    video_uri: input.video.object_name,
    completed_at_iso: input.completedAtIso,
    producer_delivery: {
      kind: "website_browser_capture_delivery",
      object_name: objectName,
      raw_video_generation: input.video.generation,
      delivery_key: deliveryKey,
    },
  }, null, 2));
  const record: BrowserDeliveryRecord = {
    schema_version: "website_browser_capture_delivery.v1",
    request_id: input.requestId, scene_id: input.sceneId,
    capture_id: input.captureId, raw_prefix: input.rawPrefix,
    delivery_key: deliveryKey, raw_video: input.video, manifest: input.manifest,
    marker_json: markerBytes.toString("utf8"), marker_sha256: sha256(markerBytes),
    completed_at_iso: input.completedAtIso,
  };
  const recordBytes = Buffer.from(JSON.stringify(record));
  if (recordBytes.length > 65_536 || markerBytes.length > 65_536) {
    throw new Error("browser_delivery_too_large");
  }
  return { objectName, markerBytes, record, recordBytes };
}

type DeliveryFile = {
  metadata?: unknown;
  save(bytes: Buffer, options: Record<string, unknown>): Promise<unknown>;
  download(): Promise<[Buffer, ...unknown[]]>;
  getMetadata(): Promise<[Record<string, unknown>, ...unknown[]]>;
};

type DeliveryBucket = { file(name: string, options?: { generation: string }): DeliveryFile };

/** Create-only under upload/, then compare any replay against the exact stored bytes. */
export async function writeBrowserDelivery(
  bucket: DeliveryBucket, delivery: BrowserDelivery,
): Promise<"created" | "matched"> {
  const file = bucket.file(delivery.objectName);
  try {
    await file.save(delivery.recordBytes, {
      contentType: "application/json", resumable: false,
      preconditionOpts: { ifGenerationMatch: 0 },
    });
    const written = capturedWriteIdentity(delivery.objectName, file.metadata);
    if (written.size_bytes !== delivery.recordBytes.length) throw new Error("browser_delivery_write_unverified");
    return "created";
  } catch (error) {
    if ((error as { code?: unknown })?.code !== 412) throw error;
    const [meta] = await file.getMetadata();
    const selected = capturedWriteIdentity(delivery.objectName, meta);
    if (selected.size_bytes !== delivery.recordBytes.length) throw new Error("browser_delivery_conflict");
    const pinned = bucket.file(delivery.objectName, { generation: selected.generation });
    const [bytes] = await pinned.download();
    if (!bytes.equals(delivery.recordBytes)) throw new Error("browser_delivery_conflict");
    const [after] = await pinned.getMetadata();
    if (capturedWriteIdentity(delivery.objectName, after).generation !== selected.generation) {
      throw new Error("browser_delivery_conflict");
    }
    return "matched";
  }
}

function sameObject(a: WrittenObject, b: WrittenObject): boolean {
  return a.object_name === b.object_name && a.generation === b.generation
    && a.size_bytes === b.size_bytes && a.crc32c === b.crc32c;
}

/** Check both canonical source names before publishing the independently stored receipt. */
export async function publishBrowserDelivery(
  bucket: DeliveryBucket, delivery: BrowserDelivery,
): Promise<WrittenObject> {
  for (const selected of [delivery.record.raw_video, delivery.record.manifest]) {
    const [metadata] = await bucket.file(selected.object_name).getMetadata();
    if (!sameObject(capturedWriteIdentity(selected.object_name, metadata), selected)) {
      throw new Error("browser_delivery_source_changed");
    }
  }
  await writeBrowserDelivery(bucket, delivery);
  const markerName = `${delivery.record.raw_prefix}/capture_upload_complete.json`;
  const file = bucket.file(markerName);
  let current: WrittenObject | null = null;
  try {
    const [metadata] = await file.getMetadata();
    current = capturedWriteIdentity(markerName, metadata);
  } catch (error) {
    if ((error as { code?: unknown })?.code !== 404) throw error;
  }
  if (current) {
    const [existingBytes] = await bucket.file(markerName, { generation: current.generation }).download();
    if (existingBytes.equals(delivery.markerBytes)) return current;
  }
  await file.save(delivery.markerBytes, {
    contentType: "application/json", resumable: false,
    // The Storage API accepts decimal generation strings; converting to a JS
    // number would round the usual 20-digit generation and defeat this CAS.
    preconditionOpts: { ifGenerationMatch: (current?.generation ?? 0) as number },
  });
  const written = capturedWriteIdentity(markerName, file.metadata);
  if (written.size_bytes !== delivery.markerBytes.length) throw new Error("browser_marker_write_unverified");
  return written;
}
