/**
 * GET /api/public/live-jobs: the live jobs anyone may see on /jobs (owner, 2026-11-23), as `listPublicLiveJobs`
 * words them: the kind of job, the country, the day it was shared and whether its simulation is ready. No sign-in;
 * the global /api limit applies. Read at most once a minute per process and cached by browsers for five minutes,
 * so a busy page never reads every job each time.
 */
import { Router, type Request, type Response } from "express";
import { logger } from "../logger";
import { listPublicLiveJobs, type PublicLiveJob } from "../utils/taskBrowse";

const router = Router();
const FRESH_MS = 60_000;
let cached: { atMs: number; jobs: PublicLiveJob[] } | null = null;

export function resetPublicLiveJobsCache() { cached = null; }

router.get("/", async (_req: Request, res: Response) => {
  try {
    if (!cached || Date.now() - cached.atMs > FRESH_MS) cached = { atMs: Date.now(), jobs: await listPublicLiveJobs() };
    res.set("Cache-Control", "public, max-age=300");
    return res.json({ jobs: cached.jobs });
  } catch (error) {
    logger.warn({ error }, "Could not list the public live jobs");
    res.set("Cache-Control", "no-store");
    return res.status(503).json({ jobs: [], error: "Live jobs are not available right now." });
  }
});

export default router;
