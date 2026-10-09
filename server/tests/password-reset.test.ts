// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { csrfCookieHandler, csrfProtection } from "../middleware/csrf";
import { COMPANY } from "../../client/src/data/company";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), send: vi.fn(), warn: vi.fn() }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ authAdmin: { generatePasswordResetLink: mocks.generate } }));
vi.mock("../utils/email", () => ({ sendEmail: mocks.send }));
vi.mock("../logger", () => ({ logger: { warn: mocks.warn } }));
vi.mock("../utils/rate-limit-redis", () => ({ createRateLimitRedisStore: () => undefined }));
let server: Server, base: string, cookie: string, csrf: string;
const resetUrl = "https://blueprint.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=private-reset-code";
beforeEach(async () => {
  vi.clearAllMocks(); vi.resetModules();
  mocks.generate.mockResolvedValue(resetUrl); mocks.send.mockResolvedValue({ sent: true });
  const { default: router } = await import("../routes/password-reset");
  const app = express(); app.use(express.json());
  app.get("/api/csrf", csrfCookieHandler); app.use("/api/password-reset", csrfProtection, router);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const response = await fetch(`${base}/api/csrf`);
  cookie = response.headers.get("set-cookie")!.split(";")[0]; csrf = (await response.json()).csrfToken;
});
afterEach(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
function request(body: unknown, token = true) {
  return fetch(`${base}/api/password-reset`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Cookie: cookie, "X-CSRF-Token": csrf } : {}) }, body: JSON.stringify(body) });
}
describe("branded password recovery", () => {
  it("generates a Firebase reset credential and sends the shared Blueprint template through Resend", async () => {
    const response = await request({ email: " Owner@Example.com " });
    expect(response.status).toBe(202); expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.generate).toHaveBeenCalledWith("owner@example.com", { url: `${COMPANY.website}/sign-in`, handleCodeInApp: false });
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@example.com", fromEmail: COMPANY.emails.hello, fromName: COMPANY.shortName, replyTo: COMPANY.emails.support, subject: "Reset your Blueprint password", html: expect.stringContaining("Reset password") }));
    expect(await response.text()).not.toContain("private-reset-code");
  });
  it("uses the same public confirmation for existing, absent, and undeliverable accounts", async () => {
    const known = await (await request({ email: "owner@example.com" })).json();
    mocks.generate.mockRejectedValueOnce({ code: "auth/user-not-found" });
    const absent = await (await request({ email: "missing@example.com" })).json();
    mocks.send.mockRejectedValueOnce(new Error(`secret ${resetUrl}`));
    const unavailable = await (await request({ email: "other@example.com" })).json();
    expect(absent).toEqual(known); expect(unavailable).toEqual(known);
    expect(mocks.send).toHaveBeenCalledTimes(2); expect(JSON.stringify(mocks.warn.mock.calls)).not.toMatch(/private-reset-code|other@example/);
  });
  it("does not automatically retry a send whose delivery is uncertain", async () => {
    mocks.send.mockResolvedValue({ sent: false });
    expect((await request({ email: "owner@example.com" })).status).toBe(202);
    expect(mocks.send).toHaveBeenCalledTimes(1); expect(mocks.warn).toHaveBeenCalledTimes(1);
  });
  it("requires CSRF and rejects caller-controlled reset links or sender overrides", async () => {
    expect((await request({ email: "owner@example.com" }, false)).status).toBe(403);
    expect((await request({ email: "invalid" })).status).toBe(400);
    expect((await request({ email: "owner@example.com", url: "https://evil.example", fromEmail: "evil@example.com" })).status).toBe(400);
    expect(mocks.generate).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("limits requests per normalized address without disclosing the limit in the confirmation", async () => {
    const responses = [];
    for (const email of ["owner@example.com", "OWNER@example.com", " owner@example.com ", "Owner@example.com"]) responses.push(await (await request({ email })).json());
    expect(responses.every(value => JSON.stringify(value) === JSON.stringify(responses[0]))).toBe(true);
    expect(mocks.send).toHaveBeenCalledTimes(3);
  });
  it("also limits requests per client IP", async () => {
    for (let i = 0; i < 6; i++) expect((await request({ email: `owner${i}@example.com` })).status).toBe(202);
    expect(mocks.send).toHaveBeenCalledTimes(5);
  });
});
