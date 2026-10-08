import { expect, test } from "@playwright/test";
import { copyFileSync } from "node:fs";
import path from "node:path";

const summary = (name: string, email = "operator@example.test") => ({
  ok: true, requestId: `fixture-${name}`, alreadyClaimed: false,
  claimEmail: email, siteTermsAcceptedCurrent: false,
  site: { siteName: name, siteLocation: "Austin", taskStatement: "Pack cartons", qualificationState: "submitted" },
});

test("owner can request an authorized assessment retry while keeping the saved recording", async ({ page }) => {
  const token = "advisory-retry-fixture";
  const jobId = `advisory-${"a".repeat(64)}`, originalRun = `site-assessment-${"b".repeat(64)}`, newRun = `site-assessment-${"c".repeat(64)}`;
  let queued = false;
  let releaseFirst!: () => void;
  const firstResponse = new Promise<void>(resolve => { releaseFirst = resolve; });
  const retries: Array<{ expected_job_id: string; expected_run_id: string; retry_identity: string }> = [];
  const writes: string[] = [];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET" && url.pathname !== "/api/analytics/ingest") writes.push(url.pathname);
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === `/api/self-capture/uploads/${token}/advisory-retry`) {
      expect(route.request().headers()["x-csrf-token"]).toBe("fixture");
      retries.push(route.request().postDataJSON());
      if (retries.length === 1) { await firstResponse; return route.abort(); }
      queued = true;
      return route.fulfill({ json: { ok: true, state: "queued", job_id: jobId, run_id: newRun } });
    }
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"],
    } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: {
      ready: true, scope: "owner", brief: { summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null },
    } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      scope: "owner", captureReceived: true, status: { decision: "confirm_brief", headline: "Review your job brief.", operatorAction: null, missingViews: [] },
      siteAdvisory: { schemaVersion: "site_customer_advisory.v1", state: queued ? "queued" : "needs_review", correlationId: "bp-advisory-aaaaaaaaaaaaaaaa", sections: [], unknowns: [], nextAction: null },
      assessment_retry_available: !queued, assessment_job_id: jobId, assessment_run_id: queued ? newRun : originalRun,
    } });
    if (url.pathname.endsWith("/items")) return route.fulfill({ json: { items: [], allItemsCovered: false, requestedShots: [] } });
    if (url.pathname.endsWith("/follow-up")) return route.fulfill({ json: { questions: [] } });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByText("Correct job details (optional)", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try assessment again", exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  await page.getByRole("button", { name: "Try assessment again", exact: true }).dblclick();
  await expect.poll(() => retries.length).toBe(1);
  await expect(page.getByRole("button", { name: "Requesting assessment retry…", exact: true })).toBeDisabled();
  expect(retries[0]).toMatchObject({ expected_job_id: jobId, expected_run_id: originalRun });
  expect(retries[0].retry_identity).toMatch(/^[0-9a-f-]{36}$/);
  releaseFirst();
  await expect(page.getByRole("status")).toContainText("We could not confirm the retry.");
  await page.reload();
  await page.getByRole("button", { name: "Try assessment again", exact: true }).click();
  await expect.poll(() => retries.length).toBe(2);
  expect(retries[1]).toEqual(retries[0]);
  await expect(page.getByText("Your video is saved and its job assessment is queued.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try assessment again", exact: true })).toHaveCount(0);
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByText("Correct job details (optional)", { exact: true })).toBeVisible();
  expect(writes).toEqual([`/api/self-capture/uploads/${token}/advisory-retry`, `/api/self-capture/uploads/${token}/advisory-retry`]);
  await expect(page.getByText("Your job brief is confirmed.", { exact: false })).toHaveCount(0);
});

test("returning owner can explicitly replace a received recording without confirming the brief", async ({ page }, info) => {
  const token = "replacement-fixture";
  const video = info.outputPath("synthetic-replacement.mp4");
  // Owned synthetic pixels exercise actual decoding and transport, not video judgment.
  copyFileSync(path.resolve("e2e/fixtures/synthetic-transport.mp4"), video);
  const writes: string[] = [];
  let posted = "";
  await page.route("**/api/**", route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") writes.push(url.pathname);
    if (url.pathname === `/api/self-capture/uploads/${token}` && request.method() === "POST") {
      posted = request.postDataBuffer()!.toString("latin1");
      return route.fulfill({ json: { captureReceived: true, uploadState: "processing_ready" } });
    }
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"],
    } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: {
      ready: true, scope: "owner", brief: { summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null },
    } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      captureReceived: true, status: { decision: "confirm_brief", headline: "Review your job brief.", operatorAction: null, missingViews: [] },
    } });
    if (url.pathname.endsWith("/items")) return route.fulfill({ json: { items: [], allItemsCovered: false, requestedShots: [] } });
    if (url.pathname.endsWith("/follow-up")) return route.fulfill({ json: { questions: [] } });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByText("Correct job details (optional)", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  const choose = page.getByRole("button", { name: "Upload a new recording", exact: true });
  await expect(choose).toBeVisible();
  expect(writes).toEqual([]);
  const chooserEvent = page.waitForEvent("filechooser");
  await choose.click();
  const chooser = await chooserEvent;
  // Opening or canceling the picker leaves the acknowledged source untouched.
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  expect(writes).toEqual([]);
  await chooser.setFiles(video);
  await expect.poll(() => writes).toEqual([`/api/self-capture/uploads/${token}`]);
  expect(posted).toContain('filename="synthetic-replacement.mp4"');
  expect(posted).toContain('name="metadata"');
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByText("Correct job details (optional)", { exact: true })).toBeVisible();
  await expect(page.getByText("Your job brief is confirmed.", { exact: false })).toHaveCount(0);
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
  await expect(page.getByRole("link", { name: "Open your job and assessment" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the camera" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry processing" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("desktop-held-footage.png"), fullPage: true });
});
