import { test, expect } from "@playwright/test";

test("legacy marketplace route redirects to the Sites library", async ({
  page,
}) => {
  await page.goto("/marketplace");

  await expect(page).toHaveURL(/\/sites$/);
  await expect(
    page.getByRole("heading", { name: "Job library" }),
  ).toBeVisible();
});

test("legacy environments route redirects to proof instead of the removed catalog", async ({
  page,
}) => {
  await page.goto("/environments");

  await expect(page).toHaveURL(/\/#how-it-works$/);
  await expect(
    page.getByRole("heading", { name: /Could a robot take over a repetitive task at your site/i }),
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
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(301);
    expect(response.headers().location, path).toBe(location);
  }
});

test("private links and ops tooling are not indexable", async ({ request }) => {
  for (const path of ["/claim/example-token", "/capture-upload/example-token", "/app/results/example", "/ops/task-evaluation-launches", "/internal/design-system", "/sign-in"]) {
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
      name: /Could a robot take over a repetitive task at your site/i,
    }),
  ).toBeVisible();
});

test("FAQ redirects to the compact method section", async ({ page }) => {
  await page.goto("/faq");

  await expect(page).toHaveURL(/\/#how-it-works$/);
  await expect(
    page.getByRole("heading", {
      name: /Could a robot take over a repetitive task at your site/i,
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
