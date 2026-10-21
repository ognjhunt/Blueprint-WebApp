import { Router } from "express";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { acceptJobEvidencePublication } from "../utils/jobEvidenceStore";
import { JobMarketplaceError } from "../utils/jobMarketplaceWorkflow";
const router = Router();
router.post("/job-evidence-publications", createPipelineSyncRateLimiter(), async (req, res) => {
  const auth = verifyPipelineSyncRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ code: auth.code, error: auth.message });
  try { return res.json(await acceptJobEvidencePublication(req.body)); }
  catch (error) {
    if (error instanceof JobMarketplaceError) return res.status(error.status).json({ code: error.code, error: error.message });
    return res.status(400).json({ code: "job_evidence_invalid", error: "Scientific publication failed schema or digest validation." });
  }
});
export default router;
