// @vitest-environment node
import express from "express";
import { createHash } from "node:crypto";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { MemoryWorkStore } from "./helpers/work-memory-store";

const mocked = vi.hoisted(() => ({ store: null as any, operator: true, submissions: [] as any[] }));
vi.mock("../utils/blueprintWorkStore", () => ({
  firestoreWorkStore: { get: (...a: any[]) => mocked.store.get(...a), set: (...a: any[]) => mocked.store.set(...a), transaction: (...a: any[]) => mocked.store.transaction(...a) },
  checkWorkOperator: async () => mocked.operator,
}));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ dbAdmin: null,
  authAdmin: { verifyIdToken: async (token: string) => {
    if (token !== "firebase-test") throw new Error("invalid");
    return { uid: "operator-1", auth_time: 1000, firebase: {} };
  } },
}));
vi.mock("../routes/admin-task-evaluation-launches", async () => {
  const { Router } = await import("express"); const router = Router();
  router.get("/profiles", (_req, res) => res.json({ profiles: [{ profile_id: "test" }] }));
  router.get("/:id", (req, res) => res.json({ launch_id: req.params.id, state: "running", api_key: "do-not-expose" }));
  return { default: router,
    preflightTaskEvaluationLaunch: async (req: any, res: any, context: any) => res.json({ status: "ready", candidate_request_digest: createHash("sha256").update(JSON.stringify([req.body, context.actorId, context.actorRole])).digest("hex") }),
    submitTaskEvaluationLaunch: async (req: any, res: any, context: any) => { mocked.submissions.push({ body: req.body, context }); return res.status(202).json({ accepted: true, launch_id: req.body.launch_id }); },
  };
});
vi.mock("../routes/task-evaluation-results", async () => ({ default: (await import("express")).Router() }));
import { registerBlueprintWorkRoutes, operationScope } from "../routes/blueprint-work";
import { csrfCookieHandler } from "../middleware/csrf";

let server: Server | undefined;
afterEach(async () => { if (server) { server.closeAllConnections(); await new Promise<void>(r => server!.close(() => r())); } vi.unstubAllEnvs(); });
async function start() {
  mocked.store = new MemoryWorkStore(); mocked.operator = true; mocked.submissions = [];
  vi.stubEnv("BLUEPRINT_WORK_ENABLED", "true");
  const app = express(); app.use(express.json()); app.use(express.urlencoded({ extended: false }));
  app.get("/api/csrf", csrfCookieHandler); registerBlueprintWorkRoutes(app);
  server = await new Promise<Server>(resolve => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  const port = (server.address() as { port: number }).port;
  return `http://127.0.0.1:${port}`;
}
async function connect(base: string, scope = "blueprint:runs:read blueprint:runs:launch") {
  const prefix = base + "/api/blueprint-work/oauth";
  const registered = await fetch(prefix + "/register", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ redirect_uris: ["https://chatgpt.com/connector/oauth/test"], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] }) });
  expect(registered.status).toBe(201);
  const client = await registered.json();
  const verifier = "v".repeat(64);
  const authorization = await fetch(prefix + "/authorize?" + new URLSearchParams({
    client_id: client.client_id, redirect_uri: client.redirect_uris[0], response_type: "code", scope,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
    resource: "https://tryblueprint.io/api/blueprint-work/mcp", state: "connection-state",
  }), { redirect: "manual" });
  expect(authorization.status).toBe(302);
  const flow = new URL(authorization.headers.get("location")!).searchParams.get("flow");
  const csrf = await fetch(base + "/api/csrf");
  const csrfToken = (await csrf.json()).csrfToken;
  const consent = await fetch(`${base}/api/blueprint-work/consent/${flow}`, { method: "POST", headers: {
    Authorization: "Bearer firebase-test", "Content-Type": "application/json", "X-CSRF-Token": csrfToken, Cookie: `csrf_token=${csrfToken}`,
  }, body: JSON.stringify({ allow: true }) });
  expect(consent.status).toBe(200);
  const code = new URL((await consent.json()).redirect_url).searchParams.get("code")!;
  const rejected = await fetch(prefix + "/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: "x".repeat(64),
      redirect_uri: client.redirect_uris[0], resource: "https://tryblueprint.io/api/blueprint-work/mcp" }) });
  expect(rejected.status).toBe(400);
  const exchanged = await fetch(prefix + "/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: client.client_id, code, code_verifier: verifier,
      redirect_uri: client.redirect_uris[0], resource: "https://tryblueprint.io/api/blueprint-work/mcp" }) });
  expect(exchanged.status).toBe(200);
  return await exchanged.json();
}

describe("Blueprint Work real OAuth and MCP HTTP transport", () => {
  it("discovers OAuth, connects with Firebase consent, and uses real SDK tools without provider keys", async () => {
    const base = await start();
    const discovery = await fetch(base + "/.well-known/oauth-protected-resource/api/blueprint-work/mcp");
    expect((await discovery.json()).resource).toBe("https://tryblueprint.io/api/blueprint-work/mcp");
    const unsupported = await fetch(base + "/api/blueprint-work/oauth/.well-known/openid-configuration");
    expect(unsupported.status).toBe(404);
    expect(unsupported.headers.get("content-type")).toContain("application/json");
    const denied = await fetch(base + "/api/blueprint-work/mcp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(denied.status).toBe(401); expect(denied.headers.get("www-authenticate")).toContain("resource_metadata");
    const tokens = await connect(base);
    const client = new Client({ name: "work-test", version: "1" });
    await client.connect(new StreamableHTTPClientTransport(new URL(base + "/api/blueprint-work/mcp"), {
      requestInit: { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    }));
    const tools = await client.listTools();
    expect(tools.tools.some(t => t.name === "submit_run")).toBe(true);
    const profiles = await client.callTool({ name: "list_launch_profiles", arguments: {} });
    expect(profiles.isError).toBe(false);
    expect(JSON.stringify(profiles)).toContain("profile_id");
    const status = await client.callTool({ name: "get_run_status", arguments: { launch_id: "test" } });
    expect(JSON.stringify(status)).not.toContain("do-not-expose");
    expect(mocked.submissions).toHaveLength(0);
    await client.close();
    mocked.operator = false;
    expect((await fetch(base + "/api/blueprint-work/operations/profiles", { headers: { Authorization: `Bearer ${tokens.access_token}` } })).status).toBe(401);
  });
  it("enforces read-only scopes on the HTTP operation surface as well as MCP", async () => {
    const base = await start(); const tokens = await connect(base, "blueprint:runs:read");
    const response = await fetch(base + "/api/blueprint-work/operations/", { method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" }, body: "{}" });
    expect(response.status).toBe(403); expect(mocked.submissions).toHaveLength(0);
    expect(operationScope("POST", "/anything/execute")).toBeNull();
    expect(operationScope("DELETE", "/run")).toBeNull();
    expect(operationScope("POST", "/run/terminal-resource-releases")).toBe("blueprint:runs:release");
  });
  it("fails closed when disabled and refuses consent without CSRF", async () => {
    const base = await start();
    expect((await fetch(base + "/api/blueprint-work/consent/unknown", { method: "POST", headers: {
      Authorization: "Bearer firebase-test", "Content-Type": "application/json",
    }, body: JSON.stringify({ allow: true }) })).status).toBe(403);
    vi.stubEnv("BLUEPRINT_WORK_ENABLED", "false");
    expect((await fetch(base + "/api/blueprint-work/health")).status).toBe(503);
  });
});
