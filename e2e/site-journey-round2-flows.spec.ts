/**
 * The flows the second stress test (2026-11-24) found broken, as browser tests on the core-journey harness: real handlers
 * on the Firebase emulators, the scripted video model and the scripted model pass over free text
 * (`scripts/qa/answer-journey-local-app.ts`); no real email, no real model.
 *
 * Run with the core journey (`npm run test:core-journey`), or alone:
 *   npx -y firebase-tools@13.35.1 emulators:exec --only firestore,storage,auth --project demo-blueprint-reliability \
 *     --config firebase.json "npx playwright test --config playwright.answer-journey.config.ts --trace off e2e/site-journey-round2-flows.spec.ts"
 *
 * The last test approves companies the next day's sweep checks; it stays last.
 */
import { test, expect, type APIRequestContext } from "@playwright/test";
import { applyAndApprove, companyBrowser, companyFor, listedJob, autoSend, applicants, respond, ORIGIN, outbox, deliverOutbox,
  csrf, signIn, decide, companyIdOf, firestoreDoc, stampInLetters, DAY_MS, FIRESTORE_EMULATOR, PROJECT } from "./helpers/journey";
import { INTRODUCTION_REQUEST_STATEMENT_VERSION } from "../client/src/lib/siteIntroductions";
import { SITE_REPLY_BEING_PREPARED, SITE_REPLY_ONLY_CONTACT_DETAILS } from "../client/src/lib/companiesRead";
import { APPLICATION_NAME_HOLDS_CONTACT, APPLICATION_WEBSITE_NOT_OWN } from "../client/src/lib/companyApplicant";
import { companyNotApprovedNow } from "../client/src/lib/companyResponses";
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ timeout: 420_000 });

const redactorFails = async (request: APIRequestContext, calls: number) =>
  expect((await request.post(`${ORIGIN}/api/reliability/redactor-fails?calls=${calls}`)).ok()).toBe(true);

async function companyJobJson(request: APIRequestContext, token: string, jobId: string) {
  const response = await request.get(`${ORIGIN}/api/site-worlds/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: response.status(), body: await response.json().catch(() => null) as any };
}

test("a reply or a question of digits alone never crosses before the model pass, and the site is told what companies read", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, jobUrl } = await listedJob(page, request, missing, stamp);
  const company = companyFor(stamp, "R", 81);
  await applyAndApprove(request, company);
  const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId);
  await autoSend(request);
  try {
    await respond(companyPage, requestId, { state: "Need more details", note: "Can we call someone at the site to arrange a visit?" });
    await page.goto(jobUrl);
    const item = applicants(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: company.name, exact: true }) });
    await expect(item).toContainText("arrange a visit", { timeout: 30_000 });
    // From now on every model pass fails, as a provider that does not answer: nothing the pass must read may cross.
    await redactorFails(request, 50);
    // A reply of only a mobile number in the Spanish grouping (3-3-3) is refused, saying why.
    await item.getByText("Reply", { exact: true }).click();
    await item.getByLabel("Your reply").fill("612 345 678");
    await item.getByRole("button", { name: "Send reply" }).click();
    await expect(item.getByRole("alert")).toHaveText(SITE_REPLY_ONLY_CONTACT_DETAILS, { timeout: 30_000 });
    // Nine digits with nothing between them stay as typed for the pattern pass, so they wait for the model pass.
    await item.getByLabel("Your reply").fill("612345678");
    await item.getByRole("button", { name: "Send reply" }).click();
    await expect(item.getByText("Reply sent.")).toBeVisible({ timeout: 30_000 });
    await page.reload();
    // The site is told the company does not read it yet: never "as the company reads it" while no pass has read it.
    await expect(item).toContainText(`${company.name} sees your reply once we have taken names and contact details out of it.`,
      { timeout: 30_000 });
    await expect(item).not.toContainText("reads it, with names and contact details taken out");
    await companyPage.goto(`/jobs/${requestId}`);
    const answer = companyPage.getByRole("region", { name: "Answer from the site" });
    await expect(answer).toContainText(SITE_REPLY_BEING_PREPARED, { timeout: 30_000 });
    expect(await answer.innerText()).not.toContain("612345678");
    // The company asks again with only a number in it: the site never reads the number, though the pass still fails.
    await respond(companyPage, requestId, { state: "Need more details", note: "☎ 415•555•0199 ☎" });
    await page.goto(jobUrl);
    await expect(item).toBeVisible({ timeout: 30_000 });
    expect(await item.innerText()).not.toContain("415•555•0199");
    expect(await item.innerText()).not.toMatch(/415\D{0,3}555\D{0,3}0199/);
  } finally {
    await redactorFails(request, 0);
    await context.close();
  }
  expect(missing).toEqual([]);
});

test("after a withdrawal, nothing of the job is reachable through a link a company holds, and it leaves the public list at once", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, token: ownerToken } = await listedJob(page, request, missing, stamp,
    { task: "Pick up the sealed carton from the end of the conveyor and place it on the blue cart by the wall." });
  const company = companyFor(stamp, "W", 82);
  await applyAndApprove(request, company);
  const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId);
  await autoSend(request);
  await respond(companyPage, requestId, { state: "Apply", note: "We have done this many times." });
  const token = await signIn(request, company.email, company.password);
  const before = await companyJobJson(request, token, requestId);
  expect(before.status).toBe(200);
  const media: Record<string, string> = {};
  if (before.body?.item?.video?.url) media.video = before.body.item.video.url;
  if (before.body?.item?.thumbnailUrl) media.thumbnail = before.body.item.thumbnailUrl;
  if (before.body?.item?.simulationDownload?.url) media.simulation = before.body.item.simulationDownload.url;
  expect(Object.keys(media).length).toBeGreaterThan(0);
  // The public list, read once so its one-minute cache is warm, as a visitor would.
  const ref = `l-${createHmac("sha256", "harness-only-company-media-tickets").update(`public-live-job:${requestId}`).digest("hex").slice(0, 32)}`;
  const publicBefore = await request.get(`${ORIGIN}/api/public/live-jobs`);
  expect(publicBefore.headers()["cache-control"]).toBe("private, no-cache");
  // A newly listed job joins the list once its one-minute cache (warmed by an earlier spec) is read again.
  await expect.poll(async () => (await (await request.get(`${ORIGIN}/api/public/live-jobs`)).json()).jobs
    .some((job: { ref?: string }) => job.ref === ref), { timeout: 90_000, intervals: [5_000] }).toBe(true);

  const withdrawn = await page.request.post(`${ORIGIN}/api/self-capture/uploads/${encodeURIComponent(ownerToken)}/withdrawal`,
    { headers: await csrf(page.request), data: { confirm: "withdraw_recording_permission" } });
  expect(withdrawn.status(), await withdrawn.text()).toBe(202);

  expect((await companyJobJson(request, token, requestId)).status).toBe(404);
  for (const [name, url] of Object.entries(media))
    expect((await companyPage.request.get(new URL(url, ORIGIN).href)).status(), `${name} after withdrawal`).toBeGreaterThanOrEqual(400);
  const library = await request.get(`${ORIGIN}/api/site-worlds/tasks`, { headers: { Authorization: `Bearer ${token}` } });
  expect(((await library.json()).items ?? []).map((item: { id: string }) => item.id)).not.toContain(requestId);
  // Gone from the public list on the very next read, within the minute its cache would have kept it.
  expect((await (await request.get(`${ORIGIN}/api/public/live-jobs`)).json()).jobs.some((job: { ref?: string }) => job.ref === ref)).toBe(false);
  // The company is asked to delete its copy.
  expect((await outbox(request, requestId)).filter(row => row.kind === "job_withdrawn_company").length).toBeGreaterThan(0);
  await context.close();
  expect(missing).toEqual([]);
});

test("a company whose approval is withdrawn after it applied: the site is told why it cannot accept it, and Accept is back once approved again", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, jobUrl } = await listedJob(page, request, missing, stamp);
  const company = companyFor(stamp, "V", 83);
  await applyAndApprove(request, company);
  const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId);
  await autoSend(request);
  await respond(companyPage, requestId, { state: "Apply", note: "We deploy carton pickers.", charge: "Monthly subscription", low: "4000", high: "6000" });
  await page.goto(jobUrl);
  const item = applicants(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: company.name, exact: true }) });
  await expect(item.getByRole("button", { name: "Accept" })).toBeVisible({ timeout: 30_000 });
  await expect(item).not.toContainText("isn't approved by Blueprint");

  await decide(request, company.email, "declined");
  await page.reload();
  await expect(item).toContainText(companyNotApprovedNow(company.name), { timeout: 30_000 });
  await expect(item.getByRole("button", { name: "Accept" })).toHaveCount(0);

  await decide(request, company.email, "approved");
  await page.reload();
  await expect(item.getByRole("button", { name: "Accept" })).toBeVisible({ timeout: 30_000 });
  await expect(item).not.toContainText("isn't approved by Blueprint");
  await context.close();
  expect(missing).toEqual([]);
});

test("after an introduction: each side's answer is recorded whatever the other said, and its questions end only on its own final answer", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, token } = await listedJob(page, request, missing, stamp);
  const [a, b] = ["S", "T"].map((letter, index) => companyFor(stamp, letter, 84 + index));
  const browsers = [];
  for (const company of [a, b]) { await applyAndApprove(request, company); browsers.push(await companyBrowser(browser, company, missing, requestId)); }
  await autoSend(request);
  for (const item of browsers) await respond(item.page, requestId, { state: "Apply", note: "", charge: "Monthly subscription", low: "4000", high: "6000" });
  const introduce = async (alias: string) => {
    const pressed = await page.request.post(`${ORIGIN}/api/site-task-brief/${encodeURIComponent(token)}/introductions`,
      { headers: await csrf(page.request), data: { alias, statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION } });
    expect(pressed.status(), await pressed.text()).toBe(200);
  };
  const t0 = Date.now();
  await introduce("A");
  await introduce("B");
  await deliverOutbox(request);
  const sweep = async (atMs: number) => expect((await request.post(`${ORIGIN}/api/reliability/outcomes?atMs=${atMs}`)).ok()).toBe(true);
  const questions = async () => (await outbox(request, requestId)).filter(row => row.kind === "job_outcome_question");
  await sweep(t0 + 14 * DAY_MS + 3_600_000);
  const day14 = await questions();
  expect(day14.length).toBe(4);
  const linkFor = (row: { body: string }, label: string) => new RegExp(`${label}:\\n(\\S+)`).exec(row.body)?.[1] ?? null;
  const [aId, bId] = [a, b].map(company => companyIdOf(company.email));
  const toCompany = (id: string, email: string) => day14.find(row => row.to === email.toLowerCase() && row.idempotencyKey.includes(`${id}:company`))!;
  const siteAbout = (id: string) => day14.find(row => row.idempotencyKey.includes(`${id}:site`))!;
  // Company A says Not going ahead; then the site, on its own day-14 link about A, says Not going ahead too, with a
  // reason: both are recorded, each on its own.
  const companyAnswer = await request.post(linkFor(toCompany(aId, a.email), "Not going ahead")!, { maxRedirects: 0 });
  expect(companyAnswer.headers().location).toMatch(/\?answer=not_going_ahead$/);
  const siteAnswer = await request.post(`${linkFor(siteAbout(aId), "Not going ahead")!}?reason=timing`, { maxRedirects: 0 });
  expect(siteAnswer.status()).toBe(303);
  // Never the other side's answer: the site is thanked for its own.
  expect(siteAnswer.headers().location).toMatch(/\?answer=not_going_ahead&reason=timing$/);
  const introA = await firestoreDoc(request, `inboundRequests/${requestId}/introductions/${aId}`);
  expect(((introA?.outcomes as Array<{ by: string; state: string }>) ?? []).map(item => `${item.by}:${item.state}`))
    .toEqual(["company:not_going_ahead", "site:not_going_ahead"]);
  // Company B says Not going ahead; the site says nothing about B. The site's later questions about B are still asked.
  await request.post(linkFor(toCompany(bId, b.email), "Not going ahead")!, { maxRedirects: 0 });
  await deliverOutbox(request);
  await sweep(t0 + 45 * DAY_MS + 3_600_000);
  await sweep(t0 + 90 * DAY_MS + 3_600_000);
  await sweep(t0 + 120 * DAY_MS);
  const keys = (await questions()).map(row => row.idempotencyKey.split(":").slice(-3).join(":")).sort();
  expect(keys).toEqual([`${aId}:company:d14`, `${aId}:site:d14`, `${bId}:company:d14`, `${bId}:site:d14`, `${bId}:site:d45`, `${bId}:site:d90`].sort());
  for (const item of browsers) await item.context.close();
  expect(missing).toEqual([]);
});

test("one office address: a company asks for its sign-in link a few times, then accepts the Terms", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId } = await listedJob(page, request, missing, stamp);
  const company = companyFor(stamp, "L", 86);
  await applyAndApprove(request, company);
  // "I did not get the email": more requests for a sign-in link from the same office in the same minute.
  const headers = { ...await csrf(request), "X-Forwarded-For": company.ip };
  const asked: number[] = [];
  for (let i = 0; i < 5; i++) asked.push((await request.post(`${ORIGIN}/api/robot-team-access/sign-in-link`, { headers, data: { email: company.email } })).status());
  expect(asked).toContain(429);
  const held = await request.post(`${ORIGIN}/api/robot-team-access/sign-in-link`, { headers, data: { email: company.email } });
  expect(held.status()).toBe(429);
  expect((await held.json()).error).toMatch(/^Too many tries in a short time\. Wait (?:a minute|\d+ minutes) and try again\.$/);
  expect(Number(held.headers()["retry-after"])).toBeGreaterThan(0);
  // Signed in with its password from the same office, the company presses I agree: its own limit, by its account.
  const { context } = await companyBrowser(browser, company, missing, requestId);
  await context.close();
  expect(missing).toEqual([]);
});

test("staff routes refuse a signed-in company and a signed-out visitor", async ({ request }) => {
  const stamp = String(Date.now());
  const company = companyFor(stamp, "K", 87);
  await applyAndApprove(request, company);
  const token = await signIn(request, company.email, company.password);
  const headers = await csrf(request);
  const results: Record<string, number> = {};
  results.listAsCompany = (await request.get(`${ORIGIN}/api/admin/robot-team-access`, { headers: { Authorization: `Bearer ${token}` } })).status();
  results.decideAsCompany = (await request.post(`${ORIGIN}/api/admin/robot-team-access/${companyIdOf(company.email)}/decision`,
    { headers: { ...headers, Authorization: `Bearer ${token}` }, data: { status: "approved" } })).status();
  results.workflowAsCompany = (await request.get(`${ORIGIN}/api/job-workflow/admin/some-job`, { headers: { ...headers, Authorization: `Bearer ${token}` } })).status();
  results.listSignedOut = (await request.get(`${ORIGIN}/api/admin/robot-team-access`)).status();
  for (const [name, status] of Object.entries(results)) {
    expect(status, name).toBeGreaterThanOrEqual(401);
    expect(status, name).toBeLessThan(500);
  }
});

test("a company's own name, website and estimate carry no phone number to the site before Accept", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, jobUrl } = await listedJob(page, request, missing, stamp);
  const zed = `Zed Robotics ${stampInLetters(stamp)}`;
  const company = { ...companyFor(stamp, "Z", 88), name: zed, website: "https://zed-robotics.example/contact?phone=14155550199" };
  const apply = async (fields: Partial<typeof company>) => request.post(`${ORIGIN}/api/robot-team-access/apply`, {
    headers: { ...await csrf(request), "X-Forwarded-For": company.ip },
    data: { name: company.contact, email: company.email, company: company.name, website: company.website, ...fields } });
  // A phone number in the name, or a messaging link as the website: refused, each saying why.
  const named = await apply({ company: `${zed} · call 415 555 0199` });
  expect(named.status()).toBe(400);
  expect((await named.json()).error).toBe(APPLICATION_NAME_HOLDS_CONTACT);
  const messaging = await apply({ website: "https://wa.me/14155550199" });
  expect(messaging.status()).toBe(400);
  expect((await messaging.json()).error).toBe(APPLICATION_WEBSITE_NOT_OWN);
  // The company's own name and website (a contact page with a number in its query) are taken.
  await applyAndApprove(request, company);
  const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId);
  await autoSend(request);
  // An hourly estimate whose digits are a phone number: refused on the page, the field marked.
  const refused = await respond(companyPage, requestId, { state: "Apply", note: "", charge: "Per hour of work", low: "41555501.99", high: "41555501.99" });
  expect(refused.response).toBeNull();
  await expect(refused.status).toContainText("Enter the estimate in US dollars");
  await expect(refused.form.getByLabel("From", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await respond(companyPage, requestId, { state: "Apply", note: "", charge: "Per hour of work", low: "45", high: "60" });
  await page.goto(jobUrl);
  const item = applicants(page).getByRole("listitem").filter({ hasText: zed });
  await expect(item).toBeVisible({ timeout: 30_000 });
  const shown = await item.innerText();
  expect(shown).toContain("https://zed-robotics.example");
  expect(shown).not.toContain("phone=");
  expect(shown).not.toMatch(/415\D{0,3}555\D{0,3}0199/);
  expect(shown).toContain("$45 to $60 an hour");
  await expect(item.getByRole("link", { name: "https://zed-robotics.example" })).toHaveAttribute("href", "https://zed-robotics.example");
  await context.close();
  expect(missing).toEqual([]);
});

test("a company's own client write of a Terms acceptance is refused, and it sees no job until it presses I agree", async ({ page, request }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId } = await listedJob(page, request, missing, stamp);
  const company = companyFor(stamp, "J", 89);
  await applyAndApprove(request, company);
  const idToken = await signIn(request, company.email, company.password);
  const uid = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")).user_id as string;
  expect((await request.get(`${ORIGIN}/api/site-worlds/jobs/${requestId}`, { headers: { Authorization: `Bearer ${idToken}` } })).status()).toBe(403);
  const { TERMS_VERSION, PRIVACY_VERSION, TERMS_URL, PRIVACY_URL } = await import("../client/src/lib/legalAcceptance");
  // The Firestore REST API with the company's own ID token: the security rules decide, as for the client SDK.
  const written = await request.patch(`http://${FIRESTORE_EMULATOR}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`
    + "?updateMask.fieldPaths=termsAcceptance&updateMask.fieldPaths=acceptedTerms", { headers: { Authorization: `Bearer ${idToken}` },
    data: { fields: { acceptedTerms: { booleanValue: true }, termsAcceptance: { mapValue: { fields: {
      accepted_terms: { booleanValue: true }, terms_version: { stringValue: TERMS_VERSION }, privacy_version: { stringValue: PRIVACY_VERSION },
      terms_url: { stringValue: TERMS_URL }, privacy_url: { stringValue: PRIVACY_URL }, accepted_at: { stringValue: "2019-01-01T00:00:00.000Z" } } } } } } });
  expect(written.status(), "the client SDK cannot write a Terms acceptance").toBeGreaterThanOrEqual(400);
  expect((await request.get(`${ORIGIN}/api/site-worlds/jobs/${requestId}`, { headers: { Authorization: `Bearer ${idToken}` } })).status()).toBe(403);
  expect((await firestoreDoc(request, `robotTeamAccess/${companyIdOf(company.email)}`))?.termsAcceptance).toBeUndefined();
  expect(missing).toEqual([]);
});

// Last in this file: the next day's sweep approves companies on the emulator.
test("a hundred junk applications do not use up the day's automatic checks, and a real company is checked again the next day", async ({ request }) => {
  test.setTimeout(600_000);
  const stamp = String(Date.now());
  // Domains spelled with letters: a website whose host holds seven digits or more reads as a phone number and is refused.
  const domain = stampInLetters(stamp);
  const headers = await csrf(request);
  let accepted = 0;
  for (let i = 0; i < 100; i++) {
    const applied = await request.post(`${ORIGIN}/api/robot-team-access/apply`, { headers: { ...headers, "X-Forwarded-For": `10.66.${Math.floor(i / 5)}.${(Number(stamp.slice(-2)) % 200) + 1}` },
      data: { name: `Junk ${i}`, email: `ops${i}@junk${domain}.example`, company: `Junk ${i}`, website: `https://junk${domain}.example` } });
    if (applied.status() === 202) accepted++;
  }
  expect(accepted).toBe(100);
  const legit = { email: `ops@realrobots${domain}.example`, website: `https://realrobots${domain}.example` };
  const applied = await request.post(`${ORIGIN}/api/robot-team-access/apply`, { headers: { ...headers, "X-Forwarded-For": "10.67.1.1" },
    data: { name: "Real Person", email: legit.email, company: `Real Robots ${domain}`, website: legit.website } });
  expect(applied.status()).toBe(202);
  const id = companyIdOf(legit.email);
  let record: Record<string, any> | null = null;
  for (let i = 0; i < 30; i++) {
    record = await firestoreDoc(request, `robotTeamAccess/${id}`);
    if (record?.companyCheck) break;
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  // The harness reaches no website, so the real company's check fails for the moment, never at the day's cap.
  expect(record?.companyCheck?.reasons ?? []).not.toContain("daily_check_cap");
  expect(record?.status).toBe("applied");
  // The next day: the ops monitor's sweep, on the same emulator, with a website that passes and a model that says yes.
  const swept = spawnSync(process.execPath, ["--import", "tsx", "e2e/helpers/company-check-sweep.ts", String(Date.now() + 26 * 3_600_000), id], {
    encoding: "utf8", env: { PATH: process.env.PATH!, HOME: process.env.HOME!, NODE_ENV: "test", BLUEPRINT_DISABLE_LOCAL_ENV_BOOTSTRAP: "1",
      GOOGLE_CLOUD_PROJECT: PROJECT, GCLOUD_PROJECT: PROJECT, FIRESTORE_EMULATOR_HOST: FIRESTORE_EMULATOR, FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
      FIREBASE_STORAGE_BUCKET: `${PROJECT}.appspot.com`, FIELD_ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 1).toString("base64") } });
  expect(swept.status, swept.stderr.slice(-800)).toBe(0);
  expect((await firestoreDoc(request, `robotTeamAccess/${id}`))?.status, "checked again the next day and approved").toBe("approved");
});
