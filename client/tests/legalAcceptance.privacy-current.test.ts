/**
 * Which Privacy Policy versions still count beside the current Terms. Pinned exactly: a new Privacy version must
 * decide, in `EARLIER_PRIVACY_VERSIONS_STILL_COUNTING` (client/src/lib/legalAcceptance.ts), whether an earlier
 * acceptance still counts. List an earlier version only when the new version changes nothing for existing accounts.
 */
import { describe, expect, it } from "vitest";
import { LAUNCH_COPY_VERSION, NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION, legalEffectiveAtMs } from "@/lib/legalAcceptance";
import { PREVIOUS_PRIVACY_VERSION, PRIVACY_VERSION, PRIVACY_VERSIONS_CURRENT_WITH_TERMS,
  acceptedVersionsAreCurrent, TERMS_VERSION } from "@/lib/legalAcceptance";

const DECIDE = "The Privacy Policy version changed. Decide in EARLIER_PRIVACY_VERSIONS_STILL_COUNTING whether an "
  + "acceptance of an earlier version still counts (only if the new version changes nothing for existing accounts), "
  + "then update this test.";

// Owner, 2026-11-17: 2026-11-17.1 (no face blurring for a job started under it) changes nothing for an existing
// account, and earlier acceptances keep counting: both versions that counted beside the Terms before it still do.
// 2026-11-19.1 (no early trial; owner permission of 2026-11-19) only narrows, so 2026-11-17.1 and every version that
// counted beside the Terms before it still count: nobody is asked again. 2026-11-21.1 (launch copy; owner approval of
// 2026-11-21) corrects the policy to what the Service already does: 2026-11-19.1 and every version that counted before
// it still count, and nobody is asked again.
describe("Privacy versions that still count beside the current Terms", () => {
  it("is exactly the current version, 2026-11-19.1, 2026-11-17.1, 2026-11-13.1 and 2026-11-12.2", () => {
    expect(PRIVACY_VERSION, DECIDE).toBe(LAUNCH_COPY_VERSION);
    expect(PREVIOUS_PRIVACY_VERSION, DECIDE).toBe(NO_EARLY_TRIAL_VERSION);
    expect([...PRIVACY_VERSIONS_CURRENT_WITH_TERMS].sort(), DECIDE)
      .toEqual(["2026-11-12.2", "2026-11-13.1", NO_FACE_BLUR_VERSION, NO_EARLY_TRIAL_VERSION, LAUNCH_COPY_VERSION]);
  });

  it("counts an acceptance of the current version, 2026-11-19.1, 2026-11-17.1, 2026-11-13.1 or 2026-11-12.2 beside a Terms version that counts, and no other", () => {
    const after = legalEffectiveAtMs(LAUNCH_COPY_VERSION) + 10 * 3_600_000;
    for (const terms of [TERMS_VERSION, NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION, "2026-11-12.2"]) {
      for (const privacy of [LAUNCH_COPY_VERSION, NO_EARLY_TRIAL_VERSION, NO_FACE_BLUR_VERSION, "2026-11-13.1", "2026-11-12.2"])
        expect(acceptedVersionsAreCurrent(terms, privacy, after), `${terms} ${privacy}`).toBe(true);
      for (const privacy of ["2026-11-12.1", "2026-11-02.1", "2026-11-25.1", "2026-11-15.5", "", null])
        expect(acceptedVersionsAreCurrent(terms, privacy, after), `${terms} ${String(privacy)}`).toBe(false);
    }
  });
});
