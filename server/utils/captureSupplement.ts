import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { createCaptureUploadToken, type CaptureSupplementBinding } from "./captureUploadToken";
import { humanDecisionDigest } from "./human-reply-admission";
import { websiteSessionSource } from "./websiteCaptureSource";

type ParentLink = { requestId: string; sceneId: string; captureId: string; scope?: "owner" | "film"; exp: number };

export function supplementIdentity(parent: ParentLink, identity: Record<string, any>, coverage: Record<string, any>) {
  if (!/^sha256:[a-f0-9]{64}$/.test(identity?.raw_bundle_digest) || !identity?.raw_manifest_uri
    || coverage?.capture_id !== parent.captureId || coverage?.covers_scene !== false
    || !Array.isArray(coverage.missing_coverage) || !coverage.missing_coverage.length) throw new Error("supplement_not_requested");
  const supplement: CaptureSupplementBinding = { parent_capture_id: parent.captureId,
    parent_bundle_digest: identity.raw_bundle_digest, parent_manifest_uri: identity.raw_manifest_uri,
    coverage_digest: humanDecisionDigest(coverage),
    ...(coverage.recording_scope === "additional_views" ? { recording_scope: "additional_views" as const } : {}) };
  return { captureId: `supplement-${humanDecisionDigest({ requestId: parent.requestId, sceneId: parent.sceneId, supplement }).slice(0, 40)}`, supplement };
}

export async function issueCaptureSupplement(parent: ParentLink, repair?: { mode: "replacement" | "additional_views" | "append_views"; requestId: string }) {
  if (parent.scope === "film") throw new Error("supplement_owner_required");
  if (repair && (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(repair.requestId)
    || !["replacement", "additional_views", "append_views"].includes(repair.mode))) throw new Error("supplement_request_invalid");
  if (!db) throw new Error("capture_store_unavailable");
  const result = await db.runTransaction(async tx => {
    const request = await tx.get(db!.collection("inboundRequests").doc(parent.requestId));
    const record = request.data();
    const selectedId = String(record?.active_capture_id || record?.capture_coverage?.capture_id || parent.captureId);
    const retainedCoverage = record?.capture_coverage;
    // The retained additional_views request meant a complete walkthrough.
    // append_views explicitly opts into the new multi-recording input contract.
    const coverage = repair && repair.mode !== "append_views" ? { status: "owner_requested_update",
      capture_id: selectedId, covers_scene: false, missing_coverage: ["An updated complete walkthrough of the job"],
      supplement_would_finish: false, repair_request_id: repair.requestId }
      : repair?.mode === "append_views" ? { status: "owner_requested_additional_views", capture_id: selectedId,
        covers_scene: false, missing_coverage: retainedCoverage?.capture_id === selectedId
          && Array.isArray(retainedCoverage.missing_coverage) && retainedCoverage.missing_coverage.length
          ? retainedCoverage.missing_coverage : ["Additional views of the job"],
        supplement_would_finish: false, repair_request_id: repair.requestId, recording_scope: "additional_views" }
      : retainedCoverage;
    // An owner link remains a capability for this job even if a newer revision
    // was selected on another device. Always bind the update to the current
    // retained source; never redirect bytes into an earlier capture.
    const currentId = selectedId;
    if (parent.captureId !== `walkthrough-${parent.requestId}`) {
      const link = (await tx.get(db!.collection("captureSupplements").doc(parent.captureId))).data();
      if (link?.requestId !== parent.requestId || link.sceneId !== parent.sceneId || link.captureId !== parent.captureId)
        throw new Error("supplement_parent_mismatch");
    }
    const effectiveParent = { ...parent, captureId: currentId };
    const session = await tx.get(db!.collection("captureUploadSessions").doc(currentId));
    const value = session.data();
    const source = websiteSessionSource(value, parent.requestId, parent.sceneId, currentId);
    const result = supplementIdentity(effectiveParent, source.identity, coverage);
    const ref = db!.collection("captureSupplements").doc(result.captureId);
    const prior = await tx.get(ref);
    if (!prior.exists) tx.create(ref, { ...result, requestId: parent.requestId, sceneId: parent.sceneId,
      parent_coverage: coverage, recording_scope: result.supplement.recording_scope ?? "complete_walkthrough",
      state: "awaiting_upload", created_at: new Date().toISOString() });
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
  const record = child.data();
  const source = websiteSessionSource(parent.data(), payload.requestId, payload.sceneId, payload.supplement.parent_capture_id);
  if (record?.requestId !== payload.requestId || record.sceneId !== payload.sceneId
    || humanDecisionDigest(record.supplement) !== humanDecisionDigest(payload.supplement)
    || (record.recording_scope ?? "complete_walkthrough") !== (payload.supplement.recording_scope ?? "complete_walkthrough")
    || source.identity.raw_bundle_digest !== payload.supplement.parent_bundle_digest
    || source.identity.raw_manifest_uri !== payload.supplement.parent_manifest_uri) throw new Error("supplement_parent_changed");
}

/** Select only a completed, source-verified child; prior results remain historical. */
export async function activateCaptureSupplement(payload: { requestId: string; sceneId: string; captureId: string;
  supplement?: CaptureSupplementBinding }) {
  if (!payload.supplement) return;
  if (!db) throw new Error("capture_store_unavailable");
  const { resolveWebsiteCaptureBinding, assertWebsiteCaptureBindingInTransaction } = await import("./websiteCaptureBinding");
  const binding = await resolveWebsiteCaptureBinding(payload.requestId, payload.sceneId, payload.captureId);
  await db.runTransaction(async tx => {
    const ref = db!.collection("inboundRequests").doc(payload.requestId);
    const current = (await tx.get(ref)).data();
    await assertWebsiteCaptureBindingInTransaction(tx, payload.requestId, binding);
    const { projectWebsiteCaptureRights } = await import("./websiteTaskContext");
    if (!projectWebsiteCaptureRights(current).derived_scene_generation_allowed) throw new Error("source_revoked");
    if (current?.active_capture_id && ![payload.supplement!.parent_capture_id, payload.captureId].includes(current.active_capture_id))
      throw new Error("capture_update_superseded");
    tx.set(ref, { active_capture_id: payload.captureId,
      active_recording_scope: payload.supplement?.recording_scope ?? "complete_walkthrough" }, { merge: true });
  });
}
