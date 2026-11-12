import { expect, test, type Page } from "@playwright/test";

/**
 * Package C1, in the browser, with the operator QA sign-in (`VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH=1`, as
 * `npm run qa:operator` sets it): the operator's "Deployment companies" panel on `/admin/jobs`, and a signed-in
 * company's response in the job library with the third answer. Every API the pages read is mocked here; no request
 * leaves the browser.
 */
const JOB = "job-c1";
const NORTH = "a".repeat(64);
const listRow = {
  requestId: JOB, createdAtIso: "2026-11-10T00:00:00.000Z", siteName: "Dock 4", siteLocation: "", company: "Acme", claimed: false,
  archived: false, brief: { state: "confirmed", unresolvedGates: 0 }, capture: { state: "covered", missingViews: [] },
  listing: { state: "live" }, teamAccess: { listed: true, evaluationAvailable: false, reason: "scene_not_runnable", sceneHold: null },
  evaluations: { total: 0, pendingAdmission: 0, admitted: 0, pending: [] },
  runs: { queued: 0, running: 0, reported: 0, noResult: 0, passing: 0, belowTarget: 0, best: null },
  withdrawal: { state: "none" }, opsNotice: null, lastActivityIso: "2026-11-12T00:00:00.000Z", stage: "listing",
  nextAction: "Send the job to deployment companies", actionOwner: "blueprint", attention: [],
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

test("the operator records a send, an emailed answer and a hold on the job's Deployment companies panel", async ({ page }) => {
  const errors = await blockOutside(page);
  const panel = {
    sharing: { state: "shared_visible", words: "Shared and visible to approved companies.", reason: null }, hold: null as null | object,
    consentRevoked: false, libraryUrl: `http://127.0.0.1/contact/robot-team#job-${JOB}`,
    companies: [{ id: NORTH, company: "North Robotics", email: "sales@north.example" }],
    sends: [] as object[], responses: [] as object[],
  };
  const posts: Array<{ path: string; body: unknown }> = [];
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.fulfill({ status: 204, body: "" });
    if (path === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (path === "/api/admin/jobs" && request.method() === "GET") return route.fulfill({ json: { jobs: [listRow], nextCursor: null, scanned: 1, stages: [] } });
    if (path === `/api/admin/jobs/${JOB}`) return route.fulfill({ json: { job: listRow, timeline: [], runs: [], admissions: [],
      admissionDefaults: { episodes: 50, sponsorCapUsd: 20, maxSponsorCapUsd: 20, reservationTtlMs: 1, maxAttempts: 1, evidenceScope: "development_only" },
      links: { lead: "/admin/leads", recommendation: "/admin/robot-team-access" } } });
    const base = `/api/admin/jobs/${JOB}/companies`;
    if (path === base) return route.fulfill({ json: panel });
    if (path.startsWith(base) && request.method() === "POST") {
      const body = request.postDataJSON();
      posts.push({ path: path.slice(base.length), body });
      if (path === `${base}/sends`) panel.sends.push({ sendId: "send-1", companyId: NORTH, company: "North Robotics", alias: "A",
        sentAtIso: "2026-11-12T10:00:00.000Z", sentBy: "operator-qa@tryblueprint.local", voidedAtIso: null, voidedBy: null });
      if (path === `${base}/responses`) panel.responses.push({ companyId: NORTH, company: "North Robotics", email: "sales@north.example",
        alias: "A", state: body.state, inputs: body.inputs, updatedAtIso: "2026-11-12T11:00:00.000Z", recordedBy: "operator" });
      if (path === `${base}/hold`) {
        panel.hold = body.held ? { atIso: "2026-11-12T12:00:00.000Z", by: "operator-qa@tryblueprint.local", reason: null } : null;
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
  const section = page.getByRole("region", { name: "Deployment companies" });
  await expect(section.getByText("Shared and visible to approved companies.", { exact: true })).toBeVisible();
  await expect(section.getByLabel("Job library address")).toHaveText(`http://127.0.0.1/contact/robot-team#job-${JOB}`);

  const sendForm = section.getByRole("form", { name: "Record a send" });
  await sendForm.getByRole("combobox").selectOption(NORTH);
  await sendForm.getByRole("button", { name: "Record the send" }).click();
  await expect(section.getByRole("region", { name: "Sends" })).toContainText("North Robotics (Company A to the site)");

  const responseForm = section.getByRole("form", { name: "Record a response" });
  await responseForm.getByRole("combobox", { name: /^Company/ }).selectOption(NORTH);
  await responseForm.getByRole("combobox", { name: /^Answer/ }).selectOption("needs_something");
  await responseForm.getByLabel(/Their words/).fill("We would need a second gripper.");
  await responseForm.getByRole("button", { name: "Record the response" }).click();
  const responses = section.getByRole("region", { name: "Responses" });
  await expect(responses).toContainText("Would need something");
  await expect(responses).toContainText("“We would need a second gripper.”");
  await expect(responseForm.getByRole("textbox", { name: /Note/ })).toHaveCount(0);

  await section.getByRole("button", { name: "Stop showing this job to companies" }).click();
  await expect(section.getByText("Shared, but not visible to companies right now: Blueprint stopped showing it.", { exact: true })).toBeVisible();
  await expect(sendForm.getByRole("button", { name: "Record the send" })).toBeDisabled();
  await section.getByRole("button", { name: "Show again" }).click();
  await expect(section.getByText("Shared and visible to approved companies.", { exact: true })).toBeVisible();

  expect(posts).toEqual([
    { path: "/sends", body: { companyId: NORTH } },
    { path: "/responses", body: { companyId: NORTH, state: "needs_something", inputs: "We would need a second gripper." } },
    { path: "/hold", body: { held: true } },
    { path: "/hold", body: { held: false } },
  ]);
  expect(errors).toEqual([]);
});

test("a signed-in company opens a job from the library, watches the video and answers on the job's page", async ({ page }) => {
  const errors = await blockOutside(page);
  const answers: unknown[] = [];
  const videoRequests: string[] = [];
  const statement = "The site is told your answer. If you answer Interested and the site asks for an introduction, we give the site your company's name and your contact details, and give you theirs.";
  const videoUrl = `/api/company-media/jobs/${JOB}/video.mp4?capture=walkthrough-${JOB}&viewer=${NORTH}&expires=1&signature=x`;
  await page.route("**/api/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.fulfill({ status: 204, body: "" });
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "fixture" } });
    if (url.pathname === "/api/site-worlds/tasks") return route.fulfill({ json: {
      access: { gated: true, status: "approved", signedIn: true, emailVerified: true, allowed: true, staff: false },
      items: [{ id: JOB, title: "Carton palletizing opportunity", taskFamily: "Pallet handling", siteType: "", region: "", objects: "Cartons",
        cycleTarget: "", pilotTiming: "", pilotBudget: "", opportunity: "open", stage: "preparing", evaluationAvailable: false, costUsd: null,
        publishedAtIso: "2026-11-12T10:00:00.000Z", thumbnailUrl: null, jobUrl: `/jobs/${JOB}` }] } });
    if (url.pathname === `/api/site-worlds/jobs/${JOB}`) return route.fulfill({ json: { item: {
      schemaVersion: "company_job_page.v1", id: JOB, title: "Carton palletizing opportunity", taskFamily: "Pallet handling",
      publishedAtIso: "2026-11-12T10:00:00.000Z", sentence: "Stack 12 kg cartons from the conveyor onto the pallet.",
      jobFacts: ["Weight: 5 to 15 kg (11 to 33 lb)"], country: "United States",
      video: { state: "ready", url: videoUrl, width: 640, height: 360, durationSeconds: 1 },
      simulation: { state: "not_finished" }, firstLook: null,
      firstLookRows: [{ verdict: "conditional", text: "Fits if the item weighs under 20 kg.", robot: "Universal Robots UR20" }],
      myAnswer: null, responseStatement: { version: "company-response-2026-11-12", text: statement } } } });
    if (url.pathname === `/api/company-media/jobs/${JOB}/video.mp4`) {
      videoRequests.push(url.search);
      return route.fulfill({ status: 200, headers: { "content-type": "video/mp4", "cache-control": "private, no-store" }, body: Buffer.from("not-a-real-mp4") });
    }
    if (url.pathname === `/api/site-worlds/tasks/${JOB}/interest` && request.method() === "POST") {
      answers.push(request.postDataJSON());
      return route.fulfill({ json: { ok: true, nextAction: "Your answer is saved. The site is told your answer. Answering commits nobody." } });
    }
    return route.fulfill({ status: 503, json: { error: "No live API calls in browser fixture" } });
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/contact/robot-team");
  const row = page.locator(`li#job-${JOB}`);
  await expect(row).toBeVisible();
  await expect(row.getByRole("form")).toHaveCount(0);
  await row.getByRole("link", { name: "Open the job and answer" }).click();
  await expect(page).toHaveURL(new RegExp(`/jobs/${JOB}$`));
  await expect(page.getByRole("heading", { name: "Carton palletizing opportunity" })).toBeVisible();
  await expect(page.getByText("Stack 12 kg cartons from the conveyor onto the pallet.")).toBeVisible();
  await expect(page.getByText("Weight: 5 to 15 kg (11 to 33 lb)")).toBeVisible();
  await expect(page.getByText("The simulation of the site is not finished yet.")).toBeVisible();
  const video = page.getByLabel("The site's video, without sound");
  await expect(video).toHaveAttribute("src", videoUrl);
  await expect(video).toHaveAttribute("controlsList", /nodownload/);
  await expect.poll(() => videoRequests.length).toBeGreaterThan(0);

  const form = page.getByRole("form", { name: "Answer about this job" });
  await expect(form.getByText(statement, { exact: true })).toBeVisible();
  await form.getByLabel("Interested").check();
  await form.getByRole("textbox").fill("We palletize cartons like these today.");
  await form.getByRole("button", { name: "Send answer" }).click();
  await expect(form.getByRole("status")).toHaveText(/^Your answer is saved\./);
  expect(answers).toEqual([{ state: "interested", inputs: "We palletize cartons like these today.", statementVersion: "company-response-2026-11-12" }]);
  expect(errors).toEqual([]);
});
