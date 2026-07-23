import { expect, test } from "@playwright/test";

test("pricing page presents the two-campaign shortlist model", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", {
      name: "Priced per campaign, not per seat.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Policy Shortlist", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Robot Match", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^\$3,000$/)).toBeVisible();
  await expect(page.getByText(/^\$5,000$/)).toBeVisible();
  await expect(page.getByText(/\$250–500/).first()).toBeVisible();
  await expect(page.getByText(/never\s+manufactures a winner/i).first()).toBeVisible();
  // Each campaign CTA lands on the correct persona intake.
  await expect(
    page.getByRole("link", { name: /Rank my policies/i }).first(),
  ).toHaveAttribute("href", /\/contact\/robot-team/);
  await expect(
    page.getByRole("link", { name: /Find robot teams for my site/i }).first(),
  ).toHaveAttribute("href", /\/contact\/site-operator/);
  // The retired subscription / supply-review / monitoring model is gone.
  await expect(page.getByText(/Robot-team subscription/i)).toHaveCount(0);
  await expect(page.getByText(/Quick-look/i)).toHaveCount(0);
  await expect(page.getByText(/Site monitoring/i)).toHaveCount(0);
});
