import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

function currentSitemapDate() {
  const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
  if (sourceDateEpoch && Number.isFinite(Number(sourceDateEpoch))) {
    return new Date(Number(sourceDateEpoch) * 1000).toISOString().slice(0, 10);
  }

  const sitemapLastModDate = process.env.SITEMAP_LASTMOD_DATE;
  if (sitemapLastModDate?.trim()) {
    return new Date(`${sitemapLastModDate.trim()}T00:00:00.000Z`)
      .toISOString()
      .slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function ensureBuildOutput() {
  const sitemapPath = path.resolve(process.cwd(), "dist/public/sitemap.xml");
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

  it("ships prerendered world-model slug pages", () => {
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "dist/public/world-models/sw-chi-01/index.html"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.resolve(
          process.cwd(),
          "dist/public/world-models/siteworld-f5fd54898cfb/index.html",
        ),
      ),
    ).toBe(true);
  });

  it("ships prerendered public route pages for the simplified public IA and support flows", () => {
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/product/index.html")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/proof/index.html")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/sample-deliverables/index.html")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/help/index.html")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/launch-map/index.html")),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "dist/public/help/category/getting-started/index.html"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "dist/public/help/article/what-blueprint-sells/index.html"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "dist/public/help/article/choose-the-right-path/index.html"),
      ),
    ).toBe(true);
  });

  it("prerenders help article routes as article content instead of the homepage", () => {
    const helpArticleHtml = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/help/article/choose-the-right-path/index.html"),
      "utf8",
    );

    expect(helpArticleHtml).toContain("Choose the right support path");
    expect(helpArticleHtml).toContain("If you are buying");
    expect(helpArticleHtml).toContain("If you are capturing");
    expect(helpArticleHtml).not.toContain("Site-specific world models for robot teams");
    expect(helpArticleHtml).not.toContain("Blueprint sells exact-site products, not generic demos.");
  });

  it("ships the sample deliverables viewer and keeps raw sample artifacts reachable", () => {
    const sampleDeliverablesHtml = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/sample-deliverables/index.html"),
      "utf8",
    );

    expect(sampleDeliverablesHtml).toContain("Sample deliverables from one real site");
    expect(sampleDeliverablesHtml).toContain("/samples/sample-site-package-manifest.json");
    expect(sampleDeliverablesHtml).toContain("/samples/sample-rights-sheet.md");
    expect(sampleDeliverablesHtml).toContain("/samples/sample-export-bundle.json");
    expect(sampleDeliverablesHtml).toContain("/samples/sample-hosted-review-report.md");
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "dist/public/samples/sample-rights-sheet.md"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.resolve(process.cwd(), "dist/public/samples/sample-hosted-review-report.md"),
      ),
    ).toBe(true);
  });

  it("does not ship false zero trust stats on marketing pages", () => {
    const captureHtml = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/capture/index.html"),
      "utf8",
    );
    const productHtml = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/product/index.html"),
      "utf8",
    );

    expect(captureHtml).not.toContain("$<span>0</span>-$<span>0</span>");
    expect(captureHtml).not.toContain("<span>0%</span>");
    expect(productHtml).not.toContain("$<span>0</span>-$<span>0</span>");
    expect(productHtml).not.toContain('>0</span></p><p class="text-xs text-zinc-500">core lanes');
  });

  it("includes canonical pages in the sitemap and excludes legacy aliases", () => {
    const sitemap = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/sitemap.xml"),
      "utf8",
    );

    expect(sitemap).toContain("https://tryblueprint.io/world-models/sw-chi-01");
    expect(sitemap).toContain("https://tryblueprint.io/product");
    expect(sitemap).toContain("https://tryblueprint.io/proof");
    expect(sitemap).toContain("https://tryblueprint.io/sample-deliverables");
    expect(sitemap).toContain("https://tryblueprint.io/capture");
    expect(sitemap).toContain("https://tryblueprint.io/updates");
    expect(sitemap).toContain("https://tryblueprint.io/help");
    expect(sitemap).toContain("https://tryblueprint.io/help/contact");
    expect(sitemap).toContain("https://tryblueprint.io/contact/site-operator");
    expect(sitemap).toContain("https://tryblueprint.io/launch-map");
    expect(sitemap).toContain("https://tryblueprint.io/help/category/getting-started");
    expect(sitemap).toContain("https://tryblueprint.io/help/article/what-blueprint-sells");
    expect(sitemap).toContain("https://tryblueprint.io/help/article/choose-the-right-path");
    expect(sitemap).toContain(`<lastmod>${currentSitemapDate()}</lastmod>`);
    expect(sitemap).not.toContain("https://tryblueprint.io/sample-evaluation");
    expect(sitemap).not.toContain("https://tryblueprint.io/exact-site-hosted-review");
    expect(sitemap).not.toContain("https://tryblueprint.io/book-exact-site-review");
    expect(sitemap).not.toContain("https://tryblueprint.io/blog");
    expect(sitemap).not.toContain("https://tryblueprint.io/site-worlds");
    expect(sitemap).not.toContain("https://tryblueprint.io/docs");
    expect(sitemap).not.toContain("https://tryblueprint.io/solutions");
    expect(sitemap).not.toContain("https://tryblueprint.io/capture-app</loc>");
    expect(sitemap).not.toContain("https://tryblueprint.io/portal");
    expect(sitemap).not.toContain("https://tryblueprint.io/sign-in");
    expect(sitemap).not.toContain("https://tryblueprint.io/signup");
    expect(sitemap).not.toContain("https://tryblueprint.io/world-models/sw-chi-01/start");
  });

  it("ships crawl artifacts for public marketing routes", () => {
    const robots = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/robots.txt"),
      "utf8",
    );
    const sitemap = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/sitemap.xml"),
      "utf8",
    );

    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("User-agent: OAI-SearchBot");
    expect(robots).toContain("User-agent: GPTBot");
    expect(robots).toContain("Disallow: /admin/");
    expect(robots).toContain("Disallow: /world-models/*/workspace");
    expect(sitemap).toContain("https://tryblueprint.io/about");
    expect(sitemap).toContain("https://tryblueprint.io/faq");
  });

  it("ships current machine-readable AI answer files", () => {
    const llms = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/llms.txt"),
      "utf8",
    );
    const llmsFull = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/llms-full.txt"),
      "utf8",
    );

    expect(llms).toContain("site-specific world-model products");
    expect(llms).toContain("https://tryblueprint.io/product");
    expect(llms).toContain("https://tryblueprint.io/updates");
    expect(llms).not.toContain("https://tryblueprint.io/exact-site-hosted-review");
    expect(llms).not.toContain("https://tryblueprint.io/solutions");
    expect(llmsFull).toContain("hosted robot evaluation");
    expect(llmsFull).toContain("Do not invent customer results");
  });

  it("ships honest proof pages without unsplash references on the examples page", () => {
    const proofHtml = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/proof/index.html"),
      "utf8",
    );
    const homeHtml = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/index.html"),
      "utf8",
    );

    expect(proofHtml).not.toContain("images.unsplash.com");
    expect(proofHtml).toContain("Sample artifact still");
    expect(proofHtml).toContain("Sample vs live");
    expect(proofHtml).toContain("Claims fail closed");
    expect(homeHtml).toContain('rel="canonical" href="https://tryblueprint.io/"');
    expect(homeHtml).toContain('property="og:image" content="https://tryblueprint.io/generated/2026-05-13-brand-system/blueprint-og-hosted-review-gpt-image-2.png"');
    expect(homeHtml).toContain('type="application/ld+json"');
    expect(homeHtml).toContain("What does Blueprint sell?");
  });

  it("ships the placeholder proof assets", () => {
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/illustrations/site-package-diagram.svg")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/illustrations/hosted-evaluation-loop.svg")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/illustrations/export-bundle-diagram.svg")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/proof/blueprint-proof-reel.mp4")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/illustrations/sw-chi-01-runtime-proof.svg")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/illustrations/sw-chi-01-buyer-review.svg")),
    ).toBe(true);
  });
});
