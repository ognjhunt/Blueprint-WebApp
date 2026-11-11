/**
 * The one line a site reads under the start form's button (owner decision 2026-11-11: "one line plus a link"). The
 * full statements it stands for are one tap away, word for word, on "What you're agreeing to". Because this line is
 * what the site sees where it presses, it is recorded as its own statement version: the description authority and,
 * when a video is attached, the recording grant (see `siteSubmissionAuthority.ts`, `recordingRightsStatement.ts`).
 *
 * Changing a word means a new version in both files.
 */
export const SITE_START_CONSENT_WITH_VIDEO =
  "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site.";
/** The same line where no video is sent with the form (film it next, or a site outside the region we take video from). */
export const SITE_START_CONSENT_NO_VIDEO =
  "By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site.";
