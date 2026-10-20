import { test, expect } from "@playwright/test";

test("homepage speaks to sites, with robot teams one nav link away", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Could a robot take over a repetitive task at your site?");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/how-it-works");
  await expect(nav.getByRole("link", { name: "Beta program" })).toHaveAttribute("href", "/beta");
  await expect(nav.getByRole("link", { name: "For robot teams" })).toHaveAttribute("href", "/contact/robot-team");
  await expect(nav.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  const main = page.locator("main");
  const starts = main.getByRole("link", { name: "Show us a task" });
  await expect(starts).toHaveCount(2);
  for (const start of await starts.all()) await expect(start).toHaveAttribute("href", "/contact/site-operator");
  await expect(main.getByText("Free during the beta, for sites and robot teams.")).toBeVisible();
  await expect(main.getByRole("link", { name: /robot-team beta|early access/i })).toHaveCount(0);
  await expect(main.getByText("One team whose evaluation passed. You agree dates and terms with them.")).toBeVisible();
});
