import { randomUUID } from "node:crypto";
import http from "node:http";
import https from "node:https";
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { Router, Request, Response } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type {
  CreateHostedSessionRequest,
  HostedBatchSummary,
  HostedEpisodeSummary,
  HostedSessionMode,
  HostedRuntimeSessionConfig,
  HostedSessionRecord,
} from "../types/hosted-session";
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
  loadHostedSessionRuntimeMetadata,
  resetHostedSessionRun,
  runBatchHostedSessionRun,
  sessionWorkDir,
  stepHostedSessionRun,
  stopHostedSessionRun,
} from "../utils/hosted-session-orchestrator";

const protectedRouter = Router();
export const publicSiteWorldSessionsRouter = Router();
const inMemorySessions = new Map<string, HostedSessionRecord>();
const activePresentationSessionIndex = new Map<string, string>();

export function resetHostedSessionRouteState() {
  inMemorySessions.clear();
  activePresentationSessionIndex.clear();
}

function nowTimestamp() {
  return admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date().toISOString();
}

function nowIso() {
  return new Date().toISOString();
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
  if (!db) {
    return;
  }

  await db.collection("hostedSessions").doc(record.sessionId).set(record);
}

async function updateSession(sessionId: string, update: Partial<HostedSessionRecord>) {
  const current = inMemorySessions.get(sessionId);
  if (current) {
    const merged = { ...current, ...update };
    inMemorySessions.set(sessionId, merged);
    syncPresentationSessionIndex(merged);
  }
  if (!db) {
    return;
  }

  await db.collection("hostedSessions").doc(sessionId).update(update);
}

export async function loadHostedSession(sessionId: string): Promise<HostedSessionRecord | null> {
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
  return {
    sessionId: record.sessionId,
    status: record.status,
    site: record.site,
    runtimeBackend: record.runtime_backend_selected,
    launchable:
      record.sessionMode === "presentation_demo"
        ? record.presentationRuntime?.status === "live"
        : Boolean(record.runtimeHandle?.runtime_base_url || record.status === "ready"),
    uiReady: record.presentationRuntime?.status === "live",
    uiMode: record.sessionMode === "presentation_demo" ? "embedded" : "redirect",
    workspaceUrl: buildWorkspaceUrl(record.site.siteWorldId, record.sessionId),
  };
}

type LaunchBlockerSource = "access" | "qualification" | "runtime" | "presentation_demo";

interface LaunchBlockerDetail {
  code: string;
  message: string;
  source: LaunchBlockerSource;
}

interface ModeLaunchReadiness {
  launchable: boolean;
  blockers: string[];
  blocker_details: LaunchBlockerDetail[];
  presentationWorldManifestUri?: string | null;
}

function addBlocker(details: LaunchBlockerDetail[], blocker: LaunchBlockerDetail) {
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
  source: LaunchBlockerSource,
  prefix: string,
) {
  const details: LaunchBlockerDetail[] = [];
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

async function buildQualificationBlockers(runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>) {
  const details: LaunchBlockerDetail[] = [];
  const qualificationState = String(runtime.qualificationState || "").trim();
  if (qualificationState && !["qualified_ready", "qualified_risky"].includes(qualificationState)) {
    addBlocker(details, {
      code: `qualification_${qualificationState}`,
      message: qualificationStateMessage(qualificationState),
      source: "qualification",
    });
  }

  if (runtime.deploymentReadiness?.recapture_required) {
    addBlocker(details, {
      code: "qualification_recapture_required",
      message: "This site requires recapture or refresh work before launch.",
      source: "qualification",
    });
  }

  (runtime.deploymentReadiness?.missing_evidence || []).forEach((item, index) => {
    addBlocker(details, {
      code: `qualification_missing_evidence_${index + 1}`,
      message: `Missing evidence: ${item}`,
      source: "qualification",
    });
  });

  const [readinessDecision, humanActions] = await Promise.all([
    readHostedRuntimeArtifactJson(runtime.readinessDecisionUri),
    readHostedRuntimeArtifactJson(runtime.humanActionsRequiredUri),
  ]);

  extractArtifactBlockers(readinessDecision, "qualification", "readiness_decision").forEach((item) => addBlocker(details, item));
  extractArtifactBlockers(humanActions, "qualification", "human_actions_required").forEach((item) => addBlocker(details, item));

  return details;
}

async function buildPresentationDemoReadiness(params: {
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>;
  accessBlockers: string[];
}): Promise<ModeLaunchReadiness> {
  const details = await buildQualificationBlockers(params.runtime);
  params.accessBlockers.forEach((message, index) =>
    addBlocker(details, { code: `access_${index + 1}`, message, source: "access" }),
  );

  if (!params.runtime.presentationWorldManifestUri) {
    addBlocker(details, {
      code: "missing_presentation_package",
      message: "This site is missing the presentation package required for embedded demos.",
      source: "presentation_demo",
    });
  }

  const config = await resolvePresentationDemoLaunchConfig({
    sessionId: "readiness-check",
    runtime: params.runtime,
  }).catch(() => null);
  if (!config?.uiBaseUrl) {
    addBlocker(details, {
      code: "presentation_ui_unconfigured",
      message: "Presentation demo UI base URL is not configured.",
      source: "presentation_demo",
    });
  }

  return {
    launchable: details.length === 0,
    blockers: details.map((item) => item.message),
    blocker_details: details,
    presentationWorldManifestUri: params.runtime.presentationWorldManifestUri ?? null,
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

  if (
    siteWorldHealth?.launchable === false &&
    params.runtime.allowBlockedSiteWorld !== true &&
    params.runtimeSessionConfig?.unsafe_allow_blocked_site_world !== true
  ) {
    addBlocker(details, {
      code: "runtime_unlaunchable",
      message:
        `The site-world runtime is not launchable: ${stringsFromUnknown(siteWorldHealth.blockers).join(", ") || "blocked"}`,
      source: "runtime",
    });
  }

  return {
    launchable: details.length === 0,
    blockers: details.map((item) => item.message),
    blocker_details: details,
    presentationWorldManifestUri: params.runtime.presentationWorldManifestUri ?? null,
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
    launchable: presentationDemo.launchable,
    blockers: presentationDemo.blockers,
    blocker_details: presentationDemo.blocker_details,
    presentationWorldManifestUri: presentationDemo.presentationWorldManifestUri ?? null,
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
  return {
    scenarioId: String(body.scenarioId),
    startStateId: String(body.startStateId),
    seed: null,
    requestedBackend: runtime.defaultRuntimeBackend,
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
      normalizeOptional(runtimeSessionConfig.canonical_package_uri) || runtime.sceneMemoryManifestUri || null,
    canonical_package_version: normalizeOptional(runtimeSessionConfig.canonical_package_version),
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

async function proxyRuntimeRenderForSession(session: HostedSessionRecord, req: Request, res: Response) {
  const runtimeBaseUrl = String(session.runtimeHandle?.runtime_base_url || "").trim();
  if (!runtimeBaseUrl) {
    return res.status(409).json({ error: "Runtime handle missing for hosted session" });
  }
  const cameraId = String(req.query.cameraId || req.query.camera_id || "head_rgb").trim() || "head_rgb";
  const response = await fetch(
    `${runtimeBaseUrl}/v1/sessions/${encodeURIComponent(session.sessionId)}/render?camera_id=${encodeURIComponent(cameraId)}`,
  );
  if (!response.ok) {
    return res.status(response.status).json({ error: "Failed to proxy runtime render" });
  }
  const arrayBuffer = await response.arrayBuffer();
  res.setHeader("Content-Type", response.headers.get("content-type") || "image/png");
  return res.send(Buffer.from(arrayBuffer));
}

async function createRuntimeOnlySession(params: {
  body: CreateHostedSessionRequest;
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>;
  record: HostedSessionRecord;
}) {
  const workDir = sessionWorkDir(params.record.sessionId);
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
    runtime_backend_selected: runtimeBackend,
    status: "ready",
    startedAt: nowTimestamp(),
    artifactUris,
    datasetArtifacts,
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

  return (await loadHostedSession(params.record.sessionId)) || { ...params.record, status: "ready" as const, runtime_backend_selected: runtimeBackend };
}

async function launchPresentationDemoSession(record: HostedSessionRecord, runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>) {
  const proxyPath = `/api/site-worlds/sessions/${encodeURIComponent(record.sessionId)}/ui/`;
  try {
    await updateSession(record.sessionId, {
      runtime_backend_selected: "neoverse",
      presentationRuntime: {
        ...(record.presentationRuntime || { provider: "vast" as const }),
        status: "starting",
        proxyPath,
        errorCode: null,
        errorMessage: null,
      },
    });
    const presentationRuntime = await launchPresentationDemoRuntime({
      sessionId: record.sessionId,
      runtime,
      proxyPath,
    });
    await updateSession(record.sessionId, {
      runtime_backend_selected: "neoverse",
      status: "ready",
      startedAt: nowTimestamp(),
      presentationRuntime,
    });
  } catch (error) {
    const failure =
      error instanceof PresentationDemoRuntimeError
        ? error
        : error instanceof Error
          ? new PresentationDemoRuntimeError("presentation_demo_launch_failed", error.message)
          : new PresentationDemoRuntimeError("presentation_demo_launch_failed", "Failed to launch presentation demo.");
    await updateSession(record.sessionId, {
      status: "failed",
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
    });
  }
}

function createSessionRecord(params: {
  body: CreateHostedSessionRequest;
  runtime: Awaited<ReturnType<typeof resolveHostedRuntime>>;
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
    runtime_backend_selected: sessionMode === "presentation_demo" ? "neoverse" : "pending",
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
    metering: {
      sessionSeconds: 0,
      billableHours: 0,
      priceLabel: params.runtime.priceLabel ?? null,
    },
    launchContext: {
      site_world_spec_uri: params.runtime.siteWorldSpecUri,
      site_world_registration_uri: params.runtime.siteWorldRegistrationUri,
      site_world_health_uri: params.runtime.siteWorldHealthUri,
      runtime_base_url: params.runtime.runtimeBaseUrl ?? null,
      websocket_base_url: params.runtime.websocketBaseUrl ?? null,
      conditioning_bundle_uri: params.runtime.conditioningBundleUri,
      scene_memory_manifest_uri: params.runtime.sceneMemoryManifestUri,
    },
  } satisfies HostedSessionRecord;
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
  if (!sessionUsesPresentationDemo(session) || session.presentationRuntime?.status !== "live" || !uiBaseUrl) {
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
  if (!sessionUsesPresentationDemo(session) || session.presentationRuntime?.status !== "live" || !uiBaseUrl) {
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
  if (!sessionUsesPresentationDemo(session) || session.presentationRuntime?.status !== "live") {
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
      user: { uid: "public-demo-user", email: null },
    });
    await writeSession(record);

    if (sessionMode === "presentation_demo") {
      void launchPresentationDemoSession(record, runtime);
      return res.status(201).json(buildSessionCreateResponse(record));
    }

    const finalizedRecord = await createRuntimeOnlySession({ body, runtime, record });
    return res.status(201).json(buildSessionCreateResponse(finalizedRecord));
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
  const session = await loadHostedSession(String(req.params.sessionId || ""));
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
    if (sessionUsesPresentationDemo(session)) {
      return sessionModeUnsupportedResponse(res);
    }
    const runtime = await resolveHostedRuntime(session.site.siteWorldId);
    const startState = String(
      req.body?.startStateId || session.runtimeConfig?.startStateId || runtime.startStateCatalog[0]?.id || "",
    ).trim();
    const scenario = String(
      req.body?.scenarioId || session.runtimeConfig?.scenarioId || runtime.scenarioCatalog[0]?.id || "",
    ).trim();
    const seed =
      typeof req.body?.seed === "number"
        ? req.body.seed
        : typeof session.runtimeConfig?.seed === "number"
          ? session.runtimeConfig.seed
          : undefined;
    const payload = await resetHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      taskId: req.body?.taskId || session.taskSelection?.taskId || undefined,
      scenarioId: scenario,
      startStateId: startState,
      seed,
    });
    const latestEpisode = normalizeEpisodeSummary(
      session.sessionId,
      payload.episode as Record<string, unknown>,
    );
    await updateSession(session.sessionId, {
      latestEpisode,
      status: "running",
      runtimeConfig: {
        ...(session.runtimeConfig || {}),
        scenarioId: scenario,
        startStateId: startState,
        seed: seed ?? null,
        requestedBackend: session.runtime_backend_selected,
      },
    });
    return res.json({ ...payload, episode: latestEpisode });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Reset failed" });
  }
});

publicSiteWorldSessionsRouter.post("/:sessionId/run-batch", async (req, res, next) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session || !isPublicDemoSession(session)) {
      return next();
    }
    if (sessionUsesPresentationDemo(session)) {
      return sessionModeUnsupportedResponse(res);
    }
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

    if (sessionUsesPresentationDemo(session)) {
      const payload = await stopPresentationDemoRuntime({
        sessionId: session.sessionId,
        presentationRuntime: session.presentationRuntime,
      });
      await updateSession(session.sessionId, {
        status: "stopped",
        stoppedAt: nowTimestamp(),
        presentationRuntime: {
          provider: "vast",
          status: "stopped",
          uiBaseUrl: session.presentationRuntime?.uiBaseUrl || null,
          proxyPath: session.presentationRuntime?.proxyPath || null,
          instanceId: session.presentationRuntime?.instanceId || null,
          startedAt: session.presentationRuntime?.startedAt || null,
          expiresAt: session.presentationRuntime?.expiresAt || null,
          errorCode: null,
          errorMessage: null,
        },
      });
      return res.json(payload);
    }

    const payload = await stopHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
    });
    await updateSession(session.sessionId, {
      status: "stopped",
      stoppedAt: nowTimestamp(),
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

publicSiteWorldSessionsRouter.post("/:sessionId/export", async (req, res, next) => {
  try {
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session || !isPublicDemoSession(session)) {
      return next();
    }
    if (sessionUsesPresentationDemo(session)) {
      return sessionModeUnsupportedResponse(res);
    }
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

    const record = createSessionRecord({ body, runtime, user });
    if (sessionMode === "presentation_demo") {
      activePresentationSessionIndex.set(presentationSessionKey(user.uid, runtime.siteWorldId), record.sessionId);
    }
    await writeSession(record);

    if (sessionMode === "presentation_demo") {
      void launchPresentationDemoSession(record, runtime);
      return res.status(201).json(buildSessionCreateResponse(record));
    }

    const finalizedRecord = await createRuntimeOnlySession({ body, runtime, record });
    return res.status(201).json(buildSessionCreateResponse(finalizedRecord));
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
    if (!sessionUsesPresentationDemo(session) || session.presentationRuntime?.status !== "live") {
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
    const session = await loadHostedSession(String(req.params.sessionId || ""));
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
    if (sessionUsesPresentationDemo(session)) {
      return sessionModeUnsupportedResponse(res);
    }
    const runtime = await resolveHostedRuntime(session.site.siteWorldId);
    const startState = String(
      req.body?.startStateId || session.runtimeConfig?.startStateId || runtime.startStateCatalog[0]?.id || "",
    ).trim();
    const scenario = String(
      req.body?.scenarioId || session.runtimeConfig?.scenarioId || runtime.scenarioCatalog[0]?.id || "",
    ).trim();
    const seed =
      typeof req.body?.seed === "number"
        ? req.body.seed
        : typeof session.runtimeConfig?.seed === "number"
          ? session.runtimeConfig.seed
          : undefined;
    const payload = await resetHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      taskId: req.body?.taskId || session.taskSelection?.taskId || undefined,
      scenarioId: scenario,
      startStateId: startState,
      seed,
    });
    const latestEpisode = normalizeEpisodeSummary(session.sessionId, payload.episode as Record<string, unknown>);
    await updateSession(session.sessionId, {
      latestEpisode,
      status: "running",
      runtimeConfig: {
        ...(session.runtimeConfig || {}),
        scenarioId: scenario,
        startStateId: startState,
        seed: seed ?? null,
        requestedBackend: session.runtime_backend_selected,
      },
    });
    return res.json({ ...payload, episode: latestEpisode });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Reset failed" });
  }
});

protectedRouter.post("/:sessionId/step", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    if (sessionUsesPresentationDemo(session)) {
      return sessionModeUnsupportedResponse(res);
    }
    const payload = await stepHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      episodeId: String(req.body?.episodeId || ""),
      action: Array.isArray(req.body?.action) ? req.body.action : undefined,
      autoPolicy: req.body?.autoPolicy !== false,
    });
    const latestEpisode = normalizeEpisodeSummary(session.sessionId, payload.episode as Record<string, unknown>);
    await updateSession(session.sessionId, {
      latestEpisode,
    });
    return res.json({ ...payload, episode: latestEpisode });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Step failed" });
  }
});

protectedRouter.post("/:sessionId/run-batch", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
    const session = await loadHostedSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    if (sessionUsesPresentationDemo(session)) {
      return sessionModeUnsupportedResponse(res);
    }
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

    let payload: Record<string, unknown>;
    if (sessionUsesPresentationDemo(session)) {
      payload = await stopPresentationDemoRuntime({
        sessionId: session.sessionId,
        presentationRuntime: session.presentationRuntime,
      });
      await updateSession(session.sessionId, {
        status: "stopped",
        stoppedAt: nowTimestamp(),
        presentationRuntime: {
          provider: "vast",
          status: "stopped",
          uiBaseUrl: session.presentationRuntime?.uiBaseUrl || null,
          proxyPath: session.presentationRuntime?.proxyPath || null,
          instanceId: session.presentationRuntime?.instanceId || null,
          startedAt: session.presentationRuntime?.startedAt || null,
          expiresAt: session.presentationRuntime?.expiresAt || null,
          errorCode: null,
          errorMessage: null,
        },
      });
      return res.json(payload);
    }

    payload = await stopHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
    });
    await updateSession(session.sessionId, {
      status: "stopped",
      stoppedAt: nowTimestamp(),
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
  const runtimeBaseUrl = String(session.runtimeHandle?.runtime_base_url || "").trim();
  if (!runtimeBaseUrl) {
    return res.status(409).json({ error: "Runtime handle missing for hosted session" });
  }
  const cameraId = String(req.query.cameraId || req.query.camera_id || "head_rgb").trim() || "head_rgb";
  const response = await fetch(
    `${runtimeBaseUrl}/v1/sessions/${encodeURIComponent(session.sessionId)}/render?camera_id=${encodeURIComponent(cameraId)}`,
  );
  if (!response.ok) {
    return res.status(response.status).json({ error: "Failed to proxy runtime render" });
  }
  const arrayBuffer = await response.arrayBuffer();
  res.setHeader("Content-Type", response.headers.get("content-type") || "image/png");
  return res.send(Buffer.from(arrayBuffer));
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
