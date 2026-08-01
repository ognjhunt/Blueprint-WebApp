import { expect, test } from "@playwright/test";

test("legacy robot-team evaluation URL reaches the current product", async ({ page }) => {
  await page.goto("/robot-team/eval");
  await expect(page).toHaveURL(/\/for-robot-teams/);
  await expect(
    page.getByRole("heading", { name: "Spend field time on the candidate that earned it." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Request a Task Evaluation Run/i }).first(),
  ).toHaveAttribute("href", /\/contact\/robot-team/);
});

test("robot-team and site-operator pages describe one service and intake", async ({ page }) => {
  await page.goto("/for-robot-teams");
  // Screening precedes the ordering, and a gap the design cannot separate is
  // still presented as an outcome rather than omitted.
  await expect(page.getByText(/Bring candidates\. Get them screened, then ordered\./i).first()).toBeVisible();
  await expect(page.getByText(/^Inside the resolution$/i).first()).toBeVisible();
  await expect(page.getByText(/Policy Shortlist/i)).toHaveCount(0);

  await page.goto("/for-site-operators");
  await expect(
    page.getByRole("heading", {
      name: "Find out what a robot could do here, before anyone shows up.",
    }),
  ).toBeVisible();
  await expect(
    page.locator("main").getByRole("link", { name: /Request a Task Evaluation Run/i }).first(),
  ).toHaveAttribute("href", /\/contact\/site-operator/);
  await expect(page.getByText(/Robot Match/i)).toHaveCount(0);
});

test("persona pages are usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/for-robot-teams");
  await expect(
    page.getByRole("link", { name: /Request a Task Evaluation Run/i }).first(),
  ).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
