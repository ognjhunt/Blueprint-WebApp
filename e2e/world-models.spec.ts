import { test, expect } from "@playwright/test";

test("world models catalog route redirects to the deployment-company page", async ({
  page,
}) => {
  await page.goto("/world-models", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/partners$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("world-model detail route redirects to the deployment-company page", async ({
  page,
}) => {
  await page.goto("/world-models/sw-chi-01", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/partners$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("legacy hosted setup does not expose a fixture site", async ({ page }) => {
  await page.goto("/world-models/sw-chi-01/start", {
    waitUntil: "domcontentloaded",
  });

  await expect(page).toHaveURL(/\/partners$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
