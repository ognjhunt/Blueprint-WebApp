import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Route registration", () => {
  it("registers the canonical public routes", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/"');
    expect(source).toContain('path: "/world-models"');
    expect(source).toContain('path: "/world-models/:slug"');
    expect(source).toContain('path: "/capture-app"');
    expect(source).toContain('path: "/for-robot-teams"');
    expect(source).toContain('path: "/for-site-operators"');
    expect(source).toContain('path: "/proof"');
    expect(source).toContain('path: "/case-studies"');
    expect(source).toContain('path: "/faq"');
    expect(source).toContain('path: "/docs"');
    expect(source).toContain('path: "/blog"');
    expect(source).toContain('path: "/governance"');
    expect(source).toContain('path: "/about"');
    expect(source).toContain('path: "/careers"');
    expect(source).toContain('path: "/readiness-pack"');
    expect(source).toContain('path: "/sign-in"');
  });

  it("keeps legacy site-world slugs as redirect aliases", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/site-worlds"');
    expect(source).toContain('path: "/site-worlds/:slug"');
    expect(source).toContain('path: "/site-worlds/:slug/start"');
    expect(source).toContain('path: "/site-worlds/:slug/workspace"');
  });

  it("does not expose legacy marketplace routes and keeps environments as a redirect alias", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).not.toContain('path: "/marketplace"');
    expect(source).not.toContain('path: "/marketplace/scenes"');
    expect(source).not.toContain('path: "/marketplace/datasets"');
    expect(source).toContain('path: "/environments"');
    expect(source).toContain("LegacyEnvironmentsRedirect");
    expect(source).not.toContain('path: "/deployment-marketplace"');
    expect(source).not.toContain('path: "/deployment-marketplace-guide"');
  });

  it("keeps canonical dashboard and off-waitlist routes reachable", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/dashboard"');
    expect(source).toContain('path: "/off-waitlist-signup"');
  });

  it("keeps the capturer signup slug and capture app handoff routes reachable", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/capture-app"');
    expect(source).toContain('path: "/signup/capturer"');
  });

  it("makes sign-in canonical and keeps login as a legacy alias", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/sign-in"');
    expect(source).toContain('path: "/login"');
    expect(source).toContain("LegacyLoginRedirect");
  });

  it("keeps public persona and readiness pages canonical instead of redirecting after hydration", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('{ path: "/for-site-operators", layout: "public", component: ForSiteOperators }');
    expect(source).toContain('{ path: "/for-robot-teams", layout: "public", component: ForRobotIntegrators }');
    expect(source).toContain('{ path: "/readiness-pack", layout: "public", component: LegacyReadinessPackRedirect }');
  });
});
