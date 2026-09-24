/**
 * Shared Terms of Service / Privacy Policy acceptance contract.
 *
 * Used by the buyer/site-operator webapp signup UI (to gate submission) and by
 * the server inbound-request route (to persist a server-derived consent record).
 *
 * Audit finding R047: buyers and site operators must accept Terms/Privacy at
 * signup, and that acceptance must be recorded server-side with the version and
 * timestamp derived on the server rather than trusting a client-only flag.
 *
 * Bump these versions whenever the published Terms or Privacy documents change
 * so new signups record consent against the current revision.
 */
export const TERMS_VERSION = "2026-09-24";
export const PRIVACY_VERSION = "2026-09-24";

/**
 * "September 23, 2026" from a version. The pages print their effective date
 * from the same constant acceptance records, so the date a visitor reads is
 * always the version they accept.
 */
export function legalEffectiveDate(version: string): string {
  const [year, month, day] = version.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

export const TERMS_URL = "/terms";
export const PRIVACY_URL = "/privacy";

export interface LegalAcceptanceRecord<TAcceptedAt = unknown> {
  accepted_terms: boolean;
  terms_version: string;
  privacy_version: string;
  terms_url: string;
  privacy_url: string;
  accepted_at: TAcceptedAt;
  accepted_from_ip_hash: string | null;
}

/** Recognize a prior server-recorded acceptance of the current documents. */
export function isCurrentLegalAcceptance(value: unknown): value is LegalAcceptanceRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.accepted_terms === true &&
    record.terms_version === TERMS_VERSION &&
    record.privacy_version === PRIVACY_VERSION &&
    record.terms_url === TERMS_URL &&
    record.privacy_url === PRIVACY_URL &&
    record.accepted_at != null;
}

/**
 * Build the persisted acceptance record. The Terms/Privacy versions and the
 * document URLs are sourced from the server-side constants above (not from the
 * client payload), and `acceptedAt` is provided by the caller (a Firestore
 * server timestamp on the real write path, an ISO string on the dev fallback).
 */
export function buildLegalAcceptanceRecord<TAcceptedAt>(params: {
  acceptedAt: TAcceptedAt;
  acceptedFromIpHash?: string | null;
}): LegalAcceptanceRecord<TAcceptedAt> {
  return {
    accepted_terms: true,
    terms_version: TERMS_VERSION,
    privacy_version: PRIVACY_VERSION,
    terms_url: TERMS_URL,
    privacy_url: PRIVACY_URL,
    accepted_at: params.acceptedAt,
    accepted_from_ip_hash: params.acceptedFromIpHash ?? null,
  };
}
