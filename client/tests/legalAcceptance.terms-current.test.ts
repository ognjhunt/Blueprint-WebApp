/**
 * Which Terms versions still count. Pinned exactly: a new Terms version must decide, in
 * `EARLIER_TERMS_VERSIONS_STILL_COUNTING` (client/src/lib/legalAcceptance.ts), whether an earlier acceptance still
 * counts. List an earlier version only when the new Terms change nothing for existing accounts and deployment companies.
 * A deployment company's side (`companyMaySeeJobs`) is in `server/tests/company-terms-gate.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { LAUNCH_COPY_VERSION, LEGAL_VERSIONS_THAT_ASK_AGAIN, NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION, legalEffectiveAtMs,
  versionsStillCounting } from "@/lib/legalAcceptance";
import { PRIOR_TERMS_VERSION, PAIRS_A_PAGE_SHOWED, PREVIOUS_TERMS_VERSION, PRIVACY_VERSION, TERMS_VERSION, TERMS_VERSIONS_CURRENT,
  acceptedVersionsAreCurrent, buildLegalAcceptanceRecord, isCurrentLegalAcceptance, shownVersionsCount } from "@/lib/legalAcceptance";

const DECIDE = "The Terms version changed. Decide in EARLIER_TERMS_VERSIONS_STILL_COUNTING whether an acceptance of an "
  + "earlier version still counts (only if the new Terms change nothing for existing accounts and deployment "
  + "companies), then update this test.";

const AFTER = legalEffectiveAtMs(LAUNCH_COPY_VERSION) + 10 * 3_600_000;
const acceptance = (terms: string, privacy: string) => ({ ...buildLegalAcceptanceRecord({ acceptedAt: "2026-11-13T09:00:00.000Z" }),
  terms_version: terms, privacy_version: privacy });

// Owner, 2026-11-17: 2026-11-17.1 (no face blurring for a job started under it) changes nothing for an existing account
// or deployment company; nobody is asked to accept again and no deployment company loses access. 2026-11-19.1 (no
// early trial; owner permission of 2026-11-19) only narrows: 2026-11-17.1 and 2026-11-12.2 still count, the same way.
// 2026-11-21.1 (launch copy; owner approval of 2026-11-21) corrects the Terms to what the Service already does and asks
// nothing new: 2026-11-19.1, 2026-11-17.1 and 2026-11-12.2 still count, and nobody is asked again.
describe("Terms versions that still count", () => {
  it("is exactly the current version, 2026-11-19.1, 2026-11-17.1 and 2026-11-12.2", () => {
    expect(TERMS_VERSION, DECIDE).toBe(LAUNCH_COPY_VERSION);
    expect(PREVIOUS_TERMS_VERSION, DECIDE).toBe(NO_EARLY_TRIAL_VERSION);
    expect([...TERMS_VERSIONS_CURRENT].sort(), DECIDE)
      .toEqual(["2026-11-12.2", NO_FACE_BLUR_VERSION, NO_EARLY_TRIAL_VERSION, LAUNCH_COPY_VERSION]);
  });

  it("keeps an account's acceptance of Terms 2026-11-19.1, 2026-11-17.1 or 2026-11-12.2 current, and still asks whoever accepted an older version", () => {
    for (const privacy of ["2026-11-12.2", "2026-11-13.1", NO_FACE_BLUR_VERSION, NO_EARLY_TRIAL_VERSION, LAUNCH_COPY_VERSION]) {
      expect(acceptedVersionsAreCurrent("2026-11-12.2", privacy, AFTER), privacy).toBe(true);
      expect(acceptedVersionsAreCurrent(NO_FACE_BLUR_VERSION, privacy, AFTER), privacy).toBe(true);
      expect(acceptedVersionsAreCurrent(NO_EARLY_TRIAL_VERSION, privacy, AFTER), privacy).toBe(true);
      expect(acceptedVersionsAreCurrent(PRIOR_TERMS_VERSION, privacy, AFTER), privacy).toBe(false);
    }
    for (const terms of ["2026-11-02.1", "2026-11-25.1", "2026-11-15.4", "", null, undefined])
      expect(acceptedVersionsAreCurrent(terms, PRIVACY_VERSION, AFTER), String(terms)).toBe(false);
  });

  it("records the new versions for a new acceptance, and leaves an earlier recorded acceptance as it is", () => {
    expect(buildLegalAcceptanceRecord({ acceptedAt: "now" })).toMatchObject({ terms_version: LAUNCH_COPY_VERSION, privacy_version: LAUNCH_COPY_VERSION });
    for (const earlier of [acceptance("2026-11-12.2", "2026-11-13.1"), acceptance(NO_FACE_BLUR_VERSION, NO_FACE_BLUR_VERSION),
      acceptance(NO_EARLY_TRIAL_VERSION, NO_EARLY_TRIAL_VERSION)]) {
      const kept = structuredClone(earlier);
      expect(isCurrentLegalAcceptance(earlier)).toBe(true);
      expect(earlier).toEqual(kept);
    }
  });
});

// Review, 2026-11-17: a form records only a pair some page showed. Terms 2026-11-12.2 promises the face blur, so it may
// never be recorded beside the no-blur Privacy version, which would leave that job unblurred.
describe("the versions a form may record", () => {
  it("records exactly a pair a page showed, and refuses a pair no page showed", () => {
    expect(PAIRS_A_PAGE_SHOWED[0]).toEqual({ terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION });
    // A form opened before 2026-11-21.1 still records the 2026-11-19.1 pair it showed, and one opened before 2026-11-19.1
    // the 2026-11-17.1 pair.
    expect(shownVersionsCount(NO_EARLY_TRIAL_VERSION, NO_EARLY_TRIAL_VERSION, AFTER))
      .toEqual({ terms_version: NO_EARLY_TRIAL_VERSION, privacy_version: NO_EARLY_TRIAL_VERSION });
    expect(shownVersionsCount(NO_FACE_BLUR_VERSION, NO_FACE_BLUR_VERSION, AFTER))
      .toEqual({ terms_version: NO_FACE_BLUR_VERSION, privacy_version: NO_FACE_BLUR_VERSION });
    for (const pair of PAIRS_A_PAGE_SHOWED)
      expect(shownVersionsCount(pair.terms_version, pair.privacy_version, AFTER)).toEqual(pair);
    for (const [terms, privacy] of [["2026-11-12.2", NO_FACE_BLUR_VERSION], [NO_FACE_BLUR_VERSION, "2026-11-13.1"],
      [NO_FACE_BLUR_VERSION, "2026-11-12.2"], ["2026-11-12.1", "2026-11-12.1"], ["2026-11-12.2", "2026-11-02.1"],
      [NO_FACE_BLUR_VERSION, NO_EARLY_TRIAL_VERSION], [NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION], ["2026-11-12.2", NO_EARLY_TRIAL_VERSION],
      [NO_EARLY_TRIAL_VERSION, LAUNCH_COPY_VERSION], [LAUNCH_COPY_VERSION, NO_EARLY_TRIAL_VERSION], [NO_FACE_BLUR_VERSION, LAUNCH_COPY_VERSION],
      ["2026-11-12.2", LAUNCH_COPY_VERSION]])
      expect(shownVersionsCount(terms, privacy, AFTER), `${terms} ${privacy}`).toBeNull();
    // An account that holds such a pair from before is still current: the check is on what a form may record.
    expect(acceptedVersionsAreCurrent(NO_FACE_BLUR_VERSION, "2026-11-13.1", AFTER)).toBe(true);
  });
});

// Audit G-13: a new Terms or Privacy version keeps counting earlier acceptances unless it is marked as asking again.
describe("a new version with no decision written", () => {
  const earlier = { [NO_EARLY_TRIAL_VERSION]: [NO_FACE_BLUR_VERSION, "2026-11-12.2"] };
  it("keeps counting the previous version and what counted beside it", () => {
    expect([...versionsStillCounting("2099-01-01.1", NO_EARLY_TRIAL_VERSION, earlier, new Set())].sort())
      .toEqual(["2026-11-12.2", NO_FACE_BLUR_VERSION, NO_EARLY_TRIAL_VERSION, "2099-01-01.1"]);
  });
  it("asks everyone again when it is marked as asking again", () => {
    expect([...versionsStillCounting("2099-01-01.1", NO_EARLY_TRIAL_VERSION, earlier, new Set(["2099-01-01.1"]))])
      .toEqual(["2099-01-01.1"]);
  });
  it("follows a written decision over the default", () => {
    expect([...versionsStillCounting(NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION, earlier, new Set())].sort())
      .toEqual(["2026-11-12.2", NO_FACE_BLUR_VERSION, NO_EARLY_TRIAL_VERSION]);
  });
  it("marks no current version as asking again", () => expect([...LEGAL_VERSIONS_THAT_ASK_AGAIN]).toEqual([]));
});
