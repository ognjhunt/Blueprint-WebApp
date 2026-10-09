import { test, expect } from "@playwright/test";
test("site signup starts with the existing intake automatically", async ({ page }) => {
  await page.goto("/signup/business");
  await expect(page).toHaveURL(/\/contact\/site-operator$/);
  await expect(page.locator("#start-task")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
});
test("legacy site signup preserves job intent without an invitation or staff approval", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/signup/business?buyerType=site_operator&intent=pilot-opportunity");
  await expect(page).toHaveURL(/\/contact\/site-operator\?intent=pilot-opportunity$/);
  await expect(page.locator("#start-task")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start free assessment", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0);
});
