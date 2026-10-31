import { Router } from "express";
import { createPipelineSyncRateLimiter, verifyPipelineSyncRequest } from "../utils/pipelineSyncSecurity";
import { recordSceneExecutionWindowExtension, sceneExecutionWindowNotice } from "../utils/sceneExecutionWindowExtension";

/**
 * The Pipeline's notice that the owner approved a time-only extension of one
 * scene intent's execution window. Signed with the existing Pipeline sync
 * credential (never a legacy bearer); it changes no spend cap.
 */
const router = Router();
router.post("/task-evaluation-scene-intents/:intentId/execution-window-extensions", createPipelineSyncRateLimiter(),
  async (req, res) => {
    if (!req.header("X-Blueprint-Pipeline-Timestamp") || !req.header("X-Blueprint-Pipeline-Signature"))
      return res.status(401).json({ code: "missing_pipeline_sync_signature" });
    const auth = verifyPipelineSyncRequest(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.message, code: auth.code });
    const notice = sceneExecutionWindowNotice.safeParse(req.body);
    if (!notice.success || notice.data.intent_id !== req.params.intentId)
      return res.status(400).json({ code: "scene_execution_window_notice_invalid" });
    try {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json(await recordSceneExecutionWindowExtension(notice.data));
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "scene_execution_window_intake_unavailable") return res.status(404).json({ code });
      if (/^scene_execution_window_[a-z_]+$/.test(code) && code !== "scene_execution_window_store_unavailable")
        return res.status(409).json({ code });
      return res.status(503).json({ code: "scene_execution_window_store_unavailable" });
    }
  });
export default router;
