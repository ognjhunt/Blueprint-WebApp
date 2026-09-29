/** Read-only original website owner and exact producer source observation. */
import { createHash } from "node:crypto";
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { buildBrowserDelivery, capturedWriteIdentity, type BrowserDeliveryRecord,
  type WrittenObject } from "./websiteCaptureDelivery";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";
import { bundleDigest, planDigestOf, SITE_CAPTURE_BUNDLE_PLAN_SCHEMA,
  SITE_CAPTURE_COMPLETION_SCHEMA, type BundlePlanRecord } from "./siteCaptureBundle";
import { strictBoundedProofJson } from "./strictBoundedProofJson";

type Metadata = Record<string, unknown>;
type Snapshot = { data: Record<string, any>; updateTime: { seconds: number; nanoseconds: number } };

export interface OwnerObservationDeps {
  bucket: string;
  now(): number;
  readRequest(requestId: string): Promise<Snapshot | null>;
  readPinned(name: string, generation: string, limit: number): Promise<{ metadata: Metadata; bytes: Buffer }>;
  readMetadata(name: string, generation: string | null): Promise<Metadata>;
}

const sha = (bytes: Buffer) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const generation = (value: unknown) => typeof value === "string" && /^[1-9][0-9]{0,19}$/.test(value);
const cleanIso = (value: unknown) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

function sameUpdateTime(a: Snapshot["updateTime"], b: Snapshot["updateTime"]): boolean {
  return a.seconds === b.seconds && a.nanoseconds === b.nanoseconds;
}

function validUpdateTime(value: Snapshot["updateTime"] | undefined): value is Snapshot["updateTime"] {
  return Boolean(value && Number.isSafeInteger(value.seconds) && value.seconds >= 0
    && Number.isInteger(value.nanoseconds) && value.nanoseconds >= 0 && value.nanoseconds < 1_000_000_000);
}

function sameObject(a: WrittenObject, b: WrittenObject): boolean {
  return a.object_name === b.object_name && a.generation === b.generation
    && a.size_bytes === b.size_bytes && a.crc32c === b.crc32c;
}

function parseBoundedJson(bytes: Buffer, max = 65_536): Record<string, any> {
  const value = strictBoundedProofJson(bytes, max);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("owner_source_invalid");
  return value;
}

type ProducerProjection = { kind: string; delivery_key: string;
  server_record: { object_name: string; generation: string; size_bytes: number; sha256: string };
  raw_video: WrittenObject };

async function observeBundleDelivery(input: {
  requestId: string; sceneId: string; captureId: string; prefix: string;
  marker: Record<string, any>; markerBytes: Buffer;
}, deps: OwnerObservationDeps): Promise<ProducerProjection> {
  const { requestId, sceneId, captureId, prefix, marker, markerBytes } = input;
  if (marker.capture_source !== "iphone" || marker.upload_channel !== "website_capture_link_bundle"
      || marker.video_uri !== "walkthrough.mov") throw new Error("owner_bundle_marker_invalid");
  const upload = `scenes/${sceneId}/captures/${captureId}/upload`;
  const completionName = `${upload}/bundle_completion.json`;
  const planName = `${upload}/bundle_plan.json`;
  const completionCurrent = capturedWriteIdentity(completionName, await deps.readMetadata(completionName, null));
  const completionRead = await deps.readPinned(completionName, completionCurrent.generation, 1_048_576);
  if (!sameObject(capturedWriteIdentity(completionName, completionRead.metadata), completionCurrent))
    throw new Error("owner_bundle_completion_invalid");
  const completion = parseBoundedJson(completionRead.bytes, 1_048_576);
  if (completion.schema_version !== SITE_CAPTURE_COMPLETION_SCHEMA
      || completion.request_id !== requestId || completion.scene_id !== sceneId
      || completion.capture_id !== captureId || completion.raw_prefix !== prefix
      || completion.completion_marker_json !== markerBytes.toString("utf8")
      || !/^sha256:[a-f0-9]{64}$/.test(completion.plan_digest))
    throw new Error("owner_bundle_completion_invalid");
  const planCurrent = capturedWriteIdentity(planName, await deps.readMetadata(planName, null));
  const planRead = await deps.readPinned(planName, planCurrent.generation, 1_048_576);
  const plan = parseBoundedJson(planRead.bytes, 1_048_576) as BundlePlanRecord;
  if (plan.schema_version !== SITE_CAPTURE_BUNDLE_PLAN_SCHEMA
      || plan.request_id !== requestId || plan.scene_id !== sceneId
      || plan.capture_id !== captureId || plan.raw_prefix !== prefix
      || plan.plan_digest !== completion.plan_digest || planDigestOf(plan) !== plan.plan_digest)
    throw new Error("owner_bundle_plan_invalid");
  if (typeof completion.hashes_json !== "string") throw new Error("owner_bundle_hashes_invalid");
  const hashes = parseBoundedJson(Buffer.from(completion.hashes_json), 1_048_576);
  const artifacts = hashes?.artifacts;
  if (!artifacts || typeof artifacts !== "object" || Array.isArray(artifacts)
      || hashes.schema_version !== "v1" || hashes.bundle_sha256 !== bundleDigest(artifacts)
      || completion.bundle_sha256 !== hashes.bundle_sha256
      || completion.identity?.raw_bundle_digest !== `sha256:${hashes.bundle_sha256}`
      || completion.identity?.upload_completion_digest !== sha(markerBytes)
      || completion.identity?.raw_manifest_uri !== `gs://${deps.bucket}/${prefix}/manifest.json`)
    throw new Error("owner_bundle_hashes_invalid");
  const markerHex = sha(markerBytes).slice(7);
  if (artifacts["capture_upload_complete.json"] !== markerHex) throw new Error("owner_bundle_marker_hash_invalid");
  const serverFiles = completion.server_files;
  if (!serverFiles || typeof serverFiles !== "object" || !serverFiles["manifest.json"]
      || !completion.server_file_sha256 || typeof completion.server_file_sha256 !== "object")
    throw new Error("owner_bundle_server_files_invalid");
  for (const [path, content] of Object.entries(serverFiles)) {
    if (typeof content !== "string" || sha(Buffer.from(content)).slice(7) !== completion.server_file_sha256[path]
        || artifacts[path] !== completion.server_file_sha256[path]) throw new Error("owner_bundle_server_files_invalid");
  }
  const manifestName = `${prefix}/manifest.json`;
  const manifestCurrent = capturedWriteIdentity(manifestName, await deps.readMetadata(manifestName, null));
  const manifestRead = await deps.readPinned(manifestName, manifestCurrent.generation, 65_536);
  if (manifestRead.bytes.toString("utf8") !== serverFiles["manifest.json"])
    throw new Error("owner_bundle_manifest_invalid");
  const declaredVideo = Array.isArray(plan.files)
    ? plan.files.find((file) => file.path === "walkthrough.mov") : null;
  const deviceObjects = completion.device_objects;
  if (!deviceObjects || typeof deviceObjects !== "object" || Array.isArray(deviceObjects)
      || Object.keys(deviceObjects).length !== plan.files.length)
    throw new Error("owner_bundle_device_generations_invalid");
  for (const file of plan.files) {
    const original = deviceObjects[file.path];
    if (!original || !generation(original.generation)
        || original.size_bytes !== file.bytes || original.md5 !== file.md5
        || !/^[A-Za-z0-9+/]{6}==$/.test(original.crc32c))
      throw new Error("owner_bundle_device_generations_invalid");
  }
  if (!declaredVideo || !Number.isSafeInteger(declaredVideo.bytes) || declaredVideo.bytes <= 0
      || !/^[a-f0-9]{64}$/.test(declaredVideo.sha256)
      || artifacts["walkthrough.mov"] !== declaredVideo.sha256)
    throw new Error("owner_bundle_video_invalid");
  const videoName = `${prefix}/walkthrough.mov`;
  const originalVideo = deviceObjects["walkthrough.mov"];
  const videoMetadata = await deps.readMetadata(videoName, originalVideo.generation);
  const video = capturedWriteIdentity(videoName, videoMetadata);
  if (video.generation !== originalVideo.generation || video.size_bytes !== originalVideo.size_bytes
      || video.crc32c !== originalVideo.crc32c || videoMetadata.md5Hash !== declaredVideo.md5)
    throw new Error("owner_bundle_video_invalid");
  const serverRecord = { object_name: completionName, generation: completionCurrent.generation,
    size_bytes: completionCurrent.size_bytes, sha256: sha(completionRead.bytes) };
  return { kind: "website_capture_link_bundle",
    delivery_key: crossRuntimeDigest({ request_id: requestId, scene_id: sceneId,
      capture_id: captureId, plan_digest: plan.plan_digest,
      raw_bundle_digest: completion.identity.raw_bundle_digest,
      server_record: serverRecord, raw_video: video }), server_record: serverRecord, raw_video: video };
}

export async function observeWebsiteCaptureOwner(
  input: { request_id: string; scene_id: string; capture_id: string; completion_marker_generation: string },
  deps: OwnerObservationDeps,
): Promise<Record<string, any>> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(input.request_id)
      || input.scene_id !== `site-${input.request_id}`
      || input.capture_id !== `walkthrough-${input.request_id}`
      || !generation(input.completion_marker_generation)
      || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,250}$/.test(deps.bucket)) {
    throw new Error("owner_request_invalid");
  }
  const first = await deps.readRequest(input.request_id);
  if (!first || !validUpdateTime(first.updateTime)) throw new Error("owner_request_missing");
  const record = first.data;
  const owner = record.account_owner_uid;
  if (record.request?.buyerType !== "site_operator"
      || record.request?.capture_mode !== "self_capture"
      || typeof owner !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(owner)) {
    throw new Error("owner_identity_invalid");
  }
  const claimed = record.claimed_at_iso ?? null;
  if (claimed !== null && !cleanIso(claimed)) throw new Error("owner_claim_invalid");
  const attestation = record.request?.consent_attestation;
  if (attestation?.granted !== true || attestation.statement_version !== "2026-09-18.v1"
      || !cleanIso(attestation.recorded_at_iso)) throw new Error("owner_attestation_invalid");
  const consent = { granted: true, statement_version: attestation.statement_version,
    recorded_at_iso: attestation.recorded_at_iso };
  const rights = projectWebsiteCaptureRights(record);
  const prefix = `scenes/${input.scene_id}/captures/${input.capture_id}/raw`;
  const markerName = `${prefix}/capture_upload_complete.json`;
  const markerRead = await deps.readPinned(markerName, input.completion_marker_generation, 65_536);
  const markerIdentity = capturedWriteIdentity(markerName, markerRead.metadata);
  if (markerIdentity.generation !== input.completion_marker_generation
      || markerIdentity.size_bytes !== markerRead.bytes.length) throw new Error("owner_marker_invalid");
  const marker = parseBoundedJson(markerRead.bytes);
  if (marker.schema_version !== "v1" || marker.scene_id !== input.scene_id
      || marker.capture_id !== input.capture_id || marker.raw_prefix !== prefix) {
    throw new Error("owner_marker_invalid");
  }
  let producer: ProducerProjection;
  if (marker.capture_source === "browser_self_capture") {
  const selector = marker.producer_delivery;
  if (!selector || selector.kind !== "website_browser_capture_delivery"
      || !generation(selector.raw_video_generation)
      || marker.video_uri !== `${prefix}/walkthrough.mp4`
        && marker.video_uri !== `${prefix}/walkthrough.mov`) {
    throw new Error("owner_producer_invalid");
  }
  const receiptName = `scenes/${input.scene_id}/captures/${input.capture_id}/upload/producer_deliveries/browser-video-${selector.raw_video_generation}.json`;
  if (selector.object_name !== receiptName) throw new Error("owner_producer_invalid");
  const receiptCurrent = capturedWriteIdentity(receiptName, await deps.readMetadata(receiptName, null));
  const receiptRead = await deps.readPinned(receiptName, receiptCurrent.generation, 65_536);
  if (!sameObject(capturedWriteIdentity(receiptName, receiptRead.metadata), receiptCurrent)
      || receiptRead.bytes.length !== receiptCurrent.size_bytes) throw new Error("owner_receipt_invalid");
  const receipt = parseBoundedJson(receiptRead.bytes) as BrowserDeliveryRecord;
  if (receipt.schema_version !== "website_browser_capture_delivery.v1"
      || receipt.request_id !== input.request_id || receipt.scene_id !== input.scene_id
      || receipt.capture_id !== input.capture_id || receipt.raw_prefix !== prefix
      || receipt.raw_video?.object_name !== marker.video_uri
      || receipt.raw_video?.generation !== selector.raw_video_generation
      || receipt.marker_json !== markerRead.bytes.toString("utf8")
      || receipt.marker_sha256 !== sha(markerRead.bytes)) throw new Error("owner_receipt_invalid");
  const rebuilt = buildBrowserDelivery({ requestId: input.request_id, sceneId: input.scene_id,
    captureId: input.capture_id, rawPrefix: prefix, video: receipt.raw_video,
    manifest: receipt.manifest, completedAtIso: receipt.completed_at_iso });
  if (!receiptRead.bytes.equals(rebuilt.recordBytes) || !markerRead.bytes.equals(rebuilt.markerBytes)
      || selector.delivery_key !== rebuilt.record.delivery_key) throw new Error("owner_receipt_invalid");
  const selectedVideo = capturedWriteIdentity(receipt.raw_video.object_name,
    await deps.readMetadata(receipt.raw_video.object_name, receipt.raw_video.generation));
  if (!sameObject(selectedVideo, receipt.raw_video)) throw new Error("owner_video_invalid");
  const manifestRead = await deps.readPinned(receipt.manifest.object_name, receipt.manifest.generation, 65_536);
  if (!sameObject(capturedWriteIdentity(receipt.manifest.object_name, manifestRead.metadata), receipt.manifest)
      || sha(manifestRead.bytes) !== receipt.manifest.sha256) throw new Error("owner_manifest_invalid");
  producer = { kind: "website_browser_capture_delivery", delivery_key: receipt.delivery_key,
    server_record: { object_name: receiptName, generation: receiptCurrent.generation,
      size_bytes: receiptCurrent.size_bytes, sha256: sha(receiptRead.bytes) }, raw_video: receipt.raw_video };
  } else {
    producer = await observeBundleDelivery({ requestId: input.request_id, sceneId: input.scene_id,
      captureId: input.capture_id, prefix, marker, markerBytes: markerRead.bytes }, deps);
  }
  const second = await deps.readRequest(input.request_id);
  if (!second || !validUpdateTime(second.updateTime)
      || !sameUpdateTime(first.updateTime, second.updateTime)) throw new Error("owner_document_changed");
  const observedAt = deps.now();
  if (!Number.isSafeInteger(observedAt) || observedAt <= 0) throw new Error("owner_clock_invalid");
  const source = { request_id: input.request_id, scene_id: input.scene_id,
    capture_id: input.capture_id, bucket: deps.bucket, raw_prefix_uri: `gs://${deps.bucket}/${prefix}`,
    capture_owner: { user_id: owner, basis: "inboundRequests.account_owner_uid" },
    ownership_record: { claimed_at_iso: claimed }, consent_attestation: consent, capture_rights: rights };
  const response = { schema_version: "website_capture_owner_observation.v1", ...source,
    source_document: { collection: "inboundRequests", document_id: input.request_id,
      update_time: first.updateTime }, source_projection_digest: crossRuntimeDigest(source),
    completion_marker: { object_name: markerName, generation: markerIdentity.generation,
      size_bytes: markerIdentity.size_bytes, sha256: sha(markerRead.bytes) },
    producer_delivery: producer, observed_at_epoch: observedAt,
    valid_until_epoch: observedAt + 60 };
  const result = { ...response, observation_digest: crossRuntimeDigest(response) };
  if (Buffer.byteLength(JSON.stringify(result)) > 65_536) throw new Error("owner_response_too_large");
  return result;
}
