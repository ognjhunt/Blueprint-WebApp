import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const JOB_REQUEST_SCHEMA_VERSION = "robot_eval_job_request.v1";
const JOB_REQUEST_QUEUE_CONTRACT = "robot_eval_job_request_inbox.v1";
const DEFAULT_FORWARD_TIMEOUT_MS = 60000;
const FORWARD_CAPTURE_ROOT_ENV = "ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT";
const FORWARD_CAPTURE_ROOT_BY_SITE_ENV =
  "ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON";

const CLAIM_BOUNDARY = {
  simulator_execution_proven: false,
  robot_readiness_proven: false,
  robot_policy_execution_proven: false,
  physics_contact_validated: false,
  safety_validated: false,
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
    queueing: {
      mode: "async_job",
      customer_response: "job_id_and_status_only",
      web_request_must_not_wait_for_simulator: true,
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
    simulator_routing: {
      requested_backend: "pipeline_selected",
      allowed_backends: ["mujoco", "isaac_sim", "isaac_lab_arena", "pybullet", "fixture"],
      default_first_pass_backend: "mujoco",
      default_first_gpu_backend: "mujoco",
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
        simulator_policy_does_not_prove_robot_readiness: true,
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
      expected_outputs: [
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
        "metrics",
        "trace",
        "simulator_pov",
        "stdout_log",
        "stderr_log",
      ],
      startup_artifacts_are_advisory_until_owner_runtime_proof: true,
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
    },
    policy_package: orderedPolicyPackage(input.policySubmission),
    entitlement: {
      access_state: input.entitlement.accessState,
      entitlement_id: input.entitlement.entitlementId || null,
      approved: input.entitlement.approved,
    },
    operation: "evaluate_only",
    simulator_preference: "mujoco_first",
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
        robot_readiness_proven: false,
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
  if (!hasObject(sitePackage)) {
    errors.push("site_package is required");
  } else {
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

  const proofBoundary = value.proof_boundary;
  if (!hasObject(proofBoundary)) {
    errors.push("proof_boundary is required");
  } else {
    for (const key of Object.keys(CLAIM_BOUNDARY) as (keyof typeof CLAIM_BOUNDARY)[]) {
      if (proofBoundary[key] !== false) {
        errors.push(`proof_boundary.${key} must be false until owner-system proof exists`);
      }
    }
  }

  if (value.execution_request !== undefined) {
    const executionRequest = value.execution_request;
    if (!hasObject(executionRequest)) {
      errors.push("execution_request must be an object when provided");
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
        if (artifactContract.simulator_execution_proven_by_webapp !== false) {
          errors.push(
            "execution_request.artifact_contract.simulator_execution_proven_by_webapp must be false",
          );
        }
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
  const required =
    params.required ?? truthy(process.env.ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED);
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
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(envelope),
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
