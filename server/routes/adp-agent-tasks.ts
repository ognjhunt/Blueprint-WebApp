import { Router } from "express";
import { z } from "zod";

import { configuredAdpManagedRuns } from "../agents/adp-managed-runs";
import { requireExecutionRole } from "../middleware/requireAdminRole";

const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/);
const router = Router();
router.use(requireExecutionRole);
router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });

router.get("/", async (_req, res) => {
  try { return res.json({ tasks: await configuredAdpManagedRuns().list(), proof_effect: "none" }); }
  catch { return res.status(503).json({ error: "Agent task records are unavailable." }); }
});

router.get("/:taskId", async (req, res) => {
  const taskId = id.safeParse(req.params.taskId);
  if (!taskId.success) return res.status(400).json({ error: "Invalid task identifier." });
  try { return res.json(await configuredAdpManagedRuns().status(taskId.data)); }
  catch { return res.status(404).json({ error: "Admitted agent task not found." }); }
});

router.post("/:taskId/:action", async (req, res) => {
  const taskId = id.safeParse(req.params.taskId);
  const action = z.enum(["start", "cancel", "cleanup"]).safeParse(req.params.action);
  if (!taskId.success || !action.success || !z.object({}).strict().safeParse(req.body ?? {}).success) {
    return res.status(400).json({ error: "Select an admitted task and a supported action." });
  }
  try {
    const actor = res.locals.firebaseUser?.uid;
    if (!actor) return res.status(401).json({ error: "Authentication required." });
    const service = configuredAdpManagedRuns();
    const result = action.data === "start"
      ? await service.start(taskId.data, actor)
      : await service.requestAction(taskId.data, action.data, actor);
    return res.status(202).json(result);
  } catch {
    return res.status(409).json({ error: "The task does not admit this action in its current state." });
  }
});

export default router;
