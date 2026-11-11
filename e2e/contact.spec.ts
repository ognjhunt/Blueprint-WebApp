import { test, expect } from "@playwright/test";
import { seedCookieConsent } from "./helpers/cookie-consent";
import { mockExternalFonts } from "./helpers/static-assets";

/** The optional sentence: typing it confirms the brief (owner direction 2026-11-11). */
async function describeTask(page: import("@playwright/test").Page) {
  await page.locator("#start-task").fill("Pick up each packed carton and place it at the end of the table");
}

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

test("phone: video capture choices are on the first screen and optional details stay closed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });
  const field = page.getByRole("radio", { name: "Upload a video now", exact: true });
  await expect(field).toBeVisible();
  await expect(field).toBeEnabled();
  await expect.poll(async () => {
    const box = await field.boundingBox();
    return box ? box.y + box.height : Infinity;
  }).toBeLessThan(844);
  await expect(page.locator("details").filter({ hasText: "How this works" })).not.toHaveAttribute("open");
  await expect(page.locator("details").filter({ hasText: "Add job details and buying plans (optional)" })).not.toHaveAttribute("open");
  await expect(page.locator("#gate-sceneStability")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/onboarding-p2-site-phone.png", fullPage: true });
});

test("capture accepts country permission without an address and keeps non-US filming held", async ({ page }) => {
  const submissions: any[] = [];
  await page.route("**/api/inbound-request", route => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ status: 202, json: { ok: true, requestId: "captured", captureUrl: null } });
  });
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });
  await describeTask(page);
  await page.locator("#start-location").fill("Berlin");
  await page.locator("#start-email").fill("owner@example.test");
  // An ambiguous optional city cannot supply permission. Native country
  // validation stops the request without requiring a fuller address.
  await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
  await expect(page.locator("#start-region")).toBeFocused();
  await expect(page.locator("#start-region")).toHaveValue("");
  await expect(page.locator("#start-location")).not.toHaveAttribute("required", "");
  expect(submissions).toHaveLength(0);
  await page.locator("#start-location").fill("");
  await page.locator("#start-region").selectOption("non_us");
  await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toMatchObject({ buyerType: "site_operator", siteLocation: "", captureRegion: "non_us", siteTaskGates: {}, consentAttestation: null,
    taskConfirmation: { granted: true, statementVersion: "2026-11-07.v1" } });
  await expect(page.getByText(/We are not sending a camera link yet/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the camera" })).toHaveCount(0);
});

test("starting with footage quotes the recording-rights sentence next to the button and records v2", async ({ page }) => {
  const rights = "I am authorized to record this site and to let Blueprint use the recording to draft the job brief, "
    + "build a simulation of the work area and run candidate robot policies in it.";
  const submissions: any[] = [];
  await page.route("**/api/inbound-request", route => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ status: 202, json: { ok: true, requestId: "captured", captureUrl: null } });
  });
  await page.goto("/contact/site-operator", { waitUntil: "domcontentloaded" });
  const start = page.getByRole("button", { name: "Start free assessment", exact: true });
  await expect(start).toBeEnabled();
  // Filming later grants nothing on this form, so nothing is quoted.
  await expect(page.getByRole("radio", { name: "Film it on a phone · Right after this form", exact: true })).toBeChecked();
  await expect(page.getByText(rights, { exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Upload a video now", exact: true }).check();
  // Starting with footage is the grant: no separate box, the sentence itself
  // is quoted in the note right above the Start button.
  const statement = page.getByText(rights, { exact: true });
  await expect(statement).toBeVisible();
  await expect(page.locator("#start-rights")).toHaveCount(0);
  await expect(page.locator("p", { has: statement })).toContainText("By selecting Start free assessment, you agree to our Terms and Privacy Policy and confirm:");
  await page.locator("#start-region").selectOption("us");
  await page.locator("#start-footage").setInputFiles({ name: "cycle.mov", mimeType: "video/quicktime", buffer: Buffer.from("frames") });
  await page.locator("#start-email").fill("owner@example.test");
  await describeTask(page);
  await start.click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toMatchObject({ captureRegion: "us", hasExistingFootage: true, descriptionOnly: false,
    consentAttestation: { granted: true, statementVersion: "2026-11-02.v2" } });
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
  await expect(page.getByRole("group", { name: "How will we see the task?", exact: true })).toBeVisible();
});
