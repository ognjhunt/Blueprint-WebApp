import { expect, test } from "@playwright/test";

test("pricing page presents the scoped run and deployment-network schedule", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", {
      name: "Do the homework free. Pay when the robot gets paid.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Both sides can do the months 0–2 homework without a core platform fee.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "5% to start. Lower automatically as annual volume grows.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/First \$1 million in the customer account year/i),
  ).toBeVisible();
  await expect(page.getByText(/Site-paid · success-aligned/i)).toBeVisible();
  await page
    .getByLabel(/Enterprise provider revenue paid this account year/i)
    .fill("10000000");
  await expect(page.getByText("$320,000", { exact: true })).toBeVisible();
  await expect(page.getByText("3.2%", { exact: true })).toBeVisible();
  await expect(page.getByText(/Customer total: \$10,320,000/i)).toBeVisible();
  await expect(
    page.getByText(/Free submission does not mean a free site visit/i),
  ).toBeVisible();
  await expect(
    page
      .locator("main")
      .getByRole("link", { name: /Submit a site task/i })
      .first(),
  ).toHaveAttribute("href", /buyerType=site_operator/);
  await expect(page.getByText(/Policy Shortlist/i)).toHaveCount(0);
  await expect(page.getByText(/Robot Match/i)).toHaveCount(0);
  await expect(page.getByText(/Robot-team subscription/i)).toHaveCount(0);
  await expect(page.getByText(/Quick-look/i)).toHaveCount(0);
  await expect(page.getByText(/Site monitoring/i)).toHaveCount(0);
});

test("deployment-network pricing remains usable on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/pricing");

  await expect(
    page.getByLabel(/Enterprise provider revenue paid this account year/i),
  ).toBeVisible();
  await page
    .getByLabel(/Enterprise provider revenue paid this account year/i)
    .fill("100000000");
  await expect(page.getByText("$1,670,000", { exact: true })).toBeVisible();
  await expect(page.getByText("1.7%", { exact: true })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);
});
