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
        site_world_spec_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/evaluation_prep/site_world_spec.json",
        site_world_registration_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/evaluation_prep/site_world_registration.json",
        site_world_health_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/evaluation_prep/site_world_health.json",
        scene_memory_manifest_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/scene_memory/scene_memory_manifest.json",
        conditioning_bundle_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/scene_memory/conditioning_bundle.json",
        preview_simulation_manifest_uri:
          "gs://bucket/scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline/presentation/preview_simulation_manifest.json",
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
          orderBy: () => ({
            limit: () => ({
              get: async () => ({
                docs: [],
              }),
            }),
          }),
        };
      }
      if (name === "hostedSessions") {
        const applyFilters = (entries: Array<[string, Record<string, unknown>]>, filters: Array<{ field: string; value: unknown }>) =>
          entries.filter(([, payload]) =>
            filters.every(({ field, value }) => {
              const actual = field.split(".").reduce<unknown>((acc, part) => {
                if (!acc || typeof acc !== "object") return undefined;
                return (acc as Record<string, unknown>)[part];
              }, payload);
              return actual === value;
            }),
          );
        const buildQuery = (filters: Array<{ field: string; value: unknown }>) => ({
          where: (field: string, _operator: string, value: unknown) => buildQuery([...filters, { field, value }]),
          limit: (count: number) => ({
            get: async () => ({
              docs: applyFilters(Array.from(state.hostedSessions.entries()), filters)
                .slice(0, count)
                .map(([id, payload]) => ({
                  ref: { id },
                  data: () => payload,
                })),
            }),
          }),
        });
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
          where: (field: string, _operator: string, value: unknown) => buildQuery([{ field, value }]),
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
      dataset_artifacts: {},
    },
  })),
  loadHostedSessionRuntimeMetadata: vi.fn(async () => ({
    site_world_id: "siteworld-1",
    build_id: "build-1",
    runtime_base_url: "http://runtime.local",
    websocket_base_url: "ws://runtime.local",
    vm_instance_id: "vast-123",
    runtime_capabilities: {
      supports_step_rollout: true,
      supports_batch_rollout: true,
      supports_camera_views: true,
    },
    health_status: "healthy",
    last_heartbeat_at: "2026-03-12T00:00:00Z",
  })),
  resetHostedSessionRun: vi.fn(async () => ({
    episode: {
      episodeId: "episode-1",
      taskId: "sw-chi-01-task-1",
      task: "Walk to shelf staging and pick the blue tote",
      scenarioId: "sw-chi-01-scenario-1",
      scenario: "Normal lighting",
      startStateId: "sw-chi-01-start-1",
      startState: "Dock-side tote stack",
      status: "ready",
      stepIndex: 0,
      done: false,
      observation: {
        frame_path: "/tmp/hosted/episode-1/head_rgb/frame_000.png",
      },
      observationCameras: [
        { id: "head_rgb", role: "head", required: true, available: true },
        { id: "wrist_rgb", role: "wrist", required: false, available: false },
      ],
      actionTrace: [],
    },
  })),
  stepHostedSessionRun: vi.fn(async () => ({
    episode: {
      episodeId: "episode-1",
      taskId: "sw-chi-01-task-1",
      task: "Walk to shelf staging and pick the blue tote",
      scenarioId: "sw-chi-01-scenario-1",
      scenario: "Normal lighting",
      startStateId: "sw-chi-01-start-1",
      startState: "Dock-side tote stack",
      status: "running",
      stepIndex: 1,
      done: false,
      reward: 0.5,
      observation: {
        frame_path: "/tmp/hosted/episode-1/head_rgb/frame_001.png",
      },
      observationCameras: [
        { id: "head_rgb", role: "head", required: true, available: true },
      ],
      actionTrace: [[0.1, 0, 0, 0, 0, 0, 1]],
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
    dataset_artifacts: {
      rlds: {
        manifestUri: "/tmp/hosted/rlds_manifest.json",
      },
    },
  })),
  stopHostedSessionRun: vi.fn(async () => ({ sessionId: "session-1", status: "stopped" })),
  exportHostedSessionRun: vi.fn(async () => ({
    exportId: "export-1",
    artifact_uris: {
      export_manifest: "/tmp/hosted/export_manifest.json",
      raw_bundle: "/tmp/hosted/raw_bundle.json",
      rlds_dataset: "/tmp/hosted/rlds_manifest.json",
    },
    dataset_artifacts: {
      rlds: {
        manifestUri: "/tmp/hosted/rlds_manifest.json",
      },
    },
  })),
  sessionWorkDir: vi.fn((sessionId: string) => `/tmp/hosted/${sessionId}`),
}));

vi.mock("../utils/presentation-demo-runtime", () => ({
  launchPresentationDemoRuntime: vi.fn(async ({ sessionId, proxyPath }: { sessionId: string; proxyPath: string }) => ({
    provider: "vast",
    status: "live",
    uiBaseUrl: process.env.TEST_PRESENTATION_UI_BASE_URL || "https://neoverse.example/demo",
    proxyPath,
    instanceId: `vast-${sessionId}`,
    startedAt: "2026-03-12T00:00:00Z",
    expiresAt: "2026-03-12T02:00:00Z",
    errorCode: null,
    errorMessage: null,
  })),
  stopPresentationDemoRuntime: vi.fn(async ({ sessionId }: { sessionId: string }) => ({
    provider: "vast",
    status: "stopped",
    instanceId: `vast-${sessionId}`,
  })),
  PresentationDemoRuntimeError: class PresentationDemoRuntimeError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

async function startServer(): Promise<{ server: Server; baseUrl: string }> {
  const { default: router, publicSiteWorldSessionsRouter } = await import("../routes/site-world-sessions");
  const app = express();
  app.use(express.json());
  app.get(["/upstream-demo", "/upstream-demo/"], (_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.setHeader("X-Frame-Options", "DENY");
    res.send("<html>proxied demo</html>");
  });
  app.use((_, res, next) => {
    res.locals.firebaseUser = {
      uid: "user-1",
      email: "robot@example.com",
      admin: false,
    };
    next();
  });
  app.use("/", publicSiteWorldSessionsRouter);
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

afterEach(async () => {
  state.hostedSessions.clear();
  const { resetHostedSessionRouteState } = await import("../routes/site-world-sessions");
  resetHostedSessionRouteState();
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
          robotProfileId: "other_sample",
          taskId: "sw-chi-01-task-1",
          scenarioId: "sw-chi-01-scenario-1",
          startStateId: "sw-chi-01-start-1",
          requestedOutputs: ["observation_frames", "action_trace", "export_bundle"],
          exportModes: ["raw_bundle", "rlds_dataset"],
        }),
      });
      const payload = (await response.json()) as Record<string, unknown>;
      if (response.status !== 201) {
        throw new Error(JSON.stringify(payload));
      }
      expect(response.status).toBe(201);
      expect(payload.status).toBe("ready");
      expect(String(payload.runtimeBackend)).toBe("neoverse");
      expect(String(payload.workspaceUrl)).toContain("/site-worlds/sw-chi-01/workspace?sessionId=");
      expect(state.hostedSessions.size).toBe(1);
      const stored = state.hostedSessions.get(String(payload.sessionId)) as Record<string, unknown>;
      expect((stored.siteModel as Record<string, unknown>).sceneId).toBe("scene-harborview-grocery-annex");
      expect((stored.robotProfile as Record<string, unknown>).displayName).toBe(
        "Unitree G1 with head cam and wrist cam",
      );
      expect((stored.runtimeConfig as Record<string, unknown>).startStateId).toBe("sw-chi-01-start-1");
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
          robotProfileId: "other_sample",
          taskId: "sw-chi-01-task-1",
          scenarioId: "sw-chi-01-scenario-1",
          startStateId: "sw-chi-01-start-1",
          requestedOutputs: ["observation_frames", "action_trace"],
          exportModes: ["raw_bundle", "rlds_dataset"],
        }),
      });
      const createPayload = (await create.json()) as Record<string, unknown>;
      if (create.status !== 201) {
        throw new Error(JSON.stringify(createPayload));
      }
      expect(create.status).toBe(201);
      const created = createPayload as { sessionId: string };
      expect(created.sessionId).toBeTruthy();

      const reset = await fetch(`${baseUrl}/${created.sessionId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(reset.status).toBe(200);
      const resetPayload = (await reset.json()) as Record<string, unknown>;
      expect((resetPayload.episode as Record<string, unknown>).episodeId).toBe("episode-1");
      expect((resetPayload.episode as Record<string, unknown>).startState).toBe("Dock-side tote stack");

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

  it("creates and reuses a presentation demo session", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const requestBody = {
        siteWorldId: "sw-chi-01",
        sessionMode: "presentation_demo",
        runtimeUi: "neoverse_gradio",
        robotProfileId: "other_sample",
        taskId: "sw-chi-01-task-1",
        scenarioId: "sw-chi-01-scenario-1",
        startStateId: "sw-chi-01-start-1",
      };
      const create = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const createPayload = (await create.json()) as Record<string, unknown>;
      expect(create.status).toBe(201);
      expect(createPayload.status).toBe("creating");
      expect(createPayload.uiReady).toBe(false);
      expect(createPayload.uiMode).toBe("embedded");

      const reuse = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const reusePayload = (await reuse.json()) as Record<string, unknown>;
      expect([200, 201]).toContain(reuse.status);
      expect(String(reusePayload.workspaceUrl || "")).toContain("/site-worlds/sw-chi-01/workspace?sessionId=");
    } finally {
      await stopServer(server);
    }
  });

  it("blocks runtime-only controls on presentation demo sessions and stops them", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const create = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteWorldId: "sw-chi-01",
          sessionMode: "presentation_demo",
          runtimeUi: "neoverse_gradio",
          robotProfileId: "other_sample",
          taskId: "sw-chi-01-task-1",
          scenarioId: "sw-chi-01-scenario-1",
          startStateId: "sw-chi-01-start-1",
        }),
      });
      const createPayload = (await create.json()) as { sessionId: string };
      expect(create.status).toBe(201);

      const reset = await fetch(`${baseUrl}/${createPayload.sessionId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const resetPayload = (await reset.json()) as Record<string, unknown>;
      expect(reset.status).toBe(409);
      expect(resetPayload.code).toBe("session_mode_unsupported");

      const stop = await fetch(`${baseUrl}/${createPayload.sessionId}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const stopPayload = (await stop.json()) as Record<string, unknown>;
      expect(stop.status).toBe(200);
      expect(stopPayload.status).toBe("stopped");
    } finally {
      await stopServer(server);
    }
  });

  it("reports launch readiness blockers when the presentation package is missing", async () => {
    const originalArtifacts = state.inboundRequestData.pipeline.artifacts;
    state.inboundRequestData.pipeline.artifacts = {
      ...originalArtifacts,
      preview_simulation_manifest_uri: null,
      presentation_world_manifest_uri: null,
    };
    const { server, baseUrl } = await startServer();
    try {
      const response = await fetch(`${baseUrl}/launch-readiness?siteWorldId=sw-chi-01`);
      const payload = (await response.json()) as Record<string, unknown>;
      expect(response.status).toBe(200);
      expect(payload.launchable).toBe(false);
      expect(payload.blockers).toContain("missing presentation package");
    } finally {
      state.inboundRequestData.pipeline.artifacts = originalArtifacts;
      await stopServer(server);
    }
  });

  it("bootstraps UI access and proxies the embedded UI without frame headers", async () => {
    const { server, baseUrl } = await startServer();
    const originalBaseUrl = process.env.TEST_PRESENTATION_UI_BASE_URL;
    process.env.TEST_PRESENTATION_UI_BASE_URL = `${baseUrl}/upstream-demo`;
    try {
      const create = await fetch(`${baseUrl}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteWorldId: "sw-chi-01",
          sessionMode: "presentation_demo",
          runtimeUi: "neoverse_gradio",
          robotProfileId: "other_sample",
          taskId: "sw-chi-01-task-1",
          scenarioId: "sw-chi-01-scenario-1",
          startStateId: "sw-chi-01-start-1",
        }),
      });
      const createPayload = (await create.json()) as { sessionId: string };
      expect(create.status).toBe(201);

      await new Promise((resolve) => setTimeout(resolve, 0));

      const uiAccess = await fetch(`${baseUrl}/${createPayload.sessionId}/ui-access`);
      const uiAccessPayload = (await uiAccess.json()) as { bootstrapUrl: string };
      expect(uiAccess.status).toBe(200);

      const invalidBootstrap = await fetch(
        `${baseUrl}/${createPayload.sessionId}/ui/bootstrap?token=bad-token`,
        { redirect: "manual" },
      );
      expect(invalidBootstrap.status).toBe(401);

      const bootstrapPath = uiAccessPayload.bootstrapUrl.replace("/api/site-worlds/sessions", "");
      const bootstrap = await fetch(`${baseUrl}${bootstrapPath}`, { redirect: "manual" });
      expect(bootstrap.status).toBe(302);
      const cookie = bootstrap.headers.get("set-cookie");
      expect(cookie).toContain("bp_hosted_session_ui=");

      const proxied = await fetch(`${baseUrl}/${createPayload.sessionId}/ui`, {
        headers: { Cookie: String(cookie) },
      });
      expect(proxied.status).toBe(200);
      expect(proxied.headers.get("x-frame-options")).toBeNull();
      expect(await proxied.text()).toContain("proxied demo");
    } finally {
      if (originalBaseUrl == null) {
        delete process.env.TEST_PRESENTATION_UI_BASE_URL;
      } else {
        process.env.TEST_PRESENTATION_UI_BASE_URL = originalBaseUrl;
      }
      await stopServer(server);
    }
  });
});
