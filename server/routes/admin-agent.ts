import { Request, Response, Router } from "express";
import { z } from "zod";

import {
  approveAgentRun,
  cancelAgentRun,
  createOpsDocument,
  createAgentSession,
  createStartupPack,
  extractOpsDocument,
  forkAgentSessionWithHandoff,
  getAgentSession,
  getOpsDocument,
  getStartupPack,
  getStartupContextOptions,
  listAgentRunsForSession,
  listAgentSessions,
  listOpsDocuments,
  listOpsActionLogs,
  listStartupPacks,
  sendAgentSessionMessage,
  updateOpsDocument,
  updateStartupPack,
} from "../agents";
import {
  getAgentRuntimeConnectionMetadata,
  runAgentRuntimeSmokeTest,
} from "../agents/runtime-connectivity";
import {
  demoteAgentLane,
  evaluateGraduationStatus,
  promoteAgentLane,
} from "../utils/agent-graduation";
import { requireAdminRole } from "../middleware/requireAdminRole";
import { resolveAccessContext } from "../utils/access-control";

const router = Router();

function normalizeTimestamp(value: unknown) {
  const timestamp = value as { toDate?: () => Date } | string | null | undefined;
  if (!timestamp) {
    return null;
  }
  if (typeof timestamp === "string") {
    return timestamp;
  }
  return timestamp.toDate?.()?.toISOString?.() || null;
}

function normalizeSession(session: unknown) {
  const value = session as Record<string, unknown>;
  const metadata =
    value.metadata && typeof value.metadata === "object"
      ? (value.metadata as Record<string, unknown>)
      : {};
  const startupContext =
    metadata.startupContext && typeof metadata.startupContext === "object"
      ? (metadata.startupContext as Record<string, unknown>)
      : {};

  return {
    ...value,
    created_at: normalizeTimestamp(value.created_at),
    updated_at: normalizeTimestamp(value.updated_at),
    metadata: {
      ...metadata,
      startupContext: {
        ...startupContext,
        startupPackIds: Array.isArray(startupContext.startupPackIds)
          ? startupContext.startupPackIds
          : [],
        repoDocPaths: Array.isArray(startupContext.repoDocPaths)
          ? startupContext.repoDocPaths
          : [],
        blueprintIds: Array.isArray(startupContext.blueprintIds)
          ? startupContext.blueprintIds
          : [],
        documentIds: Array.isArray(startupContext.documentIds)
          ? startupContext.documentIds
          : [],
        externalSources: Array.isArray(startupContext.externalSources)
          ? startupContext.externalSources
          : [],
        creativeContexts: Array.isArray(startupContext.creativeContexts)
          ? startupContext.creativeContexts
          : [],
        operatorNotes:
          typeof startupContext.operatorNotes === "string"
            ? startupContext.operatorNotes
            : "",
        targetHarness:
          startupContext.targetHarness === "claude_code" ? "claude_code" : "codex",
      },
    },
  };
}

function normalizeRun(run: unknown) {
  const value = run as Record<string, unknown>;
  return {
    ...value,
    created_at: normalizeTimestamp(value.created_at),
    updated_at: normalizeTimestamp(value.updated_at),
    started_at: normalizeTimestamp(value.started_at),
    completed_at: normalizeTimestamp(value.completed_at),
    cancelled_at: normalizeTimestamp(value.cancelled_at),
  };
}

function normalizeStartupPack(pack: unknown) {
  const value = pack as Record<string, unknown>;
  return {
    id: value.id,
    name: value.name,
    description: typeof value.description === "string" ? value.description : "",
    repoDocPaths: Array.isArray(value.repo_doc_paths) ? value.repo_doc_paths : [],
    blueprintIds: Array.isArray(value.blueprint_ids) ? value.blueprint_ids : [],
    documentIds: Array.isArray(value.document_ids) ? value.document_ids : [],
    externalSources: Array.isArray(value.external_sources) ? value.external_sources : [],
    creativeContexts: Array.isArray(value.creative_contexts) ? value.creative_contexts : [],
    operatorNotes: typeof value.operator_notes === "string" ? value.operator_notes : "",
    toolPolicies:
      value.tool_policies && typeof value.tool_policies === "object"
        ? value.tool_policies
        : {},
    ownerScope: value.owner_scope === "org" ? "org" : "workspace_admin",
    ownerId: typeof value.owner_id === "string" ? value.owner_id : null,
    visibility:
      value.visibility === "private" || value.visibility === "org"
        ? value.visibility
        : "workspace",
    version: typeof value.version === "number" ? value.version : 1,
    createdBy:
      value.created_by && typeof value.created_by === "object" ? value.created_by : null,
    updatedBy:
      value.updated_by && typeof value.updated_by === "object" ? value.updated_by : null,
    createdAt: normalizeTimestamp(value.created_at),
    updatedAt: normalizeTimestamp(value.updated_at),
  };
}

function normalizeOpsDocument(document: unknown) {
  const value = document as Record<string, unknown>;
  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "",
    sourceFileUri:
      typeof value.source_file_uri === "string" ? value.source_file_uri : "",
    mimeType: typeof value.mime_type === "string" ? value.mime_type : null,
    blueprintIds: Array.isArray(value.blueprint_ids) ? value.blueprint_ids : [],
    startupPackIds: Array.isArray(value.startup_pack_ids) ? value.startup_pack_ids : [],
    extractionStatus:
      typeof value.extraction_status === "string" ? value.extraction_status : "pending",
    indexingStatus:
      typeof value.indexing_status === "string" ? value.indexing_status : "not_started",
    extractedSummary:
      typeof value.extracted_summary === "string" ? value.extracted_summary : null,
    extractedText: typeof value.extracted_text === "string" ? value.extracted_text : null,
    openclawSessionId:
      typeof value.openclaw_session_id === "string" ? value.openclaw_session_id : null,
    openclawRunId:
      typeof value.openclaw_run_id === "string" ? value.openclaw_run_id : null,
    artifacts:
      value.artifacts && typeof value.artifacts === "object" ? value.artifacts : null,
    logs: Array.isArray(value.logs) ? value.logs : [],
    error: typeof value.error === "string" ? value.error : null,
    createdAt: normalizeTimestamp(value.created_at),
    updatedAt: normalizeTimestamp(value.updated_at),
  };
}

function normalizeActionLog(log: unknown) {
  const value = log as Record<string, unknown>;
  return {
    id: value.id,
    sessionId: typeof value.session_id === "string" ? value.session_id : null,
    runId: typeof value.run_id === "string" ? value.run_id : null,
    sessionKey: typeof value.session_key === "string" ? value.session_key : null,
    actionKey: typeof value.action_key === "string" ? value.action_key : "",
    status: typeof value.status === "string" ? value.status : "info",
    summary: typeof value.summary === "string" ? value.summary : "",
    provider: typeof value.provider === "string" ? value.provider : null,
    runtime: typeof value.runtime === "string" ? value.runtime : null,
    taskKind: typeof value.task_kind === "string" ? value.task_kind : null,
    riskLevel: typeof value.risk_level === "string" ? value.risk_level : "low",
    reversible: value.reversible === true,
    requiresApproval: value.requires_approval === true,
    latencyMs: typeof value.latency_ms === "number" ? value.latency_ms : null,
    metadata: value.metadata && typeof value.metadata === "object" ? value.metadata : {},
    createdAt: normalizeTimestamp(value.created_at),
  };
}

const createSessionSchema = z.object({
  title: z.string().min(1).max(200),
  task_kind: z.enum(["operator_thread", "support_triage"]),
  session_key: z.string().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const sessionMessageSchema = z.object({
  task_kind: z.enum(["operator_thread", "external_harness_thread", "support_triage"]),
  session_key: z.string().min(1).max(200).optional(),
  input: z.record(z.unknown()),
  tool_policy: z.record(z.unknown()).optional(),
  approval_policy: z.record(z.unknown()).optional(),
  session_policy: z.record(z.unknown()).optional(),
  resume_from_run_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const forkSessionSchema = z.object({
  phase: z.enum(["investigation", "implementation", "review_qa"]),
  source_run_id: z.string().optional(),
});

const startupPackSourceSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url(),
  description: z.string().max(1000).optional(),
  source_type: z.string().max(120).optional(),
});

const creativeContextSchema = z.object({
  id: z.string().min(1).max(160),
  sku_name: z.string().max(200).optional(),
  created_at: z.string().max(120).nullable().optional(),
  rollout_variant: z.string().max(120).nullable().optional(),
  research_topic: z.string().max(240).nullable().optional(),
  storage_uri: z.string().min(1).max(2000),
});

const createStartupPackSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(600).optional(),
  repoDocPaths: z.array(z.string().min(1).max(300)).optional(),
  blueprintIds: z.array(z.string().min(1).max(160)).optional(),
  documentIds: z.array(z.string().min(1).max(160)).optional(),
  externalSources: z.array(startupPackSourceSchema).optional(),
  creativeContexts: z.array(creativeContextSchema).optional(),
  operatorNotes: z.string().max(12000).optional(),
  toolPolicies: z.record(z.unknown()).optional(),
  ownerScope: z.enum(["workspace_admin", "org"]).optional(),
  ownerId: z.string().max(160).nullable().optional(),
  visibility: z.enum(["private", "workspace", "org"]).optional(),
});

const updateStartupPackSchema = createStartupPackSchema.partial();

const createOpsDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  sourceFileUri: z.string().min(1).max(2000),
  mimeType: z.string().max(200).optional(),
  blueprintIds: z.array(z.string().min(1).max(160)).optional(),
  startupPackIds: z.array(z.string().min(1).max(160)).optional(),
  autoExtract: z.boolean().optional(),
});

const updateOpsDocumentSchema = createOpsDocumentSchema
  .omit({ autoExtract: true })
  .partial();

const runtimeSmokeTestSchema = z.object({
  model: z.string().min(1).max(200).optional(),
});

router.post("/sessions", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = createSessionSchema.parse(req.body ?? {});
    const session = await createAgentSession(payload);
    return res.status(201).json({ ok: true, session: normalizeSession(session) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create agent session";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.get("/sessions", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const sessions = await listAgentSessions(Number.isFinite(limit) ? limit : undefined);
    return res.json({
      ok: true,
      sessions: sessions.map((session) => normalizeSession(session)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to list agent sessions";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.get("/sessions/:id", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const session = await getAgentSession(req.params.id);
    if (!session) {
      return res.status(404).json({ ok: false, error: "Agent session not found" });
    }
    return res.json({ ok: true, session: normalizeSession(session) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get agent session";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.get(
  "/sessions/:id/runs",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const limit =
        typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
      const runs = await listAgentRunsForSession(
        req.params.id,
        Number.isFinite(limit) ? limit : undefined,
      );
      return res.json({
        ok: true,
        runs: runs.map((run) => normalizeRun(run)),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to list agent runs";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.get(
  "/sessions/:id/action-logs",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const limit =
        typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
      const logs = await listOpsActionLogs({
        sessionId: req.params.id,
        limit: Number.isFinite(limit) ? limit : undefined,
      });
      return res.json({
        ok: true,
        actionLogs: logs.map((log) => normalizeActionLog(log)),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to list action logs";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.get("/context/options", requireAdminRole, async (_req: Request, res: Response) => {
  try {
    const options = await getStartupContextOptions();
    return res.json({ ok: true, ...options });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load startup context options";
    return res.status(400).json({ ok: false, error: message });
  }
});

async function runtimeConnectivityHandler(_req: Request, res: Response) {
  try {
    return res.json({
      ok: true,
      connectivity: getAgentRuntimeConnectionMetadata(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to inspect agent runtime connectivity";
    return res.status(400).json({ ok: false, error: message });
  }
}

async function runtimeSmokeHandler(req: Request, res: Response) {
  try {
    const payload = runtimeSmokeTestSchema.parse(req.body ?? {});
    const result = await runAgentRuntimeSmokeTest({
      model: payload.model,
    });
    return res.status(result.ok ? 200 : 502).json({
      ok: result.ok,
      smokeTest: result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Agent runtime smoke test failed";
    return res.status(400).json({ ok: false, error: message });
  }
}

router.get("/runtime/connectivity", requireAdminRole, runtimeConnectivityHandler);
router.post("/runtime/smoke-test", requireAdminRole, runtimeSmokeHandler);
router.get("/openclaw/connectivity", requireAdminRole, runtimeConnectivityHandler);
router.post("/openclaw/smoke-test", requireAdminRole, runtimeSmokeHandler);

router.get("/startup-packs", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const packs = await listStartupPacks(Number.isFinite(limit) ? limit : undefined);
    return res.json({
      ok: true,
      startupPacks: packs.map((pack) => normalizeStartupPack(pack)),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list startup packs";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.get("/startup-packs/:id", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const startupPack = await getStartupPack(req.params.id);
    if (!startupPack) {
      return res.status(404).json({ ok: false, error: "Startup pack not found" });
    }
    return res.json({
      ok: true,
      startupPack: normalizeStartupPack(startupPack),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load startup pack";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.post("/startup-packs", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = createStartupPackSchema.parse(req.body ?? {});
    const actor = await resolveAccessContext(res);
    const startupPack = await createStartupPack({
      name: payload.name,
      description: payload.description,
      repo_doc_paths: payload.repoDocPaths,
      blueprint_ids: payload.blueprintIds,
      document_ids: payload.documentIds,
      external_sources: payload.externalSources,
      creative_contexts: payload.creativeContexts,
      operator_notes: payload.operatorNotes,
      tool_policies: payload.toolPolicies,
      owner_scope: payload.ownerScope,
      owner_id: payload.ownerId,
      visibility: payload.visibility,
      actor: {
        uid: actor.uid,
        email: actor.email,
      },
    });

    return res.status(201).json({
      ok: true,
      startupPack: normalizeStartupPack(startupPack),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create startup pack";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.patch("/startup-packs/:id", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = updateStartupPackSchema.parse(req.body ?? {});
    const actor = await resolveAccessContext(res);
    const startupPack = await updateStartupPack(req.params.id, {
      name: payload.name,
      description: payload.description,
      repo_doc_paths: payload.repoDocPaths,
      blueprint_ids: payload.blueprintIds,
      document_ids: payload.documentIds,
      external_sources: payload.externalSources,
      creative_contexts: payload.creativeContexts,
      operator_notes: payload.operatorNotes,
      tool_policies: payload.toolPolicies,
      owner_scope: payload.ownerScope,
      owner_id: payload.ownerId,
      visibility: payload.visibility,
      actor: {
        uid: actor.uid,
        email: actor.email,
      },
    });

    if (!startupPack) {
      return res.status(404).json({ ok: false, error: "Startup pack not found" });
    }

    return res.json({
      ok: true,
      startupPack: normalizeStartupPack(startupPack),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update startup pack";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.get("/documents", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const limit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
    const documents = await listOpsDocuments(Number.isFinite(limit) ? limit : undefined);
    return res.json({
      ok: true,
      documents: documents.map((document) => normalizeOpsDocument(document)),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list ops documents";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.get("/documents/:id", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const document = await getOpsDocument(req.params.id);
    if (!document) {
      return res.status(404).json({ ok: false, error: "Ops document not found" });
    }
    return res.json({ ok: true, document: normalizeOpsDocument(document) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load ops document";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.post("/documents", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = createOpsDocumentSchema.parse(req.body ?? {});
    const actor = await resolveAccessContext(res);
    const document = await createOpsDocument({
      title: payload.title,
      source_file_uri: payload.sourceFileUri,
      mime_type: payload.mimeType,
      blueprint_ids: payload.blueprintIds,
      startup_pack_ids: payload.startupPackIds,
      actor: {
        uid: actor.uid,
        email: actor.email,
      },
    });
    const nextDocument =
      payload.autoExtract === true ? await extractOpsDocument(document.id) : document;

    return res.status(201).json({
      ok: true,
      document: normalizeOpsDocument(nextDocument),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create ops document";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.patch("/documents/:id", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = updateOpsDocumentSchema.parse(req.body ?? {});
    const actor = await resolveAccessContext(res);
    const document = await updateOpsDocument(req.params.id, {
      title: payload.title,
      source_file_uri: payload.sourceFileUri,
      mime_type: payload.mimeType,
      blueprint_ids: payload.blueprintIds,
      startup_pack_ids: payload.startupPackIds,
      actor: {
        uid: actor.uid,
        email: actor.email,
      },
    });

    if (!document) {
      return res.status(404).json({ ok: false, error: "Ops document not found" });
    }

    return res.json({ ok: true, document: normalizeOpsDocument(document) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update ops document";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.post(
  "/documents/:id/extract",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const document = await extractOpsDocument(req.params.id);
      return res.json({ ok: true, document: normalizeOpsDocument(document) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to extract ops document";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.post(
  "/sessions/:id/messages",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const payload = sessionMessageSchema.parse(req.body ?? {});
      const result = await sendAgentSessionMessage({
        sessionId: req.params.id,
        task: {
          kind: payload.task_kind,
          input: payload.input,
          session_key: payload.session_key,
          tool_policy: payload.tool_policy,
          approval_policy: payload.approval_policy,
          session_policy: payload.session_policy,
          resume_from_run_id: payload.resume_from_run_id,
          metadata: payload.metadata,
        },
      });

      return res.status(result.queued ? 202 : 200).json({
        ok: true,
        ...result,
        result: result.result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send agent message";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.post(
  "/sessions/:id/fork",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const payload = forkSessionSchema.parse(req.body ?? {});
      const result = await forkAgentSessionWithHandoff({
        sessionId: req.params.id,
        phase: payload.phase,
        sourceRunId: payload.source_run_id,
      });

      return res.status(result.dispatch.queued ? 202 : 200).json({
        ok: true,
        session: normalizeSession(result.session),
        handoffPrompt: result.handoffPrompt,
        dispatch: result.dispatch,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fork agent session";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.post("/runs/:id/approve", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const run = await approveAgentRun(req.params.id);
    return res.json({ ok: true, run: normalizeRun(run) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve agent run";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.post("/runs/:id/cancel", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const run = await cancelAgentRun(req.params.id);
    return res.json({ ok: true, run: normalizeRun(run) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to cancel agent run";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.get("/graduation", requireAdminRole, async (_req: Request, res: Response) => {
  try {
    const lanes = await Promise.all([
      evaluateGraduationStatus("waitlist"),
      evaluateGraduationStatus("inbound_qualification"),
      evaluateGraduationStatus("support_triage"),
      evaluateGraduationStatus("payout_exception"),
      evaluateGraduationStatus("capturer_reminders"),
      evaluateGraduationStatus("buyer_lifecycle"),
      evaluateGraduationStatus("growth_campaign"),
    ]);

    return res.json({ ok: true, lanes });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch graduation status";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.post(
  "/graduation/:lane/promote",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const actor = await resolveAccessContext(res);
      const result = await promoteAgentLane(
        req.params.lane,
        actor.email || actor.uid || "ops@tryblueprint.io",
      );

      if (result.error) {
        return res.status(400).json({ ok: false, error: result.error });
      }

      return res.json({ ok: true, lane: result });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to promote agent lane";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.post(
  "/graduation/:lane/demote",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const actor = await resolveAccessContext(res);
      const reason =
        typeof req.body?.reason === "string" && req.body.reason.trim().length > 0
          ? req.body.reason.trim()
          : "Manual demotion";
      const result = await demoteAgentLane(
        req.params.lane,
        actor.email || actor.uid || "ops@tryblueprint.io",
        reason,
      );
      return res.json({ ok: true, lane: result });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to demote agent lane";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

export default router;
