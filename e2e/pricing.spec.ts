import { expect, test } from "@playwright/test";

test("pricing page presents the subscription-first robot-team pricing ladder", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", {
      name: "Evaluation infrastructure, not one-off tax.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Robot team subscription" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Lite quick-look eval" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Site supply review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Site monitoring subscription" }),
  ).toBeVisible();
  await expect(page.getByText(/\$15,000 \/ month/i)).toBeVisible();
  await expect(page.getByText(/\$5,000-\$8,000 \/ eval/i)).toBeVisible();
  await expect(page.getByText(/\$5,000 \/ site/i)).toBeVisible();
  await expect(page.getByText(/\$30,000-\$40,000 \/ site \/ year/i)).toBeVisible();
  await expect(page.getByText(/Overage pricing above the cap/i)).toBeVisible();
  await expect(page.getByText(/Multiple policy-update checks up to agreed annual cap/i)).toBeVisible();
  await expect(page.getByText(/Site review is one-time; monitoring is recurring/i)).toBeVisible();
  await expect(page.getByText(/Virtual results do not approve deployment or safety/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Start site review/i }).first(),
  ).toHaveAttribute("href", /\/contact\/site-operator/);
});
