/**
 * The one line a site reads under the start form's button (owner decision 2026-11-11: "one line plus a link"). The
 * full statements it stands for are one tap away, word for word, on "What you're agreeing to". Because this line is
 * what the site sees where it presses, it is recorded as its own statement version: the description authority and,
 * when a video is attached, the recording grant (see `siteSubmissionAuthority.ts`, `recordingRightsStatement.ts`).
 *
 * Changing a word means a new version in both files.
 */
/**
 * The switch for the one-line consent. Turn on only after the Pipeline release that accepts recording-rights
 * 2026-11-11.v3 is deployed (`capture_original_owner_observer.py`, `RECORDING_RIGHTS_STATEMENT_VERSIONS`): the Pipeline
 * refuses any capture recorded under a version it does not list.
 *
 * Off: under the button the start form quotes the recorded statements word for word and records the versions
 * production records today (description authority 2026-10-06.v1, recording rights 2026-11-02.v2). No 2026-11-11
 * version is sent. On: the one line below, the "What you're agreeing to" screen, and the 2026-11-11 versions.
 * The server accepts both either way.
 */
export const START_FORM_SHORT_CONSENT = false;

export const SITE_START_CONSENT_WITH_VIDEO =
  "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site.";
/** The same line where no video is sent with the form (film it next, or a site outside the region we take video from). */
export const SITE_START_CONSENT_NO_VIDEO =
  "By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site.";
