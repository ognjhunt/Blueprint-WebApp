import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from "@playwright/test";

test.beforeEach(mockExternalFonts);

// Bare bones (owner, 2026-11-11): one question, three steps, one button; the header is the brand and one quiet link.
test("homepage asks one question, shows three steps and offers one button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Which robot could do your job?");
  const account = page.getByRole("navigation", { name: "Account" });
  await expect(account.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  const main = page.locator("main");
  const starts = main.getByRole("link", { name: "Start a job" });
  await expect(starts).toHaveCount(1);
  await expect(starts).toHaveAttribute("href", "/contact/site-operator");
  const steps = main.getByRole("list", { name: "How it works" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(1)).toContainText("We test the top AI robots on your job");
  await expect(steps.nth(2)).toContainText("Find a company to set it up");
  await expect(main.getByRole("link", { name: "How it works ›" })).toHaveAttribute("href", "/how-it-works");
  await expect(main.getByRole("link", { name: "For robot companies ›" })).toHaveAttribute("href", "/partners");
  await expect(main.getByText("We check pick-up-and-put-down jobs. Not a test at your site, or a safety check.")).toBeVisible();
  await expect(main.getByRole("tabpanel")).toContainText("Example");
});
