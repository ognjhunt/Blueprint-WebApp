/** Recording authority is separate from business screening and listing consent. */
import {
  RECORDING_RIGHTS_STATEMENT_VERSION,
  isRecordingRightsStatementVersion,
} from "../../client/src/lib/recordingRightsStatement";
import { isInternalTestRecordingGrant } from "./internalTestJob";

/** The version of the sentence a site is shown now. A grant records the version the site attested. */
export const RECORDING_CONSENT_VERSION = RECORDING_RIGHTS_STATEMENT_VERSION;

/**
 * Whether a grant names a version that grants recording rights: one in the closed set of statements a site is shown
 * (v1 records stay valid), or the internal test version in the one shape only the internal test route builds
 * (`internalTestJob.ts`). The internal version is in no sharing list.
 */
export function isRecordingGrantVersion(grant: Record<string, unknown>): boolean {
  return isRecordingRightsStatementVersion(grant.statement_version) || isInternalTestRecordingGrant(grant);
}

/** Only a version in the closed set grants recording rights; v1 records stay valid. */
export function hasCurrentRecordingConsent(value: unknown, now = Date.now()): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const grant = value as Record<string, unknown>;
  const recorded = typeof grant.recorded_at_iso === "string" ? Date.parse(grant.recorded_at_iso) : NaN;
  return grant.granted === true && isRecordingGrantVersion(grant)
    && Number.isFinite(recorded) && recorded <= now
    && !grant.revoked_at_iso && !grant.withdrawn_at_iso;
}
