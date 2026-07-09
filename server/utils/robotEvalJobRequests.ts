import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { buildPipelineSyncSignature } from "./pipelineSyncSecurity";

const JOB_REQUEST_SCHEMA_VERSION = "robot_eval_job_request.v1";
const JOB_REQUEST_QUEUE_CONTRACT = "robot_eval_job_request_inbox.v1";
const DEFAULT_FORWARD_TIMEOUT_MS = 60000;
const FORWARD_REQUIRED_ENV = "ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED";
const FORWARD_CAPTURE_ROOT_ENV = "ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT";
const FORWARD_CAPTURE_ROOT_BY_SITE_ENV =
  "ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON";

const CLAIM_BOUNDARY = {
  simulator_execution_proven: false,
  rank_fidelity_result_proven: false,
  robot_policy_execution_proven: false,
  physics_contact_validated: false,
  non_ranking_operational_claim_validated: false,
  virtual_evaluation_proves_evaluation_readiness: false,
  virtual_evaluation_proves_non_ranking_operational_claim: false,
  public_claim_upgrade_allowed: false,
};

const POLICY_MODALITIES = [
  "policy_api_endpoint",
  "docker_container",
  "recorded_action_trace",
  "high_level_skill_trace",
  "teleop_demo",
  "sim_controller_plugin",
] as const;

export const ROBOT_EVAL_PIPELINE_EXPECTED_OUTPUTS = [
  "scheduler_decision",
  "worker_launch_plan",
  "worker_manifest",
  "gpu_provider_launch_request",
  "gpu_provider_launcher_result",
  "runpod_provider_adapter_result",
  "gpu_cost_control_ledger",
  "startup_architecture_audit",
  "worker_runtime_manifest",
  "worker_runtime_preflight",
  "job_run_manifest",
  "proof_boundary",
  "proof_boundary.json",
  "proof_boundaries.json",
  "scenario_eval_matrix.json",
  "policy_ranking_scorecard.json",
  "candidate_selection_report.json",
  "wam_eval_claim_boundary.json",
  "post_training_data_package_export_manifest.json",
  "metrics",
  "trace",
  "simulator_pov",
  "manipulation_object_contracts",
  "manipulation_policy_tier_matrix",
  "manipulation_physics_output",
  "manipulation_contact_manifest",
  "manipulation_g1_model_manifest",
  "manipulation_controller_trace",
  "lucky_g1_reference_adapter_manifest",
  "lucky_g1_reference_trace",
  "lucky_g1_reference_video_manifest",
  "stdout_log",
  "stderr_log",
] as const;

const REQUIRED_ARTIFACT_CONTRACT_OUTPUTS = [
  "scenario_eval_matrix.json",
  "policy_ranking_scorecard.json",
  "candidate_selection_report.json",
  "wam_eval_claim_boundary.json",
  "post_training_data_package_export_manifest.json",
  "proof_boundary.json",
  "proof_boundaries.json",
] as const;

const DEFAULT_SIMULATOR_ROBOT_PROFILE = {
  id: "unitree_g1_humanoid",
  label: "Unitree G1",
  embodiment: "humanoid",
  sensors: ["rgb", "depth", "proprioception"],
};

const EVALUATOR_BACKEND_NEUTRAL_FIELDS = {
  evaluation_scope: {
    mode: "virtual_policy_evaluation",
    public_label: "WAM/VLA policy evaluation",
    physical_robot_deployment_claim_allowed: false,
  },
  wam_evaluator_backend: "pipeline_selected",
  allowed_evaluator_backends: [
    "wam_policy_runtime",
    "vla_policy_runtime",
    "mujoco_policy_adapter",
    "isaac_policy_adapter",
    "newton_policy_adapter",
    "fixture_policy_adapter",
  ],
  optional_physics_state_authority: {
    mode: "optional_sanity_check",
    allowed_authorities: ["mujoco", "isaac", "newton"],
    required_for_request_acceptance: false,
    proof_role: "physics_state_sanity_check_only",
  },
  proof_boundaries: {
    virtual_evaluation_proves_evaluation_readiness: false,
    virtual_evaluation_proves_non_ranking_operational_claim: false,
    virtual_evaluation_is_policy_evidence_only: true,
    evaluation_readiness_requires_owner_system_proof: true,
    non_ranking_operational_claim_requires_separate_qualified_review: true,
  },
};

type PolicyModality = (typeof POLICY_MODALITIES)[number];
type CaptureRootOverrideResolution =
  | { ok: true; captureRoot?: string; source?: "site" | "global" }
  | { ok: false; blockers: string[] };
type PipelineForwardJobRequestResolution =
  | {
      ok: true;
      jobRequest: Record<string, unknown>;
      applied: boolean;
      source?: "site" | "global";
    }
  | { ok: false; blockers: string[] };

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function fingerprint(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex")
    .slice(0, 10);
}

function orderedPolicyPackage(policySubmission: Record<string, unknown>) {
  return POLICY_MODALITIES.reduce<Record<PolicyModality, unknown>>((acc, modality) => {
    acc[modality] = policySubmission[modality] || {};
    return acc;
  }, {} as Record<PolicyModality, unknown>);
}

function buildExecutionRequest() {
  return {
    schema_version: "blueprint.robot_eval_execution_request.v1",
    webapp_role: "queue_and_forward_only",
    scheduler_owner: "BlueprintCapturePipeline",
    evaluation_scope: EVALUATOR_BACKEND_NEUTRAL_FIELDS.evaluation_scope,
    wam_evaluator_backend: EVALUATOR_BACKEND_NEUTRAL_FIELDS.wam_evaluator_backend,
    allowed_evaluator_backends: EVALUATOR_BACKEND_NEUTRAL_FIELDS.allowed_evaluator_backends,
    optional_physics_state_authority:
      EVALUATOR_BACKEND_NEUTRAL_FIELDS.optional_physics_state_authority,
    proof_boundaries: EVALUATOR_BACKEND_NEUTRAL_FIELDS.proof_boundaries,
    // Legacy/internal compatibility for existing pipeline consumers that still read simulator scope.
    scope: {
      mode: "simulator_only",
      label: "Unitree G1 MuJoCo simulator evaluation",
      physical_robot_deployment_claim_allowed: false,
    },
    queueing: {
      mode: "async_job",
      customer_response: "job_id_and_status_only",
      web_request_must_not_wait_for_simulator: true,
    },
    worker_selection: {
      mode: "blueprint_selects_fastest_cheapest_available_simulator_worker",
      customer_provider_choice_required: false,
      provider_complexity_hidden_by_default: true,
    },
    preflight: {
      cpu_preflight_required_before_gpu: true,
      blocks_gpu_when_missing: true,
      required_artifacts: [
        "scene_asset_inventory",
        "scene_asset_dependency_audit",
        "cpu_preflight_scorecard",
        "episode_spec_manifest",
        "gpu_handoff_packet",
      ],
    },
    // Legacy/internal compatibility for existing pipeline consumers that still read simulator routing.
    simulator_routing: {
      requested_backend: "pipeline_selected",
      allowed_backends: ["mujoco", "isaac_sim", "isaac_lab_arena", "pybullet", "fixture"],
      default_first_pass_backend: "mujoco",
      default_first_gpu_backend: "mujoco",
      simulator_preference: "mujoco",
      default_robot_profile_id: DEFAULT_SIMULATOR_ROBOT_PROFILE.id,
      proxy_backends: ["mujoco", "pybullet", "fixture"],
      escalation_backends: ["isaac_sim", "isaac_lab_arena"],
      selection_policy: {
        schema_version: "robot_eval_simulator_selection_policy.v1",
        mode: "mujoco_first_unless_proof_requires_isaac",
        first_pass_backend: "mujoco",
        use_mujoco_when: [
          "cheapest_first_real_simulator_pass",
          "fast_cpu_or_low_cost_owner_runtime",
          "compatible_mjcf_robot_asset_or_default_unitree_g1_smoke",
          "early_policy_and_spawn_smoke_before_gpu_spend",
        ],
        escalate_to_isaac_when: [
          "rich_usd_or_openusd_scene_load_required",
          "isaac_robot_asset_proof_required",
          "rtx_sensor_or_camera_rendering_required",
          "contact_or_physics_validation_requires_isaac_stack",
        ],
        use_isaac_lab_arena_when: [
          "isaac_lab_arena_batch_rollouts_required",
          "large_scenario_matrix_or_sharded_eval_required",
          "owner_arena_result_ingest_required",
        ],
      },
      proof_boundaries: {
        webapp_request_selects_policy_not_execution: true,
        mujoco_proof_does_not_clear_isaac_sim_gate: true,
        simulator_policy_does_not_prove_rank_fidelity: true,
        virtual_evaluation_does_not_prove_evaluation_readiness: true,
        virtual_evaluation_does_not_prove_non_ranking_operational_claim: true,
      },
      isaac_gpu_constraint: "rtx_rt_core_required_no_a100_h100",
    },
    gpu_allocation: {
      mode: "on_demand_with_optional_warm_pool",
      allocation_owner: "BlueprintCapturePipeline_or_owner_gpu_worker",
      allocation_allowed_by_webapp: false,
      gpu_spend_approved: false,
      max_budget_usd: 0,
      hard_timeout_seconds: 120,
      idle_shutdown_required: true,
      persistent_cache_recommended: true,
    },
    artifact_contract: {
      expected_outputs: [...ROBOT_EVAL_PIPELINE_EXPECTED_OUTPUTS],
      webapp_queues_and_forwards_only: true,
      pipeline_owns_execution_ranking_and_artifacts: true,
      startup_artifacts_are_advisory_until_owner_runtime_proof: true,
      ranking_outputs_are_advisory_until_owner_system_proof: true,
      ptdp_export_manifest_does_not_prove_delivery_or_training: true,
      simulator_execution_proven_by_webapp: false,
      public_claim_upgrade_allowed: false,
    },
  };
}

function hasObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSelectedPayload(value: unknown): value is Record<string, unknown> {
  return (
    hasObject(value) &&
    Object.values(value).some((item) => {
      if (Array.isArray(item)) {
        return item.length > 0;
      }
      return item !== undefined && item !== null && String(item).trim() !== "";
    })
  );
}

function stringField(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const normalized = String(payload[key] || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function validateRequiredLineageField(params: {
  errors: string[];
  payload: Record<string, unknown>;
  field: string;
  path: string;
  expectedValue: string;
  expectedPath: string;
}) {
  const actual = stringField(params.payload, params.field);
  const fieldPath = `${params.path}.${params.field}`;
  if (!actual) {
    params.errors.push(`${fieldPath} is required`);
    return;
  }
  if (params.expectedValue && actual !== params.expectedValue) {
    params.errors.push(`${fieldPath} must match ${params.expectedPath}`);
  }
}

function validateSelectedPolicyModality(
  modality: PolicyModality,
  payload: Record<string, unknown>,
) {
  const errors: string[] = [];
  if (modality === "policy_api_endpoint") {
    const endpointUrl = stringField(payload, "endpoint_url", "endpointUrl", "url");
    if (!/^https?:\/\//i.test(endpointUrl)) {
      errors.push("policy_package.policy_api_endpoint.endpoint_url is required");
    }
  } else if (modality === "docker_container") {
    if (!stringField(payload, "image_ref", "imageRef")) {
      errors.push("policy_package.docker_container.image_ref is required");
    }
    if (!stringField(payload, "digest", "digestChecksum").startsWith("sha256:")) {
      errors.push("policy_package.docker_container.digest is required");
    }
  } else if (modality === "recorded_action_trace") {
    if (!stringField(payload, "trace_manifest_uri", "traceManifestUri")) {
      errors.push("policy_package.recorded_action_trace.trace_manifest_uri is required");
    }
    if (!stringField(payload, "timestamp_alignment", "timestampAlignment")) {
      errors.push("policy_package.recorded_action_trace.timestamp_alignment is required");
    }
  } else if (modality === "high_level_skill_trace") {
    const sequence = payload.ordered_skill_sequence || payload.orderedSkillSequence;
    if (!(Array.isArray(sequence) && sequence.length > 0)) {
      errors.push("policy_package.high_level_skill_trace.ordered_skill_sequence is required");
    }
  } else if (modality === "teleop_demo") {
    if (!stringField(payload, "demo_artifact_uri", "demoArtifactUri")) {
      errors.push("policy_package.teleop_demo.demo_artifact_uri is required");
    }
    if (
      !stringField(
        payload,
        "rights_privacy_attestation",
        "rightsPrivacyAttestation",
      )
    ) {
      errors.push("policy_package.teleop_demo.rights_privacy_attestation is required");
    }
  } else if (modality === "sim_controller_plugin") {
    if (!stringField(payload, "simulator_framework", "simulatorFramework")) {
      errors.push("policy_package.sim_controller_plugin.simulator_framework is required");
    }
    if (!stringField(payload, "plugin_uri", "pluginUri")) {
      errors.push("policy_package.sim_controller_plugin.plugin_uri is required");
    }
  }
  return errors;
}

function sanitizeFileStem(value: string) {
  return slugify(value).slice(0, 160) || "robot-eval-job-request";
}

export function buildRobotEvalJobRequest(input: {
  buyerRequestId?: string | null;
  sitePackage: {
    siteSlug: string;
    siteId: string;
    siteName: string;
    siteSubmissionId?: string | null;
    captureJobId?: string | null;
    captureId?: string | null;
    captureRoot: string;
    pipelinePrefix?: string | null;
    accessState: string;
    artifactUris: {
      manifestUri?: string;
      taskCardsUri?: string;
      scenarioCardsUri?: string;
      evalCardsUri?: string;
      proofBoundariesUri?: string;
      taskThresholdsUri?: string;
      publicationReadinessUri?: string;
      sceneAssetInventoryUri?: string;
      sceneAssetDependencyAuditUri?: string;
      sceneAssetPreflightUri?: string;
      sceneAssetInspectionUri?: string;
      sceneFrameEstimateUri?: string;
      colliderProxyPlanUri?: string;
      cpuSceneProxyManifestUri?: string;
      cpuPreflightScorecardUri?: string;
      taskAnchorProposalManifestUri?: string;
      episodeSpecManifestUri?: string;
      episodeSpecsUri?: string;
      spawnPoseValidationManifestUri?: string;
      cpuPreflightManifestUri?: string;
      preGpuReadinessSummaryUri?: string;
      cpuSimulatorPreflightManifestUri?: string;
      gpuHandoffPacketUri?: string;
      gpuOwnerSystemProofSchemaUri?: string;
      gpuRunChecklistUri?: string;
      ownerGpuSimulatorExecutionBlockedManifestUri?: string;
    };
    publication: {
      readyToEvaluatePublishable: boolean;
      publicationLabel: string;
    };
    preflightSummary?: {
      readyForOwnerGpuPreflight?: boolean | null;
      localCpuSmokeRan?: boolean | null;
    };
  };
  selection: {
    taskId: string;
    scenarioId: string;
    robotProfileId: string;
    policyId: string;
  };
  robotTeam: {
    customerId: string;
    companyName: string;
    contactEmail?: string | null;
  };
  entitlement: {
    accessState: string;
    entitlementId?: string | null;
    approved: boolean;
  };
  policySubmission: Record<string, unknown>;
  source: {
    route: string;
    surface: string;
  };
}) {
  const jobBase = [
    "robot-eval",
    slugify(input.sitePackage.siteSlug),
    slugify(input.selection.taskId),
  ].join("-");
  const buyerRequestId =
    input.buyerRequestId ||
    `buyer-request-${slugify(input.sitePackage.siteSlug)}-${slugify(input.selection.taskId)}-${fingerprint({
      scenario: input.selection.scenarioId,
      policy: input.selection.policyId,
      customer: input.robotTeam.customerId,
    })}`;
  const jobId = `${jobBase}-${fingerprint({
    site: input.sitePackage.siteSlug,
    task: input.selection.taskId,
    scenario: input.selection.scenarioId,
    policy: input.selection.policyId,
    customer: input.robotTeam.customerId,
  })}`;

  return {
    schema_version: JOB_REQUEST_SCHEMA_VERSION,
    job_id: jobId,
    buyer_request_id: buyerRequestId,
    customer: {
      id: input.robotTeam.customerId,
      name: input.robotTeam.companyName,
      contact_email: input.robotTeam.contactEmail || null,
    },
    site_package: {
      site_slug: input.sitePackage.siteSlug,
      site_id: input.sitePackage.siteId,
      site_submission_id: input.sitePackage.siteSubmissionId || null,
      capture_job_id: input.sitePackage.captureJobId || null,
      capture_id: input.sitePackage.captureId || null,
      buyer_request_id: buyerRequestId,
      pipeline_prefix: input.sitePackage.pipelinePrefix || null,
      site_name: input.sitePackage.siteName,
      capture_root: input.sitePackage.captureRoot,
      package_uri: input.sitePackage.artifactUris.manifestUri || null,
      access_state: input.sitePackage.accessState,
      publication_ready_to_evaluate: input.sitePackage.publication.readyToEvaluatePublishable,
      publication_label: input.sitePackage.publication.publicationLabel,
      task_cards_uri: input.sitePackage.artifactUris.taskCardsUri || null,
      scenario_cards_uri: input.sitePackage.artifactUris.scenarioCardsUri || null,
      eval_cards_uri: input.sitePackage.artifactUris.evalCardsUri || null,
      proof_boundaries_uri: input.sitePackage.artifactUris.proofBoundariesUri || null,
      task_thresholds_uri: input.sitePackage.artifactUris.taskThresholdsUri || null,
      publication_readiness_uri:
        input.sitePackage.artifactUris.publicationReadinessUri || null,
      scene_asset_inventory_uri:
        input.sitePackage.artifactUris.sceneAssetInventoryUri || null,
      scene_asset_dependency_audit_uri:
        input.sitePackage.artifactUris.sceneAssetDependencyAuditUri || null,
      scene_asset_preflight_uri:
        input.sitePackage.artifactUris.sceneAssetPreflightUri || null,
      scene_asset_inspection_uri:
        input.sitePackage.artifactUris.sceneAssetInspectionUri || null,
      scene_frame_estimate_uri:
        input.sitePackage.artifactUris.sceneFrameEstimateUri || null,
      collider_proxy_plan_uri:
        input.sitePackage.artifactUris.colliderProxyPlanUri || null,
      cpu_scene_proxy_manifest_uri:
        input.sitePackage.artifactUris.cpuSceneProxyManifestUri || null,
      cpu_preflight_scorecard_uri:
        input.sitePackage.artifactUris.cpuPreflightScorecardUri || null,
      task_anchor_proposal_manifest_uri:
        input.sitePackage.artifactUris.taskAnchorProposalManifestUri || null,
      episode_spec_manifest_uri:
        input.sitePackage.artifactUris.episodeSpecManifestUri || null,
      episode_specs_uri:
        input.sitePackage.artifactUris.episodeSpecsUri || null,
      spawn_pose_validation_manifest_uri:
        input.sitePackage.artifactUris.spawnPoseValidationManifestUri || null,
      cpu_preflight_manifest_uri:
        input.sitePackage.artifactUris.cpuPreflightManifestUri || null,
      pre_gpu_readiness_summary_uri:
        input.sitePackage.artifactUris.preGpuReadinessSummaryUri || null,
      cpu_simulator_preflight_manifest_uri:
        input.sitePackage.artifactUris.cpuSimulatorPreflightManifestUri || null,
      gpu_handoff_packet_uri:
        input.sitePackage.artifactUris.gpuHandoffPacketUri || null,
      gpu_owner_system_proof_schema_uri:
        input.sitePackage.artifactUris.gpuOwnerSystemProofSchemaUri || null,
      gpu_run_checklist_uri:
        input.sitePackage.artifactUris.gpuRunChecklistUri || null,
      owner_gpu_simulator_execution_blocked_manifest_uri:
        input.sitePackage.artifactUris.ownerGpuSimulatorExecutionBlockedManifestUri || null,
    },
    requested_tasks: [
      {
        task_id: input.selection.taskId,
        scenario_ids: [input.selection.scenarioId],
        task_thresholds_uri: input.sitePackage.artifactUris.taskThresholdsUri || null,
      },
    ],
    robot_profile: {
      robot_profile_id: input.selection.robotProfileId,
      robot_name:
        input.selection.robotProfileId === DEFAULT_SIMULATOR_ROBOT_PROFILE.id
          ? DEFAULT_SIMULATOR_ROBOT_PROFILE.label
          : null,
      embodiment:
        input.selection.robotProfileId === DEFAULT_SIMULATOR_ROBOT_PROFILE.id
          ? DEFAULT_SIMULATOR_ROBOT_PROFILE.embodiment
          : null,
      sensors:
        input.selection.robotProfileId === DEFAULT_SIMULATOR_ROBOT_PROFILE.id
          ? DEFAULT_SIMULATOR_ROBOT_PROFILE.sensors
          : [],
    },
    policy_package: orderedPolicyPackage(input.policySubmission),
    entitlement: {
      access_state: input.entitlement.accessState,
      entitlement_id: input.entitlement.entitlementId || null,
      approved: input.entitlement.approved,
    },
    operation: "evaluate_only",
    evaluation_scope: EVALUATOR_BACKEND_NEUTRAL_FIELDS.evaluation_scope,
    wam_evaluator_backend: EVALUATOR_BACKEND_NEUTRAL_FIELDS.wam_evaluator_backend,
    allowed_evaluator_backends: EVALUATOR_BACKEND_NEUTRAL_FIELDS.allowed_evaluator_backends,
    optional_physics_state_authority:
      EVALUATOR_BACKEND_NEUTRAL_FIELDS.optional_physics_state_authority,
    // Legacy/internal compatibility for existing consumers; public product copy should use WAM/VLA policy evaluation.
    simulator_preference: "mujoco_first",
    simulator_scope: {
      mode: "simulator_only",
      robot:
        input.selection.robotProfileId === DEFAULT_SIMULATOR_ROBOT_PROFILE.id
          ? DEFAULT_SIMULATOR_ROBOT_PROFILE.label
          : input.selection.robotProfileId,
      simulator: "MuJoCo",
      customer_label: "WAM/VLA policy evaluation with internal MuJoCo adapter",
      provider_strategy: "Blueprint pipeline selects the replaceable WAM/VLA evaluator backend",
      physical_robot_deployment_claim_allowed: false,
    },
    cosmos_training_preference: { mode: "export_only" },
    budget: { budget_usd: 0, timeout_seconds: 120 },
    execution_request: buildExecutionRequest(),
    pipeline_trigger: {
      status: "queued_for_pipeline",
      command: "blueprint-run-robot-eval-job",
      default_provisioner: "fixture_local",
      default_simulator: "mujoco",
      cpu_pre_gpu_preflight: {
        scene_asset_inventory_uri:
          input.sitePackage.artifactUris.sceneAssetInventoryUri || null,
        scene_asset_dependency_audit_uri:
          input.sitePackage.artifactUris.sceneAssetDependencyAuditUri || null,
        scene_asset_preflight_uri:
          input.sitePackage.artifactUris.sceneAssetPreflightUri || null,
        scene_asset_inspection_uri:
          input.sitePackage.artifactUris.sceneAssetInspectionUri || null,
        collider_proxy_plan_uri:
          input.sitePackage.artifactUris.colliderProxyPlanUri || null,
        cpu_scene_proxy_manifest_uri:
          input.sitePackage.artifactUris.cpuSceneProxyManifestUri || null,
        cpu_preflight_scorecard_uri:
          input.sitePackage.artifactUris.cpuPreflightScorecardUri || null,
        task_anchor_proposal_manifest_uri:
          input.sitePackage.artifactUris.taskAnchorProposalManifestUri || null,
        episode_spec_manifest_uri:
          input.sitePackage.artifactUris.episodeSpecManifestUri || null,
        episode_specs_uri:
          input.sitePackage.artifactUris.episodeSpecsUri || null,
        spawn_pose_validation_manifest_uri:
          input.sitePackage.artifactUris.spawnPoseValidationManifestUri || null,
        cpu_preflight_manifest_uri:
          input.sitePackage.artifactUris.cpuPreflightManifestUri || null,
        pre_gpu_readiness_summary_uri:
          input.sitePackage.artifactUris.preGpuReadinessSummaryUri || null,
        cpu_simulator_preflight_manifest_uri:
          input.sitePackage.artifactUris.cpuSimulatorPreflightManifestUri || null,
        gpu_handoff_packet_uri:
          input.sitePackage.artifactUris.gpuHandoffPacketUri || null,
        gpu_owner_system_proof_schema_uri:
          input.sitePackage.artifactUris.gpuOwnerSystemProofSchemaUri || null,
        gpu_run_checklist_uri:
          input.sitePackage.artifactUris.gpuRunChecklistUri || null,
        owner_gpu_simulator_execution_blocked_manifest_uri:
          input.sitePackage.artifactUris.ownerGpuSimulatorExecutionBlockedManifestUri || null,
        ready_for_owner_gpu_preflight:
          input.sitePackage.preflightSummary?.readyForOwnerGpuPreflight === true,
        owner_gpu_simulator_execution_proven: false,
        local_cpu_preflight_smoke_ran:
          input.sitePackage.preflightSummary?.localCpuSmokeRan === true,
        simulator_execution_proven: false,
        rank_fidelity_result_proven: false,
      },
    },
    rights_privacy_scope: {
      status: input.entitlement.approved ? "cleared_for_robot_eval" : "review_required",
      external_use_allowed: input.entitlement.approved,
      privacy_scope: "derived_deidentified_environment",
    },
    owner_system: {
      name: "Blueprint-WebApp",
      request_id: jobId,
      buyer_request_id: buyerRequestId,
      site_submission_id: input.sitePackage.siteSubmissionId || null,
      capture_job_id: input.sitePackage.captureJobId || null,
      capture_id: input.sitePackage.captureId || null,
    },
    source: {
      system: "Blueprint-WebApp",
      route: input.source.route,
      surface: input.source.surface,
      selection_state: {
        buyer_request_id: buyerRequestId,
        site_slug: input.sitePackage.siteSlug,
        site_submission_id: input.sitePackage.siteSubmissionId || null,
        capture_job_id: input.sitePackage.captureJobId || null,
        capture_id: input.sitePackage.captureId || null,
        task_id: input.selection.taskId,
        scenario_id: input.selection.scenarioId,
        policy_id: input.selection.policyId,
      },
    },
    proof_boundary: CLAIM_BOUNDARY,
  };
}

export function validateRobotEvalJobRequest(value: unknown): {
  ok: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!hasObject(value)) {
    return { ok: false, errors: ["request must be an object"] };
  }
  if (value.schema_version !== JOB_REQUEST_SCHEMA_VERSION) {
    errors.push(`schema_version must be ${JOB_REQUEST_SCHEMA_VERSION}`);
  }
  const jobId = String(value.job_id || "").trim();
  const buyerRequestId = String(value.buyer_request_id || "").trim();
  if (!jobId) errors.push("job_id is required");
  if (!buyerRequestId) errors.push("buyer_request_id is required");

  const sitePackage = value.site_package;
  let siteSubmissionId = "";
  let captureJobId = "";
  let captureId = "";
  if (!hasObject(sitePackage)) {
    errors.push("site_package is required");
  } else {
    siteSubmissionId = stringField(sitePackage, "site_submission_id");
    captureJobId = stringField(sitePackage, "capture_job_id");
    captureId = stringField(sitePackage, "capture_id");
    for (const field of [
      "site_slug",
      "site_id",
      "site_submission_id",
      "capture_job_id",
      "capture_id",
      "buyer_request_id",
      "capture_root",
      "package_uri",
      "task_thresholds_uri",
      "publication_readiness_uri",
    ]) {
      if (!String(sitePackage[field] || "").trim()) {
        errors.push(`site_package.${field} is required`);
      }
    }
    if (String(sitePackage.buyer_request_id || "").trim() !== buyerRequestId) {
      errors.push("site_package.buyer_request_id must match buyer_request_id");
    }
  }

  const ownerSystem = value.owner_system;
  if (!hasObject(ownerSystem)) {
    errors.push("owner_system is required");
  } else {
    validateRequiredLineageField({
      errors,
      payload: ownerSystem,
      field: "request_id",
      path: "owner_system",
      expectedValue: jobId,
      expectedPath: "job_id",
    });
    validateRequiredLineageField({
      errors,
      payload: ownerSystem,
      field: "buyer_request_id",
      path: "owner_system",
      expectedValue: buyerRequestId,
      expectedPath: "buyer_request_id",
    });
    validateRequiredLineageField({
      errors,
      payload: ownerSystem,
      field: "site_submission_id",
      path: "owner_system",
      expectedValue: siteSubmissionId,
      expectedPath: "site_package.site_submission_id",
    });
    validateRequiredLineageField({
      errors,
      payload: ownerSystem,
      field: "capture_job_id",
      path: "owner_system",
      expectedValue: captureJobId,
      expectedPath: "site_package.capture_job_id",
    });
    validateRequiredLineageField({
      errors,
      payload: ownerSystem,
      field: "capture_id",
      path: "owner_system",
      expectedValue: captureId,
      expectedPath: "site_package.capture_id",
    });
  }

  const source = value.source;
  if (!hasObject(source)) {
    errors.push("source is required");
  } else {
    const selectionState = source.selection_state;
    if (!hasObject(selectionState)) {
      errors.push("source.selection_state is required");
    } else {
      validateRequiredLineageField({
        errors,
        payload: selectionState,
        field: "buyer_request_id",
        path: "source.selection_state",
        expectedValue: buyerRequestId,
        expectedPath: "buyer_request_id",
      });
      validateRequiredLineageField({
        errors,
        payload: selectionState,
        field: "site_submission_id",
        path: "source.selection_state",
        expectedValue: siteSubmissionId,
        expectedPath: "site_package.site_submission_id",
      });
      validateRequiredLineageField({
        errors,
        payload: selectionState,
        field: "capture_job_id",
        path: "source.selection_state",
        expectedValue: captureJobId,
        expectedPath: "site_package.capture_job_id",
      });
      validateRequiredLineageField({
        errors,
        payload: selectionState,
        field: "capture_id",
        path: "source.selection_state",
        expectedValue: captureId,
        expectedPath: "site_package.capture_id",
      });
    }
  }

  const policyPackage = value.policy_package;
  if (!hasObject(policyPackage)) {
    errors.push("policy_package is required");
  } else {
    const selectedModalities: PolicyModality[] = [];
    for (const modality of POLICY_MODALITIES) {
      const payload = policyPackage[modality];
      if (hasSelectedPayload(payload)) {
        selectedModalities.push(modality);
        errors.push(...validateSelectedPolicyModality(modality, payload));
      }
    }
    if (selectedModalities.length === 0) {
      errors.push("policy_package must include at least one supported modality");
    }
  }


  const evaluationScope = value.evaluation_scope;
  if (evaluationScope !== undefined && !hasObject(evaluationScope)) {
    errors.push("evaluation_scope must be an object when provided");
  } else if (hasObject(evaluationScope)) {
    if (evaluationScope.mode !== "virtual_policy_evaluation") {
      errors.push("evaluation_scope.mode must be virtual_policy_evaluation");
    }
    if (evaluationScope.physical_robot_deployment_claim_allowed !== false) {
      errors.push(
        "evaluation_scope.physical_robot_deployment_claim_allowed must be false",
      );
    }
  }
  if (
    value.wam_evaluator_backend !== undefined &&
    value.wam_evaluator_backend !== "pipeline_selected"
  ) {
    errors.push("wam_evaluator_backend must be pipeline_selected");
  }
  if (
    value.allowed_evaluator_backends !== undefined &&
    (!Array.isArray(value.allowed_evaluator_backends) ||
      !value.allowed_evaluator_backends.includes("wam_policy_runtime") ||
      !value.allowed_evaluator_backends.includes("vla_policy_runtime"))
  ) {
    errors.push(
      "allowed_evaluator_backends must include replaceable WAM and VLA policy runtimes",
    );
  }
  const physicsStateAuthority = value.optional_physics_state_authority;
  if (physicsStateAuthority !== undefined && !hasObject(physicsStateAuthority)) {
    errors.push("optional_physics_state_authority must be an object when provided");
  } else if (
    hasObject(physicsStateAuthority) &&
    physicsStateAuthority.required_for_request_acceptance !== false
  ) {
    errors.push(
      "optional_physics_state_authority.required_for_request_acceptance must be false",
    );
  }

  const proofBoundary = value.proof_boundary;
  if (!hasObject(proofBoundary)) {
    errors.push("proof_boundary is required");
  } else {
    for (const key of Object.keys(CLAIM_BOUNDARY) as (keyof typeof CLAIM_BOUNDARY)[]) {
      const optionalVirtualBoundary =
        key === "virtual_evaluation_proves_evaluation_readiness" ||
        key === "virtual_evaluation_proves_non_ranking_operational_claim";
      if (proofBoundary[key] !== false && !(optionalVirtualBoundary && proofBoundary[key] === undefined)) {
        errors.push(`proof_boundary.${key} must be false until owner-system proof exists`);
      }
    }
  }

  if (value.simulator_scope !== undefined) {
    const simulatorScope = value.simulator_scope;
    if (!hasObject(simulatorScope)) {
      errors.push("simulator_scope must be an object when provided");
    } else {
      if (simulatorScope.mode !== "simulator_only") {
        errors.push("simulator_scope.mode must be simulator_only");
      }
      if (simulatorScope.simulator !== "MuJoCo") {
        errors.push("simulator_scope.simulator must be MuJoCo");
      }
      if (simulatorScope.physical_robot_deployment_claim_allowed !== false) {
        errors.push("simulator_scope.physical_robot_deployment_claim_allowed must be false");
      }
    }
  }

  const executionRequest = value.execution_request;
  if (!hasObject(executionRequest)) {
    errors.push("execution_request is required");
  } else {
      if (
        executionRequest.schema_version !==
        "blueprint.robot_eval_execution_request.v1"
      ) {
        errors.push(
          "execution_request.schema_version must be blueprint.robot_eval_execution_request.v1",
        );
      }
      if (executionRequest.webapp_role !== "queue_and_forward_only") {
        errors.push("execution_request.webapp_role must be queue_and_forward_only");
      }
      if (executionRequest.scheduler_owner !== "BlueprintCapturePipeline") {
        errors.push("execution_request.scheduler_owner must be BlueprintCapturePipeline");
      }
      const executionEvaluationScope = executionRequest.evaluation_scope;
      if (!hasObject(executionEvaluationScope)) {
        errors.push("execution_request.evaluation_scope is required when execution_request is provided");
      } else {
        if (executionEvaluationScope.mode !== "virtual_policy_evaluation") {
          errors.push(
            "execution_request.evaluation_scope.mode must be virtual_policy_evaluation",
          );
        }
        if (executionEvaluationScope.physical_robot_deployment_claim_allowed !== false) {
          errors.push(
            "execution_request.evaluation_scope.physical_robot_deployment_claim_allowed must be false",
          );
        }
      }
      if (executionRequest.wam_evaluator_backend !== "pipeline_selected") {
        errors.push("execution_request.wam_evaluator_backend must be pipeline_selected");
      }
      if (
        !Array.isArray(executionRequest.allowed_evaluator_backends) ||
        !executionRequest.allowed_evaluator_backends.includes("wam_policy_runtime") ||
        !executionRequest.allowed_evaluator_backends.includes("vla_policy_runtime")
      ) {
        errors.push(
          "execution_request.allowed_evaluator_backends must include replaceable WAM and VLA policy runtimes",
        );
      }
      const executionProofBoundaries = executionRequest.proof_boundaries;
      if (!hasObject(executionProofBoundaries)) {
        errors.push("execution_request.proof_boundaries is required when execution_request is provided");
      } else {
        if (
          executionProofBoundaries.virtual_evaluation_proves_evaluation_readiness !== false
        ) {
          errors.push(
            "execution_request.proof_boundaries.virtual_evaluation_proves_evaluation_readiness must be false",
          );
        }
        if (executionProofBoundaries.virtual_evaluation_proves_non_ranking_operational_claim !== false) {
          errors.push(
            "execution_request.proof_boundaries.virtual_evaluation_proves_non_ranking_operational_claim must be false",
          );
        }
      }
      const scope = executionRequest.scope;
      if (hasObject(scope)) {
        if (scope.mode !== "simulator_only") {
          errors.push("execution_request.scope.mode must be simulator_only");
        }
        if (scope.physical_robot_deployment_claim_allowed !== false) {
          errors.push(
            "execution_request.scope.physical_robot_deployment_claim_allowed must be false",
          );
        }
      }
      const queueing = executionRequest.queueing;
      if (!hasObject(queueing)) {
        errors.push("execution_request.queueing is required when execution_request is provided");
      } else {
        if (queueing.mode !== "async_job") {
          errors.push("execution_request.queueing.mode must be async_job");
        }
        if (queueing.web_request_must_not_wait_for_simulator !== true) {
          errors.push(
            "execution_request.queueing.web_request_must_not_wait_for_simulator must be true",
          );
        }
      }
      const workerSelection = executionRequest.worker_selection;
      if (hasObject(workerSelection)) {
        if (
          workerSelection.mode !==
          "blueprint_selects_fastest_cheapest_available_simulator_worker"
        ) {
          errors.push(
            "execution_request.worker_selection.mode must be blueprint_selects_fastest_cheapest_available_simulator_worker",
          );
        }
        if (workerSelection.customer_provider_choice_required !== false) {
          errors.push(
            "execution_request.worker_selection.customer_provider_choice_required must be false",
          );
        }
      }
      const preflight = executionRequest.preflight;
      if (!hasObject(preflight)) {
        errors.push("execution_request.preflight is required when execution_request is provided");
      } else {
        if (preflight.cpu_preflight_required_before_gpu !== true) {
          errors.push(
            "execution_request.preflight.cpu_preflight_required_before_gpu must be true",
          );
        }
        if (preflight.blocks_gpu_when_missing !== true) {
          errors.push("execution_request.preflight.blocks_gpu_when_missing must be true");
        }
      }
      const simulatorRouting = executionRequest.simulator_routing;
      if (!hasObject(simulatorRouting)) {
        errors.push(
          "execution_request.simulator_routing is required when execution_request is provided",
        );
      } else {
        if (simulatorRouting.requested_backend !== "pipeline_selected") {
          errors.push(
            "execution_request.simulator_routing.requested_backend must be pipeline_selected",
          );
        }
        if (simulatorRouting.default_first_pass_backend !== "mujoco") {
          errors.push(
            "execution_request.simulator_routing.default_first_pass_backend must be mujoco",
          );
        }
        if (simulatorRouting.default_first_gpu_backend !== "mujoco") {
          errors.push(
            "execution_request.simulator_routing.default_first_gpu_backend must be mujoco",
          );
        }
        const selectionPolicy = simulatorRouting.selection_policy;
        if (hasObject(selectionPolicy)) {
          if (selectionPolicy.mode !== "mujoco_first_unless_proof_requires_isaac") {
            errors.push(
              "execution_request.simulator_routing.selection_policy.mode must be mujoco_first_unless_proof_requires_isaac",
            );
          }
          if (selectionPolicy.first_pass_backend !== "mujoco") {
            errors.push(
              "execution_request.simulator_routing.selection_policy.first_pass_backend must be mujoco",
            );
          }
        }
        const proofBoundaries = simulatorRouting.proof_boundaries;
        if (hasObject(proofBoundaries)) {
          if (proofBoundaries.webapp_request_selects_policy_not_execution !== true) {
            errors.push(
              "execution_request.simulator_routing.proof_boundaries.webapp_request_selects_policy_not_execution must be true",
            );
          }
          if (proofBoundaries.mujoco_proof_does_not_clear_isaac_sim_gate !== true) {
            errors.push(
              "execution_request.simulator_routing.proof_boundaries.mujoco_proof_does_not_clear_isaac_sim_gate must be true",
            );
          }
        }
      }
      const gpuAllocation = executionRequest.gpu_allocation;
      if (!hasObject(gpuAllocation)) {
        errors.push(
          "execution_request.gpu_allocation is required when execution_request is provided",
        );
      } else {
        if (gpuAllocation.allocation_allowed_by_webapp !== false) {
          errors.push(
            "execution_request.gpu_allocation.allocation_allowed_by_webapp must be false",
          );
        }
        if (gpuAllocation.gpu_spend_approved !== false) {
          errors.push(
            "execution_request.gpu_allocation.gpu_spend_approved must be false",
          );
        }
        if (gpuAllocation.idle_shutdown_required !== true) {
          errors.push(
            "execution_request.gpu_allocation.idle_shutdown_required must be true",
          );
        }
      }
      const artifactContract = executionRequest.artifact_contract;
      if (!hasObject(artifactContract)) {
        errors.push(
          "execution_request.artifact_contract is required when execution_request is provided",
        );
      } else {
        if (!Array.isArray(artifactContract.expected_outputs)) {
          errors.push(
            "execution_request.artifact_contract.expected_outputs must be an array",
          );
        } else {
          const expectedOutputs = new Set(
            artifactContract.expected_outputs.map((output) => String(output)),
          );
          for (const output of REQUIRED_ARTIFACT_CONTRACT_OUTPUTS) {
            if (!expectedOutputs.has(output)) {
              errors.push(
                `execution_request.artifact_contract.expected_outputs must include ${output}`,
              );
            }
          }
        }
        if (artifactContract.webapp_queues_and_forwards_only !== true) {
          errors.push(
            "execution_request.artifact_contract.webapp_queues_and_forwards_only must be true",
          );
        }
        if (
          artifactContract.pipeline_owns_execution_ranking_and_artifacts !== true
        ) {
          errors.push(
            "execution_request.artifact_contract.pipeline_owns_execution_ranking_and_artifacts must be true",
          );
        }
        if (artifactContract.public_claim_upgrade_allowed !== false) {
          errors.push(
            "execution_request.artifact_contract.public_claim_upgrade_allowed must be false",
          );
        }
        if (
          artifactContract.startup_artifacts_are_advisory_until_owner_runtime_proof !==
          true
        ) {
          errors.push(
            "execution_request.artifact_contract.startup_artifacts_are_advisory_until_owner_runtime_proof must be true",
          );
        }
        if (
          artifactContract.ranking_outputs_are_advisory_until_owner_system_proof !==
          true
        ) {
          errors.push(
            "execution_request.artifact_contract.ranking_outputs_are_advisory_until_owner_system_proof must be true",
          );
        }
        if (
          artifactContract.ptdp_export_manifest_does_not_prove_delivery_or_training !==
          true
        ) {
          errors.push(
            "execution_request.artifact_contract.ptdp_export_manifest_does_not_prove_delivery_or_training must be true",
          );
        }
        if (artifactContract.simulator_execution_proven_by_webapp !== false) {
          errors.push(
            "execution_request.artifact_contract.simulator_execution_proven_by_webapp must be false",
          );
        }
    }
  }

  return { ok: errors.length === 0, errors };
}

export function isRobotEvalJobRequest(value: unknown): value is Record<string, unknown> {
  return validateRobotEvalJobRequest(value).ok;
}

export async function writeRobotEvalJobRequestInbox(params: {
  rootDir: string;
  jobRequest: Record<string, unknown>;
  queuedAt: string;
}) {
  const jobId = String(params.jobRequest.job_id || "").trim();
  const buyerRequestId = String(params.jobRequest.buyer_request_id || "").trim();
  const fileName = `${sanitizeFileStem(jobId)}.json`;
  const jobPath = path.join(params.rootDir, fileName);
  const indexPath = path.join(params.rootDir, "index.jsonl");
  const exportEnvelope = {
    queue_contract: JOB_REQUEST_QUEUE_CONTRACT,
    status: "queued_for_pipeline",
    queued_at_iso: params.queuedAt,
    job_id: jobId,
    buyer_request_id: buyerRequestId,
    pipeline_command: "blueprint-run-robot-eval-job",
    pipeline_consumer: "BlueprintCapturePipeline",
    job_request: params.jobRequest,
  };

  await fs.mkdir(params.rootDir, { recursive: true });
  await fs.writeFile(jobPath, `${JSON.stringify(exportEnvelope, null, 2)}\n`, "utf8");
  await fs.appendFile(
    indexPath,
    `${JSON.stringify({
      queued_at_iso: params.queuedAt,
      job_id: jobId,
      buyer_request_id: buyerRequestId,
      path: jobPath,
      schema_version: JOB_REQUEST_SCHEMA_VERSION,
      queue_contract: JOB_REQUEST_QUEUE_CONTRACT,
    })}\n`,
    "utf8",
  );

  return {
    queue_contract: "robot_eval_job_request_inbox.v1",
    job_request_path: jobPath,
    index_path: indexPath,
  };
}

export type RobotEvalJobRequestForwardResult = {
  status: "not_configured" | "blocked" | "forwarded" | "failed";
  performed: boolean;
  endpoint_configured: boolean;
  required: boolean;
  http_status?: number;
  accepted?: boolean;
  pipeline_status?: unknown;
  input_blockers?: unknown;
  blockers?: string[];
  error_name?: string;
  error_message?: string;
  timeout_ms?: number;
  capture_root_override_applied?: boolean;
  capture_root_override_source?: "site" | "global";
};

function truthy(value: string | undefined) {
  return String(value || "").trim().toLowerCase() === "true";
}

function productionRuntime() {
  return process.env.NODE_ENV === "production";
}

export function robotEvalJobRequestForwardRequired(explicit?: boolean) {
  if (explicit !== undefined) {
    return explicit;
  }
  const configured = String(process.env[FORWARD_REQUIRED_ENV] || "").trim().toLowerCase();
  if (configured === "true") {
    return true;
  }
  if (configured === "false" && !productionRuntime()) {
    return false;
  }
  return true;
}

function intEnv(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function forwardTimeoutMs(explicitTimeoutMs?: number) {
  if (explicitTimeoutMs !== undefined) {
    return explicitTimeoutMs;
  }
  return Math.max(
    intEnv(process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TIMEOUT_MS, DEFAULT_FORWARD_TIMEOUT_MS),
    DEFAULT_FORWARD_TIMEOUT_MS,
  );
}

function parseCaptureRootBySiteEnv() {
  const raw = String(process.env[FORWARD_CAPTURE_ROOT_BY_SITE_ENV] || "").trim();
  if (!raw) {
    return { ok: true as const, overrides: {} as Record<string, string> };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!hasObject(parsed)) {
      return {
        ok: false as const,
        blockers: [`invalid_env_${FORWARD_CAPTURE_ROOT_BY_SITE_ENV}`],
      };
    }
    const overrides = Object.fromEntries(
      Object.entries(parsed)
        .map(([siteSlug, captureRoot]) => [
          String(siteSlug).trim(),
          String(captureRoot || "").trim(),
        ])
        .filter(([siteSlug, captureRoot]) => siteSlug && captureRoot),
    );
    return { ok: true as const, overrides };
  } catch {
    return {
      ok: false as const,
      blockers: [`invalid_env_${FORWARD_CAPTURE_ROOT_BY_SITE_ENV}`],
    };
  }
}

function captureRootOverrideForJobRequest(
  jobRequest: Record<string, unknown>,
): CaptureRootOverrideResolution {
  const sitePackage = hasObject(jobRequest.site_package) ? jobRequest.site_package : {};
  const siteSlug = String(sitePackage.site_slug || "").trim();
  const bySite = parseCaptureRootBySiteEnv();
  if (!bySite.ok) {
    return bySite;
  }
  if (siteSlug && bySite.overrides[siteSlug]) {
    return {
      ok: true as const,
      captureRoot: bySite.overrides[siteSlug],
      source: "site" as const,
    };
  }
  const globalCaptureRoot = String(process.env[FORWARD_CAPTURE_ROOT_ENV] || "").trim();
  if (globalCaptureRoot) {
    return {
      ok: true as const,
      captureRoot: globalCaptureRoot,
      source: "global" as const,
    };
  }
  return { ok: true as const };
}

function isWebappSyncedArtifactCaptureRoot(value: string) {
  const normalized = value.trim().replace(/\\/g, "/");
  return (
    normalized === "/synced-artifacts" ||
    normalized.startsWith("/synced-artifacts/") ||
    normalized === "synced-artifacts" ||
    normalized.startsWith("synced-artifacts/")
  );
}

function jobRequestWithPipelineCaptureRoot(
  jobRequest: Record<string, unknown>,
): PipelineForwardJobRequestResolution {
  const override = captureRootOverrideForJobRequest(jobRequest);
  if (!override.ok) {
    return override;
  }
  const sitePackage = hasObject(jobRequest.site_package) ? jobRequest.site_package : {};
  const webappCaptureRoot = String(sitePackage.capture_root || "").trim();
  if (!override.captureRoot) {
    if (isWebappSyncedArtifactCaptureRoot(webappCaptureRoot)) {
      return {
        ok: false as const,
        blockers: ["missing_pipeline_capture_root_override_for_webapp_synced_artifact"],
      };
    }
    return { ok: true as const, jobRequest, applied: false as const };
  }

  const ownerSystem = hasObject(jobRequest.owner_system) ? jobRequest.owner_system : {};
  return {
    ok: true as const,
    applied: true as const,
    source: override.source,
    jobRequest: {
      ...jobRequest,
      site_package: {
        ...sitePackage,
        capture_root: override.captureRoot,
        webapp_capture_root: webappCaptureRoot || null,
        capture_root_override_source:
          override.source === "site"
            ? `env:${FORWARD_CAPTURE_ROOT_BY_SITE_ENV}`
            : `env:${FORWARD_CAPTURE_ROOT_ENV}`,
      },
      owner_system: {
        ...ownerSystem,
        pipeline_control_plane_capture_root: override.captureRoot,
      },
    },
  };
}

export function robotEvalJobRequestForwardErrorMessage(
  result: RobotEvalJobRequestForwardResult,
) {
  if (result.status === "not_configured") {
    return "Pipeline forwarding is not configured for this WebApp environment.";
  }
  if (result.blockers?.length) {
    return `Pipeline forwarding blocked: ${result.blockers.join(", ")}`;
  }
  if (Array.isArray(result.input_blockers) && result.input_blockers.length) {
    if (
      result.input_blockers.includes(
        "webapp:request_capture_root_does_not_match_control_plane",
      )
    ) {
      return "Pipeline intake blocked this request because the WebApp capture root does not match the active CapturePipeline control-plane capture root.";
    }
    return `Pipeline intake blocked this request: ${result.input_blockers.join(", ")}`;
  }
  if (result.http_status) {
    return `CapturePipeline intake returned ${result.http_status}.`;
  }
  if (result.error_message) {
    return `Pipeline forwarding failed: ${result.error_message}`;
  }
  return "Pipeline forwarding failed.";
}

export async function forwardRobotEvalJobRequestToPipeline(params: {
  jobRequest: Record<string, unknown>;
  queuedAt: string;
  endpointUrl?: string;
  token?: string;
  required?: boolean;
  timeoutMs?: number;
}): Promise<RobotEvalJobRequestForwardResult> {
  const endpoint =
    params.endpointUrl?.trim() ||
    String(process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_URL || "").trim();
  const required = robotEvalJobRequestForwardRequired(params.required);
  if (!endpoint) {
    return {
      status: "not_configured",
      performed: false,
      endpoint_configured: false,
      required,
    };
  }

  const token = params.token ?? String(process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN || "");
  if (!token.trim()) {
    return {
      status: "blocked",
      performed: false,
      endpoint_configured: true,
      required,
      blockers: ["missing_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN"],
    };
  }

  const forwardJobRequest = jobRequestWithPipelineCaptureRoot(params.jobRequest);
  if (!forwardJobRequest.ok) {
    return {
      status: "blocked",
      performed: false,
      endpoint_configured: true,
      required,
      blockers: forwardJobRequest.blockers,
    };
  }

  const jobRequest = forwardJobRequest.jobRequest as Record<string, unknown>;
  const jobId = String(jobRequest.job_id || "").trim();
  const buyerRequestId = String(jobRequest.buyer_request_id || "").trim();
  const envelope = {
    queue_contract: JOB_REQUEST_QUEUE_CONTRACT,
    status: "queued_for_pipeline",
    queued_at_iso: params.queuedAt,
    job_id: jobId,
    buyer_request_id: buyerRequestId,
    pipeline_command: "blueprint-run-robot-eval-job",
    pipeline_consumer: "BlueprintCapturePipeline",
    job_request: jobRequest,
  };
  const controller = new AbortController();
  const timeoutMs = forwardTimeoutMs(params.timeoutMs);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const body = JSON.stringify(envelope);
  const timestamp = new Date().toISOString();
  const nonce = randomUUID();
  const signature = buildPipelineSyncSignature({
    secret: token,
    timestamp,
    nonce,
    body,
  });
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-blueprint-pipeline-timestamp": timestamp,
        "x-blueprint-pipeline-nonce": nonce,
        "x-blueprint-pipeline-signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });
    let payload: Record<string, unknown> = {};
    try {
      const parsed = await response.json();
      payload = hasObject(parsed) ? parsed : {};
    } catch {
      payload = {};
    }
    const detail = hasObject(payload.detail) ? payload.detail : payload;
    const result: RobotEvalJobRequestForwardResult = {
      status: response.ok ? "forwarded" : "failed",
      performed: response.ok,
      endpoint_configured: true,
      required,
      http_status: response.status,
      timeout_ms: timeoutMs,
      capture_root_override_applied: forwardJobRequest.applied,
    };
    if (forwardJobRequest.source) {
      result.capture_root_override_source = forwardJobRequest.source;
    }
    if (typeof detail.accepted === "boolean") {
      result.accepted = detail.accepted;
    }
    if (detail.status !== undefined) {
      result.pipeline_status = detail.status;
    }
    if (detail.input_blockers !== undefined) {
      result.input_blockers = detail.input_blockers;
    }
    return result;
  } catch (error) {
    return {
      status: "failed",
      performed: false,
      endpoint_configured: true,
      required,
      timeout_ms: timeoutMs,
      error_name: error instanceof Error ? error.name : "UnknownError",
      error_message: error instanceof Error ? error.message : "Unknown forwarding error",
    };
  } finally {
    clearTimeout(timeout);
  }
}
