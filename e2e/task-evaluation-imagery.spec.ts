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
    await expect(page.locator("h1")).toContainText("From one job to a measured pilot.");
    await expect(page.getByRole("heading", { name: "One task, from phone video to a pilot." })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("the full task and simulation frames remain readable without overlapping the headline", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const images = page.locator(".ms-task-pair img");
    await expect(images).toHaveCount(2);
    for (const image of await images.all()) {
      await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
      const frame = await image.evaluate((element: HTMLImageElement) => {
        const rect = element.getBoundingClientRect();
        return { ratio: rect.width / rect.height, originalRatio: Number(element.getAttribute("width")) / Number(element.getAttribute("height")), height: rect.height, fit: getComputedStyle(element).objectFit };
      });
      expect(frame.ratio).toBeCloseTo(frame.originalRatio, 2);
      expect(frame.height).toBeGreaterThan(150);
      expect(frame.fit).not.toBe("cover");
    }
    const layout = await page.evaluate(() => {
      const [capture, evaluation] = [...document.querySelectorAll(".ms-task-pair img")].map(element => element.getBoundingClientRect());
      const headline = document.querySelector("h1")!.getBoundingClientRect();
      return { captureX: capture.x, captureY: capture.y, captureRight: capture.right, captureBottom: capture.bottom, evaluationX: evaluation.x, evaluationY: evaluation.y, headlineBottom: headline.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(layout.overflow).toBe(false);
    expect(layout.headlineBottom).toBeLessThan(layout.captureY);
    if (width > 700) {
      expect(layout.evaluationY).toBeCloseTo(layout.captureY);
      expect(layout.evaluationX).toBeGreaterThan(layout.captureRight);
    } else {
      expect(layout.evaluationX).toBeCloseTo(layout.captureX);
      expect(layout.evaluationY).toBeGreaterThan(layout.captureBottom);
    }
  }
});

test("both audience actions lead to their working intake and the beta action reaches the application", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator(".ms-task-hero");
  await hero.getByRole("link", { name: "Start a job assessment" }).click();
  await expect(page.getByRole("form", { name: "Start a site capture" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "For robot teams" }).click();
  await expect(page.locator("h1")).toHaveText("Test your robot on real site jobs.");
  await expect(page.getByRole("img", { name: /Illustrative simulation view: a humanoid/ })).toBeVisible();
  await page.getByRole("link", { name: "Join the robot-team beta" }).click();
  await expect(page).toHaveURL(/#robot-team-access$/);
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Ada");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Ada");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
