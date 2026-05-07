import { expect, test } from "@playwright/test";

test("docs page is publicly reachable", async ({ page }) => {
  await page.goto("/docs", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/proof\/?$/);
  await expect(
    page.getByRole("heading", {
      name: /Sample grocery aisle proof packet/i,
    }),
  ).toBeVisible();
});

test("blog alias redirects to updates", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/updates\/?$/);
  await expect(
    page.getByRole("heading", {
      name: /Blueprint updates\./i,
    }),
  ).toBeVisible();
});
