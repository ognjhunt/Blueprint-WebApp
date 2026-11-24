/**
 * Privacy before Accept, end to end (2026-11-24, from a $0 stress test that found a site's words reaching companies with
 * names, phone numbers, web addresses and street numbers left in). A site types realistic identity into its sentence and
 * into its reply to a company's question. Everything the company can see before Accept is collected: its library, the
 * job page, every API response, every email queued to it, the signed-out gated page and the public live jobs. None of it
 * may name the site, a person, an address, a phone number or a web address.
 *
 * The site's own page shows exactly what companies read of its words. While the model pass over the words has not
 * succeeded (the harness's scripted pass made to fail), companies read none of them and the site is told so.
 *
 * Harness: real handlers on the Firebase emulators; the video model and the model pass over free text are scripted
 * (`scripts/qa/answer-journey-local-app.ts`): the pass points at the names planted here, as a model would.
 */
import { test, expect } from "@playwright/test";
import { applyAndApprove, companyBrowser, companyFor, listedJob, autoSend, deliverOutbox, applicants, ORIGIN,
  localOnly, respond, outboxTo } from "./helpers/journey";

test.use({ viewport: { width: 1440, height: 900 } });

const SENTENCE = "Maria will show you the line. Pick up the sealed carton from the end of the conveyor and place it on the cart "
  + "at our plant at 12 N 5th St. Questions: call 1-800-FLOWERS or see harborfresh.farm.";
const REPLY = "Joe at harbor fresh foods counts about 12 a minute; call 1-800-FLOWERS.";
const SECRETS = ["Maria", "Joe", "12 N 5th", "5th St", "1-800-FLOWERS", "FLOWERS", "harborfresh.farm", "harbor fresh"];

test("nothing a company sees before Accept names the site, a person, an address, a phone or a web address", async ({ page, request, browser }) => {
  test.setTimeout(420_000);
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, site, jobUrl } = await listedJob(page, request, missing, stamp, { task: SENTENCE });
  const company = companyFor(stamp, "P", 7);
  await applyAndApprove(request, company);
  const saw: string[] = [];
  const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId, { saw });
  await autoSend(request);

  // The site's own page: exactly what companies read of its words, and how to change them.
  await page.goto(jobUrl);
  const read = page.getByRole("region", { name: "What companies read" });
  await expect(read).toBeVisible({ timeout: 30_000 });
  await expect(read).toContainText("We take names, addresses and contact details out of your words before companies read them.");
  await expect(read).toContainText("Pick up the sealed carton from the end of the conveyor and place it on the cart");
  const siteReads = await read.innerText();

  // The library and the job page.
  await companyPage.goto("/contact/robot-team");
  const row = companyPage.locator(`li#job-${requestId}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  const libraryText = await row.innerText();
  await row.getByRole("link", { name: "View job" }).click();
  const theJob = companyPage.getByRole("region", { name: "The job" });
  await expect(theJob).toBeVisible({ timeout: 30_000 });
  const companySentence = (await theJob.locator("blockquote").innerText()).trim();
  // The site's page showed the very words the company reads.
  expect(siteReads).toContain(companySentence);
  const jobText = await companyPage.locator("body").innerText();

  // The company asks; the site replies with identity in it; both read the reply as the company reads it.
  await respond(companyPage, requestId, { state: "Need more details", note: "How many cartons a minute, and who do we ask?" });
  await page.goto(jobUrl);
  const item = applicants(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: company.name, exact: true }) });
  await item.getByText("Reply", { exact: true }).click();
  await item.getByLabel("Your reply").fill(REPLY);
  await item.getByRole("button", { name: "Send reply" }).click();
  await expect(item.getByText(/Your reply/)).toBeVisible();
  await expect(item).toContainText(`This is your reply as ${company.name} reads it, with names and contact details taken out.`);
  const siteSawReply = await item.innerText();
  await companyPage.reload();
  const answerRegion = companyPage.getByRole("region", { name: "Answer from the site" });
  await expect(answerRegion).toBeVisible({ timeout: 30_000 });
  const replyText = await answerRegion.innerText();
  const companyReply = replyText.split("Answer from the site").pop()!.trim();
  expect(companyReply).toContain("counts about 12 a minute");
  expect(siteSawReply).toContain(companyReply);

  // Read before delivery: a sent row's details are cleared.
  const toCompany = await outboxTo(request, company.email.toLowerCase());
  await deliverOutbox(request);

  // Signed out: the gated page and the public list.
  const anon = await browser.newContext();
  await localOnly(anon, missing);
  const anonPage = await anon.newPage();
  await anonPage.goto(`/jobs/${requestId}`);
  await expect(anonPage.getByRole("heading", { name: "Apply to see this job" })).toBeVisible();
  const gateText = await anonPage.locator("body").innerText();
  const publicJobs = await (await anonPage.request.get(`${ORIGIN}/api/public/live-jobs`)).text();
  await anonPage.goto("/jobs");
  const jobsPageText = await anonPage.locator("body").innerText();

  const surfaces: Record<string, string> = { library: libraryText, jobPage: jobText, reply: replyText, gate: gateText,
    publicJobs, jobsPage: jobsPageText, apiResponses: saw.join("\n"),
    emails: toCompany.map(rowItem => `${rowItem.kind}: ${rowItem.subject}\n${rowItem.body}`).join("\n---\n") };
  const secrets = [...SECRETS, site.email, site.address, "Quillfeather"];
  const leaks: string[] = [];
  for (const [where, text] of Object.entries(surfaces)) for (const secret of secrets)
    if (text.toLowerCase().includes(secret.toLowerCase())) leaks.push(`${where}: ${secret}`);
  // What the site reads of its own words leaks nothing either.
  for (const secret of SECRETS) if (`${siteReads}\n${companyReply}`.toLowerCase().includes(secret.toLowerCase())) leaks.push(`site's view: ${secret}`);
  await anon.close();
  await context.close();
  expect(missing).toEqual([]);
  expect(leaks).toEqual([]);
});

test("while the model pass over a site's words has not succeeded, companies read none of them and the site is told", async ({ page, request, browser }) => {
  test.setTimeout(300_000);
  const stamp = String(Date.now());
  const missing: string[] = [];
  const refuse = async (calls: number) => expect((await request.post(`${ORIGIN}/api/reliability/redactor-fails?calls=${calls}`)).ok()).toBe(true);
  await refuse(50);
  try {
    const { requestId, jobUrl } = await listedJob(page, request, missing, stamp, {
      task: "Pick up the sealed carton from the end of the conveyor and place it on the cart for Maria." });
    const company = companyFor(stamp, "Q", 8);
    await applyAndApprove(request, company);
    const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId);
    await autoSend(request);
    await page.goto(jobUrl);
    const read = page.getByRole("region", { name: "What companies read" });
    await expect(read).toContainText("Companies do not see these words yet.", { timeout: 30_000 });
    await companyPage.goto(`/jobs/${requestId}`);
    const theJob = companyPage.getByRole("region", { name: "The job" });
    await expect(theJob).toBeVisible({ timeout: 30_000 });
    // The rest of the job is there; the site's words are not.
    await expect(theJob).toContainText("The site's description can't be shown right now.");
    await expect(companyPage.locator("body")).not.toContainText("sealed carton from the end of the conveyor");
    await expect(companyPage.locator("body")).not.toContainText("Maria");
    await context.close();
  } finally {
    await refuse(0);
  }
  expect(missing).toEqual([]);
});
