import { devices, expect, test, type Page } from "@playwright/test";
import { bareRhythmFindings } from "./helpers/bare-rhythm";
import { SCENE_NOTE_BEYOND_REACH, allZeroEvaluation, preparingEvaluation, readyAnswer, serverOutlookFor, winnerEvaluation } from "../client/tests/fixtures/siteAnswer";
import { projectSimulationProof } from "../client/src/lib/simulationProof";

/**
 * The site's job page leads with its answer. Every API the page reads is
 * mocked here; no request leaves the browser.
 */
const token = "site-answer-fixture";

/** The winner case, with the selection the server records for it. */
const simulationRun = { ...winnerEvaluation, screening: { ...winnerEvaluation.screening!,
  selection: { status: "chosen" as const, selectionDigest: `sha256:${"e".repeat(64)}`, tiedWith: [],
    chosen: { candidateId: "pi05_droid", name: "π0.5 DROID", successRate: 0.7, scored: 10, succeeded: 7, configurationId: null,
      policyRouteId: null, deploymentCompanies: [], relationship: null, evidenceUrl: null, relatedTeams: [], partnerBlockers: [], registryTeams: [] },
    candidates: [{ candidateId: "pi05_droid", resultRank: 1, choiceBlocker: null }] } } };
const FIND = "Find a company to set it up";
const CONSENT = "Shares a summary of your job and your answer, including later test results, without saying who you are, with companies we've approved. Your video, address and contacts stay private.";
const LISTED = "✓ Shared. We'll email you when a company replies.";
const UNLISTED = "You asked on November 11, 2026. Blueprint will set up your job card and email you.";
/** Visible words on the page body: what a person reads before tapping anything. */
const visibleWords = (page: Page) => page.evaluate(() => ((document.querySelector(".ms-capture-body") as HTMLElement).innerText.match(/[^\s]+/g) ?? [])
  .filter(word => /[\p{L}\p{N}]/u.test(word)).length);

const workflow = {
  schemaVersion: "job_marketplace.v1", revision: "fixture-revision", stage: "brief_agreed",
  requirements: { purchaseReadiness: "unsure", jobFrequency: null, requiredOutput: null,
    installationBudget: null, ongoingBudget: null, currentProcessCost: null, targetStartDate: null },
  briefAgreed: true, optionsAssessed: false, reviewRequired: false,
  nextAction: "Blueprint is preparing your job.", actionOwner: "blueprint", review: null,
};

async function mockJob(page: Page, { evaluation = simulationRun as unknown, listed = true }: { evaluation?: unknown; listed?: boolean } = {}) {
  const introductions: Array<{ csrf: string | undefined }> = [];
  const unexpected: string[] = [];
  let requestedAtIso: string | null = null;
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue() : route.fulfill({ status: 204, body: "" }));
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.fulfill({ status: 204, body: "" });
    const path = url.pathname, method = route.request().method();
    if (path === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (path === "/api/analytics/ingest") return route.fulfill({ status: 204, body: "" });
    if (path === `/api/job-workflow/owner/${token}` && method === "GET") return route.fulfill({ json: { ...workflow, managedEvidence: evaluation ? [evaluation] : [] } });
    if (path === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"] } });
    if (path === `/api/self-capture/uploads/${token}/withdrawal`) return route.fulfill({ json: { ok: true, withdrawn: false } });
    if (path === `/api/site-task-brief/${token}`) return route.fulfill({ json: { ready: true, scope: "owner", account: null, brief: {
      summary: readyAnswer.job.sentence, captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } } });
    if (path === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      scope: "owner", captureReceived: true, answer: { ...readyAnswer, introductionRequestedAtIso: requestedAtIso, jobCardListed: requestedAtIso !== null && listed },
      // The job's outlook as the server decides it for this answer and evaluation (the page renders by it).
      outlook: serverOutlookFor(readyAnswer, projectSimulationProof({ evaluation: (evaluation ? [evaluation] : []) as never, pick: null })),
      status: { decision: "footage_received", headline: "We have your recording.", operatorAction: null, missingViews: [], nextUpdateIso: null } } });
    if (path === `/api/site-task-brief/${token}/introduction-request` && method === "POST") {
      introductions.push({ csrf: route.request().headers()["x-csrf-token"] });
      requestedAtIso ??= "2026-11-11T15:00:00.000Z";
      return route.fulfill({ json: { ok: true, requestedAtIso, listed } });
    }
    if (path === `/api/site-task-brief/${token}/readiness`) return route.fulfill({ json: { ok: true, summary: null, report: null,
      briefPath: null, tracker: { steps: [], meanwhile: null } } });
    // The card goes on under the statement that shares the answer when the request lists it, as the server does.
    if (path === `/api/task-listings/owner/${token}`) return route.fulfill({ json: { thumbnailPng: null,
      listing: requestedAtIso && listed ? { enabled: true, consentVersion: "public-task-card-with-answer-v3" } : null } });
    unexpected.push(`${method} ${path}`);
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  return { introductions, unexpected };
}

test.use({ serviceWorkers: "block" });

test("the simulation test leads the job page, bare bones: the option, plain ticks, how sure, the paper pick a tap away, one button", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  const answer = page.getByRole("region", { name: "Your answer" });
  // 7 of 10 against 3 of 10 is about 0.96 under the probability rule: ahead, not "did best".
  await expect(answer.getByRole("heading", { level: 2, name: "Was ahead on your job" })).toBeVisible();
  await expect(answer.locator(".bare-big", { hasText: /^Franka arm \+ π0\.5$/ })).toBeVisible();
  await expect(answer.getByText("AI software by Physical Intelligence", { exact: true })).toBeVisible();
  const titleBox = await page.getByRole("heading", { level: 1, name: "Your job" }).boundingBox();
  expect(titleBox!.y).toBeLessThan((await answer.boundingBox())!.y);
  // Nothing is asked of the site: no status card repeating a wait under the answer.
  await expect(page.getByText("We have your recording.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Robot fit" })).toHaveCount(0);
  await expect(page.getByText("Blueprint will update this job as the work progresses.", { exact: true })).toHaveCount(0);
  await expect(answer.getByRole("list", { name: "Why" })).toHaveText(/Did your job in 7 of 10 tries.*Ahead of the 2 other AI robots we tested/s);
  await expect(answer).toContainText("How sure are we? Fairly sure");
  await expect(page.locator(".bare-button, .ms-button").filter({ visible: true })).toHaveText([FIND]);
  // About 70 words is the aim; the consent line (25 words) and the limits line (19) may not be dropped, and a
  // drafted job sentence adds its own. This pins it from growing.
  expect(await visibleWords(page)).toBeLessThanOrEqual(140);
  const answerText = await answer.textContent();
  expect(answerText).not.toMatch(/episode|candidate|screening|DROID|jointpos|[a-z]_[a-z]|sha256|payload|anonymi[sz]ed/i);

  // The paper check lives under Details (round 7): no "On paper" line on the answer screen.
  await expect(answer.getByText(/^On paper/)).toHaveCount(0);
  await answer.getByRole("button", { name: "See details ›" }).click();
  await page.getByRole("button", { name: "On paper: why this robot" }).click();
  await expect(page).toHaveURL(/#details\/why$/);
  await expect(page.getByRole("heading", { level: 1, name: "On paper: why this robot" })).toBeFocused();
  await page.goBack();
  await page.goBack();

  // Every detail is on its own screen, with a way back; the browser's back button returns too.
  await answer.getByRole("button", { name: "See details ›" }).click();
  await expect(page).toHaveURL(/#details$/);
  await expect(page.getByRole("heading", { level: 1, name: "Details" })).toBeFocused();
  await page.getByRole("button", { name: "The simulation test" }).click();
  await expect(page).toHaveURL(/#details\/test$/);
  const ranked = page.getByRole("region", { name: "Ranked", exact: true });
  await expect(ranked).toContainText("We ran 3 AI robots on your job, about 10 tries each, in a simulation of your site.");
  await expect(ranked.locator("dt").filter({ hasText: /^\d+\. / })).toHaveText(["1. Franka arm + π0.5 · Physical Intelligence",
    "2. Franka arm + GR00T N1.7 · NVIDIA", "3. Franka arm + MolmoAct 2 · Ai2"]);
  await expect(ranked).toContainText("1 more AI robot was planned but did not run. Job settings › Simulation details says why.");
  await expect(ranked).toContainText(/Finished 7 of 10 tries · likely between \d+% and \d+% · Ahead/);
  await page.goBack();
  await expect(page.getByRole("button", { name: "The simulation test" })).toBeFocused();
  await page.getByRole("button", { name: "How far to trust it" }).click();
  await expect(page.getByRole("region", { name: "Published tests", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "PolaRiS: Scalable Real-to-Sim Evaluations for Generalist Robot Policies" })).toHaveAttribute("target", "_blank");
  await page.goBack();
  await page.goBack();
  await expect(answer.getByRole("button", { name: "See details ›" })).toBeFocused();
  await expect(answer.locator(".bare-big", { hasText: /^Franka arm \+ π0\.5$/ })).toBeVisible();
  // Every policy's set-up detail stays one screen away, folded, on Job settings.
  await answer.getByRole("button", { name: "Job settings ›" }).click();
  const details = page.locator("summary", { hasText: "Simulation details" });
  await expect(details.locator("xpath=..")).not.toHaveAttribute("open", "");
  await expect(page.getByText(simulationRun.summary, { exact: true })).toBeHidden();
  await details.click();
  await expect(page.getByText(simulationRun.summary, { exact: true })).toBeVisible();
  // The choice cell reads as one word.
  const chosen = page.getByRole("cell", { name: "Chosen", exact: true });
  await expect(chosen).toBeVisible();
  expect(await chosen.evaluate(cell => { const range = document.createRange(); range.selectNodeContents(cell);
    return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size; })).toBe(1);
  await page.getByRole("button", { name: "‹ Back" }).click();
  await expect(answer.locator(".bare-big", { hasText: /^Franka arm \+ π0\.5$/ })).toBeVisible();
  expect(unexpected).toEqual([]);
});

test("when no AI robot finished the job, the answer says so with the set-up notice, and the ranked list says why", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page, { evaluation: allZeroEvaluation });
  await page.goto(`/capture-upload/${token}?video=existing`);
  const answer = page.getByRole("region", { name: "Your answer" });
  await expect(answer.getByRole("heading", { level: 2, name: "Tested on your job" })).toBeVisible();
  await expect(answer.getByText("No AI robot finished your job", { exact: true })).toBeVisible();
  await expect(answer.getByText("This result may come from how we set up the simulation of your site, not from the robots.", { exact: true })).toBeVisible();
  await expect(answer.getByText(/Did best|Was ahead/)).toHaveCount(0);
  // The paper check lives under Details while a test result leads (round 7).
  await expect(answer.getByRole("button", { name: /^On paper/ })).toHaveCount(0);
  await page.getByRole("button", { name: "See details ›" }).click();
  await page.getByRole("button", { name: "The simulation test" }).click();
  const ranked = page.getByRole("region", { name: "Ranked", exact: true });
  await expect(ranked).toContainText("Finished 0 of 9 tries");
  await expect(ranked.getByText(SCENE_NOTE_BEYOND_REACH, { exact: true })).toBeVisible();
  await expect(ranked.getByText(/Did best|Ahead/)).toHaveCount(0);
  await expect(ranked.getByText(/likely between/)).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("while the simulation of the site is being built, the answer says so, with only the two links and nothing to share", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page, { evaluation: { ...preparingEvaluation, screening: { candidates: [] } } });
  await page.goto(`/capture-upload/${token}?video=existing`);
  const answer = page.getByRole("region", { name: "Your answer" });
  await expect(answer.getByRole("heading", { level: 2, name: "Getting ready" })).toBeVisible();
  await expect(answer.getByText("Building your simulation", { exact: true })).toBeVisible();
  await expect(answer.getByText("Then we test AI robots on your job in it. We'll email you the result.", { exact: true })).toBeVisible();
  await expect(answer.getByRole("navigation", { name: "More" })).toHaveText("See details ›Job settings ›");
  await expect(page.getByRole("button", { name: FIND })).toHaveCount(0);
  await expect(page.getByText(CONSENT, { exact: true })).toHaveCount(0);
  await expect(answer.getByText(/UR10e|On paper/)).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("the deployment-company button says what it shares, posts once and shows the confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { introductions, unexpected } = await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  const button = page.getByRole("button", { name: FIND, exact: true });
  await expect(button).toBeVisible();
  await expect(page.getByText(CONSENT, { exact: true })).toBeVisible();
  await expect(button).toHaveAttribute("aria-describedby", await page.getByText(CONSENT, { exact: true }).getAttribute("id") ?? "");
  await button.dblclick();
  await expect(page.getByText(LISTED, { exact: true })).toBeVisible();
  await expect(button).toHaveCount(0);
  expect(introductions).toEqual([{ csrf: "fixture" }]);
  // The stored request survives a reload; nothing is posted again.
  await page.reload();
  await expect(page.getByText(LISTED, { exact: true })).toBeVisible();
  await expect(button).toHaveCount(0);
  expect(introductions).toHaveLength(1);
  expect(unexpected).toEqual([]);
});

test("when the job card could not be listed, the confirmation says Blueprint will set it up", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { introductions } = await mockJob(page, { listed: false });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await page.getByRole("button", { name: FIND, exact: true }).click();
  await expect(page.getByText(UNLISTED, { exact: true })).toBeVisible();
  await expect(page.getByText(/Shared\./)).toHaveCount(0);
  expect(introductions).toHaveLength(1);
});

test("the answer, its details and the job settings read at phone width without scrolling sideways, the button on the first screen", async ({ browser }) => {
  const { defaultBrowserType: _, ...phone } = devices["iPhone 14"];
  // The owner's first-screen rule is set on a 390 × 844 phone screen.
  const context = await browser.newContext({ ...phone, viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.locator(".bare-big", { hasText: /^Franka arm \+ π0\.5$/ })).toBeVisible();
  const button = await page.getByRole("button", { name: FIND }).boundingBox();
  expect(button!.y + button!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  for (const screen of ["See details ›", "‹ Back", "Job settings ›"]) {
    await page.getByRole("button", { name: screen }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, screen).toBeLessThanOrEqual(0);
  }
  await context.close();
});

// Review, 2026-11-12: a job that waits for its sentence says so AND shows the form to give it. The server decides both
// from one function (`jobWaitsForItsSentence`); here they arrive together, as it sends them.
test("a job waiting for its sentence shows the form to name it under the answer that asks for it", async ({ page }) => {
  const { unexpected } = await mockJob(page, { evaluation: null });
  await page.route(`**/api/site-task-brief/${token}`, route => route.fulfill({ json: { ready: true, scope: "owner", account: null,
    taskStatementNeeded: true, brief: { summary: "", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } } }));
  await page.route(`**/api/site-task-brief/${token}/status`, route => route.fulfill({ json: { scope: "owner", captureReceived: true,
    answer: readyAnswer, outlook: { phase: "waiting_on_site", reason: "task_not_named",
      sentence: "Tell us in one sentence what the robot should do, so we can build the simulation of your job." },
    status: { decision: "footage_received", headline: "We have your recording.", operatorAction: null, missingViews: [], nextUpdateIso: null } } }));
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.locator(".site-answer-bare .bare-lead")).toHaveText("Tell us in one sentence what the robot should do, so we can build the simulation of your job.");
  const form = page.getByRole("form", { name: "Name the job" });
  await expect(form).toBeVisible();
  await expect(form.getByRole("textbox")).toBeVisible();
  // The page is asking, so the label asks too: never "Optional".
  await expect(form.locator("label")).toHaveText("In one line, what should the robot do?");
  await expect(page.getByText(/^Optional: if we read the job wrong/)).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

// Review, 2026-11-12: once the site has given its sentence, the server says so (no ask, no form) until the Pipeline
// re-reads the job: the page shows neither.
test("a job the site has named shows no ask and no naming form", async ({ page }) => {
  const { unexpected } = await mockJob(page, { evaluation: null });
  await page.route(`**/api/site-task-brief/${token}`, route => route.fulfill({ json: { ready: true, scope: "owner", account: null,
    taskStatementNeeded: false, brief: { summary: "Move the cartons onto the pallet.", captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } } }));
  await page.goto(`/capture-upload/${token}?video=existing`);
  await page.locator(".site-answer-bare .bare-big, .site-answer-bare .bare-lead").first().waitFor();
  await expect(page.getByText("Tell us in one sentence what the robot should do, so we can build the simulation of your job.")).toHaveCount(0);
  await expect(page.getByRole("form", { name: "Name the job" })).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

/** The withdrawn and before-the-video modes of the same job, as the server sends them; registered after mockJob, so they win. */
async function mockMode(page: Page, mode: "withdrawn" | "film") {
  await page.route(`**/api/self-capture/uploads/${token}/status`, route => route.fulfill({ json: mode === "withdrawn"
    ? { ok: true, state: "held", detail: "Recording permission was withdrawn. This link no longer accepts footage.", blockers: [], openQuestions: [],
      holdReason: "recording_consent_withdrawn", captureReceived: true }
    : { ok: true, state: "open", captureReceived: false, uploadState: "awaiting_upload", accepts: ["mov", "mp4"], expiresAt: "2026-11-18T00:00:00Z" } }));
  await page.route(`**/api/self-capture/uploads/${token}/withdrawal`, route => route.fulfill({ json: mode === "withdrawn"
    ? { ok: true, withdrawn: true, withdrawal: { state: "withdrawn", requestedAtIso: "2026-11-11T16:00:00Z", pipelineAcknowledged: true,
      deletionConfirmed: false, legalHold: false, storageDeletion: { state: "pending", deletedObjectCount: 0, lateUploadCheckAtIso: null, completedAtIso: null } } }
    : { ok: true, withdrawn: false } }));
  await page.route(`**/api/site-task-brief/${token}/status`, route => route.fulfill({ json: { ok: true, scope: "owner", captureReceived: mode === "withdrawn",
    answer: null, claimUrl: null, sceneViewUrl: null, status: mode === "withdrawn"
      ? { decision: "ended", headline: "Recording permission was withdrawn.", operatorAction: null, missingViews: [], nextUpdateIso: null }
      : { decision: "record", headline: "Film the work area to start your job.", operatorAction: null, missingViews: [], nextUpdateIso: null } } }));
}

/** The fixture's leader with other counts, for the states the rhythm check walks through. */
const withCounts = (pairs: Array<[number, number]>) => ({ ...simulationRun, screening: { ...simulationRun.screening, candidates: simulationRun.screening.candidates
  .map((row, index) => pairs[index] ? { ...row, scored: pairs[index][1], succeeded: pairs[index][0], failed: pairs[index][1] - pairs[index][0] } : row) } });

/**
 * The bare-bones rhythm (bare.css, at its top), checked on a phone for every answer state rather than by eye: no
 * two different kinds of block closer than 8 px, and no text centred except the filled button's own label.
 */
const RHYTHM_STATES: Array<{ name: string; evaluation: unknown; hash?: string; mode?: "withdrawn" | "film" }> = [
  { name: "recording permission withdrawn", evaluation: null, mode: "withdrawn" },
  { name: "before the video", evaluation: null, mode: "film" },
  { name: "paper check", evaluation: null },
  { name: "was ahead", evaluation: simulationRun },
  { name: "did best", evaluation: withCounts([[10, 10]]) },
  { name: "one option", evaluation: { ...simulationRun, screening: { ...simulationRun.screening, candidates: [simulationRun.screening.candidates[0]] } } },
  { name: "no clear winner", evaluation: withCounts([[1, 1], [0, 1], [0, 1]]) },
  { name: "none finished, with the set-up notice", evaluation: allZeroEvaluation },
  { name: "none finished", evaluation: { ...allZeroEvaluation, outcomeCaveat: undefined, screening: { ...allZeroEvaluation.screening!, setupNotes: [] } } },
  { name: "testing now", evaluation: preparingEvaluation },
  { name: "getting ready", evaluation: { ...preparingEvaluation, screening: { candidates: [] } } },
  { name: "the ranked test screen", evaluation: simulationRun, hash: "#details/test" },
  { name: "the details menu", evaluation: simulationRun, hash: "#details" },
];
for (const state of RHYTHM_STATES) {
  test(`keeps the bare-bones rhythm on a phone: ${state.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    const page = await context.newPage();
    await mockJob(page, { evaluation: state.evaluation });
    if (state.mode) await mockMode(page, state.mode);
    await page.goto(`/capture-upload/${token}${state.mode === "film" ? "" : "?video=existing"}${state.hash ?? ""}`);
    await page.locator(state.mode === "withdrawn" ? ".bare-withdrawn [role=status]" : state.mode === "film" ? ".bare-upload-alt"
      : state.hash === "#details" ? "h1:text-is('Details')" : state.hash ? ".site-answer-details h1"
      : ".site-answer-bare .bare-big, .site-answer-bare .bare-lead").first().waitFor();
    if (!state.hash && state.evaluation) await page.locator(".site-answer-bare h2.bare-label", { hasText: /tested|did best|was ahead|testing now|getting ready/i }).waitFor();
    if (state.hash === "#details/test") await page.getByRole("region", { name: "Ranked", exact: true }).waitFor();
    const found = await bareRhythmFindings(page);
    expect(found.blocks).toBeGreaterThanOrEqual(3);
    expect(found.tight, "blocks of different kinds closer than 8 px").toEqual([]);
    expect(found.centred, "centred text other than the filled button's label").toEqual([]);
    await context.close();
  });
}
