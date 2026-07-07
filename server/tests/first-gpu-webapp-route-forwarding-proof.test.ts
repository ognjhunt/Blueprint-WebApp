// @vitest-environment node
import { execFile as execFileCallback } from "node:child_process";
import express from "express";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);

const servers: http.Server[] = [];

async function listen(server: http.Server) {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("fake Pipeline server did not bind to a port");
  }
  return address.port;
}

async function close(server: http.Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

afterEach(async () => {
  while (servers.length) {
    const server = servers.pop();
    if (server) {
      await close(server);
    }
  }
});

describe("first-GPU WebApp route forwarding proof runner", () => {
  it("posts a non-rehearsal request through the WebApp route and records forwarded Pipeline intake", async () => {
    const received: Record<string, unknown>[] = [];
    const app = express();
    app.use(express.json({ limit: "5mb" }));
    app.post("/api/live-pipeline/job-requests", (req, res) => {
      received.push(req.body);
      res.json({
        schema_version: "blueprint_live_pipeline_intake_service.v1",
        status: "staged_for_control_plane",
        accepted: true,
        input_blockers: [],
        webapp_job_request: {
          status: "ready",
          job_id: req.body.job_id,
          fields_present: {
            site_submission_id: true,
            request_id: true,
            buyer_request_id: true,
            capture_job_id: true,
          },
          missing_fields: [],
          capture_root_matches_control_plane: true,
          blockers: [],
        },
        webapp_staging: {
          status: "staged",
          performed: true,
          blockers: [],
        },
        staged_inputs: {
          status: "staged",
          performed: true,
          blockers: [],
        },
      });
    });
    const server = http.createServer(app);
    servers.push(server);
    const port = await listen(server);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-route-proof-"));
    const captureRoot = path.join(tempDir, "capture-root");
    const outputPath = path.join(tempDir, "proof", "webapp-route-forwarding-proof.json");
    await fs.mkdir(path.join(captureRoot, "pipeline", "robot_eval_dataset"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(captureRoot, "pipeline", "robot_eval_dataset", "task_cards.json"),
      JSON.stringify(
        {
          schema_version: "real_site_robot_eval_task_cards.v0.1",
          task_card_count: 1,
          cards: [
            {
              task_card_id: "task_card_first_gpu_walkthrough_2",
              task_id: "first-gpu-walkthrough-2",
              task_statement: "First GPU humanoid navigation smoke",
            },
          ],
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(captureRoot, "pipeline", "robot_eval_dataset", "scenario_cards.json"),
      JSON.stringify(
        {
          schema_version: "real_site_robot_eval_scenario_cards.v0.1",
          scenario_card_count: 2,
          cards: [
            {
              scenario_card_id: "scenario_card_mobile",
              scenario_id: "scenario_first_gpu_walkthrough_2_mobile_manipulator_rgb_v1",
              task_id: "first-gpu-walkthrough-2",
            },
            {
              scenario_card_id: "scenario_card_humanoid",
              scenario_id: "scenario_first_gpu_walkthrough_2_humanoid_dual_camera_v1",
              task_id: "first-gpu-walkthrough-2",
            },
          ],
        },
        null,
        2,
      ),
    );

    try {
      const { stdout } = await execFile(
        path.join(process.cwd(), "node_modules/.bin/tsx"),
        [
          path.join(
            process.cwd(),
            "scripts/pipeline/run-first-gpu-webapp-route-forwarding-proof.ts",
          ),
          "--capture-root",
          captureRoot,
          "--output",
          outputPath,
          "--forward-url",
          `http://127.0.0.1:${port}/api/live-pipeline/job-requests`,
          "--site-slug",
          "first-gpu-walkthrough-2",
          "--site-submission-id",
          "site-submission-route-proof-20260611",
          "--capture-job-id",
          "capture-job-route-proof-20260611",
          "--capture-id",
          "downloads-walkthrough2-20260611",
          "--buyer-request-id",
          "buyer-request-route-proof-20260611",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN: "test-forward-token",
            GOOGLE_APPLICATION_CREDENTIALS: "",
            FIREBASE_SERVICE_ACCOUNT_JSON: "",
          },
          maxBuffer: 1024 * 1024,
        },
      );

      expect(stdout).toContain("[webapp-route-forwarding-proof] status=forwarded_to_pipeline_intake");
      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(
        expect.objectContaining({
          queue_contract: "robot_eval_job_request_inbox.v1",
          status: "queued_for_pipeline",
          pipeline_consumer: "BlueprintCapturePipeline",
        }),
      );
      const envelope = received[0];
      const forwardedRequest = envelope.job_request as Record<string, unknown>;
      expect(forwardedRequest).toEqual(
        expect.objectContaining({
          schema_version: "robot_eval_job_request.v1",
          source_kind: "webapp_route_forwarding_proof",
          buyer_request_id: "buyer-request-route-proof-20260611",
        }),
      );
      expect(forwardedRequest.requested_tasks).toEqual([
        expect.objectContaining({
          task_id: "first-gpu-walkthrough-2",
          scenario_ids: ["scenario_first_gpu_walkthrough_2_humanoid_dual_camera_v1"],
        }),
      ]);
      expect((forwardedRequest.source as Record<string, unknown>).selection_state).toEqual(
        expect.objectContaining({
          dataset_selection: expect.objectContaining({
            source: "pipeline_robot_eval_dataset_cards",
            taskId: "first-gpu-walkthrough-2",
            scenarioId: "scenario_first_gpu_walkthrough_2_humanoid_dual_camera_v1",
            taskCardCount: 1,
            scenarioCardCount: 2,
          }),
        }),
      );
      expect(forwardedRequest.local_rehearsal_only).not.toBe(true);

      const proof = JSON.parse(await fs.readFile(outputPath, "utf8"));
      expect(proof).toEqual(
        expect.objectContaining({
          schema_version: "blueprint_webapp_route_forwarding_proof.v1",
          status: "forwarded_to_pipeline_intake",
        }),
      );
    expect(proof.webapp_route).toEqual(
      expect.objectContaining({
        local_http_route_exercised: true,
        http_status: 202,
        route_submission_proven: true,
        full_production_webapp_deployment_proven: false,
      }),
    );
    expect(proof.forwarding_endpoint).toEqual(
      expect.objectContaining({
        endpoint_configured: true,
        endpoint_url: `http://127.0.0.1:${port}/api/live-pipeline/job-requests`,
        endpoint_url_source: "local_script_forward_url",
        required: true,
        token_redacted: true,
      }),
    );
    expect(JSON.stringify(proof)).not.toContain("test-forward-token");
      expect(proof.job_request).toEqual(
        expect.objectContaining({
          buyer_request_id: "buyer-request-route-proof-20260611",
          source_kind: "webapp_route_forwarding_proof",
          local_rehearsal_only: false,
        }),
      );
      expect(proof.pipeline_forward).toEqual(
        expect.objectContaining({
          status: "forwarded",
          performed: true,
          accepted: true,
          pipeline_status: "staged_for_control_plane",
        }),
      );
      expect(proof.proof_boundary).toEqual(
        expect.objectContaining({
          local_webapp_route_forwarding_proven: true,
          production_live_webapp_forwarding_proven: false,
          simulator_execution_proven: false,
          robot_policy_execution_proven: false,
          real_robot_pov_evidence_proven: false,
          non_ranking_operational_claim_validated: false,
          customer_delivery_readiness_proven: false,
          public_claim_upgrade_allowed: false,
        }),
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("derives owner-agent IDs and carries World Labs lineage when IDs are omitted", async () => {
    const received: Record<string, unknown>[] = [];
    const app = express();
    app.use(express.json({ limit: "5mb" }));
    app.post("/api/live-pipeline/job-requests", (req, res) => {
      received.push(req.body);
      res.json({
        schema_version: "blueprint_live_pipeline_intake_service.v1",
        status: "staged_for_control_plane",
        accepted: true,
        input_blockers: [],
        webapp_job_request: {
          status: "ready",
          job_id: req.body.job_id,
          fields_present: {
            site_submission_id: true,
            request_id: true,
            buyer_request_id: true,
            capture_job_id: true,
          },
          missing_fields: [],
          capture_root_matches_control_plane: true,
          blockers: [],
        },
        webapp_staging: { status: "staged", performed: true, blockers: [] },
        staged_inputs: { status: "staged", performed: true, blockers: [] },
      });
    });
    const server = http.createServer(app);
    servers.push(server);
    const port = await listen(server);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-agent-route-proof-"));
    const captureRoot = path.join(tempDir, "capture-root");
    const outputPath = path.join(tempDir, "proof", "owner-agent-webapp-route-proof.json");
    await fs.mkdir(path.join(captureRoot, "pipeline", "robot_eval_dataset"), {
      recursive: true,
    });
    await fs.mkdir(path.join(captureRoot, "pipeline"), { recursive: true });
    await fs.writeFile(
      path.join(captureRoot, "capture_descriptor.json"),
      JSON.stringify(
        {
          scene_id: "first-gpu-walkthrough-2",
          capture_id: "downloads-walkthrough2-20260611",
          privacy_status: "full_frame_redacted_local_proof",
          metadata: {
            capture_rights: {
              consent_status: "documented",
              permission_document_uri: "owner://approval/first-gpu-route-proof",
              consent_scope: [
                "isolated_owner_gpu_smoke",
                "mujoco_g1_simulator_evaluation_for_this_staged_capture",
              ],
            },
            worldlabs_input_audit: {
              privacy_safe_input: true,
              raw_video_bypass_used: false,
            },
          },
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(captureRoot, "pipeline", "provider_run_manifest.json"),
      JSON.stringify(
        {
          status: "ready",
          world_id: "97b00832-7418-4d73-b58f-9b72e6b47562",
          worldlabs_launch_url:
            "https://marble.worldlabs.ai/world/97b00832-7418-4d73-b58f-9b72e6b47562",
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(captureRoot, "pipeline", "worldlabs_input_audit.json"),
      JSON.stringify(
        {
          status: "ready",
          privacy_safe_input: true,
          raw_video_bypass_used: false,
          selected_sha256: "privacy-safe-input-sha",
        },
        null,
        2,
      ),
    );
    await fs.writeFile(
      path.join(captureRoot, "pipeline", "robot_eval_dataset", "task_cards.json"),
      JSON.stringify({ cards: [{ task_id: "walk_to_target" }] }, null, 2),
    );
    await fs.writeFile(
      path.join(captureRoot, "pipeline", "robot_eval_dataset", "scenario_cards.json"),
      JSON.stringify(
        {
          cards: [
            {
              scenario_id: "scenario_first_gpu_walkthrough_2_humanoid_dual_camera_v1",
              task_id: "walk_to_target",
            },
          ],
        },
        null,
        2,
      ),
    );

    try {
      const { stdout } = await execFile(
        path.join(process.cwd(), "node_modules/.bin/tsx"),
        [
          path.join(
            process.cwd(),
            "scripts/pipeline/run-first-gpu-webapp-route-forwarding-proof.ts",
          ),
          "--source-kind",
          "owner_agent_codex_request",
          "--capture-root",
          captureRoot,
          "--output",
          outputPath,
          "--forward-url",
          `http://127.0.0.1:${port}/api/live-pipeline/job-requests`,
          "--site-slug",
          "first-gpu-walkthrough-2",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN: "test-forward-token",
            GOOGLE_APPLICATION_CREDENTIALS: "",
            FIREBASE_SERVICE_ACCOUNT_JSON: "",
          },
          maxBuffer: 1024 * 1024,
        },
      );

      expect(stdout).toContain("[webapp-route-forwarding-proof] status=forwarded_to_pipeline_intake");
      expect(received).toHaveLength(1);
      const forwardedRequest = (received[0].job_request as Record<string, unknown>);
      const sitePackage = forwardedRequest.site_package as Record<string, unknown>;
      const rightsPrivacyScope = forwardedRequest.rights_privacy_scope as Record<string, unknown>;
      expect(forwardedRequest.source_kind).toBe("owner_agent_codex_request");
      expect(forwardedRequest.buyer_request_id).toMatch(/^owner-agent-buyer-first-gpu-walkthrough-2-/);
      expect(sitePackage.site_submission_id).toMatch(/^owner-agent-site-first-gpu-walkthrough-2-/);
      expect(sitePackage.capture_job_id).toMatch(/^owner-agent-capture-first-gpu-walkthrough-2-/);
      expect(rightsPrivacyScope).toEqual(
        expect.objectContaining({
          status: "cleared_for_robot_eval",
          external_use_allowed: true,
          source: "capture_descriptor.metadata.capture_rights",
          scope_limited_to_simulator_eval: true,
          public_claim_upgrade_allowed: false,
        }),
      );
      expect(forwardedRequest.world_model_context).toEqual(
        expect.objectContaining({
          world_id: "97b00832-7418-4d73-b58f-9b72e6b47562",
          privacy_safe_input: true,
          raw_video_bypass_used: false,
          advisory_sample_reused: false,
        }),
      );
      const proof = JSON.parse(await fs.readFile(outputPath, "utf8"));
      expect(proof.job_request.source_kind).toBe("owner_agent_codex_request");
      expect(proof.job_request.world_model_context.world_id).toBe(
        "97b00832-7418-4d73-b58f-9b72e6b47562",
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("can post through a remote WebApp URL and record production forwarding proof", async () => {
    const received: Record<string, unknown>[] = [];
    const app = express();
    app.use(express.json({ limit: "5mb" }));
    app.post("/api/robot-eval/job-requests", (req, res) => {
      received.push({
        body: req.body,
        authorization: req.headers.authorization,
      });
      res.status(202).json({
        ok: true,
        pipelineForward: {
          status: "forwarded",
          performed: true,
          endpoint_configured: true,
          required: true,
          accepted: true,
          pipeline_status: "staged_for_control_plane",
          input_blockers: [],
        },
        durableStore: {
          status: "stored",
          performed: true,
          request_id: req.body.job_id,
        },
        pipelineInbox: {
          status: "queued",
          request_id: "pipeline-intake-remote-proof",
        },
      });
    });
    const server = http.createServer(app);
    servers.push(server);
    const port = await listen(server);
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-remote-webapp-proof-"));
    const captureRoot = path.join(tempDir, "capture-root");
    const outputPath = path.join(tempDir, "proof", "remote-webapp-route-proof.json");
    await fs.mkdir(path.join(captureRoot, "pipeline", "robot_eval_dataset"), {
      recursive: true,
    });
    await fs.writeFile(
      path.join(captureRoot, "pipeline", "robot_eval_dataset", "task_cards.json"),
      JSON.stringify({ cards: [{ task_id: "walk_to_target" }] }, null, 2),
    );
    await fs.writeFile(
      path.join(captureRoot, "pipeline", "robot_eval_dataset", "scenario_cards.json"),
      JSON.stringify(
        {
          cards: [
            {
              scenario_id: "scenario_first_gpu_walkthrough_2_humanoid_dual_camera_v1",
              task_id: "walk_to_target",
            },
          ],
        },
        null,
        2,
      ),
    );

    try {
      const { stdout } = await execFile(
        path.join(process.cwd(), "node_modules/.bin/tsx"),
        [
          path.join(
            process.cwd(),
            "scripts/pipeline/run-first-gpu-webapp-route-forwarding-proof.ts",
          ),
          "--capture-root",
          captureRoot,
          "--output",
          outputPath,
          "--webapp-url",
          `http://127.0.0.1:${port}`,
          "--site-slug",
          "first-gpu-walkthrough-2",
          "--source-kind",
          "owner_agent_codex_request",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN: "",
            ROBOT_EVAL_JOB_REQUEST_ROUTE_AUTH_TOKEN: "remote-route-proof-token",
            GOOGLE_APPLICATION_CREDENTIALS: "",
            FIREBASE_SERVICE_ACCOUNT_JSON: "",
          },
          maxBuffer: 1024 * 1024,
        },
      );

      expect(stdout).toContain("[webapp-route-forwarding-proof] status=forwarded_to_pipeline_intake");
      expect(received).toHaveLength(1);
      expect(received[0].authorization).toBe("Bearer remote-route-proof-token");
      const request = received[0].body as Record<string, unknown>;
      expect(request.source_kind).toBe("owner_agent_codex_request");
      const proof = JSON.parse(await fs.readFile(outputPath, "utf8"));
      expect(JSON.stringify(proof)).not.toContain("remote-route-proof-token");
    expect(proof.webapp_route).toEqual(
      expect.objectContaining({
        local_http_route_exercised: false,
        full_production_webapp_deployment_proven: true,
        remote_webapp_url: `http://127.0.0.1:${port}`,
      }),
    );
    expect(proof.forwarding_endpoint).toEqual(
      expect.objectContaining({
        endpoint_configured: true,
        endpoint_url: null,
        endpoint_url_source: "remote_webapp_runtime_not_exposed",
        required: true,
        token_redacted: true,
      }),
    );
      expect(proof.proof_boundary).toEqual(
        expect.objectContaining({
          local_webapp_route_forwarding_proven: false,
          production_live_webapp_forwarding_proven: true,
          pipeline_intake_staged_request_proven: true,
          full_webapp_db_persistence_proven: true,
          simulator_execution_proven: false,
          robot_policy_execution_proven: false,
          real_robot_pov_evidence_proven: false,
          non_ranking_operational_claim_validated: false,
        }),
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
