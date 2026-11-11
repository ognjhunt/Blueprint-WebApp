import { devices, expect, test } from "@playwright/test";
import { bareRhythmFindings } from "./helpers/bare-rhythm";

/**
 * The bare-bones rhythm on the public screens a site meets first, on a phone: the start form's first screen and the
 * robot-team sign-up. Every API is answered in the browser; nothing leaves the machine.
 */
const SCREENS = [
  { name: "the start form's first screen", path: "/contact/site-operator", root: ".bare-start-form .bare-screen", ready: "#start-email" },
  { name: "robot-team sign-up", path: "/signup/business?buyerType=robot_team", root: ".auth-content", ready: "h1:has-text(\"Access by invitation\")" },
];

for (const screen of SCREENS) {
  test(`keeps the bare-bones rhythm on a phone: ${screen.name}`, async ({ browser }) => {
    const { defaultBrowserType: _, ...phone } = devices["iPhone 14"];
    const context = await browser.newContext({ ...phone, viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const page = await context.newPage();
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.fulfill({ status: 204, body: "" }));
    await page.route("**/api/**", route => route.fulfill({ json: { items: [], access: { gated: true, status: "none", signedIn: false, emailVerified: false,
      allowed: false, staff: false }, csrfToken: "fixture" } }));
    await page.goto(screen.path);
    await page.locator(screen.ready).first().waitFor();
    // Measured once the screen has settled: the root is visible and its button is in place.
    await page.locator(`${screen.root} ${screen.path.startsWith("/contact") ? ".bare-button" : ".auth-primary"}`).first().waitFor();
    if (screen.path.startsWith("/contact")) {
      // First load: where the job is and the email, with no country select until it is needed.
      await expect(page.locator("#start-region")).toHaveCount(0);
      await expect(page.locator("#start-location")).toHaveAttribute("placeholder", "Street address or city");
    }
    const found = await bareRhythmFindings(page, screen.root);
    expect(found.blocks, JSON.stringify(found)).toBeGreaterThanOrEqual(3);
    expect(found.tight, "blocks of different kinds closer than 8 px").toEqual([]);
    expect(found.centred, "centred text other than a control's own label").toEqual([]);
    await context.close();
  });
}
