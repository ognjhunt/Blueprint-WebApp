import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from "@playwright/test";

test.beforeEach(mockExternalFonts);

// The frame of 2026-11-12: one sentence, three steps, one button; the header is the brand and one quiet link. The
// animated example of an invented result is removed, not replaced.
test("homepage says what happens to a video in one sentence, shows three steps and offers one button", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Film a job once. We turn it into a job packet robot deployment companies can judge.");
  const account = page.getByRole("navigation", { name: "Account" });
  await expect(account.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  const main = page.locator("main");
  const starts = main.getByRole("link", { name: "Start a job" });
  await expect(starts).toHaveCount(1);
  await expect(starts).toHaveAttribute("href", "/contact/site-operator");
  const steps = main.getByRole("list", { name: "How it works" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(1)).toContainText("We turn it into a job packet: what the job is, a first look at which robots could fit, and a simulation of your site.");
  await expect(steps.nth(2)).toContainText("With your permission, we share a summary of it with robot deployment companies we approve. Your video stays private.");
  await expect(main.getByRole("link", { name: "How it works ›" })).toHaveAttribute("href", "/how-it-works");
  await expect(main.getByRole("link", { name: "Deploy robots? See how jobs reach you ›" })).toHaveAttribute("href", "/partners");
  await expect(main.getByText("We take pick-up-and-put-down jobs best. Nothing here is a test at your site or a safety check.")).toBeVisible();
  await expect(main.getByRole("tabpanel")).toHaveCount(0);
  await expect(main).not.toContainText(/which did best|top AI robots|Example/);
});
