import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import http from "node:http";
import https from "node:https";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { promisify } from "node:util";
import { Router, Request, Response } from "express";
import admin, { dbAdmin as db, storageAdmin } from "../../client/src/lib/firebaseAdmin";
import { attachRequestMeta, logger } from "../logger";
import type {
  CreateHostedSessionRequest,
  HostedBatchSummary,
  HostedEpisodeSummary,
  HostedSessionFailureDiagnostic,
  HostedSessionFailureOperation,
  HostedSessionLaunchBlockerDetail,
  HostedSessionMode,
  HostedSessionPendingOperation,
  HostedSessionPendingOperationKind,
  HostedRuntimeSessionConfig,
  HostedSessionRecord,
  PresentationDemoReadinessStatus,
  PresentationLaunchState,
} from "../types/hosted-session";
import {
  getLiveHostedSession,
  mergeLiveHostedSession,
  resetHostedSessionLiveStoreForTests,
  setLiveHostedSession,
} from "../utils/hosted-session-live-store";
import { createHostedSessionUiToken, getHostedSessionUiCookieName, parseCookies, verifyHostedSessionUiToken } from "../utils/hosted-session-ui-auth";
import { HostedSessionRuntimeError, readHostedRuntimeArtifactJson, resolveHostedRuntime } from "../utils/hosted-session-runtime";
import {
  PresentationDemoRuntimeError,
  launchPresentationDemoRuntime,
  resolvePresentationDemoLaunchConfig,
  stopPresentationDemoRuntime,
} from "../utils/presentation-demo-runtime";
import {
  createHostedSessionRun,
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

const protectedRouter = Router();
export const publicSiteWorldSessionsRouter = Router();
const inMemorySessions = new Map<string, HostedSessionRecord>();
const activePresentationSessionIndex = new Map<string, string>();
const pendingSessionMirrors = new Map<string, Promise<void>>();
const pendingRuntimeOperations = new Map<string, Promise<void>>();
const execFile = promisify(execFileCallback);

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

function toIsoString(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return String(value);
}

async function loadUserProfile(uid: string) {
  if (!db) {
    return null;
  }

  const userDoc = await db.collection("users").doc(uid).get();
  if (!userDoc.exists) {
    return null;
  }
  return userDoc.data() as Record<string, unknown>;
}

const PUBLIC_DEMO_SITE_WORLD_IDS = new Set(["siteworld-f5fd54898cfb"]);

function isPublicDemoSiteWorldId(siteWorldId: string) {
  return PUBLIC_DEMO_SITE_WORLD_IDS.has(String(siteWorldId || "").trim());
}

function isPublicDemoSession(session: HostedSessionRecord | null | undefined) {
  return Boolean(session && isPublicDemoSiteWorldId(session.site.siteWorldId));
}

async function requestTargetSiteWorldId(req: Request): Promise<string> {
  const bodySiteWorldId = String(req.body?.siteWorldId || "").trim();
  if (bodySiteWorldId) {
    return bodySiteWorldId;
  }

  const querySiteWorldId = String(req.query.siteWorldId || "").trim();
  if (querySiteWorldId) {
    return querySiteWorldId;
  }

  const sessionId = String(req.params.sessionId || "").trim();
  if (!sessionId) {
    return "";
  }

  const session = await loadHostedSession(sessionId);
  return String(session?.site?.siteWorldId || "").trim();
}

async function isPublicDemoLaunchRequest(req: Request) {
  const siteWorldId = await requestTargetSiteWorldId(req);
  return isPublicDemoSiteWorldId(siteWorldId);
}

function currentFirebaseUser(res: Response) {
  return res.locals.firebaseUser as
    | { uid?: string; email?: string; admin?: boolean }
    | undefined;
}

async function ensureLaunchAccess(req: Request, res: Response) {
  void req;
  const firebaseUser = currentFirebaseUser(res);
  if (!firebaseUser?.uid) {
    if (await isPublicDemoLaunchRequest(req)) {
      return {
        uid: "public-demo-user",
        email: null,
        entitled: true,
      };
    }
    throw new HostedSessionRuntimeError("unauthorized", "Missing authenticated user.");
  }

  if (firebaseUser.admin) {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || null,
      entitled: true,
    };
  }

  const profile = await loadUserProfile(firebaseUser.uid);
  const buyerType = String(profile?.buyerType || "").trim();
  if (buyerType !== "robot_team") {
    if (await isPublicDemoLaunchRequest(req)) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || null,
        entitled: true,
      };
    }
    throw new HostedSessionRuntimeError(
      "forbidden",
      "Hosted sessions are only available to robot-team accounts.",
    );
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || null,
    entitled: true,
  };
}

async function getLaunchAccessState(req: Request, res: Response) {
  try {
    const user = await ensureLaunchAccess(req, res);
    return { ...user, entitled: true, blockers: [] as string[] };
  } catch (error) {
    if (error instanceof HostedSessionRuntimeError && (error.code === "forbidden" || error.code === "unauthorized")) {
      return {
        uid: currentFirebaseUser(res)?.uid || null,
        email: currentFirebaseUser(res)?.email || null,
        entitled: false,
        blockers: [error.message],
      };
    }
    throw error;
  }
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

function isRenderableObservationPath(framePath?: string | null) {
  const normalized = String(framePath || "").trim();
  return /^(https?:\/\/|data:image\/|\/(api|assets|images|attached_assets)\/)/.test(normalized);
}

function normalizeSessionMode(value: unknown): HostedSessionMode {
  return value === "presentation_demo" ? "presentation_demo" : "runtime_only";
}

function sessionUsesPresentationDemo(session: HostedSessionRecord) {
  return session.sessionMode === "presentation_demo";
}

function isSessionExpired(session: HostedSessionRecord) {
  const expiresAt = toIsoString(session.presentationRuntime?.expiresAt);
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

function isReusablePresentationSession(session: HostedSessionRecord, uid: string, siteWorldId: string) {
  if (!sessionUsesPresentationDemo(session)) return false;
  if (session.createdBy.uid !== uid) return false;
  if (session.site.siteWorldId !== siteWorldId) return false;
  if (session.status === "stopped" || session.status === "failed") return false;
  if (isSessionExpired(session)) return false;
  return true;
}

function presentationSessionKey(uid: string, siteWorldId: string) {
  return `${uid}:${siteWorldId}`;
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
  return `/site-worlds/${siteWorldId}/workspace?sessionId=${encodeURIComponent(sessionId)}`;
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

interface ModeLaunchReadiness {
  status: PresentationDemoReadinessStatus | "runtime_live_ready" | "runtime_live_unavailable";
  launchable: boolean;
  blockers: string[];
  blocker_details: HostedSessionLaunchBlockerDetail[];
  presentationWorldManifestUri?: string | null;
  runtimeDemoManifestUri?: string | null;
  uiBaseUrl?: string | null;
}

function addBlocker(details: HostedSessionLaunchBlockerDetail[], blocker: HostedSessionLaunchBlockerDetail) {
  if (!details.some((item) => item.code === blocker.code && item.message === blocker.message && item.source === blocker.source)) {
    details.push(blocker);
  }
}

function stringsFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (typeof item === "string") {
        return [item.trim()];
      }
      if (item && typeof item === "object") {
        const payload = item as Record<string, unknown>;
        return [String(payload.message || payload.reason || payload.category || payload.code || "").trim()];
      }
      return [];
    })
    .filter(Boolean);
}

function qualificationStateMessage(state: string) {
  switch (state) {
    case "not_ready_yet":
      return "This site is currently marked not ready yet for launch.";
    case "needs_more_evidence":
      return "This site needs more evidence before launch.";
    case "submitted":
      return "This site has not completed qualification yet.";
    case "capture_requested":
      return "This site is still waiting on capture completion.";
    case "qa_passed":
      return "This site passed QA but has not completed qualification.";
    case "in_review":
      return "This site is still under qualification review.";
    case "needs_refresh":
      return "This site needs a refresh before launch.";
    default:
      return `This site is in qualification state ${state.replaceAll("_", " ")}.`;
  }
}

function extractArtifactBlockers(
  payload: Record<string, unknown> | null,
  source: HostedSessionLaunchBlockerDetail["source"],
  prefix: string,
) {
  const details: HostedSessionLaunchBlockerDetail[] = [];
  if (!payload) {
    return details;
  }

  const categories = [
    ...stringsFromUnknown(payload.blocker_categories),
    ...stringsFromUnknown(payload.blockerCategories),
  ];
  categories.forEach((category, index) => {
    addBlocker(details, {
      code: `${prefix}_category_${index + 1}`,
      message: `${prefix.replaceAll("_", " ")} blocker: ${category}`,
      source,
    });
  });

  const messages = [
    ...stringsFromUnknown(payload.blockers),
    ...stringsFromUnknown(payload.reasons),
    ...stringsFromUnknown(payload.actions),
    ...stringsFromUnknown(payload.required_actions),
    ...stringsFromUnknown(payload.pending_actions),
  ];
  messages.forEach((message, index) => {
    addBlocker(details, {
      code: `${prefix}_${index + 1}`,
      message,
      source,
    });
  });

  return details;
}

function summarizeDiagnosticText(detail: string) {
  const firstLine = detail
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  return firstLine || detail.trim() || "Runtime request failed.";
}

function extractTraceback(detail?: string | null) {
  const text = String(detail || "").trim();
  const marker = text.indexOf("Traceback");
  return marker >= 0 ? text.slice(marker).trim() : null;
}

function extractExitCode(detail?: string | null) {
  const match = String(detail || "").match(/exit code\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}

function buildFailureDiagnostic(params: {
  source: HostedSessionFailureDiagnostic["source"];
  operation: HostedSessionFailureOperation;
  error: unknown;
  fallbackCode: string;
  fallbackSummary: string;
  statusCode?: number | null;
}): HostedSessionFailureDiagnostic {
  const knownError = params.error as
    | (Error & { code?: string; detail?: string | null; statusCode?: number | null })
    | undefined;
  const detail = String(knownError?.detail || knownError?.message || params.fallbackSummary).trim();
  return {
    source: params.source,
    operation: params.operation,
    code: String(knownError?.code || params.fallbackCode),
    summary: summarizeDiagnosticText(detail) || params.fallbackSummary,
    detail,
    traceback: extractTraceback(detail),
    rawDetail: detail,
    exitCode: extractExitCode(detail),
    statusCode: knownError?.statusCode ?? params.statusCode ?? null,
    occurredAt: nowIso(),
  };
}

function buildCanonicalPackageMismatchDetail(session: HostedSessionRecord | null | undefined) {
  const registered = String(
    session?.siteModel?.registeredCanonicalPackageUri
      || session?.launchContext.registeredCanonicalPackageUri
      || "",
  ).trim();
  const resolved = String(
    session?.siteModel?.resolvedArtifactCanonicalUri
      || session?.launchContext.resolvedArtifactCanonicalUri
      || "",
  ).trim();

  if (!registered || !resolved || registered === resolved) {
    return null;
  }

  return `Canonical package mismatch detected. runtime_registered=${registered} resolved_artifact=${resolved}`;
}

function appendCanonicalPackageMismatch(
  diagnostic: HostedSessionFailureDiagnostic,
  session: HostedSessionRecord | null | undefined,
) {
  const mismatchDetail = buildCanonicalPackageMismatchDetail(session);
  if (!mismatchDetail) {
    return diagnostic;
  }

  const detail = [diagnostic.detail, mismatchDetail].filter(Boolean).join("\n");
  return {
    ...diagnostic,
    detail,
    rawDetail: detail,
  };
}

function buildPresentationLaunchState(params: {
  presentationRuntime?: HostedSessionRecord["presentationRuntime"];
  readiness?: ModeLaunchReadiness | null;
  runtime?: Awaited<ReturnType<typeof resolveHostedRuntime>>;
}): PresentationLaunchState {
  const blockers = params.readiness?.blockers || [];
  const blockerDetails = params.readiness?.blocker_details || [];
  const liveViewer = params.presentationRuntime?.status === "live" && params.presentationRuntime?.uiBaseUrl;
  return {
    status: liveViewer ? "live_viewer" : blockerDetails.length > 0 ? "blocked" : "artifact_backed",
    mode:
      params.readiness?.status === "runtime_live_ready" || params.readiness?.status === "runtime_live_unavailable"
        ? undefined
        : params.readiness?.status,
    blockers,
    blockerDetails,
    presentationWorldManifestUri:
      params.runtime?.presentationWorldManifestUri ?? params.readiness?.presentationWorldManifestUri ?? null,
    runtimeDemoManifestUri:
      params.runtime?.runtimeDemoManifestUri ?? params.readiness?.runtimeDemoManifestUri ?? null,
    uiBaseUrl: liveViewer ? params.presentationRuntime?.uiBaseUrl || null : params.readiness?.uiBaseUrl || null,
  };
}

async function buildQualificationBlockers(
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>,
): Promise<HostedSessionLaunchBlockerDetail[]> {
  void runtime;
  void qualificationStateMessage;
  void extractArtifactBlockers;
  return [];
}

async function buildPresentationDemoReadiness(params: {
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>;
  accessBlockers: string[];
}): Promise<ModeLaunchReadiness> {
  const details = await buildQualificationBlockers(params.runtime);
  params.accessBlockers.forEach((message, index) =>
    addBlocker(details, { code: `access_${index + 1}`, message, source: "access" }),
  );

  const [presentationWorldManifest, runtimeDemoManifest] = await Promise.all([
    readHostedRuntimeArtifactJson(params.runtime.presentationWorldManifestUri),
    readHostedRuntimeArtifactJson(params.runtime.runtimeDemoManifestUri),
  ]);
  const presentationManifestRegistered =
    params.runtime.presentationWorldManifestDeclared === true
      ? true
      : Boolean(params.runtime.presentationWorldManifestUri && presentationWorldManifest);
  const runtimeDemoManifestRegistered =
    params.runtime.runtimeDemoManifestDeclared === true
      ? true
      : Boolean(params.runtime.runtimeDemoManifestUri && runtimeDemoManifest);

  if (!presentationManifestRegistered) {
    addBlocker(details, {
      code: "missing_presentation_package",
      message: "This site is missing the presentation package required for embedded demos.",
      source: "presentation_demo",
    });
  }
  if (!runtimeDemoManifestRegistered) {
    addBlocker(details, {
      code: "missing_runtime_demo_manifest",
      message: "This site is missing the runtime demo manifest required for live presentation launch.",
      source: "presentation_demo",
    });
  }
  if (presentationManifestRegistered && !presentationWorldManifest) {
    addBlocker(details, {
      code: "presentation_manifest_unreadable",
      message: "Presentation artifacts are registered but could not be resolved on this host.",
      source: "presentation_demo",
    });
  }
  if (runtimeDemoManifestRegistered && !runtimeDemoManifest) {
    addBlocker(details, {
      code: "runtime_demo_manifest_unreadable",
      message: "Runtime demo artifacts are registered but could not be resolved on this host.",
      source: "presentation_demo",
    });
  }

  const config = await resolvePresentationDemoLaunchConfig({
    sessionId: "readiness-check",
    runtime: params.runtime,
  }).catch(() => null);

  const status =
    !presentationManifestRegistered || !runtimeDemoManifestRegistered
      ? "presentation_assets_missing"
      : config?.uiBaseUrl
        ? "presentation_ui_live"
        : "presentation_ui_unconfigured";

  return {
    status,
    launchable:
      (status === "presentation_ui_live" || status === "presentation_ui_unconfigured") &&
      details.length === 0,
    blockers: details.map((item) => item.message),
    blocker_details: details,
    presentationWorldManifestUri: params.runtime.presentationWorldManifestUri ?? null,
    runtimeDemoManifestUri: params.runtime.runtimeDemoManifestUri ?? null,
    uiBaseUrl: config?.uiBaseUrl || null,
  };
}

async function buildRuntimeOnlyReadiness(params: {
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>;
  accessBlockers: string[];
  runtimeSessionConfig?: HostedRuntimeSessionConfig | null;
}): Promise<ModeLaunchReadiness> {
  const details = await buildQualificationBlockers(params.runtime);
  params.accessBlockers.forEach((message, index) =>
    addBlocker(details, { code: `access_${index + 1}`, message, source: "access" }),
  );

  const [siteWorldSpec, siteWorldRegistration, siteWorldHealth] = await Promise.all([
    readHostedRuntimeArtifactJson(params.runtime.siteWorldSpecUri),
    readHostedRuntimeArtifactJson(params.runtime.siteWorldRegistrationUri),
    readHostedRuntimeArtifactJson(params.runtime.siteWorldHealthUri),
  ]);

  if (!siteWorldSpec && !params.runtime.allowBlockedSiteWorld) {
    addBlocker(details, {
      code: "missing_runtime_site_world_spec",
      message: "This site is missing the site-world spec required for hosted runtime launch.",
      source: "runtime",
    });
  }
  if (!siteWorldRegistration && !params.runtime.allowBlockedSiteWorld) {
    addBlocker(details, {
      code: "missing_runtime_registration",
      message: "This site is missing the site-world registration required for hosted runtime launch.",
      source: "runtime",
    });
  }
  if (!siteWorldHealth && !params.runtime.allowBlockedSiteWorld) {
    addBlocker(details, {
      code: "missing_runtime_health",
      message: "This site is missing the site-world health record required for hosted runtime launch.",
      source: "runtime",
    });
  }

  const siteWorldId = String(siteWorldRegistration?.site_world_id || "").trim();
  const runtimeBaseUrl = String(params.runtime.runtimeBaseUrl || siteWorldRegistration?.runtime_base_url || "").trim();
  if (siteWorldRegistration && (!siteWorldId || !runtimeBaseUrl)) {
    addBlocker(details, {
      code: "runtime_handle_missing",
      message: "The site-world registration does not include a live runtime handle yet.",
      source: "runtime",
    });
  }

  if (runtimeBaseUrl && siteWorldId && !params.runtime.runtimeSiteWorldRecord) {
    addBlocker(details, {
      code: "runtime_probe_failed",
      message: "The hosted runtime handle is registered, but the runtime did not answer the site-world readiness probe.",
      source: "runtime",
    });
  }

  if (
    (params.runtime.runtimeHealthRecord?.launchable === false || siteWorldHealth?.launchable === false) &&
    params.runtime.allowBlockedSiteWorld !== true &&
    params.runtimeSessionConfig?.unsafe_allow_blocked_site_world !== true
  ) {
    const liveBlockers = stringsFromUnknown(params.runtime.runtimeHealthRecord?.blockers);
    const artifactBlockers = stringsFromUnknown(siteWorldHealth?.blockers);
    addBlocker(details, {
      code: "runtime_unlaunchable",
      message:
        `The site-world runtime is not launchable: ${liveBlockers.join(", ") || artifactBlockers.join(", ") || "blocked"}`,
      source: "runtime",
    });
  }

  return {
    status: details.length === 0 ? "runtime_live_ready" : "runtime_live_unavailable",
    launchable: details.length === 0,
    blockers: details.map((item) => item.message),
    blocker_details: details,
    presentationWorldManifestUri: params.runtime.presentationWorldManifestUri ?? null,
    runtimeDemoManifestUri: params.runtime.runtimeDemoManifestUri ?? null,
  };
}

async function buildLaunchReadiness(params: {
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>;
  entitled: boolean;
  accessBlockers: string[];
  runtimeSessionConfig?: HostedRuntimeSessionConfig | null;
}) {
  const [presentationDemo, runtimeOnly] = await Promise.all([
    buildPresentationDemoReadiness({
      runtime: params.runtime,
      accessBlockers: params.accessBlockers,
    }),
    buildRuntimeOnlyReadiness({
      runtime: params.runtime,
      accessBlockers: params.accessBlockers,
      runtimeSessionConfig: params.runtimeSessionConfig,
    }),
  ]);

  return {
    entitled: params.entitled,
    status: presentationDemo.status,
    launchable: presentationDemo.launchable,
    blockers: presentationDemo.blockers,
    blocker_details: presentationDemo.blocker_details,
    presentationWorldManifestUri: presentationDemo.presentationWorldManifestUri ?? null,
    runtimeDemoManifestUri: presentationDemo.runtimeDemoManifestUri ?? null,
    presentation_demo: presentationDemo,
    runtime_only: runtimeOnly,
  };
}

function normalizeRobotProfile(
  body: CreateHostedSessionRequest,
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>,
): NonNullable<HostedSessionRecord["robotProfile"]> {
  const selected = runtime.robotProfiles.find((item) => item.id === body.robotProfileId);
  if (!selected) {
    throw new HostedSessionRuntimeError(
      "unsupported_robot_profile",
      `Robot profile ${body.robotProfileId} is not available for this site.`,
    );
  }
  return {
    ...selected,
    ...body.robotProfileOverride,
    observationCameras: body.robotProfileOverride?.observationCameras || selected.observationCameras,
    actionSpace: body.robotProfileOverride?.actionSpace || selected.actionSpace,
    actionSpaceSummary:
      body.robotProfileOverride?.actionSpaceSummary
      || selected.actionSpaceSummary
      || "Bounded robot action vector for hosted rollout execution.",
  };
}

function normalizeTaskSelection(
  body: CreateHostedSessionRequest,
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>,
): NonNullable<HostedSessionRecord["taskSelection"]> {
  const task = runtime.taskCatalog.find((item) => item.id === body.taskId);
  if (!task) {
    throw new HostedSessionRuntimeError("unsupported_task", `Task ${body.taskId} is not available for this site.`);
  }
  return {
    taskText: task.taskText,
    taskId: task.id,
  };
}

function normalizeRuntimeConfig(
  body: CreateHostedSessionRequest,
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>,
): NonNullable<HostedSessionRecord["runtimeConfig"]> {
  if (!runtime.scenarioCatalog.find((item) => item.id === body.scenarioId)) {
    throw new HostedSessionRuntimeError(
      "unsupported_scenario",
      `Scenario ${body.scenarioId} is not available for this site.`,
    );
  }
  if (!runtime.startStateCatalog.find((item) => item.id === body.startStateId)) {
    throw new HostedSessionRuntimeError(
      "unsupported_start_state",
      `Start state ${body.startStateId} is not available for this site.`,
    );
  }
  const requestedBackend = String(body.requestedBackend || runtime.defaultRuntimeBackend || "").trim() || runtime.defaultRuntimeBackend;
  if (
    requestedBackend
    && Array.isArray(runtime.availableRuntimeBackends)
    && runtime.availableRuntimeBackends.length > 0
    && !runtime.availableRuntimeBackends.includes(requestedBackend)
  ) {
    throw new HostedSessionRuntimeError(
      "unsupported_backend",
      `Backend ${requestedBackend} is not available for this site.`,
    );
  }
  return {
    scenarioId: String(body.scenarioId),
    startStateId: String(body.startStateId),
    seed: null,
    requestedBackend,
  };
}

function normalizeRuntimeSessionConfig(
  body: CreateHostedSessionRequest,
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>,
): HostedRuntimeSessionConfig {
  const runtimeSessionConfig = body.runtimeSessionConfig || {};
  const normalizeOptional = (value: unknown) => String(value || "").trim() || null;

  return {
    canonical_package_uri:
      normalizeOptional(runtimeSessionConfig.canonical_package_uri)
      || runtime.registeredCanonicalPackageUri
      || runtime.resolvedArtifactCanonicalUri,
    canonical_package_version:
      normalizeOptional(runtimeSessionConfig.canonical_package_version) || runtime.registeredCanonicalPackageVersion,
    prompt: normalizeOptional(runtimeSessionConfig.prompt),
    trajectory: normalizeOptional(runtimeSessionConfig.trajectory),
    presentation_model: normalizeOptional(runtimeSessionConfig.presentation_model),
    debug_mode: runtimeSessionConfig.debug_mode === true,
    unsafe_allow_blocked_site_world:
      runtimeSessionConfig.unsafe_allow_blocked_site_world === true || runtime.allowBlockedSiteWorld === true,
  };
}

function normalizeRequestedOutputs(body: CreateHostedSessionRequest) {
  if (Array.isArray(body.requestedOutputs) && body.requestedOutputs.length > 0) {
    return body.requestedOutputs.map((value) => String(value || "").trim()).filter(Boolean);
  }
  if (Array.isArray(body.exportModes) && body.exportModes.length > 0) {
    return body.exportModes.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return ["start_state", "task_summary", "scenario", "observation_frames", "action_trace", "step_count", "reward_score", "success_failure", "rollout_video", "export_bundle"];
}

function buildSiteModelSummary(
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>,
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

function normalizeEpisodeSummary(
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

function normalizeBatchSummary(
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

function shouldUseNodeRuntimeHttp() {
  return process.env.BLUEPRINT_HOSTED_SESSION_USE_NODE_HTTP === "1" || process.env.NODE_ENV === "production";
}

function shouldUseCurlRuntimeHttp() {
  return process.env.BLUEPRINT_HOSTED_SESSION_USE_CURL === "1" || process.env.NODE_ENV === "production";
}

async function runtimeBinaryRequest(url: string, timeoutMs: number) {
  if (!shouldUseNodeRuntimeHttp()) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal });
      return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()) as Record<string, string>,
        body: Buffer.from(await response.arrayBuffer()),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  if (shouldUseCurlRuntimeHttp()) {
    const { stdout } = await execFile(
      "curl",
      [
        "--silent",
        "--show-error",
        "--location",
        "--http1.1",
        "--max-time",
        String(Math.ceil(timeoutMs / 1000)),
        "--write-out",
        "\n__BLUEPRINT_STATUS__:%{http_code}",
        url,
      ],
      {
        encoding: "buffer",
        maxBuffer: 20 * 1024 * 1024,
      },
    );
    const marker = Buffer.from("\n__BLUEPRINT_STATUS__:");
    const markerIndex = stdout.lastIndexOf(marker);
    if (markerIndex < 0) {
      throw new Error("curl runtime render request did not return an HTTP status marker");
    }
    const statusCode = Number(stdout.subarray(markerIndex + marker.length).toString("utf-8").trim() || "0");
    return {
      statusCode,
      headers: {} as Record<string, string>,
      body: stdout.subarray(0, markerIndex),
    };
  }

  const target = new URL(url);
  const requestFn = target.protocol === "https:" ? https.request : http.request;
  return await new Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const request = requestFn(
      target,
      {
        method: "GET",
        headers: { connection: "close" },
        timeout: timeoutMs,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on("end", () => {
          resolve({
            statusCode: response.statusCode || 500,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    request.on("timeout", () => {
      request.destroy(new Error(`Timed out after ${timeoutMs}ms waiting for runtime render.`));
    });
    request.on("error", reject);
    request.end();
  });
}

async function readRuntimeErrorDetail(response: globalThis.Response) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const detail = String(payload?.detail || payload?.error || `Runtime request failed: ${response.status}`).trim();
    return {
      code: String(payload?.code || "runtime_render_failed"),
      detail,
    };
  }
  const text = await response.text().catch(() => "");
  return {
    code: "runtime_render_failed",
    detail: text.trim() || `Runtime request failed: ${response.status}`,
  };
}

function preferredPublishedArtifactBucket(session: HostedSessionRecord) {
  const candidates = [
    session.siteModel?.siteWorldHealthUri,
    session.siteModel?.siteWorldSpecUri,
    session.launchContext.site_world_health_uri,
    session.launchContext.site_world_spec_uri,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value.startsWith("gs://")) {
      continue;
    }
    const { bucket } = parseGsUri(value);
    if (bucket && bucket !== "local-blueprint") {
      return bucket;
    }
  }
  return null;
}

function normalizePublishedArtifactUri(uri: string, session: HostedSessionRecord) {
  const normalized = String(uri || "").trim();
  if (!normalized.startsWith("gs://local-blueprint/")) {
    return normalized;
  }
  const publishedBucket = preferredPublishedArtifactBucket(session);
  if (!publishedBucket) {
    return normalized;
  }
  const { objectPath } = parseGsUri(normalized);
  return `gs://${publishedBucket}/${objectPath}`;
}

async function authoritativeFrameArtifactUriForSession(session: HostedSessionRecord, cameraId: string) {
  const healthPayload =
    (await readHostedRuntimeArtifactJson(session.siteModel?.siteWorldHealthUri || session.launchContext.site_world_health_uri)) || {};
  const canonicalWorldModel =
    healthPayload.canonical_world_model && typeof healthPayload.canonical_world_model === "object"
      ? (healthPayload.canonical_world_model as Record<string, unknown>)
      : {};
  const supportingAssets = Array.isArray(canonicalWorldModel.supporting_assets)
    ? (canonicalWorldModel.supporting_assets as Array<Record<string, unknown>>)
    : [];
  const expectedName = `${cameraId}-frame0.png`;
  const supportingMatch = supportingAssets.find((asset) => String(asset?.name || "").trim() === expectedName);
  const supportingUri = String(supportingMatch?.uri || "").trim();
  if (supportingUri) {
    return normalizePublishedArtifactUri(supportingUri, session);
  }
  const primaryAssetUri = String(canonicalWorldModel.primary_asset_uri || "").trim();
  if (!primaryAssetUri.startsWith("gs://")) {
    return null;
  }
  if (!primaryAssetUri.endsWith(".mp4")) {
    return normalizePublishedArtifactUri(primaryAssetUri, session);
  }
  return normalizePublishedArtifactUri(primaryAssetUri.replace(/\.mp4$/i, "-frame0.png"), session);
}

async function maybeServeCanonicalRenderFrame(session: HostedSessionRecord, req: Request, res: Response) {
  if (!isPublicDemoSession(session)) {
    return false;
  }
  if (String(session.siteModel?.runtimeRenderSource || "").trim() !== "neoverse_full_capture") {
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
  user: { uid: string; email?: string | null };
}) {
  const taskSelection = normalizeTaskSelection(params.body, params.runtime);
  const runtimeConfig = normalizeRuntimeConfig(params.body, params.runtime);
  const runtimeSessionConfig = normalizeRuntimeSessionConfig(params.body, params.runtime);
  const robotProfile = normalizeRobotProfile(params.body, params.runtime);
  const sessionId = randomUUID();
  const sessionMode = normalizeSessionMode(params.body.sessionMode);

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
    policy: params.body.policy || {},
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
    createdBy: params.user,
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
      const primaryCode =
        selectedReadiness.blocker_details.find((item) =>
          sessionMode === "runtime_only" ? item.code === "runtime_handle_missing" : true,
        )?.code || selectedReadiness.blocker_details[0]?.code || "session_not_launchable";
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
      user: { uid: "public-demo-user", email: null },
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
    const hostedError =
      error instanceof HostedSessionRuntimeError
        ? error
        : error instanceof Error
          ? new HostedSessionRuntimeError("session_create_failed", error.message)
          : new HostedSessionRuntimeError("session_create_failed", "Failed to create hosted session.");
    const status =
      hostedError.code.startsWith("missing") || hostedError.code.includes("not_launchable")
        ? 409
        : 500;
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
    return res.status(500).json({ error: error instanceof Error ? error.message : "Export failed" });
  }
});

protectedRouter.get("/launch-readiness", async (req, res) => {
  try {
    const siteWorldId = String(req.query.siteWorldId || "").trim();
    if (!siteWorldId) {
      return res.status(400).json({ error: "siteWorldId is required" });
    }
    const access = await getLaunchAccessState(req, res);
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
    const user = await ensureLaunchAccess(req, res);
    const body = (req.body ?? {}) as CreateHostedSessionRequest;
    if (!body.siteWorldId || !body.robotProfileId || !body.taskId || !body.scenarioId || !body.startStateId) {
      return res.status(400).json({
        error: "siteWorldId, robotProfileId, taskId, scenarioId, and startStateId are required",
      });
    }

    const sessionMode = normalizeSessionMode(body.sessionMode);
    if (sessionMode === "presentation_demo") {
      const reusable = await findReusablePresentationSession(user.uid, String(body.siteWorldId));
      if (reusable) {
        return res.status(200).json(buildSessionCreateResponse(reusable));
      }
    }

    const runtime = await resolveHostedRuntime(String(body.siteWorldId));
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
      const primaryCode =
        selectedReadiness.blocker_details.find((item) =>
          sessionMode === "runtime_only" ? item.code === "runtime_handle_missing" : true,
        )?.code || selectedReadiness.blocker_details[0]?.code || "session_not_launchable";
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
    const hostedError =
      error instanceof HostedSessionRuntimeError
        ? error
        : error instanceof Error
          ? new HostedSessionRuntimeError("session_create_failed", error.message)
          : new HostedSessionRuntimeError("session_create_failed", "Failed to create hosted session.");
    const status =
      hostedError.code === "forbidden"
        ? 403
        : hostedError.code === "unauthorized"
          ? 401
          : hostedError.code.startsWith("missing") || hostedError.code.includes("not_launchable")
            ? 409
            : 500;
    return res.status(status).json({ error: hostedError.message, code: hostedError.code });
  }
});

protectedRouter.get("/:sessionId/ui-access", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
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
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to create UI access" });
  }
});

protectedRouter.get("/:sessionId", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
    const session = await readFreshHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    return res.json(session);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load session" });
  }
});

protectedRouter.post("/:sessionId/reset", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
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
    await ensureLaunchAccess(req, res);
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
    await ensureLaunchAccess(req, res);
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
    return res.status(500).json({ error: error instanceof Error ? error.message : "Batch run failed" });
  }
});

protectedRouter.post("/:sessionId/stop", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
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
    return res.status(500).json({ error: error instanceof Error ? error.message : "Stop failed" });
  }
});

protectedRouter.get("/:sessionId/render", async (req, res) => {
  const session = await loadHostedSession(String(req.params.sessionId || ""));
  if (!session) {
    return res.status(404).json({ error: "Hosted session not found" });
  }
  return proxyRuntimeRenderForSession(session, req, res);
});

protectedRouter.post("/:sessionId/explorer-render", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
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
  const session = await loadHostedSession(String(req.params.sessionId || ""));
  if (!session) {
    return res.status(404).json({ error: "Hosted session not found" });
  }
  return proxyRuntimeExplorerFrameForSession(session, req, res);
});

protectedRouter.post("/:sessionId/export", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
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
    return res.status(500).json({ error: error instanceof Error ? error.message : "Export failed" });
  }
});

export default protectedRouter;
