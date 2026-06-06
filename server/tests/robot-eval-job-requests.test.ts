// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildRobotEvalJobRequest,
  validateRobotEvalJobRequest,
  writeRobotEvalJobRequestInbox,
} from "../utils/robotEvalJobRequests";

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
          observation_schema_ref: "gs://robot-team/schemas/obs.json",
          action_schema_ref: "gs://robot-team/schemas/action.json",
        },
        docker_container: {
          image_ref: "registry.example/robot/policy:2026-06-06",
          digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
        recorded_action_trace: {
          trace_manifest_uri: "gs://robot-team/traces/trace.json",
          timestamp_alignment: "aligned_to_capture_timestamps",
        },
        high_level_skill_trace: {
          ordered_skill_sequence: ["navigate", "pick", "place"],
        },
        teleop_demo: {
          demo_artifact_uri: "gs://robot-team/demos/demo.json",
          rights_privacy_attestation: "operator_approved_deidentified",
        },
        sim_controller_plugin: {
          simulator_framework: "fixture",
          plugin_uri: "gs://robot-team/plugins/controller.json",
        },
      },
      source: {
        route: "/sites/sw-chi-01",
        surface: "sites",
      },
    });

    expect(request.schema_version).toBe("robot_eval_job_request.v1");
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
    expect(request.pipeline_trigger).toEqual(
      expect.objectContaining({
        status: "queued_for_pipeline",
        command: "blueprint-run-robot-eval-job",
        default_provisioner: "fixture_local",
        default_simulator: "fixture",
        cpu_pre_gpu_preflight: expect.objectContaining({
          cpu_preflight_scorecard_uri:
            "gs://blueprint/site-packages/sw-chi-01/pipeline/simulation_automation/cpu_preflight_scorecard.json",
          local_cpu_preflight_smoke_ran: false,
          simulator_execution_proven: false,
          robot_readiness_proven: false,
        }),
      }),
    );
    expect(request.proof_boundary).toEqual(
      expect.objectContaining({
        simulator_execution_proven: false,
        robot_readiness_proven: false,
        robot_policy_execution_proven: false,
        physics_contact_validated: false,
        safety_validated: false,
        public_claim_upgrade_allowed: false,
      }),
    );
    expect(validateRobotEvalJobRequest(request).ok).toBe(true);
  });

  it("rejects false-proof upgrades and incomplete policy modality sets", () => {
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
        package_uri: "gs://blueprint/site-packages/sw-chi-01/manifest.json",
        task_thresholds_uri: "gs://blueprint/site-packages/sw-chi-01/task_thresholds.json",
        publication_readiness_uri:
          "gs://blueprint/site-packages/sw-chi-01/publication_readiness.json",
      },
      policy_package: {
        policy_api_endpoint: {},
      },
      proof_boundary: {
        simulator_execution_proven: true,
        robot_readiness_proven: false,
        robot_policy_execution_proven: false,
        physics_contact_validated: false,
        safety_validated: false,
        public_claim_upgrade_allowed: false,
      },
    };

    const validation = validateRobotEvalJobRequest(invalid);

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        "policy_package.docker_container is required",
        "policy_package.recorded_action_trace is required",
        "policy_package.high_level_skill_trace is required",
        "policy_package.teleop_demo is required",
        "policy_package.sim_controller_plugin is required",
        "proof_boundary.simulator_execution_proven must be false until owner-system proof exists",
      ]),
    );
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
});
