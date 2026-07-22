// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRobotEvalJobRequest,
  forwardRobotEvalJobRequestToPipeline,
  robotEvalJobRequestForwardRequired,
  robotEvalJobRequestForwardErrorMessage,
  validateRobotEvalJobRequest,
  writeRobotEvalJobRequestInbox,
} from "../utils/robotEvalJobRequests";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("buildRobotEvalJobRequest", () => {
  it("creates a durable Pipeline robot_eval_job_request.v1 from a site/task/policy selection", () => {
    const request = buildRobotEvalJobRequest({
      sitePackage: {
        siteSlug: "sw-chi-01",
        siteId: "site-sw-chi-01",
        siteName: "Harborview Grocery Distribution Annex",
        siteSubmissionId: "site-submission-sw-chi-01",
        captureJobId: "capture-job-sw-chi-01",
        captureId: "capture-sw-chi-01",
        captureRoot: "gs://blueprint/site-packages/sw-chi-01",
        pipelinePrefix: "gs://blueprint/site-packages/sw-chi-01/pipeline",
        accessState: "request_gated",
        artifactUris: {
          manifestUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/robot_eval_dataset_manifest.json",
          taskCardsUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/task_cards.json",
          scenarioCardsUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/scenario_cards.json",
          evalCardsUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/eval_cards.json",
          proofBoundariesUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/proof_boundaries.json",
          taskThresholdsUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/task_thresholds.json",
          publicationReadinessUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/publication_readiness.json",
          sceneAssetInspectionUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/scene_asset_inspection.json",
          sceneFrameEstimateUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/scene_frame_estimate.json",
          cpuPreflightScorecardUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/cpu_preflight_scorecard.json",
          episodeSpecManifestUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/episode_spec_manifest.json",
          cpuSimulatorPreflightManifestUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/cpu_simulator_preflight_manifest.json",
        },
        publication: {
          readyToEvaluatePublishable: true,
          publicationLabel: "Ready to evaluate",
        },
      },
      selection: {
        taskId: "place_return_in_bin",
        scenarioId: "scenario_place_return_in_bin_mobile",
        robotProfileId: "mobile_manipulator_rgb_v1",
        policyId: "policy-api-fixture",
      },
      robotTeam: {
        customerId: "robot-team-a",
        companyName: "Robot Team A",
        contactEmail: "robot-team@example.com",
      },
      entitlement: {
        accessState: "request_gated",
        entitlementId: "entitlement-sw-chi-01",
        approved: true,
      },
      policySubmission: {
        policy_api_endpoint: {
          endpoint_url: "https://robot-team.example/policy",
          auth_handling: "Bearer token in redacted robot-team secret ref",
          observation_schema_ref: "gs://robot-team/schemas/obs.json",
          action_schema_ref: "gs://robot-team/schemas/action.json",
          runtime_constraints: "200 ms p95, 10 rps",
          callback_log_uri: "gs://robot-team/blueprint/callbacks/",
          owner_contact: "robot-owner@robotteam.dev",
        },
        docker_container: {
          image_ref: "registry.example/robot/policy:2026-06-06",
          digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          entrypoint: "python -m policy_server --port 8080",
          environment_contract: "OBS_SCHEMA=/schemas/obs.json",
          hardware_needs: "1x L4, CUDA 12.4, 16 GB RAM",
          io_schema_ref: "gs://robot-team/schemas/container-io.v1.json",
          runtime_notes: "Warm up one request before measuring cycle time.",
        },
        recorded_action_trace: {
          trace_manifest_uri: "gs://robot-team/traces/trace.json",
          format: "jsonl actions",
          task_scenario_mapping: "trace task maps to Blueprint task and scenario",
          timestamp_alignment: "aligned_to_capture_timestamps",
          observation_action_alignment: "action[t] consumes observation[t-1]",
          success_failure_labels: "success, partial, failure",
          checksum:
            "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        },
        high_level_skill_trace: {
          ordered_skill_sequence: ["navigate", "pick", "place"],
          skill_taxonomy_version: "team.manipulation_skills.v3",
          preconditions_postconditions: "Pre: tote visible. Post: tote placed.",
          failure_labels: "failure_perception_occlusion",
          source_type: "planner_export",
          confidence_coverage_note: "Covers nominal tote pick.",
        },
        teleop_demo: {
          demo_artifact_uri: "gs://robot-team/demos/demo.json",
          operator_device: "Certified operator, dual-stick controller",
          control_mapping: "left stick base xy, trigger gripper",
          time_sync: "NTP synced, trajectory timestamps in Unix ms",
          task_scenario_mapping: "demo D001 maps to scenario-1",
          rights_privacy_attestation: "operator_approved_deidentified",
          labels: "success=true, interventions=0, safety_events=0",
        },
        sim_controller_plugin: {
          simulator_framework: "fixture",
          plugin_uri: "gs://robot-team/plugins/controller.json",
          supported_control_modes: ["base_velocity", "ee_delta_pose", "binary_gripper"],
          observation_action_spaces: "obs schema v1, action schema ee_delta_pose_gripper",
          replay_export_path: "gs://robot-team/sim/replays/",
          compatibility_notes: "Fixture controller, no contact-rich validation claim.",
        },
      },
      benchmarkProtocol: {
        mode: "benchmark_grade",
        benchmarkSpecUri: "gs://blueprint/benchmarks/drawer/spec.json",
        benchmarkSpecSha256: "a".repeat(64),
      },
      source: {
        route: "/sites/sw-chi-01",
        surface: "sites",
      },
    });

    expect(request.schema_version).toBe("robot_eval_job_request.v1");
    expect(request.benchmark_protocol_request).toEqual(
      expect.objectContaining({
        mode: "benchmark_grade",
        frozen_hidden_splits_required: true,
        fixed_rollouts_required: true,
        confidence_intervals_required: true,
        exact_checkpoint_digests_required: true,
        private_split_material_allowed_in_webapp: false,
        scheduler_owner: "BlueprintCapturePipeline",
      }),
    );
    expect(request.buyer_request_id).toMatch(/^buyer-request-sw-chi-01-place-return-in-bin-/);
    expect(request.job_id).toMatch(/^robot-eval-sw-chi-01-place-return-in-bin-/);
    expect(request.customer).toEqual(
      expect.objectContaining({
        id: "robot-team-a",
        name: "Robot Team A",
      }),
    );
    expect(request.site_package).toEqual(
      expect.objectContaining({
        site_slug: "sw-chi-01",
        site_id: "site-sw-chi-01",
        site_submission_id: "site-submission-sw-chi-01",
        capture_job_id: "capture-job-sw-chi-01",
        capture_id: "capture-sw-chi-01",
        buyer_request_id: request.buyer_request_id,
        capture_root: "gs://blueprint/site-packages/sw-chi-01",
        pipeline_prefix: "gs://blueprint/site-packages/sw-chi-01/pipeline",
        publication_ready_to_evaluate: true,
        task_thresholds_uri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/task_thresholds.json",
        cpu_preflight_scorecard_uri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/cpu_preflight_scorecard.json",
        episode_spec_manifest_uri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/episode_spec_manifest.json",
      }),
    );
    expect(request.requested_tasks).toEqual([
      {
        task_id: "place_return_in_bin",
        scenario_ids: ["scenario_place_return_in_bin_mobile"],
        task_thresholds_uri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/robot_eval_dataset/task_thresholds.json",
      },
    ]);
    expect(Object.keys(request.policy_package)).toEqual([
      "policy_api_endpoint",
      "docker_container",
      "recorded_action_trace",
      "high_level_skill_trace",
      "teleop_demo",
      "sim_controller_plugin",
    ]);
    expect(request.policy_package).toEqual({
      policy_api_endpoint: {
        endpoint_url: "https://robot-team.example/policy",
        auth_handling: "Bearer token in redacted robot-team secret ref",
        observation_schema_ref: "gs://robot-team/schemas/obs.json",
        action_schema_ref: "gs://robot-team/schemas/action.json",
        runtime_constraints: "200 ms p95, 10 rps",
        callback_log_uri: "gs://robot-team/blueprint/callbacks/",
        owner_contact: "robot-owner@robotteam.dev",
      },
      docker_container: {
        image_ref: "registry.example/robot/policy:2026-06-06",
        digest:
          "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        entrypoint: "python -m policy_server --port 8080",
        environment_contract: "OBS_SCHEMA=/schemas/obs.json",
        hardware_needs: "1x L4, CUDA 12.4, 16 GB RAM",
        io_schema_ref: "gs://robot-team/schemas/container-io.v1.json",
        runtime_notes: "Warm up one request before measuring cycle time.",
      },
      recorded_action_trace: {
        trace_manifest_uri: "gs://robot-team/traces/trace.json",
        format: "jsonl actions",
        task_scenario_mapping: "trace task maps to Blueprint task and scenario",
        timestamp_alignment: "aligned_to_capture_timestamps",
        observation_action_alignment: "action[t] consumes observation[t-1]",
        success_failure_labels: "success, partial, failure",
        checksum:
          "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      },
      high_level_skill_trace: {
        ordered_skill_sequence: ["navigate", "pick", "place"],
        skill_taxonomy_version: "team.manipulation_skills.v3",
        preconditions_postconditions: "Pre: tote visible. Post: tote placed.",
        failure_labels: "failure_perception_occlusion",
        source_type: "planner_export",
        confidence_coverage_note: "Covers nominal tote pick.",
      },
      teleop_demo: {
        demo_artifact_uri: "gs://robot-team/demos/demo.json",
        operator_device: "Certified operator, dual-stick controller",
        control_mapping: "left stick base xy, trigger gripper",
        time_sync: "NTP synced, trajectory timestamps in Unix ms",
        task_scenario_mapping: "demo D001 maps to scenario-1",
        rights_privacy_attestation: "operator_approved_deidentified",
        labels: "success=true, interventions=0, safety_events=0",
      },
      sim_controller_plugin: {
        simulator_framework: "fixture",
        plugin_uri: "gs://robot-team/plugins/controller.json",
        supported_control_modes: ["base_velocity", "ee_delta_pose", "binary_gripper"],
        observation_action_spaces: "obs schema v1, action schema ee_delta_pose_gripper",
        replay_export_path: "gs://robot-team/sim/replays/",
        compatibility_notes: "Fixture controller, no contact-rich validation claim.",
      },
    });
    expect(request.pipeline_trigger).toEqual(
      expect.objectContaining({
        status: "queued_for_pipeline",
        command: "blueprint-run-robot-eval-job",
        default_provisioner: "fixture_local",
        default_simulator: "mujoco",
        cpu_pre_gpu_preflight: expect.objectContaining({
          cpu_preflight_scorecard_uri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/cpu_preflight_scorecard.json",
          ready_for_owner_gpu_preflight: false,
          local_cpu_preflight_smoke_ran: false,
          simulator_execution_proven: false,
          rank_fidelity_result_proven: false,
        }),
      }),
    );
    expect(request.simulator_preference).toBe("mujoco_first");
    expect(request.budget).toEqual({ budget_usd: 0, timeout_seconds: 120 });
    expect(request.execution_request).toEqual(
      expect.objectContaining({
        schema_version: "blueprint.robot_eval_execution_request.v1",
        webapp_role: "queue_and_forward_only",
        scheduler_owner: "BlueprintCapturePipeline",
        scope: expect.objectContaining({
          mode: "simulator_only",
          label: "Unitree G1 MuJoCo simulator evaluation",
          physical_robot_deployment_claim_allowed: false,
        }),
        queueing: expect.objectContaining({
          mode: "async_job",
          web_request_must_not_wait_for_simulator: true,
        }),
        worker_selection: expect.objectContaining({
          mode: "blueprint_selects_fastest_cheapest_available_simulator_worker",
          customer_provider_choice_required: false,
          provider_complexity_hidden_by_default: true,
        }),
        preflight: expect.objectContaining({
          cpu_preflight_required_before_gpu: true,
          blocks_gpu_when_missing: true,
        }),
        simulator_routing: expect.objectContaining({
          requested_backend: "pipeline_selected",
          default_first_pass_backend: "mujoco",
          default_first_gpu_backend: "mujoco",
          simulator_preference: "mujoco",
          default_robot_profile_id: "unitree_g1_humanoid",
          allowed_backends: expect.arrayContaining(["isaac_sim", "mujoco"]),
          escalation_backends: expect.arrayContaining(["isaac_sim", "isaac_lab_arena"]),
          selection_policy: expect.objectContaining({
            mode: "mujoco_first_unless_proof_requires_isaac",
            first_pass_backend: "mujoco",
            use_mujoco_when: expect.arrayContaining([
              "cheapest_first_real_simulator_pass",
              "early_policy_and_spawn_smoke_before_gpu_spend",
            ]),
            escalate_to_isaac_when: expect.arrayContaining([
              "rich_usd_or_openusd_scene_load_required",
              "isaac_robot_asset_proof_required",
            ]),
          }),
          proof_boundaries: expect.objectContaining({
            webapp_request_selects_policy_not_execution: true,
            mujoco_proof_does_not_clear_isaac_sim_gate: true,
          }),
        }),
        gpu_allocation: expect.objectContaining({
          allocation_allowed_by_webapp: false,
          gpu_spend_approved: false,
          idle_shutdown_required: true,
        }),
        artifact_contract: expect.objectContaining({
          expected_outputs: expect.arrayContaining([
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
          ]),
          startup_artifacts_are_advisory_until_owner_runtime_proof: true,
          simulator_execution_proven_by_webapp: false,
          public_claim_upgrade_allowed: false,
        }),
      }),
    );
    expect(request.proof_boundary).toEqual(
      expect.objectContaining({
        simulator_execution_proven: false,
        rank_fidelity_result_proven: false,
        robot_policy_execution_proven: false,
        physics_contact_validated: false,
        non_ranking_operational_claim_validated: false,
        public_claim_upgrade_allowed: false,
      }),
    );
    expect(validateRobotEvalJobRequest(request).ok).toBe(true);
  });

  it("only marks owner GPU preflight ready from an explicit preflight summary", () => {
    const request = buildRobotEvalJobRequest({
      sitePackage: {
        siteSlug: "sw-chi-01",
        siteId: "site-sw-chi-01",
        siteName: "Harborview Grocery Distribution Annex",
        siteSubmissionId: "site-submission-sw-chi-01",
        captureJobId: "capture-job-sw-chi-01",
        captureId: "capture-sw-chi-01",
        captureRoot: "gs://blueprint/site-packages/sw-chi-01",
        accessState: "request_gated",
        artifactUris: {
          manifestUri: "gs://blueprint/site-packages/sw-chi-01/robot_eval_dataset_manifest.json",
          taskThresholdsUri: "gs://blueprint/site-packages/sw-chi-01/task_thresholds.json",
          publicationReadinessUri:
            "gs://blueprint/site-packages/sw-chi-01/publication_readiness.json",
          gpuHandoffPacketUri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/gpu_handoff_packet.json",
        },
        publication: {
          readyToEvaluatePublishable: true,
          publicationLabel: "Ready to evaluate",
        },
        preflightSummary: {
          readyForOwnerGpuPreflight: true,
          localCpuSmokeRan: true,
        },
      },
      selection: {
        taskId: "place_return_in_bin",
        scenarioId: "scenario_place_return_in_bin_mobile",
        robotProfileId: "mobile_manipulator_rgb_v1",
        policyId: "policy-api-fixture",
      },
      robotTeam: {
        customerId: "robot-team-a",
        companyName: "Robot Team A",
      },
      entitlement: {
        accessState: "request_gated",
        approved: true,
      },
      policySubmission: {
        policy_api_endpoint: {
          endpoint_url: "https://robot-team.example/policy",
          observation_schema_ref: "gs://robot-team/schemas/obs.json",
          action_schema_ref: "gs://robot-team/schemas/action.json",
        },
      },
      source: {
        route: "/sites/sw-chi-01",
        surface: "sites",
      },
    });

    expect(request.pipeline_trigger.cpu_pre_gpu_preflight).toEqual(
      expect.objectContaining({
        gpu_handoff_packet_uri:
          "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/gpu_handoff_packet.json",
        ready_for_owner_gpu_preflight: true,
        local_cpu_preflight_smoke_ran: true,
        simulator_execution_proven: false,
        rank_fidelity_result_proven: false,
      }),
    );
    expect(validateRobotEvalJobRequest(request).ok).toBe(true);
  });

  it("rejects false-proof upgrades and incomplete selected policy modalities", () => {
    const invalid = {
      schema_version: "robot_eval_job_request.v1",
      job_id: "robot-eval-invalid",
      buyer_request_id: "buyer-request-invalid",
      site_package: {
        site_slug: "sw-chi-01",
        site_id: "site-sw-chi-01",
        site_submission_id: "site-submission-sw-chi-01",
        capture_job_id: "capture-job-sw-chi-01",
        capture_id: "capture-sw-chi-01",
        buyer_request_id: "buyer-request-invalid",
        capture_root: "",
        package_uri: "gs://blueprint/site-packages/sw-chi-01/manifest.json",
        task_thresholds_uri: "gs://blueprint/site-packages/sw-chi-01/task_thresholds.json",
        publication_readiness_uri:
          "gs://blueprint/site-packages/sw-chi-01/publication_readiness.json",
      },
      policy_package: {
        policy_api_endpoint: {
          observation_schema_ref: "gs://robot-team/schemas/obs.json",
        },
      },
      proof_boundary: {
        simulator_execution_proven: true,
        rank_fidelity_result_proven: false,
        robot_policy_execution_proven: false,
        physics_contact_validated: false,
        non_ranking_operational_claim_validated: false,
        public_claim_upgrade_allowed: false,
      },
      simulator_scope: {
        mode: "physical_robot",
        simulator: "RunPod",
        physical_robot_deployment_claim_allowed: true,
      },
      execution_request: {
        webapp_role: "runs_simulator",
        scheduler_owner: "Blueprint-WebApp",
        preflight: {
          cpu_preflight_required_before_gpu: false,
        },
        simulator_routing: {
          requested_backend: "isaac_sim",
          selection_policy: {
            mode: "isaac_first",
            first_pass_backend: "isaac_sim",
          },
          proof_boundaries: {
            webapp_request_selects_policy_not_execution: false,
            mujoco_proof_does_not_clear_isaac_sim_gate: false,
          },
        },
        gpu_allocation: {
          allocation_allowed_by_webapp: true,
          gpu_spend_approved: true,
        },
        artifact_contract: {
          public_claim_upgrade_allowed: true,
        },
      },
    };

    const validation = validateRobotEvalJobRequest(invalid);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "site_package.capture_root is required",
        "policy_package.policy_api_endpoint.endpoint_url is required",
        "proof_boundary.simulator_execution_proven must be false until owner-system proof exists",
        "simulator_scope.mode must be simulator_only",
        "simulator_scope.simulator must be MuJoCo",
        "simulator_scope.physical_robot_deployment_claim_allowed must be false",
        "execution_request.schema_version must be blueprint.robot_eval_execution_request.v1",
        "execution_request.webapp_role must be queue_and_forward_only",
        "execution_request.scheduler_owner must be BlueprintCapturePipeline",
        "execution_request.queueing is required when execution_request is provided",
        "execution_request.preflight.cpu_preflight_required_before_gpu must be true",
        "execution_request.preflight.blocks_gpu_when_missing must be true",
        "execution_request.simulator_routing.requested_backend must be pipeline_selected",
        "execution_request.simulator_routing.default_first_pass_backend must be mujoco",
        "execution_request.simulator_routing.default_first_gpu_backend must be mujoco",
        "execution_request.simulator_routing.selection_policy.mode must be mujoco_first_unless_proof_requires_isaac",
        "execution_request.simulator_routing.selection_policy.first_pass_backend must be mujoco",
        "execution_request.simulator_routing.proof_boundaries.webapp_request_selects_policy_not_execution must be true",
        "execution_request.simulator_routing.proof_boundaries.mujoco_proof_does_not_clear_isaac_sim_gate must be true",
        "execution_request.gpu_allocation.allocation_allowed_by_webapp must be false",
        "execution_request.gpu_allocation.gpu_spend_approved must be false",
        "execution_request.gpu_allocation.idle_shutdown_required must be true",
        "execution_request.artifact_contract.public_claim_upgrade_allowed must be false",
        "execution_request.artifact_contract.startup_artifacts_are_advisory_until_owner_runtime_proof must be true",
        "execution_request.artifact_contract.simulator_execution_proven_by_webapp must be false",
      ]),
    );
  });

  it("accepts one complete robot-team policy modality without requiring the other five", () => {
    const request = buildRobotEvalJobRequest({
      buyerRequestId: "buyer-request-single-modality",
      sitePackage: {
        siteSlug: "sw-chi-01",
        siteId: "site-sw-chi-01",
        siteName: "Harborview Grocery Distribution Annex",
        siteSubmissionId: "site-submission-sw-chi-01",
        captureJobId: "capture-job-sw-chi-01",
        captureId: "capture-sw-chi-01",
        captureRoot: "gs://blueprint/site-packages/sw-chi-01",
        accessState: "request_gated",
        artifactUris: {
          manifestUri: "gs://blueprint/site-packages/sw-chi-01/manifest.json",
          taskThresholdsUri: "gs://blueprint/site-packages/sw-chi-01/task_thresholds.json",
          publicationReadinessUri:
            "gs://blueprint/site-packages/sw-chi-01/publication_readiness.json",
        },
        publication: {
          readyToEvaluatePublishable: true,
          publicationLabel: "Ready to evaluate",
        },
      },
      selection: {
        taskId: "place_return_in_bin",
        scenarioId: "scenario_place_return_in_bin_mobile",
        robotProfileId: "mobile_manipulator_rgb_v1",
        policyId: "policy-api-fixture",
      },
      robotTeam: {
        customerId: "robot-team-a",
        companyName: "Robot Team A",
      },
      entitlement: {
        accessState: "request_gated",
        approved: true,
      },
      policySubmission: {
        policy_api_endpoint: {
          endpoint_url: "https://robot-team.example/policy",
          observation_schema_ref: "gs://robot-team/schemas/obs.json",
          action_schema_ref: "gs://robot-team/schemas/action.json",
        },
      },
      source: {
        route: "/sites/sw-chi-01",
        surface: "sites",
      },
    });

    expect(validateRobotEvalJobRequest(request)).toEqual({ ok: true, errors: [] });

    const missingPipelineLineage = {
      ...request,
      owner_system: {},
      source: {
        ...request.source,
        selection_state: {
          buyer_request_id: "wrong-buyer-request",
        },
      },
    };
    expect(validateRobotEvalJobRequest(missingPipelineLineage)).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        "owner_system.request_id is required",
        "owner_system.buyer_request_id is required",
        "owner_system.site_submission_id is required",
        "owner_system.capture_job_id is required",
        "owner_system.capture_id is required",
        "source.selection_state.buyer_request_id must match buyer_request_id",
        "source.selection_state.site_submission_id is required",
        "source.selection_state.capture_job_id is required",
        "source.selection_state.capture_id is required",
      ]),
    });
  });

  it("writes a Pipeline-readable inbox envelope and append-only index", async () => {
    const request = buildRobotEvalJobRequest({
      buyerRequestId: "buyer-request-sw-chi-01-fixture",
      sitePackage: {
        siteSlug: "sw-chi-01",
        siteId: "site-sw-chi-01",
        siteName: "Harborview Grocery Distribution Annex",
        siteSubmissionId: "site-submission-sw-chi-01",
        captureJobId: "capture-job-sw-chi-01",
        captureId: "capture-sw-chi-01",
        captureRoot: "gs://blueprint/site-packages/sw-chi-01",
        pipelinePrefix: "gs://blueprint/site-packages/sw-chi-01/pipeline",
        accessState: "request_gated",
        artifactUris: {
          manifestUri: "gs://blueprint/site-packages/sw-chi-01/robot_eval_dataset_manifest.json",
          taskThresholdsUri: "gs://blueprint/site-packages/sw-chi-01/task_thresholds.json",
          publicationReadinessUri:
            "gs://blueprint/site-packages/sw-chi-01/publication_readiness.json",
        },
        publication: {
          readyToEvaluatePublishable: true,
          publicationLabel: "Ready to evaluate",
        },
      },
      selection: {
        taskId: "place_return_in_bin",
        scenarioId: "scenario_place_return_in_bin_mobile",
        robotProfileId: "mobile_manipulator_rgb_v1",
        policyId: "policy-api-fixture",
      },
      robotTeam: {
        customerId: "robot-team-a",
        companyName: "Robot Team A",
      },
      entitlement: {
        accessState: "request_gated",
        approved: true,
      },
      policySubmission: {
        policy_api_endpoint: {},
        docker_container: {},
        recorded_action_trace: {},
        high_level_skill_trace: {},
        teleop_demo: {},
        sim_controller_plugin: {},
      },
      source: {
        route: "/sites/sw-chi-01",
        surface: "sites",
      },
    });
    const inboxDir = await fs.mkdtemp(path.join(os.tmpdir(), "robot-eval-inbox-"));

    const inbox = await writeRobotEvalJobRequestInbox({
      rootDir: inboxDir,
      jobRequest: request,
      queuedAt: "2026-06-06T00:00:00.000Z",
    });

    const envelope = JSON.parse(await fs.readFile(inbox.job_request_path, "utf8"));
    const index = await fs.readFile(inbox.index_path, "utf8");
    expect(envelope).toEqual(
      expect.objectContaining({
        queue_contract: "robot_eval_job_request_inbox.v1",
        status: "queued_for_pipeline",
        job_id: request.job_id,
        buyer_request_id: "buyer-request-sw-chi-01-fixture",
        pipeline_command: "blueprint-run-robot-eval-job",
        pipeline_consumer: "BlueprintCapturePipeline",
      }),
    );
    expect(envelope.job_request.site_package).toEqual(
      expect.objectContaining({
        capture_job_id: "capture-job-sw-chi-01",
        capture_id: "capture-sw-chi-01",
        buyer_request_id: "buyer-request-sw-chi-01-fixture",
      }),
    );
    expect(index).toContain("robot_eval_job_request_inbox.v1");
    expect(index).toContain("buyer-request-sw-chi-01-fixture");
  });

  it("requires Pipeline forwarding by default even when no endpoint is configured", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await forwardRobotEvalJobRequestToPipeline({
      jobRequest: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "robot-eval-1",
        buyer_request_id: "buyer-request-1",
      },
      queuedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(result).toEqual({
      status: "not_configured",
      performed: false,
      endpoint_configured: false,
      required: true,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows optional local forwarding only outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED", "false");
    expect(robotEvalJobRequestForwardRequired()).toBe(false);

    vi.stubEnv("NODE_ENV", "production");
    expect(robotEvalJobRequestForwardRequired()).toBe(true);
  });

  it("blocks Pipeline forwarding when endpoint is configured without a token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await forwardRobotEvalJobRequestToPipeline({
      endpointUrl: "http://127.0.0.1:8765/api/live-pipeline/job-requests",
      jobRequest: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "robot-eval-1",
        buyer_request_id: "buyer-request-1",
      },
      queuedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "blocked",
        performed: false,
        endpoint_configured: true,
        blockers: ["missing_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN"],
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks Pipeline forwarding when the site capture-root override env is invalid", async () => {
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON", "{bad-json");
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await forwardRobotEvalJobRequestToPipeline({
      endpointUrl: "http://127.0.0.1:8765/api/live-pipeline/job-requests",
      token: "test-forward-token",
      jobRequest: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "robot-eval-1",
        buyer_request_id: "buyer-request-1",
      },
      queuedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "blocked",
        performed: false,
        blockers: [
          "invalid_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON",
        ],
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("can forward a site request with the active Pipeline control-plane capture root", async () => {
    vi.stubEnv(
      "ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON",
      JSON.stringify({
        "sw-chi-01": "/var/lib/blueprint/captures/sw-chi-01/capture-root",
      }),
    );
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: true,
          status: "staged_for_control_plane",
          input_blockers: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const result = await forwardRobotEvalJobRequestToPipeline({
      endpointUrl: "http://127.0.0.1:8765/api/live-pipeline/job-requests",
      token: "test-forward-token",
      jobRequest: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "robot-eval-sw-chi-01-place-return-in-bin-default-fixture-policy",
        buyer_request_id: "buyer-request-sw-chi-01-place-return-in-bin-default-fixture-policy",
        site_package: {
          site_slug: "sw-chi-01",
          capture_root: "/synced-artifacts/sites/sw-chi-01",
        },
        owner_system: {
          name: "Blueprint-WebApp",
        },
      },
      queuedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "forwarded",
        performed: true,
        capture_root_override_applied: true,
        capture_root_override_source: "site",
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.job_request.site_package).toEqual(
      expect.objectContaining({
        site_slug: "sw-chi-01",
        capture_root: "/var/lib/blueprint/captures/sw-chi-01/capture-root",
        webapp_capture_root: "/synced-artifacts/sites/sw-chi-01",
        capture_root_override_source:
          "env:ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON",
      }),
    );
    expect(body.job_request.owner_system).toEqual(
      expect.objectContaining({
        name: "Blueprint-WebApp",
        pipeline_control_plane_capture_root:
          "/var/lib/blueprint/captures/sw-chi-01/capture-root",
      }),
    );
  });

  it("blocks forwarding synced-artifact WebApp capture roots unless a Pipeline override is configured", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await forwardRobotEvalJobRequestToPipeline({
      endpointUrl: "http://127.0.0.1:8765/api/live-pipeline/job-requests",
      token: "test-forward-token",
      jobRequest: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "robot-eval-sw-chi-01-place-return-in-bin-default-fixture-policy",
        buyer_request_id: "buyer-request-sw-chi-01-place-return-in-bin-default-fixture-policy",
        site_package: {
          site_slug: "sw-chi-01",
          capture_root: "/synced-artifacts/sites/sw-chi-01",
        },
        owner_system: {
          name: "Blueprint-WebApp",
        },
      },
      queuedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "blocked",
        performed: false,
        endpoint_configured: true,
        blockers: ["missing_pipeline_capture_root_override_for_webapp_synced_artifact"],
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards a Pipeline queue envelope with redacted status", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: true,
          status: "staged_for_control_plane",
          input_blockers: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const result = await forwardRobotEvalJobRequestToPipeline({
      endpointUrl: "http://127.0.0.1:8765/api/live-pipeline/job-requests",
      token: "test-forward-token",
      jobRequest: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "robot-eval-1",
        buyer_request_id: "buyer-request-1",
      },
      queuedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "forwarded",
        performed: true,
        endpoint_configured: true,
        http_status: 200,
        timeout_ms: 60000,
        accepted: true,
        pipeline_status: "staged_for_control_plane",
      }),
    );
    expect(result).not.toHaveProperty("capture_root_override_source");
    expect(JSON.stringify(result)).not.toContain("test-forward-token");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8765/api/live-pipeline/job-requests",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-blueprint-pipeline-signature": expect.stringMatching(/^sha256=[a-f0-9]{64}$/),
          "x-blueprint-pipeline-timestamp": expect.any(String),
          "x-blueprint-pipeline-nonce": expect.any(String),
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();
    const body = JSON.parse(String(init.body));
    expect(body).toEqual(
      expect.objectContaining({
        queue_contract: "robot_eval_job_request_inbox.v1",
        status: "queued_for_pipeline",
        job_id: "robot-eval-1",
        buyer_request_id: "buyer-request-1",
        pipeline_consumer: "BlueprintCapturePipeline",
      }),
    );
    expect(body.job_request.schema_version).toBe("robot_eval_job_request.v1");
  });

  it("keeps the production Pipeline forward timeout floor when env is lower", async () => {
    vi.stubEnv("ROBOT_EVAL_JOB_REQUEST_FORWARD_TIMEOUT_MS", "10000");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: true,
          status: "staged_for_control_plane",
          input_blockers: [],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const result = await forwardRobotEvalJobRequestToPipeline({
      endpointUrl: "http://127.0.0.1:8765/api/live-pipeline/job-requests",
      token: "test-forward-token",
      jobRequest: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "robot-eval-1",
        buyer_request_id: "buyer-request-1",
      },
      queuedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "forwarded",
        performed: true,
        timeout_ms: 60000,
      }),
    );
  });

  it("treats Pipeline-recorded blocked requests as forwarded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          accepted: false,
          status: "blocked",
          input_blockers: [
            "webapp:request_capture_root_does_not_match_control_plane",
          ],
        }),
        {
          status: 202,
          headers: { "content-type": "application/json" },
        },
      ),
    );

    const result = await forwardRobotEvalJobRequestToPipeline({
      endpointUrl: "http://127.0.0.1:8765/api/live-pipeline/job-requests",
      token: "test-forward-token",
      jobRequest: {
        schema_version: "robot_eval_job_request.v1",
        job_id: "robot-eval-1",
        buyer_request_id: "buyer-request-1",
      },
      queuedAt: "2026-06-06T00:00:00.000Z",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "forwarded",
        performed: true,
        http_status: 202,
        accepted: false,
        pipeline_status: "blocked",
        input_blockers: [
          "webapp:request_capture_root_does_not_match_control_plane",
        ],
      }),
    );
    expect(result).not.toHaveProperty("capture_root_override_source");
  });

  it("explains Pipeline input blockers instead of hiding them behind a generic 502", () => {
    expect(
      robotEvalJobRequestForwardErrorMessage({
        status: "failed",
        performed: false,
        endpoint_configured: true,
        required: true,
        http_status: 422,
        input_blockers: ["webapp:request_capture_root_does_not_match_control_plane"],
      }),
    ).toMatch(/capture root does not match/i);
  });
});
