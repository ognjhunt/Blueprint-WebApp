import { expect, test } from "@playwright/test";

test("pricing page presents two charges and a site that pays nothing", async ({ page }) => {
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", { name: "Two charges. The site pays nothing." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Sites pay nothing. Ever.", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Evaluate for $1,000. Pay again only if you win.",
      exact: true,
    }),
  ).toBeVisible();

  // Both charges, and the greater-of rule, are on the page.
  await expect(page.getByText(/1 · Evaluation fee/i)).toBeVisible();
  await expect(page.getByText(/2 · Deployment fee/i)).toBeVisible();
  await expect(page.getByText(/whichever is greater/i)).toBeVisible();

  // The worked example resolves to the stated arithmetic.
  await expect(page.getByText("$12,000 to Blueprint", { exact: true })).toBeVisible();
  await expect(page.getByText("$9,000 more from Team A", { exact: true })).toBeVisible();
  await expect(page.getByText("$30,000 more from Team A", { exact: true })).toBeVisible();

  // No contract percentage survives anywhere on the page.
  await expect(page.getByText(/% of first-year revenue/i)).toHaveCount(0);
  await expect(page.getByText(/deployment-network fee/i)).toHaveCount(0);
  await expect(page.getByText(/robot-month/i)).toHaveCount(0);

  await expect(
    page.locator("main").getByRole("link", { name: /Submit a job/i }).first(),
  ).toHaveAttribute("href", /buyerType=site_operator/);
});

test("the greater-of flips from the floor to the per-robot rate", async ({ page }) => {
  await page.goto("/pricing");
  const robots = page.getByLabel(/Robots deployed on this task/i);

  // Five robots sits on the floor: $10,000 less the $1,000 evaluation credit.
  await robots.fill("5");
  await expect(page.getByText("$9,000", { exact: true })).toBeVisible();

  // Twenty clears it: 20 x $2,000 = $40,000 less the credit.
  await robots.fill("20");
  await expect(page.getByText("$39,000", { exact: true })).toBeVisible();
});

test("pricing states the rates are terms under test rather than a market rate", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(page.getByText(/starting terms Blueprint intends to test/i).first()).toBeVisible();
  await expect(page.getByText(/vendors selling data services/i).first()).toBeVisible();
});

test("deployment pricing remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing");

  const robots = page.getByLabel(/Robots deployed on this task/i);
  await expect(robots).toBeVisible();
  await robots.fill("20");
  await expect(page.getByText("$39,000", { exact: true })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
