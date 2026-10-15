/**
 * What a site is told wherever footage is filmed or uploaded. One wording,
 * kept short, matching Terms section 3 and the Privacy Policy's "Sound" row:
 * people in the work area must be told, conversations are best avoided, and
 * sound is removed before any automated review (see
 * server/agents/adapters/video-audio-strip.ts).
 */
export const SOUND_REMOVAL_NOTE = "We remove sound before any automated review.";

export const FILMING_NOTICE =
  `Tell people in the work area that you are filming for Blueprint, and avoid filming conversations. ${SOUND_REMOVAL_NOTE}`;

export const FOOTAGE_UPLOAD_NOTICE =
  `Only upload footage you may share. People seen or heard in it must know it is shared with Blueprint, so avoid clips with conversations. ${SOUND_REMOVAL_NOTE}`;
