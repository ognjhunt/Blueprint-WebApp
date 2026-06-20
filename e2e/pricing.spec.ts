import { expect, test } from "@playwright/test";

test("pricing page presents the simple policy evaluation package ladder", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", {
      name: "Simple packages for robot policy evaluation.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Policy Evaluation Run" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Validated Evaluation Pack" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Policy Improvement Run" }),
  ).toBeVisible();
  await expect(page.getByText(/Virtual results do not guarantee/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Submit site free/i }).first(),
  ).toHaveAttribute("href", /\/contact\/site-operator/);
});
