import { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { siteWorldCards, type SiteWorldCard, type SiteWorldPackage } from "../../client/src/data/siteWorlds";
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
    launchableBackends: template.availableRuntimeBackends,
    exportModes: ["raw_bundle", "rlds_dataset"],
    supportsStepRollout: true,
    supportsBatchRollout: true,
    supportsCameraViews: true,
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
  if (pipeline?.artifacts.hosted_session_runtime_manifest_uri) exports.push("hosted_session_runtime");
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

  if (pipeline?.artifacts.task_anchor_manifest_uri || pipeline?.artifacts.task_run_manifest_uri) {
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
    export_readiness_status: exportsAvailable.length > 0 ? "ready" : pipeline?.artifacts.hosted_session_runtime_manifest_uri ? "partial" : "missing",
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
  return {
    ...template,
    runtimeManifest: template.runtimeManifest || buildFallbackRuntimeManifest(template),
    taskCatalog: template.taskCatalog || buildFallbackTaskCatalog(template),
    scenarioCatalog: template.scenarioCatalog || buildFallbackScenarioCatalog(template),
    startStateCatalog: template.startStateCatalog || buildFallbackStartStateCatalog(template),
    robotProfiles: template.robotProfiles || [template.sampleRobotProfile],
    exportModes: template.exportModes || ["raw_bundle", "rlds_dataset"],
    dataSource: "static",
  };
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
    hostedRuntimeManifest,
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
          pipeline?.artifacts.hosted_session_runtime_manifest_uri,
          "evaluation_prep/hosted_session_runtime_manifest.json",
        ),
      ),
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
  const taskCatalog = Array.isArray(hostedRuntimeManifest?.task_catalog)
    ? (hostedRuntimeManifest?.task_catalog as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id || item.task_id || ""),
        taskId: item.task_id ? String(item.task_id) : String(item.id || ""),
        taskText: String(item.task_text || item.name || sampleTask),
        taskCategory: item.task_category ? String(item.task_category) : "generic",
      }))
    : template?.taskCatalog || buildFallbackTaskCatalog(template || buildStaticRecord(siteWorldCards[0]));
  const startStateCatalog = Array.isArray(hostedRuntimeManifest?.start_state_catalog)
    ? (hostedRuntimeManifest?.start_state_catalog as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || "default_start_state"),
        taskId: item.task_id ? String(item.task_id) : undefined,
        source: item.source ? String(item.source) : undefined,
      }))
    : template?.startStateCatalog || buildFallbackStartStateCatalog(template || buildStaticRecord(siteWorldCards[0]));
  const scenarioCatalog = Array.isArray(hostedRuntimeManifest?.scenario_catalog)
    ? (hostedRuntimeManifest?.scenario_catalog as Array<Record<string, unknown>>).map((item) => ({
        id: String(item.id || ""),
        name: String(item.name || "default"),
        source: item.source ? String(item.source) : undefined,
      }))
    : template?.scenarioCatalog || buildFallbackScenarioCatalog(template || buildStaticRecord(siteWorldCards[0]));
  const robotProfiles = normalizeRobotProfiles(hostedRuntimeManifest?.robot_profiles, fallbackRobotProfile);
  const startStates = startStateCatalog.map((item) => item.name).filter(Boolean);
  const scenarioVariants = scenarioCatalog.map((item) => item.name).filter(Boolean);
  const exportModes = Array.isArray(hostedRuntimeManifest?.export_defaults)
    ? (hostedRuntimeManifest?.export_defaults as unknown[]).map((item) => String(item)).filter(Boolean)
    : template?.exportModes || ["raw_bundle", "rlds_dataset"];
  const runtimeCapabilities =
    hostedRuntimeManifest && typeof hostedRuntimeManifest.runtime_capabilities === "object"
      ? (hostedRuntimeManifest.runtime_capabilities as Record<string, unknown>)
      : {};
  const runtimeManifest = hostedRuntimeManifest
    ? {
        defaultBackend: String(hostedRuntimeManifest.default_backend || template?.defaultRuntimeBackend || "neoverse"),
        launchableBackends: Array.isArray(hostedRuntimeManifest.launchable_backends)
          ? (hostedRuntimeManifest.launchable_backends as unknown[]).map((item) => String(item))
          : template?.availableRuntimeBackends || ["neoverse", "gen3c"],
        exportModes,
        supportsStepRollout: Boolean(hostedRuntimeManifest.supports_step_rollout ?? runtimeCapabilities.supports_step_rollout ?? true),
        supportsBatchRollout: Boolean(hostedRuntimeManifest.supports_batch_rollout ?? runtimeCapabilities.supports_batch_rollout ?? true),
        supportsCameraViews: Boolean(hostedRuntimeManifest.supports_camera_views ?? runtimeCapabilities.supports_camera_views ?? true),
      }
    : template?.runtimeManifest || buildFallbackRuntimeManifest(template || buildStaticRecord(siteWorldCards[0]));

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
