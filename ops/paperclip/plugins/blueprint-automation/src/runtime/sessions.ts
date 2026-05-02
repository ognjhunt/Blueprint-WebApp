import { randomUUID } from "node:crypto";
import type { PluginContext } from "@paperclipai/plugin-sdk";
import { loadEnvironmentProfile } from "./environment-profiles.js";
import {
  checkpointStateKey,
  readRuntimeSessionIndex,
  readRuntimeState,
  sessionStateKey,
  writeRuntimeSessionIndex,
  writeRuntimeState,
} from "./state.js";
import { appendRuntimeTraceEvent, readRuntimeTrace } from "./tracing.js";
import {
  isTerminalRuntimeSessionStatus,
  nowIso,
  type RuntimeCheckpoint,
  type RuntimeSession,
  type RuntimeSessionStatus,
} from "./types.js";
import { buildBlueprintRuntimeMetadata } from "./versioning.js";
import { createVaultGrant } from "./vault.js";

function pushLimited(list: string[], value: string, limit = 50) {
  if (!list.includes(value)) {
    list.unshift(value);
  }
  if (list.length > limit) {
    list.splice(limit);
  }
}

function upsertIndexedList(target: Record<string, string[]>, key: string | null | undefined, value: string) {
  if (!key) {
    return;
  }
  const next = target[key] ?? [];
  if (!next.includes(value)) {
    next.push(value);
  }
  target[key] = next;
}

function issueAgentIndexKey(issueId: string | null, agentKey: string) {
  return issueId ? `${issueId}:${agentKey}` : "";
}

export async function getRuntimeSession(
  ctx: PluginContext,
  companyId: string,
  sessionId: string,
) {
  return await readRuntimeState<RuntimeSession>(ctx, companyId, sessionStateKey(sessionId));
}

async function persistRuntimeSession(
  ctx: PluginContext,
  companyId: string,
  session: RuntimeSession,
) {
  await writeRuntimeState(ctx, companyId, sessionStateKey(session.id), session);
}

export async function ensureRuntimeSession(
  ctx: PluginContext,
  companyId: string,
  input: {
    issueId?: string | null;
    parentSessionId?: string | null;
    agentKey: string;
    requestedChannel?: string | null;
    environmentProfileKey?: string | null;
    status?: RuntimeSessionStatus;
    wakeReason?: string | null;
    summary?: string | null;
    createdBy?: string;
  },
) {
  const index = await readRuntimeSessionIndex(ctx, companyId);
  const issueKey = issueAgentIndexKey(input.issueId ?? null, input.agentKey);
  const activeSessionId = issueKey ? index.activeByIssueAgent[issueKey] : null;
  const activeSession = activeSessionId ? await getRuntimeSession(ctx, companyId, activeSessionId) : null;
  const requestedStatus = input.status ?? "queued";

  if (activeSession && !isTerminalRuntimeSessionStatus(activeSession.status)) {
    if (activeSession.status !== requestedStatus || input.wakeReason || input.summary) {
      return await updateRuntimeSession(ctx, companyId, activeSession.id, {
        status: requestedStatus,
        wakeReason: input.wakeReason ?? activeSession.wakeReason,
        summary: input.summary ?? activeSession.summary,
      });
    }
    return activeSession;
  }

  const runtimeMetadata = buildBlueprintRuntimeMetadata(input.agentKey, input.requestedChannel ?? undefined);
  const environmentProfileKey =
    input.environmentProfileKey
    ?? runtimeMetadata?.version.environment_profile
    ?? runtimeMetadata?.manifest.default_environment_profile
    ?? "engineering_impl_default";
  const environmentProfile = loadEnvironmentProfile(environmentProfileKey);
  const vaultProfile = environmentProfile?.vault;
  const sessionId = randomUUID();
  const session: RuntimeSession = {
    id: sessionId,
    issueId: input.issueId ?? null,
    parentSessionId: input.parentSessionId ?? null,
    rootSessionId: input.parentSessionId ?? sessionId,
    agentKey: input.agentKey,
    agentVersionRef: runtimeMetadata?.agentVersionRef ?? "unversioned",
    channelRef: runtimeMetadata?.channelRef ?? null,
    environmentProfileKey,
    status: requestedStatus,
    startedAt: requestedStatus === "queued" ? null : nowIso(),
    endedAt: null,
    wakeReason: input.wakeReason ?? null,
    summary: input.summary ?? null,
    lastTraceEventAt: null,
    latestCheckpointId: null,
    outputArtifactPaths: [],
    proofLinks: [],
    memoryBindings: [
      ...(runtimeMetadata?.manifest.memory_bindings ?? []),
      ...(runtimeMetadata?.version.memory_bindings ?? []),
      ...(environmentProfile?.memory?.bind ?? []),
    ].filter((value, index, all) => value && all.indexOf(value) === index),
    vaultGrantIds: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if ((vaultProfile?.allowed_refs ?? []).length > 0) {
    const grant = await createVaultGrant(ctx, companyId, {
      scope: vaultProfile?.default_scope ?? "session",
      scopeRef: session.id,
      sessionId: session.id,
      agentKey: input.agentKey,
      secretRefs: vaultProfile?.allowed_refs ?? [],
      allowedTools: vaultProfile?.allowed_tools ?? [],
      expiresAt: null,
      createdBy: input.createdBy ?? "runtime-session-bootstrap",
    });
    session.vaultGrantIds.push(grant.id);
  }

  await persistRuntimeSession(ctx, companyId, session);
  if (issueKey) {
    index.activeByIssueAgent[issueKey] = session.id;
  }
  if (session.issueId) {
    index.latestByIssue[session.issueId] = session.id;
    upsertIndexedList(index.sessionIdsByIssue, session.issueId, session.id);
  }
  index.latestByAgent[session.agentKey] = session.id;
  upsertIndexedList(index.sessionIdsByAgent, session.agentKey, session.id);
  if (session.parentSessionId) {
    index.latestByParentSession[session.parentSessionId] = session.id;
    upsertIndexedList(index.sessionIdsByParent, session.parentSessionId, session.id);
  }
  pushLimited(index.recentSessionIds, session.id);
  await writeRuntimeSessionIndex(ctx, companyId, index);
  await appendRuntimeTraceEvent(ctx, companyId, session.id, {
    type: "session.started",
    actor: "runtime",
    summary: `Session started for ${session.agentKey}.`,
    detail: {
      issueId: session.issueId,
      agentVersionRef: session.agentVersionRef,
      channelRef: session.channelRef,
      environmentProfileKey: session.environmentProfileKey,
    },
  });
  return await updateRuntimeSession(ctx, companyId, session.id, {
    lastTraceEventAt: nowIso(),
  });
}

export async function updateRuntimeSession(
  ctx: PluginContext,
  companyId: string,
  sessionId: string,
  patch: Partial<RuntimeSession>,
) {
  const existing = await getRuntimeSession(ctx, companyId, sessionId);
  if (!existing) {
    throw new Error(`Runtime session not found: ${sessionId}`);
  }
  const next: RuntimeSession = {
    ...existing,
    ...patch,
    updatedAt: nowIso(),
  };
  await persistRuntimeSession(ctx, companyId, next);
  return next;
}

export async function updateRuntimeSessionStatus(
  ctx: PluginContext,
  companyId: string,
  sessionId: string,
  status: RuntimeSessionStatus,
  summary?: string | null,
) {
  const existing = await getRuntimeSession(ctx, companyId, sessionId);
  if (!existing) {
    throw new Error(`Runtime session not found: ${sessionId}`);
  }
  const endedAt = isTerminalRuntimeSessionStatus(status) ? nowIso() : existing.endedAt;
  const startedAt = existing.startedAt ?? (status === "queued" ? null : nowIso());
  const next = await updateRuntimeSession(ctx, companyId, sessionId, {
    status,
    summary: summary ?? existing.summary,
    startedAt,
    endedAt,
  });
  await appendRuntimeTraceEvent(ctx, companyId, sessionId, {
    type: "session.status_changed",
    actor: "runtime",
    summary: summary ?? `Session moved to ${status}.`,
    detail: { status },
  });
  await updateRuntimeSession(ctx, companyId, sessionId, {
    lastTraceEventAt: nowIso(),
  });
  if (isTerminalRuntimeSessionStatus(status) && next.issueId) {
    const index = await readRuntimeSessionIndex(ctx, companyId);
    delete index.activeByIssueAgent[issueAgentIndexKey(next.issueId, next.agentKey)];
    await writeRuntimeSessionIndex(ctx, companyId, index);
  }
  return next;
}

export async function addRuntimeSessionArtifacts(
  ctx: PluginContext,
  companyId: string,
  sessionId: string,
  input: {
    outputArtifactPaths?: string[];
    proofLinks?: string[];
    summary?: string;
  },
) {
  const existing = await getRuntimeSession(ctx, companyId, sessionId);
  if (!existing) {
    return null;
  }
  const next = await updateRuntimeSession(ctx, companyId, sessionId, {
    outputArtifactPaths: [...new Set([...existing.outputArtifactPaths, ...(input.outputArtifactPaths ?? [])])],
    proofLinks: [...new Set([...existing.proofLinks, ...(input.proofLinks ?? [])])],
    summary: input.summary ?? existing.summary,
  });
  if ((input.outputArtifactPaths ?? []).length > 0 || (input.proofLinks ?? []).length > 0) {
    await appendRuntimeTraceEvent(ctx, companyId, sessionId, {
      type: "artifact.created",
      actor: "runtime",
      summary: input.summary ?? "Runtime session artifacts updated.",
      detail: {
        outputArtifactPaths: input.outputArtifactPaths ?? [],
        proofLinks: input.proofLinks ?? [],
      },
    });
  }
  return next;
}

export async function createRuntimeCheckpoint(
  ctx: PluginContext,
  companyId: string,
  sessionId: string,
  reason: string,
) {
  const session = await getRuntimeSession(ctx, companyId, sessionId);
  if (!session) {
    throw new Error(`Runtime session not found: ${sessionId}`);
  }
  const trace = await readRuntimeTrace(ctx, companyId, sessionId);
  const checkpoint: RuntimeCheckpoint = {
    id: randomUUID(),
    sessionId,
    createdAt: nowIso(),
    reason,
    status: session.status,
    traceLength: trace.length,
    outputArtifactPaths: session.outputArtifactPaths,
    proofLinks: session.proofLinks,
    memoryBindings: session.memoryBindings,
  };
  await writeRuntimeState(ctx, companyId, checkpointStateKey(checkpoint.id), checkpoint);
  await updateRuntimeSession(ctx, companyId, sessionId, {
    latestCheckpointId: checkpoint.id,
  });
  await appendRuntimeTraceEvent(ctx, companyId, sessionId, {
    type: "session.checkpointed",
    actor: "runtime",
    summary: `Checkpoint created: ${reason}`,
    detail: {
      checkpointId: checkpoint.id,
      traceLength: checkpoint.traceLength,
    },
  });
  return checkpoint;
}

export async function getLatestSessionForIssue(
  ctx: PluginContext,
  companyId: string,
  issueId: string,
) {
  const index = await readRuntimeSessionIndex(ctx, companyId);
  const sessionId = index.latestByIssue[issueId];
  return sessionId ? await getRuntimeSession(ctx, companyId, sessionId) : null;
}

export async function listRecentRuntimeSessions(
  ctx: PluginContext,
  companyId: string,
  limit = 10,
) {
  const index = await readRuntimeSessionIndex(ctx, companyId);
  const rows = await Promise.all(index.recentSessionIds.slice(0, limit).map(async (id) => await getRuntimeSession(ctx, companyId, id)));
  return rows.filter((row): row is RuntimeSession => Boolean(row));
}
