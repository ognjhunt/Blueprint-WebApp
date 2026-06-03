import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

function currentSitemapDate() {
  const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
  if (sourceDateEpoch && Number.isFinite(Number(sourceDateEpoch))) {
    return new Date(Number(sourceDateEpoch) * 1000).toISOString().slice(0, 10);
  }

  if (process.env.SITEMAP_LASTMOD_DATE?.trim()) {
    return new Date(`${process.env.SITEMAP_LASTMOD_DATE.trim()}T00:00:00.000Z`)
      .toISOString()
      .slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function distPath(...segments: string[]) {
  return path.resolve(process.cwd(), "dist/public", ...segments);
}

function ensureBuildOutput() {
  const sitemapPath = distPath("sitemap.xml");
  if (
    fs.existsSync(sitemapPath)
    && fs.readFileSync(sitemapPath, "utf8").includes(`<lastmod>${currentSitemapDate()}</lastmod>`)
  ) {
    return;
  }
  execFileSync("npm", ["run", "build"], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });
}

describe("build output", () => {
  beforeAll(() => {
    ensureBuildOutput();
  }, 120000);

  it("ships prerendered pages for the simplified public IA and direct access flows", () => {
    [
      "index.html",
      "pricing/index.html",
      "proof/index.html",
      "for-robot-teams/index.html",
      "robot-team/eval/index.html",
      "contact/index.html",
      "contact/site-operator/index.html",
      "capture-app/index.html",
      "capture-app/launch-access/index.html",
      "portal/index.html",
      "sign-in/index.html",
      "signup/index.html",
      "signup/business/index.html",
      "signup/capturer/index.html",
      "forgot-password/index.html",
      "privacy/index.html",
      "terms/index.html",
    ].forEach((file) => {
      expect(fs.existsSync(distPath(file))).toBe(true);
    });
  });

  it("does not prerender removed secondary marketing surfaces", () => {
    [
      "product/index.html",
      "readiness/index.html",
      "how-it-works/index.html",
      "world-models/index.html",
      "world-models/sw-chi-01/index.html",
      "world-models/siteworld-f5fd54898cfb/index.html",
      "agents/index.html",
      "capture/index.html",
      "sample-deliverables/index.html",
      "launch-map/index.html",
      "faq/index.html",
      "governance/index.html",
      "about/index.html",
      "updates/index.html",
      "careers/index.html",
      "help/index.html",
      "help/article/choose-the-right-path/index.html",
    ].forEach((file) => {
      expect(fs.existsSync(distPath(file))).toBe(false);
    });
  });

  it("keeps raw sample and proof assets reachable without making them primary pages", () => {
    [
      "samples/sample-site-package-manifest.json",
      "samples/sample-rights-sheet.md",
      "samples/sample-export-bundle.json",
      "samples/sample-hosted-review-report.md",
      "illustrations/site-package-diagram.svg",
      "illustrations/hosted-evaluation-loop.svg",
      "illustrations/export-bundle-diagram.svg",
      "proof/blueprint-proof-reel.mp4",
      "illustrations/sw-chi-01-runtime-proof.svg",
      "illustrations/sw-chi-01-buyer-review.svg",
    ].forEach((file) => {
      expect(fs.existsSync(distPath(file))).toBe(true);
    });
  });

  it("includes only the core public routes in the sitemap", () => {
    const sitemap = fs.readFileSync(distPath("sitemap.xml"), "utf8");

    [
      "https://tryblueprint.io/",
      "https://tryblueprint.io/pricing",
      "https://tryblueprint.io/proof",
      "https://tryblueprint.io/for-robot-teams",
      "https://tryblueprint.io/robot-team/eval",
      "https://tryblueprint.io/contact",
      "https://tryblueprint.io/privacy",
      "https://tryblueprint.io/terms",
    ].forEach((url) => {
      expect(sitemap).toContain(url);
    });

    [
      "https://tryblueprint.io/product",
      "https://tryblueprint.io/readiness",
      "https://tryblueprint.io/how-it-works",
      "https://tryblueprint.io/world-models",
      "https://tryblueprint.io/agents",
      "https://tryblueprint.io/capture",
      "https://tryblueprint.io/sample-deliverables",
      "https://tryblueprint.io/launch-map",
      "https://tryblueprint.io/faq",
      "https://tryblueprint.io/governance",
      "https://tryblueprint.io/about",
      "https://tryblueprint.io/updates",
      "https://tryblueprint.io/careers",
      "https://tryblueprint.io/help",
      "https://tryblueprint.io/contact/site-operator",
      "https://tryblueprint.io/world-models/sw-chi-01/start",
    ].forEach((url) => {
      expect(sitemap).not.toContain(url);
    });

    expect(sitemap).toContain(`<lastmod>${currentSitemapDate()}</lastmod>`);
  });

  it("ships crawl artifacts for the KISS public-site map", () => {
    const robots = fs.readFileSync(distPath("robots.txt"), "utf8");
    const llms = fs.readFileSync(distPath("llms.txt"), "utf8");
    const llmsFull = fs.readFileSync(distPath("llms-full.txt"), "utf8");

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /world-models/*/workspace");
    expect(llms).toContain("High-Priority Public Pages");
    expect(llms).toContain("https://tryblueprint.io/pricing");
    expect(llms).toContain("https://tryblueprint.io/proof");
    expect(llms).not.toContain("https://tryblueprint.io/product");
    expect(llms).not.toContain("https://tryblueprint.io/updates");
    expect(llmsFull).toContain("Secondary marketing URLs are not the primary public buyer surface");
    expect(llmsFull).toContain("site-specific robot deployment readiness");
    expect(llmsFull).toContain("Do not invent customer results");
  });

  it("ships the simplified home and proof copy with honest claim boundaries", () => {
    const homeHtml = fs.readFileSync(distPath("index.html"), "utf8");
    const proofHtml = fs.readFileSync(distPath("proof/index.html"), "utf8");

    expect(homeHtml).toContain("Evaluate robots on real sites before deployment.");
    expect(homeHtml).toContain("Robot teams pay for evaluations and optional data exports");
    expect(homeHtml).toContain("Public samples show the workflow. Request packets prove one site.");
    expect(homeHtml).toContain('rel="canonical" href="https://tryblueprint.io/"');
    expect(homeHtml).toContain('type="application/ld+json"');
    expect(proofHtml).toContain("See what supports the site data and policy runs.");
    expect(proofHtml).toContain("Public samples teach the workflow. Request packets prove one site.");
    expect(proofHtml).toContain("Advisory until stronger proof exists.");
    expect(proofHtml).not.toContain("images.unsplash.com");
  });
});
