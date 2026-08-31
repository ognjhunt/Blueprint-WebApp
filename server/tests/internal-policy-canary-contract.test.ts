import { describe, expect, it } from "vitest";

import {
  buildInternalPolicyCanaryLaunchRequest,
  internalPolicyCanarySelectionSchema,
  internalPolicyCanarySetupSchema,
  resolveInternalPolicyCanarySelection,
} from "../utils/internalPolicyCanaryContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

const sha = (character: string) => `sha256:${character.repeat(64)}`;
const ref = (character: string) => ({ uri: `gs://policy-canary/${character}`, digest: sha(character) });

function setup() {
  const cells = Array.from({ length: 10 }, (_, index) => ({
    cell_id: `cell-${index + 1}`,
    family: [
      "canonical_anchor", "canonical_anchor", "placement_approach",
      "placement_approach", "illumination", "camera_sensor",
      "bounded_physics", "admitted_object_material_cousin",
      "pairwise_stress", "held_out_composition",
    ][index],
    seed: index + 100,
    partition: index === 9 ? "held_out" : index === 8 ? "stress" : "canonical",
    label: `Cell ${index + 1}`,
    cell_digest: sha(String(index % 10)),
  }));
  const policy = (id: string, character: string) => ({
    candidate_id: id,
    display_name: id === "pi05_droid" ? "PI 0.5 DROID" : "GR00T N1.7 DROID",
    checkpoint: ref(character),
    adapter_id: `${id}-adapter`,
    license_id: "verified-internal-use",
    compatibility: {
      robot_preset_ids: ["franka_panda_robotiq_2f85_v1"],
      embodiment_ids: ["franka_panda_robotiq_2f85_v1"],
      observation_schema_ids: ["droid-observation-v1"],
      action_schema_ids: ["droid-action-v1"],
      simulator_runtime_ids: ["isaac-sim-policy-v1"],
      task_family_ids: ["rigid-relocation-v1"],
    },
    readiness: { status: "verified_runnable", receipt: ref(character), reason: null },
  });
  const quick = {
    preset_id: "quick_10",
    label: "Quick",
    episodes_per_policy: 10,
    availability: "enabled",
    recommended: true,
    matrix: {
      matrix_digest: "",
      resolver_id: "policy-canary-quick-matrix",
      resolver_version: "v1",
      deterministic: true,
      cells,
      expected_family_counts: {
        canonical_anchor: 2,
        placement_approach: 2,
        illumination: 1,
        camera_sensor: 1,
        bounded_physics: 1,
        admitted_object_material_cousin: 1,
        pairwise_stress: 1,
        held_out_composition: 1,
      },
      coverage_gaps: [],
    },
    estimate: {
      duration_minutes: { minimum: 25, maximum: 45 },
      maximum_authorized_cost_usd: 4.25,
      hard_ttl_seconds: 3600,
      basis_digest: sha("b"),
      as_of: "2026-08-31T12:00:00.000Z",
    },
  };
  quick.matrix.matrix_digest = canonicalArtifactDigest(
    { ordered_cells: cells },
    "__no_digest_field__",
  );
  const draft: Record<string, any> = {
    schema_version: "task_evaluation_policy_canary_setup.v1",
    source_launch_id: "scene-839873-launch",
    offering_digest: sha("c"),
    scene_revision_digest: sha("d"),
    run_kind: "internal_policy_canary",
    claim_ceiling: "diagnostic_policy_execution",
    registry_digest: sha("e"),
    robot_presets: [{
      robot_preset_id: "franka_panda_robotiq_2f85_v1",
      display_name: "Franka Panda + Robotiq 2F-85",
      embodiment_id: "franka_panda_robotiq_2f85_v1",
      task_family_id: "rigid-relocation-v1",
      simulator_runtime_id: "isaac-sim-policy-v1",
      runtime_image: ref("f"),
      observation_schema: {
        schema_id: "droid-observation-v1",
        cameras: ["external", "wrist"],
        modalities: ["rgb", "proprioception"],
      },
      action_schema: { schema_id: "droid-action-v1", space: "cartesian-delta", control_hz: 15 },
      readiness: { status: "verified_runnable", receipt: ref("f"), reason: null },
      policy_candidates: [policy("pi05_droid", "1"), policy("groot_n17_droid", "2")],
    }],
    episode_presets: [
      quick,
      { ...quick, preset_id: "standard_100", label: "Standard", episodes_per_policy: 100, availability: "coming_later", recommended: false, matrix: { ...quick.matrix, cells: [] } },
      { ...quick, preset_id: "deep_500", label: "Deep", episodes_per_policy: 500, availability: "coming_later", recommended: false, matrix: { ...quick.matrix, cells: [] } },
    ],
    diagnostics: { zero_action: "nonblocking", deterministic_scripted_positive: "nonblocking" },
    setup_digest: "",
  };
  for (const preset of draft.episode_presets) {
    preset.matrix.matrix_digest = canonicalArtifactDigest(
      { ordered_cells: preset.matrix.cells },
      "__no_digest_field__",
    );
  }
  draft.setup_digest = canonicalArtifactDigest(draft, "setup_digest");
  return internalPolicyCanarySetupSchema.parse(draft);
}

function selection(value = setup()) {
  return internalPolicyCanarySelectionSchema.parse({
    schema_version: "task_evaluation_policy_canary_selection.v1",
    run_kind: "internal_policy_canary",
    claim_ceiling: "diagnostic_policy_execution",
    run_id: "scene-839873-policy-canary-001",
    offering_digest: value.offering_digest,
    setup_digest: value.setup_digest,
    scene_revision_digest: value.scene_revision_digest,
    robot_preset_id: "franka_panda_robotiq_2f85_v1",
    policy_candidate_ids: ["pi05_droid", "groot_n17_droid"],
    episode_preset_id: "quick_10",
    variation_matrix_digest: value.episode_presets[0].matrix.matrix_digest,
    notification: { email: "team@tryblueprint.io", notify_on: ["completed", "blocked", "cancelled"] },
    authorization: { maximum_cost_usd: 4.25, hard_ttl_seconds: 3600, maximum_provider_allocations: 1, retry_cap: 0 },
    confirm_unqualified_execution: true,
  });
}

describe("internal policy canary contract", () => {
  it("forwards the exact typed Quick-10 authority through the canonical launch envelope", () => {
    const setupValue = setup();
    const request = buildInternalPolicyCanaryLaunchRequest({
      selection: selection(setupValue),
      setup: setupValue,
      profile: {
        profile_id: "scene-839873-policy-canary",
        profile_digest: sha("3"),
        source_bundle: { bundle_id: "scene-839873", source_kind: "interiorgs_sage", ...ref("4") },
        evaluation_run_spec: ref("5"),
        required_controls: { canonical_allocator: "python -m blueprint_pipeline.paid_resource_allocator gpu-canary", secret_profile_id: "policy-canary", watchdog_required: true, artifact_storage_required: true, teardown_required: true, provider_zero_required: true, webapp_status_sync_required: true, retry_cap: 0 },
      },
      actor: { id: "team-user-1", role: "team_member" },
      teamNamespace: "blueprint",
      controlsStatusAtSubmission: "configured_controls_pending",
      authorizedAt: "2026-08-31T12:00:00.000Z",
    });

    expect(request).toMatchObject({
      schema_version: "task_evaluation_launch_request.v1",
      run_kind: "internal_policy_canary",
      claim_ceiling: "diagnostic_policy_execution",
      source_launch_id: "scene-839873-launch",
      robot_preset_id: "franka_panda_robotiq_2f85_v1",
      policy_candidate_ids: ["pi05_droid", "groot_n17_droid"],
      episode_plan: {
        preset: "quick_10",
        episodes_per_policy: 10,
        policy_count: 2,
        learned_policy_rollout_count: 20,
        resolved_seeds: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109],
        diagnostic_control_rollouts: { total_count: 20, blocking_for_policy_execution: false },
      },
      notification: { email: "team@tryblueprint.io", notify_on: ["completed", "blocked", "cancelled"] },
      required_controls: { maximum_provider_allocations: 1, retry_cap: 0 },
      scene_promotion_permitted: false,
      official_ranking_permitted: false,
    });
    expect(request.request_digest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("rejects a policy whose action schema does not match the selected embodiment", () => {
    const setupValue = setup();
    setupValue.robot_presets[0].policy_candidates[0].compatibility.action_schema_ids = ["franka-joint-v2"];
    expect(resolveInternalPolicyCanarySelection(setupValue, selection(setupValue))).toMatchObject({
      ok: false,
      code: "POLICY_INCOMPATIBLE",
    });
  });
});
