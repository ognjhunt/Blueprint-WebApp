import { mockExternalFonts } from "./helpers/static-assets";
import { test, expect } from "@playwright/test";

test.beforeEach(mockExternalFonts);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("blueprint_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false })));
});

test("the auth robot scene moves on to the next example after one loop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/sign-in");
  const scene = page.locator(".auth-art .robot-scene > svg");
  await expect(scene).toHaveAttribute("aria-label", "Illustration of the warehouse example: humanoid robot");
  await expect(scene).toHaveAttribute("aria-label", /Illustration of the café example/, { timeout: 20_000 });
});

test("the auth robot scene can be paused and played again", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/sign-in");
  const pause = page.locator(".auth-art").getByRole("button", { name: "Pause robot animation" });
  await expect(pause).toBeVisible();
  await pause.click();
  const play = page.locator(".auth-art").getByRole("button", { name: "Play robot animation" });
  await expect(play).toBeVisible();
  await play.click();
  await expect(page.locator(".auth-art").getByRole("button", { name: "Pause robot animation" })).toBeVisible();
});

test("sign-in validates and links to account creation and recovery", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Email is required", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await page.getByRole("link", { name: "Start a job" }).click();
  await expect(page).toHaveURL(/\/contact\/site-operator/);
  await expect(page.getByRole("heading", { level: 1, name: "Start a job" })).toBeVisible();
});
