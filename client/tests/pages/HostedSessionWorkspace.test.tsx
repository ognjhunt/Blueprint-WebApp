import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HostedSessionWorkspace from "@/pages/HostedSessionWorkspace";
import { getSiteWorldById } from "@/data/siteWorlds";

let mockSearch = "";

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useSearch: () => mockSearch,
    useLocation: () => ["/site-worlds/sw-chi-01/workspace", vi.fn()],
  };
});

vi.mock("@/lib/siteWorldsApi", () => ({
  fetchSiteWorldDetail: vi.fn(async (siteWorldId: string) => getSiteWorldById(siteWorldId)),
}));

vi.mock("@/lib/firebase", () => ({
  auth: {
    currentUser: {
      getIdToken: vi.fn(async () => "token-1"),
    },
  },
}));

afterEach(() => {
  mockSearch = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("HostedSessionWorkspace", () => {
  it("renders the hosted session workspace shell", async () => {
    render(<HostedSessionWorkspace params={{ slug: "sw-chi-01" }} />);

    expect(
      await screen.findByRole("heading", { name: /Hosted Session Workspace/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Harborview Grocery Distribution Annex/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Built World Model Demo/i)).toBeInTheDocument();
    expect(screen.getByText(/world model you already built/i)).toBeInTheDocument();
    expect(screen.getByText(/Robot observation/i)).toBeInTheDocument();
    expect(screen.getByText(/Run context/i)).toBeInTheDocument();
    expect(screen.getByText(/Controls/i)).toBeInTheDocument();
    expect(screen.getByText(/Generated outputs/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stop session/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restart world model/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Run scripted demo batch/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export demo package/i })).toBeInTheDocument();
    expect(screen.getAllByText(/Raw bundle/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/RLDS dataset/i).length).toBeGreaterThan(0);
  });

  it("shows presentation failure details and canonical package config from the session record", async () => {
    mockSearch = "sessionId=session-1";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/site-worlds/sessions/session-1")) {
          return new Response(
            JSON.stringify({
              sessionId: "session-1",
              sessionMode: "presentation_demo",
              runtime_backend_selected: "neoverse",
              status: "failed",
              site: {
                siteWorldId: "sw-chi-01",
                siteName: "Harborview Grocery Distribution Annex",
                siteAddress: "1847 W Fulton St, Chicago, IL 60612",
                scene_id: "scene-harborview-grocery-annex",
                capture_id: "cap-harborview-grocery-annex-v1",
                site_submission_id: "sw-chi-01",
                pipeline_prefix: "scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline",
              },
              policy: {},
              requestedOutputs: [],
              artifactUris: {},
              datasetArtifacts: {},
              elapsedSeconds: 0,
              metering: { sessionSeconds: 0, billableHours: 0 },
              launchContext: {
                site_world_spec_uri: "gs://bucket/spec.json",
                site_world_registration_uri: "gs://bucket/registration.json",
                site_world_health_uri: "gs://bucket/health.json",
                conditioning_bundle_uri: "gs://bucket/conditioning.json",
                scene_memory_manifest_uri: "gs://bucket/scene-memory.json",
              },
              runtimeSessionConfig: {
                canonical_package_uri: "gs://bucket/canonical-package.json",
                canonical_package_version: "v2026.03.12",
                presentation_model: "neoverse_v2",
                debug_mode: true,
              },
              presentationRuntime: {
                provider: "vast",
                status: "failed",
                errorMessage: "Presentation demo UI base URL is not configured.",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      }),
    );

    render(<HostedSessionWorkspace params={{ slug: "sw-chi-01" }} />);

    expect(await screen.findByText(/The presentation demo failed to start/i)).toBeInTheDocument();
    expect(screen.getByText(/Presentation demo UI base URL is not configured\./i)).toBeInTheDocument();
    expect(screen.getAllByText(/v2026\.03\.12/i).length).toBeGreaterThan(0);
    expect(await screen.findByRole("link", { name: /View canonical package/i })).toHaveAttribute(
      "href",
      "gs://bucket/canonical-package.json",
    );
  });

  it("prefers the remote runtime frame when the local frame path is not browser-renderable", async () => {
    mockSearch = "sessionId=session-remote-frame";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).includes("/api/site-worlds/sessions/session-remote-frame")) {
          return new Response(
            JSON.stringify({
              sessionId: "session-remote-frame",
              sessionMode: "runtime_only",
              runtime_backend_selected: "neoverse",
              status: "running",
              site: {
                siteWorldId: "sw-chi-01",
                siteName: "Harborview Grocery Distribution Annex",
                siteAddress: "1847 W Fulton St, Chicago, IL 60612",
                scene_id: "scene-harborview-grocery-annex",
                capture_id: "cap-harborview-grocery-annex-v1",
                site_submission_id: "sw-chi-01",
                pipeline_prefix: "scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline",
              },
              policy: {},
              requestedOutputs: [],
              artifactUris: {
                export_manifest: "/tmp/export_manifest.json",
                raw_bundle: "/tmp/raw_bundle.json",
              },
              datasetArtifacts: {},
              elapsedSeconds: 0,
              metering: { sessionSeconds: 0, billableHours: 0 },
              launchContext: {
                site_world_spec_uri: "gs://bucket/spec.json",
                site_world_registration_uri: "gs://bucket/registration.json",
                site_world_health_uri: "gs://bucket/health.json",
                conditioning_bundle_uri: "gs://bucket/conditioning.json",
                scene_memory_manifest_uri: "gs://bucket/scene-memory.json",
              },
              latestEpisode: {
                episodeId: "episode-1",
                taskId: "task-1",
                task: "Inspect media room",
                scenarioId: "scenario-1",
                scenario: "default",
                startStateId: "start-1",
                startState: "default",
                status: "running",
                stepIndex: 1,
                done: false,
                reward: 0.05,
                actionTrace: [[0, 0, 0, 0, 0, 0, 0]],
                observation: {
                  frame_path: "/workspace/local/frame_001.png",
                  remoteObservation: {
                    frame_path: "http://runtime.example/frame_001.png",
                    cameraFrames: [{ framePath: "http://runtime.example/frame_001.png" }],
                  },
                  runtimeMetadata: {
                    quality_flags: {
                      presentation_quality: "degraded",
                      fallback_mode: "canonical_only",
                    },
                    protected_region_violations: [{ reason: "locked_region_modified" }],
                  },
                },
                observationCameras: [{ id: "head_rgb", role: "head", required: true, defaultEnabled: true }],
                artifactUris: {
                  rollout_video: "http://runtime.example/rollout.mp4",
                },
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
      }),
    );

    render(<HostedSessionWorkspace params={{ slug: "sw-chi-01" }} />);

    const image = await screen.findByRole("img", { name: /Latest robot observation frame/i });
    expect(image).toHaveAttribute("src", "http://runtime.example/frame_001.png");
    expect(screen.getByRole("link", { name: /Open rollout video/i })).toHaveAttribute(
      "href",
      "http://runtime.example/rollout.mp4",
    );
    expect(screen.getByText(/degraded/i)).toBeInTheDocument();
  });
});
