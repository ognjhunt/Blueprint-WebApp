import { expect, test } from "@playwright/test";

const preferences = (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(localStorage.getItem("blueprint_cookie_consent") || "null"));

test.beforeEach(async ({ page }) => {
  // Every opt-in remains local, including tests that exercise Accept all.
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    if (url.pathname === "/api/analytics/ingest") return route.fulfill({ contentType: "application/json", body: "{}" });
    if (url.pathname === "/api/csrf") return route.fulfill({ contentType: "application/json", body: '{"csrfToken":"test-token"}' });
    return route.continue();
  });
});


test("cookie banner matches the public theme and rejects optional cookies", async ({ page }) => {
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Cookie preferences" });
  await expect(banner).toBeVisible();
  await expect(banner).toHaveCSS("background-color", "rgb(246, 245, 239)");
  await expect(banner.getByRole("button", { name: "Accept all", exact: true })).toHaveCSS("background-color", "rgb(32, 61, 46)");
  await banner.getByRole("button", { name: "Reject all", exact: true }).click();
  expect(await preferences(page)).toMatchObject({ analytics: false, marketing: false, necessary: true });
  await page.reload();
  await expect(banner).toHaveCount(0);
});

test("custom preferences are keyboard accessible and persist on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Cookie preferences" });
  await banner.getByRole("button", { name: "Customize", exact: true }).click();
  await expect(banner.getByRole("button", { name: "Hide details", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(banner.getByRole("checkbox", { name: /^Necessary/ })).toBeDisabled();
  await banner.getByRole("checkbox", { name: /^Analytics/ }).uncheck();
  await banner.getByRole("checkbox", { name: /^Marketing/ }).check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await banner.getByRole("button", { name: "Save preferences", exact: true }).click();
  expect(await preferences(page)).toMatchObject({ analytics: false, marketing: true, necessary: true });
});

test("accept all and close preserve their explicit consent outcomes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Accept all", exact: true }).click();
  expect(await preferences(page)).toMatchObject({ analytics: true, marketing: true, necessary: true });
  await page.evaluate(() => localStorage.removeItem("blueprint_cookie_consent"));
  await page.reload();
  await page.getByRole("button", { name: "Reject optional cookies and close", exact: true }).click();
  expect(await preferences(page)).toMatchObject({ analytics: false, marketing: false, necessary: true });
});

test("optional analytics stays off before a choice, after rejection, and after withdrawal", async ({ page }) => {
  const requests: string[] = [];
  const optionalAnalytics = /\/api\/analytics\/ingest|googletagmanager\.com|google-analytics\.com|posthog\.com/;
  page.on("request", (request) => { if (optionalAnalytics.test(request.url())) requests.push(request.url()); });
  await page.goto("/");
  const banner = page.getByRole("region", { name: "Cookie preferences" });
  await expect(banner).toBeVisible();
  await page.waitForTimeout(2800);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("bp.analytics.anonymousId"))).toBeNull();
  await banner.getByRole("button", { name: "Reject all", exact: true }).click();
  await page.goto("/privacy");
  await page.waitForTimeout(2800);
  expect(requests).toEqual([]);

  await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
  await banner.getByRole("checkbox", { name: /^Analytics/ }).check();
  await banner.getByRole("button", { name: "Save preferences", exact: true }).click();
  await page.goto("/how-it-works");
  await expect.poll(() => requests.length).toBeGreaterThan(0);
  await page.waitForTimeout(2800);
  await page.getByRole("button", { name: "Cookie settings", exact: true }).click();
  await banner.getByRole("button", { name: "Reject all", exact: true }).click();
  requests.length = 0;
  await page.goto("/privacy");
  await page.waitForTimeout(2800);
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("bp.analytics.anonymousId"))).toBeNull();
});
