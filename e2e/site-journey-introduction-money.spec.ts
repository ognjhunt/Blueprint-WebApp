/**
 * The money record of an introduction, end to end (2026-11-24, from a $0 stress test). Three Accept presses at once for
 * one company record one billable event; Accept from a page loaded before the company changed its answer to Not a fit
 * records none; and a company that answers Not a fit after the site pressed Accept, before its introduction email went,
 * is not introduced: the introduction is cancelled, its billable event void, and the company receives no email with the
 * site's details.
 *
 * Harness: real handlers on the Firebase emulators, a scripted video model, an outbox that never reaches a mail provider
 * (`scripts/qa/answer-journey-local-app.ts`).
 */
import { test, expect } from "@playwright/test";
import { applyAndApprove, companyBrowser, companyFor, listedJob, autoSend, ORIGIN, applicants, csrf, deliverOutbox, jobRecord,
  companyIdOf, outbox, respond, signIn } from "./helpers/journey";
import { INTRODUCTION_REQUEST_STATEMENT_VERSION } from "../client/src/lib/siteIntroductions";
import { COMPANY_RESPONSE_STATEMENT_VERSION } from "../client/src/lib/companyResponses";

test.use({ viewport: { width: 1440, height: 900 } });

test("concurrent Accepts, a stale Accept, and Not a fit after Accept: one event, none, and a void one", async ({ page, request, browser }) => {
  test.setTimeout(420_000);
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, token, jobUrl } = await listedJob(page, request, missing, stamp);
  const [m, n, o] = ["M", "N", "O"].map((letter, index) => companyFor(stamp, letter, 41 + index));
  const browsers = [];
  for (const company of [m, n, o]) { await applyAndApprove(request, company); browsers.push(await companyBrowser(browser, company, missing, requestId)); }
  await autoSend(request);
  for (const [index, item] of browsers.entries())
    await respond(item.page, requestId, { state: "Apply", note: "", charge: "Monthly subscription", low: String(4000 + index * 1000), high: String(6000 + index * 1000) });
  const tokens = await Promise.all([m, n, o].map(company => signIn(request, company.email, company.password)));
  const answer = async (index: number, state: string, inputs: string) => request.post(`${ORIGIN}/api/site-worlds/tasks/${requestId}/interest`, {
    headers: { ...await csrf(request), Authorization: `Bearer ${tokens[index]}` }, data: { state, inputs, statementVersion: COMPANY_RESPONSE_STATEMENT_VERSION } });
  let record = await jobRecord(request, requestId);
  const billableFor = (email: string) => record.billable.filter(row => row.companyId === companyIdOf(email));

  // 1. Three presses at once for Company A (M): one event.
  const headers = await csrf(page.request);
  const presses = await Promise.all([0, 1, 2].map(() => page.request.post(`${ORIGIN}/api/site-task-brief/${encodeURIComponent(token)}/introductions`,
    { headers, data: { alias: "A", statementVersion: INTRODUCTION_REQUEST_STATEMENT_VERSION } })));
  expect(presses.filter(press => press.status() === 200)).toHaveLength(1);
  await deliverOutbox(request);
  record = await jobRecord(request, requestId);
  expect(billableFor(m.email).filter(row => row.status !== "void")).toHaveLength(1);

  // 2. The site's page is loaded; Company B (N) then answers Not a fit; the site presses Accept on the stale page: none.
  await page.goto(jobUrl);
  const itemN = applicants(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: n.name, exact: true }) });
  await expect(itemN.getByRole("button", { name: "Accept" })).toBeVisible({ timeout: 30_000 });
  expect((await answer(1, "declined", "We no longer have capacity.")).status()).toBe(200);
  await itemN.getByRole("button", { name: "Accept" }).click();
  await expect(itemN.getByRole("alert")).toContainText("This company has not applied, so you cannot accept it.");
  record = await jobRecord(request, requestId);
  expect(billableFor(n.email)).toEqual([]);

  // 3. The site presses Accept for Company C (O); before the email goes, O answers Not a fit: cancelled and void.
  await page.reload();
  const itemO = applicants(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: o.name, exact: true }) });
  await itemO.getByRole("button", { name: "Accept" }).click();
  await expect(itemO.getByRole("status")).toContainText(/We are emailing you/);
  expect((await answer(2, "declined", "Changed our mind.")).status()).toBe(200);
  const sent = await deliverOutbox(request);
  record = await jobRecord(request, requestId);
  expect(billableFor(o.email)).toEqual([expect.objectContaining({ status: "void", voidReason: "company_answer_changed" })]);
  // No email with the site's details reached O, and the site got no "Meet" email for it.
  expect(sent.filter(mail => mail.to.includes(o.email.toLowerCase()))).toEqual([]);
  const rows = await outbox(request, requestId);
  for (const row of rows.filter(item => item.kind.startsWith("introduction_made") && item.idempotencyKey.includes(companyIdOf(o.email))))
    expect(row.status, row.kind).toBe("cancelled");
  await page.reload();
  await expect(itemO).toContainText("This could not go ahead. We did not give them your details.");
  for (const item of browsers) await item.context.close();
  expect(missing).toEqual([]);
});
