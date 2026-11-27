/**
 * Outreach gap 1 (2026-11-27): the deployment company's emailed links, in a real browser, on the core-journey harness
 * (real handlers on the Firebase emulators, the scripted video model, an outbox that never reaches a mail provider:
 * `scripts/qa/answer-journey-local-app.ts`). Each link is read from the local outbox, as the email would carry it.
 *
 * For each of the three one-use or account-making links (the sign-in link asked for at /sign-in, the approval email's
 * invitation, the "New job on Blueprint" link) it proves: a plain GET of its URL (no JavaScript), a HEAD, and a browser
 * that loads the page and runs its scripts without any click (what a mail scanner does) spend nothing and make no
 * account; the company's own press then signs it in. Before the fix of 2026-11-27 a scanner's load spent the sign-in link
 * and was signed in as the company (client/src/pages/Login.tsx redeemed on load).
 * It also walks the stranger's path: apply on /jobs, the approval email, account creation with the Terms tick, Find jobs
 * with zero and with one job, the job page, and what a signed-out reader of "Find jobs" sees.
 *
 * Run (the harness on 4183 under the emulators; its own config, because it approves companies and the core journey
 * needs a run with none):
 *   npx -y firebase-tools@13.35.1 emulators:exec --only firestore,storage,auth --project demo-blueprint-reliability \
 *     --config firebase.json "npx playwright test --config playwright.company-links.config.ts --trace off"
 */
import { test, expect, type APIRequestContext, type Browser, type Page } from "@playwright/test";
import { AUTH_EMULATOR, ORIGIN, companyIdOf, PROJECT, FIRESTORE_EMULATOR, autoSend, csrf, decide, firestoreDoc, listedJob, localOnly, outboxTo,
  stampInLetters } from "./helpers/journey";

test.describe.configure({ mode: "serial", timeout: 420_000 });
test.use({ viewport: { width: 1280, height: 900 } });

const stamp = String(Date.now());
const letters = stampInLetters(stamp);
const company = (letter: string, index: number) => ({
  email: `outreach-co-${letter.toLowerCase()}-${stamp}@example.invalid`, name: `Outreach ${letter} Robotics ${letters}`,
  contact: `Robin ${letter}field`, website: `https://outreach-${letter.toLowerCase()}.example`,
  ip: `10.31.${index}.${(Number(stamp.slice(-2)) % 200) + 1}` });
const A = company("A", 1), B = company("B", 2), C = company("C", 3);
const missing: string[] = [];
const observed: Record<string, unknown> = {};

const urlIn = (body: string, pattern: RegExp) => {
  const found = body.split(/\s+/).find(part => pattern.test(part));
  expect(found, `no link matching ${pattern} in:\n${body}`).toBeTruthy();
  return found!;
};
const jtiOf = (link: string) => {
  const token = new URL(link).searchParams.get("link")!;
  return JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")).jti as string;
};
const linkUsed = async (request: APIRequestContext, link: string) => Boolean(await firestoreDoc(request, `companySignInLinkUses/${jtiOf(link)}`));
async function authAccount(request: APIRequestContext, email: string) {
  const response = await request.post(`${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`,
    { headers: { Authorization: "Bearer owner" }, data: { email: [email] } });
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()).users ?? [])[0] ?? null;
}
async function freshPage(browser: Browser, ip: string) {
  const context = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": ip } });
  await localOnly(context, missing);
  await context.addInitScript(firestore => {
    Object.assign(globalThis, { __FIREBASE_DEFAULTS__: { emulatorHosts: { firestore } } });
  }, FIRESTORE_EMULATOR);
  return { context, page: await context.newPage() };
}
/** What a mail scanner does: load the page, run its scripts, click nothing, leave. */
async function scannerLoad(browser: Browser, link: string, ip: string) {
  const { context, page } = await freshPage(browser, ip);
  const redeems: string[] = [];
  page.on("response", async response => {
    if (new URL(response.url()).pathname.endsWith("/sign-in-link/redeem"))
      redeems.push(`${response.status()} ${(await response.text().catch(() => "")).replace(/"customToken":"[^"]+"/, '"customToken":"<token>"')}`);
  });
  await page.goto(link, { waitUntil: "networkidle" });
  await page.waitForTimeout(6_000);
  const landed = page.url();
  observed[`scanner ${new URL(link).pathname}`] = { redeems, text: (await mainText(page)).slice(0, 600) };
  await context.close();
  return landed;
}
const mainText = async (page: Page) => (await page.locator("main, body").first().innerText()).replace(/\s+/g, " ").trim();
async function apiApply(request: APIRequestContext, who: typeof A) {
  const applied = await request.post(`${ORIGIN}/api/robot-team-access/apply`, { headers: { ...await csrf(request), "X-Forwarded-For": who.ip },
    data: { name: who.contact, email: who.email, company: who.name, website: who.website } });
  expect(applied.status(), await applied.text()).toBe(202);
}

test("1. a stranger applies on /jobs; the application is saved with no receipt email; approval queues one email with the invitation", async ({ page, request }) => {
  await localOnly(page.context(), missing);
  await page.context().setExtraHTTPHeaders({ "X-Forwarded-For": C.ip });
  await page.goto("/jobs", { waitUntil: "networkidle" });
  const form = page.getByRole("form", { name: "Deployment company application" });
  await expect(form).toBeVisible();
  await form.getByLabel("Your name").fill(C.contact);
  await form.getByLabel("Work email").fill(C.email);
  await form.getByLabel("Company", { exact: true }).fill(C.name);
  await form.getByLabel("Company website").fill(C.website);
  await form.getByRole("button", { name: /^Apply/ }).click();
  await expect(page.getByRole("heading", { name: "Your application is saved." })).toBeVisible({ timeout: 30_000 });
  observed.publicJobsWithNoJob = await mainText(page);
  const record = await firestoreDoc(request, `robotTeamAccess/${companyIdOf(C.email)}`);
  expect(record?.status).toBe("applied");
  // The rule ran and could not read the website (the harness blocks every outbound host): it waits for the owner.
  await expect.poll(async () => (await firestoreDoc(request, `robotTeamAccess/${companyIdOf(C.email)}`))?.companyCheck,
    { timeout: 30_000 }).toBeTruthy();
  observed.ruleInHarness = (await firestoreDoc(request, `robotTeamAccess/${companyIdOf(C.email)}`))?.companyCheck;
  expect(await outboxTo(request, C.email)).toEqual([]); // no receipt email
  await decide(request, C.email, "approved");
  const rows = await outboxTo(request, C.email);
  expect(rows.map(row => row.kind)).toEqual(["robot_team_access_approved"]);
  observed.approvalEmailSubject = rows[0].subject;
});

test("2. the invitation link: GET, HEAD and a scanner's load create nothing; the tick and Create account land on Find jobs with zero jobs", async ({ request, browser }) => {
  const body = (await outboxTo(request, C.email)).find(row => row.kind === "robot_team_access_approved")!.body;
  const invitation = urlIn(body, /\/signup\/business\?invitation=/);
  const findJobs = urlIn(body, /\/contact\/robot-team$/);
  expect(invitation.startsWith(ORIGIN)).toBe(true);

  expect((await request.get(invitation)).status()).toBe(200);
  expect(await authAccount(request, C.email)).toBeNull();
  expect((await request.head(invitation)).status()).toBeLessThan(400);
  expect(await authAccount(request, C.email)).toBeNull();
  await scannerLoad(browser, invitation, C.ip);
  expect(await authAccount(request, C.email)).toBeNull();

  const { context, page } = await freshPage(browser, C.ip);
  await page.goto(invitation);
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible({ timeout: 30_000 });
  // Without the tick: refused with a message.
  await page.getByRole("button", { name: /^Create account/ }).click();
  await expect(page.getByRole("alert")).toContainText("agree to the Terms and Privacy Policy");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /^Create account/ }).click();
  await expect(page).toHaveURL(/\/contact\/robot-team/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "No jobs yet." })).toBeVisible({ timeout: 30_000 });
  observed.findJobsZero = await mainText(page);
  const user = await authAccount(request, C.email);
  expect(user).not.toBeNull();
  observed.accountProviders = (user.providerUserInfo ?? []).map((info: { providerId: string }) => info.providerId);
  expect(observed.accountProviders).not.toContain("password");
  await context.close();

  // The same invitation opened again, after the account exists.
  const again = await freshPage(browser, C.ip);
  await again.page.goto(invitation);
  await expect(again.page.getByRole("heading", { name: /Create your account|Access by invitation/ })).toBeVisible({ timeout: 30_000 });
  await again.page.getByRole("checkbox").check().catch(() => undefined);
  await again.page.getByRole("button", { name: /^Create account/ }).click().catch(() => undefined);
  await again.page.waitForTimeout(3_000);
  observed.invitationSecondOpen = await mainText(again.page);
  await again.context.close();

  // The approval email's "Find jobs" link, read signed out.
  const out = await freshPage(browser, "10.31.99.9");
  await out.page.goto(findJobs.replace("https://tryblueprint.io", ORIGIN), { waitUntil: "networkidle" });
  await out.page.waitForTimeout(2_000);
  observed.findJobsSignedOut = await mainText(out.page);
  await out.context.close();
});

test("3. the sign-in link asked for at /sign-in, in a real browser: it signs in once; opening it again says it no longer works", async ({ request, browser }) => {
  await apiApply(request, A);
  await decide(request, A.email, "approved");
  const { context, page } = await freshPage(browser, A.ip);
  await page.goto("/sign-in");
  await page.locator("#email").fill(A.email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByRole("status")).toContainText("If that address belongs to an approved deployment company", { timeout: 15_000 });
  await context.close();
  const row = (await outboxTo(request, A.email)).find(item => item.kind === "robot_team_sign_in_link");
  expect(row, "a sign-in link row in the outbox").toBeTruthy();
  observed.signInEmail = { subject: row!.subject, lines: row!.body.split("\n").filter(line => !/@|link=/.test(line)) };
  const link = urlIn(row!.body, /\/sign-in\?link=/);
  expect(link.startsWith(ORIGIN)).toBe(true);

  const human = await freshPage(browser, A.ip);
  await human.page.goto(link);
  await expect(human.page.getByRole("button", { name: "Sign in with this link" })).toBeVisible({ timeout: 30_000 });
  expect(human.page.url()).not.toContain("link=");
  await human.page.getByRole("button", { name: "Sign in with this link" }).click();
  await expect(human.page).toHaveURL(/\/contact\/robot-team/, { timeout: 30_000 });
  await human.page.waitForTimeout(2_000);
  observed.afterSignInLinkNoTerms = await mainText(human.page);
  expect(await linkUsed(request, link)).toBe(true);
  expect(human.page.url()).not.toContain("link=");
  await human.context.close();

  const second = await freshPage(browser, A.ip);
  await second.page.goto(link);
  await second.page.getByRole("button", { name: "Sign in with this link" }).click({ timeout: 30_000 });
  await expect(second.page.getByText("This sign-in link no longer works. Ask for a new one on this page.")).toBeVisible({ timeout: 30_000 });
  await second.context.close();
});

test("4. the sign-in link: a plain GET, a HEAD and a scanner's load (scripts, no click) spend nothing; the company's press signs it in", async ({ request, browser }) => {
  await apiApply(request, B);
  await decide(request, B.email, "approved");
  const asked = await request.post(`${ORIGIN}/api/robot-team-access/sign-in-link`, { headers: { ...await csrf(request), "X-Forwarded-For": B.ip },
    data: { email: B.email } });
  expect(asked.status()).toBe(202);
  const link = urlIn((await outboxTo(request, B.email)).find(item => item.kind === "robot_team_sign_in_link")!.body, /\/sign-in\?link=/);

  const get = await request.get(link);
  expect(get.status()).toBe(200);
  expect(await linkUsed(request, link)).toBe(false);
  const head = await request.head(link);
  expect(head.status()).toBeLessThan(400);
  expect(await linkUsed(request, link)).toBe(false);
  const landed = (await scannerLoad(browser, link, "10.31.77.7")).replace(ORIGIN, "");
  observed.signInScannerLanded = landed;
  expect(landed).toBe("/sign-in");
  expect((observed[`scanner /sign-in`] as { redeems: string[] }).redeems).toEqual([]);
  expect(await linkUsed(request, link)).toBe(false);
  // The company opens its email after the scanner: the link still works, on its press.
  const human = await freshPage(browser, B.ip);
  await human.page.goto(link);
  await human.page.getByRole("button", { name: "Sign in with this link" }).click({ timeout: 30_000 });
  await expect(human.page).toHaveURL(/\/contact\/robot-team/, { timeout: 30_000 });
  expect(await linkUsed(request, link)).toBe(true);
  await human.context.close();
});

test("5. the new-job email: one row for the approved company with Terms; GET, HEAD and a scanner's load do not spend its link; the press does; Find jobs with one job; the job page shows nothing of the site", async ({ page, request, browser }) => {
  const job = await listedJob(page, request, missing, stamp, { address: `Quillfeather Harbour ${letters}, Dockside` });
  await autoSend(request);
  const rows = (await outboxTo(request, C.email)).filter(row => row.kind === "robot_team_new_task");
  expect(rows).toHaveLength(1);
  observed.newJobEmail = { subject: rows[0].subject, lines: rows[0].body.split("\n").filter(line => !/@|link=/.test(line)) };
  // A (no Terms yet) and B (no Terms) get none.
  expect((await outboxTo(request, A.email)).filter(row => row.kind === "robot_team_new_task")).toEqual([]);
  const link = urlIn(rows[0].body, /\/jobs\/[^?]+\?link=/);
  expect(link.startsWith(ORIGIN)).toBe(true);

  expect((await request.get(link)).status()).toBe(200);
  expect(await linkUsed(request, link)).toBe(false);
  expect((await request.head(link)).status()).toBeLessThan(400);
  expect(await linkUsed(request, link)).toBe(false);
  const scannerLanded = (await scannerLoad(browser, link, "10.31.78.8")).replace(ORIGIN, "");
  observed.newJobScannerLanded = scannerLanded;
  expect(scannerLanded).toBe(`/jobs/${job.requestId}`);
  expect((observed[`scanner /jobs/${job.requestId}`] as { redeems: string[] }).redeems).toEqual([]);
  expect(await linkUsed(request, link)).toBe(false);

  // The company opens its email: one press of Sign in spends the link and opens the job.
  const human = await freshPage(browser, C.ip);
  await human.page.goto(link);
  await expect(human.page.getByRole("heading", { name: "Sign in to see this job" })).toBeVisible({ timeout: 30_000 });
  expect(human.page.url()).not.toContain("link=");
  await human.page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(human.page.getByRole("form", { name: "Your response" })).toBeVisible({ timeout: 30_000 });
  expect(await linkUsed(request, link)).toBe(true);
  await human.page.goto("/contact/robot-team");
  await human.page.waitForTimeout(3_000);
  observed.findJobsOne = await mainText(human.page);
  expect(observed.findJobsOne).not.toContain("No jobs yet.");

  await human.page.goto(`/jobs/${job.requestId}`);
  await expect(human.page.getByRole("form", { name: "Your response" })).toBeVisible({ timeout: 30_000 });
  const jobText = await mainText(human.page);
  observed.jobPage = jobText;
  expect(jobText).not.toContain(`Quillfeather Harbour ${letters}`);
  expect(jobText).not.toContain(job.site.email);
  expect(jobText.toLowerCase()).not.toContain("first look");
  expect(jobText).not.toMatch(/\bvendor|\bintegrator|\bOEM\b/i);
  await human.context.close();

  // A stranger with the job's link and no sign-in.
  const stranger = await freshPage(browser, "10.31.98.8");
  await stranger.page.goto(`/jobs/${job.requestId}`);
  await stranger.page.waitForTimeout(4_000);
  observed.jobPageStranger = await mainText(stranger.page);
  expect(observed.jobPageStranger as string).not.toContain(`Quillfeather Harbour ${letters}`);
  await stranger.context.close();
});

test.afterAll(() => {
  console.log(`OUTREACH-COMPANY-OBSERVED ${JSON.stringify(observed, null, 1)}`);
  console.log(`OUTREACH-COMPANY-MISSING ${JSON.stringify(missing)}`);
});
