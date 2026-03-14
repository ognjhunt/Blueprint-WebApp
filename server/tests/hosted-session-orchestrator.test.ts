// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createHostedSessionRun,
  reconcileHostedEpisode,
  stepHostedSessionRun,
} from "../utils/hosted-session-orchestrator";

const originalFetch = global.fetch;

afterEach(async () => {
  global.fetch = originalFetch;
});

describe("createHostedSessionRun", () => {
  it("flattens runtime session config onto the runtime create request", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bp-hosted-session-"));
    const registrationPath = path.join(tmpRoot, "site_world_registration.json");
    const healthPath = path.join(tmpRoot, "site_world_health.json");
    await fs.writeFile(
      registrationPath,
      JSON.stringify({
        site_world_id: "siteworld-test",
        runtime_base_url: "http://runtime.local",
        websocket_base_url: "ws://runtime.local",
      }),
      "utf-8",
    );
    await fs.writeFile(
      healthPath,
      JSON.stringify({
        launchable: false,
        status: "blocked",
        blockers: ["missing_runtime_service_url"],
      }),
      "utf-8",
    );

    let capturedBody: Record<string, unknown> | null = null;
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          session_id: "session-test",
          build_id: "build-1",
          runtime_capabilities: { supports_step_rollout: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof global.fetch;

    await createHostedSessionRun({
      sessionId: "session-test",
      workDir: path.join(tmpRoot, "work"),
      runtime: {
        siteWorldId: "siteworld-test",
        siteName: "Demo",
        siteAddress: "Demo",
        scene_id: "scene-1",
        capture_id: "cap-1",
        site_submission_id: "submission-1",
        pipeline_prefix: "scenes/scene-1/captures/cap-1/pipeline",
        defaultRuntimeBackend: "neoverse",
        availableRuntimeBackends: ["neoverse"],
        availableScenarioVariants: ["default"],
        availableStartStates: ["default"],
        runtimeManifest: {
          defaultBackend: "neoverse",
          launchableBackends: ["neoverse"],
          exportModes: ["raw_bundle"],
          supportsStepRollout: true,
          supportsBatchRollout: true,
          supportsCameraViews: true,
          supportsStream: false,
          launchable: true,
        },
        taskCatalog: [],
        scenarioCatalog: [],
        startStateCatalog: [],
        robotProfiles: [],
        exportModes: ["raw_bundle"],
        siteWorldSpecUri: path.join(tmpRoot, "site_world_spec.json"),
        siteWorldRegistrationUri: registrationPath,
        siteWorldHealthUri: healthPath,
        resolvedArtifactCanonicalUri: "gs://bucket/site_world_spec.json",
        registeredCanonicalPackageUri: "gs://runtime/registered-site-world-spec.json",
        registeredCanonicalPackageVersion: "runtime-v1",
        runtimeSiteWorldRecord: null,
        runtimeBaseUrl: "http://runtime.local",
        websocketBaseUrl: "ws://runtime.local",
        allowBlockedSiteWorld: true,
        sceneMemoryManifestUri: "gs://bucket/scene_memory_manifest.json",
        conditioningBundleUri: "gs://bucket/conditioning_bundle.json",
        presentationDemoBlockers: [],
      },
      robotProfileId: "mobile_manipulator_rgb_v1",
      taskId: "task-1",
      scenarioId: "scenario_default",
      startStateId: "start_default",
      exportModes: ["raw_bundle"],
      runtimeSessionConfig: {
        canonical_package_uri: "gs://bucket/custom-package.json",
        canonical_package_version: "v1",
        prompt: "Use careful handoff behavior.",
        trajectory: "shortest_safe_path",
        presentation_model: "neoverse_v2",
        debug_mode: true,
        unsafe_allow_blocked_site_world: true,
      },
    });

    expect(capturedBody).toMatchObject({
      canonical_package_uri: "gs://bucket/custom-package.json",
      canonical_package_version: "v1",
      prompt: "Use careful handoff behavior.",
      trajectory: "shortest_safe_path",
      presentation_model: "neoverse_v2",
      debug_mode: true,
      unsafe_allow_blocked_site_world: true,
    });
    expect(capturedBody).not.toHaveProperty("runtime_session_config");
  });
});

describe("stepHostedSessionRun", () => {
  it("uses a neutral zero action when no explicit action is supplied", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bp-hosted-session-step-"));
    const workDir = path.join(tmpRoot, "work");
    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(
      path.join(workDir, "runtime_metadata.json"),
      JSON.stringify({ runtime_base_url: "http://runtime.local" }),
      "utf-8",
    );

    let capturedBody: Record<string, unknown> | null = null;
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body || "{}")) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          episodeId: "episode-1",
          taskId: "task-1",
          task: "Media room",
          scenarioId: "scenario_default",
          scenario: "default",
          startStateId: "start_default",
          startState: "default",
          status: "running",
          stepIndex: 1,
          done: false,
          reward: 0.05,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof global.fetch;

    await stepHostedSessionRun({
      sessionId: "session-step-test",
      workDir,
      episodeId: "episode-1",
    });

    expect(capturedBody).toMatchObject({
      action: [0, 0, 0, 0, 0, 0, 0],
    });
  });

  it("returns runtime_proxy_timeout when the runtime never responds", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bp-hosted-session-step-timeout-"));
    const workDir = path.join(tmpRoot, "work");
    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(
      path.join(workDir, "runtime_metadata.json"),
      JSON.stringify({ runtime_base_url: "http://runtime.local" }),
      "utf-8",
    );

    const previousTimeout = process.env.BLUEPRINT_HOSTED_SESSION_RUNTIME_TIMEOUT_MS;
    process.env.BLUEPRINT_HOSTED_SESSION_RUNTIME_TIMEOUT_MS = "5";
    global.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_, reject) => {
      const signal = init?.signal;
      signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    })) as typeof global.fetch;

    try {
      await expect(stepHostedSessionRun({
        sessionId: "session-step-timeout",
        workDir,
        episodeId: "episode-1",
      })).rejects.toMatchObject({
        code: "runtime_proxy_timeout",
        statusCode: 504,
      });
    } finally {
      if (previousTimeout === undefined) {
        delete process.env.BLUEPRINT_HOSTED_SESSION_RUNTIME_TIMEOUT_MS;
      } else {
        process.env.BLUEPRINT_HOSTED_SESSION_RUNTIME_TIMEOUT_MS = previousTimeout;
      }
    }
  });
});

describe("reconcileHostedEpisode", () => {
  it("polls runtime state until a world snapshot is available", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bp-hosted-session-reconcile-"));
    const workDir = path.join(tmpRoot, "work");
    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(
      path.join(workDir, "runtime_metadata.json"),
      JSON.stringify({ runtime_base_url: "http://runtime.local" }),
      "utf-8",
    );

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: "session-1",
        status: "running",
        step_index: 0,
        observation: {
          primaryCameraId: "",
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        session_id: "session-1",
        status: "running",
        step_index: 1,
        observation: {
          primaryCameraId: "head_rgb",
          frame_path: "http://runtime.local/v1/sessions/session-1/render?camera_id=head_rgb",
          worldSnapshot: {
            snapshotId: "snapshot-1",
            status: "running",
          },
          runtimeMetadata: {
            step_index: 1,
          },
        },
        action_trace: [[0, 0, 0, 0, 0, 0, 0]],
      }), { status: 200, headers: { "Content-Type": "application/json" } }));
    global.fetch = fetchMock as typeof global.fetch;

    const episode = await reconcileHostedEpisode({
      sessionId: "session-1",
      workDir,
      episode: {
        episodeId: "episode-1",
        taskId: "task-1",
        task: "Media room",
        scenarioId: "scenario_default",
        scenario: "default",
        startStateId: "start_default",
        startState: "default",
      },
      expectedStepIndex: 1,
      timeoutMs: 25,
      pollIntervalMs: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(episode.stepIndex).toBe(1);
    expect(
      (((episode.observation as Record<string, unknown>).worldSnapshot as Record<string, unknown>).snapshotId),
    ).toBe("snapshot-1");
  });

  it("returns runtime_snapshot_not_ready when state never materializes a snapshot", async () => {
    const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bp-hosted-session-timeout-"));
    const workDir = path.join(tmpRoot, "work");
    await fs.mkdir(workDir, { recursive: true });
    await fs.writeFile(
      path.join(workDir, "runtime_metadata.json"),
      JSON.stringify({ runtime_base_url: "http://runtime.local" }),
      "utf-8",
    );

    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      session_id: "session-1",
      status: "running",
      step_index: 0,
      observation: {
        primaryCameraId: "",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof global.fetch;

    await expect(reconcileHostedEpisode({
      sessionId: "session-1",
      workDir,
      episode: {
        episodeId: "episode-1",
      },
      expectedStepIndex: 0,
      timeoutMs: 5,
      pollIntervalMs: 1,
    })).rejects.toMatchObject({
      code: "runtime_snapshot_not_ready",
      statusCode: 504,
    });
  });
});
