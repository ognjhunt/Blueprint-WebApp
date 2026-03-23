import { test, expect } from "@playwright/test";

test("capture app access page renders the handoff flow", async ({ page }) => {
  await page.goto("/capture-app", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", {
      name: /This is the mobile handoff for people capturing real sites\./i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Open app handoff/i })).toBeVisible();
  await expect(page.getByText(/Capturers use the app, not the web portal\./i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Browse world models/i })).toBeVisible();
});
