import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HostedSessionWorkspace from "@/pages/HostedSessionWorkspace";
import { getSiteWorldById } from "@/data/siteWorlds";

let mockSearch = "";
const originalCreateObjectURL = globalThis.URL.createObjectURL;
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () => mockSearch,
    useLocation: () => ["/site-worlds/siteworld-f5fd54898cfb/workspace", vi.fn()],
  };
});

vi.mock("@/lib/siteWorldsApi", () => ({
  fetchSiteWorldDetail: vi.fn(async (siteWorldId: string) => getSiteWorldById(siteWorldId)),
}));

vi.mock("@/lib/csrf", () => ({
  withCsrfHeader: vi.fn(async (headers: Record<string, string>) => headers),
}));

vi.mock("@/lib/firebase", () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn(async () => "token-1"),
    },
  },
}));

vi.mock("@/components/site/SiteWorldCanonicalViewer", () => ({
  SiteWorldCanonicalViewer: ({ selectedObjectId }: { selectedObjectId?: string | null }) => (
    <div data-testid="canonical-viewer">canonical-viewer:{selectedObjectId || "none"}</div>
  ),
}));

function buildRuntimeSession(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "session-1",
    sessionMode: "runtime_only",
    runtime_backend_selected: "neoverse",
    status: "ready",
    site: {
      siteWorldId: "siteworld-f5fd54898cfb",
      siteName: "Media Room Demo Walkthrough",
      siteAddress: "Blueprint hosted runtime demo",
      scene_id: "9483414B-8776-4F68-AC80-D3B3BA774A90",
      capture_id: "6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3",
      site_submission_id: "9483414B-8776-4F68-AC80-D3B3BA774A90:6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3",
      pipeline_prefix:
        "scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline",
    },
    siteModel: {
      siteWorldId: "siteworld-f5fd54898cfb",
      siteName: "Media Room Demo Walkthrough",
      siteAddress: "Blueprint hosted runtime demo",
      sceneId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
      captureId: "6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3",
      pipelinePrefix:
        "scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline",
      siteWorldSpecUri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_spec.json",
      siteWorldRegistrationUri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_registration.json",
      siteWorldHealthUri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_health.json",
      runtimeBaseUrl: "http://146.115.17.157:45457",
      websocketBaseUrl: "ws://146.115.17.157:45457",
      sceneMemoryManifestUri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/scene_memory/scene_memory_manifest.json",
      conditioningBundleUri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/scene_memory/conditioning_bundle.json",
      presentationWorldManifestUri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/presentation_world/presentation_world_manifest.json",
      runtimeDemoManifestUri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/presentation_world/runtime_demo_manifest.json",
      artifactExplorer: {
        status: "ready",
        headline: "Canonical site-world object geometry",
        summary: "Explore the site-specific canonical world model through object geometry reconstructed from the capture pipeline.",
        derivationMode: "grounded object geometry",
        canonicalPackageVersion: null,
        presentationStatus: "secondary derived overlays available",
        sceneKind: "canonical_object_geometry",
        sceneModelUrl: null,
        sceneModelFormat: "object_bundle",
        views: [],
        objects: [
          {
            id: "cabinet_0023",
            label: "cabinet",
            taskRole: "task_anchor",
            taskCritical: true,
            groundingLevel: "grounded",
            meshUrl: "/api/site-worlds/siteworld-f5fd54898cfb/explorer-asset?path=object_geometry%2Fobj_cabinet_0023%2Fmesh.glb",
            previewImageUrl: "/api/site-worlds/siteworld-f5fd54898cfb/explorer-asset?path=object_geometry%2Fobj_cabinet_0023%2Fviews%2Fsynthetic_view_05.png",
            selectedViewUrls: [
              "/api/site-worlds/siteworld-f5fd54898cfb/explorer-asset?path=object_geometry%2Fobj_cabinet_0023%2Fviews%2Fsynthetic_view_05.png",
            ],
            center: [0, 1.2, 0],
            extents: [0.6, 0.9, 0.3],
          },
          {
            id: "container_0002",
            label: "basket",
            taskRole: "context_object",
            taskCritical: false,
            groundingLevel: "synthetic_virtual",
            meshUrl: "/api/site-worlds/siteworld-f5fd54898cfb/explorer-asset?path=object_geometry%2Fobj_container_0002%2Fmesh.glb",
            previewImageUrl: "/api/site-worlds/siteworld-f5fd54898cfb/explorer-asset?path=object_geometry%2Fobj_container_0002%2Fviews%2Fsynthetic_view_05.png",
            selectedViewUrls: [
              "/api/site-worlds/siteworld-f5fd54898cfb/explorer-asset?path=object_geometry%2Fobj_container_0002%2Fviews%2Fsynthetic_view_05.png",
            ],
            center: [1.4, 0.8, 0.5],
            extents: [0.25, 0.2, 0.18],
          },
        ],
        sources: [],
        operatorView: {
          available: false,
          live: false,
          uiBaseUrl: null,
          label: "Private operator view unavailable",
          description: "The canonical explorer is the primary path when no private operator bridge is configured.",
        },
      },
      availableScenarioVariants: ["default", "counterfactual_lighting"],
      availableStartStates: ["default_start_state"],
      defaultRuntimeBackend: "neoverse",
      availableRuntimeBackends: ["neoverse"],
    },
    policy: {},
    requestedOutputs: ["observation_frames", "rollout_video", "export_bundle"],
    artifactUris: {},
    datasetArtifacts: {},
    elapsedSeconds: 0,
    metering: { sessionSeconds: 0, billableHours: 0 },
    runtimeHandle: {
      site_world_id: "siteworld-f5fd54898cfb",
      runtime_base_url: "http://146.115.17.157:45457",
      websocket_base_url: "ws://146.115.17.157:45457",
      vm_instance_id: "32805118",
      build_id: "build-demo",
      health_status: "healthy",
    },
    launchContext: {
      site_world_spec_uri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_spec.json",
      site_world_registration_uri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_registration.json",
      site_world_health_uri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/evaluation_prep/site_world_health.json",
      conditioning_bundle_uri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/scene_memory/conditioning_bundle.json",
      scene_memory_manifest_uri:
        "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/scene_memory/scene_memory_manifest.json",
    },
    ...overrides,
  };
}

afterEach(() => {
  mockSearch = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Object.defineProperty(globalThis.URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: originalCreateObjectURL,
  });
  Object.defineProperty(globalThis.URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: originalRevokeObjectURL,
  });
});

beforeEach(() => {
  let objectUrlCounter = 0;
  Object.defineProperty(globalThis.URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(() => `blob:frame-${++objectUrlCounter}`),
  });
  Object.defineProperty(globalThis.URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

describe("HostedSessionWorkspace", () => {
  const findModeLabel = (label: string) =>
    screen.findByText((_, element) => element?.textContent === `Mode: ${label}`);

  it("renders the interactive site-world viewer shell with explicit mode and artifact lanes", async () => {
    render(<HostedSessionWorkspace params={{ slug: "siteworld-f5fd54898cfb" }} />);

    expect(
      await screen.findByRole("heading", { name: /Interactive Site-World Viewer/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Live Runtime/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Explore Site-World/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Canonical Site-World")).toBeInTheDocument();
    expect(screen.getByText("Scene-Memory Conditioning Package")).toBeInTheDocument();
    expect(screen.getByText("Runtime Session Outputs")).toBeInTheDocument();
    expect(screen.getByText(/Hosted session ID is missing\./i)).toBeInTheDocument();
  });

  it("auto-resets the live runtime when the session loads without an episode", async () => {
    mockSearch = "sessionId=session-auto";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/site-worlds/sessions/session-auto/render?cameraId=head_rgb")) {
        return new Response("frame", { status: 200, headers: { "Content-Type": "image/png" } });
      }
      if (String(input).includes("/api/site-worlds/sessions/session-auto") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify(
            buildRuntimeSession({
              sessionId: "session-auto",
              latestEpisode: null,
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (String(input).includes("/api/site-worlds/sessions/session-auto/reset")) {
        return new Response(
          JSON.stringify({
            episode: {
              episodeId: "episode-1",
              taskId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
              task: "Media room",
              scenarioId: "scenario_default",
              scenario: "default",
              startStateId: "start_default_start_state",
              startState: "default_start_state",
              status: "running",
              stepIndex: 0,
              done: false,
              reward: 0,
              observation: {
                frame_path: "/api/site-worlds/sessions/session-auto/render?cameraId=head_rgb",
              },
              observationCameras: [{ id: "head_rgb", role: "head", required: true, defaultEnabled: true }],
              actionTrace: [],
              artifactUris: {},
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HostedSessionWorkspace params={{ slug: "siteworld-f5fd54898cfb" }} />);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([input, init]) =>
            String(input).includes("/api/site-worlds/sessions/session-auto/reset") &&
            init &&
            typeof init === "object" &&
            "method" in init &&
            init.method === "POST",
        ),
      ).toBe(true);
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/site-worlds/sessions/session-auto/render?cameraId=head_rgb"),
        ),
      ).toBe(true);
    });
    const resetCallIndex = fetchMock.mock.calls.findIndex(([input, init]) =>
      String(input).includes("/api/site-worlds/sessions/session-auto/reset") &&
      init &&
      typeof init === "object" &&
      "method" in init &&
      init.method === "POST",
    );
    const renderCallIndex = fetchMock.mock.calls.findIndex(([input]) =>
      String(input).includes("/api/site-worlds/sessions/session-auto/render?cameraId=head_rgb"),
    );
    expect(resetCallIndex).toBeGreaterThanOrEqual(0);
    expect(renderCallIndex).toBeGreaterThan(resetCallIndex);
    await findModeLabel("Explorer");
  });

  it("keeps Explorer as the default mode even after a live frame is fetched", async () => {
    mockSearch = "sessionId=session-live-flip";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/site-worlds/sessions/session-live-flip/render?cameraId=head_rgb")) {
        return new Response("frame", { status: 200, headers: { "Content-Type": "image/png" } });
      }
      if (String(input).includes("/api/site-worlds/sessions/session-live-flip") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify(
            buildRuntimeSession({
              sessionId: "session-live-flip",
              latestEpisode: {
                episodeId: "episode-live",
                taskId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
                task: "Media room",
                scenarioId: "scenario_default",
                scenario: "default",
                startStateId: "start_default_start_state",
                startState: "default_start_state",
                status: "running",
                stepIndex: 1,
                done: false,
                reward: 0.2,
                observation: {
                  frame_path: "/api/site-worlds/sessions/session-live-flip/render?cameraId=head_rgb",
                  primaryCameraId: "head_rgb",
                },
                observationCameras: [{ id: "head_rgb", role: "head", required: true, defaultEnabled: true }],
                actionTrace: [],
                artifactUris: {},
              },
            }),
          ),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<HostedSessionWorkspace params={{ slug: "siteworld-f5fd54898cfb" }} />);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/site-worlds/sessions/session-live-flip/render?cameraId=head_rgb"),
        ),
      ).toBe(true);
    });
    await findModeLabel("Explorer");
  });

  it("switches the render camera in live runtime mode", async () => {
    mockSearch = "sessionId=session-camera";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/api/site-worlds/sessions/session-camera/render?cameraId=head_rgb")) {
          return new Response("head-frame", { status: 200, headers: { "Content-Type": "image/png" } });
        }
        if (String(input).includes("/api/site-worlds/sessions/session-camera/render?cameraId=wrist_rgb")) {
          return new Response("wrist-frame", { status: 200, headers: { "Content-Type": "image/png" } });
        }
        if (String(input).includes("/api/site-worlds/sessions/session-camera") && (!init?.method || init.method === "GET")) {
          return new Response(
            JSON.stringify(
              buildRuntimeSession({
                sessionId: "session-camera",
                latestEpisode: {
                  episodeId: "episode-camera",
                  taskId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
                  task: "Media room",
                  scenarioId: "scenario_default",
                  scenario: "default",
                  startStateId: "start_default_start_state",
                  startState: "default_start_state",
                  status: "running",
                  stepIndex: 1,
                  done: false,
                  reward: 0.1,
                  observation: {
                    frame_path: "/api/site-worlds/sessions/session-camera/render?cameraId=head_rgb",
                    primaryCameraId: "head_rgb",
                  },
                  observationCameras: [
                    { id: "head_rgb", role: "head", required: true, defaultEnabled: true },
                    { id: "wrist_rgb", role: "wrist", required: false, defaultEnabled: true },
                  ],
                  actionTrace: [],
                  artifactUris: {},
                },
              }),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<HostedSessionWorkspace params={{ slug: "siteworld-f5fd54898cfb" }} />);

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/site-worlds/sessions/session-camera/render?cameraId=head_rgb"),
        ),
      ).toBe(true);
    });
    await findModeLabel("Explorer");

    fireEvent.click(screen.getByRole("button", { name: /Live Runtime/i }));

    await findModeLabel("Live Runtime");

    fireEvent.click(screen.getByRole("button", { name: /wrist/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) =>
          String(input).includes("/api/site-worlds/sessions/session-camera/render?cameraId=wrist_rgb"),
        ),
      ).toBe(true);
    });
  });

  it("shows an artifact-backed explorer when no private operator view is live", async () => {
    mockSearch = "sessionId=session-presentation";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/api/site-worlds/sessions/session-presentation/render?cameraId=head_rgb")) {
          return new Response("head-frame", { status: 200, headers: { "Content-Type": "image/png" } });
        }
        if (String(input).includes("/api/site-worlds/sessions/session-presentation") && (!init?.method || init.method === "GET")) {
          return new Response(
            JSON.stringify(
              buildRuntimeSession({
                sessionId: "session-presentation",
                sessionMode: "presentation_demo",
                latestEpisode: {
                  episodeId: "episode-2",
                  taskId: "9483414B-8776-4F68-AC80-D3B3BA774A90",
                  task: "Media room",
                  scenarioId: "scenario_default",
                  scenario: "default",
                  startStateId: "start_default_start_state",
                  startState: "default_start_state",
                  status: "running",
                  stepIndex: 2,
                  done: false,
                  reward: 0.2,
                  observation: {
                    frame_path: "/api/site-worlds/sessions/session-presentation/render?cameraId=head_rgb",
                  },
                  observationCameras: [{ id: "head_rgb", role: "head", required: true, defaultEnabled: true }],
                  actionTrace: [],
                  artifactUris: {},
                },
              }),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      }),
    );

    render(<HostedSessionWorkspace params={{ slug: "siteworld-f5fd54898cfb" }} />);

    expect(
      await screen.findByText(/Video-grounded interactive explorer/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/It does not replace the whole viewport with low-resolution generative output\./i),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Open presentation manifest/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("presentation_world_manifest.json"),
    );
    expect(screen.getAllByRole("link", { name: /Open runtime demo manifest/i })[0]).toHaveAttribute(
      "href",
      expect.stringContaining("runtime_demo_manifest.json"),
    );
  });

  it("surfaces the private operator view action only when a live bridge is configured", async () => {
    mockSearch = "sessionId=session-operator";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("/api/site-worlds/sessions/session-operator/ui-access")) {
          return new Response(
            JSON.stringify({ bootstrapUrl: "/api/site-worlds/sessions/session-operator/ui/bootstrap?token=test" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (String(input).includes("/api/site-worlds/sessions/session-operator") && (!init?.method || init.method === "GET")) {
          return new Response(
            JSON.stringify(
              buildRuntimeSession({
                sessionId: "session-operator",
                sessionMode: "presentation_demo",
                presentationRuntime: {
                  provider: "vast",
                  status: "live",
                  uiBaseUrl: "https://neoverse.example/operator",
                  proxyPath: "/api/site-worlds/sessions/session-operator/ui/",
                },
                presentationLaunchState: {
                  status: "live_viewer",
                  mode: "presentation_ui_live",
                  blockers: [],
                  blockerDetails: [],
                  presentationWorldManifestUri:
                    "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/presentation_world/presentation_world_manifest.json",
                  runtimeDemoManifestUri:
                    "gs://local-blueprint/scenes/9483414B-8776-4F68-AC80-D3B3BA774A90/captures/6F2FD31B-0F9F-43C4-9DF9-885E1A295CF3/pipeline/presentation_world/runtime_demo_manifest.json",
                  uiBaseUrl: "https://neoverse.example/operator",
                },
              }),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      }),
    );

    render(<HostedSessionWorkspace params={{ slug: "siteworld-f5fd54898cfb" }} />);

    expect(await screen.findByRole("link", { name: /Open private operator view/i })).toHaveAttribute(
      "href",
      expect.stringContaining("/api/site-worlds/sessions/session-operator/ui/bootstrap"),
    );
  });
});
