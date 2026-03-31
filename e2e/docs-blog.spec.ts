import { expect, test } from "@playwright/test";

test("docs page is publicly reachable", async ({ page }) => {
  await page.goto("/docs", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/sample-deliverables$/);
  await expect(
    page.getByRole("heading", {
      name: /What a buyer actually gets\./i,
    }),
  ).toBeVisible();
});

test("blog page is publicly reachable", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: /Notes on how Blueprint is being packaged\./i,
    }),
  ).toBeVisible();
});
