import { Router } from "express";
import { getActiveExperimentRollouts } from "../utils/experiment-ops";

const router = Router();

router.get("/assignments", async (_req, res) => {
  const assignments = await getActiveExperimentRollouts();
  return res.json({
    assignments,
    fetchedAt: new Date().toISOString(),
  });
});

export default router;
