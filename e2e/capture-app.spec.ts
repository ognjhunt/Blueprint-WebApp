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
        name: /Open assignment app|Request assignment access/i,
      })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      /Open Blueprint Capture when you have an approved assignment/i,
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
