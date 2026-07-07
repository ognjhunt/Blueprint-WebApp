// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { runHeadlessAgentSmoke } from "./headless-hosted-session-smoke";

const originalFetch = global.fetch;
const originalEnv = {
  BLUEPRINT_AGENT_AUTH_TOKEN: process.env.BLUEPRINT_AGENT_AUTH_TOKEN,
  BLUEPRINT_API_BASE_URL: process.env.BLUEPRINT_API_BASE_URL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  REDIS_URL: process.env.REDIS_URL,
};

const state = vi.hoisted(() => {
  const demoPrefix =
    "scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline";
  return {
    authorizationHeaders: [] as Array<string | null>,
    demoPrefix,
    artifactPayloads: new Map<string, Record<string, unknown>>([
      [
        `${demoPrefix}/evaluation_prep/site_world_spec.json`,
        {
          canonical_world_model: {
            render_source: "neoverse_full_capture",
            world_model_backend: "neoverse",
            scene_representation: "capture_backed_demo",
          },
        },
      ],
      [
        `${demoPrefix}/evaluation_prep/site_world_registration.json`,
        {
          site_world_id: "siteworld-f5fd54898cfb",
          runtime_base_url: "http://runtime.local",
          websocket_base_url: "ws://runtime.local",
          primary_runtime_backend: "neoverse",
          runtime_capabilities: {
            supports_step_rollout: true,
            supports_batch_rollout: true,
            supports_camera_views: true,
            supports_stream: false,
          },
        },
      ],
      [
        `${demoPrefix}/evaluation_prep/site_world_health.json`,
        {
          status: "healthy",
          launchable: true,
          blockers: [],
        },
      ],
      [`${demoPrefix}/scene_memory/scene_memory_manifest.json`, { scene_id: "demo-scene" }],
      [`${demoPrefix}/scene_memory/conditioning_bundle.json`, { bundle: "conditioning" }],
      [`${demoPrefix}/presentation_world/presentation_world_manifest.json`, { status: "available" }],
      [`${demoPrefix}/presentation_world/runtime_demo_manifest.json`, {}],
    ]),
  };
});

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => "SERVER_TIMESTAMP",
      },
    },
  },
  dbAdmin: null,
  storageAdmin: {
    bucket: () => ({
      file: (objectPath: string) => ({
        download: async () => {
          const payload = state.artifactPayloads.get(objectPath);
          if (!payload) {
            throw new Error(`Missing local hosted-session fixture: ${objectPath}`);
          }
          return [Buffer.from(JSON.stringify(payload), "utf-8")];
        },
      }),
    }),
  },
  authAdmin: null,
}));

vi.mock("../../server/utils/hosted-session-orchestrator", () => ({
  HostedSessionOrchestratorError: class HostedSessionOrchestratorError extends Error {
    code: string;
    statusCode?: number | null;

    constructor(code: string, message: string, options?: { statusCode?: number | null }) {
      super(message);
      this.code = code;
      this.statusCode = options?.statusCode ?? null;
    }
  },
  createHostedSessionRun: vi.fn(async (params: { sessionId: string }) => ({
    payload: {
      runtime_backend_selected: "neoverse",
      artifact_uris: {
        session_state: `/tmp/hosted/${params.sessionId}/session_state.json`,
      },
      dataset_artifacts: {},
    },
  })),
  controlHostedSessionRun: vi.fn(async () => ({
    control: { mode: "pause", accepted: true },
  })),
  exportHostedSessionRun: vi.fn(async () => ({
    exportId: "export-1",
    artifact_uris: {
      export_manifest: "/tmp/hosted/export_manifest.json",
      raw_bundle: "/tmp/hosted/raw_bundle.json",
    },
    dataset_artifacts: {
      rlds: { manifestUri: "/tmp/hosted/rlds_manifest.json" },
    },
  })),
  fetchHostedSessionExplorerFrame: vi.fn(async () => ({
    statusCode: 200,
    headers: { "content-type": "image/png" },
    body: Buffer.from("explorer-frame"),
  })),
  fetchHostedSessionState: vi.fn(async () => ({
    session_id: "session-1",
    status: "running",
    step_index: 0,
    reward: 0,
    done: false,
    observation: {
      primaryCameraId: "head_rgb",
      worldSnapshot: {
        snapshotId: "snapshot-0",
        status: "running",
        world_state: { step_index: 0 },
      },
    },
  })),
  loadHostedSessionRuntimeMetadata: vi.fn(async () => ({
    site_world_id: "siteworld-f5fd54898cfb",
    build_id: "build-1",
    runtime_base_url: "http://runtime.local",
    websocket_base_url: "ws://runtime.local",
    runtime_capabilities: {
      supports_step_rollout: true,
      supports_batch_rollout: true,
      supports_camera_views: true,
    },
    health_status: "healthy",
    last_heartbeat_at: "2026-05-31T00:00:00Z",
  })),
  mergeHostedEpisodeWithState: vi.fn((episode, runtimeState) => ({
    ...(episode || {}),
    ...(runtimeState || {}),
    episodeId: "episode-1",
    taskId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
    task: "Media room",
    scenarioId: "scenario_default",
    scenario: "default",
    startStateId: "start_default_start_state",
    startState: "default_start_state",
    status: "running",
    stepIndex: Number((runtimeState as Record<string, unknown>)?.step_index || 0),
    observation: {
      primaryCameraId: "head_rgb",
      worldSnapshot: {
        snapshotId: `snapshot-${Number((runtimeState as Record<string, unknown>)?.step_index || 0)}`,
        status: "running",
        world_state: { step_index: Number((runtimeState as Record<string, unknown>)?.step_index || 0) },
      },
    },
    actionTrace: [],
  })),
  persistHostedSessionRuntimeMetadata: vi.fn(async () => undefined),
  reconcileHostedEpisode: vi.fn(async (params: { expectedStepIndex?: number }) => ({
    episodeId: "episode-1",
    taskId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
    task: "Media room",
    scenarioId: "scenario_default",
    scenario: "default",
    startStateId: "start_default_start_state",
    startState: "default_start_state",
    status: params.expectedStepIndex && params.expectedStepIndex > 0 ? "running" : "ready",
    stepIndex: params.expectedStepIndex || 0,
    done: false,
    reward: params.expectedStepIndex && params.expectedStepIndex > 0 ? 0.5 : 0,
    observation: {
      primaryCameraId: "head_rgb",
      worldSnapshot: {
        snapshotId: `snapshot-${params.expectedStepIndex || 0}`,
        status: "running",
        world_state: { step_index: params.expectedStepIndex || 0 },
      },
    },
    actionTrace: params.expectedStepIndex && params.expectedStepIndex > 0 ? [[0.1, 0, 0, 0, 0, 0, 1]] : [],
    observationCameras: [{ id: "head_rgb", role: "head", required: true, available: true }],
  })),
  renderHostedSessionExplorer: vi.fn(async () => ({
    camera_id: "head_rgb",
    pose: { x: 0, y: 0, z: 1.4, yaw: 0, pitch: 0 },
    snapshot_id: "snapshot-render-1",
    grounded_source: "runtime",
    refine_status: "not_requested",
  })),
  resetHostedSessionRun: vi.fn(async () => ({
    episode: {
      episodeId: "episode-1",
      status: "ready",
      stepIndex: 0,
    },
    rawEpisode: {
      episodeId: "episode-1",
      status: "ready",
      stepIndex: 0,
    },
  })),
  runBatchHostedSessionRun: vi.fn(async () => ({
    summary: {
      batchRunId: "batch-1",
      status: "completed",
      numEpisodes: 1,
      numSuccess: 1,
      numFailure: 0,
      successRate: 1,
      commonFailureModes: [],
    },
    artifact_uris: {
      export_manifest: "/tmp/hosted/batch-export.json",
    },
    dataset_artifacts: {},
  })),
  sessionWorkDir: vi.fn((sessionId: string) => `/tmp/hosted/${sessionId}`),
  stepHostedSessionRun: vi.fn(async () => ({
    episode: {
      episodeId: "episode-1",
      status: "running",
      stepIndex: 1,
      reward: 0.5,
    },
    rawEpisode: {
      episodeId: "episode-1",
      status: "running",
      stepIndex: 1,
      reward: 0.5,
    },
  })),
  stopHostedSessionRun: vi.fn(async () => ({ status: "stopped" })),
}));

async function startAgentRouteServer(): Promise<{ server: Server; baseUrl: string }> {
  const [
    siteContentRouter,
    agentAccessRouter,
    siteWorldsRouter,
    siteWorldSessionsModule,
  ] = await Promise.all([
    import("../../server/routes/site-content"),
    import("../../server/routes/agent-access"),
    import("../../server/routes/site-worlds"),
    import("../../server/routes/site-world-sessions"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    state.authorizationHeaders.push(req.get("authorization") || null);
    next();
  });
  app.use("/api/site-content", siteContentRouter.default);
  app.use("/api/agent-access", agentAccessRouter.default);
  app.use("/api/site-worlds", siteWorldsRouter.default);
  app.use("/api/site-worlds/sessions", siteWorldSessionsModule.publicSiteWorldSessionsRouter);
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start route smoke server");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function stopServer(server: Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

describe("headless hosted-session route smoke", () => {
  beforeEach(() => {
    state.authorizationHeaders = [];
    process.env.BLUEPRINT_AGENT_AUTH_TOKEN = "ambient-token-that-public-demo-must-not-use";
    process.env.OPENAI_API_KEY = "";
    delete process.env.REDIS_URL;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "http://runtime.local/v1/site-worlds/siteworld-f5fd54898cfb") {
        return new Response(JSON.stringify({
          canonical_package_uri: `gs://local-blueprint/${state.demoPrefix}/evaluation_prep/site_world_spec.json`,
          canonical_package_version: "local-route-smoke",
          primary_runtime_backend: "neoverse",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "http://runtime.local/v1/site-worlds/siteworld-f5fd54898cfb/health") {
        return new Response(JSON.stringify({
          status: "healthy",
          launchable: true,
          blockers: [],
          world_model_backend: "neoverse",
          render_source: "neoverse_full_capture",
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    }) as typeof global.fetch;
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    const commerce = await import("../../server/utils/robot-agent-commerce");
    commerce.resetAgentDryRunCommerceForTests();
    if (originalEnv.BLUEPRINT_AGENT_AUTH_TOKEN === undefined) delete process.env.BLUEPRINT_AGENT_AUTH_TOKEN;
    else process.env.BLUEPRINT_AGENT_AUTH_TOKEN = originalEnv.BLUEPRINT_AGENT_AUTH_TOKEN;
    if (originalEnv.BLUEPRINT_API_BASE_URL === undefined) delete process.env.BLUEPRINT_API_BASE_URL;
    else process.env.BLUEPRINT_API_BASE_URL = originalEnv.BLUEPRINT_API_BASE_URL;
    if (originalEnv.OPENAI_API_KEY === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    if (originalEnv.REDIS_URL === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalEnv.REDIS_URL;
  });

  it("runs the credentialless public-demo journey through actual Express routes", async () => {
    const { server, baseUrl } = await startAgentRouteServer();
    try {
      process.env.BLUEPRINT_API_BASE_URL = baseUrl;
      const result = await runHeadlessAgentSmoke({
        mode: "public-demo",
        stdout: () => undefined,
      });

      expect(result.ok).toBe(true);
      expect(result.mode).toBe("public-demo");
      expect(result.searchRequestCandidateIntakeOnly).toBe(true);
      expect(result.orderId).toMatch(/^dry-order-/);
      expect(result.entitlementId).toMatch(/^dry-entitlement-/);
      expect(result.sessionId).toBeTruthy();
      expect(result.steps.map((step) => step.name)).toEqual(expect.arrayContaining([
        "discover",
        "agentAccess.manifest",
        "agentAccess.openapi",
        "catalog",
        "siteWorld.search",
        "commerce.quote",
        "commerce.checkoutDryRun",
        "commerce.order",
        "session.launchReadiness",
        "session.create",
        "session.reset",
        "session.step",
        "session.runBatch",
        "session.control",
        "session.explorerRender",
        "session.export",
      ]));
      expect(state.authorizationHeaders.filter(Boolean)).toEqual([]);
    } finally {
      await stopServer(server);
    }
  }, 20_000);
});
