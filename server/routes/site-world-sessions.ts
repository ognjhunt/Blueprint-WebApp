import { randomUUID } from "node:crypto";
import { Router, Request, Response } from "express";
import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import type {
  CreateHostedSessionRequest,
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

router.post("/", async (req: Request, res: Response) => {
  try {
    const user = await ensureLaunchAccess(req, res);
    const body = (req.body ?? {}) as CreateHostedSessionRequest;
    if (!body.siteWorldId || !body.robot || !body.task || !body.scenario) {
      return res.status(400).json({ error: "siteWorldId, robot, task, and scenario are required" });
    }

    const runtime = await resolveHostedRuntime(String(body.siteWorldId));
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
      runtime_backend_selected: "pending",
      status: "creating",
      robot: String(body.robot),
      policy: body.policy || {},
      task: String(body.task),
      scenario: String(body.scenario),
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
      robot: record.robot,
      policy: record.policy,
      task: record.task,
      scenario: record.scenario,
      notes: record.notes ?? undefined,
    });

    const runtimeBackend = String(createPayload.payload.runtime_backend_selected || "unknown");
    const artifactUris =
      (createPayload.payload.artifact_uris as Record<string, string> | undefined) ?? {};
    await updateSession(sessionId, {
      runtime_backend_selected: runtimeBackend,
      status: "ready",
      startedAt: nowTimestamp(),
      artifactUris,
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
    const payload = await resetHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      taskId: req.body?.taskId,
      scenario: req.body?.scenario,
      startState: req.body?.startState,
      seed: req.body?.seed,
    });
    await updateSession(session.sessionId, {
      latestEpisode: payload.episode as HostedSessionRecord["latestEpisode"],
      status: "running",
    });
    return res.json(payload);
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
    await updateSession(session.sessionId, {
      latestEpisode: payload.episode as HostedSessionRecord["latestEpisode"],
    });
    return res.json(payload);
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
    const payload = await runBatchHostedSessionRun({
      sessionId: session.sessionId,
      workDir: sessionWorkDir(session.sessionId),
      numEpisodes: Number(req.body?.numEpisodes || 1),
      taskId: req.body?.taskId,
      scenario: req.body?.scenario,
      seed: req.body?.seed,
      maxSteps: req.body?.maxSteps,
    });
    await updateSession(session.sessionId, {
      batchSummary: payload.summary as HostedSessionRecord["batchSummary"],
      artifactUris: {
        ...session.artifactUris,
        ...(payload.artifact_uris as Record<string, string> | undefined),
      },
    });
    return res.json(payload);
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
    await updateSession(session.sessionId, {
      artifactUris: {
        ...session.artifactUris,
        ...(payload.artifact_uris as Record<string, string> | undefined),
      },
    });
    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Export failed" });
  }
});

export default router;
