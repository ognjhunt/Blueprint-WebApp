/**
 * A deployment company's own words as the site reads them before Accept, end to end (2026-11-24, from a $0 stress
 * test). A company types its own email, phone number, contact name and first name into its note, "What a visit must
 * confirm" and its question; its form says the site reads the words with its company's name, people's names and contact
 * details taken out, and its line says the site gets its contact details only when the site accepts. Everything the site
 * sees before Accept (its page, the status API, every API response, its emails) is swept.
 *
 * Harness: real handlers on the Firebase emulators; the video model and the model pass over free text are scripted
 * (`scripts/qa/answer-journey-local-app.ts`).
 */
import { test, expect } from "@playwright/test";
import { applyAndApprove, companyBrowser, companyFor, listedJob, autoSend, applicants, respond, ORIGIN, outbox } from "./helpers/journey";

test.use({ viewport: { width: 1440, height: 900 } });

test("a company's own email, phone, contact name and first name stay off the site's page and emails until Accept", async ({ page, request, browser }) => {
  test.setTimeout(300_000);
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, jobUrl, token } = await listedJob(page, request, missing, stamp);
  const company = companyFor(stamp, "H", 71);
  await applyAndApprove(request, company);
  const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId);
  await autoSend(request);
  const first = company.contact.split(" ")[0];
  const last = company.contact.split(" ")[1];
  await respond(companyPage, requestId, { state: "Apply",
    note: `We do this daily. Email ${company.email} or call +1 415 555 0101, ask for ${company.contact}. Our engineer Dana Whitfield helps. — ${first}`,
    visit: `Floor load; ${first} will bring the cell drawings, text 415-555-0101`,
    question: `Can Mr. ${last} visit on Tuesday? Reply to casey at journey-h dot example` });
  await expect(companyPage.getByRole("form", { name: "Your response" }))
    .toContainText("The site reads these words, with your company's name, people's names and contact details taken out.");
  const siteSaw: string[] = [];
  page.on("response", async response => { if (new URL(response.url()).pathname.startsWith("/api/")) siteSaw.push(await response.text().catch(() => "")); });
  await page.goto(jobUrl);
  const item = applicants(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: company.name, exact: true }) });
  await expect(item).toBeVisible({ timeout: 30_000 });
  // The words reach the site, with the company's people and contact details out of them.
  await expect(item).toContainText("We do this daily.", { timeout: 30_000 });
  await expect(item).toContainText("visit on Tuesday");
  const shown = await item.innerText();
  const status = await (await page.request.get(`${ORIGIN}/api/site-task-brief/${encodeURIComponent(token)}/status`)).text();
  const emails = (await outbox(request, requestId)).filter(row => !row.to.includes("journey-co-")).map(row => `${row.subject}\n${row.body}`).join("\n---\n");
  const secrets = [company.email, "415 555 0101", "415-555-0101", company.contact, first, last, "Dana", "Whitfield", "journey-h dot example"];
  const leaks: string[] = [];
  for (const [where, text] of Object.entries({ page: shown, status, emails, responses: siteSaw.join("\n") }))
    for (const secret of secrets) if (text.includes(secret)) leaks.push(`${where}: ${secret}`);
  await context.close();
  expect(missing).toEqual([]);
  expect(leaks).toEqual([]);
});
