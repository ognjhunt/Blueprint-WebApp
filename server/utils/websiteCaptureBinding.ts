/** Authoritative supplementary lineage. A matching ID alone grants no authority. */
import { createHash } from "node:crypto";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { humanDecisionDigest } from "./human-reply-admission";
import { supplementIdentity } from "./captureSupplement";
import { resolveBundleStorage, type BundleStorage } from "./siteCaptureBundleStorage";
import { bundleDigest } from "./siteCaptureBundle";

const sha = (bytes: string) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const digest = (value: unknown) => humanDecisionDigest(value);

export async function assertWebsiteCaptureBindingInTransaction(tx: { get(ref: any): Promise<any> }, requestId: string,
  binding: Record<string, any> | undefined) {
  if (!binding) return;
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  for (const entry of binding.lineage) {
    const link = (await tx.get(db.collection("captureSupplements").doc(entry.child.capture_id))).data();
    if (link?.requestId !== requestId || link.sceneId !== `site-${requestId}`
      || digest(link.supplement) !== digest(entry.supplement)) throw new Error("website_capture_binding_lineage_changed");
    for (const source of [entry.child, entry.parent]) {
      const stored = (await tx.get(db.collection("captureUploadSessions").doc(source.capture_id))).data();
      if (stored?.site_capture_bundle?.request_id !== requestId || stored.site_capture_bundle.scene_id !== `site-${requestId}`
        || stored.immutable_upload_identity?.raw_bundle_digest !== source.raw_bundle_digest
        || stored.immutable_upload_identity?.raw_manifest_uri !== source.raw_manifest_uri
        || stored.immutable_upload_identity?.upload_completion_digest !== source.upload_completion_digest)
        throw new Error("website_capture_binding_source_changed");
    }
  }
}

async function finalized(captureId: string, requestId: string, sceneId: string, storage: BundleStorage) {
  const snap = await db!.collection("captureUploadSessions").doc(captureId).get();
  const record = snap.data();
  const identity = record?.immutable_upload_identity;
  const prefix = `scenes/${sceneId}/captures/${captureId}`;
  if (record?.site_capture_bundle?.request_id !== requestId || record.site_capture_bundle.scene_id !== sceneId
    || record.site_capture_bundle.capture_id !== captureId
    || identity?.raw_manifest_uri !== `gs://${storage.bucketName}/${prefix}/raw/manifest.json`)
    throw new Error("website_capture_binding_source_mismatch");
  const names = [`${prefix}/raw/capture_upload_complete.json`, `${prefix}/upload/bundle_completion.json`];
  const before = await Promise.all(names.map(name => storage.info(name)));
  if (before.some(row => !row?.generation)) throw new Error("website_capture_binding_not_finalized");
  const [markerBytes, completionBytes] = await Promise.all(names.map(name => storage.readText(name)));
  if (!markerBytes || !completionBytes || sha(markerBytes) !== identity.upload_completion_digest)
    throw new Error("website_capture_binding_source_changed");
  const marker = JSON.parse(markerBytes), completion = JSON.parse(completionBytes);
  if (marker.status !== "complete" || marker.capture_id !== captureId || marker.scene_id !== sceneId
    || completion.request_id !== requestId || completion.scene_id !== sceneId || completion.capture_id !== captureId
    || completion.completion_marker_json !== markerBytes || digest(completion.identity) !== digest(identity))
    throw new Error("website_capture_binding_source_mismatch");
  const hashes = JSON.parse(completion.hashes_json);
  if (`sha256:${bundleDigest(hashes.artifacts)}` !== identity.raw_bundle_digest
    || hashes.bundle_sha256 !== identity.raw_bundle_digest.slice(7)) throw new Error("website_capture_binding_source_changed");
  const manifestName = `${prefix}/raw/manifest.json`;
  const manifestInfo = await storage.info(manifestName);
  const manifestBytes = await storage.readText(manifestName);
  if (!manifestInfo?.generation || !manifestBytes || manifestBytes !== completion.server_files?.["manifest.json"]
    || sha(manifestBytes).slice(7) !== hashes.artifacts?.["manifest.json"])
    throw new Error("website_capture_binding_source_changed");
  const manifest = JSON.parse(manifestBytes);
  if (manifest.site_submission_id !== requestId || manifest.scene_id !== sceneId || manifest.capture_id !== captureId)
    throw new Error("website_capture_binding_source_mismatch");
  const deviceObjects = completion.device_objects;
  if (!deviceObjects || !Object.keys(deviceObjects).length) throw new Error("website_capture_binding_generations_unknown");
  for (const [path, source] of Object.entries(deviceObjects) as [string, any][]) {
    if (path.split("/").some(part => part === ".." || part === "." || !part)) throw new Error("website_capture_binding_source_mismatch");
    const current = await storage.info(`${prefix}/raw/${path}`);
    if (!/^[1-9][0-9]{0,19}$/.test(source.generation ?? "") || !source.crc32c || !Number.isSafeInteger(source.size_bytes)
      || source.size_bytes < 0 || current?.generation !== source.generation || current?.size !== source.size_bytes
      || current?.crc32c !== source.crc32c) throw new Error("website_capture_binding_source_changed");
  }
  const after = await Promise.all(names.map(name => storage.info(name)));
  const manifestAfter = await storage.info(manifestName);
  const latest = (await db!.collection("captureUploadSessions").doc(captureId).get()).data();
  if (digest(before) !== digest(after) || digest(manifestInfo) !== digest(manifestAfter)
    || digest(latest?.immutable_upload_identity) !== digest(identity)) throw new Error("website_capture_binding_source_changed");
  return { capture_id: captureId, ...identity, completion_generation: before[0]!.generation!,
    completion_record_generation: before[1]!.generation!, manifest_generation: manifestInfo.generation };
}

export async function resolveWebsiteCaptureBinding(requestId: string, sceneId: string, captureId: string,
  storageOverride?: BundleStorage): Promise<Record<string, any> | undefined> {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(requestId) || sceneId !== `site-${requestId}`)
    throw new Error("task_context_capture_mismatch");
  const original = `walkthrough-${requestId}`;
  // Preserve the original read-before-upload and browser contracts.
  if (captureId === original) return undefined;
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const first = (await db.collection("captureSupplements").doc(captureId).get()).data();
  if (!first || first.captureId !== captureId || first.requestId !== requestId || first.sceneId !== sceneId)
    throw new Error("task_context_capture_mismatch");
  const storage = storageOverride ?? resolveBundleStorage();
  if (!storage) throw new Error("website_capture_binding_store_unavailable");
  const chain: Record<string, any>[] = [];
  const seen = new Set<string>();
  let current = captureId;
  while (current !== original) {
    if (seen.has(current) || chain.length >= 8) throw new Error("website_capture_binding_lineage_limit");
    seen.add(current);
    const record = (await db.collection("captureSupplements").doc(current).get()).data();
    if (!record || record.captureId !== current || record.requestId !== requestId || record.sceneId !== sceneId)
      throw new Error("task_context_capture_mismatch");
    const parentId = record.supplement?.parent_capture_id;
    const expected = supplementIdentity({ requestId, sceneId, captureId: parentId, exp: 1 },
      { raw_bundle_digest: record.supplement?.parent_bundle_digest, raw_manifest_uri: record.supplement?.parent_manifest_uri },
      record.parent_coverage);
    if (expected.captureId !== current || digest(expected.supplement) !== digest(record.supplement))
      throw new Error("website_capture_binding_lineage_changed");
    const child = await finalized(current, requestId, sceneId, storage);
    const parent = await finalized(parentId, requestId, sceneId, storage);
    if (parent.raw_bundle_digest !== record.supplement.parent_bundle_digest
      || parent.raw_manifest_uri !== record.supplement.parent_manifest_uri)
      throw new Error("website_capture_binding_source_changed");
    const latest = (await db.collection("captureSupplements").doc(current).get()).data();
    if (digest(latest) !== digest(record)) throw new Error("website_capture_binding_lineage_changed");
    chain.push({ supplement: record.supplement, child, parent });
    current = parentId;
  }
  return { schema_version: "website_capture_continuation.v1", original_capture_id: original,
    capture_id: captureId, lineage: chain, coordinate_frames_independent: true };
}
