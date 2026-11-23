import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: {} });
    return route.continue();
  });
});

// Refunds left the product copy (launch copy, 2026-11-20): the cost row says only "Free for sites.". The page itself left
// with Terms 2026-11-21.1 (owner, 2026-11-21: no outside customer ever bought a pre-beta balance); its address lands on
// the Terms, which hold no refund clause.
test("the cost row links no refunds, and the old refunds address lands on the Terms on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/beta");
  const cost = page.locator("#scope");
  await expect(cost).toContainText("Free for sites.");
  await expect(cost.getByRole("link", { name: /Refunds/ })).toHaveCount(0);
  await page.goto("/refunds");
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { name: "Terms of Service", exact: true, level: 1 })).toBeVisible();
  await expect(page.locator("article")).not.toContainText(/refund|unused balance/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("privacy page offers deletion and shows optional analytics off until permission", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("link", { name: "account deletion in Settings" })).toHaveAttribute("href", "/settings?privacy=1");
  await expect(page.getByText(/stay off until you allow the corresponding category/)).toBeVisible();
  await expect(page.getByRole("link", { name: "previous version", exact: true })).toHaveAttribute("href", "/privacy/previous");
  await expect(page.getByRole("link", { name: "Refunds", exact: true })).toHaveCount(0);
});

// Privacy 2026-11-23.1 (owner, 2026-11-23: "yes to the privacy wording"): the Location row names the city, state and
// country a company sees. Since 2026-11-23.2 the 2026-11-23.1 text is the previous version, and says the same.
test("privacy page says a company sees the city, state and country, as the previous version does", async ({ page }) => {
  await page.goto("/privacy");
  const article = page.locator("article");
  await expect(article).toContainText("Effective November 23, 2026");
  await expect(article).toContainText("A deployment company sees the city, state and country of the job, not the address you typed.");
  await expect(article).not.toContainText("A deployment company sees the country of the job, not the address you typed.");
  await page.getByRole("link", { name: "previous version", exact: true }).click();
  await expect(page).toHaveURL(/\/privacy\/previous$/);
  await expect(article).toContainText("Previous version, effective November 23, 2026");
  await expect(article).toContainText("A deployment company sees the city, state and country of the job, not the address you typed.");
});

// Terms and Privacy 2026-11-23.2 (owner, 2026-11-23: "yes, update both"): a company applies, and a site sees its name
// and website with each answer and accepts the companies it wants to meet; an answer given before November 23, 2026
// stays under an alias. The previous Privacy Policy (2026-11-23.1) keeps the alias sentence. Since Terms 2026-11-23.3 the
// previous Terms are 2026-11-23.2, which say the same as the current Terms.
test("the Terms and Privacy Policy say a site sees a company's name and website and accepts it; the previous Privacy Policy keeps the alias", async ({ page }) => {
  const APPLICATION = "A site sees your company's name and website with each answer you give and the reason you give, with your contact details taken out. It gets your contact details only when it accepts your application, after you applied or answered Tested it: can do. Answers you gave before November 23, 2026 stay under an alias.";
  const ALIAS = "A site sees your answer and the reason you give, under an alias, with your company's name and contact details taken out.";
  const article = page.locator("article");
  await page.goto("/privacy");
  await expect(article).toContainText(APPLICATION);
  await expect(article).toContainText("When a site accepts your application, we give you the site's name, address and contact details.");
  await expect(article).not.toContainText(ALIAS);
  await page.goto("/privacy/previous");
  await expect(article).toContainText(ALIAS);
  await expect(article).not.toContainText(APPLICATION);
  await page.goto("/terms");
  await expect(article).toContainText("Effective November 23, 2026");
  await expect(article).toContainText(APPLICATION);
  await expect(article).toContainText("An approved deployment company can answer Apply, Not a fit or Need more details.");
  await expect(article).not.toContainText(/Interested|Introduce us/);
  await page.goto("/terms/previous");
  await expect(article).toContainText("Previous version, effective November 23, 2026");
  await expect(article).toContainText(APPLICATION);
  await expect(article).not.toContainText(ALIAS);
});

// Terms 2026-11-23.3 (owner, 2026-11-23: "yes build it this way"): a company may give an estimate with its answer. The
// Terms say, for sites and for companies, that it is an estimate before a site visit and not a quote; the previous Terms
// (2026-11-23.2) say nothing of it, and the Privacy Policy does not change.
test("the Terms say a company's estimate is its own, before a site visit and not a quote; the previous Terms and the Privacy Policy do not", async ({ page }) => {
  const SITE = "An estimate a deployment company gives with its answer is its own, given before a site visit. It is not a quote, and Blueprint does not check or guarantee it.";
  const COMPANY = "If you give an estimate with your answer, the site sees it as an estimate before a site visit, not a quote.";
  const article = page.locator("article");
  await page.goto("/terms");
  await expect(article).toContainText("Effective November 23, 2026");
  await expect(article).toContainText(SITE);
  await expect(article).toContainText(COMPANY);
  await expect(article).toContainText("This version replaced the previous version (effective November 23, 2026).");
  await page.getByRole("link", { name: "previous version", exact: true }).click();
  await expect(page).toHaveURL(/\/terms\/previous$/);
  await expect(article).toContainText("Previous version, effective November 23, 2026");
  await expect(article).not.toContainText("not a quote");
  await page.goto("/privacy");
  await expect(article).toContainText("Effective November 23, 2026");
  await expect(article).not.toContainText("not a quote");
});
