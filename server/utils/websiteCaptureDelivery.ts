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

/** `metadata` is the response attached to this File by its completed write. */
export function capturedWriteIdentity(objectName: string, metadata: unknown): WrittenObject {
  const value = metadata && typeof metadata === "object"
    ? metadata as Record<string, unknown> : {};
  const size = typeof value.size === "string" && /^(0|[1-9][0-9]*)$/.test(value.size)
    ? Number(value.size) : NaN;
  if (value.name !== objectName || !validGeneration(value.generation)
      || !Number.isSafeInteger(size) || size <= 0
      || typeof value.crc32c !== "string"
      || !/^[A-Za-z0-9+/]{6}==$/.test(value.crc32c)) {
    throw new Error("capture_write_identity_unavailable");
  }
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
      || !validGeneration(input.video.generation)
      || !validGeneration(input.manifest.generation)
      || !shaPattern.test(input.manifest.sha256)
      || !Number.isFinite(Date.parse(input.completedAtIso))) {
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
