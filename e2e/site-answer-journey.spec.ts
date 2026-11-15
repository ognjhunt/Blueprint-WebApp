/**
 * The core journey, end to end, in a real browser against the real server handlers. It is the safety net for every
 * deletion: if this fails, the product's one path is broken.
 *
 * A site starts a job with an email and a video (no share step) → its job page shows where the job stands and the
 * first look → the job is shared automatically with an approved deployment company, which sees it under no site
 * name, address or contact, opens it and answers → the site sees the answer under an alias and presses "Introduce us"
 * → exactly then each side is emailed the other's details and one billable event is recorded, with no price → the
 * 14-day follow-up asks both sides → the site withdraws, and the job leaves the company's view at once.
 *
 * How to run (nothing leaves the machine; see scripts/qa/answer-journey-local-app.ts):
 *
 *   npx -y firebase-tools@13.35.1 emulators:exec --only firestore,storage,auth \
 *     --project demo-blueprint-reliability --config firebase.json \
 *     "npx playwright test --config playwright.answer-journey.config.ts --trace off"
 *
 * Real: the intake, upload, task-brief, job-workflow, workspace, site-worlds, company-media, robot-team-access,
 * admin robot-team-access and job-outcomes routers with their production middleware (CSRF, Firebase token
 * verification, the admin role check), the coverage review, the automatic send, the introduction transaction, the
 * outcome-question sweep, Firestore, Storage and Auth (emulators), the normal Vite app. Synthetic: the video model's
 * reply (a scripted reading of one carton) and the unsigned storage read URL. The browser's Firebase Auth requests are
 * answered by the local Auth emulator. Email is read from the outbox, never delivered.
 */
import { test, expect, devices, type BrowserContext, type Page, type APIRequestContext } from "@playwright/test";
import path from "node:path";

const ORIGIN = "http://127.0.0.1:4183";
const AUTH_EMULATOR = "http://127.0.0.1:9099";
const PROJECT = "demo-blueprint-reliability";
const VIDEO = path.resolve("e2e/fixtures/synthetic-transport.mp4");
const DAY_MS = 86_400_000;

/** The private link's token names the job; its payload is signed, not secret, to its holder. */
function jobOf(href: string) {
  const token = new URL(href, ORIGIN).pathname.split("/").pop()!;
  return { token, requestId: JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")).requestId as string };
}

/**
 * Nothing but the local app: any other host is refused in the browser, except Firebase Auth's two hosts, which are
 * answered by the local Auth emulator. Every call to an unmounted /api route is collected: each API a page calls must be mounted.
 */
async function localOnly(context: BrowserContext, missing: string[]) {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/, route => route.abort("blockedbyclient"));
  await context.route(/^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//, async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${AUTH_EMULATOR}/${url.host}${url.pathname}${url.search}` });
    await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": ORIGIN } });
  });
  // An unmounted route gets the harness's own 404; a product 404 (a job no longer shared) is an answer, not a gap.
  context.on("response", async response => {
    const url = new URL(response.url());
    if (url.origin !== ORIGIN || !url.pathname.startsWith("/api/") || response.status() !== 404) return;
    if ((await response.text().catch(() => "")).includes("Route outside scoped reliability harness")) missing.push(`${response.request().method()} ${url.pathname}`);
  });
}

/** A verified account in the Auth emulator, with optional custom claims; returns its ID token. */
async function account(request: APIRequestContext, email: string, password: string, claims?: Record<string, unknown>) {
  const created = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, {
    headers: { Authorization: "Bearer owner" },
    data: { email, password },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const updated = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
    headers: { Authorization: "Bearer owner" },
    data: { localId: (await created.json()).localId, emailVerified: true, ...(claims ? { customAttributes: JSON.stringify(claims) } : {}) },
  });
  expect(updated.ok(), await updated.text()).toBe(true);
  return signIn(request, email, password);
}

async function signIn(request: APIRequestContext, email: string, password: string) {
  const signedIn = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-fixture-key`,
    { data: { email, password, returnSecureToken: true } });
  expect(signedIn.ok(), await signedIn.text()).toBe(true);
  return (await signedIn.json()).idToken as string;
}

/** The CSRF pair the production middleware checks: the cookie (kept by the context) and the same value in a header. */
async function csrf(request: APIRequestContext) {
  const response = await request.get(`${ORIGIN}/api/csrf`);
  expect(response.ok()).toBe(true);
  return { "X-CSRF-Token": (await response.json()).csrfToken as string };
}

/** The start form: upload a video, a typed street address, the country, an email. No typed job and no share step. */
async function startWithVideo(page: Page, email: string, address: string) {
  await page.goto("/contact/site-operator", { waitUntil: "networkidle" });
  await page.locator("#start-method-upload").click();
  await page.locator("#start-footage").setInputFiles(VIDEO);
  await page.locator("#start-location").fill(address);
  await page.locator("#start-email").fill(email);
  const send = page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ });
  await page.locator("#start-region").selectOption("us");
  await expect(page.locator("#start-task")).toHaveValue("");
  // Sharing is the service: nothing on the start form asks to share.
  await expect(page.getByRole("button", { name: /share my job/i })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/May we share/i);
  const posted = page.waitForRequest(request => request.method() === "POST"
    && /\/api\/(inbound-request|workspace\/capture-start)$/.test(new URL(request.url()).pathname));
  const answered = page.waitForResponse(response => response.request().method() === "POST"
    && /\/api\/(inbound-request|workspace\/capture-start)$/.test(new URL(response.url()).pathname));
  await send.click();
  const body = (await posted).postDataJSON();
  // The statements the site accepts by starting, at their current versions (video: v4 for both).
  expect(body.consentAttestation).toEqual({ granted: true, statementVersion: "2026-11-12.v4" });
  expect(body.descriptionAuthority).toEqual({ granted: true, statementVersion: "2026-11-12.v4" });
  expect((await answered).status()).toBeLessThan(300);
  await expect(page.getByRole("heading", { name: "We have your video.", exact: true })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: /share my job/i })).toHaveCount(0);
  const link = page.getByRole("link", { name: "Open my job", exact: true });
  return { link, ...jobOf((await link.getAttribute("href"))!) };
}

async function tick(request: APIRequestContext, requestId: string) {
  const response = await request.post(`${ORIGIN}/api/reliability/tick?requestId=${encodeURIComponent(requestId)}`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ finished: boolean; passes: number; videoModelCalls: number }>;
}

type OutboxRow = { kind: string; status: string; subject: string; body: string; to: string; idempotencyKey: string };
async function outbox(request: APIRequestContext, requestId: string): Promise<OutboxRow[]> {
  const response = await request.get(`${ORIGIN}/api/reliability/outbox?requestId=${encodeURIComponent(requestId)}`);
  expect(response.ok()).toBe(true);
  return (await response.json()).rows;
}

type JobRecord = { billable: Array<Record<string, unknown>>; sends: Array<Record<string, unknown>>;
  introductions: Array<{ id: string }>; access: { listed: boolean; reason: string | null } };
async function jobRecord(request: APIRequestContext, requestId: string): Promise<JobRecord> {
  const response = await request.get(`${ORIGIN}/api/reliability/job?requestId=${encodeURIComponent(requestId)}`);
  expect(response.ok()).toBe(true);
  return response.json();
}

const answer = (page: Page) => page.getByRole("region", { name: "Your job" }).last();
const companies = (page: Page) => page.getByRole("region", { name: "Deployment companies" });

/** The site's job page: where the job stands and the first look, with no answer that was not given. */
async function expectFirstLook(page: Page) {
  const firstLook = page.getByRole("region", { name: "First look" });
  await expect(firstLook.getByText(/^On paper, the robot most likely to fit: .+\.$/)).toBeVisible({ timeout: 45_000 });
  await expect(firstLook.getByText("From published specifications and where it has been used.", { exact: true })).toBeVisible();
  await expect(firstLook).toContainText(/How sure are we\?/);
  await expect(companies(page)).toContainText("We share your job with the deployment companies we approve.");
  await expect(answer(page)).not.toContainText(/answered on|Introduce us|early trial|Simulation test/i);
  await expect(page.getByRole("button", { name: /share my job/i })).toHaveCount(0);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("email and video in, shared automatically, a company answers, the site asks for an introduction, follow-ups, withdrawal", async ({ page, request, browser }) => {
    const stamp = Date.now();
    const site = { email: `core-journey-site-${stamp}@example.invalid`, address: `1847 Quillfeather Lane ${stamp}, Dockside` };
    const company = { email: `core-journey-company-${stamp}@example.invalid`, name: `Quillfeather Robotics ${stamp}`,
      contact: "Ada Corewright", password: "core-journey-company-pass" };
    const missing: string[] = [];
    await localOnly(page.context(), missing);

    // 1. The site starts a job: email, address and video in, the current statements accepted, no share step.
    const { link, requestId, token } = await startWithVideo(page, site.email, site.address);
    const jobUrl = new URL((await link.getAttribute("href"))!, ORIGIN).href;
    await link.click();
    await expect(page.getByRole("heading", { level: 1, name: "Your job", exact: true })).toBeVisible();
    await expect(answer(page).getByText("We're watching your video.", { exact: true })).toBeVisible();

    // 2. The video is read (scripted model): the page shows where the job stands and the first look, and no answer.
    const ticked = await tick(request, requestId);
    expect(ticked).toMatchObject({ finished: true, videoModelCalls: 1 });
    await page.reload();
    await expectFirstLook(page);
    expect((await jobRecord(request, requestId)).access).toMatchObject({ listed: true });

    // 3. A deployment company applies, staff approve it, and it accepts the current Terms (signed in, in the browser).
    const applyHeaders = await csrf(request);
    const legal = await import("../client/src/lib/legalAcceptance");
    const applied = await request.post(`${ORIGIN}/api/robot-team-access/apply`, { headers: applyHeaders, data: {
      name: company.contact, email: company.email, company: company.name, robot: "A mobile arm that picks cartons up to 15 kg.",
      workWanted: "Moving cartons from conveyors to carts.", partnerRole: "deployment", acceptedTerms: true,
      termsVersion: legal.TERMS_VERSION, privacyVersion: legal.PRIVACY_VERSION, optionalUpdates: true } });
    expect(applied.status(), await applied.text()).toBe(202);
    const companyId = (await import("node:crypto")).createHash("sha256").update(company.email).digest("hex");
    const staffToken = await account(request, `core-journey-staff-${stamp}@example.invalid`, "core-journey-staff-pass", { admin: true });
    const decided = await request.post(`${ORIGIN}/api/admin/robot-team-access/${companyId}/decision`, {
      headers: { ...applyHeaders, Authorization: `Bearer ${staffToken}` }, data: { status: "approved", prerequisitesReviewed: true } });
    expect(decided.status(), await decided.text()).toBe(200);
    await account(request, company.email, company.password);

    // Nothing has been shared yet: no send, no introduction, no billable event.
    expect(await jobRecord(request, requestId)).toMatchObject({ sends: [], introductions: [], billable: [] });

    // The company's own browser. Everything it receives is collected and checked for the site's identity.
    const companyContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const companySaw: string[] = [];
    await localOnly(companyContext, missing);
    companyContext.on("response", async response => {
      if (new URL(response.url()).origin !== ORIGIN || !new URL(response.url()).pathname.startsWith("/api/")) return;
      if (/^(video|image)\//.test(response.headers()["content-type"] ?? "")) return;
      companySaw.push(await response.text().catch(() => ""));
    });
    const companyPage = await companyContext.newPage();
    await companyPage.goto("/login", { waitUntil: "networkidle" });
    await companyPage.locator("#email").fill(company.email);
    await companyPage.locator("#password").fill(company.password);
    // The sign-in is answered by the Auth emulator; the page's own profile reads after it are not part of this journey.
    const signedIn = companyPage.waitForResponse(response => response.url().includes("accounts:signInWithPassword"));
    const lookedUp = companyPage.waitForResponse(response => response.url().includes("accounts:lookup"));
    await companyPage.getByRole("button", { name: /^Sign in/ }).click();
    expect((await signedIn).status()).toBe(200);
    expect((await lookedUp).status()).toBe(200);

    // The job page asks for the current Terms first, and shows nothing of the job until they are accepted.
    // (The session is persisted by the Firebase client a moment after its sign-in response.)
    await expect(async () => {
      await companyPage.goto(`/jobs/${requestId}`);
      await expect(companyPage.getByText("Before you see jobs, read and agree to our Terms and Privacy Policy.")).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 60_000 });
    await expect(companyPage.locator("body")).not.toContainText("Pick up the sealed carton");
    // The acceptance must be recorded before the sweep below: the automatic send goes only to a company that has accepted.
    const accepted = companyPage.waitForResponse(response =>
      response.url().endsWith("/api/robot-team-access/accept-terms") && response.request().method() === "POST");
    await companyPage.getByRole("button", { name: "I agree to the Terms and Privacy Policy" }).click();
    expect((await accepted).status()).toBe(200);

    // The automatic send (the worker's sweep): one system send to the approved company, its new-job email, the site's notice.
    const swept = await request.post(`${ORIGIN}/api/reliability/auto-send`);
    expect(swept.ok()).toBe(true);
    const shared = await jobRecord(request, requestId);
    expect(shared.sends.map(row => [row.id, row.sentBy])).toEqual([[`system-${companyId}`, "system"]]);
    const afterSend = await outbox(request, requestId);
    const newJob = afterSend.filter(row => row.kind === "robot_team_new_task");
    expect(newJob.map(row => row.to)).toEqual([company.email]);

    // The company sees the job in its library and on the job's page, under no site name, address or contact.
    await companyPage.goto("/contact/robot-team");
    const row = companyPage.locator(`li#job-${requestId}`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row.getByRole("link", { name: "Open the job and answer" }).click();
    await expect(companyPage).toHaveURL(new RegExp(`/jobs/${requestId}$`));
    await expect(companyPage.getByText("Pick up the sealed carton from the end of the conveyor and place it on the cart.")).toBeVisible({ timeout: 30_000 });
    // The packet's video is the Pipeline's sound-free, privacy-processed clip. No Pipeline runs here, so it is still being
    // prepared, and the site's own upload is never served in its place.
    await expect(companyPage.getByRole("region", { name: "The video" })).toContainText("The video is being prepared.");
    await expect(companyPage.getByLabel("The site's video, without sound")).toHaveCount(0);
    expect((await companyPage.request.get(`${ORIGIN}/api/company-media/jobs/${requestId}/video.mp4`)).status()).toBeGreaterThanOrEqual(400);

    // The company answers Interested on the job's page.
    const form = companyPage.getByRole("form", { name: "Answer about this job" });
    await form.getByLabel("Interested").check();
    await form.getByRole("textbox").fill("We move cartons like these today.");
    const sent = companyPage.waitForResponse(response => response.url().endsWith(`/api/site-worlds/tasks/${requestId}/interest`));
    await form.getByRole("button", { name: "Send answer" }).click();
    expect((await sent).status()).toBe(200);
    await expect(form.getByRole("status")).toContainText(/saved/i);

    // Privacy hard stop: nothing the company was sent or shown names the site, its address or its contact.
    const companyPageText = await companyPage.locator("body").innerText();
    for (const secret of [site.address, "Quillfeather Lane", site.email]) {
      expect(companyPageText, "company page").not.toContain(secret);
      for (const text of companySaw) expect(text, "company-facing response").not.toContain(secret);
      for (const email of afterSend.filter(item => item.to === company.email)) expect(email.body + email.subject).not.toContain(secret);
    }

    // 4. The site sees the answer under the alias, never the company's name, and nothing is introduced yet.
    await page.reload();
    const entries = companies(page);
    await expect(entries).toContainText(/Sent to 1 deployment company on .+\./, { timeout: 30_000 });
    await expect(entries).toContainText(/Company A answered on .+: Interested\./);
    await expect(page.locator("body")).not.toContainText(company.name);
    await expect(page.locator("body")).not.toContainText(company.email);
    await expect(entries).toContainText("We give Company A your name, address and contact details, and give you theirs.");
    const beforePress = await outbox(request, requestId);
    expect(beforePress.filter(item => item.kind.startsWith("introduction_"))).toEqual([]);
    for (const item of beforePress) {
      if (item.to === company.email) for (const secret of [site.address, site.email]) expect(item.body).not.toContain(secret);
      if (item.to === site.email) for (const secret of [company.name, company.email]) expect(item.body).not.toContain(secret);
    }
    expect(await jobRecord(request, requestId)).toMatchObject({ introductions: [], billable: [] });

    // The press: exactly then, each side is emailed the other's name and contact details, and one billable event
    // is recorded with no price.
    const introduced = page.waitForResponse(response => response.url().endsWith(`/api/site-task-brief/${encodeURIComponent(token)}/introductions`)
      && response.request().method() === "POST");
    await entries.getByRole("button", { name: "Introduce us" }).click();
    const reply = await introduced;
    expect(reply.status(), await reply.text()).toBe(200);
    expect(reply.request().postDataJSON()).toEqual({ alias: "A", statementVersion: "introduction-request-2026-11-12" });
    await expect(entries).toContainText(new RegExp(`You were introduced to ${company.name} on .+\\.`), { timeout: 30_000 });
    await expect(entries.getByRole("link", { name: company.email })).toBeVisible();

    const introEmails = (await outbox(request, requestId)).filter(item => item.kind.startsWith("introduction_"));
    expect(introEmails.map(item => [item.kind, item.to]).sort()).toEqual([
      ["introduction_made_company", company.email], ["introduction_made_site", site.email]]);
    const toCompany = introEmails.find(item => item.kind === "introduction_made_company")!;
    const toSite = introEmails.find(item => item.kind === "introduction_made_site")!;
    expect(toCompany.body).toContain(site.email);
    expect(toCompany.body).toContain(site.address);
    expect(toSite.body).toContain(company.name);
    expect(toSite.body).toContain(company.email);
    const recorded = await jobRecord(request, requestId);
    expect(recorded.introductions.map(item => item.id)).toEqual([companyId]);
    expect(recorded.billable).toEqual([{ id: `introduction-${requestId}-${companyId}`, kind: "introduction", requestId, companyId,
      atIso: expect.any(String), priceUsd: null, status: "recorded_no_price" }]);

    // A second press records nothing new.
    const again = await page.request.post(`${ORIGIN}/api/site-task-brief/${encodeURIComponent(token)}/introductions`, {
      headers: await csrf(page.request), data: { alias: "A", statementVersion: "introduction-request-2026-11-12" } });
    expect(again.status()).toBe(409);
    expect((await jobRecord(request, requestId)).billable).toHaveLength(1);
    expect((await outbox(request, requestId)).filter(item => item.kind.startsWith("introduction_"))).toHaveLength(2);

    // 5. Fourteen days later the follow-up sweep asks both sides what happened, once.
    const introducedAt = Date.parse(String(recorded.billable[0].atIso));
    const outcomes = async (atMs: number) => {
      const response = await request.post(`${ORIGIN}/api/reliability/outcomes?atMs=${atMs}`);
      expect(response.ok()).toBe(true);
      return (await response.json()) as { examined: number; queued: number };
    };
    expect((await outcomes(introducedAt + 13 * DAY_MS)).queued).toBe(0);
    expect((await outcomes(introducedAt + 14 * DAY_MS + 60_000)).queued).toBe(2);
    expect((await outcomes(introducedAt + 14 * DAY_MS + 120_000)).queued).toBe(0);
    const questions = (await outbox(request, requestId)).filter(item => item.kind === "job_outcome_question");
    expect(questions.map(item => item.to).sort()).toEqual([company.email, site.email].sort());
    // The site answers from its email's link: a confirm page, then the thank-you page.
    const siteQuestion = questions.find(item => item.to === site.email)!;
    const outcomeLink = siteQuestion.body.match(/(http:\/\/127\.0\.0\.1:4183\/api\/job-outcomes\/\S+)/)![1];
    await page.goto(outcomeLink);
    await expect(page.getByRole("heading", { name: "Record your answer" })).toBeVisible();
    await page.getByRole("button", { name: "Record this answer" }).click();
    await expect(page).toHaveURL(/\/job-outcome\/thanks/);
    await expect(page.getByRole("heading", { name: /^Thanks\. We've recorded: / })).toBeVisible();

    // 6. The site withdraws its recording permission: the job leaves the company's view at once.
    await page.goto(jobUrl);
    await answer(page).getByRole("button", { name: "Job settings ›" }).click();
    await page.getByText("Stop using my video", { exact: true }).click();
    await page.getByRole("button", { name: "Withdraw permission…" }).click();
    await page.getByRole("button", { name: "Yes, withdraw permission" }).click();
    await expect(page.getByText("Recording permission withdrawn.", { exact: true })).toBeVisible();
    expect((await jobRecord(request, requestId)).access).toEqual({ listed: false, reason: "consent_withdrawn" });
    await companyPage.goto(`/jobs/${requestId}`);
    await expect(companyPage.getByRole("heading", { name: "This job is not available" })).toBeVisible({ timeout: 30_000 });
    await companyPage.goto("/contact/robot-team");
    await expect(companyPage.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(companyPage.locator(`li#job-${requestId}`)).toHaveCount(0);
    const companyToken = await signIn(request, company.email, company.password);
    const list = await request.get(`${ORIGIN}/api/site-worlds/tasks`, { headers: { Authorization: `Bearer ${companyToken}` } });
    expect(list.ok()).toBe(true);
    expect(((await list.json()).items as Array<{ id: string }>).map(item => item.id)).not.toContain(requestId);
    const page404 = await request.get(`${ORIGIN}/api/site-worlds/jobs/${requestId}`, { headers: { Authorization: `Bearer ${companyToken}` } });
    expect(page404.status()).toBe(404);

    await companyContext.close();
    expect(missing, "every API the pages call is mounted in the harness").toEqual([]);
  });
});

test.describe("phone", () => {
  const { defaultBrowserType: _browser, ...iPhone } = devices["iPhone 14"];
  test.use({ ...iPhone });
  test("iPhone 14: start, then the first look on the job page with no sideways scroll", async ({ page, request }) => {
    const missing: string[] = [];
    await localOnly(page.context(), missing);
    const stamp = Date.now();
    const { link, requestId } = await startWithVideo(page, `core-journey-phone-${stamp}@example.invalid`, `12 Phone Street ${stamp}`);
    await link.click();
    expect((await tick(request, requestId)).finished).toBe(true);
    await page.reload();
    await expectFirstLook(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(missing).toEqual([]);
  });
});
