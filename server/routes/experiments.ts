import { Router } from "express";
import { logger } from "../logger";
import { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";

const router = Router();

async function getActiveExperimentRollouts() {
  if (!db) {
    return {};
  }

  const snapshot = await db
    .collection("experiment_rollouts")
    .where("status", "==", "active")
    .get();

  return Object.fromEntries(
    snapshot.docs
      .map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        const experimentKey =
          typeof data.experiment_key === "string" ? data.experiment_key : doc.id;
        const variant =
          typeof data.winning_variant === "string" ? data.winning_variant : null;
        return variant ? [experimentKey, variant] : null;
      })
      .filter((entry): entry is [string, string] => Boolean(entry)),
  );
}

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
