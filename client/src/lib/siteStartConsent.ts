/**
 * The one line a site reads under the start form's button (owner decision 2026-11-11: "one line plus a link"). The
 * full statements it stands for are one tap away, word for word, under "What you're agreeing to", which opens in place
 * beneath the line (owner, 2026-11-12: a drop-down, not a screen of its own). Because this line is
 * what the site sees where it presses, it is recorded as its own statement version: the description authority and,
 * when a video is attached, the recording grant (see `siteSubmissionAuthority.ts`, `recordingRightsStatement.ts`).
 *
 * Changing a word means a new version in both files.
 */
/**
 * The switch for the one-line consent: on. The Pipeline has accepted recording-rights 2026-11-11.v3 since its release
 * deployed on 2026-11-11 (`capture_original_owner_observer.py`, `RECORDING_RIGHTS_STATEMENT_VERSIONS`); it refuses any
 * capture recorded under a version it does not list.
 *
 * On: the one line below, "What you're agreeing to" opening the full statements in place, and the 2026-11-11 versions.
 * Off (set it to false to return to the long form): under the button the start form quotes the recorded statements
 * word for word and records description authority 2026-10-06.v1 and recording rights 2026-11-02.v2, and no 2026-11-11
 * version is sent. The server accepts both either way.
 */
export const START_FORM_SHORT_CONSENT = true;

export const SITE_START_CONSENT_WITH_VIDEO =
  "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site.";
/** The same line where no video is sent with the form (film it next, or a site outside the region we take video from). */
export const SITE_START_CONSENT_NO_VIDEO =
  "By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site.";

/**
 * Sharing is the service (owner, 2026-11-12): the line under "Send video" from now on, recorded as recording rights and
 * description authority `2026-11-12.v4`, and on the job page as the agreement for a job started without a video or
 * under an older statement. The lines above stay as the records of what earlier sites agreed to.
 */
export const SITE_START_CONSENT_WITH_VIDEO_V4 =
  "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. "
  + "We share your job, including this video and the simulation we build from it, with robot deployment companies we've approved.";
/** The same where no video is sent with the form: description authority `2026-11-12.v5`. */
export const SITE_START_CONSENT_NO_VIDEO_V5 =
  "By continuing, you agree to our Terms and Privacy Policy and confirm you're allowed to share this job for the site. "
  + "We share your job with robot deployment companies we've approved.";
/** The "also" line under "What you're agreeing to" (PACKAGE_E). Not a recorded statement. */
export const AGREEING_ALSO_LINE =
  "Our Terms and Privacy Policy. We don't share your name, address or contact details unless you ask for an introduction.";
