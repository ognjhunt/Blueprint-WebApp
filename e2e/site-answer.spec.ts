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
const FIND = "Find a deployment company for this job";
const CONSENT = "This shares an anonymised summary of your job and this answer with deployment companies Blueprint has approved. Your video, address and contacts stay private.";
const LISTED = "You asked on November 11, 2026. Your job card is now visible to approved deployment companies. When one responds, Blueprint will introduce you by email.";
const UNLISTED = "You asked on November 11, 2026. Blueprint will set up your job card and email you.";

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

test("the answer leads the job page and carries the proof in simulation, open, with the winner marked", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  const answer = page.getByRole("region", { name: "Your answer" });
  await expect(answer.getByText(readyAnswer.headline, { exact: true })).toBeVisible();
  const titleBox = await page.getByRole("heading", { level: 1, name: "Your job" }).boundingBox();
  expect(titleBox!.y).toBeLessThan((await answer.boundingBox())!.y);
  // Nothing is asked of the site: no status card repeating a wait under the answer.
  await expect(page.getByText("We have your recording.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Robot fit" })).toHaveCount(0);
  await expect(page.getByText("Blueprint will update this job as the work progresses.", { exact: true })).toHaveCount(0);

  // The proof is part of the answer, visible without opening anything, between the runner-up and what was ruled out.
  const proof = answer.getByRole("region", { name: "Proof in simulation" });
  await expect(proof).toBeVisible();
  await expect(proof.getByText(/^In a simulation of your site, π0\.5, an AI control policy from Physical Intelligence, did best: it completed the job in 7 of 10 tries\.$/)).toBeVisible();
  const [runnerUpBox, proofBox, ruledOutBox] = await Promise.all([answer.getByRole("article", { name: "Runner-up" }).boundingBox(),
    proof.boundingBox(), answer.getByText(/^Ruled out \(/).boundingBox()]);
  expect(runnerUpBox!.y + runnerUpBox!.height).toBeLessThanOrEqual(proofBox!.y);
  expect(proofBox!.y + proofBox!.height).toBeLessThanOrEqual(ruledOutBox!.y);
  const best = proof.getByRole("list", { name: "Control policies tried" }).getByRole("listitem").filter({ hasText: "Did best" });
  await expect(best).toHaveCount(1);
  await expect(best).toContainText("π0.5 from Physical Intelligence");
  await expect(best).toContainText("7 of 10 tries");
  await expect(proof.getByRole("heading", { name: "How far to trust this" })).toBeVisible();
  await expect(proof.getByRole("link", { name: "PolaRiS: Scalable Real-to-Sim Evaluations for Generalist Robot Policies" }))
    .toHaveAttribute("target", "_blank");
  const proofText = await proof.textContent();
  expect(proofText).not.toMatch(/episode|candidate|screening|DROID|jointpos|[a-z]_[a-z]|sha256/i);

  // Every policy's detail stays one click away, folded.
  const details = page.locator("summary", { hasText: "Simulation details" });
  await expect(details.locator("xpath=..")).not.toHaveAttribute("open", "");
  await expect(page.getByText("Every policy we set up, and why any did not run.", { exact: true })).toBeVisible();
  await expect(page.getByText(/checked against real trials/)).toHaveCount(0);
  await expect(page.getByText(simulationRun.summary, { exact: true })).toBeHidden();
  await details.click();
  await expect(page.getByText(simulationRun.summary, { exact: true })).toBeVisible();
  // The choice cell reads as one word.
  const chosen = page.getByRole("cell", { name: "Chosen", exact: true });
  await expect(chosen).toBeVisible();
  expect(await chosen.evaluate(cell => { const range = document.createRange(); range.selectNodeContents(cell);
    return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size; })).toBe(1);
  expect(unexpected).toEqual([]);
});

test("when no policy completed the job, the proof says it could not rank them, with the scene note", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { unexpected } = await mockJob(page, { evaluation: allZeroEvaluation });
  await page.goto(`/capture-upload/${token}?video=existing`);
  const proof = page.getByRole("region", { name: "Proof in simulation" });
  await expect(proof.getByText("The simulation ran, but no policy completed the job in it, so it could not rank them.", { exact: true })).toBeVisible();
  await expect(proof.getByText(SCENE_NOTE_BEYOND_REACH, { exact: true })).toBeVisible();
  await expect(proof.getByText("Did best")).toHaveCount(0);
  await expect(proof.getByText(/likely between/)).toHaveCount(0);
  expect(unexpected).toEqual([]);
});

test("the deployment-company button says what it shares, posts once and shows the confirmation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { introductions, unexpected } = await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  const button = page.getByRole("button", { name: FIND, exact: true });
  await expect(button).toBeVisible();
  await expect(page.getByText(CONSENT, { exact: true })).toBeVisible();
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
  await expect(page.getByText(/now visible to approved deployment companies/)).toHaveCount(0);
  expect(introductions).toHaveLength(1);
});

test("the answer and its proof read at phone width without scrolling sideways", async ({ browser }) => {
  const { defaultBrowserType: _, ...phone } = devices["iPhone 14"];
  const context = await browser.newContext({ ...phone, serviceWorkers: "block" });
  const page = await context.newPage();
  await mockJob(page);
  await page.goto(`/capture-upload/${token}?video=existing`);
  await expect(page.getByText(readyAnswer.headline, { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Proof in simulation" })).toBeVisible();
  await page.getByText(/^Ruled out \(/).click();
  await page.locator("summary", { hasText: "Simulation details" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  // No policy row breaks a word across lines.
  for (const name of await page.locator(".site-proof-name strong").all()) {
    expect(await name.evaluate(node => { const range = document.createRange(); range.selectNodeContents(node);
      return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size; })).toBe(1);
  }
  await context.close();
});
