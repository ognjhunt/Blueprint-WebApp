// @vitest-environment node
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const logs = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() }));
vi.mock("../logger", () => ({ logger: logs }));
vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: { apps: [] }, dbAdmin: null }));

import { APP_CHECK_HEADER, appCheckMode, requireAppCheck } from "../middleware/appCheck";

let server: Server | undefined;
afterEach(async () => {
  vi.clearAllMocks();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  server = undefined;
});

async function serve(mode: string, verifier: ((token: string) => Promise<unknown>) | null) {
  const reached = vi.fn();
  const app = express();
  app.post("/guarded", requireAppCheck("unit_route", { verifier, env: { BLUEPRINT_APP_CHECK_MODE: mode } }), (_req, res) => {
    reached();
    res.status(201).json({ ok: true });
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind");
  const post = (token?: string) => fetch(`http://127.0.0.1:${address.port}/guarded`, {
    method: "POST", headers: token ? { [APP_CHECK_HEADER]: token } : {} });
  return { post, reached };
}

const verifier = vi.fn(async (token: string) => {
  if (token !== "good-token") throw Object.assign(new Error("invalid"), { code: "app-check/invalid-argument" });
  return { appId: "1:web", token: {} };
});

describe("App Check middleware", () => {
  it("is off unless monitor or enforce is chosen", () => {
    expect(appCheckMode({})).toBe("off");
    expect(appCheckMode({ BLUEPRINT_APP_CHECK_MODE: " Enforce " })).toBe("enforce");
    expect(appCheckMode({ BLUEPRINT_APP_CHECK_MODE: "monitor" })).toBe("monitor");
    expect(appCheckMode({ BLUEPRINT_APP_CHECK_MODE: "strict" })).toBe("off");
  });

  it("reads and verifies nothing when off", async () => {
    const { post, reached } = await serve("off", verifier);
    expect((await post()).status).toBe(201);
    expect(reached).toHaveBeenCalledTimes(1);
    expect(verifier).not.toHaveBeenCalled();
  });

  it("logs, but never refuses, in monitor mode", async () => {
    const { post, reached } = await serve("monitor", verifier);
    expect((await post()).status).toBe(201);
    expect((await post("forged")).status).toBe(201);
    expect((await post("good-token")).status).toBe(201);
    expect(reached).toHaveBeenCalledTimes(3);
    await vi.waitFor(() => expect(logs.info).toHaveBeenCalledTimes(2));
    expect(logs.info.mock.calls.map(([fields]) => fields.outcome)).toEqual(["missing", "invalid"]);
    expect(logs.info.mock.calls[0][0]).toMatchObject({ event: "app_check_monitor", route: "unit_route" });
    // The token itself is never logged.
    expect(JSON.stringify(logs.info.mock.calls)).not.toContain("forged");
  });

  it("refuses missing (401) and invalid (403) tokens in enforce mode before the route runs", async () => {
    const { post, reached } = await serve("enforce", verifier);
    const missing = await post();
    expect(missing.status).toBe(401);
    expect(await missing.json()).toMatchObject({ code: "app_check_required" });
    const invalid = await post("forged");
    expect(invalid.status).toBe(403);
    expect(await invalid.json()).toMatchObject({ code: "app_check_invalid" });
    expect(reached).not.toHaveBeenCalled();
    expect((await post("good-token")).status).toBe(201);
    expect(reached).toHaveBeenCalledTimes(1);
  });

  it("fails closed in enforce mode when the verifier is unavailable", async () => {
    const { post, reached } = await serve("enforce", null);
    const response = await post("good-token");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "app_check_unavailable" });
    expect(reached).not.toHaveBeenCalled();
  });
});
