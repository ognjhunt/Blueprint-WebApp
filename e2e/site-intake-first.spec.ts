import { test, expect } from "@playwright/test";
for (const width of [1440, 390]) {
  test(`saved site job offers optional account setup at ${width}px`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const mutations: string[] = [], errors: string[] = [], intakeBodies: Record<string, unknown>[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.addInitScript(() => localStorage.setItem("blueprint_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false })));
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      const send = (json: unknown, status = 200) => route.fulfill({ json, status });
      if (url.origin !== new URL(baseURL!).origin) return send({});
      if (url.pathname === "/api/analytics/ingest") return send({ ok: true });
      if (request.method() !== "GET" && request.method() !== "HEAD") {
        mutations.push(url.pathname);
        if (url.pathname === "/api/inbound-request") {
          const body = request.postDataJSON();
          intakeBodies.push(body);
          return send({ ok: true, requestId: body.requestId, captureUrl: "/capture-upload/fixture.capture", claimUrl: "/claim/fixture.claim" }, 201);
        }
        return send({ error: "Unexpected QA mutation" }, 409);
      }
      if (url.pathname === "/api/csrf") return send({ csrfToken: "synthetic-csrf" });
      if (url.pathname === "/api/site-claim/fixture.claim") return send({ ok: true, requestId: "fixture-job", alreadyClaimed: false, claimEmail: "qa@example.invalid", siteTermsAcceptedCurrent: true, accountDefaults: { name: "Site operator", organization: "Synthetic QA site" }, site: { siteName: "Synthetic QA site", siteLocation: "Austin, TX", taskStatement: "Pack cartons", qualificationState: "submitted" } });
      if (url.pathname.startsWith("/api/")) return send({ ok: true, captureReceived: false, state: "held", items: [], questions: [] });
      return route.continue();
    });
    await page.goto("/signup/business?buyerType=site_operator");
    await expect(page).toHaveURL(/\/contact\/site-operator$/);
    // The country is asked for only when needed: pressing the button with no address asks for it.
    await page.locator("#start-email").fill("qa@example.invalid");
    await page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ }).click();
    await page.locator("#start-region").selectOption("us");
    await expect(page.locator("#start-location")).not.toHaveAttribute("required", "");
    await expect(page.locator("#start-location")).toHaveValue("");
    await page.locator("#start-email").fill("qa@example.invalid");
    // The optional sentence confirms the brief at submission (owner direction 2026-11-11).
    if (!await page.locator("#start-task").isVisible()) await page.getByText("Add details (optional)", { exact: true }).click(); await page.locator("#start-task").fill("Pack cartons");
    await expect(page.locator("#start-company")).toHaveCount(0);
    await expect(page.locator("#start-password")).toHaveCount(0);
    await page.getByRole("button", { name: /^(Send video|Next: film the job|Save my job)$/ }).click();
    // An account stays optional: one quiet link after the job is saved (bare bones, 2026-11-11).
    const optionalAccount = page.getByRole("link", { name: "Save to an account ›", exact: true });
    await expect(optionalAccount).toBeVisible();
    expect(mutations).toEqual(["/api/inbound-request"]);
    expect(intakeBodies).toEqual([expect.objectContaining({ siteName: "", siteLocation: "", captureRegion: "us", accountSignup: false,
      taskStatement: "Pack cartons", taskConfirmation: { granted: true, statementVersion: "2026-11-07.v1" } })]);
    await expect(optionalAccount).toHaveAttribute("href", "/claim/fixture.claim");
    expect(mutations).toEqual(["/api/inbound-request"]);
    await optionalAccount.click();
    await expect(page.getByRole("heading", { name: "Keep track of Synthetic QA site.", exact: true })).toBeVisible();
    await expect(page.getByLabel("Work email")).toHaveValue("qa@example.invalid");
    await expect(page.getByLabel("Work email")).toHaveAttribute("readonly", "");
    await expect(page.locator("#claim-password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByText(/Set up your workspace|Await approval|Request an invitation/)).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
