import { expect, test } from "@playwright/test";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const artifact = (index: number, role: string, contentType = "application/json") => ({
  artifact_id: index.toString(16).padStart(32, "0"),
  role,
  relative_path: `${role}-${index}.${contentType === "text/csv" ? "csv" : contentType === "video/mp4" ? "mp4" : "json"}`,
  sha256: sha((index % 10).toString()),
  size_bytes: 128,
  content_type: contentType,
  retention_status: "retained",
  access_mode: "authenticated_ticket",
});

function resultFixture() {
  const candidates = [
    { candidate_id: "pi05_droid", display_name: "π0.5 DROID", checkpoint_digest: sha("a") },
    { candidate_id: "groot_n17_droid", display_name: "GR00T N1.7 DROID", checkpoint_digest: sha("b") },
  ];
  const families = [
    "canonical_anchor",
    "canonical_anchor",
    "placement_approach",
    "placement_approach",
    "illumination",
    "camera_sensor",
    "bounded_physics",
    "admitted_object_material_cousin",
    "pairwise_stress",
    "held_out_composition",
  ];
  const episodes = families.flatMap((family, cellIndex) => candidates.map((candidate, policyIndex) => {
    const blocked = cellIndex >= 6;
    return {
      episode_id: `${candidate.candidate_id}-cell-${cellIndex}`,
      episode_kind: "learned_candidate",
      subject_id: candidate.candidate_id,
      policy_candidate_id: candidate.candidate_id,
      score: {
        status: blocked ? "blocked" : "complete",
        task_succeeded: blocked ? null : policyIndex === 0,
        grader_authority: "deterministic_simulator_state",
        policy_outcome_interpretable: !blocked,
      },
      variation: {
        cell_id: `scene839873.quick10.${String(cellIndex).padStart(2, "0")}.${family}`,
        family_id: family,
        partition: cellIndex === 9 ? "held_out" : cellIndex < 2 ? "canonical" : "stress",
        seed: 900 - cellIndex,
      },
      failure: blocked
        ? { code: "camera_render_blocked", summary: "Camera evidence was not interpretable." }
        : null,
      evidence: {
        complete: !blocked,
        frame_manifest: artifact(100 + cellIndex * 2 + policyIndex, "frame_manifest"),
        episode_json: artifact(200 + cellIndex * 2 + policyIndex, "episode_json"),
        videos: {
          external: artifact(300 + cellIndex * 6 + policyIndex * 3, "review_video", "video/mp4"),
          wrist: artifact(301 + cellIndex * 6 + policyIndex * 3, "review_video", "video/mp4"),
          overview: artifact(302 + cellIndex * 6 + policyIndex * 3, "review_video", "video/mp4"),
        },
      },
      timeline: [],
      video_timebase_offsets_seconds: { external: 0, wrist: 0, overview: 0 },
    };
  }));
  const evidenceManifest = artifact(4, "evidence_manifest");
  return {
    schema_version: "task_evaluation_result_site_record.v1",
    record_id: "result-ux-fixture",
    organization_id: "team-1",
    access_visibility: "organization_members",
    publication: {
      schema_version: "task_evaluation_run_publication.v4",
      run_id: "scene-839873-quick10-browser-fixture",
      run_kind: "internal_policy_canary",
      claim_ceiling: "diagnostic_policy_execution",
      result_status: "blocked",
      scene_controls_status: "configured_controls_pending",
      warning: "Controls pending — results are unqualified.",
      scene: { id: "839873", revision_digest: sha("c") },
      task: { id: "simple-relocation", label: "Simple relocation" },
      robot: { preset_id: "franka", display_name: "Franka + Robotiq" },
      policy_candidates: candidates,
      request_digest: sha("d"),
      configuration_digest: sha("e"),
      result_delivery: {
        schema_version: "task_evaluation_result_delivery.v2",
        run_id: "scene-839873-quick10-browser-fixture",
        result_status: "blocked",
        status: "ready",
        claim_ceiling: "diagnostic_policy_execution",
        stages: ["validate", "seal", "project", "package", "publish"].map((stage) => ({ stage, status: "complete" })),
        blockers: [],
        summary: { episode_count: 20, learned_candidate_episode_count: 20, control_episode_count: 0, successful_episode_count: 6, interpretable_episode_count: 12 },
        episodes,
        artifacts: [
          artifact(1, "summary_csv", "text/csv"),
          artifact(2, "episode_csv", "text/csv"),
          artifact(3, "full_json_report"),
          evidenceManifest,
        ],
        proof_boundary: { review_video_is_authoritative_evidence: false, simulation_is_physical_success: false, cross_team_leaderboard_authorized: false },
        delivery_digest: sha("f"),
      },
      policy_canary_result: {
        schema_version: "task_evaluation_policy_canary_result_projection.v1",
        matrix_digest: sha("1"),
        counts: { policy_count: 2, episodes_per_policy: 10, learned_policy_rollout_count: 20, completed_learned_policy_rollout_count: 12 },
        candidate_results: candidates.map((candidate) => ({
          ...candidate,
          episodes_completed: 10,
          interpretable_episode_count: 6,
          success_count: 3,
          success_rate: 0.5,
          progress_score: 0.5,
          mean_destination_error: 0.2,
          contact_maintenance_rate: 0.5,
          collision_rate: 0,
          action_delivery_rate: 0.6,
        })),
        reproducibility: {
          evidence_manifest: evidenceManifest,
          billing_receipt: artifact(5, "billing_receipt"),
          teardown_receipt: artifact(6, "teardown_receipt"),
          provider_zero_receipt: artifact(7, "provider_zero_receipt"),
          official_total_usd: 0.379,
          provider: "vast",
          provider_instance_ids: [49_609_705],
        },
        winner_declared: false,
        official_ranking_contribution: false,
      },
      proof_boundary: { result_is_unqualified: true, winner_declared: false },
    },
  };
}

test("policy canary result defaults to the simple cell-by-cell review", async ({ page }, testInfo) => {
  test.skip(
    process.env.VITE_BLUEPRINT_OPERATOR_QA_FAKE_AUTH !== "1",
    "local fixture requires the dev-only operator QA identity",
  );
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (
      route.request().method() === "GET"
      && url.pathname === "/api/task-evaluation-results/result-ux-fixture"
    ) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resultFixture()) });
      return;
    }
    if (route.request().method() === "POST" && url.pathname.endsWith("/ticket")) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "fixture video unavailable" }) });
      return;
    }
    if (route.request().method() === "GET" && url.pathname === "/api/csrf") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ csrfToken: "fixture" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/app/results/result-ux-fixture");
  await page.getByRole("button", { name: "Reject all" }).click().catch(() => undefined);
  await expect(page.getByRole("heading", { name: "10 scenario cells · 2 policies · 20 episodes" })).toBeVisible();
  await expect(page.getByText("20/20 episode records")).toBeVisible();
  await expect(page.getByText("12 completed · 8 blocked")).toBeVisible();
  await expect(page.getByText("Cell 1 of 10 · Episodes 1–2 of 20")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Baseline anchor 1" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("policy-canary-result-simple.png"), fullPage: true });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Cell 2 of 10 · Episodes 3–4 of 20")).toBeVisible();
  await page.getByRole("tab", { name: "Wrist camera" }).click();
  await expect(page.getByRole("tab", { name: "Wrist camera" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Load Wrist camera video for π0.5 DROID" }).click();
  await expect(page.getByRole("button", { name: "Retry Wrist camera video for π0.5 DROID" })).toBeVisible();
  await expect(page.getByText("The video could not be loaded. Try again.")).toBeVisible();
  await expect(page.getByText("Evidence and provenance")).toBeVisible();
  await expect(page.getByText("Complete artifact inventory")).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("policy-canary-video-retry.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  expect(consoleErrors.filter((message) => (
    !message.includes("WebSocket connection to 'ws://127.0.0.1")
    && !message.includes("Failed to load resource: the server responded with a status of 503")
  ))).toEqual([]);
});
