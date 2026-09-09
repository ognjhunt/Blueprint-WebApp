import { expect, test } from "@playwright/test";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Show mobile manipulator", exact: true })).toBeEnabled();
  await expect(page.locator(".ms-rotating-hero")).toHaveAttribute("data-scene", "arm");
}

test("How it works opens its own page from desktop and mobile navigation", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (width === 390) await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: width === 390 ? "Mobile navigation" : "Main navigation", exact: true }).getByRole("link", { name: "How it works" }).click();
    await expect(page).toHaveURL(/\/how-it-works$/);
    await expect(page.locator("h1")).toContainText("Find the right fit.");
    await expect(page.getByRole("heading", { name: "Compare the candidates." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("all four manipulation scenes are selectable without layout shifts", async ({ page }) => {
  await ready(page);
  await page.evaluate(() => document.fonts.ready);
  const position = () => page.locator("h1").evaluate((element) => { const rect = element.getBoundingClientRect(); return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height }; });
  const before = await position();
  for (const [label, id] of [["humanoid", "humanoid"], ["wheeled humanoid", "wheeled-humanoid"], ["mobile manipulator", "mobile-manipulator"], ["fixed arm", "arm"]]) {
    await page.getByRole("button", { name: `Show ${label}`, exact: true }).click();
    await expect(page.locator(".ms-rotating-hero")).toHaveAttribute("data-scene", id);
    await expect(page.getByRole("button", { name: `Show ${label}`, exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(await position()).toEqual(before);
  }
  await expect(page.getByRole("button", { name: /quadruped|inspection/i })).toHaveCount(0);
});

test("rotation advances automatically and honors the pause button", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await page.clock.install();
  // Restart the timer under the controllable clock without relying on network timing.
  await page.getByRole("button", { name: "Pause scene rotation" }).click();
  await page.getByRole("button", { name: "Play scene rotation" }).click();
  await page.clock.fastForward(7000);
  await expect(page.locator(".ms-rotating-hero")).toHaveAttribute("data-scene", "humanoid");
  await page.getByRole("button", { name: "Pause scene rotation" }).click();
  await page.getByRole("link", { name: "Blueprint home" }).focus();
  await page.clock.fastForward(15000);
  await expect(page.locator(".ms-rotating-hero")).toHaveAttribute("data-scene", "humanoid");
});

test("reduced motion stays static while manual controls still work", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page.clock.install();
  await page.clock.fastForward(20000);
  await expect(page.locator(".ms-rotating-hero")).toHaveAttribute("data-scene", "arm");
  await expect(page.getByRole("button", { name: /scene rotation/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Show mobile manipulator", exact: true }).click();
  await expect(page.locator(".ms-rotating-hero")).toHaveAttribute("data-scene", "mobile-manipulator");
  await expect(page.locator(".ms-scene-art.is-active")).toHaveCSS("transition-duration", "0s");
});

test("mobile scenes and controls stay within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await page.getByRole("button", { name: "Show mobile manipulator", exact: true }).click();
  await expect(page.locator(".ms-scene-controls")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
