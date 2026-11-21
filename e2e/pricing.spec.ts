import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from "@playwright/test";

test.beforeEach(mockExternalFonts);

test("historical pricing leads to the free beta page with one action", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page).toHaveURL(/\/beta$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Questions");
  await expect(page.locator("#scope")).toContainText("Free for sites.");
  await expect(page.getByText("You agree any work and its terms with the company directly.", { exact: true })).toBeVisible();
  await expect(page.locator("main .bare-button")).toHaveCount(1);
  await expect(page.locator("main")).not.toContainText("$2,500");
  await expect(page.locator("main")).not.toContainText("$99");
});

// Terms 2026-11-19.1 (owner: the early trial dropped on 2026-11-14): the Terms no longer say Blueprint runs one. Terms
// 2026-11-21.1 (owner approval of 2026-11-21): the site's cost line is "Free for sites."; the balance, refund and earlier
// filming-visit clauses are gone; a company may test its own robot in the downloaded simulation.
test("terms make the beta free, with no early trial and no Blueprint fee", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.locator("article").getByText("Free for sites.", { exact: true })).toBeVisible();
  await expect(page.locator("article")).not.toContainText(/early trial|openly available robot software/i);
  await expect(page.getByText(/Blueprint does not test any robot in the simulation\. Once the simulation can be downloaded, a deployment company may test its own robot in it, using its own tools\./)).toBeVisible();
  await expect(page.getByText(/Blueprint recommends one robot team whose evaluation on your job passed/)).toHaveCount(0);
  await expect(page.getByText(/Blueprint charges no fee for and takes no percentage of any pilot or deployment/)).toBeVisible();
  await expect(page.locator("article")).not.toContainText(/paid private evaluations|unused balance|refund/i);
  await expect(page.getByRole("heading", { name: /Earlier filming visits/ })).toHaveCount(0);
  await expect(page.getByText(/ask Blueprint staff to film/)).toHaveCount(0);
  await expect(page.locator("article")).not.toContainText("$2,500");
  await expect(page.getByText(/invoices the site/)).toHaveCount(0);
  await expect(page.getByText(/authorized buyer for the site must separately agree in writing/)).toHaveCount(0);
});

test("the beta page reaches the header on mobile without a horizontal scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Reject all", exact: true }).click();
  await page.getByRole("link", { name: "How it works" }).click();
  await page.getByRole("link", { name: "Questions ›" }).click();

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
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Questions");
});
