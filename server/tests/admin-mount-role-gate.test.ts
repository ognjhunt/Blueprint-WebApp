// @vitest-environment node
import { readFileSync } from "node:fs";
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
}, 60000);

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
