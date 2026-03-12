import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import type { HostedRuntimeSessionConfig } from "../types/hosted-session";
import { parseGsUri } from "./pipeline-dashboard";
import type { HostedRuntimeResolution } from "./hosted-session-runtime";

export class HostedSessionOrchestratorError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function sessionWorkRoot() {
  return (
    process.env.BLUEPRINT_HOSTED_SESSION_WORK_ROOT ||
    path.join(os.tmpdir(), "blueprint-hosted-sessions")
  );
}

async function readTextFromUri(uri: string): Promise<string> {
  if (uri.startsWith("gs://")) {
    if (!storageAdmin) {
      throw new HostedSessionOrchestratorError(
        "artifact_download_unavailable",
        "Storage is not configured, so site-world runtime artifacts cannot be resolved.",
      );
    }
    const { bucket, objectPath } = parseGsUri(uri);
    const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
    return buffer.toString("utf-8");
  }
  return fs.readFile(uri, "utf-8");
}

async function readJsonFromUri(uri: string): Promise<Record<string, unknown>> {
  const payload = JSON.parse(await readTextFromUri(uri)) as Record<string, unknown>;
  return payload && typeof payload === "object" ? payload : {};
}

async function runtimeMetadataPath(workDir: string) {
  await fs.mkdir(workDir, { recursive: true });
  return path.join(workDir, "runtime_metadata.json");
}

async function writeRuntimeMetadata(workDir: string, payload: Record<string, unknown>) {
  const metadataPath = await runtimeMetadataPath(workDir);
  await fs.writeFile(metadataPath, JSON.stringify(payload, null, 2), "utf-8");
}

async function readRuntimeMetadata(workDir: string) {
  const metadataPath = await runtimeMetadataPath(workDir);
  const raw = await fs.readFile(metadataPath, "utf-8");
  const payload = JSON.parse(raw) as Record<string, unknown>;
  return payload && typeof payload === "object" ? payload : {};
}

async function runtimeFetchJson(
  baseUrl: string,
  relativePath: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${baseUrl}${relativePath}`, init);
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new HostedSessionOrchestratorError(
      "runtime_proxy_failed",
      String(payload.detail || payload.error || `Runtime request failed: ${response.status}`),
    );
  }
  return payload;
}

async function resolveRuntimeHandle(runtime: HostedRuntimeResolution) {
  const registration = await readJsonFromUri(runtime.siteWorldRegistrationUri);
  const health = (await readJsonFromUri(runtime.siteWorldHealthUri).catch(() => ({}))) as Record<string, unknown>;
  const runtimeBaseUrl =
    String(runtime.runtimeBaseUrl || registration.runtime_base_url || "").trim();
  const websocketBaseUrl =
    String(runtime.websocketBaseUrl || registration.websocket_base_url || "").trim();
  const siteWorldId = String(registration.site_world_id || "").trim();
  if (!runtimeBaseUrl || !siteWorldId) {
    throw new HostedSessionOrchestratorError(
      "runtime_handle_missing",
      "The site-world registration does not include a reachable runtime handle.",
    );
  }
  if (health.launchable === false) {
    throw new HostedSessionOrchestratorError(
      "runtime_unlaunchable",
      `The site-world runtime is not launchable: ${String((health.blockers as string[] | undefined)?.join(", ") || "blocked")}`,
    );
  }
  return {
    registration,
    health,
    runtimeBaseUrl,
    websocketBaseUrl: websocketBaseUrl || null,
    siteWorldId,
  };
}

function normalizeEpisode(payload: Record<string, unknown>) {
  const episode =
    payload.episode && typeof payload.episode === "object"
      ? (payload.episode as Record<string, unknown>)
      : payload;
  return {
    episodeId: String(episode.episodeId || episode.episode_id || ""),
    taskId: String(episode.taskId || episode.task_id || ""),
    task: String(episode.task || ""),
    scenarioId: String(episode.scenarioId || episode.scenario_id || ""),
    scenario: String(episode.scenario || ""),
    startStateId: String(episode.startStateId || episode.start_state_id || ""),
    startState: String(episode.startState || episode.start_state || ""),
    status: String(episode.status || "ready"),
    stepIndex: Number(episode.stepIndex || episode.step_index || 0),
    done: Boolean(episode.done),
    reward:
      typeof episode.reward === "number" && Number.isFinite(episode.reward)
        ? episode.reward
        : null,
    success:
      typeof episode.success === "boolean" ? episode.success : null,
    failureReason: String(episode.failureReason || episode.failure_reason || "").trim() || null,
    observation:
      episode.observation && typeof episode.observation === "object"
        ? (episode.observation as Record<string, unknown>)
        : null,
    observationCameras: Array.isArray(episode.observationCameras)
      ? episode.observationCameras
      : [],
    actionTrace: Array.isArray(episode.actionTrace) ? episode.actionTrace : [],
    artifactUris: {},
  };
}

export async function createHostedSessionRun(params: {
  sessionId: string;
  workDir: string;
  runtime: HostedRuntimeResolution;
  robotProfileId: string;
  robotProfileOverride?: Record<string, unknown>;
  policy?: Record<string, unknown>;
  taskId: string;
  scenarioId: string;
  startStateId: string;
  exportModes: string[];
  notes?: string;
  runtimeSessionConfig?: HostedRuntimeSessionConfig | null;
}) {
  const handle = await resolveRuntimeHandle(params.runtime);
  const payload = await runtimeFetchJson(
    handle.runtimeBaseUrl,
    `/v1/site-worlds/${encodeURIComponent(handle.siteWorldId)}/sessions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: params.sessionId,
        robot_profile_id: params.robotProfileId,
        robot_profile_override: params.robotProfileOverride || null,
        policy: params.policy || {},
        task_id: params.taskId,
        scenario_id: params.scenarioId,
        start_state_id: params.startStateId,
        export_modes: params.exportModes,
        runtime_session_config: params.runtimeSessionConfig || null,
        notes: params.notes || "",
      }),
    },
  );
  await writeRuntimeMetadata(params.workDir, {
    runtime_base_url: handle.runtimeBaseUrl,
    websocket_base_url: handle.websocketBaseUrl,
    site_world_id: handle.siteWorldId,
    build_id: payload.build_id || handle.registration.build_id || null,
    vm_instance_id: handle.registration.vm_instance_id || null,
    runtime_capabilities: payload.runtime_capabilities || handle.registration.runtime_capabilities || {},
    health_status: String(handle.health.status || "healthy"),
    last_heartbeat_at: handle.health.last_heartbeat_at ? String(handle.health.last_heartbeat_at) : null,
  });
  return {
    payload: {
      runtime_backend_selected: "neoverse",
      runtime_session_id: payload.session_id,
      runtime_session_metadata: {
        site_world_id: handle.siteWorldId,
        build_id: payload.build_id || handle.registration.build_id || null,
      },
      artifact_uris: {},
      dataset_artifacts: {},
    },
  };
}

export async function resetHostedSessionRun(params: {
  sessionId: string;
  workDir: string;
  taskId?: string;
  scenarioId?: string;
  startStateId?: string;
  seed?: number;
}) {
  void params.seed;
  const metadata = await readRuntimeMetadata(params.workDir);
  const runtimeBaseUrl = String(metadata.runtime_base_url || "").trim();
  if (!runtimeBaseUrl) {
    throw new HostedSessionOrchestratorError("runtime_handle_missing", "Missing runtime base URL.");
  }
  const payload = await runtimeFetchJson(
    runtimeBaseUrl,
    `/v1/sessions/${encodeURIComponent(params.sessionId)}/reset`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: params.taskId || null,
        scenario_id: params.scenarioId || null,
        start_state_id: params.startStateId || null,
      }),
    },
  );
  return { episode: normalizeEpisode(payload) };
}

export async function stepHostedSessionRun(params: {
  sessionId: string;
  workDir: string;
  episodeId: string;
  action?: number[];
  autoPolicy?: boolean;
}) {
  void params.episodeId;
  void params.autoPolicy;
  const metadata = await readRuntimeMetadata(params.workDir);
  const runtimeBaseUrl = String(metadata.runtime_base_url || "").trim();
  if (!runtimeBaseUrl) {
    throw new HostedSessionOrchestratorError("runtime_handle_missing", "Missing runtime base URL.");
  }
  const payload = await runtimeFetchJson(
    runtimeBaseUrl,
    `/v1/sessions/${encodeURIComponent(params.sessionId)}/step`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: Array.isArray(params.action) ? params.action : [0, 0, 0, 0, 0, 0, 1] }),
    },
  );
  return { episode: normalizeEpisode(payload) };
}

export async function runBatchHostedSessionRun(params: {
  sessionId: string;
  workDir: string;
  numEpisodes: number;
  taskId?: string;
  scenarioId?: string;
  startStateId?: string;
  seed?: number;
  maxSteps?: number;
}) {
  void params.seed;
  const assignments: Array<Record<string, unknown>> = [];
  const failures = new Set<string>();
  const maxSteps = Math.max(1, Number(params.maxSteps || 6));
  for (let index = 0; index < params.numEpisodes; index += 1) {
    const reset = await resetHostedSessionRun({
      sessionId: params.sessionId,
      workDir: params.workDir,
      taskId: params.taskId,
      scenarioId: params.scenarioId,
      startStateId: params.startStateId,
    });
    let episode = reset.episode;
    for (let stepIndex = 0; stepIndex < maxSteps && !episode.done; stepIndex += 1) {
      const step = await stepHostedSessionRun({
        sessionId: params.sessionId,
        workDir: params.workDir,
        episodeId: episode.episodeId,
      });
      episode = step.episode;
    }
    if (episode.failureReason) {
      failures.add(String(episode.failureReason));
    }
    assignments.push({
      episode_id: episode.episodeId,
      rollout_index: index,
      task_id: episode.taskId,
      scenario_id: episode.scenarioId,
      start_state_id: episode.startStateId,
      success: Boolean(episode.success),
      frame_path: (episode.observation as Record<string, unknown> | null)?.frame_path || "",
    });
  }
  const numSuccess = assignments.filter((item) => item.success === true).length;
  return {
    summary: {
      batchRunId: `batch-${params.sessionId}`,
      status: "completed",
      numEpisodes: params.numEpisodes,
      numSuccess,
      numFailure: params.numEpisodes - numSuccess,
      successRate: Number((numSuccess / Math.max(params.numEpisodes, 1)).toFixed(4)),
      commonFailureModes: Array.from(failures),
    },
    artifact_uris: {},
    dataset_artifacts: {},
  };
}

export async function stopHostedSessionRun(params: { sessionId: string; workDir: string }) {
  void params.workDir;
  return { sessionId: params.sessionId, status: "stopped" };
}

export async function exportHostedSessionRun(params: { sessionId: string; workDir: string }) {
  const metadata = await readRuntimeMetadata(params.workDir);
  const exportDir = path.join(params.workDir, "exports");
  await fs.mkdir(exportDir, { recursive: true });
  const exportManifestPath = path.join(exportDir, "export_manifest.json");
  const rawBundlePath = path.join(exportDir, "raw_bundle.json");
  await fs.writeFile(
    exportManifestPath,
    JSON.stringify(
      {
        schema_version: "v1",
        session_id: params.sessionId,
        runtime_handle: metadata,
      },
      null,
      2,
    ),
    "utf-8",
  );
  await fs.writeFile(
    rawBundlePath,
    JSON.stringify(
      {
        schema_version: "v1",
        session_id: params.sessionId,
        exported_at: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf-8",
  );
  return {
    exportId: `export-${params.sessionId}`,
    artifact_uris: {
      export_manifest: exportManifestPath,
      raw_bundle: rawBundlePath,
    },
    dataset_artifacts: {},
  };
}

export async function loadHostedSessionRuntimeMetadata(workDir: string) {
  return readRuntimeMetadata(workDir);
}

export function sessionWorkDir(sessionId: string) {
  return path.join(sessionWorkRoot(), sessionId);
}
