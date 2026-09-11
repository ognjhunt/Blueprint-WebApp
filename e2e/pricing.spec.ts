import { test, expect } from "@playwright/test";

test("retired pricing leads to a scoped paid site evaluation", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/contact\/site-operator$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Let’s start with your site.");
  await expect(page.getByText(/Scope and pricing are agreed before evaluation begins/)).toBeVisible();
  // Budget is a matching parameter rather than a screen, so it now sits in the
  // spec tier behind the gates. The site screen itself is what must be here.
  await expect(page.locator("#gate-serviceArea")).toBeVisible();
  await expect(page.getByText(/site pays nothing|\$0 for sites/)).toHaveCount(0);
});

test("the pricing redirect preserves query attribution and works on mobile", async ({ page, request }) => {
  const response = await request.get("/pricing?source=old-campaign", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe("/contact/site-operator?source=old-campaign");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing");
  await expect(page.getByRole("button", { name: "Send inquiry" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
