/**
 * `POST /api/job-facts/:token`: one tap on the site's quick questions (PACKAGE_E E1).
 *
 * The credential is the site's own signed link, verified by the same function as every other owner
 * route on the job page (`verifyCaptureUploadToken`, owner scope); there is no second scheme. Rate
 * limiting is the global `/api` limiter in `server/index.ts`, as for `/api/site-task-brief`. Every
 * value is checked against the closed code lists; no free text is accepted. A tap on a question of the
 * job's brief (`{ custom, code, version }`) is checked against the brief the site's page shows now: a stale version, a question
 * it does not ask, or a choice it does not offer, is refused. A job whose site withdrew its recording
 * permission is refused and nothing is written.
 */
import { Router } from "express";
import { csrfProtection } from "../middleware/csrf";
import { logger } from "../logger";
import { verifyCaptureUploadToken } from "../utils/captureUploadToken";
import { JobFactsRefused, parseCustomJobFactTap, parseJobFactTap, saveCustomJobFactTap, saveJobFactTap } from "../utils/jobFacts";

const router = Router();

const NOT_SAVED = "Your answer could not be saved. Try again shortly.";
/** The brief's questions were written again while the page was open: nothing was saved, and the page shows the new ones. */
export const BRIEF_CHANGED = "These questions were just updated. Reload the page to answer the new ones.";

router.post("/:token", csrfProtection, async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const payload = verifyCaptureUploadToken(String(req.params.token || ""));
  if (!payload || payload.scope !== "owner")
    return res.status(403).json({ ok: false, code: "job_facts_owner_link_required", error: "This link cannot change the job." });
  // A question of the job's brief names its row (`custom`); a catalog question, its key.
  const custom = req.body && typeof req.body === "object" && !Array.isArray(req.body) && "custom" in req.body;
  const parsed = custom ? parseCustomJobFactTap(req.body) : parseJobFactTap(req.body);
  if (!parsed.ok) return res.status(400).json({ ok: false, code: `job_facts_${parsed.reason}`, error: NOT_SAVED });
  try {
    const jobFacts = "id" in parsed.tap ? await saveCustomJobFactTap(payload.requestId, parsed.tap)
      : await saveJobFactTap(payload.requestId, parsed.tap);
    return res.json({ ok: true, jobFacts });
  } catch (error) {
    if (error instanceof JobFactsRefused) {
      if (error.code === "unknown_question" || error.code === "unknown_answer")
        return res.status(400).json({ ok: false, code: `job_facts_${error.code}`, error: NOT_SAVED });
      if (error.code === "brief_changed") return res.status(409).json({ ok: false, code: "job_facts_brief_changed", error: BRIEF_CHANGED });
      if (error.code === "consent_withdrawn") return res.status(409).json({ ok: false, code: "capture_processing_not_authorized",
        error: "Recording consent was withdrawn. Your job can no longer be changed." });
      if (error.code === "job_missing") return res.status(404).json({ ok: false, code: "job_facts_job_missing", error: NOT_SAVED });
    }
    logger.warn({ error, requestId: payload.requestId }, "Could not save a job fact");
    return res.status(503).json({ ok: false, code: "job_facts_unavailable", error: NOT_SAVED });
  }
});

export default router;
