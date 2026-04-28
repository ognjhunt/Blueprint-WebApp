import { test, expect } from "@playwright/test";

test("capture app access page renders the handoff flow", async ({ page }) => {
  await page.goto("/capture-app", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", {
      name: /Everyday site\.\s*Captured\./i,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: /Open the capture app|Request capture access/i })
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/Open Blueprint Capture to record public-facing places people visit every day/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Apply for capturer access/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Explore world models/i }).first()).toBeVisible();
});
