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
  }, 300000);

  it("ships prerendered pages for the simplified public IA and direct access flows", () => {
    [
      "index.html",
      "sites/index.html",
      "capture/index.html",
      "pricing/index.html",
      "proof/index.html",
      "for-robot-teams/index.html",
      "contact/robot-team/index.html",
      "contact/site-operator/index.html",
      "capture-app/index.html",
      "capture-app/launch-access/index.html",
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

  it("does not prerender retired aliases or protected operations routes", () => {
    [
      "product/index.html",
      "robot-team/eval/index.html",
      "readiness/index.html",
      "world-models/index.html",
      "contact/index.html",
      "agents/index.html",
      "sample-deliverables/index.html",
      "launch-map/index.html",
      "updates/index.html",
      "careers/index.html",
      "help/index.html",
      "admin/leads/index.html",
      "admin/submissions/index.html",
      "admin/city-launch/austin/index.html",
      "world-models/sw-chi-01/index.html",
      "world-models/siteworld-f5fd54898cfb/index.html",
      "help/article/choose-the-right-path/index.html",
    ].forEach((file) => {
      expect(fs.existsSync(distPath(file))).toBe(false);
    });

    [
      "how-it-works/index.html",
      "faq/index.html",
      "governance/index.html",
      "capture-visit/index.html",
      "about/index.html",
    ].forEach((file) => {
      expect(fs.existsSync(distPath(file))).toBe(true);
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

  it("includes core public routes without fixture site detail pages in the sitemap", () => {
    const sitemap = fs.readFileSync(distPath("sitemap.xml"), "utf8");

    [
      "https://tryblueprint.io/",
      "https://tryblueprint.io/sites",
      "https://tryblueprint.io/capture",
      "https://tryblueprint.io/pricing",
      "https://tryblueprint.io/proof",
      "https://tryblueprint.io/faq",
      "https://tryblueprint.io/for-robot-teams",
      "https://tryblueprint.io/for-site-operators",
      "https://tryblueprint.io/how-it-works",
      "https://tryblueprint.io/contact/robot-team",
      "https://tryblueprint.io/contact/site-operator",
      "https://tryblueprint.io/about",
      "https://tryblueprint.io/vision",
      "https://tryblueprint.io/governance",
      "https://tryblueprint.io/capture-visit",
      "https://tryblueprint.io/privacy",
      "https://tryblueprint.io/terms",
    ].forEach((url) => {
      expect(sitemap).toContain(url);
    });

    [
      "https://tryblueprint.io/product",
      "https://tryblueprint.io/readiness",
      "https://tryblueprint.io/world-models",
      "https://tryblueprint.io/agents",
      "https://tryblueprint.io/sample-deliverables",
      "https://tryblueprint.io/launch-map",
      "https://tryblueprint.io/updates",
      "https://tryblueprint.io/careers",
      "https://tryblueprint.io/help",
      "https://tryblueprint.io/policy-shortlist",
      "https://tryblueprint.io/robot-match",
      "https://tryblueprint.io/policy-improvement-run",
      "https://tryblueprint.io/post-training-data-package",
      "https://tryblueprint.io/data-packages",
      "<loc>https://tryblueprint.io/contact</loc>",
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
    expect(llms).toContain("## Public pages");
    expect(llms).toContain("https://tryblueprint.io/sites");
    expect(llms).toContain("https://tryblueprint.io/pricing");
    expect(llms).toContain("https://tryblueprint.io/proof");
    expect(llms).toContain("https://tryblueprint.io/contact/robot-team");
    expect(llms).toContain("Task Evaluation Run");
    expect(llms).toContain("decision or abstention");
    expect(llms).toContain("Pipeline owns method qualification and routing");
    expect(llms).not.toContain("Policy Evaluation Run");
    expect(llms).not.toContain("https://tryblueprint.io/product");
    expect(llms).not.toContain("https://tryblueprint.io/updates");
    expect(llms).not.toContain("[Robot-Team Evaluation Submission](https://tryblueprint.io/robot-team/eval)");
    expect(llms).not.toContain("[Contact](https://tryblueprint.io/contact):");
    expect(llms).not.toContain("/contact?source=sites-library");
    expect(llmsFull).toContain("## Product model");
    expect(llmsFull).toContain("## Proof boundaries");
    expect(llmsFull).toContain("Task Evaluation Run");
    expect(llmsFull).toContain("decision or abstention");
    expect(llmsFull).toContain("Unknown future states fail closed");
    expect(llmsFull).toContain("No winner is inferred from an abstained result");
    expect(llmsFull).not.toContain("`/robot-team/eval` - Direct structured submission URL");
    expect(llmsFull).not.toContain("`/contact` - Structured Task Evaluation Run");
  });

  it("ships the current home and proof copy with honest claim boundaries", () => {
    const homeHtml = fs.readFileSync(distPath("index.html"), "utf8");
    const pricingHtml = fs.readFileSync(distPath("pricing/index.html"), "utf8");
    const proofHtml = fs.readFileSync(distPath("proof/index.html"), "utf8");

    expect(homeHtml).toContain("Robots aren&#x27;t the bottleneck. Deploying them is.");
    expect(homeHtml).toContain("Capture");
    expect(homeHtml).toContain("Recreate");
    expect(homeHtml).toContain("Evaluate");
    expect(homeHtml).toContain("Use it to validate. Not to discover.");
    // Modelled figure values must be graded in the prerendered HTML too, and the
    // charts themselves must prerender rather than shipping an empty axis.
    expect(homeHtml).toContain("Illustrative model");
    expect(homeHtml).toContain("Published figure");
    expect(homeHtml).toContain("295,000");
    expect(homeHtml).toContain("IFR World Robotics 2025");
    expect(homeHtml).toContain('rel="canonical" href="https://tryblueprint.io/"');
    expect(homeHtml).toContain('type="application/ld+json"');
    // /pricing prerenders free core access and the site-paid network schedule.
    expect(pricingHtml).toContain("Free until a robot is earning.");
    expect(pricingHtml).toContain("$0 site submission");
    expect(pricingHtml).toContain("5% deployment-network fee");
    expect(pricingHtml).toContain("$170,000 Blueprint fee");
    expect(pricingHtml).toContain("Submit a site task");
    expect(pricingHtml).not.toContain("From $2,500");
    expect(pricingHtml).not.toContain("Policy Shortlist");
    expect(pricingHtml).not.toContain("Robot Match");
    expect(pricingHtml).not.toContain("$3,000");
    expect(pricingHtml).not.toContain("Quick-look eval");
    expect(pricingHtml).not.toContain("Robot-team subscription");
    expect(proofHtml).toContain("The first two months are real work");
    expect(proofHtml).toContain("Published anchor — not a market price");
    expect(proofHtml).toContain("A useful filter is not a deployment certificate");
    expect(proofHtml).not.toContain("images.unsplash.com");
  });

  it("keeps fictional supply and provider credentials out of the browser bundle", () => {
    const assetsDir = distPath("assets");
    const browserJavaScript = fs
      .readdirSync(assetsDir)
      .filter((file) => file.endsWith(".js"))
      .map((file) => fs.readFileSync(path.join(assetsDir, file), "utf8"))
      .join("\n");

    [
      "Harborview Grocery Distribution Annex",
      "Peachtree Parcel Exchange South",
      "1847 W Fulton St",
      "2550 Lakewood Ave",
      "Ready to evaluate",
      "api.lindy",
    ].forEach((forbiddenText) => {
      expect(browserJavaScript).not.toContain(forbiddenText);
    });
    expect(browserJavaScript).not.toMatch(/pplx-[A-Za-z0-9_-]{12,}/);
    expect(browserJavaScript).not.toMatch(/fc-[A-Za-z0-9_-]{12,}/);
    expect(browserJavaScript).toContain("Task Evaluation Run");
    expect(browserJavaScript).toContain("deployment homework");
  });
});
