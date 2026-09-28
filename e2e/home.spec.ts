import { test, expect } from "@playwright/test";

test("homepage leads with the site decision and separates supplier participation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A measured robot pilot.");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Start a job assessment" })).toHaveAttribute("href", "/contact/site-operator");
  await expect(nav.getByRole("link", { name: "Robot teams" })).toHaveAttribute("href", "/contact/robot-team");
  await expect(nav.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/how-it-works");
  await expect(page.getByRole("link", { name: "Apply for early access" })).toBeVisible();
  await page.getByText("Meet your match", { exact: true }).click();
  await expect(page.getByText(/we introduce you right away\. No match, no fee\./)).toBeVisible();
  await page.getByText("Run the pilot", { exact: true }).click();
  await expect(page.getByText(/Blueprint takes no cut/)).toBeVisible();
  await expect(page.getByText("Illustrative scenes", { exact: true })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
});
