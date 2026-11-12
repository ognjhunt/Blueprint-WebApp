/**
 * `POST /api/job-facts/:token`: one tap on the site's quick questions (PACKAGE_E E1).
 *
 * The credential is the site's own signed link, verified by the same function as every other owner
 * route on the job page (`verifyCaptureUploadToken`, owner scope); there is no second scheme. Rate
 * limiting is the global `/api` limiter in `server/index.ts`, as for `/api/site-task-brief`. Every
 * value is checked against the closed code lists; no free text is accepted. A job whose site
 * withdrew its recording permission is refused and nothing is written.
 */
import { Router } from "express";
import { csrfProtection } from "../middleware/csrf";
import { logger } from "../logger";
import { verifyCaptureUploadToken } from "../utils/captureUploadToken";
import { JobFactsRefused, parseJobFactTap, saveJobFactTap } from "../utils/jobFacts";

const router = Router();

const NOT_SAVED = "Your answer could not be saved. Try again shortly.";

router.post("/:token", csrfProtection, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload || payload.scope !== "owner")
    return res.status(403).json({ ok: false, code: "job_facts_owner_link_required", error: "This link cannot change the job." });
  const parsed = parseJobFactTap(req.body);
  if (!parsed.ok) return res.status(400).json({ ok: false, code: `job_facts_${parsed.reason}`, error: NOT_SAVED });
  try {
    const jobFacts = await saveJobFactTap(payload.requestId, parsed.tap);
    return res.json({ ok: true, jobFacts });
  } catch (error) {
    if (error instanceof JobFactsRefused) {
      if (error.code === "consent_withdrawn") return res.status(409).json({ ok: false, code: "capture_processing_not_authorized",
        error: "Recording consent was withdrawn. Your job can no longer be changed." });
      if (error.code === "job_missing") return res.status(404).json({ ok: false, code: "job_facts_job_missing", error: NOT_SAVED });
    }
    logger.warn({ error, requestId: payload.requestId }, "Could not save a job fact");
    return res.status(503).json({ ok: false, code: "job_facts_unavailable", error: NOT_SAVED });
  }
});

export default router;
