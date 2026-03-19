import type {
  GeneratedOutputStatus,
  ObservationSummary,
  RequestedOutputDefinition,
  RobotProfile,
  RuntimeConfig,
  SiteModelSummary,
  TaskSelection,
} from "@/types/hostedSession";

export const DEFAULT_RUNTIME_BACKEND = "site_world_runtime";

export const REQUESTED_OUTPUT_DEFINITIONS: RequestedOutputDefinition[] = [
  { id: "start_state", label: "Start state", description: "Persist the selected episode start state." },
  { id: "task_summary", label: "Task id / task text", description: "Store the task text and any resolved task id." },
  { id: "scenario", label: "Scenario", description: "Persist the active scenario for the rollout." },
  { id: "observation_frames", label: "Observation frames", description: "Capture robot-view observations for the rollout." },
  { id: "action_trace", label: "Action trace", description: "Record predicted or supplied actions for each step." },
  { id: "step_count", label: "Step count", description: "Track the number of steps taken in the episode." },
  { id: "reward_score", label: "Reward / score", description: "Persist reward and score outputs when available." },
  { id: "success_failure", label: "Success / failure", description: "Mark whether the episode completed successfully." },
  { id: "rollout_video", label: "Rollout video", description: "Include a rendered rollout video when available." },
  { id: "export_bundle", label: "Export bundle", description: "Bundle generated outputs into an exportable manifest." },
];

export function requestedOutputLabel(id: string) {
  return REQUESTED_OUTPUT_DEFINITIONS.find((item) => item.id === id)?.label || id;
}

export function parseJsonParam<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function serializeJsonParam(value: unknown) {
  return JSON.stringify(value);
}

export function isRenderableObservationPath(framePath?: string | null) {
  const normalized = String(framePath || "").trim();
  return /^(https?:\/\/|blob:|data:image\/|\/(api|assets|images|attached_assets)\/)/.test(normalized);
}

export function summarizeObservation(framePath?: string | null, frameCount = 0): ObservationSummary {
  const normalized = String(framePath || "").trim();
  return {
    framePath: normalized || null,
    latestFramePath: normalized || null,
    frameCount,
    hasRenderableFrame: isRenderableObservationPath(normalized),
  };
}

export function generatedOutputStatus(
  available: boolean,
  artifactUri?: string | null,
  label?: string | null,
): GeneratedOutputStatus {
  return {
    available,
    artifactUri: artifactUri || null,
    label: label || null,
  };
}

export interface HostedSessionPreviewPayload {
  robotProfile: RobotProfile;
  policyLabel: string;
  runtimeConfig: RuntimeConfig;
  taskSelection: TaskSelection;
  requestedOutputs: string[];
  siteModel: SiteModelSummary;
}
