/** Recording authority is separate from business screening and listing consent. */
export const RECORDING_CONSENT_VERSION = "2026-09-18.v1";

export function hasCurrentRecordingConsent(value: unknown, now = Date.now()): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const grant = value as Record<string, unknown>;
  const recorded = typeof grant.recorded_at_iso === "string" ? Date.parse(grant.recorded_at_iso) : NaN;
  return grant.granted === true && grant.statement_version === RECORDING_CONSENT_VERSION
    && Number.isFinite(recorded) && recorded <= now
    && !grant.revoked_at_iso && !grant.withdrawn_at_iso;
}
