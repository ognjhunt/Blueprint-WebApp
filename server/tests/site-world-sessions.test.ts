// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer } from "http";
import type { Server } from "node:http";

const state = vi.hoisted(() => {
  const hostedSessions = new Map<string, Record<string, unknown>>();
  const userData = { buyerType: "robot_team" };
  const inboundRequestData = {
    pipeline: {
      pipeline_prefix: "scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline",
      artifacts: {
        hosted_session_runtime_manifest_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/evaluation_prep/hosted_session_runtime_manifest.json",
        scene_memory_manifest_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/scene_memory/scene_memory_manifest.json",
        conditioning_bundle_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/scene_memory/conditioning_bundle.json",
        task_anchor_manifest_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/evaluation_prep/task_anchor_manifest.json",
        task_run_manifest_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/evaluation_prep/task_run_manifest.json",
      },
    },
  };
  return { hostedSessions, userData, inboundRequestData };
});

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
      if (name === "users") {
        return {
          doc: () => ({
            get: async () => ({
              exists: true,
              data: () => state.userData,
            }),
          }),
        };
      }
      if (name === "inboundRequests") {
        return {
          where: () => ({
            limit: () => ({
              get: async () => ({
                docs: [
                  {
                    ref: { id: "req-1" },
                    data: () => state.inboundRequestData,
                  },
                ],
              }),
            }),
          }),
        };
      }
      if (name === "hostedSessions") {
        return {
          doc: (id: string) => ({
            set: async (payload: Record<string, unknown>) => {
              state.hostedSessions.set(id, payload);
            },
            update: async (payload: Record<string, unknown>) => {
              state.hostedSessions.set(id, {
                ...(state.hostedSessions.get(id) || {}),
                ...payload,
              });
            },
            get: async () => ({
              exists: state.hostedSessions.has(id),
              data: () => state.hostedSessions.get(id),
            }),
          }),
        };
      }
      throw new Error(`Unexpected collection: ${name}`);
    },
  },
  storageAdmin: null,
  authAdmin: null,
}));

vi.mock("../utils/hosted-session-orchestrator", () => ({
  createHostedSessionRun: vi.fn(async ({ sessionId }: { sessionId: string }) => ({
    payload: {
      runtime_backend_selected: "neoverse",
      artifact_uris: {
        session_state: `/tmp/hosted/${sessionId}/session_state.json`,
      },
    },
  })),
  resetHostedSessionRun: vi.fn(async () => ({
    episode: {
      episodeId: "episode-1",
      taskId: "task-1",
      task: "Walk to shelf staging and pick the blue tote",
      scenario: "Normal lighting",
      startState: "Dock-side tote stack",
      status: "ready",
      stepIndex: 0,
      done: false,
    },
  })),
  stepHostedSessionRun: vi.fn(async () => ({
    episode: {
      episodeId: "episode-1",
      taskId: "task-1",
      task: "Walk to shelf staging and pick the blue tote",
      scenario: "Normal lighting",
      startState: "Dock-side tote stack",
      status: "running",
      stepIndex: 1,
      done: false,
      reward: 0.5,
    },
  })),
  runBatchHostedSessionRun: vi.fn(async () => ({
    summary: {
      batchRunId: "batch-1",
      status: "completed",
      numEpisodes: 4,
      numSuccess: 3,
      numFailure: 1,
      successRate: 0.75,
      commonFailureModes: ["handoff_blocked"],
    },
    artifact_uris: {
      export_manifest: "/tmp/hosted/export_manifest.json",
    },
  })),
  stopHostedSessionRun: vi.fn(async () => ({ sessionId: "session-1", status: "stopped" })),
  exportHostedSessionRun: vi.fn(async () => ({
    exportId: "export-1",
    artifact_uris: {
      export_manifest: "/tmp/hosted/export_manifest.json",
    },
  })),
  sessionWorkDir: vi.fn((sessionId: string) => `/tmp/hosted/${sessionId}`),
}));

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: router } = await import("../routes/site-world-sessions");
  const app = express();
  app.use(express.json());
  app.use((_, res, next) => {
    res.locals.firebaseUser = {
      uid: "user-1",
      email: "robot@example.com",
      admin: false,
    };
    next();
  });
  app.use("/", router);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to bind test server");
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

afterEach(() => {
  state.hostedSessions.clear();
});

describe("site world session routes", () => {
  it("creates a hosted session and returns a workspace URL", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteWorldId: "sw-chi-01",
          robot: "Unitree G1 with head cam and wrist cam",
          policy: { adapter_name: "mock", model_name: "mock-policy" },
          task: "Walk to shelf staging and pick the blue tote",
          scenario: "Normal lighting",
        }),
      });
      expect(response.status).toBe(201);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(payload.status).toBe("ready");
      expect(String(payload.runtimeBackend)).toBe("neoverse");
      expect(String(payload.workspaceUrl)).toContain("/site-worlds/sw-chi-01/workspace?sessionId=");
    } finally {
      await stopServer(server);
    }
  });

  it("resets and steps a stored hosted session", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const create = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteWorldId: "sw-chi-01",
          robot: "Unitree G1 with head cam and wrist cam",
          policy: { adapter_name: "mock", model_name: "mock-policy" },
          task: "Walk to shelf staging and pick the blue tote",
          scenario: "Normal lighting",
        }),
      });
      const created = (await create.json()) as { sessionId: string };

      const reset = await fetch(`${baseUrl}/${created.sessionId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(reset.status).toBe(200);
      const resetPayload = (await reset.json()) as Record<string, unknown>;
      expect((resetPayload.episode as Record<string, unknown>).episodeId).toBe("episode-1");

      const step = await fetch(`${baseUrl}/${created.sessionId}/step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ episodeId: "episode-1" }),
      });
      expect(step.status).toBe(200);
      const stepPayload = (await step.json()) as Record<string, unknown>;
      expect((stepPayload.episode as Record<string, unknown>).stepIndex).toBe(1);
    } finally {
      await stopServer(server);
    }
  });
});
