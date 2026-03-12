import { randomUUID } from "node:crypto";
import { Router, Request, Response } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type {
  CreateHostedSessionRequest,
  HostedBatchSummary,
  HostedEpisodeSummary,
  HostedSessionRecord,
} from "../types/hosted-session";
import { HostedSessionRuntimeError, resolveHostedRuntime } from "../utils/hosted-session-runtime";
import {
  createHostedSessionRun,
  exportHostedSessionRun,
  resetHostedSessionRun,
  runBatchHostedSessionRun,
  sessionWorkDir,
  stepHostedSessionRun,
  stopHostedSessionRun,
} from "../utils/hosted-session-orchestrator";

const router = Router();
const inMemorySessions = new Map<string, HostedSessionRecord>();

function nowTimestamp() {
  return admin?.firestore?.FieldValue?.serverTimestamp?.() ?? new Date().toISOString();
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

async function ensureLaunchAccess(req: Request, res: Response) {
  const firebaseUser = res.locals.firebaseUser as
    | { uid?: string; email?: string; admin?: boolean }
    | undefined;
  if (!firebaseUser?.uid) {
    throw new HostedSessionRuntimeError("unauthorized", "Missing authenticated user.");
  }

  if (firebaseUser.admin) {
    return {
      uid: firebaseUser.uid,
      email: firebaseUser.email || null,
    };
  }

  const profile = await loadUserProfile(firebaseUser.uid);
  const buyerType = String(profile?.buyerType || "").trim();
  if (buyerType !== "robot_team") {
    throw new HostedSessionRuntimeError(
      "forbidden",
      "Hosted sessions are only available to robot-team accounts.",
    );
  }

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email || null,
  };
}

async function writeSession(record: HostedSessionRecord) {
  if (!db) {
    inMemorySessions.set(record.sessionId, record);
    return;
  }

  await db.collection("hostedSessions").doc(record.sessionId).set(record);
}

async function updateSession(sessionId: string, update: Partial<HostedSessionRecord>) {
  if (!db) {
    const current = inMemorySessions.get(sessionId);
    if (!current) return;
    inMemorySessions.set(sessionId, { ...current, ...update });
    return;
  }

  await db.collection("hostedSessions").doc(sessionId).update(update);
}

async function loadSession(sessionId: string): Promise<HostedSessionRecord | null> {
  if (!db) {
    return inMemorySessions.get(sessionId) ?? null;
  }

  const doc = await db.collection("hostedSessions").doc(sessionId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as HostedSessionRecord;
}

function isRenderableObservationPath(framePath?: string | null) {
  const normalized = String(framePath || "").trim();
  return /^(https?:\/\/|data:image\/|\/(api|assets|images|attached_assets)\/)/.test(normalized);
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
    runtimeManifestUri: runtime.runtimeManifestUri,
    sceneMemoryManifestUri: runtime.sceneMemoryManifestUri,
    conditioningBundleUri: runtime.conditioningBundleUri,
    previewSimulationManifestUri: runtime.previewSimulationManifestUri ?? null,
    availableScenarioVariants: runtime.availableScenarioVariants,
    availableStartStates: runtime.availableStartStates,
    defaultRuntimeBackend: runtime.defaultRuntimeBackend,
    availableRuntimeBackends: runtime.availableRuntimeBackends,
  };
}

function normalizeEpisodeSummary(
  episodePayload: Record<string, unknown>,
): HostedSessionRecord["latestEpisode"] {
  const observation =
    episodePayload.observation && typeof episodePayload.observation === "object"
      ? (episodePayload.observation as Record<string, unknown>)
      : null;
  const artifactUris =
    episodePayload.artifactUris && typeof episodePayload.artifactUris === "object"
      ? (episodePayload.artifactUris as Record<string, string>)
      : {};
  const framePath = String(observation?.frame_path || "").trim();
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
    observation,
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

router.post("/", async (req: Request, res: Response) => {
  try {
    const user = await ensureLaunchAccess(req, res);
    const body = (req.body ?? {}) as CreateHostedSessionRequest;
    if (!body.siteWorldId || !body.robotProfileId || !body.taskId || !body.scenarioId || !body.startStateId || !body.policy) {
      return res.status(400).json({
        error: "siteWorldId, robotProfileId, taskId, scenarioId, startStateId, and policy are required",
      });
    }

    const runtime = await resolveHostedRuntime(String(body.siteWorldId));
    const taskSelection = normalizeTaskSelection(body, runtime);
    const runtimeConfig = normalizeRuntimeConfig(body, runtime);
    const robotProfile = normalizeRobotProfile(body, runtime);

    const sessionId = randomUUID();
    const workDir = sessionWorkDir(sessionId);

    const record: HostedSessionRecord = {
      sessionId,
      site: {
        siteWorldId: runtime.siteWorldId,
        siteName: runtime.siteName,
        siteAddress: runtime.siteAddress,
        scene_id: runtime.scene_id,
        capture_id: runtime.capture_id,
        site_submission_id: runtime.site_submission_id,
        pipeline_prefix: runtime.pipeline_prefix,
      },
      siteModel: buildSiteModelSummary(runtime),
      runtime_backend_selected: "pending",
      status: "creating",
      robotProfileId: body.robotProfileId,
      robotProfile,
      robot: robotProfile.displayName,
      policy: body.policy || {},
      runtimeConfig,
      taskSelection,
      requestedOutputs: normalizeRequestedOutputs(body),
      datasetArtifacts: {},
      task: taskSelection.taskText,
      scenario:
        runtime.scenarioCatalog.find((item) => item.id === runtimeConfig.scenarioId)?.name
        || runtimeConfig.scenarioId,
      notes: body.notes || null,
      createdBy: user,
      createdAt: nowTimestamp(),
      startedAt: null,
      stoppedAt: null,
      elapsedSeconds: 0,
      latestEpisode: null,
      batchSummary: null,
      artifactUris: {},
      metering: {
        sessionSeconds: 0,
        billableHours: 0,
        priceLabel: runtime.priceLabel ?? null,
      },
      launchContext: {
        hosted_session_runtime_manifest_uri: runtime.runtimeManifestUri,
        task_anchor_manifest_uri: runtime.taskAnchorManifestUri,
        task_run_manifest_uri: runtime.taskRunManifestUri,
        conditioning_bundle_uri: runtime.conditioningBundleUri,
        scene_memory_manifest_uri: runtime.sceneMemoryManifestUri,
        preview_simulation_manifest_uri: runtime.previewSimulationManifestUri ?? null,
      },
    };

    await writeSession(record);
    const createPayload = await createHostedSessionRun({
      sessionId,
      workDir,
      runtime,
      robotProfileId: body.robotProfileId,
      robotProfileOverride: body.robotProfileOverride,
      policy: record.policy,
      taskId: body.taskId,
      scenarioId: body.scenarioId,
      startStateId: body.startStateId,
      exportModes: record.requestedOutputs || ["raw_bundle", "rlds_dataset"],
      notes: record.notes ?? undefined,
    });

    const runtimeBackend = String(createPayload.payload.runtime_backend_selected || "unknown");
    const artifactUris =
      (createPayload.payload.artifact_uris as Record<string, string> | undefined) ?? {};
    const datasetArtifacts =
      (createPayload.payload.dataset_artifacts as Record<string, unknown> | undefined) ?? {};
    await updateSession(sessionId, {
      runtime_backend_selected: runtimeBackend,
      status: "ready",
      startedAt: nowTimestamp(),
      artifactUris,
      datasetArtifacts,
    });

    return res.status(201).json({
      sessionId,
      status: "ready",
      site: record.site,
      runtimeBackend,
      launchable: true,
      workspaceUrl: `/site-worlds/${runtime.siteWorldId}/workspace?sessionId=${encodeURIComponent(sessionId)}`,
    });
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

router.get("/:sessionId", async (req, res) => {
  const session = await loadSession(String(req.params.sessionId || ""));
  if (!session) {
    return res.status(404).json({ error: "Hosted session not found" });
  }
  return res.json(session);
});

router.post("/:sessionId/reset", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
    const session = await loadSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
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
    const latestEpisode = normalizeEpisodeSummary(payload.episode as Record<string, unknown>);
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

router.post("/:sessionId/step", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
    const session = await loadSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
    }
    const payload = await stepHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      episodeId: String(req.body?.episodeId || ""),
      action: Array.isArray(req.body?.action) ? req.body.action : undefined,
      autoPolicy: req.body?.autoPolicy !== false,
    });
    const latestEpisode = normalizeEpisodeSummary(payload.episode as Record<string, unknown>);
    await updateSession(session.sessionId, {
      latestEpisode,
    });
    return res.json({ ...payload, episode: latestEpisode });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Step failed" });
  }
});

router.post("/:sessionId/run-batch", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
    const session = await loadSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
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

router.post("/:sessionId/stop", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
    const session = await loadSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
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

router.post("/:sessionId/export", async (req, res) => {
  try {
    await ensureLaunchAccess(req, res);
    const session = await loadSession(String(req.params.sessionId || ""));
    if (!session) {
      return res.status(404).json({ error: "Hosted session not found" });
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

export default router;
