import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("blueprint-consent", JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: Date.now() })));
  await page.route("**/api/csrf", route => route.fulfill({ json: { csrfToken: "e2e-safe-token" } }));
  await page.route("https://photon.komoot.io/**", route => route.fulfill({ json: { features: [] } }));
  await page.route("**/api/site-worlds/tasks", route => route.fulfill({ json: { items: [] } }));
});

test("phone: the first task field is on the first screen and the explanation stays closed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contact/site-operator");
  const field = page.locator("#start-task");
  await expect(field).toBeVisible();
  const box = await field.boundingBox();
  expect(box!.y + box!.height).toBeLessThan(844);
  await expect(page.locator("details").filter({ hasText: "How this works" })).not.toHaveAttribute("open");
  await expect(page.locator("#gate-sceneStability")).toHaveCount(0);
  await page.screenshot({ path: "/tmp/onboarding-p2-site-phone.png", fullPage: true });
});

test("capture keeps country and consent explicit without a duplicate screening interview", async ({ page }) => {
  const submissions: any[] = [];
  await page.route("**/api/inbound-request", route => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ status: 202, json: { ok: true, requestId: "captured", captureUrl: null } });
  });
  await page.goto("/contact/site-operator");
  await page.locator("#start-task").fill("Move cartons onto a pallet");
  await page.locator("#start-location").fill("Berlin");
  await page.locator("#start-email").fill("owner@example.test");
  await expect(page.locator("#start-region")).toHaveValue("");
  await page.locator("#start-region").selectOption("non_us");
  await page.locator("#start-rights").check();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect.poll(() => submissions.length).toBe(1);
  expect(submissions[0]).toMatchObject({ buyerType: "site_operator", captureRegion: "non_us", siteTaskGates: {}, consentAttestation: { granted: true, statementVersion: "2026-09-18.v1" } });
  await expect(page.getByText(/We are not sending a camera link yet/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the camera" })).toHaveCount(0);
});

test("robot teams reach the library without an application", async ({ page }) => {
  await page.goto("/contact/robot-team");
  await expect(page.getByRole("region", { name: "Task library" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send application" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Operate a site/ })).toBeVisible();
});

test("the retired duplicate intake joins the capture flow and preserves context", async ({ page }) => {
  await page.goto("/app/tasks/new?source=workspace");
  await expect(page).toHaveURL(/\/contact\/site-operator\?source=workspace/);
  await expect(page.locator("#start-task")).toBeVisible();
});
