import { expect, test } from "@playwright/test";

test("docs page is publicly reachable", async ({ page }) => {
  await page.goto("/docs", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/proof\/?$/);
  await expect(
    page.getByRole("heading", {
      name: /See what is attached to the world model before you buy\./i,
    }),
  ).toBeVisible();
});

test("blog alias redirects to updates", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/updates\/?$/);
  await expect(
    page.getByRole("heading", {
      name: /Notes on exact-site world models\./i,
    }),
  ).toBeVisible();
});
