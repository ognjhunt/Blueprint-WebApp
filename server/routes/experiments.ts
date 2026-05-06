import { Router } from "express";
import { logger } from "../logger";
import { getActiveExperimentRollouts } from "../utils/experiment-ops";

const router = Router();

router.get("/assignments", async (_req, res) => {
  const fetchedAt = new Date().toISOString();

  try {
    const assignments = await getActiveExperimentRollouts();
    return res.json({
      assignments,
      fetchedAt,
      sourceStatus: {
        experimentRollouts: "ready",
        warnings: [],
      },
    });
  } catch (error) {
    const warning =
      error instanceof Error ? error.message : "Experiment rollouts unavailable.";
    logger.warn({ err: error }, "Experiment assignment rollouts unavailable");

    return res.json({
      assignments: {},
      fetchedAt,
      sourceStatus: {
        experimentRollouts: "unavailable",
        warnings: [warning],
      },
    });
  }
});

export default router;
