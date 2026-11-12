/**
 * What a site is told wherever footage is filmed or uploaded. One wording,
 * kept short, matching Terms section 3 and the Privacy Policy's "Sound" row:
 * people in the work area must be told, conversations are best avoided, and
 * sound is removed before anyone reviews it or a company sees it (see
 * server/agents/adapters/video-audio-strip.ts).
 */
export const SOUND_REMOVAL_NOTE = "We remove the sound before anyone reviews it or a company sees it.";

export const FILMING_NOTICE =
  `Tell people in the work area that you are filming for Blueprint and the robot deployment companies we approve, and avoid filming conversations. ${SOUND_REMOVAL_NOTE}`;

/**
 * Sharing is the service (owner, 2026-11-12): the footage goes to the deployment companies Blueprint approves, without
 * its sound, so the people in it must know that too.
 */
export const FOOTAGE_UPLOAD_NOTICE =
  "Only upload footage you may share. People seen or heard in it must know it is shared with Blueprint and with the robot "
  + `deployment companies we approve, so avoid clips with conversations. ${SOUND_REMOVAL_NOTE}`;
