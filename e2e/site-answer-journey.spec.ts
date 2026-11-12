/**
 * The site's answer, end to end, in a real browser against the real server handlers.
 *
 * How to run (nothing leaves the machine; see scripts/qa/answer-journey-local-app.ts):
 *
 *   npx -y firebase-tools@13.35.1 emulators:start --only firestore,storage \
 *     --project demo-blueprint-reliability --config firebase.json      # in another shell
 *   npm run test:answer-journey:browser -- --trace off                  # starts the app on :4183
 *
 * Add PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/google-chrome where Playwright's own browser
 * is not installed. Stop the emulators afterwards.
 *
 * Real: intake, upload, task-brief, job-workflow and task-listings routers, the coverage
 * queue and review, the video adapter (audio strip included), the answer composer, the
 * lifecycle email enqueue, Firestore and Storage (emulators), the normal Vite app.
 * Synthetic: the video model's reply (a scripted reading of one carton moved 1.6 m) and
 * the unsigned storage read URL. Email is read from the outbox, never delivered.
 */
import { test, expect, devices, type Page, type APIRequestContext } from "@playwright/test";
import path from "node:path";

const ORIGIN = "http://127.0.0.1:4183";
const VIDEO = path.resolve("e2e/fixtures/synthetic-transport.mp4");
const SHOTS = process.env.ANSWER_JOURNEY_SHOTS || path.resolve("output/answer-journey/shots");

/** The private link's token names the job; its payload is signed, not secret, to its holder. */
function jobOf(href: string) {
  const token = new URL(href, ORIGIN).pathname.split("/").pop()!;
  return { token, requestId: JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")).requestId as string };
}

/** Nothing but the local app: any other host is refused in the browser too. */
async function localOnly(page: Page, missing: string[]) {
  await page.context().route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/, route => route.abort("blockedbyclient"));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/") && response.status() === 404) missing.push(`${response.request().method()} ${url.pathname}`);
  });
}

/** The start form: upload a video, the country, an email. No typed job. */
async function startWithVideo(page: Page, email: string, shot?: string) {
  await page.goto("/contact/site-operator", { waitUntil: "networkidle" });
  await page.locator("#start-method-upload").click();
  await page.locator("#start-footage").setInputFiles(VIDEO);
  // The country is asked for only when needed: pressing the button with no address asks for it.
  await page.locator("#start-email").fill(email);
  await page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ }).click();
  await page.locator("#start-region").selectOption("us");
  await expect(page.locator("#start-task")).toHaveValue("");
  if (shot) await page.screenshot({ path: path.join(SHOTS, shot), fullPage: true });
  await page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ }).click();
  await expect(page.getByRole("heading", { name: "We have your video.", exact: true })).toBeVisible({ timeout: 60_000 });
  const link = page.getByRole("link", { name: "Open my job", exact: true });
  const job = jobOf((await link.getAttribute("href"))!);
  return { link, ...job };
}

/** Runs the coverage review's production entry point once (the scheduler is off in the harness). */
async function tick(request: APIRequestContext, requestId: string) {
  const response = await request.post(`${ORIGIN}/api/reliability/tick?requestId=${encodeURIComponent(requestId)}`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ finished: boolean; passes: number; videoModelCalls: number }>;
}

async function outbox(request: APIRequestContext, requestId: string) {
  const response = await request.get(`${ORIGIN}/api/reliability/outbox?requestId=${encodeURIComponent(requestId)}`);
  expect(response.ok()).toBe(true);
  return (await response.json()).rows as Array<{ kind: string; status: string; subject: string; body: string; idempotencyKey: string }>;
}

const answer = (page: Page) => page.getByRole("region", { name: "Your job" });

/**
 * The job's no-grant wait ends, as the scheduler's sweep records it: the first pass starts the wait, a pass a window
 * later records the ending and queues its one email. With no simulation on the way, the first look stands on its own.
 */
async function endWithoutGrant(request: APIRequestContext, requestId: string) {
  const sweep = async (atMs: number) => {
    const response = await request.post(`${ORIGIN}/api/reliability/no-grant-sweep?requestId=${encodeURIComponent(requestId)}&atMs=${atMs}`);
    expect(response.ok()).toBe(true);
    return ((await response.json()) as { result: string }).result;
  };
  const now = Date.now();
  expect([await sweep(now), await sweep(now + 60 * 86_400_000)]).toEqual(["clock_started", "ended_notice_queued"]);
}

/** While the simulation is being built the page says so, and offers nothing to share yet. */
async function expectGettingReady(page: Page) {
  await expect(answer(page).getByText("We're building the simulation of your site.", { exact: true })).toBeVisible({ timeout: 45_000 });
  await expect(answer(page).getByText("We're building your job packet. Nothing has been shared.", { exact: true })).toBeVisible();
  await expect(answer(page).getByRole("button", { name: "Share my job" })).toHaveCount(0);
}

/** Waits, within the page's own status polling, for the answer and checks what it says. Returns the robot's name. */
async function expectAnswer(page: Page) {
  const section = answer(page);
  const firstLook = page.getByRole("region", { name: "First look" });
  const sentence = firstLook.getByText(/^On paper, the robot most likely to fit: .+\.$/);
  // The scripted reading (one carton, 1.6 m, a stated weight) gives a pick that fits on its published figures.
  await expect(sentence).toBeVisible({ timeout: 45_000 });
  await expect(firstLook.getByText("From published specifications and where it has been used.", { exact: true })).toBeVisible();
  await expect(firstLook).toContainText(/How sure are we\?/);
  // Every figure and source is on the details screen: a published figure always has its source; the track
  // record carries one, or says plainly that none was found for this kind of job (a carton moved to a cart is
  // pick and place; the pick may have documented use only for palletizing). Never an invented one.
  await section.getByRole("button", { name: "See details ›" }).click();
  await page.getByRole("button", { name: "First look: why this robot" }).click();
  const why = page.locator(".site-answer-details");
  await expect(why.getByRole("link", { name: "source" }).first()).toHaveAttribute("target", "_blank");
  if (!(await why.getByText("We found no documented use of this robot on this kind of job.").count())) {
    await expect(why.locator("a[href^='https://']").nth(1)).toHaveAttribute("target", "_blank");
  }
  await page.getByRole("button", { name: "‹ Back" }).click();
  await page.getByRole("button", { name: "Other robots" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /^Other robots/ })).toBeVisible();
  await page.getByRole("button", { name: "‹ Back" }).click();
  await page.getByRole("button", { name: "‹ Back" }).click();
  // Before our early trial starts, the page says nothing about it.
  await expect(section).not.toContainText(/early trial|Simulation test/i);
  return (await sentence.textContent())!.trim();
}

test.describe("desktop", () => {
test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
test("desktop: email and video in, the answer on the job page, a deployment company asked for, one answer email", async ({ page, request }) => {
  const missing: string[] = [];
  await localOnly(page, missing);
  const { link, requestId } = await startWithVideo(page, `answer-journey-desktop-${Date.now()}@example.invalid`, "journey-1-form-desktop.png");
  await page.screenshot({ path: path.join(SHOTS, "journey-2-submitted-desktop.png"), fullPage: true });
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: "Your job", exact: true })).toBeVisible();
  // Before the video is read the answer says so, and offers nothing yet.
  await expect(answer(page).getByText("We're watching your video.", { exact: true })).toBeVisible();
  await expect(answer(page).getByRole("button", { name: "Share my job" })).toHaveCount(0);

  const ticked = await tick(request, requestId);
  expect(ticked.finished).toBe(true);
  test.info().annotations.push({ type: "video-model-calls", description: String(ticked.videoModelCalls) });
  expect(ticked.videoModelCalls).toBe(1);
  // (a) The video is read and no ending is recorded: the job is on its way to a simulation (review, 2026-11-11).
  await expectGettingReady(page);
  await answer(page).screenshot({ path: path.join(SHOTS, "journey-3a-getting-ready-desktop.png") });
  expect((await outbox(request, requestId)).filter(row => !["task_received", "video_received"].includes(row.kind))).toEqual([]);
  // The job's wait for a simulation ends with none built: the first look stands, with the reason.
  await endWithoutGrant(request, requestId);
  await page.reload();
  const headline = await expectAnswer(page);
  await expect(answer(page)).toContainText("We have not built a simulation for this job.");
  await answer(page).screenshot({ path: path.join(SHOTS, "journey-3-answer-desktop.png") });
  await page.screenshot({ path: path.join(SHOTS, "journey-answer-desktop.png"), fullPage: true });

  // (b) Share the job with deployment companies: the question, one click, the confirmation, and it survives a reload.
  const find = answer(page).getByRole("button", { name: "Share my job", exact: true });
  await expect(find).toBeVisible();
  await expect(answer(page)).toContainText("May we share a summary of your job with deployment companies we approve?");
  await expect(answer(page)).toContainText("Your video, address and contacts stay private.");
  const posted = page.waitForResponse(response => response.url().endsWith("/introduction-request") && response.request().method() === "POST");
  await find.click();
  const reply = await posted;
  expect(reply.status(), await reply.text()).toBe(200);
  const confirmation = answer(page).getByRole("status");
  await expect(confirmation).toHaveText(/^Shared on .+ with the deployment companies we've approved\. Nothing more is needed from you\.$/);
  await page.screenshot({ path: path.join(SHOTS, "journey-4-requested-desktop.png"), fullPage: true });
  await page.reload();
  await expect(answer(page).getByRole("status")).toHaveText(/^Shared on .+ with the deployment companies we've approved\. Nothing more is needed from you\.$/, { timeout: 45_000 });
  await expect(answer(page).getByRole("button", { name: "Share my job" })).toHaveCount(0);

  // (c) One email, queued by the sweep that recorded the ending (review, 2026-11-11): why no simulation was built, and
  // the first look. Never delivered here.
  const answers = async () => (await outbox(request, requestId)).filter(row => ["answer_ready", "scene_outcome", "evaluation_outcome", "preparation_ended"].includes(row.kind));
  const paper = await answers();
  expect(paper.map(row => row.idempotencyKey)).toEqual([`${requestId}:scene_outcome:job_no_grant_ended`]);
  // A final ending: the first look, with no promise of a later result (review, 2026-11-11).
  expect(paper[0].body).toContain("On paper, the robot most likely to fit: ");
  expect(paper[0].body).not.toContain("If our early trial gives a result later");
  expect(headline).toBeTruthy();
  // A second pass of the review settles nothing new and queues no email.
  expect((await tick(request, requestId)).videoModelCalls).toBe(0);
  expect(await answers()).toHaveLength(1);

  // (e) Withdrawing recording permission takes the answer off the page. The way to stop is on Job settings.
  await answer(page).getByRole("button", { name: "Job settings ›" }).click();
  await page.getByText("Stop using my video", { exact: true }).click();
  await page.getByRole("button", { name: "Withdraw permission…" }).click();
  await page.getByRole("button", { name: "Yes, withdraw permission" }).click();
  await expect(page.getByText("Recording permission withdrawn.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Recording permission withdrawn.", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(answer(page)).toHaveCount(0);
  await expect(page.getByText(headline, { exact: true })).toHaveCount(0);

  expect(missing, "every API the page calls is mounted in the harness").toEqual([]);
});

});

test.describe("phone", () => {
  const { defaultBrowserType: _browser, ...iPhone } = devices["iPhone 14"];
  test.use({ ...iPhone });
  test("iPhone 14: the same journey shows the answer with no sideways scroll", async ({ page, request }) => {
    const missing: string[] = [];
    await localOnly(page, missing);
    const { link, requestId } = await startWithVideo(page, `answer-journey-phone-${Date.now()}@example.invalid`);
    await link.click();
    expect((await tick(request, requestId)).finished).toBe(true);
    await expectGettingReady(page);
    await endWithoutGrant(request, requestId);
    await page.reload();
    await expectAnswer(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(SHOTS, "journey-3-answer-phone.png"), fullPage: true });
    expect(missing).toEqual([]);
  });
});
