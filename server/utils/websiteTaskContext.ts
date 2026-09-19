import type { SiteTaskBriefRecord } from "./siteTaskBrief";
import { canonicalArtifactDigest } from "./taskCandidateContract";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

/** The recorded site grant covers scene building/evaluation, never resale. */
export function projectWebsiteCaptureRights(record: Record<string, any> | undefined) {
  const request = record?.request ?? {};
  const attestation = request.consent_attestation;
  const revoked = [record, request, record?.capture_rights].some(value =>
    value?.consent_revoked === true || Boolean(value?.consent_revoked_at)
    || value?.consent_status === "revoked" || value?.future_processing_allowed === false);
  const granted = !revoked && attestation?.granted === true
    && attestation.statement_version === "2026-09-18.v1"
    && typeof attestation.recorded_at_iso === "string"
    && Number.isFinite(Date.parse(attestation.recorded_at_iso));
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
export function projectWebsiteTaskContext(brief: SiteTaskBriefRecord, captureRights?: ReturnType<typeof projectWebsiteCaptureRights>) {
  const value = {
    schema_version: "website_site_task_context.v1",
    request_id: brief.requestId,
    scene_id: `site-${brief.requestId}`,
    capture_id: `walkthrough-${brief.requestId}`,
    description: brief.summary,
    confirmed: Boolean(brief.confirmedAtIso),
    confirmed_at: brief.confirmedAtIso,
    operator_answers: brief.operatorAnswers ?? {},
    unresolved: brief.operatorUnknown ?? brief.unresolved,
    capture_rights: captureRights ?? projectWebsiteCaptureRights(undefined),
  };
  return { ...value, context_digest: canonicalArtifactDigest(value, "context_digest") };
}
