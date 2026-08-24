import { expect, test } from "@playwright/test";

test("docs page is publicly reachable", async ({ page }) => {
  await page.goto("/docs", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/proof\/?$/);
  await expect(
    page.getByRole("heading", {
      name: /first two months are real work/i,
    }),
  ).toBeVisible();
});

test("blog alias redirects to home", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: /Robots aren't the bottleneck\. Deploying them is/i,
    }),
  ).toBeVisible();
});
