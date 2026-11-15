import { appRoutes, matchAppRoute } from "@/app/routes";
import { minimalMarketingRedirects, queryDroppingRedirects } from "@/data/minimalPublicSite";
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Route registration", () => {
  it("registers one destination per path and preserves protected results workflows", () => {
    const paths = appRoutes.map((route) => route.path).filter(Boolean);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of Object.keys(minimalMarketingRedirects)) expect(matchAppRoute(path)?.layout).toBe("public");
    expect(matchAppRoute("/app")?.layout).toBe("protected");
    expect(matchAppRoute("/app/results/example")?.shell).toBe("bare");
  });

  it("keeps buyer app routes protected", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    for (const route of [
      "/app",
      "/app/captures",
    ]) {
      expect(source).toContain(`path: "${route}", layout: "protected"`);
      expect(source).not.toContain(`path: "${route}", layout: "public"`);
    }
  });

  it("keeps ops aliases protected and off the mock-data console", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    for (const route of [
      "/ops",
      "/ops/supply",
      "/ops/evidence",
      "/ops/handoff",
    ]) {
      expect(source).toContain(`path: "${route}", layout: "protected"`);
      expect(source).not.toContain(`path: "${route}", layout: "public"`);
    }
    expect(source).not.toContain('../pages/ops/');
    expect(source).not.toContain("OpsQueue");
    expect(source).not.toContain("OpsSpendControls");
  });

  it("drops the query only on the retired buyer review links, which carried an access token", () => {
    expect([...queryDroppingRedirects].sort()).toEqual([
      "/requests/:requestId",
      "/requests/:requestId/evidence",
      "/requests/:requestId/preview",
      "/requests/:requestId/qualification",
    ]);
    for (const path of queryDroppingRedirects) expect(minimalMarketingRedirects[path], path).toBe("/");
  });
});
