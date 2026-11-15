import { hasCurrentRecordingConsent } from "./recordingConsent";
import { internalTestRightsMarker } from "./internalTestJob";

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
    // Only on an internal test job, beside its grant version, so every reader of the rights (the task context, the
    // manifest, the owner observation, the Pipeline's live rights read) can tell it is one. Absent on every other job.
    ...internalTestRightsMarker(record),
  };
}
