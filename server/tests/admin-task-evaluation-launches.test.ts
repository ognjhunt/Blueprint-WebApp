// @vitest-environment node
import crypto from "crypto";
import express from "express";
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CANONICAL_TASK_EVALUATION_ALLOCATOR } from "../utils/taskEvaluationLaunchContract";
import { taskEvaluationLaunchPreparationInputSchema } from "../utils/taskEvaluationLaunchPreparationContract";
import { configuredSceneOfferingSchema } from "../utils/configuredSceneOfferingContract";
import { canonicalArtifactDigest } from "../utils/taskCandidateContract";
import { sealRigidTaskSuccessContract } from "../utils/rigidTaskSuccessContract";
import {
  buildTaskEvaluationLaunchSubmissionSignature,
  TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
} from "../utils/taskEvaluationLaunchSubmissionAuth";
import pipelineConfiguredSceneOffering from "./fixtures/pipeline-configured-scene-offering.v1.json";

const realFetch = globalThis.fetch.bind(globalThis);
const LAUNCH_SUBMIT_SECRET = "task-evaluation-launch-submit-secret-0123456789abcdef";

const state = vi.hoisted(() => ({
  records: new Map<string, Record<string, any>>(),
  blobs: new Map<string, Buffer>(),
  launchProfiles: null as Record<string, any>[] | null,
  launchForwardFailuresRemaining: 0,
  hangTransaction: false,
  isOps: true,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => {
  const reference = (id: string) => ({
    id,
    get: async () => {
      const record = state.records.get(id);
      return { exists: Boolean(record), data: () => record && structuredClone(record) };
    },
    set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
      state.records.set(id, options?.merge
        ? { ...(state.records.get(id) || {}), ...structuredClone(payload) }
        : structuredClone(payload));
    },
  });
  return {
    dbAdmin: {
      collection: () => ({
        doc: reference,
        where: (field: string, operator: string, value: unknown) => ({
          limit: () => ({
            get: async () => ({
              docs: Array.from(state.records.entries())
                .filter(([, record]) => operator === "in" && Array.isArray(value)
                  ? value.includes(record[field])
                  : record[field] === value)
                .map(([id, record]) => ({
                  id,
                  data: () => structuredClone(record),
                })),
            }),
          }),
        }),
      }),
      runTransaction: async <T>(callback: (transaction: any) => Promise<T>) => {
        if (state.hangTransaction) return new Promise<T>(() => undefined);
        return callback({
          get: async (ref: ReturnType<typeof reference>) => ref.get(),
          create: (ref: ReturnType<typeof reference>, payload: Record<string, unknown>) => {
            state.records.set(ref.id, structuredClone(payload));
          },
          set: (ref: ReturnType<typeof reference>, payload: Record<string, unknown>, options?: { merge?: boolean }) => {
            state.records.set(ref.id, options?.merge
              ? { ...(state.records.get(ref.id) || {}), ...structuredClone(payload) }
              : structuredClone(payload));
          },
        });
      },
    },
    storageAdmin: {
      bucket: (bucket: string) => ({
        file: (objectPath: string) => ({
          download: async () => {
            const value = state.blobs.get(`${bucket}/${objectPath}`);
            if (!value) throw new Error("fixture_blob_missing");
            return [value];
          },
        }),
      }),
    },
  };
});

vi.mock("../utils/access-control", () => ({
  hasAnyRole: async () => true,
  resolveAccessContext: async () => ({
    uid: "founder-001", email: "founder@example.com", roles: ["admin"],
    isAdmin: state.isOps, isOps: state.isOps,
  }),
}));

vi.mock("../utils/pipelineSyncSecurity", () => ({
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyPipelineSyncRequest: () => ({ ok: true, status: 200, code: "ok", message: "ok" }),
}));

const sha = (character: string) => `sha256:${character.repeat(64)}`;

function taskSuccessContract(siteId = "scene-839873", taskId = "simple-relocation") {
  return sealRigidTaskSuccessContract({
    siteId,
    taskId,
    authorSource: "compatibility_default",
    authorId: "blueprint:manipulation_strategy_defaults.v1",
    confirmationStatus: "confirmed",
    criteria: {
      destination_containment: { mode: "required", position_bounds_world_m: { minimum: [0.41, -0.21, 0.72], maximum: [0.56, -0.06, 0.79] } },
      orientation: { mode: "ignored", reference_xyzw: [0, 0, 0, 1], tolerance_rad: 0.35 },
      support: { height_mode: "required", height_interval_m: [0.72, 0.79], contact_mode: "required" },
      terminal_task_contact: { mode: "cleared" },
      gripper_state: { mode: "ignored", threshold_m: null },
      settling: { mode: "required", window_samples: 8, position_tolerance_m: 0.01, orientation_tolerance_rad: 0.08 },
      safety: { mode: "required" },
      motion: { movement_epsilon_m: 0.002, minimum_translation_m: 0.08, minimum_lift_m: null },
      temporal_invariants: { schema_version: "rigid_task_event_ledger_expectation.v1", no_drop: { mode: "ignored", minimum_fall_m: 0.02 }, maximum_task_contact_force_n: null, forbidden_contact_classes: [], containment_excursions: "forbidden", workspace_excursions: "ignored", maximum_retries: null, maximum_regrasps: null },
    },
  });
}

function directExecutionAdoption(originalReceipt: Record<string, any>) {
  const blockers = [
    "native_rigid_construction_gate_failed:base_collision_clearance",
    "native_rigid_construction_gate_failed:destination_containment",
    "native_rigid_construction_gate_failed:push_contact_maintained",
    "native_rigid_construction_gate_failed:push_path",
  ];
  const receipt: Record<string, any> = {
    schema_version: "task_evaluation_native_direct_execution_adoption.v1",
    status: "blocked",
    launch_id: originalReceipt.launch_id,
    run_id: originalReceipt.run_id,
    request_digest: originalReceipt.request_digest,
    launch_profile_id: "scene-839873-construction",
    launch_profile_digest: originalReceipt.launch_profile_digest,
    binding_digest: originalReceipt.binding_digest,
    original_launch_receipt_digest: originalReceipt.receipt_digest,
    direct_execution_kind: "canonical_allocator_manual_rescue_adopted",
    paid_execution_performed: true,
    retry_cap: 0,
    continuing_spend_from_this_run: false,
    provider_instance_id: 49349649,
    construction_gate_qualified: false,
    controls_qualified: false,
    evaluation_ready: false,
    blockers,
    website_projection: {
      configured_scene_offering_status: "configured_controls_pending",
      native_construction_status: "blocked",
      native_construction_blockers: blockers,
      controls_qualified: false,
      evaluation_ready: false,
      qualification_upgrade_performed: false,
    },
    source_receipts: {
      native_construction_result: {
        path: "/retained/native_task_arena_construction_result.v1.json",
        size_bytes: 1024,
        sha256: sha("d"),
        schema_version: "native_task_arena_construction_result.v1",
        status: "blocked",
      },
      post_teardown_provider_zero: {
        path: "/retained/post_teardown_provider_zero_receipt.json",
        size_bytes: 512,
        sha256: sha("e"),
        schema_version: "adp_paid_provider_zero.v1",
      },
    },
    history_overwritten: false,
    automatic_retry_performed: false,
    provider_mutation_performed_by_adoption: false,
    raw_secret_values_recorded: false,
    claim_boundary: "Construction evidence only; controls remain pending.",
  };
  receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
  return receipt;
}

function profile() {
  return {
    profile_id: "interiorgs-sage-franka-001",
    profile_digest: sha("a"),
    source_commit: "b".repeat(40),
    source_bundle: {
      bundle_id: "scene-001", source_kind: "interiorgs_sage",
      uri: "gs://blueprint-runs/scene-001.json", digest: sha("b"),
    },
    evaluation_run_spec: {
      uri: "gs://blueprint-runs/spec.json", digest: sha("c"),
    },
    required_controls: {
      canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
      secret_profile_id: "canonical-vast-adp",
      watchdog_required: true,
      artifact_storage_required: true,
      teardown_required: true,
      provider_zero_required: true,
      webapp_status_sync_required: true,
      retry_cap: 0,
    },
    execution_admission: {
      live_enabled: true,
      readiness_receipt: { uri: "gs://blueprint-runs/readiness.json", digest: sha("e") },
      blockers: [],
    },
    task_evaluation_run: {
      run_mode: "scene_configuration",
      team_namespace: "robot-team-001",
      scene_id: "public-scene-001",
      task_id: "rigid-relocation",
      configuration_run_id: "scene-run-001",
      evaluation_episode_executed: false,
    },
    policy_run_setup: policyRunSetup(),
    claim_ceiling: "development_only",
  };
}

function launchInput() {
  return {
    launch_id: "launch-001",
    run_id: "run-001",
    profile_id: profile().profile_id,
    profile_digest: profile().profile_digest,
    authorization_issued_at: new Date(Date.now() - 1_000).toISOString(),
    rights: {
      scope: "interiorgs_sage_simulator_evaluation",
      evidence: { uri: "firestore://authorities/rights-001", digest: sha("d") },
    },
    spend: {
      max_spend_usd: 2,
      expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    },
    confirm_execution: true,
  };
}

const immutableRef = (name: string, character = "f") => ({
  uri: `s3://blueprint-inputs/${name}.json`,
  digest: sha(character),
  size_bytes: 128,
});

const pipelineReference = (reference: Record<string, unknown>) => ({
  digest: reference.digest,
  size_bytes: reference.size_bytes,
  uri: reference.uri,
});

function configuredSceneOffering() {
  const thumbnailBytes = Buffer.from("exact-selected-frame");
  const thumbnail = {
    uri: `s3://blueprint-inputs/blueprint/arm-decision-proof-v1/configured-scenes/team/thumbnail/sha256/${crypto.createHash("sha256").update(thumbnailBytes).digest("hex")}/task-thumbnail.png`,
    digest: `sha256:${crypto.createHash("sha256").update(thumbnailBytes).digest("hex")}`,
    size_bytes: thumbnailBytes.byteLength,
  };
  const revision = immutableRef("configured/revision", "c");
  const bundle = immutableRef("configured/bundle", "d");
  const offering: Record<string, any> = {
    schema_version: "task_evaluation_configured_scene_offering.v1",
    status: "launch_ready",
    configuration_run_id: "scene-run-001",
    team_namespace: "robot-team-001",
    catalog_visibility: "team_only",
    scene_identity: { id: "public-scene-001", version: "v1" },
    task: {
      identity: { id: "rigid-relocation", version: "v1" },
      kind: "rigid_relocation",
      strategy: "planar_push",
      subject_identity: { id: "source-mug-replacement", version: "v1" },
    },
    presentation: {
      task_thumbnail: thumbnail,
      selection_receipt: immutableRef("configured/thumbnail-selection", "f"),
      selection: {
        camera_id: "camera-03",
        frame_digest: thumbnail.digest,
        rationale: "Upright wide view with the task surface visible.",
        reviewer: {
          kind: "ai",
          identity: "artifixer-independent-vision-reviewer-v1",
          runtime: "openai_agents_sdk",
          model: "gpt-5.4",
        },
      },
      selected_from_exact_reviewed_frame_count: 8,
      derived_appearance_evidence: true,
      capture_or_physical_evidence: false,
      image_bytes_modified_after_selection: false,
    },
    evaluation_preparation_binding: {
      scene_mode: "reuse_configured_revision",
      construction_mode: "reuse_configured_scene",
      task_binding_mode: "reuse_configured_template",
      configuration_source_commit: "a".repeat(40),
      configured_scene_revision: revision,
      configured_scene_revision_digest: sha("8"),
      configured_scene_bundle: bundle,
    },
    proof_boundary: {
      thumbnail_is_derived_appearance_evidence: true,
      thumbnail_is_capture_or_physical_evidence: false,
      configuration_is_policy_evaluation: false,
      configuration_is_deployment_or_safety_approval: false,
    },
    offering_digest: "",
  };
  offering.offering_digest = canonicalArtifactDigest(offering, "offering_digest");
  return offering;
}

function pausedUngradedConfiguredSceneOffering() {
  const offering = configuredSceneOffering();
  offering.status = "configured_controls_pending";
  offering.evaluation_admission = {
    zero_action_required: true,
    scripted_positive_required: true,
    learned_policy_evaluation_admitted: false,
  };
  offering.presentation.appearance_review_status = "paused_ungraded";
  offering.presentation.selection.appearance_review_status = "paused_ungraded";
  offering.presentation.selection.reviewer = {
    kind: "system",
    identity: "deterministic_ungraded_thumbnail_selector",
    runtime: "blueprint_pipeline",
    model: "none",
  };
  offering.presentation.selected_from_exact_reviewed_frame_count = 0;
  offering.presentation.warning_label = "Visual review paused - appearance ungraded";
  offering.proof_boundary.appearance_visual_review_completed = false;
  offering.proof_boundary.appearance_quality_graded = false;
  offering.proof_boundary.appearance_review_status = "paused_ungraded";
  offering.proof_boundary.appearance_warning_label =
    "Visual review paused - appearance ungraded";
  offering.offering_digest = canonicalArtifactDigest(offering, "offering_digest");
  return offering;
}

function internalPolicyCanarySetup(
  sourceLaunchId: string,
  offering: ReturnType<typeof pausedUngradedConfiguredSceneOffering>,
) {
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
  const policy = (candidateId: string, character: string) => ({
    candidate_id: candidateId,
    display_name: candidateId === "pi05_droid" ? "PI 0.5 DROID" : "GR00T N1.7 DROID",
    checkpoint: immutableRef(`policy/${candidateId}`, character),
    adapter_id: `${candidateId}-adapter`,
    license_id: "verified-internal-use",
    compatibility: {
      robot_preset_ids: ["franka_panda_robotiq_2f85_v1"],
      embodiment_ids: ["franka_panda_robotiq_2f85_v1"],
      observation_schema_ids: ["droid-observation-v1"],
      action_schema_ids: ["droid-action-v1"],
      simulator_runtime_ids: ["isaac-sim-policy-v1"],
      task_family_ids: ["rigid-relocation-v1"],
    },
    readiness: {
      status: "verified_runnable",
      receipt: immutableRef(`readiness/${candidateId}`, character),
      reason: null,
    },
  });
  const quick = {
    preset_id: "quick_10",
    label: "Quick",
    episodes_per_policy: 10,
    availability: "enabled",
    recommended: true,
    matrix: {
      matrix_digest: canonicalArtifactDigest(
        { ordered_cells: cells },
        "__no_digest_field__",
      ),
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
      duration_minutes: { minimum: 20, maximum: 60 },
      maximum_authorized_cost_usd: 4,
      hard_ttl_seconds: 9_000,
      basis_digest: sha("b"),
      as_of: "2026-09-02T00:00:00.000Z",
    },
  };
  const unavailable = (presetId: "standard_100" | "deep_500", label: "Standard" | "Deep", episodes: 100 | 500) => ({
    ...quick,
    preset_id: presetId,
    label,
    episodes_per_policy: episodes,
    availability: "coming_later",
    recommended: false,
    matrix: {
      ...quick.matrix,
      cells: [],
      matrix_digest: canonicalArtifactDigest(
        { ordered_cells: [] },
        "__no_digest_field__",
      ),
    },
  });
  const successContract = taskSuccessContract(
    offering.scene_identity.id,
    offering.task.identity.id,
  );
  const setup: Record<string, any> = {
    schema_version: "task_evaluation_policy_canary_setup.v1",
    source_launch_id: sourceLaunchId,
    offering_digest: offering.offering_digest,
    scene_revision_digest:
      offering.evaluation_preparation_binding.configured_scene_revision_digest,
    run_kind: "internal_policy_canary",
    claim_ceiling: "diagnostic_policy_execution",
    registry_digest: sha("e"),
    robot_presets: [{
      robot_preset_id: "franka_panda_robotiq_2f85_v1",
      display_name: "Franka Panda + Robotiq 2F-85",
      embodiment_id: "franka_panda_robotiq_2f85_v1",
      task_family_id: "rigid-relocation-v1",
      simulator_runtime_id: "isaac-sim-policy-v1",
      runtime_image: immutableRef("policy/runtime", "f"),
      observation_schema: {
        schema_id: "droid-observation-v1",
        cameras: ["external", "wrist"],
        modalities: ["rgb", "proprioception"],
      },
      action_schema: {
        schema_id: "droid-action-v1",
        space: "cartesian-delta",
        control_hz: 15,
      },
      readiness: {
        status: "verified_runnable",
        receipt: immutableRef("readiness/runtime", "f"),
        reason: null,
      },
      policy_candidates: [
        policy("pi05_droid", "1"),
        policy("groot_n17_droid", "2"),
      ],
    }],
    episode_presets: [
      quick,
      unavailable("standard_100", "Standard", 100),
      unavailable("deep_500", "Deep", 500),
    ],
    diagnostics: {
      zero_action: "nonblocking",
      deterministic_scripted_positive: "nonblocking",
    },
    task_success_contract: successContract,
    task_success_contract_digest: successContract.contract_digest,
    setup_digest: "",
  };
  setup.setup_digest = canonicalArtifactDigest(setup, "setup_digest");
  return setup;
}

function internalPolicyCanaryProfile(
  sourceLaunchId: string,
  offering: ReturnType<typeof pausedUngradedConfiguredSceneOffering>,
) {
  return {
    ...profile(),
    profile_id: "scene-policy-canary-profile-v1",
    profile_digest: sha("3"),
    claim_ceiling: "diagnostic_policy_execution",
    required_authorization: { max_spend_usd: 4, hard_ttl_seconds: 9_000 },
    internal_policy_canary_setup: internalPolicyCanarySetup(sourceLaunchId, offering),
  };
}

function internalPolicyCanarySelection(
  runId: string,
  setup: ReturnType<typeof internalPolicyCanarySetup>,
) {
  return {
    schema_version: "task_evaluation_policy_canary_selection.v1",
    run_kind: "internal_policy_canary",
    claim_ceiling: "diagnostic_policy_execution",
    run_id: runId,
    offering_digest: setup.offering_digest,
    setup_digest: setup.setup_digest,
    scene_revision_digest: setup.scene_revision_digest,
    robot_preset_id: "franka_panda_robotiq_2f85_v1",
    policy_candidate_ids: ["pi05_droid", "groot_n17_droid"],
    episode_preset_id: "quick_10",
    variation_matrix_digest: setup.episode_presets[0].matrix.matrix_digest,
    task_success_contract: setup.task_success_contract,
    notification: {
      email: "founder@example.com",
      notify_on: ["completed", "blocked", "cancelled"],
    },
    authorization: {
      maximum_cost_usd: 4,
      hard_ttl_seconds: 9_000,
      maximum_provider_allocations: 1,
      retry_cap: 0,
    },
    episode_interpretation: {
      enabled: true,
      external_disclosure_authorized: true,
      provider_training_authorized: false,
      public_redistribution_authorized: false,
      maximum_cost_usd: 1.5,
    },
    confirm_unqualified_execution: true,
  };
}

function evaluationReadyConfiguredSceneOffering() {
  const offering = configuredSceneOffering();
  offering.status = "evaluation_ready";
  offering.evaluation_admission = {
    zero_action_required: true,
    scripted_positive_required: true,
    learned_policy_evaluation_admitted: true,
  };
  offering.offering_digest = canonicalArtifactDigest(offering, "offering_digest");
  return offering;
}

it("refuses an offering whose thumbnail cannot cross the private proxy ceiling", () => {
  const oversized = configuredSceneOffering();
  oversized.presentation.task_thumbnail.size_bytes = 16 * 1024 * 1024 + 1;
  oversized.offering_digest = canonicalArtifactDigest(oversized, "offering_digest");
  expect(configuredSceneOfferingSchema.safeParse(oversized).success).toBe(false);
});

it("refuses launch-ready offerings with unreachable artifact schemes", () => {
  const unreachable = configuredSceneOffering();
  unreachable.presentation.task_thumbnail.uri = "file:///tmp/task-thumbnail.png";
  unreachable.offering_digest = canonicalArtifactDigest(unreachable, "offering_digest");
  expect(configuredSceneOfferingSchema.safeParse(unreachable).success).toBe(false);
});

it("accepts the exact configured-scene offering shape emitted by Pipeline", () => {
  expect(configuredSceneOfferingSchema.safeParse(pipelineConfiguredSceneOffering).success).toBe(true);
});

it("accepts only a visibly ungraded configured-scene offering when review is paused", () => {
  const offering = pausedUngradedConfiguredSceneOffering();
  expect(configuredSceneOfferingSchema.safeParse(offering).success).toBe(true);

  delete offering.presentation.warning_label;
  offering.offering_digest = canonicalArtifactDigest(offering, "offering_digest");
  expect(configuredSceneOfferingSchema.safeParse(offering).success).toBe(false);
});

function preparationInput() {
  const ref = (name: string) => immutableRef(name);
  return {
    schema_version: "task_evaluation_launch_preparation_request.v1",
    run_mode: "scene_configuration",
    expected_production_commit: "a".repeat(40),
    preparation_id: "prep-scene-001",
    team_namespace: "robot-team-001",
    run_id: "run-prep-001",
    scene: {
      mode: "configure_source_scene",
      identity: { id: "public-scene-001", version: "v1" },
      source_manifest: ref("source-manifest"),
      appearance: {
        kind: "interiorgs", representation: ref("appearance"),
        renderer_qualification: ref("renderer-qualification"),
      },
      geometry: {
        kind: "sage_derived", collision: ref("collision"), validation: ref("geometry-validation"),
      },
      registration: {
        metric_registration: ref("metric-registration"), support_plane: ref("support-plane"),
        robot_mount_interface: ref("robot-mount-interface"),
        workspace_clearance: ref("workspace-clearance"),
        camera_calibration: ref("camera-calibration"),
      },
      rights: {
        admission: ref("scene-rights"),
        evidence: [
          { role: "publisher_terms", artifact: ref("publisher-terms") },
          { role: "human_authority_record", artifact: ref("human-rights-authority") },
        ],
        source_bytes_redistributable: false,
        provider_disclosure_scope: "derived_only",
      },
    },
    construction: {
      mode: "production_recipe",
      recipe: ref("scene-construction-recipe"),
      output_identity: { id: "public-scene-001-configured", version: "v1" },
    },
    task: {
      identity: { id: "rigid-relocation", version: "v1" },
      binding_mode: "define_configuration_template",
      definition: ref("task-definition"),
      kind: "rigid_relocation", strategy: "planar_push",
      subject: {
        mode: "construct_from_scene_object",
        identity: { id: "source-mug-replacement", version: "v1" },
        representation_kind: "simready_usd",
        source_object: ref("task-source-object"),
        rights_admission: ref("task-subject-rights-admission"),
        provider_disclosure_allowed: true,
      },
      success_criteria: ref("success-criteria"), execution: ref("execution-spec"),
    },
    sensors: { configuration: ref("sensor-config") },
    runtime: {
      identity: { id: "native-arena", version: "v1" },
      oci_image: `registry.example/native-arena@${sha("e")}`,
      entrypoint: ["/app/run-task-evaluation"], health_protocol: ref("health-protocol"),
      requirements: { cpu_cores: 8, memory_gib: 32, gpu_count: 1, disk_gib: 80 },
      network: { default: "deny", allowlist: [] }, secret_refs: [],
      mounts: [
        { source: ref("input-bundle"), container_path: "/inputs", mode: "read_only" },
        { container_path: "/outputs", mode: "output" },
      ],
      output_limit_bytes: 1_073_741_824,
    },
    execution_adapter: {
      kind: "scene_configuration_pipeline", version: "v1",
      runtime_source_bundle: ref("runtime-source.zip"),
    },
    publication: {
      input_namespace: "robot-team-001-public-scene-001-v1",
      service_account_readback_required: true,
    },
    spend: {
      maximum_hourly_rate_usd: 0.8, hard_cap_usd: 12, hard_ttl_seconds: 27_000,
      provider_compute_spend_cap_usd: 6,
      external_service_caps: {
        openai: {
          maximum_cost_usd: 6,
          maximum_requests: 32,
          stage_max_cost_usd: {
            artifixer_semantic_teacher: 4.8,
            artifixer_visual_review: 0.64,
            content_agents: 0.2,
          },
        },
      },
      retry_cap: 0, selected_provider: "vast", provider_allowlist: ["vast"],
    },
  };
}

function discoveryInput() {
  return {
    schema_version: "scene_object_discovery_request.v1",
    discovery_id: "discover-scene-001",
    expected_production_commit: "a".repeat(40),
    team_namespace: "robot-team-001",
    scene: {
      identity: { id: "public-scene-001", version: "v1" },
      source_splat: immutableRef("source-splat"),
      scene_analysis: immutableRef("scene-analysis"),
      metric_registration: immutableRef("metric-registration"),
      renderer_qualification: immutableRef("renderer-qualification"),
      retained_gaussian_count: 1234,
    },
    task: {
      kind: "rigid_relocation",
      strategy: "pick_and_place",
      task_statement: "Pick the red tote",
      target_hint: "red tote",
    },
    analysis: {
      analyzers: ["splat_analyzer", "sam31"],
      prompts: ["red tote", "container"],
      minimum_confidence: 0.5,
      minimum_task_relevance: 0.5,
      require_metric_source_object: true,
      full_scene_survey_required: true,
    },
    rights: {
      admission: immutableRef("discovery-rights"),
      human_authority_record: immutableRef("discovery-human-authority"),
      source_bytes_redistributable: false,
      provider_disclosure_scope: "derived_only",
    },
    execution: { mode: "qualified_local_runtime" },
    publication: {
      input_namespace: "robot-team-001-public-scene-001-discovery",
      service_account_readback_required: true,
    },
  };
}

function evaluationPreparationInput() {
  const input: any = preparationInput();
  input.run_mode = "episode_evaluation";
  input.preparation_id = "prep-scene-001-zero";
  input.run_id = "run-scene-001-zero";
  input.scene = {
    mode: "reuse_configured_revision",
    identity: { id: "public-scene-001", version: "v1" },
    configured_revision: immutableRef("configured-scene-revision", "8"),
  };
  input.construction = {
    mode: "reuse_configured_scene",
  };
  input.robot = {
    identity: { id: "fixed-arm", version: "v1" },
    configuration: immutableRef("robot-config"),
    kinematics: immutableRef("kinematics"),
    joint_bounds: immutableRef("joint-bounds"),
    base_registration: immutableRef("robot-base-registration"),
    controller_configuration: immutableRef("controller-config"),
  };
  input.controller = {
    identity: { id: "zero-action", version: "v1" },
    kind: "zero_action",
    configuration: immutableRef("zero-action-controller"),
  };
  input.task = {
    identity: { id: "rigid-relocation", version: "v1" },
    binding_mode: "reuse_configured_template",
    kind: "rigid_relocation",
    strategy: "planar_push",
    configured_scene_revision_digest: sha("8"),
    subject: {
    mode: "configured_scene_object",
    identity: { id: "source-mug-replacement", version: "v1" },
    physics_authority: "configured_scene_revision",
    },
  };
  input.execution_adapter.kind = "native_task_arena";
  input.spend.hard_cap_usd = 0.75;
  input.spend.hard_ttl_seconds = 3_300;
  delete input.spend.provider_compute_spend_cap_usd;
  delete input.spend.external_service_caps;
  return input;
}

function policyRunSetup() {
  const template: Record<string, any> = evaluationPreparationInput();
  delete template.expected_production_commit;
  delete template.run_mode;
  delete template.preparation_id;
  delete template.team_namespace;
  delete template.run_id;
  delete template.policy_run_configuration;
  delete template.policy_run_setup;
  delete template.policy_run_selection;
  delete template.publication.input_namespace;
  template.schema_version = "task_evaluation_policy_run_preparation_template.v1";
  template.template_digest = "";
  template.template_digest = canonicalArtifactDigest(template, "template_digest");
  const families = [
    "canonical_anchor",
    "placement_approach", "placement_approach",
    "illumination", "camera_sensor", "bounded_physics",
    "pairwise", "pairwise", "held_out", "held_out",
  ];
  const setup: Record<string, any> = {
    schema_version: "task_evaluation_policy_run_setup.v1",
    source_launch_id: "evaluation-launch-001",
    offering_digest: evaluationReadyConfiguredSceneOffering().offering_digest,
    embodiment_id: "franka_panda_robotiq_2f85_v1",
    candidate_ids: ["pi05_droid", "groot_n17_droid"],
    matrix_profile_id: "franka_rigid_relocation_nested_v1",
    preregistration: immutableRef("policy-matrix-preregistration", "7"),
    scenario_compiler: {
      compiler_id: "franka_rigid_relocation_nested_prefix",
      compiler_version: "v1",
      selection_rule: "published_ordered_prefix",
      outcome_independent: true,
      agent_may_select_cells: false,
    },
    presets: [
      {
        preset_id: "quick_10", label: "Quick", scenario_count_per_policy: 10,
        availability: "enabled", default: true,
        family_counts: {
          canonical_anchor: 1, placement_approach: 2, illumination: 1,
          camera_sensor: 1, bounded_physics: 1, pairwise: 2, held_out: 2,
        },
        scenario_set_digest: sha("1"), parent_preset_id: null, parent_prefix_count: 0,
        nesting_proof_digest: sha("2"), estimate: { status: "unavailable" },
        cells: families.map((family, index) => ({
          cell_id: `quick-${index + 1}`,
          family,
          partition: family === "held_out" ? "held_out" : "qualification",
          scored: true,
          cell_spec_digest: sha(String((index + 1) % 10)),
        })),
      },
      {
        preset_id: "standard_100", label: "Standard", scenario_count_per_policy: 100,
        availability: "coming_later", default: false,
        family_counts: {
          canonical_anchor: 1, placement_approach: 24, illumination: 12,
          camera_sensor: 12, bounded_physics: 12, pairwise: 19, held_out: 20,
        },
        scenario_set_digest: sha("3"), parent_preset_id: "quick_10", parent_prefix_count: 10,
        nesting_proof_digest: sha("4"), estimate: { status: "unavailable" },
      },
      {
        preset_id: "deep_500", label: "Deep", scenario_count_per_policy: 500,
        availability: "coming_later", default: false,
        family_counts: {
          canonical_anchor: 1, placement_approach: 124, illumination: 62,
          camera_sensor: 62, bounded_physics: 62, pairwise: 94, held_out: 95,
        },
        scenario_set_digest: sha("5"), parent_preset_id: "standard_100", parent_prefix_count: 100,
        nesting_proof_digest: sha("6"), estimate: { status: "unavailable" },
      },
    ],
    preparation_template: template,
    setup_digest: "",
  };
  setup.presets[0].scenario_set_digest = canonicalArtifactDigest(
    { ordered_cells: setup.presets[0].cells },
    "scenario_set_digest",
  );
  for (const preset of setup.presets) preset.nesting_proof_digest = canonicalArtifactDigest({
    preset_id: preset.preset_id,
    scenario_set_digest: preset.scenario_set_digest,
    parent_preset_id: preset.parent_preset_id,
    parent_prefix_count: preset.parent_prefix_count,
    selection_rule: "published_ordered_prefix",
  }, "nesting_proof_digest");
  setup.setup_digest = canonicalArtifactDigest(setup, "setup_digest");
  return setup;
}

function activationInput() {
  const preparation = preparationInput();
  return {
    schema_version: "task_evaluation_launch_activation_request.v1",
    expected_production_commit: preparation.expected_production_commit,
    activation_id: "activate-scene-001-construction",
    team_namespace: preparation.team_namespace,
    lane: "native_task_arena_construction",
    preparation: {
      preparation_id: preparation.preparation_id,
      request_digest: canonicalArtifactDigest(preparation, "request_digest"),
      result_digest: sha("9"),
    },
    release_window: immutableRef("release-window", "1"),
    lineage: {
      kind: "initial_project",
      project_spend_reconciliation: immutableRef("project-spend-reconciliation", "2"),
      initial_provider_zero: immutableRef("initial-provider-zero", "3"),
    },
    authorization: {
      reference: "founder approval 2026-08-25",
      authorized_by: "founder-001",
      authorized_on: "2026-08-25T16:00:00.000Z",
      standing_authorization_expires_at: "2026-08-25T17:00:00.000Z",
      profile_revision: "scene-001-construction-r1",
    },
    requested_mutations: {
      profile_publication: true,
      catalog_synchronization: true,
      standing_authorization: true,
    },
  };
}

function terminalBlockedLaunchRecord() {
  const requestDigest = sha("a");
  return {
    schema_version: "task_evaluation_launch_web_record.v1",
    launch_id: "launch-001",
    run_id: "run-001",
    request_digest: requestDigest,
    state: "control_plane_terminal_blocked",
    terminal_receipt_present: false,
    provider_mutation_observed: false,
    paid_execution_retry_performed: false,
    control_plane_terminal_blocker: {
      schema_version: "task_evaluation_launch_control_plane_blocker.v1",
      status: "blocked",
      code: "control_plane_terminal_receipt_missing_after_spend_authority_expiry",
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: requestDigest,
      spend_authority_expires_at: "2026-08-10T12:30:00.000Z",
      observed_at_iso: "2026-08-10T12:31:00.000Z",
      pipeline_terminal_receipt_observed: false,
      provider_mutation_performed_by_webapp: false,
      paid_execution_retry_performed: false,
      execution_result: "not_observed",
      scripted_positive_controls_result: "not_observed",
      learned_policy_result: "not_observed",
    },
  };
}

async function startServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import("../routes/admin-task-evaluation-launches");
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.firebaseUser = { uid: "founder-001", admin: true };
    next();
  });
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function startInternalServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import("../routes/internal-task-evaluation-launches");
  const app = express();
  app.use(express.json());
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function startTeamOfferingServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import("../routes/configured-scene-offerings");
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.firebaseUser = {
      uid: "team-member-001",
      tenantId: "robot-team-001",
    };
    next();
  });
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function startSubmissionServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import("../routes/internal-task-evaluation-launch-submissions");
  const app = express();
  app.use(express.json({
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: string }).rawBody = buffer.toString("utf8");
    },
  }));
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function startPreparationSubmissionServer(): Promise<{ server: Server; url: string }> {
  const { default: router } = await import(
    "../routes/internal-task-evaluation-launch-preparations"
  );
  const app = express();
  app.use(express.json({
    verify: (req, _res, buffer) => {
      (req as express.Request & { rawBody?: string }).rawBody = buffer.toString("utf8");
    },
  }));
  app.use(router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address unavailable");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

function signedSubmissionHeaders(body: string, idempotencyKey = "launch-001") {
  const timestamp = new Date().toISOString();
  const nonce = `test-nonce-${crypto.randomUUID()}`;
  return {
    "content-type": "application/json",
    "idempotency-key": idempotencyKey,
    "x-blueprint-launch-timestamp": timestamp,
    "x-blueprint-launch-client-id": TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
    "x-blueprint-launch-nonce": nonce,
    "x-blueprint-launch-signature": buildTaskEvaluationLaunchSubmissionSignature({
      secret: LAUNCH_SUBMIT_SECRET,
      timestamp,
      clientId: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
      nonce,
      body,
    }),
  };
}

beforeEach(() => {
  state.records.clear();
  state.blobs.clear();
  state.launchProfiles = null;
  state.launchForwardFailuresRemaining = 0;
  state.hangTransaction = false;
  state.isOps = true;
  process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON = JSON.stringify([profile()]);
  process.env.TASK_EVALUATION_LAUNCH_URL = "https://pipeline.example/launches";
  process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN = "forward-secret";
  process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_SECRET = LAUNCH_SUBMIT_SECRET;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("http://127.0.0.1:")) {
      return realFetch(url, init);
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-profiles") {
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_launch_profile_catalog.v1",
        profiles: state.launchProfiles || [profile()],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://pipeline.example/task-evaluation-configured-scene-artifact-readback") {
      return new Response(Buffer.from("exact-selected-frame"), {
        status: 200,
        headers: { "content-type": "image/png" },
      });
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations") {
      const request = JSON.parse(String(init?.body || "{}"));
      const receipt: Record<string, unknown> = {
        schema_version: "task_evaluation_launch_preparation_intake_receipt.v1",
        status: "queued_for_no_spend_preparation",
        accepted: true,
        already_exists: false,
        preparation_id: request.preparation_id,
        run_id: request.run_id,
        team_namespace: request.team_namespace,
        request_digest: canonicalArtifactDigest(request, "request_digest"),
        expected_production_commit: request.expected_production_commit,
        provider_mutation_performed_inside_http_request: false,
        catalog_mutation_performed_inside_http_request: false,
        paid_execution_requested: false,
        canonical_allocator_required_for_later_execution: true,
        receipt_digest: "",
      };
      receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
      return new Response(JSON.stringify(receipt), {
        status: 202, headers: { "content-type": "application/json" },
      });
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations/prep-scene-001") {
      const request = preparationInput();
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_launch_preparation_status.v1",
        status: "materialized",
        preparation_id: request.preparation_id,
        run_mode: request.run_mode,
        run_id: request.run_id,
        team_namespace: request.team_namespace,
        expected_production_commit: request.expected_production_commit,
        request_digest: canonicalArtifactDigest(request, "request_digest"),
        worker_status: "queued_for_production_scene_configuration",
        construction_orchestration_id: request.preparation_id,
        construction_queue_envelope_digest: sha("8"),
        automatic_progression_required: true,
        source_commit: request.expected_production_commit,
        result_digest: sha("9"),
        reference_count: 24,
        full_byte_service_account_readback_passed: true,
        blockers: [],
        provider_mutation_performed_by_status_read: false,
        provider_mutation_performed_by_worker: false,
        catalog_mutation_performed_by_worker: false,
        paid_execution_requested: false,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://pipeline.example/api/live-pipeline/scene-object-discoveries") {
      const request = JSON.parse(String(init?.body || "{}"));
      const receipt: Record<string, unknown> = {
        schema_version: "scene_object_discovery_intake_receipt.v1",
        status: "queued_for_no_spend_discovery_preparation",
        accepted: true,
        already_exists: false,
        discovery_id: request.discovery_id,
        team_namespace: request.team_namespace,
        request_digest: canonicalArtifactDigest(request, "request_digest"),
        expected_production_commit: request.expected_production_commit,
        provider_mutation_performed_inside_http_request: false,
        paid_execution_requested: false,
        canonical_allocator_required_for_provider_execution: true,
        receipt_digest: "",
      };
      receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
      return new Response(JSON.stringify(receipt), {
        status: 202, headers: { "content-type": "application/json" },
      });
    }
    if (url === "https://pipeline.example/api/live-pipeline/scene-object-discoveries/discover-scene-001") {
      const request = discoveryInput();
      return new Response(JSON.stringify({
        schema_version: "scene_object_discovery_status.v1",
        status: "selection_required",
        discovery_id: request.discovery_id,
        team_namespace: request.team_namespace,
        expected_production_commit: request.expected_production_commit,
        request_digest: canonicalArtifactDigest(request, "request_digest"),
        discovery_digest: sha("7"),
        source_commit: request.expected_production_commit,
        candidates: [
          {
            candidate_id: "sam31-tote-001",
            label: "red tote",
            backend: "sam31",
            confidence: 0.94,
            task_match_score: 0.9,
            eligible_for_automatic_source_object: true,
            candidate_claim_boundary: "metric_source_object_candidate",
          },
          {
            candidate_id: "splat-box-001",
            label: "red tote rough box",
            backend: "splat_analyzer",
            confidence: 0.88,
            task_match_score: 0.8,
            eligible_for_automatic_source_object: false,
            candidate_claim_boundary: "model_derived_visual_candidate_not_metric_source_object",
          },
        ],
        selected_candidate_id: null,
        source_object: null,
        unseen_regions: ["behind_uncaptured_partition"],
        blockers: [],
        provider_mutation_performed_by_status_read: false,
        paid_execution_performed: false,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url === "https://pipeline.example/api/live-pipeline/scene-object-discoveries/discover-scene-001/selection") {
      const request = JSON.parse(String(init?.body || "{}"));
      const selectionDigest = canonicalArtifactDigest(request, "selection_digest");
      const receipt: Record<string, unknown> = {
        schema_version: "scene_object_discovery_selection_receipt.v1",
        status: "selection_sealed",
        discovery_id: request.discovery_id,
        request_digest: request.request_digest,
        discovery_digest: request.discovery_digest,
        candidate_id: request.candidate_id,
        selection_digest: selectionDigest,
        provider_mutation_performed_inside_http_request: false,
        paid_execution_requested: false,
        receipt_digest: "",
      };
      receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
      return new Response(JSON.stringify(receipt), {
        status: 202, headers: { "content-type": "application/json" },
      });
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-activations") {
      const request = JSON.parse(String(init?.body || "{}"));
      const receipt: Record<string, unknown> = {
        schema_version: "task_evaluation_launch_activation_intake_receipt.v1",
        status: "queued_for_authority_gated_activation",
        accepted: true,
        already_exists: false,
        activation_id: request.activation_id,
        preparation_id: request.preparation.preparation_id,
        team_namespace: request.team_namespace,
        lane: request.lane,
        expected_production_commit: request.expected_production_commit,
        request_digest: canonicalArtifactDigest(request, "request_digest"),
        provider_mutation_performed_inside_http_request: false,
        catalog_mutation_performed_inside_http_request: false,
        standing_authorization_published_inside_http_request: false,
        paid_execution_requested: false,
        receipt_digest: "",
      };
      receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
      return new Response(JSON.stringify(receipt), {
        status: 202, headers: { "content-type": "application/json" },
      });
    }
    if (url === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-activations/activate-scene-001-construction") {
      const request = activationInput();
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_launch_activation_status.v1",
        status: "prepared",
        activation_id: request.activation_id,
        preparation_id: request.preparation.preparation_id,
        team_namespace: request.team_namespace,
        lane: request.lane,
        expected_production_commit: request.expected_production_commit,
        request_digest: canonicalArtifactDigest(request, "request_digest"),
        worker_status: "profile_authority_materialized_no_execution",
        result_digest: sha("4"),
        profile_id: "scene-001-construction-r1",
        profile_digest: sha("5"),
        profile_publication_receipt_digest: sha("6"),
        standing_authorization_digest: sha("7"),
        blockers: [],
        provider_mutation_performed_by_status_read: false,
        provider_mutation_performed_by_worker: false,
        paid_execution_requested: false,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (
      url === "https://pipeline.example/launches"
      && state.launchForwardFailuresRemaining > 0
    ) {
      state.launchForwardFailuresRemaining -= 1;
      return new Response(JSON.stringify({ error: "temporary intake refusal" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    }
    const request = JSON.parse(String(init?.body || "{}"));
    return new Response(JSON.stringify({
      schema_version: "task_evaluation_launch_intake_receipt.v1",
      status: "accepted",
      provider_mutation_performed_inside_http_request: false,
      queue: {
        schema_version: "task_evaluation_launch_queue_receipt.v1",
        status: "queued",
        launch_id: request.launch_id,
        run_id: request.run_id,
        request_digest: request.request_digest,
        provider_mutation_performed: false,
      },
    }), { status: 202, headers: { "content-type": "application/json" } });
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON;
  delete process.env.TASK_EVALUATION_LAUNCH_PROFILES_URL;
  delete process.env.TASK_EVALUATION_LAUNCH_URL;
  delete process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN;
  delete process.env.TASK_EVALUATION_LAUNCH_STORE_TIMEOUT_MS;
  delete process.env.BLUEPRINT_TASK_EVALUATION_LAUNCH_SUBMIT_SECRET;
});

describe("admin Task Evaluation launch route", () => {
  it("accepts only an exact digest-bound configured-scene public display authorization", () => {
    const input = preparationInput() as any;
    const authority = {
      schema_version: "task_evaluation_configured_scene_public_display_authorization.v1",
      status: "authorized",
      scope: "configured_scene_derived_listing",
      scene_identity: input.scene.identity,
      task_identity: input.task.identity,
      subject_identity: input.task.subject.identity,
      rights_admission_digest: input.scene.rights.admission.digest,
      human_authority_record_digest: input.scene.rights.evidence[1].artifact.digest,
      public_slug: "scene-001-planar-push",
      title: "Planar Push Scene",
      summary: "A robot-neutral configured scene for a planar push task.",
      category: "Manipulation",
      allowed_fields: [
        "status", "scene_identity", "task_identity", "task_kind", "task_strategy",
        "public_title", "public_summary", "public_category", "thumbnail", "proof_boundary",
      ],
      thumbnail_publication_authorized: true,
      derived_metadata_publication_authorized: true,
      private_artifact_uri_publication_authorized: false,
      raw_media_publication_authorized: false,
      authority_reference: "owner-public-display-authorization-20260828",
      authorized_by: "blueprint-owner",
      authorization_digest: "",
    };
    authority.authorization_digest = canonicalArtifactDigest(authority, "authorization_digest");
    input.scene.rights.public_display_authorization = authority;

    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(input).success).toBe(true);

    authority.human_authority_record_digest = sha("e");
    authority.authorization_digest = canonicalArtifactDigest(authority, "authorization_digest");
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(input).success).toBe(false);
  });

  it("scopes the seven-hour authority to scene configuration", () => {
    expect(
      taskEvaluationLaunchPreparationInputSchema.safeParse(preparationInput()).success,
    ).toBe(true);

    const shortScene = preparationInput();
    shortScene.spend.hard_ttl_seconds = 9_000;
    expect(
      taskEvaluationLaunchPreparationInputSchema.safeParse(shortScene).success,
    ).toBe(false);

    const widenedEpisode = evaluationPreparationInput();
    widenedEpisode.spend.hard_cap_usd = 10;
    widenedEpisode.spend.hard_ttl_seconds = 25_200;
    expect(
      taskEvaluationLaunchPreparationInputSchema.safeParse(widenedEpisode).success,
    ).toBe(false);
  });

  it("forbids new appearance-review pause overrides", () => {
    const paused = preparationInput();
    (paused as Record<string, any>).appearance_review_override = {
      mode: "paused_ungraded",
      scope: "artifixer_appearance_only",
      ungraded_publication_acknowledged: true,
      review_provider_call_permitted: false,
      warning_label: "Visual review paused - appearance ungraded",
    };
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(paused).success)
      .toBe(false);

    const episode = evaluationPreparationInput();
    (episode as Record<string, any>).appearance_review_override = {
      mode: "paused_ungraded",
      scope: "artifixer_appearance_only",
      ungraded_publication_acknowledged: true,
      review_provider_call_permitted: false,
      warning_label: "Visual review paused - appearance ungraded",
    };
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(episode).success)
      .toBe(false);
  });

  it("requires a distinct qualified destination for pick-and-place", () => {
    const input = evaluationPreparationInput();
    input.task.strategy = "pick_and_place";
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(input).success)
      .toBe(false);

    input.task.destination = {
      schema_version: "task_evaluation_rigid_destination_asset.v1",
      identity: { id: "document-tray", version: "v1" },
      relation: "inside",
      visible_label: "blue document tray",
      asset: immutableRef("document-tray.usda"),
      rights_admission: immutableRef("document-tray-rights"),
      static_qualification: immutableRef("document-tray-static"),
      native_import_qualification: immutableRef("document-tray-native"),
      geometry: immutableRef("document-tray-geometry"),
      pose_world: {
        position_world_m: [3.2, -6.76, 0.82],
        orientation_xyzw: [0, 0, 0, 1],
      },
      provider_disclosure_allowed: true,
    };
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(input).success)
      .toBe(true);

    input.task.destination.identity = input.task.subject.identity;
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(input).success)
      .toBe(false);
  });

  it("reserves one selective Artifixer repair and second independent review", () => {
    const repairReady = preparationInput();
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(repairReady).success)
      .toBe(true);

    const firstPassOnly = preparationInput();
    firstPassOnly.spend.hard_cap_usd = 10;
    firstPassOnly.spend.external_service_caps.openai.maximum_cost_usd = 3;
    firstPassOnly.spend.external_service_caps.openai.stage_max_cost_usd = {
      artifixer_semantic_teacher: 2.4,
      artifixer_visual_review: 0.32,
      content_agents: 0.2,
    };
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(firstPassOnly).success)
      .toBe(false);
  });

  it("requires scene configuration authority to fund every admitted OpenAI stage", () => {
    const underfundedCases: Array<[string, (input: ReturnType<typeof preparationInput>) => void]> = [
      ["semantic teacher", (input) => {
        input.spend.external_service_caps.openai.stage_max_cost_usd
          .artifixer_semantic_teacher = 2.39;
      }],
      ["visual review", (input) => {
        input.spend.external_service_caps.openai.stage_max_cost_usd
          .artifixer_visual_review = 0.29;
      }],
      ["content agents", (input) => {
        input.spend.external_service_caps.openai.stage_max_cost_usd
          .content_agents = 0.19;
      }],
      ["external aggregate", (input) => {
        input.spend.external_service_caps.openai.maximum_cost_usd = 2.89;
      }],
      ["parent attempt", (input) => {
        input.spend.hard_cap_usd = 9.99;
      }],
      ["provider compute", (input) => {
        input.spend.provider_compute_spend_cap_usd = 5.99;
      }],
    ];

    for (const [, mutate] of underfundedCases) {
      const input = preparationInput();
      mutate(input);
      expect(taskEvaluationLaunchPreparationInputSchema.safeParse(input).success).toBe(false);
    }

    const episode = evaluationPreparationInput();
    expect(taskEvaluationLaunchPreparationInputSchema.safeParse(episode).success).toBe(true);
  });

  it("isolates the launch-ready offering catalog to the authenticated team", async () => {
    state.isOps = false;
    const own = configuredSceneOffering();
    const other = configuredSceneOffering();
    const pending = pausedUngradedConfiguredSceneOffering();
    const correctedPending = structuredClone(pending);
    correctedPending.configuration_run_id = "scene-run-002";
    correctedPending.evaluation_preparation_binding.configured_scene_revision =
      immutableRef("configured/revision-corrected", "1");
    correctedPending.evaluation_preparation_binding.configured_scene_revision_digest = sha("2");
    correctedPending.evaluation_preparation_binding.configured_scene_bundle =
      immutableRef("configured/bundle-corrected", "3");
    correctedPending.offering_digest = canonicalArtifactDigest(
      correctedPending,
      "offering_digest",
    );
    other.team_namespace = "other-team";
    other.offering_digest = canonicalArtifactDigest(other, "offering_digest");
    state.records.set("own-launch", {
      configured_scene_offering_state: "launch_ready",
      configured_scene_offering_team_namespace: own.team_namespace,
      configured_scene_offering_digest: own.offering_digest,
      configured_scene_offering: own,
    });
    state.records.set("other-launch", {
      configured_scene_offering_state: "launch_ready",
      configured_scene_offering_team_namespace: other.team_namespace,
      configured_scene_offering_digest: other.offering_digest,
      configured_scene_offering: other,
    });
    state.records.set("pending-launch", {
      configured_scene_offering_state: "configured_controls_pending",
      configured_scene_offering_team_namespace: pending.team_namespace,
      configured_scene_offering_digest: pending.offering_digest,
      configured_scene_offering: pending,
      terminal_updated_at_iso: "2026-08-30T12:00:00.000Z",
    });
    state.records.set("pending-launch-corrected", {
      // Publication recovery indexes the repaired record as launch_ready while
      // preserving its scientific controls-pending status inside the offering.
      configured_scene_offering_state: "launch_ready",
      configured_scene_offering_team_namespace: correctedPending.team_namespace,
      configured_scene_offering_digest: correctedPending.offering_digest,
      configured_scene_offering: correctedPending,
      terminal_updated_at_iso: "2026-08-31T12:00:00.000Z",
    });
    state.records.set("controls-run-without-offering", {
      configured_scene_offering_state: "configured_controls_pending",
      configured_scene_offering_team_namespace: own.team_namespace,
    });
    state.blobs.set("blueprint-inputs/configured/task-thumbnail.png", Buffer.from("exact-selected-frame"));
    const { server, url } = await startTeamOfferingServer();
    try {
      const response = await fetch(url);
      expect(response.status).toBe(200);
      const catalogBody = await response.json() as any;
      expect(catalogBody).toMatchObject({
        scope: "verified_team",
        offerings: [
          { source_launch_id: "own-launch", team_namespace: "robot-team-001" },
          {
            source_launch_id: "pending-launch-corrected",
            team_namespace: "robot-team-001",
            status: "configured_controls_pending",
            presentation: {
              appearance_review_status: "paused_ungraded",
              selected_from_exact_reviewed_frame_count: 0,
              warning_label: "Visual review paused - appearance ungraded",
            },
            proof_boundary: {
              appearance_visual_review_completed: false,
              appearance_quality_graded: false,
              appearance_review_status: "paused_ungraded",
              appearance_warning_label: "Visual review paused - appearance ungraded",
            },
          },
        ],
      });
      expect(catalogBody.offerings.map((row: any) => row.source_launch_id)).toEqual([
        "own-launch",
        "pending-launch-corrected",
      ]);
      const denied = await fetch(`${url}/other-launch/thumbnail`);
      expect(denied.status).toBe(404);
      const thumbnail = await fetch(`${url}/own-launch/thumbnail`);
      expect(thumbnail.status).toBe(200);
      expect(Buffer.from(await thumbnail.arrayBuffer())).toEqual(Buffer.from("exact-selected-frame"));

      const request = evaluationPreparationInput();
      // The offering was configured at commit A, while this future evaluator
      // preparation correctly targets the currently deployed commit B.
      request.expected_production_commit = "b".repeat(40);
      request.scene.identity = own.scene_identity;
      request.scene.configured_revision = pipelineReference(
        own.evaluation_preparation_binding.configured_scene_revision,
      );
      request.task.identity = own.task.identity;
      request.task.kind = own.task.kind;
      request.task.strategy = own.task.strategy;
      request.task.subject.identity = own.task.subject_identity;
      request.task.configured_scene_revision_digest =
        own.evaluation_preparation_binding.configured_scene_revision_digest;
      const queued = await fetch(`${url}/own-launch/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(queued.status).toBe(202);
      expect(state.records.get(request.preparation_id)).toMatchObject({
        submission: { actor_role: "team_member" },
        configured_scene_offering_binding: {
          source_launch_id: "own-launch",
          offering_digest: own.offering_digest,
          configured_scene_bundle_digest:
            own.evaluation_preparation_binding.configured_scene_bundle.digest,
          task_thumbnail_digest: own.presentation.task_thumbnail.digest,
        },
      });
      const refusedPending = await fetch(`${url}/pending-launch/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(refusedPending.status).toBe(409);
      await expect(refusedPending.json()).resolves.toMatchObject({
        code: "configured_scene_offering_controls_pending",
        paid_execution_requested: false,
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("reuses the original authorization when retrying a forward-blocked policy canary", async () => {
    state.isOps = false;
    const sourceLaunchId = "controls-pending-policy-canary";
    const offering = pausedUngradedConfiguredSceneOffering();
    const canaryProfile = internalPolicyCanaryProfile(sourceLaunchId, offering);
    const setup = canaryProfile.internal_policy_canary_setup;
    const runId = "policy-canary-retry-001";
    const body = internalPolicyCanarySelection(runId, setup);
    state.launchProfiles = [canaryProfile];
    state.launchForwardFailuresRemaining = 1;
    state.records.set(sourceLaunchId, {
      configured_scene_offering_state: offering.status,
      configured_scene_offering_team_namespace: offering.team_namespace,
      configured_scene_offering_digest: offering.offering_digest,
      configured_scene_offering: offering,
    });
    const { server, url } = await startTeamOfferingServer();
    try {
      const first = await fetch(`${url}/${sourceLaunchId}/policy-canary-runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": runId },
        body: JSON.stringify(body),
      });
      expect(first.status).toBe(503);
      await expect(first.json()).resolves.toMatchObject({
        status: "forward_blocked",
        already_exists: false,
      });
      const firstRecord = structuredClone(state.records.get(runId));
      expect(firstRecord).toMatchObject({
        state: "forward_blocked",
        forward_attempt_count: 1,
        retryable: true,
      });
      const originalAuthorizedAt = firstRecord?.request.authorization.authorized_at;
      const originalRequestDigest = firstRecord?.request_digest;

      // Ensure an implementation that hashes a fresh authorized_at cannot pass
      // accidentally because both submissions landed in the same millisecond.
      await new Promise((resolve) => setTimeout(resolve, 5));
      const retry = await fetch(`${url}/${sourceLaunchId}/policy-canary-runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": runId },
        body: JSON.stringify(body),
      });
      expect(retry.status).toBe(202);
      await expect(retry.json()).resolves.toMatchObject({
        status: "queued",
        already_exists: true,
        run: {
          request_digest: originalRequestDigest,
          forward_attempt_count: 2,
          error: null,
        },
      });
      expect(state.records.get(runId)).toMatchObject({
        state: "queued",
        request_digest: originalRequestDigest,
        forward_attempt_count: 2,
        next_forward_at_iso: null,
        retryable: false,
        error: null,
        request: {
          request_digest: originalRequestDigest,
          authorization: { authorized_at: originalAuthorizedAt },
        },
      });
      const pipelineRequests = (globalThis.fetch as any).mock.calls
        .filter(([target]: [string]) => target === "https://pipeline.example/launches")
        .map(([, init]: [string, RequestInit]) => JSON.parse(String(init.body)));
      expect(pipelineRequests).toHaveLength(2);
      expect(pipelineRequests[1]).toMatchObject({
        request_digest: originalRequestDigest,
        authorization: { authorized_at: originalAuthorizedAt },
      });
      expect(pipelineRequests[1]).toEqual(pipelineRequests[0]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("keeps a forward-blocked policy canary immutable when the selection changes", async () => {
    state.isOps = false;
    const sourceLaunchId = "controls-pending-policy-canary-conflict";
    const offering = pausedUngradedConfiguredSceneOffering();
    const canaryProfile = internalPolicyCanaryProfile(sourceLaunchId, offering);
    const setup = canaryProfile.internal_policy_canary_setup;
    const runId = "policy-canary-retry-conflict-001";
    const body = internalPolicyCanarySelection(runId, setup);
    state.launchProfiles = [canaryProfile];
    state.launchForwardFailuresRemaining = 1;
    state.records.set(sourceLaunchId, {
      configured_scene_offering_state: offering.status,
      configured_scene_offering_team_namespace: offering.team_namespace,
      configured_scene_offering_digest: offering.offering_digest,
      configured_scene_offering: offering,
    });
    const { server, url } = await startTeamOfferingServer();
    try {
      const first = await fetch(`${url}/${sourceLaunchId}/policy-canary-runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": runId },
        body: JSON.stringify(body),
      });
      expect(first.status).toBe(503);
      const originalRequestDigest = state.records.get(runId)?.request_digest;

      const changedSelection = {
        ...body,
        policy_candidate_ids: ["groot_n17_droid", "pi05_droid"],
      };
      const conflict = await fetch(`${url}/${sourceLaunchId}/policy-canary-runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": runId },
        body: JSON.stringify(changedSelection),
      });
      expect(conflict.status).toBe(409);
      await expect(conflict.json()).resolves.toMatchObject({
        error: { code: "POLICY_CANARY_IMMUTABLE_CONFLICT" },
      });
      expect(state.records.get(runId)).toMatchObject({
        state: "forward_blocked",
        request_digest: originalRequestDigest,
        forward_attempt_count: 1,
      });
      const pipelineCalls = (globalThis.fetch as any).mock.calls.filter(
        ([target]: [string]) => target === "https://pipeline.example/launches",
      );
      expect(pipelineCalls).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("projects a locked team setup and idempotently queues its exact policy matrix", async () => {
    state.isOps = false;
    const offering = evaluationReadyConfiguredSceneOffering();
    state.records.set("evaluation-launch-001", {
      configured_scene_offering_state: offering.status,
      configured_scene_offering_team_namespace: offering.team_namespace,
      configured_scene_offering_digest: offering.offering_digest,
      configured_scene_offering: offering,
    });
    const otherOffering = evaluationReadyConfiguredSceneOffering();
    otherOffering.team_namespace = "other-team";
    otherOffering.offering_digest = canonicalArtifactDigest(
      otherOffering,
      "offering_digest",
    );
    state.records.set("other-evaluation-launch", {
      configured_scene_offering_state: otherOffering.status,
      configured_scene_offering_team_namespace: otherOffering.team_namespace,
      configured_scene_offering_digest: otherOffering.offering_digest,
      configured_scene_offering: otherOffering,
    });
    const { server, url } = await startTeamOfferingServer();
    const runId = "evaluation-run-001";
    const body = {
      schema_version: "task_evaluation_policy_run_selection.v1",
      run_id: runId,
      offering_digest: offering.offering_digest,
      preset_id: "quick_10",
    };
    try {
      const deniedSetup = await fetch(`${url}/other-evaluation-launch/evaluation-setup`);
      expect(deniedSetup.status).toBe(404);
      const setup = await fetch(`${url}/evaluation-launch-001/evaluation-setup`);
      expect(setup.status).toBe(200);
      const setupJson = await setup.json() as any;
      expect(setupJson).toMatchObject({
        schema_version: "task_evaluation_policy_run_setup_projection.v1",
        source_launch_id: "evaluation-launch-001",
        offering_digest: offering.offering_digest,
        offering: {
          scene_id: "public-scene-001",
          task_id: "rigid-relocation",
          task_kind: "rigid_relocation",
          task_strategy: "planar_push",
        },
        robot: { embodiment_id: "franka_panda_robotiq_2f85_v1", locked: true },
        policy_candidates: [
          { candidate_id: "pi05_droid", locked: true },
          { candidate_id: "groot_n17_droid", locked: true },
        ],
        matrix: {
          profile_id: "franka_rigid_relocation_nested_v1",
          presets: [
            {
              preset_id: "quick_10",
              availability: "enabled",
              default: true,
              episode_counts: {
                learned_episode_count: 20,
                control_episode_count: 20,
                total_episode_count: 40,
              },
            },
            { preset_id: "standard_100", availability: "coming_later" },
            { preset_id: "deep_500", availability: "coming_later" },
          ],
        },
        notification: {
          recipient: "authenticated_account",
          recipient_email: "founder@example.com",
        },
      });
      expect(setupJson.matrix).not.toHaveProperty("cells");
      expect(JSON.stringify(setupJson)).not.toContain("s3://");
      expect(setupJson).not.toHaveProperty("preparation_template");

      const mismatch = await fetch(`${url}/evaluation-launch-001/evaluation-runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": "wrong-id" },
        body: JSON.stringify(body),
      });
      expect(mismatch.status).toBe(400);
      expect(state.records.has(runId)).toBe(false);

      const unavailableBody = {
        ...body,
        run_id: "evaluation-run-standard-001",
        preset_id: "standard_100",
      };
      const unavailable = await fetch(`${url}/evaluation-launch-001/evaluation-runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": unavailableBody.run_id,
        },
        body: JSON.stringify(unavailableBody),
      });
      expect(unavailable.status).toBe(409);
      await expect(unavailable.json()).resolves.toMatchObject({
        code: "task_evaluation_policy_run_preset_unavailable",
        available_preset_ids: ["quick_10"],
        paid_execution_requested: false,
      });
      expect(state.records.has(unavailableBody.run_id)).toBe(false);

      const created = await fetch(`${url}/evaluation-launch-001/evaluation-runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": runId },
        body: JSON.stringify(body),
      });
      expect(created.status).toBe(202);
      const createdJson = await created.json() as any;
      expect(createdJson).toMatchObject({
        schema_version: "task_evaluation_policy_run_web_receipt.v1",
        status: "queued_for_preparation",
        already_exists: false,
        run: {
          run_id: runId,
          source_launch_id: "evaluation-launch-001",
          result: null,
          episode_counts: {
            learned_episode_count: 20,
            control_episode_count: 20,
            total_episode_count: 40,
          },
        },
        configuration: {
          embodiment_id: "franka_panda_robotiq_2f85_v1",
          candidate_ids: ["pi05_droid", "groot_n17_droid"],
          preset_id: "quick_10",
          scenario_count_per_policy: 10,
          counts: {
            learned_episode_count: 20,
            control_episode_count: 20,
            total_episode_count: 40,
          },
        },
        proof_boundary: {
          preparation_is_execution: false,
          paid_execution_requested: false,
          payment_required: false,
        },
      });
      expect(JSON.stringify(createdJson)).not.toContain("s3://");
      const storedRun = state.records.get(runId);
      expect(storedRun).toMatchObject({
        owner_user_id: "founder-001",
        team_namespace: "robot-team-001",
        notification_recipient_user_id: "founder-001",
        progress: { completed_episodes: 0, total_episodes: 40 },
      });
      expect(storedRun?.configuration.matrix.cells).toHaveLength(10);
      expect(new Set(storedRun?.configuration.matrix.cells.map(
        (cell: any) => cell.seed,
      )).size).toBe(10);

      const replay = await fetch(`${url}/evaluation-launch-001/evaluation-runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": runId },
        body: JSON.stringify(body),
      });
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({
        already_exists: true,
        proof_boundary: {
          provider_mutation_performed_inside_http_request: false,
          paid_execution_requested: false,
        },
      });
      const pipelineCalls = (globalThis.fetch as any).mock.calls.filter(
        ([target]: [string]) => target
          === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
      );
      expect(pipelineCalls).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("browses an accepted offering and starts only its exact configured revision", async () => {
    const offering = configuredSceneOffering();
    state.records.set("scene-launch-001", {
      configured_scene_offering_state: "launch_ready",
      configured_scene_offering_digest: offering.offering_digest,
      configured_scene_offering: offering,
    });
    state.blobs.set("blueprint-inputs/configured/task-thumbnail.png", Buffer.from("exact-selected-frame"));
    const request = evaluationPreparationInput();
    request.expected_production_commit = "b".repeat(40);
    request.scene.identity = offering.scene_identity;
    request.scene.configured_revision = pipelineReference(
      offering.evaluation_preparation_binding.configured_scene_revision,
    );
    request.task.identity = offering.task.identity;
    request.task.kind = offering.task.kind;
    request.task.strategy = offering.task.strategy;
    request.task.subject.identity = offering.task.subject_identity;
    request.task.configured_scene_revision_digest =
      offering.evaluation_preparation_binding.configured_scene_revision_digest;
    const { server, url } = await startServer();
    try {
      const catalog = await fetch(`${url}/configured-scene-offerings`);
      expect(catalog.status).toBe(200);
      await expect(catalog.json()).resolves.toMatchObject({
        schema_version: "task_evaluation_configured_scene_offering_catalog.v1",
        offerings: [{
          source_launch_id: "scene-launch-001",
          offering_digest: offering.offering_digest,
          presentation: {
            thumbnail_url:
              "/api/admin/task-evaluation-launches/configured-scene-offerings/scene-launch-001/thumbnail",
          },
        }],
      });
      const thumbnail = await fetch(`${url}/configured-scene-offerings/scene-launch-001/thumbnail`);
      expect(thumbnail.status).toBe(200);
      expect(Buffer.from(await thumbnail.arrayBuffer())).toEqual(Buffer.from("exact-selected-frame"));

      const queued = await fetch(`${url}/configured-scene-offerings/scene-launch-001/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      expect(queued.status).toBe(202);
      expect(state.records.get(request.preparation_id)).toMatchObject({
        configured_scene_offering_binding: {
          source_launch_id: "scene-launch-001",
          offering_digest: offering.offering_digest,
          configured_scene_revision_digest:
            offering.evaluation_preparation_binding.configured_scene_revision_digest,
          configured_scene_bundle_digest:
            offering.evaluation_preparation_binding.configured_scene_bundle.digest,
          task_thumbnail_digest: offering.presentation.task_thumbnail.digest,
        },
      });

      const mismatched = structuredClone(request);
      mismatched.preparation_id = "prep-mismatch";
      mismatched.scene.configured_revision.digest = sha("9");
      const refused = await fetch(`${url}/configured-scene-offerings/scene-launch-001/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mismatched),
      });
      expect(refused.status).toBe(409);
      expect(state.records.has("prep-mismatch")).toBe(false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("durably stages discovery, exposes candidates, and seals only an eligible selection", async () => {
    const { server, url } = await startServer();
    const input = discoveryInput();
    try {
      const queued = await fetch(`${url}/discoveries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(queued.status).toBe(202);
      await expect(queued.json()).resolves.toMatchObject({
        schema_version: "scene_object_discovery_web_receipt.v1",
        status: "queued_for_no_spend_discovery_preparation",
        discovery_id: input.discovery_id,
        paid_execution_requested: false,
        discovery_preparation_is_not_execution: true,
      });

      const status = await fetch(`${url}/discoveries/${input.discovery_id}`);
      expect(status.status).toBe(200);
      const statusPayload = await status.json();
      expect(statusPayload).toMatchObject({
        state: "selection_required",
        pipeline: {
          discovery_digest: sha("7"),
          candidates: [
            { candidate_id: "sam31-tote-001", eligible_for_automatic_source_object: true },
            { candidate_id: "splat-box-001", eligible_for_automatic_source_object: false },
          ],
          unseen_regions: ["behind_uncaptured_partition"],
        },
      });

      const requestDigest = canonicalArtifactDigest(input, "request_digest");
      const ineligible = await fetch(`${url}/discoveries/${input.discovery_id}/selection`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schema_version: "scene_object_discovery_selection_request.v1",
          discovery_id: input.discovery_id,
          expected_production_commit: input.expected_production_commit,
          request_digest: requestDigest,
          discovery_digest: sha("7"),
          candidate_id: "splat-box-001",
          confirm_selection: true,
        }),
      });
      expect(ineligible.status).toBe(409);

      const eligibleSelection = {
        schema_version: "scene_object_discovery_selection_request.v1",
        discovery_id: input.discovery_id,
        expected_production_commit: input.expected_production_commit,
        request_digest: requestDigest,
        discovery_digest: sha("7"),
        candidate_id: "sam31-tote-001",
        confirm_selection: true,
      };
      const selected = await fetch(`${url}/discoveries/${input.discovery_id}/selection`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(eligibleSelection),
      });
      expect(selected.status).toBe(202);
      await expect(selected.json()).resolves.toMatchObject({
        status: "selection_sealed",
        candidate_id: "sam31-tote-001",
        paid_execution_requested: false,
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("starts a production scene-configuration run without an evaluation controller", async () => {
    const { server, url } = await startServer();
    const input = preparationInput();
    try {
      const response = await fetch(`${url}/preparations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      const receipt = await response.json();
      expect(response.status).toBe(202);
      expect(receipt).toMatchObject({
        schema_version: "task_evaluation_launch_preparation_web_receipt.v1",
        status: "queued_for_no_spend_preparation",
        preparation_id: input.preparation_id,
        run_id: input.run_id,
        team_namespace: input.team_namespace,
        expected_production_commit: input.expected_production_commit,
        provider_mutation_performed_inside_web_request: false,
        catalog_mutation_performed_inside_web_request: false,
        paid_execution_requested: false,
        preparation_is_not_execution: true,
        submission_channel: "production_webapp_browser",
      });
      expect(state.records.get(input.preparation_id)).toMatchObject({
        state: "queued_for_no_spend_preparation",
        request_digest: receipt.request_digest,
        provider_mutation_observed: false,
        catalog_mutation_observed: false,
        paid_execution_requested: false,
        request: {
          run_mode: "scene_configuration",
          scene: { identity: input.scene.identity },
          construction: { mode: "production_recipe" },
          task: { identity: input.task.identity },
          runtime: { identity: input.runtime.identity },
        },
      });

      const replay = await fetch(`${url}/preparations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(replay.status).toBe(200);
      expect(await replay.json()).toMatchObject({ already_exists: true });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
      )).toHaveLength(1);

      const status = await fetch(`${url}/preparations/${input.preparation_id}`);
      expect(status.status).toBe(200);
      expect(await status.json()).toMatchObject({
        state: "materialized",
        preparation_id: input.preparation_id,
        pipeline: {
          worker_status: "queued_for_production_scene_configuration",
          construction_orchestration_id: input.preparation_id,
          automatic_progression_required: true,
          full_byte_service_account_readback_passed: true,
        },
        paid_execution_requested: false,
      });
      expect(state.records.get(input.preparation_id)).toMatchObject({
        state: "materialized",
        pipeline_status: { result_digest: sha("9") },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("accepts an episode evaluation only with configured scene, robot, and controller bindings", async () => {
    const { server, url } = await startServer();
    const input = evaluationPreparationInput();
    try {
      const response = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(202);
      expect(state.records.get(input.preparation_id)).toMatchObject({
        state: "queued_for_no_spend_preparation",
        request: {
          run_mode: "episode_evaluation",
          scene: { configured_revision: input.scene.configured_revision },
          construction: { mode: "reuse_configured_scene" },
          robot: { identity: input.robot.identity },
          controller: { kind: "zero_action" },
        },
      });

      const invalid = evaluationPreparationInput();
      invalid.preparation_id = "prep-scene-001-invalid";
      delete invalid.scene.configured_revision;
      const rejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(invalid),
      });
      expect(rejected.status).toBe(400);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("rejects unsafe or conflicting preparation inputs before Pipeline forwarding", async () => {
    const { server, url } = await startServer();
    try {
      const unsafe = preparationInput();
      unsafe.scene.source_manifest.uri = "/var/lib/blueprint/source.json";
      const rejected = await fetch(`${url}/preparations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(unsafe),
      });
      expect(rejected.status).toBe(400);
      expect(await rejected.json()).toMatchObject({
        code: "task_evaluation_launch_preparation_input_invalid",
        paid_execution_requested: false,
      });
      expect(state.records.size).toBe(0);

      const unauthorizedProvider = preparationInput();
      unauthorizedProvider.spend.selected_provider = "runpod";
      const providerRejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(unauthorizedProvider),
      });
      expect(providerRejected.status).toBe(400);
      expect(state.records.size).toBe(0);

      const overcommittedServices = preparationInput();
      overcommittedServices.spend.hard_cap_usd = 2;
      const overcommittedRejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(overcommittedServices),
      });
      expect(overcommittedRejected.status).toBe(400);
      expect(state.records.size).toBe(0);

      const shortParent = preparationInput();
      shortParent.spend.hard_ttl_seconds = 9_000;
      const shortParentRejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(shortParent),
      });
      expect(shortParentRejected.status).toBe(400);
      expect(state.records.size).toBe(0);

      const underfundedCompute = preparationInput();
      underfundedCompute.spend.provider_compute_spend_cap_usd = 5.59;
      const underfundedComputeRejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(underfundedCompute),
      });
      expect(underfundedComputeRejected.status).toBe(400);
      expect(state.records.size).toBe(0);

      const widenedEpisode = evaluationPreparationInput();
      widenedEpisode.spend.hard_cap_usd = 10;
      widenedEpisode.spend.hard_ttl_seconds = 25_200;
      const widenedEpisodeRejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(widenedEpisode),
      });
      expect(widenedEpisodeRejected.status).toBe(400);
      expect(state.records.size).toBe(0);

      const missingServiceAuthority = preparationInput();
      delete missingServiceAuthority.spend.external_service_caps;
      const missingServiceAuthorityRejected = await fetch(`${url}/preparations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(missingServiceAuthority),
      });
      expect(missingServiceAuthorityRejected.status).toBe(400);
      expect(state.records.size).toBe(0);

      const underfundedServiceCases: Array<
        (input: ReturnType<typeof preparationInput>) => void
      > = [
        (input) => {
          input.spend.external_service_caps.openai.stage_max_cost_usd
            .artifixer_semantic_teacher = 2.39;
        },
        (input) => {
          input.spend.external_service_caps.openai.stage_max_cost_usd
            .artifixer_visual_review = 0.29;
        },
        (input) => {
          input.spend.external_service_caps.openai.stage_max_cost_usd
            .content_agents = 0.19;
        },
        (input) => {
          input.spend.external_service_caps.openai.maximum_cost_usd = 2.89;
        },
        (input) => {
          input.spend.hard_cap_usd = 9.99;
        },
        (input) => {
          input.spend.provider_compute_spend_cap_usd = 5.99;
        },
      ];
      for (const mutate of underfundedServiceCases) {
        const underfunded = preparationInput();
        mutate(underfunded);
        const underfundedRejected = await fetch(`${url}/preparations`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(underfunded),
        });
        expect(underfundedRejected.status).toBe(400);
        expect(await underfundedRejected.json()).toMatchObject({
          code: "task_evaluation_launch_preparation_input_invalid",
          paid_execution_requested: false,
        });
        expect(state.records.size).toBe(0);
      }

      const firstInput = preparationInput();
      const first = await fetch(`${url}/preparations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(firstInput),
      });
      expect(first.status).toBe(202);
      const changed = preparationInput();
      changed.run_id = "different-run";
      const conflict = await fetch(`${url}/preparations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(changed),
      });
      expect(conflict.status).toBe(409);
      expect(await conflict.json()).toMatchObject({
        code: "task_evaluation_launch_preparation_immutable_conflict",
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
      )).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("activates one verified preparation exactly once without requesting paid execution", async () => {
    const { server, url } = await startServer();
    const preparation = preparationInput();
    const input = activationInput();
    state.records.set(preparation.preparation_id, {
      schema_version: "task_evaluation_launch_preparation_web_record.v1",
      preparation_id: preparation.preparation_id,
      run_id: preparation.run_id,
      team_namespace: preparation.team_namespace,
      expected_production_commit: preparation.expected_production_commit,
      request_digest: input.preparation.request_digest,
      state: "materialized",
      pipeline_status: {
        result_digest: input.preparation.result_digest,
        full_byte_service_account_readback_passed: true,
      },
    });
    try {
      const response = await fetch(`${url}/activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({
        schema_version: "task_evaluation_launch_activation_web_receipt.v1",
        status: "queued_for_authority_gated_activation",
        already_exists: false,
        activation_id: input.activation_id,
        preparation_id: input.preparation.preparation_id,
        provider_mutation_performed_inside_web_request: false,
        paid_execution_requested: false,
        activation_is_not_execution: true,
      });
      expect(state.records.get(input.activation_id)).toMatchObject({
        state: "queued_for_authority_gated_activation",
        request_digest: canonicalArtifactDigest(input, "request_digest"),
        provider_mutation_observed: false,
        paid_execution_requested: false,
      });

      const replay = await fetch(`${url}/activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({ already_exists: true });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-activations",
      )).toHaveLength(1);

      const status = await fetch(`${url}/activations/${input.activation_id}`);
      expect(status.status).toBe(200);
      await expect(status.json()).resolves.toMatchObject({
        state: "prepared",
        pipeline: {
          worker_status: "profile_authority_materialized_no_execution",
          profile_id: "scene-001-construction-r1",
          provider_mutation_performed_by_worker: false,
          paid_execution_requested: false,
        },
        activation_is_not_execution: true,
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("activates a verified scene configuration preparation through the Website", async () => {
    const { server, url } = await startServer();
    const preparation = preparationInput();
    const input = {
      ...activationInput(),
      activation_id: "activate-scene-001-configuration",
      lane: "task_evaluation_scene_configuration",
    };
    state.records.set(preparation.preparation_id, {
      schema_version: "task_evaluation_launch_preparation_web_record.v1",
      preparation_id: preparation.preparation_id,
      run_id: preparation.run_id,
      team_namespace: preparation.team_namespace,
      expected_production_commit: preparation.expected_production_commit,
      request_digest: input.preparation.request_digest,
      state: "materialized",
      pipeline_status: {
        result_digest: input.preparation.result_digest,
        full_byte_service_account_readback_passed: true,
      },
    });
    try {
      const response = await fetch(`${url}/activations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toMatchObject({
        schema_version: "task_evaluation_launch_activation_web_receipt.v1",
        status: "queued_for_authority_gated_activation",
        activation_id: input.activation_id,
        preparation_id: input.preparation.preparation_id,
        provider_mutation_performed_inside_web_request: false,
        paid_execution_requested: false,
        activation_is_not_execution: true,
      });
      expect(state.records.get(input.activation_id)).toMatchObject({
        lane: "task_evaluation_scene_configuration",
        state: "queued_for_authority_gated_activation",
        provider_mutation_observed: false,
        paid_execution_requested: false,
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("rejects activation when preparation verification or immutable identity differs", async () => {
    const { server, url } = await startServer();
    const preparation = preparationInput();
    const input = activationInput();
    state.records.set(preparation.preparation_id, {
      preparation_id: preparation.preparation_id,
      team_namespace: preparation.team_namespace,
      expected_production_commit: preparation.expected_production_commit,
      request_digest: input.preparation.request_digest,
      state: "materialized",
      pipeline_status: {
        result_digest: sha("8"),
        full_byte_service_account_readback_passed: true,
      },
    });
    try {
      const unverified = await fetch(`${url}/activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(unverified.status).toBe(409);
      await expect(unverified.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_activation_preparation_not_verified",
        paid_execution_requested: false,
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-activations",
      )).toHaveLength(0);

      state.records.set(preparation.preparation_id, {
        ...state.records.get(preparation.preparation_id),
        pipeline_status: {
          result_digest: input.preparation.result_digest,
          full_byte_service_account_readback_passed: true,
        },
      });
      const accepted = await fetch(`${url}/activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(accepted.status).toBe(202);
      const changed = {
        ...input,
        authorization: { ...input.authorization, reference: "different authority" },
      };
      const conflict = await fetch(`${url}/activations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(changed),
      });
      expect(conflict.status).toBe(409);
      await expect(conflict.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_activation_immutable_conflict",
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("authenticates and validates an exact launch without persisting or forwarding", async () => {
    process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON = "[]";
    process.env.TASK_EVALUATION_LAUNCH_PROFILES_URL =
      "https://pipeline.example/api/live-pipeline/task-evaluation-launch-profiles";
    const { server, url } = await startSubmissionServer();
    const body = JSON.stringify(launchInput());
    try {
      const unsigned = await fetch(`${url}/preflight`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      expect(unsigned.status).toBe(401);

      const missingTimestampBody = JSON.stringify({
        ...launchInput(),
        authorization_issued_at: undefined,
      });
      const missingTimestamp = await fetch(`${url}/preflight`, {
        method: "POST",
        headers: signedSubmissionHeaders(missingTimestampBody) as HeadersInit,
        body: missingTimestampBody,
      });
      expect(missingTimestamp.status).toBe(400);
      await expect(missingTimestamp.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_authorization_timestamp_required",
        provider_mutation_performed_inside_web_request: false,
      });
      expect(state.records.size).toBe(0);

      const response = await fetch(`${url}/preflight`, {
        method: "POST",
        headers: signedSubmissionHeaders(body) as HeadersInit,
        body,
      });
      const receipt = await response.json();
      expect(response.status).toBe(200);
      expect(receipt).toMatchObject({
        schema_version: "task_evaluation_launch_web_preflight_receipt.v1",
        status: "ready",
        launch_id: "launch-001",
        run_id: "run-001",
        profile_id: profile().profile_id,
        profile_digest: profile().profile_digest,
        authorization_issued_at: expect.any(String),
        authenticated_client_id: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
        submission_channel: "production_webapp_service_api",
        webapp_store_available: true,
        webapp_record_persisted: false,
        pipeline_request_forwarded: false,
        pipeline_queue_created: false,
        provider_mutation_performed_inside_web_request: false,
        preflight_is_not_execution: true,
      });
      expect(receipt.receipt_digest).toBe(
        canonicalArtifactDigest(receipt, "receipt_digest"),
      );
      expect(state.records.size).toBe(0);
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(0);
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target)
          === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-profiles",
      )).toHaveLength(1);

      const submitted = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body) as HeadersInit,
        body,
      });
      expect(submitted.status).toBe(202);
      expect(state.records.get("launch-001")?.request_digest).toBe(
        receipt.candidate_request_digest,
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("submits through the launch-only HMAC API exactly once", async () => {
    const { server, url } = await startSubmissionServer();
    const body = JSON.stringify(launchInput());
    try {
      const adminRead = await fetch(`${url}/profiles`);
      expect(adminRead.status).toBe(404);
      const terminalRelease = await fetch(`${url}/launch-001/terminal-resource-releases`, {
        method: "POST",
        headers: signedSubmissionHeaders(body) as HeadersInit,
        body,
      });
      expect(terminalRelease.status).toBe(404);
      expect(state.records.size).toBe(0);

      const missingIdempotency = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body, "") as HeadersInit,
        body,
      });
      expect(missingIdempotency.status).toBe(400);
      expect(await missingIdempotency.json()).toMatchObject({
        code: "task_evaluation_launch_submit_idempotency_key_missing",
        provider_mutation_performed_inside_web_request: false,
      });
      expect(state.records.size).toBe(0);

      const mismatch = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body, "different-launch") as HeadersInit,
        body,
      });
      expect(mismatch.status).toBe(409);
      expect(await mismatch.json()).toMatchObject({
        code: "task_evaluation_launch_submit_idempotency_key_mismatch",
      });
      expect(state.records.size).toBe(0);

      const first = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body) as HeadersInit,
        body,
      });
      const firstReceipt = await first.json();
      expect(first.status).toBe(202);
      expect(firstReceipt).toMatchObject({
        schema_version: "task_evaluation_launch_web_receipt.v1",
        status: "queued_in_pipeline",
        already_exists: false,
        submission_channel: "production_webapp_service_api",
        provider_mutation_performed_inside_web_request: false,
      });
      expect(state.records.get("launch-001")).toMatchObject({
        submission: {
          channel: "production_webapp_service_api",
          service_id: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
          idempotency_key: "launch-001",
        },
        request: {
          authorization: {
            actor: { id: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID, role: "ops" },
          },
          idempotency_key: "launch-001",
        },
      });

      const replay = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body) as HeadersInit,
        body,
      });
      expect(replay.status).toBe(200);
      expect(await replay.json()).toMatchObject({
        already_exists: true,
        request_digest: firstReceipt.request_digest,
        submission_channel: "production_webapp_service_api",
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(1);

      const changed = JSON.stringify({ ...launchInput(), run_id: "run-002" });
      const conflict = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(changed) as HeadersInit,
        body: changed,
      });
      expect(conflict.status).toBe(409);
      expect(await conflict.json()).toMatchObject({
        code: "task_evaluation_launch_immutable_conflict",
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("submits one immutable no-spend preparation through the service HMAC API", async () => {
    const { server, url } = await startPreparationSubmissionServer();
    const input = preparationInput();
    const body = JSON.stringify(input);
    const headers = () => signedSubmissionHeaders(body, input.preparation_id) as HeadersInit;
    try {
      const unsigned = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      expect(unsigned.status).toBe(401);
      expect(state.records.size).toBe(0);

      const missingIdempotency = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body, "") as HeadersInit,
        body,
      });
      expect(missingIdempotency.status).toBe(400);
      await expect(missingIdempotency.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_preparation_idempotency_key_missing",
        paid_execution_requested: false,
      });
      expect(state.records.size).toBe(0);

      const mismatch = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(body, "different-preparation") as HeadersInit,
        body,
      });
      expect(mismatch.status).toBe(409);
      await expect(mismatch.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_preparation_idempotency_key_mismatch",
        provider_mutation_performed_inside_web_request: false,
        catalog_mutation_performed_inside_web_request: false,
      });
      expect(state.records.size).toBe(0);

      const first = await fetch(url, { method: "POST", headers: headers(), body });
      expect(first.status).toBe(202);
      const firstReceipt = await first.json();
      expect(firstReceipt).toMatchObject({
        schema_version: "task_evaluation_launch_preparation_web_receipt.v1",
        status: "queued_for_no_spend_preparation",
        already_exists: false,
        preparation_id: input.preparation_id,
        provider_mutation_performed_inside_web_request: false,
        catalog_mutation_performed_inside_web_request: false,
        paid_execution_requested: false,
        preparation_is_not_execution: true,
        submission_channel: "production_webapp_service_api",
      });
      expect(state.records.get(input.preparation_id)).toMatchObject({
        request_digest: firstReceipt.request_digest,
        submission: {
          channel: "production_webapp_service_api",
          actor_id: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
          actor_role: "ops",
          service_id: TASK_EVALUATION_LAUNCH_RUNNER_CLIENT_ID,
          idempotency_key: input.preparation_id,
        },
        provider_mutation_observed: false,
        catalog_mutation_observed: false,
        paid_execution_requested: false,
      });

      const replay = await fetch(url, { method: "POST", headers: headers(), body });
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({
        already_exists: true,
        request_digest: firstReceipt.request_digest,
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
      )).toHaveLength(1);

      const unsignedStatus = await fetch(`${url}/${input.preparation_id}`);
      expect(unsignedStatus.status).toBe(401);
      const status = await fetch(`${url}/${input.preparation_id}`, {
        headers: signedSubmissionHeaders("", input.preparation_id) as HeadersInit,
      });
      expect(status.status).toBe(200);
      await expect(status.json()).resolves.toMatchObject({
        schema_version: "task_evaluation_launch_preparation_web_status.v1",
        preparation_id: input.preparation_id,
        state: "materialized",
        pipeline: {
          status: "materialized",
          full_byte_service_account_readback_passed: true,
        },
        provider_mutation_performed_by_status_read: false,
        paid_execution_requested: false,
        preparation_is_not_execution: true,
      });

      const changed = JSON.stringify({ ...input, run_id: "different-run" });
      const conflict = await fetch(url, {
        method: "POST",
        headers: signedSubmissionHeaders(changed, input.preparation_id) as HeadersInit,
        body: changed,
      });
      expect(conflict.status).toBe(409);
      await expect(conflict.json()).resolves.toMatchObject({
        code: "task_evaluation_launch_preparation_immutable_conflict",
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/api/live-pipeline/task-evaluation-launch-preparations",
      )).toHaveLength(1);

      expect((await fetch(`${url}/profiles`)).status).toBe(401);
      expect((await fetch(`${url}/preparations/${input.preparation_id}`)).status).toBe(404);
      expect((await fetch(`${url}/activations`, {
        method: "POST",
        headers: headers(),
        body,
      })).status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("keeps an unreachable Pipeline profile catalog typed and fail-closed", async () => {
    process.env.TASK_EVALUATION_LAUNCH_PROFILES_JSON = "[]";
    process.env.TASK_EVALUATION_LAUNCH_PROFILES_URL = "https://pipeline.example/profiles";
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("http://127.0.0.1:")) return realFetch(url, init);
      throw new DOMException("request timed out", "AbortError");
    }));
    const { server, url } = await startServer();
    try {
      const response = await fetch(`${url}/profiles`);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        schema_version: "task_evaluation_launch_profile_catalog.v1",
        error: "Published Pipeline launch profiles are unavailable",
        code: "task_evaluation_launch_profile_catalog_timeout",
        profiles: [],
      });
      expect(state.records.size).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("fails closed with an unknown persistence state when Firestore stalls", async () => {
    state.hangTransaction = true;
    process.env.TASK_EVALUATION_LAUNCH_STORE_TIMEOUT_MS = "250";
    const { server, url } = await startServer();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(launchInput()),
      });
      const body = await response.json();
      expect(response.status).toBe(503);
      expect(body).toMatchObject({
        code: "task_evaluation_launch_store_timeout",
        launch_id: "launch-001",
        persistence_state: "unknown",
        retryable: true,
        provider_mutation_performed_inside_web_request: false,
      });
      expect(state.records.size).toBe(0);
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("durably records authority before forwarding the exact published profile", async () => {
    const { server, url } = await startServer();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(launchInput()),
      });
      const body = await response.json();
      expect(response.status).toBe(202);
      expect(body).toMatchObject({
        status: "queued_in_pipeline",
        launch_id: "launch-001",
        provider_mutation_performed_inside_web_request: false,
      });
      expect(state.records.get("launch-001")).toMatchObject({
        state: "queued_in_pipeline",
        request_digest: body.request_digest,
        provider_mutation_observed: false,
        request: {
          launch_profile_id: profile().profile_id,
          required_controls: {
            canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
            retry_cap: 0,
          },
        },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns an existing queued launch without forwarding the website intent again", async () => {
    const { server, url } = await startServer();
    const input = launchInput();
    try {
      const first = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      expect(first.status).toBe(202);
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(1);

      const replay = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await replay.json();
      expect(replay.status).toBe(200);
      expect(body).toMatchObject({
        status: "queued_in_pipeline",
        already_exists: true,
        provider_mutation_performed_inside_web_request: false,
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target) === "https://pipeline.example/launches",
      )).toHaveLength(1);
      expect(state.records.get("launch-001")?.forward_attempt_count).toBe(1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("persists and forwards one explicit release-only recovery without reopening the launch", async () => {
    state.records.set("launch-001", terminalBlockedLaunchRecord());
    vi.stubGlobal("fetch", vi.fn(async (target: string, init?: RequestInit) => {
      if (target.startsWith("http://127.0.0.1:")) return realFetch(target, init);
      expect(target).toBe("https://pipeline.example/api/live-pipeline/task-evaluation-terminal-resource-releases");
      const request = JSON.parse(String(init?.body || "{}"));
      expect(request).toMatchObject({
        provider: "vast",
        instance_id: "47508030",
        expected_label: "blueprint-adp009d-1786496624",
        provider_mutation_performed_inside_web_request: false,
        automatic_retry_performed: false,
      });
      return new Response(JSON.stringify({
        schema_version: "task_evaluation_terminal_resource_release_intake_receipt.v1",
        status: "accepted",
        provider_mutation_performed_inside_http_request: false,
        queue: {
          schema_version: "task_evaluation_terminal_resource_release_queue_receipt.v1",
          status: "queued",
          release_id: request.release_id,
          terminal_resource_release_digest: request.terminal_resource_release_digest,
          provider_mutation_performed: false,
        },
      }), { status: 202, headers: { "content-type": "application/json" } });
    }));
    const { server, url } = await startServer();
    const input = {
      provider: "vast",
      instance_id: "47508030",
      expected_label: "blueprint-adp009d-1786496624",
      confirm_terminal_resource_release: true,
    };
    try {
      const first = await fetch(`${url}/launch-001/terminal-resource-releases`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      const body = await first.json();
      expect(first.status).toBe(202);
      expect(body).toMatchObject({
        status: "queued_in_pipeline",
        launch_id: "launch-001",
        provider_mutation_performed_inside_web_request: false,
        automatic_retry_performed: false,
      });
      expect(state.records.get("launch-001")).toMatchObject({
        state: "control_plane_terminal_blocked",
        terminal_resource_release: {
          state: "queued_in_pipeline",
          provider_mutation_observed: false,
          automatic_retry_performed: false,
          request: { instance_id: "47508030" },
        },
      });

      // A replay forwards the identical request again rather than echoing the
      // stored receipt. The WebApp never observes whether the Pipeline blocked
      // the release, so only the Pipeline can decide whether it may be
      // re-armed; echoing here left a Pipeline-blocked release unretryable.
      const replay = await fetch(`${url}/launch-001/terminal-resource-releases`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
      });
      expect(replay.status).toBe(202);
      expect(await replay.json()).toMatchObject({
        provider_mutation_performed_inside_web_request: false,
        automatic_retry_performed: false,
      });
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target).startsWith("https://pipeline.example/"),
      )).toHaveLength(2);

      // A different instance under the same launch stays an immutable conflict
      // and must never reach the Pipeline.
      const conflict = await fetch(`${url}/launch-001/terminal-resource-releases`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          ...input, instance_id: "47508031",
        }),
      });
      expect(conflict.status).toBe(409);
      expect(vi.mocked(fetch).mock.calls.filter(([target]) =>
        String(target).startsWith("https://pipeline.example/"),
      )).toHaveLength(2);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("lets a delayed digest-bound Pipeline terminal receipt supersede a control-plane blocker", async () => {
    const requestDigest = sha("a");
    state.records.set("launch-001", {
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: requestDigest,
      team_namespace: "robot-team-001",
      state: "control_plane_terminal_blocked",
      control_plane_terminal_blocker: {
        code: "control_plane_terminal_receipt_missing_after_spend_authority_expiry",
        execution_result: "not_observed",
      },
    });
    const receipt: Record<string, any> = {
      schema_version: "task_evaluation_launch_receipt.v1",
      status: "completed",
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: requestDigest,
      launch_profile_digest: sha("b"),
      binding_digest: sha("c"),
      canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
      allocator_exit_code: 0,
      execute_requested: true,
      provider_mutation_attempted: true,
      terminal_evidence: { status: "passed" },
      blockers: [],
      raw_secret_values_recorded: false,
      agent_operator_used: false,
      claim_ceiling: "development_only",
    };
    receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
    const { server, url } = await startInternalServer();
    try {
      const response = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(receipt),
      });
      expect(response.status).toBe(201);
      expect(state.records.get("launch-001")).toMatchObject({
        state: "completed",
        terminal_receipt_digest: receipt.receipt_digest,
        terminal_receipt: { terminal_evidence: { status: "passed" } },
        control_plane_terminal_blocker: { execution_result: "not_observed" },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("adds one blocked direct-execution adoption without replacing terminal history", async () => {
    const requestDigest = sha("a");
    const original: Record<string, any> = {
      schema_version: "task_evaluation_launch_receipt.v1",
      status: "blocked",
      launch_id: "launch-adoption",
      run_id: "launch-adoption",
      request_digest: requestDigest,
      launch_profile_digest: sha("b"),
      binding_digest: sha("c"),
      canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
      allocator_exit_code: 2,
      execute_requested: true,
      provider_mutation_attempted: false,
      terminal_evidence: { status: "blocked" },
      blockers: ["paid_resource_admission_not_admitted"],
      raw_secret_values_recorded: false,
      agent_operator_used: false,
      claim_ceiling: "development_only",
    };
    original.receipt_digest = canonicalArtifactDigest(original, "receipt_digest");
    state.records.set("launch-adoption", {
      launch_id: "launch-adoption",
      run_id: "launch-adoption",
      request_digest: requestDigest,
      launch_profile_digest: original.launch_profile_digest,
      request: {
        launch_profile_id: "scene-839873-construction",
        launch_profile_digest: original.launch_profile_digest,
      },
      state: "blocked",
      terminal_receipt: structuredClone(original),
      terminal_receipt_digest: original.receipt_digest,
    });
    const adoption = directExecutionAdoption(original);
    const { server, url } = await startInternalServer();
    try {
      const unbound = structuredClone(adoption);
      unbound.original_launch_receipt_digest = sha("f");
      unbound.receipt_digest = canonicalArtifactDigest(unbound, "receipt_digest");
      const refused = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(unbound),
      });
      expect(refused.status).toBe(409);
      expect(state.records.get("launch-adoption")?.terminal_adoption_receipt)
        .toBeUndefined();

      const first = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(adoption),
      });
      expect(first.status).toBe(201);
      await expect(first.json()).resolves.toMatchObject({
        status: "blocked",
        already_exists: false,
        configured_scene_offering_status: "configured_controls_pending",
        native_construction_status: "blocked",
        native_construction_blockers: adoption.blockers,
        qualification_upgrade_performed: false,
      });
      expect(state.records.get("launch-adoption")).toMatchObject({
        state: "blocked",
        terminal_receipt_digest: original.receipt_digest,
        terminal_receipt: { blockers: ["paid_resource_admission_not_admitted"] },
        terminal_adoption_receipt_digest: adoption.receipt_digest,
        terminal_adoption_original_receipt_digest: original.receipt_digest,
        terminal_adoption_receipt: {
          blockers: adoption.blockers,
          controls_qualified: false,
          evaluation_ready: false,
        },
        configured_scene_offering_state: "configured_controls_pending",
        native_construction_status: "blocked",
        native_construction_blockers: adoption.blockers,
        controls_qualified: false,
        evaluation_ready: false,
      });

      const replay = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(adoption),
      });
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({ already_exists: true });

      const changed = structuredClone(adoption);
      changed.blockers = [...changed.blockers, "different_native_blocker"];
      changed.website_projection.native_construction_blockers = changed.blockers;
      changed.receipt_digest = canonicalArtifactDigest(changed, "receipt_digest");
      const conflict = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changed),
      });
      expect(conflict.status).toBe(409);
      await expect(conflict.json()).resolves.toMatchObject({
        code: "task_evaluation_direct_execution_adoption_immutable_conflict",
      });
      expect(state.records.get("launch-adoption")?.terminal_adoption_receipt_digest)
        .toBe(adoption.receipt_digest);

      expect(state.records.get("launch-adoption")?.terminal_receipt_digest)
        .toBe(original.receipt_digest);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("atomically publishes only a fully bound configured-scene offering", async () => {
    const requestDigest = sha("a");
    state.records.set("launch-001", {
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: requestDigest,
      team_namespace: "robot-team-001",
      configured_scene_context: {
        run_mode: "scene_configuration",
        team_namespace: "robot-team-001",
        scene_id: "interiorgs-839873",
        task_id: "planar-mug-push",
        configuration_run_id: "configuration-run-001",
        evaluation_episode_executed: false,
      },
      state: "queued_in_pipeline",
    });
    const offering = configuredSceneOffering();
    offering.configuration_run_id = "configuration-run-001";
    offering.offering_digest = canonicalArtifactDigest(offering, "offering_digest");
    // Pipeline seals the terminal receipt with canonical JSON, so its artifact
    // reference keys arrive alphabetically even though Zod reconstructs the
    // embedded offering references in schema order. Binding is about the exact
    // fields and values, not their object insertion order.
    const receipt: Record<string, any> = {
      schema_version: "task_evaluation_launch_receipt.v1",
      status: "completed",
      launch_id: "launch-001",
      run_id: "run-001",
      request_digest: requestDigest,
      launch_profile_digest: sha("b"),
      binding_digest: sha("c"),
      canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
      allocator_exit_code: 0,
      execute_requested: true,
      provider_mutation_attempted: true,
      terminal_evidence: {
        status: "passed",
        scene_configuration: {
          configured_scene_revision_digest:
            offering.evaluation_preparation_binding.configured_scene_revision_digest,
          configured_scene_revision_reference: pipelineReference(
            offering.evaluation_preparation_binding.configured_scene_revision,
          ),
          configured_scene_bundle_reference: pipelineReference(
            offering.evaluation_preparation_binding.configured_scene_bundle,
          ),
          task_thumbnail_reference: pipelineReference(
            offering.presentation.task_thumbnail,
          ),
          task_thumbnail_selection_receipt_reference: pipelineReference(
            offering.presentation.selection_receipt,
          ),
          configured_scene_offering: offering,
        },
      },
      blockers: [],
      raw_secret_values_recorded: false,
      agent_operator_used: false,
      claim_ceiling: "development_only",
    };
    receipt.receipt_digest = canonicalArtifactDigest(receipt, "receipt_digest");
    const { server, url } = await startInternalServer();
    try {
      const response = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(receipt),
      });
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        configured_scene_offering_digest: offering.offering_digest,
        configured_scene_offering_status: "launch_ready",
      });
      expect(state.records.get("launch-001")).toMatchObject({
        state: "completed",
        configured_scene_offering_state: "launch_ready",
        configured_scene_offering_public_visibility: "private",
        configured_scene_offering_digest: offering.offering_digest,
        configured_scene_offering: {
          presentation: {
            task_thumbnail: offering.presentation.task_thumbnail,
          },
          evaluation_preparation_binding: {
            configured_scene_revision:
              offering.evaluation_preparation_binding.configured_scene_revision,
            configured_scene_bundle:
              offering.evaluation_preparation_binding.configured_scene_bundle,
          },
        },
      });

      state.records.set("launch-missing-offering", {
        launch_id: "launch-missing-offering",
        run_id: "run-missing-offering",
        request_digest: requestDigest,
        team_namespace: "robot-team-001",
        configured_scene_context: {
          run_mode: "scene_configuration",
          team_namespace: "robot-team-001",
          scene_id: "interiorgs-839873",
          task_id: "planar-mug-push",
          configuration_run_id: "run-missing-offering",
          evaluation_episode_executed: false,
        },
        state: "queued_in_pipeline",
      });
      const missingOffering = structuredClone(receipt);
      missingOffering.launch_id = "launch-missing-offering";
      missingOffering.run_id = "run-missing-offering";
      delete missingOffering.terminal_evidence.scene_configuration;
      missingOffering.receipt_digest = canonicalArtifactDigest(
        missingOffering,
        "receipt_digest",
      );
      const missingOfferingResponse = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(missingOffering),
      });
      expect(missingOfferingResponse.status).toBe(409);
      await expect(missingOfferingResponse.json()).resolves.toMatchObject({
        code: "configured_scene_offering_missing",
      });
      expect(state.records.get("launch-missing-offering")?.terminal_receipt)
        .toBeUndefined();

      state.records.set("launch-blocked", {
        launch_id: "launch-blocked",
        run_id: "run-blocked",
        request_digest: requestDigest,
        team_namespace: "robot-team-001",
        configured_scene_context: {
          run_mode: "scene_configuration",
          team_namespace: "robot-team-001",
          scene_id: "interiorgs-839873",
          task_id: "planar-mug-push",
          configuration_run_id: "configuration-run-blocked",
          evaluation_episode_executed: false,
        },
        state: "queued_in_pipeline",
      });
      const blocked = structuredClone(receipt);
      blocked.launch_id = "launch-blocked";
      blocked.run_id = "run-blocked";
      blocked.status = "blocked";
      blocked.allocator_exit_code = 2;
      blocked.terminal_evidence.status = "failed";
      delete blocked.terminal_evidence.scene_configuration;
      blocked.blockers = ["provider_refused"];
      blocked.receipt_digest = canonicalArtifactDigest(blocked, "receipt_digest");
      const blockedTerminalResponse = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(blocked),
      });
      expect(blockedTerminalResponse.status).toBe(201);
      expect(state.records.get("launch-blocked")).toMatchObject({
        state: "blocked",
        terminal_receipt_digest: blocked.receipt_digest,
        terminal_receipt: {
          status: "blocked",
          blockers: ["provider_refused"],
        },
      });
      expect(state.records.get("launch-blocked")?.configured_scene_offering)
        .toBeUndefined();

      state.records.set("launch-invalid", {
        launch_id: "launch-invalid",
        run_id: "run-invalid",
        request_digest: requestDigest,
        team_namespace: "robot-team-001",
        state: "queued_in_pipeline",
      });
      const invalidReceipt = structuredClone(receipt);
      invalidReceipt.launch_id = "launch-invalid";
      invalidReceipt.run_id = "run-invalid";
      invalidReceipt.terminal_evidence.scene_configuration.configured_scene_offering
        .presentation.task_thumbnail.digest = sha("9");
      invalidReceipt.receipt_digest = canonicalArtifactDigest(invalidReceipt, "receipt_digest");
      const refused = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(invalidReceipt),
      });
      expect(refused.status).toBe(400);
      expect(state.records.get("launch-invalid")).toEqual({
        launch_id: "launch-invalid",
        run_id: "run-invalid",
        request_digest: requestDigest,
        team_namespace: "robot-team-001",
        state: "queued_in_pipeline",
      });

      state.records.set("launch-wrong-selection", {
        launch_id: "launch-wrong-selection",
        run_id: "run-wrong-selection",
        request_digest: requestDigest,
        team_namespace: "robot-team-001",
        state: "queued_in_pipeline",
      });
      const wrongSelection = structuredClone(receipt);
      wrongSelection.launch_id = "launch-wrong-selection";
      wrongSelection.run_id = "run-wrong-selection";
      const wrongSelectionOffering = wrongSelection.terminal_evidence.scene_configuration
        .configured_scene_offering;
      wrongSelectionOffering.configuration_run_id = "run-wrong-selection";
      wrongSelectionOffering.offering_digest = canonicalArtifactDigest(
        wrongSelectionOffering,
        "offering_digest",
      );
      wrongSelection.terminal_evidence.scene_configuration
        .task_thumbnail_selection_receipt_reference = immutableRef(
          "wrong-selection-receipt",
          "9",
        );
      wrongSelection.receipt_digest = canonicalArtifactDigest(
        wrongSelection,
        "receipt_digest",
      );
      const wrongSelectionResponse = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(wrongSelection),
      });
      expect(wrongSelectionResponse.status).toBe(400);
      expect(state.records.get("launch-wrong-selection")?.configured_scene_offering)
        .toBeUndefined();

      state.records.set("launch-wrong-run", {
        launch_id: "launch-wrong-run",
        run_id: "run-wrong-run",
        request_digest: requestDigest,
        team_namespace: "robot-team-001",
        configured_scene_context: {
          run_mode: "scene_configuration",
          team_namespace: "robot-team-001",
          scene_id: "interiorgs-839873",
          task_id: "planar-mug-push",
          configuration_run_id: "configuration-run-other",
          evaluation_episode_executed: false,
        },
        state: "queued_in_pipeline",
      });
      const wrongRun = structuredClone(receipt);
      wrongRun.launch_id = "launch-wrong-run";
      wrongRun.run_id = "run-wrong-run";
      wrongRun.receipt_digest = canonicalArtifactDigest(wrongRun, "receipt_digest");
      const wrongRunResponse = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(wrongRun),
      });
      expect(wrongRunResponse.status).toBe(409);
      expect(state.records.get("launch-wrong-run")?.configured_scene_offering).toBeUndefined();

      state.records.set("launch-wrong-team", {
        launch_id: "launch-wrong-team",
        run_id: "run-wrong-team",
        request_digest: requestDigest,
        team_namespace: "robot-team-001",
        state: "queued_in_pipeline",
      });
      const wrongTeam = structuredClone(receipt);
      wrongTeam.launch_id = "launch-wrong-team";
      wrongTeam.run_id = "run-wrong-team";
      const wrongTeamOffering = wrongTeam.terminal_evidence.scene_configuration
        .configured_scene_offering;
      wrongTeamOffering.configuration_run_id = "run-wrong-team";
      wrongTeamOffering.team_namespace = "other-team";
      wrongTeamOffering.offering_digest = canonicalArtifactDigest(
        wrongTeamOffering,
        "offering_digest",
      );
      wrongTeam.receipt_digest = canonicalArtifactDigest(wrongTeam, "receipt_digest");
      const wrongTeamResponse = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(wrongTeam),
      });
      expect(wrongTeamResponse.status).toBe(409);
      expect(state.records.get("launch-wrong-team")?.configured_scene_offering).toBeUndefined();

      state.records.set("launch-blocked-offering", {
        launch_id: "launch-blocked-offering",
        run_id: "run-blocked-offering",
        request_digest: requestDigest,
        team_namespace: "robot-team-001",
        state: "queued_in_pipeline",
      });
      const blockedOffering = structuredClone(receipt);
      blockedOffering.launch_id = "launch-blocked-offering";
      blockedOffering.run_id = "run-blocked-offering";
      blockedOffering.status = "blocked";
      blockedOffering.blockers = ["provider_refused"];
      const blockedEmbeddedOffering = blockedOffering.terminal_evidence
        .scene_configuration.configured_scene_offering;
      blockedEmbeddedOffering.configuration_run_id = "run-blocked-offering";
      blockedEmbeddedOffering.offering_digest = canonicalArtifactDigest(
        blockedEmbeddedOffering,
        "offering_digest",
      );
      blockedOffering.receipt_digest = canonicalArtifactDigest(
        blockedOffering,
        "receipt_digest",
      );
      const blockedResponse = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(blockedOffering),
      });
      expect(blockedResponse.status).toBe(400);
      expect(state.records.get("launch-blocked-offering")?.configured_scene_offering).toBeUndefined();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("upgrades one publication-only blocked launch while preserving terminal history", async () => {
    const requestDigest = sha("a");
    const original: Record<string, any> = {
      schema_version: "task_evaluation_launch_receipt.v1",
      status: "blocked",
      launch_id: "launch-publication-recovery",
      run_id: "launch-publication-recovery",
      request_digest: requestDigest,
      launch_profile_digest: sha("b"),
      binding_digest: sha("c"),
      canonical_allocator: CANONICAL_TASK_EVALUATION_ALLOCATOR,
      allocator_exit_code: 2,
      execute_requested: true,
      provider_mutation_attempted: true,
      terminal_evidence: { status: "blocked" },
      blockers: ["scene_configuration_configured_revision_not_published"],
      raw_secret_values_recorded: false,
      agent_operator_used: false,
      claim_ceiling: "development_only",
    };
    original.receipt_digest = canonicalArtifactDigest(original, "receipt_digest");
    state.records.set("launch-publication-recovery", {
      launch_id: "launch-publication-recovery",
      run_id: "launch-publication-recovery",
      request_digest: requestDigest,
      team_namespace: "robot-team-001",
      configured_scene_context: {
        run_mode: "scene_configuration",
        team_namespace: "robot-team-001",
        scene_id: "interiorgs-839873",
        task_id: "planar-mug-push",
        configuration_run_id: "configuration-run-recovered",
        evaluation_episode_executed: false,
      },
      state: "blocked",
      terminal_receipt: structuredClone(original),
      terminal_receipt_digest: original.receipt_digest,
    });
    const offering = pausedUngradedConfiguredSceneOffering();
    offering.configuration_run_id = "configuration-run-recovered";
    offering.offering_digest = canonicalArtifactDigest(offering, "offering_digest");
    const publicationRecovery: Record<string, any> = {
      schema_version: "task_evaluation_scene_configuration_publication_recovery.v1",
      status: "completed",
      recovery_source_commit: "d".repeat(40),
      provider_execution_repeated: false,
      paid_execution_requested: false,
      provider_mutation_performed: false,
      original_configuration_result_digest: sha("d"),
      provider_result_digest: sha("e"),
      original_terminal_receipt_digest: original.receipt_digest,
      recovered_configuration_result_digest: sha("f"),
      queue_finalization_digest: sha("1"),
      recovery_digest: "",
    };
    publicationRecovery.recovery_digest = canonicalArtifactDigest(
      publicationRecovery,
      "recovery_digest",
    );
    const recovered: Record<string, any> = {
      ...structuredClone(original),
      status: "completed",
      blockers: [],
      terminal_evidence: {
        status: "passed",
        scene_configuration: {
          configured_scene_revision_digest:
            offering.evaluation_preparation_binding.configured_scene_revision_digest,
          configured_scene_revision_reference: pipelineReference(
            offering.evaluation_preparation_binding.configured_scene_revision,
          ),
          configured_scene_bundle_reference: pipelineReference(
            offering.evaluation_preparation_binding.configured_scene_bundle,
          ),
          task_thumbnail_reference: pipelineReference(
            offering.presentation.task_thumbnail,
          ),
          task_thumbnail_selection_receipt_reference: pipelineReference(
            offering.presentation.selection_receipt,
          ),
          configured_scene_offering: offering,
        },
        publication_recovery: publicationRecovery,
      },
      publication_recovery: publicationRecovery,
      receipt_digest: "",
    };
    recovered.receipt_digest = canonicalArtifactDigest(recovered, "receipt_digest");
    const { server, url } = await startInternalServer();
    try {
      const response = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(recovered),
      });
      expect(response.status).toBe(201);
      await expect(response.json()).resolves.toMatchObject({
        status: "completed",
        publication_recovery_applied: true,
        configured_scene_offering_digest: offering.offering_digest,
      });
      expect(state.records.get("launch-publication-recovery")).toMatchObject({
        state: "completed",
        terminal_receipt_before_publication_recovery_digest: original.receipt_digest,
        terminal_receipt_before_publication_recovery: {
          status: "blocked",
          receipt_digest: original.receipt_digest,
        },
        terminal_receipt_digest: recovered.receipt_digest,
        terminal_receipt: { status: "completed" },
        publication_recovery: {
          provider_execution_repeated: false,
          original_terminal_receipt_digest: original.receipt_digest,
        },
        configured_scene_offering_state: "launch_ready",
        configured_scene_offering_digest: offering.offering_digest,
      });

      state.records.set("launch-publication-recovery", {
        ...state.records.get("launch-publication-recovery"),
        configured_scene_offering_state: "configured_controls_pending",
      });
      const replay = await fetch(`${url}/task-evaluation-launches`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(recovered),
      });
      expect(replay.status).toBe(200);
      await expect(replay.json()).resolves.toMatchObject({
        already_exists: true,
        configured_scene_catalog_state_repaired: true,
      });
      expect(state.records.get("launch-publication-recovery")).toMatchObject({
        configured_scene_offering_state: "launch_ready",
        terminal_receipt_digest: recovered.receipt_digest,
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
