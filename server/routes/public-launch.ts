import { Router } from "express";
import { buildCreatorLaunchStatus, buildUnavailableCreatorLaunchStatus } from "../utils/cityLaunchCaptureTargets";

const router = Router();

router.get("/status", async (req, res) => {
  const city = String(req.query.city || "").trim();
  const stateCode = String(req.query.state_code || "").trim() || null;
  const resolvedCity = city ? { city, stateCode } : null;
  try {
    const status = await buildCreatorLaunchStatus({
      resolvedCity,
    });

    res.json({
      ok: true,
      ...status,
    });
  } catch (error) {
    res.json({
      ok: true,
      ...buildUnavailableCreatorLaunchStatus({
        resolvedCity,
        warning: `publicLaunchStatus:${error instanceof Error ? error.message : String(error)}`,
      }),
    });
  }
});

export default router;
