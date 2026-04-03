import { Router } from "express";
import { HTTP_STATUS } from "../constants/http-status";
import { isEnvFlagEnabled } from "../config/env";
import { logGrowthEvent } from "../utils/growth-events";
import { logger } from "../logger";

const router = Router();

router.post("/ingest", async (req, res) => {
  if (!isEnvFlagEnabled("BLUEPRINT_ANALYTICS_INGEST_ENABLED")) {
    return res.status(HTTP_STATUS.ACCEPTED).json({
      ok: true,
      persisted: false,
      disabled: true,
    });
  }

  try {
    const event = typeof req.body?.event === "string" ? req.body.event.trim() : "";
    if (!event) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, error: "Missing event" });
    }

    const result = await logGrowthEvent({
      event,
      anonymousId:
        typeof req.body?.anonymousId === "string" ? req.body.anonymousId : null,
      sessionId: typeof req.body?.sessionId === "string" ? req.body.sessionId : null,
      pagePath: typeof req.body?.pagePath === "string" ? req.body.pagePath : null,
      pageTitle: typeof req.body?.pageTitle === "string" ? req.body.pageTitle : null,
      currentUrl:
        typeof req.body?.currentUrl === "string" ? req.body.currentUrl : null,
      referrer: typeof req.body?.referrer === "string" ? req.body.referrer : null,
      source: typeof req.body?.source === "string" ? req.body.source : "web",
      properties:
        req.body?.properties && typeof req.body.properties === "object"
          ? req.body.properties
          : {},
      experiments:
        req.body?.experiments && typeof req.body.experiments === "object"
          ? req.body.experiments
          : {},
      attribution:
        req.body?.attribution && typeof req.body.attribution === "object"
          ? req.body.attribution
          : {},
      user:
        req.body?.user && typeof req.body.user === "object" ? req.body.user : null,
    });

    return res.status(HTTP_STATUS.ACCEPTED).json(result);
  } catch (error) {
    logger.error({ err: error }, "Failed to ingest analytics event");
    return res
      .status(500)
      .json({ ok: false, error: "Failed to ingest analytics event" });
  }
});

export default router;
