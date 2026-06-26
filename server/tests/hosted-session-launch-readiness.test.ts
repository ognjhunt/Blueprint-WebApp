// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HostedRuntimeResolution } from "../utils/hosted-session-runtime";
import {
  buildLaunchReadiness,
  buildPresentationLaunchState,
} from "../utils/hosted-session-launch-readiness";

const state = vi.hoisted(() => ({
  artifacts: new Map<string, Record<string, unknown> | null>(),
  uiBaseUrl: "https://neoverse.example/demo",
}));

vi.mock("../utils/hosted-session-runtime", () => ({
  readHostedRuntimeArtifactJson: vi.fn(async (uri?: string | null) => {
    if (!uri) return null;
    return state.artifacts.get(uri) ?? null;
  }),
}));

vi.mock("../utils/presentation-demo-runtime", () => ({
  resolvePresentationDemoLaunchConfig: vi.fn(async () => ({
    manifest: {},
    uiBaseUrl: state.uiBaseUrl,
    instanceId: "vast-config",
    expiresAt: "2026-03-12T02:00:00Z",
  })),
}));

function runtimeFixture(overrides: Partial<HostedRuntimeResolution> = {}): HostedRuntimeResolution {
  return {
    siteWorldId: "sw-chi-01",
    siteName: "Harborview Grocery Distribution Annex",
    siteAddress: "1847 W Fulton St, Chicago, IL 60612",
    scene_id: "scene-harborview-grocery-annex",
    capture_id: "cap-harborview-grocery-annex-v1",
    site_submission_id: "site-sub-harborview-grocery-annex",
    pipeline_prefix: "scenes/scene-harborview-grocery-annex/captures/cap-harborview-grocery-annex-v1/pipeline",
    defaultRuntimeBackend: "neoverse",
    availableRuntimeBackends: ["neoverse"],
    availableScenarioVariants: ["sw-chi-01-scenario-1"],
    availableStartStates: ["sw-chi-01-start-1"],
    runtimeManifest: {
      defaultBackend: "neoverse",
      launchableBackends: ["neoverse"],
      supportsStepRollout: true,
      supportsBatchRollout: true,
      supportsCameraViews: true,
      supportsStream: true,
    },
    taskCatalog: [
      {
        id: "sw-chi-01-task-1",
        taskText: "Walk to shelf staging and pick the blue tote",
      },
    ],
    scenarioCatalog: [{ id: "sw-chi-01-scenario-1", name: "Normal lighting" }],
    startStateCatalog: [{ id: "sw-chi-01-start-1", name: "Dock-side tote stack" }],
    robotProfiles: [],
    exportModes: ["raw_bundle"],
    siteWorldSpecUri: "gs://bucket/site_world_spec.json",
    siteWorldRegistrationUri: "gs://bucket/site_world_registration.json",
    siteWorldHealthUri: "gs://bucket/site_world_health.json",
    resolvedArtifactCanonicalUri: "gs://bucket/site_world_spec.json",
    registeredCanonicalPackageUri: "gs://runtime/registered/site_world_spec.json",
    registeredCanonicalPackageVersion: "runtime-v2",
    primaryRuntimeBackend: "neoverse",
    worldModelBackend: "neoverse",
    sceneRepresentation: "gaussian_splat",
    runtimeRenderSource: "neoverse_full_capture",
    fallbackMode: "none",
    groundingStatus: "capture_grounded",
    runtimeSiteWorldRecord: {
      canonical_package_uri: "gs://runtime/registered/site_world_spec.json",
      canonical_package_version: "runtime-v2",
    },
    runtimeHealthRecord: {
      status: "healthy",
      launchable: true,
      blockers: [],
    },
    runtimeBaseUrl: "http://runtime.local",
    websocketBaseUrl: "ws://runtime.local",
    allowBlockedSiteWorld: false,
    sceneMemoryManifestUri: "gs://bucket/scene_memory_manifest.json",
    conditioningBundleUri: "gs://bucket/conditioning_bundle.json",
    presentationWorldManifestUri: "gs://bucket/presentation_world_manifest.json",
    runtimeDemoManifestUri: "gs://bucket/runtime_demo_manifest.json",
    presentationWorldManifestDeclared: true,
    runtimeDemoManifestDeclared: true,
    presentationDemoBlockers: [],
    priceLabel: "$16/session-hour",
    qualificationState: "qualified_ready",
    evaluationReadiness: {
      qualification_state: "qualified_ready",
      missing_evidence: [],
      recapture_required: false,
    },
    readinessDecisionUri: "gs://bucket/readiness_decision.json",
    humanActionsRequiredUri: "gs://bucket/human_actions_required.json",
    ...overrides,
  };
}

describe("hosted-session launch readiness", () => {
  beforeEach(() => {
    state.uiBaseUrl = "https://neoverse.example/demo";
    state.artifacts = new Map<string, Record<string, unknown> | null>([
      ["gs://bucket/site_world_spec.json", { status: "available" }],
      [
        "gs://bucket/site_world_registration.json",
        {
          site_world_id: "siteworld-1",
          runtime_base_url: "http://runtime.local",
        },
      ],
      ["gs://bucket/site_world_health.json", { status: "healthy", launchable: true, blockers: [] }],
      ["gs://bucket/presentation_world_manifest.json", { status: "available" }],
      ["gs://bucket/runtime_demo_manifest.json", { status: "available" }],
    ]);
  });

  it("keeps access blockers attached to both launch modes", async () => {
    const accessBlocker = "A provisioned hosted-session entitlement is required for protected site-world launch.";

    const readiness = await buildLaunchReadiness({
      runtime: runtimeFixture(),
      entitled: false,
      accessBlockers: [accessBlocker],
    });

    expect(readiness.entitled).toBe(false);
    expect(readiness.status).toBe("presentation_ui_live");
    expect(readiness.launchable).toBe(false);
    expect(readiness.blockers).toEqual([accessBlocker]);
    expect(readiness.presentation_demo.blocker_details).toEqual([
      { code: "access_1", message: accessBlocker, source: "access" },
    ]);
    expect(readiness.runtime_only.blocker_details).toEqual([
      { code: "access_1", message: accessBlocker, source: "access" },
    ]);
  });

  it("preserves the unsafe blocked-site-world runtime override", async () => {
    state.artifacts.set("gs://bucket/site_world_health.json", {
      status: "blocked",
      launchable: false,
      blockers: ["Aisle egress is blocked for the target workflow."],
    });
    const runtime = runtimeFixture({ runtimeHealthRecord: null });

    const blocked = await buildLaunchReadiness({
      runtime,
      entitled: true,
      accessBlockers: [],
    });
    const allowed = await buildLaunchReadiness({
      runtime,
      entitled: true,
      accessBlockers: [],
      runtimeSessionConfig: {
        unsafe_allow_blocked_site_world: true,
      },
    });

    expect(blocked.runtime_only.status).toBe("runtime_live_unavailable");
    expect(blocked.runtime_only.blockers).toContain(
      "The site-world runtime is not launchable: Aisle egress is blocked for the target workflow.",
    );
    expect(allowed.runtime_only.status).toBe("runtime_live_ready");
    expect(allowed.runtime_only.launchable).toBe(true);
    expect(allowed.runtime_only.blockers).toEqual([]);
  });

  it("builds artifact-backed presentation state without requiring a live UI", async () => {
    state.uiBaseUrl = "";
    const readiness = await buildLaunchReadiness({
      runtime: runtimeFixture(),
      entitled: true,
      accessBlockers: [],
    });

    expect(buildPresentationLaunchState({
      readiness: readiness.presentation_demo,
      runtime: runtimeFixture(),
    })).toEqual({
      status: "artifact_backed",
      mode: "presentation_ui_unconfigured",
      blockers: [],
      blockerDetails: [],
      presentationWorldManifestUri: "gs://bucket/presentation_world_manifest.json",
      runtimeDemoManifestUri: "gs://bucket/runtime_demo_manifest.json",
      uiBaseUrl: null,
    });
  });
});
