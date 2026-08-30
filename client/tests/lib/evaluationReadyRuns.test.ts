import { describe, expect, it, vi } from "vitest";

import {
  buildEvaluationReadyRunInput,
  evaluationReadyRunProjectionSchema,
  fetchEvaluationReadySetup,
} from "@/lib/evaluationReadyRuns";

const digest = (character: string) => `sha256:${character.repeat(64)}`;

describe("evaluation-ready run client contract", () => {
  it("builds only the digest-bound preset selection", () => {
    expect(buildEvaluationReadyRunInput({
      runId: "scene-839873-policy-run-001",
      offeringDigest: digest("a"),
      presetId: "quick_10",
    })).toEqual({
      schema_version: "task_evaluation_policy_run_selection.v1",
      run_id: "scene-839873-policy-run-001",
      offering_digest: digest("a"),
      preset_id: "quick_10",
    });
  });

  it("rejects invalid presets and unsafe run projections", () => {
    expect(() => buildEvaluationReadyRunInput({
      runId: "scene-839873-policy-run-001",
      offeringDigest: digest("a"),
      presetId: "custom_42" as any,
    })).toThrow("Evaluation preset is invalid");

    expect(evaluationReadyRunProjectionSchema.safeParse({
      schema_version: "task_evaluation_policy_run_projection.v1",
      run_id: "run-001",
      state: "results_ready",
      terminal: true,
      result: { href: "https://outside.example/result" },
    }).success).toBe(false);
  });

  it("adapts the authenticated server setup without exposing team or email inputs", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({
      schema_version: "task_evaluation_policy_run_setup_projection.v1",
      source_launch_id: "scene-839873-launch",
      offering_digest: digest("a"),
      offering_status: "evaluation_ready",
      setup_digest: digest("b"),
      offering: {
        scene_id: "scene-839873",
        scene_version: "v1",
        task_id: "rigid-relocation",
        task_version: "v1",
        task_kind: "pick_and_place",
        task_strategy: "simple_relocation",
      },
      launch_profile: { profile_id: "franka-profile-v1", profile_digest: digest("c") },
      robot: { embodiment_id: "franka_panda_robotiq_2f85_v1", label: "Franka + DROID", locked: true },
      policy_candidates: [
        { candidate_id: "pi05_droid", label: "PI 0.5 DROID", locked: true },
        { candidate_id: "groot_n17_droid", label: "GR00T N1.7 DROID", locked: true },
      ],
      matrix: {
        profile_id: "franka_rigid_relocation_nested_v1",
        preregistration_digest: digest("d"),
        compiler: { compiler_id: "franka_rigid_relocation_nested_prefix", compiler_version: "v1", selection_rule: "published_ordered_prefix", outcome_independent: true, agent_may_select_cells: false },
        presets: [
          {
            preset_id: "quick_10", label: "Quick", scenario_count_per_policy: 10, availability: "enabled", default: true,
            family_counts: { canonical_anchor: 1, placement_approach: 2, illumination: 1, camera_sensor: 1, bounded_physics: 1, pairwise: 2, held_out: 2 },
            scenario_set_digest: digest("e"), parent_preset_id: null, parent_prefix_count: 0, nesting_proof_digest: digest("0"),
            estimate: { status: "estimated", duration_minutes: { minimum: 18, maximum: 25 }, cost_usd: { minimum: 2, maximum: 4 }, basis_digest: digest("f"), as_of: "2026-08-30T12:00:00Z" },
            episode_counts: { learned_episode_count: 20, control_episode_count: 20, total_episode_count: 40 },
          },
          {
            preset_id: "standard_100", label: "Standard", scenario_count_per_policy: 100, availability: "coming_later", default: false,
            family_counts: { canonical_anchor: 1, placement_approach: 24, illumination: 12, camera_sensor: 12, bounded_physics: 12, pairwise: 19, held_out: 20 },
            scenario_set_digest: digest("1"), parent_preset_id: "quick_10", parent_prefix_count: 10, nesting_proof_digest: digest("2"), estimate: { status: "unavailable" },
            episode_counts: { learned_episode_count: 200, control_episode_count: 200, total_episode_count: 400 },
          },
          {
            preset_id: "deep_500", label: "Deep", scenario_count_per_policy: 500, availability: "coming_later", default: false,
            family_counts: { canonical_anchor: 1, placement_approach: 124, illumination: 62, camera_sensor: 62, bounded_physics: 62, pairwise: 94, held_out: 95 },
            scenario_set_digest: digest("3"), parent_preset_id: "standard_100", parent_prefix_count: 100, nesting_proof_digest: digest("4"), estimate: { status: "unavailable" },
            episode_counts: { learned_episode_count: 1000, control_episode_count: 1000, total_episode_count: 2000 },
          },
        ],
      },
      notification: { email_when_ready: true, recipient: "authenticated_account", recipient_email: "friend@example.com" },
      proof_boundary: { setup_is_execution: false, provider_mutation_performed: false, paid_execution_requested: false, simulation_is_physical_success: false },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    const currentUser = { getIdToken: vi.fn().mockResolvedValue("firebase-token") } as any;

    const setup = await fetchEvaluationReadySetup(currentUser, "scene-839873-launch");

    expect(setup).toMatchObject({
      sceneLabel: "scene-839873 · v1",
      taskLabel: "rigid-relocation · simple relocation",
      candidateIds: ["pi05_droid", "groot_n17_droid"],
      defaultPresetId: "quick_10",
      presets: expect.arrayContaining([expect.objectContaining({ presetId: "quick_10", scenarioCountPerPolicy: 10, availability: "available" })]),
      notificationRecipient: "friend@example.com",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/configured-scene-offerings/scene-839873-launch/evaluation-setup",
      expect.objectContaining({ headers: { Authorization: "Bearer firebase-token" } }),
    );
    fetcher.mockRestore();
  });
});
