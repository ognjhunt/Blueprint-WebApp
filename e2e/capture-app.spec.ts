import { test, expect } from "@playwright/test";

test("capture app access page renders the handoff flow", async ({ page }) => {
  await page.goto("/capture-app", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", {
      name: /Open the capture app\./i,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: /Open capture app|Request capture access/i })
      .first(),
  ).toBeVisible();
  await expect(page.getByText(/This is the public handoff for people recording indoor spaces for Blueprint\./i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Apply for capturer access/i }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /Read capture basics/i }).first()).toBeVisible();
});
