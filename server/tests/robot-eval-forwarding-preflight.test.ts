// @vitest-environment node
import fs from "node:fs/promises";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  auditRobotEvalForwardingReadiness,
  parseRobotEvalForwardingEnvFile,
  writeRobotEvalForwardingReadinessReport,
} from "../../scripts/pipeline/audit-robot-eval-forwarding-readiness";

type StartedServer = {
  baseUrl: string;
  received: Array<{
    method: string | undefined;
    url: string | undefined;
    authorization: string | undefined;
    signature: string | undefined;
    timestamp: string | undefined;
    nonce: string | undefined;
  }>;
  server: Server;
};

async function startIntakeAuditStub(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<StartedServer> {
  const received: StartedServer["received"] = [];
  const server = createServer((req, res) => {
    received.push({
      method: req.method,
      url: req.url,
      authorization: req.headers.authorization,
      signature: req.headers["x-blueprint-pipeline-signature"] as string | undefined,
      timestamp: req.headers["x-blueprint-pipeline-timestamp"] as string | undefined,
      nonce: req.headers["x-blueprint-pipeline-nonce"] as string | undefined,
    });
    handler(req, res);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server failed to bind");
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    received,
    server,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("robot-eval forwarding readiness preflight", () => {
  it("keeps optional forwarding unconfigured without treating it as a proof gap", async () => {
    const report = await auditRobotEvalForwardingReadiness({
      env: {},
      nowIso: "2026-06-12T00:00:00.000Z",
    });

    expect(report).toEqual(
      expect.objectContaining({
        schema_version: "blueprint.webapp.robot_eval_forwarding_readiness.v1",
        status: "not_configured",
        forwarding_required: false,
        endpoint_configured: false,
        blockers: [],
      }),
    );
    expect(report.proof_boundary).toEqual(
      expect.objectContaining({
        command_is_read_only: true,
        no_job_queued: true,
        no_gpu_allocated: true,
        no_simulator_execution_proven: true,
        no_public_claim_upgrade_allowed: true,
      }),
    );
  });

  it("names both missing env vars when required forwarding is entirely unconfigured", async () => {
    const report = await auditRobotEvalForwardingReadiness({
      env: {},
      requireForwarding: true,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockers).toEqual(
      expect.arrayContaining([
        "missing_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_URL",
        "missing_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN",
      ]),
    );
  });

  it("blocks required forwarding when the endpoint has no bearer token", async () => {
    const report = await auditRobotEvalForwardingReadiness({
      env: {
        ROBOT_EVAL_JOB_REQUEST_FORWARD_URL:
          "https://pipeline.example/api/live-pipeline/job-requests",
        ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED: "true",
      },
    });

    expect(report.status).toBe("blocked");
    expect(report.blockers).toContain("missing_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN");
    expect(report.configured_env.forward_token).toEqual({
      configured: false,
      redacted: true,
    });
  });

  it("parses dotenv-style forwarding env files without leaking token values", async () => {
    const parsed = parseRobotEvalForwardingEnvFile(
      [
        "ROBOT_EVAL_JOB_REQUEST_FORWARD_URL=https://pipeline.example/api/live-pipeline/job-requests",
        'ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN="test-forward-token"',
        "ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED=true",
        "not a valid env line",
      ].join("\n"),
      "test.env",
    );

    const report = await auditRobotEvalForwardingReadiness({
      env: parsed.env,
      warnings: parsed.warnings,
    });

    expect(report.status).toBe("ready_for_required_forwarding");
    expect(report.warnings).toContain("test.env:4:ignored_malformed_env_line");
    expect(report.configured_env.forward_token).toEqual({
      configured: true,
      redacted: true,
    });
    expect(JSON.stringify(report)).not.toContain("test-forward-token");
  });

  it("normalizes copied line-number prefixes before parsing forwarding env files", async () => {
    const parsed = parseRobotEvalForwardingEnvFile(
      [
        "1|1|ROBOT_EVAL_JOB_REQUEST_FORWARD_URL=https://pipeline.example/api/live-pipeline/job-requests",
        '2|2|ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN="test-forward-token"',
        "3|3|ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED=true",
      ].join("\n"),
      "numbered.env",
    );

    const report = await auditRobotEvalForwardingReadiness({
      env: parsed.env,
      warnings: parsed.warnings,
    });

    expect(parsed.warnings).toEqual([]);
    expect(report.status).toBe("ready_for_required_forwarding");
    expect(report.warnings).toContain("capture_root_override_not_configured");
    expect(report.configured_env.forward_token).toEqual({
      configured: true,
      redacted: true,
    });
    expect(JSON.stringify(report)).not.toContain("test-forward-token");
  });

  it("fails closed instead of throwing when an intake probe is requested without config", async () => {
    const report = await auditRobotEvalForwardingReadiness({
      env: {},
      probeIntakeAudit: true,
    });

    expect(report.status).toBe("blocked");
    expect(report.blockers).toContain("missing_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN");
    expect(report.probe).toEqual(
      expect.objectContaining({
        requested: true,
        attempted: false,
        status: "skipped",
      }),
    );
  });

  it("blocks malformed capture-root override maps before a customer request uses them", async () => {
    const report = await auditRobotEvalForwardingReadiness({
      env: {
        ROBOT_EVAL_JOB_REQUEST_FORWARD_URL:
          "https://pipeline.example/api/live-pipeline/job-requests",
        ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN: "test-forward-token",
        ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON: "[]",
      },
    });

    expect(report.status).toBe("blocked");
    expect(report.blockers).toContain(
      "invalid_env_ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON",
    );
    expect(JSON.stringify(report)).not.toContain("test-forward-token");
  });

  it("probes the Pipeline intake audit route with a redacted bearer token", async () => {
    const stub = await startIntakeAuditStub((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          schema_version: "blueprint.live_pipeline_input_intake.v1",
          status: "staged_for_control_plane",
          input_blockers: [],
          webapp_staging: { performed: true },
        }),
      );
    });
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "forwarding-preflight-"));
    const outputPath = path.join(tempDir, "forwarding-preflight.json");

    try {
      const report = await auditRobotEvalForwardingReadiness({
        env: {
          ROBOT_EVAL_JOB_REQUEST_FORWARD_URL: `${stub.baseUrl}/api/live-pipeline/job-requests`,
          ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN: "test-forward-token",
          ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED: "true",
          ROBOT_EVAL_JOB_REQUEST_FORWARD_CAPTURE_ROOT_BY_SITE_JSON:
            '{"sw-chi-01":"/abs/live/capture/root"}',
        },
        probeIntakeAudit: true,
      });
      await writeRobotEvalForwardingReadinessReport(report, outputPath);
      const written = await fs.readFile(outputPath, "utf8");

      expect(report.status).toBe("ready_for_required_forwarding_with_probe");
      expect(report.probe).toEqual(
        expect.objectContaining({
          requested: true,
          attempted: true,
          status: "reachable",
          http_status: 200,
          audit_status: "staged_for_control_plane",
          input_blockers_count: 0,
          webapp_staging_performed: true,
        }),
      );
      expect(stub.received).toEqual([
        expect.objectContaining({
          method: "GET",
          url: "/api/live-pipeline/intake-audit",
          authorization: undefined,
          signature: expect.stringMatching(/^sha256=[a-f0-9]{64}$/),
          timestamp: expect.any(String),
          nonce: expect.any(String),
        }),
      ]);
      expect(JSON.stringify(report)).not.toContain("test-forward-token");
      expect(written).not.toContain("test-forward-token");
    } finally {
      await stopServer(stub.server);
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails closed when the read-only intake audit probe is rejected", async () => {
    const stub = await startIntakeAuditStub((_req, res) => {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ detail: "invalid intake token" }));
    });

    try {
      const report = await auditRobotEvalForwardingReadiness({
        env: {
          ROBOT_EVAL_JOB_REQUEST_FORWARD_URL: `${stub.baseUrl}/api/live-pipeline/job-requests`,
          ROBOT_EVAL_JOB_REQUEST_FORWARD_TOKEN: "test-forward-token",
          ROBOT_EVAL_JOB_REQUEST_FORWARD_REQUIRED: "true",
        },
        probeIntakeAudit: true,
      });

      expect(report.status).toBe("blocked");
      expect(report.blockers).toContain("probe_intake_audit_failed");
      expect(report.probe).toEqual(
        expect.objectContaining({
          requested: true,
          attempted: true,
          status: "failed",
          http_status: 401,
        }),
      );
      expect(JSON.stringify(report)).not.toContain("test-forward-token");
    } finally {
      await stopServer(stub.server);
    }
  });
});
