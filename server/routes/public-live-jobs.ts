/**
 * GET /api/public/live-jobs: the live jobs anyone may see on /jobs (owner, 2026-11-23), as `listPublicLiveJobs`
 * words them: the kind of job, the country, the day it was shared and whether its simulation is ready. No sign-in;
 * the global /api limit applies. Read at most once a minute per process (`publicLiveJobsCache.ts`), so a busy page never
 * reads every job each time; a withdrawal empties that cache at once. Browsers keep no copy without asking again
 * (`private, no-cache`, answered 304 by its ETag when unchanged), so a withdrawn job leaves the list on the next read.
 */
import { Router, type Request, type Response } from "express";
import { logger } from "../logger";
import { listPublicLiveJobs } from "../utils/taskBrowse";
import { cachedPublicLiveJobs } from "../utils/publicLiveJobsCache";

export { resetPublicLiveJobsCache } from "../utils/publicLiveJobsCache";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  try {
    const jobs = await cachedPublicLiveJobs(listPublicLiveJobs);
    res.set("Cache-Control", "private, no-cache");
    return res.json({ jobs });
  } catch (error) {
    logger.warn({ error }, "Could not list the public live jobs");
    res.set("Cache-Control", "no-store");
    return res.status(503).json({ jobs: [], error: "Live jobs are not available right now." });
  }
});

export default router;
