import { expect, test } from "@playwright/test";

const initialJobWorkflow = () => ({
  schemaVersion: "job_marketplace.v1", revision: "fixture-revision", stage: "job_submitted",
  requirements: { purchaseReadiness: "unsure", jobFrequency: null, requiredOutput: null,
    installationBudget: null, ongoingBudget: null, currentProcessCost: null, targetStartDate: null },
  briefAgreed: false, optionsAssessed: false, reviewRequired: false,
  nextAction: "Review the job brief with Blueprint.", actionOwner: "site",
  review: null, proposals: [], selection: null, agreement: null, outcome: null,
});

test.skip(process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== "1", "Requires isolated fixture identity");

for (const width of [390, 1440]) {
  test(`invited site return, correction, retry and proposal choice without agreement at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const unexpected: string[] = [];
    const posts: { path: string; body: Record<string, unknown> }[] = [];
    let confirmed = false;
    let received = false;
    let retried = false;
    let proposalsReady = false;
    let selected = false;
    let withdrawn = false;
    let pilotIntent = { pilotConsideration: "subject_to_review", deploymentPath: "multiple_sites" };
    const proposal = {
      id: "synthetic-proposal-1", revision: "a".repeat(64), briefRevision: "b".repeat(64),
      status: "available", providerName: "Synthetic delivery partner", scope: "Proposed carton transfer against site targets",
      equipment: "Fixture robot and gripper", software: "Fixture controller", deliveryCommitment: "Scope remains subject to the parties' agreement",
      installationCostUsd: null, monthlyCostUsd: null, currency: "USD", exclusions: "Fixture proposal only",
      sitePreparation: "Named task owner and agreed trial window", humanAssistance: "Operator and reset assistance",
      timing: "Subject to both parties agreeing dates", support: "To be agreed directly",
      evidence: [{ level: "unverified", summary: "Physical cycle time remains unmeasured" }],
      acceptanceCriteria: "Measure carton transfer against agreed site targets", recommendationReason: null,
      createdAtIso: "2026-10-21T00:00:00Z", updatedAtIso: "2026-10-21T00:00:00Z",
    };
    const jobWorkflow = () => ({
      ...initialJobWorkflow(), briefAgreed: confirmed, optionsAssessed: proposalsReady,
      stage: proposalsReady ? "proposals_ready" : confirmed ? "brief_agreed" : "job_submitted",
      nextAction: selected ? "Agree pilot scope, price, dates and support directly with the delivery partner." : "Review the current job brief and proposal.",
      actionOwner: selected ? "deployment_partner" : "site", proposals: proposalsReady ? [proposal] : [],
      selection: selected ? { proposalId: proposal.id, proposalRevision: proposal.revision, selectedAtIso: "2026-10-21T01:00:00Z" } : null,
      agreement: null, outcome: null,
    });

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
      if (path === "/api/job-workflow/owner/synthetic-owner" && !post) return route.fulfill({ json: jobWorkflow() });
      if (path === "/api/job-workflow/owner/synthetic-owner/select" && post) {
        expect(body).toEqual({ proposalId: proposal.id, expectedRevision: proposal.revision, authorized: true });
        selected = true;
        return route.fulfill({ json: jobWorkflow() });
      }
      if (path === "/api/csrf") return route.fulfill({ json: { csrfToken: "synthetic" } });
      if (path === "/api/location-autocomplete" && route.request().method() === "GET") return route.fulfill({ json: { features: [] } });
      if (path === "/api/analytics/ingest") return route.fulfill({ status: 204, body: "" });
      if (path === "/api/workspace/setup") return route.fulfill({ json: { workspaceType: "robot_team" } });
      if (path === "/api/inbound-request" && post) {
        expect(body).toMatchObject({ descriptionOnly: true, consentAttestation: null, accountSignup: false, taskDescription: "", taskStatement: "" });
        return route.fulfill({ json: { ok: true, captureUrl: "/capture-upload/synthetic-owner" } });
      }
      // The owner page reads whether recording permission was withdrawn.
      if (path === "/api/self-capture/uploads/synthetic-owner/withdrawal" && route.request().method() === "GET") return route.fulfill({ json: withdrawn
        ? { ok: true, withdrawn: true, withdrawal: { state: "uploads_stopped_cleanup_pending", requestedAtIso: "2026-10-13T00:00:00.000Z",
          pipelineAcknowledged: false, deletionConfirmed: false, legalHold: false,
          storageDeletion: { state: "pending", deletedObjectCount: 0, lateUploadCheckAtIso: null, completedAtIso: null } } }
        : { ok: true, withdrawn: false } });
      if (path === "/api/self-capture/uploads/synthetic-owner/status") return route.fulfill({ json: {
        ok: true, state: received && !withdrawn ? "ready" : "held", holdReason: "recording_consent_required",
        detail: withdrawn ? "Recording permission was withdrawn; processing is held." : "Confirm recording permission before adding footage.",
        recordingConsentAvailable: !withdrawn && !received, blockers: [], openQuestions: [], accepts: ["mov", "mp4"],
        captureReceived: received, uploadState: received ? retried ? "processing_ready" : "processing_pending" : "not_received",
        processingRetryAvailable: received && !retried && !withdrawn,
      } });
      if (path === "/api/site-task-brief/synthetic-owner") return route.fulfill({ json: {
        ready: received, scope: "owner", account: null, brief: { summary: "Cartons reach the pallet without damage", captureMode: "self_capture",
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
          headline: received ? "Video received; physical performance remains uncertain" : "Video needed to assess your job",
          operatorAction: received ? "Founder and site owner agree the next measurement" : "Upload or record the job to continue", nextUpdateIso: null, missingViews: [] },
      } });
      if (path === "/api/self-capture/uploads/synthetic-owner/processing-retry" && post) {
        retried = true;
        return route.fulfill({ json: { ok: true, captureReceived: true, uploadState: "processing_ready", processingRetryAvailable: false } });
      }
      if (path === "/api/task-listings/owner/synthetic-owner") return route.fulfill({ json: {
        listing: null, thumbnailPng: null, recommendation: null, booking: null,
      } });
      // The readiness report answers for itself; this journey's job is not shared. The site sends its video and
      // nothing else, so no item photos, measurements or follow-up questions are ever read.
      if (path === "/api/site-task-brief/synthetic-owner/readiness" && !post) return route.fulfill({ json: { ok: true, summary: null,
        tracker: { steps: [], meanwhile: null }, report: null, briefPath: null } });
      unexpected.push(`${route.request().method()} ${path}`);
      return route.fulfill({ status: 501, json: { error: "Unmapped fixture API" } });
    });

    await page.goto("/contact/site-operator");
    await expect(page.locator("#start-task")).toBeHidden();
    await page.locator("#start-location").fill("Austin, TX");
    await expect(page.locator("#start-region")).toHaveCount(0);
    await page.getByRole("button", { name: "Start free assessment", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Film the work area.", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Open your job page", exact: true }).click();
    await expect(page.getByRole("region", { name: "Confirm recording permission", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm recording permission", exact: true })).toBeDisabled();
    await expect(page.getByRole("heading", { name: "Your job summary", exact: true })).toHaveCount(0);
    await expect(page.getByText("Review or correct job details (optional)", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add footage when you are ready (optional)", exact: true })).toHaveCount(0);

    // Simulate an actual retained receipt from this existing fixture job. The
    // analyzed brief is reviewed only after video; no real capture or execution occurs.
    received = true;
    await page.reload();
    await expect(page.getByText("Review or correct job details (optional)", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "This is right — confirm it", exact: true })).toBeHidden();
    await page.getByText("Review or correct job details (optional)", { exact: true }).click();
    await expect(page.getByRole("button", { name: "This is right — confirm it", exact: true })).toBeVisible();
    await page.getByText("Your recorded pilot preferences (optional corrections)", { exact: true }).click();
    await expect(page.getByRole("combobox", { name: /would you consider a physical pilot/ })).toHaveValue("subject_to_review");
    await page.locator("#confirm-name").fill("Synthetic site owner");
    await page.locator("#pilot-consideration").selectOption("evaluation_only");
    await page.getByRole("button", { name: "This is right — confirm it", exact: true }).click();
    await expect(page.getByText(/Your job brief is confirmed\./)).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Edit your answers", exact: true }).click();
    await page.getByText("Your recorded pilot preferences (optional corrections)", { exact: true }).click();
    await expect(page.locator("#pilot-consideration")).toHaveValue("evaluation_only");
    await page.reload();
    await page.getByRole("button", { name: "Edit your answers", exact: true }).click();
    await page.getByText("Your recorded pilot preferences (optional corrections)", { exact: true }).click();
    await expect(page.locator("#pilot-consideration")).toHaveValue("evaluation_only");
    await expect(page.locator("#deployment-path")).toHaveValue("multiple_sites");
    expect(posts.filter(entry => /recording-consent|uploads\/synthetic-owner$/.test(entry.path))).toHaveLength(0);

    // The retained video is still available through a processing retry.
    await page.reload();
    await expect(page.getByText("Your video is saved.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry processing", exact: true })).toBeHidden();
    await page.getByText("Processing details (optional)", { exact: true }).click();
    await page.getByRole("button", { name: "Retry processing", exact: true }).click();
    await expect(page.getByRole("button", { name: "Retry processing", exact: true })).toHaveCount(0);
    expect(posts.filter(entry => entry.path.endsWith("/processing-retry"))).toHaveLength(1);
    await expect(page.getByText("Video received; physical performance remains uncertain", { exact: true })).toBeVisible();

    proposalsReady = true;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Delivery proposals", exact: true })).toBeVisible();
    const offered = page.getByRole("article", { name: `${proposal.providerName} delivery proposal` });
    await offered.getByText("Review scope, evidence and support", { exact: true }).click();
    await expect(offered.getByText("Physical cycle time remains unmeasured", { exact: true })).toBeVisible();
    await offered.getByRole("checkbox", { name: /authorized to choose this proposal for my site/ }).check();
    await offered.getByRole("button", { name: "Choose this proposal", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your choice is recorded", exact: true })).toBeVisible();
    await expect(page.getByText("Blueprint will record the agreed pilot after both parties confirm it. A proposal selection alone is not an agreement.", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pilot agreement recorded", exact: true })).toHaveCount(0);
    await expect(page.getByRole("form", { name: "Pilot outcome" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your choice is recorded", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pilot agreement recorded", exact: true })).toHaveCount(0);
    expect(posts.filter(entry => entry.path.endsWith("/select"))).toEqual([
      { path: "/api/job-workflow/owner/synthetic-owner/select", body: { proposalId: proposal.id, expectedRevision: proposal.revision, authorized: true } },
    ]);
    expect(posts.filter(entry => /\/(book|agreement|outcome)$/.test(entry.path))).toHaveLength(0);
    expect(jobWorkflow().selection?.proposalRevision).toBe(proposal.revision);
    expect(jobWorkflow().agreement).toBeNull();

    withdrawn = true;
    received = false;
    await page.reload();
    await expect(page.getByText("Recording permission was withdrawn; processing is held.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry processing", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Confirm recording permission", exact: true })).toHaveCount(0);
    expect(unexpected).toEqual([]);
  });
}
