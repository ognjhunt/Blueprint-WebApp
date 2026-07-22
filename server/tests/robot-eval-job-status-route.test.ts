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
    collection: (name: string) => {
      const matchingDocs = (field: string, value: unknown) =>
        [...state.docs.entries()]
          .filter(([, data]) => name === "robotEvalJobRequests" && data[field] === value)
          .map(([id, data]) => ({ id, data: () => data }));
      return {
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
        where: (field: string, _operator: string, value: unknown) => ({
          limit: (limit: number) => ({
            get: async () => ({ docs: matchingDocs(field, value).slice(0, limit) }),
          }),
        }),
      };
    },
  },
  // WEB-02: verifyFirebaseToken needs authAdmin. Treat the Bearer token as the uid;
  // "invalid" throws (rejected token). admin uid grants the admin bypass.
  authAdmin: {
    verifyIdToken: async (token: string) => {
      if (token === "invalid") throw new Error("invalid token");
      return { uid: token, admin: token === "admin-user" };
    },
  },
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

function plannedBenchmarkProjection() {
  const visibilityCounts = { seen: 1, unseen: 1 };
  return {
    schema_version: "blueprint_webapp_benchmark_projection.v1",
    benchmark_id: "blueprint-drawer",
    benchmark_version: "2026.1",
    benchmark_card_sha256: "a".repeat(64),
    status: "planned",
    split_summary: {
      counts: { train: 1, dev: 1, public_test: 1, hidden_test: 1 },
      generalization_counts: {
        task: visibilityCounts,
        scene: visibilityCounts,
        object: visibilityCounts,
        camera: visibilityCounts,
        lighting: visibilityCounts,
        embodiment: visibilityCounts,
      },
      hidden_test_identifiers_redacted: true,
      hidden_test_content_digest_committed: true,
    },
    rollout_protocol: {
      fixed_rollouts_per_scenario_policy: 20,
      cherry_picking_prohibited: true,
      result_replacement_prohibited: true,
      infrastructure_retries_scored_as_new_attempts: true,
    },
    scoring: {
      metrics: [
        "full_task_success",
        "partial_progress",
        "efficiency",
        "safety_interventions",
        "evaluator_abstention",
      ],
      confidence_intervals_required: true,
      bootstrap_replicates: 10_000,
    },
    policy_aggregates: [],
    breakdowns: { split: {}, generalization: {} },
    external_rank_fidelity: null,
    hidden_scenario_identifiers_included: false,
    claim_boundary: {
      owner_system_artifacts_required: true,
      different_site_comparison_is_not_site_specific_validation: true,
      public_claim_upgrade_allowed: false,
    },
  };
}

afterEach(() => {
  state.docs.clear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("robot eval job request status routes", () => {
  it("lists only the authenticated buyer's persisted runs in recency order", async () => {
    state.docs.set("older-run", {
      status: "queued_for_pipeline",
      buyer_user_id: "buyer-1",
      buyer_request_id: "request-older",
      site_slug: "owned-site",
      created_at_iso: "2026-07-01T00:00:00.000Z",
      jobRequest: {
        site_package: { site_name: "Owned site" },
        requested_tasks: [{ task_id: "task-1", label: "Inspect aisle" }],
      },
    });
    state.docs.set("newer-run", {
      status: "completed",
      buyer_user_id: "buyer-1",
      updated_at_iso: "2026-07-03T00:00:00.000Z",
    });
    state.docs.set("another-buyers-run", {
      status: "completed",
      buyer_user_id: "buyer-2",
      updated_at_iso: "2026-07-04T00:00:00.000Z",
    });
    const { server, baseUrl } = await startRoute();

    try {
      const response = await fetch(`${baseUrl}/api/robot-eval/job-requests`, {
        headers: { Authorization: "Bearer buyer-1" },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        count: 2,
        job_requests: [
          expect.objectContaining({ job_id: "newer-run", status: "completed" }),
          expect.objectContaining({
            job_id: "older-run",
            site_slug: "owned-site",
            status: "queued_for_pipeline",
          }),
        ],
      });
    } finally {
      await stopServer(server);
    }
  });

  it("returns job status to the owning buyer (authenticated)", async () => {
    state.docs.set("job-1", {
      status: "queued_for_pipeline",
      pipeline_status: "staged_for_control_plane",
      buyer_user_id: "buyer-1",
      created_at_iso: "2026-07-02T00:00:00.000Z",
      proof_boundary: {
        simulator_execution_proven: false,
      },
    });
    const { server, baseUrl } = await startRoute();

    try {
      const response = await fetch(`${baseUrl}/api/robot-eval/job-requests/job-1/status`, {
        headers: { Authorization: "Bearer buyer-1" },
      });
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

  it("WEB-02: rejects an unauthenticated status request (401)", async () => {
    state.docs.set("job-1", { status: "queued_for_pipeline", buyer_user_id: "buyer-1" });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/robot-eval/job-requests/job-1/status`);
      expect(response.status).toBe(401);
    } finally {
      await stopServer(server);
    }
  });

  it("WEB-02: forbids a non-owner buyer from reading another buyer's job (403)", async () => {
    state.docs.set("job-1", {
      status: "queued_for_pipeline",
      buyer_user_id: "buyer-1",
      result_artifacts: { policy_ranking_scorecard_uri: "gs://bucket/secret.json" },
    });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/robot-eval/job-requests/job-1/status`, {
        headers: { Authorization: "Bearer buyer-2" },
      });
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ code: "robot_eval_job_forbidden" }),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("WEB-02: allows an admin to read any job", async () => {
    state.docs.set("job-1", { status: "queued_for_pipeline", buyer_user_id: "buyer-1" });
    const { server, baseUrl } = await startRoute();
    try {
      const response = await fetch(`${baseUrl}/api/robot-eval/job-requests/job-1/status`, {
        headers: { Authorization: "Bearer admin-user" },
      });
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

  it("stores and returns only the validated benchmark projection", async () => {
    vi.stubEnv("PIPELINE_SYNC_TOKEN", "secret");
    vi.stubEnv("PIPELINE_SYNC_ALLOWED_GCS_PREFIXES", "gs://bucket/");
    state.docs.set("job-1", { status: "queued_for_pipeline" });
    const { server, baseUrl } = await startRoute();
    const benchmarkProjection = plannedBenchmarkProjection();
    const signedRequest = signedPipelineRequest({
      job_id: "job-1",
      pipeline_status: "running",
      benchmark_projection: benchmarkProjection,
      internal_debug_payload: { policy_api_token: "must-not-be-persisted" },
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/robot-eval/job-requests/job-1/pipeline-status`,
        { method: "POST", ...signedRequest },
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ benchmark: benchmarkProjection }),
      );
      expect(state.docs.get("job-1")).toEqual(
        expect.objectContaining({ benchmark_projection: benchmarkProjection }),
      );
      expect(state.docs.get("job-1")?.pipeline_result).not.toEqual(
        expect.objectContaining({ internal_debug_payload: expect.anything() }),
      );
    } finally {
      await stopServer(server);
    }
  });

  it("rejects benchmark projections containing hidden scenario material", async () => {
    vi.stubEnv("PIPELINE_SYNC_TOKEN", "secret");
    state.docs.set("job-1", { status: "queued_for_pipeline" });
    const { server, baseUrl } = await startRoute();
    const signedRequest = signedPipelineRequest({
      job_id: "job-1",
      pipeline_status: "running",
      benchmark_projection: {
        ...plannedBenchmarkProjection(),
        hidden_scenario_ids: ["secret-scenario"],
      },
    });

    try {
      const response = await fetch(
        `${baseUrl}/api/robot-eval/job-requests/job-1/pipeline-status`,
        { method: "POST", ...signedRequest },
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ code: "invalid_benchmark_projection" }),
      );
      expect(state.docs.get("job-1")).toEqual({ status: "queued_for_pipeline" });
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
