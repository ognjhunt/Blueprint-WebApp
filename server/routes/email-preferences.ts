import { Request, Response, Router } from "express";
import { HTTP_STATUS } from "../constants/http-status";
import {
  type EmailSuppressionScope,
  normalizeSuppressionEmail,
  recordEmailSuppression,
} from "../utils/email-suppression";

const router = Router();

function normalizeScope(value: unknown): EmailSuppressionScope {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "all" || normalized === "growth_campaign" || normalized === "lifecycle") {
    return normalized;
  }
  return "lifecycle";
}

function getParam(req: Request, key: string) {
  const queryValue = req.query[key];
  if (typeof queryValue === "string") {
    return queryValue;
  }
  const bodyValue = req.body?.[key];
  return typeof bodyValue === "string" ? bodyValue : "";
}

async function unsubscribeHandler(req: Request, res: Response) {
  const email = normalizeSuppressionEmail(getParam(req, "email"));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      ok: false,
      error: "Valid email is required",
    });
  }

  const scope = normalizeScope(getParam(req, "scope"));
  const campaignId = getParam(req, "campaignId") || null;
  const cadenceId = getParam(req, "cadenceId") || null;
  await recordEmailSuppression({
    email,
    scope,
    reason: "unsubscribe",
    source: "email_preferences_route",
    campaignId,
    cadenceId,
  });

  if (req.method === "POST" || req.accepts("json")) {
    return res.status(HTTP_STATUS.OK).json({ ok: true, email, scope });
  }

  return res
    .status(HTTP_STATUS.OK)
    .type("text/plain")
    .send("You have been unsubscribed from these Blueprint emails.");
}

router.get("/unsubscribe", unsubscribeHandler);
router.post("/unsubscribe", unsubscribeHandler);

export default router;
