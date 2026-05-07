import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

function ensureBuildOutput() {
  const sitemapPath = path.resolve(process.cwd(), "dist/public/sitemap.xml");
  if (fs.existsSync(sitemapPath)) {
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
      fs.existsSync(path.resolve(process.cwd(), "dist/public/help/index.html")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve(process.cwd(), "dist/public/launch-map/index.html")),
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
    expect(sitemap).toContain("https://tryblueprint.io/capture");
    expect(sitemap).toContain("https://tryblueprint.io/updates");
    expect(sitemap).toContain("https://tryblueprint.io/help");
    expect(sitemap).not.toContain("https://tryblueprint.io/sample-evaluation");
    expect(sitemap).not.toContain("https://tryblueprint.io/exact-site-hosted-review");
    expect(sitemap).not.toContain("https://tryblueprint.io/book-exact-site-review");
    expect(sitemap).not.toContain("https://tryblueprint.io/blog");
    expect(sitemap).not.toContain("https://tryblueprint.io/site-worlds");
    expect(sitemap).not.toContain("https://tryblueprint.io/docs");
    expect(sitemap).not.toContain("https://tryblueprint.io/solutions");
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
    expect(proofHtml).toContain("Sample packet");
    expect(homeHtml).toContain('rel="canonical" href="https://tryblueprint.io/"');
    expect(homeHtml).toContain('property="og:image" content="https://tryblueprint.io/generated/editorial/world-models-hero.png"');
    expect(homeHtml).toContain('type="application/ld+json"');
    expect(homeHtml).toContain("What is a site-specific world model?");
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
