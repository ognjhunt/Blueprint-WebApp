import { test, expect, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const { PNG } = createRequire(import.meta.url)("pngjs");
const taskPhoto = PNG.sync.write({ width: 480, height: 300, data: Buffer.alloc(480 * 300 * 4, 180) });
const out = "output/qa/onboarding-p1";
const card = { id: "task-1", title: "Move sealed cartons from conveyor to pallet", taskFamily: "Palletizing", siteType: "Warehouse", region: "US Midwest", objects: "Sealed cartons", cycleTarget: "12 seconds", pilotTiming: "October", pilotBudget: "$20,000", pilotPriceStatus: "site_offer", pilotConditions: "Four weeks including setup and provider support", ongoingTarget: "$5,000 per month", opportunity: "open", stage: "ready", evaluationAvailable: true, costUsd: 25, thumbnailUrl: null, publishedAtIso: "2026-09-19T00:00:00Z" };
async function fixtures(page: Page, items: unknown[] | { gated: true } = [card, { ...card, id: "task-2", title: "Sort small rigid parts into bins", taskFamily: "Pick and place", objects: "Small rigid parts", cycleTarget: "15 seconds", siteType: "Assembly area", pilotTiming: "Past opportunity", opportunity: "past" }, { ...card, id: "task-3", title: "Transfer trays between two stations", taskFamily: "Transport", objects: "Loaded trays", siteType: "Manufacturing", cycleTarget: "20 seconds", pilotTiming: "November", stage: "capture", evaluationAvailable: false, costUsd: null }]) {
  const mutations: { path: string; body: any }[] = [];
  await page.addLocatorHandler(page.getByRole("button", { name: "Reject all", exact: true }), async button => { await button.click(); });
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/**", async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (req.method() === "POST" && !path.startsWith("/api/analytics/")) mutations.push({ path, body: req.postDataJSON() });
    let data: unknown = {};
    if (path === "/api/site-worlds/tasks") data = Array.isArray(items) ? { items }
      : { items: [], access: { gated: true, status: "none", signedIn: false, emailVerified: false, allowed: false, staff: false } };
    else if (path === "/api/robot-team-access/apply") data = { status: "applied" };
    else if (path === "/api/csrf") data = { csrfToken: "local-only" };
    else if (path.startsWith("/api/task-listings/owner/")) data = { listing: null, ok: true };
    else if (path === "/api/agent-team/register") data = { teamId: "team-1", agentKey: "local-fixture", checkpoint: { checkpointId: "cp-1" } };
    else if (path === "/api/agent-team/plan") data = { selected: [{ sceneId: card.id, siteLabel: card.title, costUsd: 25, rationale: "Payload needs confirmation before execution.", details: card }], totalCostUsd: 25 };
    else if (path === "/api/inbound-request") data = { ok: true, requestId: "task-1", captureUrl: "http://127.0.0.1:42931/capture-upload/owner-fixture" };
    else if (path.startsWith("/api/self-capture/uploads/") && path.endsWith("/status")) data = { ok: true, state: "ready", uploadState: "not_received", captureReceived: false, accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" };
    else if (/^\/api\/self-capture\/uploads\/[^/]+$/.test(path) && req.method() === "GET") throw new Error("Receipt checks must use the pure upload status endpoint.");
    else if (path.startsWith("/api/site-task-brief/") && path.endsWith("/status")) data = { ok: true, status: { decision: "received", headline: "We have your task and are checking your footage.", operatorAction: null, missingViews: [], nextUpdateIso: "2099-09-21T12:00:00Z" } };
    else if (path.endsWith("/items")) data = { items: [] };
    else if (path.startsWith("/api/site-task-brief/")) data = { ready: false, scope: "owner" };
    return route.fulfill({ json: data });
  });
  return mutations;
}
async function screenshot(page: Page, name: string) {
  mkdirSync(out, { recursive: true });
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const mobile of [false, true]) test(`${mobile ? "phone" : "desktop"}: retained upload retries processing and survives refresh and Back`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, ...(mobile ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage();
  const mutations = await fixtures(page);
  let ready = false;
  const retries: string[] = [];
  await page.route("**/api/self-capture/uploads/retained-fixture**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith("/processing-retry")) {
      expect(request.method()).toBe("POST"); retries.push(path); ready = true;
      await route.fulfill({ json: { ok: true, state: "processing_ready", uploadState: "processing_ready", captureReceived: true, processingRetryAvailable: false } });
    } else {
      expect(request.method()).toBe("GET");
      expect(path).toBe("/api/self-capture/uploads/retained-fixture/status");
      await route.fulfill({ json: { ok: true, state: "ready", uploadState: ready ? "processing_ready" : "processing_pending", captureReceived: true, processingRetryAvailable: !ready } });
    }
  });
  await page.goto("/capture-upload/retained-fixture");
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry processing", exact: true })).toBeVisible();
  await expect(page.getByText("Your video is saved.", { exact: true })).toBeVisible();
  await expect(page.getByText("We have your task and are checking your footage.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /phone|device/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open the camera|Choose or record|Upload a video file/ })).toHaveCount(0);
  expect(retries).toEqual([]); expect(mutations).toEqual([]);
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry processing", exact: true })).toBeVisible();
  expect(retries).toEqual([]);
  await page.getByRole("link", { name: "Back to Blueprint", exact: true }).click();
  await expect(page.getByRole("form", { name: "Start a site capture" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("button", { name: "Retry processing", exact: true })).toBeVisible();
  await screenshot(page, `${mobile ? "phone" : "desktop"}-retained-processing-pending`);
  await page.getByRole("button", { name: "Retry processing", exact: true }).click();
  await expect(page.getByRole("button", { name: /Retry.*processing/ })).toHaveCount(0);
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  expect(retries).toHaveLength(1); expect(mutations).toEqual([]);
  await page.reload();
  await expect(page.getByRole("button", { name: /Retry.*processing|Upload a video file|Open the camera/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await context.close();
});

test("a retained video with changed consent shows the current hold without processing or recording actions", async ({ page }) => {
  const mutations = await fixtures(page);
  await page.route("**/api/self-capture/uploads/consent-fixture/status", route => route.fulfill({ json: {
    ok: true, state: "held", detail: "Confirm current consent before this video can be processed.", captureReceived: true,
    uploadState: "processing_pending", processingRetryAvailable: false,
  } }));
  await page.goto("/capture-upload/consent-fixture");
  await expect(page.getByText(/Confirm current consent/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Retry.*processing|Open the camera|Upload a video file/ })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /phone|device/ })).toHaveCount(0);
  expect(mutations).toEqual([]);
});

for (const mobile of [false, true]) test(`${mobile ? "phone" : "desktop"}: existing video opens an uploader with an optional device handoff`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, ...(mobile ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage();
  const mutations = await fixtures(page);
  await page.goto("/capture-upload/existing-fixture?video=existing");
  await expect(page.getByRole("heading", { name: "Upload your existing video" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload a video file", exact: true })).toBeVisible();
  await expect(page.getByText("Your job is saved.", { exact: true })).toBeVisible();
  await expect(page.getByText("We have your task and are checking your footage.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open the camera|Choose or record/ })).toHaveCount(0);
  await expect(page.getByText("Ask someone else to film", { exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"][accept=".mov,.mp4"]')).not.toHaveAttribute("capture");
  const handoff = page.locator("details").filter({ has: page.getByText("Open this job on another device (optional)", { exact: true }) });
  await expect(handoff).not.toHaveAttribute("open");
  await expect(page.getByRole("img", { name: /phone|device/ })).toHaveCount(0);
  expect(mutations).toEqual([]);
  await screenshot(page, `${mobile ? "phone" : "desktop"}-existing-video-upload`);
  await context.close();
});
for (const mobile of [false, true]) {
  test(`${mobile ? "phone" : "desktop"}: browse before setup and request a free invited evaluation`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, ...(mobile ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", isMobile: true, hasTouch: true } : {}) });
    const page = await context.newPage(); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const mutations = await fixtures(page);
    await page.goto("/contact/robot-team");
    await expect(page.getByRole("heading", { name: card.title })).toBeVisible();
    await expect(page.getByLabel("Work email", { exact: true }).first()).not.toBeVisible();
    await expect(page.getByText("Job illustration · not a site photo", { exact: true })).toHaveCount(3);
    expect(mutations).toEqual([]);
    await screenshot(page, `${mobile ? "phone" : "desktop"}-browse`);
    if (mobile) await page.getByText("Filter jobs", { exact: true }).click();
    await page.getByLabel("Filter by availability").selectOption("past");
    await expect(page.getByRole("heading", { name: "Sort small rigid parts into bins" })).toBeVisible();
    await expect(page.getByRole("heading", { name: card.title })).toHaveCount(0);
    await page.getByLabel("Filter by availability").selectOption("open");
    const selected = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: card.title }) });
    await expect(selected.getByRole("link", { name: "Request a free invited evaluation" })).toHaveAttribute("href", "/app");
    await expect(selected.getByText("Site's proposed pilot price")).toBeVisible();
    await expect(selected.getByText("Four weeks including setup and provider support")).toBeVisible();
    await expect(selected.getByText("$5,000 per month")).toBeVisible();
    await expect(page.getByText("Invited evaluations are free within the approved scope and share results with the site.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Private evaluation|See what we would run|Queue these runs/ })).toHaveCount(0);
    expect(mutations).toEqual([]);
    expect(errors).toEqual([]); await context.close();
  });
}

test("an approved team's empty library says tasks are coming; an outage is not an empty library", async ({ page }) => {
  await fixtures(page, []); await page.goto("/sites");
  await expect(page.getByText("The first site jobs are being prepared.")).toBeVisible();
  await expect(page.getByRole("form", { name: "Task preferences" })).toHaveCount(0);
  await screenshot(page, "empty-approved");
  await page.route("**/api/site-worlds/tasks", route => route.fulfill({ status: 503, json: { error: "offline" } }));
  await page.reload(); await expect(page.getByRole("form", { name: "Early access application" })).toBeVisible();
  await expect(page.getByText("The first site jobs are being prepared.")).toHaveCount(0);
});

test("a robot team outside early access applies instead of browsing", async ({ page }) => {
  const mutations = await fixtures(page, { gated: true }); await page.goto("/contact/robot-team");
  const form = page.getByRole("form", { name: "Early access application" });
  await expect(form).toBeVisible();
  await expect(page.getByText("Already have a robot policy to evaluate? Register it and see a plan", { exact: true })).toHaveCount(0);
  await form.getByLabel("Your name").fill("Ada Lovelace");
  await form.getByLabel("Work email").fill("ada@arm.example");
  await form.getByLabel("Company").fill("Arm Co");
  await form.getByLabel("What does your robot do?").fill("Fixed arm with a parallel gripper");
  await form.getByLabel("What work do you want to test it on?").fill("Tote picking");
  await form.getByRole("button", { name: "Register interest" }).click();
  await expect(page.getByRole("heading", { name: "Application received." })).toBeVisible();
  expect(mutations.at(-1)).toMatchObject({ path: "/api/robot-team-access/apply", body: { name: "Ada Lovelace", email: "ada@arm.example", acceptedTerms: true } });
  await screenshot(page, "early-access-applied");
});

test("desktop owner reviews the brief before optional recording, with one status and explicit public card approval", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); const mutations = await fixtures(page);
  await page.goto("/capture-upload/owner-fixture");
  await expect(page.getByRole("heading", { name: "Your job summary", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Point your phone at this." })).toHaveCount(0);
  await page.getByRole("button", { name: "Add footage when you are ready (optional)" }).click();
  await expect(page.getByRole("heading", { name: "Point your phone at this." })).toBeVisible();
  await expect(page.getByText("We have your task and are checking your footage.")).toHaveCount(1);
  // Updates follow events by email; the page promises that, not a deadline.
  await expect(page.getByText("Blueprint prepares the next useful step from your job and existing evidence. We send meaningful progress and ask for action only when a missing fact or concrete commitment needs your input.")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Blueprint home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open the camera" })).toHaveCount(0);
  const upload = await page.getByRole("button", { name: "Upload a video file" }).boundingBox();
  const instruction = await page.getByText("Already have the recording on this computer? Upload a .mov or .mp4 file.").boundingBox();
  expect(upload!.y - instruction!.y).toBeLessThan(110);
  await screenshot(page, "desktop-capture");
  await page.getByText("Manage opportunity sharing (optional)", { exact: true }).click();
  const form = page.getByRole("form", { name: "Public job card" });
  await form.getByLabel("Describe the job without naming your site").fill(card.title);
  await form.getByLabel("Job type", { exact: true }).fill("Palletizing");
  await form.getByLabel("Job thumbnail (optional)").setInputFiles({ name: "task.png", mimeType: "image/png", buffer: taskPhoto });
  await expect(form.getByRole("img", { name: "Thumbnail crop to approve for public display" })).toBeVisible();
  await form.getByLabel("Show this card in the job library").check();
  await form.getByLabel(/I reviewed the text and thumbnail/).check();
  await form.getByRole("button", { name: "Publish reviewed card" }).click();
  await expect(page.getByText(/Public card saved/)).toBeVisible();
  expect(mutations.at(-1)?.body).toMatchObject({ consent: true, enabled: true, thumbnailConsent: true, details: { title: card.title } });
  expect(mutations.at(-1)?.body.thumbnailPng).toBeTruthy();
  await form.getByRole("button", { name: "Use a job illustration instead" }).click();
  await expect(form.getByRole("img", { name: "Thumbnail crop to approve for public display" })).toHaveCount(0);
  await form.getByLabel(/I reviewed the text and thumbnail/).check();
  await form.getByRole("button", { name: "Publish reviewed card" }).click();
  await expect.poll(() => mutations.at(-1)?.body.thumbnailPng).toBe(null);
});

test("phone owner reviews the brief before optional recording and keeps event emails", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", isMobile: true, hasTouch: true });
  const page = await context.newPage(); await fixtures(page);
  await page.route("**/api/site-task-brief/*/status", route => route.fulfill({ json: { status: { decision: "assessing", headline: "Preparing your scene", nextUpdateIso: "2020-01-01T12:00:00Z" } } }));
  await page.goto("/capture-upload/phone-fixture");
  // A stale deadline left on the record is ignored: timed check-ins are retired.
  await expect(page.getByText(/We send meaningful progress/)).toBeVisible();
  await expect(page.getByText(/Update overdue|Next status update by/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Point your phone at this." })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Your job summary", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open the camera|Choose or record a video/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Add footage when you are ready (optional)" }).click();
  await expect(page.getByRole("button", { name: /Open the camera|Choose or record a video/ }).first()).toBeVisible();
  await screenshot(page, "phone-capture"); await context.close();
});

for (const mobile of [false, true]) test(`${mobile ? "phone" : "desktop"}: description intake leads to brief review`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, ...(mobile ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage(); await fixtures(page);
  await page.goto("/contact/site-operator");
  const form = page.getByRole("form", { name: "Start a site capture" });
  await form.locator("#start-task").fill("Move sealed cartons from conveyor to pallet");
  await form.locator("#start-location").fill("Chicago, Illinois");
  await form.locator("#start-email").fill("owner@example.test");
  await form.locator("#start-company").fill("Acme Foods");
  await expect(form.locator("#start-rights")).toHaveCount(0);
  await expect(form.locator("#start-region")).toHaveCount(0);
  await form.getByRole("button", { name: "Start free assessment", exact: true }).click();
  await expect(page.getByRole("link", { name: "Open your job and assessment", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the camera" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Point your phone at this to film" })).toHaveCount(0);
  await screenshot(page, `${mobile ? "phone" : "desktop"}-intake-handoff`); await context.close();
});

test("public photos fall back to illustrations when removed", async ({ page }) => {
  await fixtures(page, [{ ...card, thumbnailUrl: "/api/site-worlds/tasks/task-1/thumbnail" }]);
  await page.route("**/api/site-worlds/tasks/task-1/thumbnail", route => route.fulfill({ contentType: "image/png", body: taskPhoto }));
  await page.goto("/sites");
  await expect(page.getByRole("img", { name: `Owner-approved job view: ${card.title}` })).toBeVisible();
  await expect(page.getByText("Owner-approved job photo", { exact: true })).toBeVisible();
  await page.route("**/api/site-worlds/tasks/task-1/thumbnail", route => route.fulfill({ status: 404, body: "" }));
  await page.reload();
  await expect(page.getByText("Job illustration · not a site photo", { exact: true })).toBeVisible();
});


test("free beta does not restore paid checkout controls after a reload", async ({ page }) => {
  const mutations = await fixtures(page);
  await page.goto("/contact/robot-team");
  for (let attempt = 0; attempt < 2; attempt++) {
    await expect(page.getByRole("link", { name: "Request a free invited evaluation" }).first()).toHaveAttribute("href", "/app");
    await expect(page.getByRole("button", { name: /Private evaluation|See what we would run|Queue these runs/ })).toHaveCount(0);
    await expect(page.locator("#plan-hardware")).toHaveCount(0);
    expect(mutations).toEqual([]);
    if (attempt === 0) await page.reload();
  }
});

test("site owner receives a claim link alongside completed screening status", async ({ page }) => {
  await fixtures(page);
  await page.route("**/api/site-task-brief/*/status", route => route.fulfill({ json: {
    ok: true, status: { decision: "results", headline: "Results are in from 2 screening runs. Review each run separately.", operatorAction: null, missingViews: [], nextUpdateIso: null },
    claimUrl: "/sign-in?claim=owner-fixture", sceneViewUrl: "https://scene.example.test/view/owner-scene",
  } }));
  await page.goto("/capture-upload/owner-fixture");
  await expect(page.getByText("Results are in from 2 screening runs. Review each run separately.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Claim your site to see the results" })).toHaveAttribute("href", "/sign-in?claim=owner-fixture");
  await expect(page.getByRole("link", { name: "View your scene" })).toHaveAttribute("href", "https://scene.example.test/view/owner-scene");
});
