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
 *
 * A job whose video arrived but which never received a grant has the same
 * length of time, counted only while the site was waiting on Blueprint
 * (`websiteJobDeadlineWithoutGrant`); the window sweep ends it there.
 */
export const WEBSITE_JOB_WINDOW_MIN_SECONDS = 60;
export const WEBSITE_JOB_WINDOW_MAX_SECONDS = 7 * 86400;
export const WEBSITE_JOB_WINDOW_DEFAULT_SECONDS = 7 * 86400;

/**
 * The deadline of a job whose video arrived but which never received a grant: the same length of
 * time a grant would have had, counted only while the site was waiting on Blueprint. The clock
 * starts at the later of the video's arrival and `releasedAtIso`, the last moment something spoke
 * for the job or its page asked the site for a step (the window sweep's hold marker). `windowSeconds`
 * is the length in force (`websiteJobWindowSeconds`). Returns the instant the clock started, as the
 * stored string it came from, and the deadline. Null when either instant does not read, which no
 * caller may take as "past".
 */
export function websiteJobDeadlineWithoutGrant(input: { videoReceivedAtIso: unknown; releasedAtIso?: unknown },
  windowSeconds: number): { waitingSinceIso: string; deadlineEpoch: number } | null {
  const instant = (value: unknown) => typeof value === "string" ? Date.parse(value) : Number.NaN;
  const received = instant(input.videoReceivedAtIso);
  if (!Number.isFinite(received) || received <= 0 || !Number.isSafeInteger(windowSeconds) || windowSeconds <= 0) return null;
  if (input.releasedAtIso === undefined) return { waitingSinceIso: input.videoReceivedAtIso as string,
    deadlineEpoch: received / 1000 + windowSeconds };
  const released = instant(input.releasedAtIso);
  if (!Number.isFinite(released) || released <= 0) return null;
  return released > received
    ? { waitingSinceIso: input.releasedAtIso as string, deadlineEpoch: released / 1000 + windowSeconds }
    : { waitingSinceIso: input.videoReceivedAtIso as string, deadlineEpoch: received / 1000 + windowSeconds };
}

/** The window a retained grant was issued with, in whole seconds; null when unreadable. */
export function issuedWebsiteJobWindowSeconds(grant: { expires_at_epoch?: unknown; consent?: { accepted_at_epoch?: unknown } }) {
  const expires = grant.expires_at_epoch, issued = grant.consent?.accepted_at_epoch;
  if (typeof expires !== "number" || typeof issued !== "number") return null;
  // Epoch floats subtract inexactly; the policy digest proves the rounded window.
  const seconds = Math.round(expires - issued);
  return Number.isSafeInteger(seconds) ? seconds : null;
}
