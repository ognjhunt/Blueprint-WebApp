import { expect, test } from "@playwright/test";

const summary = (name: string, email = "operator@example.test") => ({
  ok: true, requestId: `fixture-${name}`, alreadyClaimed: false,
  claimEmail: email, siteTermsAcceptedCurrent: false,
  site: { siteName: name, siteLocation: "Austin", taskStatement: "Pack cartons", qualificationState: "submitted" },
});

test.beforeEach(async ({ context }) => {
  // Fresh, anonymous browser context. No inherited auth or real API traffic.
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:42874") return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
    return route.continue();
  });
});

test("private claim navigation resets credentials and consent before the next summary arrives", async ({ page }, info) => {
  let releaseSecond!: () => void;
  const secondReady = new Promise<void>(resolve => { releaseSecond = resolve; });
  await page.route("**/api/site-claim/**", async route => {
    if (route.request().url().endsWith("second")) {
      await secondReady;
      return route.fulfill({ json: summary("Second site", "second@example.test") });
    }
    return route.fulfill({ json: summary("First site") });
  });
  await page.goto("/claim/first");
  await expect(page.getByRole("heading", { name: "Keep track of First site." })).toBeVisible();
  await page.getByLabel("Password", { exact: false }).fill("fixture-password");
  await page.getByRole("checkbox").check();
  // Wouter observes pushState; keep the React route mounted to exercise the
  // cross-token transition that full document navigation would hide.
  await page.evaluate(() => history.pushState({}, "", "/claim/second"));
  await expect(page.getByText("Loading…", { exact: true })).toBeVisible();
  await expect(page.getByRole("form", { name: "Claim this site" })).toHaveCount(0);
  releaseSecond();
  await expect(page.getByRole("heading", { name: "Keep track of Second site." })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: false })).toHaveValue("");
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.screenshot({ path: info.outputPath("isolated-second-claim.png"), fullPage: true });
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Keep track of First site." })).toBeVisible();
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Keep track of First site." })).toBeVisible();
});

test("mobile claim link recovers from an offline read and keeps controls accessible", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let offline = true;
  await page.route("**/api/site-claim/**", route => offline ? route.abort() : route.fulfill({ json: summary("Mobile site") }));
  await page.goto("/claim/mobile");
  const retry = page.getByRole("button", { name: "Try again" });
  await expect(retry).toBeVisible();
  offline = false;
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Keep track of Mobile site." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: /Work email/ })).toHaveValue("operator@example.test");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.screenshot({ path: info.outputPath("mobile-claim-recovery.png"), fullPage: true });
});


test("desktop handoff recognizes retained footage without claiming processing completion", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  let received = false;
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === "/api/inbound-request") return route.fulfill({ json: { captureUrl: "/capture-upload/held-fixture" } });
    if (url.pathname === "/api/site-task-brief/held-fixture/status") return route.fulfill({ json: {
      captureReceived: received,
      status: { stage: received ? "footage_received" : "awaiting_capture", headline: received ? "Your footage is retained; review is pending." : "Waiting for footage." },
    } });
    if (url.pathname === "/api/self-capture/uploads/held-fixture/status") return route.fulfill({ json: {
      captureReceived: true, state: "held", detail: "Your video is retained. Recording permission needs review.",
    } });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.clock.install();
  await page.goto("/contact/site-operator");
  await page.locator("#start-task").fill("Move cartons to the pallet");
  await page.locator("#start-location").fill("Austin, TX");
  await page.locator("#start-email").fill("operator@example.test");
  await page.locator("#start-company").fill("Fixture site");
  await page.getByRole("button", { name: "Start free assessment" }).click();
  await expect(page.getByRole("heading", { name: "Your job description is saved." })).toBeVisible();
  received = true;
  await page.clock.fastForward(6000);
  await expect(page.getByRole("heading", { name: "Your recording is in." })).toBeVisible();
  await expect(page.getByText("Your video is retained. Recording permission needs review.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Review your job brief" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the camera" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry processing" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("desktop-held-footage.png"), fullPage: true });
});
