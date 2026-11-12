import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from "@playwright/test";

test.beforeEach(mockExternalFonts);

test("legacy marketplace route redirects to the deployment-company page", async ({
  page,
}) => {
  await page.goto("/marketplace");

  await expect(page).toHaveURL(/\/partners$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("legacy environments route redirects to proof instead of the removed catalog", async ({
  page,
}) => {
  await page.goto("/environments");

  await expect(page).toHaveURL(/\/#how-it-works$/);
  await expect(
    page.getByRole("heading", { name: /Film a job once\. We turn it into a job packet/i }),
  ).toBeVisible();
});

test("legacy contact route redirects to the canonical robot-team intake", async ({
  request,
}) => {
  const response = await request.get(
    "/contact?persona=robot-team&source=server-redirect",
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(
    "/contact/robot-team?persona=robot-team&source=server-redirect",
  );
});

test("retired public offer URLs redirect to the single scoped run", async ({
  request,
}) => {
  for (const path of [
    "/policy-shortlist",
    "/robot-match",
    "/policy-improvement-run",
    "/post-training-data-package",
    "/post-training-policy-improvement-package",
    "/data-packages",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe("/beta");
  }
});

test("legacy proof, docs and help URLs reach their destination in one hop", async ({
  request,
}) => {
  for (const [path, location] of [
    ["/docs", "/#how-it-works"],
    ["/case-studies", "/#how-it-works"],
    ["/sample-evaluation", "/#how-it-works"],
    ["/environments", "/#how-it-works"],
    ["/help", "/contact/site-operator"],
    ["/beta/capturer-guide", "/contact/site-operator"],
    // Bare bones (2026-11-11): "Jobs we support" folded into How it works, "About" into the Questions page.
    ["/jobs-we-support", "/how-it-works"],
    ["/about", "/beta#who-we-are"],
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(301);
    expect(response.headers().location, path).toBe(location);
  }
});

test("private links and ops tooling are not indexable", async ({ request }) => {
  for (const path of ["/claim/example-token", "/capture-upload/example-token", "/app/results/example", "/ops/task-evaluation-launches", "/admin/jobs", "/sign-in"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()["x-robots-tag"], path).toMatch(/noindex/);
  }
  const robots = await (await request.get("/robots.txt")).text();
  for (const rule of ["Disallow: /claim/", "Disallow: /capture-upload/", "Disallow: /app/", "Disallow: /ops/", "Disallow: /internal/"]) {
    expect(robots).toContain(rule);
  }
});

test("public routes work with trailing slashes", async ({ page }) => {
  await page.goto("/docs/");

  await expect(page).toHaveURL(/\/#how-it-works$/);
  await expect(
    page.getByRole("heading", {
      name: /Film a job once\. We turn it into a job packet/i,
    }),
  ).toBeVisible();
});

test("FAQ redirects to the compact method section", async ({ page }) => {
  await page.goto("/faq");

  await expect(page).toHaveURL(/\/#how-it-works$/);
  await expect(
    page.getByRole("heading", {
      name: /Film a job once\. We turn it into a job packet/i,
    }),
  ).toBeVisible();
});

test("robots and sitemap are publicly reachable", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  const sitemap = await request.get("/sitemap.xml");

  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("User-agent: *");
  expect(sitemap.ok()).toBeTruthy();
  const sitemapText = await sitemap.text();
  expect(sitemapText).toContain("https://tryblueprint.io/contact/site-operator");
  expect(sitemapText).toContain("https://tryblueprint.io/contact/robot-team");
  expect(sitemapText).toContain("https://tryblueprint.io/beta");
  expect(sitemapText).not.toContain("https://tryblueprint.io/world-models");
});

// The job packet frame (2026-11-12) removed these surfaces. Each old URL
// answers with one 301 to a live page, and a browser lands there.
const retiredSurfaceRedirects: Array<[string, string]> = [
  ["/internal/opportunity-board", "/"],
  ["/internal/opportunity-board/listing-1", "/"],
  ["/internal/opportunity-board/listing-1/offer", "/"],
  ["/partners/deployment", "/partners"],
  ["/partners/technology", "/partners"],
  ["/sites", "/partners"],
  ["/sites/some-site", "/partners"],
  ["/beta/buyer-guide", "/partners"],
  ["/requests/req-1", "/"],
  ["/requests/req-1/evidence", "/"],
  ["/app/library", "/partners"],
  ["/app/opportunities/task-1", "/partners"],
  ["/app/evaluations/application-1", "/partners"],
  ["/app/runs", "/partners"],
  ["/app/runs/new", "/partners"],
  ["/app/advanced/runs/new", "/partners"],
  ["/app/runs/run-1", "/partners"],
  ["/app/runs/run-1/policy-candidate/new", "/partners"],
  ["/app/packs", "/partners"],
  ["/app/packs/policy-packet", "/partners"],
  ["/app/packs/source-one/evaluate", "/partners"],
  ["/app/packs/source-one/policy-canary", "/partners"],
  ["/app/entitlements", "/partners"],
  ["/app/history", "/"],
  ["/admin/company-metrics", "/"],
  ["/ops/spend", "/"],
  ["/internal/design-system", "/"],
  // The last removal round (2026-11-12): the signed-in job pages and the printed readiness brief.
  ["/app/tasks", "/"],
  ["/app/tasks/job-1", "/"],
  ["/readiness-brief/brief-token.signature", "/"],
];

test("retired surfaces answer with one 301 to a live page", async ({ request }) => {
  for (const [path, location] of retiredSurfaceRedirects) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(301);
    expect(response.headers().location, path).toBe(location);
  }
});

test("a browser opening a retired surface lands on its redirect", async ({ page }) => {
  for (const [path, location] of retiredSurfaceRedirects) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page, path).toHaveURL(new RegExp(`^[^?#]*//[^/]+${location === "/" ? "/" : location}$`));
    await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
  }
});

test("an old buyer review link drops its access token on the way to the home page", async ({ request, page }) => {
  for (const path of ["/requests/req-1", "/requests/req-1/evidence", "/requests/req-1/preview"]) {
    const response = await request.get(`${path}?access=secret-token&x=1`, { maxRedirects: 0 });
    expect(response.status(), path).toBe(301);
    expect(response.headers().location, path).toBe("/");
  }
  await page.goto("/requests/req-1?access=secret-token", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/^[^?#]*\/\/[^/]+\/$/);
  expect(page.url()).not.toContain("secret-token");
  // Other retired URLs still carry their query (source context survives).
  const kept = await request.get("/sites?source=newsletter", { maxRedirects: 0 });
  expect(kept.headers().location).toBe("/partners?source=newsletter");
});
