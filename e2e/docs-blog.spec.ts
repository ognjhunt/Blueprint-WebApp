import { mockExternalFonts } from "./helpers/static-assets";
import { expect, test } from "@playwright/test";

test.beforeEach(mockExternalFonts);

test("docs page is publicly reachable", async ({ page }) => {
  await page.goto("/docs", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/#how-it-works$/);
  await expect(
    page.getByRole("heading", {
      name: /Find the right way to automate your work/i,
    }),
  ).toBeVisible();
});

test("blog alias redirects to home", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: /Find the right way to automate your work/i,
    }),
  ).toBeVisible();
});
