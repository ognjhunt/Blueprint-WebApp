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
  if (normalized === "all" || normalized === "growth_campaign" || normalized === "lifecycle" || normalized === "optional_updates") {
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

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]!));

async function unsubscribeHandler(req: Request, res: Response) {
  const email = normalizeSuppressionEmail(getParam(req, "email"));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, error: "Valid email is required" });
  }
  const scope = normalizeScope(getParam(req, "scope"));
  const campaignId = getParam(req, "campaignId") || null;
  const cadenceId = getParam(req, "cadenceId") || null;
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  // GET also serves Express's HEAD fallback. A scanner/prefetch must never
  // turn a link observation into a recipient preference.
  if (req.method !== "POST") {
    if (req.accepts(["html", "json"]) === "json") return res.status(HTTP_STATUS.OK).json({
      ok: true, confirmationRequired: true, email, scope,
    });
    const hidden = Object.entries({ email, scope, ...(campaignId ? { campaignId } : {}), ...(cadenceId ? { cadenceId } : {}) })
      .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`).join("");
    return res.status(HTTP_STATUS.OK).type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>Blueprint email preferences</title></head><body>
      <h1>Stop these Blueprint emails?</h1><p>Confirm the preference for ${escapeHtml(email)} (${scope.replace("_", " ")}). No preference has changed yet.</p>
      <form method="post" action="/api/growth/email/unsubscribe">${hidden}<button type="submit" name="confirmation" value="unsubscribe">Confirm opt-out</button></form>
      </body></html>`);
  }
  // The form carries the exact target shown on GET. Query parameters cannot
  // substitute another recipient or scope behind a deliberate confirmation.
  if (req.body?.confirmation !== "unsubscribe" || normalizeSuppressionEmail(req.body?.email) !== email
    || normalizeScope(req.body?.scope) !== scope) return res.status(HTTP_STATUS.BAD_REQUEST).json({
      ok: false, error: "Confirm the matching email preference before submitting", confirmationRequired: true,
    });
  const suppression = await recordEmailSuppression({ email, scope, reason: "unsubscribe", source: "email_preferences_route", campaignId, cadenceId });
  if (!suppression.persisted) return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Email preference storage is unavailable" });
  if (req.accepts(["html", "json"]) === "html") return res.status(HTTP_STATUS.OK).type("text/plain")
    .send("Your opt-out has been recorded. You will not receive these Blueprint emails.");
  return res.status(HTTP_STATUS.OK).json({ ok: true, email, scope });
}

router.get("/unsubscribe", unsubscribeHandler);
router.post("/unsubscribe", unsubscribeHandler);

export default router;
