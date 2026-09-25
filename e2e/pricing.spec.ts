import { test, expect } from "@playwright/test";

test("pricing shows current costs and separates physical pilot work", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One task. Clear costs.");

  const site = page.locator("section", { has: page.getByRole("heading", { name: "Initial task assessment" }) });
  await expect(site.getByText("$0", { exact: true })).toBeVisible();
  await expect(site.getByText(/No card required/)).toBeVisible();
  await expect(site.getByRole("link", { name: /Start a task assessment/ })).toHaveAttribute("href", "/contact/site-operator");
  await expect(site.getByText(/\$99|per entry|episode/i)).toHaveCount(0);

  const team = page.locator("section", { has: page.getByRole("heading", { name: "Bring a credible solution" }) });
  await expect(team.getByText("$0", { exact: true })).toBeVisible();
  await expect(team.getByText(/Invited teams pay no evaluation entry fee for a site-funded pilot project/)).toBeVisible();
  await expect(team.getByText(/Optional self-directed runs outside that project cost \$99 per entry/)).toBeVisible();
  await expect(team.getByText(/One entry is one policy, running on one embodiment/)).toBeVisible();
  await expect(team.getByRole("link", { name: /Apply for early access/ })).toHaveAttribute("href", "/contact/robot-team");

  const pilot = page.locator("section", { has: page.getByRole("heading", { name: "Physical pilots" }) });
  await expect(pilot.getByText(/fee starts at \$5,000/)).toBeVisible();
  await expect(pilot.getByText(/itemized quote for the full trial/)).toBeVisible();
  await expect(pilot.getByText(/result adds no extra Blueprint fee/)).toBeVisible();
  await expect(pilot.getByRole("link", { name: /billing details in our Terms/ })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("terms separate free invited participation from optional paid runs", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByText(/Invited teams pay no evaluation entry fee for work within that project's agreed scope/)).toBeVisible();
  await expect(page.getByText(/currently \$99/)).toBeVisible();
  await expect(page.getByText(/written scope and budget showing Blueprint's fixed fee/)).toBeVisible();
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
