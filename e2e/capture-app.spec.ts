import { test, expect } from "@playwright/test";

test("capture app access page renders the handoff flow", async ({ page }) => {
  await page.goto("/capture-app", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", {
      name: /Get paid to capture real places robots need to understand\.\s*Phone first\./i,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: /Open assignment app|Request assignment access/i })
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/Open Blueprint Capture when you have access to an approved assignment/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Apply for approved capture assignments/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore sites/i }).first()).toBeVisible();
});
