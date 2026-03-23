import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("build output", () => {
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

  it("does not ship false zero trust stats on marketing pages", () => {
    const captureHtml = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/capture/index.html"),
      "utf8",
    );
    const siteOperatorHtml = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/for-site-operators/index.html"),
      "utf8",
    );
    const howItWorksHtml = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/how-it-works/index.html"),
      "utf8",
    );

    expect(captureHtml).not.toContain("$<span>0</span>-$<span>0</span>");
    expect(captureHtml).not.toContain("<span>0%</span>");
    expect(siteOperatorHtml).not.toContain("$<span>0</span>-$<span>0</span>");
    expect(howItWorksHtml).not.toContain('>0</span></p><p class="text-xs text-zinc-500">core lanes');
  });

  it("includes canonical pages in the sitemap and excludes legacy aliases", () => {
    const sitemap = fs.readFileSync(
      path.resolve(process.cwd(), "dist/public/sitemap.xml"),
      "utf8",
    );

    expect(sitemap).toContain("https://tryblueprint.io/world-models/sw-chi-01");
    expect(sitemap).toContain("https://tryblueprint.io/docs");
    expect(sitemap).toContain("https://tryblueprint.io/blog");
    expect(sitemap).not.toContain("https://tryblueprint.io/site-worlds");
  });
});
