import { randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { Router, Request, Response } from "express";
import admin, { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { attachRequestMeta, logger } from "../logger";
import type {
  CreateHostedSessionRequest,
  HostedBatchSummary,
  HostedEpisodeSummary,
  HostedSessionFailureOperation,
  HostedSessionMode,
  HostedSessionPendingOperation,
  HostedSessionPendingOperationKind,
  HostedRuntimeSessionConfig,
  HostedSessionRecord,
  PresentationLaunchState,
} from "../types/hosted-session";
import {
  getLiveHostedSession,
  mergeLiveHostedSession,
  resetHostedSessionLiveStoreForTests,
  setLiveHostedSession,
} from "../utils/hosted-session-live-store";
import { createHostedSessionUiToken, getHostedSessionUiCookieName, parseCookies, verifyHostedSessionUiToken } from "../utils/hosted-session-ui-auth";
import { HostedSessionRuntimeError, resolveHostedRuntime } from "../utils/hosted-session-runtime";
import {
  PresentationDemoRuntimeError,
  launchPresentationDemoRuntime,
  stopPresentationDemoRuntime,
} from "../utils/presentation-demo-runtime";
import {
  createHostedSessionRun,
  controlHostedSessionRun,
  exportHostedSessionRun,
  fetchHostedSessionExplorerFrame,
  fetchHostedSessionState,
  HostedSessionOrchestratorError,
  loadHostedSessionRuntimeMetadata,
  mergeHostedEpisodeWithState,
  reconcileHostedEpisode,
  renderHostedSessionExplorer,
  persistHostedSessionRuntimeMetadata,
  resetHostedSessionRun,
  runBatchHostedSessionRun,
  sessionWorkDir,
  stepHostedSessionRun,
  stopHostedSessionRun,
} from "../utils/hosted-session-orchestrator";
import { parseGsUri } from "../utils/pipeline-dashboard";
import {
  buildLaunchReadiness,
  buildPresentationDemoReadiness,
  buildPresentationLaunchState,
} from "../utils/hosted-session-launch-readiness";
import {
  appendCanonicalPackageMismatch,
  buildFailureDiagnostic,
  hostedRuntimeEntitlementIds,
  selectLaunchReadinessBlockerCode,
} from "../utils/hosted-session-route-helpers";
import {
  normalizeHostedSessionPolicy,
  normalizeRequestedOutputs,
  normalizeRobotProfile,
  normalizeRuntimeConfig,
  normalizeRuntimeSessionConfig,
  normalizeTaskSelection,
} from "../utils/hosted-session-config";
import {
  buildSiteModelSummary,
  normalizeBatchSummary,
  normalizeEpisodeSummary,
} from "../utils/hosted-session-summaries";
import { runtimeBinaryRequest } from "../utils/hosted-session-runtime-transport";
import { authoritativeFrameArtifactUriForSession } from "../utils/hosted-session-artifacts";
import {
  isPublicDemoSession,
  isPublicDemoSiteWorldId,
  isReusablePresentationSession,
  isSessionExpired,
  normalizeSessionMode,
  presentationSessionKey,
  sessionUsesPresentationDemo,
} from "../utils/hosted-session-predicates";
import {
  createHostedSessionAccess,
  type HostedSessionLaunchAccess,
} from "../utils/hosted-session-access";

const protectedRouter = Router();
export const publicSiteWorldSessionsRouter = Router();
const inMemorySessions = new Map<string, HostedSessionRecord>();
const activePresentationSessionIndex = new Map<string, string>();
const pendingSessionMirrors = new Map<string, Promise<void>>();
const pendingRuntimeOperations = new Map<string, Promise<void>>();

export function resetHostedSessionRouteState() {
  inMemorySessions.clear();
  activePresentationSessionIndex.clear();
  resetHostedSessionLiveStoreForTests();
}

function nowTimestamp() {
  return admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date().toISOString();
}

function nowIso() {
  return new Date().toISOString();
}

function liveSessionReadTimeoutMs() {
  return Math.max(250, Number(process.env.BLUEPRINT_HOSTED_SESSION_LIVE_READ_TIMEOUT_MS || 1500));
}

function shouldUseAsyncRuntimeMutations() {
  return process.env.BLUEPRINT_HOSTED_SESSION_ASYNC_RUNTIME_MUTATIONS === "1" || process.env.NODE_ENV === "production";
}

const { sendHostedAccessError, ensureLaunchAccess, getLaunchAccessState } =
  createHostedSessionAccess({ loadHostedSession });

function hostedSessionCreateErrorStatus(error: HostedSessionRuntimeError) {
  if (error.code === "forbidden" || error.code === "entitlement_required" || error.code === "session_access_denied") {
    return 403;
  }
  if (error.code === "unauthorized") {
    return 401;
  }
  if (error.code === "invalid_robot_team_test_submission" || error.code === "robot_team_test_modality_required") {
    return 400;
  }
  if (
    error.code.startsWith("missing") ||
    error.code.includes("missing") ||
    error.code.includes("not_launchable") ||
    error.code.includes("unlaunchable")
  ) {
    return 409;
  }
  return 500;
}

function hostedSessionCreateError(error: unknown) {
  if (error instanceof HostedSessionRuntimeError) {
    return error;
  }
  if (error instanceof HostedSessionOrchestratorError) {
    return new HostedSessionRuntimeError(error.code, error.message);
  }
  if (error instanceof Error) {
    return new HostedSessionRuntimeError("session_create_failed", error.message);
  }
  return new HostedSessionRuntimeError("session_create_failed", "Failed to create hosted session.");
}

async function writeSession(record: HostedSessionRecord) {
  inMemorySessions.set(record.sessionId, record);
  syncPresentationSessionIndex(record);
  await setLiveHostedSession(record);
  if (!db) {
    return;
  }

  await db.collection("hostedSessions").doc(record.sessionId).set(record);
}

function queueSessionMirror(sessionId: string, update: Partial<HostedSessionRecord>) {
  const firestore = db;
  if (!firestore) {
    return;
  }
  const previous = pendingSessionMirrors.get(sessionId) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      await firestore.collection("hostedSessions").doc(sessionId).update(update);
    })
    .catch((error) => {
      logger.warn({ sessionId, error, fields: Object.keys(update) }, "Hosted session Firestore mirror failed");
    })
    .finally(() => {
      if (pendingSessionMirrors.get(sessionId) === next) {
        pendingSessionMirrors.delete(sessionId);
      }
    });
  pendingSessionMirrors.set(sessionId, next);
}

async function updateSession(
  sessionId: string,
  update: Partial<HostedSessionRecord>,
  options?: { awaitPersist?: boolean },
) {
  const current = inMemorySessions.get(sessionId);
  if (current) {
    const merged = { ...current, ...update };
    inMemorySessions.set(sessionId, merged);
    syncPresentationSessionIndex(merged);
  }
  await mergeLiveHostedSession(sessionId, update);
  if (!db) {
    return;
  }

  if (options?.awaitPersist === false) {
    queueSessionMirror(sessionId, update);
    return;
  }

  await db.collection("hostedSessions").doc(sessionId).update(update);
}

function shouldRefreshSessionFromRuntime(session: HostedSessionRecord | null | undefined) {
  if (!session) {
    return false;
  }
  if (session.activeOperation) {
    return false;
  }
  return ["ready", "running"].includes(String(session.status || "").trim());
}

function shouldPreferCachedEpisode(
  cachedEpisode: HostedSessionRecord["latestEpisode"] | null | undefined,
  refreshedEpisode: HostedSessionRecord["latestEpisode"] | null | undefined,
) {
  const cachedStepIndex = Number(cachedEpisode?.stepIndex || 0);
  const refreshedStepIndex = Number(refreshedEpisode?.stepIndex || 0);
  if (cachedStepIndex <= refreshedStepIndex) {
    return false;
  }
  if (refreshedEpisode?.status === "failed" || refreshedEpisode?.done) {
    return false;
  }
  return true;
}

function preferredRuntimeHandleForSession(session: HostedSessionRecord) {
  return {
    runtime_base_url:
      String(
        session.siteModel?.runtimeBaseUrl ||
          session.launchContext.runtime_base_url ||
          session.runtimeHandle?.runtime_base_url ||
          "",
      ).trim() || null,
    websocket_base_url:
      String(
        session.siteModel?.websocketBaseUrl ||
          session.launchContext.websocket_base_url ||
          session.runtimeHandle?.websocket_base_url ||
          "",
      ).trim() || null,
  };
}

async function readFreshHostedSession(sessionId: string): Promise<HostedSessionRecord | null> {
  const loadedSession = await loadHostedSession(sessionId);
  if (!loadedSession) {
    return loadedSession;
  }

  let session = loadedSession;
  if (isPublicDemoSession(session)) {
    const preferredHandle = preferredRuntimeHandleForSession(session);
    if (
      preferredHandle.runtime_base_url &&
      (
        String(session.runtimeHandle?.runtime_base_url || "").trim() !== preferredHandle.runtime_base_url ||
        String(session.runtimeHandle?.websocket_base_url || "").trim() !== (preferredHandle.websocket_base_url || "")
      )
    ) {
      session = {
        ...session,
        runtimeHandle: {
          ...(session.runtimeHandle || {}),
          site_world_id: String(session.runtimeHandle?.site_world_id || session.site.siteWorldId || "").trim(),
          runtime_base_url: preferredHandle.runtime_base_url,
          websocket_base_url: preferredHandle.websocket_base_url,
        },
      };
      inMemorySessions.set(session.sessionId, session);
      syncPresentationSessionIndex(session);
      await setLiveHostedSession(session);
      void updateSession(session.sessionId, { runtimeHandle: session.runtimeHandle }, { awaitPersist: false });
    }
  }

  if (!shouldRefreshSessionFromRuntime(session)) {
    return session;
  }
  try {
    await ensureRuntimeMetadataForSession(session);
    const statePayload = await fetchHostedSessionState({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      timeoutMs: liveSessionReadTimeoutMs(),
    });
    const mergedEpisode = mergeHostedEpisodeWithState(
      session.latestEpisode && typeof session.latestEpisode === "object"
        ? (session.latestEpisode as unknown as Record<string, unknown>)
        : null,
      statePayload,
    );
    let latestEpisode = normalizeEpisodeSummary(session.sessionId, mergedEpisode);
    if (shouldPreferCachedEpisode(session.latestEpisode, latestEpisode)) {
      latestEpisode = session.latestEpisode || latestEpisode;
    }
    const refreshed: HostedSessionRecord = {
      ...session,
      latestEpisode,
      status:
        latestEpisode && latestEpisode.status === "failed"
          ? "failed"
          : "running",
      latestRuntimeFailure: null,
    };
    inMemorySessions.set(session.sessionId, refreshed);
    syncPresentationSessionIndex(refreshed);
    await setLiveHostedSession(refreshed);
    void updateSession(
      session.sessionId,
      {
        latestEpisode,
        status: refreshed.status,
        latestRuntimeFailure: null,
      },
      { awaitPersist: false },
    );
    return refreshed;
  } catch (error) {
    logger.warn({ sessionId, error }, "Hosted session live read fallback to cached session");
    return session;
  }
}

export async function loadHostedSession(sessionId: string): Promise<HostedSessionRecord | null> {
  const live = await getLiveHostedSession(sessionId);
  if (live) {
    inMemorySessions.set(sessionId, live);
    syncPresentationSessionIndex(live);
    return live;
  }

  const cached = inMemorySessions.get(sessionId) ?? null;
  if (!db || cached) {
    return cached;
  }

  const doc = await db.collection("hostedSessions").doc(sessionId).get();
  if (!doc.exists) {
    return null;
  }
  const record = doc.data() as HostedSessionRecord;
  inMemorySessions.set(sessionId, record);
  syncPresentationSessionIndex(record);
  await setLiveHostedSession(record);
  return record;
}

function syncPresentationSessionIndex(record: HostedSessionRecord) {
  if (!sessionUsesPresentationDemo(record)) {
    return;
  }
  const key = presentationSessionKey(record.createdBy.uid, record.site.siteWorldId);
  if (record.status === "stopped" || record.status === "failed" || isSessionExpired(record)) {
    if (activePresentationSessionIndex.get(key) === record.sessionId) {
      activePresentationSessionIndex.delete(key);
    }
    return;
  }
  activePresentationSessionIndex.set(key, record.sessionId);
}

async function findReusablePresentationSession(uid: string, siteWorldId: string) {
  const key = presentationSessionKey(uid, siteWorldId);
  const indexedSessionId = activePresentationSessionIndex.get(key);
  if (indexedSessionId) {
    const indexedSession = await loadHostedSession(indexedSessionId);
    if (indexedSession && isReusablePresentationSession(indexedSession, uid, siteWorldId)) {
      return indexedSession;
    }
    activePresentationSessionIndex.delete(key);
  }

  for (const record of inMemorySessions.values()) {
    if (isReusablePresentationSession(record, uid, siteWorldId)) {
      syncPresentationSessionIndex(record);
      return record;
    }
  }

  if (!db) {
    return null;
  }

  const snapshot = await db
    .collection("hostedSessions")
    .where("createdBy.uid", "==", uid)
    .limit(25)
    .get();

  for (const doc of snapshot.docs) {
    const record = doc.data() as HostedSessionRecord;
    if (isReusablePresentationSession(record, uid, siteWorldId)) {
      inMemorySessions.set(record.sessionId, record);
      syncPresentationSessionIndex(record);
      return record;
    }
  }
  return null;
}

function buildWorkspaceUrl(siteWorldId: string, sessionId: string) {
  return `/world-models/${siteWorldId}/workspace?sessionId=${encodeURIComponent(sessionId)}`;
}

function buildSessionCreateResponse(record: HostedSessionRecord) {
  const artifactBackedPresentation =
    record.sessionMode === "presentation_demo" &&
    record.presentationLaunchState?.status === "artifact_backed";
  return {
    sessionId: record.sessionId,
    status: record.status,
    site: record.site,
    runtimeBackend: record.runtime_backend_selected,
    launchable:
      record.sessionMode === "presentation_demo"
        ? record.presentationRuntime?.status === "live" || artifactBackedPresentation
        : Boolean(record.runtimeHandle?.runtime_base_url || record.status === "ready"),
    uiReady: record.presentationRuntime?.status === "live",
    uiMode: record.presentationRuntime?.status === "live" ? "embedded" : "redirect",
    workspaceUrl: buildWorkspaceUrl(record.site.siteWorldId, record.sessionId),
  };
}

async function maybeServeCanonicalRenderFrame(session: HostedSessionRecord, req: Request, res: Response) {
  if (!isPublicDemoSession(session)) {
    return false;
  }
  const selectedBackend = String(session.runtime_backend_selected || session.siteModel?.primaryRuntimeBackend || "").trim();
  if (selectedBackend === "native_world_model") {
    return false;
  }
  const renderSource = String(session.siteModel?.runtimeRenderSource || "").trim();
  if (!renderSource || renderSource === "worldlabs_fallback_preview") {
    return false;
  }
  const cameraId = String(req.query.cameraId || req.query.camera_id || "head_rgb").trim() || "head_rgb";
  const artifactUri = await authoritativeFrameArtifactUriForSession(session, cameraId);
  if (!artifactUri?.startsWith("gs://") || !storageAdmin) {
    return false;
  }
  const { bucket, objectPath } = parseGsUri(artifactUri);
  const [buffer] = await storageAdmin.bucket(bucket).file(objectPath).download();
  res.setHeader("Content-Type", objectPath.toLowerCase().endsWith(".png") ? "image/png" : "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("X-Blueprint-Render-Source", "canonical-authoritative-frame");
  res.status(200).send(buffer);
  return true;
}

async function proxyRuntimeRenderForSession(session: HostedSessionRecord, req: Request, res: Response) {
  const runtimeBaseUrl = String(session.runtimeHandle?.runtime_base_url || "").trim();
  if (!runtimeBaseUrl) {
    if (await maybeServeCanonicalRenderFrame(session, req, res).catch(() => false)) {
      return;
    }
    const diagnostic = buildFailureDiagnostic({
      source: "runtime",
      operation: "render",
      error: new HostedSessionRuntimeError("runtime_handle_missing", "Runtime handle missing for hosted session"),
      fallbackCode: "runtime_handle_missing",
      fallbackSummary: "Runtime handle missing for hosted session.",
      statusCode: 409,
    });
    await updateSession(session.sessionId, { latestRuntimeFailure: diagnostic });
    return res.status(409).json({ error: diagnostic.summary, code: diagnostic.code, diagnostic });
  }
  const cameraId = String(req.query.cameraId || req.query.camera_id || "head_rgb").trim() || "head_rgb";
  const renderUrl =
    `${runtimeBaseUrl}/v1/sessions/${encodeURIComponent(session.sessionId)}/render?camera_id=${encodeURIComponent(cameraId)}`;
  const timeoutMs = Math.max(
    1000,
    Number(process.env.BLUEPRINT_HOSTED_SESSION_RENDER_TIMEOUT_MS || process.env.BLUEPRINT_HOSTED_SESSION_RUNTIME_TIMEOUT_MS || 300000),
  );
  const startedAt = Date.now();
  let response: { statusCode: number; headers: http.IncomingHttpHeaders | Record<string, string>; body: Buffer };
  try {
    response = await runtimeBinaryRequest(renderUrl, timeoutMs);
  } catch (error) {
    const runtimeError =
      error instanceof Error && (error.name === "AbortError" || /Timed out after \d+ms/.test(error.message))
        ? {
            code: "runtime_render_timeout",
            detail: `Timed out after ${timeoutMs}ms waiting for runtime render.`,
            statusCode: 504,
          }
        : {
            code: "runtime_render_unreachable",
            detail: `Failed to reach runtime render endpoint: ${error instanceof Error ? error.message : String(error)}`,
            statusCode: 502,
          };
    logger.warn(
      attachRequestMeta({
        requestId: res.locals?.requestId,
        traceId: res.locals?.traceId,
        sessionId: session.sessionId,
        runtimeUrl: renderUrl,
        durationMs: Date.now() - startedAt,
        timeoutMs: runtimeError.code === "runtime_render_timeout" ? timeoutMs : undefined,
        code: runtimeError.code,
      }),
      "Hosted session render proxy failed before receiving a response",
    );
    if (await maybeServeCanonicalRenderFrame(session, req, res).catch(() => false)) {
      return;
    }
    const diagnostic = buildFailureDiagnostic({
      source: "runtime",
      operation: "render",
      error: runtimeError,
      fallbackCode: runtimeError.code,
      fallbackSummary: "Failed to proxy runtime render.",
      statusCode: runtimeError.statusCode,
    });
    await updateSession(session.sessionId, { latestRuntimeFailure: diagnostic });
    return res.status(runtimeError.statusCode).json({ error: diagnostic.summary, code: diagnostic.code, diagnostic });
  }
  const contentType =
    typeof response.headers?.["content-type"] === "string"
      ? response.headers["content-type"]
      : Array.isArray(response.headers?.["content-type"])
        ? response.headers["content-type"][0]
        : "";
  if (response.statusCode < 200 || response.statusCode >= 300) {
    if (await maybeServeCanonicalRenderFrame(session, req, res).catch(() => false)) {
      return;
    }
    const runtimeError = contentType.toLowerCase().includes("application/json")
      ? (() => {
          const payload = JSON.parse(response.body.toString("utf-8") || "{}") as Record<string, unknown>;
          return {
            code: String(payload?.code || "runtime_render_failed"),
            detail: String(payload?.detail || payload?.error || `Runtime request failed: ${response.statusCode}`),
          };
        })()
      : {
          code: "runtime_render_failed",
          detail: response.body.toString("utf-8").trim() || `Runtime request failed: ${response.statusCode}`,
        };
    const diagnostic = buildFailureDiagnostic({
      source: "runtime",
      operation: "render",
      error: {
        code: runtimeError.code,
        message: runtimeError.detail,
        detail: runtimeError.detail,
        statusCode: response.statusCode,
      },
      fallbackCode: runtimeError.code,
      fallbackSummary: "Failed to proxy runtime render.",
      statusCode: response.statusCode,
    });
    await updateSession(session.sessionId, { latestRuntimeFailure: diagnostic });
    return res.status(response.statusCode).json({ error: diagnostic.summary, code: diagnostic.code, diagnostic });
  }
  logger.info(
    attachRequestMeta({
      requestId: res.locals?.requestId,
      traceId: res.locals?.traceId,
      sessionId: session.sessionId,
      runtimeUrl: renderUrl,
      durationMs: Date.now() - startedAt,
    }),
    "Hosted session render proxy completed",
  );
  if (session.latestRuntimeFailure?.operation === "render") {
    await updateSession(session.sessionId, { latestRuntimeFailure: null });
  }
  res.setHeader("Content-Type", contentType || "image/png");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Blueprint-Render-Source", "runtime-proxy");
  return res.send(response.body);
}

async function proxyRuntimeMediaForSession(session: HostedSessionRecord, req: Request, res: Response) {
  const runtimeBaseUrl = String(session.runtimeHandle?.runtime_base_url || "").trim();
  if (!runtimeBaseUrl) {
    const diagnostic = buildFailureDiagnostic({
      source: "runtime",
      operation: "render",
      error: new HostedSessionRuntimeError("runtime_handle_missing", "Runtime handle missing for hosted session"),
      fallbackCode: "runtime_handle_missing",
      fallbackSummary: "Runtime media handle missing for hosted session.",
      statusCode: 409,
    });
    await updateSession(session.sessionId, { latestRuntimeFailure: diagnostic });
    return res.status(409).json({ error: diagnostic.summary, code: diagnostic.code, diagnostic });
  }
  const cameraId = String(req.query.cameraId || req.query.camera_id || "head_rgb").trim() || "head_rgb";
  const chunkId = String(req.query.chunkId || req.query.chunk_id || "").trim();
  const mediaUrl =
    `${runtimeBaseUrl}/v2/sessions/${encodeURIComponent(session.sessionId)}/media?camera_id=${encodeURIComponent(cameraId)}`
    + (chunkId ? `&chunk_id=${encodeURIComponent(chunkId)}` : "");
  const timeoutMs = Math.max(
    1000,
    Number(process.env.BLUEPRINT_HOSTED_SESSION_RENDER_TIMEOUT_MS || process.env.BLUEPRINT_HOSTED_SESSION_RUNTIME_TIMEOUT_MS || 300000),
  );
  let response: { statusCode: number; headers: http.IncomingHttpHeaders | Record<string, string>; body: Buffer };
  try {
    response = await runtimeBinaryRequest(mediaUrl, timeoutMs);
  } catch (error) {
    const diagnostic = buildFailureDiagnostic({
      source: "runtime",
      operation: "render",
      error: error instanceof Error ? error : new Error(String(error)),
      fallbackCode: "runtime_media_proxy_failed",
      fallbackSummary: "Failed to proxy runtime media.",
      statusCode: error instanceof Error && /Timed out after \d+ms/.test(error.message) ? 504 : 502,
    });
    await updateSession(session.sessionId, { latestRuntimeFailure: diagnostic });
    return res.status(diagnostic.statusCode || 500).json({ error: diagnostic.summary, code: diagnostic.code, diagnostic });
  }
  const contentType =
    typeof response.headers?.["content-type"] === "string"
      ? response.headers["content-type"]
      : Array.isArray(response.headers?.["content-type"])
        ? response.headers["content-type"][0]
        : "";
  if (response.statusCode < 200 || response.statusCode >= 300) {
    const diagnostic = buildFailureDiagnostic({
      source: "runtime",
      operation: "render",
      error: new Error(response.body.toString("utf-8").trim() || `Runtime media request failed: ${response.statusCode}`),
      fallbackCode: "runtime_media_proxy_failed",
      fallbackSummary: "Failed to proxy runtime media.",
      statusCode: response.statusCode,
    });
    await updateSession(session.sessionId, { latestRuntimeFailure: diagnostic });
    return res.status(response.statusCode).json({ error: diagnostic.summary, code: diagnostic.code, diagnostic });
  }
  if (session.latestRuntimeFailure?.operation === "render") {
    await updateSession(session.sessionId, { latestRuntimeFailure: null });
  }
  res.setHeader("Content-Type", contentType || "video/mp4");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Blueprint-Render-Source", "runtime-media-proxy");
  const chunkHeader =
    typeof response.headers?.["x-blueprint-chunk-id"] === "string"
      ? response.headers["x-blueprint-chunk-id"]
      : Array.isArray(response.headers?.["x-blueprint-chunk-id"])
        ? response.headers["x-blueprint-chunk-id"][0]
        : "";
  const mediaStatusHeader =
    typeof response.headers?.["x-blueprint-media-status"] === "string"
      ? response.headers["x-blueprint-media-status"]
      : Array.isArray(response.headers?.["x-blueprint-media-status"])
        ? response.headers["x-blueprint-media-status"][0]
        : "";
  if (chunkHeader) {
    res.setHeader("X-Blueprint-Chunk-Id", chunkHeader);
  }
  if (mediaStatusHeader) {
    res.setHeader("X-Blueprint-Media-Status", mediaStatusHeader);
  }
  return res.send(response.body);
}

async function proxyRuntimeExplorerFrameForSession(session: HostedSessionRecord, req: Request, res: Response) {
  try {
    await ensureRuntimeMetadataForSession(session);
    const payload = await fetchHostedSessionExplorerFrame({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      cameraId: String(req.query.cameraId || req.query.camera_id || "head_rgb").trim() || "head_rgb",
    });
    res.setHeader("Content-Type", "image/png");
    return res.send(payload);
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
      source: "runtime",
      operation: "render",
      error,
      fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "explorer_render_failed",
      fallbackSummary: "Explorer frame fetch failed.",
    }), session);
    await updateSession(session.sessionId, { latestRuntimeFailure: diagnostic });
    return res.status(diagnostic.statusCode || 500).json({
      error: diagnostic.summary,
      code: diagnostic.code,
      diagnostic,
    });
  }
}

async function ensureRuntimeMetadataForSession(session: HostedSessionRecord) {
  const preferredHandle = preferredRuntimeHandleForSession(session);
  const preferredRuntimeBaseUrl = String(preferredHandle.runtime_base_url || "").trim();
  const preferredWebsocketBaseUrl = String(preferredHandle.websocket_base_url || "").trim();
  const runtimeBaseUrl = String(
    preferredRuntimeBaseUrl,
  ).trim();

  if (!runtimeBaseUrl) {
    throw new HostedSessionRuntimeError("runtime_handle_missing", "Missing runtime base URL for hosted session.");
  }

  const workDir = sessionWorkDir(session.sessionId);
  let shouldPersistMetadata = true;
  try {
    const metadata = await loadHostedSessionRuntimeMetadata(workDir);
    const metadataRuntimeBaseUrl = String(metadata.runtime_base_url || "").trim();
    const metadataWebsocketBaseUrl = String(metadata.websocket_base_url || "").trim();
    shouldPersistMetadata =
      !metadataRuntimeBaseUrl ||
      metadataRuntimeBaseUrl !== preferredRuntimeBaseUrl ||
      metadataWebsocketBaseUrl !== preferredWebsocketBaseUrl;
    if (!shouldPersistMetadata) {
      return;
    }
  } catch {
    // Rehydrate runtime metadata below.
  }

  if (
    isPublicDemoSession(session) &&
    (
      String(session.runtimeHandle?.runtime_base_url || "").trim() !== preferredRuntimeBaseUrl ||
      String(session.runtimeHandle?.websocket_base_url || "").trim() !== preferredWebsocketBaseUrl
    )
  ) {
    void updateSession(session.sessionId, {
      runtimeHandle: {
        ...(session.runtimeHandle || {}),
        site_world_id: String(session.runtimeHandle?.site_world_id || session.site.siteWorldId || "").trim(),
        runtime_base_url: preferredRuntimeBaseUrl,
        websocket_base_url: preferredWebsocketBaseUrl || null,
      },
    }, { awaitPersist: false });
  }

  await persistHostedSessionRuntimeMetadata(workDir, {
    runtime_base_url: runtimeBaseUrl,
    websocket_base_url:
      preferredWebsocketBaseUrl || null,
    site_world_id: String(session.runtimeHandle?.site_world_id || session.site.siteWorldId || "").trim() || null,
    build_id: String(session.runtimeHandle?.build_id || "").trim() || null,
    canonical_package_uri:
      String(
        session.siteModel?.registeredCanonicalPackageUri
          || session.launchContext.registeredCanonicalPackageUri
          || session.siteModel?.resolvedArtifactCanonicalUri
          || session.launchContext.resolvedArtifactCanonicalUri
          || "",
      ).trim() || null,
    canonical_package_version:
      String(
        session.siteModel?.registeredCanonicalPackageVersion
          || session.launchContext.registeredCanonicalPackageVersion
          || "",
      ).trim() || null,
    vm_instance_id: String(session.runtimeHandle?.vm_instance_id || "").trim() || null,
    runtime_capabilities:
      session.runtimeHandle?.runtime_capabilities && typeof session.runtimeHandle.runtime_capabilities === "object"
        ? session.runtimeHandle.runtime_capabilities
        : {},
    health_status: String(session.runtimeHandle?.health_status || "").trim() || null,
    last_heartbeat_at: String(session.runtimeHandle?.last_heartbeat_at || "").trim() || null,
  });
}

function hostedSessionRouteLogContext(
  req: Request,
  res: Response,
  session: HostedSessionRecord,
  operation: HostedSessionFailureOperation,
  routeScope: "public" | "protected",
) {
  return attachRequestMeta({
    requestId: res.locals?.requestId,
    traceId: res.locals?.traceId,
    method: req.method,
    path: req.originalUrl || req.path,
    sessionId: session.sessionId,
    siteWorldId: session.site.siteWorldId,
    operation,
    routeScope,
  });
}

function pendingOperationLabel(operation: HostedSessionPendingOperationKind) {
  return operation === "reset" ? "Resetting runtime" : "Applying action";
}

function buildPendingOperation(
  operation: HostedSessionPendingOperationKind,
  status: HostedSessionPendingOperation["status"] = "queued",
): HostedSessionPendingOperation {
  const timestamp = nowIso();
  return {
    operation,
    status,
    label: pendingOperationLabel(operation),
    startedAt: timestamp,
    updatedAt: timestamp,
  };
}

function operationInProgressResponse(
  res: Response,
  session: HostedSessionRecord,
  operation: HostedSessionPendingOperationKind,
) {
  const activeOperation = session.activeOperation;
  if (!activeOperation) {
    return null;
  }
  if (activeOperation.operation === operation) {
    return res.status(202).json({
      accepted: true,
      pendingOperation: activeOperation,
      episode: session.latestEpisode || null,
    });
  }
  return res.status(409).json({
    error: `${activeOperation.label} is already in progress for this session.`,
    code: "session_operation_in_progress",
    pendingOperation: activeOperation,
    episode: session.latestEpisode || null,
  });
}

async function startPendingRuntimeOperation(params: {
  session: HostedSessionRecord;
  operation: HostedSessionPendingOperationKind;
  logContext: Record<string, unknown>;
  run: () => Promise<void>;
}) {
  const queuedOperation = buildPendingOperation(params.operation, "queued");
  await updateSession(
    params.session.sessionId,
    {
      activeOperation: queuedOperation,
      latestRuntimeFailure: null,
    },
    { awaitPersist: false },
  );

  let operationPromise: Promise<void> | null = null;
  operationPromise = (async () => {
    try {
      logger.info(
        attachRequestMeta({
          ...params.logContext,
          pendingStatus: "running",
        }),
        "Hosted session runtime mutation running in background",
      );
      await updateSession(
        params.session.sessionId,
        {
          activeOperation: {
            ...queuedOperation,
            status: "running",
            updatedAt: nowIso(),
          },
          latestRuntimeFailure: null,
        },
        { awaitPersist: false },
      );
      await params.run();
      logger.info(params.logContext, "Hosted session runtime mutation completed in background");
    } finally {
      if (pendingRuntimeOperations.get(params.session.sessionId) === operationPromise) {
        pendingRuntimeOperations.delete(params.session.sessionId);
      }
    }
  })();

  pendingRuntimeOperations.set(params.session.sessionId, operationPromise);
  return queuedOperation;
}

async function resolveResetRouteInputs(
  session: HostedSessionRecord,
  body: Record<string, unknown> | null | undefined,
) {
  const startState = String(body?.startStateId || session.runtimeConfig?.startStateId || "").trim();
  const scenario = String(body?.scenarioId || session.runtimeConfig?.scenarioId || "").trim();
  if (startState && scenario) {
    return { startState, scenario };
  }

  const runtime = await resolveHostedRuntime(session.site.siteWorldId);
  return {
    startState: startState || String(runtime.startStateCatalog[0]?.id || "").trim(),
    scenario: scenario || String(runtime.scenarioCatalog[0]?.id || "").trim(),
  };
}

async function createRuntimeOnlySession(params: {
  body: CreateHostedSessionRequest;
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>;
  record: HostedSessionRecord;
}) {
  const workDir = sessionWorkDir(params.record.sessionId);
  try {
    const createPayload = await createHostedSessionRun({
      sessionId: params.record.sessionId,
      workDir,
      runtime: params.runtime,
      robotProfileId: params.body.robotProfileId,
      robotProfileOverride: params.body.robotProfileOverride,
      policy: params.record.policy,
      taskId: params.body.taskId,
      scenarioId: params.body.scenarioId,
      startStateId: params.body.startStateId,
      requestedBackend: params.record.runtimeConfig?.requestedBackend,
      exportModes: params.record.requestedOutputs || ["raw_bundle", "rlds_dataset"],
      notes: params.record.notes ?? undefined,
      runtimeSessionConfig: params.record.runtimeSessionConfig,
    });
    const runtimeMetadata = await loadHostedSessionRuntimeMetadata(workDir);

    const runtimeBackend = String(createPayload.payload.runtime_backend_selected || "unknown");
    const artifactUris =
      (createPayload.payload.artifact_uris as Record<string, string> | undefined) ?? {};
    const datasetArtifacts =
      (createPayload.payload.dataset_artifacts as Record<string, unknown> | undefined) ?? {};
    await updateSession(params.record.sessionId, {
      runtime_backend_requested:
        String(createPayload.payload.runtime_backend_requested || params.record.runtimeConfig?.requestedBackend || "").trim() || null,
      runtime_backend_selected: runtimeBackend,
      runtime_execution_mode:
        String(createPayload.payload.runtime_execution_mode || "").trim()
        || params.record.runtime_execution_mode
        || null,
      status: "ready",
      startedAt: nowTimestamp(),
      artifactUris,
      datasetArtifacts,
      latestRuntimeFailure: null,
      runtimeHandle: {
        site_world_id: String(runtimeMetadata.site_world_id || ""),
        build_id: runtimeMetadata.build_id ? String(runtimeMetadata.build_id) : null,
        runtime_base_url: runtimeMetadata.runtime_base_url ? String(runtimeMetadata.runtime_base_url) : null,
        websocket_base_url: runtimeMetadata.websocket_base_url ? String(runtimeMetadata.websocket_base_url) : null,
        vm_instance_id: runtimeMetadata.vm_instance_id ? String(runtimeMetadata.vm_instance_id) : null,
        runtime_capabilities:
          runtimeMetadata.runtime_capabilities && typeof runtimeMetadata.runtime_capabilities === "object"
            ? (runtimeMetadata.runtime_capabilities as Record<string, unknown>)
            : null,
        health_status: runtimeMetadata.health_status ? String(runtimeMetadata.health_status) : null,
        last_heartbeat_at: runtimeMetadata.last_heartbeat_at ? String(runtimeMetadata.last_heartbeat_at) : null,
      },
    });

    return (await loadHostedSession(params.record.sessionId)) || {
      ...params.record,
      status: "ready" as const,
      runtime_backend_selected: runtimeBackend,
      runtime_execution_mode:
        String(createPayload.payload.runtime_execution_mode || "").trim() || params.record.runtime_execution_mode || null,
    };
  } catch (error) {
    const diagnostic = buildFailureDiagnostic({
      source: "runtime",
      operation: "create",
      error,
      fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "session_create_failed",
      fallbackSummary: "Runtime session launch failed.",
    });
    await updateSession(params.record.sessionId, {
      status: "failed",
      latestRuntimeFailure: diagnostic,
    });
    throw error;
  }
}

async function launchPresentationDemoSession(
  record: HostedSessionRecord,
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>,
  options: { failSessionOnError?: boolean } = {},
) {
  const proxyPath = `/api/site-worlds/sessions/${encodeURIComponent(record.sessionId)}/ui/`;
  const readiness = await buildPresentationDemoReadiness({
    runtime,
    accessBlockers: [],
  });
  if (!readiness.launchable) {
    await updateSession(record.sessionId, {
      status: options.failSessionOnError ? "failed" : record.status === "creating" ? "ready" : record.status,
      presentationLaunchState: buildPresentationLaunchState({ readiness, runtime }),
      presentationRuntime: record.presentationRuntime
        ? {
            ...record.presentationRuntime,
            status: "failed",
            proxyPath,
            errorCode: readiness.blocker_details[0]?.code || "presentation_demo_blocked",
            errorMessage: readiness.blockers[0] || "Presentation viewer is blocked.",
          }
        : {
            provider: "vast",
            status: "failed",
            uiBaseUrl: null,
            proxyPath,
            instanceId: null,
            startedAt: null,
            expiresAt: null,
            errorCode: readiness.blocker_details[0]?.code || "presentation_demo_blocked",
            errorMessage: readiness.blockers[0] || "Presentation viewer is blocked.",
          },
    });
    return;
  }
  if (readiness.status === "presentation_ui_unconfigured") {
    await updateSession(record.sessionId, {
      runtime_backend_selected:
        record.runtime_backend_selected || record.runtime_backend_requested || runtime.defaultRuntimeBackend || "site_world_runtime",
      status: record.status === "creating" ? "ready" : record.status,
      startedAt: record.startedAt || nowTimestamp(),
      presentationRuntime: null,
      presentationLaunchState: buildPresentationLaunchState({ readiness, runtime }),
      latestRuntimeFailure: null,
    });
    return;
  }
  try {
    await updateSession(record.sessionId, {
      runtime_backend_selected: record.runtime_backend_requested || runtime.defaultRuntimeBackend || "site_world_runtime",
      presentationRuntime: {
        ...(record.presentationRuntime || { provider: "vast" as const }),
        status: "starting",
        proxyPath,
        errorCode: null,
        errorMessage: null,
      },
      presentationLaunchState: buildPresentationLaunchState({
        presentationRuntime: {
          ...(record.presentationRuntime || { provider: "vast" as const }),
          status: "starting",
          proxyPath,
          errorCode: null,
          errorMessage: null,
        },
        readiness,
        runtime,
      }),
    });
    const presentationRuntime = await launchPresentationDemoRuntime({
      sessionId: record.sessionId,
      runtime,
      proxyPath,
    });
    await updateSession(record.sessionId, {
      runtime_backend_selected: record.runtime_backend_requested || runtime.defaultRuntimeBackend || "site_world_runtime",
      status: record.status === "creating" ? "ready" : record.status,
      startedAt: nowTimestamp(),
      presentationRuntime,
      presentationLaunchState: buildPresentationLaunchState({
        presentationRuntime,
        readiness,
        runtime,
      }),
      latestRuntimeFailure: null,
    });
  } catch (error) {
    const failure =
      error instanceof PresentationDemoRuntimeError
        ? error
        : error instanceof Error
          ? new PresentationDemoRuntimeError("presentation_demo_launch_failed", error.message)
          : new PresentationDemoRuntimeError("presentation_demo_launch_failed", "Failed to launch presentation demo.");
    const diagnostic = buildFailureDiagnostic({
      source: "presentation_demo",
      operation: "presentation_launch",
      error: failure,
      fallbackCode: failure.code,
      fallbackSummary: "Presentation viewer launch failed.",
    });
    await updateSession(record.sessionId, {
      status: options.failSessionOnError ? "failed" : record.status === "creating" ? "ready" : record.status,
      presentationRuntime: {
        provider: "vast",
        status: "failed",
        uiBaseUrl: null,
        proxyPath,
        instanceId: null,
        startedAt: null,
        expiresAt: null,
        errorCode: failure.code,
        errorMessage: failure.message,
      },
      presentationLaunchState: {
        status: "blocked",
        blockers: [failure.message],
        blockerDetails: [
          {
            code: failure.code,
            message: failure.message,
            source: "presentation_demo",
          },
        ],
        presentationWorldManifestUri: runtime.presentationWorldManifestUri ?? null,
        runtimeDemoManifestUri: runtime.runtimeDemoManifestUri ?? null,
        uiBaseUrl: null,
      },
      latestRuntimeFailure: diagnostic,
    });
  }
}

function createSessionRecord(params: {
  body: CreateHostedSessionRequest;
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>;
  presentationLaunchState?: PresentationLaunchState | null;
  user: Pick<HostedSessionLaunchAccess, "uid" | "email" | "accessSource" | "entitlement">;
}) {
  const taskSelection = normalizeTaskSelection(params.body, params.runtime);
  const runtimeConfig = normalizeRuntimeConfig(params.body, params.runtime);
  const runtimeSessionConfig = normalizeRuntimeSessionConfig(params.body, params.runtime);
  const robotProfile = normalizeRobotProfile(params.body, params.runtime);
  const sessionId = randomUUID();
  const sessionMode = normalizeSessionMode(params.body.sessionMode);
  const commerceAccessSource =
    params.user.accessSource === "none" || params.user.accessSource === "session_share"
      ? null
      : params.user.accessSource;

  return {
    sessionId,
    site: {
      siteWorldId: params.runtime.siteWorldId,
      siteName: params.runtime.siteName,
      siteAddress: params.runtime.siteAddress,
      scene_id: params.runtime.scene_id,
      capture_id: params.runtime.capture_id,
      site_submission_id: params.runtime.site_submission_id,
      pipeline_prefix: params.runtime.pipeline_prefix,
    },
    siteModel: buildSiteModelSummary(params.runtime),
    sessionMode,
    runtimeUi: sessionMode === "presentation_demo" ? (params.body.runtimeUi || "neoverse_gradio") : null,
    runtime_backend_requested: runtimeConfig.requestedBackend || params.runtime.defaultRuntimeBackend,
    runtime_backend_selected:
      sessionMode === "presentation_demo"
        ? (runtimeConfig.requestedBackend || params.runtime.defaultRuntimeBackend || "site_world_runtime")
        : "pending",
    runtime_execution_mode:
      params.runtime.runtimeManifest?.backendVariants?.[runtimeConfig.requestedBackend || params.runtime.defaultRuntimeBackend || ""]?.runtimeMode
      || null,
    status: "creating" as const,
    robotProfileId: params.body.robotProfileId,
    robotProfile,
    robot: robotProfile.displayName,
    policy: normalizeHostedSessionPolicy(params.body),
    runtimeConfig,
    runtimeSessionConfig,
    taskSelection,
    requestedOutputs: normalizeRequestedOutputs(params.body),
    datasetArtifacts: {},
    task: taskSelection.taskText,
    scenario:
      params.runtime.scenarioCatalog.find((item) => item.id === runtimeConfig.scenarioId)?.name
      || runtimeConfig.scenarioId,
    notes: params.body.notes || null,
    createdBy: {
      uid: params.user.uid,
      email: params.user.email,
    },
    commerce: {
      entitlementId: params.user.entitlement?.id || params.body.entitlementId || null,
      orderId: params.user.entitlement?.order_id || params.body.orderId || null,
      mode: params.body.commerceMode === "dry_run" || params.user.entitlement?.dry_run ? "dry_run" : null,
      sku: params.user.entitlement?.sku || null,
      accessSource: commerceAccessSource,
    },
    createdAt: nowTimestamp(),
    startedAt: null,
    stoppedAt: null,
    elapsedSeconds: 0,
    latestEpisode: null,
    explorerState: null,
    batchSummary: null,
    artifactUris: {},
    runtimeHandle: null,
    presentationRuntime:
      sessionMode === "presentation_demo"
        ? {
            provider: "vast" as const,
            status: "provisioning" as const,
            uiBaseUrl: null,
            proxyPath: `/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/ui/`,
            instanceId: null,
            startedAt: null,
            expiresAt: null,
            errorCode: null,
            errorMessage: null,
          }
        : null,
    presentationLaunchState: params.presentationLaunchState || null,
    latestRuntimeFailure: null,
    metering: {
      sessionSeconds: 0,
      billableHours: 0,
      priceLabel: params.runtime.priceLabel ?? null,
    },
    launchContext: {
      site_world_spec_uri: params.runtime.siteWorldSpecUri,
      site_world_registration_uri: params.runtime.siteWorldRegistrationUri,
      site_world_health_uri: params.runtime.siteWorldHealthUri,
      resolvedArtifactCanonicalUri: params.runtime.resolvedArtifactCanonicalUri,
      registeredCanonicalPackageUri: params.runtime.registeredCanonicalPackageUri ?? null,
      registeredCanonicalPackageVersion: params.runtime.registeredCanonicalPackageVersion ?? null,
      runtime_base_url: params.runtime.runtimeBaseUrl ?? null,
      websocket_base_url: params.runtime.websocketBaseUrl ?? null,
      conditioning_bundle_uri: params.runtime.conditioningBundleUri,
      scene_memory_manifest_uri: params.runtime.sceneMemoryManifestUri,
    },
  } satisfies HostedSessionRecord;
}

function normalizeExplorerPose(body: unknown) {
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  return {
    x: Number(payload.x || 0),
    y: Number(payload.y || 0),
    z: Number(payload.z || 0),
    yaw: Number(payload.yaw || 0),
    pitch: Number(payload.pitch || 0),
  };
}

function buildExplorerState(
  sessionId: string,
  payload: Record<string, unknown>,
): HostedSessionRecord["explorerState"] {
  const cameraId = String(payload.camera_id || "head_rgb").trim() || "head_rgb";
  return {
    pose: normalizeExplorerPose(payload.pose),
    explorerFrame: {
      cameraId,
      framePath: `/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/explorer-frame?cameraId=${encodeURIComponent(cameraId)}`,
      viewport:
        payload.viewport && typeof payload.viewport === "object"
          ? (payload.viewport as Record<string, unknown>)
          : null,
      snapshotId: String(payload.snapshot_id || "").trim() || null,
    },
    explorerQualityFlags:
      payload.quality_flags && typeof payload.quality_flags === "object"
        ? (payload.quality_flags as Record<string, unknown>)
        : null,
    groundedSource: String(payload.grounded_source || "").trim() as NonNullable<HostedSessionRecord["explorerState"]>["groundedSource"],
    refineStatus: String(payload.refine_status || "").trim() as NonNullable<HostedSessionRecord["explorerState"]>["refineStatus"],
    debugArtifacts:
      payload.debug_artifacts && typeof payload.debug_artifacts === "object"
        ? (payload.debug_artifacts as Record<string, unknown>)
        : null,
  };
}

function sessionModeUnsupportedResponse(res: Response) {
  return res.status(409).json({
    error: "This operation is not available for presentation-demo sessions.",
    code: "session_mode_unsupported",
  });
}

function stripProxyResponseHeader(key: string) {
  const normalized = key.toLowerCase();
  return normalized === "x-frame-options" || normalized === "content-security-policy" || normalized === "content-length";
}

async function proxyPresentationUiRequest(req: Request, res: Response) {
  const sessionId = String(req.params.sessionId || "");
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[getHostedSessionUiCookieName()];
  if (!verifyHostedSessionUiToken(token || "", sessionId)) {
    return res.status(401).json({ error: "Missing or invalid UI session token" });
  }

  const session = await loadHostedSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Hosted session not found" });
  }
  const uiBaseUrl = String(session.presentationRuntime?.uiBaseUrl || "").trim();
  if (session.presentationRuntime?.status !== "live" || !uiBaseUrl) {
    return res.status(409).json({ error: "Presentation demo UI is not available" });
  }

  const proxyPrefixes = [
    `/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/ui`,
    `/${encodeURIComponent(sessionId)}/ui`,
  ];
  const originalUrl = req.originalUrl || req.url;
  const matchedPrefix = proxyPrefixes.find((prefix) => originalUrl.startsWith(prefix));
  const rawSuffix = matchedPrefix ? originalUrl.slice(matchedPrefix.length) : "";
  const baseUrl = new URL(uiBaseUrl.endsWith("/") ? uiBaseUrl : `${uiBaseUrl}/`);
  const suffix = rawSuffix
    ? rawSuffix.startsWith("/") || rawSuffix.startsWith("?")
      ? `.${rawSuffix}`
      : rawSuffix
    : ".";
  const upstreamUrl = new URL(suffix, baseUrl);

  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (!value || key === "host" || key === "cookie" || key === "content-length") {
      return;
    }
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
      return;
    }
    headers.set(key, value);
  });
  headers.set("x-forwarded-host", req.headers.host || "");
  headers.set("x-forwarded-prefix", matchedPrefix || proxyPrefixes[0]);

  let body: BodyInit | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (Buffer.isBuffer(req.body)) {
      body = req.body;
    } else if (typeof req.body === "string") {
      body = req.body;
    } else if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) {
      const contentType = headers.get("content-type") || "application/json";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        body = new URLSearchParams(req.body as Record<string, string>).toString();
      } else {
        headers.set("content-type", "application/json");
        body = JSON.stringify(req.body);
      }
    }
  }

  const response = await fetch(upstreamUrl, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (!stripProxyResponseHeader(key)) {
      res.setHeader(key, value);
    }
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return res.send(buffer);
}

function rawUpgradeResponse(socket: Duplex, statusCode: number, message: string) {
  socket.write(`HTTP/1.1 ${statusCode} ${statusCode === 401 ? "Unauthorized" : statusCode === 404 ? "Not Found" : "Bad Gateway"}\r\nConnection: close\r\nContent-Type: text/plain\r\nContent-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`);
  socket.destroy();
}

export async function handleHostedSessionUiUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
  const url = String(req.url || "");
  const match = url.match(/^\/api\/site-worlds\/sessions\/([^/]+)\/ui(\/.*)?$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const sessionId = decodeURIComponent(match[1] || "");
  const token = parseCookies(req.headers.cookie)[getHostedSessionUiCookieName()];
  if (!verifyHostedSessionUiToken(token || "", sessionId)) {
    rawUpgradeResponse(socket, 401, "Missing or invalid UI session token");
    return;
  }

  const session = await loadHostedSession(sessionId);
  if (!session) {
    rawUpgradeResponse(socket, 404, "Hosted session not found");
    return;
  }

  const uiBaseUrl = String(session.presentationRuntime?.uiBaseUrl || "").trim();
  if (session.presentationRuntime?.status !== "live" || !uiBaseUrl) {
    rawUpgradeResponse(socket, 502, "Presentation demo UI is not available");
    return;
  }

  const base = new URL(uiBaseUrl);
  const protocol = base.protocol === "https:" ? "wss:" : "ws:";
  const upstreamUrl = new URL(match[2] || "/", `${protocol}//${base.host}${base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`}`);
  const requestFn = upstreamUrl.protocol === "wss:" ? https.request : http.request;
  const proxyReq = requestFn(upstreamUrl, {
    method: "GET",
    headers: {
      ...req.headers,
      host: upstreamUrl.host,
      cookie: undefined,
    },
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    const statusLine = `HTTP/1.1 ${proxyRes.statusCode || 101} ${proxyRes.statusMessage || "Switching Protocols"}\r\n`;
    socket.write(statusLine);
    Object.entries(proxyRes.headers).forEach(([key, value]) => {
      if (!value || stripProxyResponseHeader(key)) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => socket.write(`${key}: ${item}\r\n`));
        return;
      }
      socket.write(`${key}: ${value}\r\n`);
    });
    socket.write("\r\n");
    if (head.length > 0) {
      proxySocket.write(head);
    }
    if (proxyHead.length > 0) {
      socket.write(proxyHead);
    }
    proxySocket.pipe(socket).pipe(proxySocket);
  });
  proxyReq.on("response", (proxyRes) => {
    rawUpgradeResponse(socket, proxyRes.statusCode || 502, proxyRes.statusMessage || "Upgrade failed");
  });
  proxyReq.on("error", () => {
    rawUpgradeResponse(socket, 502, "Unable to reach presentation demo UI");
  });
  proxyReq.end();
}

publicSiteWorldSessionsRouter.get("/:sessionId/ui/bootstrap", async (req, res) => {
  const sessionId = String(req.params.sessionId || "");
  const token = String(req.query.token || "");
  if (!verifyHostedSessionUiToken(token, sessionId)) {
    return res.status(401).json({ error: "Missing or invalid UI bootstrap token" });
  }

  const session = await loadHostedSession(sessionId);
  if (!session) {
    return res.status(404).json({ error: "Hosted session not found" });
  }
  if (session.presentationRuntime?.status !== "live") {
    return res.status(409).json({ error: "Presentation demo UI is not available" });
  }

  res.cookie(getHostedSessionUiCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: `/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/ui`,
  });
  return res.redirect(session.presentationRuntime?.proxyPath || `/api/site-worlds/sessions/${encodeURIComponent(sessionId)}/ui/`);
});

publicSiteWorldSessionsRouter.all("/:sessionId/ui", proxyPresentationUiRequest);
publicSiteWorldSessionsRouter.all("/:sessionId/ui/*", proxyPresentationUiRequest);

publicSiteWorldSessionsRouter.get("/launch-readiness", async (req, res, next) => {
  try {
    const siteWorldId = String(req.query.siteWorldId || "").trim();
    if (!isPublicDemoSiteWorldId(siteWorldId)) {
      return next();
    }
    const runtime = await resolveHostedRuntime(siteWorldId);
    return res.json(
      await buildLaunchReadiness({
        runtime,
        entitled: true,
        accessBlockers: [],
      }),
    );
  } catch (error) {
    const hostedError =
      error instanceof HostedSessionRuntimeError
        ? error
        : new HostedSessionRuntimeError("launch_readiness_failed", error instanceof Error ? error.message : "Failed to resolve launch readiness.");
    return res.status(hostedError.code === "site_not_found" ? 404 : 500).json({
      error: hostedError.message,
      code: hostedError.code,
    });
  }
});

publicSiteWorldSessionsRouter.post("/", async (req, res, next) => {
  try {
    const body = (req.body ?? {}) as CreateHostedSessionRequest;
    if (!isPublicDemoSiteWorldId(String(body.siteWorldId || ""))) {
      return next();
    }
    if (!body.siteWorldId || !body.robotProfileId || !body.taskId || !body.scenarioId || !body.startStateId) {
      return res.status(400).json({
        error: "siteWorldId, robotProfileId, taskId, scenarioId, and startStateId are required",
      });
    }

    const runtime = await resolveHostedRuntime(String(body.siteWorldId));
    const sessionMode = normalizeSessionMode(body.sessionMode);
    const runtimeSessionConfig = normalizeRuntimeSessionConfig(body, runtime);
    const readiness = await buildLaunchReadiness({
      runtime,
      entitled: true,
      accessBlockers: [],
      runtimeSessionConfig,
    });
    const selectedReadiness =
      sessionMode === "presentation_demo" ? readiness.presentation_demo : readiness.runtime_only;
    if (!selectedReadiness.launchable) {
      const primaryCode = selectLaunchReadinessBlockerCode({
        sessionMode,
        blockerDetails: selectedReadiness.blocker_details,
      });
      return res.status(409).json({
        error: selectedReadiness.blockers.join(", "),
        code: primaryCode,
        blockers: selectedReadiness.blockers,
        blocker_details: selectedReadiness.blocker_details,
      });
    }

    const record = createSessionRecord({
      body,
      runtime,
      presentationLaunchState: buildPresentationLaunchState({
        readiness: readiness.presentation_demo,
        runtime,
      }),
      user: { uid: "public-demo-user", email: null, accessSource: "public_demo", entitlement: null },
    });
    await writeSession(record);

    if (sessionMode === "presentation_demo") {
      const finalizedRecord = await createRuntimeOnlySession({ body, runtime, record });
      await launchPresentationDemoSession(finalizedRecord, runtime, { failSessionOnError: true });
      return res
        .status(201)
        .json(buildSessionCreateResponse((await loadHostedSession(finalizedRecord.sessionId)) || finalizedRecord));
    }

    const finalizedRecord = await createRuntimeOnlySession({ body, runtime, record });
    return res
      .status(201)
      .json(buildSessionCreateResponse((await loadHostedSession(finalizedRecord.sessionId)) || finalizedRecord));
  } catch (error) {
    const hostedError = hostedSessionCreateError(error);
    const status = hostedSessionCreateErrorStatus(hostedError);
    return res.status(status).json({ error: hostedError.message, code: hostedError.code });
  }
});

publicSiteWorldSessionsRouter.get("/:sessionId", async (req, res, next) => {
  const session = await readFreshHostedSession(String(req.params.sessionId || ""));
  if (!session || !isPublicDemoSession(session)) {
    return next();
  }
  return res.json(session);
});

publicSiteWorldSessionsRouter.post("/:sessionId/reset", async (req, res, next) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session || !isPublicDemoSession(session)) {
      return next();
    }
    if (sessionUsesPresentationDemo(session) && session.presentationRuntime) {
      return sessionModeUnsupportedResponse(res);
    }
    const logContext = hostedSessionRouteLogContext(req, res, session, "reset", "public");
    logger.info(logContext, "Hosted session reset started");
    await ensureRuntimeMetadataForSession(session);
    logger.info(logContext, "Hosted session runtime metadata ready");
    const { startState, scenario } = await resolveResetRouteInputs(
      session,
      req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : null,
    );
    const seed =
      typeof req.body?.seed === "number"
        ? req.body.seed
        : typeof session.runtimeConfig?.seed === "number"
          ? session.runtimeConfig.seed
          : undefined;
    logger.info(
      attachRequestMeta({
        ...logContext,
        taskId: req.body?.taskId || session.taskSelection?.taskId || undefined,
        scenarioId: scenario,
        startStateId: startState,
        seed: seed ?? undefined,
      }),
      "Hosted session reset runtime inputs resolved",
    );
    if (session.activeOperation) {
      return operationInProgressResponse(res, session, "reset");
    }
    if (shouldUseAsyncRuntimeMutations()) {
      const pendingOperation = await startPendingRuntimeOperation({
        session,
        operation: "reset",
        logContext,
        run: async () => {
          try {
            const payload = await resetHostedSessionRun({
              sessionId: session.sessionId,
              workDir: sessionWorkDir(session.sessionId),
              taskId: req.body?.taskId || session.taskSelection?.taskId || undefined,
              scenarioId: scenario,
              startStateId: startState,
              seed,
            });
            logger.info(logContext, "Hosted session reset runtime call completed");
            const reconciledEpisode = await reconcileHostedEpisode({
              sessionId: session.sessionId,
              workDir: sessionWorkDir(session.sessionId),
              episode: payload.rawEpisode,
              expectedStepIndex: 0,
            });
            logger.info(logContext, "Hosted session reset snapshot reconciled");
            const latestEpisode = normalizeEpisodeSummary(session.sessionId, reconciledEpisode);
            await updateSession(
              session.sessionId,
              {
                activeOperation: null,
                latestEpisode,
                status: "running",
                latestRuntimeFailure: null,
                runtimeConfig: {
                  ...(session.runtimeConfig || {}),
                  scenarioId: scenario,
                  startStateId: startState,
                  seed: seed ?? null,
                  requestedBackend: session.runtime_backend_selected,
                },
              },
              { awaitPersist: false },
            );
            logger.info(
              attachRequestMeta({
                ...logContext,
                episodeId: latestEpisode?.episodeId || undefined,
                stepIndex: latestEpisode?.stepIndex || 0,
              }),
              "Hosted session reset completed",
            );
          } catch (error) {
            const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
              source: "runtime",
              operation: "reset",
              error,
              fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "reset_failed",
              fallbackSummary: "Reset failed.",
            }), await loadHostedSession(session.sessionId));
            await updateSession(
              session.sessionId,
              {
                activeOperation: null,
                latestRuntimeFailure: diagnostic,
              },
              { awaitPersist: false },
            );
            logger.warn(
              attachRequestMeta({
                ...logContext,
                code: diagnostic.code,
                statusCode: diagnostic.statusCode || undefined,
              }),
              "Hosted session reset failed in background",
            );
          }
        },
      });
      return res.status(202).json({
        accepted: true,
        pendingOperation,
        episode: session.latestEpisode || null,
      });
    }
    const payload = await resetHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      taskId: req.body?.taskId || session.taskSelection?.taskId || undefined,
      scenarioId: scenario,
      startStateId: startState,
      seed,
    });
    logger.info(logContext, "Hosted session reset runtime call completed");
    const reconciledEpisode = await reconcileHostedEpisode({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      episode: payload.rawEpisode,
      expectedStepIndex: 0,
    });
    logger.info(logContext, "Hosted session reset snapshot reconciled");
    const latestEpisode = normalizeEpisodeSummary(
      session.sessionId,
      reconciledEpisode,
    );
    await updateSession(session.sessionId, {
      latestEpisode,
      status: "running",
      latestRuntimeFailure: null,
      runtimeConfig: {
        ...(session.runtimeConfig || {}),
        scenarioId: scenario,
        startStateId: startState,
        seed: seed ?? null,
        requestedBackend: session.runtime_backend_selected,
      },
    }, { awaitPersist: false });
    logger.info(
      attachRequestMeta({
        ...logContext,
        episodeId: latestEpisode?.episodeId || undefined,
        stepIndex: latestEpisode?.stepIndex || 0,
      }),
      "Hosted session reset completed",
    );
    return res.json({ ...payload, episode: latestEpisode });
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
      source: "runtime",
      operation: "reset",
      error,
      fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "reset_failed",
      fallbackSummary: "Reset failed.",
    }), await loadHostedSession(String(req.params.sessionId || "")));
    const sessionId = String(req.params.sessionId || "");
    if (sessionId) {
      await updateSession(sessionId, { latestRuntimeFailure: diagnostic });
    }
    return res.status(diagnostic.statusCode || 500).json({
      error: diagnostic.summary,
      code: diagnostic.code,
      diagnostic,
    });
  }
});

publicSiteWorldSessionsRouter.post("/:sessionId/step", async (req, res, next) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session || !isPublicDemoSession(session)) {
      return next();
    }
    if (session.activeOperation) {
      return operationInProgressResponse(res, session, "step");
    }
    await ensureRuntimeMetadataForSession(session);
    const logContext = hostedSessionRouteLogContext(req, res, session, "step", "public");
    if (shouldUseAsyncRuntimeMutations()) {
      const pendingOperation = await startPendingRuntimeOperation({
        session,
        operation: "step",
        logContext,
        run: async () => {
          try {
            const payload = await stepHostedSessionRun({
              sessionId: session.sessionId,
              workDir: sessionWorkDir(session.sessionId),
              episodeId: String(req.body?.episodeId || ""),
              action: Array.isArray(req.body?.action) ? req.body.action : undefined,
              autoPolicy: req.body?.autoPolicy !== false,
            });
            const expectedStepIndex = Math.max(
              Number(session.latestEpisode?.stepIndex || 0) + 1,
              Number(payload.episode?.stepIndex || 0),
            );
            const reconciledEpisode = await reconcileHostedEpisode({
              sessionId: session.sessionId,
              workDir: sessionWorkDir(session.sessionId),
              episode: payload.rawEpisode,
              expectedStepIndex,
            });
            const latestEpisode = normalizeEpisodeSummary(session.sessionId, reconciledEpisode);
            await updateSession(
              session.sessionId,
              {
                activeOperation: null,
                latestEpisode,
                latestRuntimeFailure: null,
              },
              { awaitPersist: false },
            );
          } catch (error) {
            const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
              source: "runtime",
              operation: "step",
              error,
              fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "step_failed",
              fallbackSummary: "Step failed.",
            }), await loadHostedSession(session.sessionId));
            await updateSession(
              session.sessionId,
              {
                activeOperation: null,
                latestRuntimeFailure: diagnostic,
              },
              { awaitPersist: false },
            );
            logger.warn(
              attachRequestMeta({
                ...logContext,
                code: diagnostic.code,
                statusCode: diagnostic.statusCode || undefined,
              }),
              "Hosted session step failed in background",
            );
          }
        },
      });
      return res.status(202).json({
        accepted: true,
        pendingOperation,
        episode: session.latestEpisode || null,
      });
    }
    const payload = await stepHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      episodeId: String(req.body?.episodeId || ""),
      action: Array.isArray(req.body?.action) ? req.body.action : undefined,
      autoPolicy: req.body?.autoPolicy !== false,
    });
    const expectedStepIndex = Math.max(
      Number(session.latestEpisode?.stepIndex || 0) + 1,
      Number(payload.episode?.stepIndex || 0),
    );
    const reconciledEpisode = await reconcileHostedEpisode({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      episode: payload.rawEpisode,
      expectedStepIndex,
    });
    const latestEpisode = normalizeEpisodeSummary(session.sessionId, reconciledEpisode);
    await updateSession(session.sessionId, {
      latestEpisode,
      latestRuntimeFailure: null,
    }, { awaitPersist: false });
    return res.json({ ...payload, episode: latestEpisode });
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
      source: "runtime",
      operation: "step",
      error,
      fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "step_failed",
      fallbackSummary: "Step failed.",
    }), await loadHostedSession(String(req.params.sessionId || "")));
    const sessionId = String(req.params.sessionId || "");
    if (sessionId) {
      await updateSession(sessionId, { latestRuntimeFailure: diagnostic });
    }
    return res.status(diagnostic.statusCode || 500).json({
      error: diagnostic.summary,
      code: diagnostic.code,
      diagnostic,
    });
  }
});

publicSiteWorldSessionsRouter.post("/:sessionId/run-batch", async (req, res, next) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session || !isPublicDemoSession(session)) {
      return next();
    }
    if (sessionUsesPresentationDemo(session) && session.presentationRuntime) {
      return sessionModeUnsupportedResponse(res);
    }
    await ensureRuntimeMetadataForSession(session);
    const runtime = await resolveHostedRuntime(session.site.siteWorldId);
    const payload = await runBatchHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      numEpisodes: Number(req.body?.numEpisodes || 1),
      taskId: req.body?.taskId || session.taskSelection?.taskId || undefined,
      scenarioId: req.body?.scenarioId || session.runtimeConfig?.scenarioId || runtime.scenarioCatalog[0]?.id,
      startStateId: req.body?.startStateId || session.runtimeConfig?.startStateId || runtime.startStateCatalog[0]?.id,
      seed:
        typeof req.body?.seed === "number"
          ? req.body.seed
          : typeof session.runtimeConfig?.seed === "number"
            ? session.runtimeConfig.seed
            : undefined,
      maxSteps: req.body?.maxSteps,
    });
    const nextArtifactUris = {
      ...session.artifactUris,
      ...(payload.artifact_uris as Record<string, string> | undefined),
    };
    const batchSummary = normalizeBatchSummary(
      (payload.summary as Record<string, unknown>) || {},
      payload.artifact_uris as Record<string, string> | undefined,
    );
    await updateSession(session.sessionId, {
      batchSummary,
      artifactUris: nextArtifactUris,
      datasetArtifacts: {
        ...(session.datasetArtifacts || {}),
        ...((payload.dataset_artifacts as Record<string, unknown> | undefined) || {}),
      },
    });
    return res.json({
      ...payload,
      summary: batchSummary,
      artifact_uris: nextArtifactUris,
    });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Batch run failed" });
  }
});

publicSiteWorldSessionsRouter.post("/:sessionId/stop", async (req, res, next) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session || !isPublicDemoSession(session)) {
      return next();
    }

    if (session.presentationRuntime?.status === "live") {
      await stopPresentationDemoRuntime({
        sessionId: session.sessionId,
        presentationRuntime: session.presentationRuntime,
      });
    }

    const payload = await stopHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
    });
    await updateSession(session.sessionId, {
      status: "stopped",
      stoppedAt: nowTimestamp(),
      presentationRuntime: session.presentationRuntime
        ? {
            provider: "vast",
            status: "stopped",
            uiBaseUrl: session.presentationRuntime.uiBaseUrl || null,
            proxyPath: session.presentationRuntime.proxyPath || null,
            instanceId: session.presentationRuntime.instanceId || null,
            startedAt: session.presentationRuntime.startedAt || null,
            expiresAt: session.presentationRuntime.expiresAt || null,
            errorCode: null,
            errorMessage: null,
          }
        : session.presentationRuntime,
    });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Stop failed" });
  }
});

publicSiteWorldSessionsRouter.get("/:sessionId/render", async (req, res, next) => {
  const session = await loadHostedSession(String(req.params.sessionId || ""));
  if (!session || !isPublicDemoSession(session)) {
    return next();
  }
  return proxyRuntimeRenderForSession(session, req, res);
});

publicSiteWorldSessionsRouter.get("/:sessionId/media", async (req, res, next) => {
  const session = await loadHostedSession(String(req.params.sessionId || ""));
  if (!session || !isPublicDemoSession(session)) {
    return next();
  }
  return proxyRuntimeMediaForSession(session, req, res);
});

publicSiteWorldSessionsRouter.post("/:sessionId/control", async (req, res, next) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session || !isPublicDemoSession(session)) {
      return next();
    }
    await ensureRuntimeMetadataForSession(session);
    const payload = await controlHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      control: req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
    });
    void updateSession(session.sessionId, { latestRuntimeFailure: null }, { awaitPersist: false });
    return res.json(payload);
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
      source: "runtime",
      operation: "step",
      error,
      fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "control_failed",
      fallbackSummary: "Control update failed.",
    }), await loadHostedSession(String(req.params.sessionId || "")));
    const sessionId = String(req.params.sessionId || "");
    if (sessionId) {
      await updateSession(sessionId, { latestRuntimeFailure: diagnostic });
    }
    return res.status(diagnostic.statusCode || 500).json({ error: diagnostic.summary, code: diagnostic.code, diagnostic });
  }
});

publicSiteWorldSessionsRouter.post("/:sessionId/explorer-render", async (req, res, next) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session || !isPublicDemoSession(session)) {
      return next();
    }
    await ensureRuntimeMetadataForSession(session);
    const payload = await renderHostedSessionExplorer({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      cameraId: String(req.body?.cameraId || req.body?.camera_id || "head_rgb").trim() || "head_rgb",
      pose: normalizeExplorerPose(req.body?.pose),
      viewportWidth: Number(req.body?.viewportWidth || req.body?.viewport_width || 0) || null,
      viewportHeight: Number(req.body?.viewportHeight || req.body?.viewport_height || 0) || null,
      refineMode: String(req.body?.refineMode || req.body?.refine_mode || "").trim() || null,
    });
    const explorerState = buildExplorerState(session.sessionId, payload as Record<string, unknown>);
    void updateSession(session.sessionId, { explorerState, latestRuntimeFailure: null }, { awaitPersist: false });
    return res.json({ explorerState });
  } catch (error) {
    const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
      source: "runtime",
      operation: "render",
      error,
      fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "explorer_render_failed",
      fallbackSummary: "Explorer render failed.",
    }), await loadHostedSession(String(req.params.sessionId || "")));
    const sessionId = String(req.params.sessionId || "");
    if (sessionId) {
      await updateSession(sessionId, { latestRuntimeFailure: diagnostic });
    }
    return res.status(diagnostic.statusCode || 500).json({ error: diagnostic.summary, code: diagnostic.code, diagnostic });
  }
});

publicSiteWorldSessionsRouter.get("/:sessionId/explorer-frame", async (req, res, next) => {
  const session = await loadHostedSession(String(req.params.sessionId || ""));
  if (!session || !isPublicDemoSession(session)) {
    return next();
  }
  return proxyRuntimeExplorerFrameForSession(session, req, res);
});

publicSiteWorldSessionsRouter.post("/:sessionId/export", async (req, res, next) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session || !isPublicDemoSession(session)) {
      return next();
    }
    if (sessionUsesPresentationDemo(session) && session.presentationRuntime) {
      return sessionModeUnsupportedResponse(res);
    }
    await ensureRuntimeMetadataForSession(session);
    const payload = await exportHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
    });
    const nextArtifactUris = {
      ...session.artifactUris,
      ...(payload.artifact_uris as Record<string, string> | undefined),
    };
    const nextDatasetArtifacts = {
      ...(session.datasetArtifacts || {}),
      ...((payload.dataset_artifacts as Record<string, unknown> | undefined) || {}),
    };
    await updateSession(session.sessionId, {
      artifactUris: nextArtifactUris,
      datasetArtifacts: nextDatasetArtifacts,
      batchSummary: session.batchSummary
        ? {
            ...session.batchSummary,
            artifactManifestUri:
              (payload.artifact_uris as Record<string, string> | undefined)?.export_manifest ||
              session.batchSummary.artifactManifestUri ||
              null,
            exportBundle: {
              available: Boolean(
                (payload.artifact_uris as Record<string, string> | undefined)?.export_manifest ||
                  session.batchSummary.exportBundle?.artifactUri,
              ),
              artifactUri:
                (payload.artifact_uris as Record<string, string> | undefined)?.export_manifest ||
                session.batchSummary.exportBundle?.artifactUri ||
                null,
              label: "Export bundle",
            },
          }
        : session.batchSummary,
    });
    return res.json({
      ...payload,
      artifact_uris: nextArtifactUris,
      dataset_artifacts: nextDatasetArtifacts,
    });
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    return res.status(500).json({ error: error instanceof Error ? error.message : "Export failed" });
  }
});

protectedRouter.get("/launch-readiness", async (req, res) => {
  try {
    const siteWorldId = String(req.query.siteWorldId || "").trim();
    if (!siteWorldId) {
      return res.status(400).json({ error: "siteWorldId is required" });
    }
    if (isPublicDemoSiteWorldId(siteWorldId)) {
      const runtime = await resolveHostedRuntime(siteWorldId);
      return res.json(
        await buildLaunchReadiness({
          runtime,
          entitled: true,
          accessBlockers: [],
        }),
      );
    }
    const access = await getLaunchAccessState(req, res, siteWorldId);
    const runtime = await resolveHostedRuntime(siteWorldId);
    return res.json(
      await buildLaunchReadiness({
        runtime,
        entitled: access.entitled,
        accessBlockers: access.blockers,
      }),
    );
  } catch (error) {
    const hostedError =
      error instanceof HostedSessionRuntimeError
        ? error
        : new HostedSessionRuntimeError("launch_readiness_failed", error instanceof Error ? error.message : "Failed to resolve launch readiness.");
    return res.status(hostedError.code === "site_not_found" ? 404 : 500).json({
      error: hostedError.message,
      code: hostedError.code,
    });
  }
});

protectedRouter.post("/", async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as CreateHostedSessionRequest;
    if (!body.siteWorldId || !body.robotProfileId || !body.taskId || !body.scenarioId || !body.startStateId) {
      return res.status(400).json({
        error: "siteWorldId, robotProfileId, taskId, scenarioId, and startStateId are required",
      });
    }

    const runtime = await resolveHostedRuntime(String(body.siteWorldId));
    const runtimeSessionConfig = normalizeRuntimeSessionConfig(body, runtime);
    const user = await ensureLaunchAccess(req, res, {
      siteWorldIds: hostedRuntimeEntitlementIds(runtime, String(body.siteWorldId)),
      entitlementId: body.entitlementId,
      requireEntitlement: true,
    });
    const sessionMode = normalizeSessionMode(body.sessionMode);
    if (sessionMode === "presentation_demo") {
      const reusable = await findReusablePresentationSession(user.uid, String(body.siteWorldId));
      if (reusable) {
        return res.status(200).json(buildSessionCreateResponse(reusable));
      }
    }
    const readiness = await buildLaunchReadiness({
      runtime,
      entitled: user.entitled,
      accessBlockers: user.blockers,
      runtimeSessionConfig,
    });
    const selectedReadiness =
      sessionMode === "presentation_demo" ? readiness.presentation_demo : readiness.runtime_only;
    if (!selectedReadiness.launchable) {
      const primaryCode = selectLaunchReadinessBlockerCode({
        sessionMode,
        blockerDetails: selectedReadiness.blocker_details,
      });
      return res.status(409).json({
        error: selectedReadiness.blockers.join(", "),
        code: primaryCode,
        blockers: selectedReadiness.blockers,
        blocker_details: selectedReadiness.blocker_details,
      });
    }

    const record = createSessionRecord({
      body,
      runtime,
      presentationLaunchState: buildPresentationLaunchState({
        readiness: readiness.presentation_demo,
        runtime,
      }),
      user,
    });
    if (sessionMode === "presentation_demo") {
      activePresentationSessionIndex.set(presentationSessionKey(user.uid, runtime.siteWorldId), record.sessionId);
    }
    await writeSession(record);

    if (sessionMode === "presentation_demo") {
      const finalizedRecord = await createRuntimeOnlySession({ body, runtime, record });
      await launchPresentationDemoSession(finalizedRecord, runtime, { failSessionOnError: true });
      return res
        .status(201)
        .json(buildSessionCreateResponse((await loadHostedSession(finalizedRecord.sessionId)) || finalizedRecord));
    }

    const finalizedRecord = await createRuntimeOnlySession({ body, runtime, record });
    return res
      .status(201)
      .json(buildSessionCreateResponse((await loadHostedSession(finalizedRecord.sessionId)) || finalizedRecord));
  } catch (error) {
    const hostedError = hostedSessionCreateError(error);
    const status = hostedSessionCreateErrorStatus(hostedError);
    return res.status(status).json({ error: hostedError.message, code: hostedError.code });
  }
});

protectedRouter.get("/:sessionId/ui-access", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res, { sessionAccess: "ui" });
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    if (session.presentationRuntime?.status !== "live") {
      return res.status(409).json({ error: "Presentation demo UI is not available" });
    }

    const token = createHostedSessionUiToken(session.sessionId);
    const bootstrapUrl = `/api/site-worlds/sessions/${encodeURIComponent(session.sessionId)}/ui/bootstrap?token=${encodeURIComponent(token)}`;
    return res.json({
      sessionId: session.sessionId,
      bootstrapUrl,
      proxyPath: session.presentationRuntime?.proxyPath || `/api/site-worlds/sessions/${encodeURIComponent(session.sessionId)}/ui/`,
      expiresAt: session.presentationRuntime?.expiresAt || null,
    });
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create UI access" });
  }
});

protectedRouter.get("/:sessionId", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res, { sessionAccess: "read" });
    const session = await readFreshHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    return res.json(session);
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load session" });
  }
});

protectedRouter.post("/:sessionId/reset", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res, { sessionAccess: "operate" });
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    if (sessionUsesPresentationDemo(session) && session.presentationRuntime) {
      return sessionModeUnsupportedResponse(res);
    }
    const logContext = hostedSessionRouteLogContext(req, res, session, "reset", "protected");
    logger.info(logContext, "Hosted session reset started");
    await ensureRuntimeMetadataForSession(session);
    logger.info(logContext, "Hosted session runtime metadata ready");
    const { startState, scenario } = await resolveResetRouteInputs(
      session,
      req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : null,
    );
    const seed =
      typeof req.body?.seed === "number"
        ? req.body.seed
        : typeof session.runtimeConfig?.seed === "number"
          ? session.runtimeConfig.seed
          : undefined;
    logger.info(
      attachRequestMeta({
        ...logContext,
        taskId: req.body?.taskId || session.taskSelection?.taskId || undefined,
        scenarioId: scenario,
        startStateId: startState,
        seed: seed ?? undefined,
      }),
      "Hosted session reset runtime inputs resolved",
    );
    if (session.activeOperation) {
      return operationInProgressResponse(res, session, "reset");
    }
    if (shouldUseAsyncRuntimeMutations()) {
      const pendingOperation = await startPendingRuntimeOperation({
        session,
        operation: "reset",
        logContext,
        run: async () => {
          try {
            const payload = await resetHostedSessionRun({
              sessionId: session.sessionId,
              workDir: sessionWorkDir(session.sessionId),
              taskId: req.body?.taskId || session.taskSelection?.taskId || undefined,
              scenarioId: scenario,
              startStateId: startState,
              seed,
            });
            logger.info(logContext, "Hosted session reset runtime call completed");
            const reconciledEpisode = await reconcileHostedEpisode({
              sessionId: session.sessionId,
              workDir: sessionWorkDir(session.sessionId),
              episode: payload.rawEpisode,
              expectedStepIndex: 0,
            });
            logger.info(logContext, "Hosted session reset snapshot reconciled");
            const latestEpisode = normalizeEpisodeSummary(session.sessionId, reconciledEpisode);
            await updateSession(
              session.sessionId,
              {
                activeOperation: null,
                latestEpisode,
                status: "running",
                latestRuntimeFailure: null,
                runtimeConfig: {
                  ...(session.runtimeConfig || {}),
                  scenarioId: scenario,
                  startStateId: startState,
                  seed: seed ?? null,
                  requestedBackend: session.runtime_backend_selected,
                },
              },
              { awaitPersist: false },
            );
            logger.info(
              attachRequestMeta({
                ...logContext,
                episodeId: latestEpisode?.episodeId || undefined,
                stepIndex: latestEpisode?.stepIndex || 0,
              }),
              "Hosted session reset completed",
            );
          } catch (error) {
            const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
              source: "runtime",
              operation: "reset",
              error,
              fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "reset_failed",
              fallbackSummary: "Reset failed.",
            }), await loadHostedSession(session.sessionId));
            await updateSession(
              session.sessionId,
              {
                activeOperation: null,
                latestRuntimeFailure: diagnostic,
              },
              { awaitPersist: false },
            );
            logger.warn(
              attachRequestMeta({
                ...logContext,
                code: diagnostic.code,
                statusCode: diagnostic.statusCode || undefined,
              }),
              "Hosted session reset failed in background",
            );
          }
        },
      });
      return res.status(202).json({
        accepted: true,
        pendingOperation,
        episode: session.latestEpisode || null,
      });
    }
    const payload = await resetHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      taskId: req.body?.taskId || session.taskSelection?.taskId || undefined,
      scenarioId: scenario,
      startStateId: startState,
      seed,
    });
    logger.info(logContext, "Hosted session reset runtime call completed");
    const reconciledEpisode = await reconcileHostedEpisode({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      episode: payload.rawEpisode,
      expectedStepIndex: 0,
    });
    logger.info(logContext, "Hosted session reset snapshot reconciled");
    const latestEpisode = normalizeEpisodeSummary(session.sessionId, reconciledEpisode);
    void updateSession(session.sessionId, {
      latestEpisode,
      status: "running",
      latestRuntimeFailure: null,
      runtimeConfig: {
        ...(session.runtimeConfig || {}),
        scenarioId: scenario,
        startStateId: startState,
        seed: seed ?? null,
        requestedBackend: session.runtime_backend_selected,
      },
    }, { awaitPersist: false });
    logger.info(
      attachRequestMeta({
        ...logContext,
        episodeId: latestEpisode?.episodeId || undefined,
        stepIndex: latestEpisode?.stepIndex || 0,
      }),
      "Hosted session reset completed",
    );
    return res.json({ ...payload, episode: latestEpisode });
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
      source: "runtime",
      operation: "reset",
      error,
      fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "reset_failed",
      fallbackSummary: "Reset failed.",
    }), await loadHostedSession(String(req.params.sessionId || "")));
    const sessionId = String(req.params.sessionId || "");
    if (sessionId) {
      await updateSession(sessionId, { latestRuntimeFailure: diagnostic });
    }
    return res.status(diagnostic.statusCode || 500).json({
      error: diagnostic.summary,
      code: diagnostic.code,
      diagnostic,
    });
  }
});

protectedRouter.post("/:sessionId/step", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res, { sessionAccess: "operate" });
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    if (session.activeOperation) {
      return operationInProgressResponse(res, session, "step");
    }
    await ensureRuntimeMetadataForSession(session);
    const logContext = hostedSessionRouteLogContext(req, res, session, "step", "protected");
    if (shouldUseAsyncRuntimeMutations()) {
      const pendingOperation = await startPendingRuntimeOperation({
        session,
        operation: "step",
        logContext,
        run: async () => {
          try {
            const payload = await stepHostedSessionRun({
              sessionId: session.sessionId,
              workDir: sessionWorkDir(session.sessionId),
              episodeId: String(req.body?.episodeId || ""),
              action: Array.isArray(req.body?.action) ? req.body.action : undefined,
              autoPolicy: req.body?.autoPolicy !== false,
            });
            const expectedStepIndex = Math.max(
              Number(session.latestEpisode?.stepIndex || 0) + 1,
              Number(payload.episode?.stepIndex || 0),
            );
            const reconciledEpisode = await reconcileHostedEpisode({
              sessionId: session.sessionId,
              workDir: sessionWorkDir(session.sessionId),
              episode: payload.rawEpisode,
              expectedStepIndex,
            });
            const latestEpisode = normalizeEpisodeSummary(session.sessionId, reconciledEpisode);
            await updateSession(
              session.sessionId,
              {
                activeOperation: null,
                latestEpisode,
                latestRuntimeFailure: null,
              },
              { awaitPersist: false },
            );
          } catch (error) {
            const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
              source: "runtime",
              operation: "step",
              error,
              fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "step_failed",
              fallbackSummary: "Step failed.",
            }), await loadHostedSession(session.sessionId));
            await updateSession(
              session.sessionId,
              {
                activeOperation: null,
                latestRuntimeFailure: diagnostic,
              },
              { awaitPersist: false },
            );
            logger.warn(
              attachRequestMeta({
                ...logContext,
                code: diagnostic.code,
                statusCode: diagnostic.statusCode || undefined,
              }),
              "Hosted session step failed in background",
            );
          }
        },
      });
      return res.status(202).json({
        accepted: true,
        pendingOperation,
        episode: session.latestEpisode || null,
      });
    }
    const payload = await stepHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      episodeId: String(req.body?.episodeId || ""),
      action: Array.isArray(req.body?.action) ? req.body.action : undefined,
      autoPolicy: req.body?.autoPolicy !== false,
    });
    const expectedStepIndex = Math.max(
      Number(session.latestEpisode?.stepIndex || 0) + 1,
      Number(payload.episode?.stepIndex || 0),
    );
    const reconciledEpisode = await reconcileHostedEpisode({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      episode: payload.rawEpisode,
      expectedStepIndex,
    });
    const latestEpisode = normalizeEpisodeSummary(session.sessionId, reconciledEpisode);
    void updateSession(session.sessionId, {
      latestEpisode,
      latestRuntimeFailure: null,
    }, { awaitPersist: false });
    return res.json({ ...payload, episode: latestEpisode });
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
      source: "runtime",
      operation: "step",
      error,
      fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "step_failed",
      fallbackSummary: "Step failed.",
    }), await loadHostedSession(String(req.params.sessionId || "")));
    const sessionId = String(req.params.sessionId || "");
    if (sessionId) {
      await updateSession(sessionId, { latestRuntimeFailure: diagnostic });
    }
    return res.status(diagnostic.statusCode || 500).json({
      error: diagnostic.summary,
      code: diagnostic.code,
      diagnostic,
    });
  }
});

protectedRouter.post("/:sessionId/run-batch", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res, { sessionAccess: "operate" });
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    await ensureRuntimeMetadataForSession(session);
    const runtime = await resolveHostedRuntime(session.site.siteWorldId);
    const payload = await runBatchHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      numEpisodes: Number(req.body?.numEpisodes || 1),
      taskId: req.body?.taskId || session.taskSelection?.taskId || undefined,
      scenarioId: req.body?.scenarioId || session.runtimeConfig?.scenarioId || runtime.scenarioCatalog[0]?.id,
      startStateId: req.body?.startStateId || session.runtimeConfig?.startStateId || runtime.startStateCatalog[0]?.id,
      seed:
        typeof req.body?.seed === "number"
          ? req.body.seed
          : typeof session.runtimeConfig?.seed === "number"
            ? session.runtimeConfig.seed
            : undefined,
      maxSteps: req.body?.maxSteps,
    });
    const nextArtifactUris = {
      ...session.artifactUris,
      ...(payload.artifact_uris as Record<string, string> | undefined),
    };
    const batchSummary = normalizeBatchSummary(
      (payload.summary as Record<string, unknown>) || {},
      payload.artifact_uris as Record<string, string> | undefined,
    );
    await updateSession(session.sessionId, {
      batchSummary,
      artifactUris: nextArtifactUris,
      datasetArtifacts: {
        ...(session.datasetArtifacts || {}),
        ...((payload.dataset_artifacts as Record<string, unknown> | undefined) || {}),
      },
    });
    return res.json({
      ...payload,
      summary: batchSummary,
      artifact_uris: nextArtifactUris,
    });
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    return res.status(500).json({ error: error instanceof Error ? error.message : "Batch run failed" });
  }
});

protectedRouter.post("/:sessionId/stop", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res, { sessionAccess: "operate" });
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }

    if (session.presentationRuntime?.status === "live") {
      await stopPresentationDemoRuntime({
        sessionId: session.sessionId,
        presentationRuntime: session.presentationRuntime,
      });
    }

    const payload = await stopHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
    });
    await updateSession(session.sessionId, {
      status: "stopped",
      stoppedAt: nowTimestamp(),
      presentationRuntime: session.presentationRuntime
        ? {
            provider: "vast",
            status: "stopped",
            uiBaseUrl: session.presentationRuntime.uiBaseUrl || null,
            proxyPath: session.presentationRuntime.proxyPath || null,
            instanceId: session.presentationRuntime.instanceId || null,
            startedAt: session.presentationRuntime.startedAt || null,
            expiresAt: session.presentationRuntime.expiresAt || null,
            errorCode: null,
            errorMessage: null,
          }
        : session.presentationRuntime,
    });
    return res.json(payload);
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    return res.status(500).json({ error: error instanceof Error ? error.message : "Stop failed" });
  }
});

protectedRouter.get("/:sessionId/render", async (req, res) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    await ensureLaunchAccess(req, res, { session, sessionAccess: "read" });
    return proxyRuntimeRenderForSession(session, req, res);
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    return res.status(500).json({ error: error instanceof Error ? error.message : "Render failed" });
  }
});

protectedRouter.get("/:sessionId/media", async (req, res) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    await ensureLaunchAccess(req, res, { session, sessionAccess: "read" });
    return proxyRuntimeMediaForSession(session, req, res);
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    return res.status(500).json({ error: error instanceof Error ? error.message : "Media proxy failed" });
  }
});

protectedRouter.post("/:sessionId/control", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res, { sessionAccess: "operate" });
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    await ensureRuntimeMetadataForSession(session);
    const payload = await controlHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      control: req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {},
    });
    void updateSession(session.sessionId, { latestRuntimeFailure: null }, { awaitPersist: false });
    return res.json(payload);
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
      source: "runtime",
      operation: "step",
      error,
      fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "control_failed",
      fallbackSummary: "Control update failed.",
    }), await loadHostedSession(String(req.params.sessionId || "")));
    const sessionId = String(req.params.sessionId || "");
    if (sessionId) {
      await updateSession(sessionId, { latestRuntimeFailure: diagnostic });
    }
    return res.status(diagnostic.statusCode || 500).json({ error: diagnostic.summary, code: diagnostic.code, diagnostic });
  }
});

protectedRouter.post("/:sessionId/explorer-render", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res, { sessionAccess: "operate" });
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    await ensureRuntimeMetadataForSession(session);
    const payload = await renderHostedSessionExplorer({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      cameraId: String(req.body?.cameraId || req.body?.camera_id || "head_rgb").trim() || "head_rgb",
      pose: normalizeExplorerPose(req.body?.pose),
      viewportWidth: Number(req.body?.viewportWidth || req.body?.viewport_width || 0) || null,
      viewportHeight: Number(req.body?.viewportHeight || req.body?.viewport_height || 0) || null,
      refineMode: String(req.body?.refineMode || req.body?.refine_mode || "").trim() || null,
    });
    const explorerState = buildExplorerState(session.sessionId, payload as Record<string, unknown>);
    void updateSession(session.sessionId, { explorerState, latestRuntimeFailure: null }, { awaitPersist: false });
    return res.json({ explorerState });
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    const diagnostic = appendCanonicalPackageMismatch(buildFailureDiagnostic({
      source: "runtime",
      operation: "render",
      error,
      fallbackCode: error instanceof HostedSessionOrchestratorError ? error.code : "explorer_render_failed",
      fallbackSummary: "Explorer render failed.",
    }), await loadHostedSession(String(req.params.sessionId || "")));
    const sessionId = String(req.params.sessionId || "");
    if (sessionId) {
      await updateSession(sessionId, { latestRuntimeFailure: diagnostic });
    }
    return res.status(diagnostic.statusCode || 500).json({ error: diagnostic.summary, code: diagnostic.code, diagnostic });
  }
});

protectedRouter.get("/:sessionId/explorer-frame", async (req, res) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    await ensureLaunchAccess(req, res, { session, sessionAccess: "read" });
    return proxyRuntimeExplorerFrameForSession(session, req, res);
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    return res.status(500).json({ error: error instanceof Error ? error.message : "Explorer frame proxy failed" });
  }
});

protectedRouter.post("/:sessionId/export", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res, { sessionAccess: "export" });
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    if (sessionUsesPresentationDemo(session)) {
      return sessionModeUnsupportedResponse(res);
    }
    await ensureRuntimeMetadataForSession(session);
    const payload = await exportHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
    });
    const nextArtifactUris = {
      ...session.artifactUris,
      ...(payload.artifact_uris as Record<string, string> | undefined),
    };
    const nextDatasetArtifacts = {
      ...(session.datasetArtifacts || {}),
      ...((payload.dataset_artifacts as Record<string, unknown> | undefined) || {}),
    };
    await updateSession(session.sessionId, {
      artifactUris: nextArtifactUris,
      datasetArtifacts: nextDatasetArtifacts,
      batchSummary: session.batchSummary
        ? {
            ...session.batchSummary,
            artifactManifestUri:
              (payload.artifact_uris as Record<string, string> | undefined)?.export_manifest ||
              session.batchSummary.artifactManifestUri ||
              null,
            exportBundle: {
              available: Boolean(
                (payload.artifact_uris as Record<string, string> | undefined)?.export_manifest ||
                  session.batchSummary.exportBundle?.artifactUri,
              ),
              artifactUri:
                (payload.artifact_uris as Record<string, string> | undefined)?.export_manifest ||
                session.batchSummary.exportBundle?.artifactUri ||
                null,
              label: "Export bundle",
            },
          }
        : session.batchSummary,
    });
    return res.json({
      ...payload,
      artifact_uris: nextArtifactUris,
      dataset_artifacts: nextDatasetArtifacts,
    });
  } catch (error) {
    if (sendHostedAccessError(res, error)) return;
    return res.status(500).json({ error: error instanceof Error ? error.message : "Export failed" });
  }
});

export default protectedRouter;
