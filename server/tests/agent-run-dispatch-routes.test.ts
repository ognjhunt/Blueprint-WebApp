// @vitest-environment node
/**
 * The two calls that let the Pipeline execute what a team bought.
 *
 * Results and settlement already had Pipeline-signed routes. What was missing
 * was the front of the loop: nothing listed the runs waiting to be executed,
 * and nothing could say one had started. These pin the list (with the
 * checkpoint and scene an executor needs, and nothing a site did not agree to
 * share), the start marker, and that a team can see its run move from queued
 * to running.
 */
import express from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sharedFakeFirestoreState } from "./helpers/fake-firestore";

vi.mock("../../client/src/lib/firebaseAdmin", async () => {
  const { sharedFakeFirestore, FAKE_FIELD_DELETE } = await import("./helpers/fake-firestore");
  return {
    default: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => "SERVER_TIMESTAMP",
          delete: () => FAKE_FIELD_DELETE,
        },
      },
    },
    dbAdmin: sharedFakeFirestore,
    authAdmin: { verifyIdToken: async () => ({ uid: "nobody" }) },
  };
});

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../utils/robotTeamAgentKeys", () => ({
  presentedAgentKey: (headers: Record<string, unknown>) => {
    const raw = String(headers["authorization"] ?? "");
    return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7) : null;
  },
  resolveAgentKey: async (key: string | null) => (key === "bpk_test" ? "team-alpha" : null),
}));

vi.mock("../utils/pipelineSyncSecurity", () => ({
  verifyPipelineSyncRequest: () => ({ ok: true }),
  createPipelineSyncRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) =>
    next(),
}));

const { createRequestedRun } = await import("../utils/agentEvalRuns");

let server: Server;
let baseUrl: string;

beforeEach(async () => {
  sharedFakeFirestoreState.docs.clear();
  const { default: agentTeam } = await import("../routes/agent-team");
  const { default: pipeline } = await import("../routes/internal-agent-run-settlement");
  const app = express();
  app.use(express.json());
  app.use("/api/agent-team", agentTeam);
  app.use("/api/internal/pipeline", pipeline);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;

  sharedFakeFirestoreState.docs.set("robotCheckpoints/ckpt-1", {
    checkpointId: "ckpt-1",
    teamId: "team-alpha",
    label: "v1",
    runtime: "policy_endpoint",
    reference: "https://policies.example/v1",
    status: "registered",
  });
  sharedFakeFirestoreState.docs.set("inboundRequests/req-1", {
    requestId: "req-1",
    contact: { email: "ops@acme.example", firstName: "Dana", company: "Acme" },
    request: { siteName: "Acme Dock 4", targetSiteType: "Warehouse" },
    pipeline: {
      capture_id: "cap-1",
      scene_id: "scene-1",
      artifacts: { worldlabs_world_manifest_uri: "gs://bucket/scene-1/manifest.json" },
    },
    evaluation_readiness: { runtime_launchable: true },
  });
  await createRequestedRun({
    teamId: "team-alpha",
    checkpointId: "ckpt-1",
    sceneId: "req-1",
    taskFamily: "pick_place",
    reservationId: "r1",
    quotedUsd: 25,
    quotedEpisodes: 50,
  });
});

async function json(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  return { status: response.status, body: await response.json() };
}

describe("GET /api/internal/pipeline/agent-runs", () => {
  it("lists queued runs with the checkpoint and scene an executor needs", async () => {
    const { status, body } = await json("/api/internal/pipeline/agent-runs");

    expect(status).toBe(200);
    expect(body.runs).toHaveLength(1);
    const run = body.runs[0];
    expect(run.run_id).toBe("run_r1");
    expect(run.reservation_id).toBe("r1");
    expect(run.team_id).toBe("team-alpha");
    expect(run.quoted_episodes).toBe(50);
    expect(run.dispatch).toBeNull();
    expect(run.checkpoint).toEqual({
      checkpoint_id: "ckpt-1",
      label: "v1",
      runtime: "policy_endpoint",
      reference: "https://policies.example/v1",
    });
    expect(run.scene).toEqual({
      request_id: "req-1",
      capture_id: "cap-1",
      scene_id: "scene-1",
      world_manifest_uri: "gs://bucket/scene-1/manifest.json",
      evaluation_readiness: { runtime_launchable: true },
    });
    // The site's identity is not the executor's business.
    expect(JSON.stringify(body)).not.toContain("Acme");
    expect(JSON.stringify(body)).not.toContain("ops@acme.example");
  });
});

describe("POST /api/internal/pipeline/agent-runs/:runId/started", () => {
  it("claims the run once, removes it from the pending queue, and shows the team it is running", async () => {
    const started = await json("/api/internal/pipeline/agent-runs/run_r1/started", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipeline_run_id: "pipe-1" }),
    });
    expect(started.status).toBe(200);
    expect(started.body.run_id).toBe("run_r1");
    expect(typeof started.body.started_at_iso).toBe("string");

    const listed = await json("/api/internal/pipeline/agent-runs");
    expect(listed.body.runs).toEqual([]);
    const resumed = await json("/api/internal/pipeline/agent-runs/run_r1");
    expect(resumed.body.dispatch).toEqual({ started_at_iso: started.body.started_at_iso, pipeline_run_id: "pipe-1" });
    const conflict = await json("/api/internal/pipeline/agent-runs/run_r1/started", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pipeline_run_id: "pipe-other" }),
    });
    expect(conflict.status).toBe(409);

    const results = await json("/api/agent-team/results", {
      headers: { authorization: "Bearer bpk_test" },
    });
    expect(results.status).toBe(200);
    expect(results.body.runs[0].resultStatus).toBe("awaiting_result");
    expect(results.body.runs[0].dispatch).toEqual({
      startedAtIso: started.body.started_at_iso,
      pipelineRunId: "pipe-1",
    });
  });

  it("refuses an unknown run without granting execution", async () => {
    const { status } = await json("/api/internal/pipeline/agent-runs/run_missing/started", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pipeline_run_id: "owner" }),
    });
    expect(status).toBe(409);
  });
});
