// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";
import express from "express";
import { createServer, request as httpRequest, type Server } from "node:http";
const auth = vi.hoisted(() => ({ verifyIdToken: vi.fn(async () => ({ uid: "owner-uid", auth_time: 900 })) }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ authAdmin: auth, dbAdmin: null }));
import { founderGmailOAuthRouter } from "../routes/communications-oauth";
import { FOUNDER_OAUTH_PREFIX, FOUNDER_OAUTH_COOKIE, FOUNDER_OAUTH_CALLBACK } from "../agents/communications-oauth";
import { createHash } from "node:crypto";
import { consentFixture } from "./fixtures/communications-oauth";
import { privateWorkLogPath } from "../utils/blueprintWorkLogPrivacy";
let server: Server | undefined;
afterEach(async () => { if (server) await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; vi.clearAllMocks(); });
async function app(enabled = true) {
  const f = consentFixture(); const app = express(); app.use(express.json());
  app.use(FOUNDER_OAUTH_PREFIX, founderGmailOAuthRouter(() => enabled ? f.consent : null));
  server = createServer(app); await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  // Node 24 fetch ignores caller-supplied Host. Use raw HTTP so these tests
  // exercise the actual deployed Host header instead of loopback's hostname.
  const request = (path: string, options: RequestInit = {}) => new Promise<Response>((resolve, reject) => {
    const req = httpRequest(`http://127.0.0.1:${port}${FOUNDER_OAUTH_PREFIX}${path}`, {
      method: options.method || "GET", headers: { host: "tryblueprint.io", ...Object.fromEntries(new Headers(options.headers).entries()) },
    }, res => {
      const chunks: Buffer[] = []; res.on("data", chunk => chunks.push(Buffer.from(chunk)));
      res.on("error", reject); res.on("end", () => {
        const headers = new Headers();
        for (let i = 0; i < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
        resolve(new Response(Buffer.concat(chunks), { status: res.statusCode, headers }));
      });
    });
    req.on("error", reject); req.end(options.body);
  });
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
    expect((await request("/start", { method: "POST", headers: { ...headers, "X-CSRF-Token": "", "x-blueprint-native-client": "ios" }, body: "{}" })).status).toBe(403);
    expect(f.records.size).toBe(0);
  });
  it("permits www preparation but refuses consent mutations and callbacks off the fixed host", async () => {
    const { f, request, headers } = await app();
    const wwwHeaders = { ...headers, Host: "www.tryblueprint.io", Origin: "https://www.tryblueprint.io" };
    expect(await (await request("/status", { headers: wwwHeaders })).json()).toMatchObject({ enabled: true, state: "idle", sendsEnabled: false });
    for (const path of ["/start", "/complete"]) {
      for (const host of ["www.tryblueprint.io", "attacker.example"]) {
        const response = await request(path, { method: "POST", headers: { ...headers, Host: host, "X-Forwarded-Host": "tryblueprint.io" }, body: "{}" });
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: "founder_oauth_callback_host_required" });
        expect(response.headers.get("set-cookie")).toBeNull();
      }
    }
    expect((await request("/start", { method: "POST", headers: { ...headers, Origin: wwwHeaders.Origin }, body: "{}" })).status).toBe(403);
    expect((await request("/callback?state=private&code=PRIVATE_CODE", { headers: { Host: "www.tryblueprint.io" } })).status).toBe(403);
    expect(f.records.size).toBe(0); expect(f.ports.exchange).not.toHaveBeenCalled(); expect(f.ports.save).not.toHaveBeenCalled();
  });
  it("receives Google callback without exposing codes; requires explicit owner POST before exchange/save", async () => {
    const { f, request, headers } = await app();
    const start = await request("/start", { method: "POST", headers, body: "{}" });
    const cookie = start.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly"); expect(cookie).toContain("Secure"); expect(cookie).toContain("SameSite=Lax"); expect(cookie).toContain(`Path=${FOUNDER_OAUTH_PREFIX}`);
    expect(cookie).not.toMatch(/Domain=/i);
    const authorization = new URL((await start.json()).authorizationUrl);
    expect(authorization.searchParams.get("redirect_uri")).toBe(FOUNDER_OAUTH_CALLBACK);
    expect(authorization.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/gmail.readonly");
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    const state = authorization.searchParams.get("state");
    const browserCookie = cookie.split(";", 1)[0];
    expect((await request(`/callback?state=${state}&code=PRIVATE_CODE`)).status).toBe(400);
    expect((await request(`/callback?state=${"a".repeat(43)}&code=PRIVATE_CODE`, { headers: { Cookie: browserCookie } })).status).toBe(400);
    expect((await request(`/callback?state=${state}&code=PRIVATE_CODE`, { headers: { Cookie: browserCookie, Host: "www.tryblueprint.io" } })).status).toBe(403);
    const callback = await request(`/callback?state=${state}&code=PRIVATE_CODE`, { headers: { Cookie: browserCookie } });
    expect(callback.status).toBe(303); expect(callback.headers.get("location")).toBe("/admin/leads?founder_gmail=returned");
    expect(callback.headers.get("referrer-policy")).toBe("no-referrer"); expect(callback.headers.get("cache-control")).toBe("no-store");
    expect(f.ports.exchange).not.toHaveBeenCalled(); expect(f.ports.save).not.toHaveBeenCalled();
    expect((await request(`/callback?state=${state}&code=PRIVATE_CODE`, { headers: { Cookie: browserCookie } })).status).toBe(400);
    expect((await request("/complete", { method: "POST", headers: { Cookie: browserCookie }, body: "{}" })).status).toBe(401);
    expect((await request("/complete", { method: "POST", headers: { ...headers, "X-CSRF-Token": "wrong", Cookie: headers.Cookie + ";" + browserCookie }, body: "{}" })).status).toBe(403);
    const complete = await request("/complete", { method: "POST", headers: { ...headers, Cookie: headers.Cookie + ";" + browserCookie }, body: "{}" });
    const result = await complete.json(); expect(result).toMatchObject({ state: "connected_readonly", sendsEnabled: false });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_CODE|PRIVATE_REFRESH|PRIVATE_ACCESS/);
    expect(complete.headers.get("set-cookie")).toContain(FOUNDER_OAUTH_COOKIE);
    expect(f.ports.exchange).toHaveBeenCalledTimes(1); expect(f.ports.save).toHaveBeenCalledTimes(1);
    const exchange = vi.mocked(f.ports.exchange).mock.calls[0][0];
    expect(exchange.callback).toBe(FOUNDER_OAUTH_CALLBACK);
    expect(createHash("sha256").update(exchange.verifier).digest("base64url")).toBe(authorization.searchParams.get("code_challenge"));
    expect((await request("/complete", { method: "POST", headers: { ...headers, Cookie: headers.Cookie + ";" + browserCookie }, body: "{}" })).status).toBe(400);
    expect(f.ports.exchange).toHaveBeenCalledTimes(1); expect(f.ports.save).toHaveBeenCalledTimes(1);
  });
  it("refuses repeated parameters and strips all callback query values from request logs", async () => {
    const { request } = await app();
    const response = await request("/callback?state=a&state=b&code=PRIVATE_CODE");
    expect(response.status).toBe(400); expect(await response.text()).not.toContain("PRIVATE_CODE");
    expect(privateWorkLogPath(`${FOUNDER_OAUTH_PREFIX}/callback?state=PRIVATE_STATE&code=PRIVATE_CODE`)).toBe(`${FOUNDER_OAUTH_PREFIX}/callback`);
  });
  it("returns a safe completion failure stage, keeps the failed status, and refuses a second exchange", async () => {
    const { f, request, headers } = await app(), flow = await f.start();
    await f.consent.callback({ state: flow.state, code: "PRIVATE_CODE" }, flow.cookie);
    vi.mocked(f.ports.exchange).mockRejectedValueOnce(new Error("PRIVATE_CODE PRIVATE_ACCESS PRIVATE_REFRESH provider details"));
    const cookie = headers.Cookie + `;${FOUNDER_OAUTH_COOKIE}=${flow.cookie}`;
    const response = await request("/complete", { method: "POST", headers: { ...headers, Cookie: cookie }, body: "{}" });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "founder_oauth_exchange_failed_requires_new_owner_consent", failureStage: "token_exchange" });
    expect(await (await request("/status", { headers: { ...headers, Cookie: cookie } })).json()).toMatchObject({ state: "failed_requires_new_owner_consent", failureStage: "token_exchange", sendsEnabled: false });
    expect((await request("/complete", { method: "POST", headers: { ...headers, Cookie: cookie }, body: "{}" })).status).toBe(400);
    expect(f.ports.exchange).toHaveBeenCalledTimes(1); expect(f.ports.save).not.toHaveBeenCalled();
  });
});
