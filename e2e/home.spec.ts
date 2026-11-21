import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from "@playwright/test";

test.beforeEach(mockExternalFonts);

test("homepage explains the offer and shows both paths and a labeled example", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Post a job for robots.");
  const account = page.getByRole("navigation", { name: "Account" });
  await expect(account.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
  const main = page.locator("main");
  await expect(main).toContainText("Film one repetitive job. We turn it into a job packet and a simulation of your site, so approved robot deployment companies can review it without a visit.");
  const starts = main.getByRole("link", { name: "Start a job" });
  await expect(starts).toHaveCount(1);
  await expect(starts).toHaveAttribute("href", "/contact/site-operator");
  const steps = main.getByRole("list", { name: "How it works" }).getByRole("listitem");
  await expect(steps).toHaveCount(3);
  await expect(steps).toHaveText(["Film the job", "Companies review it", "Choose who to meet"]);
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await expect(nav.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/how-it-works");
  await expect(nav.getByRole("link", { name: "Find jobs" })).toHaveAttribute("href", "/jobs");
  await expect(main.getByRole("region", { name: "Example job" })).toBeVisible();
  await expect(main.getByRole("tabpanel")).toContainText("6 views");
  await expect(main).not.toContainText(/pick-up-and-put-down|safety check|contact details|which did best|top AI robots/);
});
