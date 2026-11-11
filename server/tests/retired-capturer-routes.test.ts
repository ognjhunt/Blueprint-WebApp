// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";

import { registerRetiredCapturerRoutes } from "../utils/retiredCapturerRoutes";

let server: Server | null = null;
const reached = vi.fn();

async function serve() {
  const app = express();
  registerRetiredCapturerRoutes(app);
  // Stand-ins for the real routers and the webhook, mounted after, as in routes.ts.
  app.use((req, res) => { reached(req.method, req.path); res.status(200).json({ ok: true }); });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  reached.mockClear();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = null;
});

describe("capturer money and account routes (switched off 2026-11-11)", () => {
  it.each([
    ["POST", "/v1/stripe/account/instant_payout", "capturer_payouts_off"],
    ["POST", "/v1/stripe/account/onboarding_link", "capturer_payouts_off"],
    ["GET", "/v1/stripe/account/onboarding_link", "capturer_payouts_off"],
    ["GET", "/v1/creator/earnings", "capturer_program_closed"],
    ["POST", "/v1/creator/captures", "capturer_program_closed"],
    ["GET", "/v1/creator/payouts/ledger", "capturer_program_closed"],
    ["GET", "/api/admin/capturer-applications", "capturer_applications_closed"],
    ["POST", "/api/admin/capturer-applications/u1/decision", "capturer_applications_closed"],
    ["POST", "/api/admin/field-ops/capture-jobs/j1/assign-capturer", "field_ops_retired"],
    ["POST", "/api/admin/field-ops/automation/capturer-reminders/run", "field_ops_retired"],
  ])("%s %s answers 410 %s and reaches nothing behind it", async (method, path, code) => {
    const base = await serve();
    const response = await fetch(`${base}${path}`, { method });
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: code });
    expect(reached).not.toHaveBeenCalled();
  });

  it("leaves the Stripe webhook and the other Stripe account reads alone", async () => {
    const base = await serve();
    expect((await fetch(`${base}/api/stripe/webhooks`, { method: "POST" })).status).toBe(200);
    expect((await fetch(`${base}/v1/stripe/account`)).status).toBe(200);
    expect(reached).toHaveBeenCalledTimes(2);
  });
});
