import { test, expect } from "@playwright/test";
import { seedCookieConsent } from "./helpers/cookie-consent";
import { mockExternalFonts } from "./helpers/static-assets";

test.beforeEach(async ({ page }) => {
  await seedCookieConsent({ page });
  await mockExternalFonts({ page });
  await page.route("**/api/csrf", route => route.fulfill({ json: { csrfToken: "e2e-safe-token" } }));
  await page.route("https://photon.komoot.io/**", route => route.fulfill({ json: { features: [] } }));
  await page.route("**/api/site-worlds/tasks", route => route.fulfill({ json: { items: [], access: { gated: true, status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false } } }));
});

test("prerendered intake stays inactive while its scripts are unavailable", async ({ page }) => {
  test.skip(process.env.BLUEPRINT_E2E_STATIC !== "1", "Requires the production prerendered HTML.");
  const intakeRequests: string[] = [];
  page.on("request", request => { if (/\/api\/(?:inbound-request|workspace\/capture-start|self-capture\/uploads)/.test(request.url())) intakeRequests.push(request.method()); });
  await page.route("**/*", route => route.request().resourceType() === "script"
    ? route.abort()
    : route.continue());
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });
  // Browser-local recovery is unavailable without scripts; preserve inactivity
  // rather than render a fresh, uncontrolled intake identity.
  await expect(page.getByRole("status")).toHaveText(/Loading your account and saved draft/);
  await expect(page.getByRole("form", { name: "Start a site capture" })).toHaveCount(0);
  await expect(page.locator("#start-email")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start free assessment", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", {name: /talk to a person/i})).toHaveAttribute("href", /^mailto:/);
  expect(intakeRequests).toEqual([]);
  await expect(page).toHaveURL(/\/contact\/site-operator$/);
});

test("phone: the first task field is on the first screen and the explanation stays closed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });
  const field = page.locator("#start-task");
  await expect(field).toBeVisible();
  await expect(field).toBeEnabled();
  await expect.poll(async () => {
    const box = await field.boundingBox();
    return box ? box.y + box.height : Infinity;
  }).toBeLessThan(844);
  await expect(page.locator("details").filter({ hasText: "How this works" })).not.toHaveAttribute("open");
  await expect(page.locator("#gate-sceneStability")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/onboarding-p2-site-phone.png", fullPage: true });
});

test("capture takes the country from the address, asks only when it cannot, and keeps consent explicit", async ({ page }) => {
  const submissions: any[] = [];
  await page.route("**/api/inbound-request", route => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ status: 202, json: { ok: true, requestId: "captured", captureUrl: null } });
  });
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });
  await page.locator("#start-task").fill("Move cartons onto a pallet");
  await page.locator("#start-location").fill("Berlin");
  await page.locator("#start-email").fill("owner@example.test");
  await page.locator("#start-company").fill("Acme Foods");
  await page.locator("#start-rights").check();
  // A city alone does not name its country, so Start asks for it in the address.
  await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
  await expect(page.getByText(/Add the country to the address/)).toBeVisible();
  await expect(page.locator("#start-location")).toBeFocused();
  await expect(page.locator("#start-region")).toHaveCount(0);
  expect(submissions).toHaveLength(0);
  await page.locator("#start-location").fill("Berlin, Germany");
  await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toMatchObject({ buyerType: "site_operator", captureRegion: "non_us", siteTaskGates: {}, consentAttestation: { granted: true, statementVersion: "2026-09-18.v1" } });
  await expect(page.getByText(/We are not sending a camera link yet/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the camera" })).toHaveCount(0);
});

test("robot teams can apply before approval without seeing private jobs", async ({ page }) => {
  await page.goto("/contact/robot-team");
  await expect(page.getByRole("form", { name: "Early access application" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Register interest", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Job library" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Operate a site/ })).toBeVisible();
});

test("the retired duplicate intake joins the capture flow and preserves context", async ({ page }) => {
  await page.goto("/app/tasks/new?source=workspace");
  await expect(page).toHaveURL(/\/contact\/site-operator\?source=workspace/);
  await expect(page.locator("#start-task")).toBeVisible();
});
