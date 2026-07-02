// @vitest-environment node
import express from "express";
import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        get: async () => ({
          exists: name === "robotEvalJobRequests" && state.docs.has(id),
          data: () => state.docs.get(id),
        }),
        set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
          if (name !== "robotEvalJobRequests") return;
          state.docs.set(id, {
            ...(options?.merge ? state.docs.get(id) || {} : {}),
            ...payload,
          });
        },
      }),
    }),
  },
  authAdmin: null,
}));

async function startRoute(): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await import("../routes/robot-eval-job-requests");
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/robot-eval/job-requests", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("server failed to bind");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function signedPipelineRequest(body: Record<string, unknown>, secret = "secret") {
  const rawBody = JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
  return {
    headers: {
      "Content-Type": "application/json",
      "X-Blueprint-Pipeline-Timestamp": timestamp,
      "X-Blueprint-Pipeline-Signature": `sha256=${signature}`,
    },
    body: rawBody,
  };
}

afterEach(() => {
  state.docs.clear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("robot eval job request status routes", () => {
  it("returns buyer-readable job status from the durable store", async () => {
    state.docs.set("job-1", {
      status: "queued_for_pipeline",
      pipeline_status: "staged_for_control_plane",
      created_at_iso: "2026-07-02T00:00:00.000Z",
      proof_boundary: {
        simulator_execution_proven: false,
      },
    });
    const { server, baseUrl } = await startRoute();

    try {
      const response = await fetch(`${baseUrl}/api/robot-eval/job-requests/job-1/status`);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          ok: true,
          job_id: "job-1",
          status: "queued_for_pipeline",
          pipeline_status: "staged_for_control_plane",
          proof_boundary: expect.objectContaining({
            simulator_execution_proven: false,
          }),
        }),
      );
      expect(response.status).toBe(200);
    } finally {
      await stopServer(server);
    }
  });

  it("accepts HMAC-signed pipeline status and result artifact callbacks", async () => {
    vi.stubEnv("PIPELINE_SYNC_TOKEN", "secret");
    vi.stubEnv("PIPELINE_SYNC_ALLOWED_GCS_PREFIXES", "gs://bucket/");
    state.docs.set("job-1", {
      status: "queued_for_pipeline",
      created_at_iso: "2026-07-02T00:00:00.000Z",
    });
    const { server, baseUrl } = await startRoute();
    const signedRequest = signedPipelineRequest({
      job_id: "job-1",
      pipeline_status: "completed",
      result_artifacts: {
        policy_ranking_scorecard_uri: "gs://bucket/results/policy_ranking_scorecard.json",
      },
      proof_boundary: {
        simulator_execution_proven: true,
        physical_robot_deployment_claim_allowed: false,
      },
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/robot-eval/job-requests/job-1/pipeline-status`,
        {
          method: "POST",
          ...signedRequest,
        },
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          ok: true,
          job_id: "job-1",
          status: "completed",
          pipeline_status: "completed",
          result_artifacts: expect.objectContaining({
            policy_ranking_scorecard_uri:
              "gs://bucket/results/policy_ranking_scorecard.json",
          }),
        }),
      );
      expect(state.docs.get("job-1")).toEqual(
        expect.objectContaining({
          status: "completed",
          pipeline_status: "completed",
          updated_at: "SERVER_TIMESTAMP",
          result_artifacts: expect.objectContaining({
            policy_ranking_scorecard_uri:
              "gs://bucket/results/policy_ranking_scorecard.json",
          }),
        }),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("rate limits repeated pipeline status callbacks", async () => {
    vi.stubEnv("PIPELINE_SYNC_TOKEN", "secret");
    vi.stubEnv("PIPELINE_SYNC_ALLOWED_GCS_PREFIXES", "gs://bucket/");
    vi.stubEnv("PIPELINE_SYNC_RATE_LIMIT_MAX", "1");
    vi.stubEnv("PIPELINE_SYNC_RATE_LIMIT_WINDOW_MS", "60000");
    state.docs.set("job-1", {
      status: "queued_for_pipeline",
      created_at_iso: "2026-07-02T00:00:00.000Z",
    });
    const { server, baseUrl } = await startRoute();
    const body = {
      job_id: "job-1",
      pipeline_status: "running",
      result_artifacts: {
        status_manifest_uri: "gs://bucket/results/status.json",
      },
    };

    try {
      const first = await fetch(
        `${baseUrl}/api/robot-eval/job-requests/job-1/pipeline-status`,
        {
          method: "POST",
          ...signedPipelineRequest(body),
        },
      );
      expect(first.status).toBe(200);

      const second = await fetch(
        `${baseUrl}/api/robot-eval/job-requests/job-1/pipeline-status`,
        {
          method: "POST",
          ...signedPipelineRequest(body),
        },
      );
      expect(second.status).toBe(429);
      await expect(second.json()).resolves.toEqual(
        expect.objectContaining({
          code: "pipeline_sync_rate_limited",
        }),
      );
    } finally {
      await stopServer(server);
    }
  });
});
