import { test, expect } from "@playwright/test";

test("capture app access page renders the handoff flow", async ({ page }) => {
  await page.goto("/capture-app", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: /Your mobile gateway to Blueprint's capture network\./i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Request launch access/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Download the app/i })).toBeVisible();
  await expect(page.getByAltText(/QR code for Blueprint Capture access/i)).toBeVisible();
});
