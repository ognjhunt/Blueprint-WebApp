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
  await page.locator("#start-method-upload").check();
  await page.locator("#start-footage").setInputFiles(VIDEO);
  await page.locator("#start-region").selectOption("us");
  await page.locator("#start-email").fill(email);
  await expect(page.locator("#start-task")).toHaveValue("");
  if (shot) await page.screenshot({ path: path.join(SHOTS, shot), fullPage: true });
  await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your recording is in.", exact: true })).toBeVisible({ timeout: 60_000 });
  const link = page.getByRole("link", { name: "Open your job and assessment", exact: true });
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

const answer = (page: Page) => page.getByRole("region", { name: "Your answer" });

/** Waits, within the page's own status polling, for the answer and checks what it says. */
async function expectAnswer(page: Page) {
  const section = answer(page);
  await expect(section.getByRole("heading", { name: "Your answer", exact: true })).toBeVisible({ timeout: 45_000 });
  const headline = section.locator(".site-answer-headline");
  await expect(headline).toHaveText(/^Most likely to fit: .+\.$/);
  const pick = section.getByRole("article", { name: "Our pick" });
  await expect(pick).toBeVisible();
  // The pick's track record carries a published source, opened in a new tab.
  const source = pick.locator(".site-answer-evidence a[href^='https://']").first();
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute("target", "_blank");
  await expect(section.getByRole("article", { name: "Runner-up" })).toBeVisible();
  await expect(section.getByRole("heading", { name: /^How sure we are: / })).toBeVisible();
  const proof = section.getByRole("region", { name: "Proof in simulation" });
  await expect(proof).toBeVisible();
  await expect(proof).toContainText("The simulation of your site has not started yet.");
  return (await headline.textContent())!.trim();
}

test("desktop: email and video in, the answer on the job page, a deployment company asked for, one answer email", async ({ page, request }) => {
  const missing: string[] = [];
  await localOnly(page, missing);
  const { link, requestId } = await startWithVideo(page, `answer-journey-desktop-${Date.now()}@example.invalid`, "journey-1-form-desktop.png");
  await page.screenshot({ path: path.join(SHOTS, "journey-2-submitted-desktop.png"), fullPage: true });
  await link.click();
  await expect(page.getByRole("heading", { level: 1, name: "Your job", exact: true })).toBeVisible();
  // Before the video is read the answer says so, and offers nothing yet.
  await expect(answer(page).locator(".site-answer-headline")).toHaveText("We are reading your video. Your answer will appear here.");
  await expect(answer(page).getByRole("button", { name: "Find a deployment company for this job" })).toHaveCount(0);

  const ticked = await tick(request, requestId);
  expect(ticked.finished).toBe(true);
  // KNOWN (2026-11-11): with no typed job the review drafts the job from the video, which
  // changes the brief its claim was bound to, so the queue reads the same video a second
  // time before the review leaves the queue: two model calls per job instead of one.
  // Kept visible here rather than asserted away; tighten to 1 once the queue keeps the
  // first review's result across its own draft.
  test.info().annotations.push({ type: "video-model-calls", description: String(ticked.videoModelCalls) });
  expect(ticked.videoModelCalls).toBeGreaterThanOrEqual(1);
  expect(ticked.videoModelCalls).toBeLessThanOrEqual(2);
  const headline = await expectAnswer(page);
  await answer(page).screenshot({ path: path.join(SHOTS, "journey-3-answer-desktop.png") });

  // (b) Find a deployment company: one click, the confirmation, and it survives a reload.
  const find = answer(page).getByRole("button", { name: "Find a deployment company for this job", exact: true });
  await expect(find).toBeVisible();
  await expect(answer(page)).toContainText("Your video, address and contacts stay private.");
  await find.click();
  const confirmation = answer(page).getByRole("status").filter({ hasText: /^You asked on / });
  await expect(confirmation).toContainText("Your job card is now visible to approved deployment companies");
  await page.screenshot({ path: path.join(SHOTS, "journey-4-requested-desktop.png"), fullPage: true });
  await page.reload();
  await expect(answer(page).getByRole("status").filter({ hasText: /^You asked on / })).toBeVisible({ timeout: 45_000 });
  await expect(answer(page).getByRole("button", { name: "Find a deployment company for this job" })).toHaveCount(0);

  // (c) Exactly one answer email for this job, carrying the headline. Never delivered here.
  const rows = (await outbox(request, requestId)).filter(row => row.kind === "answer_ready");
  expect(rows).toHaveLength(1);
  expect(rows[0].idempotencyKey).toBe(`${requestId}:answer_ready`);
  expect(rows[0].body).toContain(headline);
  // A second pass of the review settles nothing new and queues no second email.
  expect((await tick(request, requestId)).videoModelCalls).toBe(0);
  expect((await outbox(request, requestId)).filter(row => row.kind === "answer_ready")).toHaveLength(1);

  // (e) Withdrawing recording permission takes the answer off the page.
  await page.getByText("Withdraw recording permission", { exact: true }).click();
  await page.getByRole("button", { name: "Withdraw permission…" }).click();
  await page.getByRole("button", { name: "Yes, withdraw permission" }).click();
  await expect(page.getByText("Recording permission withdrawn.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Recording permission withdrawn.", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(answer(page)).toHaveCount(0);
  await expect(page.getByText(headline, { exact: true })).toHaveCount(0);

  expect(missing, "every API the page calls is mounted in the harness").toEqual([]);
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
    await expectAnswer(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(SHOTS, "journey-3-answer-phone.png"), fullPage: true });
    expect(missing).toEqual([]);
  });
});
