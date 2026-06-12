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
          safety_validated: false,
          customer_delivery_readiness_proven: false,
          public_claim_upgrade_allowed: false,
        }),
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
