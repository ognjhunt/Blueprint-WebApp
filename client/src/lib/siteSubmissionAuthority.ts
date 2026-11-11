import { SITE_START_CONSENT_NO_VIDEO, SITE_START_CONSENT_WITH_VIDEO } from "./siteStartConsent";

/** Sharing a job description grants no recording, listing or fee authority. */
export const DESCRIPTION_AUTHORITY_VERSION = "2026-10-06.v1";
export const DESCRIPTION_AUTHORITY_STATEMENT =
  "I am authorized to share this job description with Blueprint on behalf of the site.";

/**
 * The start form's one-line consent (2026-11-11), recorded as the description authority the site gave: one version
 * for the line under "Send video" and one for the line where no video is sent. The full statement above is shown,
 * word for word, on the "What you're agreeing to" screen. Records made under v1 stay valid.
 */
export const DESCRIPTION_AUTHORITY_WITH_VIDEO_VERSION = "2026-11-11.v2";
export const DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION = "2026-11-11.v3";

/** Every version a stored or submitted description authority may name, and no other. */
export const DESCRIPTION_AUTHORITY_VERSIONS = [
  DESCRIPTION_AUTHORITY_VERSION, DESCRIPTION_AUTHORITY_WITH_VIDEO_VERSION, DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION,
] as const;
export type DescriptionAuthorityVersion = (typeof DESCRIPTION_AUTHORITY_VERSIONS)[number];

/** The exact sentence each version recorded. */
export const DESCRIPTION_AUTHORITY_STATEMENTS: Readonly<Record<DescriptionAuthorityVersion, string>> = {
  [DESCRIPTION_AUTHORITY_VERSION]: DESCRIPTION_AUTHORITY_STATEMENT,
  [DESCRIPTION_AUTHORITY_WITH_VIDEO_VERSION]: SITE_START_CONSENT_WITH_VIDEO,
  [DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION]: SITE_START_CONSENT_NO_VIDEO,
};

export function isDescriptionAuthorityVersion(value: unknown): value is DescriptionAuthorityVersion {
  return typeof value === "string" && (DESCRIPTION_AUTHORITY_VERSIONS as readonly string[]).includes(value);
}
