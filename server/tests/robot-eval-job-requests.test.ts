// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRobotEvalJobRequest,
  forwardRobotEvalJobRequestToPipeline,
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
        "policy_package.policy_api_endpoint.endpoint_url is required",
        "proof_boundary.simulator_execution_proven must be false until owner-system proof exists",
      ]),
    );
  });

  it("accepts one complete robot-team policy modality without requiring the other five", () => {
    const request = {
      schema_version: "robot_eval_job_request.v1",
      job_id: "robot-eval-single-modality",
      buyer_request_id: "buyer-request-single-modality",
      site_package: {
        site_slug: "sw-chi-01",
        site_id: "site-sw-chi-01",
        site_submission_id: "site-submission-sw-chi-01",
        capture_job_id: "capture-job-sw-chi-01",
        capture_id: "capture-sw-chi-01",
        buyer_request_id: "buyer-request-single-modality",
        package_uri: "gs://blueprint/site-packages/sw-chi-01/manifest.json",
        task_thresholds_uri: "gs://blueprint/site-packages/sw-chi-01/task_thresholds.json",
        publication_readiness_uri:
          "gs://blueprint/site-packages/sw-chi-01/publication_readiness.json",
      },
      policy_package: {
        policy_api_endpoint: {
          endpoint_url: "https://robot-team.example/policy",
          observation_schema_ref: "gs://robot-team/schemas/obs.json",
          action_schema_ref: "gs://robot-team/schemas/action.json",
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

    expect(validateRobotEvalJobRequest(request)).toEqual({ ok: true, errors: [] });
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

  it("leaves Pipeline forwarding off when no endpoint is configured", async () => {
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
      required: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
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
          authorization: "Bearer test-forward-token",
        }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
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
