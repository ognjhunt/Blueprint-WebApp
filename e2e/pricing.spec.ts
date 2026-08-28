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
      name: "Lose and it stays $1,000. Win and it is $10,000.",
      exact: true,
    }),
  ).toBeVisible();

  // The whole price list: lose $1,000, win $10,000, site $0.
  await expect(page.getByText(/The whole price list/i)).toBeVisible();
  await expect(page.getByText(/You evaluate and do not win/i)).toBeVisible();
  await expect(page.getByText(/You evaluate and win the task/i)).toBeVisible();
  await expect(page.getByText(/The site, in every case/i)).toBeVisible();

  // The worked example resolves to the stated arithmetic.
  await expect(page.getByText("$12,000 to Blueprint", { exact: true })).toBeVisible();
  await expect(page.getByText("$9,000 more from Team A", { exact: true })).toBeVisible();
  await expect(page.getByText("$12,000 from Team A", { exact: true })).toBeVisible();

  // No contract percentage survives anywhere on the page.
  await expect(page.getByText(/% of first-year revenue/i)).toHaveCount(0);
  await expect(page.getByText(/deployment-network fee/i)).toHaveCount(0);
  await expect(page.getByText(/robot-month/i)).toHaveCount(0);
  await expect(page.getByText(/per robot deployed/i)).toHaveCount(0);

  await expect(
    page.locator("main").getByRole("link", { name: /Submit a job/i }).first(),
  ).toHaveAttribute("href", /buyerType=site_operator/);
});

test("a loss costs $1,000 and a win costs $10,000", async ({ page }) => {
  await page.goto("/pricing");
  const evaluated = page.getByLabel(/Site-tasks evaluated/i);
  const won = page.getByLabel(/Of those, won/i);

  await evaluated.fill("1");
  await won.fill("0");
  await expect(page.getByText("$1,000", { exact: true }).first()).toBeVisible();

  await won.fill("1");
  await expect(page.getByText("$10,000", { exact: true }).first()).toBeVisible();

  // Three evaluated, one won: $3,000 + $9,000.
  await evaluated.fill("3");
  await expect(page.getByText("$12,000", { exact: true }).first()).toBeVisible();
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

  const evaluated = page.getByLabel(/Site-tasks evaluated/i);
  await expect(evaluated).toBeVisible();
  await evaluated.fill("3");
  await page.getByLabel(/Of those, won/i).fill("1");
  await expect(page.getByText("$12,000", { exact: true }).first()).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
