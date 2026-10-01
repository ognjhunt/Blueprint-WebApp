// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
const auth = vi.hoisted(() => ({ verifyIdToken: vi.fn(async () => ({ uid: "owner-uid", auth_time: 900 })) }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ authAdmin: auth, dbAdmin: null }));
import { founderGmailOAuthRouter } from "../routes/communications-oauth";
import { FOUNDER_OAUTH_PREFIX, FOUNDER_OAUTH_COOKIE } from "../agents/communications-oauth";
import { consentFixture } from "./fixtures/communications-oauth";
import { privateWorkLogPath } from "../utils/blueprintWorkLogPrivacy";
let server: Server | undefined;
afterEach(async () => { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; vi.clearAllMocks(); });
async function app(enabled = true) {
  const f = consentFixture(); const app = express(); app.use(express.json());
  app.use(FOUNDER_OAUTH_PREFIX, founderGmailOAuthRouter(() => enabled ? f.consent : null));
  server = createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  const request = (path: string, options: RequestInit = {}) => fetch(`http://127.0.0.1:${port}${FOUNDER_OAUTH_PREFIX}${path}`, { redirect: "manual", ...options });
  const headers = { Authorization: "Bearer mock-firebase", "Content-Type": "application/json", Origin: "https://tryblueprint.io", "X-CSRF-Token": "csrf", Cookie: "csrf_token=csrf" };
  return { f, request, headers };
}
describe("actual mounted founder Google consent routes", () => {
  it("stays disabled with no provider or storage calls", async () => {
    const { f, request, headers } = await app(false);
    expect(await (await request("/status", { headers })).json()).toMatchObject({ enabled: false, sendsEnabled: false });
    expect((await request("/start", { method: "POST", headers, body: "{}" })).status).toBe(503);
    expect((await request("/callback?state=private&code=secret")).status).toBe(503);
    expect(f.records.size).toBe(0); expect(f.ports.exchange).not.toHaveBeenCalled();
  });
  it("requires verified Firebase bearer, CSRF, exact origin and an empty body", async () => {
    const { f, request, headers } = await app();
    expect((await request("/status")).status).toBe(401);
    expect((await request("/start", { method: "POST", headers: { ...headers, "X-CSRF-Token": "wrong" }, body: "{}" })).status).toBe(403);
    expect((await request("/start", { method: "POST", headers: { ...headers, Origin: "https://attacker.example" }, body: "{}" })).status).toBe(403);
    expect((await request("/start", { method: "POST", headers, body: JSON.stringify({ refresh_token: "never-accepted" }) })).status).toBe(400);
    auth.verifyIdToken.mockResolvedValueOnce({ uid: "other", auth_time: 900 });
    expect((await request("/start", { method: "POST", headers, body: "{}" })).status).toBe(403);
    expect(f.records.size).toBe(0);
  });
  it("receives Google callback without exposing codes; requires explicit owner POST before exchange/save", async () => {
    const { f, request, headers } = await app();
    const start = await request("/start", { method: "POST", headers, body: "{}" });
    const cookie = start.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("Secure"); expect(cookie).toContain("SameSite=Lax"); expect(cookie).toContain(`Path=${FOUNDER_OAUTH_PREFIX}`);
    const state = new URL((await start.json()).authorizationUrl).searchParams.get("state");
    const browserCookie = cookie.split(";", 1)[0];
    const callback = await request(`/callback?state=${state}&code=PRIVATE_CODE`, { headers: { Cookie: browserCookie } });
    expect(callback.status).toBe(303); expect(callback.headers.get("location")).toBe("/admin/leads?founder_gmail=returned");
    expect(callback.headers.get("referrer-policy")).toBe("no-referrer"); expect(callback.headers.get("cache-control")).toBe("no-store");
    expect(f.ports.exchange).not.toHaveBeenCalled(); expect(f.ports.save).not.toHaveBeenCalled();
    expect((await request("/complete", { method: "POST", headers: { Cookie: browserCookie }, body: "{}" })).status).toBe(401);
    const complete = await request("/complete", { method: "POST", headers: { ...headers, Cookie: headers.Cookie + ";" + browserCookie }, body: "{}" });
    const result = await complete.json(); expect(result).toMatchObject({ state: "connected_readonly", sendsEnabled: false });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_CODE|PRIVATE_REFRESH|PRIVATE_ACCESS/);
    expect(complete.headers.get("set-cookie")).toContain(FOUNDER_OAUTH_COOKIE);
    expect(f.ports.exchange).toHaveBeenCalledTimes(1); expect(f.ports.save).toHaveBeenCalledTimes(1);
  });
  it("refuses repeated parameters and strips all callback query values from request logs", async () => {
    const { request } = await app();
    const response = await request("/callback?state=a&state=b&code=PRIVATE_CODE");
    expect(response.status).toBe(400); expect(await response.text()).not.toContain("PRIVATE_CODE");
    expect(privateWorkLogPath(`${FOUNDER_OAUTH_PREFIX}/callback?state=PRIVATE_STATE&code=PRIVATE_CODE`)).toBe(`${FOUNDER_OAUTH_PREFIX}/callback`);
  });
});
