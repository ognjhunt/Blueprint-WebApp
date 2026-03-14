import fs from "node:fs";
import path from "node:path";
import { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { siteWorldCards, type SiteWorldCard, type SiteWorldPackage } from "../../client/src/data/siteWorlds";
import { getConfiguredEnvValue } from "../config/env";
import type {
  DeploymentReadinessSummary,
  InboundRequest,
  InboundRequestStored,
  OpportunityState,
  PipelineAttachment,
  QualificationState,
  RightsAndComplianceSummary,
  RobotCapabilityEnvelope,
} from "../types/inbound-request";
import { decryptInboundRequestForAdmin } from "./field-encryption";
import { parseGsUri } from "./pipeline-dashboard";
import { resolvePresentationDemoUiBaseUrl } from "./presentation-demo-runtime";

const LIVE_QUALIFICATION_STATES = new Set<QualificationState>([
  "qualified_ready",
  "qualified_risky",
  "needs_refresh",
]);

const LIVE_OPPORTUNITY_STATES = new Set<OpportunityState>([
  "handoff_ready",
  "escalated_to_geometry",
  "escalated_to_validation",
]);

type ArtifactJson = Record<string, unknown> | null;

const DEMO_SITE_WORLD_ID = "siteworld-f5fd54898cfb";
const DEMO_BUNDLE_PIPELINE_ROOT =
  "/Users/nijelhunt_1/Downloads/neoverse_a100_20260313_133908_demo_bundle/remote/storage/capture/pipeline";

function deriveWebsocketUrl(runtimeBaseUrl: string | null): string | null {
  const normalized = String(runtimeBaseUrl || "").trim();
  if (!normalized) {
    return null;
  }
  try {
    const url = new URL(normalized);
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol === "http:") url.protocol = "ws:";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function resolveDemoRuntimeManifest(runtimeManifest: SiteWorldCard["runtimeManifest"]): SiteWorldCard["runtimeManifest"] {
  const runtimeBaseUrl = getConfiguredEnvValue(
    "BLUEPRINT_HOSTED_DEMO_RUNTIME_BASE_URL",
    "VITE_HOSTED_DEMO_RUNTIME_BASE_URL",
  );
  const websocketBaseUrl =
    getConfiguredEnvValue(
      "BLUEPRINT_HOSTED_DEMO_RUNTIME_WEBSOCKET_BASE_URL",
      "VITE_HOSTED_DEMO_RUNTIME_WEBSOCKET_BASE_URL",
    ) || deriveWebsocketUrl(runtimeBaseUrl);

  return {
    ...runtimeManifest,
    runtimeBaseUrl,
    websocketBaseUrl,
    healthStatus: runtimeBaseUrl ? runtimeManifest.healthStatus || "healthy" : "unknown",
    launchable: Boolean(runtimeBaseUrl),
  };
}

function demoBundleAssetPath(relativePath: string) {
  return path.join(DEMO_BUNDLE_PIPELINE_ROOT, relativePath);
}

function resolveDemoBundlePathFromRuntimePath(rawPath: string) {
  const normalized = String(rawPath || "").trim();
  const marker = "/pipeline/";
  const index = normalized.indexOf(marker);
  if (index === -1) {
    return null;
  }
  const relative = normalized.slice(index + marker.length);
  const local = demoBundleAssetPath(relative);
  return fs.existsSync(local) ? local : null;
}

function buildExplorerAssetUrl(siteWorldId: string, relativePath: string) {
  return `/api/site-worlds/${encodeURIComponent(siteWorldId)}/explorer-asset?path=${encodeURIComponent(relativePath)}`;
}

function resolvePresentationWorldManifestUri(pipeline?: PipelineAttachment): string | null {
  const explicit = String(pipeline?.artifacts.presentation_world_manifest_uri || "").trim();
  if (explicit) {
    return explicit;
  }
  return pipelineArtifactUri(
    pipeline,
    null,
    "presentation_world/presentation_world_manifest.json",
  );
}

function resolveRuntimeDemoManifestUri(pipeline?: PipelineAttachment): string | null {
  const explicit = String(pipeline?.artifacts.runtime_demo_manifest_uri || "").trim();
  if (explicit) {
    return explicit;
  }
  return pipelineArtifactUri(
    pipeline,
    null,
    "presentation_world/runtime_demo_manifest.json",
  );
}

function buildPresentationDemoReadiness(params: {
  pipeline?: PipelineAttachment;
  launchable?: boolean;
  presentationWorldManifest?: ArtifactJson;
  runtimeDemoManifest?: ArtifactJson;
  siteWorldId?: string;
  sceneId?: string;
  captureId?: string;
}): SiteWorldCard["presentationDemoReadiness"] {
  const blockers: string[] = [];
  const presentationWorldManifestUri = resolvePresentationWorldManifestUri(params.pipeline);
  const runtimeDemoManifestUri = resolveRuntimeDemoManifestUri(params.pipeline);
  const presentationManifestRegistered =
    Boolean(String(params.pipeline?.artifacts.presentation_world_manifest_uri || "").trim()) ||
    Boolean(presentationWorldManifestUri && params.presentationWorldManifest);
  const runtimeDemoManifestRegistered =
    Boolean(String(params.pipeline?.artifacts.runtime_demo_manifest_uri || "").trim()) ||
    Boolean(runtimeDemoManifestUri && params.runtimeDemoManifest);
  const uiBaseUrl =
    presentationManifestRegistered && runtimeDemoManifestRegistered
      ? resolvePresentationDemoUiBaseUrl({
          sessionId: "site-world-preview",
          siteWorldId: String(params.siteWorldId || "").trim(),
          sceneId: String(params.sceneId || "").trim(),
          captureId: String(params.captureId || "").trim(),
          manifest: (params.runtimeDemoManifest as Record<string, unknown>) || {},
        }).url || null
      : null;

  if (!presentationManifestRegistered) {
    blockers.push("missing presentation package");
  }
  if (!runtimeDemoManifestRegistered) {
    blockers.push("missing runtime demo manifest");
  }
  if (!String(params.pipeline?.artifacts.site_world_spec_uri || params.pipeline?.pipeline_prefix || "").trim()) {
    blockers.push("missing runtime site-world spec");
  }
  if (!String(params.pipeline?.artifacts.site_world_registration_uri || params.pipeline?.pipeline_prefix || "").trim()) {
    blockers.push("missing runtime registration");
  }
  if (!params.launchable) {
    blockers.push("site not launchable yet");
  }

  const status = !presentationManifestRegistered || !runtimeDemoManifestRegistered
    ? "presentation_assets_missing"
    : uiBaseUrl
      ? "presentation_ui_live"
      : "presentation_ui_unconfigured";

  return {
    launchable:
      (status === "presentation_ui_live" || status === "presentation_ui_unconfigured") &&
      blockers.length === 0,
    blockers,
    presentationWorldManifestUri,
    runtimeDemoManifestUri,
    status,
    uiBaseUrl,
  };
}

function buildArtifactExplorer(params: {
  template?: SiteWorldCard;
  siteWorldId: string;
  sceneId: string;
  captureId: string;
  siteWorldSpecUri?: string | null;
  sceneMemoryManifestUri?: string | null;
  conditioningBundleUri?: string | null;
  presentationWorldManifestUri?: string | null;
  runtimeDemoManifestUri?: string | null;
  presentationWorldManifest?: ArtifactJson;
  runtimeDemoManifest?: ArtifactJson;
}): SiteWorldCard["artifactExplorer"] {
  const uiBaseUrl =
    params.presentationWorldManifestUri && params.runtimeDemoManifestUri
      ? resolvePresentationDemoUiBaseUrl({
          sessionId: "site-world-preview",
          siteWorldId: params.siteWorldId,
          sceneId: params.sceneId,
          captureId: params.captureId,
          manifest: (params.runtimeDemoManifest as Record<string, unknown>) || {},
        }).url || null
      : null;

  if (params.siteWorldId === DEMO_SITE_WORLD_ID) {
    const manifestPath = demoBundleAssetPath("evaluation_prep/object_geometry_manifest.json");
    if (fs.existsSync(manifestPath)) {
      try {
        const objectGeometryManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
        const rawObjects = Array.isArray(objectGeometryManifest.objects)
          ? (objectGeometryManifest.objects as Array<Record<string, unknown>>)
          : [];
        const objects = rawObjects
          .map((item) => {
            const rawMeshPath = String(item.mesh_glb_path || "").trim();
            const localMeshPath = resolveDemoBundlePathFromRuntimePath(rawMeshPath);
            const placement = (item.placement_bbox as Record<string, unknown> | undefined) || {};
            const center = Array.isArray(placement.center)
              ? placement.center.slice(0, 3).map((value) => Number(value || 0))
              : [0, 0, 0];
            const extents = Array.isArray(placement.extents)
              ? placement.extents.slice(0, 3).map((value) => Number(value || 0))
              : [0.15, 0.15, 0.15];
            const selectedViews = Array.isArray(item.selected_views)
              ? (item.selected_views as Array<Record<string, unknown>>)
              : [];
            const firstImagePath = String(selectedViews[0]?.image_path || "").trim();
            const localImagePath = resolveDemoBundlePathFromRuntimePath(firstImagePath);
            const selectedViewUrls = selectedViews
              .map((view) => resolveDemoBundlePathFromRuntimePath(String(view.image_path || "").trim()))
              .filter((value): value is string => Boolean(value))
              .map((value) => buildExplorerAssetUrl(params.siteWorldId, path.relative(DEMO_BUNDLE_PIPELINE_ROOT, value)));
            return {
              id: String(item.object_id || ""),
              label: String(item.label || item.object_id || "object"),
              taskRole: String(item.task_role || "").trim() || null,
              taskCritical: Boolean(item.task_critical),
              groundingLevel: String(item.grounding_level || item.source_mode || "").trim() || null,
              meshUrl: localMeshPath
                ? buildExplorerAssetUrl(params.siteWorldId, path.relative(DEMO_BUNDLE_PIPELINE_ROOT, localMeshPath))
                : null,
              previewImageUrl: localImagePath
                ? buildExplorerAssetUrl(params.siteWorldId, path.relative(DEMO_BUNDLE_PIPELINE_ROOT, localImagePath))
                : null,
              selectedViewUrls,
              center: center as [number, number, number],
              extents: extents as [number, number, number],
            };
          })
          .filter((item) => item.id);

        return {
          status: objects.length > 0 ? "ready" : "partial",
          headline: "Canonical site-world object geometry",
          summary:
            "Explore the site-specific canonical world model through object geometry reconstructed from the capture pipeline.",
          derivationMode: "grounded object geometry",
          canonicalPackageVersion: params.template?.siteWorldSpecUri ? null : null,
          presentationStatus: "secondary derived overlays available",
          sceneKind: "canonical_object_geometry",
          sceneModelUrl: null,
          sceneModelFormat: "object_bundle",
          views: [],
          objects,
          sources: [
            {
              id: "canonical",
              label: "Canonical package",
              uri: params.siteWorldSpecUri || null,
              detail: "Grounded site-world package",
            },
            {
              id: "object-geometry",
              label: "Object geometry manifest",
              uri: buildExplorerAssetUrl(params.siteWorldId, "evaluation_prep/object_geometry_manifest.json"),
              detail: `${objects.length} reconstructed scene objects`,
            },
            {
              id: "presentation",
              label: "Presentation manifest",
              uri: params.presentationWorldManifestUri || null,
              detail: "Derived presentation output, secondary to the canonical scene",
            },
            {
              id: "runtime-demo",
              label: "Runtime demo manifest",
              uri: params.runtimeDemoManifestUri || null,
              detail: "Saved demo runtime configuration",
            },
          ].filter((item) => Boolean(item.uri)),
          operatorView: {
            available: Boolean(uiBaseUrl),
            live: Boolean(uiBaseUrl),
            uiBaseUrl,
            label: uiBaseUrl ? "Private operator view available" : "Private operator view unavailable",
            description: uiBaseUrl
              ? "A private NeoVerse UI is configured for internal movement and debugging."
              : "The canonical explorer is the primary path when no private operator bridge is configured.",
          },
        };
      } catch {
        // Fall through to the generic artifact explorer below.
      }
    }
  }

  const template = params.template;
  const derivationMode = String(
    params.presentationWorldManifest?.derivation_mode || params.runtimeDemoManifest?.derivation_mode || "",
  ).trim() || null;
  const canonicalPackageVersion = String(
    params.presentationWorldManifest?.canonical_package_version || params.runtimeDemoManifest?.canonical_package_version || "",
  ).trim() || null;
  const presentationStatus = String(
    params.presentationWorldManifest?.status || params.runtimeDemoManifest?.status || "",
  ).trim() || null;

  const views = [
    {
      id: "presentation-overview",
      title: "Presentation overview",
      description: "Saved customer-facing view from the presentation-world lane.",
      imageUrl: template?.presentationReferenceImageUrl || null,
      sourceUri: params.presentationWorldManifestUri || null,
      badge: "Derived presentation",
      available: Boolean(template?.presentationReferenceImageUrl),
    },
    {
      id: "runtime-head-rgb",
      title: "Runtime head camera",
      description: "Validated runtime observation frame from the saved demo session.",
      imageUrl: template?.runtimeReferenceImageUrl || null,
      sourceUri: params.runtimeDemoManifestUri || null,
      badge: "Validated runtime frame",
      cameraId: "head_rgb",
      available: Boolean(template?.runtimeReferenceImageUrl),
    },
  ].filter((item) => item.available);

  const sources = [
    {
      id: "canonical",
      label: "Canonical package",
      uri: params.siteWorldSpecUri || null,
      detail: "Grounded site-world package",
    },
    {
      id: "scene-memory",
      label: "Scene-memory manifest",
      uri: params.sceneMemoryManifestUri || null,
      detail: "Conditioning support artifacts",
    },
    {
      id: "conditioning",
      label: "Conditioning bundle",
      uri: params.conditioningBundleUri || null,
      detail: "Reconstruction and presentation inputs",
    },
    {
      id: "presentation",
      label: "Presentation manifest",
      uri: params.presentationWorldManifestUri || null,
      detail: "Saved presentation-world output",
    },
    {
      id: "runtime-demo",
      label: "Runtime demo manifest",
      uri: params.runtimeDemoManifestUri || null,
      detail: "Saved demo runtime configuration",
    },
  ].filter((item) => Boolean(item.uri));

  if (views.length === 0 && sources.length === 0) {
    return null;
  }

  return {
    status: views.length > 0 ? "ready" : "partial",
    headline: "Explore the site-world through saved artifacts",
    summary:
      "This viewer uses already-produced site-world and presentation artifacts. It does not hallucinate new scene content in the browser.",
    derivationMode,
    canonicalPackageVersion,
    presentationStatus,
    views,
    sources,
    operatorView: {
      available: Boolean(uiBaseUrl),
      live: Boolean(uiBaseUrl),
      uiBaseUrl,
      label: uiBaseUrl ? "Private operator view available" : "Private operator view unavailable",
      description: uiBaseUrl
        ? "A private NeoVerse UI is configured for internal movement and debugging."
        : "Use artifact-backed exploration when no private operator bridge is configured.",
    },
  };
}

function deriveSampleRobotProfile(sampleRobot: string, runtime: string): SiteWorldCard["sampleRobotProfile"] {
  const normalized = `${sampleRobot} ${runtime}`.toLowerCase();
  const observationCameras: SiteWorldCard["sampleRobotProfile"]["observationCameras"] = [];
  if (normalized.includes("head")) observationCameras.push({ id: "head_rgb", role: "head", required: true, defaultEnabled: true });
  if (normalized.includes("wrist")) observationCameras.push({ id: "wrist_rgb", role: "wrist", required: false, defaultEnabled: true });
  if (normalized.includes("overhead")) observationCameras.push({ id: "overhead_rgb", role: "context", required: false, defaultEnabled: true });
  if (normalized.includes("mast")) observationCameras.push({ id: "mast_rgb", role: "head", required: true, defaultEnabled: true });
  if (normalized.includes("stereo")) observationCameras.push({ id: "stereo_rgb", role: "head", required: true, defaultEnabled: true });
  if (normalized.includes("barcode")) observationCameras.push({ id: "barcode_stream", role: "context", required: false, defaultEnabled: true });
  if (normalized.includes("thermal")) observationCameras.push({ id: "thermal_state", role: "context", required: false, defaultEnabled: true });
  if (normalized.includes("map")) observationCameras.push({ id: "map_state", role: "context", required: false, defaultEnabled: true });
  if (normalized.includes("vision")) observationCameras.push({ id: "site_context_rgb", role: "context", required: false, defaultEnabled: true });
  const embodimentType = normalized.includes("humanoid")
    ? "humanoid"
    : normalized.includes("arm")
      ? "fixed_arm"
      : normalized.includes("cart")
        ? "cart"
        : normalized.includes("amr") || normalized.includes("mobile")
          ? "mobile_manipulator"
          : normalized.includes("tug")
            ? "mobile_base"
            : "other";

  return {
    id: `${embodimentType}_sample`,
    displayName: sampleRobot,
    embodimentType,
    observationCameras: observationCameras.length > 0
      ? observationCameras
      : [{ id: "primary_rgb", role: "head", required: true, defaultEnabled: true }],
    actionSpace: {
      name: embodimentType === "fixed_arm" ? "joint_delta_gripper" : "ee_delta_pose_gripper",
      dim: 7,
      labels: ["x", "y", "z", "roll", "pitch", "yaw", "gripper"],
    },
    actionSpaceSummary: normalized.includes("arm")
      ? "End-effector pose deltas plus gripper open/close."
      : normalized.includes("humanoid")
        ? "Base locomotion, torso reach, and hand state transitions."
        : normalized.includes("cart") || normalized.includes("tug")
          ? "Base motion, docking alignment, and handoff state changes."
          : "Bounded robot action vector for site-conditioned rollout control.",
    gripperSemantics: normalized.includes("arm") || normalized.includes("picker") || normalized.includes("assistant")
      ? "Binary grasp / release state on the active manipulator."
      : normalized.includes("humanoid")
        ? "Task-level hand closure and release semantics."
        : "No explicit gripper profile provided.",
    baseSemantics: normalized.includes("cart")
      || normalized.includes("tug")
      || normalized.includes("amr")
      || normalized.includes("mobile")
      ? "Planar base translation with heading control for lane and aisle navigation."
      : normalized.includes("humanoid")
        ? "Footstep and body-pose control for approach and handoff alignment."
        : "Stationary or task-local base semantics.",
    urdfRef: null,
    usdRef: null,
    allowedPolicyAdapters: ["openvla_oft", "pi05", "dreamzero"],
    defaultPolicyAdapter: "openvla_oft",
  };
}

function buildFallbackRuntimeManifest(template: SiteWorldCard): SiteWorldCard["runtimeManifest"] {
  return {
    defaultBackend: template.defaultRuntimeBackend,
    runtimeBaseUrl: null,
    websocketBaseUrl: null,
    supportedCameras: template.sampleRobotProfile.observationCameras.map((item) => item.id),
    launchableBackends: template.availableRuntimeBackends,
    exportModes: ["raw_bundle", "rlds_dataset"],
    supportsStepRollout: true,
    supportsBatchRollout: true,
    supportsCameraViews: true,
    supportsStream: false,
    healthStatus: "unknown",
    launchable: false,
  };
}

function buildFallbackTaskCatalog(template: SiteWorldCard): SiteWorldCard["taskCatalog"] {
  return [
    {
      id: `${template.id}-task-1`,
      taskId: `${template.id}-task-1`,
      taskText: template.sampleTask,
      taskCategory: "generic",
    },
  ];
}

function buildFallbackScenarioCatalog(template: SiteWorldCard): SiteWorldCard["scenarioCatalog"] {
  return template.scenarioVariants.map((name, index) => ({
    id: `${template.id}-scenario-${index + 1}`,
    name,
    source: "static",
  }));
}

function buildFallbackStartStateCatalog(template: SiteWorldCard): SiteWorldCard["startStateCatalog"] {
  return template.startStates.map((name, index) => ({
    id: `${template.id}-start-${index + 1}`,
    name,
    taskId: `${template.id}-task-1`,
    source: "static",
  }));
}

function normalizeRobotProfiles(value: unknown, fallback: SiteWorldCard["sampleRobotProfile"]): SiteWorldCard["robotProfiles"] {
  if (!Array.isArray(value) || value.length === 0) {
    return [fallback];
  }
  return value
    .filter((item) => typeof item === "object" && item !== null)
    .map((item) => {
      const profile = item as Record<string, unknown>;
      return {
        id: String(profile.id || fallback.id || ""),
        displayName: String(profile.display_name || profile.displayName || fallback.displayName),
        embodimentType: String(profile.embodiment_type || profile.embodimentType || fallback.embodimentType) as SiteWorldCard["sampleRobotProfile"]["embodimentType"],
        observationCameras: Array.isArray(profile.observation_cameras)
          ? (profile.observation_cameras as Array<Record<string, unknown>>).map((camera) => ({
              id: String(camera.id || ""),
              role: String(camera.role || ""),
              required: Boolean(camera.required),
              defaultEnabled: Boolean(camera.default_enabled ?? camera.defaultEnabled),
            }))
          : fallback.observationCameras,
        actionSpace: typeof profile.action_space === "object" && profile.action_space
          ? {
              name: String((profile.action_space as Record<string, unknown>).name || fallback.actionSpace.name),
              dim: Number((profile.action_space as Record<string, unknown>).dim || fallback.actionSpace.dim),
              labels: Array.isArray((profile.action_space as Record<string, unknown>).labels)
                ? ((profile.action_space as Record<string, unknown>).labels as unknown[]).map((item) => String(item))
                : fallback.actionSpace.labels,
            }
          : fallback.actionSpace,
        actionSpaceSummary: fallback.actionSpaceSummary,
        gripperSemantics: String(profile.gripper_semantics || profile.gripperSemantics || fallback.gripperSemantics || ""),
        baseSemantics: String(profile.base_semantics || profile.baseSemantics || fallback.baseSemantics || ""),
        urdfRef: profile.urdf_uri ? String(profile.urdf_uri) : fallback.urdfRef,
        usdRef: profile.usd_uri ? String(profile.usd_uri) : fallback.usdRef,
        allowedPolicyAdapters: Array.isArray(profile.allowed_policy_adapters)
          ? (profile.allowed_policy_adapters as unknown[]).map((item) => String(item))
          : fallback.allowedPolicyAdapters,
        defaultPolicyAdapter: String(profile.default_policy_adapter || profile.defaultPolicyAdapter || fallback.defaultPolicyAdapter || ""),
      };
    });
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function timestampToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function legacyStatusToQualificationState(status?: string | null): QualificationState {
  switch (status) {
    case "triaging":
      return "in_review";
    case "scheduled":
      return "capture_requested";
    case "qualified":
      return "qualified_ready";
    case "disqualified":
      return "not_ready_yet";
    case "closed":
      return "not_ready_yet";
    default:
      return "submitted";
  }
}

function normalizeQualificationState(request: InboundRequest): QualificationState {
  if (request.qualification_state) {
    return request.qualification_state;
  }
  return legacyStatusToQualificationState(request.status);
}

function normalizeOpportunityState(request: InboundRequest, qualificationState: QualificationState): OpportunityState {
  if (request.opportunity_state) {
    return request.opportunity_state;
  }
  if (qualificationState === "qualified_ready" || qualificationState === "qualified_risky") {
    return "handoff_ready";
  }
  return "not_applicable";
}

async function readArtifactJson(uri?: string | null): Promise<ArtifactJson> {
  const normalized = String(uri || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    if (normalized.startsWith("gs://")) {
      if (!storageAdmin) return null;
      const { bucket, objectPath } = parseGsUri(normalized);
      const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
      const payload = JSON.parse(buffer.toString("utf-8"));
      return typeof payload === "object" && payload ? (payload as Record<string, unknown>) : null;
    }

    const fs = await import("node:fs/promises");
    const text = await fs.readFile(normalized, "utf-8");
    const payload = JSON.parse(text);
    return typeof payload === "object" && payload ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function pipelineArtifactUri(
  pipeline: PipelineAttachment | undefined,
  explicitValue: string | null | undefined,
  relativePath: string,
): string | null {
  const explicit = String(explicitValue || "").trim();
  if (explicit) {
    return explicit;
  }
  const pipelinePrefix = String(pipeline?.pipeline_prefix || "").trim();
  if (!pipelinePrefix) {
    return null;
  }
  const bucket = process.env.FIREBASE_STORAGE_BUCKET || "blueprint-8c1ca.appspot.com";
  return `gs://${bucket}/${pipelinePrefix}/${relativePath}`;
}

function buildFallbackPackages(siteId: string, siteName: string, siteAddress: string, sampleTask: string, sampleRobot: string): [SiteWorldPackage, SiteWorldPackage] {
  const params = new URLSearchParams({
    interest: "data-licensing",
    buyerType: "robot_team",
    source: "site-worlds",
    siteName,
    siteLocation: siteAddress,
    taskStatement: sampleTask,
    targetRobotTeam: sampleRobot,
  });

  return [
    {
      name: "Scene Package",
      summary: "Review the qualified site package and deployment-readiness artifacts for this exact workflow area.",
      priceLabel: "Quoted per site",
      payerLabel: "Likely buyer: Robot team",
      actionLabel: "Request scene package",
      actionHref: `/contact?${params.toString()}`,
      deliverables: [
        "Readiness verdict",
        "Scene-memory and task manifests",
        "Compatibility and export summaries",
        "Rights and sharing terms",
      ],
      emphasis: "recommended",
    },
    {
      name: "Hosted Sessions",
      summary: "Launch Blueprint-managed evaluation sessions when this site is ready for downstream testing.",
      priceLabel: "Quoted per session",
      payerLabel: "Likely buyer: Robot team",
      actionLabel: "Start hosted session",
      actionHref: `/site-worlds/${siteId}/start`,
      deliverables: [
        "Managed runtime",
        "Scenario variants",
        "Rollout exports",
        "Episode summaries",
      ],
    },
  ];
}

function fallbackCapabilityEnvelope(template?: SiteWorldCard): RobotCapabilityEnvelope {
  return {
    embodiment_type: template?.sampleRobot?.toLowerCase().includes("humanoid")
      ? "humanoid"
      : template?.sampleRobot?.toLowerCase().includes("arm")
        ? "fixed_arm"
        : "mobile_manipulator",
    minimum_path_width_m: 0.95,
    maximum_reach_m: 1.1,
    maximum_payload_kg: null,
    sensor_requirements: template?.runtime ? [template.runtime] : [],
    controller_interface_assumptions: ["policy checkpoint interface", "bounded rollout execution"],
    safety_envelope: ["qualification-backed task scope", "operator-defined restricted zones"],
    facility_constraints: [],
  };
}

function buildFallbackRights(request: InboundRequest): RightsAndComplianceSummary {
  const exportEntitlements = [
    request.request.captureRights,
    request.request.derivedScenePermission,
    request.request.datasetLicensingPermission,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  return {
    consent_scope: [],
    export_entitlements: exportEntitlements,
    customer_specific_sharing: [],
    audit_trail_uri: null,
    retention_policy: null,
  };
}

function extractCapabilityEnvelope(compatibilityMatrix: ArtifactJson, template?: SiteWorldCard): RobotCapabilityEnvelope {
  const envelope = compatibilityMatrix?.reference_capability_envelope;
  if (envelope && typeof envelope === "object") {
    return envelope as RobotCapabilityEnvelope;
  }
  return fallbackCapabilityEnvelope(template);
}

function extractRightsSummary(siteNormalization: ArtifactJson, request: InboundRequest): RightsAndComplianceSummary {
  const rights = siteNormalization?.rights_and_compliance;
  if (rights && typeof rights === "object") {
    return rights as RightsAndComplianceSummary;
  }
  return buildFallbackRights(request);
}

function extractExports(launchableExportBundle: ArtifactJson, pipeline: PipelineAttachment | undefined): string[] {
  const bundles = launchableExportBundle?.bundles;
  if (bundles && typeof bundles === "object") {
    return Object.entries(bundles)
      .filter(([, value]) => typeof value === "object" && value && (value as { launchable?: boolean }).launchable)
      .map(([key]) => key);
  }

  const exports: string[] = [];
  if (pipeline?.artifacts.scene_memory_manifest_uri) exports.push("scene_memory");
  if (pipeline?.artifacts.preview_simulation_manifest_uri) exports.push("preview_simulation");
  if (pipeline?.artifacts.site_world_registration_uri || pipeline?.pipeline_prefix) exports.push("site_world_runtime");
  return exports;
}

function deriveBenchmarkStatus(benchmarkSuite: ArtifactJson, pipeline: PipelineAttachment | undefined): {
  status: "missing" | "partial" | "ready";
  taskCount: number;
  categories: string[];
} {
  const tasks = Array.isArray(benchmarkSuite?.tasks) ? (benchmarkSuite?.tasks as Array<Record<string, unknown>>) : [];
  const categories = Array.isArray(benchmarkSuite?.task_categories)
    ? (benchmarkSuite?.task_categories as unknown[]).map((item) => String(item)).filter(Boolean)
    : [];

  if (typeof benchmarkSuite?.status === "string") {
    return {
      status: benchmarkSuite.status === "ready" ? "ready" : benchmarkSuite.status === "partial" ? "partial" : "missing",
      taskCount: tasks.length,
      categories,
    };
  }

  if (pipeline?.artifacts.site_world_spec_uri || pipeline?.pipeline_prefix) {
    return { status: "partial", taskCount: tasks.length, categories };
  }

  return { status: "missing", taskCount: 0, categories: [] };
}

function deriveRecapture(recaptureDiff: ArtifactJson, qualificationState: QualificationState): {
  status: DeploymentReadinessSummary["recapture_status"];
  required: boolean;
  missingEvidence: string[];
} {
  const missingEvidence = Array.isArray(recaptureDiff?.changed_fields)
    ? (recaptureDiff?.changed_fields as unknown[]).map((item) => String(item)).filter(Boolean)
    : [];

  if (typeof recaptureDiff?.status === "string") {
    return {
      status: recaptureDiff.status as DeploymentReadinessSummary["recapture_status"],
      required: Boolean(recaptureDiff?.recapture_required),
      missingEvidence,
    };
  }

  if (qualificationState === "needs_refresh") {
    return { status: "review_required", required: true, missingEvidence };
  }

  return { status: "not_requested", required: false, missingEvidence: [] };
}

function buildDeploymentReadiness({
  request,
  qualificationState,
  opportunityState,
  pipeline,
  siteNormalization,
  benchmarkSuite,
  compatibilityMatrix,
  recaptureDiff,
  launchableExportBundle,
  template,
}: {
  request: InboundRequest;
  qualificationState: QualificationState;
  opportunityState: OpportunityState;
  pipeline: PipelineAttachment | undefined;
  siteNormalization: ArtifactJson;
  benchmarkSuite: ArtifactJson;
  compatibilityMatrix: ArtifactJson;
  recaptureDiff: ArtifactJson;
  launchableExportBundle: ArtifactJson;
  template?: SiteWorldCard;
}): DeploymentReadinessSummary & {
  qualification_state: QualificationState;
  opportunity_state: OpportunityState;
  exports_available: string[];
  task_categories: string[];
  runtime_label: string;
} {
  const benchmark = deriveBenchmarkStatus(benchmarkSuite, pipeline);
  const recapture = deriveRecapture(recaptureDiff, qualificationState);
  const exportsAvailable = extractExports(launchableExportBundle, pipeline);
  const runtimeLabel = String(launchableExportBundle?.public_runtime_label || template?.runtime || "Qualified site runtime");

  return {
    qualification_state: qualificationState,
    opportunity_state: opportunityState,
    benchmark_coverage_status: benchmark.status,
    benchmark_task_count: benchmark.taskCount,
    export_readiness_status: exportsAvailable.length > 0 ? "ready" : pipeline?.artifacts.site_world_registration_uri ? "partial" : "missing",
    recapture_status: recapture.status,
    recapture_required: recapture.required,
    freshness_date: timestampToIso(pipeline?.synced_at) || timestampToIso(request.createdAt) || null,
    missing_evidence: recapture.missingEvidence,
    capability_envelope: extractCapabilityEnvelope(compatibilityMatrix, template),
    rights_and_compliance: extractRightsSummary(siteNormalization, request),
    exports_available: exportsAvailable,
    task_categories: benchmark.categories,
    runtime_label: runtimeLabel,
  };
}

function buildStaticRecord(template: SiteWorldCard): SiteWorldCard {
  const presentationDemoReadiness =
    template.presentationDemoReadiness || {
      launchable: false,
      blockers: ["missing presentation package", "site not launchable yet"],
      presentationWorldManifestUri: null,
      runtimeDemoManifestUri: null,
      status: "presentation_assets_missing" as const,
      uiBaseUrl: null,
    };
  return {
    ...template,
    runtimeManifest:
      template.id === DEMO_SITE_WORLD_ID
        ? resolveDemoRuntimeManifest(template.runtimeManifest || buildFallbackRuntimeManifest(template))
        : template.runtimeManifest || buildFallbackRuntimeManifest(template),
    taskCatalog: template.taskCatalog || buildFallbackTaskCatalog(template),
    scenarioCatalog: template.scenarioCatalog || buildFallbackScenarioCatalog(template),
    startStateCatalog: template.startStateCatalog || buildFallbackStartStateCatalog(template),
    robotProfiles: template.robotProfiles || [template.sampleRobotProfile],
    exportModes: template.exportModes || ["raw_bundle", "rlds_dataset"],
    presentationDemoReadiness,
    artifactExplorer:
      template.artifactExplorer ||
      buildArtifactExplorer({
        template,
        siteWorldId: template.id,
        sceneId: template.sceneId,
        captureId: template.captureId,
        siteWorldSpecUri: template.siteWorldSpecUri ?? null,
        sceneMemoryManifestUri: template.sceneMemoryManifestUri ?? null,
        conditioningBundleUri: template.conditioningBundleUri ?? null,
        presentationWorldManifestUri: presentationDemoReadiness.presentationWorldManifestUri ?? null,
        runtimeDemoManifestUri: presentationDemoReadiness.runtimeDemoManifestUri ?? null,
      }),
    sceneMemoryManifestUri: template.sceneMemoryManifestUri ?? null,
    conditioningBundleUri: template.conditioningBundleUri ?? null,
    siteWorldSpecUri: template.siteWorldSpecUri ?? null,
    siteWorldRegistrationUri: template.siteWorldRegistrationUri ?? null,
    siteWorldHealthUri: template.siteWorldHealthUri ?? null,
    dataSource: template.dataSource || "static",
  };
}

function findStaticSiteWorldById(id: string): SiteWorldCard | null {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) {
    return null;
  }

  const template = siteWorldCards.find(
    (item) =>
      item.id === normalizedId ||
      item.siteSubmissionId === normalizedId ||
      item.sceneId === normalizedId ||
      item.captureId === normalizedId,
  );
  return template ? buildStaticRecord(template) : null;
}

async function buildLiveRecord(
  requestId: string,
  request: InboundRequest,
): Promise<SiteWorldCard | null> {
  const qualificationState = normalizeQualificationState(request);
  const opportunityState = normalizeOpportunityState(request, qualificationState);
  if (!LIVE_QUALIFICATION_STATES.has(qualificationState) && !LIVE_OPPORTUNITY_STATES.has(opportunityState)) {
    return null;
  }

  const pipeline = request.pipeline;
  const siteSubmissionId = request.site_submission_id || requestId;
  const template = siteWorldCards.find(
    (item) =>
      item.id === siteSubmissionId ||
      item.siteSubmissionId === siteSubmissionId ||
      item.sceneId === pipeline?.scene_id ||
      item.captureId === pipeline?.capture_id,
  );

  const generatedId =
    template?.id ||
    `sw-${slugify(siteSubmissionId || request.request.siteName || requestId) || requestId.slice(0, 8)}`;
  const sceneId = String(pipeline?.scene_id || template?.sceneId || siteSubmissionId);
  const captureId = String(pipeline?.capture_id || template?.captureId || requestId);
  const pipelinePrefix = String(pipeline?.pipeline_prefix || template?.pipelinePrefix || "");
  const siteName = request.request.siteName || template?.siteName || "Qualified site";
  const siteAddress = request.request.siteLocation || template?.siteAddress || "Location pending";
  const sampleTask = request.request.taskStatement || template?.sampleTask || "Review the qualified workflow";
  const sampleRobot = request.request.targetRobotTeam || template?.sampleRobot || "Robot team";

  const [
    siteNormalization,
    benchmarkSuite,
    compatibilityMatrix,
    recaptureDiff,
    launchableExportBundle,
    siteWorldSpec,
    siteWorldRegistration,
    siteWorldHealth,
    presentationWorldManifest,
    runtimeDemoManifest,
  ] =
    await Promise.all([
      readArtifactJson(
        pipelineArtifactUri(
          pipeline,
          pipeline?.artifacts.site_normalization_package_uri,
          "evaluation_prep/site_normalization_package.json",
        ),
      ),
      readArtifactJson(
        pipelineArtifactUri(
          pipeline,
          pipeline?.artifacts.benchmark_suite_manifest_uri,
          "evaluation_prep/benchmark_suite_manifest.json",
        ),
      ),
      readArtifactJson(
        pipelineArtifactUri(
          pipeline,
          pipeline?.artifacts.compatibility_matrix_uri,
          "evaluation_prep/compatibility_matrix.json",
        ),
      ),
      readArtifactJson(
        pipelineArtifactUri(
          pipeline,
          pipeline?.artifacts.recapture_diff_uri,
          "evaluation_prep/recapture_diff.json",
        ),
      ),
      readArtifactJson(
        pipelineArtifactUri(
          pipeline,
          pipeline?.artifacts.launchable_export_bundle_uri,
          "evaluation_prep/launchable_export_bundle.json",
        ),
      ),
      readArtifactJson(
        pipelineArtifactUri(
          pipeline,
          pipeline?.artifacts.site_world_spec_uri,
          "evaluation_prep/site_world_spec.json",
        ),
      ),
      readArtifactJson(
        pipelineArtifactUri(
          pipeline,
          pipeline?.artifacts.site_world_registration_uri,
          "evaluation_prep/site_world_registration.json",
        ),
      ),
      readArtifactJson(
        pipelineArtifactUri(
          pipeline,
          pipeline?.artifacts.site_world_health_uri,
          "evaluation_prep/site_world_health.json",
        ),
      ),
      readArtifactJson(resolvePresentationWorldManifestUri(pipeline)),
      readArtifactJson(resolveRuntimeDemoManifestUri(pipeline)),
    ]);

  const readiness = buildDeploymentReadiness({
    request,
    qualificationState,
    opportunityState,
    pipeline,
    siteNormalization,
    benchmarkSuite,
    compatibilityMatrix,
    recaptureDiff,
    launchableExportBundle,
    template,
  });

  const packages =
    template?.packages ||
    buildFallbackPackages(generatedId, siteName, siteAddress, sampleTask, sampleRobot);

  const fallbackRobotProfile = template?.sampleRobotProfile || deriveSampleRobotProfile(sampleRobot, readiness.runtime_label);
  const taskCatalog = Array.isArray(siteWorldSpec?.task_catalog)
    ? (siteWorldSpec?.task_catalog as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id || item.task_id || ""),
        taskId: item.task_id ? String(item.task_id) : String(item.id || ""),
        taskText: String(item.task_text || item.name || sampleTask),
        taskCategory: item.task_category ? String(item.task_category) : "generic",
      }))
    : template?.taskCatalog || buildFallbackTaskCatalog(template || buildStaticRecord(siteWorldCards[0]));
  const startStateCatalog = Array.isArray(siteWorldSpec?.start_state_catalog)
    ? (siteWorldSpec?.start_state_catalog as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || "default_start_state"),
        taskId: item.task_id ? String(item.task_id) : undefined,
        source: item.source ? String(item.source) : undefined,
      }))
    : template?.startStateCatalog || buildFallbackStartStateCatalog(template || buildStaticRecord(siteWorldCards[0]));
  const scenarioCatalog = Array.isArray(siteWorldRegistration?.scenario_catalog)
    ? (siteWorldRegistration?.scenario_catalog as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || "default"),
        source: item.source ? String(item.source) : undefined,
      }))
    : template?.scenarioCatalog || buildFallbackScenarioCatalog(template || buildStaticRecord(siteWorldCards[0]));
  const robotProfiles = normalizeRobotProfiles(siteWorldRegistration?.robot_profiles || siteWorldSpec?.robot_profiles, fallbackRobotProfile);
  const startStates = startStateCatalog.map((item) => item.name).filter(Boolean);
  const scenarioVariants = scenarioCatalog.map((item) => item.name).filter(Boolean);
  const exportModes = template?.exportModes || ["raw_bundle", "rlds_dataset"];
  const runtimeCapabilities =
    siteWorldRegistration && typeof siteWorldRegistration.runtime_capabilities === "object"
      ? (siteWorldRegistration.runtime_capabilities as Record<string, unknown>)
      : {};
  const runtimeManifest = siteWorldRegistration
    ? {
        defaultBackend: "neoverse",
        runtimeBaseUrl: String(siteWorldRegistration.runtime_base_url || ""),
        websocketBaseUrl: String(siteWorldRegistration.websocket_base_url || ""),
        supportedCameras: Array.isArray(siteWorldRegistration.supported_cameras)
          ? (siteWorldRegistration.supported_cameras as unknown[]).map((item) => String(item))
          : [],
        exportModes,
        launchableBackends: ["neoverse"],
        supportsStepRollout: Boolean(runtimeCapabilities.supports_step_rollout ?? true),
        supportsBatchRollout: Boolean(runtimeCapabilities.supports_batch_rollout ?? true),
        supportsCameraViews: Boolean(runtimeCapabilities.supports_camera_views ?? true),
        supportsStream: Boolean(runtimeCapabilities.supports_stream ?? true),
        healthStatus: String(siteWorldHealth?.status || "unknown"),
        launchable: Boolean(siteWorldHealth?.launchable ?? true),
      }
    : template?.runtimeManifest || buildFallbackRuntimeManifest(template || buildStaticRecord(siteWorldCards[0]));
  const presentationDemoReadiness = buildPresentationDemoReadiness({
    pipeline,
    launchable: Boolean(siteWorldHealth?.launchable ?? runtimeManifest.launchable),
    presentationWorldManifest,
    runtimeDemoManifest,
    siteWorldId: generatedId,
    sceneId,
    captureId,
  });
  const sceneMemoryManifestUri = pipelineArtifactUri(
    pipeline,
    pipeline?.artifacts.scene_memory_manifest_uri,
    "scene_memory/scene_memory_manifest.json",
  );
  const conditioningBundleUri = pipelineArtifactUri(
    pipeline,
    pipeline?.artifacts.conditioning_bundle_uri,
    "scene_memory/conditioning_bundle.json",
  );
  const siteWorldSpecUri = pipelineArtifactUri(
    pipeline,
    pipeline?.artifacts.site_world_spec_uri,
    "evaluation_prep/site_world_spec.json",
  );
  const siteWorldRegistrationUri = pipelineArtifactUri(
    pipeline,
    pipeline?.artifacts.site_world_registration_uri,
    "evaluation_prep/site_world_registration.json",
  );
  const siteWorldHealthUri = pipelineArtifactUri(
    pipeline,
    pipeline?.artifacts.site_world_health_uri,
    "evaluation_prep/site_world_health.json",
  );
  const artifactExplorer = buildArtifactExplorer({
    template,
    siteWorldId: generatedId,
    sceneId,
    captureId,
    siteWorldSpecUri,
    sceneMemoryManifestUri,
    conditioningBundleUri,
    presentationWorldManifestUri: presentationDemoReadiness?.presentationWorldManifestUri ?? null,
    runtimeDemoManifestUri: presentationDemoReadiness?.runtimeDemoManifestUri ?? null,
    presentationWorldManifest,
    runtimeDemoManifest,
  });

  return {
    ...(template || {
      id: generatedId,
      siteCode: `LIVE-${requestId.slice(0, 6).toUpperCase()}`,
      category: "Logistics",
      industry: "Qualified site",
      tone: "from-slate-100 via-white to-slate-50",
      accent: "#0f172a",
      thumbnailKind: "parcel" as const,
      summary: "Qualified deployment-readiness record prepared from pipeline artifacts.",
      bestFor: "Teams reviewing exact-site readiness before a pilot.",
      runtime: readiness.runtime_label,
      defaultRuntimeBackend: runtimeManifest.defaultBackend,
      availableRuntimeBackends: runtimeManifest.launchableBackends,
      samplePolicy: "Submitted checkpoint",
      exportArtifacts: readiness.exports_available,
      startStates,
      scenarioVariants,
      runtimeManifest,
      taskCatalog,
      scenarioCatalog,
      startStateCatalog,
      robotProfiles,
      exportModes,
      packages,
      siteName,
      siteAddress,
      sceneId,
      captureId,
      siteSubmissionId,
      pipelinePrefix,
      taskLane: sampleTask,
      sampleRobot,
      sampleRobotProfile: robotProfiles[0] || fallbackRobotProfile,
      sampleTask,
    }),
    id: generatedId,
    siteName,
    siteAddress,
    sceneId,
    captureId,
    siteSubmissionId,
    pipelinePrefix,
    taskLane: template?.taskLane || sampleTask,
    summary:
      String(siteNormalization?.summary || "").trim() ||
      template?.summary ||
      "Qualified site packaged for deployment-readiness review and downstream evaluation.",
    bestFor: template?.bestFor || "Deployment readiness review on one exact site.",
    runtime: readiness.runtime_label,
    defaultRuntimeBackend: runtimeManifest.defaultBackend,
    availableRuntimeBackends: runtimeManifest.launchableBackends,
    sampleRobot,
    sampleRobotProfile: robotProfiles[0] || fallbackRobotProfile,
    sampleTask,
    startStates,
    scenarioVariants,
    exportArtifacts: readiness.exports_available.length > 0 ? readiness.exports_available : template?.exportArtifacts || [],
    runtimeManifest,
    taskCatalog,
    scenarioCatalog,
    startStateCatalog,
    robotProfiles,
    exportModes,
    packages,
    presentationDemoReadiness,
    artifactExplorer,
    sceneMemoryManifestUri,
    conditioningBundleUri,
    siteWorldSpecUri,
    siteWorldRegistrationUri,
    siteWorldHealthUri,
    dataSource: "pipeline",
    deploymentReadiness: readiness,
  };
}

export async function listPublicSiteWorlds(limit = 24): Promise<SiteWorldCard[]> {
  if (!db) {
    return siteWorldCards.slice(0, limit).map(buildStaticRecord);
  }

  const snapshot = await db.collection("inboundRequests").orderBy("createdAt", "desc").limit(100).get();
  const liveRecords = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const decrypted = (await decryptInboundRequestForAdmin(doc.data() as InboundRequestStored)) as InboundRequest;
      return buildLiveRecord(doc.id, decrypted);
    }),
  );

  const deduped = new Map<string, SiteWorldCard>();
  for (const record of liveRecords) {
    if (record) {
      deduped.set(record.id, record);
    }
  }

  for (const template of siteWorldCards) {
    if (!deduped.has(template.id)) {
      deduped.set(template.id, buildStaticRecord(template));
    }
  }

  return Array.from(deduped.values()).slice(0, limit);
}

export async function getPublicSiteWorldById(id: string): Promise<SiteWorldCard | null> {
  const staticRecord = findStaticSiteWorldById(id);
  if (staticRecord) {
    return staticRecord;
  }

  const catalog = await listPublicSiteWorlds(100);
  return (
    catalog.find(
      (item) =>
        item.id === id ||
        item.siteSubmissionId === id ||
        item.sceneId === id ||
        item.captureId === id,
    ) || null
  );
}

export async function resolvePublicSiteWorldExplorerAssetPath(siteWorldId: string, relativePath: string): Promise<string | null> {
  if (siteWorldId !== DEMO_SITE_WORLD_ID) {
    return null;
  }
  const normalized = path.normalize(String(relativePath || "").trim()).replace(/^(\.\.(\/|\\|$))+/, "");
  if (!normalized || normalized.startsWith("..")) {
    return null;
  }
  const resolved = path.resolve(DEMO_BUNDLE_PIPELINE_ROOT, normalized);
  const allowedRoot = path.resolve(DEMO_BUNDLE_PIPELINE_ROOT);
  if (!resolved.startsWith(`${allowedRoot}${path.sep}`) && resolved !== allowedRoot) {
    return null;
  }
  return fs.existsSync(resolved) ? resolved : null;
}
