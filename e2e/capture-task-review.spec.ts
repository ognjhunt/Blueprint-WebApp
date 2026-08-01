import { expect, test } from "@playwright/test";

import { seedCookieConsent } from "./helpers/cookie-consent";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

// Same reason as task-evaluation-run.spec.ts: this review flow runs past
// CookieConsent's 1500ms reveal timer, and the fixed bottom banner then
// intercepts clicks on the controls underneath it.
test.beforeEach(seedCookieConsent);

test("customer reviews Pipeline-authored task intent without a false approval", async ({ page }, testInfo) => {
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
      observed_site_facts: [{ description: "A blue tote is directly visible on the table." }],
      inferred_objects_and_affordances: [{ description: "The tote may be graspable from its rim." }],
      unsupported_or_occluded_regions: [{ description: "The rear grasp surface is occluded." }],
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
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "e2e-csrf" }) });
      return;
    }
    if (path === "/api/analytics/ingest" && request.method() === "POST") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (path === "/api/capture-uploads" && request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ sessions: [{
          ...session,
          task_review: {
            ...session.task_review,
            status: commandRecorded
              ? "decision_pending_pipeline_validation"
              : "task_approval_required",
            latest_action: commandRecorded ? "approve" : null,
          },
        }] }),
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
      body: JSON.stringify({ error: `Unmocked E2E API: ${request.method()} ${path}` }),
    });
  });

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/app/captures", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Review tasks" }).click();
  await expect(page.getByRole("heading", { name: "Review proposed tasks" })).toBeVisible();
  await expect(page.getByText("Direct observations")).toBeVisible();
  await expect(page.getByText("Inferred objects and affordances")).toBeVisible();
  await expect(page.getByText(/does not prove the task succeeds/i)).toBeVisible();

  const approve = page.getByRole("button", { name: "Approve candidate" });
  await expect(approve).toBeDisabled();
  await page.getByPlaceholder(/Why this task is correct/i).fill(
    "This is the exact task we want evaluated.",
  );
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
  expect(JSON.stringify(submittedCommand)).not.toMatch(/selected_provider|approved_task_definition|decision_evidence_request/i);
  expect(unmockedApiRequests).toEqual([]);
  expect(consoleProblems).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("capture-task-review.png"),
    fullPage: true,
  });
});
