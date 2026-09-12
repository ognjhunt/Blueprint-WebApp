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
    // Compile-only: this build is read off disk to assert on prerendered
    // output and is never served, so it needs no Firebase client config.
    env: { ...process.env, BLUEPRINT_ALLOW_UNCONFIGURED_CLIENT_BUILD: "1" },
  });
}

describe("build output", () => {
  beforeAll(() => {
    ensureBuildOutput();
  }, 300000);

  it("ships prerendered pages for the simplified public IA and direct access flows", () => {
    [
      "index.html",
      "how-it-works/index.html",
      "sites/index.html",
      "capture/index.html",
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

  it("prerenders the real auth forms in the shared minimal shell", () => {
    for (const route of ["sign-in", "signup/business", "signup/capturer", "forgot-password"]) {
      const html = fs.readFileSync(distPath(route, "index.html"), "utf8");
      expect(html).toContain("auth-shell");
      expect(html).toContain("/images/site-led/auth/packing.webp");
      expect((html.match(/id="main-content"/g) || []).length).toBe(1);
      expect(html).not.toContain("Access Control Suite");
      expect(html).not.toContain("Why Exact-Site Context Matters");
    }
    for (const route of ["sign-in", "forgot-password"]) {
      expect(fs.readFileSync(distPath(route, "index.html"), "utf8")).toContain('method="post"');
    }
    expect(fs.readFileSync(distPath("signup/business/index.html"), "utf8")).toContain('id="organizationName"');
  });

  it("does not prerender retired aliases or protected operations routes", () => {
    [
      "pricing/index.html",
      "proof/index.html",
      "for-robot-teams/index.html",
      "for-site-operators/index.html",
      "faq/index.html",
      "governance/index.html",
      "capture-visit/index.html",
      "site-task/index.html",
      "robot-intake/index.html",
      "about/index.html",
      "vision/index.html",
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

    ["/", "/how-it-works", "/contact/site-operator", "/contact/robot-team", "/privacy", "/terms"].forEach((route) => {
      expect(sitemap).toContain(`<loc>https://tryblueprint.io${route}</loc>`);
    });
    expect((sitemap.match(/<loc>/g) || []).length).toBe(6);

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
    expect(llms).toContain("https://tryblueprint.io/contact/site-operator");
    expect(llms).toContain("https://tryblueprint.io/contact/robot-team");
    expect(llms).toContain("paid engagement");
    expect(llmsFull).toContain("simulation is not a deployment guarantee");
    expect(llmsFull).toContain("participation depends on task fit and site approval");
    expect(llms).not.toContain("https://tryblueprint.io/pricing");
    expect(llms).not.toContain("The site pays nothing");

  });

  it("prerenders the approved homepage and both inquiry personas in the shared theme", () => {
    const homeHtml = fs.readFileSync(distPath("index.html"), "utf8");
    const siteHtml = fs.readFileSync(distPath("contact/site-operator/index.html"), "utf8");
    const robotHtml = fs.readFileSync(distPath("contact/robot-team/index.html"), "utf8");
    expect(homeHtml).toContain("Your site.");
    expect(homeHtml).toContain("A pilot worth running.");
    expect(homeHtml).toContain("Illustrative scenes");
    expect(homeHtml).toContain("clear reason to pause");
    expect(homeHtml).toContain('rel="canonical" href="https://tryblueprint.io/"');
    expect(homeHtml).toContain('type="application/ld+json"');
    expect(homeHtml).not.toContain("The site pays nothing");
    for (const file of ["index.html", "how-it-works/index.html", "contact/robot-team/index.html", "contact/site-operator/index.html"]) {
      expect(fs.readFileSync(distPath(file), "utf8")).not.toMatch(/two (?:compatible|frozen|candidates|policies)/i);
    }
    expect(siteHtml).toContain("Let’s start with your site.");
    expect(siteHtml).toContain("paid evaluation");
    // Budget moved into the spec tier behind the gates -- it is a matching
    // parameter, not a screen. The persona distinction in prerendered HTML is
    // now the gate set itself.
    expect(siteHtml).toContain('id="gate-serviceArea"');
    expect(robotHtml).toContain("Bring your robot. Find the fit.");
    expect(robotHtml).toContain("applying does not guarantee either");
    expect(robotHtml).not.toContain('id="gate-serviceArea"');
    expect(robotHtml).toContain('id="gate-hardwareMaturity"');
    for (const route of ["index.html", "contact/site-operator/index.html", "contact/robot-team/index.html", "privacy/index.html", "terms/index.html"]) {
      const html = fs.readFileSync(distPath(route), "utf8");
      // The ivory shell also declares the Tailwind paper theme, so product
      // components dropped onto a public route inherit the same palette.
      expect(html).toContain('class="minimal-site paper-theme"');
      expect(html).toContain('class="ms-footer ms-container"');
    }
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
    // Sentinels that the current public message actually shipped to the browser.
    expect(browserJavaScript).toContain("A pilot worth running.");
    expect(browserJavaScript).toContain("Site-funded Task Evaluation Run");
  });
});
