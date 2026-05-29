import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const harnessModulePath = path.join(repoRoot, "scripts", "qa", "operator-surfaces.ts");

describe("operator surfaces QA harness contract", () => {
  test("exports the fixture-backed local surface inventory and report contract", async () => {
    expect(fs.existsSync(harnessModulePath), "scripts/qa/operator-surfaces.ts must exist").toBe(true);

    const harness = await import(pathToFileURL(harnessModulePath).href);

    expect(harness.operatorQaOutputRoot).toBe("output/qa/operator-surfaces/latest");
    expect(harness.operatorQaViewports.map((viewport: { name: string }) => viewport.name)).toEqual([
      "desktop",
      "mobile",
    ]);
    expect(harness.operatorQaSurfaces.map((surface: { path: string }) => surface.path)).toEqual([
      "/admin/company-metrics",
      "/admin/growth-studio",
      "/requests/op-qa-ready",
      "/requests/op-qa-ready/evidence",
      "/requests/op-qa-ready/qualification",
      "/requests/op-qa-provider-blocked/preview",
      "/admin/leads",
    ]);

    expect(harness.operatorQaApiFixtures.map((fixture: { id: string }) => fixture.id)).toEqual(
      expect.arrayContaining([
        "company-metrics",
        "growth-studio",
        "request-console-ready",
        "request-console-provider-blocked",
        "admin-leads",
      ]),
    );

    const routeSlug = harness.operatorQaArtifactSlugForSurface(
      "/requests/op-qa-provider-blocked/preview",
      "mobile",
    );
    expect(routeSlug).toBe("requests-op-qa-provider-blocked-preview-mobile");

    const report = harness.buildOperatorQaReportMarkdown({
      generatedAt: "2026-05-26T12:00:00.000Z",
      baseUrl: "http://127.0.0.1:4173",
      routeResults: [
        {
          surfaceLabel: "Company Metrics",
          routePath: "/admin/company-metrics",
          viewportName: "desktop",
          screenshotPath: "output/qa/operator-surfaces/latest/screenshots/admin-company-metrics-desktop.png",
          status: "pass",
          checks: [{ name: "Fixture boundary", status: "pass", detail: "local API fixture used" }],
        },
      ],
      issues: [],
      apiFixtureHits: { "company-metrics": 1 },
      blockedLiveEndpoints: [],
    });

    expect(report).toContain("# Blueprint Operator Surface QA Report");
    expect(report).toContain("Command: `npm run qa:operator`");
    expect(report).toContain("Boundary: local Playwright dev server with mocked API responses and disabled ops scheduler");
    expect(report).toContain("Does not prove: live Firebase, Stripe, Notion, Paperclip, Render, Redis, provider execution, email/Slack sends, payments, payouts, or production mutation readiness.");
  });

  test("wires the repeatable npm command, local fake auth gate, Playwright spec, and docs", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    expect(packageJson.scripts["qa:operator"]).toBe(
      "tsx scripts/qa/run-operator-surfaces.ts",
    );

    expect(fs.existsSync(path.join(repoRoot, "e2e", "operator-surfaces.spec.ts"))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, "scripts", "qa", "run-operator-surfaces.ts"))).toBe(true);

    const authContext = fs.readFileSync(path.join(repoRoot, "client", "src", "contexts", "AuthContext.tsx"), "utf8");
    expect(authContext).toContain("VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH");

    const docPath = path.join(repoRoot, "docs", "qa", "operator-surfaces-harness.md");
    expect(fs.existsSync(docPath), "docs/qa/operator-surfaces-harness.md must exist").toBe(true);

    const doc = fs.readFileSync(docPath, "utf8");
    expect(doc).toContain("npm run qa:operator");
    expect(doc).toContain("output/qa/operator-surfaces/latest/report.md");
    expect(doc).toContain("No live Firebase, Stripe, Notion, Paperclip, Render, Redis, provider, Slack, email, payment, payout, or send actions");
    expect(doc).toContain("does not prove live operational readiness");
  });
});
