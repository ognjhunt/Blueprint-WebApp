import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from "@playwright/test";

test.beforeEach(mockExternalFonts);

test("historical pricing leads to the free beta page with one action", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/beta$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start with one real job.");
  await expect(page.getByText(/The beta is free for sites and partners/)).toBeVisible();
  await expect(page.getByText(/You choose whether to proceed and approve the spending/i)).toBeVisible();
  await expect(page.locator("article .ms-button")).toHaveCount(1);
  await expect(page.locator("article")).not.toContainText("$2,500");
  await expect(page.locator("article")).not.toContainText("$99");
});

test("terms make the beta free, with Blueprint running the evaluation and no Blueprint fee", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByText(/building the simulation, the evaluation and its result cost the site nothing/)).toBeVisible();
  await expect(page.getByText(/Teams do not run their own evaluations of a site's job/)).toBeVisible();
  await expect(page.getByText(/Blueprint recommends one robot team whose evaluation on your job passed/)).toHaveCount(0);
  await expect(page.getByText(/There is no Blueprint fee, invoice or payment step/)).toBeVisible();
  await expect(page.getByText(/Blueprint charges no fee for and takes no percentage of any pilot or deployment/)).toBeVisible();
  await expect(page.getByText(/The beta has no paid private evaluations, balances, top-ups or checkout/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "4. In-person filming visits" })).toBeVisible();
  await expect(page.locator("article")).not.toContainText("$2,500");
  await expect(page.getByText(/invoices the site/)).toHaveCount(0);
  await expect(page.getByText(/authorized buyer for the site must separately agree in writing/)).toHaveCount(0);
});

test("the beta page reaches the header on mobile without a horizontal scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Reject all", exact: true }).click();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "How it works" }).click();
  await page.getByRole("navigation", { name: "Footer navigation" }).getByRole("link", { name: "Beta & pricing" }).click();

  await expect(page).toHaveURL(/\/beta$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("legacy offer URLs land on the beta page in one hop", async ({ page, request }) => {
  const response = await request.get("/data-packages?source=old-campaign", { maxRedirects: 0 });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe("/beta?source=old-campaign");

  await page.goto("/data-packages");
  await expect(page).toHaveURL(/\/beta/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Start with one real job.");
});
