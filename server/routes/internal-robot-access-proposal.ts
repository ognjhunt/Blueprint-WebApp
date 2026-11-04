import { Router } from "express";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { recordRobotAccessProposal, robotAccessProposalSchema } from "../utils/websiteRobotAccessRemoval";

/**
 * The Pipeline's signed notice that moving named movable furniture would give
 * the robot room in a website job's simulation, answered with the job owner's
 * decision on exactly that proposal, if any. Signed with the existing Pipeline
 * sync credential; it changes nothing in the simulation by itself.
 */
const router = Router();
router.post("/task-evaluation-scene-intents/:intentId/robot-access-proposal", createPipelineSyncRateLimiter(),
  async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature"))
      return res.status(401).json({ code: "missing_pipeline_sync_signature" });
    const auth = verifyPipelineSyncRequest(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.message, code: auth.code });
    const notice = robotAccessProposalSchema.safeParse(req.body);
    if (!notice.success || notice.data.intent_id !== req.params.intentId)
      return res.status(400).json({ code: "website_robot_access_proposal_invalid" });
    try {
      return res.status(200).json(await recordRobotAccessProposal(notice.data));
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "website_robot_access_intake_unavailable") return res.status(404).json({ code });
      if (/^website_robot_access_[a-z_]+$/.test(code) && code !== "website_robot_access_store_unavailable")
        return res.status(409).json({ code });
      return res.status(503).json({ code: "website_robot_access_store_unavailable" });
    }
  });
export default router;
