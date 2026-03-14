export type HostedSessionStatus =
  | "creating"
  | "ready"
  | "running"
  | "stopped"
  | "failed";

export type HostedSessionMode = "presentation_demo" | "runtime_only";

export type HostedSessionRuntimeUi = "neoverse_gradio" | null;

export type EmbodimentType =
  | "humanoid"
  | "mobile_manipulator"
  | "fixed_arm"
  | "mobile_base"
  | "cart"
  | "other";

export interface RobotObservationCamera {
  id: string;
  role: string;
  required: boolean;
  defaultEnabled: boolean;
  available?: boolean;
  framePath?: string | null;
}

export interface RobotActionSpace {
  name: string;
  dim: number;
  labels: string[];
}

export interface RobotProfile {
  id?: string;
  displayName: string;
  embodimentType: EmbodimentType;
  observationCameras: RobotObservationCamera[];
  actionSpace: RobotActionSpace;
  actionSpaceSummary: string;
  gripperSemantics?: string | null;
  baseSemantics?: string | null;
  urdfRef?: string | null;
  usdRef?: string | null;
  allowedPolicyAdapters?: string[];
  defaultPolicyAdapter?: string | null;
}

export interface TaskCatalogEntry {
  id: string;
  taskId?: string | null;
  taskText: string;
  taskCategory?: string | null;
}

export interface ScenarioCatalogEntry {
  id: string;
  name: string;
  source?: string | null;
}

export interface StartStateCatalogEntry {
  id: string;
  name: string;
  taskId?: string | null;
  source?: string | null;
}

export interface BackendVariantSummary {
  backendId: string;
  bundleManifestUri?: string | null;
  adapterManifestUri?: string | null;
  launchable: boolean;
  readinessState: string;
  blockers: string[];
  warnings: string[];
  runtimeMode: string;
  groundingStatus?: string | null;
  provenance?: Record<string, unknown> | null;
  conversion?: Record<string, unknown> | null;
  qualityFlags?: Record<string, unknown> | null;
  canonicalWriteAllowed?: boolean | null;
}

export interface SiteWorldRuntimeSummary {
  defaultBackend: string;
  runtimeBaseUrl?: string | null;
  websocketBaseUrl?: string | null;
  supportedCameras?: string[];
  exportModes?: string[];
  launchableBackends: string[];
  supportsStepRollout: boolean;
  supportsBatchRollout: boolean;
  supportsCameraViews: boolean;
  supportsStream?: boolean;
  healthStatus?: string | null;
  launchable?: boolean;
  backendVariants?: Record<string, BackendVariantSummary>;
}

export type RuntimeManifestSummary = SiteWorldRuntimeSummary;

export interface TaskSelection {
  taskId: string;
  taskText: string;
}

export interface RuntimeConfig {
  scenarioId: string;
  startStateId: string;
  seed?: number | null;
  requestedBackend?: string | null;
}

export interface HostedRuntimeSessionConfig {
  canonical_package_uri?: string | null;
  canonical_package_version?: string | null;
  prompt?: string | null;
  trajectory?: string | null;
  presentation_model?: string | null;
  debug_mode?: boolean;
  unsafe_allow_blocked_site_world?: boolean;
}

export interface SiteModelSummary {
  siteWorldId: string;
  siteName: string;
  siteAddress: string;
  sceneId: string;
  captureId: string;
  pipelinePrefix: string;
  siteWorldSpecUri?: string | null;
  siteWorldRegistrationUri?: string | null;
  siteWorldHealthUri?: string | null;
  runtimeBaseUrl?: string | null;
  websocketBaseUrl?: string | null;
  sceneMemoryManifestUri?: string | null;
  conditioningBundleUri?: string | null;
  presentationWorldManifestUri?: string | null;
  runtimeDemoManifestUri?: string | null;
  resolvedArtifactCanonicalUri?: string | null;
  registeredCanonicalPackageUri?: string | null;
  registeredCanonicalPackageVersion?: string | null;
  canonicalPackageSource?: "runtime_registered" | "resolved_artifact";
  artifactExplorer?: ArtifactExplorerSummary | null;
  availableScenarioVariants: string[];
  availableStartStates: string[];
  defaultRuntimeBackend?: string | null;
  availableRuntimeBackends?: string[];
  backendVariants?: Record<string, BackendVariantSummary>;
}

export type HostedSessionFailureSource = "runtime" | "presentation_demo";

export type HostedSessionFailureOperation =
  | "create"
  | "reset"
  | "step"
  | "render"
  | "presentation_launch";

export interface HostedSessionFailureDiagnostic {
  source: HostedSessionFailureSource;
  operation: HostedSessionFailureOperation;
  code: string;
  summary: string;
  detail?: string | null;
  traceback?: string | null;
  rawDetail?: string | null;
  exitCode?: number | null;
  statusCode?: number | null;
  occurredAt: string;
}

export type HostedSessionLaunchBlockerSource =
  | "access"
  | "qualification"
  | "runtime"
  | "presentation_demo";

export interface HostedSessionLaunchBlockerDetail {
  code: string;
  message: string;
  source: HostedSessionLaunchBlockerSource;
}

export type PresentationDemoReadinessStatus =
  | "artifact_explorer_ready"
  | "presentation_ui_unconfigured"
  | "presentation_ui_live"
  | "presentation_assets_missing";

export interface ArtifactExplorerView {
  id: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  sourceUri?: string | null;
  badge?: string | null;
  cameraId?: string | null;
  available: boolean;
}

export interface ArtifactExplorerObject {
  id: string;
  label: string;
  taskRole?: string | null;
  taskCritical?: boolean;
  groundingLevel?: string | null;
  meshUrl?: string | null;
  previewImageUrl?: string | null;
  selectedViewUrls?: string[];
  center: [number, number, number];
  extents: [number, number, number];
}

export interface ArtifactExplorerSourceLink {
  id: string;
  label: string;
  uri?: string | null;
  detail?: string | null;
}

export interface ArtifactExplorerSummary {
  status: "ready" | "partial" | "missing";
  headline: string;
  summary: string;
  derivationMode?: string | null;
  canonicalPackageVersion?: string | null;
  presentationStatus?: string | null;
  sceneKind?: "canonical_object_geometry" | "derived_presentation";
  sceneModelUrl?: string | null;
  sceneModelFormat?: "glb" | "ply" | "object_bundle" | null;
  views: ArtifactExplorerView[];
  objects?: ArtifactExplorerObject[];
  sources: ArtifactExplorerSourceLink[];
  operatorView: {
    available: boolean;
    live: boolean;
    uiBaseUrl?: string | null;
    label: string;
    description: string;
  };
}

export interface PresentationLaunchState {
  status: "live_viewer" | "artifact_backed" | "blocked";
  mode?: PresentationDemoReadinessStatus;
  blockers: string[];
  blockerDetails: HostedSessionLaunchBlockerDetail[];
  presentationWorldManifestUri?: string | null;
  runtimeDemoManifestUri?: string | null;
  uiBaseUrl?: string | null;
}

export interface PresentationRuntimeState {
  provider: "vast";
  status: "provisioning" | "starting" | "live" | "stopped" | "failed";
  uiBaseUrl?: string | null;
  proxyPath?: string | null;
  instanceId?: string | null;
  startedAt?: string | null;
  expiresAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export interface GeneratedOutputStatus {
  available: boolean;
  artifactUri?: string | null;
  label?: string | null;
}

export interface ObservationSummary {
  framePath?: string | null;
  latestFramePath?: string | null;
  frameCount?: number;
  hasRenderableFrame?: boolean;
}

export interface GeneratedOutputsSummary {
  observationFrames?: ObservationSummary | null;
  actionTrace?: GeneratedOutputStatus | null;
  rolloutVideo?: GeneratedOutputStatus | null;
  exportBundle?: GeneratedOutputStatus | null;
}

export interface HostedSessionSiteRef {
  siteWorldId: string;
  siteName: string;
  siteAddress: string;
  scene_id: string;
  capture_id: string;
  site_submission_id: string;
  pipeline_prefix: string;
}

export interface HostedEpisodeSummary {
  episodeId: string;
  taskId: string;
  task: string;
  scenarioId?: string;
  scenario: string;
  startStateId?: string;
  startState: string;
  status: "ready" | "running" | "completed" | "failed";
  stepIndex: number;
  reward?: number | null;
  done: boolean;
  success?: boolean | null;
  failureReason?: string | null;
  observation?: Record<string, unknown> | null;
  observationSummary?: ObservationSummary | null;
  score?: Record<string, unknown> | null;
  artifactUris?: Record<string, string>;
  generatedOutputs?: GeneratedOutputsSummary | null;
  actionTrace?: Array<number[] | Record<string, number>>;
  observationCameras?: RobotObservationCamera[];
  canonicalPackageVersion?: string | null;
  presentationConfig?: Record<string, unknown> | null;
  qualityFlags?: Record<string, unknown> | null;
  protectedRegionViolations?: Record<string, unknown>[] | null;
  debugArtifacts?: Record<string, unknown> | null;
  runtimeEngineIdentity?: Record<string, unknown> | null;
  runtimeModelIdentity?: Record<string, unknown> | null;
  runtimeCheckpointIdentity?: Record<string, unknown> | null;
}

export interface HostedBatchSummary {
  batchRunId: string;
  status: "running" | "completed" | "failed";
  numEpisodes: number;
  numSuccess: number;
  numFailure: number;
  successRate: number;
  commonFailureModes: string[];
  artifactManifestUri?: string | null;
  exportBundle?: GeneratedOutputStatus | null;
}

export type ExplorerGroundedSource = "arkit_rgbd" | "video_only" | "runtime_fallback";

export type ExplorerRefineStatus = "idle" | "queued" | "running" | "complete" | "failed";

export interface ExplorerPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

export interface ExplorerFrame {
  cameraId: string;
  framePath?: string | null;
  viewport?: Record<string, unknown> | null;
  snapshotId?: string | null;
}

export interface ExplorerState {
  pose: ExplorerPose;
  explorerFrame?: ExplorerFrame | null;
  explorerQualityFlags?: Record<string, unknown> | null;
  groundedSource?: ExplorerGroundedSource | null;
  refineStatus?: ExplorerRefineStatus | null;
  debugArtifacts?: Record<string, unknown> | null;
}

export interface HostedSessionRecord {
  sessionId: string;
  site: HostedSessionSiteRef;
  siteModel?: SiteModelSummary | null;
  sessionMode: HostedSessionMode;
  runtimeUi?: HostedSessionRuntimeUi;
  runtime_backend_requested?: string | null;
  runtime_backend_selected: string;
  runtime_execution_mode?: string | null;
  status: HostedSessionStatus;
  robotProfile?: RobotProfile | null;
  robotProfileId?: string;
  robot: string;
  policy: Record<string, unknown>;
  runtimeConfig?: RuntimeConfig | null;
  runtimeSessionConfig?: HostedRuntimeSessionConfig | null;
  taskSelection?: TaskSelection | null;
  requestedOutputs?: string[];
  datasetArtifacts?: Record<string, unknown>;
  task: string;
  scenario: string;
  notes?: string | null;
  createdBy: {
    uid: string;
    email?: string | null;
  };
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string;
  startedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string | null;
  stoppedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue | string | null;
  elapsedSeconds: number;
  latestEpisode?: HostedEpisodeSummary | null;
  explorerState?: ExplorerState | null;
  batchSummary?: HostedBatchSummary | null;
  artifactUris: Record<string, string>;
  runtimeHandle?: {
    site_world_id: string;
    build_id?: string | null;
    runtime_base_url?: string | null;
    websocket_base_url?: string | null;
    vm_instance_id?: string | null;
    runtime_capabilities?: Record<string, unknown> | null;
    health_status?: string | null;
    last_heartbeat_at?: string | null;
  } | null;
  presentationRuntime?: PresentationRuntimeState | null;
  presentationLaunchState?: PresentationLaunchState | null;
  latestRuntimeFailure?: HostedSessionFailureDiagnostic | null;
  metering: {
    sessionSeconds: number;
    billableHours: number;
    priceLabel?: string | null;
  };
  launchContext: {
    site_world_spec_uri: string;
    site_world_registration_uri: string;
    site_world_health_uri: string;
    resolvedArtifactCanonicalUri?: string | null;
    registeredCanonicalPackageUri?: string | null;
    registeredCanonicalPackageVersion?: string | null;
    runtime_base_url?: string | null;
    websocket_base_url?: string | null;
    conditioning_bundle_uri: string;
    scene_memory_manifest_uri: string;
  };
}

export interface CreateHostedSessionRequest {
  siteWorldId: string;
  sessionMode?: HostedSessionMode;
  runtimeUi?: HostedSessionRuntimeUi;
  autoStartDemo?: boolean;
  robotProfileId: string;
  robotProfileOverride?: Partial<RobotProfile>;
  policy?: Record<string, unknown>;
  taskId: string;
  scenarioId: string;
  startStateId: string;
  requestedBackend?: string | null;
  runtimeSessionConfig?: HostedRuntimeSessionConfig | null;
  requestedOutputs?: string[];
  exportModes?: string[];
  notes?: string;
}
