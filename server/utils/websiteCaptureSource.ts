import { createHash } from "node:crypto";
/** Portable source identities for both supported website upload producers. */
import { crossRuntimeDigest } from "./crossRuntimeCanonical";
import { buildBrowserDelivery } from "./websiteCaptureDelivery";
import { isWebsiteCaptureId } from "./websiteCaptureIdentity";

export function websiteSessionSource(record: Record<string, any> | undefined,
  requestId: string, sceneId: string, captureId: string, bucket = process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com") {
  if (!isWebsiteCaptureId(requestId, sceneId, captureId)) throw new Error("website_capture_binding_source_mismatch");
  const pending = record?.browser_pending_delivery;
  const stored = record?.browser_stored_upload;
  if (pending?.state === "held" || stored) {
    const source = pending?.state === "held" ? pending : stored;
    if (source.request_id !== requestId || source.scene_id !== sceneId || source.capture_id !== captureId)
      throw new Error("website_capture_binding_source_mismatch");
    const manifestSha256 = pending?.manifest?.sha256 ?? stored?.manifest_sha256;
    const raw = `scenes/${sceneId}/captures/${captureId}/raw`;
    if (!/^sha256:[a-f0-9]{64}$/.test(manifestSha256 ?? "") || !source.video
      || ![`${raw}/walkthrough.mp4`, `${raw}/walkthrough.mov`].includes(source.video.object_name)
      || !/^[1-9][0-9]{0,19}$/.test(source.video.generation ?? "")
      || !Number.isSafeInteger(source.video.size_bytes) || source.video.size_bytes <= 0
      || !/^[A-Za-z0-9+/]{6}==$/.test(source.video.crc32c ?? "")
      || pending && (pending.manifest?.object_name !== `${raw}/manifest.json`
        || !/^[1-9][0-9]{0,19}$/.test(pending.manifest?.generation ?? ""))
      || !pending && (typeof stored.manifest_json !== "string"
        || `sha256:${createHash("sha256").update(stored.manifest_json).digest("hex")}` !== manifestSha256))
      throw new Error("website_capture_binding_source_mismatch");
    const retained = { video: source.video, manifest_sha256: manifestSha256,
      ...(pending ? { manifest: pending.manifest } : { manifest_json: stored.manifest_json }) };
    return { identity: { raw_bundle_digest: crossRuntimeDigest({ request_id: requestId, scene_id: sceneId,
      capture_id: captureId, source: retained }), raw_manifest_uri: `gs://${bucket}/scenes/${sceneId}/captures/${captureId}/raw/manifest.json`,
      upload_completion_digest: null, verification_status: "retained_unprocessed" }, delivery: null, retained };
  }
  if (pending) {
    if (pending.state !== "published" || pending.request_id !== requestId || pending.scene_id !== sceneId
      || pending.capture_id !== captureId) throw new Error("website_capture_binding_not_finalized");
    const delivery = buildBrowserDelivery({ requestId, sceneId, captureId,
      rawPrefix: `scenes/${sceneId}/captures/${captureId}/raw`, video: pending.video,
      manifest: pending.manifest, completedAtIso: pending.completed_at_iso });
    // Browser source identity binds exact Storage generations and the manifest's
    // content hash. It is not represented as a video-content SHA-256.
    const identity = { raw_bundle_digest: delivery.record.delivery_key,
      raw_manifest_uri: `gs://${bucket}/${delivery.record.manifest.object_name}`,
      upload_completion_digest: delivery.record.marker_sha256,
      verification_status: "pending_pipeline_storage_readback" };
    return { identity, delivery, retained: null };
  }
  if (record?.site_capture_bundle?.request_id !== requestId || record.site_capture_bundle.scene_id !== sceneId
      || record.site_capture_bundle.capture_id !== captureId || !record.immutable_upload_identity)
    throw new Error("website_capture_binding_source_mismatch");
  return { identity: record.immutable_upload_identity, delivery: null, retained: null };
}
