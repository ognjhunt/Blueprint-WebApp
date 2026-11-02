/** Recording authority is separate from business screening and listing consent. */
import {
  RECORDING_RIGHTS_STATEMENT_VERSION,
  isRecordingRightsStatementVersion,
} from "../../client/src/lib/recordingRightsStatement";

/** The version of the sentence a site is shown now. A grant records the version the site attested. */
export const RECORDING_CONSENT_VERSION = RECORDING_RIGHTS_STATEMENT_VERSION;

/** Only a version in the closed set grants recording rights; v1 records stay valid. */
export function hasCurrentRecordingConsent(value: unknown, now = Date.now()): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const grant = value as Record<string, unknown>;
  const recorded = typeof grant.recorded_at_iso === "string" ? Date.parse(grant.recorded_at_iso) : NaN;
  return grant.granted === true && isRecordingRightsStatementVersion(grant.statement_version)
    && Number.isFinite(recorded) && recorded <= now
    && !grant.revoked_at_iso && !grant.withdrawn_at_iso;
}
