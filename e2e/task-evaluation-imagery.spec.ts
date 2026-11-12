import { expect, test } from "@playwright/test";
import { mockExternalFonts } from "./helpers/static-assets";

test.beforeEach(mockExternalFonts);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: {
    items: [], access: { gated: true, status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false },
  } }));
});

// How it works lists the video, the job packet, deployment companies and the early trial, one quiet link from home.
test("How it works opens its own page from the home page's quiet link", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("link", { name: "How it works ›" }).click();
    await expect(page).toHaveURL(/\/how-it-works$/);
    await expect(page.locator("h1")).toHaveText("How it works");
    await expect(page.getByRole("list", { name: "Steps" }).getByRole("listitem")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

// The animated example of an invented result is removed (frame of 2026-11-12), and nothing replaces it: the home page
// is one text column that never overflows.
test("the home page is one text column, with no example, and does not overflow", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator(".bare-example")).toHaveCount(0);
    await expect(page.getByRole("tablist")).toHaveCount(0);
    await expect(page.locator(".bare-home .bare-button")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("both audience actions lead to their working intake and the company landing reaches the application", async ({ page }) => {
  await page.goto("/");
  await page.locator("main").getByRole("link", { name: "Start a job" }).click();
  await expect(page.getByRole("form", { name: "Start a site capture" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "Deploy robots? See how jobs reach you ›" }).click();
  await expect(page).toHaveURL(/\/partners$/);
  await expect(page.locator("h1")).toHaveText("Real jobs from real sites.");
  // The application form is on the page itself (folded in from the old /partners/deployment page).
  await expect(page.getByRole("form", { name: "Deployment company application" })).toBeVisible();
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Ada");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Ada");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
