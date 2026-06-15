import { describe, expect, it } from "vitest";
import {
  buildRobotEvalJobRequestFromSite,
  buildPolicyPackageFromRobotTeamSubmission,
  robotTeamSubmissionReadyForJobRequest,
} from "@/lib/robotEvalJobRequest";
import { siteLibrarySites } from "@/data/siteLibrary";
import {
  normalizeRobotTeamTestSubmission,
  ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS,
} from "@/lib/robotTeamTestSubmission";

describe("robotTeamTestSubmission", () => {
  it("normalizes all six modalities and keeps references inside proof boundaries", () => {
    const submission = normalizeRobotTeamTestSubmission({
      submissionId: "submission-1",
      siteWorldId: "siteworld-f5fd54898cfb",
      taskId: "task-1",
      scenarioId: "scenario-1",
      robotProfileId: "robot-1",
      modalities: {
        policy_api_endpoint: {
          selected: true,
          fields: {
            endpointUrl: "https://robot-team.example/policy",
            authHandling: "secret ref only",
            observationSchemaRef: "gs://robot-team/schemas/obs.json",
            actionSchemaRef: "gs://robot-team/schemas/action.json",
            runtimeConstraints: "200 ms p95",
            callbackLogUri: "gs://robot-team/logs/",
            ownerContact: "owner@example.com",
          },
        },
        docker_container: {
          selected: true,
          fields: {
            imageRef: "registry.example.com/team/policy:latest",
          },
        },
      },
    });

    expect(submission?.schemaVersion).toBe("blueprint.robot_team_test_submission.v1");
    expect(Object.keys(submission?.modalities || {})).toHaveLength(
      ROBOT_TEAM_TEST_SUBMISSION_MODALITY_DEFINITIONS.length,
    );
    expect(submission?.selectedModalities).toEqual([
      "policy_api_endpoint",
      "docker_container",
    ]);
    expect(submission?.modalities.policy_api_endpoint.reviewStatus).toBe("ready_for_review");
    expect(submission?.modalities.docker_container.reviewStatus).toBe("missing_required_refs");
    expect(submission?.missingEvidenceStatuses).toEqual(["needs_docker_container_ref"]);
    expect(submission?.pipelineDatasetSchemaRefs).toContain(
      "robot_team_test_submission_modalities.v0.1",
    );
    expect(submission?.proofBoundary.submittedArtifactsAre).toBe("artifact_references_only");
    expect(submission?.proofBoundary.blockedClaimUpgrades).toContain(
      "policy_execution_passed_claim",
    );
    expect(submission?.proofBoundary.operationalReadinessRequires).toContain(
      "robot profile with geometry, sensors, controllers, and control level, or a clear site-feasibility-only scope",
    );
  });

  it("builds a Pipeline policy package from selected concrete refs only", () => {
    const submission = normalizeRobotTeamTestSubmission({
      submissionId: "submission-policy-api",
      siteWorldId: "site-sw-chi-01",
      taskId: "place_return_in_bin",
      scenarioId: "scenario_place_return_in_bin_mobile_manipulator_rgb_v1",
      robotProfileId: "mobile_manipulator_rgb_v1",
      modalities: {
        policy_api_endpoint: {
          selected: true,
          fields: {
            endpointUrl: "https://policies.robotteam.dev/v1/action",
            authHandling: "Bearer token in redacted robot-team secret ref",
            observationSchemaRef: "gs://robot-team/schemas/observation.v1.json",
            actionSchemaRef: "gs://robot-team/schemas/action.v1.json",
            runtimeConstraints: "200 ms p95, 10 rps",
            callbackLogUri: "gs://robot-team/blueprint/callbacks/",
            ownerContact: "robot-owner@robotteam.dev",
          },
        },
      },
    });

    expect(robotTeamSubmissionReadyForJobRequest(submission)).toBe(true);
    const policyPackage = buildPolicyPackageFromRobotTeamSubmission(submission);

    expect(Object.keys(policyPackage)).toEqual(["policy_api_endpoint"]);
    expect(policyPackage).toEqual({
      policy_api_endpoint: {
        endpoint_url: "https://policies.robotteam.dev/v1/action",
        auth_handling: "Bearer token in redacted robot-team secret ref",
        observation_schema_ref: "gs://robot-team/schemas/observation.v1.json",
        action_schema_ref: "gs://robot-team/schemas/action.v1.json",
        runtime_constraints: "200 ms p95, 10 rps",
        callback_log_uri: "gs://robot-team/blueprint/callbacks/",
        owner_contact: "robot-owner@robotteam.dev",
      },
    });
    expect(JSON.stringify(policyPackage)).not.toMatch(/placeholder/i);
  });

  it("builds the full Pipeline policy package for every robot-team interface", () => {
    const submission = normalizeRobotTeamTestSubmission({
      submissionId: "submission-all-modalities",
      siteWorldId: "site-sw-chi-01",
      taskId: "place_return_in_bin",
      scenarioId: "scenario_place_return_in_bin_mobile_manipulator_rgb_v1",
      robotProfileId: "mobile_manipulator_rgb_v1",
      modalities: {
        policy_api_endpoint: {
          selected: true,
          fields: {
            endpointUrl: "https://policies.robotteam.dev/v1/action",
            authHandling: "Bearer token in redacted robot-team secret ref",
            observationSchemaRef: "gs://robot-team/schemas/observation.v1.json",
            actionSchemaRef: "gs://robot-team/schemas/action.v1.json",
            runtimeConstraints: "200 ms p95, 10 rps",
            callbackLogUri: "gs://robot-team/blueprint/callbacks/",
            ownerContact: "robot-owner@robotteam.dev",
          },
        },
        docker_container: {
          selected: true,
          fields: {
            imageRef: "registry.example.com/team/policy:2026-06-08",
            digestChecksum:
              "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            entrypoint: "python -m policy_server --port 8080",
            environmentContract: "OBS_SCHEMA=/schemas/obs.json",
            hardwareNeeds: "1x L4, CUDA 12.4, 16 GB RAM",
            ioSchemaRef: "gs://robot-team/schemas/container-io.v1.json",
            runtimeNotes: "Warm up one request before measuring cycle time.",
          },
        },
        recorded_action_trace: {
          selected: true,
          fields: {
            traceManifestUri: "gs://robot-team/traces/manifest.json",
            format: "jsonl actions",
            taskScenarioMapping: "trace task maps to Blueprint task and scenario",
            timestampAlignment: "Unix ms aligned to observation frame timestamps",
            observationActionAlignment: "action[t] consumes observation[t-1]",
            successFailureLabels: "success, partial, failure",
            checksum:
              "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          },
        },
        high_level_skill_trace: {
          selected: true,
          fields: {
            skillTaxonomyVersion: "team.manipulation_skills.v3",
            orderedSkillSequence: "navigate -> pick -> place",
            preconditionsPostconditions: "Pre: tote visible. Post: tote placed.",
            failureLabels: "failure_perception_occlusion",
            sourceType: "planner_export",
            confidenceCoverageNote: "Covers nominal tote pick.",
          },
        },
        teleop_demo: {
          selected: true,
          fields: {
            demoArtifactUri: "gs://robot-team/teleop/demo-001/manifest.json",
            operatorDevice: "Certified operator, dual-stick controller",
            controlMapping: "left stick base xy, trigger gripper",
            timeSync: "NTP synced, trajectory timestamps in Unix ms",
            taskScenarioMapping: "demo D001 maps to scenario-1",
            rightsPrivacyAttestation: "privacy reviewed; operator face excluded",
            labels: "success=true, interventions=0, safety_events=0",
          },
        },
        sim_controller_plugin: {
          selected: true,
          fields: {
            simulatorFramework: "Isaac Sim 4.x controller extension",
            pluginUri: "gs://robot-team/plugins/isaac-controller-v2.zip",
            supportedControlModes: "base velocity, ee delta pose, binary gripper",
            observationActionSpaces: "obs schema v1, action schema ee_delta_pose_gripper",
            replayExportPath: "gs://robot-team/sim/replays/",
            compatibilityNotes: "Isaac Sim 4.2, Python 3.10",
          },
        },
      },
    });

    expect(robotTeamSubmissionReadyForJobRequest(submission)).toBe(true);
    expect(submission?.missingEvidenceStatuses).toEqual([]);
    const policyPackage = buildPolicyPackageFromRobotTeamSubmission(submission);

    expect(policyPackage).toEqual({
      policy_api_endpoint: {
        endpoint_url: "https://policies.robotteam.dev/v1/action",
        auth_handling: "Bearer token in redacted robot-team secret ref",
        observation_schema_ref: "gs://robot-team/schemas/observation.v1.json",
        action_schema_ref: "gs://robot-team/schemas/action.v1.json",
        runtime_constraints: "200 ms p95, 10 rps",
        callback_log_uri: "gs://robot-team/blueprint/callbacks/",
        owner_contact: "robot-owner@robotteam.dev",
      },
      docker_container: {
        image_ref: "registry.example.com/team/policy:2026-06-08",
        digest:
          "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        entrypoint: "python -m policy_server --port 8080",
        environment_contract: "OBS_SCHEMA=/schemas/obs.json",
        hardware_needs: "1x L4, CUDA 12.4, 16 GB RAM",
        io_schema_ref: "gs://robot-team/schemas/container-io.v1.json",
        runtime_notes: "Warm up one request before measuring cycle time.",
      },
      recorded_action_trace: {
        trace_manifest_uri: "gs://robot-team/traces/manifest.json",
        format: "jsonl actions",
        task_scenario_mapping: "trace task maps to Blueprint task and scenario",
        timestamp_alignment: "Unix ms aligned to observation frame timestamps",
        observation_action_alignment: "action[t] consumes observation[t-1]",
        success_failure_labels: "success, partial, failure",
        checksum:
          "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      },
      high_level_skill_trace: {
        skill_taxonomy_version: "team.manipulation_skills.v3",
        ordered_skill_sequence: ["navigate", "pick", "place"],
        preconditions_postconditions: "Pre: tote visible. Post: tote placed.",
        failure_labels: "failure_perception_occlusion",
        source_type: "planner_export",
        confidence_coverage_note: "Covers nominal tote pick.",
      },
      teleop_demo: {
        demo_artifact_uri: "gs://robot-team/teleop/demo-001/manifest.json",
        operator_device: "Certified operator, dual-stick controller",
        control_mapping: "left stick base xy, trigger gripper",
        time_sync: "NTP synced, trajectory timestamps in Unix ms",
        task_scenario_mapping: "demo D001 maps to scenario-1",
        rights_privacy_attestation: "privacy reviewed; operator face excluded",
        labels: "success=true, interventions=0, safety_events=0",
      },
      sim_controller_plugin: {
        simulator_framework: "Isaac Sim 4.x controller extension",
        plugin_uri: "gs://robot-team/plugins/isaac-controller-v2.zip",
        supported_control_modes: ["base velocity", "ee delta pose", "binary gripper"],
        observation_action_spaces: "obs schema v1, action schema ee_delta_pose_gripper",
        replay_export_path: "gs://robot-team/sim/replays/",
        compatibility_notes: "Isaac Sim 4.2, Python 3.10",
      },
    });
    expect(JSON.stringify(policyPackage)).not.toMatch(/placeholder/i);
  });

  it("refuses to synthesize fallback capture lineage for live robot-eval job requests", () => {
    const site = {
      ...siteLibrarySites[0],
      captureLineage: undefined,
    };

    expect(() =>
      buildRobotEvalJobRequestFromSite(site, {
        route: `/sites/${site.slug}`,
        surface: "sites",
      }),
    ).toThrow(/capture lineage/i);
  });

  it("keeps sample site GPU preflight readiness false unless artifact truth upgrades it", () => {
    const site = siteLibrarySites[0];
    const request = buildRobotEvalJobRequestFromSite(site, {
      route: `/sites/${site.slug}`,
      surface: "sites",
    });

    expect(request.buyer_request_id).toBe(
      "buyer-request-sw-chi-01-walk-to-target-blueprint-default-unitree-g1-mujoco-simulator-policy",
    );
    expect(request.requested_tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        task_id: "walk_to_target",
        label: "Navigate to a spot",
        skill_id: "walk_to_target",
        scenario_ids: ["sw-chi-01_scenario_walk_to_target_unitree_g1_mujoco_v1"],
      }),
      expect.objectContaining({
        task_id: "mobile_pick_carry_place_tote",
        label: "Pick tote and return",
        skill_id: "mobile_manipulation_pick_carry_place",
        task_kind: "mobile_manipulation_pick_carry_place",
        object_id: "simready_tote_001",
        object_class: "tote",
      }),
    ]));
    expect(request.robot_profile).toEqual(
      expect.objectContaining({
        robot_profile_id: "unitree_g1_humanoid",
        robot_name: "Unitree G1",
        embodiment: "humanoid",
      }),
    );
    expect(request.simulator_scope).toEqual(
      expect.objectContaining({
        mode: "simulator_only",
        simulator: "MuJoCo",
        physical_robot_deployment_claim_allowed: false,
      }),
    );
    expect(request.policy_package).toEqual({
      default_test_policy: expect.objectContaining({
        policy_kind: "mobile_manipulation_pick_carry_place",
        task_id: "mobile_pick_carry_place_tote",
        object_id: "simready_tote_001",
        object_class: "tote",
      }),
      high_level_skill_trace: expect.objectContaining({
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
      }),
    });
    expect(request.execution_request).toEqual(
      expect.objectContaining({
        webapp_role: "queue_and_forward_only",
        scope: expect.objectContaining({
          mode: "simulator_only",
          physical_robot_deployment_claim_allowed: false,
        }),
        worker_selection: expect.objectContaining({
          mode: "blueprint_selects_fastest_cheapest_available_simulator_worker",
          customer_provider_choice_required: false,
        }),
        simulator_routing: expect.objectContaining({
          requested_backend: "pipeline_selected",
          default_first_pass_backend: "mujoco",
          default_first_gpu_backend: "mujoco",
          default_robot_profile_id: "unitree_g1_humanoid",
        }),
      }),
    );
    expect(request.pipeline_trigger.cpu_pre_gpu_preflight).toEqual(
      expect.objectContaining({
        ready_for_owner_gpu_preflight: false,
        owner_gpu_simulator_execution_proven: false,
        simulator_execution_proven: false,
        robot_readiness_proven: false,
      }),
    );
  });
});
