import { expect, test } from "@playwright/test";

test("pricing page presents the subscription-first robot-team pricing ladder", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", {
      name: "Priced as evaluation infrastructure.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Robot-team subscription" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Quick-look eval" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Site supply", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Site monitoring", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^\$15k$/i)).toBeVisible();
  await expect(page.getByText(/^\$5–8k$/i)).toBeVisible();
  await expect(page.getByText(/^\$5k$/i)).toBeVisible();
  await expect(page.getByText(/^\$30–40k$/i)).toBeVisible();
  await expect(page.getByText(/Overage pricing above the cap/i)).toBeVisible();
  await expect(page.getByText(/Multiple scoped checks up to annual cap/i)).toBeVisible();
  await expect(page.getByText(/Monitoring is a separate, recurring option\./i)).toBeVisible();
  await expect(
    page.getByText(/not a deployment-ready claim or a/i),
  ).toBeVisible();
  // Site-operator tiers must land on the site-operator intake form, not the
  // generic /contact redirect (which routes to the robot-team form).
  await expect(
    page.getByRole("link", { name: /Start a site review/i }).first(),
  ).toHaveAttribute("href", /\/contact\/site-operator/);
  await expect(
    page.getByRole("link", { name: /Discuss monitoring/i }).first(),
  ).toHaveAttribute("href", /\/contact\/site-operator/);
});
