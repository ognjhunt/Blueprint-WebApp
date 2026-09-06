import { expect, test } from "@playwright/test";

import { seedCookieConsent } from "./helpers/cookie-consent";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

// Same reason as task-evaluation-run.spec.ts: this review flow runs past
// CookieConsent's 1500ms reveal timer, and the fixed bottom banner then
// intercepts clicks on the controls underneath it.
test.beforeEach(seedCookieConsent);

test("customer reviews Pipeline-authored task intent without a false approval", async ({
  page,
}, testInfo) => {
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (
      ["error", "warning"].includes(message.type()) &&
      !/WebSocket connection to 'ws:\/\/127\.0\.0\.1:\d+\/\?token=.*failed/i.test(
        message.text(),
      )
    ) {
      consoleProblems.push(message.text());
    }
  });
  let submittedCommand: Record<string, unknown> | null = null;
  let commandRecorded = false;
  const unmockedApiRequests: string[] = [];
  const candidate = {
    task_candidate_id: "task-candidate-1",
    candidate_digest: sha("c"),
    description: "Move the blue tote into the marked box.",
    observed_objects: [{ object_id: "tote-1", label: "blue tote" }],
    target_regions: [{ region_id: "box-1", label: "marked box" }],
    required_robot_capabilities: ["rigid-object grasp"],
    likely_task_family: "rigid_object_pick_place",
    proposed_measurable_success_condition: {
      metric: "object_center_distance",
      operator: "<=",
      threshold: 0.05,
      units: "m",
    },
    required_site_reset: "Return the tote to the table marker.",
    supporting_frames: ["frame-10"],
    supporting_3d_regions: ["region-table", "box-1"],
    confidence: 0.94,
    coverage: { task_object: 0.8 },
    assumptions: ["The tote is movable."],
    missing_evidence: ["Rear grasp surface is occluded."],
    prohibited_claims: ["physical_task_success", "deployment_readiness"],
    estimated_evaluation_cost_usd: 2.5,
    expected_customer_value: null,
    approval_status: "approval_required" as const,
  };
  const discovery = {
    schema_version: "task_candidate_discovery.v1",
    discovery_id: "discovery-1",
    discovery_digest: sha("d"),
    source_capture: {
      intake_id: "intake-1",
      capture_digest: sha("a"),
      capture_authority_profile: "camera_360_equirectangular",
    },
    scene_analysis: {
      observed_site_facts: [
        { description: "A blue tote is directly visible on the table." },
      ],
      inferred_objects_and_affordances: [
        { description: "The tote may be graspable from its rim." },
      ],
      unsupported_or_occluded_regions: [
        { description: "The rear grasp surface is occluded." },
      ],
      hazards: [],
      privacy_sensitive_areas: [],
    },
    task_candidates: [candidate],
    approval_state: "task_approval_required",
    claim_boundaries: {
      candidate_is_customer_intent: false,
      candidate_is_task_success_evidence: false,
      generated_or_inferred_content_upgrades_capture_authority: false,
    },
  };
  const receipt = {
    schema_version: "task_candidate_decision_command_receipt.v1",
    command_request_id: "task-command-1",
    capture_session_id: "capture-upload-1",
    discovery_digest: discovery.discovery_digest,
    task_candidate_id: candidate.task_candidate_id,
    candidate_digest: candidate.candidate_digest,
    action: "approve",
    rationale: "This is the exact task we want evaluated.",
    edited_task: null,
    pipeline_approval_status: "pending_pipeline_validation",
    created_at_iso: "2026-07-29T21:00:00.000Z",
  };
  const session = {
    schema_version: "capture_upload_session.v1",
    session_id: "capture-upload-1",
    intake_id: "intake-1",
    status: "uploaded_verification_pending",
    capture_authority_profile: "camera_360_equirectangular",
    source_type: "camera_360_equirectangular",
    scene_id: "warehouse-cell-a",
    original_filename: "warehouse-tour.mp4",
    size_bytes: 130 * 1024 * 1024,
    media_type: "video/mp4",
    part_size_bytes: 64 * 1024 * 1024,
    expected_part_count: 3,
    uploaded_parts: [],
    storage_uri: null,
    upload_validation: { status: "provider_parts_verified" },
    malware_content_validation: { status: "pending" },
    content_addressing: { status: "pending_server_sha256_verification" },
    task_review: {
      status: commandRecorded
        ? "decision_pending_pipeline_validation"
        : "task_approval_required",
      candidate_count: 1,
      latest_action: commandRecorded ? "approve" : null,
    },
    claim_boundary: {
      capture_accepted: false,
      metric_scale_inherent: false,
      collision_geometry_established: false,
      physical_task_success_established: false,
      comparative_policy_ranking_verdict: "thesis_not_supported",
    },
    created_at_iso: "2026-07-29T20:00:00.000Z",
    updated_at_iso: "2026-07-29T20:01:00.000Z",
    error: null,
  };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/csrf") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ csrfToken: "e2e-csrf" }),
      });
      return;
    }
    if (path === "/api/analytics/ingest" && request.method() === "POST") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (
      request.method() === "GET" &&
      [
        "/api/task-evaluation-scene-intakes",
        "/api/task-evaluation-scene-intakes/options",
        "/api/task-evaluation-scene-intakes/sources",
      ].includes(path)
    ) {
      const body = path.endsWith("/options")
        ? { provider_terms: {}, policy_pairs: [] }
        : path.endsWith("/sources")
          ? { sources: [] }
          : { intakes: [] };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
      return;
    }
    if (path === "/api/capture-uploads" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessions: [
            {
              ...session,
              task_review: {
                ...session.task_review,
                status: commandRecorded
                  ? "decision_pending_pipeline_validation"
                  : "task_approval_required",
                latest_action: commandRecorded ? "approve" : null,
              },
            },
          ],
        }),
      });
      return;
    }
    if (
      path === `/api/capture-uploads/${session.session_id}` &&
      request.method() === "GET"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...session,
          task_review: {
            ...session.task_review,
            status: commandRecorded
              ? "decision_pending_pipeline_validation"
              : "task_approval_required",
            latest_action: commandRecorded ? "approve" : null,
          },
        }),
      });
      return;
    }
    if (path.endsWith("/task-discovery") && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          schema_version: "capture_task_review.v1",
          session_id: session.session_id,
          intake_id: session.intake_id,
          status: commandRecorded
            ? "decision_pending_pipeline_validation"
            : "task_approval_required",
          discovery,
          latest_decision_command: commandRecorded ? receipt : null,
          claim_boundary: {
            webapp_command_is_pipeline_approval: false,
            decision_evidence_request_compiled: false,
            task_success_established: false,
          },
        }),
      });
      return;
    }
    if (path.endsWith("/task-decisions") && request.method() === "POST") {
      submittedCommand = request.postDataJSON() as Record<string, unknown>;
      commandRecorded = true;
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify(receipt),
      });
      return;
    }
    unmockedApiRequests.push(`${request.method()} ${path}`);
    await route.fulfill({
      status: 599,
      contentType: "application/json",
      body: JSON.stringify({
        error: `Unmocked E2E API: ${request.method()} ${path}`,
      }),
    });
  });

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/app/captures", { waitUntil: "networkidle" });
  await page.getByLabel("Capture type", { exact: true }).selectOption("provided_scene_splat");
  await page.getByRole("combobox", { name: "Asset units", exact: true }).selectOption("1");
  await page.getByRole("combobox", { name: "Up axis", exact: true }).selectOption("Z");
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1100 });
    await expect(page.getByRole("combobox", { name: "Asset units", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Up axis", exact: true })).toHaveValue("Z");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.getByRole("button", { name: "Review tasks" }).click();
  await expect(
    page.getByRole("heading", { name: "Review proposed tasks" }),
  ).toBeVisible();
  await expect(page.getByText("Direct observations")).toBeVisible();
  await expect(
    page.getByText("Inferred objects and affordances"),
  ).toBeVisible();
  await expect(
    page.getByText(/does not prove the task succeeds/i),
  ).toBeVisible();

  const approve = page.getByRole("button", { name: "Approve candidate" });
  await expect(approve).toBeDisabled();
  await page
    .getByPlaceholder(/Why this task is correct/i)
    .fill("This is the exact task we want evaluated.");
  await approve.click();
  await expect(page.getByText("Decision command recorded")).toBeVisible();
  await expect(page.getByText(/pending Pipeline validation/i)).toBeVisible();
  expect(submittedCommand).toMatchObject({
    discovery_digest: discovery.discovery_digest,
    task_candidate_id: candidate.task_candidate_id,
    candidate_digest: candidate.candidate_digest,
    action: "approve",
    rationale: "This is the exact task we want evaluated.",
    edited_task: null,
  });
  expect(JSON.stringify(submittedCommand)).not.toMatch(
    /selected_provider|approved_task_definition|decision_evidence_request/i,
  );
  expect(unmockedApiRequests).toEqual([]);
  expect(consoleProblems).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("capture-task-review.png"),
    fullPage: true,
  });
});

test("owner submits bounded scene intent and sees source verification without a success claim", async ({
  page,
}, testInfo) => {
  const unmocked: string[] = [];
  let submitted: Record<string, any> | null = null;
  const id = `scene-${"1".repeat(64)}`;
  const projection = () => ({
    id,
    submission_id: submitted?.submission_id,
    state: "accepted",
    receipt: { intent_id: id },
    pipeline_status: {
      status: "awaiting_source",
      phase: "Source verification",
      blockers: ["source_storage_readback_required"],
    },
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown;
    if (path === "/api/csrf") body = { csrfToken: "e2e-csrf" };
    else if (path === "/api/analytics/ingest" && request.method() === "POST") {
      await route.fulfill({ status: 204, body: "" });
      return;
    } else if (path === "/api/capture-uploads" && request.method() === "GET")
      body = { sessions: [{
        schema_version: "capture_upload_session.v1", session_id: "provided-splat-one", intake_id: "asset-intake",
        status: "uploaded_verification_pending", capture_authority_profile: "provided_scene_splat", source_type: "provided_scene_splat",
        scene_id: "workcell", original_filename: "workcell.ply", size_bytes: 10000, media_type: "application/octet-stream",
        part_size_bytes: 10000, expected_part_count: 1, uploaded_parts: [], storage_uri: null,
        pipeline_handoff: { status: "forwarded" }, upload_validation: { status: "passed" },
        malware_content_validation: { status: "passed" }, content_addressing: { status: "server_sha256_verified" },
        task_review: { status: "not_requested", candidate_count: 0 }, claim_boundary: {},
        created_at_iso: "2026-09-06T00:00:00Z", updated_at_iso: "2026-09-06T00:00:00Z", error: null,
      }] };
    else if (path === "/api/task-evaluation-scene-intakes/options")
      body = {
        provider_terms: {
          vast: {
            digest: sha("e"),
            label: "Retained test terms",
            url: "https://vast.ai/terms",
          },
        },
        policy_pairs: [
          [
            { id: "pi05_droid", artifact_digest: sha("a") },
            { id: "groot_n17_droid", artifact_digest: sha("b") },
          ],
        ],
      };
    else if (path === "/api/task-evaluation-scene-intakes/sources")
      body = {
        sources: [
          {
            id: "native-cap-one",
            label: "App workcell",
            validation_status: "pending_pipeline_storage_readback",
            selectable: true,
          },
        ],
      };
    else if (
      path === "/api/task-evaluation-scene-intakes" &&
      request.method() === "POST"
    ) {
      submitted = request.postDataJSON();
      expect(request.headers().authorization).toBeTruthy();
      expect(request.headers()["x-csrf-token"]).toBe("e2e-csrf");
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify(projection()),
      });
      return;
    } else if (
      path === "/api/task-evaluation-scene-intakes" &&
      request.method() === "GET"
    )
      body = { intakes: submitted ? [projection()] : [] };
    else {
      unmocked.push(`${request.method()} ${path}`);
      await route.fulfill({
        status: 599,
        contentType: "application/json",
        body: JSON.stringify({ error: "Unmocked scene-intake request" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/app/captures", { waitUntil: "networkidle" });
  await page
    .getByRole("combobox", { name: "Source", exact: true })
    .selectOption("provided-splat-one");
  await page.getByLabel("Object to move", { exact: true }).fill("blue tote");
  await page
    .getByLabel("Starting support surface", { exact: true })
    .fill("work table");
  await page.getByLabel("Destination", { exact: true }).fill("tray");
  await expect(
    page.getByLabel("Observable success condition", { exact: true }),
  ).toHaveValue(
    "Place the object fully inside the destination, release it, and move the gripper clear.",
  );
  await page.getByLabel(/I confirm this task/).check();
  await page
    .getByRole("button", { name: "Confirm task and submit run", exact: true })
    .click();
  await expect(
    page.getByText("awaiting source", { exact: true }),
  ).toBeVisible();
  expect(submitted).toMatchObject({
    source_session_id: "provided-splat-one",
    task: {
      subject: { description: "blue tote", authority: "owner_confirmed" },
    },
    execution: {
      max_total_spend_usd: 35,
      max_paid_attempts: 8,
      max_retries: 0,
      allowed_providers: ["vast"],
      claim_scope: "development_only",
    },
    consent: {
      provider_terms_reference: sha("e"),
      task_confirmed: true,
      private_processing_authorized: true,
      provider_training_authorized: false,
      spend_authorized: true,
    },
  });
  expect(submitted).not.toHaveProperty("owner");
  expect(submitted?.consent).not.toHaveProperty("accepted_by");
  expect(unmocked).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("scene-intake-awaiting-source.png"),
    fullPage: true,
  });
});
