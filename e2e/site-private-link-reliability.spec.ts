import { expect, test } from "@playwright/test";

const legacyJobWorkflow = () => ({
  schemaVersion: "job_marketplace.v1", revision: "fixture-revision", stage: "job_submitted",
  requirements: { purchaseReadiness: "unsure", jobFrequency: null, requiredOutput: null,
    installationBudget: null, ongoingBudget: null, currentProcessCost: null, targetStartDate: null },
  briefAgreed: false, optionsAssessed: false, reviewRequired: false,
  nextAction: "Review the job brief with Blueprint.", actionOwner: "site",
  review: null, proposals: [], selection: null, agreement: null, outcome: null,
});

const summary = (name: string, email = "operator@example.test") => ({
  ok: true, requestId: `fixture-${name}`, alreadyClaimed: false,
  claimEmail: email, siteTermsAcceptedCurrent: false,
  site: { siteName: name, siteLocation: "Austin", taskStatement: "Pack cartons", qualificationState: "submitted" },
});

test("owner can request an authorized assessment retry while keeping the saved recording", async ({ page }, info) => {
  const token = "advisory-retry-fixture";
  const jobId = `advisory-${"a".repeat(64)}`, originalRun = `site-assessment-${"b".repeat(64)}`, newRun = `site-assessment-${"c".repeat(64)}`;
  let queued = false;
  let releaseFirst!: () => void;
  const firstResponse = new Promise<void>(resolve => { releaseFirst = resolve; });
  const retries: Array<{ expected_job_id: string; expected_run_id: string; retry_identity: string }> = [];
  const writes: string[] = [];
  const asks: string[] = [];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/job-workflow/owner/") && route.request().method() === "GET") return route.fulfill({ json: legacyJobWorkflow() });
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
    // The site sends its video and nothing else: no item photos, measurements or follow-up questions are read.
    if (/\/(items|clarification|follow-up|measurements)$/.test(url.pathname)) asks.push(url.pathname);
    if (url.pathname.endsWith("/readiness")) return route.fulfill({ json: { ok: true, summary: null, report: null, briefPath: null,
      tracker: { steps: [], meanwhile: null } } });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Confirm your job brief", exact: true })).toBeVisible();
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
  await expect(page.getByText("Your video is saved. Blueprint is preparing your job assessment; nothing more is needed from you right now.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try assessment again", exact: true })).toHaveCount(0);
  await expect(page.getByText("Add photos of the job items", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Add measurements/)).toHaveCount(0);
  expect(asks).toEqual([]);
  await page.screenshot({path:info.outputPath("video-only-saved-job-local-fixture.png"),fullPage:true});
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Confirm your job brief", exact: true })).toBeVisible();
  expect(writes).toEqual([`/api/self-capture/uploads/${token}/advisory-retry`, `/api/self-capture/uploads/${token}/advisory-retry`]);
  await expect(page.getByText("Your job brief is confirmed.", { exact: false })).toHaveCount(0);
});

test("returning owner keeps the received recording and gets fresh-job recovery guidance without new writes", async ({ page }, info) => {
  const token = "retained-recording-fixture";
  const writes: string[] = [];
  await page.route("**/api/**", route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/job-workflow/owner/") && request.method() === "GET") return route.fulfill({ json: legacyJobWorkflow() });
    if (request.method() !== "GET") writes.push(url.pathname);
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
  await expect(page.getByRole("region", { name: "Confirm your job brief", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload a new recording", exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload a new recording", exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.getByText(/This link keeps your original recording/)).toContainText(
    "for help starting a new job with a complete walkthrough and fresh recording permission.");
  await expect(page.getByText(/This link keeps your original recording/)).toContainText(
    "Your existing job stays saved; the new job needs its own review before evaluation.");
  const support = page.getByRole("link", { name: "contact Blueprint", exact: true });
  await expect(support).toHaveAttribute("href", "mailto:hello@tryblueprint.io?subject=Help%20with%20a%20new%20capture%20job");
  expect(await support.getAttribute("href")).not.toContain(token);
  await expect(page.getByRole("region", { name: "Confirm your job brief", exact: true })).toBeVisible();
  await expect(page.getByText("Your job brief is confirmed.", { exact: false })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("retained-recording-fresh-job-guidance.png"), fullPage: true });
  // Neither returning nor reloading uploads bytes, grants new permission, or confirms the brief.
  expect(writes).toEqual([]);
});

test.beforeEach(async ({ context, baseURL }) => {
  // Fresh, anonymous browser context. No inherited auth or real API traffic.
  const localOrigin = new URL(baseURL!).origin;
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/job-workflow/owner/") && route.request().method() === "GET") return route.fulfill({ json: legacyJobWorkflow() });
    if (url.origin !== localOrigin) return route.abort();
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
    if (url.pathname.startsWith("/api/job-workflow/owner/") && route.request().method() === "GET") return route.fulfill({ json: legacyJobWorkflow() });
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
  await page.locator("#start-location").fill("Austin, TX");
  await page.locator("#start-email").fill("operator@example.test");
  await page.locator("#start-company").fill("Fixture site");
  await page.getByRole("button", { name: "Start free assessment" }).click();
  await expect(page.getByRole("heading", { name: "Film the work area." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open your job page", exact: true })).toHaveAttribute("href", "/capture-upload/held-fixture");
  received = true;
  await page.clock.fastForward(6000);
  await expect(page.getByRole("heading", { name: "Your recording is in." })).toBeVisible();
  await expect(page.getByText("Your video is retained. Recording permission needs review.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open your job and assessment" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the camera" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Retry processing" })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("desktop-held-footage.png"), fullPage: true });
});

test("the person filming is asked for the video and nothing else", async ({ page }, info) => {
  const token = "video-only-fixture";
  const asks: string[] = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/job-workflow/owner/") && route.request().method() === "GET") return route.fulfill({ json: legacyJobWorkflow() });
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: { ready: false, scope: "film" } });
    if (/\/(items|clarification|follow-up|measurements|readiness)$/.test(url.pathname)) asks.push(url.pathname);
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}`);
  await expect(page.getByRole("heading", { name: "Point your phone at this." })).toBeVisible();
  // Blueprint infers sizes, weights, distances and pace from the video: the site measures nothing.
  await expect(page.getByText(/Add measurements/)).toHaveCount(0);
  await expect(page.getByText("Add photos of the job items", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/printer paper/)).toHaveCount(0);
  expect(asks).toEqual([]);
  await page.screenshot({ path: info.outputPath("video-only-film-link-local-fixture.png"), fullPage: true });
});

const READINESS_NOTE = "Blueprint invites robot teams whose robots look right for this job to evaluate it in a simulation of your site. If Blueprint recommends a team, it will be one whose evaluation of your job passed. This is a first read from your video, not a promise that any robot can do the job.";

function readinessFixture(overrides: Record<string, unknown> = {}) {
  const notNeeded = "between spots isn't needed: the object moves about 90 cm (estimated from your video).";
  return {
    ok: true,
    summary: "Sort parcels onto outbound chutes",
    tracker: { steps: [
      { id: "video", label: "Video received", state: "done", owner: "site" },
      { id: "brief", label: "Job brief confirmed", state: "done", owner: "site" },
      { id: "scene", label: "Your site rebuilt in 3D", state: "in_progress", owner: "blueprint" },
      { id: "evaluation", label: "Robot teams evaluate your job in simulation", state: "pending", owner: "blueprint" },
      { id: "recommendation", label: "Blueprint recommends one team", state: "pending", owner: "blueprint" },
      { id: "booking", label: "You book the pilot", state: "pending", owner: "site" },
    ], meanwhile: "Blueprint is rebuilding your work area in 3D from your video." },
    briefPath: "/readiness-brief/brief-token.signature",
    report: {
      robotFit: {
        needs: ["It has to pick the object up and put it down at another spot.", "It can work from one place: the object moves about 90 cm (estimated from your video)."],
        forms: [
          { id: "fixed_base_arm", label: "One arm on a fixed stand", description: "A single robot arm fixed in place at the work area.", verdict: "fits", reasons: [] },
          { id: "bimanual_arm", label: "Two arms on a fixed stand", description: "Two robot arms working together from one fixed spot.", verdict: "fits", reasons: [] },
          { id: "mobile_manipulator", label: "Arm on a wheeled base", description: "A robot arm on a base that drives between spots.", verdict: "fits", reasons: [`Driving ${notNeeded}`] },
          { id: "wheeled_humanoid", label: "Wheeled humanoid", description: "A human-like upper body with two arms, on a wheeled base.", verdict: "fits", reasons: [`Driving ${notNeeded}`] },
          { id: "humanoid", label: "Walking humanoid", description: "A human-shaped robot with two arms that walks on two legs.", verdict: "fits", reasons: [`Walking ${notNeeded}`] },
          { id: "legged_manipulator", label: "Legged robot with an arm", description: "A robot that walks on legs, such as four, with an arm on top.", verdict: "fits", reasons: [`Walking ${notNeeded}`] },
        ],
        note: READINESS_NOTE,
      },
      checklist: [
        { id: "floor_space", title: "Floor space at the station", state: "confirm", detail: "The robot team confirms the floor space its robot needs beside the work." },
        { id: "power_network", title: "Power and network", state: "confirm", detail: "A power outlet near the work area, and Wi-Fi along the route for a robot that drives between spots. The robot team tells you exactly what its robot needs." },
      ],
      successFactors: [{ id: "variety", title: "How many different items",
        detail: "Probably also handled here, though not in your video: flat envelopes, padded mailers (estimated from your video).",
        test: "The evaluation tests the object in your rebuilt scene. Other items are checked in the pilot.", where: "pilot" }],
      safety: ["Before a robot works at your site, ask the robot team for its risk assessment of the job. Robot safety follows the standards ISO 10218, adopted in the US as ANSI/A3 R15.06, and ANSI/A3 R15.08 for robots that drive between spots.",
        "Blueprint's evaluation runs in a simulation of your site. It does not certify that any robot is safe, or that a robot will perform the same at your site."],
      examples: [{ id: "parcel-sorting", name: "Parcel sorting",
        sources: [{ label: "China Daily: humanoid robots move onto fast track", href: "https://global.chinadaily.com.cn/a/202606/11/WS6a2ac863a310d6866eb4dcd2.html" }] }],
      examplesFootnote: "These are third-party deployments cited as evidence about which environments qualify. None is a Blueprint customer and none was prepared by Blueprint.",
    },
    ...overrides,
  };
}

test("the owner sees only the shared robot report, folded, with nothing to fill in and no robot team named", async ({ page }, info) => {
  const token = "readiness-fixture";
  const asks: string[] = [];
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/job-workflow/owner/") && route.request().method() === "GET") return route.fulfill({ json: legacyJobWorkflow() });
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: { ready: false, scope: "owner" } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: { captureReceived: true,
      sceneViewUrl: "https://scene.example/view",
      status: { stage: "footage_received", headline: "Your footage is retained; review is pending." } } });
    if (url.pathname === `/api/site-task-brief/${token}/readiness`) return route.fulfill({ json: readinessFixture() });
    if (/\/(items|clarification|follow-up|measurements|operations)$/.test(url.pathname)) asks.push(url.pathname);
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}`);
  // As little text as the site needs: one folded section, one number in its title.
  const report = page.locator("details", { has: page.locator("summary", { hasText: "Your robot readiness report · 6 kinds of robot fit" }) });
  await expect(report).toBeVisible();
  await expect(report).not.toHaveAttribute("open", "");
  await expect(page.getByRole("region", { name: "Your next steps" })).toHaveCount(0);
  await expect(page.getByText(/How the job runs today|Add measurements/)).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("readiness-default-local-fixture.png"), fullPage: true });

  await report.locator("summary").click();
  for (const label of ["One arm on a fixed stand", "Two arms on a fixed stand", "Arm on a wheeled base", "Wheeled humanoid",
    "Walking humanoid", "Legged robot with an arm"]) await expect(report.getByText(label, { exact: true })).toBeVisible();
  await expect(report.getByText("Checked in the pilot, not the simulation")).toBeVisible();
  await expect(report.getByText("Jobs like this on the public record", { exact: true })).toBeVisible();
  await expect(report.getByRole("link", { name: "China Daily: humanoid robots move onto fast track" })).toBeVisible();
  await expect(report.getByRole("link", { name: "Print or save the brief" })).toHaveAttribute("href", "/readiness-brief/brief-token.signature");
  await expect(report.locator("form, input, select, textarea")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/\bmatch|Galbot|Robot Era/i);
  expect(asks).toEqual([]);
  await page.screenshot({ path: info.outputPath("readiness-panel-local-fixture.png"), fullPage: true });
});

test("the robot readiness brief opens by its own read-only link and lays out the report to print", async ({ page }, info) => {
  const briefToken = "brief-token.signature";
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/job-workflow/owner/") && route.request().method() === "GET") return route.fulfill({ json: legacyJobWorkflow() });
    if (url.pathname === `/api/site-task-brief/readiness-brief/${briefToken}`) return route.fulfill({ json: readinessFixture({ briefPath: null }) });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/readiness-brief/${briefToken}`);
  await expect(page.getByRole("heading", { level: 1, name: "Sort parcels onto outbound chutes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Where things stand" }).getByText("Video received")).toBeVisible();
  await expect(page.getByRole("region", { name: "Robot readiness report" }).getByText("Walking humanoid", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "What is left to check" })).toHaveCount(0);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeHidden();
  await page.screenshot({ path: info.outputPath("readiness-brief-print-local-fixture.png"), fullPage: true });
});
