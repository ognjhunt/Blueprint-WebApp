import { expect, test } from "@playwright/test";
import { mockExternalFonts } from "./helpers/static-assets";

test.beforeEach(mockExternalFonts);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: {
    items: [], access: { gated: true, status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false },
  } }));
});

test("How it works opens its own page from desktop and mobile navigation", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (width === 390) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: width === 390 ? "Mobile navigation" : "Main navigation", exact: true }).getByRole("link", { name: "How it works" }).click();
    await expect(page).toHaveURL(/\/how-it-works$/);
    await expect(page.locator("h1")).toContainText("Start with your task.");
    await expect(page.getByRole("heading", { name: "One task, from phone video to a pilot." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("the example recommended pilot sits below the headline without overflowing", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator(".ms-pilot-card");
    await expect(card.getByRole("tabpanel")).toContainText("Example");
    await expect(card).toContainText("Book this pilot");
    await expect(page.locator(".ms-task-pair")).toHaveCount(0);
    const layout = await page.evaluate(() => ({
      headlineBottom: document.querySelector("h1")!.getBoundingClientRect().bottom,
      cardTop: document.querySelector(".ms-pilot-card")!.getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(layout.overflow).toBe(false);
    expect(layout.headlineBottom).toBeLessThan(layout.cardTop);
  }
});

test("both audience actions lead to their working intake and the beta action reaches the application", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator(".ms-task-hero");
  await hero.getByRole("link", { name: "Show us a task" }).click();
  await expect(page.getByRole("form", { name: "Start a site capture" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "For robot teams" }).click();
  await expect(page.locator("h1")).toHaveText("Test your robot on real site jobs.");
  await expect(page.getByRole("img", { name: /Illustration: a humanoid lifts a tote/ })).toBeVisible();
  await page.getByRole("link", { name: "Register interest", exact: true }).click();
  await expect(page).toHaveURL(/#robot-team-access$/);
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Ada");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Ada");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
