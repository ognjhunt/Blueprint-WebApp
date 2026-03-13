// @vitest-environment node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createHostedSessionRun } from "../utils/hosted-session-orchestrator";

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
