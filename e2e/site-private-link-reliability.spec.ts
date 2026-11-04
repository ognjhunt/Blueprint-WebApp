import { expect, test } from "@playwright/test";

const legacyJobWorkflow = () => ({
  schemaVersion: "job_marketplace.v1", revision: "fixture-revision", stage: "job_submitted",
  requirements: { purchaseReadiness: "unsure", jobFrequency: null, requiredOutput: null,
    installationBudget: null, ongoingBudget: null, currentProcessCost: null, targetStartDate: null },
  briefAgreed: false, optionsAssessed: false, reviewRequired: false,
  nextAction: "Review the job brief with Blueprint.", actionOwner: "site",
  review: null,
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
  await expect(page.getByText("Review or correct job details (optional)", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "This is right — confirm it", exact: true })).toBeHidden();
  await expect(page.getByRole("button", { name: "Try assessment again", exact: true })).toBeHidden();
  await page.getByText("Processing details", { exact: true }).click();
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
  await expect(page.getByRole("button", { name: "Try assessment again", exact: true })).toBeHidden();
  await page.getByText("Processing details", { exact: true }).click();
  await page.getByRole("button", { name: "Try assessment again", exact: true }).click();
  await expect.poll(() => retries.length).toBe(2);
  expect(retries[1]).toEqual(retries[0]);
  await expect(page.getByText("Your assessment retry is recorded. Your recording is saved; keep this page to follow progress.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try assessment again", exact: true })).toHaveCount(0);
  await expect(page.getByText("Add photos of the job items", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Add measurements/)).toHaveCount(0);
  expect(asks).toEqual([]);
  await page.screenshot({path:info.outputPath("video-only-saved-job-local-fixture.png"),fullPage:true});
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "This is right — confirm it", exact: true })).toBeHidden();
  expect(writes).toEqual([`/api/self-capture/uploads/${token}/advisory-retry`, `/api/self-capture/uploads/${token}/advisory-retry`]);
  await expect(page.getByText("Your job brief is confirmed.", { exact: false })).toHaveCount(0);
});

test("returning owner keeps the received recording and gets same-job update guidance without new writes", async ({ page }, info) => {
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
  await expect(page.getByText("Review or correct job details (optional)", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "This is right — confirm it", exact: true })).toBeHidden();
  await expect(page.getByText("Next action · You", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Blueprint is preparing your reconstruction.", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Upload a new recording", exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByText("Next action · You", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Upload a new recording", exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  const update = page.locator("details").filter({ has: page.getByText("Update walkthrough (optional)", { exact: true }) });
  await expect(update).toContainText("If your job or recording has changed, you can send a complete updated walkthrough.");
  await expect(update).toContainText("Your job and original video stay saved.");
  await expect(update.getByRole("button", { name: "Update walkthrough", exact: true })).toBeHidden();
  await page.getByText("Update walkthrough (optional)", { exact: true }).click();
  await expect(update.getByRole("button", { name: "Update walkthrough", exact: true })).toBeEnabled();
  await expect(page.getByRole("link", { name: "contact Blueprint", exact: true })).toHaveCount(0);
  await expect(page.getByText(/starting a new job|new job needs its own review/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "This is right — confirm it", exact: true })).toBeHidden();
  await expect(page.getByText("Your job brief is confirmed.", { exact: false })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("retained-recording-same-job-guidance.png"), fullPage: true });
  // Neither returning nor reloading uploads bytes, grants new permission, or confirms the brief.
  expect(writes).toEqual([]);
});

test("the owner confirms how success is judged, in plain words, with no number to edit", async ({ page }, info) => {
  const token = "success-thresholds-fixture";
  const proposalDigest = `sha256:${"1".repeat(64)}`;
  const decisions: unknown[] = [];
  const thresholds = (decision: unknown) => ({ proposalDigest, decision,
    rows: [{ label: "Goal area", value: "The green spot: a circle 30 cm across. The whole object has to end up inside it." },
      { label: "Force", value: "The robot pushes on the object with no more than 100 N (about the weight of 10 kg)." },
      { label: "Drops", value: "The object is never dropped." }],
    otherValues: [{ label: "authority", value: "deterministic_simulator_state" }] });
  await page.route("**/api/**", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith("/api/job-workflow/owner/") && request.method() === "GET") return route.fulfill({ json: legacyJobWorkflow() });
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"] } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: {
      ready: true, scope: "owner", brief: { summary: "Book onto the green spot", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: "2026-11-01T00:00:00Z" } } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      ok: true, scope: "owner", captureReceived: true,
      status: { decision: "assessing", headline: "Blueprint is preparing your scene.", operatorAction: null, missingViews: [] },
      successThresholds: thresholds(decisions.length ? { kind: "confirmed", reason: null, decidedAt: "2026-11-03T18:00:00.000Z" } : null) } });
    if (url.pathname === `/api/site-task-brief/${token}/success-thresholds` && request.method() === "POST") {
      decisions.push(request.postDataJSON());
      return route.fulfill({ json: { ok: true, decision: "confirmed", reason: null, decidedAt: "2026-11-03T18:00:00.000Z" } });
    }
    if (url.pathname.endsWith("/items")) return route.fulfill({ json: { items: [], allItemsCovered: false, requestedShots: [] } });
    if (url.pathname.endsWith("/follow-up")) return route.fulfill({ json: { questions: [] } });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}?video=existing`);
  const section = page.getByRole("region", { name: "How success is judged" });
  await expect(section.getByRole("heading", { name: "How success is judged" })).toBeVisible();
  await expect(section.getByText("The green spot: a circle 30 cm across. The whole object has to end up inside it.")).toBeVisible();
  await expect(section.getByText("Robot scoring waits until you confirm these goals.")).toBeVisible();
  await expect(section.getByText("deterministic_simulator_state")).toBeHidden();
  await expect(section.locator("input:not([type=radio])")).toHaveCount(0);
  await section.getByRole("button", { name: "Something is wrong" }).click();
  await expect(section.getByRole("button", { name: "Hold the job" })).toBeDisabled();
  await expect(section.getByLabel("The goal area is in the wrong place")).toBeVisible();
  await page.screenshot({ path: info.outputPath("success-thresholds-proposed.png"), fullPage: true });
  await section.getByRole("button", { name: "Use these goals" }).click();
  await expect(section.getByText("You confirmed these goals. Blueprint scores robot candidates against them.")).toBeVisible();
  expect(decisions).toEqual([{ proposalDigest, decision: "confirm" }]);
  await page.screenshot({ path: info.outputPath("success-thresholds-confirmed.png"), fullPage: true });
});

test("the owner is asked in plain words before a chair is moved out of the robot's way in the simulation", async ({ page }, info) => {
  const token = "robot-access-fixture";
  const proposalDigest = `sha256:${"2".repeat(64)}`;
  const decisions: unknown[] = [];
  const robotAccess = (decision: unknown) => ({ proposalDigest, decision, what: "1 chair",
    why: "In the simulation of your site, the robot arm can't stand close enough to reach the job: 1 chair is in the way.",
    question: "To give the robot room, Blueprint would move 1 chair away from the wooden dining table in the simulation. Approve?",
    note: "Only the simulation changes; your site and your video stay as they are. The chair may still show in the simulation's pictures, but the robot is no longer blocked by it. Results stay estimates.",
    items: ["dining chair by the window"], approve: "Move it in the simulation", decline: "Keep it where it is",
    approved: "You approved this. Blueprint moves 1 chair in the simulation and checks again whether the robot can reach the job.",
    declined: "You chose to keep 1 chair where it is. The robot can't stand within reach, so this job is on hold. You can still approve if you change your mind." });
  await page.route("**/api/**", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.startsWith("/api/job-workflow/owner/") && request.method() === "GET") return route.fulfill({ json: legacyJobWorkflow() });
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"] } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: {
      ready: true, scope: "owner", brief: { summary: "Tray to the other end of the table", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: "2026-11-01T00:00:00Z" } } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      ok: true, scope: "owner", captureReceived: true,
      status: { decision: "assessing", headline: "Blueprint is preparing your scene.", operatorAction: null, missingViews: [] },
      robotAccess: robotAccess(decisions.length ? { kind: "approved", decidedAt: "2026-11-04T09:00:00.000Z" } : null) } });
    if (url.pathname === `/api/site-task-brief/${token}/robot-access` && request.method() === "POST") {
      decisions.push(request.postDataJSON());
      return route.fulfill({ json: { ok: true, decision: "approved", decidedAt: "2026-11-04T09:00:00.000Z" } });
    }
    if (url.pathname.endsWith("/items")) return route.fulfill({ json: { items: [], allItemsCovered: false, requestedShots: [] } });
    if (url.pathname.endsWith("/follow-up")) return route.fulfill({ json: { questions: [] } });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}?video=existing`);
  const section = page.getByRole("region", { name: "Room for the robot" });
  await expect(section.getByRole("heading", { name: "Room for the robot" })).toBeVisible();
  await expect(section.getByText("To give the robot room, Blueprint would move 1 chair away from the wooden dining table in the simulation. Approve?")).toBeVisible();
  await expect(section.getByText("dining chair by the window")).toBeVisible();
  await expect(section.getByText("Nothing changes until you answer.")).toBeVisible();
  await expect(section.locator("input")).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("robot-access-proposed.png"), fullPage: true });
  await section.getByRole("button", { name: "Move it in the simulation" }).click();
  await expect(section.getByText("You approved this. Blueprint moves 1 chair in the simulation and checks again whether the robot can reach the job.")).toBeVisible();
  expect(decisions).toEqual([{ proposalDigest, decision: "approve" }]);
  await page.screenshot({ path: info.outputPath("robot-access-approved.png"), fullPage: true });
});

test("the current simulation estimate is visible while technical references stay folded", async ({ page }, info) => {
  const token = "scored-result-fixture";
  const writes: string[] = [];
  await page.route("**/api/**", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET" && url.pathname !== "/api/analytics/ingest") writes.push(url.pathname);
    if (url.pathname.startsWith("/api/job-workflow/owner/")) return route.fulfill({ json: {
      ...legacyJobWorkflow(), managedEvidence: [{ runId: "accepted-evaluation", state: "completed", outcome: "estimate", current: true,
        resultDigest: "sha256:fixture-result", summary: "Your job's simulation estimate: 1 candidate ran, with 3 episodes scored.",
        nextAction: "Blueprint uses this estimate to recommend the next step.",
        limitations: ["Simulation does not certify physical performance or safety."], href: "#managed-evidence-accepted-evaluation",
        screening: { candidates: [{ candidateId: "candidate-1", name: "Current candidate", state: "completed",
          planned: 3, scored: 3, succeeded: 2, failed: 1, void: 0, blockers: [],
          successRange: { lowerPercent: 21, upperPercent: 94, confidencePercent: 95 } }] } }],
    } });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"],
    } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: {
      ready: true, scope: "owner", brief: { summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null },
    } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      scope: "owner", captureReceived: true, status: { decision: "confirm_brief", headline: "Review your job brief.", operatorAction: null, missingViews: [] },
    } });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByRole("heading", { name: "Your simulation estimate" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Candidates evaluated for your job" })).toBeVisible();
  await expect(page.getByText("Succeeded in 2 of 3 scored tries; likely between 21% and 94%.")).toBeVisible();
  await expect(page.getByText("1 failed · 0 unscorable")).toBeVisible();
  await expect(page.getByText("Simulation does not certify physical performance or safety.")).toBeVisible();
  await expect(page.getByText("Technical evidence and test details").locator("..")).not.toHaveAttribute("open");
  await expect(page.getByText(/Run: accepted-evaluation/)).not.toBeVisible();
  expect(writes).toEqual([]);
  await page.screenshot({ path: info.outputPath("current-simulation-result-visible.png"), fullPage: true });
});

test("a held result says the same plain sentence as the headline, with plain reasons and no operator words", async ({ page }, info) => {
  const token = "held-result-fixture";
  const sentence = "No match: none of the robots we can simulate matched this job. At least one was measured out of reach from the robot position planned in the scene built from your video.";
  const writes: string[] = [];
  await page.route("**/api/**", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET" && url.pathname !== "/api/analytics/ingest") writes.push(url.pathname);
    // As the server sends a site's view: no operator instruction and no budget figure.
    if (url.pathname.startsWith("/api/job-workflow/owner/")) return route.fulfill({ json: {
      ...legacyJobWorkflow(), managedEvidence: [{ runId: "held-evaluation", state: "held", outcome: "no_match", current: true,
        resultDigest: "sha256:fixture-held", summary: sentence,
        nextAction: "Nothing is needed from you. Each row lists the measured reason or why it could not run.",
        limitations: ["A simulation result is a bounded estimate. It does not certify physical performance or safety."],
        href: "#managed-evidence-held-evaluation", screening: { candidates: [
          { candidateId: "candidate-1", name: "Reach candidate", state: "infeasible", planned: 3, scored: 0, succeeded: 0, failed: 0, void: 0,
            blockers: ["candidate_infeasible_measured_geometry", "team_embodiment_station_out_of_reach"] },
          { candidateId: "candidate-2", name: "Other candidate", state: "blocked", planned: 3, scored: 0, succeeded: 0, failed: 0, void: 0,
            blockers: ["task_kind_not_supported_by_candidate"] }] } }],
    } });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"],
    } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: {
      ready: true, scope: "owner", brief: { summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null },
    } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      scope: "owner", captureReceived: true, status: { decision: "assessing", headline: `${sentence} Nothing is needed from you.`,
        operatorAction: null, missingViews: [] },
    } });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText(`${sentence} Nothing is needed from you.`, { exact: true })).toBeVisible();
  const results = page.getByRole("region", { name: "Simulation results for your job" });
  await expect(results.getByText(sentence, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simulation evaluation" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your simulation estimate" })).toHaveCount(0);
  await expect(results.getByText(/^Out of reach · 0\/3 scored/)).toBeVisible();
  await results.getByText("Recorded limitations").first().click();
  await expect(results.getByText("Measured out of reach from the robot position planned in your scene.")).toBeVisible();
  const text = await results.textContent();
  expect(text).not.toMatch(/[a-z]_[a-z]|measured geometry|task kind not supported|rerun|setup blockers|development only|budget|\$/i);
  expect(text).not.toMatch(/can't simulate this kind of job/);
  expect(writes).toEqual([]);
  await page.screenshot({ path: info.outputPath("held-no-match-result.png"), fullPage: true });
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

const READINESS_NOTE = "Blueprint runs candidate robots and policies that look right for this job in a simulation of your site and shows you a bounded estimate of what works. This is a first read from your video, not a promise that any robot can do the job.";

function readinessFixture(overrides: Record<string, unknown> = {}) {
  const notNeeded = "between spots isn't needed: the object moves about 90 cm (estimated from your video).";
  return {
    ok: true,
    summary: "Sort parcels onto outbound chutes",
    tracker: { steps: [
      { id: "video", label: "Video received", state: "done", owner: "site" },
      { id: "brief", label: "Job brief confirmed", state: "done", owner: "site" },
      { id: "scene", label: "Your site rebuilt in 3D", state: "in_progress", owner: "blueprint" },
      { id: "evaluation", label: "Blueprint evaluates candidate robots and policies in simulation", state: "pending", owner: "blueprint" },
      { id: "recommendation", label: "Blueprint shows you what works", state: "pending", owner: "blueprint" },
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
        { id: "floor_space", title: "Floor space at the station", state: "confirm", detail: "The deployment partner confirms the floor space its robot needs beside the work." },
        { id: "power_network", title: "Power and network", state: "confirm", detail: "A power outlet near the work area, and Wi-Fi along the route for a robot that drives between spots. The deployment partner tells you exactly what its robot needs." },
      ],
      successFactors: [{ id: "variety", title: "How many different items",
        detail: "Probably also handled here, though not in your video: flat envelopes, padded mailers (estimated from your video).",
        test: "The evaluation tests the object in your rebuilt scene. Other items are checked in the pilot.", where: "pilot" }],
      safety: ["Before a robot works at your site, ask the deployment partner for its risk assessment of the job. Robot safety follows the standards ISO 10218, adopted in the US as ANSI/A3 R15.06, and ANSI/A3 R15.08 for robots that drive between spots.",
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
