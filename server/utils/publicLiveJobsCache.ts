/**
 * The public live-jobs list's one-minute read cache (`server/routes/public-live-jobs.ts`), kept apart from the route so a
 * withdrawal can empty it without importing a route (stress test round 2, 2026-11-24: a withdrawn job stayed on the
 * public list for up to six minutes, a minute here plus five in browsers). A withdrawal empties it at once
 * (`recordWebsiteCaptureWithdrawal`); browsers revalidate every read.
 */
export const PUBLIC_LIVE_JOBS_FRESH_MS = 60_000;

let cached: { atMs: number; value: unknown } | null = null;

/** The cached list while it is under a minute old, else a fresh read (kept for the next minute). */
export async function cachedPublicLiveJobs<T>(load: () => Promise<T>, nowMs = Date.now()): Promise<T> {
  if (cached && nowMs - cached.atMs <= PUBLIC_LIVE_JOBS_FRESH_MS) return cached.value as T;
  const value = await load();
  cached = { atMs: nowMs, value };
  return value;
}

export function resetPublicLiveJobsCache() {
  cached = null;
}
