import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("blueprint_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false })));
});

for (const width of [1440, 390]) {
  test(`auth routes share the minimal theme at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const [path, heading] of [["/sign-in", "Sign in"], ["/signup/business", "Create an account"], ["/signup/business?buyerType=site_operator", "Create an account"], ["/signup/capturer", "Create your account"], ["/forgot-password", "Reset your password"]]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
      await expect(page.locator(".auth-shell")).toHaveCSS("background-color", "rgb(246, 245, 239)");
      await expect(page.getByRole("link", { name: "Blueprint home" })).toHaveCount(1);
      await expect(page.locator("#main-content")).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByText(/Access Control Suite|Why Exact-Site Context Matters|Secure Access Portal/)).toHaveCount(0);
      if (width === 1440) await expect(page.locator(".auth-art img")).toBeVisible();
    }
  });
}

test("sign-in validates and links to account creation and recovery", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Email is required", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByRole("link", { name: "Back to sign in" }).click();
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup\/business$/);
  await expect(page.getByRole("heading", { name: "Create an account", exact: true })).toBeVisible();
});
