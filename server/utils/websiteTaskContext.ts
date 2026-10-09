import type { SiteTaskBriefRecord } from "./siteTaskBrief";
import { canonicalArtifactDigest } from "./taskCandidateContract";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { hasCurrentRecordingConsent } from "./recordingConsent";
import type { TaskItemInventoryRecord } from "./taskItemInventory";

/** The recorded site grant covers scene building/evaluation, never resale. */
export function projectWebsiteCaptureRights(record: Record<string, any> | undefined) {
  const request = record?.request ?? {};
  const attestation = request.consent_attestation;
  const revoked = Boolean(attestation?.revoked_at_iso || attestation?.withdrawn_at_iso)
    || [record, request, record?.capture_rights].some(value =>
    value?.consent_revoked === true || Boolean(value?.consent_revoked_at)
    || value?.consent_status === "revoked" || value?.future_processing_allowed === false);
  const granted = !revoked && hasCurrentRecordingConsent(attestation);
  return {
    derived_scene_generation_allowed: granted,
    data_licensing_allowed: false,
    capture_contributor_payout_eligible: false,
    consent_status: revoked ? "revoked" : granted ? "granted" : "unknown",
    consent_revoked: revoked,
    consent_scope: granted ? ["derived_scene_generation", "robot_evaluation"] : [],
    statement_version: attestation?.statement_version ?? null,
    recorded_at_iso: attestation?.recorded_at_iso ?? null,
  };
}

export async function loadWebsiteCaptureRights(requestId: string) {
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const snapshot = await db.collection("inboundRequests").doc(requestId).get();
  if (!snapshot.exists) return projectWebsiteCaptureRights(undefined);
  // Consent is stored in plaintext; owner/contact fields are not needed here.
  return projectWebsiteCaptureRights(snapshot.data());
}

/** Minimal, current task snapshot. Never forwards owner contact or identity. */
export function projectWebsiteTaskContext(brief: SiteTaskBriefRecord, captureRights?: ReturnType<typeof projectWebsiteCaptureRights>,
  evidence?: { inventory?: TaskItemInventoryRecord | null; captureId?: string; captureBinding?: Record<string, unknown>; purpose?: "scene_preparation" }) {
  const value = {
    schema_version: "website_site_task_context.v1",
    ...(evidence?.purpose ? { purpose: evidence.purpose } : {}),
    request_id: brief.requestId,
    scene_id: `site-${brief.requestId}`,
    capture_id: evidence?.captureId ?? `walkthrough-${brief.requestId}`,
    description: brief.summary,
    confirmed: Boolean(brief.confirmedAtIso),
    confirmed_at: brief.confirmedAtIso,
    operator_answers: brief.operatorAnswers ?? {},
    unresolved: brief.operatorUnknown ?? brief.unresolved,
    capture_rights: captureRights ?? projectWebsiteCaptureRights(undefined),
    ...(brief.operatorTaskDetails ? { operator_task_details: brief.operatorTaskDetails } : {}),
    ...(brief.successCriteria ? { success_criteria: brief.successCriteria } : {}),
    ...(brief.operatorTaskDetails || brief.successCriteria ? { task_evidence_provenance: {
      item_details: "owner_stated_unverified", success_criteria: "owner_stated_target",
      success_rate_unit: "percent", cycle_time_unit: "seconds", physical_measurements_verified: false,
    } } : {}),
    ...(evidence?.captureBinding ? { capture_binding: evidence.captureBinding } : {}),
    ...(evidence?.inventory ? { task_items: evidence.inventory.items.map(item => ({
      item_id: item.itemId, label: item.label, location_note: item.locationNote,
      quantity_hint: item.quantityHint, basis: item.basis,
      // Coverage/asset status are deliberately excluded: images are observations.
      images: item.images.map(image => {
        const prefix = `scenes/site-${brief.requestId}/items/`;
        if (!image.storagePath.startsWith(`${prefix}${item.itemId}/`) || image.storagePath.split("/").some(p => p === ".." || p === "." || !p))
          throw new Error("website_task_item_source_mismatch");
        return { image_id: image.imageId, storage_path: image.storagePath, uploaded_at_iso: image.uploadedAtIso,
          source: image.source ?? null, basis: "owner_supplied_photo", physical_metrology: false };
      }),
    })) } : {}),
  };
  return { ...value, context_digest: canonicalArtifactDigest(value, "context_digest") };
}

/** One projection used by the signed read and the spending/publication checks. */
export async function loadWebsiteTaskInventory(requestId: string): Promise<TaskItemInventoryRecord | null> {
  if (!db) throw new Error("website_capture_rights_store_unavailable");
  const record = (await db.collection("siteTaskItemInventories").doc(requestId).get()).data();
  if (!record) return null;
  if (record.requestId !== requestId || !Array.isArray(record.items)) throw new Error("website_task_item_inventory_invalid");
  return record as TaskItemInventoryRecord;
}
