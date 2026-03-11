export type HostedSessionStatus =
  | "creating"
  | "ready"
  | "running"
  | "stopped"
  | "failed";

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
  scenario: string;
  startState: string;
  status: "ready" | "running" | "completed" | "failed";
  stepIndex: number;
  reward?: number | null;
  done: boolean;
  observation?: Record<string, unknown> | null;
  score?: Record<string, unknown> | null;
  artifactUris?: Record<string, string>;
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
}

export interface HostedSessionRecord {
  sessionId: string;
  site: HostedSessionSiteRef;
  runtime_backend_selected: string;
  status: HostedSessionStatus;
  robot: string;
  policy: Record<string, unknown>;
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
  robot: string;
  policy: Record<string, unknown>;
  task: string;
  scenario: string;
  notes?: string;
}
