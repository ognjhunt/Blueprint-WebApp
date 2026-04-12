import { Request, Response, Router } from "express";
import { z } from "zod";

import {
  approveAgentRun,
  cancelAgentRun,
  cancelAgentSession,
  compactAgentSession,
  createAgentProfile,
  createOpsDocument,
  createAgentSession,
  createEnvironmentProfile,
  createStartupPack,
  delegateManagedAgentTask,
  extractOpsDocument,
  interruptAgentSession,
  forkAgentSessionWithHandoff,
  getAgentProfile,
  getAgentSession,
  getEnvironmentProfile,
  getOpsDocument,
  getStartupPack,
  getStartupContextOptions,
  listAgentProfiles,
  listAgentRunsForSession,
  listAgentSessions,
  listCheckpointsForSession,
  listCompactionsForSession,
  listEnvironmentProfiles,
  listOpsDocuments,
  listOpsActionLogs,
  listRuntimeEventsForSession,
  listStartupPacks,
  resumeAgentSession,
  sendAgentSessionMessage,
  spawnSessionSubagents,
  startAgentSessionRun,
  steerAgentSession,
  updateAgentProfile,
  updateEnvironmentProfile,
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
import { dispatchHumanBlocker } from "../utils/human-blocker-dispatch";

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
        knowledgePagePaths: Array.isArray(startupContext.knowledgePagePaths)
          ? startupContext.knowledgePagePaths
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

function normalizeAgentProfile(profile: unknown) {
  const value = profile as Record<string, unknown>;
  return {
    ...value,
    created_at: normalizeTimestamp(value.created_at),
    updated_at: normalizeTimestamp(value.updated_at),
    capabilities: Array.isArray(value.capabilities) ? value.capabilities : [],
    human_gates: Array.isArray(value.human_gates) ? value.human_gates : [],
    allowed_subagent_profile_ids: Array.isArray(value.allowed_subagent_profile_ids)
      ? value.allowed_subagent_profile_ids
      : [],
  };
}

function normalizeEnvironmentProfile(profile: unknown) {
  const value = profile as Record<string, unknown>;
  return {
    ...value,
    created_at: normalizeTimestamp(value.created_at),
    updated_at: normalizeTimestamp(value.updated_at),
    repo_mounts: Array.isArray(value.repo_mounts) ? value.repo_mounts : [],
    package_set: Array.isArray(value.package_set) ? value.package_set : [],
    secret_bindings: Array.isArray(value.secret_bindings) ? value.secret_bindings : [],
    startup_pack_ids: Array.isArray(value.startup_pack_ids) ? value.startup_pack_ids : [],
  };
}

function normalizeRuntimeEvent(event: unknown) {
  const value = event as Record<string, unknown>;
  return {
    ...value,
    created_at: normalizeTimestamp(value.created_at),
  };
}

function normalizeCheckpoint(checkpoint: unknown) {
  const value = checkpoint as Record<string, unknown>;
  return {
    ...value,
    created_at: normalizeTimestamp(value.created_at),
  };
}

function normalizeCompaction(compaction: unknown) {
  const value = compaction as Record<string, unknown>;
  return {
    ...value,
    created_at: normalizeTimestamp(value.created_at),
    updated_at: normalizeTimestamp(value.updated_at),
  };
}

function normalizeStartupPack(pack: unknown) {
  const value = pack as Record<string, unknown>;
  return {
    id: value.id,
    name: value.name,
    description: typeof value.description === "string" ? value.description : "",
    repoDocPaths: Array.isArray(value.repo_doc_paths) ? value.repo_doc_paths : [],
    knowledgePagePaths:
      Array.isArray(value.knowledge_page_paths) ? value.knowledge_page_paths : [],
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
  task_kind: z.enum(["operator_thread", "support_triage", "external_harness_thread"]),
  session_key: z.string().min(1).max(200).optional(),
  agent_profile_id: z.string().min(1).max(200).nullable().optional(),
  environment_profile_id: z.string().min(1).max(200).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const sessionMessageSchema = z.object({
  task_kind: z.enum(["operator_thread", "external_harness_thread", "support_triage"]),
  session_key: z.string().min(1).max(200).optional(),
  input: z.record(z.unknown()),
  tool_policy: z.record(z.unknown()).optional(),
  approval_policy: z.record(z.unknown()).optional(),
  session_policy: z.record(z.unknown()).optional(),
  outcome_contract: z.record(z.unknown()).optional(),
  resume_from_run_id: z.string().optional(),
  parent_run_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const agentProfileSchema = z.object({
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  description: z.string().max(1200).optional(),
  task_kind: z.enum(["operator_thread", "support_triage", "external_harness_thread"]),
  default_provider: z.string().max(120).optional(),
  default_runtime: z.string().max(120).optional(),
  default_model: z.string().max(200).nullable().optional(),
  lane: z.string().max(120).nullable().optional(),
  default_environment_profile_id: z.string().max(200).nullable().optional(),
  startup_context: z.record(z.unknown()).optional(),
  tool_policy: z.record(z.unknown()).optional(),
  approval_policy: z.record(z.unknown()).optional(),
  session_policy: z.record(z.unknown()).optional(),
  outcome_contract: z.record(z.unknown()).optional(),
  capabilities: z.array(z.string().min(1).max(240)).optional(),
  human_gates: z.array(z.string().min(1).max(240)).optional(),
  allowed_subagent_profile_ids: z.array(z.string().min(1).max(200)).optional(),
});

const environmentProfileSchema = z.object({
  key: z.string().min(1).max(160),
  name: z.string().min(1).max(200),
  description: z.string().max(1200).optional(),
  lane: z.string().min(1).max(120),
  repo_mounts: z.array(z.string().min(1).max(400)).optional(),
  package_set: z.array(z.string().min(1).max(200)).optional(),
  secret_bindings: z.array(z.string().min(1).max(200)).optional(),
  startup_pack_ids: z.array(z.string().min(1).max(200)).optional(),
  network_rules: z.record(z.unknown()).optional(),
  runtime_constraints: z.record(z.unknown()).optional(),
  tool_policy: z.record(z.unknown()).optional(),
  approval_policy: z.record(z.unknown()).optional(),
  session_policy: z.record(z.unknown()).optional(),
});

const sessionControlSchema = z.object({
  message: z.string().min(1).max(8000).optional(),
  reason: z.string().min(1).max(1000).optional(),
  checkpoint_id: z.string().min(1).max(200).optional(),
  phase: z.enum(["investigation", "implementation", "review_qa"]).optional(),
});

const delegationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(8000),
  agent_profile_id: z.string().min(1).max(200),
  environment_profile_id: z.string().min(1).max(200).nullable().optional(),
  parent_session_id: z.string().min(1).max(200).nullable().optional(),
  parent_run_id: z.string().min(1).max(200).nullable().optional(),
});

const subagentBatchSchema = z.object({
  parent_run_id: z.string().min(1).max(200).nullable().optional(),
  workers: z.array(
    z.object({
      title: z.string().min(1).max(200),
      message: z.string().min(1).max(8000),
      agent_profile_id: z.string().min(1).max(200),
      environment_profile_id: z.string().min(1).max(200).nullable().optional(),
    }),
  ).min(1).max(6),
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
  knowledgePagePaths: z.array(z.string().min(1).max(500)).optional(),
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

const humanBlockerPacketSchema = z.object({
  blockerId: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(240),
  summary: z.string().min(1).max(2000),
  recommendedAnswer: z.string().min(1).max(2000),
  exactResponseNeeded: z.string().min(1).max(2000),
  whyBlocked: z.string().min(1).max(3000),
  alternatives: z.array(z.string().min(1).max(2000)).min(1).max(5),
  risk: z.string().min(1).max(2000),
  executionOwner: z.string().min(1).max(120),
  immediateNextAction: z.string().min(1).max(2000),
  deadline: z.string().min(1).max(240),
  evidence: z.array(z.string().min(1).max(2000)).min(1).max(12),
  nonScope: z.string().min(1).max(2000),
});

const dispatchHumanBlockerSchema = z.object({
  packet: humanBlockerPacketSchema,
  blocker_kind: z.enum(["technical", "ops_commercial"]),
  email_target: z.string().email().optional(),
  mirror_to_slack: z.boolean().optional(),
  slack_webhook_url: z.string().url().optional(),
  routing_owner: z.string().max(120).optional(),
  execution_owner: z.string().max(120).optional(),
  escalation_owner: z.string().max(120).optional(),
  report_paths: z.array(z.string().min(1).max(500)).optional(),
  paperclip_issue_id: z.string().max(200).optional(),
  ops_work_item_id: z.string().max(200).optional(),
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

router.get(
  "/sessions/:id/events",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const limit =
        typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
      const events = await listRuntimeEventsForSession(
        req.params.id,
        Number.isFinite(limit) ? limit : undefined,
      );
      return res.json({
        ok: true,
        events: events.map((event) => normalizeRuntimeEvent(event)),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to list runtime events";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.get(
  "/sessions/:id/checkpoints",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const limit =
        typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
      const checkpoints = await listCheckpointsForSession(
        req.params.id,
        Number.isFinite(limit) ? limit : undefined,
      );
      return res.json({
        ok: true,
        checkpoints: checkpoints.map((checkpoint) => normalizeCheckpoint(checkpoint)),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to list checkpoints";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.get(
  "/sessions/:id/compactions",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const limit =
        typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
      const compactions = await listCompactionsForSession(
        req.params.id,
        Number.isFinite(limit) ? limit : undefined,
      );
      return res.json({
        ok: true,
        compactions: compactions.map((compaction) => normalizeCompaction(compaction)),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to list compactions";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.get("/context/options", requireAdminRole, async (_req: Request, res: Response) => {
  try {
    const [options, profiles, environments] = await Promise.all([
      getStartupContextOptions(),
      listAgentProfiles(),
      listEnvironmentProfiles(),
    ]);
    return res.json({
      ok: true,
      ...options,
      profiles: profiles.map((profile) => normalizeAgentProfile(profile)),
      environments: environments.map((environment) => normalizeEnvironmentProfile(environment)),
    });
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

router.get("/profiles", requireAdminRole, async (_req: Request, res: Response) => {
  try {
    const profiles = await listAgentProfiles();
    return res.json({
      ok: true,
      profiles: profiles.map((profile) => normalizeAgentProfile(profile)),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list agent profiles";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.get("/profiles/:id", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const profile = await getAgentProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({ ok: false, error: "Agent profile not found" });
    }
    return res.json({ ok: true, profile: normalizeAgentProfile(profile) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load agent profile";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.post("/profiles", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = agentProfileSchema.parse(req.body ?? {});
    const profile = await createAgentProfile(payload as any);
    return res.status(201).json({ ok: true, profile: normalizeAgentProfile(profile) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create agent profile";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.patch("/profiles/:id", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = agentProfileSchema.partial().parse(req.body ?? {});
    const profile = await updateAgentProfile(req.params.id, payload as any);
    if (!profile) {
      return res.status(404).json({ ok: false, error: "Agent profile not found or not editable" });
    }
    return res.json({ ok: true, profile: normalizeAgentProfile(profile) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update agent profile";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.get("/environments", requireAdminRole, async (_req: Request, res: Response) => {
  try {
    const environments = await listEnvironmentProfiles();
    return res.json({
      ok: true,
      environments: environments.map((profile) => normalizeEnvironmentProfile(profile)),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to list environment profiles";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.get("/environments/:id", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const environment = await getEnvironmentProfile(req.params.id);
    if (!environment) {
      return res.status(404).json({ ok: false, error: "Environment profile not found" });
    }
    return res.json({ ok: true, environment: normalizeEnvironmentProfile(environment) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load environment profile";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.post("/environments", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = environmentProfileSchema.parse(req.body ?? {});
    const environment = await createEnvironmentProfile(payload as any);
    return res.status(201).json({
      ok: true,
      environment: normalizeEnvironmentProfile(environment),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create environment profile";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.patch("/environments/:id", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = environmentProfileSchema.partial().parse(req.body ?? {});
    const environment = await updateEnvironmentProfile(req.params.id, payload as any);
    if (!environment) {
      return res.status(404).json({ ok: false, error: "Environment profile not found or not editable" });
    }
    return res.json({
      ok: true,
      environment: normalizeEnvironmentProfile(environment),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update environment profile";
    return res.status(400).json({ ok: false, error: message });
  }
});

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
      knowledge_page_paths: payload.knowledgePagePaths,
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
      knowledge_page_paths: payload.knowledgePagePaths,
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

router.post("/human-blockers", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = dispatchHumanBlockerSchema.parse(req.body ?? {});
    const actor = await resolveAccessContext(res);
    const result = await dispatchHumanBlocker({
      ...payload,
      actor: {
        uid: actor.uid,
        email: actor.email,
      },
    });
    return res.status(201).json({ ok: true, result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to dispatch human blocker";
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
          outcome_contract: payload.outcome_contract,
          resume_from_run_id: payload.resume_from_run_id,
          parent_run_id: payload.parent_run_id,
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
  "/sessions/:id/control/start",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const payload = sessionControlSchema.parse(req.body ?? {});
      const result = await startAgentSessionRun({
        sessionId: req.params.id,
        message: payload.message || "Start the bounded task.",
      });
      return res.status(result.queued ? 202 : 200).json({ ok: true, ...result });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to start agent session";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.post(
  "/sessions/:id/control/interrupt",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const payload = sessionControlSchema.parse(req.body ?? {});
      const result = await interruptAgentSession({
        sessionId: req.params.id,
        reason: payload.reason,
      });
      return res.json({ ok: true, ...result });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to interrupt session";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.post(
  "/sessions/:id/control/steer",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const payload = sessionControlSchema.parse(req.body ?? {});
      if (!payload.message) {
        return res.status(400).json({ ok: false, error: "Steer message is required" });
      }
      const result = await steerAgentSession({
        sessionId: req.params.id,
        message: payload.message,
      });
      return res.status(result.queued ? 202 : 200).json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to steer session";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.post(
  "/sessions/:id/control/resume",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const payload = sessionControlSchema.parse(req.body ?? {});
      const result = await resumeAgentSession({
        sessionId: req.params.id,
        checkpointId: payload.checkpoint_id,
      });
      return res.status(result.queued ? 202 : 200).json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resume session";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.post(
  "/sessions/:id/control/compact",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const payload = sessionControlSchema.parse(req.body ?? {});
      const result = await compactAgentSession({
        sessionId: req.params.id,
        phase: payload.phase || "investigation",
        reason: payload.reason,
      });
      return res.status(result.dispatch.queued ? 202 : 200).json({
        ok: true,
        session: normalizeSession(result.session),
        handoffPrompt: result.handoffPrompt,
        dispatch: result.dispatch,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to compact session";
      return res.status(400).json({ ok: false, error: message });
    }
  },
);

router.post(
  "/sessions/:id/control/cancel",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const payload = sessionControlSchema.parse(req.body ?? {});
      const session = await cancelAgentSession({
        sessionId: req.params.id,
        reason: payload.reason,
      });
      return res.json({ ok: true, session: normalizeSession(session) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to cancel session";
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

router.post("/delegations", requireAdminRole, async (req: Request, res: Response) => {
  try {
    const payload = delegationSchema.parse(req.body ?? {});
    const result = await delegateManagedAgentTask({
      title: payload.title,
      message: payload.message,
      agentProfileId: payload.agent_profile_id,
      environmentProfileId: payload.environment_profile_id || null,
      parentSessionId: payload.parent_session_id || null,
      parentRunId: payload.parent_run_id || null,
    });

    return res.status(result.dispatch.queued ? 202 : 201).json({
      ok: true,
      session: normalizeSession(result.session),
      dispatch: result.dispatch,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delegate managed task";
    return res.status(400).json({ ok: false, error: message });
  }
});

router.post(
  "/sessions/:id/subagents",
  requireAdminRole,
  async (req: Request, res: Response) => {
    try {
      const payload = subagentBatchSchema.parse(req.body ?? {});
      const results = await spawnSessionSubagents({
        parentSessionId: req.params.id,
        parentRunId: payload.parent_run_id || null,
        workers: payload.workers.map((worker) => ({
          title: worker.title,
          message: worker.message,
          agentProfileId: worker.agent_profile_id,
          environmentProfileId: worker.environment_profile_id || null,
        })),
      });

      return res.status(201).json({
        ok: true,
        sessions: results.map((result) => normalizeSession(result.session)),
        dispatches: results.map((result) => result.dispatch),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to spawn subagents";
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
