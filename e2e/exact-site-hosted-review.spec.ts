import { test, expect } from "@playwright/test";

test("exact-site hosted review route redirects to home", async ({ page }) => {
  await page.goto("/exact-site-hosted-review", { waitUntil: "networkidle" });

  // The standalone "/product" page is gone; LegacyHostedReviewRedirect now sends
  // this legacy path to the home page (targeting the "/#how-it-works" anchor).
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: /Test robot policies before field time\./i,
    }),
  ).toBeVisible();
});
