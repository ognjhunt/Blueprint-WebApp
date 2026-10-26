import { Router } from "express";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { parseBetaPolicyScreeningPublication } from "../utils/betaPolicyScreeningContract";
import { ingestBetaPolicyScreening } from "../utils/betaPolicyScreeningIngest";

const router = Router();
router.post("/beta-policy-screening-runs", createPipelineSyncRateLimiter(), async (req, res) => {
  const auth = verifyPipelineSyncRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message, code: auth.code });
  const publication = parseBetaPolicyScreeningPublication(req.body);
  if (!publication) return res.status(400).json({ code: "screening_publication_invalid" });
  try {
    const receipt = await ingestBetaPolicyScreening(publication);
    return res.status(receipt.status === "created" ? 201 : 200).json(receipt);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (/^(screening_|job_)[a-z_]+$/.test(code))
      return res.status(code.endsWith("store_unavailable") ? 503 : 409).json({ code });
    return res.status(503).json({ code: "screening_store_unavailable" });
  }
});
export default router;
