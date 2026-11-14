import { devices, expect, test } from "@playwright/test";
import { bareRhythmFindings } from "./helpers/bare-rhythm";

// The same rhythm with an email refusal shown under its field (owner, 2026-11-11): the sentence sits 8 px under the
// field's helper line, and nothing else moves closer than 8 px.
test("keeps the bare-bones rhythm on a phone with an email error under its field", async ({ browser }) => {
  const { defaultBrowserType: _, ...phone } = devices["iPhone 14"];
  const context = await browser.newContext({ ...phone, viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  const posts: string[] = [];
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/**", route => { if (route.request().method() === "POST") posts.push(route.request().url());
    return route.fulfill({ json: { items: [], csrfToken: "fixture" } }); });
  await page.goto("/contact/site-operator");
  await page.locator("#start-email").waitFor();
  await page.locator("#start-location").fill("Austin, TX");
  await page.getByRole("button", { name: "Next: film the job" }).click();
  await page.locator("#start-region").selectOption("us");
  await page.locator("#start-email").fill("yeet@mailinator.com");
  await page.getByRole("button", { name: "Next: film the job" }).click();
  await expect(page.locator("#start-email-error")).toHaveText("We can't send to a temporary email address. Use one you check.");
  expect(posts.filter(url => url.includes("/api/inbound-request"))).toEqual([]);
  const found = await bareRhythmFindings(page, ".bare-start-form .bare-screen");
  expect(found.tight, "blocks of different kinds closer than 8 px").toEqual([]);
  expect(found.centred, "centred text other than a control's own label").toEqual([]);
  await context.close();
});
