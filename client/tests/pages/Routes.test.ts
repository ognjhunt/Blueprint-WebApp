import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Route registration", () => {
  it("registers the canonical public routes", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/"');
    expect(source).toContain('path: "/sites"');
    expect(source).toContain('path: "/sites/:slug"');
    expect(source).toContain('path: "/pricing"');
    expect(source).toContain('path: "/proof"');
    expect(source).toContain('path: "/contact"');
    expect(source).toContain('path: "/for-robot-teams"');
    expect(source).toContain('path: "/robot-team/eval"');
    expect(source).toContain('path: "/privacy"');
    expect(source).toContain('path: "/terms"');
    expect(source).toContain('path: "/sign-in"');
    expect(source).toContain('path: "/signup/robot-team"');
    expect(source).toContain('path: "/signup/site-operator"');
  });

  it("keeps legacy site-world slugs as redirect aliases", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/site-worlds"');
    expect(source).toContain('path: "/site-worlds/:slug"');
    expect(source).toContain('path: "/site-worlds/:slug/start"');
    expect(source).toContain('path: "/site-worlds/:slug/workspace"');
  });

  it("routes legacy marketplace and environments paths through public redirects", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/marketplace"');
    expect(source).toContain("SitesRedirect");
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

  it("keeps buyer app routes protected", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    for (const route of [
      "/app",
      "/app/runs",
      "/app/runs/:runId",
      "/app/packs",
      "/app/packs/:siteId",
      "/app/policies",
      "/app/data",
      "/app/entitlements",
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
      "/ops/city-launch",
      "/ops/evidence",
      "/ops/handoff",
      "/ops/spend",
    ]) {
      expect(source).toContain(`path: "${route}", layout: "protected"`);
      expect(source).not.toContain(`path: "${route}", layout: "public"`);
    }
    expect(source).not.toContain('../pages/ops/');
    expect(source).not.toContain("OpsQueue");
    expect(source).not.toContain("OpsSpendControls");
  });

  it("keeps the capturer signup slug and capture app handoff routes reachable", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('{ path: "/capture", layout: "public", component: Capture }');
    expect(source).toContain('path: "/capture-app"');
    expect(source).toContain('path: "/signup/capturer"');
  });

  it("keeps old capturer public route names as aliases to Capture Jobs", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");
    const serverPath = path.resolve(process.cwd(), "server/index.ts");
    const serverSource = fs.readFileSync(serverPath, "utf-8");

    for (const route of [
      "/capture-jobs",
      "/capture-network",
      "/capturer",
      "/capturers",
      "/capturer-access",
      "/become-a-capturer",
      "/for-capturers",
      "/earn",
    ]) {
      expect(source).toContain(`path: "${route}"`);
      expect(serverSource).toContain(`from: "${route}", to: "/capture"`);
    }

    expect(serverSource).not.toContain('from: "/capture", to: "/capture-app/launch-access');
  });

  it("makes sign-in canonical and keeps login as a legacy alias", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/sign-in"');
    expect(source).toContain('path: "/login"');
    expect(source).toContain("LegacyLoginRedirect");
  });

  it("keeps secondary public marketing routes as redirect aliases", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('{ path: "/for-site-operators", layout: "public", component: ForSiteOperators }');
    expect(source).toContain('{ path: "/for-robot-teams", layout: "public", component: ForRobotTeams }');
    expect(source).toContain('{ path: "/robot-team/eval", layout: "public", component: RobotTeamEval }');
    expect(source).toContain('{ path: "/for-robot-integrators", layout: "public", component: LegacyForRobotIntegratorsRedirect }');
    expect(source).toContain('{ path: "/exact-site-hosted-review", layout: "public", component: LegacyHostedReviewRedirect }');
    expect(source).toContain('{ path: "/how-it-works", layout: "public", component: HowItWorks }');
    expect(source).toContain('{ path: "/world-models", layout: "public", component: SitesRedirect }');
    expect(source).toContain('{ path: "/world-models/:slug", layout: "public", component: LegacySiteLibraryDetailRedirect }');
    expect(source).toContain('{ path: "/agents", layout: "public", component: ContactRedirect }');
    expect(source).toContain('{ path: "/sample-evaluation", layout: "public", component: LegacyProofStoryRedirect }');
    expect(source).toContain('{ path: "/blog", layout: "public", component: LegacyBlogRedirect }');
    expect(source).toContain('{ path: "/readiness-pack", layout: "public", component: LegacyReadinessPackRedirect }');
  });
});
