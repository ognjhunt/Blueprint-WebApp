// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  buildResolvedPolicyRunConfiguration,
  evaluationReadyPolicyRunSetupSchema,
  evaluationReadyRunInputSchema,
  projectEvaluationReadyRun,
} from "../utils/evaluationReadyRunContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";

const sha = (character: string) => `sha256:${character.repeat(64)}`;

const quickFamilies = [
  "canonical_anchor",
  "placement_approach", "placement_approach",
  "illumination", "camera_sensor", "bounded_physics",
  "pairwise", "pairwise", "held_out", "held_out",
] as const;

const remainingFamilies = [
  "placement_approach", "illumination", "camera_sensor", "bounded_physics",
  "pairwise", "held_out", "canonical_anchor",
] as const;

function scenarioInventory() {
  return Array.from({ length: 500 }, (_, index) => {
    const family = index < quickFamilies.length
      ? quickFamilies[index]
      : remainingFamilies[(index - quickFamilies.length) % remainingFamilies.length];
    return {
      cell_id: `nested-cell-${String(index + 1).padStart(3, "0")}`,
      family,
      partition: family === "held_out" ? "held_out" : "qualification",
      scored: true,
      cell_spec_digest: canonicalArtifactDigest({ index, family }, "cell_spec_digest"),
    };
  });
}

function familyCounts(cells: ReturnType<typeof scenarioInventory>) {
  return {
    canonical_anchor: cells.filter((cell) => cell.family === "canonical_anchor").length,
    placement_approach: cells.filter((cell) => cell.family === "placement_approach").length,
    illumination: cells.filter((cell) => cell.family === "illumination").length,
    camera_sensor: cells.filter((cell) => cell.family === "camera_sensor").length,
    bounded_physics: cells.filter((cell) => cell.family === "bounded_physics").length,
    pairwise: cells.filter((cell) => cell.family === "pairwise").length,
    held_out: cells.filter((cell) => cell.family === "held_out").length,
  };
}

function setup() {
  const inventory = scenarioInventory();
  const inventorySeedDigest = sha("8");
  const coverageRecipeDigest = sha("9");
  const template: Record<string, unknown> = {
    schema_version: "task_evaluation_policy_run_preparation_template.v1",
    template_digest: "",
  };
  template.template_digest = canonicalArtifactDigest(template, "template_digest");
  const value: Record<string, any> = {
    schema_version: "task_evaluation_policy_run_setup.v1",
    source_launch_id: "scene-839873-launch",
    offering_digest: sha("a"),
    embodiment_id: "franka_panda_robotiq_2f85_v1",
    candidate_ids: ["pi05_droid", "groot_n17_droid"],
    matrix_profile_id: "franka_rigid_relocation_nested_v1",
    preregistration: {
      uri: "s3://blueprint-evidence/policy-run-preregistration.json",
      digest: sha("b"), size_bytes: 2048,
    },
    scenario_compiler: {
      compiler_id: "franka_rigid_relocation_nested_prefix",
      compiler_version: "v1",
      selection_rule: "published_ordered_prefix",
      outcome_independent: true,
      agent_may_select_cells: false,
      inventory_seed_digest: inventorySeedDigest,
      coverage_recipe_digest: coverageRecipeDigest,
      cell_seed_rule: "sha256_inventory_seed_digest_nul_cell_id",
    },
    scenario_inventory: {
      inventory_count: 500,
      inventory_digest: "",
      compilation_proof_digest: "",
      cells: inventory,
    },
    presets: [
      {
        preset_id: "quick_10", label: "Quick", scenario_count_per_policy: 10,
        availability: "enabled", default: true,
        family_counts: familyCounts(inventory.slice(0, 10)),
        scenario_set_digest: sha("c"), parent_preset_id: null, parent_prefix_count: 0,
        parent_scenario_set_digest: null,
        nesting_proof_digest: sha("d"), estimate: { status: "unavailable" },
        cells: inventory.slice(0, 10),
      },
      {
        preset_id: "standard_100", label: "Standard", scenario_count_per_policy: 100,
        availability: "coming_later", default: false,
        family_counts: familyCounts(inventory.slice(0, 100)),
        scenario_set_digest: sha("e"), parent_preset_id: "quick_10", parent_prefix_count: 10,
        parent_scenario_set_digest: sha("c"),
        nesting_proof_digest: sha("f"), estimate: { status: "unavailable" },
      },
      {
        preset_id: "deep_500", label: "Deep", scenario_count_per_policy: 500,
        availability: "coming_later", default: false,
        family_counts: familyCounts(inventory),
        scenario_set_digest: sha("6"), parent_preset_id: "standard_100", parent_prefix_count: 100,
        parent_scenario_set_digest: sha("e"),
        nesting_proof_digest: sha("7"), estimate: { status: "unavailable" },
      },
    ],
    preparation_template: template,
    setup_digest: "",
  };
  value.scenario_inventory.inventory_digest = canonicalArtifactDigest(
    { ordered_cells: inventory }, "inventory_digest",
  );
  value.scenario_inventory.compilation_proof_digest = canonicalArtifactDigest({
    inventory_count: 500,
    inventory_digest: value.scenario_inventory.inventory_digest,
    compiler_id: value.scenario_compiler.compiler_id,
    compiler_version: value.scenario_compiler.compiler_version,
    selection_rule: value.scenario_compiler.selection_rule,
    inventory_seed_digest: inventorySeedDigest,
    coverage_recipe_digest: coverageRecipeDigest,
    cell_seed_rule: value.scenario_compiler.cell_seed_rule,
  }, "compilation_proof_digest");
  for (const preset of value.presets) preset.scenario_set_digest = canonicalArtifactDigest(
    { ordered_cells: inventory.slice(0, preset.scenario_count_per_policy) },
    "scenario_set_digest",
  );
  value.presets[1].parent_scenario_set_digest = value.presets[0].scenario_set_digest;
  value.presets[2].parent_scenario_set_digest = value.presets[1].scenario_set_digest;
  for (const preset of value.presets) preset.nesting_proof_digest = canonicalArtifactDigest({
    preset_id: preset.preset_id,
    scenario_set_digest: preset.scenario_set_digest,
    parent_preset_id: preset.parent_preset_id,
    parent_prefix_count: preset.parent_prefix_count,
    parent_scenario_set_digest: preset.parent_scenario_set_digest,
    selection_rule: "published_ordered_prefix",
    inventory_digest: value.scenario_inventory.inventory_digest,
    inventory_seed_digest: inventorySeedDigest,
    coverage_recipe_digest: coverageRecipeDigest,
    cell_seed_rule: value.scenario_compiler.cell_seed_rule,
  }, "nesting_proof_digest");
  value.setup_digest = canonicalArtifactDigest(value, "setup_digest");
  return evaluationReadyPolicyRunSetupSchema.parse(value);
}

describe("evaluation-ready policy-run contract", () => {
  it("accepts only server-owned preset selection and rejects client cells or providers", () => {
    const valid = {
      schema_version: "task_evaluation_policy_run_selection.v1",
      run_id: "scene-839873-policy-run-001",
      offering_digest: sha("a"),
      preset_id: "quick_10",
    };
    expect(evaluationReadyRunInputSchema.safeParse(valid).success).toBe(true);
    expect(evaluationReadyRunInputSchema.safeParse({ ...valid, cells: [], seed: 839873 }).success)
      .toBe(false);
    expect(evaluationReadyRunInputSchema.safeParse({ ...valid, provider: "vast" }).success)
      .toBe(false);
  });

  it("compiles Quick to stable inventory seeds and four episodes per scenario", () => {
    const policySetup = setup();
    const params = {
      sourceLaunchId: policySetup.source_launch_id,
      offeringDigest: policySetup.offering_digest,
      runId: "scene-839873-policy-run-001",
      setup: policySetup,
      presetId: "quick_10" as const,
    };
    const resolved = buildResolvedPolicyRunConfiguration(params);
    const laterRun = buildResolvedPolicyRunConfiguration({
      ...params,
      runId: "scene-839873-policy-run-002",
    });

    expect(resolved.candidate_ids).toEqual(["pi05_droid", "groot_n17_droid"]);
    expect(resolved.matrix.cells).toHaveLength(10);
    expect(resolved.matrix.cells.map((cell) => cell.seed)).toEqual(
      laterRun.matrix.cells.map((cell) => cell.seed),
    );
    expect(resolved.matrix.cells[0].seed).toBe(675648467);
    expect(new Set(resolved.matrix.cells.map((cell) => cell.seed)).size).toBe(10);
    expect(resolved.counts).toEqual({
      learned_episode_count: 20,
      control_episode_count: 20,
      total_episode_count: 40,
    });
    expect(resolved.execution_guards).toMatchObject({
      candidate_cells_and_seeds_must_match: true,
      retained_prefix_cells_and_seeds_must_match: true,
      zero_action_negative_every_scored_cell: true,
      deterministic_scripted_positive_every_scored_cell: true,
      retry_cap: 0,
    });
  });

  it("fails closed when the private inventory or nested-prefix commitment changes", () => {
    const policySetup = setup();
    const changedInventory = structuredClone(policySetup) as Record<string, any>;
    changedInventory.scenario_inventory.cells[10].cell_spec_digest = sha("f");
    changedInventory.setup_digest = canonicalArtifactDigest(
      changedInventory,
      "setup_digest",
    );
    expect(evaluationReadyPolicyRunSetupSchema.safeParse(changedInventory).success)
      .toBe(false);

    const changedParent = structuredClone(policySetup) as Record<string, any>;
    changedParent.presets[1].parent_scenario_set_digest = sha("f");
    changedParent.setup_digest = canonicalArtifactDigest(changedParent, "setup_digest");
    expect(evaluationReadyPolicyRunSetupSchema.safeParse(changedParent).success)
      .toBe(false);
  });

  it("projects bounded status and safe Website links without raw artifact locations", () => {
    const projected = projectEvaluationReadyRun({
      schema_version: "task_evaluation_policy_run_web_record.v1",
      run_id: "scene-839873-policy-run-001",
      source_launch_id: "scene-839873-launch",
      offering_digest: sha("a"),
      owner_user_id: "owner-001",
      team_namespace: "team-001",
      state: "results_ready",
      configuration_digest: sha("c"),
      episode_counts: {
        learned_episode_count: 20,
        control_episode_count: 20,
        total_episode_count: 40,
      },
      created_at_iso: "2026-08-30T12:00:00.000Z",
      updated_at_iso: "2026-08-30T13:00:00.000Z",
      result_record_id: "capture-run-safe-001",
      private_pipeline: {
        artifact_uri: "s3://private-bucket/results.json",
        secret_ref: "secret-file:pipeline-token",
      },
    });

    expect(projected.result).toEqual({
      record_id: "capture-run-safe-001",
      href: "/app/results/capture-run-safe-001",
      api_href: "/api/task-evaluation-results/capture-run-safe-001",
    });
    expect(projected.episode_counts).toEqual({
      learned_episode_count: 20,
      control_episode_count: 20,
      total_episode_count: 40,
    });
    expect(JSON.stringify(projected)).not.toContain("s3://");
    expect(JSON.stringify(projected)).not.toContain("secret-file:");
  });

  it("projects live canary lifecycle without erasing real episode counters", () => {
    const projected = projectEvaluationReadyRun({
      schema_version: "task_evaluation_policy_run_web_record.v1",
      run_id: "scene-839873-policy-canary-live",
      run_kind: "internal_policy_canary",
      source_launch_id: "scene-839873-launch",
      offering_digest: sha("a"),
      request_digest: sha("b"),
      owner_user_id: "owner-001",
      team_namespace: "team-001",
      state: "queued",
      stage: "queued",
      phase: "preparing",
      configuration_digest: sha("c"),
      progress: { completed_episodes: 0, total_episodes: 20 },
      completed_learned_episode_count: 0,
      pipeline_progress: {
        phase: "provider_allocating",
        phase_status: "running",
        observed_at_iso: "2026-09-02T00:40:00.000Z",
        elapsed_seconds: 12,
      },
      policy_candidate_ids: ["pi05_droid", "groot_n17_droid"],
      created_at_iso: "2026-09-02T00:39:00.000Z",
      updated_at_iso: "2026-09-02T00:39:00.000Z",
    });

    expect(projected).toMatchObject({
      run_kind: "internal_policy_canary",
      state: "running",
      stage: "provider_allocating",
      phase: "provider_allocating",
      progress: { completed_episodes: 0, total_episodes: 20 },
    });
  });

  it("recovers the live phase from records written before progress fields split", () => {
    const projected = projectEvaluationReadyRun({
      schema_version: "task_evaluation_policy_run_web_record.v1",
      run_id: "scene-839873-policy-canary-legacy-progress",
      run_kind: "internal_policy_canary",
      source_launch_id: "scene-839873-launch",
      offering_digest: sha("a"),
      request_digest: sha("b"),
      owner_user_id: "owner-001",
      team_namespace: "team-001",
      state: "queued",
      stage: "queued",
      phase: "preparing",
      configuration_digest: sha("c"),
      progress: {
        phase: "vast_isaac_smoke_started",
        phase_status: "running",
      } as unknown as { completed_episodes: number; total_episodes: number },
      completed_learned_episode_count: 0,
      policy_candidate_ids: ["pi05_droid", "groot_n17_droid"],
      created_at_iso: "2026-09-02T00:39:00.000Z",
      updated_at_iso: "2026-09-02T00:39:00.000Z",
    });

    expect(projected).toMatchObject({
      state: "running",
      stage: "runtime_starting",
      phase: "vast_isaac_smoke_started",
      progress: { completed_episodes: 0, total_episodes: 20 },
    });
  });
});
