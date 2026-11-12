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
 *
 * Owner, 2026-11-02: the corrected documents (D-16: people are not removed from
 * job footage; faces are blurred only in the frames sent to World Labs) take
 * effect at once instead of on November 15. Every job with footage was the
 * owner's own, and the corrected text is the accurate one.
 */
/*
 * 2026-11-12 (owner: "sharing is the service"; PACKAGE_D D1.2). The new version says a started job is shared with the
 * deployment companies Blueprint approves. It takes effect at once, as the 2026-11-02 correction did, and it replaces
 * the version published ahead as 2026-11-25.1 before that version took effect. Its text keeps everything 2026-11-25.1
 * changed (the filming visits retired) and adds the sharing.
 *
 * Who it binds, and how: a person accepts it only by an act of their own, never by continuing to use the Service.
 * - A site starting a job from the release accepts it under the start form's line (recorded in `terms_acceptance`).
 * - A site with an older job accepts it by agreeing to recording statement v4 on the job's page, which records it on the
 *   job (`server/utils/jobSharedListing.ts`). Until then the job keeps what it was promised: it is not shown to any
 *   company, and its stored acceptance stays as it is under its own version id.
 * - A signed-in account whose recorded acceptance is 2026-11-02.1 or 2026-11-25.1 is asked to accept the current
 *   versions the next time it is checked (`acceptedVersionsAreCurrent` is false for them; `server/routes/workspace.ts`).
 * The permission to share a job never rests on the Terms alone: it rests on recording statement v4.
 */
export const TERMS_VERSION = "2026-11-12.1";
export const PRIVACY_VERSION = "2026-11-12.1";
/**
 * Published ahead on 2026-11-11 for November 25 and replaced before it took effect. Acceptances recorded under it keep
 * it; its text is frozen at `client/src/pages/TermsAnnounced.tsx` and `PrivacyAnnounced.tsx` (not routed). It no
 * longer counts as current.
 */
export const ANNOUNCED_SUPERSEDED_VERSION = "2026-11-25.1";

/**
 * The versions in force until TERMS_VERSION / PRIVACY_VERSION take effect.
 *
 * 2026-11-11 revision (owner: Blueprint filming visits retired): the visit
 * offer leaves the Terms and the Privacy Policy. Following the 2026-10-15
 * convention it is published ahead with a future effective date, so the
 * notice Terms section 12 promises can be given before it takes effect. The
 * date is a placeholder for the owner to confirm; no notice is sent by code.
 */
export const PREVIOUS_TERMS_VERSION = "2026-11-02.1";
export const PREVIOUS_PRIVACY_VERSION = "2026-11-02.1";

/**
 * SHA-256 of each legal page's source file, pinned to the version above it. A change to a page's text needs a new
 * version approved by the owner; `client/tests/legalPages.pinned.test.ts` fails on any byte change until both the
 * version and this digest are updated together.
 */
export const LEGAL_PAGE_DIGESTS = {
  "client/src/pages/Terms.tsx": { version: TERMS_VERSION, sha256: "e3ce4d98b176b3f35a9983b2a0ecbbc46b88a8bab7c7335a2391270fcbba3b47" },
  "client/src/pages/Privacy.tsx": { version: PRIVACY_VERSION, sha256: "b4507322dc8b084a704689bae96c83704da9f885f24b1b0a19eee98e885b80bf" },
  "client/src/pages/TermsAnnounced.tsx": { version: ANNOUNCED_SUPERSEDED_VERSION, sha256: "2a56699800d45d0ce2d63598021799a7abbc3027612b1cdfaaf9c0c98cf2cd97" },
  "client/src/pages/PrivacyAnnounced.tsx": { version: ANNOUNCED_SUPERSEDED_VERSION, sha256: "ae47ecfdb9bbf404ac0d070c02816d2a99f7d4460616e8b06435fbbcb3f115f9" },
  "client/src/pages/TermsPrevious.tsx": { version: PREVIOUS_TERMS_VERSION, sha256: "37a4885464a275f5236ed3dd0edee9b148bbeea9bdc80b6ab7f7b9a4dfb8d7bb" },
  "client/src/pages/PrivacyPrevious.tsx": { version: PREVIOUS_PRIVACY_VERSION, sha256: "cad7fcac5cc1ec468ab74471a13a5e61a208b697deafd97b4039f01ab38eab3c" },
} as const;
/** The versions the digests above were recorded against; a version bump without a new digest fails the same test. */
export const LEGAL_PAGE_DIGEST_VERSIONS = {
  terms: "2026-11-12.1", privacy: "2026-11-12.1", previousTerms: "2026-11-02.1", previousPrivacy: "2026-11-02.1",
  announced: "2026-11-25.1",
} as const;

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
 * the published versions (the signer has seen their date). While an update is
 * announced but not yet in force, an acceptance of the versions in force also
 * counts, so nobody is asked to accept documents early.
 */
export function acceptedVersionsAreCurrent(terms: unknown, privacy: unknown, nowMs = Date.now()): boolean {
  if (terms === TERMS_VERSION && privacy === PRIVACY_VERSION) return true;
  // The same corrected text, published earlier on 2026-11-02 under the announced
  // November 15 date. The earlier November 15 pairs said people were removed
  // from footage, so they no longer count.
  // They counted as 2026-11-02.1, which is now the previous version.
  if (!legalUpdatePending(nowMs)) return false;
  if (terms === "2026-11-15.4" && privacy === "2026-11-15.5") return true;
  return terms === PREVIOUS_TERMS_VERSION && privacy === PREVIOUS_PRIVACY_VERSION;
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
