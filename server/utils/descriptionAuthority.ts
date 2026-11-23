import { isDescriptionAuthorityVersion } from "../../client/src/lib/siteSubmissionAuthority";
import { isApprovedCaptureRegion, isCaptureRegion } from "../../client/src/data/captureResidency";
import { projectWebsiteCaptureRights } from "./websiteCaptureRights";

export function hasCurrentDescriptionAuthority(value: unknown, now = Date.now()): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const grant = value as Record<string, unknown>;
  const recorded = typeof grant.recorded_at_iso === "string" ? Date.parse(grant.recorded_at_iso) : NaN;
  return grant.granted === true && isDescriptionAuthorityVersion(grant.statement_version)
    && Number.isFinite(recorded) && recorded <= now
    && !grant.revoked_at_iso && !grant.withdrawn_at_iso;
}

/** A job whose site is in a known country Blueprint cannot take a video from yet (finding A-02). */
export function jobOutsideApprovedRegion(record: Record<string, any> | undefined): boolean {
  const region = record?.request?.capture_region;
  return isCaptureRegion(region) && !isApprovedCaptureRegion(region);
}

/**
 * A later recording grant may fill an absent grant, never replace a revoked one. A job outside the approved region is
 * offered none: its video can never be taken, so no sharing agreement is offered or recorded.
 */
export function canGrantInitialRecordingConsent(record: Record<string, any> | undefined): boolean {
  return record?.request?.buyerType === "site_operator" && !jobOutsideApprovedRegion(record)
    && hasCurrentDescriptionAuthority(record.request.description_authority)
    && record.request.consent_attestation == null
    && !projectWebsiteCaptureRights(record).consent_revoked;
}
