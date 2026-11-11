import type { Express, Request, Response } from "express";

/**
 * Capturer money and account routes, switched off (owner, 2026-11-11).
 *
 * No capture app is in use and Blueprint does not ask outside people to
 * capture: there are no outside capturers, no capturer marketplace and no
 * capturer payouts. These routes answer 410 with one short code before any
 * authentication, store read or provider call, so reaching them stores
 * nothing, calls nothing and moves no money. The route modules, Firestore
 * triggers and rules behind them stay in the tree until a separate deletion.
 *
 * Stripe webhook handling (`/api/stripe/webhooks`) is not here: provider
 * events are still accepted.
 */
export const RETIRED_CAPTURER_ROUTES: ReadonlyArray<{ method: "all" | "get" | "post"; path: string; code: string }> = [
  { method: "all", path: "/v1/creator", code: "capturer_program_closed" },
  { method: "post", path: "/v1/stripe/account/instant_payout", code: "capturer_payouts_off" },
  { method: "all", path: "/v1/stripe/account/onboarding_link", code: "capturer_payouts_off" },
  { method: "all", path: "/api/admin/capturer-applications", code: "capturer_applications_closed" },
  { method: "all", path: "/api/admin/field-ops", code: "field_ops_retired" },
];

function gone(code: string) {
  return (_req: Request, res: Response) => {
    res.status(410).json({ error: code });
  };
}

/** Register before the real routers so nothing behind them runs. */
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
