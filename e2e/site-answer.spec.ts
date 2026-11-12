import { devices, expect, test, type Page } from "@playwright/test";
import { bareRhythmFindings } from "./helpers/bare-rhythm";
import { SCENE_NOTE_BEYOND_REACH, allZeroEvaluation, preparingEvaluation, readyAnswer, serverOutlookFor, winnerEvaluation } from "../client/tests/fixtures/siteAnswer";
import { projectSimulationProof } from "../client/src/lib/simulationProof";

/**
 * The site's job page (frame of 2026-11-12): deployment companies first, then the first look, the simulation of the
 * site and, folded, our own early trial. Every API the page reads is mocked here; no request leaves the browser.
 */
const token = "site-answer-fixture";

/** The winner case, with the selection the server records for it. */
const simulationRun = { ...winnerEvaluation, screening: { ...winnerEvaluation.screening!,
  selection: { status: "chosen" as const, selectionDigest: `sha256:${"e".repeat(64)}`, tiedWith: [],
    chosen: { candidateId: "pi05_droid", name: "π0.5 DROID", successRate: 0.7, scored: 10, succeeded: 7, configurationId: null,
      policyRouteId: null, deploymentCompanies: [], relationship: null, evidenceUrl: null, relatedTeams: [], partnerBlockers: [], registryTeams: [] },
    candidates: [{ candidateId: "pi05_droid", resultRank: 1, choiceBlocker: null }] } } };
/** The old share button (until 2026-11-12): it must not come back. */
const FIND = "Share my job";
/** An older job's page (PACKAGE_D D1.3): what changed, recording statement v4, and the one button that agrees to it. */
const OLDER = "Blueprint now shares each job, with its video, with the deployment companies we approve. Your job is not shown to any company. To have it shared, agree below.";
const AGREE = "Agree and send my job";
const V4 = "By sending, you agree to our Terms and Privacy Policy and confirm you're allowed to film and share this site. We share your job, including this video and the simulation we build from it, with robot deployment companies we've approved.";
const SHARED = "We share your job with the deployment companies we approve.";
/** The recorded statement, word for word: only the words around it changed. */

const FIRST_LOOK = "On paper, the robot most likely to fit: Universal Robots UR10e.";
const TRIAL_LINE = "This is our own trial of openly available robot software. It does not predict what a deployment company's robot would do.";
/** Opens the folded early trial, as a site would. */
async function openTrial(page: Page) {
  const trial = page.getByRole("region", { name: "Early trial of openly available robot software" });
  await expect(trial.locator("details")).not.toHaveAttribute("open", "");
  await trial.locator("summary").click();
  return trial;
}
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

type Sharing = { state: "not_shared" | "preparing" | "visible" | "not_visible"; sharedAtIso: string | null; olderStatement?: boolean };
const OLDER_JOB: Sharing = { state: "not_shared", sharedAtIso: null, olderStatement: true };
async function mockJob(page: Page, { evaluation = simulationRun as unknown, sharing: initial = OLDER_JOB, agreedListed = true,
  companies }: { evaluation?: unknown; sharing?: Sharing; agreedListed?: boolean; companies?: unknown } = {}) {
  const consents: Array<{ csrf: string | undefined; body: unknown }> = [];
  const introductions: Array<{ csrf: string | undefined; body: unknown }> = [];
  const unexpected: string[] = [];
  let sharing = initial;
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
      scope: "owner", captureReceived: true, answer: { ...readyAnswer, introductionRequestedAtIso: null, jobCardListed: sharing.state !== "not_shared",
        // The server's own reading of what a company can see (`jobSharingOf`).
        sharing,
        // Sends, answers and introductions, by alias until an introduction, as the server projects them.
        ...(companies && sharing.state !== "not_shared" ? { companies } : {}) },
      // The job's outlook as the server decides it for this answer and evaluation (the page renders by it).
      outlook: serverOutlookFor(readyAnswer, projectSimulationProof({ evaluation: (evaluation ? [evaluation] : []) as never, pick: null })),
      status: { decision: "footage_received", headline: "We have your recording.", operatorAction: null, missingViews: [], nextUpdateIso: null } } });
    if (path === `/api/self-capture/uploads/${token}/recording-consent` && method === "POST") {
      consents.push({ csrf: route.request().headers()["x-csrf-token"], body: route.request().postDataJSON() });
      sharing = { state: agreedListed ? "visible" : "not_visible", sharedAtIso: "2026-11-11T15:00:00.000Z" };
      return route.fulfill({ json: { ok: true, outcome: "upgraded" } });
    }
    if (path === `/api/site-task-brief/${token}/introductions` && method === "POST") {
      introductions.push({ csrf: route.request().headers()["x-csrf-token"], body: route.request().postDataJSON() });
      return route.fulfill({ status: 409, json: { ok: false, code: "introduction_refused", reason: "limit_reached", error: "x" } });
    }
    if (path === `/api/site-task-brief/${token}/readiness`) return route.fulfill({ json: { ok: true, summary: null, report: null,
      briefPath: null, tracker: { steps: [], meanwhile: null } } });
    unexpected.push(`${method} ${path}`);
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  return { consents, introductions, unexpected };
}

test.use({ serviceWorkers: "block" });

test("the job page leads with deployment companies and the first look, with our early trial folded under its fixed line", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  const job = page.getByRole("region", { name: "Your job" });
  const companies = page.getByRole("region", { name: "Deployment companies" });
  await expect(companies.getByText(OLDER, { exact: true })).toBeVisible();
  await expect(job.locator("h2, summary")).toHaveText(["Deployment companies", "First look", "Simulation of your site", "Early trial of openly available robot software"]);
  const titleBox = await page.getByRole("heading", { level: 1, name: "Your job" }).boundingBox();
  expect(titleBox!.y).toBeLessThan((await job.boundingBox())!.y);
  const firstLook = page.getByRole("region", { name: "First look" });
  await expect(firstLook.getByText(FIRST_LOOK, { exact: true })).toBeVisible();
  await expect(firstLook.getByText("From published specifications and where it has been used.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Simulation of your site" }).getByText("The simulation of your site is ready.", { exact: true })).toBeVisible();
  // Nothing is asked of the site: no status card repeating a wait.
  await expect(page.getByText("We have your recording.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Robot fit" })).toHaveCount(0);
  await expect(page.getByText("Blueprint will update this job as the work progresses.", { exact: true })).toHaveCount(0);
  await expect(page.locator(".bare-button, .ms-button").filter({ visible: true })).toHaveText([AGREE]);
  await expect(page.getByRole("button", { name: FIND })).toHaveCount(0);
  // The recorded statement (30 words), the share question, the first look's source and the limits line may not be
  // dropped, and a drafted job sentence adds its own. This pins it from growing. (140 before 2026-11-12, when the
  // test result led and the first look sat behind Details.)
  expect(await visibleWords(page)).toBeLessThanOrEqual(160);
  const jobText = await job.textContent();
  expect(jobText).not.toMatch(/episode|candidate|screening|DROID|jointpos|[a-z]_[a-z]|sha256|payload|anonymi[sz]ed|AI robot|paper check|which did best/i);

  // The trial: folded, labelled, never the answer. 7 of 10 against 3 of 10 is about 0.96 under the probability rule:
  // ahead, not "did best".
  const trial = await openTrial(page);
  await expect(trial.getByText(TRIAL_LINE, { exact: true })).toBeVisible();
  await expect(trial.getByRole("heading", { level: 3, name: "Was ahead in our trial" })).toBeVisible();
  await expect(trial.locator(".bare-big", { hasText: /^Franka arm \+ π0\.5$/ })).toBeVisible();
  await expect(trial.getByText("Robot software by Physical Intelligence", { exact: true })).toBeVisible();
  await expect(trial.getByRole("list", { name: "Why" })).toHaveText(/Did the job in 7 of 10 tries.*Ahead of the 2 other robots we tried/s);
  await expect(trial).toContainText("How sure are we? Fairly sure");

  await job.getByRole("button", { name: "See details ›" }).click();
  await page.getByRole("button", { name: "First look: why this robot" }).click();
  await expect(page).toHaveURL(/#details\/why$/);
  await expect(page.getByRole("heading", { level: 1, name: "First look: why this robot" })).toBeFocused();
  await page.goBack();
  await page.goBack();

  // Every detail is on its own screen, with a way back; the browser's back button returns too.
  await job.getByRole("button", { name: "See details ›" }).click();
  await expect(page).toHaveURL(/#details$/);
  await expect(page.getByRole("heading", { level: 1, name: "Details" })).toBeFocused();
  await page.getByRole("button", { name: "Our early trial" }).click();
  await expect(page).toHaveURL(/#details\/test$/);
  await expect(page.getByText(TRIAL_LINE, { exact: true })).toBeVisible();
  const ranked = page.getByRole("region", { name: "Ranked", exact: true });
  await expect(ranked).toContainText("In our early trial we ran 3 robots on your job, about 10 tries each, in a simulation of your site.");
  await expect(ranked.locator("dt").filter({ hasText: /^\d+\. / })).toHaveText(["1. Franka arm + π0.5 · Physical Intelligence",
    "2. Franka arm + GR00T N1.7 · NVIDIA", "3. Franka arm + MolmoAct 2 · Ai2"]);
  await expect(ranked).toContainText("1 more robot was planned but did not run. Job settings › Simulation details says why.");
  await expect(ranked).toContainText(/Finished 7 of 10 tries · likely between \d+% and \d+% · Ahead/);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Our early trial" })).toBeFocused();
  await page.getByRole("button", { name: "How far to trust the trial" }).click();
  await expect(page.getByRole("region", { name: "Published tests", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "PolaRiS: Scalable Real-to-Sim Evaluations for Generalist Robot Policies" })).toHaveAttribute("target", "_blank");
  await page.goBack();
  await page.goBack();
  await expect(job.getByRole("button", { name: "See details ›" })).toBeFocused();
  await expect(firstLook.getByText(FIRST_LOOK, { exact: true })).toBeVisible();
  // Every policy's set-up detail stays one screen away, folded, on Job settings.
  await job.getByRole("button", { name: "Job settings ›" }).click();
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
  await expect(firstLook.getByText(FIRST_LOOK, { exact: true })).toBeVisible();
  expect(unexpected).toEqual([]);
});

test("when no robot finished the job in our trial, the trial says so with the set-up notice, and the first look still stands", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page, { evaluation: allZeroEvaluation });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByRole("region", { name: "First look" }).getByText(FIRST_LOOK, { exact: true })).toBeVisible();
  const trial = await openTrial(page);
  await expect(trial.getByRole("heading", { level: 3, name: "Tried in our trial" })).toBeVisible();
  await expect(trial.getByText("No robot finished the job in our trial.", { exact: true })).toBeVisible();
  await expect(trial.getByText("This result may come from how we set up the simulation of your site, not from the robots.", { exact: true })).toBeVisible();
  await expect(trial.getByText(/Did best|Was ahead/)).toHaveCount(0);
  await page.getByRole("button", { name: "See details ›" }).click();
  await page.getByRole("button", { name: "Our early trial" }).click();
  const ranked = page.getByRole("region", { name: "Ranked", exact: true });
  await expect(ranked).toContainText("Finished 0 of 9 tries");
  await expect(ranked.getByText(SCENE_NOTE_BEYOND_REACH, { exact: true })).toBeVisible();
  await expect(ranked.getByText(/Did best|Ahead/)).toHaveCount(0);
  await expect(ranked.getByText(/likely between/)).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("while the simulation of the site is being built, the page says so, with the first look and nothing to share", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page, { evaluation: { ...preparingEvaluation, screening: { candidates: [] } },
    sharing: { state: "preparing", sharedAtIso: "2026-11-11T15:00:00.000Z" } });
  await page.goto(`/capture-upload/${token}?video=existing`);
  const job = page.getByRole("region", { name: "Your job" });
  await expect(page.getByRole("region", { name: "Deployment companies" }).getByText(SHARED, { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Simulation of your site" }).getByText("We're building the simulation of your site.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "First look" }).getByText(FIRST_LOOK, { exact: true })).toBeVisible();
  await expect(job.getByRole("navigation", { name: "More" })).toHaveText("See details ›Job settings ›");
  await expect(page.getByRole("button", { name: FIND })).toHaveCount(0);
  await expect(page.getByRole("button", { name: AGREE })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Early trial of openly available robot software" })).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

// Sharing is the service (2026-11-12): an older job's page offers recording statement v4 once; agreeing records v4 on
// the existing recording-consent route and the job is then shared.
test("an older job agrees to v4 once, under the sentence itself, and is then shared", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { consents, unexpected } = await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  const button = page.getByRole("button", { name: AGREE, exact: true });
  await expect(button).toBeVisible();
  await expect(page.getByText(V4, { exact: true })).toBeVisible();
  await expect(button).toHaveAttribute("aria-describedby", await page.getByText(V4, { exact: true }).getAttribute("id") ?? "");
  await button.dblclick();
  await expect(page.getByText(SHARED, { exact: true })).toBeVisible();
  await expect(button).toHaveCount(0);
  expect(consents).toEqual([{ csrf: "fixture", body: { granted: true, statementVersion: "2026-11-12.v4" } }]);
  await page.reload();
  await expect(page.getByText(SHARED, { exact: true })).toBeVisible();
  await expect(button).toHaveCount(0);
  expect(consents).toHaveLength(1);
  expect(unexpected).toEqual([]);
});

test("a shared job that is held says it is not visible right now", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockJob(page, { sharing: { state: "not_visible", sharedAtIso: "2026-11-11T15:00:00.000Z" } });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByRole("region", { name: "Deployment companies" }).getByRole("status")).toHaveText("Your job is not visible to companies right now.");
  await expect(page.getByText(/summary/)).toHaveCount(0);
});

// PACKAGE_E E4 and E6: one send line, each answer by alias, and "Introduce us" with its sentence where it can be pressed.
test("the deployment companies section says the send line, each answer by alias, and offers Introduce us", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { introductions, unexpected } = await mockJob(page, { sharing: { state: "visible", sharedAtIso: "2026-11-11T15:00:00.000Z" },
    companies: { interested: true, sent: { count: 3, firstAtIso: "2026-11-12T10:00:00.000Z" }, introductions: { used: 0, max: 3 }, entries: [
      { kind: "answered", alias: "Company B", atIso: "2026-11-12T12:00:00.000Z", state: "needs_something", canIntroduce: false },
      { kind: "answered", alias: "Company A", atIso: "2026-11-13T09:00:00.000Z", state: "interested", canIntroduce: true },
    ] } });
  await page.goto(`/capture-upload/${token}?video=existing`);
  const companies = page.getByRole("region", { name: "Deployment companies" });
  await expect(companies.getByText(SHARED, { exact: true })).toBeVisible();
  await expect(companies.getByText("Sent to 3 deployment companies on November 12, 2026.", { exact: true })).toBeVisible();
  await expect(companies.getByText("Company B answered on November 12, 2026: Would need something.", { exact: true })).toBeVisible();
  await expect(companies.getByText("Company A answered on November 13, 2026: Interested.", { exact: true })).toBeVisible();
  await expect(companies.getByText("We give Company A your name and contact details, and give you theirs.", { exact: true })).toBeVisible();
  await expect(companies.getByText("We will write to you about next steps.")).toHaveCount(0);
  await companies.getByRole("button", { name: "Introduce us" }).click();
  await expect(companies.getByRole("alert")).toHaveText("You have used your three introductions.");
  expect(introductions).toEqual([{ csrf: "fixture", body: { alias: "A" } }]);
  expect(unexpected).toEqual([]);
});

test("the job page, its details and the job settings read at phone width without scrolling sideways, the button on the first screen", async ({ browser }) => {
  const { defaultBrowserType: _, ...phone } = devices["iPhone 14"];
  // The owner's first-screen rule is set on a 390 × 844 phone screen.
  const context = await browser.newContext({ ...phone, viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText(FIRST_LOOK, { exact: true })).toBeVisible();
  const button = await page.getByRole("button", { name: AGREE }).boundingBox();
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
  await expect(page.getByRole("region", { name: "Simulation of your site" }).locator(".bare-lead")).toHaveText("Tell us in one sentence what the robot should do, so we can build the simulation of your job.");
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

// Review, 2026-11-12: the optional place question, with its private picture, beside the answer; the job keeps going.
test("the place question shows its picture and sentence, This is right needs nothing more, and it never shows without one", async ({ page }) => {
  const { unexpected } = await mockJob(page, { evaluation: null });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await page.locator(".site-answer-bare .bare-big, .site-answer-bare .bare-lead").first().waitFor();
  await expect(page.getByRole("region", { name: "Where the object goes" })).toHaveCount(0);

  const posted: unknown[] = [];
  const picture = "/api/website-destination-pictures/job-one/walkthrough-job-one/place.png?digest=sha256%3A" + "5".repeat(64) + "&expires=1&signature=" + "a".repeat(64);
  await page.route(`**/api/site-task-brief/${token}/status`, route => route.fulfill({ json: { scope: "owner", captureReceived: true,
    answer: readyAnswer, outlook: serverOutlookFor(readyAnswer, projectSimulationProof({ evaluation: [] as never, pick: null })),
    destinationAnswered: posted.length > 0,
    destinationChoice: posted.length ? null : { questionDigest: `sha256:${"3".repeat(64)}`, objectLabel: "Carton",
      guessedCandidateId: "p0123456789abcdef", pictureUrl: picture,
      candidates: [{ id: "p0123456789abcdef", place: "named_place" }, { id: "pfedcba9876543210", place: "surface_end" }] },
    status: { decision: "footage_received", headline: "We have your recording.", operatorAction: null, missingViews: [], nextUpdateIso: null } } }));
  // A 1x1 PNG stands in for the private frame; the page only ever asks the ticketed route for it.
  await page.route("**/api/website-destination-pictures/**", route => route.fulfill({ contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64") }));
  await page.route(`**/api/site-task-brief/${token}/task-target-choice`, route => {
    posted.push(route.request().postDataJSON());
    return route.fulfill({ json: { ok: true, choice: "confirm_guess" } });
  });
  await page.reload();
  const region = page.getByRole("region", { name: "Where the object goes" });
  await expect(region).toBeVisible();
  await expect(region.getByText("We will test moving the carton from here to here.")).toBeVisible();
  await expect(region.getByRole("img")).toBeVisible();
  await expect(region.getByText("Nothing is needed from you: your job keeps going either way.")).toBeVisible();
  await region.getByRole("button", { name: "The place is wrong" }).click();
  // Places are told apart by the letters the picture draws: never the Pipeline's words.
  await expect(region.getByLabel("Place B")).toBeVisible();
  await expect(region.getByText("Place A (our guess) is the one we use now.")).toBeVisible();
  await region.getByRole("button", { name: "This is right" }).click();
  await expect.poll(() => posted.length).toBe(1);
  expect(posted[0]).toEqual({ questionDigest: `sha256:${"3".repeat(64)}`, choice: { kind: "confirm_guess" } });
  // The job's answer stays where it was; once answered, the page says only that.
  await expect(page.getByRole("region", { name: "Where the object goes" }).getByRole("status"))
    .toHaveText("We have your answer about where the object goes.");
  await expect(page.getByRole("button", { name: "This is right" })).toHaveCount(0);
  await expect(page.locator(".site-answer-bare")).toBeVisible();
  expect(unexpected).toEqual([]);
});

// Review, 2026-11-12: results prepared before the site corrected the place say so beside them, and nothing else changes.
// The server decides it per result from the result's own preparation revision (`placeCorrectedSince`); the page shows
// it beside exactly those results. Replacement results prepared with the corrected place carry no line.
for (const [name, evaluation, choice, predates, caveat] of [
  ["results from before the correction", simulationRun, "other", true, true],
  ["replacement results prepared with the corrected place", simulationRun, "other", false, false],
  ["results, then the guess confirmed", simulationRun, "confirm", false, false],
  ["another place chosen, no results yet", null, "other", false, false],
] as const) {
  test(`the place answer beside the result: ${name}`, async ({ page }) => {
    const { unexpected } = await mockJob(page, { evaluation });
    const posted: Array<{ choice: { kind: string } }> = [];
    const picture = "/api/website-destination-pictures/job-one/walkthrough-job-one/place.png?digest=sha256%3A" + "5".repeat(64) + "&expires=1&signature=" + "a".repeat(64);
    await page.route(`**/api/job-workflow/owner/${token}`, route => route.fulfill({ json: { ...workflow,
      managedEvidence: evaluation ? [{ ...evaluation, ...(posted.length && predates ? { placeCorrectedSince: true } : {}) }] : [] } }));
    await page.route(`**/api/site-task-brief/${token}/status`, route => route.fulfill({ json: { scope: "owner", captureReceived: true,
      answer: readyAnswer, outlook: serverOutlookFor(readyAnswer, projectSimulationProof({ evaluation: (evaluation ? [evaluation] : []) as never, pick: null })),
      destinationAnswered: posted.length > 0,
      destinationChoice: posted.length ? null : { questionDigest: `sha256:${"3".repeat(64)}`, objectLabel: "Carton",
        guessedCandidateId: "p0123456789abcdef", pictureUrl: picture,
        candidates: [{ id: "p0123456789abcdef", place: "named_place" }, { id: "pfedcba9876543210", place: "surface_end" }] },
      status: { decision: "footage_received", headline: "We have your recording.", operatorAction: null, missingViews: [], nextUpdateIso: null } } }));
    await page.route("**/api/website-destination-pictures/**", route => route.fulfill({ contentType: "image/png",
      body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64") }));
    await page.route(`**/api/site-task-brief/${token}/task-target-choice`, route => {
      posted.push(route.request().postDataJSON());
      return route.fulfill({ json: { ok: true, choice: posted[0].choice.kind } });
    });
    await page.goto(`/capture-upload/${token}?video=existing`);
    const region = page.getByRole("region", { name: "Where the object goes" });
    await expect(region.getByRole("img")).toBeVisible();
    const line = page.getByText("These results were tested with the place you have since corrected.");
    await expect(line).toHaveCount(0);
    if (choice === "other") {
      await region.getByRole("button", { name: "The place is wrong" }).click();
      await region.getByLabel("Place B").click();
      await region.getByRole("button", { name: "Use this place" }).click();
    } else await region.getByRole("button", { name: "This is right" }).click();
    await expect(page.getByRole("region", { name: "Where the object goes" }).getByRole("status"))
      .toHaveText("We have your answer about where the object goes.");
    // The results the page shows, read again: the line follows their own revision.
    await page.reload();
    await expect(page.getByRole("region", { name: "Where the object goes" }).getByRole("status"))
      .toHaveText("We have your answer about where the object goes.");
    await expect(line).toHaveCount(caveat ? 1 : 0);
    // Nothing else changes: no "updating", no superseded wording.
    await expect(page.getByText(/updating this job|superseded/i)).toHaveCount(0);
    expect(unexpected).toEqual([]);
  });
}

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
  { name: "first look only", evaluation: null },
  { name: "was ahead", evaluation: simulationRun },
  { name: "did best", evaluation: withCounts([[10, 10]]) },
  { name: "one option", evaluation: { ...simulationRun, screening: { ...simulationRun.screening, candidates: [simulationRun.screening.candidates[0]] } } },
  { name: "no clear winner", evaluation: withCounts([[1, 1], [0, 1], [0, 1]]) },
  { name: "none finished, with the set-up notice", evaluation: allZeroEvaluation },
  { name: "none finished", evaluation: { ...allZeroEvaluation, outcomeCaveat: undefined, screening: { ...allZeroEvaluation.screening!, setupNotes: [] } } },
  { name: "early trial running", evaluation: preparingEvaluation },
  { name: "simulation being built", evaluation: { ...preparingEvaluation, screening: { candidates: [] } } },
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
    if (!state.hash && state.evaluation) await page.locator(".site-answer-bare h2.bare-label", { hasText: /^Simulation of your site$/ }).waitFor();
    if (state.hash === "#details/test") await page.getByRole("region", { name: "Ranked", exact: true }).waitFor();
    const found = await bareRhythmFindings(page);
    expect(found.blocks).toBeGreaterThanOrEqual(3);
    expect(found.tight, "blocks of different kinds closer than 8 px").toEqual([]);
    expect(found.centred, "centred text other than the filled button's label").toEqual([]);
    await context.close();
  });
}
