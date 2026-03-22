import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { runAcpHarnessTask } from "./adapters/acp-harness";
import { runAnthropicAgentSdkTask } from "./adapters/anthropic-agent-sdk";
import { runOpenAIResponsesTask } from "./adapters/openai-responses";
import {
  cancelActionSession,
  startActionSession,
  waitForActionResult,
} from "../integrations/openclaw/client";
import { attachRequestMeta, logger } from "../logger";
import { resolveStartupContext } from "./knowledge";
import { recordOpsActionLog } from "./ops-action-logs";
import {
  mergeApprovalPolicy,
  mergeSessionPolicy,
  mergeToolPolicy,
  requiresApproval,
} from "./policies";
import { getTaskDefinition } from "./tasks";
import type {
  AgentResult,
  AgentProvider,
  AgentRunStatus,
  AgentTask,
  AgentTaskKind,
  NormalizedAgentTask,
  OpsActionRiskLevel,
  PersistedAgentRun,
  PersistedAgentSession,
  ApprovalPolicy,
} from "./types";

function nowTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function normalizeAgentProvider(provider?: AgentProvider): AgentProvider {
  switch (provider) {
    case "openai_responses":
    case "anthropic_agent_sdk":
    case "acp_harness":
    case "openclaw":
      return provider;
    default:
      return "openai_responses";
  }
}

function defaultModelForProvider(provider: AgentProvider) {
  switch (provider) {
    case "openai_responses":
      return process.env.OPENAI_DEFAULT_MODEL?.trim() || "gpt-5.4";
    case "anthropic_agent_sdk":
      return process.env.ANTHROPIC_DEFAULT_MODEL?.trim() || "claude-sonnet-4-5";
    case "acp_harness":
      return process.env.ACP_DEFAULT_HARNESS?.trim() || "codex";
    case "openclaw":
      return process.env.OPENCLAW_DEFAULT_MODEL?.trim() || "openai/gpt-5.4";
    default:
      return "gpt-5.4";
  }
}

function normalizeTask<TInput, TOutput>(
  task: AgentTask<TInput>,
): NormalizedAgentTask<TInput, TOutput> {
  const definition = getTaskDefinition<TInput, TOutput>(task.kind);
  const provider = normalizeAgentProvider(task.provider || definition.default_provider);
  const runtime = task.runtime || definition.default_runtime || provider;
  const model =
    task.model ||
    definition.model_by_provider?.[provider] ||
    defaultModelForProvider(provider);

  return {
    ...task,
    provider,
    runtime,
    model,
    definition,
    tool_policy: mergeToolPolicy(definition.tool_policy, task.tool_policy),
    approval_policy: mergeApprovalPolicy(
      definition.approval_policy,
      task.approval_policy,
    ),
    session_policy: mergeSessionPolicy(
      definition.session_policy,
      task.session_policy,
    ),
  };
}

function resultStatus(result: AgentResult) {
  return result.status;
}

function isAutonomousAutomationTask(kind: AgentTaskKind) {
  return [
    "waitlist_triage",
    "inbound_qualification",
    "post_signup_scheduling",
    "support_triage",
    "payout_exception_triage",
    "preview_diagnosis",
  ].includes(kind);
}

function shouldRequireHumanReview(
  task: {
    approval_policy: ApprovalPolicy;
  },
  params: {
    status: AgentRunStatus;
    output?: unknown;
  },
) {
  const output =
    params.output && typeof params.output === "object"
      ? (params.output as Record<string, unknown>)
      : null;
  const outputRequiresHumanReview =
    output && typeof output.requires_human_review === "boolean"
      ? output.requires_human_review
      : false;

  if (task.approval_policy.require_human_approval) {
    return true;
  }

  if (task.approval_policy.sensitive_actions.length > 0) {
    return true;
  }

  if (outputRequiresHumanReview) {
    return true;
  }

  return params.status !== "completed";
}

function openClawModeForTask(task: NormalizedAgentTask<unknown, unknown>) {
  if (
    task.kind === "operator_thread" ||
    task.kind === "external_harness_thread" ||
    task.session_policy.lane === "session"
  ) {
    return "interactive" as const;
  }

  return "sync" as const;
}

function allowedToolsForTask(task: NormalizedAgentTask<unknown, unknown>) {
  const tools = new Set<string>();
  if (task.tool_policy.mode !== "none") {
    tools.add(task.tool_policy.mode);
  }

  for (const action of task.tool_policy.allowed_actions || []) {
    tools.add(action);
  }

  return [...tools];
}

function forbiddenActionsForTask(task: NormalizedAgentTask<unknown, unknown>) {
  const forbidden = new Set<string>();

  if (!task.tool_policy.browser_fallback_allowed) {
    forbidden.add("browser_fallback");
  }
  if (task.tool_policy.isolated_runtime_required) {
    forbidden.add("shared_runtime");
  }
  if (task.approval_policy.sensitive_actions.includes("destructive")) {
    forbidden.add("destructive_without_blueprint_gate");
  }
  if (task.approval_policy.sensitive_actions.includes("financial")) {
    forbidden.add("financial_without_blueprint_gate");
  }

  return [...forbidden];
}

function riskLevelForTask(task: NormalizedAgentTask<unknown, unknown>): OpsActionRiskLevel {
  const sensitiveActions = task.approval_policy.sensitive_actions || [];
  if (
    sensitiveActions.includes("financial") ||
    sensitiveActions.includes("payout") ||
    sensitiveActions.includes("rights") ||
    sensitiveActions.includes("licensing") ||
    sensitiveActions.includes("compliance")
  ) {
    return "critical";
  }

  if (
    sensitiveActions.includes("destructive") ||
    sensitiveActions.includes("preview_release")
  ) {
    return "high";
  }

  if (
    task.tool_policy.mode === "browser" ||
    task.tool_policy.mode === "external_harness" ||
    task.tool_policy.mode === "mixed"
  ) {
    return "medium";
  }

  return "low";
}

async function logRunEvent(
  task: NormalizedAgentTask<unknown, unknown>,
  params: {
    runId: string;
    sessionId?: string | null;
    actionKey: string;
    status: "queued" | "started" | "completed" | "failed" | "pending_approval" | "cancelled" | "info";
    summary: string;
    requiresApproval?: boolean;
    latencyMs?: number;
    metadata?: Record<string, unknown>;
  },
) {
  await recordOpsActionLog({
    session_id: params.sessionId || task.session_id || null,
    run_id: params.runId,
    session_key: task.session_key || null,
    action_key: params.actionKey,
    status: params.status,
    summary: params.summary,
    provider: task.provider,
    runtime: task.runtime,
    task_kind: task.kind,
    risk_level: riskLevelForTask(task),
    reversible: !task.approval_policy.sensitive_actions.includes("destructive"),
    requires_approval: params.requiresApproval ?? false,
    latency_ms: params.latencyMs ?? null,
    metadata: params.metadata || {},
  });
}

async function executeTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
): Promise<AgentResult<TOutput>> {
  if (task.provider === "openai_responses") {
    return runOpenAIResponsesTask(task);
  }

  if (task.provider === "anthropic_agent_sdk") {
    return runAnthropicAgentSdkTask(task);
  }

  if (task.provider === "acp_harness") {
    return runAcpHarnessTask(task);
  }

  const taskForPolicy = task as unknown as NormalizedAgentTask<unknown, unknown>;
  const inputRecord =
    task.input && typeof task.input === "object"
      ? (task.input as Record<string, unknown>)
      : {};
  const startupContext =
    inputRecord.startup_context &&
    typeof inputRecord.startup_context === "object"
      ? (inputRecord.startup_context as Record<string, unknown>)
      : null;
  const { startup_context: _ignoredStartupContext, ...inputs } = inputRecord;

  try {
    const initialResponse = await startActionSession({
      request_id: crypto.randomUUID(),
      session_key: task.session_key || `run:${crypto.randomUUID()}`,
      task_type: task.kind,
      mode: openClawModeForTask(taskForPolicy),
      inputs,
      startup_context: startupContext,
      policy: {
        risk_level: riskLevelForTask(taskForPolicy),
        requires_approval: task.approval_policy.require_human_approval,
        allowed_domains: task.tool_policy.allowed_domains || [],
        allowed_tools: allowedToolsForTask(taskForPolicy),
        allowed_skill_ids: [],
        forbidden_actions: forbiddenActionsForTask(taskForPolicy),
        artifact_retention_policy: {
          retain_logs: true,
          retain_artifacts: true,
          retention_days: 30,
        },
      },
      artifacts_config: {
        artifact_targets: ["text_summary", "json_result", "skill_log"],
        include_logs: true,
        include_screenshots:
          task.tool_policy.mode === "browser" || task.tool_policy.mode === "mixed",
      },
      wait_timeout_ms: Number(process.env.OPENCLAW_WAIT_TIMEOUT_MS ?? 60_000),
      model: task.model,
      prompt: task.definition.build_prompt(task.input),
    });

    const finalResponse =
      initialResponse.accepted &&
      initialResponse.openclaw_run_id &&
      initialResponse.status !== "completed" &&
      initialResponse.status !== "failed"
        ? await waitForActionResult({
            openclaw_run_id: initialResponse.openclaw_run_id,
            wait_timeout_ms: Number(process.env.OPENCLAW_WAIT_TIMEOUT_MS ?? 60_000),
          })
        : initialResponse;

    const finalStatus =
      finalResponse.status === "failed"
        ? "failed"
        : finalResponse.status === "completed"
          ? "completed"
          : "failed";

    return {
      status: finalStatus,
      provider: "openclaw",
      runtime: "openclaw",
      model: task.model,
      tool_mode: task.tool_policy.mode,
      output:
        finalStatus === "completed"
          ? task.definition.output_schema.parse(finalResponse.result)
          : undefined,
      raw_output_text: finalResponse.raw_output_text,
      error: finalResponse.error || null,
      requires_human_review: shouldRequireHumanReview(task, {
        status: finalStatus,
        output: finalStatus === "completed" ? finalResponse.result : undefined,
      }),
      requires_approval: false,
      openclaw_session_id: finalResponse.openclaw_session_id || null,
      openclaw_run_id: finalResponse.openclaw_run_id || null,
      artifacts: finalResponse.artifacts || null,
      logs: finalResponse.logs || null,
    };
  } catch (error) {
    return {
      status: "failed",
      provider: "openclaw",
      runtime: "openclaw",
      model: task.model,
      tool_mode: task.tool_policy.mode,
      error: error instanceof Error ? error.message : "OpenClaw execution failed",
      requires_human_review: shouldRequireHumanReview(task, {
        status: "failed",
      }),
      requires_approval: false,
    };
  }
}

async function saveSession(session: PersistedAgentSession) {
  if (!db) {
    return;
  }
  await db.collection("agentSessions").doc(session.id).set(session, { merge: true });
}

async function saveRun(run: PersistedAgentRun) {
  if (!db) {
    return;
  }
  await db.collection("agentRuns").doc(run.id).set(run, { merge: true });
}

async function getRun(runId: string) {
  if (!db) {
    return null;
  }
  const doc = await db.collection("agentRuns").doc(runId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as PersistedAgentRun;
}

async function getSession(sessionId: string) {
  if (!db) {
    return null;
  }
  const doc = await db.collection("agentSessions").doc(sessionId).get();
  if (!doc.exists) {
    return null;
  }
  return doc.data() as PersistedAgentSession;
}

async function listSessions(limit = 50) {
  if (!db) {
    return [];
  }
  const snapshot = await db
    .collection("agentSessions")
    .orderBy("updated_at", "desc")
    .limit(Math.max(1, Math.min(limit, 100)))
    .get();
  return snapshot.docs.map((doc) => doc.data() as PersistedAgentSession);
}

async function listRunsForSession(sessionId: string, limit = 100) {
  if (!db) {
    return [];
  }
  const snapshot = await db
    .collection("agentRuns")
    .where("session_id", "==", sessionId)
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(limit, 200)))
    .get();
  return snapshot.docs.map((doc) => doc.data() as PersistedAgentRun);
}

async function findActiveSessionRun(sessionKey: string) {
  if (!db) {
    return null;
  }
  const snapshot = await db
    .collection("agentRuns")
    .where("session_key", "==", sessionKey)
    .where("status", "in", ["queued", "running", "pending_approval"])
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].data() as PersistedAgentRun;
}

async function markRunStatus(
  runId: string,
  status: AgentRunStatus,
  updates?: Record<string, unknown>,
) {
  if (!db) {
    return;
  }

  await db.collection("agentRuns").doc(runId).set(
    {
      status,
      updated_at: nowTimestamp(),
      ...(status === "running" ? { started_at: nowTimestamp() } : {}),
      ...(status === "completed" ? { completed_at: nowTimestamp() } : {}),
      ...(status === "cancelled" ? { cancelled_at: nowTimestamp() } : {}),
      ...updates,
    },
    { merge: true },
  );
}

async function dispatchQueuedRuns(sessionKey: string) {
  if (!db) {
    return null;
  }

  const activeRun = await findActiveSessionRun(sessionKey);
  if (activeRun && (activeRun.status === "running" || activeRun.status === "pending_approval")) {
    return activeRun;
  }

  const queuedSnapshot = await db
    .collection("agentRuns")
    .where("session_key", "==", sessionKey)
    .where("status", "==", "queued")
    .orderBy("created_at", "asc")
    .limit(1)
    .get();

  if (queuedSnapshot.empty) {
    return null;
  }

  const runRecord = queuedSnapshot.docs[0].data() as PersistedAgentRun;
  await markRunStatus(runRecord.id, "running");

  const result = await runAgentTask(runRecord.input as AgentTask, {
    runId: runRecord.id,
    sessionId: runRecord.session_id || null,
    dispatchQueuedOnFinish: false,
  });

  if (result.status !== "pending_approval") {
    await dispatchQueuedRuns(sessionKey);
  }

  return result;
}

export async function runAgentTask<TInput = unknown, TOutput = unknown>(
  task: AgentTask<TInput>,
  options?: {
    runId?: string;
    sessionId?: string | null;
    dispatchQueuedOnFinish?: boolean;
  },
): Promise<AgentResult<TOutput>> {
  const normalizedTask = normalizeTask<TInput, TOutput>(task);
  const normalizedTaskForLogs = normalizedTask as unknown as NormalizedAgentTask<
    unknown,
    unknown
  >;
  const requestMeta = attachRequestMeta({
    route: "agent-runtime",
    kind: normalizedTask.kind,
    provider: normalizedTask.provider,
    sessionKey: normalizedTask.session_key || undefined,
  });
  const runId = options?.runId || crypto.randomUUID();
  const approval = requiresApproval(task, normalizedTask.approval_policy);

  if (approval.required) {
    const pendingResult: AgentResult<TOutput> = {
      status: "pending_approval",
      provider: normalizedTask.provider,
      runtime: normalizedTask.runtime,
      model: normalizedTask.model,
      tool_mode: normalizedTask.tool_policy.mode,
      error: null,
      requires_human_review: true,
      requires_approval: true,
      approval_reason: approval.reason,
    };

    if (db) {
      await saveRun({
        id: runId,
        session_id: options?.sessionId || normalizedTask.session_id || null,
        session_key: normalizedTask.session_key || null,
        task_kind: normalizedTask.kind,
        provider: normalizedTask.provider,
        runtime: normalizedTask.runtime,
        model: normalizedTask.model,
        status: "pending_approval",
        dispatch_mode: normalizedTask.session_policy.dispatch_mode,
        input: task,
        approval_reason: approval.reason,
        requires_human_review: true,
        tool_policy: normalizedTask.tool_policy,
        approval_policy: normalizedTask.approval_policy,
        metadata: normalizedTask.metadata,
        resume_from_run_id: normalizedTask.resume_from_run_id || null,
        created_at: nowTimestamp(),
        updated_at: nowTimestamp(),
      });
    }

    await logRunEvent(normalizedTaskForLogs, {
      runId,
      sessionId: options?.sessionId || normalizedTask.session_id || null,
      actionKey: "agent.run.approval_required",
      status: "pending_approval",
      summary: approval.reason || "Run requires approval before execution",
      requiresApproval: true,
      metadata: {
        sensitive_actions: normalizedTask.approval_policy.sensitive_actions,
      },
    });

    return pendingResult;
  }

  if (db && !options?.runId) {
    await saveRun({
      id: runId,
      session_id: options?.sessionId || normalizedTask.session_id || null,
      session_key: normalizedTask.session_key || null,
      task_kind: normalizedTask.kind,
      provider: normalizedTask.provider,
      runtime: normalizedTask.runtime,
      model: normalizedTask.model,
      status: "running",
      dispatch_mode: normalizedTask.session_policy.dispatch_mode,
      input: task,
      requires_human_review: shouldRequireHumanReview(normalizedTaskForLogs, {
        status: "running",
      }),
      tool_policy: normalizedTask.tool_policy,
      approval_policy: normalizedTask.approval_policy,
      metadata: normalizedTask.metadata,
      resume_from_run_id: normalizedTask.resume_from_run_id || null,
      created_at: nowTimestamp(),
      updated_at: nowTimestamp(),
      started_at: nowTimestamp(),
    });
  } else if (db && options?.runId) {
    await markRunStatus(options.runId, "running");
  }

  await logRunEvent(normalizedTaskForLogs, {
    runId,
    sessionId: options?.sessionId || normalizedTask.session_id || null,
    actionKey: "agent.run.execute",
    status: "started",
    summary: `Executing ${normalizedTask.kind}`,
    metadata: {
      dispatch_mode: normalizedTask.session_policy.dispatch_mode,
      tool_mode: normalizedTask.tool_policy.mode,
    },
  });

  try {
    const startedAtMs = Date.now();
    const result = await executeTask(normalizedTask);
    const status = resultStatus(result);
    const latencyMs = Date.now() - startedAtMs;

    if (db) {
      await markRunStatus(runId, status, {
        output: result.output,
        raw_output_text: result.raw_output_text || null,
        artifacts: result.artifacts || null,
        logs: result.logs || null,
        error: result.error || null,
        approval_reason: result.approval_reason || null,
        requires_human_review: result.requires_human_review,
        openclaw_session_id: result.openclaw_session_id || null,
        openclaw_run_id: result.openclaw_run_id || null,
      });
    }

    await logRunEvent(normalizedTaskForLogs, {
      runId,
      sessionId: options?.sessionId || normalizedTask.session_id || null,
      actionKey: "agent.run.execute",
      status: status === "failed" ? "failed" : status === "pending_approval" ? "pending_approval" : "completed",
      summary:
        status === "completed"
          ? `${normalizedTask.kind} completed`
          : result.error || `${normalizedTask.kind} finished with status ${status}`,
      requiresApproval: result.requires_approval,
      latencyMs,
      metadata: {
        requires_human_review: result.requires_human_review,
      },
    });

    logger.info(
      {
        ...requestMeta,
        runId,
        status,
      },
      "Agent task completed",
    );

    if (
      options?.dispatchQueuedOnFinish !== false &&
      normalizedTask.session_key &&
      status !== "pending_approval"
    ) {
      await dispatchQueuedRuns(normalizedTask.session_key);
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown agent runtime error";

    if (db) {
      await markRunStatus(runId, "failed", {
        error: message,
        requires_human_review: shouldRequireHumanReview(normalizedTaskForLogs, {
          status: "failed",
        }),
      });
    }

    logger.error(
      {
        ...requestMeta,
        runId,
        err: error,
      },
      "Agent task failed",
    );

    await logRunEvent(normalizedTaskForLogs, {
      runId,
      sessionId: options?.sessionId || normalizedTask.session_id || null,
      actionKey: "agent.run.execute",
      status: "failed",
      summary: message,
      metadata: {
        exception: true,
      },
    });

    return {
      status: "failed",
      provider: normalizedTask.provider,
      runtime: normalizedTask.runtime,
      model: normalizedTask.model,
      tool_mode: normalizedTask.tool_policy.mode,
      error: message,
      requires_human_review: shouldRequireHumanReview(normalizedTaskForLogs, {
        status: "failed",
      }),
      requires_approval: false,
    };
  }
}

export async function createAgentSession(params: {
  title: string;
  task_kind: AgentTaskKind;
  provider?: NormalizedAgentTask["provider"];
  runtime?: NormalizedAgentTask["runtime"];
  session_key?: string;
  metadata?: Record<string, unknown>;
}) {
  const sessionId = crypto.randomUUID();
  const provider = normalizeAgentProvider(params.provider);
  const session: PersistedAgentSession = {
    id: sessionId,
    title: params.title,
    task_kind: params.task_kind,
    provider,
    runtime: normalizeAgentProvider(params.runtime || provider),
    status: "idle",
    session_key: params.session_key || `session:${sessionId}`,
    created_at: nowTimestamp(),
    updated_at: nowTimestamp(),
    metadata: params.metadata || {},
  };

  await saveSession(session);
  await recordOpsActionLog({
    session_id: sessionId,
    run_id: null,
    session_key: session.session_key,
    action_key: "agent.session.create",
    status: "completed",
    summary: `Created ${params.task_kind} session`,
    provider: session.provider,
    runtime: session.runtime,
    task_kind: session.task_kind,
    risk_level: "low",
    reversible: true,
    requires_approval: false,
    metadata: {
      title: session.title,
      startup_pack_ids:
        ((params.metadata?.startupContext as Record<string, unknown> | undefined)
          ?.startupPackIds as string[] | undefined) || [],
      document_ids:
        ((params.metadata?.startupContext as Record<string, unknown> | undefined)
          ?.documentIds as string[] | undefined) || [],
    },
  });
  const savedSession = await getSession(sessionId);
  return savedSession || session;
}

export async function sendAgentSessionMessage(params: {
  sessionId: string;
  task: AgentTask;
}) {
  const session = await getSession(params.sessionId);
  if (!session) {
    throw new Error("Agent session not found");
  }

  const startupContext =
    params.task.kind === "operator_thread" ||
    params.task.kind === "external_harness_thread"
      ? await resolveStartupContext(
          session.metadata as Record<string, unknown> | undefined,
          typeof (params.task.input as Record<string, unknown> | undefined)?.message === "string"
            ? String((params.task.input as Record<string, unknown>).message)
            : "",
        )
      : null;

  if (startupContext) {
    await recordOpsActionLog({
      session_id: params.sessionId,
      run_id: null,
      session_key: session.session_key,
      action_key: "agent.startup_context.resolve",
      status: "completed",
      summary: "Resolved startup context for session message",
      provider: session.provider,
      runtime: session.runtime,
      task_kind: params.task.kind,
      risk_level: "low",
      reversible: true,
      requires_approval: false,
      metadata: {
        attached_startup_packs:
          (startupContext as Record<string, unknown>).attached_startup_packs || [],
        repo_doc_count:
          Array.isArray((startupContext as Record<string, unknown>).repo_docs)
            ? ((startupContext as Record<string, unknown>).repo_docs as unknown[]).length
            : 0,
        blueprint_context_count:
          Array.isArray((startupContext as Record<string, unknown>).blueprint_contexts)
            ? ((startupContext as Record<string, unknown>).blueprint_contexts as unknown[]).length
            : 0,
        document_count:
          Array.isArray((startupContext as Record<string, unknown>).attached_documents)
            ? ((startupContext as Record<string, unknown>).attached_documents as unknown[]).length
            : 0,
        external_source_count:
          Array.isArray((startupContext as Record<string, unknown>).external_sources)
            ? ((startupContext as Record<string, unknown>).external_sources as unknown[]).length
            : 0,
      },
    });
  }

  const normalizedTask = normalizeTask({
    ...params.task,
    session_id: params.sessionId,
    session_key: params.task.session_key || session.session_key,
    provider: params.task.provider || session.provider,
    runtime: params.task.runtime || session.runtime,
    input:
      startupContext && params.task.input && typeof params.task.input === "object"
        ? {
            ...(params.task.input as Record<string, unknown>),
            startup_context: startupContext,
          }
        : params.task.input,
  });

  const activeRun = await findActiveSessionRun(normalizedTask.session_key || session.session_key);

  if (activeRun && normalizedTask.session_policy.dispatch_mode === "interrupt") {
    await markRunStatus(activeRun.id, "cancelled", {
      error: "Interrupted by a newer session message",
    });
  }

  const shouldQueue =
    activeRun &&
    normalizedTask.session_policy.dispatch_mode !== "interrupt" &&
    (activeRun.status === "queued" ||
      activeRun.status === "running" ||
      activeRun.status === "pending_approval");

  const runId = crypto.randomUUID();

  if (shouldQueue && db) {
    const queuedRun: PersistedAgentRun = {
      id: runId,
      session_id: params.sessionId,
      session_key: normalizedTask.session_key || session.session_key,
      task_kind: normalizedTask.kind,
      provider: normalizedTask.provider,
      runtime: normalizedTask.runtime,
      model: normalizedTask.model,
      status: "queued",
      dispatch_mode: normalizedTask.session_policy.dispatch_mode,
      input: normalizedTask,
      requires_human_review: false,
      tool_policy: normalizedTask.tool_policy,
      approval_policy: normalizedTask.approval_policy,
      metadata: normalizedTask.metadata,
      resume_from_run_id: normalizedTask.resume_from_run_id || null,
      created_at: nowTimestamp(),
      updated_at: nowTimestamp(),
    };
    await saveRun(queuedRun);
    await logRunEvent(
      normalizedTask as unknown as NormalizedAgentTask<unknown, unknown>,
      {
        runId,
        sessionId: params.sessionId,
        actionKey: "agent.run.queue",
        status: "queued",
        summary: "Queued behind an active session run",
        metadata: {
          active_run_id: activeRun.id,
        },
      },
    );
    await saveSession({
      ...session,
      status: "active",
      last_run_id: queuedRun.id,
      updated_at: nowTimestamp(),
    });
    return {
      queued: true,
      runId,
    };
  }

  const result = await runAgentTask(normalizedTask, {
    runId,
    sessionId: params.sessionId,
  });

  await saveSession({
    ...session,
    status: result.status === "failed" ? "active" : "idle",
    last_run_id: runId,
    updated_at: nowTimestamp(),
  });

  return {
    queued: false,
    runId,
    result,
  };
}

export async function listAgentSessions(limit?: number) {
  return listSessions(limit);
}

export async function getAgentSession(sessionId: string) {
  return getSession(sessionId);
}

export async function listAgentRunsForSession(sessionId: string, limit?: number) {
  return listRunsForSession(sessionId, limit);
}

export async function approveAgentRun(runId: string) {
  const run = await getRun(runId);
  if (!run) {
    throw new Error("Agent run not found");
  }
  if (run.status !== "pending_approval") {
    return run;
  }

  await markRunStatus(runId, "queued", {
    approval_reason: null,
  });
  await recordOpsActionLog({
    session_id: run.session_id || null,
    run_id: runId,
    session_key: run.session_key || null,
    action_key: "agent.run.approve",
    status: "completed",
    summary: "Operator approved pending run",
    provider: run.provider,
    runtime: run.runtime,
    task_kind: run.task_kind,
    risk_level: "high",
    reversible: true,
    requires_approval: false,
    metadata: {
      previous_approval_reason: run.approval_reason || null,
    },
  });

  const input = {
    ...(run.input as AgentTask),
    metadata: {
      ...(((run.input as AgentTask).metadata || {}) as Record<string, unknown>),
      approved: true,
    },
  };

  const result = await runAgentTask(input, {
    runId,
    sessionId: run.session_id || null,
  });

  return {
    ...run,
    status: result.status,
    output: result.output,
    artifacts: result.artifacts || null,
    logs: result.logs || null,
    error: result.error,
  };
}

export async function cancelAgentRun(runId: string) {
  const run = await getRun(runId);
  if (!run) {
    throw new Error("Agent run not found");
  }

  if (run.openclaw_run_id) {
    try {
      await cancelActionSession(run.openclaw_run_id);
    } catch (error) {
      logger.warn({ runId, err: error }, "Failed to cancel OpenClaw run");
    }
  }

  await markRunStatus(runId, "cancelled", {
    error: "Cancelled by operator",
  });
  await recordOpsActionLog({
    session_id: run.session_id || null,
    run_id: runId,
    session_key: run.session_key || null,
    action_key: "agent.run.cancel",
    status: "cancelled",
    summary: "Operator cancelled run",
    provider: run.provider,
    runtime: run.runtime,
    task_kind: run.task_kind,
    risk_level: "medium",
    reversible: true,
    requires_approval: false,
    metadata: {},
  });

  return {
    ...run,
    status: "cancelled" as const,
  };
}
