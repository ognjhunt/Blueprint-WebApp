import { expect, test } from "@playwright/test";

test("pricing page presents one scoped Task Evaluation Run", async ({
  page,
}) => {
  await page.goto("/pricing");

  await expect(
    page.getByRole("heading", {
      name: "You pay for the decision, not a package.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Scoped quote", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "One scoped run, and everything needed to read it.", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/\$3,000/)).toHaveCount(0);
  await expect(page.getByText(/\$5,000/)).toHaveCount(0);
  await expect(page.getByText(/No guaranteed outcome/i)).toBeVisible();
  // The single engagement CTA lands on the shared robot-team-first intake.
  await expect(
    page.getByRole("link", { name: /Request a Task Evaluation Run/i }).first(),
  ).toHaveAttribute("href", /\/contact\/robot-team/);
  await expect(page.getByText(/Policy Shortlist/i)).toHaveCount(0);
  await expect(page.getByText(/Robot Match/i)).toHaveCount(0);
  await expect(page.getByText(/Robot-team subscription/i)).toHaveCount(0);
  await expect(page.getByText(/Quick-look/i)).toHaveCount(0);
  await expect(page.getByText(/Site monitoring/i)).toHaveCount(0);
});
