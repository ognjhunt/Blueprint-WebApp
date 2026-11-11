import type { Express, Request, Response } from "express";

/**
 * Routes of the retired capture app, outside capturers, capturer payouts,
 * field operations and Blueprint filming visits (owner, 2026-11-11).
 *
 * There is one way to capture: a person who works at the site films the job
 * on their own phone and uploads it in the browser. The code behind these
 * routes is deleted. They answer 410 with one short code before any
 * authentication, store read or provider call, so an old client gets a clear
 * answer, nothing is stored, nothing is bought and no money moves.
 *
 * Stripe webhook handling (`/api/stripe/webhooks`) is not here: provider
 * events are still accepted.
 */
export const RETIRED_CAPTURER_ROUTES: ReadonlyArray<{ method: "all" | "get" | "post"; path: string; code: string }> = [
  // The capture app's account, capture and earnings API.
  { method: "all", path: "/v1/creator", code: "capturer_program_closed" },
  // Capturer city-launch status, read only by the capture app.
  { method: "get", path: "/api/public/launch/status", code: "capturer_program_closed" },
  // Stripe Connect accounts, onboarding, payout schedule and instant payouts for capturers.
  { method: "all", path: "/v1/stripe", code: "capturer_payouts_off" },
  { method: "all", path: "/api/admin/capturer-applications", code: "capturer_applications_closed" },
  { method: "all", path: "/api/admin/field-ops", code: "field_ops_retired" },
  // Request, reschedule or cancel a Blueprint filming visit, or message its capturer.
  { method: "post", path: "/api/workspace/tasks/:taskId/capture", code: "filming_visits_retired" },
  // The capture app's bundle upload; browser uploads never call these.
  { method: "post", path: "/api/self-capture/uploads/:token/bundle", code: "capture_app_not_in_use" },
  { method: "post", path: "/api/self-capture/uploads/:token/bundle/targets", code: "capture_app_not_in_use" },
  { method: "post", path: "/api/self-capture/uploads/:token/bundle/complete", code: "capture_app_not_in_use" },
  // Publishing a claimable capture job for contributors, the admin "open in
  // BlueprintCapture" handoff, and the app's handoff read.
  { method: "post", path: "/api/admin/leads/:requestId/capture-job", code: "capturer_program_closed" },
  { method: "post", path: "/api/admin/leads/:requestId/capture-handoff", code: "capture_app_not_in_use" },
  { method: "get", path: "/api/requests/capture-handoff/:handoff", code: "capture_app_not_in_use" },
  // The capture app's direct world purchase. Website captures were always
  // refused here; the Pipeline prepares their scenes.
  { method: "post", path: "/api/internal/pipeline/creator-captures/:captureId/world/reconstruct", code: "capture_app_not_in_use" },
  { method: "post", path: "/api/internal/pipeline/creator-captures/:captureId/world/advance", code: "capture_app_not_in_use" },
];

function gone(code: string) {
  return (_req: Request, res: Response) => {
    res.status(410).json({ error: code });
  };
}

/** Register before every router so nothing behind them runs. */
export function registerRetiredCapturerRoutes(app: Express) {
  for (const route of RETIRED_CAPTURER_ROUTES) {
    if (route.method === "all") {
      // The prefix and everything under it.
      app.use(route.path, gone(route.code));
    } else {
      app[route.method](route.path, gone(route.code));
    }
  }
}
