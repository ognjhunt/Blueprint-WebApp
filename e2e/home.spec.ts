import { test, expect } from "@playwright/test";

test("homepage speaks to sites, with robot teams one nav link away", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Could a robot take over a repetitive task?");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/how-it-works");
  await expect(nav.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
  await expect(nav.getByRole("link", { name: "For robot teams" })).toHaveAttribute("href", "/contact/robot-team");
  await expect(nav.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  const main = page.locator("main");
  await expect(main.getByRole("link", { name: "Show us a task" })).toHaveAttribute("href", "/contact/site-operator");
  await expect(main.getByText("Free to start. No pilot, no fee.")).toBeVisible();
  await expect(main.getByRole("link", { name: /robot-team beta|early access/i })).toHaveCount(0);
  await expect(main.getByText("One click. We coordinate the rest.")).toBeVisible();
});
