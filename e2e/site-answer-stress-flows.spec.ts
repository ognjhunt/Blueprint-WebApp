/**
 * The flows the stress test of 2026-11-24 found broken or confusingly worded, as proper tests on the core-journey harness
 * (real handlers, Firebase emulators, the scripted video model, an outbox that never reaches a mail provider). Run by
 * `npm run test:core-journey` after `e2e/site-answer-journey.spec.ts` (files run in name order): the journey needs a run with
 * no approved company yet, and these approve several.
 *
 * - A site corrects one word of a description longer than 300 characters, with real keystrokes.
 * - A company gives an estimate with cents or under a dollar; a refused detail names its field; the site is told when an
 *   estimate changed since it last looked.
 * - A company signs in from the gated job page and Back does not show a sign-in form; a declined company is told why.
 * - The site's applicants: the reply box names the company, the comparison leaves out a company that can no longer be
 *   accepted, a stale Accept reads the job again, an estimate changed after Accept is said.
 * - At 375 px the comparison is cards with no sideways scroll; a failing status read says so with a retry.
 * - A depalletizing job is asked about its incoming pallets, and a weight typed in pounds reads as typed.
 */
import { test, expect } from "@playwright/test";
import { COMPANY_RESPONSE_STATEMENT_VERSION as STATEMENT } from "../client/src/lib/companyResponses";
import { ORIGIN, applicants, applyAndApprove, autoSend, companyBrowser, companyFor, csrf, decide, deliverOutbox, jobRecord,
  listedJob, localOnly, respond, signIn, FIRESTORE_EMULATOR, companyIdOf } from "./site-answer-journey-helpers";

test.use({ viewport: { width: 1440, height: 900 } });
// Several companies sign in and answer in their own browsers: longer than the journey's own default.
test.describe.configure({ timeout: 420_000 });

const LONG = "Pick up each sealed carton from the end of the conveyor and place it on the cart beside the line. "
  + "The cartons come in three sizes, the largest about 45 cm on its longest side, and arrive about every nine seconds at the busiest time. "
  + "The cart is moved away by a person when it is full, and an empty one is put in its place; the robot must wait while that happens. "
  + "Cartons that arrive damaged are left on the conveyor for a person to deal with.";

test("a site corrects one word of a description longer than 300 characters, by keystrokes, and it is saved", async ({ page, request }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  expect(LONG.length).toBeGreaterThan(300);
  const { jobUrl, token } = await listedJob(page, request, missing, stamp, { task: LONG });
  await page.goto(jobUrl);
  await page.getByRole("button", { name: /Job settings/ }).first().click();
  const editor = page.locator("#job-brief-editor");
  if (!await editor.evaluate((node: HTMLDetailsElement) => node.open)) await editor.locator("summary").first().click();
  const summary = editor.locator("#brief-summary");
  await expect(summary).toHaveValue(LONG);
  // A person fixes one word: the cursor after "three", five Backspaces, then "four".
  await summary.click();
  await summary.evaluate((input: HTMLTextAreaElement) => { const at = input.value.indexOf("three") + 5; input.setSelectionRange(at, at); });
  for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type("four");
  await expect(summary).toHaveValue(LONG.replace("three sizes", "four sizes"));
  const name = editor.locator("#confirm-name");
  if (await name.count()) await name.fill("Site Lead");
  const confirmed = page.waitForResponse(response => response.url().endsWith("/confirm"));
  await editor.getByRole("button", { name: /confirm it|confirm and save/ }).first().click();
  expect((await confirmed).status()).toBe(200);
  const brief = await (await page.request.get(`${ORIGIN}/api/site-task-brief/${encodeURIComponent(token)}`)).json();
  expect(brief.brief.summary).toBe(LONG.replace("three sizes", "four sizes"));
  expect(missing).toEqual([]);
});

test("a company gives estimates with cents, a refused detail names its field, and the site is told the estimate changed", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, jobUrl } = await listedJob(page, request, missing, stamp);
  const company = companyFor(stamp, "E", 14);
  await applyAndApprove(request, company);
  const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId);
  await autoSend(request);

  // Under a dollar, per item: sent and saved.
  const cents = await respond(companyPage, requestId, { state: "Apply", note: "", charge: "Per task or item", low: "0.35", high: "0.50" });
  expect(cents.response?.status()).toBe(200);
  expect(cents.response?.request().postDataJSON().details.estimate).toEqual({ lowUsd: 0.35, highUsd: 0.5 });
  // The site looks.
  await page.goto(jobUrl);
  const item = applicants(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: company.name, exact: true }) });
  await expect(item).toContainText("$0.35 to $0.50 per task or item", { timeout: 30_000 });

  // A comma that does not group thousands is never guessed at: the form says how to write it and sends nothing.
  const comma = await respond(companyPage, requestId, { state: "Apply", note: "", charge: "Per hour of work", low: "0,35", high: "" });
  expect(comma.response).toBeNull();
  await expect(comma.status).toContainText("Enter the estimate in US dollars, such as 1,200 or 0.35");
  // Written with a dollar sign and cents: sent as dollars.
  const hourly = await respond(companyPage, requestId, { state: "Apply", note: "", charge: "Per hour of work", low: "$45.00", high: "$60.50" });
  expect(hourly.response?.status()).toBe(200);

  // A refused detail is named, not blamed on the note.
  const token = await signIn(request, company.email, company.password);
  const refusal = async (details: Record<string, unknown>) => {
    const refused = await request.post(`${ORIGIN}/api/site-worlds/tasks/${requestId}/interest`, { headers: { ...await csrf(request),
      Authorization: `Bearer ${token}` }, data: { state: "interested", inputs: "ok", statementVersion: STATEMENT, details } });
    expect(refused.status()).toBe(400);
    return (await refused.json()).error as string;
  };
  expect(await refusal({ question: "Hi?" })).toBe("Write your question for the site in 4 to 400 characters.");
  expect(await refusal({ visitMustConfirm: "x".repeat(301) })).toBe("Keep what a visit must confirm to 300 characters or fewer.");
  expect(await refusal({ estimate: { lowUsd: 5, highUsd: 9 }, chargeModel: "undecided" })).toMatch(/^An estimate needs a way of charging/);

  // The site comes back: the new estimate, and what it was when the site last looked.
  await page.reload();
  await expect(item).toContainText("$45.00 to $60.50 an hour", { timeout: 30_000 });
  await expect(item).toContainText("Changed since you last looked. It was $0.35 to $0.50 per task or item.");
  // Seen now: the next look says nothing changed.
  await page.reload();
  await expect(item).toContainText("$45.00 to $60.50 an hour", { timeout: 30_000 });
  await expect(item).not.toContainText("Changed since you last looked");
  await context.close();
  expect(missing).toEqual([]);
});

test("a company signs in from the gated job page and Back does not show a sign-in form; a declined company is told why", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId } = await listedJob(page, request, missing, stamp);
  const company = companyFor(stamp, "G", 11);
  await applyAndApprove(request, company);
  const anon = await browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": company.ip } });
  await localOnly(anon, missing);
  await anon.addInitScript(firestore => { Object.assign(globalThis, { __FIREBASE_DEFAULTS__: { emulatorHosts: { firestore } } }); }, FIRESTORE_EMULATOR);
  const gate = await anon.newPage();
  await gate.goto(`/jobs/${requestId}`);
  await expect(gate.getByRole("heading", { name: "Apply to see this job" })).toBeVisible({ timeout: 30_000 });
  await gate.getByRole("main").getByRole("link", { name: "Sign in", exact: true }).click();
  await gate.locator("#email").fill(company.email);
  await gate.locator("#password").fill(company.password);
  await gate.getByRole("button", { name: "Sign in", exact: true }).click();
  await gate.getByRole("button", { name: "I agree to the Terms and Privacy Policy" }).click({ timeout: 30_000 });
  await expect(gate.getByRole("region", { name: "The job" })).toBeVisible({ timeout: 30_000 });
  // Back: the sign-in page was replaced, so Back is the gated page, which reads the account as it is now.
  await gate.goBack();
  await expect(gate).toHaveURL(new RegExp(`/jobs/${requestId}$`));
  await expect(gate.getByRole("region", { name: "The job" })).toBeVisible({ timeout: 30_000 });
  await expect(gate.locator("#password")).toHaveCount(0);
  await anon.close();

  // A company Blueprint declined: why it cannot see the job, and where to write.
  const declined = companyFor(stamp, "X", 13);
  await applyAndApprove(request, declined, false);
  await decide(request, declined.email, "declined");
  const { context, page: declinedPage } = await companyBrowser(browser, declined, missing, requestId, { acceptTerms: false });
  await expect(declinedPage.getByRole("heading", { name: "This job is not available" })).toBeVisible({ timeout: 30_000 });
  await expect(declinedPage.getByText(/Only approved deployment companies can see jobs, and we cannot offer your company access yet\./))
    .toBeVisible();
  await expect(declinedPage.getByText(/may no longer be shared/)).toHaveCount(0);
  await context.close();
  expect(missing).toEqual([]);
});

test("the site's applicants: the reply names the company, the comparison leaves out one that cannot be accepted, a stale Accept reads the job again", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, jobUrl } = await listedJob(page, request, missing, stamp);
  const [a, b, c, d] = ["A", "B", "C", "D"].map((letter, index) => companyFor(stamp, letter, index + 1));
  const browsers = [];
  for (const company of [a, b, c, d]) { await applyAndApprove(request, company); browsers.push(await companyBrowser(browser, company, missing, requestId)); }
  await autoSend(request);
  const [pa, pb, pc, pd] = browsers.map(item => item.page);
  expect((await respond(pa, requestId, { state: "Apply", note: "", charge: "Per hour of work", low: "$1,200", high: "1,800" })).response?.status()).toBe(200);
  expect((await respond(pb, requestId, { state: "Apply", note: "", charge: "Monthly subscription", low: "4000", high: "6000" })).response?.status()).toBe(200);
  expect((await respond(pc, requestId, { state: "Need more details", note: "How many cartons arrive per minute at peak?" })).response?.status()).toBe(200);
  expect((await respond(pd, requestId, { state: "Apply", note: "", charge: "Monthly subscription", low: "5000", high: "7000" })).response?.status()).toBe(200);
  const entry = (name: string) => applicants(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
  const compare = page.getByRole("table", { name: "Compare applicants" });

  await page.goto(jobUrl);
  await expect(applicants(page)).toContainText("4 responses", { timeout: 30_000 });
  await expect(compare.getByRole("row")).toHaveCount(4);
  // The reply box names the company as the site reads it, never an alias it does not see.
  await entry(c.name).getByText("Reply", { exact: true }).click();
  await expect(entry(c.name).locator("form p.bare-helper")).toHaveText(`Blueprint shares this reply with ${c.name} and keeps your contact details private.`);

  // A accepted, then declined before its email went: its introduction is cancelled and it can no longer be accepted.
  await entry(a.name).getByRole("button", { name: "Accept" }).click();
  await expect(entry(a.name).getByRole("status")).toContainText(/We are emailing you/);
  await decide(request, a.email, "declined");
  await deliverOutbox(request);
  await page.reload();
  await expect(entry(a.name)).toContainText("This could not go ahead.", { timeout: 30_000 });
  await expect(compare.getByRole("row")).toHaveCount(3);
  await expect(compare).not.toContainText(a.name);

  // B changes to Not a fit while this page still offers Accept; pressing it reads the job again.
  const tokenB = await signIn(request, b.email, b.password);
  const changed = await request.post(`${ORIGIN}/api/site-worlds/tasks/${requestId}/interest`, { headers: { ...await csrf(request),
    Authorization: `Bearer ${tokenB}` }, data: { state: "declined", inputs: "We no longer have capacity.", statementVersion: STATEMENT } });
  expect(changed.status()).toBe(200);
  await entry(b.name).getByRole("button", { name: "Accept" }).click();
  await expect(entry(b.name).getByRole("alert")).toHaveText("This company has not applied, or has changed its answer since, so you cannot accept it now.");
  await expect(entry(b.name).getByText("Not a fit", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(entry(b.name).getByRole("button", { name: "Accept" })).toHaveCount(0);
  expect((await jobRecord(request, requestId)).billable.filter(row => row.companyId === companyIdOf(b.email) && row.status !== "void")).toEqual([]);

  // D accepted and introduced; it then raises its estimate. The site is told what it was when it accepted.
  await entry(d.name).getByRole("button", { name: "Accept" }).click();
  await expect(entry(d.name).getByRole("status")).toContainText(/We are emailing you/);
  await deliverOutbox(request);
  const tokenD = await signIn(request, d.email, d.password);
  const raised = await request.post(`${ORIGIN}/api/site-worlds/tasks/${requestId}/interest`, { headers: { ...await csrf(request),
    Authorization: `Bearer ${tokenD}` }, data: { state: "interested", inputs: "", statementVersion: STATEMENT,
    details: { chargeModel: "subscription", estimate: { lowUsd: 9000, highUsd: 12000 } } } });
  expect(raised.status()).toBe(200);
  await page.reload();
  await expect(entry(d.name)).toContainText(new RegExp(`You accepted ${d.name} on .+\\.`), { timeout: 30_000 });
  await expect(entry(d.name)).toContainText("$9,000 to $12,000 a month");
  await expect(entry(d.name)).toContainText("Changed after you accepted. It was $5,000 to $7,000 a month.");
  for (const item of browsers) await item.context.close();
  expect(missing).toEqual([]);
});

test("at 375 px the comparison is cards with no sideways scroll, and a failing status read says so with a retry", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  await page.setViewportSize({ width: 375, height: 740 });
  const { requestId, jobUrl } = await listedJob(page, request, missing, stamp);
  const [k, l] = [companyFor(stamp, "K", 31), companyFor(stamp, "L", 32)];
  for (const [index, company] of [k, l].entries()) {
    await applyAndApprove(request, company);
    const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId);
    if (index === 0) await autoSend(request);
    expect((await respond(companyPage, requestId, { state: "Apply", note: "", charge: "Per hour of work", low: "45", high: "60" })).response?.status()).toBe(200);
    await context.close();
  }
  await page.goto(jobUrl);
  await expect(applicants(page)).toContainText("2 responses", { timeout: 30_000 });
  const table = page.getByRole("table", { name: "Compare applicants" });
  await expect(table).toBeVisible();
  const fit = await table.evaluate((node: HTMLElement) => ({ width: node.scrollWidth, box: node.parentElement!.clientWidth,
    cell: getComputedStyle(node.querySelector("td")!).display, page: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
  expect(fit.width).toBeLessThanOrEqual(fit.box);
  expect(fit.cell).toBe("grid");
  expect(fit.page).toBe(0);
  await expect(table.getByRole("row")).toHaveCount(3);

  // Every status read fails: the page says so, with a retry, instead of "Checking…" for ever.
  await page.route(/\/api\/site-task-brief\/[^/]+\/status$/, route => route.fulfill({ status: 503, json: { error: "unavailable" } }));
  await page.reload();
  await expect(page.getByRole("alert").filter({ hasText: "We could not check where your job stands just now." })).toBeVisible({ timeout: 30_000 });
  await page.unroute(/\/api\/site-task-brief\/[^/]+\/status$/);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(applicants(page)).toContainText("2 responses", { timeout: 30_000 });
  await expect(page.getByText("We could not check where your job stands just now.")).toHaveCount(0);
  expect(missing).toEqual([]);
});

test("a depalletizing job is asked about its incoming pallets, and a weight typed in pounds reads as typed", async ({ page, request, browser }) => {
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId } = await listedJob(page, request, missing, stamp, { task: "Take each carton off the incoming pallet and put it on the conveyor." });
  const facts = page.getByRole("region", { name: "A few quick questions help companies answer" });
  await expect(facts.locator(".site-job-fact-question")).toHaveText("What are the incoming pallets like?", { timeout: 30_000 });
  await facts.getByRole("button", { name: "Same size and pattern" }).click();
  await expect(facts.locator(".site-job-fact-question")).toHaveText("How heavy is the heaviest loaded item?");
  await facts.getByRole("spinbutton", { name: "Weight" }).fill("44");
  await expect(facts.getByRole("combobox", { name: "Unit" })).toHaveValue("lb");
  const saved = page.waitForResponse(response => response.url().includes("/job-facts") && response.request().method() === "POST");
  await facts.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saved).request().postDataJSON()).toEqual({ key: "maxLoadedWeightKg", code: "44lb" });

  const company = companyFor(stamp, "Q", 21);
  await applyAndApprove(request, company);
  const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId);
  const glance = companyPage.getByRole("region", { name: "At a glance" });
  await expect(glance).toBeVisible({ timeout: 30_000 });
  await expect(glance).toContainText("44 lb (about 20 kg)");
  await expect(glance).toContainText("Same size and pattern");
  await expect(glance).not.toContainText("19.958");
  await context.close();
  expect(missing).toEqual([]);
});
