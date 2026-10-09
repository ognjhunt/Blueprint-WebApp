import { test, expect } from "@playwright/test";
for (const width of [1440, 390]) {
  test(`saved site job leads directly to account setup at ${width}px`, async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width, height: 1000 });
    const mutations: string[] = [], errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.addInitScript(() => localStorage.setItem("blueprint_cookie_consent", JSON.stringify({ necessary: true, analytics: false, marketing: false })));
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      const send = (json: unknown, status = 200) => route.fulfill({ json, status });
      if (url.origin !== new URL(baseURL!).origin) return send({});
      if (url.pathname === "/api/analytics/ingest") return send({ ok: true });
      if (request.method() !== "GET" && request.method() !== "HEAD") {
        mutations.push(url.pathname);
        if (url.pathname === "/api/inbound-request") return send({ ok: true, requestId: request.postDataJSON().requestId, captureUrl: "/capture-upload/fixture.capture", claimUrl: "/claim/fixture.claim" }, 201);
        return send({ error: "Unexpected QA mutation" }, 409);
      }
      if (url.pathname === "/api/csrf") return send({ csrfToken: "synthetic-csrf" });
      if (url.pathname === "/api/site-claim/fixture.claim") return send({ ok: true, requestId: "fixture-job", alreadyClaimed: false, claimEmail: "qa@example.invalid", siteTermsAcceptedCurrent: true, accountDefaults: { name: "Site operator", organization: "Synthetic QA site" }, site: { siteName: "Synthetic QA site", siteLocation: "Austin, TX", taskStatement: "Pack cartons", qualificationState: "submitted" } });
      if (url.pathname.startsWith("/api/")) return send({ ok: true, captureReceived: false, state: "held", items: [], questions: [] });
      return route.continue();
    });
    await page.goto("/signup/business?buyerType=site_operator");
    await expect(page).toHaveURL(/\/contact\/site-operator$/);
    await page.locator("#start-task").fill("Pack cartons");
    await page.locator("#start-location").fill("Austin, TX");
    await page.locator("#start-email").fill("qa@example.invalid");
    await page.locator("#start-company").fill("Synthetic QA site");
    await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
    const signup = page.getByRole("link", { name: "Create an account for this job", exact: true });
    await expect(signup).toBeVisible();
    await expect(page.getByRole("link", { name: "Sign in to save this job" })).toHaveAttribute("href", "/claim/fixture.claim?mode=signin");
    expect(mutations).toEqual(["/api/inbound-request"]);
    await signup.click();
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
