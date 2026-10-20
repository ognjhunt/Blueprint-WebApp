import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: {} });
    return route.continue();
  });
});

test("refund information is next to the cost explanation and available on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/beta");
  await page.getByRole("button", { name: "Reject all", exact: true }).click();
  const cost = page.locator("#scope");
  await expect(cost).toContainText("Nothing. The beta is free");
  await cost.getByRole("link", { name: "Refunds and cancellations" }).click();
  await expect(page).toHaveURL(/\/refunds$/);
  await expect(page.getByRole("heading", { name: "Refunds and cancellations", exact: true })).toBeVisible();
  await expect(page.getByText("Purchases made before the free beta", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "applicable Terms of Service" })).toHaveAttribute("href", /\/terms(?:\/previous)?$/);
  await expect(page.getByRole("link", { name: "hello@tryblueprint.io", exact: true }).first()).toHaveAttribute("href", /^mailto:/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("privacy page offers deletion and shows optional analytics off until permission", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("link", { name: "account deletion in Settings" })).toHaveAttribute("href", "/settings?privacy=1");
  await expect(page.getByText(/stay off until you allow the corresponding category/)).toBeVisible();
  await expect(page.getByRole("link", { name: "previous version", exact: true })).toHaveAttribute("href", "/privacy/previous");
  await expect(page.getByRole("link", { name: "Refunds", exact: true })).toHaveAttribute("href", "/refunds");
});
