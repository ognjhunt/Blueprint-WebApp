import { expect, test } from "@playwright/test";

test("pricing page presents free discovery, the paid line, and observable units", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", {
      name: "Free to discover. You pay when robots are working.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Discovery costs nothing, because it costs us nothing.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Payment starts where scarce work does.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Billed on units both sides can count.",
      exact: true,
    }),
  ).toBeVisible();

  // The unit is the point: an activated site-task and an active robot-month.
  await expect(page.getByText(/Observable units · not a contract percentage/i).first()).toBeVisible();
  await expect(page.getByText(/Active robot-month/i).first()).toBeVisible();

  // The credit is returned, so a team that deploys pays nothing extra for evaluating.
  await page.getByLabel(/^Active robots$/i).fill("3");
  await page.getByLabel(/^Months$/i).fill("12");
  await expect(page.getByText("$6,100", { exact: true })).toBeVisible();
  await expect(page.getByText("−$2,500", { exact: true })).toBeVisible();

  // A capture visit is gated on a commitment, not on interest.
  await expect(page.getByText(/Expressed interest does not buy one/i)).toBeVisible();

  await expect(
    page
      .locator("main")
      .getByRole("link", { name: /Submit a job/i })
      .first(),
  ).toHaveAttribute("href", /buyerType=site_operator/);

  // The superseded revenue-share model must not resurface anywhere on the page.
  await expect(page.getByText(/5% deployment-network fee/i)).toHaveCount(0);
  await expect(page.getByText(/First \$1 million in the customer account year/i)).toHaveCount(0);
  await expect(page.getByText(/Policy Shortlist/i)).toHaveCount(0);
  await expect(page.getByText(/Robot Match/i)).toHaveCount(0);
});

test("pricing states the rates are terms under test rather than a market rate", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(
    page.getByText(/starting terms Blueprint intends to test/i).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/vendors selling data services/i).first(),
  ).toBeVisible();
});

test("deployment pricing remains usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing");

  await expect(page.getByLabel(/^Active robots$/i)).toBeVisible();
  await page.getByLabel(/^Active robots$/i).fill("10");
  await page.getByLabel(/^Months$/i).fill("12");
  await expect(page.getByText("$14,500", { exact: true })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
