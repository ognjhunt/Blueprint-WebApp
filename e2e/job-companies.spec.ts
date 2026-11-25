import { expect, test, type Page } from "@playwright/test";

/**
 * Package C1, in the browser, with the operator QA sign-in (`VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1`, as
 * `npm run qa:operator` sets it): the "Deployment companies" staff tool on a job's page at `/admin/jobs`, and a signed-in
 * company's response in the job library with the third answer. Every API the pages read is mocked here; no request
 * leaves the browser.
 */
const JOB = "job-c1";
const NORTH = "a".repeat(64);
const listRow = { requestId: JOB, sentence: "Stack cartons onto the pallet.", internalTest: null, phase: "simulation_ready",
  standing: "Simulation ready", receivedAtIso: "2026-11-10T00:00:00.000Z" };
const detail = {
  requestId: JOB, job: { sentence: "Stack cartons onto the pallet.", drafted: false, site: { name: "Dock 4", place: "Springfield" }, internalTest: null },
  standing: { phase: "simulation_ready", phrase: "Simulation ready", siteSees: null, companies: "Shared and visible to approved companies.", pipeline: null },
  simulationPackageUrl: null, simulationPackage: null, cost: null, stops: [],
  events: [{ key: "received", text: "Job received", atIso: "2026-11-10T00:00:00.000Z" }],
};

/** Page errors other than the QA server's known missing HMR socket. */
async function blockOutside(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("pageerror", error => {
    if (!/^Failed to construct 'WebSocket'/.test(error.message)) errors.push(error.message);
  });
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    return ["127.0.0.1", "localhost"].includes(url.hostname) ? route.continue() : route.fulfill({ status: 204, body: "" });
  });
  return errors;
}

test("the operator sees the sends and answers on record and stops showing the job with a reason, on the job's Deployment companies panel", async ({ page }) => {
  const errors = await blockOutside(page);
  const panel = {
    sharing: { state: "shared_visible", words: "Shared and visible to approved companies.", reason: null }, hold: null as null | object,
    consentRevoked: false, libraryUrl: `http://127.0.0.1/contact/robot-team#job-${JOB}`,
    companies: [{ id: NORTH, company: "North Robotics", email: "sales@north.example" }],
    sends: [{ sendId: `system-${NORTH}`, companyId: NORTH, company: "North Robotics", alias: "A", sentAtIso: "2026-11-12T10:00:00.000Z",
      sentBy: "system", voidedAtIso: null, voidedBy: null }],
    responses: [{ companyId: NORTH, company: "North Robotics", email: "sales@north.example", alias: "A", state: "needs_something",
      inputs: "We would need a second gripper.", updatedAtIso: "2026-11-12T11:00:00.000Z", recordedBy: "company" }],
  };
  const posts: Array<{ path: string; body: unknown }> = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.fulfill({ status: 204, body: "" });
    if (path === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (path === "/api/admin/jobs" && request.method() === "GET") return route.fulfill({ json: { jobs: [listRow], nextCursor: null } });
    if (path === `/api/admin/jobs/${JOB}`) return route.fulfill({ json: detail });
    const base = `/api/admin/jobs/${JOB}/companies`;
    if (path === base) return route.fulfill({ json: panel });
    if (path.startsWith(base) && request.method() === "POST") {
      const body = request.postDataJSON();
      posts.push({ path: path.slice(base.length), body });
      if (path === `${base}/hold`) {
        panel.hold = body.held ? { atIso: "2026-11-12T12:00:00.000Z", by: "operator-qa@tryblueprint.local", reason: body.reason } : null;
        panel.sharing = body.held ? { state: "shared_not_visible", reason: "blueprint_hold",
          words: "Shared, but not visible to companies right now: Blueprint stopped showing it." }
          : { state: "shared_visible", words: "Shared and visible to approved companies.", reason: null };
      }
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ status: 503, json: { error: "No live API calls in browser fixture" } });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/admin/jobs?job=${JOB}`);
  // A staff tool on the job's page: closed until opened.
  await page.getByText("Deployment companies", { exact: true }).click();
  const section = page.getByRole("region", { name: "Deployment companies" });
  await expect(section.getByText("Shared and visible to approved companies.", { exact: true })).toBeVisible();
  await expect(section.getByRole("region", { name: "Sends" })).toContainText("North Robotics (Company A to the site)");
  const responses = section.getByRole("region", { name: "Responses" });
  await expect(responses).toContainText("Need more details");
  await expect(responses).toContainText("“We would need a second gripper.”");
  await expect(section.getByRole("form", { name: "Record a send" })).toHaveCount(0);
  await expect(section.getByRole("form", { name: "Record a response" })).toHaveCount(0);
  await expect(section.getByRole("button", { name: "Void" })).toHaveCount(0);

  const holdForm = section.getByRole("form", { name: "Stop showing this job to companies" });
  await holdForm.getByRole("button", { name: "Stop showing this job to companies" }).click();
  // No reason, no hold: the browser keeps the form until one is given.
  expect(posts).toEqual([]);
  await holdForm.getByRole("textbox").fill("Checking the summary");
  await holdForm.getByRole("button", { name: "Stop showing this job to companies" }).click();
  await expect(section.getByText("Shared, but not visible to companies right now: Blueprint stopped showing it.", { exact: true })).toBeVisible();
  await section.getByRole("button", { name: "Show again" }).click();
  await expect(section.getByText("Shared and visible to approved companies.", { exact: true })).toBeVisible();

  expect(posts).toEqual([
    { path: "/hold", body: { held: true, reason: "Checking the summary" } },
    { path: "/hold", body: { held: false } },
  ]);
  expect(errors).toEqual([]);
});

test("a signed-in company opens a job from the library, watches the video and answers on the job's page", async ({ page }) => {
  const errors = await blockOutside(page);
  const answers: unknown[] = [];
  const videoRequests: string[] = [];
  const statement = "The site is told your answer. If you answer Interested or Tested it: can do and the site asks for an introduction, we give the site your company's name and your contact details, and give you theirs.";
  const videoUrl = `/api/company-media/jobs/${JOB}/video.mp4?capture=walkthrough-${JOB}&viewer=${NORTH}&expires=1&signature=x`;
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.fulfill({ status: 204, body: "" });
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === "/api/site-worlds/tasks") return route.fulfill({ json: {
      access: { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: false },
      items: [{ id: JOB, title: "Carton palletizing opportunity", taskFamily: "Pallet handling", siteType: "", region: "", objects: "Cartons",
        cycleTarget: "", pilotTiming: "", pilotBudget: "", opportunity: "open", stage: "preparing", evaluationAvailable: false,
        publishedAtIso: "2026-11-12T10:00:00.000Z", thumbnailUrl: null, jobUrl: `/jobs/${JOB}` }] } });
    if (url.pathname === `/api/site-worlds/jobs/${JOB}`) return route.fulfill({ json: { item: {
      schemaVersion: "company_job_page.v1", id: JOB, title: "Carton palletizing opportunity", taskFamily: "Pallet handling",
      headline: "Stack cartons on pallets", headlineFacts: ["Two shifts"],
      publishedAtIso: "2026-11-12T10:00:00.000Z", sentence: "Stack 12 kg cartons from the conveyor onto the pallet.",
      jobFacts: ["Weight: 5 to 15 kg (11 to 33 lb)"], country: "United States",
      fitSummary: [{ key: "weight", label: "Weight", value: "5 to 15 kg (11 to 33 lb)", state: "stated" },
        { key: "perHour", label: "Times an hour", value: null, state: "not_stated" },
        { key: "hours", label: "Hours a day", value: "Two shifts", state: "stated" }],
      firstLookStatus: null, simulationStatus: "The simulation is being built from the site's video.",
      visitMustConfirm: ["How pallets arrive, where they are staged and how full ones leave."],
      aboutSite: ["The site's name, street address and contact details come only with an introduction the site asks for."],
      video: { state: "ready", url: videoUrl, width: 640, height: 360, durationSeconds: 1 },
      simulation: { state: "not_finished" }, firstLook: null,
      firstLookRows: [{ verdict: "conditional", text: "Fits if the item weighs under 20 kg.", robot: "Universal Robots UR20" }],
      packetFacts: null,
      myAnswer: null, responseStatement: { version: "company-response-2026-11-12", text: statement } } } });
    if (url.pathname === `/api/company-media/jobs/${JOB}/video.mp4`) {
      videoRequests.push(url.search);
      return route.fulfill({ status: 200, headers: { "content-type": "video/mp4", "cache-control": "private, no-store" }, body: Buffer.from("not-a-real-mp4") });
    }
    if (url.pathname === `/api/site-worlds/tasks/${JOB}/interest` && request.method() === "POST") {
      answers.push(request.postDataJSON());
      return route.fulfill({ json: { ok: true, nextAction: "Saved. The site sees this answer, without your company's name." } });
    }
    return route.fulfill({ status: 503, json: { error: "No live API calls in browser fixture" } });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/contact/robot-team");
  const row = page.locator(`li#job-${JOB}`);
  await expect(row).toBeVisible();
  await expect(row.getByRole("form")).toHaveCount(0);
  await row.getByRole("link", { name: "View job" }).click();
  await expect(page).toHaveURL(new RegExp(`/jobs/${JOB}$`));
  await expect(page.getByRole("heading", { name: "Stack cartons on pallets" })).toBeVisible();
  await expect(page.getByText("Stack 12 kg cartons from the conveyor onto the pallet.")).toBeVisible();
  const glance = page.getByLabel("The site's answers");
  await expect(glance.getByText("5 to 15 kg (11 to 33 lb)")).toBeVisible();
  // A skipped question is named on one line under the answers, not given a row (owner, 2026-11-25).
  await expect(glance.getByText("Not stated yet: Times an hour")).toBeVisible();
  await expect(page.getByText("The simulation is being built from the site's video.")).toBeVisible();
  // The visit list is the same for every job of its kind: folded to one line until opened (owner, 2026-11-25).
  await expect(page.getByRole("list", { name: "What a visit must confirm" })).toBeHidden();
  await page.getByText("What a visit must confirm", { exact: true }).click();
  await expect(page.getByRole("list", { name: "What a visit must confirm" })).toBeVisible();
  const video = page.getByLabel("The site's video, without sound");
  await expect(video).toHaveAttribute("src", videoUrl);
  await expect(video).toHaveAttribute("controlsList", /nodownload/);
  await expect.poll(() => videoRequests.length).toBeGreaterThan(0);

  // Back at the top, as a company arrives on the page at phone width.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.setViewportSize({ width: 390, height: 844 });
  const answerLink = page.getByRole("link", { name: "Apply or respond", exact: true });
  await expect(answerLink).toBeInViewport();
  await answerLink.click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const form = page.getByRole("form", { name: "Your response" });
  await expect(form).toBeInViewport();
  await expect(form.getByText(statement, { exact: true })).toBeVisible();
  await form.getByLabel("Apply").check();
  await form.getByRole("textbox", { name: "Note to the site" }).fill("We palletize cartons like these today.");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByRole("status")).toHaveText(/^Saved\. The site sees this answer/);
  expect(answers).toEqual([{ state: "interested", inputs: "We palletize cartons like these today.", statementVersion: "company-response-2026-11-12" }]);
  expect(errors).toEqual([]);
});
