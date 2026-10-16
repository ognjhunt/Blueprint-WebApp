// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { createServer, type Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const verifyIdToken = vi.fn();

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: { auth: () => ({ verifyIdToken }) },
  dbAdmin: null,
  storageAdmin: null,
  authAdmin: { verifyIdToken },
}));

/**
 * Every `app.use("/api/admin…", …)` mount exactly as written in
 * server/routes.ts. Reading the source keeps a newly added admin mount from
 * escaping this test.
 */
function adminMounts(): Array<{ path: string; middleware: string[] }> {
  const source = readFileSync(path.resolve(__dirname, "../routes.ts"), "utf8");
  const mounts: Array<{ path: string; middleware: string[] }> = [];
  for (const match of source.matchAll(/app\.use\(\s*"(\/api\/admin[^"]*)"\s*,([\s\S]*?)\);/g)) {
    const middleware = match[2].split(",").map((part) => part.trim()).filter(Boolean);
    mounts.push({ path: match[1], middleware });
  }
  return mounts;
}

const mounts = adminMounts();

const ROLE_GATES = ["requireAdminRole", "requireExecutionRole"];

/**
 * A router that imports a role gate holds handlers meant for admins or ops, so
 * every handler in it must be gated: on its own route, by a `router.use` before
 * it, or by every mount of that router in server/routes.ts. Returns each one
 * that is not, as "file METHOD path".
 */
function ungatedHandlersInGatedRouters(): string[] {
  const routesDir = path.resolve(__dirname, "../routes");
  const routesSource = readFileSync(path.resolve(__dirname, "../routes.ts"), "utf8");
  const ungated: string[] = [];
  for (const file of readdirSync(routesDir).filter((name) => name.endsWith(".ts"))) {
    const source = readFileSync(path.join(routesDir, file), "utf8");
    const gates = ROLE_GATES.filter((gate) =>
      new RegExp(`import[^;]*\\b${gate}\\b[^;]*from\\s+"\\.\\./middleware/requireAdminRole"`).test(source));
    if (!gates.length) continue;
    const gated = (text: string) => gates.some((gate) => new RegExp(`\\b${gate}\\b`).test(text));
    const routerGates = [...source.matchAll(/router\.use\(([^;]*?)\);/g)]
      .filter((use) => gated(use[1])).map((use) => use.index ?? 0);
    const variable = new RegExp(`import\\s+(\\w+)\\s+from\\s+"\\./routes/${file.replace(/\.ts$/, "")}"`)
      .exec(routesSource)?.[1];
    const routerMounts = variable
      ? [...routesSource.matchAll(/app\.use\(([\s\S]*?)\);/g)].map((use) => use[1])
        .filter((args) => args.split(",").map((part) => part.trim()).at(-1) === variable)
      : [];
    const mountGated = routerMounts.length > 0 && routerMounts.every(gated);
    for (const handler of source.matchAll(/router\.(get|post|put|patch|delete|all)\(\s*("[^"]*"|'[^']*')?/g)) {
      const start = handler.index ?? 0;
      const rest = source.slice(start + handler[0].length);
      const end = Math.min(...[rest.indexOf("=>"), rest.indexOf("router.")].filter((at) => at >= 0), rest.length);
      if (gated(rest.slice(0, end)) || routerGates.some((at) => at < start) || mountGated) continue;
      ungated.push(`${file} ${handler[1].toUpperCase()} ${handler[2] ?? "?"}`);
    }
  }
  return ungated;
}

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  verifyIdToken.mockResolvedValue({ uid: "ordinary-user", email: "site@example.com" });
  const { registerRoutes } = await import("../routes");
  const app = express();
  app.use(express.json());
  registerRoutes(app);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // Importing every route module is cheap alone but can run long while every
  // worker cold-transforms modules at the start of a coverage run.
}, 300_000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

describe("admin mounts in server/routes.ts", () => {
  it("finds the admin mounts", () => {
    expect(mounts.length).toBeGreaterThanOrEqual(17);
    expect(mounts.map((mount) => mount.path)).toContain("/api/admin/sla");
  });

  it.each(mounts.map((mount) => [mount.path, mount.middleware] as const))(
    "%s requires an admin/ops role right before its router",
    (_path, middleware) => {
      const gate = middleware.indexOf("requireAdminRole");
      expect(gate).toBeGreaterThan(0);
      expect(gate).toBe(middleware.length - 2);
    },
  );

  it.each(mounts.map((mount) => [mount.path] as const))(
    "%s returns 403 to a signed-in account without an admin/ops role",
    async (mountPath) => {
      const response = await fetch(`${baseUrl}${mountPath}/role-gate-probe`, {
        headers: { Authorization: "Bearer ordinary-user-token" },
      });
      expect(response.status).toBe(403);
    },
  );
});

describe("routers that import a role gate", () => {
  it("gate every handler they declare", () => {
    expect(ungatedHandlersInGatedRouters()).toEqual([]);
  });

  it.each([["/api/city-launch/sends?city=austin"], ["/api/city-launch/status?city=austin"]])(
    "%s returns 403 to a signed-in account without an admin/ops role",
    async (url) => {
      const response = await fetch(`${baseUrl}${url}`, { headers: { Authorization: "Bearer ordinary-user-token" } });
      expect(response.status).toBe(403);
    },
  );
});

describe("G1 development campaign spending authority", () => {
  it("mounts the entire namespace behind current execution authority", () => {
    const source = readFileSync(path.resolve(__dirname, "../routes.ts"), "utf8");
    const mount = /app\.use\(\s*"\/api\/native-g1-team-campaigns"\s*,([\s\S]*?)\);/.exec(source);
    expect(mount?.[1]).toMatch(/verifyFirebaseToken,[\s\S]*requireExecutionRole,\s*nativeG1TeamCampaignsRouter/);
  });

  it.each(["", "/policy-runs", "/policy-deliveries"])(
    "refuses a signed-in non-operator before forwarding %s",
    async (suffix) => {
      const response = await fetch(`${baseUrl}/api/native-g1-team-campaigns${suffix}`, {
        method: "POST",
        headers: {
          Authorization: "Bearer ordinary-user-token",
          "x-blueprint-native-client": "ios",
          "content-type": "application/json",
        },
        body: "{}",
      });
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toMatchObject({ error: "Verified execution authority required" });
    },
  );
});

describe("SLA trackers", () => {
  it("do not leak customer emails to an ordinary account", async () => {
    const response = await fetch(`${baseUrl}/api/admin/sla/status`, {
      headers: { Authorization: "Bearer ordinary-user-token" },
    });
    expect(response.status).toBe(403);
    expect(await response.text()).not.toMatch(/buyer_email|request_id/);
  });

  it("stay readable by ops", async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: "ops-user", roles: ["ops"] });
    const response = await fetch(`${baseUrl}/api/admin/sla/status`, {
      headers: { Authorization: "Bearer ops-token" },
    });
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });

  it("refuse an ordinary account even when the router is mounted without the mount gate", async () => {
    const { default: adminSlaRouter } = await import("../routes/admin-sla");
    const app = express();
    app.use((_req, res, next) => {
      res.locals.firebaseUser = { uid: "ordinary-user", email: "site@example.com" };
      next();
    });
    app.use("/sla", adminSlaRouter);
    const isolated = createServer(app);
    await new Promise<void>((resolve) => isolated.listen(0, resolve));
    try {
      const port = (isolated.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/sla/status`);
      expect(response.status).toBe(403);
    } finally {
      await new Promise<void>((resolve) => isolated.close(() => resolve()));
    }
  });
});
