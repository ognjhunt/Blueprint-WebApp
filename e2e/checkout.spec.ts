import { test, expect } from "@playwright/test";

test("old world models checkout flag lands on the sites catalog", async ({
  page,
}) => {
  await page.goto("/world-models?checkout=success", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveURL(/\/sites\?checkout=success$/);
  await expect(
    page.getByRole("heading", { name: "Task library" }),
  ).toBeVisible();
});
