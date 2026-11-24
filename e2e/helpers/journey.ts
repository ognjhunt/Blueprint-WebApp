/**
 * Shared helpers for the journey specs beside the core journey (`e2e/site-journey-*.spec.ts`, 2026-11-24: the privacy and
 * money checks a $0 stress test turned into tests). The same as the core journey's own (`e2e/site-answer-journey.spec.ts`)
 * so they drive the same harness: real handlers, Firebase emulators, a scripted video model, a scripted model pass over
 * free text, an outbox that never reaches a mail provider (`scripts/qa/answer-journey-local-app.ts`).
 *
 * Run (from the repo root, emulators started by the wrapper), with the core journey:
 *   npm run test:core-journey
 * or one spec:
 *   npx -y firebase-tools@13.35.1 emulators:exec --only firestore,storage,auth --project demo-blueprint-reliability \
 *     --config firebase.json "npx playwright test --config playwright.answer-journey.config.ts --trace off e2e/site-journey-…"
 */
import { expect, type APIRequestContext, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { createHash, createHmac } from "node:crypto";
import path from "node:path";

export const ORIGIN = "http://127.0.0.1:4183";
export const AUTH_EMULATOR = "http://127.0.0.1:9099";
export const FIRESTORE_EMULATOR = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
export const PROJECT = "demo-blueprint-reliability";
export const VIDEO = path.resolve("e2e/fixtures/synthetic-transport.mp4");
export const DAY_MS = 86_400_000;
/** The harness's own fixture secret (scripts/qa/reliability-local-app.mjs), never a production one. */
const HARNESS_TOKEN_SECRET = "owned-local-reliability-fixture-secret-never-production";

export function jobOf(href: string) {
  const token = new URL(href, ORIGIN).pathname.split("/").pop()!;
  return { token, requestId: JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")).requestId as string };
}

/** An owner link for a job, signed with the harness secret, that expired `agoSeconds` ago. */
export function expiredOwnerToken(requestId: string, agoSeconds = 3600) {
  const payload = JSON.stringify({ kind: "capture_upload", requestId, captureId: `walkthrough-${requestId}`, sceneId: `site-${requestId}`,
    scope: "owner", exp: Math.floor(Date.now() / 1000) - agoSeconds });
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${createHmac("sha256", HARNESS_TOKEN_SECRET).update(payload).digest("base64url")}`;
}

export const companyIdOf = (email: string) => createHash("sha256").update(email.toLowerCase()).digest("hex");

export async function localOnly(context: BrowserContext, missing: string[]) {
  await context.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/, route => route.abort("blockedbyclient"));
  await context.route(url => url.origin === ORIGIN && url.pathname === "/api/location-autocomplete",
    route => route.fulfill({ json: { suggestions: [] } }));
  await context.route(/^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com\//, async route => {
    const url = new URL(route.request().url());
    const response = await route.fetch({ url: `${AUTH_EMULATOR}/${url.host}${url.pathname}${url.search}` });
    await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": ORIGIN } });
  });
  context.on("response", async response => {
    const url = new URL(response.url());
    if (url.origin !== ORIGIN || !url.pathname.startsWith("/api/") || response.status() !== 404) return;
    if ((await response.text().catch(() => "")).includes("Route outside scoped reliability harness")) missing.push(`${response.request().method()} ${url.pathname}`);
  });
}

export async function account(request: APIRequestContext, email: string, password: string, claims?: Record<string, unknown>) {
  const created = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts`, {
    headers: { Authorization: "Bearer owner" }, data: { email, password } });
  expect(created.ok(), await created.text()).toBe(true);
  const updated = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
    headers: { Authorization: "Bearer owner" },
    data: { localId: (await created.json()).localId, emailVerified: true, ...(claims ? { customAttributes: JSON.stringify(claims) } : {}) } });
  expect(updated.ok(), await updated.text()).toBe(true);
  return signIn(request, email, password);
}

export async function signIn(request: APIRequestContext, email: string, password: string) {
  const signedIn = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-fixture-key`,
    { data: { email, password, returnSecureToken: true } });
  expect(signedIn.ok(), await signedIn.text()).toBe(true);
  return (await signedIn.json()).idToken as string;
}

export async function csrf(request: APIRequestContext) {
  const response = await request.get(`${ORIGIN}/api/csrf`);
  expect(response.ok()).toBe(true);
  return { "X-CSRF-Token": (await response.json()).csrfToken as string };
}

export async function startWithVideo(page: Page, email: string, address: string,
  task = "Pick up the sealed carton from the end of the conveyor and place it on the cart.", ip?: string) {
  // Each simulated site from its own address: the intake's per-address caps are real and count per client address.
  await page.context().setExtraHTTPHeaders({ "X-Forwarded-For": ip ?? `10.77.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}` });
  await page.goto("/contact/site-operator", { waitUntil: "networkidle" });
  await page.locator("#start-method-upload").click();
  await page.locator("#start-footage").setInputFiles(VIDEO);
  await page.locator("#start-task").fill(task);
  await page.locator("#start-location").fill(address);
  await page.locator("#start-email").fill(email);
  await page.locator("#start-region").selectOption("us");
  const posted = page.waitForRequest(request => request.method() === "POST"
    && /\/api\/(inbound-request|workspace\/capture-start)$/.test(new URL(request.url()).pathname));
  const answered = page.waitForResponse(response => response.request().method() === "POST"
    && /\/api\/(inbound-request|workspace\/capture-start)$/.test(new URL(response.url()).pathname));
  await page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ }).click();
  const body = (await posted).postDataJSON();
  expect((await answered).status()).toBeLessThan(300);
  await expect(page.getByRole("heading", { name: "We have your video.", exact: true })).toBeVisible({ timeout: 60_000 });
  const link = page.getByRole("link", { name: "Open my job", exact: true });
  return { link, body, ...jobOf((await link.getAttribute("href"))!) };
}

export async function tick(request: APIRequestContext, requestId: string) {
  const response = await request.post(`${ORIGIN}/api/reliability/tick?requestId=${encodeURIComponent(requestId)}`);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ finished: boolean; passes: number; videoModelCalls: number }>;
}

export async function publishCompanyClip(request: APIRequestContext, requestId: string) {
  const response = await request.post(`${ORIGIN}/api/reliability/publish-company-clip?requestId=${encodeURIComponent(requestId)}`);
  expect(response.ok(), await response.text()).toBe(true);
}

export type OutboxRow = { kind: string; status: string; subject: string; body: string; to: string; idempotencyKey: string };
export type SentMail = { to: string[]; replyTo: string | null; subject: string };
export async function deliverOutbox(request: APIRequestContext): Promise<SentMail[]> {
  const sent: SentMail[] = [];
  for (let pass = 0; pass < 5; pass++) {
    const response = await request.post(`${ORIGIN}/api/reliability/deliver-outbox`);
    expect(response.ok(), await response.text()).toBe(true);
    const body = (await response.json()) as { sent: SentMail[] };
    if (!body.sent.length && pass > 0) break;
    sent.push(...body.sent);
  }
  return sent;
}

export async function outbox(request: APIRequestContext, requestId: string): Promise<OutboxRow[]> {
  const response = await request.get(`${ORIGIN}/api/reliability/outbox?requestId=${encodeURIComponent(requestId)}`);
  expect(response.ok()).toBe(true);
  return (await response.json()).rows;
}

export type JobRecord = { billable: Array<Record<string, unknown>>; sends: Array<Record<string, unknown>>;
  introductions: Array<{ id: string; introducedAtIso: string | null }>; access: { listed: boolean; reason: string | null } };
export async function jobRecord(request: APIRequestContext, requestId: string): Promise<JobRecord> {
  const response = await request.get(`${ORIGIN}/api/reliability/job?requestId=${encodeURIComponent(requestId)}`);
  expect(response.ok()).toBe(true);
  return response.json();
}

export async function autoSend(request: APIRequestContext) {
  const swept = await request.post(`${ORIGIN}/api/reliability/auto-send`);
  expect(swept.ok()).toBe(true);
  return swept.json();
}

/** A job that is read, published and listed: the site's page, the job's ids and its owner link. */
export async function listedJob(page: Page, request: APIRequestContext, missing: string[], stamp: string, options: {
  task?: string; address?: string; email?: string } = {}) {
  await localOnly(page.context(), missing);
  const site = { email: options.email ?? `journey-site-${stamp}@example.invalid`, address: options.address ?? `Quillfeather Harbour ${stamp}, Dockside` };
  const started = await startWithVideo(page, site.email, site.address, options.task);
  const jobUrl = new URL((await started.link.getAttribute("href"))!, ORIGIN).href;
  expect((await tick(request, started.requestId)).finished).toBe(true);
  await publishCompanyClip(request, started.requestId);
  expect((await jobRecord(request, started.requestId)).access.listed).toBe(true);
  await page.goto(jobUrl);
  return { site, jobUrl, ...started };
}

let staffToken: string | null = null;
export async function staff(request: APIRequestContext) {
  if (!staffToken) staffToken = await account(request, `journey-staff-${Date.now()}@example.invalid`, "journey-staff-pass", { admin: true });
  return staffToken;
}

export async function decide(request: APIRequestContext, email: string, status: "approved" | "declined") {
  const headers = await csrf(request);
  const decided = await request.post(`${ORIGIN}/api/admin/robot-team-access/${companyIdOf(email)}/decision`, {
    headers: { ...headers, Authorization: `Bearer ${await staff(request)}` }, data: { status } });
  expect(decided.status(), await decided.text()).toBe(200);
}

export type Company = { email: string; name: string; website: string; contact: string; password: string; ip: string };
/** A run's stamp in letters ("1732" → "bhdc"): a company name with a run of digits reads as a phone number and is refused
 * (stress test round 2, 2026-11-24). */
export const stampInLetters = (stamp: string) => stamp.replace(/\d/g, digit => "abcdefghij"[Number(digit)]);
export function companyFor(stamp: string, letter: string, index: number): Company {
  return { email: `journey-co-${letter}-${stamp}@example.invalid`, name: `Journey ${letter} Robotics ${stampInLetters(stamp)}`,
    website: `https://journey-${letter.toLowerCase()}.example`, contact: `Casey ${letter}lington`, password: "journey-company-pass",
    // Each company from its own address: the application limiter counts per client address.
    ip: `10.9.${index}.${(Number(stamp.slice(-2)) % 200) + 1}` };
}

/** Apply (API), approve (staff API), create the account. No Terms yet. */
export async function applyAndApprove(request: APIRequestContext, company: Company, approve = true) {
  const headers = await csrf(request);
  const applied = await request.post(`${ORIGIN}/api/robot-team-access/apply`, { headers: { ...headers, "X-Forwarded-For": company.ip },
    data: { name: company.contact, email: company.email, company: company.name, website: company.website } });
  expect(applied.status(), await applied.text()).toBe(202);
  if (approve) await decide(request, company.email, "approved");
  await account(request, company.email, company.password);
}

/** The company's own browser, signed in through the sign-in page, with the current Terms accepted on a job page. */
export async function companyBrowser(browser: Browser, company: Company, missing: string[], jobId: string,
  options: { viewport?: { width: number; height: number }; acceptTerms?: boolean; saw?: string[] } = {}) {
  const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 900 },
    extraHTTPHeaders: { "X-Forwarded-For": company.ip } });
  await localOnly(context, missing);
  await context.addInitScript(firestore => {
    Object.assign(globalThis, { __FIREBASE_DEFAULTS__: { emulatorHosts: { firestore } } });
  }, FIRESTORE_EMULATOR);
  if (options.saw) {
    const saw = options.saw;
    context.on("response", async response => {
      if (new URL(response.url()).origin !== ORIGIN || !new URL(response.url()).pathname.startsWith("/api/")) return;
      if (/^(video|image)\//.test(response.headers()["content-type"] ?? "")) return;
      saw.push(await response.text().catch(() => ""));
    });
  }
  const page = await context.newPage();
  await page.goto(`/sign-in?next=${encodeURIComponent(`/jobs/${jobId}`)}`);
  await page.locator("#email").fill(company.email);
  await page.locator("#password").fill(company.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/jobs/${jobId}`), { timeout: 30_000 });
  if (options.acceptTerms !== false) {
    const prompt = page.getByRole("button", { name: "I agree to the Terms and Privacy Policy" });
    await expect(prompt).toBeVisible({ timeout: 30_000 });
    const accepted = page.waitForResponse(response => response.url().endsWith("/api/robot-team-access/accept-terms"));
    await prompt.click();
    expect((await accepted).status()).toBe(200);
  }
  return { context, page };
}

/** Answer on the job page's form. */
export async function respond(page: Page, jobId: string, answer: {
  state: "Apply" | "Not a fit" | "Need more details"; note?: string; charge?: string; low?: string; high?: string;
  similar?: string; start?: string; visit?: string; question?: string }) {
  await page.goto(`/jobs/${jobId}`);
  const form = page.getByRole("form", { name: "Your response" });
  await expect(form).toBeVisible({ timeout: 30_000 });
  await form.getByLabel(answer.state, { exact: true }).check();
  const noteBox = form.getByRole("textbox").first();
  if (answer.note !== undefined) await noteBox.fill(answer.note);
  if (answer.charge) await form.getByLabel("How you charge").selectOption({ label: answer.charge });
  if (answer.low !== undefined) await form.getByLabel("From", { exact: true }).fill(answer.low);
  if (answer.high !== undefined) await form.getByLabel("To", { exact: true }).fill(answer.high);
  if (answer.similar) await form.getByLabel("Similar jobs you have done").selectOption({ label: answer.similar });
  if (answer.visit) await form.getByLabel("What a visit must confirm").fill(answer.visit);
  if (answer.start) {
    if (answer.state !== "Apply") await form.getByText("Add details", { exact: true }).click();
    await form.getByLabel("Earliest start").selectOption({ label: answer.start });
  }
  if (answer.question) {
    await form.getByText("Add details", { exact: true }).click();
    await form.getByLabel("Question for the site").fill(answer.question);
  }
  const sent = page.waitForResponse(response => response.url().endsWith(`/api/site-worlds/tasks/${jobId}/interest`), { timeout: 6_000 })
    .catch(() => null);
  await form.getByRole("button", { name: "Send" }).click();
  const response = await sent;
  return { form, response, status: form.getByRole("status") };
}

export const applicants = (page: Page) => page.getByRole("region", { name: "Applicants" });

/** Visible words that look like a price or a currency. */
export const PRICE_PATTERN = /(?:[$€£¥]\s?\d|\bUSD\b|\bEUR\b|\bGBP\b|\b\d+(?:[.,]\d+)?\s?(?:dollars|euros|pounds)\b|\bper (?:month|year|hour|introduction|lead)\b.*\$|\bfee\b|\bfees\b|\bpricing\b|\bprice\b|\bcost[s]? (?:\$|\d))/i;

/** Every outbox row to one address, read straight from the Firestore emulator (any job, digests included). A sent row's
 * details are cleared, so read before a delivery pass. Paged listing, filtered here (the emulator's runQuery was not
 * reliable from Playwright's request context). */
export async function outboxTo(request: APIRequestContext, email: string): Promise<OutboxRow[]> {
  const rows: OutboxRow[] = [];
  let pageToken = "";
  for (let pageNumber = 0; pageNumber < 50; pageNumber++) {
    const response = await request.get(`http://${FIRESTORE_EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents/captureOutbox?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`,
      { headers: { Authorization: "Bearer owner" } });
    expect(response.ok(), await response.text()).toBe(true);
    const body = await response.json() as { documents?: Array<{ fields: Record<string, { stringValue?: string }> }>; nextPageToken?: string };
    for (const doc of body.documents ?? []) {
      const field = (name: string) => doc.fields[name]?.stringValue ?? "";
      if (field("to").toLowerCase() !== email.toLowerCase()) continue;
      rows.push({ kind: field("kind"), status: field("status"), subject: field("subject"), body: field("body"), to: field("to"),
        idempotencyKey: field("idempotencyKey") });
    }
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }
  return rows;
}

/** One Firestore document from the emulator, as plain JSON values (strings, numbers, booleans, maps, arrays). */
export async function firestoreDoc(request: APIRequestContext, docPath: string): Promise<Record<string, unknown> | null> {
  const response = await request.get(`http://${FIRESTORE_EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents/${docPath}`,
    { headers: { Authorization: "Bearer owner" } });
  if (response.status() === 404) return null;
  expect(response.ok(), await response.text()).toBe(true);
  const plain = (value: Record<string, any>): unknown => value.stringValue ?? (value.integerValue !== undefined ? Number(value.integerValue)
    : value.doubleValue ?? value.booleanValue ?? value.timestampValue ?? (value.nullValue !== undefined ? null
      : value.mapValue ? Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, plain(item as never)]))
        : value.arrayValue ? (value.arrayValue.values ?? []).map((item: never) => plain(item)) : value));
  const body = await response.json() as { fields?: Record<string, Record<string, unknown>> };
  return Object.fromEntries(Object.entries(body.fields ?? {}).map(([key, value]) => [key, plain(value as never)]));
}
