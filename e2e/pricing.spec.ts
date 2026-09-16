import { test, expect } from "@playwright/test";

test("pricing keeps the site's bill and the robot team's bill apart", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Robot teams pay to be screened.",
  );

  const site = page.locator("section", { has: page.getByRole("heading", { name: /scoped assessment of one task at one site/i }) });
  await expect(site.getByText("$2,500", { exact: true })).toBeVisible();
  await expect(site.getByRole("link", { name: /Discuss your site/i })).toHaveAttribute(
    "href",
    "/contact/site-operator",
  );

  const team = page.locator("section", { has: page.getByRole("heading", { name: /Screening is the only thing a robot team buys/i }) });
  await expect(team.getByText("$0.50", { exact: true })).toBeVisible();
  await expect(team.getByRole("link", { name: /Apply as a robot team/i })).toHaveAttribute(
    "href",
    "/contact/robot-team",
  );

  // The old model is gone from the public surface entirely.
  await expect(page.getByText(/site pays nothing|\$0 for sites|\$10,000 if you win/)).toHaveCount(0);
});

test("pricing shows the episode definition and the arithmetic behind a quote", async ({ page }) => {
  await page.goto("/pricing");
  await expect(
    page.getByText(/One episode is one run of one policy on one scenario/),
  ).toBeVisible();
  await expect(
    page.getByText(/Six checkpoints attempting the same scenario is six episodes, not one/),
  ).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: "Six checkpoints" });
  await expect(row.getByText("300", { exact: true })).toBeVisible();
  await expect(row.getByText("$150", { exact: true })).toBeVisible();
  await expect(page.getByText(/Checkpoints × 50 × \$0\.50/)).toBeVisible();
});

test("pricing reaches the header on mobile without a horizontal scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Pricing" })
    .click();

  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("legacy offer URLs still land on the pricing page itself", async ({ page, request }) => {
  const response = await request.get("/data-packages?source=old-campaign", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe("/pricing?source=old-campaign");

  await page.goto("/data-packages");
  await expect(page).toHaveURL(/\/pricing/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Robot teams pay to be screened.",
  );
});

test("a site never sees a per-episode rate, and a shortlisted team owes nothing more", async ({ page }) => {
  await page.goto("/pricing");

  const site = page.locator("section", { has: page.getByRole("heading", { name: /scoped assessment of one task at one site/i }) });
  // The site is buying a decision, not compute — no unit rate in its column.
  await expect(site.getByText(/per episode|\$0\.50/i)).toHaveCount(0);
  await expect(site.getByText(/No per-episode charge/i)).toBeVisible();
  await expect(site.getByText(/up to five finalists/i)).toBeVisible();

  const rounds = page.locator("section", { has: page.getByRole("heading", { name: "The two rounds" }) });
  await expect(rounds.getByText("Screening", { exact: true })).toBeVisible();
  await expect(rounds.getByText("Finalist comparison", { exact: true })).toBeVisible();
  await expect(rounds.getByText(/Included in the site's assessment fee/i)).toBeVisible();

  await expect(page.getByRole("heading", { name: /Being shortlisted never costs you more/i })).toBeVisible();
  await expect(page.getByText(/Everything screening cannot separate from the leader goes forward, up to five/i)).toBeVisible();
});
