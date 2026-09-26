import { Router } from "express";

import { sceneOwner } from "../utils/taskEvaluationSceneIntake";
import {
  fetchG1TeamCatalog,
  g1SubmissionSchema,
  submitG1TeamCampaign,
} from "../utils/nativeG1TeamCampaignForwarding";

const router = Router();

router.get("/setups", async (_req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const owner = sceneOwner(res.locals.firebaseUser || {});
    return res.json(await fetchG1TeamCatalog(owner));
  } catch {
    return res.status(503).json({ error: "G1 task setups are unavailable" });
  }
});

router.post("/", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const parsed = g1SubmissionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: "Confirm the G1 setup, four policies, and $12 limit" });
  try {
    const owner = sceneOwner(res.locals.firebaseUser || {});
    return res.status(202).json(await submitG1TeamCampaign(parsed.data, owner));
  } catch (error) {
    const code = error instanceof Error ? error.message : "g1_submission_unavailable";
    return res.status(code.includes("unavailable") || code.startsWith("g1_pipeline_5") ? 503 : 409)
      .json({ error: code });
  }
});

export default router;
