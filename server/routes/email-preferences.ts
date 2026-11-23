import { Request, Response, Router } from "express";
import { HTTP_STATUS } from "../constants/http-status";
import {
  type EmailSuppressionScope,
  normalizeSuppressionEmail,
  OPTIONAL_UPDATES_EMAILS,
  recordEmailSuppression,
  verifyUnsubscribeToken,
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

/**
 * The page's words, by what the link stops. Only `optional_updates` (the new-job email's footer) is linked from an
 * email today; any other scope is named plainly as "this kind of email", never by its internal name.
 */
function pageWords(scope: EmailSuppressionScope, email: string) {
  return scope === "optional_updates" ? {
    heading: `Unsubscribe from ${OPTIONAL_UPDATES_EMAILS}?`,
    text: `We'll stop sending them to ${escapeHtml(email)}.`,
    done: "You're unsubscribed. We won't send you new-job emails or Blueprint updates.",
  } : {
    heading: "Stop these emails from Blueprint?",
    text: `We'll stop sending this kind of email to ${escapeHtml(email)}. Nothing has changed yet.`,
    done: "You're unsubscribed. We won't send you these emails again.",
  };
}

/** What a person who opened the link in a browser is told when it cannot be done, in place of a JSON error. */
const LINK_INCOMPLETE = "This unsubscribe link is incomplete. Use the link in your latest Blueprint email, or write to hello@tryblueprint.io.";
const LINK_CHANGED = "This link changed. Open it again from the email.";
const NOT_SAVED = "We couldn't save that just now. Open the link again shortly.";

/** The small page frame the email-link pages use (the outcome questions' confirm page is the same). */
const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Blueprint email preferences</title><style>
:root{color-scheme:light dark}body{font-family:system-ui,sans-serif;margin:0;padding:32px 16px;line-height:1.5;background:Canvas;color:CanvasText}
main{max-width:480px;margin:0 auto}button{font:inherit;padding:12px 20px;min-height:44px;border-radius:8px;border:1px solid currentColor;cursor:pointer}
</style></head><body><main>${body}</main></body></html>`;

const wantsHtml = (req: Request) => req.accepts(["html", "json"]) === "html";

async function unsubscribeHandler(req: Request, res: Response) {
  // A link carries a sealed token. A link sent before it (address and scope in the query) still works.
  const token = getParam(req, "token");
  const sealed = token ? verifyUnsubscribeToken(token) : null;
  const email = token ? sealed?.email ?? "" : normalizeSuppressionEmail(getParam(req, "email"));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (wantsHtml(req)) return res.status(HTTP_STATUS.BAD_REQUEST).type("html").send(page(`<p>${LINK_INCOMPLETE}</p>`));
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ ok: false, error: "Valid email is required" });
  }
  const scope = sealed ? sealed.scope : normalizeScope(getParam(req, "scope"));
  const campaignId = getParam(req, "campaignId") || null;
  const cadenceId = getParam(req, "cadenceId") || null;
  const words = pageWords(scope, email);
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  // GET also serves Express's HEAD fallback. A scanner/prefetch must never
  // turn a link observation into a recipient preference.
  if (req.method !== "POST") {
    if (req.accepts(["html", "json"]) === "json") return res.status(HTTP_STATUS.OK).json({
      ok: true, confirmationRequired: true, email, scope,
    });
    const hidden = Object.entries({ ...(sealed ? { token } : { email, scope }), ...(campaignId ? { campaignId } : {}), ...(cadenceId ? { cadenceId } : {}) })
      .map(([name, value]) => `<input type="hidden" name="${name}" value="${escapeHtml(value)}">`).join("");
    return res.status(HTTP_STATUS.OK).type("html").send(page(`<h1>${words.heading}</h1><p>${words.text}</p>
      <form method="post" action="/api/growth/email/unsubscribe">${hidden}<button type="submit" name="confirmation" value="unsubscribe">Unsubscribe</button></form>`));
  }
  // The form carries the exact target shown on GET. Query parameters cannot
  // substitute another recipient or scope behind a deliberate confirmation.
  if (req.body?.confirmation !== "unsubscribe" || (sealed ? req.body?.token !== token
    : normalizeSuppressionEmail(req.body?.email) !== email || normalizeScope(req.body?.scope) !== scope)) {
    if (wantsHtml(req)) return res.status(HTTP_STATUS.BAD_REQUEST).type("html").send(page(`<p>${LINK_CHANGED}</p>`));
    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      ok: false, error: "Confirm the matching email preference before submitting", confirmationRequired: true,
    });
  }
  const suppression = await recordEmailSuppression({ email, scope, reason: "unsubscribe", source: "email_preferences_route", campaignId, cadenceId });
  if (!suppression.persisted) {
    if (wantsHtml(req)) return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).type("html").send(page(`<p>${NOT_SAVED}</p>`));
    return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({ ok: false, error: "Email preference storage is unavailable" });
  }
  if (wantsHtml(req)) return res.status(HTTP_STATUS.OK).type("html").send(page(`<h1>${words.done}</h1>`));
  return res.status(HTTP_STATUS.OK).json({ ok: true, email, scope });
}

router.get("/unsubscribe", unsubscribeHandler);
router.post("/unsubscribe", unsubscribeHandler);

export default router;
