import { expect, test } from "@playwright/test";

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
    if (url.pathname.endsWith("/items")) return route.fulfill({ json: { items: [{itemId:"dishes",label:"Dishes",basis:"suggested",imageCount:0,coverageStatus:"needs_images",imagesStillWanted:2,assetStatus:"pending"}], allItemsCovered: false, requestedShots: [] } });
    if (url.pathname.endsWith("/clarification")) { expect(url.searchParams.get("mode")).toBe("assessment"); return route.fulfill({json:{revision:"a".repeat(64),needed:false,questions:[],assessmentState:"queued"}}); }
    if (url.pathname.endsWith("/follow-up")) return route.fulfill({ json: { questions: [] } });
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
  await page.getByText("Add photos of the job items",{exact:true}).click();
  await expect(page.getByPlaceholder("e.g. Dishes",{exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Add photos",exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath("known-item-placeholder-local-fixture.png"),fullPage:true});
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

test("the person filming records measurements beside the item photos, each in its own unit", async ({ page }, info) => {
  const token = "measurements-fixture";
  const puts: Array<Record<string, any>> = [];
  let saved: Record<string, unknown> | null = null;
  const empty = { ok: true, scope: "film", revision: 0, family: null, articulation: null, referencePaper: null,
    referenceSheetLongEdge: null, readings: {}, measuredBy: null, note: null, updatedAtIso: null };
  await page.route("**/api/**", route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: { ready: false, scope: "film" } });
    if (url.pathname.endsWith("/items")) return route.fulfill({ json: { items: [], allItemsCovered: false, requestedShots: [] } });
    if (url.pathname === `/api/site-task-brief/${token}/measurements`) {
      if (request.method() === "PUT") {
        const body = request.postDataJSON();
        puts.push(body);
        saved = { ...empty, revision: 1, family: body.family, articulation: body.articulation, referencePaper: body.referencePaper,
          readings: Object.fromEntries(Object.entries(body.readings as Record<string, object>).map(([id, reading]) =>
            [id, { ...reading, recordedAtIso: "2026-10-19T10:00:00.000Z", recordedByScope: "film" }])),
          updatedAtIso: "2026-10-19T10:00:00.000Z" };
        return route.fulfill({ json: saved });
      }
      return route.fulfill({ json: saved ?? empty });
    }
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}`);
  await page.getByText("Add measurements (optional)", { exact: true }).click();
  await page.getByRole("radio", { name: "Opens or closes a door, drawer or lid", exact: true }).check();
  await page.getByRole("radio", { name: "It slides out, like a drawer", exact: true }).check();
  await expect(page.getByLabel("How far it opens", { exact: true })).toHaveCount(0);
  await page.getByLabel("Height of the handle", { exact: true }).fill("80");
  await page.getByLabel("Unit for Height of the handle", { exact: true }).selectOption("cm");
  await page.getByLabel("How far it pulls out", { exact: true }).fill("18");
  await page.getByLabel("Unit for How far it pulls out", { exact: true }).selectOption("in");
  await page.getByRole("radio", { name: "Yes, A4", exact: true }).check();
  await page.getByRole("button", { name: "Save measurements", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Measurements saved." })).toBeVisible();
  expect(puts).toEqual([{ revision: 0, family: "articulated_open_close", articulation: "sliding",
    readings: { handle_height: { value: 80, unit: "cm" }, opening_travel: { value: 18, unit: "in" } },
    referencePaper: "a4", referenceSheetLongEdge: null, measuredBy: null, note: null }]);
  await page.screenshot({ path: info.outputPath("measurements-saved-local-fixture.png"), fullPage: true });
});

test("readings typed while the video lands on another device survive the switch to the saved layout", async ({ page }) => {
  const token = "measurements-handoff-fixture";
  let received = false;
  const puts: Array<Record<string, any>> = [];
  const empty = { ok: true, scope: "film", revision: 0, family: null, articulation: null, referencePaper: null,
    referenceSheetLongEdge: null, readings: {}, note: null, updatedAtIso: null };
  await page.route("**/api/**", route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: { ready: false, scope: "film" } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      scope: "film", captureReceived: received,
      status: { decision: "assessing", headline: "Preparing your scene", operatorAction: null, missingViews: [] } } });
    if (url.pathname.endsWith("/items")) return route.fulfill({ json: { items: [], allItemsCovered: false, requestedShots: [] } });
    if (url.pathname === `/api/site-task-brief/${token}/measurements`) {
      if (request.method() === "PUT") {
        puts.push(request.postDataJSON());
        return route.fulfill({ json: { ...empty, revision: 1, family: "rigid_pick_place" } });
      }
      return route.fulfill({ json: empty });
    }
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}`);
  await expect(page.getByRole("heading", { name: "Point your phone at this." })).toBeVisible();
  await page.getByText("Add measurements (optional)", { exact: true }).click();
  await page.getByRole("radio", { name: "Moves an object from one place to another", exact: true }).check();
  await page.getByLabel("Height of the surface where the object starts", { exact: true }).fill("30 1/4");
  await page.getByLabel("Unit for Height of the surface where the object starts", { exact: true }).selectOption("in");
  received = true; // The phone's recording lands; the next status poll switches the layout.
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("Height of the surface where the object starts", { exact: true })).toHaveValue("30 1/4");
  await page.getByRole("button", { name: "Save measurements", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Measurements saved." })).toBeVisible();
  expect(puts).toHaveLength(1);
  expect(puts[0].readings).toEqual({ pick_surface_height: { value: 30.25, unit: "in" } });
});

const READINESS_NOTE = "Blueprint invites robot teams whose robots look right for this job to evaluate it in a simulation of your site. If Blueprint recommends a team, it will be one whose evaluation of your job passed. This is a first read from what you told us and measured, not a promise that any robot can do the job.";

function readinessFixture(overrides: Record<string, unknown> = {}) {
  const notNeeded = "between spots isn't needed: the object moves 90 cm (you measured this).";
  return {
    ok: true,
    summary: "Pack finished parts into cartons",
    tracker: { steps: [
      { id: "video", label: "Video received", state: "done", detail: null, owner: "site" },
      { id: "brief", label: "Job brief confirmed", state: "done", detail: null, owner: "site" },
      { id: "measurements", label: "Measurements", state: "partial", detail: "1 of 6", owner: "site" },
      { id: "operations", label: "How the job runs today", state: "todo", detail: null, owner: "site" },
      { id: "scene", label: "Your site rebuilt in 3D", state: "in_progress", detail: null, owner: "blueprint" },
      { id: "recommendation", label: "Blueprint recommends one team", state: "pending", detail: null, owner: "blueprint" },
    ], meanwhile: "Blueprint is rebuilding your work area in 3D from your video." },
    nextThings: [
      { id: "times_per_day", action: "Tell us how many times a day the job is done", why: "It lets us work out the hours this job takes.", target: "operations" },
      { id: "weigh_object", action: "Weigh one object", why: "It tells us how much the robot has to lift.", target: "measurements" },
    ],
    operations: { timesPerDay: null, daysPerWeek: null, peopleNearby: null, updatedAtIso: null },
    workload: null,
    speed: { state: "needs_target", sentence: "Your people take about 60 seconds per cycle (measured from your video). Set a target time per cycle in your job brief, and the evaluation checks a robot against it." },
    report: {
      robotFit: {
        needs: ["It has to pick the object up and put it down at another spot.", "It can work from one place: the object moves 90 cm (you measured this)."],
        forms: [
          { id: "fixed_base_arm", label: "One arm on a fixed stand", description: "A single robot arm fixed in place at the work area.", verdict: "fits", reasons: [] },
          { id: "bimanual_arm", label: "Two arms on a fixed stand", description: "Two robot arms working together from one fixed spot.", verdict: "fits", reasons: [] },
          { id: "mobile_manipulator", label: "Arm on a wheeled base", description: "A robot arm on a base that drives between spots.", verdict: "fits", reasons: [`Driving ${notNeeded}`] },
          { id: "wheeled_humanoid", label: "Wheeled humanoid", description: "A human-like upper body with two arms, on a wheeled base.", verdict: "fits", reasons: [`Driving ${notNeeded}`] },
          { id: "humanoid", label: "Walking humanoid", description: "A human-shaped robot with two arms that walks on two legs.", verdict: "fits", reasons: [`Walking ${notNeeded}`] },
          { id: "legged_manipulator", label: "Legged robot with an arm", description: "A robot that walks on legs, such as four, with an arm on top.", verdict: "fits", reasons: [`Walking ${notNeeded}`] },
        ],
        unknowns: ["How heavy the object is. You can add it under Add measurements (optional) on this page."],
        note: READINESS_NOTE,
      },
      checklist: [
        { id: "floor_space", title: "Floor space at the station", state: "unknown", detail: "We don't know yet how much open floor is in front of the starting surface. You can add it under Add measurements (optional) on this page.", why: "A robot needs room to stand, or to drive up, beside the work." },
        { id: "power_network", title: "Power and network", state: "confirm", detail: "A power outlet near the work area, and Wi-Fi along the route for a robot that drives between spots. The robot team tells you exactly what its robot needs.", why: "A robot needs power where it works." },
      ],
      successFactors: [{ id: "exceptions", title: "Jams and damaged items", detail: "Your job mentions \"damaged\".", test: "Jams and damaged items are not in the simulation. Plan who handles them; your success target sets how many a person catches.", where: "pilot" }],
      safety: ["Before a robot works at your site, the robot team does a risk assessment of the job with you. It follows the robot-safety standards: ISO 10218, adopted in the US as ANSI/A3 R15.06, and ANSI/A3 R15.08 for robots that drive between spots.",
        "Blueprint's evaluation runs in a simulation of your site. It does not certify that any robot is safe, or that a robot will perform the same at your site."],
      examples: [{ id: "line-side-packing", name: "Line-side packing", status: "emerging", evidence: "Reported on an assembly line at a components manufacturer, packing a single product family into cartons.",
        sources: [{ label: "China Daily: humanoid robots move onto fast track", href: "https://global.chinadaily.com.cn/a/202606/11/WS6a2ac863a310d6866eb4dcd2.html" }] }],
      examplesFootnote: "These are third-party deployments cited as evidence about which environments qualify. None is a Blueprint customer and none was prepared by Blueprint.",
    },
    ...overrides,
  };
}

test("the owner sees simple next steps above the measurements, with the robot report folded and no robot team named", async ({ page }, info) => {
  const token = "readiness-fixture";
  const puts: Array<Record<string, unknown>> = [];
  let answered = false;
  await page.route("**/api/**", route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", accepts: ["mov", "mp4"], expiresAt: "2099-01-01T00:00:00Z" } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: { ready: false, scope: "owner" } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: { captureReceived: true,
      sceneViewUrl: "https://scene.example/view",
      status: { stage: "footage_received", headline: "Your footage is retained; review is pending." } } });
    if (url.pathname.endsWith("/items")) return route.fulfill({ json: { items: [], allItemsCovered: false, requestedShots: [] } });
    if (url.pathname === `/api/site-task-brief/${token}/operations` && request.method() === "PUT") {
      puts.push(request.postDataJSON());
      answered = true;
      return route.fulfill({ json: { ok: true, operations: { timesPerDay: 120, daysPerWeek: 5, peopleNearby: "shared", updatedAtIso: "2026-10-20T12:00:00.000Z" } } });
    }
    if (url.pathname === `/api/site-task-brief/${token}/readiness`) return route.fulfill({ json: answered ? readinessFixture({
      operations: { timesPerDay: 120, daysPerWeek: 5, peopleNearby: "shared", updatedAtIso: "2026-10-20T12:00:00.000Z" },
      workload: { headline: "about 10 person-hours a week", hoursPerDay: 2, hoursPerWeek: 10, sentence: "This job takes about 2 person-hours a day, about 10 a week.",
        basis: "120 times a day, 5 days a week (you told us), at about 60 seconds per cycle (measured from your video). It counts time on this job only." },
    }) : readinessFixture() });
    if (url.pathname === `/api/site-task-brief/${token}/measurements`) return route.fulfill({ json: { ok: true, scope: "owner", revision: 0,
      family: null, articulation: null, referencePaper: null, referenceSheetLongEdge: null, readings: {}, note: null, updatedAtIso: null } });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}`);
  const steps = page.getByRole("region", { name: "Your next steps" });
  await expect(steps).toHaveText("Your next stepsTell us how many times a day the job is done →Weigh one object →");
  // As little text as the site needs: the form and the full report stay folded, one number in each title.
  const report = page.locator("details", { has: page.locator("summary", { hasText: "Your robot readiness report · 6 kinds of robot fit" }) });
  await expect(report).not.toHaveAttribute("open", "");
  await expect(page.locator("details#how-the-job-runs")).not.toHaveAttribute("open", "");
  const measurements = page.getByText("Add measurements (optional)", { exact: true });
  expect((await steps.boundingBox())!.y).toBeLessThan((await measurements.boundingBox())!.y);
  await page.screenshot({ path: info.outputPath("readiness-default-local-fixture.png"), fullPage: true });

  // A next thing opens the step that answers it.
  await steps.getByRole("button", { name: "Weigh one object" }).click();
  await expect(page.locator("details#site-measurements")).toHaveAttribute("open", "");
  await steps.getByRole("button", { name: "Tell us how many times a day the job is done" }).click();
  await expect(page.locator("details#how-the-job-runs")).toHaveAttribute("open", "");

  const form = page.getByRole("form", { name: "How the job runs today" });
  await form.getByLabel("How many times a day is the job done?").fill("120");
  await form.getByLabel("On how many days a week?").selectOption("5");
  await form.getByLabel("People work in the same space").check();
  await form.getByRole("button", { name: "Save answers" }).click();
  await expect(page.getByText("How the job runs today · about 10 person-hours a week")).toBeVisible();
  expect(puts).toEqual([{ timesPerDay: 120, daysPerWeek: 5, peopleNearby: "shared" }]);

  await report.locator("summary").click();
  for (const label of ["One arm on a fixed stand", "Two arms on a fixed stand", "Arm on a wheeled base", "Wheeled humanoid",
    "Walking humanoid", "Legged robot with an arm"]) await expect(report.getByText(label, { exact: true })).toBeVisible();
  await expect(report.getByText("Checked in the pilot, not the simulation")).toBeVisible();
  await expect(report.getByRole("link", { name: "China Daily: humanoid robots move onto fast track" })).toBeVisible();
  await expect(report.getByRole("link", { name: "Print or save a one-page brief" })).toHaveAttribute("href", `/capture-upload/${token}/brief`);
  await expect(page.locator("body")).not.toContainText(/\bmatch/i);
  await page.screenshot({ path: info.outputPath("readiness-panel-local-fixture.png"), fullPage: true });
});

test("the one-page robot readiness brief lays out the report to print", async ({ page }, info) => {
  const token = "readiness-brief-fixture";
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    if (url.pathname === `/api/site-task-brief/${token}/readiness`) return route.fulfill({ json: readinessFixture() });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}/brief`);
  await expect(page.getByRole("heading", { level: 1, name: "Pack finished parts into cartons" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Where things stand" }).getByText("Video received")).toBeVisible();
  await expect(page.getByRole("region", { name: "Robot readiness report" }).getByText("Walking humanoid", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "What is left to check" }).getByText("Weigh one object")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Print or save as PDF" })).toBeHidden();
  await page.screenshot({ path: info.outputPath("readiness-brief-print-local-fixture.png"), fullPage: true });
});
