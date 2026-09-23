import { test, expect } from "@playwright/test";

test("capture app access page renders the handoff flow", async ({ page }) => {
  await page.goto("/capture-app", { waitUntil: "networkidle" });

  await expect(
    page.getByRole("heading", {
      name: /Get paid to capture the job before the robot arrives\.\s*Phone first\./i,
    }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", {
        name: /Open Blueprint Capture|Request assignment access/i,
      })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Blueprint Capture is a camera for iPhone/i,
    ),
  ).toBeVisible();
  await expect(
    page
      .getByRole("link", { name: /Apply for approved capture assignments/i })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Explore sites/i }).first(),
  ).toBeVisible();
});
