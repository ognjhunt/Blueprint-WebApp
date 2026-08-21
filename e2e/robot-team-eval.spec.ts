import { expect, test } from "@playwright/test";

test("legacy robot-team evaluation URL reaches the current product", async ({ page }) => {
  await page.goto("/robot-team/eval");
  await expect(page).toHaveURL(/\/for-robot-teams/);
  await expect(
    page.getByRole("heading", { name: "Know which candidate deserves the pilot." }),
  ).toBeVisible();
  await expect(
    page.locator("main").getByRole("link", { name: /Scope a benchmark/i }).first(),
  ).toHaveAttribute("href", /\/contact\/robot-team/);
});

test("robot-team and site-operator pages describe one service and intake", async ({ page }) => {
  await page.goto("/for-robot-teams");
  // Screening precedes the ranking, and a gap the design cannot separate is
  // still presented as an outcome rather than omitted.
  await expect(page.getByText(/Bring candidates\. Get them screened, then ordered\./i).first()).toBeVisible();
  await expect(page.getByText(/^Inside the resolution$/i).first()).toBeVisible();
  await expect(page.getByText(/Policy Shortlist/i)).toHaveCount(0);

  await page.goto("/for-site-operators");
  await expect(
    page.getByRole("heading", {
      name: "Find out what a robot could do here, before anyone shows up.",
    }),
  ).toBeVisible();
  await expect(
    page.locator("main").getByRole("link", { name: /Scope a site benchmark/i }).first(),
  ).toHaveAttribute("href", /\/contact\/site-operator/);
  await expect(
    page.getByRole("link", { name: /Prepare a pilot opportunity/i }),
  ).toHaveAttribute("href", /\/signup\/business\?buyerType=site_operator&intent=pilot-opportunity/);
  await expect(page.getByText(/Progressive access · no twin download/i)).toBeVisible();
  await expect(page.getByText(/Controlled evaluation/i).first()).toBeVisible();
  await expect(page.getByText(/Separately negotiated training rights/i).first()).toBeVisible();
  await expect(page.getByText(/Robot teams fund their incremental evaluation compute/i)).toBeVisible();
  await expect(page.getByText(/Robot Match/i)).toHaveCount(0);
});

test("persona pages are usable on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/for-robot-teams");
  await expect(
    page.getByRole("link", { name: /Scope a benchmark/i }).first(),
  ).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasHorizontalOverflow).toBe(false);

  await page.goto("/for-site-operators");
  await expect(page.getByRole("link", { name: /Prepare a pilot opportunity/i })).toBeVisible();
  const operatorHasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(operatorHasHorizontalOverflow).toBe(false);
});
