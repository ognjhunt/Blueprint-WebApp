import { test, expect } from "@playwright/test";

test("pricing keeps the site's bill and the robot team's bill apart", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Robot teams pay $99 an entry.",
  );

  const site = page.locator("section", { has: page.getByRole("heading", { name: /assessment of one task at one site/i }) });
  await expect(site.getByText("$0", { exact: true })).toBeVisible();
  await expect(site.getByText(/No fee, no card, and nothing per run/i)).toBeVisible();
  await expect(site.getByRole("link", { name: /Start a task assessment/i })).toHaveAttribute(
    "href",
    "/contact/site-operator",
  );

  const team = page.locator("section", { has: page.getByRole("heading", { name: /One price for each policy you put on a task/i }) });
  await expect(team.getByText("$99", { exact: true })).toBeVisible();
  await expect(team.getByRole("link", { name: /Apply as a robot team/i })).toHaveAttribute(
    "href",
    "/contact/robot-team",
  );

  // A free site is told what funds this and what is still not free, rather
  // than discovering later that it was never the customer.
  await expect(page.getByText(/Robot teams pay for evaluation runs/i)).toBeVisible();
  await expect(page.getByText(/A physical pilot/i)).toBeVisible();
  // And a team is told money cannot buy a longer run than a rival.
  await expect(page.getByText(/You cannot buy a longer run than a rival/i)).toBeVisible();

  // The superseded deployment-marketplace model stays off this page. Sites now
  // pay nothing, but never via win fees -- that is a different product surface.
  await expect(page.getByText(/\$10,000 if you win|\$1,000 to evaluate/)).toHaveCount(0);
});

test("pricing defines an entry and shows the arithmetic behind a quote", async ({ page }) => {
  await page.goto("/pricing");
  await expect(
    page.getByText(/One entry is one policy, running on one embodiment, against one task/),
  ).toBeVisible();

  // Both halves of the pair, because this is the only part of a flat price a
  // buyer can get wrong.
  await expect(
    page.getByText(/The same policy on a second embodiment is a second entry/),
  ).toBeVisible();
  await expect(
    page.getByText(/A second policy on the same embodiment is a second entry/),
  ).toBeVisible();

  const row = page.getByRole("row").filter({ hasText: "Three policies on two tasks" });
  await expect(row.getByText("6", { exact: true })).toBeVisible();
  await expect(row.getByText("$594", { exact: true })).toBeVisible();
  await expect(page.getByText(/Entries × tasks × \$99/)).toBeVisible();
  await expect(page.getByText(/Entries × tasks ×/i)).toHaveCount(1);
});

test("pricing reaches the header on mobile without a horizontal scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("link", { name: "Pricing" })
    .click();

  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("legacy offer URLs still land on the pricing page itself", async ({ page, request }) => {
  const response = await request.get("/data-packages?source=old-campaign", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe("/pricing?source=old-campaign");

  await page.goto("/data-packages");
  await expect(page).toHaveURL(/\/pricing/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Robot teams pay $99 an entry.",
  );
});

test("a site never sees a unit price, and nothing is owed after the entry fee", async ({ page }) => {
  await page.goto("/pricing");

  const site = page.locator("section", { has: page.getByRole("heading", { name: /assessment of one task at one site/i }) });
  // The site is buying a decision, not compute — no price in its column at all.
  await expect(site.getByText(/\$99|per entry|episode/i)).toHaveCount(0);
  await expect(site.getByText(/up to five candidates/i)).toBeVisible();

  const covers = page.locator("section", { has: page.getByRole("heading", { name: /What \$99 covers/i }) });
  await expect(covers.getByText(/no budget to choose, no episode count to size/i)).toBeVisible();
  await expect(covers.getByText(/same for every entry on the task/i)).toBeVisible();
  await expect(page.getByText(/Nothing more later, including if you are shortlisted/i)).toBeVisible();

  // Where the answer stops, stated next to what it costs.
  await expect(page.getByText(/too close to separate/i)).toBeVisible();
});
