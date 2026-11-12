import { expect, test } from "@playwright/test";
import { mockExternalFonts } from "./helpers/static-assets";

test.beforeEach(mockExternalFonts);

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: {
    items: [], access: { gated: true, status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false },
  } }));
});

// How it works lists the video, the job packet, deployment companies and the early trial, one quiet link from home.
test("How it works opens its own page from the home page's quiet link", async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.getByRole("link", { name: "How it works ›" }).click();
    await expect(page).toHaveURL(/\/how-it-works$/);
    await expect(page.locator("h1")).toHaveText("How it works");
    await expect(page.getByRole("list", { name: "Steps" }).getByRole("listitem")).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

// The moving example card is back where it was (owner, 2026-11-12: "can we add it back in where we had it?"), marked as
// an example: beside the text on a desktop, below the button on a phone.
test("the example card sits beside the text on a desktop and below the button on a phone, without overflowing", async ({ page }) => {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const card = page.getByRole("region", { name: "Example of a job page once deployment companies answer" });
    await expect(card.getByRole("tabpanel")).toContainText("Example");
    await expect(card).toContainText("Everything in this example is made up.");
    await expect(card.getByRole("tab", { name: "Warehouse", exact: true })).toHaveAttribute("aria-selected", "true");
    const examples = [
      ["Warehouse", "Humanoid robot"], ["Café", "Fixed robot arm"], ["Laundromat", "Wheeled humanoid"],
      ["Factory", "Mobile manipulator"], ["Hotel", "Mobile robot"], ["Lab", "Fixed robot arm"],
    ];
    await expect(card.getByRole("tab")).toHaveText(examples.map(([site]) => site));
    for (const [site, embodiment] of examples) {
      await card.getByRole("tab", { name: site, exact: true }).click();
      await expect(card.getByRole("tabpanel", { name: site, exact: true })).toContainText(/Example.*Sent to \d deployment companies/);
      await expect(page.getByRole("img", { name: `Illustration of the ${site.toLowerCase()} example: ${embodiment.toLowerCase()}`, exact: true })).toBeVisible();
    }
    const layout = await page.evaluate(() => ({
      button: document.querySelector(".bare-home .bare-button")!.getBoundingClientRect(),
      steps: document.querySelector(".bare-home .bare-steps")!.getBoundingClientRect(),
      card: document.querySelector(".bare-example")!.getBoundingClientRect(),
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(layout.overflow).toBe(false);
    if (width >= 960) expect(layout.card.left).toBeGreaterThan(Math.max(layout.button.right, layout.steps.right));
    else expect(layout.card.top).toBeGreaterThan(layout.button.bottom);
  }
});

test("both audience actions lead to their working intake and the company landing reaches the application", async ({ page }) => {
  await page.goto("/");
  await page.locator("main").getByRole("link", { name: "Start a job" }).click();
  await expect(page.getByRole("form", { name: "Start a site capture" })).toBeVisible();
  await page.goto("/");
  await page.getByRole("link", { name: "Deploy robots? See how jobs reach you ›" }).click();
  await expect(page).toHaveURL(/\/partners$/);
  await expect(page.locator("h1")).toHaveText("Real jobs from real sites.");
  // The application form is on the page itself (folded in from the old /partners/deployment page).
  await expect(page.getByRole("form", { name: "Deployment company application" })).toBeVisible();
  await expect(page.getByLabel("Your name", { exact: true })).toBeVisible();
  await page.getByLabel("Your name", { exact: true }).fill("Ada");
  await expect(page.getByLabel("Your name", { exact: true })).toHaveValue("Ada");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
