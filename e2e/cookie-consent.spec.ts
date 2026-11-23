import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Every request stays local.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    if (url.pathname === "/api/csrf") return route.fulfill({ contentType: "application/json", body: '{"csrfToken":"test-token"}' });
    return route.continue();
  });
});

test("no cookie banner on a first visit, and cookie settings say only essential storage is used", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  const panel = page.getByRole("region", { name: "Cookie preferences" });
  await page.waitForTimeout(2800);
  await expect(panel).toHaveCount(0);

  await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
  await expect(panel).toBeVisible();
  await expect(panel).toHaveCSS("background-color", "rgb(246, 245, 239)");
  await expect(panel).toContainText("only essential cookies and browser storage");
  await expect(panel.getByRole("checkbox")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.getByRole("button", { name: "Close cookie settings", exact: true }).click();
  await expect(panel).toHaveCount(0);

  await page.goto("/privacy");
  await page.getByRole("button", { name: "open cookie settings", exact: true }).click();
  await expect(panel).toBeVisible();
});

test("no analytics request is made", async ({ page }) => {
  const requests: string[] = [];
  const optionalAnalytics = /\/api\/analytics\/ingest|googletagmanager\.com|google-analytics\.com|posthog\.com/;
  page.on("request", (request) => { if (optionalAnalytics.test(request.url())) requests.push(request.url()); });
  await page.goto("/");
  await page.waitForTimeout(2800);
  await page.goto("/privacy");
  await page.waitForTimeout(2800);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("bp.analytics.anonymousId"))).toBeNull();
});
