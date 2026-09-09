import { test, expect } from "@playwright/test";

test("homepage leads with the site decision and separates supplier participation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A pilot worth running.");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "Discuss your site" })).toHaveAttribute("href", "/contact/site-operator");
  await expect(nav.getByRole("link", { name: "Robot teams" })).toHaveAttribute("href", "/contact/robot-team");
  await expect(nav.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/how-it-works");
  await expect(page.getByRole("link", { name: "Apply as a robot team" })).toBeVisible();
  await page.getByText("Choose the pilot", { exact: true }).click();
  await expect(page.getByText(/clear reason to pause/)).toBeVisible();
  await expect(page.getByText(/site and robot team run the physical pilot/)).toBeVisible();
  await expect(page.getByText("Illustrative scenes", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Pricing", exact: true })).toHaveCount(0);
});
