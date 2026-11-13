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
/*
 * 2026-11-12, later the same day (owner: "if they want to talk to 1 that should be fine if they want to go through the
 * steps with 8 that should be fine"). Version 2026-11-12.2 removes one sentence from the Terms, "You can ask for up to
 * three introductions for each job.", and changes nothing else. It takes effect at once, as 2026-11-12.1 did. The text of
 * 2026-11-12.1 is frozen at `client/src/pages/TermsPrevious.tsx` (/terms/previous). The Privacy Policy shares the version
 * id, so it moves to 2026-11-12.2 with its text unchanged: Privacy 2026-11-12.1 and 2026-11-12.2 are the same words
 * (the same `Privacy.tsx`, same digest).
 *
 * Who it binds, and how, exactly as for 2026-11-12.1: only by an act of the person's own.
 * - A site starting a job from this release accepts it under the start form's line.
 * - A signed-in account whose recorded acceptance is 2026-11-12.1 (or older) is asked to accept the current versions the
 *   next time it is checked (`acceptedVersionsAreCurrent` is false for it; `server/routes/workspace.ts`).
 * - A deployment company whose access record holds 2026-11-12.1 sees the Terms prompt and presses "I agree" again
 *   (`server/utils/companyTerms.ts`); until then `companyMaySeeJobs` is false for it.
 */
/*
 * 2026-11-13 (owner decision 1 of 2026-11-13: Anthropic may process a site's job like OpenAI, for jobs started under the
 * new version only). Privacy Policy 2026-11-13.1 changes its AI rows and its "AI in the Service" paragraph and nothing
 * else: Anthropic's row reads like OpenAI's for jobs started and requests sent under it (with "may": Anthropic is not
 * first anywhere until a paid test passes), Google Gemini's row says it receives the job description with the footage,
 * and the row of the provider no longer used (DeepSeek) leaves. It takes effect at once. Its text of 2026-11-12.2 is
 * frozen at `client/src/pages/PrivacyPrevious.tsx` (/privacy/previous), and the 2026-11-02.1 page byte for byte at
 * `PrivacyEarlier.tsx` (not routed).
 *
 * The Terms do not change: they keep 2026-11-12.2 (planner, 2026-11-13: nobody is asked to agree again to text that
 * did not change). From here on the Terms and the Privacy Policy have their own ids.
 *
 * Who it binds, and how:
 * - Nobody is asked to agree again. It changes only what may happen to jobs started and requests sent from now on, so
 *   an account or a deployment company that accepted Terms 2026-11-12.2 with Privacy 2026-11-12.2 keeps everything it
 *   had (`acceptedVersionsAreCurrent`: a Privacy-only change gates nothing; a Terms change still does).
 * - A site starting a job from this release accepts Terms 2026-11-12.2 and Privacy 2026-11-13.1 under the start form's
 *   line, recorded as two versions; that job is under Privacy 2026-11-13.1.
 * - A job started earlier keeps what it was promised: the data-class gate reads the Privacy version recorded when the
 *   job was started (`server/agents/runtime.ts`), and a later acceptance on the job's page does not move it.
 */
export const TERMS_VERSION = "2026-11-12.2";
export const PRIVACY_VERSION = "2026-11-13.1";
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
/** The Terms in force before 2026-11-12.2 are 2026-11-12.1. The Privacy Policy in force before 2026-11-13.1 is
 * 2026-11-12.2 (the same words as 2026-11-12.1). */
export const PREVIOUS_TERMS_VERSION = "2026-11-12.1";
export const PREVIOUS_PRIVACY_VERSION = "2026-11-12.2";
/** The Privacy Policy that was "previous" until 2026-11-13.1: kept byte for byte at `client/src/pages/PrivacyEarlier.tsx`, not routed. */
export const EARLIER_PRIVACY_VERSION = "2026-11-02.1";
/** The Terms that were "previous" until 2026-11-12.2: kept byte for byte at `client/src/pages/TermsEarlier.tsx`, not routed. */
export const EARLIER_TERMS_VERSION = "2026-11-02.1";

/**
 * SHA-256 of each legal page's source file, pinned to the version above it. A change to a page's text needs a new
 * version approved by the owner; `client/tests/legalPages.pinned.test.ts` fails on any byte change until both the
 * version and this digest are updated together.
 */
export const LEGAL_PAGE_DIGESTS = {
  "client/src/pages/Terms.tsx": { version: TERMS_VERSION, sha256: "44b0d966c803df4699ecc20c2dbd9a20f229d99395f9b57eee524a7f0774cc86" },
  "client/src/pages/Privacy.tsx": { version: PRIVACY_VERSION, sha256: "26a1411d6bd826830b61ff1c85bdc13433fdfd90586e8bca153996a496831938" },
  "client/src/pages/TermsAnnounced.tsx": { version: ANNOUNCED_SUPERSEDED_VERSION, sha256: "2a56699800d45d0ce2d63598021799a7abbc3027612b1cdfaaf9c0c98cf2cd97" },
  "client/src/pages/PrivacyAnnounced.tsx": { version: ANNOUNCED_SUPERSEDED_VERSION, sha256: "ae47ecfdb9bbf404ac0d070c02816d2a99f7d4460616e8b06435fbbcb3f115f9" },
  "client/src/pages/TermsPrevious.tsx": { version: PREVIOUS_TERMS_VERSION, sha256: "ccb2fb154ddab8e8c052c5870ca13084e461d4f2815c2eb8c7f5454ffbc12f27" },
  "client/src/pages/TermsEarlier.tsx": { version: EARLIER_TERMS_VERSION, sha256: "37a4885464a275f5236ed3dd0edee9b148bbeea9bdc80b6ab7f7b9a4dfb8d7bb" },
  "client/src/pages/PrivacyPrevious.tsx": { version: PREVIOUS_PRIVACY_VERSION, sha256: "c2a859cb17b3b54629e4b88545a3c950e842f85c4a52d0a2652943fe749e895f" },
  "client/src/pages/PrivacyEarlier.tsx": { version: EARLIER_PRIVACY_VERSION, sha256: "cad7fcac5cc1ec468ab74471a13a5e61a208b697deafd97b4039f01ab38eab3c" },
} as const;
/** The versions the digests above were recorded against; a version bump without a new digest fails the same test. */
export const LEGAL_PAGE_DIGEST_VERSIONS = {
  terms: "2026-11-12.2", privacy: "2026-11-13.1", previousTerms: "2026-11-12.1", previousPrivacy: "2026-11-12.2",
  announced: "2026-11-25.1", earlierTerms: "2026-11-02.1", earlierPrivacy: "2026-11-02.1",
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
/**
 * For a Privacy Policy version, the earlier versions whose acceptance, recorded beside the current Terms, still
 * counts. An earlier version may be listed ONLY when the newer version changes nothing for existing accounts: its
 * changes concern only jobs started and requests sent from then on, so nobody needs to agree again (2026-11-13.1
 * replaced 2026-11-12.2 that way). Keyed by the version that decided it, so a new PRIVACY_VERSION inherits nothing:
 * until its own entry is written, only the new version counts (everyone is asked again), and
 * `client/tests/legalAcceptance.privacy-current.test.ts` fails, asking for the decision. A Terms change still asks.
 */
const EARLIER_PRIVACY_VERSIONS_STILL_COUNTING: Readonly<Record<string, readonly string[]>> = {
  "2026-11-13.1": [PREVIOUS_PRIVACY_VERSION],
};
export const PRIVACY_VERSIONS_CURRENT_WITH_TERMS: ReadonlySet<string> =
  new Set([PRIVACY_VERSION, ...(EARLIER_PRIVACY_VERSIONS_STILL_COUNTING[PRIVACY_VERSION] ?? [])]);

export function acceptedVersionsAreCurrent(terms: unknown, privacy: unknown, nowMs = Date.now()): boolean {
  // Each document on its own: the current version counts; while a document's update is announced but not yet in
  // force, its previous version counts too, so nobody is asked to accept a document early.
  const termsCurrent = terms === TERMS_VERSION
    || (nowMs < legalEffectiveAtMs(TERMS_VERSION) && terms === PREVIOUS_TERMS_VERSION);
  const privacyCurrent = (typeof privacy === "string" && PRIVACY_VERSIONS_CURRENT_WITH_TERMS.has(privacy))
    || (nowMs < legalEffectiveAtMs(PRIVACY_VERSION) && privacy === PREVIOUS_PRIVACY_VERSION);
  if (termsCurrent && privacyCurrent) return true;
  // The same corrected text, published earlier on 2026-11-02 under the announced
  // November 15 date. The earlier November 15 pairs said people were removed
  // from footage, so they no longer count.
  // They counted as 2026-11-02.1, which is now the previous version.
  // Only while a Terms update is announced: it was a Terms-and-Privacy pair.
  if (nowMs >= legalEffectiveAtMs(TERMS_VERSION)) return false;
  return terms === "2026-11-15.4" && privacy === "2026-11-15.5";
}

/** The Terms and Privacy versions a form showed when the person accepted. */
export type ShownLegalVersions = { terms_version: string; privacy_version: string };

/**
 * What a form that sends the versions it showed may record: those versions, exactly, when they still count as
 * current (`acceptedVersionsAreCurrent`); otherwise null, and the route refuses as it always has. A recorded version
 * is never rewritten to the current one: a page opened before a Privacy change records the Privacy version it showed.
 */
export function shownVersionsCount(terms: unknown, privacy: unknown, nowMs = Date.now()): ShownLegalVersions | null {
  return typeof terms === "string" && typeof privacy === "string" && acceptedVersionsAreCurrent(terms, privacy, nowMs)
    ? { terms_version: terms, privacy_version: privacy } : null;
}

/**
 * The versions every site start form showed before forms sent the versions they show (before Privacy 2026-11-13.1).
 * A start form that sends none was opened before this release, so this is what its line showed.
 */
export const START_FORM_VERSIONS_BEFORE_SENT: ShownLegalVersions = { terms_version: "2026-11-12.2", privacy_version: "2026-11-12.2" };

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
  /** The versions the person was shown, when the route knows them and `shownVersionsCount` accepted them. */
  shown?: ShownLegalVersions | null;
}): LegalAcceptanceRecord<TAcceptedAt> {
  return {
    accepted_terms: true,
    terms_version: params.shown?.terms_version ?? TERMS_VERSION,
    privacy_version: params.shown?.privacy_version ?? PRIVACY_VERSION,
    terms_url: TERMS_URL,
    privacy_url: PRIVACY_URL,
    accepted_at: params.acceptedAt,
    accepted_from_ip_hash: params.acceptedFromIpHash ?? null,
  };
}
