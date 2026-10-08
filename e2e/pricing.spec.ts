import { test, expect } from "@playwright/test";

test("historical pricing leads to invited beta scope with one action", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/beta$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start with one real task.");
  await expect(page.getByText(/The initial assessment is free for invited participants/)).toBeVisible();
  await expect(page.getByText(/Any later evaluation, integration, or physical pilot/)).toBeVisible();
  await expect(page.locator("article .ms-button")).toHaveCount(1);
  await expect(page.locator("article")).not.toContainText("$2,500");
});

test("terms put the fee at booking and disable paid team evaluations", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByText(/No pilot, no fee\. Blueprint selects one robot team/)).toBeVisible();
  await expect(page.getByText(/invoices the site \$2,500 \(plus any applicable tax\), once per job\. If you do not book, you owe nothing/)).toBeVisible();
  await expect(page.getByText(/Blueprint takes no percentage of any pilot or deployment/)).toBeVisible();
  await expect(page.getByText(/Invited teams pay no evaluation entry fee or supplier commission within the invitation's stated scope/)).toBeVisible();
  await expect(page.getByText(/New paid private evaluations and balance top-ups are unavailable during this beta/)).toBeVisible();
  await expect(page.getByText(/authorized buyer for the site must separately agree in writing/)).toHaveCount(0);
});

test("pricing reaches the header on mobile without a horizontal scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Reject all", exact: true }).click();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Beta program" }).click();

  await expect(page).toHaveURL(/\/beta$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("legacy offer URLs still land on the pricing page", async ({ page, request }) => {
  const response = await request.get("/data-packages?source=old-campaign", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe("/pricing?source=old-campaign");

  await page.goto("/data-packages");
  await expect(page).toHaveURL(/\/beta/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start with one real task.");
});
