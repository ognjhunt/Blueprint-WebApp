import { expect, test } from "@playwright/test";

test("pricing page presents the simple policy evaluation package ladder", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", {
      name: "Pick a run.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Test policies" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Validate with robot" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Improve policy" }),
  ).toBeVisible();
  await expect(page.getByText(/100 episodes/i)).toBeVisible();
  await expect(page.getByText(/500 episodes/i)).toBeVisible();
  await expect(page.getByText(/Virtual results do not approve deployment or safety/i)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Submit site/i }).first(),
  ).toHaveAttribute("href", /\/contact\/site-operator/);
});
