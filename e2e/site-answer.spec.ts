import { devices, expect, test, type Page } from "@playwright/test";
import { readyAnswer } from "../client/tests/fixtures/siteAnswer";

/**
 * The site's job page leads with its answer. Every API the page reads is
 * mocked here; no request leaves the browser.
 */
const token = "site-answer-fixture";

const simulationRun = {
  runId: "fixture-evaluation", state: "completed", outcome: "estimate", current: true, resultDigest: `sha256:${"d".repeat(64)}`,
  summary: "Your job's simulation estimate: 1 robot setup ran, with 3 tries scored.",
  nextAction: "Nothing is needed from you.", limitations: ["Simulation does not certify physical performance or safety."],
  href: "#managed-evidence-fixture-evaluation",
  screening: {
    candidates: [{ candidateId: "setup-1", name: "Arm with suction gripper", state: "completed", planned: 3, scored: 3, succeeded: 2,
      failed: 1, void: 0, blockers: [], successRange: { lowerPercent: 21, upperPercent: 94, confidencePercent: 95 } }],
    selection: { status: "chosen", selectionDigest: `sha256:${"e".repeat(64)}`, tiedWith: [],
      chosen: { candidateId: "setup-1", name: "Arm with suction gripper", successRate: 2 / 3, scored: 3, succeeded: 2, configurationId: null,
        policyRouteId: null, deploymentCompanies: [], relationship: null, evidenceUrl: null, relatedTeams: [], partnerBlockers: [], registryTeams: [] },
      candidates: [{ candidateId: "setup-1", resultRank: 1, choiceBlocker: null }] },
  },
};

const workflow = {
  schemaVersion: "job_marketplace.v1", revision: "fixture-revision", stage: "brief_agreed",
  requirements: { purchaseReadiness: "unsure", jobFrequency: null, requiredOutput: null,
    installationBudget: null, ongoingBudget: null, currentProcessCost: null, targetStartDate: null },
  briefAgreed: true, optionsAssessed: false, reviewRequired: false,
  nextAction: "Blueprint is preparing your job.", actionOwner: "blueprint", review: null, managedEvidence: [simulationRun],
};

async function mockJob(page: Page) {
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
    if (path === `/api/job-workflow/owner/${token}` && method === "GET") return route.fulfill({ json: workflow });
    if (path === `/api/self-capture/uploads/${token}/status`) return route.fulfill({ json: {
      ok: true, state: "open", captureReceived: true, uploadState: "processing_ready", accepts: ["mov", "mp4"] } });
    if (path === `/api/self-capture/uploads/${token}/withdrawal`) return route.fulfill({ json: { ok: true, withdrawn: false } });
    if (path === `/api/site-task-brief/${token}`) return route.fulfill({ json: { ready: true, scope: "owner", account: null, brief: {
      summary: readyAnswer.job.sentence, captureMode: "self_capture", proposed: [], unresolved: [], confirmedAtIso: null } } });
    if (path === `/api/site-task-brief/${token}/status`) return route.fulfill({ json: {
      scope: "owner", captureReceived: true, answer: { ...readyAnswer, introductionRequestedAtIso: requestedAtIso },
      status: { decision: "footage_received", headline: "We have your recording.", operatorAction: null, missingViews: [], nextUpdateIso: null } } });
    if (path === `/api/site-task-brief/${token}/introduction-request` && method === "POST") {
      introductions.push({ csrf: route.request().headers()["x-csrf-token"] });
      requestedAtIso ??= "2026-11-11T15:00:00.000Z";
      return route.fulfill({ json: { ok: true, requestedAtIso } });
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

test("the answer leads the job page and simulation is folded below it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  const answer = page.getByRole("region", { name: "Your answer" });
  await expect(answer.getByText(readyAnswer.headline, { exact: true })).toBeVisible();
  const card = page.getByText("We have your recording.", { exact: true });
  await expect(card).toBeVisible();
  const [answerBox, cardBox, titleBox] = await Promise.all([answer.boundingBox(), card.boundingBox(),
    page.getByRole("heading", { level: 1, name: "Your job" }).boundingBox()]);
  expect(titleBox!.y).toBeLessThan(answerBox!.y);
  expect(answerBox!.y + answerBox!.height).toBeLessThanOrEqual(cardBox!.y);
  await expect(page.getByRole("region", { name: "Robot fit" })).toHaveCount(0);
  await expect(page.getByText("Blueprint will update this job as the work progresses.", { exact: true })).toHaveCount(0);

  const simulationSummary = page.locator("summary", { hasText: "Simulation evidence" });
  await expect(simulationSummary.locator("xpath=..")).not.toHaveAttribute("open", "");
  await expect(page.getByText("Simulation runs for this job, where we made any. They have not been checked against real trials.", { exact: true })).toBeVisible();
  await expect(page.getByText(simulationRun.summary, { exact: true })).toBeHidden();
  await simulationSummary.click();
  await expect(page.getByText(simulationRun.summary, { exact: true })).toBeVisible();
  // The choice cell reads as one word.
  const chosen = page.getByRole("cell", { name: "Chosen", exact: true });
  await expect(chosen).toBeVisible();
  expect(await chosen.evaluate(cell => { const range = document.createRange(); range.selectNodeContents(cell);
    return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size; })).toBe(1);
  expect(unexpected).toEqual([]);
});

test("the introduction button posts once and shows the confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { introductions, unexpected } = await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  const button = page.getByRole("button", { name: "Ask for an introduction", exact: true });
  await expect(button).toBeVisible();
  await button.dblclick();
  await expect(page.getByText("You asked for an introduction on November 11, 2026. Blueprint will reply by email.", { exact: true })).toBeVisible();
  await expect(button).toHaveCount(0);
  expect(introductions).toEqual([{ csrf: "fixture" }]);
  // The stored request survives a reload; nothing is posted again.
  await page.reload();
  await expect(page.getByText("You asked for an introduction on November 11, 2026. Blueprint will reply by email.", { exact: true })).toBeVisible();
  await expect(button).toHaveCount(0);
  expect(introductions).toHaveLength(1);
  expect(unexpected).toEqual([]);
});

test("the answer reads at phone width without scrolling sideways", async ({ browser }) => {
  const { defaultBrowserType: _, ...phone } = devices["iPhone 14"];
  const context = await browser.newContext({ ...phone, serviceWorkers: "block" });
  const page = await context.newPage();
  await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText(readyAnswer.headline, { exact: true })).toBeVisible();
  await page.getByText(/^Ruled out \(/).click();
  await page.locator("summary", { hasText: "Simulation evidence" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await context.close();
});
