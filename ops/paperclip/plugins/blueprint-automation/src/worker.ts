import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  definePlugin,
  runWorker,
  type Agent,
  type Company,
  type Issue,
  type PaperclipPlugin,
  type PluginContext,
  type PluginEntityRecord,
  type PluginHealthDiagnostics,
  type PluginJobContext,
  type PluginWorkspace,
  type ToolResult,
  type ToolRunContext,
  type PluginWebhookInput,
  type Project,
} from "@paperclipai/plugin-sdk";
import yaml from "js-yaml";
import {
  ACTION_KEYS,
  DATA_KEYS,
  DEFAULT_COMPANY_NAME,
  DEFAULT_REPO_CATALOG,
  JOB_KEYS,
  ORIGIN_KIND,
  PLUGIN_ID,
  STATE_KEYS,
  TOOL_NAMES,
  WEBHOOK_KEYS,
} from "./constants.js";
import {
  handleFirestoreWebhook,
  handleStripeWebhook,
  handleSupportWebhook,
} from "./ops-webhooks.js";
import {
  buildNotionToolHandlers,
  createKnowledgeEntry,
  createNotionClient,
  createWorkQueueItem,
  queryWorkQueue,
} from "./notion.js";
import { buildSlackToolHandler, postSlackDigest } from "./slack-notify.js";
import { buildWebSearchToolHandler } from "./web-search.js";
import {
  buildClaudeFallbackAdapterConfig,
  buildCodexFallbackAdapterConfig,
  buildQuotaFallbackRetryRecord,
  getLocalAdapterWorkspaceKey,
  getWorkspaceAdapterCooldownKey,
  isQuotaOrRateLimitFailure,
  resolveQuotaCooldownUntil,
  selectWorkspaceQuotaFallbackTargets,
  type LocalQuotaFallbackAdapterType,
  type QuotaFallbackRetryState,
  type WorkspaceAdapterCooldownRecord,
  type WorkspaceAdapterCooldownState,
} from "./quota-fallback.js";

const execFileAsync = promisify(execFile);
const GIT_BIN = process.env.BLUEPRINT_PAPERCLIP_GIT_BIN || "/usr/bin/git";
const CODEX_FALLBACK_MODEL =
  process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL || "gpt-5.4-mini";
const CODEX_FALLBACK_REASONING_EFFORT =
  process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT || "xhigh";
const WORKSPACE_QUOTA_COOLDOWN_MS =
  Number(process.env.BLUEPRINT_PAPERCLIP_WORKSPACE_QUOTA_COOLDOWN_MS || "") || 6 * 60 * 60 * 1000;
const ENTITY_TYPES = {
  sourceMapping: "source-mapping",
} as const;
// STATE_KEYS imported from ./constants.js

type RepoConfig = {
  key: string;
  projectName: string;
  githubRepo: string;
  defaultBranch: string;
  implementationAgent: string;
  reviewAgent: string;
};

type OpsDepartmentConfig = {
  enabled: boolean;
  agents: {
    opsLead: string;
    intake: string;
    captureQa: string;
    fieldOps: string;
    financeSupport: string;
  };
};

type GrowthDepartmentConfig = {
  enabled: boolean;
  agents: {
    growthLead: string;
    conversionOptimizer: string;
    analytics: string;
    marketIntel: string;
    demandIntel: string;
    robotTeamGrowth: string;
    siteOperatorPartnership: string;
    cityDemand: string;
  };
};

type SecretRefsConfig = {
  notionApiTokenRef?: string;
  slackOpsWebhookUrlRef?: string;
  slackGrowthWebhookUrlRef?: string;
  searchApiKeyRef?: string;
  searchApiProviderRef?: string;
};

type BlueprintAutomationConfig = {
  companyName?: string;
  githubOwner?: string;
  githubTokenRef?: string;
  githubWebhookSecretRef?: string;
  ciSharedSecretRef?: string;
  intakeSharedSecretRef?: string;
  notificationWebhookUrlRef?: string;
  enableGitRepoScanning?: boolean;
  enableGithubPolling?: boolean;
  enableOutboundNotifications?: boolean;
  repoCatalog?: RepoConfig[];
  opsDepartment?: OpsDepartmentConfig;
  growthDepartment?: GrowthDepartmentConfig;
  secrets?: SecretRefsConfig;
};

type AgentRunFailurePayload = {
  agentId: string | null;
  runId: string | null;
  issueId: string | null;
  taskId: string | null;
  taskKey: string | null;
  error: string | null;
};

type SourceMappingData = {
  fingerprint: string;
  issueId: string;
  sourceType: string;
  sourceId: string;
  projectName: string;
  assignee: string;
  signalUrl?: string;
  hits: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolutionStatus?: string | null;
  metadata?: Record<string, unknown>;
};

type RecentEvent = {
  id: string;
  kind: string;
  title: string;
  fingerprint?: string;
  issueId?: string;
  createdAt: string;
  detail?: string;
};

type GitRepoScanSummary = {
  repoKey: string;
  projectName: string;
  branch: string;
  changedFiles: number;
  untrackedFiles: number;
  ahead: number;
  behind: number;
};

type DashboardData = {
  companyId: string;
  companyName: string;
  pluginId: string;
  lastScan: Record<string, unknown> | null;
  recentEvents: RecentEvent[];
  openManagedIssues: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assigneeAgentId: string | null;
    updatedAt: string;
  }>;
  sourceMappings: Array<{
    externalId: string | null;
    title: string | null;
    status: string | null;
    issueId: string | null;
    hits: number;
    lastSeenAt: string | null;
  }>;
};

type AnalyticsReportCadence = "daily" | "weekly";

type AnalyticsStructuredReport = {
  headline: string;
  summaryBullets: string[];
  workflowFindings: string[];
  risks: string[];
  recommendedFollowUps: string[];
};

type AnalyticsOutputProof = {
  success: boolean;
  outcome: "done" | "blocked";
  failureReason?: string;
  cadence: AnalyticsReportCadence;
  generatedAt: string;
  title: string;
  report: AnalyticsStructuredReport;
  dataAvailability: Array<{
    source: string;
    status: "available" | "missing";
    detail: string;
  }>;
  notion?: {
    workQueuePageId?: string;
    workQueuePageUrl?: string;
    knowledgePageId?: string;
    knowledgePageUrl?: string;
  };
  slack?: {
    ok: boolean;
    routedChannel: string;
    target: "ops" | "growth" | "default" | "none";
    statusCode?: number;
    responseBody?: string;
  };
  proofLinks: string[];
  issueComment: string;
  errors: string[];
};

// ── Demand Intel Types ─────────────────────────────────

type DemandIntelReportCadence = "daily" | "weekly";

type DemandIntelLane =
  | "robot-team-demand"
  | "site-operator-lane"
  | "city-demand"
  | "cross-lane";

type DemandIntelConfidence = "high" | "medium" | "low";

type DemandIntelStructuredReport = {
  headline: string;
  topic: string;
  lane: DemandIntelLane;
  companyOrPattern: string;
  city: string;
  signals: string[];
  proofRequirements: string[];
  channelFindings: string[];
  partnershipFindings: string[];
  recommendedActions: string[];
  confidence: DemandIntelConfidence;
  openQuestions: string[];
};

type DemandIntelOutputProof = {
  success: boolean;
  outcome: "done" | "blocked";
  failureReason?: string;
  cadence: DemandIntelReportCadence;
  generatedAt: string;
  title: string;
  report: DemandIntelStructuredReport;
  notion?: {
    workQueuePageId?: string;
    workQueuePageUrl?: string;
    knowledgePageId?: string;
    knowledgePageUrl?: string;
  };
  slack?: {
    ok: boolean;
    routedChannel: string;
    target: "ops" | "growth" | "default" | "none";
    statusCode?: number;
    responseBody?: string;
  };
  proofLinks: string[];
  issueComment: string;
  errors: string[];
};

// ── Monitoring, Budget & Phase Types ───────────────────

type RoutineHealthEntry = {
  routineKey: string;
  routineTitle: string;
  agentKey: string;
  lastOutcome: "done" | "blocked" | "unknown";
  lastRunAt: string;
  lastSuccessAt: string | null;
  lastFailureReason: string | null;
  consecutiveFailures: number;
  expectedIntervalHours: number | null;
  lastIssueId: string | null;
};

type RoutineHealthState = Record<string, RoutineHealthEntry>;

type BudgetTrackingState = {
  period: string;
  agents: Record<string, { runs: number; estimatedCostUsd: number }>;
};

type PhaseTrackingEntry = {
  currentPhase: number;
  phaseStartDate: string;
  metrics: {
    totalRuns: number;
    successfulRuns: number;
    overrideCount: number;
    overrideRate: number;
    consecutiveSuccesses: number;
    lastRunAt: string | null;
  };
};

type PhaseTrackingState = Record<string, PhaseTrackingEntry>;

type PaperclipYamlAgentConfig = {
  budgetMonthlyCents?: number;
  adapter?: {
    type?: string;
    config?: {
      cwd?: string;
      model?: string;
      modelReasoningEffort?: string;
      timeoutSec?: number;
      dangerouslySkipPermissions?: boolean;
      dangerouslyBypassApprovalsAndSandbox?: boolean;
      paperclipSkillSync?: Record<string, unknown>;
    };
  };
};

type PaperclipYamlRoutineTrigger = {
  kind?: string;
  cronExpression?: string;
};

type PaperclipYamlRoutineConfig = {
  agent?: string;
  triggers?: PaperclipYamlRoutineTrigger[];
};

type PaperclipYamlConfig = {
  agents?: Record<string, PaperclipYamlAgentConfig>;
  routines?: Record<string, PaperclipYamlRoutineConfig>;
};

// ── Market Intel Types ─────────────────────────────────

type MarketIntelReportCadence = "daily" | "weekly";

type MarketIntelSignal = {
  title: string;
  source: string;
  relevanceScore: number;
  urgencyScore: number;
  actionabilityScore: number;
  combinedScore: number;
  summary: string;
};

type MarketIntelStructuredReport = {
  headline: string;
  signals: MarketIntelSignal[];
  competitorUpdates: string[];
  technologyFindings: string[];
  recommendedActions: string[];
};

type MarketIntelOutputProof = {
  success: boolean;
  outcome: "done" | "blocked";
  failureReason?: string;
  cadence: MarketIntelReportCadence;
  generatedAt: string;
  title: string;
  report: MarketIntelStructuredReport;
  notion?: {
    workQueuePageId?: string;
    workQueuePageUrl?: string;
    knowledgePageId?: string;
    knowledgePageUrl?: string;
  };
  slack?: {
    ok: boolean;
    routedChannel: string;
    target: "ops" | "growth" | "default" | "none";
    statusCode?: number;
    responseBody?: string;
  };
  proofLinks: string[];
  issueComment: string;
  errors: string[];
};

type UpsertManagedIssueInput = {
  companyId: string;
  sourceType: string;
  sourceId: string;
  title: string;
  description: string;
  projectName: string;
  assignee: string;
  priority?: "critical" | "high" | "medium" | "low";
  status?: "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done" | "cancelled";
  parentIssueId?: string;
  signalUrl?: string;
  metadata?: Record<string, unknown>;
  comment?: string;
  suppressRefreshComment?: boolean;
};

type ResolveManagedIssueInput = {
  companyId: string;
  sourceType: string;
  sourceId: string;
  resolutionStatus: "done" | "cancelled";
  comment: string;
};

let currentContext: PluginContext | null = null;
const PAPERCLIP_COMPANY_CONFIG_PATH = new URL("../../../blueprint-company/.paperclip.yaml", import.meta.url);
let cachedPaperclipYamlConfig: PaperclipYamlConfig | null | undefined;

function loadPaperclipYamlConfig(): PaperclipYamlConfig | null {
  if (cachedPaperclipYamlConfig !== undefined) {
    return cachedPaperclipYamlConfig;
  }

  try {
    const raw = readFileSync(PAPERCLIP_COMPANY_CONFIG_PATH, "utf8");
    cachedPaperclipYamlConfig = (yaml.load(raw) as PaperclipYamlConfig | undefined) ?? null;
  } catch {
    cachedPaperclipYamlConfig = null;
  }

  return cachedPaperclipYamlConfig;
}

function resolveYamlAgentKey(agentKey: string): string {
  return agentKey.replace(/^blueprint-/, "");
}

function getConfiguredAgent(agentKey: string): PaperclipYamlAgentConfig | undefined {
  const config = loadPaperclipYamlConfig();
  if (!config?.agents) {
    return undefined;
  }
  return config.agents[agentKey] ?? config.agents[resolveYamlAgentKey(agentKey)];
}

function estimateRoutineIntervalHours(cronExpression: string): number | null {
  const parts = cronExpression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }

  const [, hour, dayOfMonth, month, dayOfWeek] = parts;
  if (hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "1-5") {
    return 1;
  }
  if (/^\d+$/.test(hour) && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    return 24;
  }
  if (/^\d+$/.test(hour) && dayOfMonth === "*" && month === "*" && /^[0-7]$/.test(dayOfWeek)) {
    return 24 * 7;
  }
  if (/^\d+$/.test(hour) && dayOfMonth === "*" && month === "*" && dayOfWeek === "1-5") {
    return 24;
  }

  return null;
}

function getConfiguredRoutineMetadata(routineKey: string): {
  expectedIntervalHours: number | null;
} {
  const config = loadPaperclipYamlConfig();
  const routine = config?.routines?.[routineKey];
  const scheduleTrigger = routine?.triggers?.find((trigger) => trigger.kind === "schedule");
  return {
    expectedIntervalHours: scheduleTrigger?.cronExpression
      ? estimateRoutineIntervalHours(scheduleTrigger.cronExpression)
      : null,
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

const DEMAND_INTEL_LANES = [
  "robot-team-demand",
  "site-operator-lane",
  "city-demand",
  "cross-lane",
] as const satisfies readonly DemandIntelLane[];

const DEMAND_INTEL_CONFIDENCE_LEVELS = [
  "high",
  "medium",
  "low",
] as const satisfies readonly DemandIntelConfidence[];

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseAgentRunFailurePayload(value: unknown): AgentRunFailurePayload {
  const payload = asRecord(value) ?? {};
  return {
    agentId: asString(payload.agentId) ?? null,
    runId: asString(payload.runId) ?? null,
    issueId: asString(payload.issueId) ?? null,
    taskId: asString(payload.taskId) ?? null,
    taskKey: asString(payload.taskKey) ?? null,
    error: asString(payload.error) ?? null,
  };
}

function buildQuotaFallbackDescriptor(
  adapterType: string,
  adapterConfig: Record<string, unknown> | null | undefined,
) {
  if (adapterType === "claude_local") {
    return {
      adapterType: "codex_local" as LocalQuotaFallbackAdapterType,
      reason: "quota_fallback_to_codex",
      adapterConfig: buildCodexFallbackAdapterConfig(asRecord(adapterConfig), {
        model: CODEX_FALLBACK_MODEL,
        modelReasoningEffort: CODEX_FALLBACK_REASONING_EFFORT,
      }),
    };
  }

  if (adapterType === "codex_local") {
    return {
      adapterType: "claude_local" as LocalQuotaFallbackAdapterType,
      reason: "quota_fallback_to_claude",
      adapterConfig: buildClaudeFallbackAdapterConfig(asRecord(adapterConfig), {
        model: "claude-sonnet-4-6",
      }),
    };
  }

  return null;
}

function buildDesiredAdapterDescriptor(agent: Agent) {
  const configuredAgent = getConfiguredAgent(agent.urlKey);
  const configuredAdapterType = configuredAgent?.adapter?.type;
  const configuredAdapterConfig = asRecord(configuredAgent?.adapter?.config);
  if (
    (configuredAdapterType !== "claude_local" && configuredAdapterType !== "codex_local")
    || !configuredAdapterConfig
  ) {
    return null;
  }

  return {
    adapterType: configuredAdapterType,
    adapterConfig: configuredAdapterConfig,
  };
}

function getActiveWorkspaceCooldown(
  state: WorkspaceAdapterCooldownState,
  workspaceKey: string | null,
  adapterType: string,
  now = Date.now(),
): WorkspaceAdapterCooldownRecord | null {
  if (!workspaceKey || (adapterType !== "claude_local" && adapterType !== "codex_local")) {
    return null;
  }
  const record = state[getWorkspaceAdapterCooldownKey(workspaceKey, adapterType)];
  if (!record) {
    return null;
  }
  return Date.parse(record.cooldownUntil) > now ? record : null;
}

async function setWorkspaceCooldown(
  ctx: PluginContext,
  companyId: string,
  record: WorkspaceAdapterCooldownRecord,
) {
  const state =
    await readState<WorkspaceAdapterCooldownState>(ctx, companyId, STATE_KEYS.workspaceAdapterCooldowns) ?? {};
  const nextState = {
    ...state,
    [getWorkspaceAdapterCooldownKey(record.workspaceKey, record.unavailableAdapterType)]: record,
  };
  await writeState(ctx, companyId, STATE_KEYS.workspaceAdapterCooldowns, nextState);
}

async function enforceWorkspaceAdapterCooldowns(
  ctx: PluginContext,
  companyId: string,
  agents?: Agent[],
) {
  const currentState =
    await readState<WorkspaceAdapterCooldownState>(ctx, companyId, STATE_KEYS.workspaceAdapterCooldowns) ?? {};
  const now = Date.now();
  const nextStateEntries = Object.entries(currentState).filter(([, record]) => {
    const parsed = Date.parse(record.cooldownUntil);
    return Number.isFinite(parsed) && parsed > now;
  });

  if (nextStateEntries.length !== Object.keys(currentState).length) {
    await writeState(
      ctx,
      companyId,
      STATE_KEYS.workspaceAdapterCooldowns,
      Object.fromEntries(nextStateEntries),
    );
  }

  const activeState = Object.fromEntries(nextStateEntries);
  const targetAgents = agents ?? await listAgents(ctx, companyId);

  for (const agent of targetAgents) {
    const desired = buildDesiredAdapterDescriptor(agent);
    if (!desired) {
      continue;
    }

    const workspaceKey = getLocalAdapterWorkspaceKey(
      asRecord(agent.adapterConfig) ?? desired.adapterConfig,
    );
    const cooldown = getActiveWorkspaceCooldown(activeState, workspaceKey, desired.adapterType, now);
    const targetAdapterType = cooldown?.fallbackAdapterType ?? desired.adapterType;

    if (agent.adapterType === targetAdapterType) {
      continue;
    }

    let targetAdapterConfig: Record<string, unknown> | null = null;
    if (targetAdapterType === desired.adapterType) {
      targetAdapterConfig = desired.adapterConfig;
    } else {
      const currentFallback = buildQuotaFallbackDescriptor(
        agent.adapterType,
        asRecord(agent.adapterConfig),
      );
      if (currentFallback?.adapterType === targetAdapterType) {
        targetAdapterConfig = currentFallback.adapterConfig;
      } else {
        const desiredFallback = buildQuotaFallbackDescriptor(
          desired.adapterType,
          desired.adapterConfig,
        );
        if (desiredFallback?.adapterType === targetAdapterType) {
          targetAdapterConfig = desiredFallback.adapterConfig;
        }
      }
    }

    if (!targetAdapterConfig) {
      continue;
    }

    await ctx.agents.update(
      agent.id,
      {
        adapterType: targetAdapterType,
        adapterConfig: targetAdapterConfig,
      },
      companyId,
    );
    await ctx.agents.resetRuntimeSession(agent.id, companyId);
  }
}

function normalizeConfig(rawConfig: Record<string, unknown>): BlueprintAutomationConfig {
  const opsDepartment = rawConfig.opsDepartment && typeof rawConfig.opsDepartment === "object"
    ? rawConfig.opsDepartment as Record<string, unknown>
    : {};
  const opsAgents = opsDepartment.agents && typeof opsDepartment.agents === "object"
    ? opsDepartment.agents as Record<string, unknown>
    : {};
  const growthDepartment = rawConfig.growthDepartment && typeof rawConfig.growthDepartment === "object"
    ? rawConfig.growthDepartment as Record<string, unknown>
    : {};
  const growthAgents = growthDepartment.agents && typeof growthDepartment.agents === "object"
    ? growthDepartment.agents as Record<string, unknown>
    : {};
  const secrets = rawConfig.secrets && typeof rawConfig.secrets === "object"
    ? rawConfig.secrets as Record<string, unknown>
    : {};

  return {
    companyName: asString(rawConfig.companyName) ?? DEFAULT_COMPANY_NAME,
    githubOwner: asString(rawConfig.githubOwner) ?? "ognjhunt",
    githubTokenRef: asString(rawConfig.githubTokenRef),
    githubWebhookSecretRef: asString(rawConfig.githubWebhookSecretRef),
    ciSharedSecretRef: asString(rawConfig.ciSharedSecretRef),
    intakeSharedSecretRef: asString(rawConfig.intakeSharedSecretRef),
    notificationWebhookUrlRef: asString(rawConfig.notificationWebhookUrlRef),
    enableGitRepoScanning: asBoolean(rawConfig.enableGitRepoScanning, true),
    enableGithubPolling: asBoolean(rawConfig.enableGithubPolling, true),
    enableOutboundNotifications: asBoolean(rawConfig.enableOutboundNotifications, false),
    repoCatalog: Array.isArray(rawConfig.repoCatalog) && rawConfig.repoCatalog.length > 0
      ? rawConfig.repoCatalog.filter((entry): entry is RepoConfig => {
        if (!entry || typeof entry !== "object") return false;
        const record = entry as Record<string, unknown>;
        return Boolean(
          asString(record.key) &&
          asString(record.projectName) &&
          asString(record.githubRepo) &&
          asString(record.defaultBranch) &&
          asString(record.implementationAgent) &&
          asString(record.reviewAgent),
        );
      }).map((entry) => ({
        key: entry.key,
        projectName: entry.projectName,
        githubRepo: entry.githubRepo,
        defaultBranch: entry.defaultBranch,
        implementationAgent: entry.implementationAgent,
        reviewAgent: entry.reviewAgent,
      }))
      : [...DEFAULT_REPO_CATALOG],
    opsDepartment: {
      enabled: asBoolean(opsDepartment.enabled, true),
      agents: {
        opsLead: asString(opsAgents.opsLead) ?? "ops-lead",
        intake: asString(opsAgents.intake) ?? "intake-agent",
        captureQa: asString(opsAgents.captureQa) ?? "capture-qa-agent",
        fieldOps: asString(opsAgents.fieldOps) ?? "field-ops-agent",
        financeSupport: asString(opsAgents.financeSupport) ?? "finance-support-agent",
      },
    },
    growthDepartment: {
      enabled: asBoolean(growthDepartment.enabled, true),
      agents: {
        growthLead: asString(growthAgents.growthLead) ?? "growth-lead",
        conversionOptimizer: asString(growthAgents.conversionOptimizer) ?? "conversion-agent",
        analytics: asString(growthAgents.analytics) ?? "analytics-agent",
        marketIntel: asString(growthAgents.marketIntel) ?? "market-intel-agent",
        demandIntel: asString(growthAgents.demandIntel) ?? "demand-intel-agent",
        robotTeamGrowth: asString(growthAgents.robotTeamGrowth) ?? "robot-team-growth-agent",
        siteOperatorPartnership: asString(growthAgents.siteOperatorPartnership) ?? "site-operator-partnership-agent",
        cityDemand: asString(growthAgents.cityDemand) ?? "city-demand-agent",
      },
    },
    secrets: {
      notionApiTokenRef: asString(secrets.notionApiTokenRef) ?? asString(secrets.notionApiToken),
      slackOpsWebhookUrlRef: asString(secrets.slackOpsWebhookUrlRef) ?? asString(secrets.slackOpsWebhookUrl),
      slackGrowthWebhookUrlRef: asString(secrets.slackGrowthWebhookUrlRef) ?? asString(secrets.slackGrowthWebhookUrl),
      searchApiKeyRef: asString(secrets.searchApiKeyRef) ?? asString(secrets.searchApiKey),
      searchApiProviderRef: asString(secrets.searchApiProviderRef) ?? asString(secrets.searchApiProvider),
    },
  };
}

function normalizedCandidates(entity: Record<string, unknown>): string[] {
  const codebase = entity.codebase && typeof entity.codebase === "object"
    ? entity.codebase as Record<string, unknown>
    : null;
  return [
    entity.id,
    entity.name,
    entity.title,
    entity.slug,
    entity.key,
    entity.urlKey,
    entity.identifier,
    codebase?.repoName,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toLowerCase());
}

function hasDuplicateSuffix(value: unknown) {
  return typeof value === "string" && /(?:-\d+| \d+)$/.test(value.trim());
}

function scoreProjectMatch(project: Project, target: string) {
  const record = project as unknown as Record<string, unknown>;
  const codebase = record.codebase && typeof record.codebase === "object"
    ? record.codebase as Record<string, unknown>
    : null;
  const exactCandidates = [
    record.id,
    record.name,
    record.title,
    record.slug,
    record.key,
    record.urlKey,
    record.identifier,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());
  const repoName = typeof codebase?.repoName === "string" ? codebase.repoName.trim().toLowerCase() : null;
  const localFolder = typeof codebase?.localFolder === "string" ? codebase.localFolder : null;

  let score = 0;
  if (exactCandidates.includes(target)) score += 100;
  if (repoName === target) score += 25;
  if (localFolder) score += 10;
  if (!hasDuplicateSuffix(record.urlKey) && !hasDuplicateSuffix(record.name)) score += 5;
  return score;
}

function scoreAgentMatch(agent: Agent, target: string) {
  const record = agent as unknown as Record<string, unknown>;
  const exactCandidates = [
    record.id,
    record.name,
    record.title,
    record.slug,
    record.key,
    record.urlKey,
    record.identifier,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase());
  const cwd = typeof (record.adapterConfig as Record<string, unknown> | undefined)?.cwd === "string"
    ? (record.adapterConfig as Record<string, unknown>).cwd as string
    : null;

  let score = 0;
  if (exactCandidates.includes(target)) score += 100;
  if (cwd) score += 10;
  if (!hasDuplicateSuffix(record.urlKey) && !hasDuplicateSuffix(record.name)) score += 5;
  return score;
}

async function getConfig(ctx: PluginContext): Promise<BlueprintAutomationConfig> {
  return normalizeConfig(await ctx.config.get());
}

async function resolveOptionalSecret(
  ctx: PluginContext,
  ref?: string,
  fallbackName?: string,
): Promise<string | null> {
  if (ref) {
    const resolved = await ctx.secrets.resolve(ref);
    if (resolved) return resolved;
  }
  if (fallbackName) {
    const resolved = await ctx.secrets.resolve(fallbackName);
    if (resolved) return resolved;
  }
  return null;
}

function getOpsRoutingConfig(config: BlueprintAutomationConfig) {
  const agents = config.opsDepartment?.agents;
  return {
    opsLead: agents?.opsLead ?? "ops-lead",
    intakeAgent: agents?.intake ?? "intake-agent",
    captureQaAgent: agents?.captureQa ?? "capture-qa-agent",
    fieldOpsAgent: agents?.fieldOps ?? "field-ops-agent",
    financeSupportAgent: agents?.financeSupport ?? "finance-support-agent",
  };
}

function mapQueueSystemToProject(system: string) {
  switch (system) {
    case "WebApp":
      return "blueprint-webapp";
    case "Capture":
      return "blueprint-capture";
    case "Pipeline":
      return "blueprint-capture-pipeline";
    default:
      return "blueprint-executive-ops";
  }
}

function mapQueuePriority(priority: string): UpsertManagedIssueInput["priority"] {
  switch (priority) {
    case "P0":
      return "critical";
    case "P1":
      return "high";
    case "P3":
      return "low";
    default:
      return "medium";
  }
}

async function findCompany(ctx: PluginContext, companyName?: string): Promise<Company> {
  const companies = await ctx.companies.list({ limit: 100, offset: 0 });
  const target = (companyName ?? DEFAULT_COMPANY_NAME).trim().toLowerCase();
  const company = companies.find((entry) => {
    const record = entry as unknown as Record<string, unknown>;
    return normalizedCandidates(record).includes(target);
  });
  if (!company) {
    throw new Error(`Blueprint company not found: ${companyName ?? DEFAULT_COMPANY_NAME}`);
  }
  return company;
}

async function listProjects(ctx: PluginContext, companyId: string) {
  return await ctx.projects.list({ companyId, limit: 200, offset: 0 });
}

async function listAgents(ctx: PluginContext, companyId: string) {
  return await ctx.agents.list({ companyId, limit: 200, offset: 0 });
}

async function resolveProject(ctx: PluginContext, companyId: string, projectName: string) {
  const projects = await listProjects(ctx, companyId);
  const target = projectName.trim().toLowerCase();
  const project = [...projects]
    .map((entry) => ({ entry, score: scoreProjectMatch(entry, target) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.entry;
  if (!project) {
    throw new Error(`Project not found for Blueprint automation: ${projectName}`);
  }
  return project;
}

async function resolveAgent(ctx: PluginContext, companyId: string, agentName: string) {
  const agents = await listAgents(ctx, companyId);
  const target = agentName.trim().toLowerCase();
  const agent = [...agents]
    .map((entry) => ({ entry, score: scoreAgentMatch(entry, target) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.entry;
  if (!agent) {
    throw new Error(`Agent not found for Blueprint automation: ${agentName}`);
  }
  return agent;
}

function makeFingerprint(sourceType: string, sourceId: string) {
  return `${sourceType.trim()}:${sourceId.trim()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeIssueStatus(value: unknown, fallback: UpsertManagedIssueInput["status"] = "todo") {
  const next = asString(value);
  if (!next) return fallback;
  if (["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"].includes(next)) {
    return next as UpsertManagedIssueInput["status"];
  }
  return fallback;
}

function normalizeIssuePriority(value: unknown, fallback: UpsertManagedIssueInput["priority"] = "medium") {
  const next = asString(value);
  if (!next) return fallback;
  if (["critical", "high", "medium", "low"].includes(next)) {
    return next as UpsertManagedIssueInput["priority"];
  }
  return fallback;
}

async function readState<T>(ctx: PluginContext, companyId: string, stateKey: string): Promise<T | null> {
  return await ctx.state.get({
    scopeKind: "company",
    scopeId: companyId,
    namespace: "blueprint-automation",
    stateKey,
  }) as T | null;
}

async function writeState(ctx: PluginContext, companyId: string, stateKey: string, value: unknown) {
  await ctx.state.set(
    {
      scopeKind: "company",
      scopeId: companyId,
      namespace: "blueprint-automation",
      stateKey,
    },
    value,
  );
}

async function appendRecentEvent(ctx: PluginContext, companyId: string, event: Omit<RecentEvent, "id" | "createdAt">) {
  const existing = await readState<RecentEvent[]>(ctx, companyId, STATE_KEYS.recentEvents);
  const next: RecentEvent = {
    id: randomUUID(),
    createdAt: nowIso(),
    ...event,
  };
  const recentEvents = [next, ...(existing ?? [])].slice(0, 30);
  await writeState(ctx, companyId, STATE_KEYS.recentEvents, recentEvents);
}

async function writeHealth(ctx: PluginContext, companyId: string, status: PluginHealthDiagnostics["status"], message: string) {
  await writeState(ctx, companyId, STATE_KEYS.health, {
    status,
    message,
    updatedAt: nowIso(),
  });
}

async function getMapping(
  ctx: PluginContext,
  companyId: string,
  fingerprint: string,
): Promise<PluginEntityRecord | null> {
  const rows = await ctx.entities.list({
    entityType: ENTITY_TYPES.sourceMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: fingerprint,
    limit: 1,
    offset: 0,
  });
  return rows[0] ?? null;
}

async function upsertMapping(
  ctx: PluginContext,
  companyId: string,
  fingerprint: string,
  title: string,
  status: string,
  data: SourceMappingData,
) {
  return await ctx.entities.upsert({
    entityType: ENTITY_TYPES.sourceMapping,
    scopeKind: "company",
    scopeId: companyId,
    externalId: fingerprint,
    title,
    status,
    data,
  });
}

async function getManagedIssue(ctx: PluginContext, companyId: string, fingerprint: string) {
  const mapping = await getMapping(ctx, companyId, fingerprint);
  if (!mapping) return { mapping: null, issue: null };
  const data = (mapping.data ?? {}) as Partial<SourceMappingData>;
  const issueId = typeof data.issueId === "string" ? data.issueId : null;
  const issue = issueId ? await ctx.issues.get(issueId, companyId) : null;
  return { mapping, issue };
}

function makeTraceBlock(input: UpsertManagedIssueInput) {
  const lines = [
    "## Automation Trace",
    `- Source type: ${input.sourceType}`,
    `- Source id: ${input.sourceId}`,
    `- Project: ${input.projectName}`,
    `- Assignee: ${input.assignee}`,
  ];
  if (input.signalUrl) {
    lines.push(`- URL: ${input.signalUrl}`);
  }
  return `${input.description}\n\n${lines.join("\n")}`;
}

function makeUpdateComment(input: UpsertManagedIssueInput, hits: number) {
  const lines = [
    "Automation refresh",
    `- Fingerprint: ${makeFingerprint(input.sourceType, input.sourceId)}`,
    `- Seen count: ${hits}`,
    `- Updated at: ${nowIso()}`,
  ];
  if (input.signalUrl) {
    lines.push(`- URL: ${input.signalUrl}`);
  }
  if (input.comment) {
    lines.push("", input.comment);
  }
  return lines.join("\n");
}

function makeNotificationText(input: {
  headline: string;
  issueTitle: string;
  issueId: string;
  projectName: string;
  priority?: string | null;
  status?: string | null;
  detail?: string | null;
}) {
  const lines = [
    input.headline,
    `Issue: ${input.issueTitle} (${input.issueId})`,
    `Project: ${input.projectName}`,
  ];
  if (input.priority) {
    lines.push(`Priority: ${input.priority}`);
  }
  if (input.status) {
    lines.push(`Status: ${input.status}`);
  }
  if (input.detail) {
    lines.push(`Detail: ${input.detail}`);
  }
  return lines.join("\n");
}

async function sendNotification(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  payload: {
    headline: string;
    issueTitle: string;
    issueId: string;
    projectName: string;
    priority?: string | null;
    status?: string | null;
    detail?: string | null;
  },
) {
  if (!config.enableOutboundNotifications || !config.notificationWebhookUrlRef) {
    return;
  }

  try {
    const url = await ctx.secrets.resolve(config.notificationWebhookUrlRef);
    const text = makeNotificationText(payload);
    const response = await ctx.http.fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: text.replace(/\n/g, "\n"),
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
  } catch (error) {
    await appendRecentEvent(ctx, companyId, {
      kind: "notification-error",
      title: "Blueprint outbound notification failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleAgentRunFailureQuotaFallback(
  ctx: PluginContext,
  event: { companyId: string; payload: unknown },
) {
  const payload = parseAgentRunFailurePayload(event.payload);
  if (!payload.agentId || !payload.runId || !payload.error) {
    return;
  }
  if (!isQuotaOrRateLimitFailure(payload.error)) {
    return;
  }

  const existingState =
    await readState<QuotaFallbackRetryState>(ctx, event.companyId, STATE_KEYS.quotaFallbackRetries) ?? {};
  if (existingState[payload.runId]) {
    return;
  }

  const markAttempt = async (record: ReturnType<typeof buildQuotaFallbackRetryRecord>) => {
    const nextState = {
      ...existingState,
      [payload.runId as string]: record,
    };
    await writeState(ctx, event.companyId, STATE_KEYS.quotaFallbackRetries, nextState);
  };

  const agent = await ctx.agents.get(payload.agentId, event.companyId);
  if (!agent) {
    await markAttempt(
      buildQuotaFallbackRetryRecord({
        attemptedAt: nowIso(),
        status: "skipped",
        agentId: payload.agentId,
        issueId: payload.issueId,
        taskKey: payload.taskKey,
        reason: "quota_fallback_skipped",
        note: "Agent not found.",
      }),
    );
    return;
  }

  const fallback = buildQuotaFallbackDescriptor(agent.adapterType, asRecord(agent.adapterConfig));
  if (!fallback) {
    await markAttempt(
      buildQuotaFallbackRetryRecord({
        attemptedAt: nowIso(),
        status: "skipped",
        agentId: agent.id,
        issueId: payload.issueId,
        taskKey: payload.taskKey ?? payload.taskId,
        reason: "quota_fallback_skipped",
        note: `Agent adapter is ${agent.adapterType}, which has no configured quota fallback.`,
      }),
    );
    return;
  }

  const retryTaskKey =
    payload.taskKey ??
    payload.taskId ??
    payload.issueId ??
    `quota-fallback:${agent.id}:${payload.runId}`;
  const workspaceKey = getLocalAdapterWorkspaceKey(asRecord(agent.adapterConfig));
  const cooldownUntil = resolveQuotaCooldownUntil(payload.error, {
    defaultCooldownMs: WORKSPACE_QUOTA_COOLDOWN_MS,
  });

  try {
    const allAgents = await listAgents(ctx, event.companyId).catch(() => []);
    const workspaceTargets = selectWorkspaceQuotaFallbackTargets(
      {
        id: agent.id,
        adapterType: agent.adapterType,
        adapterConfig: asRecord(agent.adapterConfig),
      },
      allAgents.map((entry) => ({
        id: entry.id,
        adapterType: entry.adapterType,
        adapterConfig: asRecord(entry.adapterConfig),
      })),
    );
    const siblingSwitchErrors: string[] = [];

    for (const target of workspaceTargets) {
      const targetFallback = buildQuotaFallbackDescriptor(
        target.adapterType,
        asRecord(target.adapterConfig),
      );
      if (!targetFallback) {
        continue;
      }

      try {
        await ctx.agents.update(
          target.id,
          {
            adapterType: targetFallback.adapterType,
            adapterConfig: targetFallback.adapterConfig,
          },
          event.companyId,
        );
        await ctx.agents.resetRuntimeSession(
          target.id,
          event.companyId,
          target.id === agent.id
            ? {
              taskKey: payload.taskKey ?? payload.taskId ?? payload.issueId ?? null,
            }
            : undefined,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (target.id === agent.id) {
          throw error;
        }
        siblingSwitchErrors.push(`${target.id}: ${errorMessage}`);
      }
    }

    if (
      workspaceKey
      && (agent.adapterType === "claude_local" || agent.adapterType === "codex_local")
      && fallback.adapterType !== agent.adapterType
    ) {
      await setWorkspaceCooldown(ctx, event.companyId, {
        workspaceKey,
        unavailableAdapterType: agent.adapterType,
        fallbackAdapterType: fallback.adapterType,
        cooldownUntil,
        recordedAt: nowIso(),
        reason: fallback.reason,
        sourceRunId: payload.runId,
        sourceAgentId: agent.id,
        note: payload.error,
      });
    }

    const wakePayload: Record<string, unknown> = {
      retryOfRunId: payload.runId,
      taskKey: retryTaskKey,
    };
    if (payload.issueId) wakePayload.issueId = payload.issueId;
    if (payload.taskId) wakePayload.taskId = payload.taskId;

    const wakeResult = await ctx.agents.wakeup(
      agent.id,
      event.companyId,
      {
        source: "automation",
        triggerDetail: "system",
        reason: fallback.reason,
        payload: wakePayload,
        idempotencyKey: `quota-fallback:${payload.runId}`,
        forceFreshSession: true,
      },
    );

    await markAttempt(
      buildQuotaFallbackRetryRecord({
        attemptedAt: nowIso(),
        status: "retried",
        agentId: agent.id,
        issueId: payload.issueId,
        taskKey: retryTaskKey,
        reason: fallback.reason,
        fallbackAdapterType: fallback.adapterType,
        wakeupRunId: asString(wakeResult?.runId) ?? null,
        note: siblingSwitchErrors.length > 0
          ? `${payload.error} | sibling_switch_errors=${siblingSwitchErrors.join(" ; ")}`
          : payload.error,
      }),
    );

    await appendRecentEvent(ctx, event.companyId, {
      kind: "quota-fallback-retry",
      title: `Retried ${agent.name} on ${fallback.adapterType === "codex_local" ? "Codex" : "Claude"} after quota failure`,
      issueId: payload.issueId ?? undefined,
      detail: payload.issueId
        ? `Issue ${payload.issueId} retried from failed run ${payload.runId}; switched ${workspaceTargets.length} same-workspace agent(s) to ${fallback.adapterType === "codex_local" ? "Codex" : "Claude"} until ${cooldownUntil}.`
        : `Task ${retryTaskKey} retried from failed run ${payload.runId}; switched ${workspaceTargets.length} same-workspace agent(s) to ${fallback.adapterType === "codex_local" ? "Codex" : "Claude"} until ${cooldownUntil}.`,
    });

    if (payload.issueId) {
      await ctx.issues.createComment(
        payload.issueId,
        `Detected a ${agent.adapterType === "claude_local" ? "Claude" : "Codex"} quota/rate-limit failure on run ${payload.runId}. Switched ${agent.name} and ${Math.max(workspaceTargets.length - 1, 0)} same-workspace peer(s) to ${fallback.adapterType === "codex_local" ? "Codex" : "Claude"} until ${cooldownUntil}, then requeued the work once.`,
        event.companyId,
      ).catch(() => undefined);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await markAttempt(
      buildQuotaFallbackRetryRecord({
        attemptedAt: nowIso(),
        status: "failed",
        agentId: agent.id,
        issueId: payload.issueId,
        taskKey: retryTaskKey,
        reason: "quota_fallback_failed",
        note: errorMessage,
      }),
    );
    await appendRecentEvent(ctx, event.companyId, {
      kind: "quota-fallback-error",
      title: `${fallback.adapterType === "codex_local" ? "Codex" : "Claude"} fallback failed for ${agent.name}`,
      issueId: payload.issueId ?? undefined,
      detail: errorMessage,
    });
  }
}

async function upsertManagedIssue(ctx: PluginContext, input: UpsertManagedIssueInput) {
  const fingerprint = makeFingerprint(input.sourceType, input.sourceId);
  const project = await resolveProject(ctx, input.companyId, input.projectName);
  const assignee = await resolveAgent(ctx, input.companyId, input.assignee);
  const { mapping, issue } = await getManagedIssue(ctx, input.companyId, fingerprint);
  const existingData = (mapping?.data ?? {}) as Partial<SourceMappingData>;
  const hits = (existingData.hits ?? 0) + 1;
  const desiredStatus = normalizeIssueStatus(input.status, "todo");
  const desiredPriority = normalizeIssuePriority(input.priority, "medium");
  let currentIssue = issue;
  const isNewIssue = !currentIssue;

  if (currentIssue) {
    const nextStatus =
      currentIssue.status === "done" || currentIssue.status === "cancelled"
        ? desiredStatus
        : desiredStatus === "todo"
          ? currentIssue.status
          : desiredStatus;

    const updatedIssue = await (ctx.issues.update as any)(
      currentIssue.id,
      {
        title: input.title,
        description: makeTraceBlock(input),
        status: nextStatus,
        priority: desiredPriority,
        assigneeAgentId: assignee.id,
      },
      input.companyId,
    );
    currentIssue = updatedIssue;
    if (!updatedIssue) {
      throw new Error(`Failed to update managed issue for ${fingerprint}`);
    }
    if (!input.suppressRefreshComment) {
      await ctx.issues.createComment(updatedIssue.id, makeUpdateComment(input, hits), input.companyId);
    }
  } else {
    const createdIssue = await (ctx.issues.create as any)({
      companyId: input.companyId,
      projectId: project.id,
      parentId: input.parentIssueId,
      title: input.title,
      description: makeTraceBlock(input),
      status: desiredStatus,
      priority: desiredPriority,
      assigneeAgentId: assignee.id,
      originKind: ORIGIN_KIND,
      originId: fingerprint,
    });
    currentIssue = createdIssue;
    if (!input.suppressRefreshComment) {
      await ctx.issues.createComment(
        createdIssue.id,
        makeUpdateComment(input, hits),
        input.companyId,
      );
    }
  }

  if (!currentIssue) {
    throw new Error(`Failed to create or update managed issue for ${fingerprint}`);
  }

  await upsertMapping(ctx, input.companyId, fingerprint, input.title, currentIssue.status, {
    fingerprint,
    issueId: currentIssue.id,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    projectName: input.projectName,
    assignee: input.assignee,
    signalUrl: input.signalUrl,
    hits,
    firstSeenAt: existingData.firstSeenAt ?? nowIso(),
    lastSeenAt: nowIso(),
    resolutionStatus: null,
    metadata: input.metadata,
  });

  await appendRecentEvent(ctx, input.companyId, {
    kind: "issue-upserted",
    title: input.title,
    fingerprint,
    issueId: currentIssue.id,
    detail: `${input.projectName} -> ${input.assignee}`,
  });

  await ctx.activity.log({
    companyId: input.companyId,
    message: "blueprint.automation.issue_upserted",
    entityType: "issue",
    entityId: currentIssue.id,
    metadata: {
      fingerprint,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      projectName: input.projectName,
      assignee: input.assignee,
      hits,
    },
  });

  if (isNewIssue && desiredPriority && ["critical", "high"].includes(desiredPriority)) {
    const config = await getConfig(ctx);
    await sendNotification(ctx, config, input.companyId, {
      headline: "Blueprint automation opened a high-priority issue.",
      issueTitle: currentIssue.title,
      issueId: currentIssue.id,
      projectName: input.projectName,
      priority: desiredPriority,
      status: currentIssue.status,
      detail: fingerprint,
    });
  }

  return { fingerprint, issue: currentIssue, hits };
}

async function resolveManagedIssue(ctx: PluginContext, input: ResolveManagedIssueInput) {
  const fingerprint = makeFingerprint(input.sourceType, input.sourceId);
  const { mapping, issue } = await getManagedIssue(ctx, input.companyId, fingerprint);
  if (!mapping || !issue) {
    return { fingerprint, issue: null };
  }

  const updatedIssue =
    issue.status === input.resolutionStatus
      ? issue
      : await ctx.issues.update(
        issue.id,
        { status: input.resolutionStatus },
        input.companyId,
      );

  await ctx.issues.createComment(updatedIssue.id, input.comment, input.companyId);

  const existingData = (mapping.data ?? {}) as Partial<SourceMappingData>;
  await upsertMapping(ctx, input.companyId, fingerprint, mapping.title ?? updatedIssue.title, input.resolutionStatus, {
    fingerprint,
    issueId: updatedIssue.id,
    sourceType: existingData.sourceType ?? input.sourceType,
    sourceId: existingData.sourceId ?? input.sourceId,
    projectName: existingData.projectName ?? "unknown",
    assignee: existingData.assignee ?? "unknown",
    signalUrl: existingData.signalUrl,
    hits: existingData.hits ?? 1,
    firstSeenAt: existingData.firstSeenAt ?? nowIso(),
    lastSeenAt: nowIso(),
    resolutionStatus: input.resolutionStatus,
    metadata: existingData.metadata,
  });

  await appendRecentEvent(ctx, input.companyId, {
    kind: "issue-resolved",
    title: updatedIssue.title,
    fingerprint,
    issueId: updatedIssue.id,
    detail: input.comment,
  });

  if (
    updatedIssue &&
    (input.sourceType === "github-workflow" || input.sourceType.includes("ci"))
  ) {
    const config = await getConfig(ctx);
    await sendNotification(ctx, config, input.companyId, {
      headline: "Blueprint automation resolved a CI-tracked issue.",
      issueTitle: updatedIssue.title,
      issueId: updatedIssue.id,
      projectName: existingData.projectName ?? "unknown",
      priority: updatedIssue.priority,
      status: updatedIssue.status,
      detail: fingerprint,
    });
  }

  return { fingerprint, issue: updatedIssue };
}

function configuredSourceStatus(
  source: string,
  configured: boolean,
  availableDetail: string,
  missingDetail: string,
) {
  return {
    source,
    status: configured ? "available" : "missing",
    detail: configured ? availableDetail : missingDetail,
  } as const;
}

function coerceStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  const singleValue = asString(value);
  return singleValue ? [singleValue] : [];
}

function normalizeAnalyticsStructuredReport(
  params: Record<string, unknown>,
  cadence: AnalyticsReportCadence,
): { report: AnalyticsStructuredReport; validationErrors: string[] } {
  const report: AnalyticsStructuredReport = {
    headline: asString(params.headline) ?? "",
    summaryBullets: coerceStringArray(params.summaryBullets),
    workflowFindings: coerceStringArray(params.workflowFindings),
    risks: coerceStringArray(params.risks),
    recommendedFollowUps: coerceStringArray(params.recommendedFollowUps),
  };

  const validationErrors: string[] = [];
  if (!report.headline) {
    validationErrors.push(`Missing headline for ${cadence} analytics report.`);
  }
  if (report.summaryBullets.length === 0) {
    validationErrors.push("Missing summaryBullets for analytics report.");
  }
  if (report.workflowFindings.length === 0) {
    validationErrors.push("Missing workflowFindings for analytics report.");
  }
  if (report.risks.length === 0) {
    validationErrors.push("Missing risks for analytics report.");
  }
  if (report.recommendedFollowUps.length === 0) {
    validationErrors.push("Missing recommendedFollowUps for analytics report.");
  }

  return { report, validationErrors };
}

function formatAnalyticsIssueComment(result: {
  outcome: "done" | "blocked";
  report: AnalyticsStructuredReport;
  cadence: AnalyticsReportCadence;
  notion?: AnalyticsOutputProof["notion"];
  slack?: AnalyticsOutputProof["slack"];
  failureReason?: string;
}) {
  const slackStatus = result.slack?.ok
    ? `delivered to ${result.slack.routedChannel} (HTTP ${result.slack.statusCode ?? "unknown"}${result.slack.responseBody ? `, body: ${result.slack.responseBody}` : ""})`
    : `missing or failed${result.slack?.statusCode ? ` (HTTP ${result.slack.statusCode})` : ""}${result.slack?.responseBody ? `: ${result.slack.responseBody}` : ""}`;

  const lines = [
    result.outcome === "done"
      ? `${result.cadence === "daily" ? "Daily" : "Weekly"} analytics report delivered.`
      : `${result.cadence === "daily" ? "Daily" : "Weekly"} analytics report blocked.`,
    `- Headline: ${result.report.headline}`,
    ...(result.failureReason ? [`- Failure reason: ${result.failureReason}`] : []),
    `- Notion Work Queue: ${result.notion?.workQueuePageUrl ?? result.notion?.workQueuePageId ?? "missing"}`,
    `- Notion Knowledge: ${result.notion?.knowledgePageUrl ?? result.notion?.knowledgePageId ?? "missing"}`,
    `- Slack digest: ${slackStatus}`,
  ];
  return lines.join("\n");
}

// ── Routine Health Tracking ────────────────────────────

async function updateRoutineHealth(
  ctx: PluginContext,
  companyId: string,
  routineKey: string,
  routineTitle: string,
  agentKey: string,
  outcome: "done" | "blocked",
  failureReason?: string,
  issueId?: string,
) {
  const state = await readState<RoutineHealthState>(ctx, companyId, STATE_KEYS.routineHealth) ?? {};
  const key = routineKey;
  const existing = state[key];
  const now = nowIso();
  const { expectedIntervalHours } = getConfiguredRoutineMetadata(routineKey);
  state[key] = {
    routineKey,
    routineTitle,
    agentKey,
    lastOutcome: outcome,
    lastRunAt: now,
    lastSuccessAt: outcome === "done" ? now : (existing?.lastSuccessAt ?? null),
    lastFailureReason: outcome === "blocked" ? (failureReason ?? "unknown") : null,
    consecutiveFailures: outcome === "blocked" ? ((existing?.consecutiveFailures ?? 0) + 1) : 0,
    expectedIntervalHours,
    lastIssueId: issueId ?? existing?.lastIssueId ?? null,
  };
  await writeState(ctx, companyId, STATE_KEYS.routineHealth, state);
}

async function runRoutineHealthCheck(ctx: PluginContext, companyId: string, config: BlueprintAutomationConfig) {
  const healthState = await readState<RoutineHealthState>(ctx, companyId, STATE_KEYS.routineHealth) ?? {};
  const alerts: string[] = [];
  const now = Date.now();

  for (const [, entry] of Object.entries(healthState)) {
    if (entry.consecutiveFailures >= 2) {
      alerts.push(
        `:warning: *Routine Alert: ${entry.routineTitle}*\nStatus: blocked\nLast failure: ${entry.lastFailureReason ?? "unknown"}\nConsecutive failures: ${entry.consecutiveFailures}\nAgent: ${entry.agentKey}\nIssue: ${entry.lastIssueId ?? "unknown"}`,
      );
    }

    if (entry.expectedIntervalHours && entry.expectedIntervalHours > 0) {
      const staleAnchor = entry.lastSuccessAt ?? entry.lastRunAt;
      const ageHours = (now - new Date(staleAnchor).getTime()) / (1000 * 60 * 60);
      if (ageHours >= entry.expectedIntervalHours * 2) {
        alerts.push(
          `:warning: *Routine Alert: ${entry.routineTitle}*\nStatus: stale\nLast success: ${entry.lastSuccessAt ?? "never"}\nExpected interval: ${entry.expectedIntervalHours}h\nAgent: ${entry.agentKey}\nIssue: ${entry.lastIssueId ?? "unknown"}`,
        );
      }
    }
  }

  if (alerts.length > 0) {
    const slackOpsUrl = await resolveOptionalSecret(ctx, config.secrets?.slackOpsWebhookUrlRef, "SLACK_OPS_WEBHOOK_URL");
    const slackGrowthUrl = await resolveOptionalSecret(ctx, config.secrets?.slackGrowthWebhookUrlRef, "SLACK_GROWTH_WEBHOOK_URL");
    if (slackOpsUrl || slackGrowthUrl) {
      await postSlackDigest(
        { default: slackOpsUrl ?? slackGrowthUrl ?? undefined, ops: slackOpsUrl ?? undefined, growth: slackGrowthUrl ?? undefined },
        {
          channel: "#ops",
          title: `Routine Health Alert \u2014 ${alerts.length} issue(s)`,
          sections: [{ heading: "Alerts", items: alerts }],
        },
      );
    }
  }

  await runBudgetCheck(ctx, companyId, config);
  await runPhaseGraduationCheck(ctx, companyId, config);
}

// ── Budget Tracking ────────────────────────────────────

function currentBudgetPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const MODEL_COST_ESTIMATES: Record<string, number> = {
  "claude-sonnet-4-6": 0.25,
  "gpt-5.4": 0.40,
  "gpt-5.4-mini": 0.30,
  default: 0.30,
};

async function trackAgentRun(ctx: PluginContext, companyId: string, agentKey: string, model?: string) {
  const period = currentBudgetPeriod();
  const state = await readState<BudgetTrackingState>(ctx, companyId, STATE_KEYS.budgetTracking) ?? { period, agents: {} };

  if (state.period !== period) {
    state.period = period;
    state.agents = {};
  }

  const configuredModel = model ?? getConfiguredAgent(agentKey)?.adapter?.config?.model;
  const costPerRun = MODEL_COST_ESTIMATES[configuredModel ?? "default"] ?? MODEL_COST_ESTIMATES.default;
  const entry = state.agents[agentKey] ?? { runs: 0, estimatedCostUsd: 0 };
  entry.runs += 1;
  entry.estimatedCostUsd = Math.round((entry.estimatedCostUsd + costPerRun) * 100) / 100;
  state.agents[agentKey] = entry;

  await writeState(ctx, companyId, STATE_KEYS.budgetTracking, state);
}

function getBudgetLimit(agentKey: string): number {
  return getConfiguredAgent(agentKey)?.budgetMonthlyCents ?? 3000;
}

async function runBudgetCheck(ctx: PluginContext, companyId: string, config: BlueprintAutomationConfig) {
  const state = await readState<BudgetTrackingState>(ctx, companyId, STATE_KEYS.budgetTracking);
  if (!state) return;

  const alerts: string[] = [];
  for (const [agentKey, entry] of Object.entries(state.agents)) {
    const limit = getBudgetLimit(agentKey);
    const pct = (entry.estimatedCostUsd / limit) * 100;
    if (pct >= 100) {
      alerts.push(`:rotating_light: *${agentKey}* exceeded monthly budget ($${entry.estimatedCostUsd.toFixed(2)} / $${limit} \u2014 ${pct.toFixed(0)}%, ${entry.runs} runs)`);
    } else if (pct >= 80) {
      alerts.push(`:warning: *${agentKey}* at ${pct.toFixed(0)}% of monthly budget ($${entry.estimatedCostUsd.toFixed(2)} / $${limit}, ${entry.runs} runs)`);
    }
  }

  if (alerts.length > 0) {
    const slackOpsUrl = await resolveOptionalSecret(ctx, config.secrets?.slackOpsWebhookUrlRef, "SLACK_OPS_WEBHOOK_URL");
    const slackGrowthUrl = await resolveOptionalSecret(ctx, config.secrets?.slackGrowthWebhookUrlRef, "SLACK_GROWTH_WEBHOOK_URL");
    if (slackOpsUrl || slackGrowthUrl) {
      await postSlackDigest(
        { default: slackOpsUrl ?? slackGrowthUrl ?? undefined, ops: slackOpsUrl ?? undefined, growth: slackGrowthUrl ?? undefined },
        {
          channel: "#ops",
          title: `Budget Alert \u2014 ${state.period}`,
          sections: [{ heading: "Agents", items: alerts }],
        },
      );
    }
  }
}

// ── Phase Tracking ─────────────────────────────────────

async function updatePhaseMetrics(
  ctx: PluginContext,
  companyId: string,
  agentKey: string,
  outcome: "done" | "blocked",
) {
  const state = await readState<PhaseTrackingState>(ctx, companyId, STATE_KEYS.phaseTracking) ?? {};
  const entry = state[agentKey] ?? {
    currentPhase: 1,
    phaseStartDate: nowIso().slice(0, 10),
    metrics: { totalRuns: 0, successfulRuns: 0, overrideCount: 0, overrideRate: 0, consecutiveSuccesses: 0, lastRunAt: null },
  };

  entry.metrics.totalRuns += 1;
  entry.metrics.lastRunAt = nowIso();
  if (outcome === "done") {
    entry.metrics.successfulRuns += 1;
    entry.metrics.consecutiveSuccesses += 1;
  } else {
    entry.metrics.consecutiveSuccesses = 0;
  }
  entry.metrics.overrideRate = entry.metrics.totalRuns > 0
    ? Math.round((entry.metrics.overrideCount / entry.metrics.totalRuns) * 1000) / 1000
    : 0;

  state[agentKey] = entry;
  await writeState(ctx, companyId, STATE_KEYS.phaseTracking, state);
}

async function recordAgentOverride(ctx: PluginContext, companyId: string, agentKey: string) {
  const state = await readState<PhaseTrackingState>(ctx, companyId, STATE_KEYS.phaseTracking) ?? {};
  const entry = state[agentKey];
  if (!entry) return;

  entry.metrics.overrideCount += 1;
  entry.metrics.overrideRate = entry.metrics.totalRuns > 0
    ? Math.round((entry.metrics.overrideCount / entry.metrics.totalRuns) * 1000) / 1000
    : 0;

  state[agentKey] = entry;
  await writeState(ctx, companyId, STATE_KEYS.phaseTracking, state);
}

async function runPhaseGraduationCheck(ctx: PluginContext, companyId: string, config: BlueprintAutomationConfig) {
  const state = await readState<PhaseTrackingState>(ctx, companyId, STATE_KEYS.phaseTracking) ?? {};
  const alerts: string[] = [];
  const now = new Date();
  const rules: Record<string, { minimumDays: number; minimumRuns: number; minimumSuccessRate?: number; maximumOverrideRate?: number }> = {
    "analytics-agent": {
      minimumDays: 14,
      minimumRuns: 10,
      minimumSuccessRate: 0.95,
    },
    "ops-lead": {
      minimumDays: 14,
      minimumRuns: 10,
      maximumOverrideRate: 0.1,
    },
    "intake-agent": {
      minimumDays: 14,
      minimumRuns: 10,
      maximumOverrideRate: 0.1,
    },
  };

  for (const [agentKey, entry] of Object.entries(state)) {
    if (entry.currentPhase >= 3) continue;
    const rule = rules[agentKey];
    if (!rule) continue;
    const phaseStart = new Date(entry.phaseStartDate);
    const daysInPhase = Math.floor((now.getTime() - phaseStart.getTime()) / (1000 * 60 * 60 * 24));
    const successRate = entry.metrics.totalRuns > 0 ? entry.metrics.successfulRuns / entry.metrics.totalRuns : 0;

    const meetsMinimumDays = daysInPhase >= rule.minimumDays;
    const meetsMinimumRuns = entry.metrics.totalRuns >= rule.minimumRuns;
    const meetsSuccessRate = rule.minimumSuccessRate === undefined || successRate >= rule.minimumSuccessRate;
    const meetsOverrideRate = rule.maximumOverrideRate === undefined || entry.metrics.overrideRate < rule.maximumOverrideRate;

    if (meetsMinimumDays && meetsMinimumRuns && meetsSuccessRate && meetsOverrideRate) {
      alerts.push(
        `:star: *${agentKey}* eligible for Phase ${entry.currentPhase + 1} graduation \u2014 ${daysInPhase} days in Phase ${entry.currentPhase}, ${(successRate * 100).toFixed(0)}% success rate, ${(entry.metrics.overrideRate * 100).toFixed(1)}% override rate, ${entry.metrics.totalRuns} runs. *Founder approval required.*`,
      );
    }
  }

  if (alerts.length > 0) {
    const slackOpsUrl = await resolveOptionalSecret(ctx, config.secrets?.slackOpsWebhookUrlRef, "SLACK_OPS_WEBHOOK_URL");
    const slackGrowthUrl = await resolveOptionalSecret(ctx, config.secrets?.slackGrowthWebhookUrlRef, "SLACK_GROWTH_WEBHOOK_URL");
    if (slackOpsUrl || slackGrowthUrl) {
      await postSlackDigest(
        { default: slackOpsUrl ?? slackGrowthUrl ?? undefined, ops: slackOpsUrl ?? undefined, growth: slackGrowthUrl ?? undefined },
        {
          channel: "#ops",
          title: "Phase Graduation Eligibility",
          sections: [{ heading: "Eligible Agents", items: alerts }],
        },
      );
    }
  }
}

// ── Analytics Output Proof ─────────────────────────────

async function buildAnalyticsOutputProof(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<AnalyticsOutputProof> {
  const cadence = asString(params.cadence) === "weekly" ? "weekly" : "daily";
  const generatedAt = nowIso();
  const title = `${cadence === "daily" ? "Analytics Daily" : "Analytics Weekly"} Snapshot - ${generatedAt.slice(0, 10)}`;
  const { report, validationErrors } = normalizeAnalyticsStructuredReport(params, cadence);
  const errors: string[] = [];

  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );
  const slackOpsWebhookUrl = await resolveOptionalSecret(
    ctx,
    config.secrets?.slackOpsWebhookUrlRef,
    "SLACK_OPS_WEBHOOK_URL",
  );
  const slackGrowthWebhookUrl = await resolveOptionalSecret(
    ctx,
    config.secrets?.slackGrowthWebhookUrlRef,
    "SLACK_GROWTH_WEBHOOK_URL",
  );

  const dataAvailability = [
    configuredSourceStatus(
      "Notion reporting",
      Boolean(notionToken),
      "Notion token is configured for Work Queue and Knowledge writes.",
      "NOTION_API_TOKEN is not configured for this host.",
    ),
    configuredSourceStatus(
      "Slack digest delivery",
      Boolean(slackGrowthWebhookUrl || slackOpsWebhookUrl),
      "Slack webhook target is configured for growth and analytics digests.",
      "No Slack webhook target is configured for this host.",
    ),
    configuredSourceStatus(
      "GA4 measurement feed",
      Boolean(process.env.VITE_GA_MEASUREMENT_ID),
      "GA4 measurement ID is present in the runtime environment.",
      "GA4 measurement ID is not present in the Paperclip runtime environment.",
    ),
    configuredSourceStatus(
      "Stripe revenue feed",
      Boolean(process.env.STRIPE_SECRET_KEY),
      "Stripe secret key is present in the runtime environment.",
      "Stripe secret key is not present in the Paperclip runtime environment.",
    ),
    configuredSourceStatus(
      "Firestore admin feed",
      Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        (process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
      ),
      "Firestore admin credentials are present in the runtime environment.",
      "Firestore admin credentials are not present in the Paperclip runtime environment.",
    ),
  ];

  const reportLines = [
    `Generated at: ${generatedAt}`,
    `Cadence: ${cadence}`,
    "",
    "## Headline",
    report.headline,
    "",
    "## Summary Bullets",
    ...report.summaryBullets.map((line) => `- ${line}`),
    "",
    "## Workflow Findings",
    ...report.workflowFindings.map((line) => `- ${line}`),
    "",
    "## Risks",
    ...report.risks.map((line) => `- ${line}`),
    "",
    "## Recommended Follow-Ups",
    ...report.recommendedFollowUps.map((line) => `- ${line}`),
    "",
    "## Data Availability",
    ...dataAvailability.map((entry) => `- ${entry.source}: ${entry.status} — ${entry.detail}`),
  ];
  if (validationErrors.length > 0) {
    reportLines.push("", "## Validation Errors", ...validationErrors.map((line) => `- ${line}`));
  }
  if (errors.length > 0) {
    reportLines.push("", "## Collection Errors", ...errors.map((line) => `- ${line}`));
  }

  const result: AnalyticsOutputProof = {
    success: false,
    outcome: "blocked",
    cadence,
    generatedAt,
    title,
    report,
    dataAvailability,
    proofLinks: [],
    issueComment: "",
    errors,
  };

  if (validationErrors.length === 0 && notionToken) {
    try {
      const notionClient = createNotionClient({ token: notionToken });
      const knowledgeEntry = await createKnowledgeEntry(notionClient, {
        title,
        type: "Reference",
        system: "WebApp",
        content: reportLines.join("\n"),
      });
      const workQueueEntry = await createWorkQueueItem(notionClient, {
        title,
        priority: cadence === "daily" ? "P2" : "P1",
        system: "WebApp",
        lifecycleStage: "Open",
        workType: "Refresh",
        substage: [
          report.headline,
          knowledgeEntry.pageUrl ? `Knowledge page: ${knowledgeEntry.pageUrl}` : `Knowledge page ID: ${knowledgeEntry.pageId}`,
        ].join(" "),
      });
      result.notion = {
        workQueuePageId: workQueueEntry.pageId,
        workQueuePageUrl: workQueueEntry.pageUrl,
        knowledgePageId: knowledgeEntry.pageId,
        knowledgePageUrl: knowledgeEntry.pageUrl,
      };
    } catch (error) {
      errors.push(`Notion write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length === 0 && (slackGrowthWebhookUrl || slackOpsWebhookUrl)) {
    try {
      result.slack = await postSlackDigest(
        {
          default: slackOpsWebhookUrl ?? slackGrowthWebhookUrl ?? undefined,
          ops: slackOpsWebhookUrl ?? undefined,
          growth: slackGrowthWebhookUrl ?? undefined,
        },
        {
          channel: cadence === "daily" ? "#analytics" : "#growth",
          title,
          sections: [
            { heading: "Headline", items: [report.headline] },
            { heading: "Summary", items: report.summaryBullets },
            { heading: "Workflow Findings", items: report.workflowFindings },
            { heading: "Risks", items: report.risks },
            { heading: "Recommended Follow-Ups", items: report.recommendedFollowUps },
          ],
        },
      );
      if (!result.slack.ok) {
        errors.push(`Slack digest failed with HTTP ${result.slack.statusCode ?? "unknown"}: ${result.slack.responseBody ?? "no response body"}`);
      }
    } catch (error) {
      errors.push(`Slack digest failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length > 0) {
    errors.push(...validationErrors);
  }

  const failureReasons: string[] = [];
  if (!result.notion?.workQueuePageId) {
    failureReasons.push("Missing Notion Work Queue artifact.");
  }
  if (!result.notion?.knowledgePageId) {
    failureReasons.push("Missing Notion Knowledge artifact.");
  }
  if (!result.slack?.ok) {
    if (result.slack) {
      failureReasons.push(
        `Slack digest failed for ${result.slack.routedChannel} with HTTP ${result.slack.statusCode ?? "unknown"}${result.slack.responseBody ? `: ${result.slack.responseBody}` : ""}.`,
      );
    } else {
      failureReasons.push("Missing Slack digest artifact.");
    }
  }

  result.proofLinks = [
    result.notion?.workQueuePageUrl,
    result.notion?.knowledgePageUrl,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  result.failureReason = [...failureReasons, ...errors].join(" ");
  result.success = failureReasons.length === 0 && errors.length === 0;
  result.outcome = result.success ? "done" : "blocked";
  result.issueComment = formatAnalyticsIssueComment(result);

  // Track routine health, budget, and phase metrics
  await updateRoutineHealth(
    ctx,
    companyId,
    `analytics-${cadence}`,
    `Analytics ${cadence.charAt(0).toUpperCase()}${cadence.slice(1)}`,
    "analytics-agent",
    result.outcome,
    result.failureReason,
    asString(params.issueId),
  );
  await trackAgentRun(ctx, companyId, "analytics-agent");
  await updatePhaseMetrics(ctx, companyId, "analytics-agent", result.outcome);

  return result;
}

async function createFollowUpIssue(
  ctx: PluginContext,
  companyId: string,
  input: {
    parentIssueId: string;
    title: string;
    description: string;
    projectName: string;
    assignee: string;
    priority?: string;
  },
) {
  const project = await resolveProject(ctx, companyId, input.projectName);
  const assignee = await resolveAgent(ctx, companyId, input.assignee);
  const followUp = await (ctx.issues.create as any)({
    companyId,
    projectId: project.id,
    parentId: input.parentIssueId,
    title: input.title,
    description: `${input.description}\n\n## Blocker Trace\n- Parent issue: ${input.parentIssueId}`,
    priority: normalizeIssuePriority(input.priority, "high"),
    assigneeAgentId: assignee.id,
    status: "todo",
    originKind: ORIGIN_KIND,
    originId: `blocker:${input.parentIssueId}:${input.projectName}:${input.title}`,
  });
  await ctx.issues.createComment(
    input.parentIssueId,
    `Created follow-up blocker issue ${followUp.id}: ${followUp.title}`,
    companyId,
  );
  await appendRecentEvent(ctx, companyId, {
    kind: "blocker-follow-up",
    title: input.title,
    issueId: followUp.id,
    detail: `Parent issue ${input.parentIssueId}`,
  });
  const config = await getConfig(ctx);
  await sendNotification(ctx, config, companyId, {
    headline: "Blueprint automation created a blocker follow-up issue.",
    issueTitle: followUp.title,
    issueId: followUp.id,
    projectName: input.projectName,
    priority: followUp.priority,
    status: followUp.status,
    detail: `Parent issue ${input.parentIssueId}`,
  });
  return followUp;
}

async function getPrimaryWorkspaceForRepo(
  ctx: PluginContext,
  companyId: string,
  repoConfig: RepoConfig,
): Promise<{ projectId: string; workspace: PluginWorkspace }> {
  const project = await resolveProject(ctx, companyId, repoConfig.projectName);
  const workspace = await ctx.projects.getPrimaryWorkspace(project.id, companyId);
  if (!workspace) {
    throw new Error(`Primary workspace not found for project ${repoConfig.projectName}`);
  }
  return { projectId: project.id, workspace };
}

function parseGitStatus(output: string) {
  const lines = output.split("\n").filter(Boolean);
  const branchLine = lines[0] ?? "";
  const branch = branchLine.replace(/^##\s*/, "").split("...")[0] ?? "unknown";
  const changedEntries = lines.slice(1);
  const untrackedFiles = changedEntries.filter((line) => line.startsWith("??")).length;
  const aheadMatch = branchLine.match(/ahead (\d+)/);
  const behindMatch = branchLine.match(/behind (\d+)/);
  return {
    branch,
    changedFiles: changedEntries.length,
    untrackedFiles,
    ahead: aheadMatch ? Number(aheadMatch[1]) : 0,
    behind: behindMatch ? Number(behindMatch[1]) : 0,
  };
}

async function scanRepoWorkspace(workspacePath: string) {
  const result = await execFileAsync(GIT_BIN, ["status", "--porcelain=v1", "--branch"], {
    cwd: workspacePath,
  });
  return parseGitStatus(result.stdout);
}

function agentCwd(agent: Agent) {
  const record = agent as unknown as Record<string, unknown>;
  const config = record.adapterConfig && typeof record.adapterConfig === "object"
    ? record.adapterConfig as Record<string, unknown>
    : null;
  return typeof config?.cwd === "string" && config.cwd.length > 0 ? config.cwd : null;
}

async function resolveRepoWorkspacePath(
  ctx: PluginContext,
  companyId: string,
  repoConfig: RepoConfig,
  workspace: PluginWorkspace,
) {
  if (workspace.path && existsSync(workspace.path)) {
    return workspace.path;
  }

  const implementationAgent = await resolveAgent(ctx, companyId, repoConfig.implementationAgent);
  const implementationCwd = agentCwd(implementationAgent);
  if (implementationCwd && existsSync(implementationCwd)) {
    return implementationCwd;
  }

  const reviewAgent = await resolveAgent(ctx, companyId, repoConfig.reviewAgent);
  const reviewCwd = agentCwd(reviewAgent);
  if (reviewCwd && existsSync(reviewCwd)) {
    return reviewCwd;
  }

  throw new Error(
    `No usable repo workspace exists for ${repoConfig.projectName}; checked ${workspace.path || "no primary path"}, implementation agent cwd, and review agent cwd.`,
  );
}

async function scanRepoDrift(ctx: PluginContext, companyId: string, repoConfig: RepoConfig) {
  const { workspace } = await getPrimaryWorkspaceForRepo(ctx, companyId, repoConfig);
  const workspacePath = await resolveRepoWorkspacePath(ctx, companyId, repoConfig, workspace);
  const status = await scanRepoWorkspace(workspacePath);

  await resolveManagedIssue(ctx, {
    companyId,
    sourceType: "repo-scan-error",
    sourceId: repoConfig.key,
    resolutionStatus: "done",
    comment: `Repo scan succeeded again at ${nowIso()}.`,
  });

  if (status.changedFiles > 0) {
    await upsertManagedIssue(ctx, {
      companyId,
      sourceType: "repo-dirty",
      sourceId: repoConfig.key,
      title: `${repoConfig.projectName} local worktree drift`,
      description:
        `The shared ${repoConfig.projectName} workspace currently has ${status.changedFiles} local changes (${status.untrackedFiles} untracked). ` +
        `This needs triage so repo specialists are not working off ambiguous local state.`,
      projectName: repoConfig.projectName,
      assignee: repoConfig.implementationAgent,
      priority: "medium",
      status: "todo",
      metadata: status,
    });
  } else {
    await resolveManagedIssue(ctx, {
      companyId,
      sourceType: "repo-dirty",
      sourceId: repoConfig.key,
      resolutionStatus: "done",
      comment: `Repo scan cleared the local worktree drift condition at ${nowIso()}.`,
    });
  }

  const branchDrift = status.branch !== repoConfig.defaultBranch || status.ahead > 0 || status.behind > 0;
  if (branchDrift) {
    await upsertManagedIssue(ctx, {
      companyId,
      sourceType: "repo-branch-drift",
      sourceId: repoConfig.key,
      title: `${repoConfig.projectName} branch drift`,
      description:
        `The primary workspace for ${repoConfig.projectName} is on branch ${status.branch} with ahead=${status.ahead} and behind=${status.behind}. ` +
        `This needs review before autonomous execution can be trusted on this host.`,
      projectName: repoConfig.projectName,
      assignee: repoConfig.reviewAgent,
      priority: "high",
      status: "todo",
      metadata: status,
    });
  } else {
    await resolveManagedIssue(ctx, {
      companyId,
      sourceType: "repo-branch-drift",
      sourceId: repoConfig.key,
      resolutionStatus: "done",
      comment: `Repo scan cleared the branch drift condition at ${nowIso()}.`,
    });
  }

  return {
    repoKey: repoConfig.key,
    projectName: repoConfig.projectName,
    ...status,
  } satisfies GitRepoScanSummary;
}

async function fetchJson(ctx: PluginContext, url: string, token?: string) {
  const headers: Record<string, string> = {
    "User-Agent": "Blueprint-Paperclip-Automation/0.1",
    Accept: "application/vnd.github+json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await ctx.http.fetch(url, { headers });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}: ${text.slice(0, 200)}`);
  }
  return text.length > 0 ? JSON.parse(text) as Record<string, unknown> : {};
}

async function syncGithubWorkflowRun(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  repoConfig: RepoConfig,
  workflowRun: Record<string, unknown>,
) {
  const workflowName = asString(workflowRun.name) ?? "workflow";
  const branch = asString(workflowRun.head_branch) ?? repoConfig.defaultBranch;
  const runId = String(workflowRun.id ?? `${workflowName}:${branch}`);
  const htmlUrl = asString(workflowRun.html_url);
  const conclusion = asString(workflowRun.conclusion) ?? asString(workflowRun.status) ?? "unknown";
  const sourceId = `${repoConfig.key}:${workflowName}:${branch}`;

  if (["success", "neutral", "skipped"].includes(conclusion)) {
    await resolveManagedIssue(ctx, {
      companyId,
      sourceType: "github-workflow",
      sourceId,
      resolutionStatus: "done",
      comment: `GitHub workflow ${workflowName} recovered on branch ${branch} via run ${runId}.`,
    });
    return;
  }

  if (!["failure", "cancelled", "timed_out", "action_required", "startup_failure"].includes(conclusion)) {
    return;
  }

  await upsertManagedIssue(ctx, {
    companyId,
    sourceType: "github-workflow",
    sourceId,
    title: `${repoConfig.projectName} CI failure: ${workflowName}`,
    description:
      `GitHub Actions reported ${conclusion} for ${workflowName} on branch ${branch}. This should stay tracked in Paperclip until a succeeding run clears it.`,
    projectName: repoConfig.projectName,
    assignee: repoConfig.implementationAgent,
    priority: "high",
    status: "todo",
    signalUrl: htmlUrl,
    metadata: {
      runId,
      workflowName,
      branch,
      conclusion,
      githubOwner: config.githubOwner,
      githubRepo: repoConfig.githubRepo,
    },
    comment: `Latest failing run: ${runId}`,
  });
}

async function pollGithubWorkflows(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
) {
  if (!config.enableGithubPolling || !config.githubTokenRef || !config.githubOwner) {
    return { polled: 0 };
  }

  const token = await ctx.secrets.resolve(config.githubTokenRef);
  let polled = 0;

  for (const repoConfig of config.repoCatalog ?? DEFAULT_REPO_CATALOG) {
    const response = await fetchJson(
      ctx,
      `https://api.github.com/repos/${config.githubOwner}/${repoConfig.githubRepo}/actions/runs?per_page=3`,
      token,
    );
    const workflowRuns = Array.isArray(response.workflow_runs)
      ? response.workflow_runs.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      : [];
    if (workflowRuns[0]) {
      await syncGithubWorkflowRun(ctx, config, companyId, repoConfig, workflowRuns[0]);
      polled += 1;
    }
  }

  return { polled };
}

async function runFullRepoScan(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  reason: string,
) {
  const repoSummaries: GitRepoScanSummary[] = [];
  const errors: string[] = [];

  if (config.enableGitRepoScanning) {
    for (const repoConfig of config.repoCatalog ?? DEFAULT_REPO_CATALOG) {
      try {
        repoSummaries.push(await scanRepoDrift(ctx, companyId, repoConfig));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${repoConfig.projectName}: ${message}`);
        await upsertManagedIssue(ctx, {
          companyId,
          sourceType: "repo-scan-error",
          sourceId: repoConfig.key,
          title: `${repoConfig.projectName} repo scan error`,
          description: `Blueprint automation could not scan ${repoConfig.projectName}: ${message}`,
          projectName: repoConfig.projectName,
          assignee: repoConfig.reviewAgent,
          priority: "high",
          status: "todo",
          metadata: { reason },
        });
      }
    }
  }

  const githubSummary = await pollGithubWorkflows(ctx, config, companyId);
  const summary = {
    reason,
    scannedAt: nowIso(),
    repoSummaries,
    githubSummary,
    errors,
  };
  await writeState(ctx, companyId, STATE_KEYS.lastScan, summary);
  await appendRecentEvent(ctx, companyId, {
    kind: "repo-scan",
    title: "Blueprint automation repo scan completed",
    detail: `Scanned ${repoSummaries.length} repos, polled ${githubSummary.polled} workflow feeds`,
  });
  await writeHealth(ctx, companyId, errors.length > 0 ? "degraded" : "ok", "Repo scan completed");
  return summary;
}

function parseBearerSecret(headers: Record<string, string | string[]>) {
  const authorization = headers.authorization;
  if (typeof authorization === "string" && authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  const direct = headers["x-blueprint-shared-secret"];
  if (typeof direct === "string") return direct.trim();
  return null;
}

async function assertSharedSecret(
  ctx: PluginContext,
  secretRef: string | undefined,
  headers: Record<string, string | string[]>,
) {
  if (!secretRef) {
    return;
  }
  const provided = parseBearerSecret(headers);
  const expected = await ctx.secrets.resolve(secretRef);
  if (!provided || provided !== expected) {
    throw new Error("Shared webhook secret validation failed");
  }
}

async function assertGithubSignature(
  ctx: PluginContext,
  secretRef: string | undefined,
  rawBody: string,
  headers: Record<string, string | string[]>,
) {
  if (!secretRef) {
    return;
  }
  const signatureHeader = headers["x-hub-signature-256"];
  if (typeof signatureHeader !== "string" || !signatureHeader.startsWith("sha256=")) {
    throw new Error("Missing GitHub webhook signature");
  }
  const secret = await ctx.secrets.resolve(secretRef);
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const actual = signatureHeader.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("GitHub webhook signature mismatch");
  }
}

// ── Demand Intel Output Proof ──────────────────────────

function normalizeDemandIntelStructuredReport(
  params: Record<string, unknown>,
  cadence: DemandIntelReportCadence,
): { report: DemandIntelStructuredReport; validationErrors: string[] } {
  const rawLane = asString(params.lane) ?? "";
  const rawConfidence = asString(params.confidence) ?? "";
  const report: DemandIntelStructuredReport = {
    headline: asString(params.headline) ?? "",
    topic: asString(params.topic) ?? "",
    lane: (DEMAND_INTEL_LANES.includes(rawLane as DemandIntelLane)
      ? rawLane
      : "cross-lane") as DemandIntelLane,
    companyOrPattern: asString(params.companyOrPattern) ?? "",
    city: asString(params.city) ?? "",
    signals: coerceStringArray(params.signals),
    proofRequirements: coerceStringArray(params.proofRequirements),
    channelFindings: coerceStringArray(params.channelFindings),
    partnershipFindings: coerceStringArray(params.partnershipFindings),
    recommendedActions: coerceStringArray(params.recommendedActions),
    confidence: (DEMAND_INTEL_CONFIDENCE_LEVELS.includes(rawConfidence as DemandIntelConfidence)
      ? rawConfidence
      : "medium") as DemandIntelConfidence,
    openQuestions: coerceStringArray(params.openQuestions),
  };

  const validationErrors: string[] = [];
  if (!report.headline) {
    validationErrors.push(`Missing headline for ${cadence} demand intel report.`);
  }
  if (!report.topic) {
    validationErrors.push("Missing topic for demand intel report.");
  }
  if (!rawLane) {
    validationErrors.push("Missing lane for demand intel report.");
  } else if (!DEMAND_INTEL_LANES.includes(rawLane as DemandIntelLane)) {
    validationErrors.push(`Invalid lane for demand intel report. Expected one of: ${DEMAND_INTEL_LANES.join(", ")}.`);
  }
  if (!report.companyOrPattern) {
    validationErrors.push("Missing companyOrPattern for demand intel report.");
  }
  if (report.lane === "city-demand" && !report.city) {
    validationErrors.push("Missing city for city-demand demand intel report.");
  }
  if (report.signals.length === 0) {
    validationErrors.push("Missing signals for demand intel report.");
  }
  if (report.proofRequirements.length === 0) {
    validationErrors.push("Missing proofRequirements for demand intel report.");
  }
  if (report.channelFindings.length === 0) {
    validationErrors.push("Missing channelFindings for demand intel report.");
  }
  if (report.partnershipFindings.length === 0) {
    validationErrors.push("Missing partnershipFindings for demand intel report.");
  }
  if (report.recommendedActions.length === 0) {
    validationErrors.push("Missing recommendedActions for demand intel report.");
  }
  if (!rawConfidence) {
    validationErrors.push("Missing confidence for demand intel report.");
  } else if (!DEMAND_INTEL_CONFIDENCE_LEVELS.includes(rawConfidence as DemandIntelConfidence)) {
    validationErrors.push(
      `Invalid confidence for demand intel report. Expected one of: ${DEMAND_INTEL_CONFIDENCE_LEVELS.join(", ")}.`,
    );
  }
  if (report.openQuestions.length === 0) {
    validationErrors.push("Missing openQuestions for demand intel report.");
  }

  return { report, validationErrors };
}

function formatDemandIntelIssueComment(result: {
  outcome: "done" | "blocked";
  report: DemandIntelStructuredReport;
  cadence: DemandIntelReportCadence;
  notion?: DemandIntelOutputProof["notion"];
  slack?: DemandIntelOutputProof["slack"];
  failureReason?: string;
}) {
  const slackStatus = result.slack?.ok
    ? `delivered to ${result.slack.routedChannel} (HTTP ${result.slack.statusCode ?? "unknown"})`
    : `missing or failed${result.slack?.statusCode ? ` (HTTP ${result.slack.statusCode})` : ""}`;
  const lines = [
    result.outcome === "done"
      ? `${result.cadence === "daily" ? "Daily" : "Weekly"} demand intel report delivered.`
      : `${result.cadence === "daily" ? "Daily" : "Weekly"} demand intel report blocked.`,
    `- Headline: ${result.report.headline}`,
    `- Topic: ${result.report.topic}`,
    `- Lane: ${result.report.lane}`,
    `- Company or pattern: ${result.report.companyOrPattern}`,
    `- City: ${result.report.city || "n/a"}`,
    `- Confidence: ${result.report.confidence}`,
    `- Signals: ${result.report.signals.length}`,
    `- Open questions: ${result.report.openQuestions.length}`,
    ...(result.failureReason ? [`- Failure reason: ${result.failureReason}`] : []),
    `- Notion Work Queue: ${result.notion?.workQueuePageUrl ?? result.notion?.workQueuePageId ?? "missing"}`,
    `- Notion Knowledge: ${result.notion?.knowledgePageUrl ?? result.notion?.knowledgePageId ?? "missing"}`,
    `- Slack digest: ${slackStatus}`,
  ];
  return lines.join("\n");
}

async function buildDemandIntelOutputProof(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<DemandIntelOutputProof> {
  const cadence: DemandIntelReportCadence = asString(params.cadence) === "weekly" ? "weekly" : "daily";
  const generatedAt = nowIso();
  const { report, validationErrors } = normalizeDemandIntelStructuredReport(params, cadence);
  const title = `Demand Intel ${cadence === "daily" ? "Daily" : "Weekly"} Digest - ${generatedAt.slice(0, 10)} - ${report.topic || "untitled"}`;
  const errors: string[] = [];

  const notionToken = await resolveOptionalSecret(ctx, config.secrets?.notionApiTokenRef, "NOTION_API_TOKEN");
  const slackOpsWebhookUrl = await resolveOptionalSecret(ctx, config.secrets?.slackOpsWebhookUrlRef, "SLACK_OPS_WEBHOOK_URL");
  const slackGrowthWebhookUrl = await resolveOptionalSecret(ctx, config.secrets?.slackGrowthWebhookUrlRef, "SLACK_GROWTH_WEBHOOK_URL");

  const scopeLines = [
    `Topic: ${report.topic}`,
    `Lane: ${report.lane}`,
    `Company or Pattern: ${report.companyOrPattern}`,
    `City: ${report.city || "n/a"}`,
    `Confidence: ${report.confidence}`,
  ];
  const reportLines = [
    `Generated at: ${generatedAt}`,
    `Cadence: ${cadence}`,
    "",
    "## Headline",
    report.headline,
    "",
    "## Scope",
    ...scopeLines.map((line) => `- ${line}`),
    "",
    "## Signals",
    ...report.signals.map((line) => `- ${line}`),
    "",
    "## Proof Requirements",
    ...report.proofRequirements.map((line) => `- ${line}`),
    "",
    "## Channel Findings",
    ...report.channelFindings.map((line) => `- ${line}`),
    "",
    "## Partnership Findings",
    ...report.partnershipFindings.map((line) => `- ${line}`),
    "",
    "## Recommended Actions",
    ...report.recommendedActions.map((line) => `- ${line}`),
    "",
    "## Open Questions",
    ...report.openQuestions.map((line) => `- ${line}`),
  ];

  const result: DemandIntelOutputProof = {
    success: false,
    outcome: "blocked",
    cadence,
    generatedAt,
    title,
    report,
    proofLinks: [],
    issueComment: "",
    errors,
  };

  if (validationErrors.length === 0 && notionToken) {
    try {
      const notionClient = createNotionClient({ token: notionToken });
      const knowledgeEntry = await createKnowledgeEntry(notionClient, {
        title,
        type: "Reference",
        system: "Cross-System",
        content: reportLines.join("\n"),
      });
      const workQueueEntry = await createWorkQueueItem(notionClient, {
        title,
        priority: cadence === "daily" ? "P2" : "P1",
        system: "Cross-System",
        lifecycleStage: "Open",
        workType: "Research",
        substage: [
          `Lane: ${report.lane}.`,
          `Topic: ${report.topic}.`,
          `Company/pattern: ${report.companyOrPattern}.`,
          `City: ${report.city || "n/a"}.`,
          `Confidence: ${report.confidence}.`,
          `Next action: ${report.recommendedActions[0] ?? "Review knowledge entry."}`,
          knowledgeEntry.pageUrl
            ? `Knowledge page: ${knowledgeEntry.pageUrl}`
            : `Knowledge page ID: ${knowledgeEntry.pageId}`,
        ].join(" "),
      });
      result.notion = {
        workQueuePageId: workQueueEntry.pageId,
        workQueuePageUrl: workQueueEntry.pageUrl,
        knowledgePageId: knowledgeEntry.pageId,
        knowledgePageUrl: knowledgeEntry.pageUrl,
      };
    } catch (error) {
      errors.push(`Notion write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length === 0 && (slackGrowthWebhookUrl || slackOpsWebhookUrl)) {
    try {
      result.slack = await postSlackDigest(
        {
          default: slackOpsWebhookUrl ?? slackGrowthWebhookUrl ?? undefined,
          ops: slackOpsWebhookUrl ?? undefined,
          growth: slackGrowthWebhookUrl ?? undefined,
        },
        {
          channel: "#research",
          title,
          sections: [
            { heading: "Headline", items: [report.headline] },
            { heading: "Scope", items: scopeLines },
            { heading: "Signals", items: report.signals.slice(0, 5) },
            { heading: "Proof Requirements", items: report.proofRequirements.slice(0, 5) },
            { heading: "Channel Findings", items: report.channelFindings.slice(0, 5) },
            { heading: "Partnership Findings", items: report.partnershipFindings.slice(0, 5) },
            { heading: "Recommended Actions", items: report.recommendedActions.slice(0, 5) },
            { heading: "Open Questions", items: report.openQuestions.slice(0, 5) },
          ],
        },
      );
      if (!result.slack.ok) {
        errors.push(`Slack digest failed with HTTP ${result.slack.statusCode ?? "unknown"}`);
      }
    } catch (error) {
      errors.push(`Slack digest failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length > 0) errors.push(...validationErrors);

  const failureReasons: string[] = [];
  if (!result.notion?.workQueuePageId) failureReasons.push("Missing Notion Work Queue artifact.");
  if (!result.notion?.knowledgePageId) failureReasons.push("Missing Notion Knowledge artifact.");
  if (!result.slack?.ok) {
    failureReasons.push(result.slack ? `Slack digest failed (HTTP ${result.slack.statusCode ?? "unknown"})` : "Missing Slack digest artifact.");
  }

  result.proofLinks = [result.notion?.workQueuePageUrl, result.notion?.knowledgePageUrl]
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  result.failureReason = [...failureReasons, ...errors].join(" ");
  result.success = failureReasons.length === 0 && errors.length === 0;
  result.outcome = result.success ? "done" : "blocked";
  result.issueComment = formatDemandIntelIssueComment(result);

  await updateRoutineHealth(
    ctx,
    companyId,
    `demand-intel-${cadence}`,
    `Demand Intel ${cadence.charAt(0).toUpperCase()}${cadence.slice(1)}`,
    "demand-intel-agent",
    result.outcome,
    result.failureReason,
    asString(params.issueId),
  );
  await trackAgentRun(ctx, companyId, "demand-intel-agent");
  await updatePhaseMetrics(ctx, companyId, "demand-intel-agent", result.outcome);

  return result;
}

// ── Market Intel Output Proof ──────────────────────────

function normalizeMarketIntelReport(
  params: Record<string, unknown>,
): { report: MarketIntelStructuredReport; validationErrors: string[] } {
  const report: MarketIntelStructuredReport = {
    headline: asString(params.headline) ?? "",
    signals: Array.isArray(params.signals) ? (params.signals as MarketIntelSignal[]) : [],
    competitorUpdates: coerceStringArray(params.competitorUpdates),
    technologyFindings: coerceStringArray(params.technologyFindings),
    recommendedActions: coerceStringArray(params.recommendedActions),
  };
  const validationErrors: string[] = [];
  if (!report.headline) validationErrors.push("Missing headline for market intel report.");
  if (report.signals.length === 0) validationErrors.push("Missing signals for market intel report.");
  if (report.recommendedActions.length === 0) validationErrors.push("Missing recommendedActions for market intel report.");
  return { report, validationErrors };
}

function formatMarketIntelIssueComment(result: {
  outcome: "done" | "blocked";
  report: MarketIntelStructuredReport;
  cadence: MarketIntelReportCadence;
  notion?: MarketIntelOutputProof["notion"];
  slack?: MarketIntelOutputProof["slack"];
  failureReason?: string;
}) {
  const slackStatus = result.slack?.ok
    ? `delivered to ${result.slack.routedChannel} (HTTP ${result.slack.statusCode ?? "unknown"})`
    : `missing or failed${result.slack?.statusCode ? ` (HTTP ${result.slack.statusCode})` : ""}`;
  const lines = [
    result.outcome === "done"
      ? `${result.cadence === "daily" ? "Daily" : "Weekly"} market intel report delivered.`
      : `${result.cadence === "daily" ? "Daily" : "Weekly"} market intel report blocked.`,
    `- Headline: ${result.report.headline}`,
    `- Signals: ${result.report.signals.length}`,
    ...(result.failureReason ? [`- Failure reason: ${result.failureReason}`] : []),
    `- Notion Work Queue: ${result.notion?.workQueuePageUrl ?? result.notion?.workQueuePageId ?? "missing"}`,
    `- Notion Knowledge: ${result.notion?.knowledgePageUrl ?? result.notion?.knowledgePageId ?? "missing"}`,
    `- Slack digest: ${slackStatus}`,
  ];
  return lines.join("\n");
}

async function buildMarketIntelOutputProof(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<MarketIntelOutputProof> {
  const cadence: MarketIntelReportCadence = asString(params.cadence) === "weekly" ? "weekly" : "daily";
  const generatedAt = nowIso();
  const title = `Market Intel ${cadence === "daily" ? "Daily" : "Weekly"} Digest - ${generatedAt.slice(0, 10)}`;
  const { report, validationErrors } = normalizeMarketIntelReport(params);
  const errors: string[] = [];

  const notionToken = await resolveOptionalSecret(ctx, config.secrets?.notionApiTokenRef, "NOTION_API_TOKEN");
  const slackOpsWebhookUrl = await resolveOptionalSecret(ctx, config.secrets?.slackOpsWebhookUrlRef, "SLACK_OPS_WEBHOOK_URL");
  const slackGrowthWebhookUrl = await resolveOptionalSecret(ctx, config.secrets?.slackGrowthWebhookUrlRef, "SLACK_GROWTH_WEBHOOK_URL");

  const signalLines = report.signals.map(
    (s) => `- [${s.combinedScore.toFixed(1)}] ${s.title} (${s.source}): ${s.summary}`,
  );
  const reportLines = [
    `Generated at: ${generatedAt}`,
    `Cadence: ${cadence}`,
    "",
    "## Headline",
    report.headline,
    "",
    "## Signals",
    ...signalLines,
    "",
    "## Competitor Updates",
    ...report.competitorUpdates.map((line) => `- ${line}`),
    "",
    "## Technology Findings",
    ...report.technologyFindings.map((line) => `- ${line}`),
    "",
    "## Recommended Actions",
    ...report.recommendedActions.map((line) => `- ${line}`),
  ];

  const result: MarketIntelOutputProof = {
    success: false,
    outcome: "blocked",
    cadence,
    generatedAt,
    title,
    report,
    proofLinks: [],
    issueComment: "",
    errors,
  };

  if (validationErrors.length === 0 && notionToken) {
    try {
      const notionClient = createNotionClient({ token: notionToken });
      const knowledgeEntry = await createKnowledgeEntry(notionClient, {
        title,
        type: "Reference",
        system: "Cross-System",
        content: reportLines.join("\n"),
      });
      const workQueueEntry = await createWorkQueueItem(notionClient, {
        title,
        priority: cadence === "daily" ? "P2" : "P1",
        system: "Cross-System",
        lifecycleStage: "Open",
        workType: "Refresh",
        substage: [
          report.headline,
          knowledgeEntry.pageUrl ? `Knowledge page: ${knowledgeEntry.pageUrl}` : `Knowledge page ID: ${knowledgeEntry.pageId}`,
        ].join(" "),
      });
      result.notion = {
        workQueuePageId: workQueueEntry.pageId,
        workQueuePageUrl: workQueueEntry.pageUrl,
        knowledgePageId: knowledgeEntry.pageId,
        knowledgePageUrl: knowledgeEntry.pageUrl,
      };
    } catch (error) {
      errors.push(`Notion write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length === 0 && (slackGrowthWebhookUrl || slackOpsWebhookUrl)) {
    try {
      result.slack = await postSlackDigest(
        {
          default: slackOpsWebhookUrl ?? slackGrowthWebhookUrl ?? undefined,
          ops: slackOpsWebhookUrl ?? undefined,
          growth: slackGrowthWebhookUrl ?? undefined,
        },
        {
          channel: "#research",
          title,
          sections: [
            { heading: "Headline", items: [report.headline] },
            { heading: `Signals (${report.signals.length})`, items: signalLines.slice(0, 5) },
            { heading: "Competitor Updates", items: report.competitorUpdates },
            { heading: "Technology Findings", items: report.technologyFindings },
            { heading: "Recommended Actions", items: report.recommendedActions },
          ],
        },
      );
      if (!result.slack.ok) {
        errors.push(`Slack digest failed with HTTP ${result.slack.statusCode ?? "unknown"}`);
      }
    } catch (error) {
      errors.push(`Slack digest failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length > 0) errors.push(...validationErrors);

  const failureReasons: string[] = [];
  if (!result.notion?.workQueuePageId) failureReasons.push("Missing Notion Work Queue artifact.");
  if (!result.notion?.knowledgePageId) failureReasons.push("Missing Notion Knowledge artifact.");
  if (!result.slack?.ok) {
    failureReasons.push(result.slack ? `Slack digest failed (HTTP ${result.slack.statusCode ?? "unknown"})` : "Missing Slack digest artifact.");
  }

  result.proofLinks = [result.notion?.workQueuePageUrl, result.notion?.knowledgePageUrl]
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  result.failureReason = [...failureReasons, ...errors].join(" ");
  result.success = failureReasons.length === 0 && errors.length === 0;
  result.outcome = result.success ? "done" : "blocked";
  result.issueComment = formatMarketIntelIssueComment(result);

  // Track routine health, budget, and phase metrics
  await updateRoutineHealth(
    ctx,
    companyId,
    `market-intel-${cadence}`,
    `Market Intel ${cadence.charAt(0).toUpperCase()}${cadence.slice(1)}`,
    "market-intel-agent",
    result.outcome,
    result.failureReason,
    asString(params.issueId),
  );
  await trackAgentRun(ctx, companyId, "market-intel-agent");
  await updatePhaseMetrics(ctx, companyId, "market-intel-agent", result.outcome);

  return result;
}

async function handleGithubWebhook(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  input: PluginWebhookInput,
) {
  await assertGithubSignature(ctx, config.githubWebhookSecretRef, input.rawBody, input.headers);
  const event = asString(input.headers["x-github-event"]) ?? "unknown";
  const payload = (input.parsedBody ?? {}) as Record<string, unknown>;
  const repoName = asString((payload.repository as Record<string, unknown> | undefined)?.name) ?? "";
  const repoConfig = (config.repoCatalog ?? DEFAULT_REPO_CATALOG).find((entry) => entry.githubRepo === repoName);

  if (!repoConfig) {
    await appendRecentEvent(ctx, companyId, {
      kind: "github-ignored",
      title: `Ignored GitHub event for ${repoName || "unknown repo"}`,
      detail: `No repo mapping for event ${event}`,
    });
    return { ignored: true, event, repoName };
  }

  if (event === "workflow_run" && payload.workflow_run && typeof payload.workflow_run === "object") {
    await syncGithubWorkflowRun(ctx, config, companyId, repoConfig, payload.workflow_run as Record<string, unknown>);
    return { handled: true, event, repoName };
  }

  if (event === "pull_request_review" && payload.review && typeof payload.review === "object") {
    const review = payload.review as Record<string, unknown>;
    const pr = (payload.pull_request ?? {}) as Record<string, unknown>;
    const reviewState = asString(review.state) ?? "unknown";
    const reviewUrl = asString(review.html_url) ?? asString(pr.html_url);
    const prNumber = String(pr.number ?? payload.number ?? "unknown");
    if (reviewState === "changes_requested") {
      await upsertManagedIssue(ctx, {
        companyId,
        sourceType: "github-review",
        sourceId: `${repoConfig.key}:${prNumber}`,
        title: `${repoConfig.projectName} review changes requested on PR #${prNumber}`,
        description:
          `GitHub review feedback requested changes on PR #${prNumber}. The assigned review specialist should convert that feedback into concrete Paperclip work and verify the fix.`,
        projectName: repoConfig.projectName,
        assignee: repoConfig.reviewAgent,
        priority: "high",
        status: "todo",
        signalUrl: reviewUrl,
        metadata: {
          prNumber,
          reviewState,
        },
      });
      return { handled: true, event, repoName };
    }

    if (reviewState === "approved") {
      await resolveManagedIssue(ctx, {
        companyId,
        sourceType: "github-review",
        sourceId: `${repoConfig.key}:${prNumber}`,
        resolutionStatus: "done",
        comment: `GitHub review approved PR #${prNumber}; closing the review-change issue.`,
      });
      return { handled: true, event, repoName };
    }
  }

  await appendRecentEvent(ctx, companyId, {
    kind: "github-unhandled",
    title: `Unhandled GitHub event ${event}`,
    detail: repoConfig.projectName,
  });
  return { handled: false, event, repoName };
}

async function handleGenericCiWebhook(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  input: PluginWebhookInput,
) {
  await assertSharedSecret(ctx, config.ciSharedSecretRef, input.headers);
  const payload = (input.parsedBody ?? {}) as Record<string, unknown>;
  const sourceType = asString(payload.sourceType) ?? "generic-ci";
  const sourceId = asString(payload.sourceId) ?? asString(payload.externalId) ?? randomUUID();
  const state = asString(payload.state) ?? asString(payload.status) ?? "failure";
  const projectName = asString(payload.projectName) ?? asString(payload.repoName);
  const assignee = asString(payload.assignee);
  if (!projectName || !assignee) {
    throw new Error("Generic CI payload requires projectName and assignee");
  }

  if (["success", "passed", "resolved"].includes(state)) {
    return await resolveManagedIssue(ctx, {
      companyId,
      sourceType,
      sourceId,
      resolutionStatus: "done",
      comment: asString(payload.comment) ?? `Generic CI signal ${sourceId} resolved successfully.`,
    });
  }

  return await upsertManagedIssue(ctx, {
    companyId,
    sourceType,
    sourceId,
    title: asString(payload.title) ?? `${projectName} CI issue`,
    description: asString(payload.description) ?? `${projectName} reported a CI issue through the generic webhook path.`,
    projectName,
    assignee,
    priority: normalizeIssuePriority(payload.priority, "high"),
    status: normalizeIssueStatus(payload.status, "todo"),
    signalUrl: asString(payload.signalUrl),
    metadata: payload,
  });
}

async function handleOperatorIntakeWebhook(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  input: PluginWebhookInput,
) {
  await assertSharedSecret(ctx, config.intakeSharedSecretRef, input.headers);
  const payload = (input.parsedBody ?? {}) as Record<string, unknown>;
  const action = asString(payload.action) ?? "upsert";

  if (action === "resolve") {
    return await resolveManagedIssue(ctx, {
      companyId,
      sourceType: asString(payload.sourceType) ?? "operator-signal",
      sourceId: asString(payload.sourceId) ?? "unknown",
      resolutionStatus: asString(payload.resolutionStatus) === "cancelled" ? "cancelled" : "done",
      comment: asString(payload.comment) ?? "Operator intake resolved the work item.",
    });
  }

  if (action === "blocker") {
    return await createFollowUpIssue(ctx, companyId, {
      parentIssueId: asString(payload.parentIssueId) ?? "",
      title: asString(payload.title) ?? "Blueprint blocker",
      description: asString(payload.description) ?? "A blocker was reported through the operator intake path.",
      projectName: asString(payload.projectName) ?? "",
      assignee: asString(payload.assignee) ?? "",
      priority: asString(payload.priority) ?? "high",
    });
  }

  return await upsertManagedIssue(ctx, {
    companyId,
    sourceType: asString(payload.sourceType) ?? "operator-signal",
    sourceId: asString(payload.sourceId) ?? randomUUID(),
    title: asString(payload.title) ?? "Blueprint operator signal",
    description:
      asString(payload.description) ??
      "A normalized operator signal arrived through the intake webhook. This path is suitable for Slack workflow or email-forward integrations.",
    projectName: asString(payload.projectName) ?? "",
    assignee: asString(payload.assignee) ?? "",
    priority: normalizeIssuePriority(payload.priority, "medium"),
    status: normalizeIssueStatus(payload.status, "todo"),
    parentIssueId: asString(payload.parentIssueId),
    signalUrl: asString(payload.signalUrl),
    metadata: payload,
  });
}

async function getDashboardData(ctx: PluginContext, companyId: string): Promise<DashboardData> {
  const company = await ctx.companies.get(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }
  const recentEvents = await readState<RecentEvent[]>(ctx, companyId, STATE_KEYS.recentEvents) ?? [];
  const lastScan = await readState<Record<string, unknown>>(ctx, companyId, STATE_KEYS.lastScan);
  const sourceMappings = await ctx.entities.list({
    entityType: ENTITY_TYPES.sourceMapping,
    scopeKind: "company",
    scopeId: companyId,
    limit: 100,
    offset: 0,
  });
  const openManagedIssues = (
    await Promise.all(
      sourceMappings.map(async (mapping) => {
        const data = (mapping.data ?? {}) as Partial<SourceMappingData>;
        return typeof data.issueId === "string"
          ? await ctx.issues.get(data.issueId, companyId)
          : null;
      }),
    )
  ).filter((issue): issue is Issue => !!issue);

  return {
    companyId,
    companyName: (company as unknown as Record<string, unknown>).name as string,
    pluginId: PLUGIN_ID,
    lastScan,
    recentEvents,
    openManagedIssues: openManagedIssues.map((issue) => ({
      id: issue.id,
      title: issue.title,
      status: issue.status,
      priority: issue.priority,
      assigneeAgentId: issue.assigneeAgentId,
      updatedAt: issue.updatedAt instanceof Date ? issue.updatedAt.toISOString() : String(issue.updatedAt),
    })),
    sourceMappings: sourceMappings.map((mapping) => {
      const data = (mapping.data ?? {}) as Partial<SourceMappingData>;
      return {
        externalId: mapping.externalId,
        title: mapping.title,
        status: mapping.status,
        issueId: typeof data.issueId === "string" ? data.issueId : null,
        hits: typeof data.hits === "number" ? data.hits : 0,
        lastSeenAt: typeof data.lastSeenAt === "string" ? data.lastSeenAt : null,
      };
    }),
  };
}

async function registerDataHandlers(ctx: PluginContext) {
  ctx.data.register(DATA_KEYS.dashboard, async (params) => {
    const config = await getConfig(ctx);
    const companyId =
      asString(params.companyId) ??
      (await findCompany(ctx, asString(params.companyName) ?? config.companyName)).id;
    return await getDashboardData(ctx, companyId);
  });
}

async function registerActionHandlers(ctx: PluginContext) {
  ctx.actions.register(ACTION_KEYS.scanNow, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await runFullRepoScan(ctx, company.id, config, "manual-action");
  });

  ctx.actions.register(ACTION_KEYS.simulateSignal, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await upsertManagedIssue(ctx, {
      companyId: company.id,
      sourceType: asString(params.sourceType) ?? "manual-signal",
      sourceId: asString(params.sourceId) ?? randomUUID(),
      title: asString(params.title) ?? "Blueprint simulated signal",
      description: asString(params.description) ?? "Smoke-test signal injected through the Blueprint automation plugin.",
      projectName: asString(params.projectName) ?? DEFAULT_REPO_CATALOG[0].projectName,
      assignee: asString(params.assignee) ?? DEFAULT_REPO_CATALOG[0].implementationAgent,
      priority: normalizeIssuePriority(params.priority, "medium"),
      status: normalizeIssueStatus(params.status, "todo"),
      signalUrl: asString(params.signalUrl),
      comment: asString(params.comment),
    });
  });

  ctx.actions.register(ACTION_KEYS.reportBlocker, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await createFollowUpIssue(ctx, company.id, {
      parentIssueId: asString(params.parentIssueId) ?? "",
      title: asString(params.title) ?? "Blueprint blocker",
      description: asString(params.description) ?? "A blocker follow-up was created by Blueprint automation.",
      projectName: asString(params.projectName) ?? DEFAULT_REPO_CATALOG[0].projectName,
      assignee: asString(params.assignee) ?? DEFAULT_REPO_CATALOG[0].reviewAgent,
      priority: asString(params.priority) ?? "high",
    });
  });

  ctx.actions.register(ACTION_KEYS.resolveWorkItem, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await resolveManagedIssue(ctx, {
      companyId: company.id,
      sourceType: asString(params.sourceType) ?? "manual-signal",
      sourceId: asString(params.sourceId) ?? "",
      resolutionStatus: asString(params.resolutionStatus) === "cancelled" ? "cancelled" : "done",
      comment: asString(params.comment) ?? "Resolved by Blueprint automation action.",
    });
  });

  ctx.actions.register(ACTION_KEYS.analyticsReport, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await buildAnalyticsOutputProof(ctx, config, company.id, params);
  });

  ctx.actions.register(ACTION_KEYS.demandIntelReport, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await buildDemandIntelOutputProof(ctx, config, company.id, params);
  });

  ctx.actions.register(ACTION_KEYS.marketIntelReport, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await buildMarketIntelOutputProof(ctx, config, company.id, params);
  });
}

async function registerToolHandlers(ctx: PluginContext) {
  ctx.tools.register(
    TOOL_NAMES.scanWork,
    {
      displayName: "Blueprint Scan Work",
      description: "Scan Blueprint repos and GitHub workflow state, then create or update Paperclip issues.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          applyChanges: { type: "boolean" },
        },
      },
    },
    async (params, runContext: ToolRunContext): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, asString((params as Record<string, unknown>).companyName) ?? config.companyName);
      const summary = await runFullRepoScan(ctx, company.id, config, `agent-tool:${runContext.agentId}`);
      return {
        content: `Scanned ${summary.repoSummaries.length} Blueprint repos and polled ${summary.githubSummary.polled} GitHub workflow feeds.`,
        data: summary,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.upsertWorkItem,
    {
      displayName: "Blueprint Upsert Work Item",
      description: "Create or update a deduped Blueprint Paperclip issue.",
      parametersSchema: {
        type: "object",
        properties: {
          sourceType: { type: "string" },
          sourceId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          projectName: { type: "string" },
          assignee: { type: "string" },
          priority: { type: "string" },
          status: { type: "string" },
          parentIssueId: { type: "string" },
          signalUrl: { type: "string" },
        },
        required: ["sourceType", "sourceId", "title", "description", "projectName", "assignee"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      const result = await upsertManagedIssue(ctx, {
        companyId: company.id,
        sourceType: asString((params as Record<string, unknown>).sourceType) ?? "manual-signal",
        sourceId: asString((params as Record<string, unknown>).sourceId) ?? randomUUID(),
        title: asString((params as Record<string, unknown>).title) ?? "Blueprint work item",
        description: asString((params as Record<string, unknown>).description) ?? "Blueprint automation created this work item.",
        projectName: asString((params as Record<string, unknown>).projectName) ?? DEFAULT_REPO_CATALOG[0].projectName,
        assignee: asString((params as Record<string, unknown>).assignee) ?? DEFAULT_REPO_CATALOG[0].implementationAgent,
        priority: normalizeIssuePriority((params as Record<string, unknown>).priority, "medium"),
        status: normalizeIssueStatus((params as Record<string, unknown>).status, "todo"),
        parentIssueId: asString((params as Record<string, unknown>).parentIssueId),
        signalUrl: asString((params as Record<string, unknown>).signalUrl),
      });
      return {
        content: `Upserted ${result.issue.title} as Paperclip issue ${result.issue.id}.`,
        data: result,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.reportBlocker,
    {
      displayName: "Blueprint Report Blocker",
      description: "Create a follow-up blocker issue linked to an existing Paperclip issue.",
      parametersSchema: {
        type: "object",
        properties: {
          parentIssueId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          projectName: { type: "string" },
          assignee: { type: "string" },
          priority: { type: "string" },
        },
        required: ["parentIssueId", "title", "description", "projectName", "assignee"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      const followUp = await createFollowUpIssue(ctx, company.id, {
        parentIssueId: asString((params as Record<string, unknown>).parentIssueId) ?? "",
        title: asString((params as Record<string, unknown>).title) ?? "Blueprint blocker",
        description: asString((params as Record<string, unknown>).description) ?? "A blocker was reported.",
        projectName: asString((params as Record<string, unknown>).projectName) ?? DEFAULT_REPO_CATALOG[0].projectName,
        assignee: asString((params as Record<string, unknown>).assignee) ?? DEFAULT_REPO_CATALOG[0].reviewAgent,
        priority: asString((params as Record<string, unknown>).priority) ?? "high",
      });
      return {
        content: `Created blocker follow-up issue ${followUp.id}.`,
        data: followUp,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.resolveWorkItem,
    {
      displayName: "Blueprint Resolve Work Item",
      description: "Resolve a deduped Blueprint automation issue with an explicit trace comment.",
      parametersSchema: {
        type: "object",
        properties: {
          sourceType: { type: "string" },
          sourceId: { type: "string" },
          resolutionStatus: { type: "string" },
          comment: { type: "string" },
        },
        required: ["sourceType", "sourceId", "resolutionStatus", "comment"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      const result = await resolveManagedIssue(ctx, {
        companyId: company.id,
        sourceType: asString((params as Record<string, unknown>).sourceType) ?? "manual-signal",
        sourceId: asString((params as Record<string, unknown>).sourceId) ?? "",
        resolutionStatus:
          asString((params as Record<string, unknown>).resolutionStatus) === "cancelled"
            ? "cancelled"
            : "done",
        comment: asString((params as Record<string, unknown>).comment) ?? "Resolved by Blueprint automation tool.",
      });
      return {
        content: result.issue ? `Resolved issue ${result.issue.id}.` : "No matching issue found for that source fingerprint.",
        data: result,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.analyticsReport,
    {
      displayName: "Generate Analytics Report",
      description:
        "Create a truthful Blueprint analytics snapshot, write the resulting Notion artifacts, and post the companion Slack digest.",
      parametersSchema: {
        type: "object",
        properties: {
          cadence: { type: "string", enum: ["daily", "weekly"] },
          companyName: { type: "string" },
          issueId: { type: "string" },
          headline: { type: "string" },
          summaryBullets: { type: "array", items: { type: "string" } },
          workflowFindings: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          recommendedFollowUps: { type: "array", items: { type: "string" } },
        },
        required: [
          "cadence",
          "headline",
          "summaryBullets",
          "workflowFindings",
          "risks",
          "recommendedFollowUps",
        ],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const cadence =
        asString((params as Record<string, unknown>).cadence) === "weekly"
          ? "weekly"
          : "daily";
      const report = await buildAnalyticsOutputProof(
        ctx,
        config,
        company.id,
        params as Record<string, unknown>,
      );
      return {
        content: report.success
          ? `Generated ${cadence} analytics report with Notion and Slack outputs.`
          : `Analytics report writer blocked: ${report.failureReason || report.errors.join("; ") || "unknown error"}.`,
        data: report,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.demandIntelReport,
    {
      displayName: "Generate Demand Intel Report",
      description:
        "Create a deterministic demand intelligence report from Blueprint demand-side research, write Notion artifacts, and post the companion Slack digest.",
      parametersSchema: {
        type: "object",
        properties: {
          cadence: { type: "string", enum: ["daily", "weekly"] },
          companyName: { type: "string" },
          issueId: { type: "string" },
          headline: { type: "string" },
          topic: { type: "string" },
          lane: {
            type: "string",
            enum: ["robot-team-demand", "site-operator-lane", "city-demand", "cross-lane"],
          },
          companyOrPattern: { type: "string" },
          city: { type: "string" },
          signals: { type: "array", items: { type: "string" } },
          proofRequirements: { type: "array", items: { type: "string" } },
          channelFindings: { type: "array", items: { type: "string" } },
          partnershipFindings: { type: "array", items: { type: "string" } },
          recommendedActions: { type: "array", items: { type: "string" } },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          openQuestions: { type: "array", items: { type: "string" } },
        },
        required: [
          "cadence",
          "headline",
          "topic",
          "lane",
          "companyOrPattern",
          "signals",
          "proofRequirements",
          "channelFindings",
          "partnershipFindings",
          "recommendedActions",
          "confidence",
          "openQuestions",
        ],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const cadence =
        asString((params as Record<string, unknown>).cadence) === "weekly"
          ? "weekly"
          : "daily";
      const report = await buildDemandIntelOutputProof(
        ctx,
        config,
        company.id,
        params as Record<string, unknown>,
      );
      return {
        content: report.success
          ? `Generated ${cadence} demand intel report with Notion and Slack outputs.`
          : `Demand intel report writer blocked: ${report.failureReason || report.errors.join("; ") || "unknown error"}.`,
        data: report,
      };
    },
  );

  // ── Market Intel Report Tool ──────────────────────────
  ctx.tools.register(
    TOOL_NAMES.marketIntelReport,
    {
      displayName: "Generate Market Intel Report",
      description:
        "Create a deterministic market intelligence report from agent-supplied findings, write Notion artifacts, and post Slack digest.",
      parametersSchema: {
        type: "object",
        properties: {
          cadence: { type: "string", enum: ["daily", "weekly"] },
          companyName: { type: "string" },
          issueId: { type: "string" },
          headline: { type: "string" },
          signals: { type: "array", items: { type: "object" } },
          competitorUpdates: { type: "array", items: { type: "string" } },
          technologyFindings: { type: "array", items: { type: "string" } },
          recommendedActions: { type: "array", items: { type: "string" } },
        },
        required: ["cadence", "headline", "signals", "competitorUpdates", "technologyFindings", "recommendedActions"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, asString((params as Record<string, unknown>).companyName) ?? config.companyName);
      const cadence = asString((params as Record<string, unknown>).cadence) === "weekly" ? "weekly" : "daily";
      const report = await buildMarketIntelOutputProof(ctx, config, company.id, params as Record<string, unknown>);
      return {
        content: report.success
          ? `Generated ${cadence} market intel report with Notion and Slack outputs.`
          : `Market intel report writer blocked: ${report.failureReason || report.errors.join("; ") || "unknown error"}.`,
        data: report,
      };
    },
  );

  // ── Budget, Phase & Override Tools ──────────────────
  ctx.tools.register(
    TOOL_NAMES.budgetStatus,
    {
      displayName: "Budget Status",
      description: "Query current budget status for an agent.",
      parametersSchema: {
        type: "object",
        properties: { agentKey: { type: "string" } },
        required: ["agentKey"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      const state = await readState<BudgetTrackingState>(ctx, company.id, STATE_KEYS.budgetTracking);
      const agentKey = asString((params as Record<string, unknown>).agentKey) ?? "";
      const agentBudget = state?.agents[agentKey];
      const limit = getBudgetLimit(agentKey);
      return {
        content: agentBudget
          ? `${agentKey}: ${agentBudget.runs} runs, $${agentBudget.estimatedCostUsd.toFixed(2)} / $${limit} (${((agentBudget.estimatedCostUsd / limit) * 100).toFixed(0)}%)`
          : `No budget data for ${agentKey} in period ${state?.period ?? "unknown"}.`,
        data: { period: state?.period, agentKey, ...agentBudget, limit },
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.phaseStatus,
    {
      displayName: "Phase Status",
      description: "Query current phase and graduation metrics for an agent.",
      parametersSchema: {
        type: "object",
        properties: { agentKey: { type: "string" } },
        required: ["agentKey"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      const state = await readState<PhaseTrackingState>(ctx, company.id, STATE_KEYS.phaseTracking);
      const agentKey = asString((params as Record<string, unknown>).agentKey) ?? "";
      const entry = state?.[agentKey];
      if (!entry) {
        return { content: `No phase data for ${agentKey}.`, data: { agentKey } };
      }
      const successRate = entry.metrics.totalRuns > 0 ? entry.metrics.successfulRuns / entry.metrics.totalRuns : 0;
      return {
        content: `${agentKey}: Phase ${entry.currentPhase}, ${entry.metrics.totalRuns} runs, ${(successRate * 100).toFixed(0)}% success, ${(entry.metrics.overrideRate * 100).toFixed(1)}% override rate`,
        data: { agentKey, ...entry },
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.recordOverride,
    {
      displayName: "Record Override",
      description: "Record when a human or lead overrides an agent decision.",
      parametersSchema: {
        type: "object",
        properties: {
          agentKey: { type: "string" },
          issueId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["agentKey", "issueId", "reason"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      const agentKey = asString((params as Record<string, unknown>).agentKey) ?? "";
      await recordAgentOverride(ctx, company.id, agentKey);
      return {
        content: `Override recorded for ${agentKey}.`,
        data: { agentKey, issueId: asString((params as Record<string, unknown>).issueId), reason: asString((params as Record<string, unknown>).reason) },
      };
    },
  );

  // ── Notion Tools ──────────────────────────────────────
  try {
    const config = await getConfig(ctx);
    const notionToken = await resolveOptionalSecret(
      ctx,
      config.secrets?.notionApiTokenRef,
      "NOTION_API_TOKEN",
    );
    if (notionToken) {
      const notionClient = createNotionClient({ token: notionToken });
      const notionTools = buildNotionToolHandlers(notionClient);

      ctx.tools.register(
        TOOL_NAMES.notionReadWorkQueue,
        {
          displayName: "Read Notion Work Queue",
          description: "Query Blueprint Work Queue items by system, priority, or lifecycle stage.",
          parametersSchema: {
            type: "object",
            properties: {
              system: { type: "string" },
              priority: { type: "string" },
              lifecycleStage: { type: "string" },
            },
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionReadWorkQueue](params as any);
          return { content: `Found ${result.count} work queue items.`, data: result };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionWriteWorkQueue,
        {
          displayName: "Write Notion Work Queue",
          description: "Create or update items in Blueprint Work Queue.",
          parametersSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              priority: { type: "string" },
              system: { type: "string" },
              lifecycleStage: { type: "string" },
              workType: { type: "string" },
              substage: { type: "string" },
            },
            required: ["title", "priority", "system"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionWriteWorkQueue](params as any);
          return { content: `Created work queue item ${result.pageId}.`, data: result };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionWriteKnowledge,
        {
          displayName: "Write Notion Knowledge",
          description: "Create entries in Blueprint Knowledge database.",
          parametersSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              type: { type: "string" },
              system: { type: "string" },
              content: { type: "string" },
            },
            required: ["title", "type", "content"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionWriteKnowledge](params as any);
          return { content: `Created knowledge entry ${result.pageId}.`, data: result };
        },
      );
    }
  } catch {
    // Notion token not configured — tools will not be available
  }

  // ── Slack Tools ───────────────────────────────────────
  try {
    const config = await getConfig(ctx);
    const slackOpsWebhookUrl = await resolveOptionalSecret(
      ctx,
      config.secrets?.slackOpsWebhookUrlRef,
      "SLACK_OPS_WEBHOOK_URL",
    );
    const slackGrowthWebhookUrl = await resolveOptionalSecret(
      ctx,
      config.secrets?.slackGrowthWebhookUrlRef,
      "SLACK_GROWTH_WEBHOOK_URL",
    );
    if (slackOpsWebhookUrl || slackGrowthWebhookUrl) {
      const slackTools = buildSlackToolHandler({
        default: slackOpsWebhookUrl ?? slackGrowthWebhookUrl ?? undefined,
        ops: slackOpsWebhookUrl ?? undefined,
        growth: slackGrowthWebhookUrl ?? undefined,
      });
      ctx.tools.register(
        TOOL_NAMES.slackPostDigest,
        {
          displayName: "Post Slack Digest",
          description: "Post formatted digest message to a Slack channel.",
          parametersSchema: {
            type: "object",
            properties: {
              channel: { type: "string" },
              title: { type: "string" },
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    heading: { type: "string" },
                    items: { type: "array", items: { type: "string" } },
                  },
                },
              },
            },
            required: ["channel", "title", "sections"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await slackTools[TOOL_NAMES.slackPostDigest](params as any);
          return {
            content: result.success
              ? `Digest posted to ${result.routedChannel}.`
              : `Failed to post digest to ${result.routedChannel}.`,
            data: result,
          };
        },
      );
    }
  } catch {
    // Slack webhook not configured — tool will not be available
  }

  // ── Web Search Tool ─────────────────────────────────────
  try {
    const config = await getConfig(ctx);
    const searchApiKey = await resolveOptionalSecret(
      ctx,
      config.secrets?.searchApiKeyRef,
      "SEARCH_API_KEY",
    );
    const searchApiProvider = await resolveOptionalSecret(
      ctx,
      config.secrets?.searchApiProviderRef,
      "SEARCH_API_PROVIDER",
    ) ?? "perplexity";
    if (searchApiKey) {
      const searchTools = buildWebSearchToolHandler({
        apiKey: searchApiKey,
        provider: searchApiProvider,
      });
      ctx.tools.register(
        TOOL_NAMES.webSearch,
        {
          displayName: "Web Search",
          description:
            "Search the web for market intelligence, competitor info, technology trends, and research papers.",
          parametersSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "The search query" },
            },
            required: ["query"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await searchTools[TOOL_NAMES.webSearch](params as any);
          return {
            content: `Search complete: ${result.citations.length} citations found.`,
            data: result,
          };
        },
      );
    }
  } catch {
    // Search API not configured — tool will not be available
  }
}

async function runRepoScanJob(ctx: PluginContext, _job: PluginJobContext) {
  const config = await getConfig(ctx);
  const company = await findCompany(ctx, config.companyName);
  await runFullRepoScan(ctx, company.id, config, JOB_KEYS.repoScan);
}

async function runOpsQueueScanJob(ctx: PluginContext, companyId: string, config: BlueprintAutomationConfig) {
  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );

  if (!notionToken) {
    await appendRecentEvent(ctx, companyId, {
      kind: "ops-queue-scan-skipped",
      title: "Ops queue scan skipped",
      detail: "NOTION_API_TOKEN is not configured.",
    });
    return { synced: 0, skipped: true };
  }

  const notionClient = createNotionClient({ token: notionToken });
  const workQueueItems = await queryWorkQueue(notionClient, {});
  const opsRouting = getOpsRoutingConfig(config);
  let synced = 0;

  for (const item of workQueueItems) {
    await upsertManagedIssue(ctx, {
      companyId,
      sourceType: "notion-work-queue",
      sourceId: item.id,
      title: `Notion Work Queue: ${item.title}`,
      description: [
        "Blueprint automation synced this Notion Work Queue item into Paperclip for active triage.",
        "",
        `- Notion page: ${item.url ?? item.id}`,
        `- System: ${item.system}`,
        `- Priority: ${item.priority}`,
        `- Lifecycle Stage: ${item.lifecycleStage || "unknown"}`,
        `- Work Type: ${item.workType || "unknown"}`,
      ].join("\n"),
      projectName: mapQueueSystemToProject(item.system),
      assignee: opsRouting.opsLead,
      priority: mapQueuePriority(item.priority),
      status: "todo",
      signalUrl: item.url,
      metadata: {
        system: item.system,
        priority: item.priority,
        lifecycleStage: item.lifecycleStage,
        workType: item.workType,
      },
      comment: "Synced from Notion Work Queue scan.",
      suppressRefreshComment: true,
    });
    synced += 1;
  }

  await appendRecentEvent(ctx, companyId, {
    kind: "ops-queue-scan",
    title: "Ops queue scan completed",
    detail: `Synced ${synced} Notion work queue items at ${nowIso()}`,
  });

  return { synced, skipped: false };
}

async function handleWebhook(ctx: PluginContext, input: PluginWebhookInput) {
  const config = await getConfig(ctx);
  const payload = (input.parsedBody ?? {}) as Record<string, unknown>;
  const company = await findCompany(ctx, asString(payload.companyName) ?? config.companyName);
  await writeHealth(ctx, company.id, "ok", `Webhook ${input.endpointKey} received`);

  if (input.endpointKey === WEBHOOK_KEYS.github) {
    return await handleGithubWebhook(ctx, config, company.id, input);
  }
  if (input.endpointKey === WEBHOOK_KEYS.ci) {
    return await handleGenericCiWebhook(ctx, config, company.id, input);
  }
  if (input.endpointKey === WEBHOOK_KEYS.intake) {
    return await handleOperatorIntakeWebhook(ctx, config, company.id, input);
  }
  if (input.endpointKey === WEBHOOK_KEYS.opsFirestore) {
    const parsed = await handleFirestoreWebhook(input, getOpsRoutingConfig(config));
    if (parsed.workItem) {
      return await upsertManagedIssue(ctx, {
        companyId: company.id,
        ...parsed.workItem,
        status: "todo",
        comment: "Created from Firestore ops webhook.",
      });
    }
    return parsed;
  }
  if (input.endpointKey === WEBHOOK_KEYS.opsStripe) {
    const parsed = await handleStripeWebhook(input, getOpsRoutingConfig(config));
    if (parsed.workItem) {
      return await upsertManagedIssue(ctx, {
        companyId: company.id,
        ...parsed.workItem,
        status: "todo",
        comment: "Created from Stripe ops webhook.",
      });
    }
    return parsed;
  }
  if (input.endpointKey === WEBHOOK_KEYS.opsSupport) {
    const parsed = await handleSupportWebhook(input, getOpsRoutingConfig(config));
    if (parsed.workItem) {
      return await upsertManagedIssue(ctx, {
        companyId: company.id,
        ...parsed.workItem,
        status: "todo",
        comment: "Created from support webhook.",
      });
    }
    return parsed;
  }
  throw new Error(`Unsupported Blueprint webhook endpoint: ${input.endpointKey}`);
}

const plugin: PaperclipPlugin = definePlugin({
  async setup(ctx) {
    currentContext = ctx;
    await registerDataHandlers(ctx);
    await registerActionHandlers(ctx);
    await registerToolHandlers(ctx);
    ctx.events.on("agent.run.failed", async (event) => {
      try {
        await handleAgentRunFailureQuotaFallback(ctx, event);
      } catch (error) {
        ctx.logger.warn("agent.run.failed quota fallback handler failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            runId: asString(asRecord(event.payload)?.runId) ?? null,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
    });
    ctx.events.on("agent.updated", async (event) => {
      try {
        const agent = await ctx.agents.get(event.entityId, event.companyId);
        if (agent) {
          await enforceWorkspaceAdapterCooldowns(ctx, event.companyId, [agent]);
        }
      } catch (error) {
        ctx.logger.warn("agent.updated cooldown enforcement failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            agentId: event.entityId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
    });
    ctx.events.on("agent.created", async (event) => {
      try {
        const agent = await ctx.agents.get(event.entityId, event.companyId);
        if (agent) {
          await enforceWorkspaceAdapterCooldowns(ctx, event.companyId, [agent]);
        }
      } catch (error) {
        ctx.logger.warn("agent.created cooldown enforcement failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            agentId: event.entityId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
    });
    ctx.jobs.register(JOB_KEYS.repoScan, async (job) => {
      await runRepoScanJob(ctx, job);
    });
    ctx.jobs.register(JOB_KEYS.opsQueueScan, async (job) => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await runOpsQueueScanJob(ctx, company.id, config);
    });
    ctx.jobs.register(JOB_KEYS.routineHealthCheck, async () => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await runRoutineHealthCheck(ctx, company.id, config);
    });
    ctx.jobs.register(JOB_KEYS.quotaCooldownEnforcer, async () => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await enforceWorkspaceAdapterCooldowns(ctx, company.id);
    });
    try {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await enforceWorkspaceAdapterCooldowns(ctx, company.id);
    } catch (error) {
      ctx.logger.warn("startup cooldown enforcement failed", {
        meta: {
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
  },

  async onHealth(): Promise<PluginHealthDiagnostics> {
    if (!currentContext) {
      return { status: "degraded", message: "Blueprint automation worker has not initialized its context yet." };
    }
    try {
      const config = await getConfig(currentContext);
      const company = await findCompany(currentContext, config.companyName);
      const health = await readState<Record<string, unknown>>(currentContext, company.id, STATE_KEYS.health);
      return {
        status: (health?.status as PluginHealthDiagnostics["status"]) ?? "ok",
        message: asString(health?.message) ?? "Blueprint automation is ready.",
        details: {
          companyId: company.id,
          updatedAt: health?.updatedAt ?? null,
        },
      };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async onWebhook(input) {
    if (!currentContext) {
      throw new Error("Blueprint automation context is not initialized");
    }
    await handleWebhook(currentContext, input);
  },
});

export default plugin;

runWorker(plugin, import.meta.url);
