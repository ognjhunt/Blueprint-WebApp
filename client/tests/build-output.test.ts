import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";
import { siteLibrarySites } from "@/data/siteLibrary";

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
  }, 300000);

  it("ships prerendered pages for the simplified public IA and direct access flows", () => {
    [
      "index.html",
      "sites/index.html",
      "sites/sw-chi-01/index.html",
      "sites/sw-det-09/index.html",
      "sites/triangle-robotics-lab/index.html",
      "capture/index.html",
      "pricing/index.html",
      "proof/index.html",
      "for-robot-teams/index.html",
      "robot-team/eval/index.html",
      "contact/robot-team/index.html",
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

  it("ships lightweight secondary public aliases without legacy dynamic shells", () => {
    [
      "product/index.html",
      "readiness/index.html",
      "how-it-works/index.html",
      "world-models/index.html",
      "world-models/sw-chi-01/index.html",
      "contact/index.html",
      "agents/index.html",
      "sample-deliverables/index.html",
      "launch-map/index.html",
      "faq/index.html",
      "governance/index.html",
      "about/index.html",
      "updates/index.html",
      "careers/index.html",
      "help/index.html",
    ].forEach((file) => {
      expect(fs.existsSync(distPath(file))).toBe(true);
    });

    [
      "world-models/siteworld-f5fd54898cfb/index.html",
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

  it("includes core public routes and canonical site detail pages in the sitemap", () => {
    const sitemap = fs.readFileSync(distPath("sitemap.xml"), "utf8");

    [
      "https://tryblueprint.io/",
      "https://tryblueprint.io/sites",
      "https://tryblueprint.io/capture",
      "https://tryblueprint.io/pricing",
      "https://tryblueprint.io/proof",
      "https://tryblueprint.io/for-robot-teams",
      "https://tryblueprint.io/contact/robot-team",
      "https://tryblueprint.io/privacy",
      "https://tryblueprint.io/terms",
    ].forEach((url) => {
      expect(sitemap).toContain(url);
    });

    siteLibrarySites.forEach((site) => {
      expect(sitemap).toContain(`https://tryblueprint.io/sites/${site.slug}`);
    });

    [
      "https://tryblueprint.io/product",
      "https://tryblueprint.io/readiness",
      "https://tryblueprint.io/how-it-works",
      "https://tryblueprint.io/world-models",
      "https://tryblueprint.io/agents",
      "https://tryblueprint.io/sample-deliverables",
      "https://tryblueprint.io/launch-map",
      "https://tryblueprint.io/faq",
      "https://tryblueprint.io/governance",
      "https://tryblueprint.io/about",
      "https://tryblueprint.io/updates",
      "https://tryblueprint.io/careers",
      "https://tryblueprint.io/help",
      "<loc>https://tryblueprint.io/contact</loc>",
      "<loc>https://tryblueprint.io/contact/site-operator</loc>",
      "<loc>https://tryblueprint.io/robot-team/eval</loc>",
      "<loc>https://tryblueprint.io/world-models/sw-chi-01/start</loc>",
      "<loc>https://tryblueprint.io/world-models/sw-chi-01</loc>",
      "<loc>https://tryblueprint.io/sites/siteworld-f5fd54898cfb</loc>",
    ].forEach((url) => {
      expect(sitemap).not.toContain(url);
    });

    expect(sitemap).toContain(`<lastmod>${currentSitemapDate()}</lastmod>`);
  });

  it("ships answer-ready crawl artifacts for the current public-site map", () => {
    const robots = fs.readFileSync(distPath("robots.txt"), "utf8");
    const llms = fs.readFileSync(distPath("llms.txt"), "utf8");
    const llmsFull = fs.readFileSync(distPath("llms-full.txt"), "utf8");

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /world-models/*/workspace");
    expect(llms).toContain("High-Priority Public Pages");
    expect(llms).toContain("https://tryblueprint.io/sites");
    expect(llms).toContain("https://tryblueprint.io/pricing");
    expect(llms).toContain("https://tryblueprint.io/proof");
    expect(llms).toContain("https://tryblueprint.io/contact/robot-team");
    expect(llms).toContain("capture-backed robot policy evaluation");
    expect(llms).toContain("WAM/VLA");
    expect(llms).toContain("Policy Evaluation Run");
    expect(llms).toContain("source citation");
    expect(llms).not.toContain("https://tryblueprint.io/product");
    expect(llms).not.toContain("https://tryblueprint.io/updates");
    expect(llms).not.toContain("[Robot-Team Evaluation Submission](https://tryblueprint.io/robot-team/eval)");
    expect(llms).not.toContain("[Contact](https://tryblueprint.io/contact):");
    expect(llms).not.toContain("/contact?source=sites-library");
    expect(llmsFull).toContain("Secondary marketing URLs are not the primary public buyer surface");
    expect(llmsFull).toContain("Answer And Citation Guidance");
    expect(llmsFull).toContain("test and rank policies on captured real-site task packs");
    expect(llmsFull).toContain("request Policy Evaluation Run");
    expect(llmsFull).toContain("source citation output");
    expect(llmsFull).toContain("Do not invent customer results");
    expect(llmsFull).not.toContain("`/robot-team/eval` - Direct structured submission URL");
    expect(llmsFull).not.toContain("`/contact` - Structured Task Evaluation Run");
  });

  it("ships the current home and proof copy with honest claim boundaries", () => {
    const homeHtml = fs.readFileSync(distPath("index.html"), "utf8");
    const proofHtml = fs.readFileSync(distPath("proof/index.html"), "utf8");

    expect(homeHtml).toContain("Test robot policies before field time.");
    expect(homeHtml).toContain("Use captured real-site tasks to see what works.");
    expect(homeHtml).toContain("Same task. Same robot. Clear winner.");
    expect(homeHtml).toContain("Pick winner");
    expect(homeHtml).toContain('rel="canonical" href="https://tryblueprint.io/"');
    expect(homeHtml).toContain('type="application/ld+json"');
    expect(proofHtml).toContain("Proof stays scoped");
    expect(proofHtml).toContain(
      "Generated clips help review. Real-world validation requires the matched robot, task, and site envelope.",
    );
    expect(proofHtml).toContain("Start");
    expect(proofHtml).not.toContain("images.unsplash.com");
  });
});
