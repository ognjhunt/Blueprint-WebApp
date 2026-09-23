import { appRoutes, matchAppRoute } from "@/app/routes";
import { minimalMarketingRedirects } from "@/data/minimalPublicSite";
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
    // /pricing is a page of its own again, not a redirect into the site intake.
    expect(source).toContain('path: "/pricing"');
    expect(minimalMarketingRedirects["/pricing"]).toBeUndefined();
    expect(minimalMarketingRedirects["/proof"]).toBe("/#how-it-works");
    expect(source).toContain('path: "/contact"');
    expect(minimalMarketingRedirects["/for-robot-teams"]).toBe("/contact/robot-team");
    expect(minimalMarketingRedirects["/robot-team/eval"]).toBe("/contact/robot-team");
    expect(source).toContain('path: "/privacy"');
    expect(source).toContain('path: "/terms"');
    expect(source).toContain('path: "/sign-in"');
    expect(source).toContain('path: "/signup/robot-team"');
    expect(source).toContain('path: "/signup/site-operator"');
  });

  it("registers one destination per path and preserves protected results workflows", () => {
    const paths = appRoutes.map((route) => route.path).filter(Boolean);
    expect(new Set(paths).size).toBe(paths.length);
    for (const path of Object.keys(minimalMarketingRedirects)) expect(matchAppRoute(path)?.layout).toBe("public");
    expect(matchAppRoute("/app/runs")?.layout).toBe("protected");
    expect(matchAppRoute("/app/results/example")?.shell).toBe("bare");
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

  it("keeps legacy dashboard and signup aliases as redirects", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('path: "/dashboard"');
    expect(source).toContain('path: "/off-waitlist-signup"');
    expect(source).toContain("BuyerAppRedirect");
    expect(source).toContain("BusinessSignupRedirect");
    expect(source).not.toContain('import("../pages/Dashboard")');
    expect(source).not.toContain('import("../pages/Portal")');
    expect(source).not.toContain('import("../pages/JoinBlueprint")');
  });

  it("keeps buyer app routes protected", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    for (const route of [
      "/app",
      "/app/runs",
      "/app/runs/new",
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

  it("redirects retired buyer pages to where their content lives now", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('const AppRunsRedirect = () => <MarketingRedirect to="/app/runs" />;');
    expect(source).toContain('const AppSettingsRedirect = () => <MarketingRedirect to="/settings" />;');
    expect(source).toContain('const AppTasksListRedirect = () => <MarketingRedirect to="/app/packs" />;');
    expect(source).toContain('{ path: "/app/packs/:siteId", layout: "protected", shell: "bare", component: AppTasksListRedirect }');
    expect(source).toContain('{ path: "/app/policies", layout: "protected", shell: "bare", component: AppSettingsRedirect }');
    expect(source).toContain('{ path: "/app/data", layout: "protected", shell: "bare", component: AppRunsRedirect }');
    expect(source).toContain('{ path: "/app/entitlements", layout: "protected", shell: "bare", component: AppRunsRedirect }');
    for (const page of ["SiteDetail", "Policies", "DataPackages", "Entitlements"]) {
      expect(source).not.toContain(`import("../pages/app/${page}")`);
    }
    // A task's own setup pages still win over the retired pack-detail alias.
    expect(matchAppRoute("/app/packs/source-one/evaluate")?.path).toBe("/app/packs/:sourceLaunchId/evaluate");
    expect(matchAppRoute("/app/packs/source-one/policy-canary")?.path).toBe("/app/packs/:sourceLaunchId/policy-canary");
    expect(matchAppRoute("/app/packs/legacy-pack")?.path).toBe("/app/packs/:siteId");
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

  it("sends every retired capture-app and capturer route to the site intake", () => {
    // Sites film their own task; the capturer network and its app are not
    // offered publicly. Old links land on the page that is live instead of
    // the dark, all-caps pages that used to sit two clicks from home.
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");
    const serverPath = path.resolve(process.cwd(), "server/index.ts");
    const serverSource = fs.readFileSync(serverPath, "utf-8");

    for (const route of [
      "/capture",
      "/capture-app",
      "/capture-app/launch-access",
      "/signup/capturer",
      "/capture-jobs",
      "/capture-network",
      "/capturer",
      "/capturers",
      "/capturer-access",
      "/become-a-capturer",
      "/for-capturers",
      "/earn",
    ]) {
      expect(source).toMatch(new RegExp(`path: "${route}",[^}]*component: SiteOperatorCaptureRedirect`));
      expect(serverSource).toContain(`from: "${route}", to: "/contact/site-operator"`);
    }
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

    expect(source).toContain('{ path: "/for-robot-integrators", layout: "public", component: LegacyForRobotIntegratorsRedirect }');
    expect(source).toContain('{ path: "/exact-site-hosted-review", layout: "public", component: LegacyHostedReviewRedirect }');
    expect(source).toContain('{ path: "/world-models", layout: "public", component: SitesRedirect }');
    expect(source).toContain('{ path: "/world-models/:slug", layout: "public", component: LegacySiteLibraryDetailRedirect }');
    expect(source).toContain('{ path: "/agents", layout: "public", component: ContactRedirect }');
    expect(source).toContain('{ path: "/sample-evaluation", layout: "public", component: LegacyProofStoryRedirect }');
    expect(source).toContain('{ path: "/blog", layout: "public", component: LegacyBlogRedirect }');
    expect(source).toContain('{ path: "/readiness-pack", layout: "public", component: LegacyReadinessPackRedirect }');
  });

  it("redirects retired offer URLs to the one-product pricing surface", () => {
    const routesPath = path.resolve(process.cwd(), "client/src/app/routes.tsx");
    const source = fs.readFileSync(routesPath, "utf-8");

    expect(source).toContain('<MarketingRedirect to="/pricing" />');
    for (const route of [
      "/policy-shortlist",
      "/robot-match",
      "/policy-improvement-run",
      "/post-training-data-package",
      "/post-training-policy-improvement-package",
      "/data-packages",
    ]) {
      expect(source).toContain(`{ path: "${route}", layout: "public", component: LegacyOfferRedirect }`);
    }
  });
});
