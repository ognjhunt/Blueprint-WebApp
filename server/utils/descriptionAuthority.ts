import { DESCRIPTION_AUTHORITY_VERSION } from "../../client/src/lib/siteSubmissionAuthority";
import { projectWebsiteCaptureRights } from "./websiteTaskContext";

export function hasCurrentDescriptionAuthority(value: unknown, now = Date.now()): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const grant = value as Record<string, unknown>;
  const recorded = typeof grant.recorded_at_iso === "string" ? Date.parse(grant.recorded_at_iso) : NaN;
  return grant.granted === true && grant.statement_version === DESCRIPTION_AUTHORITY_VERSION
    && Number.isFinite(recorded) && recorded <= now
    && !grant.revoked_at_iso && !grant.withdrawn_at_iso;
}

/** A later recording grant may fill an absent grant, never replace a revoked one. */
export function canGrantInitialRecordingConsent(record: Record<string, any> | undefined): boolean {
  return record?.request?.buyerType === "site_operator"
    && hasCurrentDescriptionAuthority(record.request.description_authority)
    && record.request.consent_attestation == null
    && !projectWebsiteCaptureRights(record).consent_revoked;
}
