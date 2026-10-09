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

for (const viewport of [{ width: 1536, height: 1024 }, { width: 390, height: 844 }]) {
  test(`all public pages share the approved theme at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });
    for (const [name, path, heading] of [
      ["home", "/", "Could a robot take over a repetitive task at your site?"],
      ["how", "/how-it-works", "Start with your task."],
      ["beta", "/beta", "Start with one real task."],
      ["site", "/contact/site-operator", "Start with one task."],
      ["robot", "/contact/robot-team", "Test your robot on real site jobs."],
      ["privacy", "/privacy", "Privacy Policy"],
      ["terms", "/terms", "Terms of Service"],
      ["not-found", "/this-page-does-not-exist", "That page isn’t here."],
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toContainText(heading);
      await expect(page.locator(".minimal-site")).toHaveCSS("background-color", "rgb(246, 245, 239)");
      await expect(page.getByRole("link", { name: "Blueprint home" })).toHaveCSS("color", "rgb(34, 37, 30)");
      await expect(page.locator(".ms-footer")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const image of await page.locator('img[loading="lazy"]').all()) {
        await image.scrollIntoViewIfNeeded();
      }
      await expect.poll(() => page.locator("img").evaluateAll((images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.src))).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: `output/site-led-review/${name}-${viewport.width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}

test("mobile navigation works and the method steps are visible without a click", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open menu" }).click();
  const nav = page.getByRole("navigation", { name: "Mobile navigation" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Beta program" })).toHaveAttribute("href", "/beta");
  await nav.getByRole("link", { name: "How it works" }).focus();
  await page.keyboard.press("Escape");
  await expect(nav).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "How it works" }).click();
  await expect(page).toHaveURL(/\/how-it-works$/);
  await expect(page.locator("h1")).toContainText("Start with your task.");
  await page.goto("/");
  await expect(page.getByText("Any later work has a separately agreed scope and cost.")).toBeVisible();
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

test("the site page puts the capture form before the explanation, on a phone too", async ({ page }) => {
  for (const viewport of [{ width: 1536, height: 1024 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/contact/site-operator");
    const form = page.getByRole("form", { name: "Start a site capture" });
    await expect(form).toBeVisible();
    const how = page.getByText("How this works", { exact: true });
    await expect(how).toBeVisible();
    // Form above the disclosure, and the disclosure closed.
    // Prerendered markup is replaced during hydration; wait for both boxes
    // in the same poll instead of reading across that replacement.
    await expect.poll(async () => {
      const formBox = await form.boundingBox();
      const howBox = await how.boundingBox();
      return formBox !== null && howBox !== null && formBox.y < howBox.y;
    }).toBe(true);
    expect(await how.evaluate((node) => (node.closest("details") as HTMLDetailsElement).open)).toBe(false);
    // Nothing from the old screen.
    await expect(page.locator("#gate-sceneStability")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Send inquiry" })).toHaveCount(0);
  }
});

test("old pricing reaches the beta page with one CTA and separately agreed later work", async ({ page }) => {
  await page.goto("/pricing?source=legacy-review#scope");
  await expect(page).toHaveURL(/\/beta\?source=legacy-review#scope$/);
  await expect(page.locator("h1")).toHaveText("Start with one real task.");
  await expect(page.getByText(/The initial assessment is free during the beta/)).toBeVisible();
  await expect(page.getByText(/Any later evaluation, integration, or physical pilot/)).toBeVisible();
  await expect(page.locator("article .ms-button")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Discuss a task" })).toHaveAttribute("href", "/contact/site-operator?source=beta");
  await expect(page.locator("article")).not.toContainText("$2,500");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://tryblueprint.io/beta");
});
