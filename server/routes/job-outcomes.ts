/**
 * The one-click links in the outcome questions (PACKAGE_E E8).
 *
 * `GET /api/job-outcomes/:token` shows a small confirm page and records nothing: email scanners
 * follow links. `POST` (the page's button) records the answer the link carries and redirects to
 * the thank-you page. On a "Not going ahead" link the page has one button per reason
 * (`NOT_GOING_AHEAD_REASONS`, and "Rather not say"), each a form whose action names its reason
 * (`?reason=`), so the reason is one press too. The signed, single-purpose token is the credential, so
 * the page is a plain form with no CSRF header; a forged post would need the token itself, and could
 * only choose among the fixed reasons. A link reveals nothing but the answer it carries: no name, no
 * job, no company. Rate limiting is the global `/api` limiter.
 */
import { Router, type Response } from "express";
import { NOT_GOING_AHEAD_REASONS, NOT_GOING_AHEAD_REASON_LABELS, OUTCOME_STATE_LABELS, RATHER_NOT_SAY_LABEL, isNotGoingAheadReason }
  from "../../client/src/lib/jobOutcomeStates";
import { logger } from "../logger";
import { recordOutcomeAnswer } from "../utils/jobOutcomes";
import { JOB_OUTCOME_TOKEN_PATTERN, verifyJobOutcomeToken } from "../utils/jobOutcomeToken";

const router = Router();

export const OUTCOME_LINK_NOT_WORKING = "This link no longer works.";
/** Under the dead-link heading: the one other way to answer. */
export const OUTCOME_LINK_NOT_WORKING_NEXT = "You can email hello@tryblueprint.io instead.";
/** When the answer store cannot be reached: what happened, then what to do. */
export const OUTCOME_NOT_RECORDED = "We couldn't record that just now.";
export const OUTCOME_NOT_RECORDED_NEXT = "Please open the link again shortly.";
export const OUTCOME_CONFIRM_HEADING = "Record your answer";
export const OUTCOME_CONFIRM_BUTTON = "Record this answer";
/** Above the reason buttons on a "Not going ahead" link. */
export const OUTCOME_REASON_QUESTION = "What is the main reason? Press one.";
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

const notWorking = (res: Response) => send(res, 404, page(`<h1>${OUTCOME_LINK_NOT_WORKING}</h1><p>${OUTCOME_LINK_NOT_WORKING_NEXT}</p>`));
const notRecorded = (res: Response) => send(res, 503, page(`<h1>${OUTCOME_NOT_RECORDED}</h1><p>${OUTCOME_NOT_RECORDED_NEXT}</p>`));

router.get("/:token", (req, res) => {
  const token = String(req.params.token || "");
  const payload = verifyJobOutcomeToken(token);
  if (!payload || !JOB_OUTCOME_TOKEN_PATTERN.test(token)) return notWorking(res);
  // Every label is a fixed string and the token matched its character pattern: nothing here needs escaping.
  const answer = `<h1>${OUTCOME_CONFIRM_HEADING}</h1><p>Your answer: <strong>${OUTCOME_STATE_LABELS[payload.state]}</strong></p>`;
  if (payload.state !== "not_going_ahead")
    return send(res, 200, page(`${answer}
<form method="post" action="/api/job-outcomes/${token}"><button type="submit">${OUTCOME_CONFIRM_BUTTON}</button></form>`));
  const button = (reason: string | null, label: string) => `<form method="post" action="/api/job-outcomes/${token}${reason ? `?reason=${reason}` : ""}" style="margin:0 0 8px"><button type="submit">${label}</button></form>`;
  return send(res, 200, page(`${answer}<p>${OUTCOME_REASON_QUESTION}</p>
${NOT_GOING_AHEAD_REASONS.map(reason => button(reason, NOT_GOING_AHEAD_REASON_LABELS[reason])).join("\n")}
${button(null, RATHER_NOT_SAY_LABEL)}`));
});

router.post("/:token", async (req, res) => {
  const token = String(req.params.token || "");
  try {
    // The reason a "Not going ahead" page's button names; anything else is not recorded (`recordOutcomeAnswer`).
    const pressed = typeof req.query.reason === "string" ? req.query.reason : (req.body as { reason?: unknown } | undefined)?.reason;
    const result = await recordOutcomeAnswer(token, new Date(), { reason: isNotGoingAheadReason(pressed) ? pressed : undefined });
    if (!result.ok) {
      if (result.reason === "store_unavailable") return notRecorded(res);
      return notWorking(res);
    }
    res.setHeader("Cache-Control", "no-store");
    if (result.finalAlready) return res.redirect(303, `${OUTCOME_THANKS_PATH}?already=${result.finalAlready}`);
    return res.redirect(303, `${OUTCOME_THANKS_PATH}?answer=${result.state}${result.notGoingAheadReason ? `&reason=${result.notGoingAheadReason}` : ""}`);
  } catch (error) {
    logger.warn({ error }, "Could not record an outcome answer");
    return notRecorded(res);
  }
});

export default router;
