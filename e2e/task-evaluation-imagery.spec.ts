import { expect, test } from "@playwright/test";
import { mockExternalFonts } from "./helpers/static-assets";

test.beforeEach(mockExternalFonts);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: {
    items: [], access: { gated: true, status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false },
  } }));
});

// Bare bones (owner, 2026-11-11): How it works is three steps, one quiet link from home.
test("How it works opens its own page from the home page's quiet link", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("link", { name: "How it works ›" }).click();
    await expect(page).toHaveURL(/\/how-it-works$/);
    await expect(page.locator("h1")).toHaveText("How it works");
    await expect(page.getByRole("list", { name: "Steps" }).getByRole("listitem")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

// The moving example stays (owner, 2026-11-11), drawn as a small answer screen and marked as an example: beside the
// text on a desktop, below the button on a phone.
test("the example answer sits beside the text on a desktop and below the button on a phone, without overflowing", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator(".bare-example");
    await expect(card.getByRole("tabpanel")).toContainText("Example");
    await expect(card).toContainText("The names, jobs and results are made up.");
    await expect(card.getByRole("tab", { name: "Packaging", exact: true })).toHaveAttribute("aria-selected", "true");
    const examples = [
      ["Packaging", "Fixed robot arm"], ["Warehouse", "Humanoid robot"], ["Café", "Fixed robot arm"],
      ["Laundromat", "Wheeled humanoid"], ["Factory", "Mobile manipulator"], ["Lab", "Fixed robot arm"],
    ];
    await expect(card.getByRole("tab")).toHaveText(examples.map(([site]) => site));
    for (const [site, embodiment] of examples) {
      await card.getByRole("tab", { name: site, exact: true }).click();
      await expect(card.getByRole("tabpanel", { name: site, exact: true })).toBeVisible();
      await expect(page.getByRole("img", { name: `Illustration of the ${site.toLowerCase()} example: ${embodiment.toLowerCase()}`, exact: true })).toBeVisible();
    }
    const layout = await page.evaluate(() => ({
      button: document.querySelector(".bare-home .bare-button")!.getBoundingClientRect(),
      card: document.querySelector(".bare-example")!.getBoundingClientRect(),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(layout.overflow).toBe(false);
    if (width >= 960) expect(layout.card.left).toBeGreaterThan(layout.button.right);
    else expect(layout.card.top).toBeGreaterThan(layout.button.bottom);
  }
});

test("both audience actions lead to their working intake and the company landing reaches the application", async ({ page }) => {
  await page.goto("/");
  await page.locator("main").getByRole("link", { name: "Start a job" }).click();
  await expect(page.getByRole("form", { name: "Start a site capture" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "For robot companies ›" }).click();
  await expect(page.locator("h1")).toHaveText("See jobs that sites choose to share.");
  await page.getByRole("link", { name: "Apply to see jobs" }).click();
  await expect(page).toHaveURL(/\/contact\/robot-team$/);
  await expect(page.locator("h1")).toHaveText("Apply to see jobs");
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Ada");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Ada");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
