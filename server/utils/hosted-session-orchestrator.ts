import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { attachRequestMeta, logger } from "../logger";
import type { HostedRuntimeSessionConfig } from "../types/hosted-session";
import { parseGsUri } from "./pipeline-dashboard";
import type { HostedRuntimeResolution } from "./hosted-session-runtime";

export class HostedSessionOrchestratorError extends Error {
  code: string;
  statusCode?: number | null;

  constructor(code: string, message: string, options?: { statusCode?: number | null }) {
    super(message);
    this.code = code;
    this.statusCode = options?.statusCode ?? null;
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
  const url = `${baseUrl}${relativePath}`;
  const timeoutMs = Math.max(1000, Number(process.env.BLUEPRINT_HOSTED_SESSION_RUNTIME_TIMEOUT_MS || 45000));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new HostedSessionOrchestratorError(
        "runtime_proxy_failed",
        String(payload.detail || payload.error || `Runtime request failed: ${response.status}`),
        { statusCode: response.status },
      );
    }
    logger.info(
      attachRequestMeta({
        runtimeUrl: url,
        runtimeMethod: String(init?.method || "GET").toUpperCase(),
        durationMs: Date.now() - startedAt,
      }),
      "Hosted runtime request completed",
    );
    return payload;
  } catch (error) {
    if (error instanceof HostedSessionOrchestratorError) {
      logger.warn(
        attachRequestMeta({
          runtimeUrl: url,
          runtimeMethod: String(init?.method || "GET").toUpperCase(),
          durationMs: Date.now() - startedAt,
          code: error.code,
          statusCode: error.statusCode ?? undefined,
        }),
        "Hosted runtime request failed",
      );
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      logger.warn(
        attachRequestMeta({
          runtimeUrl: url,
          runtimeMethod: String(init?.method || "GET").toUpperCase(),
          durationMs: Date.now() - startedAt,
          timeoutMs,
        }),
        "Hosted runtime request timed out",
      );
      throw new HostedSessionOrchestratorError(
        "runtime_proxy_timeout",
        `Timed out after ${timeoutMs}ms waiting for runtime request ${relativePath}.`,
        { statusCode: 504 },
      );
    }
    logger.warn(
      attachRequestMeta({
        runtimeUrl: url,
        runtimeMethod: String(init?.method || "GET").toUpperCase(),
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
      }),
      "Hosted runtime request was unreachable",
    );
    throw new HostedSessionOrchestratorError(
      "runtime_proxy_unreachable",
      `Failed to reach runtime request ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
      { statusCode: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function resolveRuntimeHandle(runtime: HostedRuntimeResolution) {
  const registration = (await readJsonFromUri(runtime.siteWorldRegistrationUri).catch(() => ({}))) as Record<string, unknown>;
  const health = (await readJsonFromUri(runtime.siteWorldHealthUri).catch(() => ({}))) as Record<string, unknown>;
  const runtimeBaseUrl = String(runtime.runtimeBaseUrl || registration.runtime_base_url || "").trim();
  const websocketBaseUrl = String(runtime.websocketBaseUrl || registration.websocket_base_url || "").trim();
  const siteWorldId = String(registration.site_world_id || runtime.siteWorldId || "").trim();
  if (!runtimeBaseUrl || !siteWorldId) {
    throw new HostedSessionOrchestratorError(
      "runtime_handle_missing",
      "The site-world registration does not include a reachable runtime handle.",
    );
  }
  if (health.launchable === false && !runtime.allowBlockedSiteWorld) {
    throw new HostedSessionOrchestratorError(
      "runtime_unlaunchable",
      `The site-world runtime is not launchable: ${String((health.blockers as string[] | undefined)?.join(", ") || "blocked")}`,
    );
  }
  return {
    registration: Object.keys(registration).length > 0 ? registration : {
      site_world_id: siteWorldId,
      runtime_base_url: runtimeBaseUrl,
      websocket_base_url: websocketBaseUrl || null,
    },
    health: Object.keys(health).length > 0 ? health : {
      launchable: true,
      status: "healthy",
      blockers: [],
    },
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
    ...episode,
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
    artifactUris:
      episode.artifactUris && typeof episode.artifactUris === "object"
        ? (episode.artifactUris as Record<string, unknown>)
        : {},
  };
}

type NormalizedEpisodePayload = ReturnType<typeof normalizeEpisode>;
type NormalizedStatePayload = ReturnType<typeof normalizeStatePayload>;

function normalizeStatePayload(payload: Record<string, unknown>) {
  const observation =
    payload.observation && typeof payload.observation === "object"
      ? ({ ...(payload.observation as Record<string, unknown>) })
      : null;

  return {
    ...payload,
    sessionId: String(payload.session_id || payload.sessionId || ""),
    episodeId: String(payload.episode_id || payload.episodeId || payload.current_episode_id || ""),
    status: String(payload.status || "ready"),
    stepIndex: Number(payload.step_index || payload.stepIndex || 0),
    done: Boolean(payload.done),
    reward:
      typeof payload.reward === "number" && Number.isFinite(payload.reward)
        ? payload.reward
        : null,
    success:
      typeof payload.success === "boolean" ? payload.success : null,
    failureReason: String(payload.failure_reason || payload.failureReason || "").trim() || null,
    observation: observation
      ? {
          ...observation,
          remoteObservation:
            observation.remoteObservation && typeof observation.remoteObservation === "object"
              ? observation.remoteObservation
              : { ...observation },
        }
      : null,
    actionTrace: Array.isArray(payload.action_trace)
      ? (payload.action_trace as number[][])
      : Array.isArray(payload.actionTrace)
        ? (payload.actionTrace as number[][])
        : [],
    canonicalPackageVersion:
      String(payload.canonical_package_version || payload.canonicalPackageVersion || "").trim() || null,
    presentationConfig:
      payload.presentation_config && typeof payload.presentation_config === "object"
        ? (payload.presentation_config as Record<string, unknown>)
        : payload.presentationConfig && typeof payload.presentationConfig === "object"
          ? (payload.presentationConfig as Record<string, unknown>)
          : null,
    qualityFlags:
      payload.quality_flags && typeof payload.quality_flags === "object"
        ? (payload.quality_flags as Record<string, unknown>)
        : payload.qualityFlags && typeof payload.qualityFlags === "object"
          ? (payload.qualityFlags as Record<string, unknown>)
          : null,
    protectedRegionViolations: Array.isArray(payload.protected_region_violations)
      ? payload.protected_region_violations
      : Array.isArray(payload.protectedRegionViolations)
        ? payload.protectedRegionViolations
        : [],
    debugArtifacts:
      payload.debug_artifacts && typeof payload.debug_artifacts === "object"
        ? (payload.debug_artifacts as Record<string, unknown>)
        : payload.debugArtifacts && typeof payload.debugArtifacts === "object"
          ? (payload.debugArtifacts as Record<string, unknown>)
          : null,
    runtimeEngineIdentity:
      payload.runtime_engine_identity && typeof payload.runtime_engine_identity === "object"
        ? (payload.runtime_engine_identity as Record<string, unknown>)
        : payload.runtimeEngineIdentity && typeof payload.runtimeEngineIdentity === "object"
          ? (payload.runtimeEngineIdentity as Record<string, unknown>)
          : null,
    runtimeModelIdentity:
      payload.runtime_model_identity && typeof payload.runtime_model_identity === "object"
        ? (payload.runtime_model_identity as Record<string, unknown>)
        : payload.runtimeModelIdentity && typeof payload.runtimeModelIdentity === "object"
          ? (payload.runtimeModelIdentity as Record<string, unknown>)
          : null,
    runtimeCheckpointIdentity:
      payload.runtime_checkpoint_identity && typeof payload.runtime_checkpoint_identity === "object"
        ? (payload.runtime_checkpoint_identity as Record<string, unknown>)
        : payload.runtimeCheckpointIdentity && typeof payload.runtimeCheckpointIdentity === "object"
          ? (payload.runtimeCheckpointIdentity as Record<string, unknown>)
          : null,
  };
}

function mergeEpisodeWithState(
  episodePayload: Record<string, unknown> | null,
  statePayload: Record<string, unknown>,
) {
  const baseEpisode: Partial<NormalizedEpisodePayload> = episodePayload ? normalizeEpisode(episodePayload) : {};
  const normalizedState: NormalizedStatePayload = normalizeStatePayload(statePayload);
  const baseObservation =
    baseEpisode.observation && typeof baseEpisode.observation === "object"
      ? (baseEpisode.observation as Record<string, unknown>)
      : {};
  const stateObservation =
    normalizedState.observation && typeof normalizedState.observation === "object"
      ? (normalizedState.observation as Record<string, unknown>)
      : {};
  const mergedObservation =
    Object.keys(baseObservation).length > 0 || Object.keys(stateObservation).length > 0
      ? {
          ...baseObservation,
          ...stateObservation,
          remoteObservation:
            stateObservation.remoteObservation && typeof stateObservation.remoteObservation === "object"
              ? stateObservation.remoteObservation
              : baseObservation.remoteObservation && typeof baseObservation.remoteObservation === "object"
                ? baseObservation.remoteObservation
                : Object.keys(stateObservation).length > 0
                  ? { ...stateObservation }
                  : null,
        }
      : null;

  return {
    ...baseEpisode,
    ...normalizedState,
    episodeId: String(baseEpisode.episodeId || normalizedState.episodeId || ""),
    taskId: String(baseEpisode.taskId || ""),
    task: String(baseEpisode.task || ""),
    scenarioId: String(baseEpisode.scenarioId || ""),
    scenario: String(baseEpisode.scenario || ""),
    startStateId: String(baseEpisode.startStateId || ""),
    startState: String(baseEpisode.startState || ""),
    observation: mergedObservation,
    observationCameras:
      Array.isArray(baseEpisode.observationCameras) && baseEpisode.observationCameras.length > 0
        ? baseEpisode.observationCameras
        : [],
    artifactUris:
      baseEpisode.artifactUris && typeof baseEpisode.artifactUris === "object"
        ? baseEpisode.artifactUris
        : {},
    actionTrace:
      Array.isArray(normalizedState.actionTrace) && normalizedState.actionTrace.length > 0
        ? normalizedState.actionTrace
        : Array.isArray(baseEpisode.actionTrace)
          ? baseEpisode.actionTrace
          : [],
  };
}

function hasRenderableSnapshot(episode: Record<string, unknown>) {
  const observation =
    episode.observation && typeof episode.observation === "object"
      ? (episode.observation as Record<string, unknown>)
      : null;
  const worldSnapshot =
    observation?.worldSnapshot && typeof observation.worldSnapshot === "object"
      ? (observation.worldSnapshot as Record<string, unknown>)
      : null;
  const snapshotId = String(worldSnapshot?.snapshotId || worldSnapshot?.snapshot_id || "").trim();
  const primaryCameraId = String(observation?.primaryCameraId || observation?.primary_camera_id || "").trim();
  return Boolean(snapshotId && primaryCameraId);
}

function runtimeStateTimeoutMs() {
  return Math.max(1000, Number(process.env.BLUEPRINT_HOSTED_SESSION_STATE_TIMEOUT_MS || 90000));
}

function runtimeStatePollIntervalMs() {
  return Math.max(50, Number(process.env.BLUEPRINT_HOSTED_SESSION_STATE_POLL_INTERVAL_MS || 1000));
}

async function waitFor(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchHostedSessionState(params: {
  sessionId: string;
  workDir: string;
}) {
  const metadata = await readRuntimeMetadata(params.workDir);
  const runtimeBaseUrl = String(metadata.runtime_base_url || "").trim();
  if (!runtimeBaseUrl) {
    throw new HostedSessionOrchestratorError("runtime_handle_missing", "Missing runtime base URL.");
  }
  return runtimeFetchJson(
    runtimeBaseUrl,
    `/v1/sessions/${encodeURIComponent(params.sessionId)}/state`,
  );
}

export async function reconcileHostedEpisode(params: {
  sessionId: string;
  workDir: string;
  episode?: Record<string, unknown> | null;
  expectedStepIndex?: number;
  timeoutMs?: number;
  pollIntervalMs?: number;
}) {
  const timeoutMs = Math.max(1, Number(params.timeoutMs ?? runtimeStateTimeoutMs()));
  const pollIntervalMs = Math.max(1, Number(params.pollIntervalMs ?? runtimeStatePollIntervalMs()));
  const deadline = Date.now() + timeoutMs;
  let lastMergedEpisode = params.episode ? normalizeEpisode(params.episode) : null;

  while (Date.now() <= deadline) {
    const statePayload = await fetchHostedSessionState({
      sessionId: params.sessionId,
      workDir: params.workDir,
    });
    lastMergedEpisode = mergeEpisodeWithState(params.episode || null, statePayload);
    const stepIndex = Number(lastMergedEpisode.stepIndex || 0);
    const snapshotReady = hasRenderableSnapshot(lastMergedEpisode);
    const stepReady =
      typeof params.expectedStepIndex === "number"
        ? stepIndex >= params.expectedStepIndex
        : true;
    if (snapshotReady && stepReady) {
      return lastMergedEpisode;
    }
    if (Date.now() + pollIntervalMs > deadline) {
      break;
    }
    await waitFor(pollIntervalMs);
  }

  const actualStepIndex = Number(lastMergedEpisode?.stepIndex || 0);
  const expectedStepSuffix =
    typeof params.expectedStepIndex === "number" ? ` Expected step >= ${params.expectedStepIndex}; received ${actualStepIndex}.` : "";
  throw new HostedSessionOrchestratorError(
    "runtime_snapshot_not_ready",
    `Runtime session did not materialize a renderable world snapshot in time.${expectedStepSuffix}`.trim(),
    { statusCode: 504 },
  );
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
  const runtimeSessionConfig = params.runtimeSessionConfig || null;
  let payload: Record<string, unknown>;
  try {
    payload = await runtimeFetchJson(
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
          notes: params.notes || "",
          canonical_package_uri: runtimeSessionConfig?.canonical_package_uri || null,
          canonical_package_version: runtimeSessionConfig?.canonical_package_version || null,
          prompt: runtimeSessionConfig?.prompt || null,
          trajectory: runtimeSessionConfig?.trajectory || null,
          presentation_model: runtimeSessionConfig?.presentation_model || null,
          debug_mode: runtimeSessionConfig?.debug_mode === true,
          unsafe_allow_blocked_site_world: runtimeSessionConfig?.unsafe_allow_blocked_site_world === true,
        }),
      },
    );
  } catch (error) {
    if (
      error instanceof HostedSessionOrchestratorError &&
      error.code === "runtime_proxy_failed" &&
      /not launchable/i.test(error.message)
    ) {
      const health = await runtimeFetchJson(
        handle.runtimeBaseUrl,
        `/v1/site-worlds/${encodeURIComponent(handle.siteWorldId)}/health`,
      ).catch(() => null);
      const blockers = Array.isArray(health?.blockers)
        ? health.blockers.map((item) => String(item)).filter(Boolean)
        : [];
      if (blockers.length > 0) {
        throw new HostedSessionOrchestratorError(
          "runtime_proxy_failed",
          `site world ${handle.siteWorldId} is not launchable: ${blockers.join(", ")}`,
        );
      }
    }
    if (
      error instanceof HostedSessionOrchestratorError &&
      error.code === "runtime_proxy_failed" &&
      /canonical_package_uri_mismatch/i.test(error.message)
    ) {
      const siteWorld = await runtimeFetchJson(
        handle.runtimeBaseUrl,
        `/v1/site-worlds/${encodeURIComponent(handle.siteWorldId)}`,
      ).catch(() => null);
      const expected = String(siteWorld?.canonical_package_uri || "").trim();
      const actual = String(runtimeSessionConfig?.canonical_package_uri || "").trim();
      if (expected || actual) {
        throw new HostedSessionOrchestratorError(
          "runtime_proxy_failed",
          `canonical_package_uri_mismatch (expected: ${expected || "runtime default"}, received: ${actual || "runtime default"})`,
        );
      }
    }
    throw error;
  }
  await writeRuntimeMetadata(params.workDir, {
    runtime_base_url: handle.runtimeBaseUrl,
    websocket_base_url: handle.websocketBaseUrl,
    site_world_id: handle.siteWorldId,
    build_id: payload.build_id || handle.registration.build_id || null,
    canonical_package_uri:
      String(
        params.runtime.registeredCanonicalPackageUri
          || runtimeSessionConfig?.canonical_package_uri
          || params.runtime.resolvedArtifactCanonicalUri
          || "",
      ).trim() || null,
    canonical_package_version:
      String(
        params.runtime.registeredCanonicalPackageVersion
          || runtimeSessionConfig?.canonical_package_version
          || "",
      ).trim() || null,
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
  const rawEpisode =
    payload.episode && typeof payload.episode === "object"
      ? (payload.episode as Record<string, unknown>)
      : payload;
  return {
    episode: normalizeEpisode(rawEpisode),
    rawEpisode,
  };
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
      body: JSON.stringify({ action: Array.isArray(params.action) ? params.action : [0, 0, 0, 0, 0, 0, 0] }),
    },
  );
  const rawEpisode =
    payload.episode && typeof payload.episode === "object"
      ? (payload.episode as Record<string, unknown>)
      : payload;
  return {
    episode: normalizeEpisode(rawEpisode),
    rawEpisode,
  };
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

export async function persistHostedSessionRuntimeMetadata(
  workDir: string,
  payload: {
    runtime_base_url: string;
    websocket_base_url?: string | null;
    site_world_id?: string | null;
    build_id?: string | null;
    canonical_package_uri?: string | null;
    canonical_package_version?: string | null;
    vm_instance_id?: string | null;
    runtime_capabilities?: Record<string, unknown> | null;
    health_status?: string | null;
    last_heartbeat_at?: string | null;
  },
) {
  await writeRuntimeMetadata(workDir, {
    runtime_base_url: payload.runtime_base_url,
    websocket_base_url: payload.websocket_base_url || null,
    site_world_id: payload.site_world_id || null,
    build_id: payload.build_id || null,
    canonical_package_uri: payload.canonical_package_uri || null,
    canonical_package_version: payload.canonical_package_version || null,
    vm_instance_id: payload.vm_instance_id || null,
    runtime_capabilities: payload.runtime_capabilities || {},
    health_status: payload.health_status || null,
    last_heartbeat_at: payload.last_heartbeat_at || null,
  });
}

export function sessionWorkDir(sessionId: string) {
  return path.join(sessionWorkRoot(), sessionId);
}
