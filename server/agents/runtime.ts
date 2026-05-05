import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { getAgentProfile } from "./agent-profiles";
import { createAgentCheckpoint, getAgentCheckpoint, listAgentCheckpoints } from "./checkpoints";
import { createAgentCompaction, listAgentCompactions } from "./compactions";
import { getEnvironmentProfile } from "./environment-profiles";
import {
  cancelActionSession,
  startActionSession,
  waitForActionResult,
} from "../integrations/openclaw/client";
import { attachRequestMeta, logger } from "../logger";
import { resolveStartupContext } from "./knowledge";
import { recordOpsActionLog } from "./ops-action-logs";
import { recordRuntimeEvent, listRuntimeEvents } from "./runtime-events";
import {
  dispatchRuntimeApprovalHumanBlocker,
  safelyDispatchHumanBlocker,
} from "../utils/human-blocker-autonomy";
import {
  extractAgentCostTelemetry,
  summarizeRollingAgentSpend,
  type AgentSpendThresholds,
  type AgentCostTelemetryRecord,
} from "../utils/agentCostTelemetry";
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
  AgentThreadPhase,
  NormalizedAgentTask,
  OutcomeContract,
  OutcomeEvaluation,
  OpsActionRiskLevel,
  PersistedAgentRun,
  PersistedAgentSession,
  ApprovalPolicy,
  AgentProfileRecord,
  AgentEnvironmentProfileRecord,
  RuntimeEventRecord,
} from "./types";

function nowTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => entry !== undefined)
      .map((entry) => stripUndefinedDeep(entry)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, stripUndefinedDeep(entry)]),
    ) as T;
  }

  return value;
}

function mergeStringArrays(...values: Array<string[] | undefined>) {
  return Array.from(
    new Set(
      values
        .flatMap((value) => value || [])
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function defaultOutcomeContract(taskKind: AgentTaskKind): OutcomeContract {
  switch (taskKind) {
    case "support_triage":
      return {
        objective: "Safely classify the inbound issue and recommend the next operator action.",
        success_criteria: [
          "Category, queue, and priority are explicit.",
          "Suggested response is concise and safe.",
          "Human review is required when confidence or risk warrants it.",
        ],
        self_checks: [
          "Verify that no unsupported promise is made.",
          "Verify that escalation is explicit for blocked or sensitive issues.",
        ],
        proof_requirements: ["Use the inbound request details as evidence."],
        pass_threshold: 0.8,
        bounded_scope: "One support issue.",
        grader_name: "default-support-grader",
      };
    case "external_harness_thread":
      return {
        objective: "Complete the bounded external harness task and return a concise status.",
        success_criteria: [
          "The response states whether the bounded task completed.",
          "Suggested next actions are concrete when work is incomplete.",
        ],
        self_checks: ["Verify that the request stayed bounded to the assigned harness task."],
        proof_requirements: ["Name any produced artifact, file, or unresolved blocker."],
        pass_threshold: 0.75,
        bounded_scope: "One external harness thread step.",
        grader_name: "default-external-harness-grader",
      };
    default:
      return {
        objective: "Produce a bounded operator-quality response with clear next actions.",
        success_criteria: [
          "The reply addresses the operator request directly.",
          "The summary is specific and useful.",
          "Suggested actions are concrete.",
        ],
        self_checks: [
          "Verify that no claim outruns the supplied evidence.",
          "Verify that unresolved blockers are explicit.",
        ],
        proof_requirements: ["Reference the attached context when it materially informed the answer."],
        pass_threshold: 0.75,
        bounded_scope: "One operator request.",
        grader_name: "default-operator-grader",
      };
  }
}

function mergeOutcomeContract(
  taskKind: AgentTaskKind,
  ...contracts: Array<Partial<OutcomeContract> | undefined | null>
): OutcomeContract {
  const base = defaultOutcomeContract(taskKind);
  return contracts.reduce<OutcomeContract>(
    (acc, contract) => ({
      ...acc,
      ...contract,
      objective: contract?.objective?.trim() || acc.objective,
      success_criteria: contract?.success_criteria
        ? mergeStringArrays(contract.success_criteria)
        : acc.success_criteria,
      self_checks: contract?.self_checks
        ? mergeStringArrays(contract.self_checks)
        : acc.self_checks,
      proof_requirements: contract?.proof_requirements
        ? mergeStringArrays(contract.proof_requirements)
        : acc.proof_requirements,
      pass_threshold:
        typeof contract?.pass_threshold === "number" ? contract.pass_threshold : acc.pass_threshold,
      bounded_scope: contract?.bounded_scope?.trim() || acc.bounded_scope,
      grader_name: contract?.grader_name?.trim() || acc.grader_name,
    }),
    base,
  );
}

function normalizeStartupContextMetadata(value: unknown) {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    startupPackIds: mergeStringArrays(record.startupPackIds as string[] | undefined),
    repoDocPaths: mergeStringArrays(record.repoDocPaths as string[] | undefined),
    knowledgePagePaths: mergeStringArrays(record.knowledgePagePaths as string[] | undefined),
    blueprintIds: mergeStringArrays(record.blueprintIds as string[] | undefined),
    documentIds: mergeStringArrays(record.documentIds as string[] | undefined),
    externalSources: Array.isArray(record.externalSources)
      ? record.externalSources.filter((entry) => entry && typeof entry === "object")
      : [],
    creativeContexts: Array.isArray(record.creativeContexts)
      ? record.creativeContexts.filter((entry) => entry && typeof entry === "object")
      : [],
    operatorNotes:
      typeof record.operatorNotes === "string" ? record.operatorNotes.trim() : "",
    targetHarness:
      record.targetHarness === "claude_code" ? "claude_code" : "codex",
  };
}

function mergeStartupContextMetadata(...values: Array<unknown>) {
  return values.reduce<{
    startupPackIds: string[];
    repoDocPaths: string[];
    knowledgePagePaths: string[];
    blueprintIds: string[];
    documentIds: string[];
    externalSources: Array<Record<string, unknown>>;
    creativeContexts: Array<Record<string, unknown>>;
    operatorNotes: string;
    targetHarness: "codex" | "claude_code";
  }>(
    (acc, value) => {
      const next = normalizeStartupContextMetadata(value);
      return {
        startupPackIds: mergeStringArrays(acc.startupPackIds, next.startupPackIds),
        repoDocPaths: mergeStringArrays(acc.repoDocPaths, next.repoDocPaths),
        knowledgePagePaths: mergeStringArrays(acc.knowledgePagePaths, next.knowledgePagePaths),
        blueprintIds: mergeStringArrays(acc.blueprintIds, next.blueprintIds),
        documentIds: mergeStringArrays(acc.documentIds, next.documentIds),
        externalSources: [...acc.externalSources, ...next.externalSources],
        creativeContexts: [...acc.creativeContexts, ...next.creativeContexts],
        operatorNotes: [acc.operatorNotes, next.operatorNotes].filter(Boolean).join("\n\n").trim(),
        targetHarness: (next.targetHarness || acc.targetHarness) as "codex" | "claude_code",
      };
    },
    {
      startupPackIds: [] as string[],
      repoDocPaths: [] as string[],
      knowledgePagePaths: [] as string[],
      blueprintIds: [] as string[],
      documentIds: [] as string[],
      externalSources: [] as Array<Record<string, unknown>>,
      creativeContexts: [] as Array<Record<string, unknown>>,
      operatorNotes: "",
      targetHarness: "codex" as const,
    },
  );
}

async function resolveManagedRuntimeMetadata(metadata?: Record<string, unknown>) {
  const source = metadata && typeof metadata === "object" ? metadata : {};
  const managedRuntime =
    source.managedRuntime && typeof source.managedRuntime === "object"
      ? (source.managedRuntime as Record<string, unknown>)
      : {};
  const startupContext =
    source.startupContext && typeof source.startupContext === "object"
      ? (source.startupContext as Record<string, unknown>)
      : {};

  const agentProfileId =
    typeof managedRuntime.agentProfileId === "string" ? managedRuntime.agentProfileId : null;
  const environmentProfileId =
    typeof managedRuntime.environmentProfileId === "string"
      ? managedRuntime.environmentProfileId
      : null;

  const [agentProfile, environmentProfile] = await Promise.all([
    agentProfileId ? getAgentProfile(agentProfileId) : Promise.resolve(null),
    environmentProfileId ? getEnvironmentProfile(environmentProfileId) : Promise.resolve(null),
  ]);

  const mergedStartupContext = mergeStartupContextMetadata(
    agentProfile?.startup_context,
    environmentProfile
      ? {
          startupPackIds: environmentProfile.startup_pack_ids || [],
        }
      : undefined,
    startupContext,
  );

  return {
    agentProfile,
    environmentProfile,
    metadata: {
      ...source,
      startupContext: mergedStartupContext,
      managedRuntime: {
        ...managedRuntime,
        agentProfileId: agentProfile?.id || agentProfileId,
        environmentProfileId: environmentProfile?.id || environmentProfileId,
        profileName: agentProfile?.name || null,
        environmentName: environmentProfile?.name || null,
      },
    } as Record<string, unknown>,
  };
}

function buildEnvironmentSnapshot(environmentProfile: AgentEnvironmentProfileRecord | null) {
  if (!environmentProfile) {
    return null;
  }
  return {
    id: environmentProfile.id,
    key: environmentProfile.key,
    name: environmentProfile.name,
    lane: environmentProfile.lane,
    repo_mounts: environmentProfile.repo_mounts,
    package_set: environmentProfile.package_set,
    secret_bindings: environmentProfile.secret_bindings,
    network_rules: environmentProfile.network_rules,
    runtime_constraints: environmentProfile.runtime_constraints || null,
  };
}

function buildProfileSnapshot(agentProfile: AgentProfileRecord | null) {
  if (!agentProfile) {
    return null;
  }
  return {
    id: agentProfile.id,
    key: agentProfile.key,
    name: agentProfile.name,
    task_kind: agentProfile.task_kind,
    lane: agentProfile.lane || null,
    capabilities: agentProfile.capabilities || [],
    human_gates: agentProfile.human_gates || [],
  };
}

function gradeOutcome<TOutput>(
  task: NormalizedAgentTask<unknown, TOutput>,
  result: AgentResult<TOutput>,
): OutcomeEvaluation {
  const checks = [
    {
      label: "completed_without_runtime_error",
      passed: result.status === "completed" && !result.error,
      detail:
        result.status === "completed"
          ? "Run completed."
          : result.error || `Run ended with status ${result.status}.`,
    },
    {
      label: "has_structured_output",
      passed: Boolean(result.output),
      detail: result.output ? "Structured output present." : "No structured output returned.",
    },
    {
      label: "passes_human_review_gate",
      passed: result.requires_human_review === false,
      detail: result.requires_human_review
        ? "Run still requires human review."
        : "Run stayed within autonomous bounds.",
    },
    {
      label: "meets_proof_expectations",
      passed:
        task.outcome_contract.proof_requirements.length === 0
        || Boolean(result.artifacts || result.logs || result.raw_output_text),
      detail:
        task.outcome_contract.proof_requirements.length === 0
          ? "No explicit proof requirement."
          : result.artifacts || result.logs || result.raw_output_text
            ? "Trace or artifacts captured."
            : "No proof-bearing trace or artifact captured.",
    },
  ];

  const passed = checks.filter((check) => check.passed).length;
  const score = checks.length > 0 ? passed / checks.length : 0;
  return {
    status:
      score >= task.outcome_contract.pass_threshold
        ? "pass"
        : score >= Math.max(task.outcome_contract.pass_threshold - 0.2, 0.4)
          ? "partial"
          : "fail",
    score,
    summary:
      score >= task.outcome_contract.pass_threshold
        ? "Run satisfied the managed outcome contract."
        : score >= Math.max(task.outcome_contract.pass_threshold - 0.2, 0.4)
          ? "Run partially satisfied the outcome contract and needs follow-up."
          : "Run failed the managed outcome contract.",
    checks,
  };
}

const CONTEXT_WINDOW_FAILURE_PATTERN =
  /(context window|out of room|too much (earlier )?history|prompt (is )?too long|maximum context|token limit|max[_ ]output[_ ]tokens|incomplete response returned|stream disconnected before completion)/i;

function isContextWindowFailure(error?: string | null) {
  return Boolean(error && CONTEXT_WINDOW_FAILURE_PATTERN.test(error));
}

function phaseLabel(phase: AgentThreadPhase) {
  switch (phase) {
    case "implementation":
      return "Implementation";
    case "review_qa":
      return "Review/QA";
    default:
      return "Investigation";
  }
}

function sanitizeInlineText(value: unknown, maxLength = 280) {
  if (typeof value !== "string") {
    return "";
  }

  const collapsed = value.replace(/\s+/g, " ").trim();
  if (!collapsed) {
    return "";
  }

  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
}

function normalizeStringList(values: unknown, maxItems: number) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, maxItems);
}

function inferGoalFromRun(run: PersistedAgentRun | null, session: PersistedAgentSession) {
  const input =
    run?.input && typeof run.input === "object" ? (run.input as Record<string, unknown>) : null;
  const runInput =
    input?.input && typeof input.input === "object"
      ? (input.input as Record<string, unknown>)
      : input;
  const message = sanitizeInlineText(runInput?.message, 220);
  return message || sanitizeInlineText(session.title, 220) || "Continue the bounded task.";
}

function inferStateFromRun(run: PersistedAgentRun | null) {
  if (!run) {
    return "No prior run output is attached yet.";
  }

  const output =
    run.output && typeof run.output === "object"
      ? (run.output as Record<string, unknown>)
      : null;
  const summary = sanitizeInlineText(output?.summary, 320);
  const reply = sanitizeInlineText(output?.reply, 320);
  const error = sanitizeInlineText(run.error, 320);

  if (summary) {
    return summary;
  }
  if (reply) {
    return reply;
  }
  if (error) {
    return error;
  }

  return `Latest run status: ${run.status}.`;
}

function buildContextReferenceLines(session: PersistedAgentSession) {
  const metadata =
    session.metadata && typeof session.metadata === "object"
      ? (session.metadata as Record<string, unknown>)
      : {};
  const startupContext =
    metadata.startupContext && typeof metadata.startupContext === "object"
      ? (metadata.startupContext as Record<string, unknown>)
      : {};

  const lines: string[] = [];
  const repoDocs = normalizeStringList(startupContext.repoDocPaths, 6);
  const knowledgePagePaths = normalizeStringList(startupContext.knowledgePagePaths, 6);
  const blueprintIds = normalizeStringList(startupContext.blueprintIds, 6);
  const documentIds = normalizeStringList(startupContext.documentIds, 6);
  const startupPackIds = normalizeStringList(startupContext.startupPackIds, 6);
  const creativeContextIds = Array.isArray(startupContext.creativeContexts)
    ? (startupContext.creativeContexts as Array<Record<string, unknown>>)
        .map((context) =>
          typeof context.id === "string"
            ? context.id.trim()
            : typeof context.storage_uri === "string"
              ? context.storage_uri.trim()
              : "",
        )
        .filter(Boolean)
        .slice(0, 4)
    : [];
  const notes = sanitizeInlineText(startupContext.operatorNotes, 320);

  if (startupPackIds.length > 0) {
    lines.push(`- startup packs: ${startupPackIds.join(", ")}`);
  }
  if (repoDocs.length > 0) {
    lines.push(`- repo docs: ${repoDocs.join(", ")}`);
  }
  if (knowledgePagePaths.length > 0) {
    lines.push(`- KB pages: ${knowledgePagePaths.join(", ")}`);
  }
  if (blueprintIds.length > 0) {
    lines.push(`- blueprints: ${blueprintIds.join(", ")}`);
  }
  if (documentIds.length > 0) {
    lines.push(`- ops docs: ${documentIds.join(", ")}`);
  }
  if (creativeContextIds.length > 0) {
    lines.push(`- creative contexts: ${creativeContextIds.join(", ")}`);
  }
  if (notes) {
    lines.push(`- operator notes: ${notes}`);
  }

  return lines;
}

function buildNextMoveLine(params: {
  phase: AgentThreadPhase;
  retryCount: number;
  contextWindowFailure: boolean;
}) {
  const phaseStep =
    params.phase === "implementation"
      ? "Inspect the minimal set of files needed for the code change, implement it, and keep this thread scoped to implementation."
      : params.phase === "review_qa"
        ? "Review the changed behavior, run the narrowest useful checks, and keep this thread scoped to review and QA."
        : "Investigate only the blocker, summarize findings, and stop once the cause is clear.";

  if (params.retryCount >= 1) {
    return `${phaseStep} If this thread fails again, split the work or reroute it instead of retrying in place.`;
  }

  if (params.contextWindowFailure) {
    return `${phaseStep} Retry once in this fresh thread. If it fails again, split the task or reroute it.`;
  }

  return phaseStep;
}

function buildCompressedHandoff(params: {
  sourceSession: PersistedAgentSession;
  sourceRun: PersistedAgentRun | null;
  phase: AgentThreadPhase;
  retryCount: number;
}) {
  const { sourceSession, sourceRun, phase, retryCount } = params;
  const goal = inferGoalFromRun(sourceRun, sourceSession);
  const currentState = inferStateFromRun(sourceRun);
  const contextWindowFailure = isContextWindowFailure(sourceRun?.error || null);
  const references = buildContextReferenceLines(sourceSession);
  const lines = [
    `Task: continue "${sanitizeInlineText(sourceSession.title, 180) || sourceSession.id}"`,
    `Phase: ${phaseLabel(phase)}`,
    `Source session: ${sourceSession.id}`,
    `Source run: ${sourceRun?.id || "none"}`,
    `Goal: ${goal}`,
    `Current state: ${currentState}`,
  ];

  if (references.length > 0) {
    lines.push("Reference context:");
    lines.push(...references);
  }

  if (sourceRun?.error) {
    lines.push(`Last blocker: ${sanitizeInlineText(sourceRun.error, 320)}`);
  }

  lines.push(
    "Working rules:",
    "- keep this thread bounded to one phase",
    "- summarize, do not paste long logs or documents",
    "- reference file paths and document ids before dropping large excerpts",
    `Next step: ${buildNextMoveLine({ phase, retryCount, contextWindowFailure })}`,
  );

  return lines.join("\n");
}

function buildForkedSessionTitle(sourceTitle: string, phase: AgentThreadPhase, retryCount: number) {
  const suffix =
    retryCount > 0 ? `${phaseLabel(phase)} Retry ${retryCount + 1}` : phaseLabel(phase);
  return `${sourceTitle} · ${suffix}`;
}

function normalizeAgentProvider(provider?: AgentProvider): AgentProvider {
  switch (provider) {
    case "codex_local":
    case "deepseek_chat":
    case "openai_responses":
    case "anthropic_agent_sdk":
    case "acp_harness":
    case "openclaw":
      return provider;
    default:
      return "codex_local";
  }
}

function defaultModelForProvider(provider: AgentProvider) {
  switch (provider) {
    case "codex_local":
      return process.env.CODEX_DEFAULT_MODEL?.trim() || "gpt-5.4-mini";
    case "deepseek_chat":
      return process.env.DEEPSEEK_DEFAULT_MODEL?.trim() || "deepseek-v4-flash";
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
    outcome_contract: mergeOutcomeContract(
      task.kind,
      definition.build_outcome_contract?.(task.input),
      task.outcome_contract,
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

function summarizeCreativeContexts(startupContext: Record<string, unknown> | null) {
  const creativeContexts = Array.isArray(startupContext?.creative_contexts)
    ? (startupContext?.creative_contexts as Array<Record<string, unknown>>)
    : [];

  return {
    creative_context_ids: creativeContexts
      .map((context) => (typeof context.id === "string" ? context.id : null))
      .filter(Boolean),
    creative_context_uris: creativeContexts
      .map((context) =>
        typeof context.storage_uri === "string" ? context.storage_uri : null,
      )
      .filter(Boolean),
  };
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
    const { runOpenAIResponsesTask } = await import("./adapters/openai-responses");
    return runOpenAIResponsesTask(task);
  }

  if (task.provider === "deepseek_chat") {
    const { runDeepSeekChatTask } = await import("./adapters/deepseek-chat");
    return runDeepSeekChatTask(task);
  }

  if (task.provider === "codex_local") {
    const { runCodexLocalTask } = await import("./adapters/codex-local");
    return runCodexLocalTask(task);
  }

  if (task.provider === "anthropic_agent_sdk") {
    const { runAnthropicAgentSdkTask } = await import("./adapters/anthropic-agent-sdk");
    return runAnthropicAgentSdkTask(task);
  }

  if (task.provider === "acp_harness") {
    const { runAcpHarnessTask } = await import("./adapters/acp-harness");
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
  await db.collection("agentSessions").doc(session.id).set(stripUndefinedDeep(session), { merge: true });
}

async function saveRun(run: PersistedAgentRun) {
  if (!db) {
    return;
  }
  await db.collection("agentRuns").doc(run.id).set(stripUndefinedDeep(run), { merge: true });
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

function readUsdThreshold(envKey: string) {
  const raw = process.env[envKey];
  if (!raw || raw.trim().length === 0) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readCostThresholds(kind: "WARN" | "STOP"): AgentSpendThresholds {
  return {
    last15m: readUsdThreshold(`BLUEPRINT_AGENT_COST_${kind}_15M_USD`),
    lastHour: readUsdThreshold(`BLUEPRINT_AGENT_COST_${kind}_HOUR_USD`),
    lastDay: readUsdThreshold(`BLUEPRINT_AGENT_COST_${kind}_DAY_USD`),
  };
}

function hasThresholds(thresholds: AgentSpendThresholds) {
  return Object.values(thresholds).some((value) => typeof value === "number" && value > 0);
}

async function listRecentRunsForCostTelemetry(limit = 500): Promise<PersistedAgentRun[]> {
  if (!db) return [];
  const snapshot = await db
    .collection("agentRuns")
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(limit, 1000)))
    .get();
  return snapshot.docs.map((doc) => ({
    ...(doc.data() as PersistedAgentRun),
    id: doc.id,
  }));
}

function compactRollingSpendSummary(params: {
  summary: ReturnType<typeof summarizeRollingAgentSpend>;
  agentKey: string;
}) {
  return {
    windows: params.summary.windows,
    agent_windows: params.summary.by_agent[params.agentKey] ?? null,
  };
}

function highestSpendGuardrailStatus(
  metadata: Awaited<ReturnType<typeof buildRollingSpendMetadata>> | null,
) {
  if (!metadata) return null;
  const stopped = Object.entries(metadata.windows).find(([, window]) => window.status === "stop");
  if (stopped) return { status: "stop" as const, windowKey: stopped[0], window: stopped[1] };
  const warned = Object.entries(metadata.windows).find(([, window]) => window.status === "warn");
  if (warned) return { status: "warn" as const, windowKey: warned[0], window: warned[1] };
  return null;
}

async function buildRollingSpendMetadata(params: {
  currentRun?: PersistedAgentRun;
  currentTelemetry?: AgentCostTelemetryRecord;
}) {
  const warnUsd = readCostThresholds("WARN");
  const stopUsd = readCostThresholds("STOP");
  const recentRuns = await listRecentRunsForCostTelemetry();
  const runsForSummary =
    params.currentRun
      ? [params.currentRun, ...recentRuns.filter((run) => run.id !== params.currentRun?.id)]
      : recentRuns;
  const summary = summarizeRollingAgentSpend(runsForSummary, { warnUsd, stopUsd });
  const agentKey = params.currentTelemetry?.agent_key ?? "unknown";
  return {
    warn_usd: warnUsd,
    stop_usd: stopUsd,
    ...compactRollingSpendSummary({ summary, agentKey }),
  };
}

async function evaluatePreRunCostStop(params: {
  task: NormalizedAgentTask<unknown, unknown>;
  runId: string;
  sessionId?: string | null;
}) {
  const stopUsd = readCostThresholds("STOP");
  if (!hasThresholds(stopUsd)) {
    return null;
  }
  const warnUsd = readCostThresholds("WARN");
  const recentRuns = await listRecentRunsForCostTelemetry();
  const summary = summarizeRollingAgentSpend(recentRuns, { warnUsd, stopUsd });
  const stoppedWindow = Object.entries(summary.windows).find(([, window]) => window.status === "stop");
  if (!stoppedWindow) {
    return {
      stopped: false as const,
      metadata: {
        warn_usd: warnUsd,
        stop_usd: stopUsd,
        windows: summary.windows,
      },
    };
  }
  const [windowKey, window] = stoppedWindow;
  const error = `Agent runtime cost stop threshold reached for ${windowKey}: $${window.cost_usd.toFixed(4)}.`;
  const metadata = {
    warn_usd: warnUsd,
    stop_usd: stopUsd,
    windows: summary.windows,
    stopped_window: windowKey,
    stopped_cost_usd: window.cost_usd,
  };
  await markRunStatus(params.runId, "failed", {
    error,
    requires_human_review: true,
    metadata: {
      cost_guardrail: metadata,
    },
    outcome_evaluation: {
      status: "fail",
      score: 0,
      summary: "Run stopped before provider execution by the runtime cost guardrail.",
      checks: [
        {
          label: "cost_stop_threshold",
          passed: false,
          detail: error,
        },
      ],
    },
  });
  await logRunEvent(params.task, {
    runId: params.runId,
    sessionId: params.sessionId || params.task.session_id || null,
    actionKey: "agent.run.cost_guardrail",
    status: "failed",
    summary: error,
    requiresApproval: true,
    metadata,
  });
  if (params.sessionId) {
    await recordRuntimeEvent({
      session_id: params.sessionId,
      run_id: params.runId,
      kind: "run.cost_guardrail.stop",
      status: "error",
      summary: error,
      metadata,
    });
  }
  return { stopped: true as const, error, metadata };
}

function buildCompletedRunForCostTelemetry(params: {
  task: NormalizedAgentTask<unknown, unknown>;
  runId: string;
  sessionId?: string | null;
  result: AgentResult<unknown>;
  status: AgentRunStatus;
  createdAtIso: string;
}): PersistedAgentRun {
  return {
    id: params.runId,
    session_id: params.sessionId || params.task.session_id || null,
    session_key: params.task.session_key || null,
    task_kind: params.task.kind,
    provider: params.task.provider,
    runtime: params.task.runtime,
    model: params.task.model,
    status: params.status,
    dispatch_mode: params.task.session_policy.dispatch_mode,
    input: params.task,
    output: params.result.output,
    raw_output_text: params.result.raw_output_text || null,
    artifacts: params.result.artifacts || null,
    logs: params.result.logs || null,
    error: params.result.error || null,
    requires_human_review: params.result.requires_human_review,
    tool_policy: params.task.tool_policy,
    approval_policy: params.task.approval_policy,
    outcome_contract: params.task.outcome_contract,
    metadata: params.task.metadata || {},
    resume_from_run_id: params.task.resume_from_run_id || null,
    parent_run_id: params.task.parent_run_id || null,
    created_at: params.createdAtIso,
    updated_at: params.createdAtIso,
  };
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

async function updateSessionRuntimePointers(
  sessionId: string,
  updates: Partial<PersistedAgentSession>,
) {
  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }
  const nextSession = {
    ...session,
    ...updates,
    updated_at: nowTimestamp(),
  };
  await saveSession(nextSession);
  return nextSession;
}

async function createRuntimeCheckpoint(params: {
  session: PersistedAgentSession;
  runId?: string | null;
  label: string;
  trigger: string;
  replayable?: boolean;
  snapshot: Record<string, unknown>;
}) {
  const checkpoint = await createAgentCheckpoint({
    session_id: params.session.id,
    run_id: params.runId || null,
    session_key: params.session.session_key,
    label: params.label,
    trigger: params.trigger,
    replayable: params.replayable,
    snapshot: params.snapshot,
  });
  if (checkpoint) {
    await updateSessionRuntimePointers(params.session.id, {
      latest_checkpoint_id: checkpoint.id,
    });
    await recordRuntimeEvent({
      session_id: params.session.id,
      run_id: params.runId || null,
      checkpoint_id: checkpoint.id,
      kind: "checkpoint.created",
      status: "success",
      summary: params.label,
      detail: `Checkpoint captured via ${params.trigger}.`,
      metadata: {
        trigger: params.trigger,
        replayable: params.replayable !== false,
      },
    });
  }
  return checkpoint;
}

async function emitAdapterTraceEvents(params: {
  sessionId: string;
  runId: string;
  logs?: Array<Record<string, unknown>> | null;
}) {
  for (const log of params.logs || []) {
    if (!log || typeof log !== "object") {
      continue;
    }
    await recordRuntimeEvent({
      session_id: params.sessionId,
      run_id: params.runId,
      kind:
        typeof log.event_type === "string"
          ? log.event_type
          : typeof log.type === "string"
            ? log.type
            : "adapter.log",
      status:
        log.status === "error"
          ? "error"
          : log.status === "warning"
            ? "warning"
            : log.status === "success"
              ? "success"
              : "info",
      summary:
        typeof log.summary === "string"
          ? log.summary
          : typeof log.message === "string"
            ? log.message
            : "Adapter trace event",
      detail: typeof log.detail === "string" ? log.detail : null,
      metadata: log,
    });
  }
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
    stripUndefinedDeep({
      status,
      updated_at: nowTimestamp(),
      ...(status === "running" ? { started_at: nowTimestamp() } : {}),
      ...(status === "completed" ? { completed_at: nowTimestamp() } : {}),
      ...(status === "cancelled" ? { cancelled_at: nowTimestamp() } : {}),
      ...updates,
    }),
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
        outcome_contract: normalizedTask.outcome_contract,
        metadata: normalizedTask.metadata || {},
        resume_from_run_id: normalizedTask.resume_from_run_id || null,
        parent_run_id: normalizedTask.parent_run_id || null,
        created_at: nowTimestamp(),
        updated_at: nowTimestamp(),
      });
    }

    if (options?.sessionId) {
      const session = await getSession(options.sessionId);
      if (session) {
        await createRuntimeCheckpoint({
          session,
          runId,
          label: "Pending approval checkpoint",
          trigger: "run.pending_approval",
          snapshot: {
            task: normalizedTask,
            approval_reason: approval.reason,
          },
        });
      }
      await recordRuntimeEvent({
        session_id: options.sessionId,
        run_id: runId,
        kind: "run.pending_approval",
        status: "warning",
        summary: approval.reason || "Run requires approval before execution",
        metadata: {
          sensitive_actions: normalizedTask.approval_policy.sensitive_actions,
        },
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

    await safelyDispatchHumanBlocker("runtime.approval_required", () =>
      dispatchRuntimeApprovalHumanBlocker({
        runId,
        task,
        approvalReason: approval.reason,
        sessionId: options?.sessionId || normalizedTask.session_id || null,
        sessionKey: normalizedTask.session_key || null,
      }),
    );

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
      outcome_contract: normalizedTask.outcome_contract,
      metadata: normalizedTask.metadata || {},
      resume_from_run_id: normalizedTask.resume_from_run_id || null,
      parent_run_id: normalizedTask.parent_run_id || null,
      created_at: nowTimestamp(),
      updated_at: nowTimestamp(),
      started_at: nowTimestamp(),
    });
  } else if (db && options?.runId) {
    const existingRun = await getRun(options.runId);
    if (existingRun) {
      await markRunStatus(options.runId, "running");
    } else {
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
        outcome_contract: normalizedTask.outcome_contract,
        metadata: normalizedTask.metadata || {},
        resume_from_run_id: normalizedTask.resume_from_run_id || null,
        parent_run_id: normalizedTask.parent_run_id || null,
        created_at: nowTimestamp(),
        updated_at: nowTimestamp(),
        started_at: nowTimestamp(),
      });
    }
  }

  const preRunCostStop = await evaluatePreRunCostStop({
    task: normalizedTaskForLogs,
    runId,
    sessionId: options?.sessionId || normalizedTask.session_id || null,
  });
  if (preRunCostStop?.stopped) {
    return {
      status: "failed",
      provider: normalizedTask.provider,
      runtime: normalizedTask.runtime,
      model: normalizedTask.model,
      tool_mode: normalizedTask.tool_policy.mode,
      error: preRunCostStop.error,
      requires_human_review: true,
      requires_approval: false,
      artifacts: {
        cost_guardrail: preRunCostStop.metadata,
      },
      logs: [
        {
          event_type: "provider.request.skipped",
          status: "warning",
          summary: "Provider request skipped by runtime cost stop threshold",
          cost_guardrail: preRunCostStop.metadata,
        },
      ],
    };
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
      ...((((normalizedTask.metadata || {}) as Record<string, unknown>)
        .resolved_startup_context as Record<string, unknown> | undefined) || {}),
    },
  });

  if (options?.sessionId) {
    const session = await getSession(options.sessionId);
    if (session) {
      await createRuntimeCheckpoint({
        session,
        runId,
        label: "Run started checkpoint",
        trigger: "run.started",
        snapshot: {
          task: normalizedTask,
        },
      });
    }
    await recordRuntimeEvent({
      session_id: options.sessionId,
      run_id: runId,
      kind: "run.started",
      status: "info",
      summary: `Started ${normalizedTask.kind}`,
      metadata: {
        dispatch_mode: normalizedTask.session_policy.dispatch_mode,
        tool_mode: normalizedTask.tool_policy.mode,
      },
    });
  }

  try {
    const startedAtMs = Date.now();
    const result = await executeTask(normalizedTask);
    const status = resultStatus(result);
    const latencyMs = Date.now() - startedAtMs;
    const outcomeEvaluation = gradeOutcome(normalizedTaskForLogs, result as AgentResult<unknown>);
    const telemetryRun = buildCompletedRunForCostTelemetry({
      task: normalizedTaskForLogs,
      runId,
      sessionId: options?.sessionId || normalizedTask.session_id || null,
      result: result as AgentResult<unknown>,
      status,
      createdAtIso: new Date(startedAtMs).toISOString(),
    });
    const costTelemetry = extractAgentCostTelemetry(telemetryRun);
    const costGuardrail = await buildRollingSpendMetadata({
      currentRun: telemetryRun,
      currentTelemetry: costTelemetry,
    }).catch((error) => ({
      error: error instanceof Error ? error.message : String(error),
    }));
    const spendAlert =
      "windows" in costGuardrail
        ? highestSpendGuardrailStatus(costGuardrail)
        : null;

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
        outcome_evaluation: outcomeEvaluation,
        metadata: {
          cost_telemetry: costTelemetry,
          cost_guardrail: costGuardrail,
        },
      });
    }

    if (options?.sessionId) {
      await emitAdapterTraceEvents({
        sessionId: options.sessionId,
        runId,
        logs: result.logs,
      });
      const session = await getSession(options.sessionId);
      if (session) {
        await createRuntimeCheckpoint({
          session,
          runId,
          label: `Run ${status} checkpoint`,
          trigger: `run.${status}`,
          snapshot: {
            task: normalizedTask,
            result,
            outcome_evaluation: outcomeEvaluation,
          },
        });
        await updateSessionRuntimePointers(options.sessionId, {
          metadata: {
            ...(session.metadata || {}),
            latest_outcome_evaluation: outcomeEvaluation,
          },
        });
      }
      await recordRuntimeEvent({
        session_id: options.sessionId,
        run_id: runId,
        kind: "run.outcome.graded",
        status:
          outcomeEvaluation.status === "pass"
            ? "success"
            : outcomeEvaluation.status === "partial"
              ? "warning"
              : "error",
        summary: outcomeEvaluation.summary,
        metadata: {
          score: outcomeEvaluation.score,
          checks: outcomeEvaluation.checks,
        },
      });
      await recordRuntimeEvent({
        session_id: options.sessionId,
        run_id: runId,
        kind: `run.${status}`,
        status:
          status === "completed"
            ? "success"
            : status === "failed"
              ? "error"
              : "warning",
        summary:
          status === "completed"
            ? `${normalizedTask.kind} completed`
            : result.error || `${normalizedTask.kind} finished with status ${status}`,
        metadata: {
          latency_ms: latencyMs,
          requires_human_review: result.requires_human_review,
          tool_mode: normalizedTask.tool_policy.mode,
          output: result.output ?? null,
          artifacts: result.artifacts ?? null,
          cost_telemetry: costTelemetry,
          cost_guardrail: costGuardrail,
          raw_output_text: result.raw_output_text ?? null,
          outcome_evaluation: outcomeEvaluation,
        },
      });
    }

    if (spendAlert) {
      const summary = `Agent spend ${spendAlert.status} threshold in ${spendAlert.windowKey}: $${spendAlert.window.cost_usd.toFixed(4)}.`;
      await logRunEvent(normalizedTaskForLogs, {
        runId,
        sessionId: options?.sessionId || normalizedTask.session_id || null,
        actionKey: "agent.run.cost_guardrail",
        status: spendAlert.status === "stop" ? "failed" : "info",
        summary,
        metadata: {
          cost_telemetry: costTelemetry,
          cost_guardrail: costGuardrail,
        },
      });
      if (options?.sessionId) {
        await recordRuntimeEvent({
          session_id: options.sessionId,
          run_id: runId,
          kind: `run.cost_guardrail.${spendAlert.status}`,
          status: spendAlert.status === "stop" ? "error" : "warning",
          summary,
          metadata: {
            cost_telemetry: costTelemetry,
            cost_guardrail: costGuardrail,
          },
        });
      }
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
        cost_telemetry: costTelemetry,
        cost_guardrail: costGuardrail,
        ...((((normalizedTask.metadata || {}) as Record<string, unknown>)
          .resolved_startup_context as Record<string, unknown> | undefined) || {}),
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
        outcome_evaluation: {
          status: "fail",
          score: 0,
          summary: "Run failed before satisfying the managed outcome contract.",
          checks: [
            {
              label: "completed_without_runtime_error",
              passed: false,
              detail: message,
            },
          ],
        },
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
        ...((((normalizedTask.metadata || {}) as Record<string, unknown>)
          .resolved_startup_context as Record<string, unknown> | undefined) || {}),
      },
    });

    if (options?.sessionId) {
      const session = await getSession(options.sessionId);
      if (session) {
        await createRuntimeCheckpoint({
          session,
          runId,
          label: "Run failed checkpoint",
          trigger: "run.failed",
          snapshot: {
            task: normalizedTask,
            error: message,
          },
        });
      }
      await recordRuntimeEvent({
        session_id: options.sessionId,
        run_id: runId,
        kind: "run.failed",
        status: "error",
        summary: message,
        metadata: {
          tool_mode: normalizedTask.tool_policy.mode,
        },
      });
    }

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
  agent_profile_id?: string | null;
  environment_profile_id?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const sessionId = crypto.randomUUID();
  const profile = params.agent_profile_id ? await getAgentProfile(params.agent_profile_id) : null;
  const environment = params.environment_profile_id
    ? await getEnvironmentProfile(params.environment_profile_id)
    : null;
  const resolvedRuntimeMetadata = await resolveManagedRuntimeMetadata({
    ...(params.metadata || {}),
    managedRuntime: {
      ...(((params.metadata || {}).managedRuntime as Record<string, unknown> | undefined) || {}),
      agentProfileId: profile?.id || params.agent_profile_id || null,
      environmentProfileId: environment?.id || params.environment_profile_id || null,
      agentProfileKey: profile?.key || null,
      environmentProfileKey: environment?.key || null,
      environmentSnapshot: buildEnvironmentSnapshot(environment),
      agentProfileSnapshot: buildProfileSnapshot(profile),
    },
  });
  const provider = normalizeAgentProvider(
    params.provider || profile?.default_provider,
  );
  const session: PersistedAgentSession = {
    id: sessionId,
    title: params.title,
    task_kind: params.task_kind,
    provider,
    runtime: normalizeAgentProvider(params.runtime || provider),
    status: "idle",
    session_key: params.session_key || `session:${sessionId}`,
    agent_profile_id: profile?.id || params.agent_profile_id || null,
    environment_profile_id: environment?.id || params.environment_profile_id || null,
    created_at: nowTimestamp(),
    updated_at: nowTimestamp(),
    metadata: resolvedRuntimeMetadata.metadata,
  };

  await saveSession(session);
  const initialCheckpoint = await createRuntimeCheckpoint({
    session,
    label: "Session initialized",
    trigger: "session.create",
    replayable: true,
    snapshot: {
      session,
      managedRuntime: resolvedRuntimeMetadata.metadata.managedRuntime || {},
    },
  });
  if (initialCheckpoint) {
    session.latest_checkpoint_id = initialCheckpoint.id;
  }
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
      agent_profile_id: session.agent_profile_id,
      environment_profile_id: session.environment_profile_id,
      startup_pack_ids:
        ((resolvedRuntimeMetadata.metadata.startupContext as Record<string, unknown> | undefined)
          ?.startupPackIds as string[] | undefined) || [],
      document_ids:
        ((resolvedRuntimeMetadata.metadata.startupContext as Record<string, unknown> | undefined)
          ?.documentIds as string[] | undefined) || [],
      creative_context_ids:
        Array.isArray(
          (resolvedRuntimeMetadata.metadata.startupContext as Record<string, unknown> | undefined)
            ?.creativeContexts,
        )
          ? (
              ((resolvedRuntimeMetadata.metadata.startupContext as Record<string, unknown> | undefined)
                ?.creativeContexts as Array<Record<string, unknown>>)
            )
              .map((context) =>
                typeof context?.id === "string" ? context.id : null,
              )
              .filter(Boolean)
          : [],
      },
  });
  await recordRuntimeEvent({
    session_id: sessionId,
    kind: "session.created",
    status: "success",
    summary: `Created ${params.task_kind} session`,
    metadata: {
      title: session.title,
      agent_profile_id: session.agent_profile_id,
      environment_profile_id: session.environment_profile_id,
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

  const taskMetadata =
    params.task.metadata && typeof params.task.metadata === "object"
      ? (params.task.metadata as Record<string, unknown>)
      : {};
  const agentProfile = session.agent_profile_id
    ? await getAgentProfile(session.agent_profile_id)
    : null;
  const environmentProfile = session.environment_profile_id
    ? await getEnvironmentProfile(session.environment_profile_id)
    : null;
  const workflowMetadata =
    session.metadata &&
    typeof session.metadata === "object" &&
    (session.metadata as Record<string, unknown>).workflow &&
    typeof (session.metadata as Record<string, unknown>).workflow === "object"
      ? ((session.metadata as Record<string, unknown>).workflow as Record<string, unknown>)
      : {};
  const sessionStartupContext =
    session.metadata &&
    typeof session.metadata === "object" &&
    (session.metadata as Record<string, unknown>).startupContext &&
    typeof (session.metadata as Record<string, unknown>).startupContext === "object"
      ? ((session.metadata as Record<string, unknown>).startupContext as Record<string, unknown>)
      : {};
  const compactStartupContext =
    taskMetadata.compact_startup_context === true
    || workflowMetadata.startupContextMode === "compact_references";

  const startupContext =
    params.task.kind === "operator_thread" ||
    params.task.kind === "external_harness_thread"
      ? await resolveStartupContext(
          {
            ...(session.metadata as Record<string, unknown> | undefined),
            startupContext: mergeStartupContextMetadata(
              agentProfile?.startup_context,
              environmentProfile
                ? {
                    startupPackIds: environmentProfile.startup_pack_ids || [],
                  }
                : undefined,
              sessionStartupContext,
            ),
          },
          typeof (params.task.input as Record<string, unknown> | undefined)?.message === "string"
            ? String((params.task.input as Record<string, unknown>).message)
            : "",
          {
            compact: compactStartupContext,
          },
        )
      : null;

  const resolvedStartupContextSummary = startupContext
    ? {
        creative_context_count: Array.isArray(
          (startupContext as Record<string, unknown>).creative_contexts,
        )
          ? ((startupContext as Record<string, unknown>).creative_contexts as unknown[]).length
          : 0,
        ...summarizeCreativeContexts(startupContext as Record<string, unknown>),
      }
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
        knowledge_page_count:
          Array.isArray((startupContext as Record<string, unknown>).knowledge_pages)
            ? ((startupContext as Record<string, unknown>).knowledge_pages as unknown[]).length
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
        creative_context_count:
          Array.isArray((startupContext as Record<string, unknown>).creative_contexts)
            ? ((startupContext as Record<string, unknown>).creative_contexts as unknown[]).length
            : 0,
        ...summarizeCreativeContexts(startupContext as Record<string, unknown>),
      },
    });
  }

  const normalizedTask = normalizeTask({
    ...params.task,
    session_id: params.sessionId,
    session_key: params.task.session_key || session.session_key,
    parent_run_id: params.task.parent_run_id || null,
    provider: params.task.provider || agentProfile?.default_provider || session.provider,
    runtime: params.task.runtime || agentProfile?.default_runtime || session.runtime,
    tool_policy: mergeToolPolicy(
      environmentProfile?.tool_policy,
      agentProfile?.tool_policy,
      params.task.tool_policy,
    ),
    approval_policy: mergeApprovalPolicy(
      environmentProfile?.approval_policy,
      agentProfile?.approval_policy,
      params.task.approval_policy,
    ),
    session_policy: mergeSessionPolicy(
      environmentProfile?.session_policy,
      agentProfile?.session_policy,
      params.task.session_policy,
    ),
    outcome_contract: mergeOutcomeContract(
      params.task.kind,
      agentProfile?.outcome_contract,
      params.task.outcome_contract,
    ),
    metadata:
      {
        ...(resolvedStartupContextSummary
        ? {
            ...taskMetadata,
            resolved_startup_context: resolvedStartupContextSummary,
          }
        : taskMetadata),
        managedRuntime: {
          ...((taskMetadata.managedRuntime as Record<string, unknown> | undefined) || {}),
          agentProfileId: agentProfile?.id || session.agent_profile_id || null,
          environmentProfileId: environmentProfile?.id || session.environment_profile_id || null,
          profileName: agentProfile?.name || null,
          environmentName: environmentProfile?.name || null,
          profileSnapshot: buildProfileSnapshot(agentProfile),
          environmentSnapshot: buildEnvironmentSnapshot(environmentProfile),
        },
      },
    input:
      startupContext && params.task.input && typeof params.task.input === "object"
        ? {
            ...(params.task.input as Record<string, unknown>),
            startup_context: startupContext,
          }
        : params.task.input,
  });

  const activeRun = await findActiveSessionRun(normalizedTask.session_key || session.session_key);
  await recordRuntimeEvent({
    session_id: params.sessionId,
    run_id: activeRun?.id || null,
    kind: "session.message.received",
    status: "info",
    summary: "Received session message",
    metadata: {
      dispatch_mode: normalizedTask.session_policy.dispatch_mode,
      parent_run_id: normalizedTask.parent_run_id || null,
      compact_startup_context: compactStartupContext,
      agent_profile_id: agentProfile?.id || session.agent_profile_id || null,
      environment_profile_id: environmentProfile?.id || session.environment_profile_id || null,
    },
  });

  if (activeRun && normalizedTask.session_policy.dispatch_mode === "interrupt") {
    await markRunStatus(activeRun.id, "cancelled", {
      error: "Interrupted by a newer session message",
    });
    await recordRuntimeEvent({
      session_id: params.sessionId,
      run_id: activeRun.id,
      kind: "run.interrupted",
      status: "warning",
      summary: "Interrupted active run for a newer session message",
      metadata: {
        dispatch_mode: normalizedTask.session_policy.dispatch_mode,
      },
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
      outcome_contract: normalizedTask.outcome_contract,
      metadata: normalizedTask.metadata || {},
      resume_from_run_id: normalizedTask.resume_from_run_id || null,
      parent_run_id: normalizedTask.parent_run_id || null,
      created_at: nowTimestamp(),
      updated_at: nowTimestamp(),
    };
    await saveRun(queuedRun);
    await createRuntimeCheckpoint({
      session,
      runId: queuedRun.id,
      label: "Queued run prepared",
      trigger: "run.queued",
      snapshot: {
        task: normalizedTask,
        active_run_id: activeRun.id,
      },
    });
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
          ...(resolvedStartupContextSummary || {}),
        },
      },
    );
    await recordRuntimeEvent({
      session_id: params.sessionId,
      run_id: queuedRun.id,
      kind: "run.queued",
      status: "info",
      summary: "Queued behind an active session run",
      metadata: {
        active_run_id: activeRun.id,
      },
    });
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

  const nextSessionMetadata = {
    ...(session.metadata || {}),
    ...(result.artifacts && typeof result.artifacts === "object"
      ? {
          previous_response_id:
            typeof (result.artifacts as Record<string, unknown>).openai_response_id === "string"
              ? (result.artifacts as Record<string, unknown>).openai_response_id
              : (session.metadata as Record<string, unknown> | undefined)?.previous_response_id,
        }
      : {}),
  };

  await saveSession({
    ...session,
    status: result.status === "failed" ? "active" : "idle",
    last_run_id: runId,
    metadata: nextSessionMetadata,
    updated_at: nowTimestamp(),
  });
  await createRuntimeCheckpoint({
    session: {
      ...session,
      metadata: nextSessionMetadata,
    },
    runId,
    label: `Run ${result.status}`,
    trigger: `run.${result.status}`,
    snapshot: {
      task: normalizedTask,
      result,
      session_metadata: nextSessionMetadata,
    },
  });

  return {
    queued: false,
    runId,
    result,
  };
}

export async function forkAgentSessionWithHandoff(params: {
  sessionId: string;
  phase: AgentThreadPhase;
  sourceRunId?: string;
}) {
  const sourceSession = await getSession(params.sessionId);
  if (!sourceSession) {
    throw new Error("Agent session not found");
  }

  const sourceRun =
    params.sourceRunId
      ? await getRun(params.sourceRunId)
      : (await listRunsForSession(params.sessionId, 1))[0] || null;

  if (sourceRun && sourceRun.session_id && sourceRun.session_id !== params.sessionId) {
    throw new Error("Run does not belong to the requested session");
  }

  const sourceMetadata =
    sourceSession.metadata && typeof sourceSession.metadata === "object"
      ? (sourceSession.metadata as Record<string, unknown>)
      : {};
  const sourceWorkflow =
    sourceMetadata.workflow && typeof sourceMetadata.workflow === "object"
      ? (sourceMetadata.workflow as Record<string, unknown>)
      : {};
  const sourcePhase =
    sourceWorkflow.phase === "implementation" || sourceWorkflow.phase === "review_qa"
      ? (sourceWorkflow.phase as AgentThreadPhase)
      : "investigation";
  const sourceRetryCount =
    typeof sourceWorkflow.retryCount === "number" && Number.isFinite(sourceWorkflow.retryCount)
      ? sourceWorkflow.retryCount
      : 0;
  const retryCount =
    sourcePhase === params.phase && isContextWindowFailure(sourceRun?.error || null)
      ? sourceRetryCount + 1
      : 0;
  const handoffPrompt = buildCompressedHandoff({
    sourceSession,
    sourceRun,
    phase: params.phase,
    retryCount,
  });
  const sourceTaskRecord =
    sourceRun?.input && typeof sourceRun.input === "object"
      ? (sourceRun.input as Record<string, unknown>)
      : {};
  const sourceTaskInput =
    sourceTaskRecord.input && typeof sourceTaskRecord.input === "object"
      ? (sourceTaskRecord.input as Record<string, unknown>)
      : sourceTaskRecord;
  const startupContext =
    sourceMetadata.startupContext && typeof sourceMetadata.startupContext === "object"
      ? (sourceMetadata.startupContext as Record<string, unknown>)
      : {};
  const forkInput =
    sourceSession.task_kind === "support_triage"
      ? {
          ...sourceTaskInput,
          summary: sanitizeInlineText(
            `${String(sourceTaskInput.summary || sourceTaskInput.message || "")}\n${handoffPrompt}`,
            1400,
          ),
        }
      : sourceSession.task_kind === "external_harness_thread"
        ? {
            ...sourceTaskInput,
            message: handoffPrompt,
            harness:
              typeof sourceTaskInput.harness === "string"
                ? sourceTaskInput.harness
                : "codex",
          }
        : {
            message: handoffPrompt,
          };

  const forkedSession = await createAgentSession({
    title: buildForkedSessionTitle(sourceSession.title, params.phase, retryCount),
    task_kind: sourceSession.task_kind,
    provider: sourceSession.provider,
    runtime: sourceSession.runtime,
    metadata: {
      startupContext,
      workflow: {
        phase: params.phase,
        parentSessionId: sourceSession.id,
        parentRunId: sourceRun?.id || null,
        retryCount,
        startupContextMode: "compact_references",
        handoffPrompt,
        sourceSessionTitle: sourceSession.title,
      },
    },
  });

  const dispatch = await sendAgentSessionMessage({
    sessionId: forkedSession.id,
    task: {
      kind: sourceSession.task_kind,
      input: forkInput,
      metadata: {
        compact_startup_context: true,
        handoff_source_session_id: sourceSession.id,
        handoff_source_run_id: sourceRun?.id || null,
        workflow_phase: params.phase,
        retry_count: retryCount,
      },
    },
  });

  const compaction = await createAgentCompaction({
    source_session_id: sourceSession.id,
    source_run_id: sourceRun?.id || null,
    target_session_id: forkedSession.id,
    target_run_id: dispatch.runId,
    phase: params.phase,
    reason: isContextWindowFailure(sourceRun?.error || null)
      ? "context_window_failure"
      : "manual_phase_fork",
    status: "continued",
    handoff_prompt: handoffPrompt,
    summary: `Compacted ${sourceSession.title} into a ${phaseLabel(params.phase)} thread.`,
    metadata: {
      retry_count: retryCount,
    },
  });
  await recordRuntimeEvent({
    session_id: sourceSession.id,
    run_id: sourceRun?.id || null,
    kind: "session.compacted",
    status: "success",
    summary: `Compacted into ${forkedSession.title}`,
    metadata: {
      compaction_id: compaction?.id || null,
      target_session_id: forkedSession.id,
      target_run_id: dispatch.runId,
      phase: params.phase,
    },
  });

  return {
    session: (await getSession(forkedSession.id)) || forkedSession,
    handoffPrompt,
    dispatch,
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
  if (run.session_id) {
    await recordRuntimeEvent({
      session_id: run.session_id,
      run_id: runId,
      kind: "run.approved",
      status: "success",
      summary: "Operator approved pending run",
      metadata: {
        previous_approval_reason: run.approval_reason || null,
      },
    });
  }

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
  if (run.session_id) {
    await recordRuntimeEvent({
      session_id: run.session_id,
      run_id: runId,
      kind: "run.cancelled",
      status: "warning",
      summary: "Operator cancelled run",
      metadata: {},
    });
  }

  return {
    ...run,
    status: "cancelled" as const,
  };
}

async function findLatestRunnableTask(sessionId: string) {
  const runs = await listRunsForSession(sessionId, 25);
  const candidate = runs.find((run) => run.input && typeof run.input === "object");
  return candidate ? (candidate.input as AgentTask) : null;
}

export async function listRuntimeEventsForSession(sessionId: string, limit?: number) {
  return listRuntimeEvents({ sessionId, limit });
}

export async function listCheckpointsForSession(sessionId: string, limit?: number) {
  return listAgentCheckpoints({ sessionId, limit });
}

export async function listCompactionsForSession(sessionId: string, limit?: number) {
  return listAgentCompactions({ sessionId, limit });
}

export async function startAgentSessionRun(params: {
  sessionId: string;
  message: string;
}) {
  const session = await getSession(params.sessionId);
  if (!session) {
    throw new Error("Agent session not found");
  }

  await recordRuntimeEvent({
    session_id: params.sessionId,
    kind: "session.control.start",
    status: "info",
    summary: "Operator started the session",
    metadata: {},
  });

  return sendAgentSessionMessage({
    sessionId: params.sessionId,
    task: {
      kind: session.task_kind,
      input:
        session.task_kind === "support_triage"
          ? { summary: params.message, message: params.message }
          : session.task_kind === "external_harness_thread"
            ? { message: params.message, harness: "codex" }
          : { message: params.message },
      metadata: {
        control_action: "start",
      },
    },
  });
}

export async function interruptAgentSession(params: {
  sessionId: string;
  reason?: string;
}) {
  const session = await getSession(params.sessionId);
  if (!session) {
    throw new Error("Agent session not found");
  }

  const activeRun = await findActiveSessionRun(session.session_key);
  if (!activeRun) {
    await recordRuntimeEvent({
      session_id: params.sessionId,
      kind: "session.control.interrupt",
      status: "info",
      summary: "Interrupt requested with no active run",
      metadata: {
        reason: params.reason || null,
      },
    });
    return { interrupted: false, run: null };
  }

  const run = await cancelAgentRun(activeRun.id);
  await recordRuntimeEvent({
    session_id: params.sessionId,
    run_id: activeRun.id,
    kind: "session.control.interrupt",
    status: "warning",
    summary: "Operator interrupted the active run",
    metadata: {
      reason: params.reason || null,
    },
  });
  return { interrupted: true, run };
}

export async function steerAgentSession(params: {
  sessionId: string;
  message: string;
}) {
  const session = await getSession(params.sessionId);
  if (!session) {
    throw new Error("Agent session not found");
  }

  const latestRun = (await listRunsForSession(params.sessionId, 1))[0] || null;
  await interruptAgentSession({
    sessionId: params.sessionId,
    reason: "Steered by operator",
  });
  await recordRuntimeEvent({
    session_id: params.sessionId,
    run_id: latestRun?.id || null,
    kind: "session.control.steer",
    status: "info",
    summary: "Operator steered the session",
    metadata: {},
  });

  return sendAgentSessionMessage({
    sessionId: params.sessionId,
    task: {
      kind: session.task_kind,
      input:
        session.task_kind === "support_triage"
          ? { summary: params.message, message: params.message }
          : session.task_kind === "external_harness_thread"
            ? { message: params.message, harness: "codex" }
          : { message: params.message },
      session_policy: {
        dispatch_mode: "interrupt",
      },
      metadata: {
        control_action: "steer",
      },
      parent_run_id: latestRun?.id || null,
    },
  });
}

export async function resumeAgentSession(params: {
  sessionId: string;
  checkpointId?: string;
}) {
  const session = await getSession(params.sessionId);
  if (!session) {
    throw new Error("Agent session not found");
  }

  const checkpoint = params.checkpointId
    ? await getAgentCheckpoint(params.checkpointId)
    : session.latest_checkpoint_id
      ? await getAgentCheckpoint(session.latest_checkpoint_id)
      : (await listAgentCheckpoints({ sessionId: params.sessionId, limit: 1 }))[0] || null;
  const lastTask = checkpoint?.snapshot?.task && typeof checkpoint.snapshot.task === "object"
    ? (checkpoint.snapshot.task as AgentTask)
    : await findLatestRunnableTask(params.sessionId);

  if (!lastTask) {
    throw new Error("No replayable task state found for this session");
  }

  await recordRuntimeEvent({
    session_id: params.sessionId,
    run_id: checkpoint?.run_id || null,
    checkpoint_id: checkpoint?.id || null,
    kind: "session.control.resume",
    status: "info",
    summary: "Operator resumed the session from checkpoint",
    metadata: {},
  });

  return sendAgentSessionMessage({
    sessionId: params.sessionId,
    task: {
      ...lastTask,
      metadata: {
        ...((lastTask.metadata as Record<string, unknown> | undefined) || {}),
        control_action: "resume",
        resumed_from_checkpoint_id: checkpoint?.id || null,
      },
      resume_from_run_id: checkpoint?.run_id || lastTask.resume_from_run_id || null,
    },
  });
}

export async function cancelAgentSession(params: {
  sessionId: string;
  reason?: string;
}) {
  const session = await getSession(params.sessionId);
  if (!session) {
    throw new Error("Agent session not found");
  }

  const activeRun = await findActiveSessionRun(session.session_key);
  if (activeRun) {
    await cancelAgentRun(activeRun.id);
  }
  await saveSession({
    ...session,
    status: "cancelled",
    updated_at: nowTimestamp(),
  });
  await recordRuntimeEvent({
    session_id: params.sessionId,
    run_id: activeRun?.id || null,
    kind: "session.control.cancel",
    status: "warning",
    summary: "Operator cancelled the session",
    metadata: {
      reason: params.reason || null,
    },
  });

  return (await getSession(params.sessionId)) || session;
}

export async function compactAgentSession(params: {
  sessionId: string;
  phase: AgentThreadPhase;
  reason?: string;
}) {
  return forkAgentSessionWithHandoff({
    sessionId: params.sessionId,
    phase: params.phase,
  });
}

export async function delegateManagedAgentTask(params: {
  title: string;
  message: string;
  agentProfileId: string;
  environmentProfileId?: string | null;
  parentSessionId?: string | null;
  parentRunId?: string | null;
}) {
  const profile = await getAgentProfile(params.agentProfileId);
  if (!profile) {
    throw new Error("Agent profile not found");
  }

  const session = await createAgentSession({
    title: params.title,
    task_kind: profile.task_kind,
    provider: profile.default_provider,
    runtime: profile.default_runtime,
    agent_profile_id: profile.id,
    environment_profile_id:
      params.environmentProfileId || profile.default_environment_profile_id || null,
    metadata: {
      startupContext: profile.startup_context || {},
      workflow: {
        phase: "investigation",
      },
      managedRuntime: {
        delegation: {
          parentSessionId: params.parentSessionId || null,
          parentRunId: params.parentRunId || null,
        },
      },
    },
  });

  const dispatch = await sendAgentSessionMessage({
    sessionId: session.id,
    task: {
      kind: profile.task_kind,
      input:
        profile.task_kind === "support_triage"
          ? { summary: params.message, message: params.message }
          : profile.task_kind === "external_harness_thread"
            ? { message: params.message, harness: "codex" }
            : { message: params.message },
      metadata: {
        control_action: "delegated_start",
      },
      parent_run_id: params.parentRunId || null,
      outcome_contract: profile.outcome_contract || undefined,
    },
  });

  if (params.parentSessionId) {
    await recordRuntimeEvent({
      session_id: params.parentSessionId,
      run_id: params.parentRunId || null,
      kind: "subagent.spawned",
      status: "success",
      summary: `Delegated bounded task to ${profile.name}`,
      metadata: {
        child_session_id: session.id,
        child_profile_id: profile.id,
      },
    });
  }

  return {
    session,
    dispatch,
  };
}

export async function spawnSessionSubagents(params: {
  parentSessionId: string;
  parentRunId?: string | null;
  workers: Array<{
    title: string;
    message: string;
    agentProfileId: string;
    environmentProfileId?: string | null;
  }>;
}) {
  const results = await Promise.all(
    params.workers.map((worker) =>
      delegateManagedAgentTask({
        ...worker,
        parentSessionId: params.parentSessionId,
        parentRunId: params.parentRunId || null,
      }),
    ),
  );

  await recordRuntimeEvent({
    session_id: params.parentSessionId,
    run_id: params.parentRunId || null,
    kind: "subagent.batch_spawned",
    status: "success",
    summary: `Spawned ${results.length} subagent session(s)`,
    metadata: {
      child_session_ids: results.map((result) => result.session.id),
    },
  });

  return results;
}
