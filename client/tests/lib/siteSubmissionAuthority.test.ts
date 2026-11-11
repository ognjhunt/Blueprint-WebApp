import { describe, expect, it } from "vitest";

import {
  DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION,
  DESCRIPTION_AUTHORITY_STATEMENT,
  DESCRIPTION_AUTHORITY_STATEMENTS,
  DESCRIPTION_AUTHORITY_VERSION,
  DESCRIPTION_AUTHORITY_VERSIONS,
  DESCRIPTION_AUTHORITY_WITH_VIDEO_VERSION,
  isDescriptionAuthorityVersion,
} from "@/lib/siteSubmissionAuthority";
import { SITE_START_CONSENT_NO_VIDEO, SITE_START_CONSENT_WITH_VIDEO } from "@/lib/siteStartConsent";

/**
 * A stored description authority names the exact sentence the site saw where it pressed. The start form's one line
 * (owner, 2026-11-11) is two new versions; the v1 sentence stays valid for records made under it.
 */
describe("description authority statement", () => {
  it("pins each version to its exact sentence", () => {
    expect(DESCRIPTION_AUTHORITY_VERSION).toBe("2026-10-06.v1");
    expect(DESCRIPTION_AUTHORITY_STATEMENT).toBe("I am authorized to share this job description with Blueprint on behalf of the site.");
    expect(DESCRIPTION_AUTHORITY_WITH_VIDEO_VERSION).toBe("2026-11-11.v2");
    expect(DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION).toBe("2026-11-11.v3");
    expect(DESCRIPTION_AUTHORITY_STATEMENTS).toEqual({
      "2026-10-06.v1": DESCRIPTION_AUTHORITY_STATEMENT,
      "2026-11-11.v2": SITE_START_CONSENT_WITH_VIDEO,
      "2026-11-11.v3": SITE_START_CONSENT_NO_VIDEO,
    });
    expect(SITE_START_CONSENT_WITH_VIDEO).toBe("By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site.");
    expect(SITE_START_CONSENT_NO_VIDEO).toBe("By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site.");
    // No filming claim where no video is sent.
    expect(SITE_START_CONSENT_NO_VIDEO).not.toMatch(/film/);
  });

  it("accepts exactly the three versions", () => {
    expect(DESCRIPTION_AUTHORITY_VERSIONS).toEqual(["2026-10-06.v1", "2026-11-11.v2", "2026-11-11.v3"]);
    for (const version of DESCRIPTION_AUTHORITY_VERSIONS) expect(isDescriptionAuthorityVersion(version)).toBe(true);
    for (const other of ["2026-10-06.v2", "2026-11-11.v4", "2026-11-02.v2", " 2026-10-06.v1", "", null, undefined, 1]) {
      expect(isDescriptionAuthorityVersion(other)).toBe(false);
    }
  });
});
