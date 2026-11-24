/**
 * Accessibility and phone width for the pieces round 1 added, as the second stress test (2026-11-24) checked them: the
 * company's estimate fields, the site's "What companies read" section and an applicant card. Same harness as the core
 * journey (`npm run test:core-journey`).
 */
import { test, expect, type Page } from "@playwright/test";
import { applyAndApprove, companyBrowser, companyFor, listedJob, autoSend, applicants, respond } from "./helpers/journey";

test.describe.configure({ timeout: 420_000 });

const sideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("at 375 px: the estimate fields name their unit and mark a refused end, and the site's page fits", async ({ page, request, browser }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const stamp = String(Date.now());
  const missing: string[] = [];
  const { requestId, jobUrl } = await listedJob(page, request, missing, stamp, {
    task: "Pick up each sealed carton from the end of the conveyor and place it on the cart beside the line, one at a time." });
  const company = companyFor(stamp, "Y", 91);
  await applyAndApprove(request, company);
  const { context, page: companyPage } = await companyBrowser(browser, company, missing, requestId, { viewport: { width: 375, height: 812 } });
  await autoSend(request);

  // The company's form at 375 px.
  await companyPage.goto(`/jobs/${requestId}`);
  const form = companyPage.getByRole("form", { name: "Your response" });
  await expect(form).toBeVisible({ timeout: 30_000 });
  await form.getByLabel("Apply", { exact: true }).check();
  await form.getByLabel("How you charge").selectOption({ label: "Per hour of work" });
  const from = form.getByLabel("From", { exact: true }), to = form.getByLabel("To", { exact: true });
  const visit = form.getByLabel("What a visit must confirm");
  // Each end names its unit and the estimate's line; the visit field its hint.
  await expect(from).toHaveAccessibleDescription(/^Estimate, in US dollars an hour Estimate before a site visit\. Not a quote\./);
  await expect(to).toHaveAccessibleDescription(/^Estimate, in US dollars an hour/);
  await expect(visit).toHaveAccessibleDescription(/^What you would need to see at the site before you commit/);
  // A comma decimal: refused, the field marked, focused and in view.
  await from.fill("0,35");
  await to.fill("");
  await form.getByRole("button", { name: "Send" }).click();
  await expect(form.getByRole("status")).toContainText("Enter the estimate in US dollars", { timeout: 10_000 });
  await expect(from).toHaveAttribute("aria-invalid", "true");
  await expect(from).toBeFocused();
  await expect(from).toBeInViewport();
  await expect(from).toHaveAccessibleDescription(/Enter the estimate in US dollars/);
  expect(await sideways(companyPage)).toBeLessThanOrEqual(0);
  await respond(companyPage, requestId, { state: "Apply", note: "We deploy carton pickers at three plants.", charge: "Per hour of work", low: "45", high: "60",
    visit: "Floor load and the cart's wheel locks" });

  // The site's page at 375 px.
  await page.goto(jobUrl);
  const read = page.getByRole("region", { name: "What companies read" });
  await expect(read).toBeVisible({ timeout: 30_000 });
  const item = applicants(page).getByRole("listitem").filter({ has: page.getByRole("heading", { name: company.name, exact: true }) });
  await expect(item).toBeVisible({ timeout: 30_000 });
  const accept = item.getByRole("button", { name: "Accept" });
  expect((await accept.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(24);
  expect(await sideways(page)).toBeLessThanOrEqual(0);
  expect(await read.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
  expect(await item.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
  await context.close();
  expect(missing).toEqual([]);
});
