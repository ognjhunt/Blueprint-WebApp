/**
 * Practice-run video copies an earlier release cached on this instance for a job's early-trial results. Nothing
 * caches new ones; a withdrawal still drops any copy of the job's videos that remains.
 */
import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const SCREENING_VIDEO_ID = /^[a-f0-9]{64}$/;
const JOB_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

const CACHE_DIRECTORY = path.join(tmpdir(), "blueprint-screening-practice-run-videos");
/** `jobs/<jobId>/<videoId>`: which job each cached copy was fetched for, so a job's copies can all go at once. */
const JOBS_DIRECTORY = path.join(CACHE_DIRECTORY, "jobs");
export const practiceRunVideoCachePath = (videoId: string) => path.join(CACHE_DIRECTORY, `${videoId}.mp4`);
export const practiceRunVideoMarkerPath = (requestId: string, videoId: string) => path.join(JOBS_DIRECTORY, requestId, videoId);

/** Drop every cached copy of this job's videos on this instance: consent or ownership no longer stands. */
export async function forgetPracticeRunVideos(requestId: string) {
  if (!JOB_ID.test(requestId)) return;
  const markers = path.join(JOBS_DIRECTORY, requestId);
  const videoIds = await readdir(markers).catch(() => [] as string[]);
  await Promise.all(videoIds.filter(videoId => SCREENING_VIDEO_ID.test(videoId))
    .map(videoId => rm(practiceRunVideoCachePath(videoId), { force: true })));
  await rm(markers, { recursive: true, force: true });
}
