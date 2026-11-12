/**
 * What a site is told wherever footage is filmed or uploaded. One wording,
 * kept short, matching Terms section 3 and the Privacy Policy's "Sound" row:
 * people in the work area must be told, conversations are best avoided, and
 * sound is removed before anyone reviews it or a company sees it (see
 * server/agents/adapters/video-audio-strip.ts).
 */
export const SOUND_REMOVAL_NOTE = "We remove the sound before anyone reviews it or a company sees it.";

/** Said where the site films, kept to two lines on a desktop (the upload-spacing pin in `e2e/onboarding-p1.spec.ts`). */
export const FILMING_NOTICE =
  "Tell people nearby that the video goes to Blueprint and to deployment companies we approve. Avoid conversations: we remove the sound.";

/**
 * Sharing is the service (owner, 2026-11-12): the footage goes to the deployment companies Blueprint approves, without
 * its sound, so the people in it must know that too. Kept to two lines beside the upload button (planner, 2026-11-12:
 * the upload-spacing pin stays at 140 px), so it says PACKAGE_D's footage notice in fewer words.
 */
export const FOOTAGE_UPLOAD_NOTICE =
  "Only upload footage you may share. People in it must know it goes to Blueprint and to deployment companies we approve. "
  + "Avoid conversations: we remove the sound.";
