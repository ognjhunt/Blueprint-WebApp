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
 * reply (a scripted reading of one carton), the Pipeline clip reference, the unsigned storage read URL and the empty location suggestions for a
 * manually chosen country. The local Auth emulator answers Firebase Auth requests. The test reads the email outbox.
 */
import { test, expect, devices, type BrowserContext, type Page, type APIRequestContext } from "@playwright/test";
import path from "node:path";

const ORIGIN = "http://127.0.0.1:4183";
const AUTH_EMULATOR = "http://127.0.0.1:9099";
const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
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
  // These jobs use typed locations and an explicitly chosen country. An empty geocoder response
  // lets the form exercise that path without contacting a geocoding provider.
  await context.route(url => url.origin === ORIGIN && url.pathname === "/api/location-autocomplete",
    route => route.fulfill({ json: { suggestions: [] } }));
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

/** The start form: upload a video, the job in one sentence, a typed city or region, the country, an email. No share step. */
async function startWithVideo(page: Page, email: string, address: string) {
  await page.goto("/contact/site-operator", { waitUntil: "networkidle" });
  await page.locator("#start-method-upload").click();
  await page.locator("#start-footage").setInputFiles(VIDEO);
  await page.locator("#start-task").fill("Pick up the sealed carton from the end of the conveyor and place it on the cart.");
  await page.locator("#start-location").fill(address);
  await page.locator("#start-email").fill(email);
  const send = page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ });
  await page.locator("#start-region").selectOption("us");
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

async function publishCompanyClip(request: APIRequestContext, requestId: string) {
  const response = await request.post(`${ORIGIN}/api/reliability/publish-company-clip?requestId=${encodeURIComponent(requestId)}`);
  expect(response.ok(), await response.text()).toBe(true);
  expect(await response.json()).toMatchObject({ accepted: true });
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
  await expect(companies(page)).toContainText("Posted for approved deployment companies");
  await expect(answer(page)).not.toContainText(/answered on|Introduce us|early trial|Simulation test/i);
  await expect(page.getByRole("button", { name: /share my job/i })).toHaveCount(0);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("email and video in, shared automatically, a company answers, the site asks for an introduction, follow-ups, withdrawal", async ({ page, request, browser }) => {
    const stamp = Date.now();
    const site = { email: `core-journey-site-${stamp}@example.invalid`, address: `Quillfeather Harbour ${stamp}, Dockside` };
    const company = { email: `core-journey-company-${stamp}@example.invalid`, name: `Quillfeather Robotics ${stamp}`,
      contact: "Ada Corewright", password: "core-journey-company-pass" };
    const missing: string[] = [];
    await localOnly(page.context(), missing);

    // 1. The site starts a job: email, its city or region and video in, the current statements accepted, no share step.
    const { link, requestId, token } = await startWithVideo(page, site.email, site.address);
    const jobUrl = new URL((await link.getAttribute("href"))!, ORIGIN).href;
    await link.click();
    await expect(page.getByRole("heading", { level: 1, name: "Your job", exact: true })).toBeVisible();
    await expect(answer(page).getByText("We're watching your video.", { exact: true })).toBeVisible();

    // 2. The video is read (scripted model): the page shows where the job stands and the first look, and no answer.
    const ticked = await tick(request, requestId);
    expect(ticked).toMatchObject({ finished: true, videoModelCalls: 1 });
    expect((await jobRecord(request, requestId)).access).toEqual({ listed: false, reason: "video_required" });
    await publishCompanyClip(request, requestId);
    await page.reload();
    await expectFirstLook(page);
    expect((await jobRecord(request, requestId)).access).toMatchObject({ listed: true });
    await expect(companies(page)).toContainText("Viewed by 0 companies");
    await expect(companies(page)).toContainText("0 responses");
    const facts = page.getByRole("region", { name: "A few quick questions help companies answer" });
    await expect(facts.getByText("Where does the robot pick up the load?")).toBeVisible();
    await facts.getByRole("button", { name: "Moving conveyor" }).click();
    await expect(facts.getByText("How heavy is the heaviest loaded item?")).toBeVisible();
    await facts.getByRole("spinbutton", { name: "Weight" }).fill("20");
    await facts.getByRole("button", { name: "Save", exact: true }).click();
    await expect(facts.getByText("How many items arrive per minute at the busiest time?")).toBeVisible();

    // 3. A deployment company applies, staff approve it, and it accepts the current Terms (signed in, in the browser).
    const applicationContext = await browser.newContext();
    await localOnly(applicationContext, missing);
    const applicationPage = await applicationContext.newPage();
    await applicationPage.goto(`/partners?next=${encodeURIComponent(`/jobs/${requestId}`)}#partner-application`);
    const application = applicationPage.getByRole("form", { name: "Deployment company application" });
    await application.getByLabel("Your name").fill(company.contact);
    await application.getByLabel("Work email").fill(company.email);
    await application.locator('input[name="company"]').fill(company.name);
    await application.getByLabel("What jobs can you deliver?").fill("Moving cartons from conveyors to carts.");
    await application.getByLabel("Which robots do you deploy?").fill("A mobile arm that picks cartons up to 15 kg.");
    await application.getByLabel("Where can you deploy?").fill("United States");
    // No box for job emails: an approved company gets them unless it turns them off (owner, 2026-11-20).
    const applied = applicationPage.waitForResponse(response => response.url().endsWith("/api/robot-team-access/apply")
      && response.request().method() === "POST");
    await application.getByRole("button", { name: "Apply", exact: true }).click();
    const applicationResponse = await applied;
    expect(applicationResponse.status(), await applicationResponse.text()).toBe(202);
    expect(applicationResponse.request().postDataJSON().returnToJob).toBe(`/jobs/${requestId}`);
    await expect(applicationPage.getByRole("heading", { name: "Your application is saved." })).toBeVisible();
    await applicationContext.close();
    const applyHeaders = await csrf(request);
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
    // The Firebase browser SDK uses this default for its own profile reads and writes during sign-in.
    await companyContext.addInitScript(firestore => {
      Object.assign(globalThis, { __FIREBASE_DEFAULTS__: { emulatorHosts: { firestore } } });
    }, FIRESTORE_EMULATOR);
    companyContext.on("response", async response => {
      if (new URL(response.url()).origin !== ORIGIN || !new URL(response.url()).pathname.startsWith("/api/")) return;
      if (/^(video|image)\//.test(response.headers()["content-type"] ?? "")) return;
      companySaw.push(await response.text().catch(() => ""));
    });
    const companyPage = await companyContext.newPage();
    const companyJobPath = `/jobs/${requestId}`;
    const companyJobLink = new URL(companyJobPath, ORIGIN).href;
    await companyPage.goto(companyJobPath);
    await expect(companyPage.getByRole("heading", { name: "Sign in to see this job" })).toBeVisible();
    await expect(companyPage.locator("body")).not.toContainText("Pick up the sealed carton");
    const signInLink = companyPage.getByRole("link", { name: "Sign in to this job" });
    const signInPath = `/sign-in?next=${encodeURIComponent(companyJobPath)}`;
    await expect(signInLink).toHaveAttribute("href", signInPath);
    await expect(companyPage.getByRole("navigation", { name: "Account" }).getByRole("link", { name: "Sign in" })).toHaveAttribute("href", signInPath);
    await signInLink.click();
    await expect(companyPage).toHaveURL(new URL(signInPath, ORIGIN).href);
    await companyPage.locator("#email").fill(company.email);
    await companyPage.locator("#password").fill(company.password);
    const signedIn = companyPage.waitForResponse(response => response.url().includes("accounts:signInWithPassword"));
    await companyPage.getByRole("button", { name: "Sign in", exact: true }).click();
    expect((await signedIn).status()).toBe(200);

    // Sign-in returns to the original job, where the current Terms still have to be accepted.
    await expect(companyPage).toHaveURL(companyJobLink, { timeout: 30_000 });
    await expect(companyPage.getByText("Before you see jobs, read and agree to our Terms and Privacy Policy.")).toBeVisible();
    await expect(companyPage.getByRole("link", { name: "Sign in", exact: true })).toHaveCount(0);
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
    expect(newJob[0].body).toContain(companyJobLink);

    // The company sees the job in its library and on the job's page, under no site name, address or contact.
    await companyPage.goto("/contact/robot-team");
    const row = companyPage.locator(`li#job-${requestId}`);
    await expect(row).toBeVisible({ timeout: 30_000 });
    const searchTerm = (await row.getByRole("heading").innerText()).trim().split(/\s+/)[0];
    await companyPage.getByRole("searchbox", { name: "Search jobs" }).fill(searchTerm);
    await row.getByRole("link", { name: "View job" }).click();
    await expect(companyPage).toHaveURL(new RegExp(`/jobs/${requestId}\\?from=`));
    await companyPage.getByRole("link", { name: "Back to jobs" }).click();
    await expect(companyPage.getByRole("searchbox", { name: "Search jobs" })).toHaveValue(searchTerm);
    await row.getByRole("link", { name: "View job" }).click();
    await expect(companyPage.getByText("Pick up the sealed carton from the end of the conveyor and place it on the cart.")).toBeVisible({ timeout: 30_000 });
    await expect(companyPage.getByText("Pickup: Moving conveyor", { exact: true })).toBeVisible();
    await expect(companyPage.getByText("Heaviest loaded item: 9.072 kg", { exact: true })).toBeVisible();
    // The approved browser receives a ticket for the published clip. A request without a ticket is refused.
    await expect(companyPage.getByLabel("The site's video, without sound")).toHaveAttribute("src",
      new RegExp(`/api/company-media/jobs/${requestId}/video\\.mp4\\?`));
    expect((await companyPage.request.get(`${ORIGIN}/api/company-media/jobs/${requestId}/video.mp4`)).status()).toBeGreaterThanOrEqual(400);

    // The company answers Interested on the job's page.
    const form = companyPage.getByRole("form", { name: "Response to opportunity" });
    await form.getByLabel("Interested").check();
    await form.getByRole("textbox", { name: "Note to the site (optional)" }).fill("We move cartons like these today.");
    await form.getByText("Add details", { exact: true }).click();
    await form.getByLabel("What you’ve verified").fill("The carton weight is in our payload range.");
    await form.getByLabel("Question for the site").fill("How many cartons arrive per minute?");
    await form.getByLabel("Earliest start").selectOption("within_month");
    const sent = companyPage.waitForResponse(response => response.url().endsWith(`/api/site-worlds/tasks/${requestId}/interest`));
    await form.getByRole("button", { name: "Send response" }).click();
    expect((await sent).status()).toBe(200);
    await expect(form.getByRole("status")).toContainText(/saved/i);

    // Privacy hard stop: nothing the company was sent or shown names the site, its address or its contact.
    const companyPageText = await companyPage.locator("body").innerText();
    for (const secret of [site.address, "Quillfeather Harbour", site.email]) {
      expect(companyPageText, "company page").not.toContain(secret);
      for (const text of companySaw) expect(text, "company-facing response").not.toContain(secret);
      for (const email of afterSend.filter(item => item.to === company.email)) expect(email.body + email.subject).not.toContain(secret);
    }

    // 4. The site sees the answer under the alias, never the company's name, and nothing is introduced yet.
    await page.reload();
    const entries = companies(page);
    await expect(entries).toContainText("Viewed by 1 company", { timeout: 30_000 });
    await expect(entries).toContainText("1 response");
    const companyReply = entries.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Company A", exact: true }) });
    await expect(companyReply.getByText("Interested", { exact: true })).toBeVisible();
    await expect(companyReply.getByText("Within a month", { exact: true })).toBeVisible();
    await expect(companyReply.getByText("How many cartons arrive per minute?", { exact: true })).toBeVisible();
    await companyReply.getByText("Reply", { exact: true }).click();
    await companyReply.getByLabel("Your reply").fill("12 cartons per minute.");
    await companyReply.getByRole("button", { name: "Send reply" }).click();
    await expect(companyReply.getByText("12 cartons per minute.", { exact: true })).toBeVisible();
    await companyPage.reload();
    await expect(companyPage.getByRole("region", { name: "Answer from the site" })).toContainText("12 cartons per minute.");
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
    await page.getByRole("button", { name: "Stop using my video…" }).click();
    await page.getByRole("button", { name: "Yes, stop using my video" }).click();
    await expect(page.getByText("Video withdrawn.", { exact: true })).toBeVisible();
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
    await publishCompanyClip(request, requestId);
    await page.reload();
    await expectFirstLook(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(missing).toEqual([]);
  });
});
