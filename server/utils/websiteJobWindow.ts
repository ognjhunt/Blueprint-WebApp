/**
 * The website job window: how long a preparation grant stays valid after it is
 * issued. The scene intent bound to the grant carries the same expiry
 * (validateWebsiteSponsoredIntake), so this one value is both windows.
 *
 * The length is the sponsorship policy's `ttl_seconds`
 * (BLUEPRINT_WEBSITE_SCENE_SPONSORSHIP_JSON, websiteSceneSponsorship.ts); left
 * out, it is the default here. A grant keeps the window it was issued with: a
 * later change to the length alone neither shortens nor lengthens it.
 *
 * The Pipeline accepts a grant whose issued window is at most
 * WEBSITE_JOB_WINDOW_MAX_SECONDS, mirrored in
 * blueprint_pipeline/website_job_window.py. Raise the maximum here only after
 * the Pipeline accepts the new bound and is deployed; otherwise it refuses the
 * grants this issues.
 *
 * Only time is set here. Caps, attempt counts, rights and consent are
 * unchanged. An owner-approved extension (door `extend-scene-execution-window`,
 * sceneExecutionWindowExtension.ts) still adds at most 7 days past the issued
 * expiry, so a job can run for at most the window plus 7 days.
 *
 * 7 days, owner-approved 2026-11-03 (up from one day in practice).
 */
export const WEBSITE_JOB_WINDOW_MIN_SECONDS = 60;
export const WEBSITE_JOB_WINDOW_MAX_SECONDS = 7 * 86400;
export const WEBSITE_JOB_WINDOW_DEFAULT_SECONDS = 7 * 86400;

/** The window a retained grant was issued with, in whole seconds; null when unreadable. */
export function issuedWebsiteJobWindowSeconds(grant: { expires_at_epoch?: unknown; consent?: { accepted_at_epoch?: unknown } }) {
  const expires = grant.expires_at_epoch, issued = grant.consent?.accepted_at_epoch;
  if (typeof expires !== "number" || typeof issued !== "number") return null;
  // Epoch floats subtract inexactly; the policy digest proves the rounded window.
  const seconds = Math.round(expires - issued);
  return Number.isSafeInteger(seconds) ? seconds : null;
}
