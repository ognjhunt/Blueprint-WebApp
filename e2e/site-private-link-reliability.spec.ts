import { expect, test } from "@playwright/test";
import { earlyTaskHoldOutcome, projectPreparationOutcome } from "../server/utils/taskPreparationOutcome";
import { projectTaskStatus, taskStatusInputFrom } from "../server/utils/taskStatusProjection";

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

// The per-job site assessment has ended (2026-11-11): no retry is offered, the retry fields are never read, and
// "Processing details" appears only for an older job that already has a finished assessment (rewritten from the
// retry journey).
test("a saved job shows no assessment retry, and processing details only for a finished older assessment", async ({ page }, info) => {
  const token = "advisory-retry-fixture";
  let advisoryState = "needs_review";
  const writes: string[] = [];
  const asks: string[] = [];
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/job-workflow/owner/") && route.request().method() === "GET") return route.fulfill({ json: legacyJobWorkflow() });
    if (route.request().method() !== "GET" && url.pathname !== "/api/analytics/ingest") writes.push(url.pathname);
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"],
    } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: {
      ready: true, scope: "owner", brief: { summary: "Cartons onto a pallet", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null },
    } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      scope: "owner", captureReceived: true, status: { decision: "confirm_brief", headline: "Review your job brief.", operatorAction: null, missingViews: [] },
      siteAdvisory: { schemaVersion: "site_customer_advisory.v1", state: advisoryState, correlationId: "bp-advisory-aaaaaaaaaaaaaaaa", sections: [], unknowns: [], nextAction: null },
      // An older server still sends these; the page never reads them.
      assessment_retry_available: true, assessment_job_id: "job-1", assessment_run_id: "run-1",
    } });
    // The site sends its video and nothing else: no item photos, measurements or follow-up questions are read.
    if (/\/(items|clarification|follow-up|measurements)$/.test(url.pathname)) asks.push(url.pathname);
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirm your job description", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "This is right — confirm it", exact: true })).toBeHidden();
  await expect(page.getByText("Earlier video notes", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try assessment again", exact: true })).toHaveCount(0);
  // An older job with a finished assessment keeps it, folded, with no retry.
  advisoryState = "ready";
  await page.reload();
  await page.getByText("Earlier video notes", { exact: true }).click();
  await expect(page.getByText("These notes are from an earlier check of your video and job details.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try assessment again", exact: true })).toHaveCount(0);
  await expect(page.getByText("Add photos of the job items", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Add measurements/)).toHaveCount(0);
  expect(asks).toEqual([]);
  await page.screenshot({path:info.outputPath("video-only-saved-job-local-fixture.png"),fullPage:true});
  expect(writes).toEqual([]);
  await expect(page.getByText("Your job description is confirmed.", { exact: false })).toHaveCount(0);
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
  await expect(page.getByText("Confirm your job description", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "This is right — confirm it", exact: true })).toBeHidden();
  await expect(page.getByText("Next action · You", { exact: true })).toHaveCount(0);
  await expect(page.getByText("We're preparing your job. Nothing is needed from you.", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Upload a new recording", exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.getByText("Video received.", { exact: true })).toBeVisible();
  await expect(page.getByText("Next action · You", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Upload a new recording", exact: true })).toHaveCount(0);
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  const update = page.locator("details").filter({ has: page.locator("summary").getByText("Send a new video", { exact: true }) });
  await expect(update).toContainText("Your job and first video stay saved.");
  await expect(update.getByRole("button", { name: "Send a new video", exact: true })).toBeHidden();
  await page.locator("summary").getByText("Send a new video", { exact: true }).click();
  await expect(update.getByRole("button", { name: "Send a new video", exact: true })).toBeEnabled();
  await expect(page.getByRole("link", { name: "contact Blueprint", exact: true })).toHaveCount(0);
  await expect(page.getByText(/starting a new job|new job needs its own review/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "This is right — confirm it", exact: true })).toBeHidden();
  await expect(page.getByText("Your job description is confirmed.", { exact: false })).toHaveCount(0);
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
  await expect(section.getByText("You can confirm these goals, or tell us what is wrong.")).toBeVisible();
  await expect(section.getByText("deterministic_simulator_state")).toBeHidden();
  await expect(section.locator("input:not([type=radio])")).toHaveCount(0);
  await section.getByRole("button", { name: "Something is wrong" }).click();
  await expect(section.getByRole("button", { name: "Send this reason" })).toBeDisabled();
  await expect(section.getByLabel("The goal area is in the wrong place")).toBeVisible();
  await page.screenshot({ path: info.outputPath("success-thresholds-proposed.png"), fullPage: true });
  await section.getByRole("button", { name: "Use these goals" }).click();
  await expect(section.getByText("You confirmed these goals.")).toBeVisible();
  expect(decisions).toEqual([{ proposalDigest, decision: "confirm" }]);
  await page.screenshot({ path: info.outputPath("success-thresholds-confirmed.png"), fullPage: true });
});

test("the owner is not asked about moving a chair, even when an older server still sends the question", async ({ page }, info) => {
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
  await expect(page.getByText("Blueprint is preparing your scene.").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Room for the robot" })).toHaveCount(0);
  await expect(page.getByText("To give the robot room, Blueprint would move 1 chair away from the wooden dining table in the simulation. Approve?")).toHaveCount(0);
  expect(decisions).toEqual([]);
  await page.screenshot({ path: info.outputPath("robot-access-not-asked.png"), fullPage: true });
});

test("an older job's stored early trial result is not shown, and nothing is written", async ({ page }, info) => {
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
        screening: { candidates: [{ candidateId: "candidate-1", name: "Arm with suction gripper", state: "completed",
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
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("region", { name: "Early trial of openly available robot software" })).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Candidates evaluated for your job" })).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toMatch(/early trial|openly available|Arm with suction gripper/i);
  expect(writes).toEqual([]);
  await page.screenshot({ path: info.outputPath("stored-trial-result-hidden.png"), fullPage: true });
});

test("a held result says the status card's plain sentence, and shows no early trial", async ({ page }, info) => {
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
  await expect(page.getByRole("region", { name: "Early trial of openly available robot software" })).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toMatch(/early trial|openly available|rerun|setup blockers/i);
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

function heldJobRoutes(page: import("@playwright/test").Page, token: string, summary: string, status: Record<string, unknown>,
  writes: string[]) {
  return page.route("**/api/**", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET" && url.pathname !== "/api/analytics/ingest") writes.push(url.pathname);
    if (url.pathname.startsWith("/api/job-workflow/owner/")) return route.fulfill({ json: legacyJobWorkflow() });
    if (url.pathname === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"] } });
    if (url.pathname === `/api/site-task-brief/${token}`) return route.fulfill({ json: {
      ready: true, scope: "owner", brief: { summary, captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } } });
    if (url.pathname === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: status });
    if (url.pathname.endsWith("/items")) return route.fulfill({ json: { items: [], allItemsCovered: false, requestedShots: [] } });
    if (url.pathname.endsWith("/follow-up")) return route.fulfill({ json: { questions: [] } });
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
}

test("a job no robot we checked fits is on hold, said as an estimate from the precheck alone", async ({ page }, info) => {
  const token = "robot-fit-hold-fixture";
  const digest = `sha256:${"f".repeat(64)}`;
  const counts = { fit: 0, noFit: 8, unknown: 0, unavailable: 128 };
  // The server's own projection of a v6 hold (Pipeline #3336), as the status route sends it to the owner.
  const outcome = projectPreparationOutcome({ category: "robot_incompatibility", reason: "robot_fit_none",
    basis: "conservative_pre_spend_fit_check", robot_id: null, evidence_digest: digest },
  { holdReason: "website_robot_fit_none:reach", precheckDigest: digest, counts });
  const writes: string[] = [];
  await heldJobRoutes(page, token, "Pick up the tray and put it on the counter", {
    ok: true, scope: "owner", captureReceived: true,
    status: { decision: outcome.category, headline: outcome.title, operatorAction: null, missingViews: [], outcome },
    robotFitHold: { status: "no_fit", holdReason: "website_robot_fit_none:reach", taskKind: "rigid_pick_place", counts,
      embodiments: [{ embodiment: "droid_franka_panda_robotiq_2f85_v1", verdict: "no_fit", reasons: ["reach"] }],
      embodimentsTruncated: false, precheckDigest: digest },
  }, writes);
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText("The simulation is on hold: none of the robots we checked fits this job", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/None of the 136 robots we checked fits this job\. The main reason: the spot where the object is picked up or put down is farther than their arms can reach\./).first()).toBeVisible();
  const checked = page.getByRole("region", { name: "Robots we checked" });
  await expect(checked.getByRole("heading", { name: "Robots we checked" })).toBeVisible();
  await expect(checked.getByText("None of the robots we checked fits this job. This is an estimate from your video; it does not mean no robot could do the job.")).toBeVisible();
  const text = await checked.textContent();
  expect(text).not.toMatch(/[a-z]_[a-z]|website_robot_fit|sha256|physical test passed|certif|Franka|setups|software|paid work/i);
  expect(writes).toEqual([]);
  await page.screenshot({ path: info.outputPath("robot-fit-hold.png"), fullPage: true });
});

test("a job we can't simulate yet is held in one plain sentence, never as a processing failure", async ({ page }, info) => {
  const token = "early-task-hold-fixture";
  // The server's own projection of the Pipeline's early hold, as the status route sends it to the owner.
  const outcome = earlyTaskHoldOutcome("website_native_task_profile_preparation_required", `sha256:${"e".repeat(64)}`);
  const writes: string[] = [];
  await heldJobRoutes(page, token, "Close the fire door at the end of the hall", { ok: true, scope: "owner", captureReceived: true,
    status: { decision: outcome.category, headline: outcome.title, operatorAction: null, missingViews: [], outcome } }, writes);
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText("The simulation is held: we can't simulate this kind of job yet.", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/This says nothing about whether a robot could do the job\. Your first look stays on your job page\./).first()).toBeVisible();
  const body = await page.locator("body").textContent();
  expect(body).not.toMatch(/could not finish processing|website_native|preparation_required|we'll run|email you when|Next step|next step is with Blueprint/i);
  expect(writes).toEqual([]);
  await page.screenshot({ path: info.outputPath("early-task-hold.png"), fullPage: true });
});

test("a job with several steps is accepted and told what any accepted job is told, never held for its steps", async ({ page }, info) => {
  const token = "multi-step-accepted-fixture";
  const summary = "Take the plates to the kitchen then load the dishwasher";
  // The server's own status for this job, as projectTaskStatus sends it: the same as for a job of one step.
  const status = projectTaskStatus(taskStatusInputFrom({ briefDrafted: true, stage: null, hasStoredCapture: true,
    site_task_brief_confirmed_at: "2026-11-18", site_task_scope: { supported: false, reason: "multi_step" } }));
  expect(status).toEqual(projectTaskStatus(taskStatusInputFrom({ briefDrafted: true, stage: null, hasStoredCapture: true,
    site_task_brief_confirmed_at: "2026-11-18", site_task_scope: { supported: true, kind: "rigid_pick_and_place" } })));
  const writes: string[] = [];
  await heldJobRoutes(page, token, summary, { ok: true, scope: "owner", captureReceived: true, status }, writes);
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText(status.headline, { exact: true }).first()).toBeVisible();
  const body = await page.locator("body").textContent();
  expect(body).not.toMatch(/on hold|more than one step|one step at a time|split|this kind of job/i);
  expect(writes).toEqual([]);
  await page.screenshot({ path: info.outputPath("multi-step-accepted.png"), fullPage: true });
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
  // The optional sentence confirms the brief at submission (owner direction 2026-11-11).
  if (!await page.locator("#start-task").isVisible()) await page.getByText("Add details (optional)", { exact: true }).click(); await page.locator("#start-task").fill("Move sealed cartons onto a pallet");
  await page.locator("#start-location").fill("Austin, TX"); await page.locator("#start-region").selectOption("us");
  await page.locator("#start-email").fill("operator@example.test");
  await page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ }).click();
  await expect(page.getByRole("heading", { name: "Now film the job." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open my job page ›", exact: true })).toHaveAttribute("href", "/capture-upload/held-fixture");
  received = true;
  await page.clock.fastForward(6000);
  await expect(page.getByRole("heading", { name: "We have your video." })).toBeVisible();
  await expect(page.getByText("Your video is retained. Recording permission needs review.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open my job" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the camera" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start processing again" })).toHaveCount(0);
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

// The readiness report and its printable brief were removed (2026-11-12). Where the folded report used to appear (a
// saved owner job with no answer yet), the page says where the job stands and asks for nothing.
test("the owner of a saved job with no answer yet sees where it stands, with no readiness report", async ({ page }, info) => {
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
    if (/\/(items|clarification|follow-up|measurements|operations|readiness)$/.test(url.pathname)) asks.push(url.pathname);
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  await page.goto(`/capture-upload/${token}`);
  await expect(page.getByText("Your footage is retained; review is pending.").first()).toBeVisible();
  await expect(page.getByText(/readiness report/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Print or save the brief" })).toHaveCount(0);
  // The owner's page never names a robot team or matches one to the job (privacy; the site sees only aliases).
  await expect(page.locator("body")).not.toContainText(/\bmatch|Galbot|Robot Era/i);
  expect(asks).toEqual([]);
  await page.screenshot({ path: info.outputPath("saved-job-no-readiness-local-fixture.png"), fullPage: true });
});

test("an old readiness brief link lands on the home page, carrying nothing of the link", async ({ page }) => {
  await page.goto("/readiness-brief/brief-token.signature");
  await expect(page).toHaveURL(/\/$/);
});

// WP-11: the fourth outcome on the job page. Only scripted reference baselines
// were scored, so the run is not called an estimate; the site reads the same
// sentence in the headline and the results, and each baseline row says what it is.
test("a run with only scripted reference baselines is not called an estimate, and shows no early trial", async ({ page }, info) => {
  const token = "reference-only-result-fixture";
  const sentence = "No estimate yet: only scripted reference baselines were scored, and no learned policy could be evaluated on your job yet.";
  const writes: string[] = [];
  await page.route("**/api/**", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET" && url.pathname !== "/api/analytics/ingest") writes.push(url.pathname);
    // As server/utils/jobManagedEvaluation.ts sends a reference_only run to the site.
    if (url.pathname.startsWith("/api/job-workflow/owner/")) return route.fulfill({ json: {
      ...legacyJobWorkflow(), managedEvidence: [{ runId: "reference-evaluation", state: "reference_only", outcome: "reference_only", current: true,
        resultDigest: "sha256:fixture-reference", summary: sentence,
        nextAction: "Nothing is needed from you. Each row shows what ran, or why it could not run.",
        limitations: ["Scripted baselines use simulator state. Their outcomes do not establish learned-policy or vendor-policy performance.",
          "A simulation result is a bounded estimate. It does not certify physical performance or safety."],
        href: "#managed-evidence-reference-evaluation", screening: { candidates: [
          { candidateId: "candidate-1", name: "Scripted pick baseline", state: "completed", planned: 3, scored: 3, succeeded: 2, failed: 1, void: 0,
            blockers: [], successRange: { lowerPercent: 21, upperPercent: 94, confidencePercent: 95 },
            executionEvidence: { execution_evidence_kind: "scripted_simulator_state_baseline", action_source: "scripted_simulator_state",
              scripted_rollout_count: 3, learned_policy_rollout_count: 0, scripted_controller_invoked: true, candidate_policy_queried: false } }] } }],
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
  await expect(page.getByRole("region", { name: "Early trial of openly available robot software" })).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toMatch(/early trial|openly available|did best|your simulation estimate is ready/i);
  expect(writes).toEqual([]);
  await page.screenshot({ path: info.outputPath("reference-only-result.png"), fullPage: true });
});
