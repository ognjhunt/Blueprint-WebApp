import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from "@playwright/test";

test.beforeEach(mockExternalFonts);

// Owner, 2026-11-12: the 11 Nov layout with new words. The title is the outcome, three steps, one button; the moving
// example card is back, marked as an example; no privacy sentence and no fine line on the home page.
test("homepage says the outcome, shows three steps, offers one button and the example card", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Get repetitive work done by robots.");
  const account = page.getByRole("navigation", { name: "Account" });
  await expect(account.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  const main = page.locator("main");
  await expect(main).toContainText("Film the job once. Robot deployment companies can test it on a simulation of your site and tell you if they can do it.");
  const starts = main.getByRole("link", { name: "Start a job" });
  await expect(starts).toHaveCount(1);
  await expect(starts).toHaveAttribute("href", "/contact/site-operator");
  const steps = main.getByRole("list", { name: "How it works" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps.nth(0)).toContainText("Send a video of one job that repeats.");
  await expect(steps.nth(1)).toContainText("We build a simulation of your site and send the job to robot deployment companies we approve.");
  await expect(steps.nth(2)).toContainText("Their answers come back to you: interested, can do, not a fit, or would need something. You pick who to meet.");
  await expect(main.getByRole("link", { name: "How it works ›" })).toHaveAttribute("href", "/how-it-works");
  await expect(main.getByRole("link", { name: "Deploy robots? See how jobs reach you ›" })).toHaveAttribute("href", "/partners");
  await expect(main.getByRole("tabpanel")).toContainText("Example");
  await expect(main.getByRole("tabpanel")).toContainText("Sent to 6 deployment companies");
  await expect(main).not.toContainText(/job packet|pick-up-and-put-down|safety check|contact details|which did best|top AI robots/);
});
