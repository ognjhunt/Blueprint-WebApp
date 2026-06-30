import { expect, test } from "@playwright/test";

test("docs page is publicly reachable", async ({ page }) => {
  await page.goto("/docs", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/proof\/?$/);
  await expect(
    page.getByRole("heading", {
      name: /Proof stays scoped\./i,
    }),
  ).toBeVisible();
});

test("blog alias redirects to home", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: /Test robot policies before field time\./i,
    }),
  ).toBeVisible();
});
