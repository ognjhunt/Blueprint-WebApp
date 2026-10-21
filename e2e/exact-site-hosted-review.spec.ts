import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from "@playwright/test";

test.beforeEach(mockExternalFonts);

test("exact-site hosted review route redirects to home", async ({ page }) => {
  await page.goto("/exact-site-hosted-review", { waitUntil: "networkidle" });

  // The standalone "/product" page is gone; LegacyHostedReviewRedirect now sends
  // this legacy path to the home page (targeting the "/#how-it-works" anchor).
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: /Find the right way to automate your work/i,
    }),
  ).toBeVisible();
});
