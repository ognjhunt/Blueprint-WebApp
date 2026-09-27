import { test, expect } from "@playwright/test";

test("pricing leads with no match, no fee and keeps robot teams free", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No match, no fee.");

  const site = page.locator("section", { has: page.getByRole("heading", { name: "Find a robot team" }) });
  await expect(site.getByText("$2,500", { exact: true })).toBeVisible();
  await expect(site.getByText("per task, only if we find a match", { exact: true })).toBeVisible();
  await expect(site.getByText(/passed the evaluation for your task, fits your budget, and wants to run your pilot/)).toBeVisible();
  await expect(site.getByRole("link", { name: /Start a task assessment/ })).toHaveAttribute("href", "/contact/site-operator");

  const team = page.locator("section", { has: page.getByRole("heading", { name: "Evaluate real site tasks" }) });
  await expect(team.getByText("$0", { exact: true })).toBeVisible();
  const privateOption = team.locator("details");
  await expect(privateOption).not.toHaveAttribute("open");
  await privateOption.locator("summary").click();
  await expect(privateOption.getByText(/the site does not see or consider them/)).toBeVisible();
  await expect(privateOption.getByText(/separate free invited evaluation/)).toBeVisible();
  await expect(team.getByRole("link", { name: /Apply for early access/ })).toHaveAttribute("href", "/contact/robot-team");

  const pilot = page.locator("section", { has: page.getByRole("heading", { name: "The pilot itself" }) });
  await expect(pilot.getByText(/Blueprint takes no cut of the pilot or any deployment that follows/)).toBeVisible();
  await expect(pilot.getByRole("link", { name: /Fee details in our Terms/ })).toHaveAttribute("href", "/terms");
  await expect(page.getByText(/5%|capped at|authorized buyer/)).toHaveCount(0);
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("terms state the match fee and keep optional paid runs separate", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByText(/No match, no fee\. When you open a task to pilot proposals/)).toBeVisible();
  await expect(page.getByText(/invoice the site \$2,500 \(plus any applicable tax\), once per task however many teams match/)).toBeVisible();
  await expect(page.getByText(/Blueprint takes no percentage of any pilot or deployment/)).toBeVisible();
  await expect(page.getByText(/Invited teams pay no evaluation entry fee or supplier commission for work within the invitation's stated scope/)).toBeVisible();
  await expect(page.getByText(/currently \$99/)).toBeVisible();
  await expect(page.getByText(/authorized buyer for the site must separately agree in writing/)).toHaveCount(0);
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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("No match, no fee.");
});
