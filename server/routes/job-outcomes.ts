/**
 * The one-click links in the outcome questions (PACKAGE_E E8).
 *
 * `GET /api/job-outcomes/:token` shows a small confirm page and records nothing: email scanners
 * follow links. `POST` (the page's one button) records the answer the link carries and redirects to
 * the thank-you page. The signed, single-purpose token is the credential, so the page is a plain form
 * with no CSRF header; a forged post would need the token itself. A link reveals nothing but the
 * answer it carries: no name, no job, no company. Rate limiting is the global `/api` limiter.
 */
import { Router, type Response } from "express";
import { OUTCOME_STATE_LABELS } from "../../client/src/lib/jobOutcomeStates";
import { logger } from "../logger";
import { recordOutcomeAnswer } from "../utils/jobOutcomes";
import { JOB_OUTCOME_TOKEN_PATTERN, verifyJobOutcomeToken } from "../utils/jobOutcomeToken";

const router = Router();

export const OUTCOME_LINK_NOT_WORKING = "This link no longer works.";
export const OUTCOME_CONFIRM_HEADING = "Record your answer";
export const OUTCOME_CONFIRM_BUTTON = "Record this answer";
export const OUTCOME_THANKS_PATH = "/job-outcome/thanks";

const page = (body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Blueprint</title><style>
:root{color-scheme:light dark}body{font-family:system-ui,sans-serif;margin:0;padding:32px 16px;line-height:1.5;background:Canvas;color:CanvasText}
main{max-width:480px;margin:0 auto}button{font:inherit;padding:12px 20px;min-height:44px;border-radius:8px;border:1px solid currentColor;cursor:pointer}
</style></head><body><main>${body}</main></body></html>`;

function send(res: Response, status: number, html: string) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex");
  return res.status(status).type("html").send(html);
}

const notWorking = (res: Response) => send(res, 404, page(`<h1>${OUTCOME_LINK_NOT_WORKING}</h1>`));

router.get("/:token", (req, res) => {
  const token = String(req.params.token || "");
  const payload = verifyJobOutcomeToken(token);
  if (!payload || !JOB_OUTCOME_TOKEN_PATTERN.test(token)) return notWorking(res);
  // The label is one of five fixed strings and the token matched its character pattern: nothing here needs escaping.
  return send(res, 200, page(`<h1>${OUTCOME_CONFIRM_HEADING}</h1><p>Your answer: <strong>${OUTCOME_STATE_LABELS[payload.state]}</strong></p>
<form method="post" action="/api/job-outcomes/${token}"><button type="submit">${OUTCOME_CONFIRM_BUTTON}</button></form>`));
});

router.post("/:token", async (req, res) => {
  const token = String(req.params.token || "");
  try {
    const result = await recordOutcomeAnswer(token);
    if (!result.ok) {
      if (result.reason === "store_unavailable") return send(res, 503, page("<h1>Please try again shortly.</h1>"));
      return notWorking(res);
    }
    res.setHeader("Cache-Control", "no-store");
    if (result.finalAlready) return res.redirect(303, `${OUTCOME_THANKS_PATH}?already=${result.finalAlready}`);
    return res.redirect(303, `${OUTCOME_THANKS_PATH}?answer=${result.state}`);
  } catch (error) {
    logger.warn({ error }, "Could not record an outcome answer");
    return send(res, 503, page("<h1>Please try again shortly.</h1>"));
  }
});

export default router;
