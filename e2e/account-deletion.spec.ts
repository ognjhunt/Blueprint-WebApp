import { test, expect, type Page } from "@playwright/test";
import { mockExternalFonts } from "./helpers/static-assets";

test.skip(process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== "1", "Uses DEV-only fake auth and local API fixtures; never a real account.");
test.beforeEach(mockExternalFonts);

async function privacyFixture(page: Page) {
  const state = {
    request: null as null | { id: string; status: string; requestedAtIso: string; updatedAtIso: string; message: string },
    failSubmit: false,
    posts: [] as unknown[],
    workspaceRequests: [] as string[],
    unexpected: [] as string[],
  };
  await page.addInitScript(() => {
    localStorage.removeItem("blueprint_workspace_qa_role");
    localStorage.setItem("blueprint_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false }));
  });
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    // Every remote request is blocked; this spec cannot call Firebase/providers.
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname.startsWith("/api/workspace")) state.workspaceRequests.push(url.pathname);
    if (url.pathname === "/api/csrf") return route.fulfill({ json: { csrfToken: "privacy-fixture-csrf" } });
    if (url.pathname === "/api/account-deletion") {
      if (request.method() === "POST") {
        expect(request.headers()["authorization"]).toBe("Bearer operator-qa-local-token");
        expect(request.headers()["x-csrf-token"]).toBe("privacy-fixture-csrf");
        state.posts.push(request.postDataJSON());
        if (state.failSubmit) return route.fulfill({ status: 503, json: { error: "Privacy requests are temporarily unavailable. Please try again." } });
        state.request ||= { id: `deletion_${"a".repeat(64)}`, status: "requested", requestedAtIso: "2026-10-19T12:00:00.000Z",
          updatedAtIso: "2026-10-19T12:00:00.000Z", message: "Your request is recorded for privacy review. Your account remains active until we process it. This receipt does not confirm deletion." };
        return route.fulfill({ status: 202, json: { request: state.request, created: true } });
      }
      return route.fulfill({ json: { request: state.request } });
    }
    state.unexpected.push(`${request.method()} ${url.pathname}`);
    return route.fulfill({ status: 404, json: { error: "Unexpected local fixture request" } });
  });
  return state;
}

test("deletion request works before workspace setup and restores its receipt and review status", async ({ page }, info) => {
  const state = await privacyFixture(page);
  await page.goto("/settings?privacy=1");
  await expect(page.getByRole("heading", { name: "Delete my account and data" })).toBeVisible();
  const submit = page.getByRole("button", { name: "Request account and data deletion" });
  await expect(submit).toBeDisabled();
  await page.getByLabel("Type DELETE to confirm the request").fill("DELETE");
  await submit.click();
  await expect(page.getByRole("heading", { name: "Deletion requested", exact: true })).toBeVisible();
  await expect(page.getByText(/This receipt does not confirm deletion/)).toBeVisible();
  expect(state.posts).toEqual([{ confirmation: "DELETE" }]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Deletion requested", exact: true })).toBeVisible();
  state.request!.status = "in_review";
  await page.getByRole("button", { name: "Refresh status" }).click();
  await expect(page.getByRole("heading", { name: "Request under review", exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("account-deletion-review.png"), fullPage: true });
  expect(state.workspaceRequests).toEqual([]); expect(state.unexpected).toEqual([]);
});

test("failed request preserves confirmation and allows a safe retry without a false success", async ({ page }) => {
  const state = await privacyFixture(page); state.failSubmit = true;
  await page.goto("/settings?privacy=1");
  await page.getByLabel("Type DELETE to confirm the request").fill("DELETE");
  await page.getByRole("button", { name: "Request account and data deletion" }).click();
  await expect(page.getByRole("alert")).toContainText("Privacy requests are temporarily unavailable");
  await expect(page.getByRole("heading", { name: "Deletion requested", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Type DELETE to confirm the request")).toHaveValue("DELETE");
  state.failSubmit = false;
  await page.getByRole("button", { name: "Request account and data deletion" }).click();
  await expect(page.getByRole("heading", { name: "Deletion requested", exact: true })).toBeVisible();
  expect(state.posts).toHaveLength(2); expect(state.unexpected).toEqual([]);
});

test("account privacy request is usable on a phone without horizontal overflow", async ({ page }, info) => {
  await privacyFixture(page); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings?privacy=1");
  await expect(page.getByRole("heading", { name: "Delete my account and data" })).toBeVisible();
  await page.getByLabel("Type DELETE to confirm the request").fill("DELETE");
  await page.getByRole("button", { name: "Request account and data deletion" }).click();
  await expect(page.getByRole("heading", { name: "Deletion requested", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("account-deletion-mobile.png"), fullPage: true });
});
