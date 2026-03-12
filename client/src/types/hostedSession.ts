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

export interface RuntimeManifestSummary {
  defaultBackend: string;
  launchableBackends: string[];
  exportModes: string[];
  supportsStepRollout: boolean;
  supportsBatchRollout: boolean;
  supportsCameraViews: boolean;
}

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

export interface RequestedOutputDefinition {
  id: string;
  label: string;
  description: string;
}

export interface SiteModelSummary {
  siteWorldId: string;
  siteName: string;
  siteAddress: string;
  sceneId: string;
  captureId: string;
  pipelinePrefix: string;
  runtimeManifestUri?: string | null;
  sceneMemoryManifestUri?: string | null;
  conditioningBundleUri?: string | null;
  previewSimulationManifestUri?: string | null;
  availableScenarioVariants: string[];
  availableStartStates: string[];
  defaultRuntimeBackend?: string | null;
  availableRuntimeBackends?: string[];
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
  actionTrace?: number[][];
  observationCameras?: RobotObservationCamera[];
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

export interface HostedSessionRecord {
  sessionId: string;
  runtime_backend_selected: string;
  status: "creating" | "ready" | "running" | "stopped" | "failed";
  site: {
    siteWorldId: string;
    siteName: string;
    siteAddress: string;
    scene_id: string;
    capture_id: string;
    site_submission_id: string;
    pipeline_prefix: string;
  };
  siteModel?: SiteModelSummary | null;
  robotProfile?: RobotProfile | null;
  robotProfileId?: string;
  policy: Record<string, unknown>;
  runtimeConfig?: RuntimeConfig | null;
  taskSelection?: TaskSelection | null;
  requestedOutputs?: string[];
  datasetArtifacts?: Record<string, unknown>;
  robot?: string;
  task?: string;
  scenario?: string;
  notes?: string | null;
  elapsedSeconds: number;
  latestEpisode?: HostedEpisodeSummary | null;
  batchSummary?: HostedBatchSummary | null;
  artifactUris: Record<string, string>;
  metering: {
    sessionSeconds: number;
    billableHours: number;
    priceLabel?: string | null;
  };
  launchContext: {
    hosted_session_runtime_manifest_uri: string;
    task_anchor_manifest_uri: string;
    task_run_manifest_uri: string;
    conditioning_bundle_uri: string;
    scene_memory_manifest_uri: string;
    preview_simulation_manifest_uri?: string | null;
  };
}

export interface CreateHostedSessionRequest {
  siteWorldId: string;
  robotProfileId: string;
  robotProfileOverride?: Partial<RobotProfile>;
  policy: Record<string, unknown>;
  taskId: string;
  scenarioId: string;
  startStateId: string;
  requestedOutputs?: string[];
  exportModes?: string[];
  notes?: string;
}
