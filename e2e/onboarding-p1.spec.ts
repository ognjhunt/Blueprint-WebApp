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
    else if (path.startsWith("/api/self-capture/uploads/")) data = { ok: true, state: "open", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" };
    else if (path.endsWith("/status")) data = { ok: true, status: { decision: "received", headline: "We have your task and are checking your footage.", operatorAction: null, missingViews: [], nextUpdateIso: "2099-09-21T12:00:00Z" } };
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
for (const mobile of [false, true]) {
  test(`${mobile ? "phone" : "desktop"}: browse before setup and evaluate only the selected task`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, ...(mobile ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", isMobile: true, hasTouch: true } : {}) });
    const page = await context.newPage(); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    const mutations = await fixtures(page);
    await page.goto("/contact/robot-team");
    await expect(page.getByRole("heading", { name: card.title })).toBeVisible();
    await expect(page.getByLabel("Work email", { exact: true }).first()).not.toBeVisible();
    await expect(page.getByText("Task illustration · not a site photo", { exact: true })).toHaveCount(3);
    expect(mutations).toEqual([]);
    await screenshot(page, `${mobile ? "phone" : "desktop"}-browse`);
    if (mobile) await page.getByText("Filter tasks", { exact: true }).click();
    await page.getByLabel("Filter by availability").selectOption("past");
    await expect(page.getByRole("heading", { name: "Sort small rigid parts into bins" })).toBeVisible();
    await expect(page.getByRole("heading", { name: card.title })).toHaveCount(0);
    await page.getByLabel("Filter by availability").selectOption("open");
    await page.getByRole("button", { name: "Self-directed evaluation · $25" }).click();
    await expect(page.getByText("Site's proposed pilot price")).toBeVisible();
    await expect(page.getByText("Four weeks including setup and provider support")).toBeVisible();
    await expect(page.getByText("$5,000 per month")).toBeVisible();
    await expect(page.getByText(/Evaluation does not commit you to a pilot/)).toBeVisible();
    await page.getByLabel("Work email", { exact: true }).fill("engineer@example.test");
    await page.locator("#plan-hardware").selectOption("prototype");
  await page.locator("#plan-geography").selectOption("yes");
  await page.getByLabel("Team or company").fill("Local robot team");
    await page.getByLabel("Where is it?").fill("https://example.test/policy");
    await page.getByRole("button", { name: "See what we would run" }).click();
    await expect(page.getByText("Payload needs confirmation before execution.")).toBeVisible();
    expect(mutations.find(item => item.path.endsWith("/plan"))?.body).toMatchObject({ sceneId: "task-1", checkpointId: "cp-1" });
    expect(mutations.some(item => item.path.endsWith("/runs"))).toBe(false);
    expect(errors).toEqual([]); await context.close();
  });
}

test("an approved team's empty library says tasks are coming; an outage is not an empty library", async ({ page }) => {
  await fixtures(page, []); await page.goto("/sites");
  await expect(page.getByText("The first site tasks are being prepared.")).toBeVisible();
  await expect(page.getByRole("form", { name: "Task preferences" })).toHaveCount(0);
  await screenshot(page, "empty-approved");
  await page.route("**/api/site-worlds/tasks", route => route.fulfill({ status: 503, json: { error: "offline" } }));
  await page.reload(); await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByText("The first site tasks are being prepared.")).toHaveCount(0);
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
  await form.getByRole("button", { name: "Apply for early access" }).click();
  await expect(page.getByRole("heading", { name: "Application received." })).toBeVisible();
  expect(mutations.at(-1)).toMatchObject({ path: "/api/robot-team-access/apply", body: { name: "Ada Lovelace", email: "ada@arm.example", acceptedTerms: true } });
  await screenshot(page, "early-access-applied");
});

test("desktop capture has one status, adjacent upload, brand and owner-reviewed public card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); const mutations = await fixtures(page);
  await page.goto("/capture-upload/owner-fixture");
  await expect(page.getByRole("heading", { name: "Point your phone at this." })).toBeVisible();
  await expect(page.getByText("We have your task and are checking your footage.")).toHaveCount(1);
  // Updates follow events by email; the page promises that, not a deadline.
  await expect(page.getByText("We email you each time something happens on this task. You do not need to check back.")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Blueprint home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open the camera" })).toHaveCount(0);
  const upload = await page.getByRole("button", { name: "Upload a video file" }).boundingBox();
  const instruction = await page.getByText("Already have the recording on this computer? Upload a .mov or .mp4 file.").boundingBox();
  expect(upload!.y - instruction!.y).toBeLessThan(110);
  await screenshot(page, "desktop-capture");
  await page.getByText("Share a task card with robot teams", { exact: true }).click();
  const form = page.getByRole("form", { name: "Public task card" });
  await form.getByLabel("Describe the task without naming your site").fill(card.title);
  await form.getByLabel("Task family", { exact: true }).fill("Palletizing");
  await form.getByLabel("Task thumbnail (optional)").setInputFiles({ name: "task.png", mimeType: "image/png", buffer: taskPhoto });
  await expect(form.getByRole("img", { name: "Thumbnail crop to approve for public display" })).toBeVisible();
  await form.getByLabel("Show this card in the task library").check();
  await form.getByLabel(/I reviewed the text and thumbnail/).check();
  await form.getByRole("button", { name: "Save public card" }).click();
  await expect(page.getByText(/Public card saved/)).toBeVisible();
  expect(mutations.at(-1)?.body).toMatchObject({ consent: true, enabled: true, thumbnailConsent: true, details: { title: card.title } });
  expect(mutations.at(-1)?.body.thumbnailPng).toBeTruthy();
  await form.getByRole("button", { name: "Use a task illustration instead" }).click();
  await expect(form.getByRole("img", { name: "Thumbnail crop to approve for public display" })).toHaveCount(0);
  await form.getByLabel(/I reviewed the text and thumbnail/).check();
  await form.getByRole("button", { name: "Save public card" }).click();
  await expect.poll(() => mutations.at(-1)?.body.thumbnailPng).toBe(null);
});

test("phone capture prioritizes the camera and promises event emails, not a deadline", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", isMobile: true, hasTouch: true });
  const page = await context.newPage(); await fixtures(page);
  await page.route("**/api/site-task-brief/*/status", route => route.fulfill({ json: { status: { decision: "assessing", headline: "Preparing your scene", nextUpdateIso: "2020-01-01T12:00:00Z" } } }));
  await page.goto("/capture-upload/phone-fixture");
  // A stale deadline left on the record is ignored: timed check-ins are retired.
  await expect(page.getByText(/We email you each time something happens/)).toBeVisible();
  await expect(page.getByText(/Update overdue|Next status update by/)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Point your phone at this." })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Open the camera|Choose or record a video/ }).first()).toBeVisible();
  await screenshot(page, "phone-capture"); await context.close();
});

for (const mobile of [false, true]) test(`${mobile ? "phone" : "desktop"}: intake hands off to the right device`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, ...(mobile ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", isMobile: true, hasTouch: true } : {}) });
  const page = await context.newPage(); await fixtures(page);
  await page.goto("/contact/site-operator");
  const form = page.getByRole("form", { name: "Start a site capture" });
  await form.locator("#start-task").fill("Move sealed cartons from conveyor to pallet");
  await form.locator("#start-location").fill("Chicago, Illinois");
  await form.locator("#start-region").selectOption("us");
  await form.locator("#start-email").fill("owner@example.test");
  await form.locator("#start-rights").check();
  await form.getByRole("button", { name: "Start", exact: true }).click();
  if (mobile) {
    await expect(page.getByRole("link", { name: "Open the camera" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Point your phone at this to film" })).toHaveCount(0);
  } else {
    await expect(page.getByRole("img", { name: "Point your phone at this to film" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open the camera" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open your task page" })).toBeVisible();
  }
  await screenshot(page, `${mobile ? "phone" : "desktop"}-intake-handoff`); await context.close();
});

test("public photos fall back to illustrations when removed", async ({ page }) => {
  await fixtures(page, [{ ...card, thumbnailUrl: "/api/site-worlds/tasks/task-1/thumbnail" }]);
  await page.route("**/api/site-worlds/tasks/task-1/thumbnail", route => route.fulfill({ contentType: "image/png", body: taskPhoto }));
  await page.goto("/sites");
  await expect(page.getByRole("img", { name: `Owner-approved task view: ${card.title}` })).toBeVisible();
  await expect(page.getByText("Owner-approved task photo", { exact: true })).toBeVisible();
  await page.route("**/api/site-worlds/tasks/task-1/thumbnail", route => route.fulfill({ status: 404, body: "" }));
  await page.reload();
  await expect(page.getByText("Task illustration · not a site photo", { exact: true })).toBeVisible();
});


test("a one-time paid plan keeps its receipt across reload and exposes results", async ({ page }) => {
  const mutations = await fixtures(page);
  await page.route("**/api/agent-team/plan", route => route.fulfill({ json: {
    selected: [{ sceneId: card.id, siteLabel: card.title, costUsd: 25, rationale: "Prepared execution", details: card }],
    totalCostUsd: 25, planToken: "signed-fixture-plan", availableBalanceUsd: 50, fundingNeededUsd: 0,
    // A team whose verified account is already connected: paying needs one.
    accountBound: true,
  } }));
  let confirmations = 0;
  await page.route("**/api/agent-team/runs", async route => {
    confirmations += 1;
    expect(route.request().postDataJSON()).toMatchObject({ checkpointId: "cp-1", spendMode: "one_time", planToken: "signed-fixture-plan", confirm: true });
    await route.fulfill({ status: 202, json: { started: [{ runId: "local-run", sceneId: card.id, siteLabel: card.title, costUsd: 25 }], refused: [], reservedUsd: 25 } });
  });
  await page.route("**/api/agent-team/results", route => route.fulfill({ json: { runs: [{ runId: "local-run", state: "completed", result: { observed: { episodesRun: 50, episodesSucceeded: 41 } } }] } }));
  await page.goto("/contact/robot-team");
  await page.getByRole("button", { name: "Self-directed evaluation · $25" }).first().click();
  await page.getByLabel("Work email", { exact: true }).fill("engineer@example.test");
  await page.locator("#plan-hardware").selectOption("prototype");
  await page.locator("#plan-geography").selectOption("yes");
  await page.getByLabel("Team or company").fill("Local robot team");
  await page.getByLabel("Where is it?").fill("https://example.test/policy");
  await page.getByRole("button", { name: "See what we would run" }).click();
  await page.getByRole("button", { name: "Queue these runs from your balance" }).click();
  await expect(page.getByRole("button", { name: "Check results" })).toBeVisible();
  await page.reload();
  await page.getByText("Already have a robot policy to evaluate? Register it and see a plan", { exact: true }).click();
  await page.getByRole("button", { name: "Check results" }).click();
  await expect(page.getByRole("list", { name: "Run results" })).toContainText("41 of 50 episodes");
  expect(confirmations).toBe(1);
  expect(mutations.some(item => item.path.endsWith("/policy") || item.path.endsWith("/funding"))).toBe(false);
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
