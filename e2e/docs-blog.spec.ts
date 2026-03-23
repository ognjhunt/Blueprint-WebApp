import { expect, test } from "@playwright/test";

test("docs page is publicly reachable", async ({ page }) => {
  await page.goto("/docs", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: /Technical notes for world-model packages and hosted access\./i,
    }),
  ).toBeVisible();
});

test("blog page is publicly reachable", async ({ page }) => {
  await page.goto("/blog", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: /Product notes from the world-model side of Blueprint\./i,
    }),
  ).toBeVisible();
});
