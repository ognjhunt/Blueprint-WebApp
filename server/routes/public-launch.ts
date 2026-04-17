import { Router } from "express";
import { buildCreatorLaunchStatus } from "../utils/cityLaunchCaptureTargets";

const router = Router();

router.get("/status", async (req, res) => {
  try {
    const city = String(req.query.city || "").trim();
    const stateCode = String(req.query.state_code || "").trim() || null;

    const status = await buildCreatorLaunchStatus({
      resolvedCity: city ? { city, stateCode } : null,
    });

    res.json({
      ok: true,
      ...status,
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
