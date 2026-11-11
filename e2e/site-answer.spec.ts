import { devices, expect, test, type Page } from "@playwright/test";
import { SCENE_NOTE_BEYOND_REACH, allZeroEvaluation, readyAnswer, winnerEvaluation } from "../client/tests/fixtures/siteAnswer";

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
const CONSENT = "Shares a summary of your job and this answer, without saying who you are, with companies we've approved. Your video, address and contacts stay private.";
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
    if (path === `/api/job-workflow/owner/${token}` && method === "GET") return route.fulfill({ json: { ...workflow, managedEvidence: [evaluation] } });
    if (path === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"] } });
    if (path === `/api/self-capture/uploads/${token}/withdrawal`) return route.fulfill({ json: { ok: true, withdrawn: false } });
    if (path === `/api/site-task-brief/${token}`) return route.fulfill({ json: { ready: true, scope: "owner", account: null, brief: {
      summary: readyAnswer.job.sentence, captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } } });
    if (path === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      scope: "owner", captureReceived: true, answer: { ...readyAnswer, introductionRequestedAtIso: requestedAtIso, jobCardListed: requestedAtIso !== null && listed },
      status: { decision: "footage_received", headline: "We have your recording.", operatorAction: null, missingViews: [], nextUpdateIso: null } } });
    if (path === `/api/site-task-brief/${token}/introduction-request` && method === "POST") {
      introductions.push({ csrf: route.request().headers()["x-csrf-token"] });
      requestedAtIso ??= "2026-11-11T15:00:00.000Z";
      return route.fulfill({ json: { ok: true, requestedAtIso, listed } });
    }
    if (path === `/api/site-task-brief/${token}/readiness`) return route.fulfill({ json: { ok: true, summary: null, report: null,
      briefPath: null, tracker: { steps: [], meanwhile: null } } });
    if (path === `/api/task-listings/owner/${token}`) return route.fulfill({ json: { listing: null, thumbnailPng: null } });
    unexpected.push(`${method} ${path}`);
    return route.fulfill({ status: 503, json: { error: "Unstubbed local API" } });
  });
  return { introductions, unexpected };
}

test.use({ serviceWorkers: "block" });

test("the answer leads the job page, bare bones: the robot, plain ticks, how sure, one computer-test line, one button", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  const answer = page.getByRole("region", { name: "Your answer" });
  await expect(answer.getByText("UR10e", { exact: true })).toBeVisible();
  await expect(answer.getByText("by Universal Robots", { exact: true })).toBeVisible();
  const titleBox = await page.getByRole("heading", { level: 1, name: "Your job" }).boundingBox();
  expect(titleBox!.y).toBeLessThan((await answer.boundingBox())!.y);
  // Nothing is asked of the site: no status card repeating a wait under the answer.
  await expect(page.getByText("We have your recording.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Robot fit" })).toHaveCount(0);
  await expect(page.getByText("Blueprint will update this job as the work progresses.", { exact: true })).toHaveCount(0);
  await expect(answer.getByRole("list", { name: "Why" })).toHaveText(/Reaches far enough.*Strong enough.*Already used for jobs like this/s);
  // 7 of 10 against 3 of 10 is about 0.96 under the probability rule: ahead, and it could still be chance.
  await expect(answer.getByText("Computer test: π0.5 was ahead, finishing the job in 7 of 10 tries, on a Franka research arm, not the UR10e. It could still be chance.", { exact: true })).toBeVisible();
  await expect(page.locator(".bare-button, .ms-button").filter({ visible: true })).toHaveText([FIND]);
  // About 70 words is the aim; the consent line (25 words) and the limits line (19) may not be dropped, and a
  // drafted job sentence and a computer-test line add theirs. Measured 136 here; this pins it from growing.
  expect(await visibleWords(page)).toBeLessThanOrEqual(140);
  const answerText = await answer.textContent();
  expect(answerText).not.toMatch(/episode|candidate|screening|DROID|jointpos|[a-z]_[a-z]|sha256|payload|anonymi[sz]ed/i);

  // Every detail is on its own screen, with a way back; the browser's back button returns too.
  await answer.getByRole("button", { name: "See details ›" }).click();
  await expect(page).toHaveURL(/#details$/);
  const test = page.getByRole("region", { name: "Computer test", exact: true });
  await expect(test).toContainText(/π0\.5 Physical IntelligenceFinished 7 of 10 tries · likely between \d+% and \d+% · Ahead/);
  await expect(page.getByRole("link", { name: "PolaRiS: Scalable Real-to-Sim Evaluations for Generalist Robot Policies" })).toHaveAttribute("target", "_blank");
  await page.goBack();
  await expect(answer.getByText("UR10e", { exact: true })).toBeVisible();
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
  await expect(answer.getByText("UR10e", { exact: true })).toBeVisible();
  expect(unexpected).toEqual([]);
});

test("when no policy completed the job, the line says so, and the details say why with the scene note", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page, { evaluation: allZeroEvaluation });
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText("Computer test: None of the robot programs finished the job, on a Franka research arm, not the UR10e.", { exact: true })).toBeVisible();
  await expect(page.getByText("This result may come from how we set up the computer copy of your site, not from the robots.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "See details ›" }).click();
  const test = page.getByRole("region", { name: "Computer test", exact: true });
  await expect(test.getByText(/^The simulation ran, but no policy completed the job in it, so it could not rank them\./)).toBeVisible();
  await expect(test.getByText(SCENE_NOTE_BEYOND_REACH, { exact: true })).toBeVisible();
  await expect(test.getByText(/Did best|Ahead/)).toHaveCount(0);
  await expect(test.getByText(/likely between/)).toHaveCount(0);
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
  await expect(page.getByText("UR10e", { exact: true })).toBeVisible();
  const button = await page.getByRole("button", { name: FIND }).boundingBox();
  expect(button!.y + button!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  for (const screen of ["See details ›", "‹ Back", "Job settings ›"]) {
    await page.getByRole("button", { name: screen }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, screen).toBeLessThanOrEqual(0);
  }
  await context.close();
});
