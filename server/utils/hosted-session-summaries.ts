import type {
  HostedBatchSummary,
  HostedEpisodeSummary,
  HostedSessionRecord,
} from "../types/hosted-session";
import type { HostedRuntimeResolution } from "./hosted-session-runtime";

/**
 * Pure summary builders for hosted sessions.
 *
 * These map runtime/episode/batch payloads into the persisted summary shapes on
 * a {@link HostedSessionRecord}. They perform no I/O and hold no route-level
 * state, so they live here rather than in the route module.
 */

export function isRenderableObservationPath(framePath?: string | null) {
  const normalized = String(framePath || "").trim();
  return /^(https?:\/\/|data:image\/|\/(api|assets|images|attached_assets)\/)/.test(normalized);
}

export function buildSiteModelSummary(
  runtime: HostedRuntimeResolution,
): NonNullable<HostedSessionRecord["siteModel"]> {
  return {
    siteWorldId: runtime.siteWorldId,
    siteName: runtime.siteName,
    siteAddress: runtime.siteAddress,
    sceneId: runtime.scene_id,
    captureId: runtime.capture_id,
    pipelinePrefix: runtime.pipeline_prefix,
    siteWorldSpecUri: runtime.siteWorldSpecUri,
    siteWorldRegistrationUri: runtime.siteWorldRegistrationUri,
    siteWorldHealthUri: runtime.siteWorldHealthUri,
    resolvedArtifactCanonicalUri: runtime.resolvedArtifactCanonicalUri,
    registeredCanonicalPackageUri: runtime.registeredCanonicalPackageUri ?? null,
    registeredCanonicalPackageVersion: runtime.registeredCanonicalPackageVersion ?? null,
    canonicalPackageSource: runtime.registeredCanonicalPackageUri ? "runtime_registered" : "resolved_artifact",
    primaryRuntimeBackend: runtime.primaryRuntimeBackend ?? null,
    worldModelBackend: runtime.worldModelBackend ?? null,
    sceneRepresentation: runtime.sceneRepresentation ?? null,
    runtimeRenderSource: runtime.runtimeRenderSource ?? null,
    fallbackMode: runtime.fallbackMode ?? null,
    groundingStatus: runtime.groundingStatus ?? null,
    runtimeBaseUrl: runtime.runtimeBaseUrl ?? null,
    websocketBaseUrl: runtime.websocketBaseUrl ?? null,
    sceneMemoryManifestUri: runtime.sceneMemoryManifestUri,
    conditioningBundleUri: runtime.conditioningBundleUri,
    presentationWorldManifestUri: runtime.presentationWorldManifestUri ?? null,
    runtimeDemoManifestUri: runtime.runtimeDemoManifestUri ?? null,
    availableScenarioVariants: runtime.availableScenarioVariants,
    availableStartStates: runtime.availableStartStates,
    defaultRuntimeBackend: runtime.defaultRuntimeBackend,
    availableRuntimeBackends: runtime.availableRuntimeBackends,
    backendVariants: runtime.runtimeManifest.backendVariants || {},
  };
}

export function normalizeEpisodeSummary(
  sessionId: string,
  episodePayload: Record<string, unknown>,
  renderRouteBase = "/api/site-worlds/sessions",
): HostedSessionRecord["latestEpisode"] {
  const observation =
    episodePayload.observation && typeof episodePayload.observation === "object"
      ? (episodePayload.observation as Record<string, unknown>)
      : null;
  const artifactUris =
    episodePayload.artifactUris && typeof episodePayload.artifactUris === "object"
      ? (episodePayload.artifactUris as Record<string, string>)
      : {};
  const primaryCameraId =
    String(observation?.primaryCameraId || episodePayload.primaryCameraId || "head_rgb").trim() || "head_rgb";
  const framePath = `${renderRouteBase}/${encodeURIComponent(sessionId)}/render?cameraId=${encodeURIComponent(primaryCameraId)}`;
  const normalizedObservation = observation ? { ...observation, frame_path: framePath } : null;
  const frameCount = Array.isArray(episodePayload.frame_paths)
    ? episodePayload.frame_paths.length
    : framePath
      ? 1
      : 0;

  return {
    episodeId: String(episodePayload.episodeId || ""),
    taskId: String(episodePayload.taskId || ""),
    task: String(episodePayload.task || ""),
    scenarioId: String(episodePayload.scenarioId || ""),
    scenario: String(episodePayload.scenario || ""),
    startStateId: String(episodePayload.startStateId || ""),
    startState: String(episodePayload.startState || ""),
    status: String(episodePayload.status || "ready") as HostedEpisodeSummary["status"],
    stepIndex: Number(episodePayload.stepIndex || 0),
    reward:
      typeof episodePayload.reward === "number" && Number.isFinite(episodePayload.reward)
        ? episodePayload.reward
        : null,
    done: Boolean(episodePayload.done),
    success:
      typeof episodePayload.success === "boolean" ? episodePayload.success : null,
    failureReason: String(episodePayload.failureReason || "").trim() || null,
    observation: normalizedObservation,
    observationSummary: {
      framePath: framePath || null,
      latestFramePath: framePath || null,
      frameCount,
      hasRenderableFrame: isRenderableObservationPath(framePath),
    },
    score:
      episodePayload.score && typeof episodePayload.score === "object"
        ? (episodePayload.score as Record<string, unknown>)
        : null,
    artifactUris,
    actionTrace: Array.isArray(episodePayload.actionTrace)
      ? (episodePayload.actionTrace as number[][])
      : [],
    observationCameras: Array.isArray(episodePayload.observationCameras)
      ? (episodePayload.observationCameras as HostedEpisodeSummary["observationCameras"])
      : [],
    canonicalPackageVersion: String(episodePayload.canonicalPackageVersion || "").trim() || null,
    presentationConfig:
      episodePayload.presentationConfig && typeof episodePayload.presentationConfig === "object"
        ? (episodePayload.presentationConfig as Record<string, unknown>)
        : null,
    qualityFlags:
      episodePayload.qualityFlags && typeof episodePayload.qualityFlags === "object"
        ? (episodePayload.qualityFlags as Record<string, unknown>)
        : null,
    protectedRegionViolations: Array.isArray(episodePayload.protectedRegionViolations)
      ? (episodePayload.protectedRegionViolations as Record<string, unknown>[])
      : [],
    debugArtifacts:
      episodePayload.debugArtifacts && typeof episodePayload.debugArtifacts === "object"
        ? (episodePayload.debugArtifacts as Record<string, unknown>)
        : null,
    runtimeEngineIdentity:
      episodePayload.runtimeEngineIdentity && typeof episodePayload.runtimeEngineIdentity === "object"
        ? (episodePayload.runtimeEngineIdentity as Record<string, unknown>)
        : null,
    runtimeModelIdentity:
      episodePayload.runtimeModelIdentity && typeof episodePayload.runtimeModelIdentity === "object"
        ? (episodePayload.runtimeModelIdentity as Record<string, unknown>)
        : null,
    runtimeCheckpointIdentity:
      episodePayload.runtimeCheckpointIdentity && typeof episodePayload.runtimeCheckpointIdentity === "object"
        ? (episodePayload.runtimeCheckpointIdentity as Record<string, unknown>)
        : null,
    generatedOutputs: {
      observationFrames: {
        framePath: framePath || null,
        latestFramePath: framePath || null,
        frameCount,
        hasRenderableFrame: isRenderableObservationPath(framePath),
      },
      actionTrace: {
        available: Boolean(artifactUris.actions),
        artifactUri: artifactUris.actions || null,
        label: "Action trace",
      },
      rolloutVideo: {
        available: Boolean(artifactUris.rollout_video || artifactUris.rolloutVideo),
        artifactUri: artifactUris.rollout_video || artifactUris.rolloutVideo || null,
        label: "Rollout video",
      },
      exportBundle: {
        available: Boolean(artifactUris.export_manifest),
        artifactUri: artifactUris.export_manifest || null,
        label: "Export bundle",
      },
    },
  };
}

export function normalizeBatchSummary(
  summaryPayload: Record<string, unknown>,
  artifactUris?: Record<string, string>,
): HostedSessionRecord["batchSummary"] {
  return {
    batchRunId: String(summaryPayload.batchRunId || ""),
    status: String(summaryPayload.status || "running") as HostedBatchSummary["status"],
    numEpisodes: Number(summaryPayload.numEpisodes || 0),
    numSuccess: Number(summaryPayload.numSuccess || 0),
    numFailure: Number(summaryPayload.numFailure || 0),
    successRate: Number(summaryPayload.successRate || 0),
    commonFailureModes: Array.isArray(summaryPayload.commonFailureModes)
      ? summaryPayload.commonFailureModes.map((item) => String(item))
      : [],
    artifactManifestUri: artifactUris?.export_manifest || null,
    exportBundle: {
      available: Boolean(artifactUris?.export_manifest),
      artifactUri: artifactUris?.export_manifest || null,
      label: "Export bundle",
    },
  };
}
