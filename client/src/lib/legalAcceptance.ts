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
 *
 * A version's date is its effective date, and it may be in the future: the
 * owner decided on 2026-10-15 that an update is published ahead of time with
 * notice, and the previous version stays in force until the new date. The
 * previous versions below are frozen at /terms/previous and /privacy/previous.
 */
export const TERMS_VERSION = "2026-11-15.3";
export const PRIVACY_VERSION = "2026-11-15.4";

/** The versions in force until TERMS_VERSION / PRIVACY_VERSION take effect. */
export const PREVIOUS_TERMS_VERSION = "2026-10-14.1";
export const PREVIOUS_PRIVACY_VERSION = "2026-10-13.1";

/**
 * The date printed from a version. The pages print their effective date
 * from the same constant acceptance records, so the date a visitor reads is
 * always the version they accept.
 */
export function legalEffectiveDate(version: string): string {
  return new Date(legalEffectiveAtMs(version)).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

/**
 * When a version takes effect: 08:00 UTC on its date, which is midnight Pacific
 * standard time, so the switch is never early anywhere in the continental US.
 */
export function legalEffectiveAtMs(version: string): number {
  const [year, month, day] = version.split("-").map(Number);
  return Date.UTC(year, month - 1, day, 8);
}

/** True while the published Terms or Privacy Policy are announced but not yet in force. */
export function legalUpdatePending(nowMs = Date.now()): boolean {
  return nowMs < Math.max(legalEffectiveAtMs(TERMS_VERSION), legalEffectiveAtMs(PRIVACY_VERSION));
}

export const TERMS_URL = "/terms";
export const PRIVACY_URL = "/privacy";
export const PREVIOUS_TERMS_URL = "/terms/previous";
export const PREVIOUS_PRIVACY_URL = "/privacy/previous";

export interface LegalAcceptanceRecord<TAcceptedAt = unknown> {
  accepted_terms: boolean;
  terms_version: string;
  privacy_version: string;
  terms_url: string;
  privacy_url: string;
  accepted_at: TAcceptedAt;
  accepted_from_ip_hash: string | null;
}

/**
 * Whether an accepted Terms/Privacy pair still counts. New acceptances record
 * the published versions (the signer has seen their date). Until those take
 * effect, an acceptance of the versions in force also counts, so nobody is
 * asked to accept documents early.
 */
export function acceptedVersionsAreCurrent(terms: unknown, privacy: unknown, nowMs = Date.now()): boolean {
  if (terms === TERMS_VERSION && privacy === PRIVACY_VERSION) return true;
  // Keep the pair published October 22 usable until its announced deadline,
  // without rewriting its record as acceptance of the later Terms revision.
  return legalUpdatePending(nowMs) && (
    (terms === PREVIOUS_TERMS_VERSION && privacy === PREVIOUS_PRIVACY_VERSION)
    || (terms === "2026-11-15.2" && privacy === "2026-11-15.4"
      && nowMs < legalEffectiveAtMs("2026-11-15.2"))
  );
}

/** Recognize a prior server-recorded acceptance of the current documents. */
export function isCurrentLegalAcceptance(value: unknown): value is LegalAcceptanceRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.accepted_terms === true &&
    acceptedVersionsAreCurrent(record.terms_version, record.privacy_version) &&
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
