import { expect, test } from "@playwright/test";

test.skip(process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== "1", "Requires isolated fixture identity");

for (const width of [390, 1440]) {
  test(`invited site return, correction, retry and pilot booking at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const unexpected: string[] = [];
    const posts: { path: string; body: Record<string, unknown> }[] = [];
    let confirmed = false;
    let received = false;
    let retried = false;
    let recommended = false;
    let booked = false;
    let withdrawn = false;
    let pilotIntent = { pilotConsideration: "subject_to_review", deploymentPath: "multiple_sites" };
    const recommendation = { id: "synthetic-rec-1", teamName: "Synthetic willing team", purpose: "Measure carton transfer against site targets",
      siteProvides: "Named task owner and agreed trial window", teamProvides: "Robot, operator and reset protocol",
      pilotCost: "Fixture proposal only", window: "Subject to both owners confirming", uncertainties: "Physical cycle time remains unmeasured" };

    // Every non-loopback request is blocked. Every API request must be named below.
    await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue() : route.fulfill({ status: 204, body: "" }));
    await page.route("**/api/**", async route => {
      const url = new URL(route.request().url());
      // This newer route takes precedence over the catch-all, including external
      // geocoding paths containing /api/. Block those here as well.
      if (url.hostname !== "127.0.0.1") return route.fulfill({ status: 204, body: "" });
      const path = url.pathname;
      const post = route.request().method() === "POST";
      const body = post ? route.request().postDataJSON() : null;
      if (post) posts.push({ path, body });
      if (path === "/api/csrf") return route.fulfill({ json: { csrfToken: "synthetic" } });
      if (path === "/api/analytics/ingest") return route.fulfill({ status: 204, body: "" });
      if (path === "/api/workspace/setup") return route.fulfill({ json: { workspaceType: "robot_team" } });
      if (path === "/api/inbound-request" && post) {
        expect(body).toMatchObject({ descriptionOnly: true, consentAttestation: null, accountSignup: false, taskDescription: "Move sealed cartons from conveyor to pallet." });
        return route.fulfill({ json: { ok: true, captureUrl: "/capture-upload/synthetic-owner" } });
      }
      if (path === "/api/self-capture/uploads/synthetic-owner/status") return route.fulfill({ json: {
        ok: true, state: received && !withdrawn ? "ready" : "held", holdReason: "recording_consent_required",
        detail: withdrawn ? "Recording permission was withdrawn; processing is held." : "Confirm recording permission before adding footage.",
        recordingConsentAvailable: !withdrawn && !received, blockers: [], openQuestions: [], accepts: ["mov", "mp4"],
        captureReceived: received, uploadState: received ? retried ? "processing_ready" : "processing_pending" : "not_received",
        processingRetryAvailable: received && !retried && !withdrawn,
      } });
      if (path === "/api/site-task-brief/synthetic-owner") return route.fulfill({ json: {
        ready: true, scope: "owner", account: null, brief: { summary: "Cartons reach the pallet without damage", captureMode: "self_capture",
          proposed: [], unresolved: [], confirmedAtIso: confirmed ? "2026-10-06T00:00:00Z" : null,
          successCriteria: { successDefinition: "No damaged carton", successRate: 99, cycleTimeSeconds: 30, unknown: false }, pilotIntent },
      } });
      if (path === "/api/site-task-brief/synthetic-owner/confirm" && post) {
        pilotIntent = body.pilotIntent;
        confirmed = true;
        return route.fulfill({ json: { disposition: "needs_conversation", stage: "description_received",
          nextAction: "Founder reviews the missing physical measurement with the site owner", stillNeeded: ["Physical cycle time"], beforeRecording: [] } });
      }
      if (path === "/api/site-task-brief/synthetic-owner/status") return route.fulfill({ json: {
        captureReceived: received, status: { decision: received ? "footage_received" : "description_received",
          headline: received ? "Video received; physical performance remains uncertain" : "Description received; review the brief",
          operatorAction: "Founder and site owner agree the next measurement", nextUpdateIso: null, missingViews: [] },
      } });
      if (path === "/api/self-capture/uploads/synthetic-owner/processing-retry" && post) {
        retried = true;
        return route.fulfill({ json: { ok: true, captureReceived: true, uploadState: "processing_ready", processingRetryAvailable: false } });
      }
      if (path === "/api/task-listings/owner/synthetic-owner") return route.fulfill({ json: {
        listing: null, thumbnailPng: null, recommendation: recommended ? recommendation : null,
        booking: booked ? { recommendationId: recommendation.id } : null,
      } });
      if (path === "/api/task-listings/owner/synthetic-owner/book" && post) {
        expect(body).toEqual({ recommendationId: recommendation.id, authorized: true });
        booked = true;
        return route.fulfill({ json: { ok: true } });
      }
      if (path.endsWith("/items")) return route.fulfill({ json: { items: [], allItemsCovered: false, requestedShots: [] } });
      if (path.endsWith("/follow-up")) return route.fulfill({ json: { questions: [] } });
      unexpected.push(`${route.request().method()} ${path}`);
      return route.fulfill({ status: 501, json: { error: "Unmapped fixture API" } });
    });

    await page.goto("/contact/site-operator");
    await page.locator("#start-task").fill("Move sealed cartons from conveyor to pallet.");
    await page.locator("#start-location").fill("Austin, TX");
    await page.locator("#start-description-authority").check();
    await expect(page.getByText(/Country: United States\./)).toBeVisible();
    await expect(page.locator("#start-region")).toHaveCount(0);
    await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
    await expect(page.getByText("Your job description is saved.", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Review your job brief", exact: true }).click();
    await expect(page.getByRole("combobox", { name: /would you consider a physical pilot/ })).toHaveValue("subject_to_review");
    await page.locator("#confirm-name").fill("Synthetic site owner");
    await page.getByRole("radio", { name: "Not now", exact: true }).check();
    await page.locator("#pilot-consideration").selectOption("evaluation_only");
    await page.getByRole("button", { name: "This is right — confirm it", exact: true }).click();
    await expect(page.getByText("Your job brief is confirmed.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Edit your answers", exact: true }).click();
    await expect(page.locator("#pilot-consideration")).toHaveValue("evaluation_only");
    await page.reload();
    await page.getByRole("button", { name: "Edit your answers", exact: true }).click();
    await expect(page.locator("#pilot-consideration")).toHaveValue("evaluation_only");
    await expect(page.locator("#deployment-path")).toHaveValue("multiple_sites");
    expect(posts.filter(entry => /recording-consent|uploads\/synthetic-owner$/.test(entry.path))).toHaveLength(0);

    // Simulate a previously retained receipt; this is never capture or execution proof.
    received = true;
    await page.reload();
    await expect(page.getByText(/could not confirm that processing started/i)).toBeVisible();
    await page.getByRole("button", { name: "Retry processing", exact: true }).click();
    await expect(page.getByRole("button", { name: "Retry processing", exact: true })).toHaveCount(0);
    expect(posts.filter(entry => entry.path.endsWith("/processing-retry"))).toHaveLength(1);
    await expect(page.getByText("Video received; physical performance remains uncertain", { exact: true })).toBeVisible();

    recommended = true;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your recommended pilot" })).toBeVisible();
    await expect(page.getByText("Physical cycle time remains unmeasured", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: /authorized to book this pilot/ }).check();
    await page.getByRole("button", { name: /Book this pilot · \$2,500 Blueprint fee/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Booked." })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "Booked." })).toBeVisible();
    expect(posts.filter(entry => entry.path.endsWith("/book"))).toHaveLength(1);

    withdrawn = true;
    received = false;
    await page.reload();
    await expect(page.getByText("Recording permission was withdrawn; processing is held.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry processing", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirm recording permission", exact: true })).toHaveCount(0);
    expect(unexpected).toEqual([]);
  });
}
