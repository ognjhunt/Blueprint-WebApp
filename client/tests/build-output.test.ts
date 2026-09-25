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
      "pricing/index.html",
      "sites/index.html",
      "about/index.html",
      "contact/robot-team/index.html",
      "contact/site-operator/index.html",
      "sign-in/index.html",
      "signup/index.html",
      "signup/business/index.html",
      "forgot-password/index.html",
      "privacy/index.html",
      "terms/index.html",
    ].forEach((file) => {
      expect(fs.existsSync(distPath(file))).toBe(true);
    });
  });

  it("ships the retired capture-app pages no more, and the current brand's icons and share image", () => {
    for (const file of ["capture/index.html", "capture-app/index.html", "capture-app/launch-access/index.html", "signup/capturer/index.html"]) {
      expect(fs.existsSync(distPath(file))).toBe(false);
    }
    for (const file of ["favicon.ico", "favicon.svg", "apple-touch-icon.png", "brand/mark.svg", "brand/og-default.png"]) {
      expect(fs.existsSync(distPath(file))).toBe(true);
    }
    const home = fs.readFileSync(distPath("index.html"), "utf8");
    expect(home).toContain('content="https://tryblueprint.io/brand/og-default.png"');
    expect(home).not.toContain("blueprint-og-hosted-review");
    expect(home).not.toMatch(/og:image" content="[^"]+\.webp"/);
  });

  it("ships the recorded evaluation example and all six episode videos", () => {
    const html = fs.readFileSync(distPath("how-it-works/index.html"), "utf8");
    expect(html).toContain("Recorded simulation");
    expect(html).toContain("/proof/cup-evaluation/02-groot-external.mp4");
    for (const cell of ["00", "02", "04"]) {
      for (const policy of ["pi05", "groot"]) {
        expect(fs.existsSync(distPath(`proof/cup-evaluation/${cell}-${policy}-external.mp4`))).toBe(true);
        expect(fs.existsSync(distPath(`proof/cup-evaluation/${cell}-${policy}-poster.webp`))).toBe(true);
      }
    }
  });

  it("prerenders the real auth forms in the shared minimal shell", () => {
    // The capturer sign-up is retired (it redirects to the site intake), so it
    // is not prerendered.
    expect(fs.existsSync(distPath("signup/capturer/index.html"))).toBe(false);
    for (const route of ["sign-in", "signup/business", "forgot-password"]) {
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
    expect(fs.readFileSync(distPath("signup/business/index.html"), "utf8")).toContain('id="email"');
  });

  it("does not prerender retired aliases or protected operations routes", () => {
    [
      "proof/index.html",
      "for-robot-teams/index.html",
      "for-site-operators/index.html",
      "faq/index.html",
      "governance/index.html",
      "capture-visit/index.html",
      "site-task/index.html",
      "robot-intake/index.html",
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

    ["/", "/how-it-works", "/pricing", "/contact/site-operator", "/contact/robot-team", "/sites", "/about", "/privacy", "/terms"].forEach((route) => {
      expect(sitemap).toContain(`<loc>https://tryblueprint.io${route}</loc>`);
    });
    expect((sitemap.match(/<loc>/g) || []).length).toBe(9);

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
    expect(llms).toContain("$99 per policy entry");
    expect(llmsFull).toMatch(/simulation is not physical proof or a deployment guarantee/i);
    expect(llmsFull).toContain("Robot teams join by early access");
    expect(llmsFull).toContain("early_access_required");
    expect(llms).toContain("https://tryblueprint.io/pricing");
    expect(llms).toContain("Sites pay nothing for initial assessment or scene preparation");

  });

  it("prerenders the approved homepage and both inquiry personas in the shared theme", () => {
    const homeHtml = fs.readFileSync(distPath("index.html"), "utf8");
    const siteHtml = fs.readFileSync(distPath("contact/site-operator/index.html"), "utf8");
    const robotHtml = fs.readFileSync(distPath("contact/robot-team/index.html"), "utf8");
    expect(homeHtml).toContain("One recurring task.");
    expect(homeHtml).toContain("A measured robot pilot.");
    expect(homeHtml).toContain("Illustrative scenes");
    expect(homeHtml).toContain("no credible fit yet");
    expect(homeHtml).toContain('rel="canonical" href="https://tryblueprint.io/"');
    expect(homeHtml).toContain('type="application/ld+json"');
    expect(homeHtml).not.toContain("The site pays nothing");
    for (const file of ["index.html", "how-it-works/index.html", "contact/robot-team/index.html", "contact/site-operator/index.html"]) {
      expect(fs.readFileSync(distPath(file), "utf8")).not.toMatch(/two (?:compatible|frozen|candidates|policies)/i);
    }
    expect(siteHtml).toContain("Start with one recurring task.");
    // The published site form keeps the task and consent, without the retired
    // screening interview. These assertions inspect actual prerendered HTML.
    expect(siteHtml).toContain("What is the job?");
    expect(siteHtml).toContain("Describe the work and share photos or phone video.");
    expect(siteHtml).toContain("How this works");
    expect(siteHtml).toContain('id="start-self-recording"');
    expect(siteHtml).toContain('id="start-region"');
    expect(siteHtml).toContain('id="start-rights"');
    expect(siteHtml).not.toContain('id="gate-sceneStability"');
    expect(siteHtml).not.toContain('id="gate-serviceArea"');
    expect(robotHtml).toContain("Find a task your robot can support.");
    expect(robotHtml).toContain("Spend less time on unsuitable opportunities. Approved teams review site-approved tasks");
    // Early access: nothing library-shaped is prerendered. The page asks the
    // server who is looking before it shows tasks or the setup form.
    expect(robotHtml).not.toContain("Already have a robot policy to evaluate?");
    expect(robotHtml).not.toContain("See what we would run");
    expect(robotHtml).not.toContain('id="capture-mode"');
    expect(robotHtml).not.toContain('id="gate-serviceArea"');
    expect(robotHtml).not.toContain('id="gate-hardwareMaturity"');
    for (const route of ["index.html", "contact/site-operator/index.html", "contact/robot-team/index.html", "privacy/index.html", "terms/index.html"]) {
      const html = fs.readFileSync(distPath(route), "utf8");
      expect(html).toContain('class="minimal-site"');
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
      "api.lindy",
    ].forEach((forbiddenText) => {
      expect(browserJavaScript).not.toContain(forbiddenText);
    });
    expect(browserJavaScript).not.toMatch(/pplx-[A-Za-z0-9_-]{12,}/);
    expect(browserJavaScript).not.toMatch(/fc-[A-Za-z0-9_-]{12,}/);
    expect(browserJavaScript).toContain("Task Evaluation Run");
    // Sentinels that the current public message actually shipped to the browser.
    // Replaced rather than dropped: the point of these is to prove the scan
    // above is reading the real public bundle, so removing one because the copy
    // moved would quietly make the whole check vacuous. "Site-funded Task
    // Evaluation Run" left the site page when it stopped leading with a screen.
    expect(browserJavaScript).toContain("A measured robot pilot.");
    expect(browserJavaScript).toContain("We turn your description and footage into a task brief");
  });

  it("keeps charting, Firebase and Sentry out of what a marketing page preloads", () => {
    for (const page of ["index.html", "pricing/index.html", "how-it-works/index.html", "about/index.html"]) {
      const html = fs.readFileSync(distPath(page), "utf8");
      const preloaded = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+\.js)"/g)].map((match) => match[1]);
      expect(preloaded.length, page).toBeGreaterThan(0);
      for (const file of preloaded) {
        expect(file, `${page} preloads ${file}`).not.toMatch(/recharts|firebase|sentry|radix/);
      }
    }
  });

  it("writes the client route patterns outside the served directory for real 404s", () => {
    const file = path.resolve(process.cwd(), "dist", "app-route-patterns.json");
    const { patterns } = JSON.parse(fs.readFileSync(file, "utf8")) as { patterns: string[] };
    expect(patterns).toEqual(expect.arrayContaining(["/", "/pricing", "/about", "/sites", "/capture-upload/:token"]));
    expect(fs.existsSync(distPath("app-route-patterns.json"))).toBe(false);
  });
});
