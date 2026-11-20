import crypto from "node:crypto";

import admin, { dbAdmin as db } from "../../client/src/lib/firebaseAdmin";
import { LANE_DATA_CLASSES, NO_PERMITTED_PROVIDER, PRIVACY_NOT_PERMITTED, PROFILE_DATA_CLASSES, PROVIDER_DESTINATIONS,
  STRICTEST_PRIVACY_TABLE, privacyDecisionForClasses, resolvePrivacyVersion, type AgentDataClass } from "./provider-privacy";
import { AgentEvidenceError, hydrateAgentEvidence, persistAgentEvidence, persistAgentEvidenceFailure, requiresMutationReconciliation } from "./private-evidence";
import { createAgentCheckpoint } from "./checkpoints";
import { attachRequestMeta, logger } from "../logger";
import { recordOpsActionLog } from "./ops-action-logs";
import { recordRuntimeEvent } from "./runtime-events";
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
import { ACCOUNTING_ONLY_TASK_KINDS, chooseFailoverProvider, type FailoverDecision, getDefaultAnthropicModel, isRemovedProviderId,
  isStructuredProvider } from "./provider-config";
import { isProviderCoolingDown, markProviderOutOfFunds } from "./provider-funds";
import { classifyProviderError, type ProviderErrorClassification } from "./provider-errors";
import type {
  AgentResult,
  AgentProvider,
  AgentRunStatus,
  AgentTask,
  AgentTaskKind,
  NormalizedAgentTask,
  OutcomeContract,
  OutcomeEvaluation,
  OpsActionRiskLevel,
  PersistedAgentRun,
  PersistedAgentSession,
  ApprovalPolicy,
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
    const record = value as Record<string, unknown>;
    const definition = record.definition && typeof record.kind === "string"
      ? getTaskDefinition(record.kind as AgentTaskKind) : undefined;
    const hasRuntimeDefinition = definition && definition.kind === record.kind && record.definition === definition;
    return Object.fromEntries(
      Object.entries(record)
        .filter(([, entry]) => entry !== undefined)
        // Parsers and prompt builders are runtime code. Keep their registry reference in saved task data.
        .map(([key, entry]) => [key, hasRuntimeDefinition && key === "definition"
          ? { kind: definition.kind } : stripUndefinedDeep(entry)]),
    ) as T;
  }

  return value;
}

function isRuntimeRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

const RUN_DEDUPE_IGNORED_KEYS = new Set([
  "startup_context",
  "resolved_startup_context",
  "managedRuntime",
  "created_at",
  "updated_at",
  "started_at",
  "completed_at",
  "cancelled_at",
]);

function stripRunDedupeVolatileFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripRunDedupeVolatileFields);
  }
  if (!isRuntimeRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !RUN_DEDUPE_IGNORED_KEYS.has(key))
      .map(([key, entry]) => [key, stripRunDedupeVolatileFields(entry)]),
  );
}

function sortRuntimeFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortRuntimeFingerprintValue);
  }
  if (!isRuntimeRecord(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, sortRuntimeFingerprintValue(entry)]),
  );
}

function agentRunDedupeFingerprint(value: unknown) {
  const record = isRuntimeRecord(value) ? value : {};
  const sessionPolicy = isRuntimeRecord(record.session_policy)
    ? record.session_policy
    : {};
  const fingerprintShape = {
    kind: record.kind ?? record.task_kind ?? null,
    input: stripRunDedupeVolatileFields(record.input ?? null),
    provider: record.provider ?? null,
    runtime: record.runtime ?? null,
    model: record.model ?? null,
    session_key: record.session_key ?? null,
    parent_run_id: record.parent_run_id ?? null,
    resume_from_run_id: record.resume_from_run_id ?? null,
    dispatch_mode: sessionPolicy.dispatch_mode ?? record.dispatch_mode ?? null,
  };

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sortRuntimeFingerprintValue(fingerprintShape)))
    .digest("hex");
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

/**
 * A provider id this runtime still has, or null. A record that names one it no
 * longer has (a session or profile saved before a provider was removed) is
 * treated as naming none, so the lane's own resolution applies; it is never
 * sent to an adapter that does not exist, nor rewritten to another pin.
 */
function knownAgentProvider(provider?: string | null): AgentProvider | null {
  switch (provider) {
    case "codex_local":
    case "openai_responses":
    case "openai_agents_api":
    case "openai_agents_sdk":
    case "anthropic_agent_sdk":
    case "acp_harness":
    case "openclaw":
    case "gemini_video":
      return provider;
    default:
      return null;
  }
}

function normalizeAgentProvider(provider?: AgentProvider): AgentProvider {
  switch (provider) {
    case "codex_local":
    case "openai_responses":
    case "openai_agents_api":
    case "openai_agents_sdk":
    case "anthropic_agent_sdk":
    case "acp_harness":
    case "openclaw":
    // Video lanes pin this provider and have their own executor below. Without
    // it here the pin was rewritten to codex_local, which the website host
    // cannot spawn, so every upload's privacy screen held and never handed off.
    case "gemini_video":
      return provider;
    default:
      return "codex_local";
  }
}

function defaultModelForProvider(provider: AgentProvider) {
  switch (provider) {
    case "codex_local":
      return process.env.CODEX_DEFAULT_MODEL?.trim() || "gpt-5.4-mini";
    case "openai_responses":
      return process.env.OPENAI_DEFAULT_MODEL?.trim() || "gpt-5.4";
    case "openai_agents_api":
    case "openai_agents_sdk":
      return "server-admitted-model";
    case "anthropic_agent_sdk":
      return getDefaultAnthropicModel();
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
  const pinned = knownAgentProvider(task.provider);
  const provider = pinned ?? normalizeAgentProvider(definition.default_provider);
  const runtime = (pinned ? knownAgentProvider(task.runtime) : null) || definition.default_runtime || provider;
  const model =
    (pinned ? task.model : undefined) ||
    definition.model_by_provider?.[provider] ||
    defaultModelForProvider(provider);

  // A task saved under a removed provider keeps that fact, so the common
  // execution check refuses it rather than running it on the lane.
  const savedRemoved = [task.provider, task.runtime].find((value) => isRemovedProviderId(value as string | undefined));
  return {
    ...task,
    ...(savedRemoved ? { metadata: { ...(task.metadata || {}), saved_removed_provider: savedRemoved } } : {}),
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
    /** The provider and runtime that served the run, when they differ from the task's (a switch on no funds). */
    servedBy?: { provider: AgentProvider; runtime: AgentProvider } | null;
  },
) {
  await recordOpsActionLog({
    session_id: params.sessionId || task.session_id || null,
    run_id: params.runId,
    session_key: task.session_key || null,
    action_key: params.actionKey,
    status: params.status,
    summary: params.summary,
    provider: params.servedBy?.provider ?? task.provider,
    runtime: params.servedBy?.runtime ?? task.runtime,
    task_kind: task.kind,
    risk_level: riskLevelForTask(task),
    reversible: !task.approval_policy.sensitive_actions.includes("destructive"),
    requires_approval: params.requiresApproval ?? false,
    latency_ms: params.latencyMs ?? null,
    metadata: params.metadata || {},
  });
}

/** The per-job site assessment ended (owner decision 2026-11-11). Every path
 * that could start one, queued, direct or through a session, refuses it before
 * any run record or spend. Retained records and readers are untouched. */
function refuseRetiredSiteAssessment(kind: string): void {
  if (kind === "site_assessment") throw new Error("site_assessment_retired");
}

/**
 * The data-class gate at the one place every provider call passes through.
 * Whatever chose the provider (the lane's resolution, a saved session, a
 * profile, the shadow setting, a caller's pin), a provider the Privacy Policy
 * that applies to the task's data does not name for every kind of data the
 * task sends is never called.
 */
/**
 * Which stored request a run's data belongs to, said ONLY by the server code
 * that loaded the data from that request (the `privacyRequestBinding` option
 * of `runAgentTask`). No route copies it from a request body, query or stored
 * caller metadata, and nothing in a task's `input` or `metadata` is read for
 * it. It is kept on the task under a module-private symbol, which no caller can
 * set and no JSON round trip carries, and stored on the run in its own field,
 * so a queued or approved run keeps it. A run without it is strictest.
 */
export type PrivacyRequestBinding = { request_id: string };
const PRIVACY_REQUEST_BINDING = Symbol("privacy_request_binding");
const storedVersionReads = new WeakMap<PrivacyRequestBinding, Promise<string>>();

function validPrivacyRequestBinding(value: unknown): PrivacyRequestBinding | null {
  const id = value && typeof value === "object" ? (value as Record<string, unknown>).request_id : undefined;
  return typeof id === "string" && id.trim() === id && id.length > 0 && id.length <= 200 && !id.includes("/")
    ? { request_id: id } : null;
}

function bindPrivacyRequest<T extends object>(task: T, binding: PrivacyRequestBinding | null): T {
  Object.defineProperty(task, PRIVACY_REQUEST_BINDING, { value: binding, enumerable: true, configurable: true, writable: false });
  return task;
}

function privacyRequestBindingOf(task: object): PrivacyRequestBinding | null {
  return (task as Record<symbol, PrivacyRequestBinding | null | undefined>)[PRIVACY_REQUEST_BINDING] ?? null;
}

/**
 * The Privacy Policy version a run's data was received under: the
 * `privacy_version_at_submission` the server wrote on the bound request when
 * the job was created (`server/routes/inbound-request.ts`). Absent, malformed
 * or unknown is older: the strictest table. Every job stored before that field
 * existed lacks it, so every such job is older by construction. A run with no
 * binding, or a read that fails, is strictest too. Read at most once per run.
 */
function storedPrivacyVersionForTask(task: object): Promise<string> {
  const binding = privacyRequestBindingOf(task);
  if (!binding || !db) return Promise.resolve(STRICTEST_PRIVACY_TABLE);
  const store = db;
  let read = storedVersionReads.get(binding);
  if (!read) {
    read = (async () => {
      try {
        const record = (await store.collection("inboundRequests").doc(binding.request_id).get()).data() as Record<string, unknown> | undefined;
        return resolvePrivacyVersion(record?.privacy_version_at_submission);
      } catch (error) {
        logger.warn({ err: error }, "The stored Privacy version could not be read; the strictest table applies");
        return STRICTEST_PRIVACY_TABLE;
      }
    })();
    storedVersionReads.set(binding, read);
  }
  return read;
}

async function privacyGateForTask(task: NormalizedAgentTask<unknown, unknown>) {
  const managedRuntime = (task.metadata?.managedRuntime ?? null) as Record<string, unknown> | null;
  const snapshot = (managedRuntime?.profileSnapshot ?? null) as Record<string, unknown> | null;
  const profileKey = typeof managedRuntime?.agentProfileKey === "string" ? managedRuntime.agentProfileKey
    : typeof snapshot?.key === "string" ? snapshot.key : null;
  const classes = [...new Set([...(LANE_DATA_CLASSES[task.kind]?.classes ?? ["site_job_text", "job_records", "personal_info", "staff_tools"]),
    ...((profileKey && PROFILE_DATA_CLASSES[profileKey]?.classes) || [])])] as AgentDataClass[];
  const decideOn = (version: string) => {
    const decide = (provider: AgentProvider) => privacyDecisionForClasses(provider, classes, version);
    const decision = decide(task.provider);
    const anyPermitted = (Object.keys(PROVIDER_DESTINATIONS) as AgentProvider[]).some((provider) => decide(provider).permitted);
    return { ...decision, reason: decision.permitted ? null : anyPermitted ? PRIVACY_NOT_PERMITTED : NO_PERMITTED_PROVIDER };
  };
  // The stored version is read only when the decision depends on it: a provider the strictest table permits needs no read.
  const strictest = decideOn(STRICTEST_PRIVACY_TABLE);
  if (strictest.permitted || !privacyRequestBindingOf(task)) return strictest;
  return decideOn(await storedPrivacyVersionForTask(task));
}

/**
 * A run saved under a removed provider, on the run itself or on its session,
 * is refused; otherwise null and the run follows its lane, through the
 * data-class gate.
 */
async function disabledProfileForRun(task: { provider?: unknown; runtime?: unknown; metadata?: Record<string, unknown> | null;
  session_id?: string | null }, sessionId?: string | null): Promise<RetainedRefusal | null> {
  // When the records cannot be read, the run fails closed and visibly.
  try {
    return await disabledProfileForRunUnchecked(task, sessionId);
  } catch (error) {
    logger.warn({ err: error }, "Agent run check could not read its session or profile; the run is refused");
    return { reason: "agent_run_check_unavailable", removed_provider: null, saved_on: "run", profile_id: null, profile_key: null };
  }
}

async function disabledProfileForRunUnchecked(task: { provider?: unknown; runtime?: unknown; metadata?: Record<string, unknown> | null;
  session_id?: string | null }, sessionId?: string | null): Promise<RetainedRefusal | null> {
  const sessionRecord = sessionId || task.session_id ? await getSession((sessionId || task.session_id)!) : null;
  // Saved under a removed provider: the run's own record (its saved provider
  // or runtime, kept in metadata once normalized) or its session.
  const savedOnRun = [task.provider, task.runtime, task.metadata?.saved_removed_provider]
    .find((value) => typeof value === "string" && isRemovedProviderId(value));
  const savedOnSession = sessionRecord ? [sessionRecord.provider, sessionRecord.runtime]
    .find((value) => typeof value === "string" && isRemovedProviderId(value)) : undefined;
  if (savedOnRun || savedOnSession) {
    return { reason: "agent_session_provider_removed", removed_provider: String(savedOnRun ?? savedOnSession),
      saved_on: savedOnRun ? "run" : "session", profile_id: null, profile_key: null };
  }
  return null;
}

type RetainedRefusal = {
  reason: "agent_profile_provider_removed" | "agent_session_provider_removed" | "agent_run_check_unavailable";
  removed_provider: string | null;
  saved_on: "run" | "session" | "profile";
  profile_id: string | null;
  profile_key: string | null;
};

function disabledProfileResult<TOutput>(task: { provider?: AgentProvider; runtime?: AgentProvider; model?: string;
  tool_policy?: { mode?: string } }, refusal: RetainedRefusal): AgentResult<TOutput> {
  return { status: "failed", provider: (task.provider ?? "codex_local") as AgentProvider,
    runtime: (task.runtime ?? task.provider ?? "codex_local") as AgentProvider, model: task.model ?? "unknown",
    tool_mode: (task.tool_policy?.mode ?? "api") as AgentResult<TOutput>["tool_mode"], requires_approval: false, requires_human_review: true,
    error: refusal.reason === "agent_profile_provider_removed" ? `${refusal.reason}: ${refusal.profile_key}`
      : refusal.reason === "agent_run_check_unavailable" ? `${refusal.reason}: the run's session or profile could not be read`
      : `${refusal.reason}: saved under ${refusal.removed_provider} on the ${refusal.saved_on}`,
    artifacts: { inference_not_invoked: true, agent_profile_refusal: refusal } };
}

type ExecuteHost = { runId: string; assertActive: () => Promise<void>; assertCostAllowed: () => Promise<void> };

/** The typed failure when a lane's provider has no funds and no other permitted, configured, priced provider is left. */
export const NO_PROVIDER_WITH_FUNDS = "no_provider_with_funds";

/** Nothing happened that a second provider could repeat: no response, no tool call, no charge, no fenced mutation. */
function attemptLeftNoTrace(result: AgentResult<unknown> | undefined): boolean {
  if (!result) return true;
  const artifacts = (result.artifacts ?? {}) as Record<string, unknown>;
  const reservation = (artifacts.inference_reservation ?? {}) as Record<string, unknown>;
  const responses = artifacts.provider_responses;
  const historyCalls = artifacts.company_history_tool_calls;
  return !(Array.isArray(responses) && responses.length)
    && !(Array.isArray(historyCalls) && historyCalls.length)
    && !(typeof reservation.reconciled_cost_usd === "number" && reservation.reconciled_cost_usd > 0)
    && artifacts.mutation_reconciliation_required !== true;
}

/**
 * Failover on "no funds" only. When the lane's provider answers that it has
 * no funds (classifyProviderError, the decided rows), or is cooling down after
 * saying so while another provider can take the run, the run moves once to
 * the next provider in the lane's order that the data-class gate permits for
 * the lane's data, that is configured and priced, and that enforces the
 * per-run cap (chooseFailoverProvider). A provider cooling down with nowhere
 * else to go is asked again: asking a provider with no funds costs nothing,
 * and the first run after a top-up must succeed. A run switches at most once,
 * never after its first provider answered, called a tool or may have charged
 * anything, and the switch is recorded in the run's artifacts
 * (`provider_failover`, with how the second attempt ended) and logs, which the
 * cost telemetry, run history and action log read. Any other error is
 * returned as it was. Server log lines carry ids and error codes only, never
 * the task's text.
 */
async function executeTask<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
  host?: ExecuteHost,
): Promise<AgentResult<TOutput>> {
  const mutationReconciliationRequired = requiresMutationReconciliation(task as unknown as Record<string, unknown>);
  const switchTo = (provider: AgentProvider): NormalizedAgentTask<TInput, TOutput> => ({ ...task, provider, runtime: provider,
    model: task.definition.model_by_provider?.[provider] || defaultModelForProvider(provider) });
  // The target may use the Privacy table of the job the run is bound to (its version at submission; anything else is
  // the strictest table), read only when the strictest table leaves no target. Lane resolution stays on the strictest
  // table, and the runtime gate re-checks the target.
  const chooseTarget = async () => {
    const strictest = chooseFailoverProvider(task.kind, task.provider, { mutationReconciliationRequired });
    if (strictest.provider || !privacyRequestBindingOf(task)) return strictest;
    return chooseFailoverProvider(task.kind, task.provider, { mutationReconciliationRequired,
      privacyVersion: await storedPrivacyVersionForTask(task) });
  };
  const structured = isStructuredProvider(task.provider);
  let classification: ProviderErrorClassification | null = null;
  let firstResult: AgentResult<TOutput> | undefined;
  let firstError: unknown;
  let trigger: "no_funds" | "cooling_down_no_funds" | null = null;
  let decision: FailoverDecision | null = null;

  if (structured && isProviderCoolingDown(task.provider)) {
    const target = await chooseTarget();
    if (target.provider) {
      trigger = "cooling_down_no_funds";
      decision = target;
    }
  }
  if (!trigger) {
    try {
      firstResult = await executeTaskOnProvider(task, host);
    } catch (error) {
      firstError = error;
    }
    classification = firstError !== undefined
      ? classifyProviderError(firstError, task.provider)
      : firstResult?.status === "failed"
        ? ((firstResult.artifacts as Record<string, unknown> | undefined)?.provider_error as ProviderErrorClassification | undefined) ?? null
        : null;
    if (classification?.error_class === "no_funds") {
      markProviderOutOfFunds(task.provider, classification);
      if (structured && attemptLeftNoTrace(firstResult as AgentResult<unknown> | undefined)) trigger = "no_funds";
    }
    if (!trigger) {
      if (firstError !== undefined) throw firstError;
      return firstResult!;
    }
  }

  decision ??= await chooseTarget();
  const errorFields = (value: ProviderErrorClassification | null) => ({ error_class: value?.error_class ?? null,
    http_status: value?.status ?? null, error_type: value?.type ?? null, error_code: value?.code ?? null });
  const record = { from_provider: task.provider, from_model: task.model, trigger,
    error: classification ? errorFields(classification) : null,
    to_provider: decision.provider, to_model: decision.provider ? switchTo(decision.provider).model : null,
    skipped: decision.skipped, first_attempt: firstResult ? {
      inference_reservation: (firstResult.artifacts as Record<string, unknown> | undefined)?.inference_reservation ?? null,
      known_usage_subtotals: (firstResult.artifacts as Record<string, unknown> | undefined)?.known_usage_subtotals ?? null,
    } : null };
  const log = { event_type: "provider.failover", status: decision.provider ? "info" : "error",
    summary: decision.provider ? `Switched from ${task.provider} to ${decision.provider} after no funds`
      : `${task.provider} has no funds and no other permitted, configured, priced provider is left`, ...record };
  // Ids and error codes only.
  const opsFields = { runId: host?.runId ?? null, taskKind: task.kind, fromProvider: task.provider,
    toProvider: decision.provider, trigger, errorClass: record.error?.error_class ?? null,
    httpStatus: record.error?.http_status ?? null, errorCode: record.error?.error_code ?? null };

  if (!decision.provider) {
    logger.error(opsFields, "Agent task failed: no provider with funds");
    return { status: "failed", provider: task.provider, runtime: task.runtime, model: task.model,
      tool_mode: task.tool_policy.mode, requires_approval: false, requires_human_review: true,
      error: `${NO_PROVIDER_WITH_FUNDS}: ${task.provider} has no funds and no other provider is permitted, configured and priced for ${task.kind}`,
      // True only when no request was sent to any provider in this run.
      artifacts: { ...((firstResult?.artifacts as Record<string, unknown> | undefined) ?? {}),
        inference_not_invoked: trigger === "cooling_down_no_funds", provider_failover: record },
      logs: [...(firstResult?.logs ?? []), log] };
  }

  logger.warn(opsFields, "Agent task switched provider after no funds");
  const switched = switchTo(decision.provider);
  let second: AgentResult<TOutput> | undefined;
  let secondError: unknown;
  // The second attempt is the last: whatever it does, no further switch.
  try {
    second = await executeTaskOnProvider(switched, host);
  } catch (error) {
    secondError = error;
  }
  const threw = secondError !== undefined;
  const secondClassification = threw ? classifyProviderError(secondError, switched.provider)
    : second!.status === "failed"
      ? ((second!.artifacts as Record<string, unknown> | undefined)?.provider_error as ProviderErrorClassification | undefined) ?? null
      : null;
  if (secondClassification?.error_class === "no_funds") markProviderOutOfFunds(switched.provider, secondClassification);
  const failoverRecord = { ...record, second_attempt: { threw, status: threw ? null : second!.status,
    ...errorFields(secondClassification) } };
  if (threw || second!.status === "failed") {
    logger.error({ ...opsFields, secondAttemptThrew: threw, secondErrorClass: secondClassification?.error_class ?? null,
      secondHttpStatus: secondClassification?.status ?? null, secondErrorCode: secondClassification?.code ?? null },
    "Agent task failed after switching provider");
  }

  if (threw) {
    // Recorded under the provider that last ran, with the switch, as a failed
    // run that needs a person, never as a cheaper or healthier run.
    const message = secondError instanceof Error ? secondError.message : "Unknown agent runtime error";
    return { status: "failed", provider: switched.provider, runtime: switched.runtime, model: switched.model,
      tool_mode: switched.tool_policy.mode, requires_approval: false, requires_human_review: true, error: message,
      artifacts: { provider_failover: failoverRecord, ...(secondClassification ? { provider_error: secondClassification } : {}) },
      logs: [...(firstResult?.logs ?? []), log, { event_type: "provider.second_attempt", status: "error",
        summary: `${switched.provider} failed on the second attempt`, provider: switched.provider, threw: true,
        ...errorFields(secondClassification) }] };
  }
  return { ...second!, provider: switched.provider, runtime: switched.runtime, model: second!.model || switched.model,
    artifacts: { ...((second!.artifacts as Record<string, unknown> | undefined) ?? {}), provider_failover: failoverRecord },
    logs: [...(firstResult?.logs ?? []), log, ...(second!.logs ?? [])] };
}

async function executeTaskOnProvider<TInput, TOutput>(
  task: NormalizedAgentTask<TInput, TOutput>,
  host?: ExecuteHost,
): Promise<AgentResult<TOutput>> {
  refuseRetiredSiteAssessment(task.kind);
  // The one point every provider call and every operator tool passes: a run of
  // a disabled profile (agent-profiles) is refused here whatever started it.
  const profileRefusal = await disabledProfileForRun(task);
  if (profileRefusal) return disabledProfileResult<TOutput>(task, profileRefusal);
  if (requiresMutationReconciliation(task as unknown as Record<string, unknown>) && task.provider !== "openai_responses") {
    return { status: "failed", provider: task.provider, runtime: task.runtime, model: task.model,
      tool_mode: task.tool_policy.mode, requires_approval: false, requires_human_review: true,
      error: `mutation_reconciliation_required: ${task.provider} cannot enforce the recorded mutation barrier. Inspect existing effects through the OpenAI Responses safe-read context or reconcile them before resuming this provider.`,
      artifacts: { mutation_reconciliation_required: true, inference_not_invoked: true },
      continuation_state: { mutation_reconciliation_required: true,
        ...(Array.isArray(task.metadata?.openai_replay_input) ? { openai_replay_input: task.metadata.openai_replay_input } : {}),
      },
    };
  }
  const privacyGate = await privacyGateForTask(task as unknown as NormalizedAgentTask<unknown, unknown>);
  if (!privacyGate.permitted) {
    return { status: "failed", provider: task.provider, runtime: task.runtime, model: task.model,
      tool_mode: task.tool_policy.mode, requires_approval: false, requires_human_review: true,
      error: `${privacyGate.reason}: Privacy Policy ${privacyGate.version} does not name ${task.provider} for ${privacyGate.blocked_by.join(", ")}`,
      artifacts: { inference_not_invoked: true, privacy_gate: { reason: privacyGate.reason, provider: task.provider,
        privacy_policy_version: privacyGate.version, data_classes: privacyGate.data_classes, blocked_by: privacyGate.blocked_by } } };
  }
  if (task.provider === "openai_responses") {
    const { runOpenAIResponsesTask } = await import("./adapters/openai-responses");
    return runOpenAIResponsesTask(task);
  }

  if (task.provider === "anthropic_agent_sdk") {
    const { runAnthropicAgentSdkTask } = await import("./adapters/anthropic-agent-sdk");
    return runAnthropicAgentSdkTask(task);
  }

  if (task.provider === "gemini_video") {
    const { runGeminiVideoTask } = await import("./adapters/gemini-video");
    return runGeminiVideoTask(task);
  }

  return { status: "failed", provider: task.provider, runtime: task.runtime, model: task.model,
    tool_mode: task.tool_policy.mode, requires_approval: false, requires_human_review: true,
    error: `${task.provider} has no adapter`, artifacts: { inference_not_invoked: true } };
}

async function saveSession(session: PersistedAgentSession, preserveCancelledSession = false) {
  if (!db) {
    return;
  }
  await persistAgentEvidence(db.collection("agentSessions").doc(session.id), { collection: "agentSessions", id: session.id }, stripUndefinedDeep(session), db, { preserveCancelledSession });
}

/** Lengths and a digest in place of content. */
function contentDigest(value: unknown) {
  if (value === undefined || value === null) return value;
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  return { redacted: true, chars: text.length, sha256: crypto.createHash("sha256").update(text).digest("hex") };
}

// Keys under which the adapters keep a model's answer in a run's artifacts and logs.
const MODEL_CONTENT_KEYS = new Set(["output", "output_text", "rawOutput", "raw_output_text", "content"]);

function redactModelContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactModelContent);
  if (!isRuntimeRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key,
    MODEL_CONTENT_KEYS.has(key) ? contentDigest(entry) : redactModelContent(entry)]));
}

function storesContentRedacted(kind: unknown) {
  return typeof kind === "string" && getTaskDefinition(kind as AgentTaskKind)?.persist_content === "redacted";
}

/**
 * What a run row stores of a task and its result. For a lane whose definition
 * says `persist_content: "redacted"`, the task's input, the output, the raw
 * output text and the model's answer inside artifacts and logs are stored as
 * lengths and a digest; every other field (cost, usage, model, provider,
 * status, timings, failover, metadata) is stored as it is.
 */
function storedRunContent<T extends Record<string, unknown>>(kind: unknown, fields: T): T {
  if (!storesContentRedacted(kind)) return fields;
  const stored: Record<string, unknown> = { ...fields };
  if ("input" in stored) {
    stored.input = isRuntimeRecord(stored.input) && "input" in stored.input
      ? { ...stored.input, input: contentDigest(stored.input.input) } : contentDigest(stored.input);
  }
  if ("output" in stored) stored.output = contentDigest(stored.output);
  if ("raw_output_text" in stored) stored.raw_output_text = contentDigest(stored.raw_output_text);
  if ("artifacts" in stored) stored.artifacts = redactModelContent(stored.artifacts);
  if ("logs" in stored) stored.logs = redactModelContent(stored.logs);
  return stored as T;
}

/** The typed refusal for a redacted-content lane on a path that would replay its stored input. */
export const REDACTED_CONTENT_NOT_REPLAYABLE = "redacted_content_not_replayable";

/**
 * A failure of a lane that stores its content redacted, as it is stored and
 * logged: the error's class, HTTP status and code (classifyProviderError), the
 * exception's type name, and lengths and a digest of the message. Never the
 * message itself, which may quote the site's text or the model's answer.
 */
function redactedFailure(error: unknown, provider: AgentProvider, classification?: ProviderErrorClassification | null) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : String(error ?? "");
  const classified = classification ?? classifyProviderError(error, provider);
  // The evidence store's own errors are codes written in this code base.
  const code = error instanceof AgentEvidenceError ? error.message : classified.code;
  const detail = { error_class: classified.error_class, http_status: classified.status, error_code: code,
    exception_type: error instanceof Error ? error.name : null, message: contentDigest(message) };
  const summary = `agent_run_failed: ${classified.error_class}`
    + (classified.status !== null ? ` http ${classified.status}` : "") + (code ? ` ${code}` : "");
  return { summary, detail };
}

/** The classification a returned failure carries in its artifacts, when the adapter or a switch recorded one. */
function returnedFailureClassification(result: AgentResult<unknown>): ProviderErrorClassification | null {
  const artifacts = (result.artifacts ?? {}) as Record<string, unknown>;
  if (artifacts.provider_error && typeof artifacts.provider_error === "object") return artifacts.provider_error as ProviderErrorClassification;
  const failover = artifacts.provider_failover as { error?: { error_class?: string; http_status?: number | null;
    error_type?: string | null; error_code?: string | null } | null } | undefined;
  return failover?.error?.error_class ? { error_class: failover.error.error_class as ProviderErrorClassification["error_class"],
    provider: result.provider, sdk: "unknown", status: failover.error.http_status ?? null, type: failover.error.error_type ?? null,
    code: failover.error.error_code ?? null } : null;
}

async function saveRun(run: PersistedAgentRun) {
  if (!db) {
    return;
  }
  await persistAgentEvidence(db.collection("agentRuns").doc(run.id), { collection: "agentRuns", id: run.id },
    stripUndefinedDeep(storedRunContent(run.task_kind, run as unknown as Record<string, unknown>)), db);
}

async function getRun(runId: string) {
  if (!db) {
    return null;
  }
  const doc = await db.collection("agentRuns").doc(runId).get();
  if (!doc.exists) {
    return null;
  }
  return hydrateAgentEvidence(doc.data() as PersistedAgentRun, { collection: "agentRuns", id: runId });
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
  return Promise.all(snapshot.docs.map(async (doc) => {
    const raw = { ...(doc.data() as PersistedAgentRun), id: doc.id };
    if ((raw as unknown as Record<string, unknown>).agent_accounting_incomplete === true) throw new AgentEvidenceError("agent_usage_evidence_unavailable", { collection: "agentRuns", id: doc.id });
    return hydrateAgentEvidence(raw, { collection: "agentRuns", id: doc.id });
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
  // After a switch on "no funds" the run is costed as the provider and model that served it.
  const switched = Boolean((params.result.artifacts as Record<string, unknown> | undefined)?.provider_failover);
  return {
    id: params.runId,
    session_id: params.sessionId || params.task.session_id || null,
    session_key: params.task.session_key || null,
    task_kind: params.task.kind,
    provider: switched ? params.result.provider : params.task.provider,
    runtime: switched ? params.result.runtime : params.task.runtime,
    model: switched ? params.result.model : params.task.model,
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
  return hydrateAgentEvidence(doc.data() as PersistedAgentSession, { collection: "agentSessions", id: sessionId });
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
    snapshot: stripUndefinedDeep(params.snapshot),
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

async function markRunStatus(
  runId: string,
  status: AgentRunStatus,
  updates?: Record<string, unknown>,
) {
  if (!db) {
    return;
  }

  await persistAgentEvidence(db.collection("agentRuns").doc(runId), { collection: "agentRuns", id: runId },
    stripUndefinedDeep({
      status,
      updated_at: nowTimestamp(),
      ...(status === "running" ? { started_at: nowTimestamp() } : {}),
      ...(status === "completed" ? { completed_at: nowTimestamp() } : {}),
      ...(status === "cancelled" ? { cancelled_at: nowTimestamp() } : {}),
      ...updates,
    }), db,
  );
}

/**
 * Runs a session's queue in order. One bad record cannot block the queue: a
 * run whose dispatch throws (for example a refused retained run whose
 * "failed" mark could not be written) is logged, marked failed where that can
 * be written, left visible, and skipped for the rest of this dispatch.
 */
async function dispatchQueuedRuns(sessionKey: string, skipped: Set<string> = new Set()): Promise<AgentResult<unknown> | PersistedAgentRun | null> {
  if (!db) {
    return null;
  }

  // Only the status is needed here, so the record is not hydrated: a run whose
  // private evidence cannot be read must not stop the queue at this step.
  const active = await db.collection("agentRuns").where("session_key", "==", sessionKey)
    .where("status", "in", ["running", "pending_approval"]).limit(skipped.size + 1).get();
  const activeRun = active.docs.find((doc) => !skipped.has(doc.id));
  if (activeRun) {
    return { id: activeRun.id, ...(activeRun.data() as object) } as PersistedAgentRun;
  }

  const queuedSnapshot = await db
    .collection("agentRuns")
    .where("session_key", "==", sessionKey)
    .where("status", "==", "queued")
    .orderBy("created_at", "asc")
    .limit(skipped.size + 1)
    .get();

  const next = queuedSnapshot.docs.find((doc) => !skipped.has(doc.id));
  if (!next) {
    return null;
  }

  let result: AgentResult<unknown>;
  try {
    const runRecord = await hydrateAgentEvidence(next.data() as PersistedAgentRun, { collection: "agentRuns", id: next.id });
    await markRunStatus(runRecord.id, "running");
    result = await runAgentTask(runRecord.input as AgentTask, {
      runId: runRecord.id,
      sessionId: runRecord.session_id || null,
      dispatchQueuedOnFinish: false,
      privacyRequestBinding: validPrivacyRequestBinding(runRecord.privacy_request_binding),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn({ runId: next.id, sessionKey, reason }, "Queued agent run could not be dispatched; skipped so the queue continues");
    const failure = { error: `agent_run_dispatch_failed: ${reason}`, requires_human_review: true };
    await markRunStatus(next.id, "failed", failure)
      // A record whose evidence cannot be rewritten still gets a plain status write.
      .catch(() => db!.collection("agentRuns").doc(next.id).set({ status: "failed", ...failure, updated_at: nowTimestamp() }, { merge: true }))
      .catch((markError) => logger.warn({ runId: next.id, err: markError }, "Could not mark the skipped run failed; it stays visible"));
    skipped.add(next.id);
    return dispatchQueuedRuns(sessionKey, skipped);
  }

  if (result.status !== "pending_approval") {
    await dispatchQueuedRuns(sessionKey, skipped);
  }

  return result;
}

async function sessionRequiresMutationReconciliation(sessionId: string) {
  if (!db) return false;
  const session = await db.collection("agentSessions").doc(sessionId).get();
  if (session.exists && session.data()?.mutation_reconciliation_required === true) return true;
  // Also cover a partially failed marker write and already queued tasks.
  const runs = await db.collection("agentRuns").where("session_id", "==", sessionId)
    .where("mutation_reconciliation_required", "==", true).limit(1).get();
  return !runs.empty;
}

export async function runAgentTask<TInput = unknown, TOutput = unknown>(
  task: AgentTask<TInput>,
  options?: {
    runId?: string;
    sessionId?: string | null;
    dispatchQueuedOnFinish?: boolean;
    /** The stored request this run's data was loaded from, set only by server code (see PrivacyRequestBinding). */
    privacyRequestBinding?: PrivacyRequestBinding | null;
  },
): Promise<AgentResult<TOutput>> {
  // Durable ADP tasks use the task controller and its worker. A chat message
  // cannot turn an admitted task reference into a new free-form model call.
  if (task.provider === "openai_agents_api" || task.provider === "openai_agents_sdk") {
    throw new Error("adp_agent_use_admitted_task_controller");
  }
  // The per-job site assessment ended (owner decision 2026-11-11). No path,
  // queued or direct, may start one: refuse before any run record or spend.
  refuseRetiredSiteAssessment(task.kind);
  // A lane that stores its content redacted runs at once or not at all: its
  // stored input is a digest, so no path that replays a stored input (a
  // session, its queue, approval, resume) and no session checkpoint or event
  // may carry it. Refused before anything is stored or sent.
  if (storesContentRedacted(task.kind)) {
    const definition = getTaskDefinition(task.kind);
    const approval = requiresApproval(task, mergeApprovalPolicy(definition.approval_policy, task.approval_policy));
    const replayable = [task.session_key ? "session_key" : null, task.session_id || options?.sessionId ? "session" : null,
      options?.runId ? "existing_run" : null, task.resume_from_run_id ? "resume" : null, approval.required ? "approval" : null]
      .filter((value): value is string => Boolean(value));
    if (replayable.length) {
      return { status: "failed", provider: (knownAgentProvider(task.provider) ?? definition.default_provider) as AgentProvider,
        runtime: (knownAgentProvider(task.provider) ?? definition.default_provider) as AgentProvider,
        model: task.model ?? "unknown", tool_mode: "api", requires_approval: false, requires_human_review: true,
        error: `${REDACTED_CONTENT_NOT_REPLAYABLE}: ${task.kind} stores its content redacted and cannot run with ${replayable.join(", ")}`,
        artifacts: { inference_not_invoked: true, refusal_reason: REDACTED_CONTENT_NOT_REPLAYABLE, refused_paths: replayable } };
    }
  }
  // A run of a disabled profile (saved before its provider was removed, then
  // dispatched from the queue, approved, resumed, retried, forked, delegated
  // or woken) is refused before its saved provider is rerouted to the lane,
  // before approval, and before any adapter or tool. A retained run record
  // ends failed, with the reason, so it is never dispatched again.
  {
    const refusal = await disabledProfileForRun(task as { metadata?: Record<string, unknown> | null; session_id?: string | null },
      options?.sessionId);
    if (refusal) {
      const refused = disabledProfileResult<TOutput>(task as never, refusal);
      if (db && options?.runId && await getRun(options.runId)) {
        await markRunStatus(options.runId, "failed", { error: refused.error, artifacts: refused.artifacts,
          requires_human_review: true });
      }
      return refused;
    }
  }
  const privacyRequestBinding = validPrivacyRequestBinding(options?.privacyRequestBinding);
  const normalizedTask = bindPrivacyRequest(normalizeTask<TInput, TOutput>(task), privacyRequestBinding);
  const admissionSessionId = options?.sessionId || normalizedTask.session_id;
  if (admissionSessionId && await sessionRequiresMutationReconciliation(admissionSessionId)) {
    normalizedTask.metadata = { ...(normalizedTask.metadata || {}), mutation_reconciliation_required: true };
  }
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
        dedupe_fingerprint: agentRunDedupeFingerprint(normalizedTask),
        privacy_request_binding: privacyRequestBinding,
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
      dedupe_fingerprint: agentRunDedupeFingerprint(normalizedTask),
      privacy_request_binding: privacyRequestBinding,
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
        dedupe_fingerprint: agentRunDedupeFingerprint(normalizedTask),
        privacy_request_binding: privacyRequestBinding,
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

  const accountingOnly = ACCOUNTING_ONLY_TASK_KINDS.has(normalizedTask.kind);
  let preRunCostStop;
  try {
    if (!accountingOnly) preRunCostStop = await evaluatePreRunCostStop({
      task: normalizedTaskForLogs,
      runId,
      sessionId: options?.sessionId || normalizedTask.session_id || null,
    });
  } catch (error) {
    const message = error instanceof AgentEvidenceError ? error.message : "agent_spend_evidence_unavailable";
    await markRunStatus(runId, "failed", { error: message, requires_human_review: true }).catch(() => undefined);
    return { status: "failed", provider: normalizedTask.provider, runtime: normalizedTask.runtime,
      model: normalizedTask.model, tool_mode: normalizedTask.tool_policy.mode,
      error: message, requires_human_review: true, requires_approval: false,
      artifacts: { inference_not_invoked: true, cost_evidence_unavailable: true,
        ...(requiresMutationReconciliation(normalizedTask as unknown as Record<string, unknown>) ? { mutation_reconciliation_required: true } : {}),
      },
    };
  }
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

  let retainedAdapterResult: AgentResult<TOutput> | undefined;
  try {
    const startedAtMs = Date.now();
    const assertActive = async () => {
      const run = await db?.collection("agentRuns").doc(runId).get();
      const sessionId = options?.sessionId || normalizedTask.session_id;
      const session = sessionId ? await db?.collection("agentSessions").doc(sessionId).get() : null;
      if (run?.data()?.status === "cancelled" || session?.data()?.status === "cancelled") throw new Error("site_assessment_cancelled");
      if (run?.data()?.status !== "running") throw new Error("site_assessment_run_not_active");
    };
    const result = await executeTask(normalizedTask, { runId, assertActive, assertCostAllowed: async () => {
      if (accountingOnly) return;
      const check = await evaluatePreRunCostStop({ task: normalizedTaskForLogs, runId,
        sessionId: options?.sessionId || normalizedTask.session_id || null });
      if (check?.stopped) throw new Error("site_assessment_runtime_cost_stop");
    } });
    if (storesContentRedacted(normalizedTask.kind) && typeof result.error === "string" && result.error) {
      const failure = redactedFailure(result.error, result.provider, returnedFailureClassification(result as AgentResult<unknown>));
      failure.detail.exception_type = null;
      result.error = failure.summary;
      result.artifacts = { ...(result.artifacts || {}), failure_detail: failure.detail };
    }
    retainedAdapterResult = result as AgentResult<TOutput>;
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

    if (db && requiresMutationReconciliation(result as unknown as Record<string, unknown>)) {
      // Compact marker must land before any potentially oversized evidence write.
      const sessionId = options?.sessionId || normalizedTask.session_id;
      if (sessionId) await db.collection("agentSessions").doc(sessionId).set({ mutation_reconciliation_required: true }, { merge: true });
      await db.collection("agentRuns").doc(runId).set({ mutation_reconciliation_required: true }, { merge: true });
    }

    if (db) {
      await markRunStatus(runId, status, {
        // The run's history names the provider and model that served it after a switch.
        ...((result.artifacts as Record<string, unknown> | undefined)?.provider_failover
          ? { provider: result.provider, runtime: result.runtime, model: result.model } : {}),
        ...storedRunContent(normalizedTask.kind, {
          output: result.output,
          raw_output_text: result.raw_output_text || null,
          artifacts: result.artifacts || null,
          logs: result.logs || null,
        }),
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
      const summary = accountingOnly
        ? `Recorded agent spend in ${spendAlert.windowKey}: $${spendAlert.window.cost_usd.toFixed(4)}; spending does not gate this customer assessment.`
        : `Agent spend ${spendAlert.status} threshold in ${spendAlert.windowKey}: $${spendAlert.window.cost_usd.toFixed(4)}.`;
      await logRunEvent(normalizedTaskForLogs, {
        runId,
        sessionId: options?.sessionId || normalizedTask.session_id || null,
        actionKey: "agent.run.cost_guardrail",
        status: !accountingOnly && spendAlert.status === "stop" ? "failed" : "info",
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
          kind: accountingOnly ? "run.cost.recorded" : `run.cost_guardrail.${spendAlert.status}`,
          status: accountingOnly ? "info" : spendAlert.status === "stop" ? "error" : "warning",
          summary,
          metadata: {
            cost_telemetry: costTelemetry,
            cost_guardrail: costGuardrail,
          },
        });
      }
    }

    // After a switch on no funds, the row names the provider that served the run and says so.
    const failover = (result.artifacts as Record<string, unknown> | undefined)?.provider_failover as
      { from_provider?: string; to_provider?: string | null } | undefined;
    const outcomeSummary = status === "completed"
      ? `${normalizedTask.kind} completed`
      : result.error || `${normalizedTask.kind} finished with status ${status}`;
    await logRunEvent(normalizedTaskForLogs, {
      runId,
      sessionId: options?.sessionId || normalizedTask.session_id || null,
      actionKey: "agent.run.execute",
      status: status === "failed" ? "failed" : status === "pending_approval" ? "pending_approval" : "completed",
      summary: failover?.to_provider
        ? `${outcomeSummary} (switched from ${failover.from_provider} to ${failover.to_provider} after no funds)`
        : outcomeSummary,
      servedBy: failover ? { provider: result.provider, runtime: result.runtime } : null,
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
    const redactedError = storesContentRedacted(normalizedTask.kind) ? redactedFailure(error, normalizedTask.provider) : null;
    const message = redactedError ? redactedError.summary
      : error instanceof Error ? error.message : "Unknown agent runtime error";

    if (db) {
      await persistAgentEvidenceFailure(db.collection("agentRuns").doc(runId), { collection: "agentRuns", id: runId }, {
        status: retainedAdapterResult && requiresMutationReconciliation(retainedAdapterResult as unknown as Record<string, unknown>) ? "running" : "failed",
        updated_at: nowTimestamp(),
        ...(retainedAdapterResult ? { artifact_persistence_error: "agent_evidence_persistence_failed", ...(requiresMutationReconciliation(retainedAdapterResult as unknown as Record<string, unknown>) ? { mutation_reconciliation_required: true } : {}) } : {}),
        error: message,
        ...(redactedError ? { failure_detail: redactedError.detail } : {}),
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
      }, error, db).catch(() => undefined);
    }

    logger.error(
      {
        ...requestMeta,
        runId,
        ...(redactedError ? { failure: redactedError.detail } : { err: error }),
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
        ...(redactedError ? { failure: redactedError.detail } : {}),
        ...((((normalizedTask.metadata || {}) as Record<string, unknown>)
          .resolved_startup_context as Record<string, unknown> | undefined) || {}),
      },
    }).catch(() => undefined);

    if (options?.sessionId) {
      const session = await getSession(options.sessionId).catch(() => null);
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
        }).catch(() => null);
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
      }).catch(() => null);
    }

    if (retainedAdapterResult) {
      return { ...retainedAdapterResult, status: "failed", requires_human_review: true,
        error: error instanceof AgentEvidenceError ? error.message : "agent_evidence_persistence_failed",
        artifacts: { ...(retainedAdapterResult.artifacts || {}), artifact_persistence_error: true, ...(error instanceof AgentEvidenceError && error.evidenceReference ? { private_evidence_reference: error.evidenceReference } : {}) },
      };
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
