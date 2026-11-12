import { test, expect } from "@playwright/test";

test("old world models checkout flag lands on the deployment-company page", async ({
  page,
}) => {
  await page.goto("/world-models?checkout=success", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/partners\?checkout=success$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
