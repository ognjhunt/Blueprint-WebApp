import { Router } from "express";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { parseBetaPolicyScreeningPublication } from "../utils/betaPolicyScreeningContract";
import { ingestBetaCandidateSelection, ingestBetaPolicyScreening, observeBetaScreeningExecutionControl,
  parseBetaScreeningExecutionControlRequest } from "../utils/betaPolicyScreeningIngest";
import { parseBetaCandidateSelection } from "../utils/betaCandidateSelection";

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
router.post("/beta-policy-screening-runs/:campaignId/execution-control", createPipelineSyncRateLimiter(), async (req, res) => {
  // This controller-only observation always requires the existing signature,
  // including installations that retain legacy bearer publication transport.
  if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature"))
    return res.status(401).json({ code: "missing_pipeline_sync_signature" });
  const auth = verifyPipelineSyncRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message, code: auth.code });
  const request = parseBetaScreeningExecutionControlRequest(req.body);
  if (!request || request.campaign_id !== req.params.campaignId)
    return res.status(400).json({ code: "screening_control_request_invalid" });
  try { return res.status(200).json(await observeBetaScreeningExecutionControl(request)); }
  catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (/^screening_[a-z_]+$/.test(code))
      return res.status(code.endsWith("unavailable") ? 503 : 409).json({ code });
    return res.status(503).json({ code: "screening_store_unavailable" });
  }
});
router.post("/beta-policy-screening-runs/:campaignId/candidate-selection", createPipelineSyncRateLimiter(), async (req, res) => {
  // A new delivery, so it never takes the legacy bearer transport.
  if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature"))
    return res.status(401).json({ code: "missing_pipeline_sync_signature" });
  const auth = verifyPipelineSyncRequest(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.message, code: auth.code });
  const selection = parseBetaCandidateSelection(req.body);
  if (!selection || selection.campaign_id !== req.params.campaignId)
    return res.status(400).json({ code: "screening_selection_invalid" });
  try {
    const receipt = await ingestBetaCandidateSelection(selection);
    return res.status(receipt.status === "created" ? 201 : 200).json(receipt);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (/^screening_[a-z_]+$/.test(code))
      return res.status(code.endsWith("unavailable") ? 503 : 409).json({ code });
    return res.status(503).json({ code: "screening_store_unavailable" });
  }
});
export default router;
