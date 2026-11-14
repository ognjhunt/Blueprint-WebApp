import { mockExternalFonts } from "./helpers/static-assets";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(mockExternalFonts);

// Every submission is intercepted. These tests never send an inquiry or email.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(pathname === "/api/csrf" ? { csrfToken: "local-review-token" } : { ok: true }) });
  });
});

test("the Terms and Privacy Policy link to the previous versions, which stay published", async ({ page }) => {
  for (const [path, previous, heading] of [["/terms", "/terms/previous", "Terms of Service"], ["/privacy", "/privacy/previous", "Privacy Policy"]]) {
    await page.goto(path);
    const link = page.locator("article").getByRole("link", { name: "previous version" });
    await expect(link).toHaveAttribute("href", previous);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${previous}$`));
    await expect(page.locator(".minimal-site h1")).toHaveText(heading);
    await expect(page.getByText(/^Previous version, effective/)).toBeVisible();
  }
});

// Bare bones (2026-11-11): no menu; the page's own quiet links lead on, and the steps are visible without a click.
test("on a phone the steps are visible without a click and How it works is one quiet link away", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Open menu" })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "How it works" })).toBeVisible();
  await page.getByRole("link", { name: "How it works ›" }).click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  await expect(page.locator("h1")).toHaveText("How it works");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("old marketing links resolve to the minimal website without losing source context", async ({ page }) => {
  for (const [from, to] of [["/for-robot-teams", "/contact/robot-team"], ["/vision", "/"], ["/governance", "/privacy"]]) {
    await page.goto(`${from}?source=legacy-review`);
    await expect(page).toHaveURL(new RegExp(`${to.replaceAll("/", "\\/")}\\?source=legacy-review`));
    await expect(page.locator(".minimal-site h1")).toBeVisible();
  }
  await page.goto("/contact");
  await expect(page).toHaveURL(/\/contact\/site-operator/);
});

test("the site page is the start form alone, on a phone too", async ({ page }) => {
  for (const viewport of [{ width: 1536, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/contact/site-operator");
    await expect(page.getByRole("form", { name: "Start a site capture" })).toBeVisible();
    await expect(page.getByText("How this works", { exact: true })).toHaveCount(0);
    await expect(page.locator("#gate-sceneStability")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send inquiry" })).toHaveCount(0);
  }
});

test("old pricing reaches the free beta page with one CTA", async ({ page }) => {
  await page.goto("/pricing?source=legacy-review#scope");
  await expect(page).toHaveURL(/\/beta\?source=legacy-review#scope$/);
  await expect(page.locator("h1")).toHaveText("Questions");
  await expect(page.locator("main")).toContainText("Free for sites.");
  await expect(page.getByText("You agree any work and its terms with the company directly.")).toBeVisible();
  await expect(page.locator("main .bare-button")).toHaveCount(1);
  await expect(page.locator("main").getByRole("link", { name: "Start a job" })).toHaveAttribute("href", "/contact/site-operator?source=beta");
  await expect(page.locator("main")).not.toContainText("$2,500");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://tryblueprint.io/beta");
});
