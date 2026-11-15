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

describe("retired capture app, capturer, payout, field-ops and visit routes (2026-11-11)", () => {
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
    ["GET", "/v1/stripe/account", "capturer_payouts_off"],
    ["GET", "/v1/stripe/accounts/current", "capturer_payouts_off"],
    ["PUT", "/v1/stripe/account/payout_schedule", "capturer_payouts_off"],
    ["DELETE", "/v1/stripe/accounts/acct_1", "capturer_payouts_off"],
    ["GET", "/api/public/launch/status", "capturer_program_closed"],
    ["POST", "/api/workspace/tasks/task-1/capture", "filming_visits_retired"],
    ["POST", "/api/self-capture/uploads/any-token/bundle", "capture_app_not_in_use"],
    ["POST", "/api/self-capture/uploads/any-token/bundle/targets", "capture_app_not_in_use"],
    ["POST", "/api/self-capture/uploads/any-token/bundle/complete", "capture_app_not_in_use"],
    ["POST", "/api/internal/pipeline/creator-captures/cap-1/world/reconstruct", "capture_app_not_in_use"],
    ["POST", "/api/internal/pipeline/creator-captures/walkthrough-req1/world/reconstruct", "capture_app_not_in_use"],
    ["POST", "/api/internal/pipeline/creator-captures/cap-1/world/advance", "capture_app_not_in_use"],
    ["POST", "/api/admin/leads/req-1/capture-job", "capturer_program_closed"],
    ["POST", "/api/admin/leads/req-1/capture-handoff", "capture_app_not_in_use"],
    ["GET", "/api/requests/capture-handoff/some-token", "capture_app_not_in_use"],
  ])("%s %s answers 410 %s and reaches nothing behind it", async (method, path, code) => {
    const base = await serve();
    const response = await fetch(`${base}${path}`, { method });
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: code });
    expect(reached).not.toHaveBeenCalled();
  });

  it("leaves the browser upload and the live Pipeline callbacks alone", async () => {
    const base = await serve();
    const live: Array<[string, string]> = [
      ["GET", "/api/self-capture/uploads/any-token/status"],
      ["POST", "/api/self-capture/uploads/any-token/complete"],
      ["POST", "/api/workspace/tasks/task-1/recording-consent/withdraw"],
      ["POST", "/api/internal/pipeline/creator-captures/walkthrough-req1/task-context"],
      ["POST", "/api/internal/pipeline/creator-captures/walkthrough-req1/visual-scene"],
      ["POST", "/api/admin/leads/req-1/trigger-preview"],
      ["GET", "/api/requests/req-1"],
    ];
    for (const [method, path] of live) expect((await fetch(`${base}${path}`, { method })).status).toBe(200);
    expect(reached).toHaveBeenCalledTimes(live.length);
  });
});
