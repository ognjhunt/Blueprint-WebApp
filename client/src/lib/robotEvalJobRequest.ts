import type { SiteLibrarySite } from "@/data/siteLibrary";
import type {
  RobotTeamTestSubmission,
  RobotTeamTestSubmissionModalityId,
} from "@/lib/robotTeamTestSubmission";

type PolicyPackagePayload = Record<string, unknown>;

export type RobotEvalSimulatorTaskSelection = {
  taskId: string;
  label: string;
  scenarioId: string;
  skillId: string;
  taskKind?: "navigation" | "mobile_manipulation_pick_carry_place";
  objectId?: string;
  objectClass?: string;
  policyKind?: string;
  taskThresholdsUri?: string;
};

export const DEFAULT_SIMULATOR_EVAL_TASKS = [
  {
    taskId: "walk_to_target",
    label: "Navigate to a spot",
    scenarioId: "scenario_walk_to_target_unitree_g1_mujoco_v1",
    skillId: "walk_to_target",
    taskKind: "navigation",
  },
  {
    taskId: "mobile_pick_carry_place_tote",
    label: "Pick tote and return",
    scenarioId: "scenario_mobile_pick_carry_place_tote_unitree_g1_mujoco_v1",
    skillId: "mobile_manipulation_pick_carry_place",
    taskKind: "mobile_manipulation_pick_carry_place",
    objectId: "simready_tote_001",
    objectClass: "tote",
    policyKind: "mobile_manipulation_pick_carry_place",
  },
] satisfies RobotEvalSimulatorTaskSelection[];

const DEFAULT_SIMULATOR_ROBOT_PROFILE = {
  id: "unitree_g1_humanoid",
  label: "Unitree G1",
  embodiment: "humanoid",
  sensors: ["rgb", "depth", "proprioception"],
};

function kebab(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function compactRecord(record: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined && value !== null && String(value).trim() !== "";
    }),
  );
}

function splitList(value: string | undefined) {
  return String(value || "")
    .split(/\n|,|->/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildExecutionRequest() {
  return {
    schema_version: "blueprint.robot_eval_execution_request.v1",
    webapp_role: "queue_and_forward_only",
    scheduler_owner: "BlueprintCapturePipeline",
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
      ],
      startup_artifacts_are_advisory_until_owner_runtime_proof: true,
      simulator_execution_proven_by_webapp: false,
      public_claim_upgrade_allowed: false,
    },
  };
}

export function defaultSimulatorEvalTasksForSite(site: SiteLibrarySite) {
  const thresholdUri = site.robotEvalPublication?.artifactUris.taskThresholdsUri;
  return DEFAULT_SIMULATOR_EVAL_TASKS.map((task) => ({
    ...task,
    scenarioId: `${site.slug}_${task.scenarioId}`,
    taskThresholdsUri: thresholdUri,
  }));
}

function selectedSimulatorTasksForSite(
  site: SiteLibrarySite,
  tasks?: RobotEvalSimulatorTaskSelection[],
) {
  const fallback = defaultSimulatorEvalTasksForSite(site);
  const selected = (tasks && tasks.length ? tasks : fallback).filter((task) =>
    String(task.taskId || "").trim(),
  );
  return selected.length ? selected : fallback;
}

function buildDefaultSimulatorPolicyPackage(tasks: RobotEvalSimulatorTaskSelection[]) {
  const manipulationTask = tasks.find(
    (task) => task.taskKind === "mobile_manipulation_pick_carry_place",
  );
  if (manipulationTask) {
    return {
      default_test_policy: {
        policy_kind: manipulationTask.policyKind || "mobile_manipulation_pick_carry_place",
        task_id: manipulationTask.taskId,
        object_id: manipulationTask.objectId || "simready_tote_001",
        object_class: manipulationTask.objectClass || "tote",
      },
      high_level_skill_trace: {
        ordered_skill_sequence: [
          "navigate_to_object",
          "pregrasp_stance",
          "reach",
          "close_grip",
          "lift",
          "verify_grasp",
          "carry_to_return_pose",
          "place",
          "release",
          "verify_placement",
        ],
        skill_taxonomy_version: "blueprint_unitree_g1_mobile_manipulation_beta.v1",
        source_type: "webapp_default_manipulation_request",
        confidence_coverage_note:
          "Default manipulation request only; Pipeline must supply simulator physics, contact traces, or team endpoint proof before any readiness claim.",
      },
    };
  }
  return {
    high_level_skill_trace: {
      ordered_skill_sequence: tasks.map((task) => task.skillId || task.taskId),
      skill_taxonomy_version: "blueprint_unitree_g1_mujoco_beta.v1",
      source_type: "webapp_default_simulator_beta_request",
      confidence_coverage_note:
        "Default Unitree G1 MuJoCo simulator request only; Pipeline must supply owner-runtime proof before any execution or readiness claim.",
    },
  };
}

function fieldsFor(
  submission: RobotTeamTestSubmission,
  modality: RobotTeamTestSubmissionModalityId,
) {
  return submission.modalities[modality]?.fields || {};
}

export function buildPolicyPackageFromRobotTeamSubmission(
  submission?: RobotTeamTestSubmission | null,
) {
  if (!submission) {
    return {};
  }

  const policyPackage: Record<RobotTeamTestSubmissionModalityId, PolicyPackagePayload> = {
    policy_api_endpoint: {},
    docker_container: {},
    recorded_action_trace: {},
    high_level_skill_trace: {},
    teleop_demo: {},
    sim_controller_plugin: {},
    model_checkpoint: {},
  };

  if (submission.selectedModalities.includes("policy_api_endpoint")) {
    const fields = fieldsFor(submission, "policy_api_endpoint");
    policyPackage.policy_api_endpoint = compactRecord({
      endpoint_url: fields.endpointUrl,
      auth_handling: fields.authHandling,
      observation_schema_ref: fields.observationSchemaRef,
      action_schema_ref: fields.actionSchemaRef,
      runtime_constraints: fields.runtimeConstraints,
      callback_log_uri: fields.callbackLogUri,
      owner_contact: fields.ownerContact,
    });
  }

  if (submission.selectedModalities.includes("docker_container")) {
    const fields = fieldsFor(submission, "docker_container");
    policyPackage.docker_container = compactRecord({
      image_ref: fields.imageRef,
      digest: fields.digestChecksum,
      entrypoint: fields.entrypoint,
      environment_contract: fields.environmentContract,
      hardware_needs: fields.hardwareNeeds,
      io_schema_ref: fields.ioSchemaRef,
      runtime_notes: fields.runtimeNotes,
    });
  }

  if (submission.selectedModalities.includes("recorded_action_trace")) {
    const fields = fieldsFor(submission, "recorded_action_trace");
    policyPackage.recorded_action_trace = compactRecord({
      trace_manifest_uri: fields.traceManifestUri,
      format: fields.format,
      task_scenario_mapping: fields.taskScenarioMapping,
      timestamp_alignment: fields.timestampAlignment,
      observation_action_alignment: fields.observationActionAlignment,
      success_failure_labels: fields.successFailureLabels,
      checksum: fields.checksum,
    });
  }

  if (submission.selectedModalities.includes("high_level_skill_trace")) {
    const fields = fieldsFor(submission, "high_level_skill_trace");
    policyPackage.high_level_skill_trace = compactRecord({
      skill_taxonomy_version: fields.skillTaxonomyVersion,
      ordered_skill_sequence: splitList(fields.orderedSkillSequence),
      preconditions_postconditions: fields.preconditionsPostconditions,
      failure_labels: fields.failureLabels,
      source_type: fields.sourceType,
      confidence_coverage_note: fields.confidenceCoverageNote,
    });
  }

  if (submission.selectedModalities.includes("teleop_demo")) {
    const fields = fieldsFor(submission, "teleop_demo");
    policyPackage.teleop_demo = compactRecord({
      demo_artifact_uri: fields.demoArtifactUri,
      operator_device: fields.operatorDevice,
      control_mapping: fields.controlMapping,
      time_sync: fields.timeSync,
      task_scenario_mapping: fields.taskScenarioMapping,
      rights_privacy_attestation: fields.rightsPrivacyAttestation,
      labels: fields.labels,
    });
  }

  if (submission.selectedModalities.includes("model_checkpoint")) {
    const fields = fieldsFor(submission, "model_checkpoint");
    policyPackage.model_checkpoint = compactRecord({
      artifact_uri: fields.artifactUri,
      digest_checksum: fields.digestChecksum,
      framework_runtime: fields.frameworkRuntime,
      model_card_policy_interface_notes: fields.modelCardPolicyInterfaceNotes,
      observation_schema_ref: fields.observationSchemaRef,
      action_schema_ref: fields.actionSchemaRef,
      owner_contact: fields.ownerContact,
    });
  }

  if (submission.selectedModalities.includes("sim_controller_plugin")) {
    const fields = fieldsFor(submission, "sim_controller_plugin");
    policyPackage.sim_controller_plugin = compactRecord({
      simulator_framework: fields.simulatorFramework,
      plugin_uri: fields.pluginUri,
      supported_control_modes: splitList(fields.supportedControlModes),
      observation_action_spaces: fields.observationActionSpaces,
      replay_export_path: fields.replayExportPath,
      compatibility_notes: fields.compatibilityNotes,
    });
  }

  return Object.fromEntries(
    Object.entries(policyPackage).filter(([, payload]) => Object.keys(payload).length > 0),
  );
}

export function robotTeamSubmissionReadyForJobRequest(
  submission?: RobotTeamTestSubmission | null,
) {
  return Boolean(
    submission &&
      submission.selectedModalities.length > 0 &&
      submission.selectedModalities.every(
        (modality) => submission.modalities[modality]?.reviewStatus === "ready_for_review",
      ),
  );
}

export function buildRobotEvalJobRequestFromSite(
  site: SiteLibrarySite,
  source: { route: string; surface: "sites" | "site-detail" },
  options: {
    robotTeamTestSubmission?: RobotTeamTestSubmission | null;
    simulatorTasks?: RobotEvalSimulatorTaskSelection[];
  } = {},
) {
  const publication = site.robotEvalPublication;
  if (!publication || !site.defaultRobotEvalSelection || !publication.readyToEvaluatePublishable) {
    throw new Error("Robot-eval publication package is not ready for this site.");
  }
  const selectedTasks = selectedSimulatorTasksForSite(site, options.simulatorTasks);
  const primaryTask = selectedTasks[0];
  const selection = {
    taskId: primaryTask.taskId,
    scenarioId: primaryTask.scenarioId,
    robotProfileId: DEFAULT_SIMULATOR_ROBOT_PROFILE.id,
    policyId: "blueprint_default_unitree_g1_mujoco_simulator_policy",
  };
  const jobId = `robot-eval-${site.slug}-${kebab(selection.taskId)}-${kebab(selection.policyId)}`;
  const buyerRequestId = `buyer-request-${site.slug}-${kebab(selection.taskId)}-${kebab(selection.policyId)}`;
  const lineage = site.captureLineage;
  if (!lineage) {
    throw new Error(
      "Capture lineage is required before creating a live robot-eval job request.",
    );
  }

  return {
    schema_version: "robot_eval_job_request.v1",
    job_id: jobId,
    buyer_request_id: buyerRequestId,
    customer: {
      id: "public-site-robot-team",
      name: "Robot team site-library request",
      contact_email: null,
    },
    site_package: {
      site_slug: site.slug,
      site_id: `site-${site.slug}`,
      site_submission_id: lineage.siteSubmissionId,
      capture_job_id: lineage.captureJobId,
      capture_id: lineage.captureId,
      buyer_request_id: buyerRequestId,
      pipeline_prefix: lineage.pipelinePrefix,
      site_name: site.name,
      site_type: site.siteType,
      site_region: site.region,
      access_state: site.access,
      capture_root: `/synced-artifacts/sites/${site.slug}`,
      capture_lineage_verified: true,
      package_uri: publication.artifactUris.manifestUri,
      publication_ready_to_evaluate: publication.readyToEvaluatePublishable,
      publication_readiness_uri: publication.artifactUris.publicationReadinessUri,
      task_thresholds_uri: publication.artifactUris.taskThresholdsUri,
      scene_asset_inventory_uri: publication.artifactUris.sceneAssetInventoryUri,
      scene_asset_dependency_audit_uri:
        publication.artifactUris.sceneAssetDependencyAuditUri,
      scene_asset_preflight_uri: publication.artifactUris.sceneAssetPreflightUri,
      scene_asset_inspection_uri: publication.artifactUris.sceneAssetInspectionUri,
      scene_frame_estimate_uri: publication.artifactUris.sceneFrameEstimateUri,
      collider_proxy_plan_uri: publication.artifactUris.colliderProxyPlanUri,
      cpu_scene_proxy_manifest_uri: publication.artifactUris.cpuSceneProxyManifestUri,
      cpu_preflight_scorecard_uri: publication.artifactUris.cpuPreflightScorecardUri,
      task_anchor_proposal_manifest_uri:
        publication.artifactUris.taskAnchorProposalManifestUri,
      episode_spec_manifest_uri: publication.artifactUris.episodeSpecManifestUri,
      episode_specs_uri: publication.artifactUris.episodeSpecsUri,
      spawn_pose_validation_manifest_uri:
        publication.artifactUris.spawnPoseValidationManifestUri,
      cpu_preflight_manifest_uri: publication.artifactUris.cpuPreflightManifestUri,
      pre_gpu_readiness_summary_uri: publication.artifactUris.preGpuReadinessSummaryUri,
      cpu_simulator_preflight_manifest_uri:
        publication.artifactUris.cpuSimulatorPreflightManifestUri,
      gpu_handoff_packet_uri: publication.artifactUris.gpuHandoffPacketUri,
      gpu_owner_system_proof_schema_uri:
        publication.artifactUris.gpuOwnerSystemProofSchemaUri,
      gpu_run_checklist_uri: publication.artifactUris.gpuRunChecklistUri,
      owner_gpu_simulator_execution_blocked_manifest_uri:
        publication.artifactUris.ownerGpuSimulatorExecutionBlockedManifestUri,
      artifact_uris: publication.artifactUris,
      missing_proof_labels: publication.missingProofLabels,
    },
    requested_tasks: selectedTasks.map((task) => ({
      task_id: task.taskId,
      label: task.label,
      scenario_ids: [task.scenarioId],
      skill_id: task.skillId,
      task_kind: task.taskKind || "navigation",
      object_id: task.objectId,
      object_class: task.objectClass,
      task_thresholds_uri: task.taskThresholdsUri || publication.artifactUris.taskThresholdsUri,
    })),
    manipulation_task: selectedTasks.some(
      (task) => task.taskKind === "mobile_manipulation_pick_carry_place",
    )
      ? {
          schema_version: "robot_eval_manipulation_task_request.v1",
          task_id: "mobile_pick_carry_place_tote",
          task_kind: "mobile_manipulation_pick_carry_place",
          object_id: "simready_tote_001",
          object_class: "tote",
          object_contract_required: true,
          default_object_contract_template: "tote.v1",
          required_phases: [
            "navigate_to_object",
            "pregrasp_stance",
            "reach",
            "close_grip",
            "lift",
            "verify_grasp",
            "carry_to_return_pose",
            "place",
            "release",
            "verify_placement",
          ],
          requested_policy_tiers: [
            "default_phase_policy",
            "lucky_g1_reference_or_blueprint_physics",
            "team_policy_endpoint_or_vla_adapter",
          ],
          claim_boundary: {
            webapp_request_selects_task_not_execution: true,
            simulator_physics_execution_proven_by_webapp: false,
            grasp_or_carry_validated_by_webapp: false,
            robot_readiness_proven_by_webapp: false,
          },
        }
      : undefined,
    policy_tier_selection: selectedTasks.some(
      (task) => task.taskKind === "mobile_manipulation_pick_carry_place",
    )
      ? {
          schema_version: "robot_eval_manipulation_policy_tier_selection.v1",
          requested_tiers: [
            {
              tier: 1,
              tier_id: "default_phase_policy",
              requested: true,
            },
            {
              tier: 2,
              tier_id: "lucky_g1_reference_or_blueprint_physics",
              requested: true,
              source_repo: "https://github.com/luckyrobots/g1-manipulation-challenge",
            },
            {
              tier: 3,
              tier_id: "team_policy_endpoint_or_vla_adapter",
              requested: true,
              endpoint_configured_by_webapp: robotTeamSubmissionReadyForJobRequest(
                options.robotTeamTestSubmission,
              ),
            },
          ],
        }
      : undefined,
    robot_profile: {
      robot_profile_id: selection.robotProfileId,
      robot_name: DEFAULT_SIMULATOR_ROBOT_PROFILE.label,
      embodiment: DEFAULT_SIMULATOR_ROBOT_PROFILE.embodiment,
      sensors: DEFAULT_SIMULATOR_ROBOT_PROFILE.sensors,
    },
    policy_package: options.robotTeamTestSubmission
      ? buildPolicyPackageFromRobotTeamSubmission(options.robotTeamTestSubmission)
      : buildDefaultSimulatorPolicyPackage(selectedTasks),
    operation: "evaluate_only",
    simulator_preference: "mujoco_first",
    simulator_scope: {
      mode: "simulator_only",
      robot: DEFAULT_SIMULATOR_ROBOT_PROFILE.label,
      simulator: "MuJoCo",
      customer_label: "Unitree G1 MuJoCo simulator evaluation",
      provider_strategy: "Blueprint chooses fastest/cheapest available simulator worker",
      physical_robot_deployment_claim_allowed: false,
    },
    cosmos_training_preference: { mode: "export_only" },
    budget: { budget_usd: 0, timeout_seconds: 120 },
    execution_request: buildExecutionRequest(),
    entitlement: {
      access_state: site.access,
      approved: site.access === "Open sample",
      entitlement_id: site.access === "Open sample" ? `open-sample-${site.slug}` : null,
    },
    rights_privacy_scope: {
      status: site.access === "Private / NDA" ? "review_required" : "cleared_for_robot_eval",
      external_use_allowed: site.access !== "Private / NDA",
      privacy_scope: "derived_deidentified_environment",
    },
    owner_system: {
      name: "Blueprint-WebApp",
      request_id: jobId,
      buyer_request_id: buyerRequestId,
      site_submission_id: lineage.siteSubmissionId,
      capture_job_id: lineage.captureJobId,
      capture_id: lineage.captureId,
      capture_lineage_verified: true,
    },
    source: {
      system: "Blueprint-WebApp",
      ...source,
      robot_team_test_submission: options.robotTeamTestSubmission
        ? {
            schema_version: options.robotTeamTestSubmission.schemaVersion,
            submission_id: options.robotTeamTestSubmission.submissionId || null,
            selected_modalities: options.robotTeamTestSubmission.selectedModalities,
            missing_evidence_statuses:
              options.robotTeamTestSubmission.missingEvidenceStatuses,
          }
        : null,
      selection_state: {
        buyer_request_id: buyerRequestId,
        site_slug: site.slug,
        site_submission_id: lineage.siteSubmissionId,
        capture_job_id: lineage.captureJobId,
        capture_id: lineage.captureId,
        task_id: selection.taskId,
        scenario_id: selection.scenarioId,
        selected_task_ids: selectedTasks.map((task) => task.taskId),
        selected_scenario_ids: selectedTasks.map((task) => task.scenarioId),
        policy_id: selection.policyId,
        robot_profile_id: selection.robotProfileId,
        simulator: "mujoco",
        scope: "simulator_only",
      },
    },
    pipeline_trigger: {
      status: "queued_for_pipeline",
      command: "blueprint-run-robot-eval-job",
      default_provisioner: "fixture_local",
      default_simulator: "mujoco",
      cpu_pre_gpu_preflight: {
        scene_asset_inventory_uri: publication.artifactUris.sceneAssetInventoryUri,
        scene_asset_dependency_audit_uri:
          publication.artifactUris.sceneAssetDependencyAuditUri,
        scene_asset_preflight_uri: publication.artifactUris.sceneAssetPreflightUri,
        scene_asset_inspection_uri: publication.artifactUris.sceneAssetInspectionUri,
        collider_proxy_plan_uri: publication.artifactUris.colliderProxyPlanUri,
        cpu_scene_proxy_manifest_uri: publication.artifactUris.cpuSceneProxyManifestUri,
        cpu_preflight_scorecard_uri: publication.artifactUris.cpuPreflightScorecardUri,
        task_anchor_proposal_manifest_uri:
          publication.artifactUris.taskAnchorProposalManifestUri,
        episode_spec_manifest_uri: publication.artifactUris.episodeSpecManifestUri,
        episode_specs_uri: publication.artifactUris.episodeSpecsUri,
        spawn_pose_validation_manifest_uri:
          publication.artifactUris.spawnPoseValidationManifestUri,
        cpu_preflight_manifest_uri: publication.artifactUris.cpuPreflightManifestUri,
        pre_gpu_readiness_summary_uri:
          publication.artifactUris.preGpuReadinessSummaryUri,
        cpu_simulator_preflight_manifest_uri:
          publication.artifactUris.cpuSimulatorPreflightManifestUri,
        gpu_handoff_packet_uri: publication.artifactUris.gpuHandoffPacketUri,
        gpu_owner_system_proof_schema_uri:
          publication.artifactUris.gpuOwnerSystemProofSchemaUri,
        gpu_run_checklist_uri: publication.artifactUris.gpuRunChecklistUri,
        owner_gpu_simulator_execution_blocked_manifest_uri:
          publication.artifactUris.ownerGpuSimulatorExecutionBlockedManifestUri,
        ready_for_owner_gpu_preflight:
          publication.preflightSummary.readyForOwnerGpuPreflight,
        owner_gpu_simulator_execution_proven: false,
        local_cpu_preflight_smoke_ran:
          publication.preflightSummary.localCpuSmokeRan,
        simulator_execution_proven: false,
        robot_readiness_proven: false,
      },
    },
    proof_boundary: {
      simulator_execution_proven: false,
      robot_readiness_proven: false,
      robot_policy_execution_proven: false,
      physics_contact_validated: false,
      safety_validated: false,
      public_claim_upgrade_allowed: false,
    },
  };
}
