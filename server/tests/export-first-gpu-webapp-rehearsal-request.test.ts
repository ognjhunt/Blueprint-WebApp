// @vitest-environment node
import { execFile as execFileCallback } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFile = promisify(execFileCallback);

describe("first-GPU WebApp rehearsal request exporter", () => {
  it("exports a Pipeline queue envelope without turning rehearsal into live proof", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "blueprint-webapp-rehearsal-"));
    const captureRoot = path.join(tempDir, "capture-root");
    const outputPath = path.join(tempDir, "out", "webapp-job-request.json");

    try {
      const { stdout } = await execFile(
        path.join(process.cwd(), "node_modules/.bin/tsx"),
        [
          path.join(process.cwd(), "scripts/pipeline/export-first-gpu-webapp-rehearsal-request.ts"),
          "--capture-root",
          captureRoot,
          "--output",
          outputPath,
          "--site-slug",
          "first-gpu-site",
          "--site-submission-id",
          "site-submission-first-gpu",
          "--capture-job-id",
          "capture-job-first-gpu",
          "--capture-id",
          "capture-first-gpu",
          "--buyer-request-id",
          "buyer-request-first-gpu",
        ],
        { cwd: process.cwd(), maxBuffer: 1024 * 1024 },
      );

      expect(stdout).toContain("[webapp-rehearsal-request] output=");
      expect(stdout).toContain("[webapp-rehearsal-request] job_id=");

      const envelope = JSON.parse(await fs.readFile(outputPath, "utf8"));
      expect(envelope).toEqual(
        expect.objectContaining({
          queue_contract: "robot_eval_job_request_inbox.v1",
          source_kind: "local_first_gpu_rehearsal_request",
          local_rehearsal_only: true,
          status: "queued_for_pipeline_local_rehearsal",
          pipeline_command: "blueprint-run-robot-eval-job",
          pipeline_consumer: "BlueprintCapturePipeline",
        }),
      );
      expect(envelope.proof_boundary).toEqual(
        expect.objectContaining({
          local_rehearsal_only: true,
          webapp_request_built_by_webapp_code: true,
          webapp_route_submission_proven: false,
          live_webapp_forwarding_proven: false,
          simulator_execution_proven: false,
          robot_policy_execution_proven: false,
          rank_fidelity_result_proven: false,
          public_claim_upgrade_allowed: false,
        }),
      );

      const request = envelope.job_request;
      expect(request).toEqual(
        expect.objectContaining({
          schema_version: "robot_eval_job_request.v1",
          source_kind: "local_first_gpu_rehearsal_request",
          local_rehearsal_only: true,
          buyer_request_id: "buyer-request-first-gpu",
        }),
      );
      expect(request.owner_system).toEqual(
        expect.objectContaining({
          site_submission_id: "site-submission-first-gpu",
          capture_job_id: "capture-job-first-gpu",
          capture_id: "capture-first-gpu",
        }),
      );
      expect(request.site_package).toEqual(
        expect.objectContaining({
          site_submission_id: "site-submission-first-gpu",
          capture_job_id: "capture-job-first-gpu",
          capture_id: "capture-first-gpu",
          access_state: "local_rehearsal_only",
        }),
      );
      expect(request.execution_request).toEqual(
        expect.objectContaining({
          webapp_role: "queue_and_forward_only",
          scheduler_owner: "BlueprintCapturePipeline",
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
              "job_run_manifest",
            ]),
            startup_artifacts_are_advisory_until_owner_runtime_proof: true,
            simulator_execution_proven_by_webapp: false,
            public_claim_upgrade_allowed: false,
          }),
        }),
      );
      expect(request.proof_boundary).toEqual(
        expect.objectContaining({
          local_rehearsal_only: true,
          webapp_request_built_by_webapp_code: true,
          webapp_route_submission_proven: false,
          live_webapp_forwarding_proven: false,
          simulator_execution_proven: false,
          rank_fidelity_result_proven: false,
          public_claim_upgrade_allowed: false,
        }),
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
