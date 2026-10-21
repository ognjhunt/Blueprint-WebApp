import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from "@playwright/test";

test.beforeEach(mockExternalFonts);

test("homepage speaks to sites, with partners one nav link away", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Find the right way to automate your work.");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/how-it-works");
  await expect(nav.getByRole("link", { name: "Submit a job" })).toHaveAttribute("href", "/contact/site-operator");
  await expect(nav.getByRole("link", { name: "For partners" })).toHaveAttribute("href", "/partners");
  await expect(nav.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  const main = page.locator("main");
  const starts = main.getByRole("link", { name: "Submit a job" });
  await expect(starts).toHaveCount(2);
  for (const start of await starts.all()) await expect(start).toHaveAttribute("href", "/contact/site-operator");
  await expect(main.getByText("Free during the beta. Start with a video; we draft the job description from it.")).toBeVisible();
  await expect(main.getByRole("link", { name: /robot-team beta|early access/i })).toHaveCount(0);
  await expect(main.getByText("Review comparable proposals, agree the pilot with your chosen partner and measure the result against your criteria.")).toBeVisible();
});
