import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, test } from "vitest";

const repoRoot = process.cwd();
const harnessModulePath = path.join(repoRoot, "scripts", "qa", "brand-polish.ts");

describe("brand polish QA harness contract", () => {
  test("exports the local route, viewport, report, and Notion checklist contract", async () => {
    expect(fs.existsSync(harnessModulePath), "scripts/qa/brand-polish.ts must exist").toBe(true);

    const harness = await import(pathToFileURL(harnessModulePath).href);

    expect(harness.qaOutputRoot).toBe("output/qa/brand-polish/latest");
    expect(harness.qaViewports.map((viewport: { name: string }) => viewport.name)).toEqual([
      "desktop",
      "mobile",
    ]);
    expect(harness.publicQaRoutes.map((route: { path: string }) => route.path)).toEqual([
      "/",
      "/product",
      "/world-models",
      "/pricing",
      "/proof",
      "/capture",
      "/contact",
      "/careers",
      "/faq",
      "/about",
      "/updates",
    ]);

    const notionChecklist = harness.buildNotionLayoutChecklistMarkdown({
      generatedAt: "2026-05-14T00:00:00.000Z",
      reportPath: "output/qa/brand-polish/latest/report.md",
    });

    expect(notionChecklist).toContain("# Notion Layout QA Checklist");
    expect(notionChecklist).toContain("Repo/Paperclip/Notion source-of-truth labels are visible");
    expect(notionChecklist).toContain("Counsel/PEO review status is visible");
    expect(notionChecklist).toContain("No live Notion mutation was performed by this harness");
  });

  test("wires the repeatable npm command and usage doc", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
    expect(packageJson.scripts["qa:polish"]).toBe(
      "playwright test e2e/brand-polish.spec.ts --reporter=line",
    );

    const docPath = path.join(repoRoot, "docs", "qa", "brand-polish-harness.md");
    expect(fs.existsSync(docPath), "docs/qa/brand-polish-harness.md must exist").toBe(true);

    const doc = fs.readFileSync(docPath, "utf8");
    expect(doc).toContain("npm run qa:polish");
    expect(doc).toContain("output/qa/brand-polish/latest/report.md");
    expect(doc).toContain("No live sends, provider calls, payments, deploys, or Notion writes");
  });
});
