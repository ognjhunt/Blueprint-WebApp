import { expect, test } from "@playwright/test";

test("docs page is publicly reachable", async ({ page }) => {
  await page.goto("/docs", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/sample-deliverables\/?$/);
  await expect(
    page.getByRole("heading", {
      name: /Sample deliverables from one real site\./i,
    }),
  ).toBeVisible();
});

test("blog page is publicly reachable", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: /Notes on exact-site world models\./i,
    }),
  ).toBeVisible();
});
