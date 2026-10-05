import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createCaptureUploadToken, type CaptureSupplementBinding } from "./captureUploadToken";
import { humanDecisionDigest } from "./human-reply-admission";

type ParentLink = { requestId: string; sceneId: string; captureId: string; scope?: "owner" | "film"; exp: number };

export function supplementIdentity(parent: ParentLink, identity: Record<string, any>, coverage: Record<string, any>) {
  if (!/^sha256:[a-f0-9]{64}$/.test(identity?.raw_bundle_digest) || !identity?.raw_manifest_uri
    || coverage?.capture_id !== parent.captureId || coverage?.covers_scene !== false
    || !Array.isArray(coverage.missing_coverage) || !coverage.missing_coverage.length) throw new Error("supplement_not_requested");
  const supplement: CaptureSupplementBinding = { parent_capture_id: parent.captureId,
    parent_bundle_digest: identity.raw_bundle_digest, parent_manifest_uri: identity.raw_manifest_uri,
    coverage_digest: humanDecisionDigest(coverage) };
  return { captureId: `supplement-${humanDecisionDigest({ requestId: parent.requestId, sceneId: parent.sceneId, supplement }).slice(0, 40)}`, supplement };
}

export async function issueCaptureSupplement(parent: ParentLink) {
  if (!db) throw new Error("capture_store_unavailable");
  const result = await db.runTransaction(async tx => {
    const request = await tx.get(db!.collection("inboundRequests").doc(parent.requestId));
    const coverage = request.data()?.capture_coverage;
    // Reopening the original link after another coverage pass follows only a
    // verified descendant. It never creates an unrelated capture or rewrites raw.
    const currentId = String(coverage?.capture_id || parent.captureId);
    let ancestor = currentId;
    for (let depth = 0; ancestor !== parent.captureId && depth < 8; depth++) {
      const link = (await tx.get(db!.collection("captureSupplements").doc(ancestor))).data();
      if (link?.requestId !== parent.requestId || link.sceneId !== parent.sceneId) throw new Error("supplement_parent_mismatch");
      ancestor = String(link.supplement?.parent_capture_id || "");
    }
    if (ancestor !== parent.captureId) throw new Error("supplement_lineage_limit");
    const effectiveParent = { ...parent, captureId: currentId };
    const session = await tx.get(db!.collection("captureUploadSessions").doc(currentId));
    const value = session.data();
    if (value?.site_capture_bundle?.request_id !== parent.requestId || value.site_capture_bundle.scene_id !== parent.sceneId) throw new Error("supplement_parent_mismatch");
    const result = supplementIdentity(effectiveParent, value.immutable_upload_identity, coverage);
    const ref = db!.collection("captureSupplements").doc(result.captureId);
    const prior = await tx.get(ref);
    if (!prior.exists) tx.create(ref, { ...result, requestId: parent.requestId, sceneId: parent.sceneId,
      parent_coverage: coverage, state: "awaiting_upload", created_at: new Date().toISOString() });
    return result;
  });
  return { captureId: result.captureId, token: createCaptureUploadToken({ ...parent, ...result,
    ttlSeconds: Math.max(0, parent.exp - Math.floor(Date.now() / 1000)) }) };
}

export async function validateCaptureSupplement(payload: { requestId: string; sceneId: string; captureId: string; supplement?: CaptureSupplementBinding }) {
  if (!payload.supplement) return;
  if (!db) throw new Error("capture_store_unavailable");
  const [child, parent] = await Promise.all([db.collection("captureSupplements").doc(payload.captureId).get(),
    db.collection("captureUploadSessions").doc(payload.supplement.parent_capture_id).get()]);
  const record = child.data(), source = parent.data();
  if (record?.requestId !== payload.requestId || record.sceneId !== payload.sceneId
    || humanDecisionDigest(record.supplement) !== humanDecisionDigest(payload.supplement)
    || source?.immutable_upload_identity?.raw_bundle_digest !== payload.supplement.parent_bundle_digest
    || source.site_capture_bundle?.request_id !== payload.requestId
    || source.site_capture_bundle?.scene_id !== payload.sceneId
    || source.immutable_upload_identity?.raw_manifest_uri !== payload.supplement.parent_manifest_uri) throw new Error("supplement_parent_changed");
}
