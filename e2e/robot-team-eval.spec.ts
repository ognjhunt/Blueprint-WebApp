import { expect, test } from "@playwright/test";

test("legacy robot-team evaluation URL reaches the current product", async ({
  page,
}) => {
  await page.goto("/robot-team/eval");
  await expect(page).toHaveURL(/\/for-robot-teams/);
  await expect(
    page.getByRole("heading", {
      name: "Arrive with the robot. Not before it.",
    }),
  ).toBeVisible();
  await expect(
    page
      .locator("main")
      .getByRole("link", { name: /Join the robot network/i })
      .first(),
  ).toHaveAttribute("href", /buyerType=robot_team/);
});

test("robot-team and site-operator pages describe one service and intake", async ({
  page,
}) => {
  await page.goto("/for-robot-teams");
  await expect(
    page.getByText(/Deployment-engineer weeks/i).first(),
  ).toBeVisible();
  await expect(
    page.getByText(/We prepare it\. You install it and prove it/i),
  ).toBeVisible();
  await expect(page.getByText(/Policy Shortlist/i)).toHaveCount(0);

  await page.goto("/for-site-operators");
  await expect(
    page.getByRole("heading", {
      name: "Show us the job. We find the robot that can do it.",
    }),
  ).toBeVisible();
  await expect(
    page
      .locator("main")
      .getByRole("link", { name: /Submit a job/i })
      .first(),
  ).toHaveAttribute("href", /intent=pilot-opportunity/);
  await expect(
    page.getByRole("link", { name: /Submit a job/i }).first(),
  ).toHaveAttribute(
    "href",
    /\/signup\/business\?buyerType=site_operator&intent=pilot-opportunity/,
  );
  await expect(page.getByText(/Progressive access/i).first()).toBeVisible();
  await expect(page.getByText(/Controlled evaluation/i).first()).toBeVisible();
  await expect(
    page.getByText(/site model stays hosted by Blueprint/i),
  ).toBeVisible();
  await expect(
    page.getByText(/robot provider still owns onsite deployment/i),
  ).toBeVisible();
  await expect(page.getByText(/Robot Match/i)).toHaveCount(0);
});

test("persona pages are usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/for-robot-teams");
  await expect(
    page.getByRole("link", { name: /Join the robot network/i }).first(),
  ).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.goto("/for-site-operators");
  await expect(
    page.getByRole("link", { name: /Submit a job/i }).first(),
  ).toBeVisible();
  const operatorHasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  expect(operatorHasHorizontalOverflow).toBe(false);
});
