import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: {} });
    return route.continue();
  });
});

// Refunds left the product copy (launch copy, 2026-11-20): the cost row says only "Free for sites.". The page itself left
// with Terms 2026-11-21.1 (owner, 2026-11-21: no outside customer ever bought a pre-beta balance); its address lands on
// the Terms, which hold no refund clause.
test("the cost row links no refunds, and the old refunds address lands on the Terms on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/beta");
  const cost = page.locator("#scope");
  await expect(cost).toContainText("Free for sites.");
  await expect(cost.getByRole("link", { name: /Refunds/ })).toHaveCount(0);
  await page.goto("/refunds");
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { name: "Terms of Service", exact: true, level: 1 })).toBeVisible();
  await expect(page.locator("article")).not.toContainText(/refund|unused balance/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("privacy page offers deletion and shows optional analytics off until permission", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("link", { name: "account deletion in Settings" })).toHaveAttribute("href", "/settings?privacy=1");
  await expect(page.getByText(/stay off until you allow the corresponding category/)).toBeVisible();
  await expect(page.getByRole("link", { name: "previous version", exact: true })).toHaveAttribute("href", "/privacy/previous");
  await expect(page.getByRole("link", { name: "Refunds", exact: true })).toHaveCount(0);
});

// Privacy 2026-11-23.1 (owner, 2026-11-23: "yes to the privacy wording"): the Location row names the city, state and
// country a company sees. The 2026-11-21.1 text, with the country alone, is kept as the previous version.
test("privacy page says a company sees the city, state and country; the previous version keeps the country alone", async ({ page }) => {
  await page.goto("/privacy");
  const article = page.locator("article");
  await expect(article).toContainText("Effective November 23, 2026");
  await expect(article).toContainText("A deployment company sees the city, state and country of the job, not the address you typed.");
  await expect(article).not.toContainText("A deployment company sees the country of the job, not the address you typed.");
  await page.getByRole("link", { name: "previous version", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy\/previous$/);
  await expect(article).toContainText("Previous version, effective November 21, 2026");
  await expect(article).toContainText("A deployment company sees the country of the job, not the address you typed.");
  await expect(article).not.toContainText("city, state and country");
});
