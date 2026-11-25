// @vitest-environment node
/**
 * `GET /api/admin/jobs/marketplace-numbers`: staff only (the console's own admin or ops check), the window and the
 * internal test switch read strictly, never cached, and a read that fails is a 503, never numbers made up.
 */
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../client/src/lib/firebaseAdmin", () => ({ default: {}, dbAdmin: null }));
vi.mock("../utils/access-control", () => ({
  hasAnyRole: async (res: express.Response, roles: string[]) => roles.includes("admin") && res.locals.firebaseUser?.admin === true,
}));
const loader = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>>, fail: false }));
vi.mock("../utils/marketplaceNumbers", () => ({
  loadMarketplaceNumbers: vi.fn(async (options: Record<string, unknown>) => {
    loader.calls.push(options);
    if (loader.fail) throw new Error("index missing");
    return { windowDays: options.windowDays, includeTests: options.includeTests, sharedJobs: 0, jobs: [] };
  }),
}));

let server: Server;
let base: string;
beforeEach(async () => {
  loader.calls.length = 0;
  loader.fail = false;
  const { default: router } = await import("../routes/admin-job-console");
  const app = express();
  app.use((req, res, next) => {
    const auth = req.headers.authorization;
    res.locals.firebaseUser = auth === "Bearer admin" ? { uid: "admin", admin: true } : auth === "Bearer user" ? { uid: "user" } : null;
    next();
  });
  app.use("/api/admin/jobs", router);
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server failed to bind");
  base = `http://127.0.0.1:${address.port}/api/admin/jobs/marketplace-numbers`;
});
afterEach(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const get = (query = "", who: "admin" | "user" | null = "admin") =>
  fetch(`${base}${query}`, { headers: who ? { authorization: `Bearer ${who}` } : {} });

describe("the marketplace numbers endpoint", () => {
  it("answers no one who is not signed in, and no one without the admin or ops role", async () => {
    expect((await get("", null)).status).toBe(401);
    expect((await get("", "user")).status).toBe(403);
    expect(loader.calls).toEqual([]);
  });

  it("reads the last 7 days without internal test jobs by default, not cached", async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ windowDays: 7, includeTests: false });
    expect(loader.calls).toEqual([{ windowDays: 7, includeTests: false }]);
  });

  it("takes the 30-day window and the switch that includes internal test jobs", async () => {
    expect((await get("?window=30&includeTests=1")).status).toBe(200);
    expect(loader.calls.at(-1)).toEqual({ windowDays: 30, includeTests: true });
  });

  it("refuses any other window or field, and is not taken for a job id", async () => {
    for (const query of ["?window=14", "?includeTests=yes", "?window=7&cursor=x"]) expect((await get(query)).status).toBe(400);
    expect(loader.calls).toEqual([]);
  });

  it("says the numbers are unavailable when they cannot be read", async () => {
    loader.fail = true;
    const response = await get();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "The marketplace numbers are unavailable. Try again." });
  });
});
