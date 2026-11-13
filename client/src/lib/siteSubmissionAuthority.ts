import { SITE_START_CONSENT_NO_VIDEO, SITE_START_CONSENT_NO_VIDEO_V5, SITE_START_CONSENT_WITH_VIDEO, SITE_START_CONSENT_WITH_VIDEO_V4 } from "./siteStartConsent";

/** Sharing a job description grants no recording, listing or fee authority. */
export const DESCRIPTION_AUTHORITY_VERSION = "2026-10-06.v1";
export const DESCRIPTION_AUTHORITY_STATEMENT =
  "I am authorized to share this job description with Blueprint on behalf of the site.";

/**
 * The start form's one-line consent (2026-11-11), recorded as the description authority the site gave: one version
 * for the line under "Send video" and one for the line where no video is sent. The full statement above is shown,
 * word for word, under "What you're agreeing to". Records made under v1 stay valid.
 */
export const DESCRIPTION_AUTHORITY_WITH_VIDEO_VERSION = "2026-11-11.v2";
export const DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION = "2026-11-11.v3";
/**
 * Sharing is the service (owner, 2026-11-12): the start form records these from now on. With a video, the same sentence
 * as recording rights v4; without one, its own sentence. The two above stay as records.
 */
export const DESCRIPTION_AUTHORITY_WITH_VIDEO_V4_VERSION = "2026-11-12.v4";
export const DESCRIPTION_AUTHORITY_NO_VIDEO_V5_VERSION = "2026-11-12.v5";

/** Every version a stored or submitted description authority may name, and no other. */
export const DESCRIPTION_AUTHORITY_VERSIONS = [
  DESCRIPTION_AUTHORITY_VERSION, DESCRIPTION_AUTHORITY_WITH_VIDEO_VERSION, DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION,
  DESCRIPTION_AUTHORITY_WITH_VIDEO_V4_VERSION, DESCRIPTION_AUTHORITY_NO_VIDEO_V5_VERSION,
] as const;
export type DescriptionAuthorityVersion = (typeof DESCRIPTION_AUTHORITY_VERSIONS)[number];

/** The exact sentence each version recorded. */
export const DESCRIPTION_AUTHORITY_STATEMENTS: Readonly<Record<DescriptionAuthorityVersion, string>> = {
  [DESCRIPTION_AUTHORITY_VERSION]: DESCRIPTION_AUTHORITY_STATEMENT,
  [DESCRIPTION_AUTHORITY_WITH_VIDEO_VERSION]: SITE_START_CONSENT_WITH_VIDEO,
  [DESCRIPTION_AUTHORITY_NO_VIDEO_VERSION]: SITE_START_CONSENT_NO_VIDEO,
  [DESCRIPTION_AUTHORITY_WITH_VIDEO_V4_VERSION]: SITE_START_CONSENT_WITH_VIDEO_V4,
  [DESCRIPTION_AUTHORITY_NO_VIDEO_V5_VERSION]: SITE_START_CONSENT_NO_VIDEO_V5,
};

export function isDescriptionAuthorityVersion(value: unknown): value is DescriptionAuthorityVersion {
  return typeof value === "string" && (DESCRIPTION_AUTHORITY_VERSIONS as readonly string[]).includes(value);
}
