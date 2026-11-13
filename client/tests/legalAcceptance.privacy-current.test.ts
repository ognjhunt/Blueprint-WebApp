/**
 * Which Privacy Policy versions still count beside the current Terms. Pinned exactly: a new Privacy version must
 * decide, in `EARLIER_PRIVACY_VERSIONS_STILL_COUNTING` (client/src/lib/legalAcceptance.ts), whether an earlier
 * acceptance still counts. List an earlier version only when the new version changes nothing for existing accounts.
 */
import { describe, expect, it } from "vitest";
import { PREVIOUS_PRIVACY_VERSION, PRIVACY_VERSION, PRIVACY_VERSIONS_CURRENT_WITH_TERMS,
  acceptedVersionsAreCurrent, TERMS_VERSION } from "@/lib/legalAcceptance";

const DECIDE = "The Privacy Policy version changed. Decide in EARLIER_PRIVACY_VERSIONS_STILL_COUNTING whether an "
  + "acceptance of an earlier version still counts (only if the new version changes nothing for existing accounts), "
  + "then update this test.";

describe("Privacy versions that still count beside the current Terms", () => {
  it("is exactly 2026-11-13.1 and 2026-11-12.2", () => {
    expect(PRIVACY_VERSION, DECIDE).toBe("2026-11-13.1");
    expect(PREVIOUS_PRIVACY_VERSION, DECIDE).toBe("2026-11-12.2");
    expect([...PRIVACY_VERSIONS_CURRENT_WITH_TERMS].sort(), DECIDE).toEqual(["2026-11-12.2", "2026-11-13.1"]);
  });

  it("counts an acceptance of 2026-11-12.2 or 2026-11-13.1 beside the current Terms, and no other", () => {
    const after = Date.parse("2026-11-14T00:00:00Z");
    for (const privacy of ["2026-11-13.1", "2026-11-12.2"]) expect(acceptedVersionsAreCurrent(TERMS_VERSION, privacy, after), privacy).toBe(true);
    for (const privacy of ["2026-11-12.1", "2026-11-02.1", "2026-11-25.1", "2026-11-15.5", "", null])
      expect(acceptedVersionsAreCurrent(TERMS_VERSION, privacy, after), String(privacy)).toBe(false);
  });
});
