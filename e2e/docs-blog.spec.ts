import { expect, test } from "@playwright/test";

test("docs page is publicly reachable", async ({ page }) => {
  await page.goto("/docs", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/proof\/?$/);
  await expect(
    page.getByRole("heading", {
      name: /What we claim, and what we refuse to\./i,
    }),
  ).toBeVisible();
});

test("blog alias redirects to home", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("heading", {
      name: /Know what the real site will do to your robot\./i,
    }),
  ).toBeVisible();
});
