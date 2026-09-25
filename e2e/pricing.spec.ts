import { test, expect } from "@playwright/test";

test("pricing shows current costs and separates physical pilot work", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One task. Clear costs.");

  const site = page.locator("section", { has: page.getByRole("heading", { name: "Review an offer" }) });
  await expect(site.getByText("$0", { exact: true })).toBeVisible();
  await expect(site.getByText(/No card required/)).toBeVisible();
  await expect(site.getByRole("link", { name: /Start a task assessment/ })).toHaveAttribute("href", "/contact/site-operator");
  await expect(site.getByText(/\$99|per entry|episode/i)).toHaveCount(0);

  const team = page.locator("section", { has: page.getByRole("heading", { name: "Evaluate a matched task" }) });
  await expect(team.getByText("$0", { exact: true })).toBeVisible();
  await expect(team.getByText(/Matched evaluations are free/)).toBeVisible();
  await expect(team.getByText(/Optional self-directed runs cost \$99 per entry/)).toBeVisible();
  await expect(team.getByText(/site decides whether to buy it/)).toBeVisible();
  await expect(team.getByRole("link", { name: /Apply for early access/ })).toHaveAttribute("href", "/contact/robot-team");

  const pilot = page.locator("section", { has: page.getByRole("heading", { name: "If you buy a pilot" }) });
  await expect(pilot.getByText(/5% of the introduced provider's physical pilot price/)).toBeVisible();
  await expect(pilot.getByText(/capped at \$5,000/)).toBeVisible();
  await expect(pilot.getByText(/No pilot purchase, no Blueprint fee/)).toBeVisible();
  await expect(pilot.getByRole("link", { name: /Fee details in our Terms/ })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("terms separate free invited participation from optional paid runs", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByText(/Invited teams pay no evaluation entry fee or supplier commission for work within the invitation's stated scope/)).toBeVisible();
  await expect(page.getByText(/currently \$99/)).toBeVisible();
  await expect(page.getByText(/Before Blueprint invites robot teams to evaluate a site task for free, an authorized buyer for the site must separately agree in writing/)).toBeVisible();
  await expect(page.getByText(/even if the site and provider contract or communicate directly/)).toBeVisible();
  await expect(page.getByText(/A paid entry retains its no-later-supplier-commission promise/)).toBeVisible();
});

test("pricing reaches the header on mobile without a horizontal scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Pricing" }).click();

  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("legacy offer URLs still land on the pricing page", async ({ page, request }) => {
  const response = await request.get("/data-packages?source=old-campaign", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe("/pricing?source=old-campaign");

  await page.goto("/data-packages");
  await expect(page).toHaveURL(/\/pricing/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One task. Clear costs.");
});
