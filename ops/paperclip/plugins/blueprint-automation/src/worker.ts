import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  definePlugin,
  runWorker,
  type Agent,
  type Company,
  type Issue,
  type IssueComment,
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
  canonicalWorkQueueScanKey,
  collapseWorkQueueItemsByNaturalKey,
  buildNotionToolHandlers,
  createKnowledgeEntry,
  createNotionClient,
  createWorkQueueItem,
  extractAnalyticsSnapshotDate,
  isStaleAnalyticsSnapshotQueueItem,
  mapWorkQueueLifecycleStageToIssueStatus,
  queryDatabase,
  queryWorkQueue,
  upsertKnowledgeEntry,
  upsertWorkQueueItem,
} from "./notion.js";
import { assessNotionDrift, type NotionDriftAssessment } from "./notion-drift.js";
import { collectFounderQueueAlerts, type FounderQueueAlert } from "./firestore.js";
import {
  buildSlackToolHandler,
  postSlackDigest,
  slackChannelsShareDestination,
} from "./slack-notify.js";
import { buildWebSearchToolHandler } from "./web-search.js";
import {
  buildFirehoseBrief,
  createIntrowPartnerDraft,
  dedupeFirehoseSignals,
  fetchFirehoseSignals,
  readIntrowAccount,
  runCustomerResearchSearch,
  searchIntrowPartners,
  synthesizeCustomerResearch,
  type CustomerResearchEvidenceItem,
  type CustomerResearchJTBDItem,
  type CustomerResearchPersona,
  type FirehoseBrief,
  type FirehoseConfig,
  type FirehoseSignal,
  type IntrowConfig,
  type ResearchConfidence,
  updateIntrowPartnerDraft,
} from "./marketing-integrations.js";
import {
  buildLocalQuotaFallbackDescriptor,
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
  buildOpenCodeFallbackAdapterConfig,
  buildHermesFallbackAdapterConfig,
  isModelNotFoundFailure,
  syncExecutionPolicyToAdapter,
} from "./quota-fallback.js";
import {
  buildRoutineHealthAlertSignature,
  buildDailyAccountabilitySnapshot,
  buildManagerStateSnapshot,
  collectRoutineHealthAlerts,
  shouldWakeChiefOfStaffForIssueEvent,
  type ManagerStateSnapshot,
  type ManagerRoutineHealthEntry,
} from "./manager-loop.js";
import {
  buildHandoffAnalytics,
  parseHandoffComment,
  type HandoffAnalytics,
  type HandoffSnapshot,
} from "./handoffs.js";
import {
  assessCityLaunchCompletion,
  findLatestCityLaunchCloseout,
  type CityLaunchRoutineType,
  type CityLaunchStoredSelection,
} from "./city-launch-proof.js";
import {
  buildAgentRunFailureSlackCopy,
  buildAgentConversationSlackCopy,
  buildManagerIssueSlackCopy,
  buildManagedIssueSlackCopy,
  cleanIssueTitle,
  formatAgentName,
  formatOwnerLabel,
  formatIssuePriority,
  formatIssueStatus,
  shouldPostManagerIssueEventToSlack,
} from "./slack-copy.js";
import {
  buildFounderIssueExceptionDigest,
  maybePostFounderException as maybePostFounderExceptionDigest,
  type FounderBusinessLane,
  type FounderExceptionDigest,
} from "./founder-exceptions.js";
import {
  inferRepoAgentForTask,
  isInboundEngineeringQueueTask,
  preferredQueueRepoAgent,
} from "./queue-routing.js";
import { inferChiefOfStaffRoute } from "../../../chief-of-staff-routing.js";
import {
  buildAnalyticsFollowUpIssues,
  type AnalyticsFollowUpIssue,
} from "./analytics-followups.js";
import {
  buildRoutineCatchUpWindowKey,
  isStaleRoutineExecutionIssue,
  recommendedRoutineExecutionPolicy,
  selectHealthyAgentKey,
  shouldTriggerRoutineCatchUp,
} from "./execution-governor.js";
import {
  createGrowthCampaignDraft,
  getGrowthCampaignRecord,
  queueGrowthCampaignSend,
} from "../../../../../server/utils/growth-ops.js";
import {
  buildShipBroadcastIssueSpec,
  formatContentOutcomeReviewIssueComment,
  normalizeContentBrief,
  normalizeContentOutcomeReview,
  type ContentAssetType,
  type ContentBrief,
  type ContentChannel,
  type ContentOutcomeReview,
} from "./content-ops.js";

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
const EXECUTIVE_OPS_PROJECT = "blueprint-executive-ops";
const NOTION_MANAGER_AGENT = "notion-manager-agent";
const BUYER_RISK_OWNER_RESPONSE_GRACE_HOURS = 12;
const MEANINGFUL_PROGRESS_GRACE_MS = 5 * 60 * 1000;
const EXECUTION_DISPATCH_COOLDOWN_MS = 15 * 60 * 1000;
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
    communityUpdates: string;
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
  slackExecWebhookUrlRef?: string;
  slackEngineeringWebhookUrlRef?: string;
  slackManagerWebhookUrlRef?: string;
  searchApiKeyRef?: string;
  searchApiProviderRef?: string;
  firehoseApiTokenRef?: string;
  introwApiTokenRef?: string;
};

type ManagementConfig = {
  chiefOfStaffAgent: string;
};

type MarketingCapabilitiesConfig = {
  firehoseBaseUrl?: string;
  introwBaseUrl?: string;
  firehoseDefaultTopics?: string[];
  firehoseMaxSignalsPerRead?: number;
  introwDefaultWorkspace?: string;
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
  management?: ManagementConfig;
  secrets?: SecretRefsConfig;
  marketingCapabilities?: MarketingCapabilitiesConfig;
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

type NotionQueueDuplicateCandidate = {
  mapping: PluginEntityRecord;
  data: SourceMappingData;
  issue: Issue;
  queueKey: string;
  queueTitle: string;
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
  handoffAnalytics: HandoffAnalytics;
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

type SlackDeliveryTarget =
  | "ops"
  | "growth"
  | "exec"
  | "engineering"
  | "manager"
  | "default"
  | "none";

type AnalyticsReportCadence = "daily" | "weekly";

type AnalyticsStructuredReport = {
  headline: string;
  summaryBullets: string[];
  workflowFindings: string[];
  risks: string[];
  recommendedFollowUps: string[];
};

type AnalyticsReportRunStateEntry = {
  reportKey: string;
  cadence: AnalyticsReportCadence;
  title: string;
  signature: string;
  firstRunAt: string;
  lastRunAt: string;
  issueId?: string;
  notion?: {
    workQueuePageId?: string;
    workQueuePageUrl?: string;
    knowledgePageId?: string;
    knowledgePageUrl?: string;
  };
  slackDeliveredAt?: string;
  slack?: {
    routedChannel: string;
    target: SlackDeliveryTarget;
    statusCode?: number;
    responseBody?: string;
  };
  followUpIssueIds?: string[];
};

type AnalyticsReportRunState = Record<string, AnalyticsReportRunStateEntry>;

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
    target: SlackDeliveryTarget;
    statusCode?: number;
    responseBody?: string;
    deduped?: boolean;
    deliveredAt?: string;
  };
  followUpIssues?: Array<{
    id: string;
    title: string;
    kind: AnalyticsFollowUpIssue["kind"];
    status: string;
  }>;
  proofLinks: string[];
  issueComment: string;
  errors: string[];
};

type MarketIntelReportRunStateEntry = {
  reportKey: string;
  cadence: MarketIntelReportCadence;
  title: string;
  signature: string;
  firstRunAt: string;
  lastRunAt: string;
  issueId?: string;
  notion?: {
    workQueuePageId?: string;
    workQueuePageUrl?: string;
    knowledgePageId?: string;
    knowledgePageUrl?: string;
  };
  slackDeliveredAt?: string;
  slack?: {
    routedChannel: string;
    target: SlackDeliveryTarget;
    statusCode?: number;
    responseBody?: string;
  };
};

type MarketIntelReportRunState = Record<string, MarketIntelReportRunStateEntry>;

type ContentAssetRunState = Record<string, {
  assetKey: string;
  assetType: ContentAssetType;
  channels: ContentChannel[];
  issueId?: string | null;
  title: string;
  reportHeadline: string;
  brief: ContentBrief;
  sourceIssueIds: string[];
  sourceEvidence: string[];
  generatedAt: string;
  lastRunAt: string;
  outcome: "done" | "blocked";
  proofLinks: string[];
  growthCampaignDraftId?: string | null;
}>;

type ContentOutcomeReviewState = Record<string, ContentOutcomeReview[]>;

// ── Community Updates Types ───────────────────────────

type CommunityUpdatesCadence = "weekly" | "ad_hoc";

type CommunityUpdatesStructuredReport = {
  headline: string;
  shippedThisWeek: string[];
  byTheNumbers: string[];
  whatWeLearned: string[];
  whatIsNext: string[];
};

type CommunityUpdatesOutputProof = {
  success: boolean;
  outcome: "done" | "blocked";
  failureReason?: string;
  cadence: CommunityUpdatesCadence;
  generatedAt: string;
  assetKey: string;
  assetType: ContentAssetType;
  channels: ContentChannel[];
  brief: ContentBrief;
  sourceIssueIds: string[];
  sourceEvidence: string[];
  title: string;
  report: CommunityUpdatesStructuredReport;
  growthCampaignDraft?: {
    id: string;
    channel: "sendgrid";
    recipientCount: number;
  };
  notion?: {
    workQueuePageId?: string;
    workQueuePageUrl?: string;
    knowledgePageId?: string;
    knowledgePageUrl?: string;
  };
  slack?: {
    configured: boolean;
    ok?: boolean;
    routedChannel?: string;
    target?: SlackDeliveryTarget;
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
    target: SlackDeliveryTarget;
    statusCode?: number;
    responseBody?: string;
  };
  proofLinks: string[];
  issueComment: string;
  errors: string[];
};

// ── Customer Research Types ───────────────────────────

type CustomerResearchCadence = "daily" | "weekly" | "ad_hoc";

type CustomerResearchOutputProof = {
  success: boolean;
  outcome: "done" | "blocked";
  failureReason?: string;
  cadence: CustomerResearchCadence;
  generatedAt: string;
  title: string;
  topic: string;
  lane: string;
  headline: string;
  synthesis: {
    evidence: CustomerResearchEvidenceItem[];
    jtbd: CustomerResearchJTBDItem[];
    personas: CustomerResearchPersona[];
    objections: string[];
    openQuestions: string[];
    confidence: ResearchConfidence;
    sourceCoverage: string[];
    recommendedActions: string[];
  };
  notion?: {
    workQueuePageId?: string;
    workQueuePageUrl?: string;
    knowledgePageId?: string;
    knowledgePageUrl?: string;
  };
  slack?: {
    ok: boolean;
    routedChannel: string;
    target: SlackDeliveryTarget;
    statusCode?: number;
    responseBody?: string;
  };
  proofLinks: string[];
  issueComment: string;
  errors: string[];
};

type FirehoseSignalCacheState = {
  updatedAt: string;
  signals: FirehoseSignal[];
};

type FounderVisibilityIssue = {
  id: string;
  title: string;
  lane: FounderBusinessLane;
  owner: string;
  projectName?: string | null;
  priority: Issue["priority"];
  status: Issue["status"];
  hoursSinceUpdate: number;
};

type FounderExperimentOutcome = {
  title: string;
  lifecycleStage: string;
  url?: string;
  lastReviewed?: string;
};

type FounderVisibilitySnapshot = {
  needsFounderItems: FounderVisibilityIssue[];
  blockedOver24h: FounderVisibilityIssue[];
  recentlyShipped: FounderVisibilityIssue[];
  queueAlerts: FounderQueueAlert[];
  routineMisses: Array<{
    routineKey: string;
    routineTitle: string;
    agentKey: string;
    kind: "blocked" | "stale";
    detail: string;
    expectedIntervalHours: number | null;
    lastIssueId: string | null;
  }>;
  buyerRisks: FounderVisibilityIssue[];
  capturerRisks: FounderVisibilityIssue[];
  experimentOutcomes: FounderExperimentOutcome[];
};

type FounderRemediationEntry = {
  stage: "owner_nudged" | "rerouted" | "managed_escalation";
  updatedAt: string;
  evidenceKey: string;
};

type FounderRemediationState = Record<string, FounderRemediationEntry>;

type ManagerAlertState = {
  routineHealth: {
    signature: string;
    sentAt: string;
  } | null;
  issueAlerts: Record<string, {
    signature: string;
    sentAt: string;
  }>;
};

type HandoffMonitorEntry = {
  requestCommentId: string | null;
  responseCommentId: string | null;
  escalatedAt: string | null;
  escalatedIssueId: string | null;
  resolvedAt: string | null;
};

type HandoffMonitorState = Record<string, HandoffMonitorEntry>;
type ExecutionDispatchState = Record<string, {
  signature: string;
  assignee: string;
  dispatchedAt: string;
  wakeupRunId: string | null;
}>;
type RoutineCatchupState = Record<string, {
  triggerUpdatedAt: string;
  lastManualRunAt: string;
}>;

// ── Monitoring, Budget & Phase Types ───────────────────

type RoutineHealthState = Record<string, ManagerRoutineHealthEntry>;
type CityLaunchSelectionState = CityLaunchStoredSelection | null;

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
  status?: string;
  concurrencyPolicy?: string;
  catchUpPolicy?: string;
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
    target: SlackDeliveryTarget;
    statusCode?: number;
    responseBody?: string;
    deduped?: boolean;
    deliveredAt?: string;
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
let cachedPaperclipYamlConfig: { mtimeMs: number; config: PaperclipYamlConfig | null } | undefined;

function loadPaperclipYamlConfig(): PaperclipYamlConfig | null {
  try {
    const stats = statSync(PAPERCLIP_COMPANY_CONFIG_PATH);
    if (cachedPaperclipYamlConfig && cachedPaperclipYamlConfig.mtimeMs === stats.mtimeMs) {
      return cachedPaperclipYamlConfig.config;
    }
    const raw = readFileSync(PAPERCLIP_COMPANY_CONFIG_PATH, "utf8");
    cachedPaperclipYamlConfig = {
      mtimeMs: stats.mtimeMs,
      config: (yaml.load(raw) as PaperclipYamlConfig | undefined) ?? null,
    };
  } catch {
    cachedPaperclipYamlConfig = {
      mtimeMs: Number.NaN,
      config: null,
    };
  }

  return cachedPaperclipYamlConfig.config;
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

function normalizeRoutineKey(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function getConfiguredRoutineMetadata(routineKeyOrTitle: string): {
  agentKey: string | null;
  expectedIntervalHours: number | null;
  routineStatus: string | null;
  concurrencyPolicy: string | null;
  catchUpPolicy: string | null;
} {
  const config = loadPaperclipYamlConfig();
  const normalizedKey = normalizeRoutineKey(routineKeyOrTitle);
  const routine =
    config?.routines?.[routineKeyOrTitle]
    ?? config?.routines?.[normalizedKey];
  const recommendedPolicy = recommendedRoutineExecutionPolicy();
  const scheduleTrigger = routine?.triggers?.find((trigger) => trigger.kind === "schedule");
  return {
    agentKey: asString(routine?.agent) ?? null,
    expectedIntervalHours: scheduleTrigger?.cronExpression
      ? estimateRoutineIntervalHours(scheduleTrigger.cronExpression)
      : null,
    routineStatus: asString(routine?.status) ?? "active",
    concurrencyPolicy: asString(routine?.concurrencyPolicy) ?? recommendedPolicy.concurrencyPolicy,
    catchUpPolicy: asString(routine?.catchUpPolicy) ?? recommendedPolicy.catchUpPolicy,
  };
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .map((entry) => asString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
}

function normalizeEmailRecipients(value: unknown): string[] {
  const rawValues = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]+/)
      : [];

  return rawValues
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry, index, items) => entry.includes("@") && items.indexOf(entry) === index);
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

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim().length > 0 && Number.isFinite(Number(value))
      ? Number(value)
      : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
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
  desired?: {
    adapterType: string;
    adapterConfig: Record<string, unknown> | null | undefined;
  } | null,
) {
  return buildLocalQuotaFallbackDescriptor({
    currentAdapterType: adapterType,
    currentAdapterConfig: asRecord(adapterConfig),
    desiredAdapterType: desired?.adapterType ?? null,
    desiredAdapterConfig: asRecord(desired?.adapterConfig),
  });
}

function buildDesiredAdapterDescriptor(agent: Agent): {
  adapterType: LocalQuotaFallbackAdapterType;
  adapterConfig: Record<string, unknown>;
} | null {
  const configuredAgent = getConfiguredAgent(agent.urlKey);
  const configuredAdapterType = configuredAgent?.adapter?.type;
  const configuredAdapterConfig = asRecord(configuredAgent?.adapter?.config);
  if (
    (configuredAdapterType !== "claude_local" &&
      configuredAdapterType !== "codex_local" &&
      configuredAdapterType !== "opencode_local" &&
      configuredAdapterType !== "hermes_local") ||
    !configuredAdapterConfig
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
  if (
    !workspaceKey ||
    (adapterType !== "claude_local" &&
      adapterType !== "codex_local" &&
      adapterType !== "hermes_local")
  ) {
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
    const runtimeConfigRecord = asRecord(agent.runtimeConfig);
    const targetRuntimeConfig = syncExecutionPolicyToAdapter(
      runtimeConfigRecord,
      targetAdapterType,
    );
    const currentExecutionPolicyJson = JSON.stringify(asRecord(runtimeConfigRecord?.executionPolicy));
    const targetExecutionPolicyJson = JSON.stringify(asRecord(targetRuntimeConfig.executionPolicy));
    const executionPolicyDrifted = currentExecutionPolicyJson !== targetExecutionPolicyJson;

    if (agent.adapterType === targetAdapterType && !executionPolicyDrifted) {
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
        runtimeConfig: targetRuntimeConfig,
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
  const management = rawConfig.management && typeof rawConfig.management === "object"
    ? rawConfig.management as Record<string, unknown>
    : {};
  const secrets = rawConfig.secrets && typeof rawConfig.secrets === "object"
    ? rawConfig.secrets as Record<string, unknown>
    : {};
  const marketingCapabilities = rawConfig.marketingCapabilities && typeof rawConfig.marketingCapabilities === "object"
    ? rawConfig.marketingCapabilities as Record<string, unknown>
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
        communityUpdates: asString(growthAgents.communityUpdates) ?? "community-updates-agent",
        marketIntel: asString(growthAgents.marketIntel) ?? "market-intel-agent",
        demandIntel: asString(growthAgents.demandIntel) ?? "demand-intel-agent",
        robotTeamGrowth: asString(growthAgents.robotTeamGrowth) ?? "robot-team-growth-agent",
        siteOperatorPartnership: asString(growthAgents.siteOperatorPartnership) ?? "site-operator-partnership-agent",
        cityDemand: asString(growthAgents.cityDemand) ?? "city-demand-agent",
      },
    },
    management: {
      chiefOfStaffAgent: asString(management.chiefOfStaffAgent) ?? "blueprint-chief-of-staff",
    },
    secrets: {
      notionApiTokenRef: asString(secrets.notionApiTokenRef) ?? asString(secrets.notionApiToken),
      slackOpsWebhookUrlRef: asString(secrets.slackOpsWebhookUrlRef) ?? asString(secrets.slackOpsWebhookUrl),
      slackGrowthWebhookUrlRef: asString(secrets.slackGrowthWebhookUrlRef) ?? asString(secrets.slackGrowthWebhookUrl),
      slackExecWebhookUrlRef: asString(secrets.slackExecWebhookUrlRef) ?? asString(secrets.slackExecWebhookUrl),
      slackEngineeringWebhookUrlRef: asString(secrets.slackEngineeringWebhookUrlRef) ?? asString(secrets.slackEngineeringWebhookUrl),
      slackManagerWebhookUrlRef: asString(secrets.slackManagerWebhookUrlRef) ?? asString(secrets.slackManagerWebhookUrl),
      searchApiKeyRef: asString(secrets.searchApiKeyRef) ?? asString(secrets.searchApiKey),
      searchApiProviderRef: asString(secrets.searchApiProviderRef) ?? asString(secrets.searchApiProvider),
      firehoseApiTokenRef: asString(secrets.firehoseApiTokenRef) ?? asString(secrets.firehoseApiToken),
      introwApiTokenRef: asString(secrets.introwApiTokenRef) ?? asString(secrets.introwApiToken),
    },
    marketingCapabilities: {
      firehoseBaseUrl: asString(marketingCapabilities.firehoseBaseUrl),
      introwBaseUrl: asString(marketingCapabilities.introwBaseUrl),
      firehoseDefaultTopics: asArray(marketingCapabilities.firehoseDefaultTopics)
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
      firehoseMaxSignalsPerRead: asNumber(marketingCapabilities.firehoseMaxSignalsPerRead),
      introwDefaultWorkspace: asString(marketingCapabilities.introwDefaultWorkspace),
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

function preferredAgentDisplayName(
  agent: Agent | null | undefined,
  fallback: string | null | undefined,
) {
  if (agent) {
    const record = agent as unknown as Record<string, unknown>;
    const displayCandidate = [
      record.name,
      record.title,
      record.urlKey,
      record.key,
      record.slug,
      record.identifier,
    ].find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (displayCandidate) {
      return displayCandidate.trim();
    }
  }

  return fallback?.trim() || null;
}

function hoursSinceTimestamp(value: unknown, nowMs: number): number {
  const timestamp = typeof value === "string" ? Date.parse(value) : value instanceof Date ? value.getTime() : Number.NaN;
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((((nowMs - timestamp) / (1000 * 60 * 60)) + Number.EPSILON) * 10) / 10);
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

async function resolveSlackTargets(ctx: PluginContext, config: BlueprintAutomationConfig) {
  const ops = await resolveOptionalSecret(
    ctx,
    config.secrets?.slackOpsWebhookUrlRef,
    "SLACK_OPS_WEBHOOK_URL",
  );
  const growth = await resolveOptionalSecret(
    ctx,
    config.secrets?.slackGrowthWebhookUrlRef,
    "SLACK_GROWTH_WEBHOOK_URL",
  );
  const exec = await resolveOptionalSecret(
    ctx,
    config.secrets?.slackExecWebhookUrlRef,
    "SLACK_EXEC_WEBHOOK_URL",
  );
  const engineering = await resolveOptionalSecret(
    ctx,
    config.secrets?.slackEngineeringWebhookUrlRef,
    "SLACK_ENGINEERING_WEBHOOK_URL",
  );
  const manager = await resolveOptionalSecret(
    ctx,
    config.secrets?.slackManagerWebhookUrlRef,
    "SLACK_MANAGER_WEBHOOK_URL",
  );

  return {
    default: exec ?? manager ?? ops ?? growth ?? engineering ?? undefined,
    ops: ops ?? undefined,
    growth: growth ?? undefined,
    exec: exec ?? undefined,
    engineering: engineering ?? undefined,
    manager: manager ?? undefined,
  };
}

async function resolveFirehoseConfig(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
): Promise<FirehoseConfig | null> {
  const apiToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.firehoseApiTokenRef,
    "FIREHOSE_API_TOKEN",
  );
  const baseUrl = config.marketingCapabilities?.firehoseBaseUrl;
  return apiToken && baseUrl ? {
    apiToken,
    baseUrl,
    defaultTopics: config.marketingCapabilities?.firehoseDefaultTopics,
    maxSignalsPerRead: config.marketingCapabilities?.firehoseMaxSignalsPerRead,
  } : null;
}

async function resolveIntrowConfig(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
): Promise<IntrowConfig | null> {
  const apiToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.introwApiTokenRef,
    "INTROW_API_TOKEN",
  );
  const baseUrl = config.marketingCapabilities?.introwBaseUrl;
  return apiToken && baseUrl ? {
    apiToken,
    baseUrl,
    defaultWorkspace: config.marketingCapabilities?.introwDefaultWorkspace,
  } : null;
}

function normalizeCustomerResearchCadence(value: unknown): CustomerResearchCadence {
  const next = asString(value)?.toLowerCase();
  if (next === "daily" || next === "weekly" || next === "ad_hoc") {
    return next;
  }
  return "ad_hoc";
}

function mergeFirehoseSignalCache(
  existing: FirehoseSignalCacheState | null,
  incoming: FirehoseSignal[],
  maxSignals: number,
): FirehoseSignalCacheState {
  const merged = dedupeFirehoseSignals([
    ...(existing?.signals ?? []),
    ...incoming,
  ]).slice(0, maxSignals);
  return {
    updatedAt: nowIso(),
    signals: merged,
  };
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

function getGrowthRoutingConfig(config: BlueprintAutomationConfig) {
  const agents = config.growthDepartment?.agents;
  return {
    growthLead: agents?.growthLead ?? "growth-lead",
    conversionOptimizer: agents?.conversionOptimizer ?? "conversion-agent",
  };
}

function getChiefOfStaffAgentKey(config: BlueprintAutomationConfig) {
  return config.management?.chiefOfStaffAgent ?? "blueprint-chief-of-staff";
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

function issueNeedsExecution(status: Issue["status"]) {
  return ["backlog", "todo", "in_progress", "in_review"].includes(status);
}

function issueDispatchSignature(issue: Issue) {
  return [
    issue.id,
    issue.status,
    issue.priority,
    issue.assigneeAgentId ?? "unassigned",
    issue.updatedAt,
  ].join("|");
}

function desiredAdapterTypeForAgent(agentKey: string) {
  return asString(getConfiguredAgent(agentKey)?.adapter?.type) ?? null;
}

function preferredRepoAgentForIssue(
  issue: Pick<Issue, "title" | "status" | "projectId">,
  projectName: string | null | undefined,
  config: BlueprintAutomationConfig,
) {
  const repoConfig = (config.repoCatalog ?? DEFAULT_REPO_CATALOG).find(
    (entry) => entry.projectName === projectName,
  );
  if (!repoConfig) {
    return null;
  }

  const normalizedTitle = issue.title.trim().toLowerCase();
  const preferReview =
    issue.status === "in_review"
    || normalizedTitle.includes("review")
    || normalizedTitle.includes("qa")
    || normalizedTitle.includes("audit")
    || normalizedTitle.includes("benchmark")
    || normalizedTitle.includes("changes requested");

  return preferReview ? repoConfig.reviewAgent : repoConfig.implementationAgent;
}

function routeManagedIssueAssignee(
  input: {
    projectName: string;
    title: string;
    description?: string | null;
    assignee?: string | null;
  },
  config: BlueprintAutomationConfig,
) {
  const requestedAssignee = (input.assignee ?? "").trim();
  const repoCatalog = config.repoCatalog ?? DEFAULT_REPO_CATALOG;
  const repoAgent = inferRepoAgentForTask(
    {
      projectName: input.projectName,
      title: input.title,
      description: input.description,
    },
    repoCatalog,
  );
  if (!repoAgent) {
    return requestedAssignee;
  }

  const repoConfig = repoCatalog.find((entry) =>
    entry.implementationAgent === repoAgent || entry.reviewAgent === repoAgent,
  );
  if (!repoConfig) {
    return repoAgent;
  }

  const opsRouting = getOpsRoutingConfig(config);
  const growthRouting = getGrowthRoutingConfig(config);
  const managerOwners = new Set([
    "",
    opsRouting.opsLead,
    growthRouting.growthLead,
    getChiefOfStaffAgentKey(config),
    "blueprint-cto",
  ]);
  const repoOwners = new Set([repoConfig.implementationAgent, repoConfig.reviewAgent]);

  if (managerOwners.has(requestedAssignee) || repoOwners.has(requestedAssignee)) {
    return repoAgent;
  }

  return requestedAssignee;
}

function routeWorkQueueAssignee(
  item: {
    title: string;
    system: string;
    workType?: string | null;
    lifecycleStage?: string | null;
  },
  config: BlueprintAutomationConfig,
) {
  const normalizedTitle = item.title.trim().toLowerCase();
  const normalizedWorkType = (item.workType ?? "").trim().toLowerCase();
  const opsRouting = getOpsRoutingConfig(config);
  const growthRouting = getGrowthRoutingConfig(config);
  const repoCatalog = config.repoCatalog ?? DEFAULT_REPO_CATALOG;
  const repoAgent =
    inferRepoAgentForTask(
      {
        projectName: mapQueueSystemToProject(item.system),
        title: item.title,
      },
      repoCatalog,
    )
    ?? preferredQueueRepoAgent(item.system, item.title, repoCatalog);

  if (repoAgent && isInboundEngineeringQueueTask(item.system, item.title, repoCatalog)) {
    return repoAgent;
  }

  if (normalizedTitle.includes("market intel")) return "market-intel-agent";
  if (normalizedTitle.includes("demand intel")) return "demand-intel-agent";
  if (normalizedTitle.includes("analytics")) return "analytics-agent";
  if (normalizedTitle.includes("community update")) return "community-updates-agent";
  if (normalizedTitle.includes("investor")) return "investor-relations-agent";
  if (normalizedTitle.includes("pricing")) return "revenue-ops-pricing-agent";
  if (normalizedTitle.includes("security") || normalizedTitle.includes("procurement")) return "security-procurement-agent";
  if (normalizedTitle.includes("city launch")) return "city-launch-agent";
  if (normalizedTitle.includes("city demand")) return "city-demand-agent";
  if (normalizedTitle.includes("capturer growth")) return "capturer-growth-agent";
  if (normalizedTitle.includes("robot team")) return "robot-team-growth-agent";
  if (normalizedTitle.includes("site operator")) return "site-operator-partnership-agent";
  if (normalizedTitle.includes("support") || normalizedTitle.includes("finance")) return opsRouting.financeSupportAgent;
  if (normalizedTitle.includes("intake") || normalizedTitle.includes("waitlist") || normalizedTitle.includes("inbound")) return opsRouting.intakeAgent;
  if (normalizedTitle.includes("schedule") || normalizedTitle.includes("field ops")) return opsRouting.fieldOpsAgent;
  if (normalizedTitle.includes("qa") || normalizedTitle.includes("quality")) return opsRouting.captureQaAgent;
  if (normalizedTitle.includes("conversion") || normalizedTitle.includes("cro") || normalizedTitle.includes("experiment")) return growthRouting.conversionOptimizer;

  if (repoAgent) {
    return repoAgent;
  }

  if (normalizedWorkType === "refresh" && item.system.trim().toLowerCase() === "cross-system") {
    return opsRouting.opsLead;
  }

  if ((item.lifecycleStage ?? "").trim().toLowerCase() === "open") {
    return opsRouting.opsLead;
  }

  return opsRouting.opsLead;
}

function isAgentUnavailable(agent: Agent | null | undefined) {
  return !agent || agent.status === "error" || agent.status === "paused";
}

function agentHasDesiredAdapter(agent: Agent, agentKey: string) {
  const desired = desiredAdapterTypeForAgent(agentKey);
  if (!desired) return true;
  return agent.adapterType === desired;
}

function pickFallbackAgentKey(
  config: BlueprintAutomationConfig,
  primaryAgentKey: string,
  issue: Pick<Issue, "title" | "status">,
) {
  const opsRouting = getOpsRoutingConfig(config);
  const growthRouting = getGrowthRoutingConfig(config);
  const chiefOfStaff = getChiefOfStaffAgentKey(config);

  if (primaryAgentKey === chiefOfStaff) {
    return "blueprint-cto";
  }
  if (primaryAgentKey === opsRouting.opsLead || primaryAgentKey === growthRouting.growthLead) {
    return chiefOfStaff;
  }

  const repoConfig = (config.repoCatalog ?? DEFAULT_REPO_CATALOG).find((entry) =>
    entry.implementationAgent === primaryAgentKey || entry.reviewAgent === primaryAgentKey,
  );
  if (repoConfig) {
    return repoConfig.implementationAgent === primaryAgentKey
      ? repoConfig.reviewAgent
      : "blueprint-cto";
  }

  if (
    primaryAgentKey === opsRouting.intakeAgent
    || primaryAgentKey === opsRouting.captureQaAgent
    || primaryAgentKey === opsRouting.fieldOpsAgent
    || primaryAgentKey === opsRouting.financeSupportAgent
  ) {
    return opsRouting.opsLead;
  }

  if (
    primaryAgentKey === "analytics-agent"
    || primaryAgentKey === "market-intel-agent"
    || primaryAgentKey === "demand-intel-agent"
    || primaryAgentKey === "community-updates-agent"
    || primaryAgentKey === "investor-relations-agent"
    || primaryAgentKey === "capturer-growth-agent"
    || primaryAgentKey === "city-launch-agent"
    || primaryAgentKey === "city-demand-agent"
    || primaryAgentKey === "robot-team-growth-agent"
    || primaryAgentKey === "site-operator-partnership-agent"
    || primaryAgentKey === "revenue-ops-pricing-agent"
    || primaryAgentKey === "security-procurement-agent"
    || primaryAgentKey === growthRouting.conversionOptimizer
  ) {
    return growthRouting.growthLead;
  }

  const route = inferChiefOfStaffRoute({
    title: issue.title,
    status: issue.status,
    project: { name: EXECUTIVE_OPS_PROJECT },
  });
  return route?.assigneeKey ?? chiefOfStaff;
}

function buildManagementRouting(config: BlueprintAutomationConfig) {
  return {
    chiefOfStaffKey: getChiefOfStaffAgentKey(config),
    ctoKey: "blueprint-cto",
    ceoKey: "blueprint-ceo",
  };
}

function buildAgentStatusMap(agents: Agent[]) {
  return Object.fromEntries(
    agents.flatMap((agent) =>
      normalizedCandidates(agent as unknown as Record<string, unknown>).map((key) => [key, agent.status ?? null] as const),
    ),
  );
}

async function resolveAssignableAgent(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  preferredAgentKey: string,
) {
  const agents = await listAgents(ctx, companyId);
  const target = preferredAgentKey.trim().toLowerCase();
  const preferredAgent = [...agents]
    .map((entry) => ({ entry, score: scoreAgentMatch(entry, target) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.entry;

  if (!preferredAgent) {
    throw new Error(`Agent not found for Blueprint automation: ${preferredAgentKey}`);
  }

  const preferredKey = normalizedCandidates(preferredAgent as unknown as Record<string, unknown>)[0] ?? target;
  const selected = selectHealthyAgentKey(
    preferredKey,
    buildAgentStatusMap(agents),
    buildManagementRouting(config),
  );
  const selectedAgent = agents.find((agent) =>
    normalizedCandidates(agent as unknown as Record<string, unknown>).includes(selected.assigneeKey),
  ) ?? preferredAgent;

  return {
    agent: selectedAgent,
    preferredKey,
    selectedKey: selected.assigneeKey,
    rerouted: selected.rerouted && selected.assigneeKey !== preferredKey,
    attempted: selected.attempted,
  };
}

function parseCronField(field: string, min: number, max: number) {
  if (field === "*") {
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
  }

  const values = new Set<number>();
  for (const part of field.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (trimmed.includes("-")) {
      const [startRaw, endRaw] = trimmed.split("-", 2);
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
      for (let value = start; value <= end; value += 1) {
        if (value >= min && value <= max) values.add(value);
      }
      continue;
    }
    const value = Number(trimmed);
    if (Number.isFinite(value) && value >= min && value <= max) {
      values.add(value);
    }
  }
  return [...values].sort((left, right) => left - right);
}

function getTimezoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(date);
  const value = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
    weekday: weekdayMap[value("weekday")] ?? 0,
  };
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const parts = getTimezoneParts(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function scheduleWindowPassedToday(
  cronExpression: string,
  timeZone: string,
  now = new Date(),
) {
  const fields = cronExpression.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minuteField, hourField, dayOfMonthField, monthField, dayOfWeekField] = fields;
  if (monthField !== "*") {
    return false;
  }
  const parts = getTimezoneParts(now, timeZone);
  const minutes = parseCronField(minuteField, 0, 59);
  const hours = parseCronField(hourField, 0, 23);
  const daysOfMonth = dayOfMonthField === "*" ? null : parseCronField(dayOfMonthField, 1, 31);
  const daysOfWeek = dayOfWeekField === "*" ? null : parseCronField(dayOfWeekField, 0, 7).map((value) => value === 7 ? 0 : value);

  if (daysOfMonth && !daysOfMonth.includes(parts.day)) return false;
  if (daysOfWeek && !daysOfWeek.includes(parts.weekday)) return false;

  return hours.some((hour) =>
    hour < parts.hour || (hour === parts.hour && minutes.some((minute) => minute <= parts.minute)),
  );
}

function routineCatchupKey(routineId: string, triggerUpdatedAt: string) {
  return `${routineId}:${triggerUpdatedAt}`;
}

function paperclipApiBaseUrl() {
  return process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100";
}

async function fetchPaperclipApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${paperclipApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Paperclip API ${response.status} for ${path}: ${(await response.text()).slice(0, 200)}`);
  }
  return await response.json() as T;
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

async function listAllIssues(ctx: PluginContext, companyId: string) {
  const pageSize = 200;
  const rows: Issue[] = [];
  for (let offset = 0; offset < 2000; offset += pageSize) {
    const page = await ctx.issues.list({ companyId, limit: pageSize, offset });
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function repairManagedIssueRouting(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
) {
  const [issues, agents, projects] = await Promise.all([
    listAllIssues(ctx, companyId),
    listAgents(ctx, companyId),
    listProjects(ctx, companyId),
  ]);
  const agentKeyById = new Map(agents.map((agent) => [agent.id, agent.urlKey]));
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));

  const repaired: Array<{
    issueId: string;
    title: string;
    from: string;
    to: string;
  }> = [];

  for (const issue of issues) {
    if (issue.status === "done" || issue.status === "cancelled") {
      continue;
    }

    const projectName = issue.projectId ? (projectNameById.get(issue.projectId) ?? "") : "";
    const currentAssignee =
      issue.assigneeAgentId
        ? (agentKeyById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId)
        : "";
    const routedAssignee = routeManagedIssueAssignee(
      {
        projectName,
        title: issue.title,
        description: issue.description,
        assignee: currentAssignee,
      },
      config,
    );

    if (!routedAssignee || routedAssignee === currentAssignee) {
      continue;
    }

    const assigneeResolution = await resolveAssignableAgent(ctx, companyId, config, routedAssignee).catch(() => null);
    if (!assigneeResolution || issue.assigneeAgentId === assigneeResolution.agent.id) {
      continue;
    }

    await ctx.issues.update(issue.id, { assigneeAgentId: assigneeResolution.agent.id }, companyId);
    await ctx.issues.createComment(
      issue.id,
      [
        "Routing repair reassigned this issue to the repo lane that matches the current task shape.",
        `- Previous owner: ${formatAgentName(currentAssignee || "unassigned")}`,
        `- New owner: ${formatAgentName(assigneeResolution.selectedKey)}`,
        "- Reason: repo-coded implementation and review work now auto-routes to the matching execution or review lane.",
      ].join("\n"),
      companyId,
    ).catch(() => undefined);

    repaired.push({
      issueId: issue.id,
      title: issue.title,
      from: currentAssignee || "unassigned",
      to: assigneeResolution.selectedKey,
    });
  }

  await appendRecentEvent(ctx, companyId, {
    kind: "routing-repair",
    title: "Managed issue routing repair completed",
    detail: repaired.length > 0
      ? repaired.map((entry) => `${entry.issueId}:${entry.from}->${entry.to}`).join(", ")
      : "No misrouted open issues found.",
  });

  return {
    repairedCount: repaired.length,
    repaired,
  };
}

async function listCommentsForIssue(ctx: PluginContext, companyId: string, issueId: string) {
  return await ctx.issues.listComments(issueId, companyId);
}

async function buildHandoffState(
  ctx: PluginContext,
  companyId: string,
  issues: Array<Issue & { projectName?: string | null }>,
  agents?: Agent[],
) {
  const agentRows = agents ?? await listAgents(ctx, companyId);
  const handoffIssues = issues.filter((issue) => issue.title.trim().toLowerCase().startsWith("[handoff]"));
  const commentsEntries = await Promise.all(
    handoffIssues.map(async (issue) => [issue.id, await listCommentsForIssue(ctx, companyId, issue.id)] as const),
  );
  const commentsByIssueId = new Map(commentsEntries);
  const agentKeyById = new Map(
    agentRows.map((agent) => {
      const firstCandidate = normalizedCandidates(agent as unknown as Record<string, unknown>)[0] ?? agent.id;
      return [agent.id, firstCandidate] as const;
    }),
  );

  return buildHandoffAnalytics({
    issues,
    commentsByIssueId,
    agentKeyById,
    generatedAt: nowIso(),
  });
}

async function buildChiefOfStaffState(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
) {
  const generatedAt = nowIso();
  const [issues, agents, projects, recentEvents, routineHealth, sourceMappings] = await Promise.all([
    listAllIssues(ctx, companyId),
    listAgents(ctx, companyId),
    listProjects(ctx, companyId),
    readState<RecentEvent[]>(ctx, companyId, STATE_KEYS.recentEvents),
    readState<RoutineHealthState>(ctx, companyId, STATE_KEYS.routineHealth),
    ctx.entities.list({
      entityType: ENTITY_TYPES.sourceMapping,
      scopeKind: "company",
      scopeId: companyId,
      limit: 200,
      offset: 0,
    }),
  ]);

  const chiefOfStaffKey = getChiefOfStaffAgentKey(config);
  const chiefOfStaffAgent = agents.find((agent) => normalizedCandidates(agent as unknown as Record<string, unknown>).includes(chiefOfStaffKey));
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const issuesWithProjectName = issues.map((issue) => ({
    ...issue,
    projectName: issue.projectId ? (projectNameById.get(issue.projectId) ?? null) : null,
  }));
  const managedIssueIds = new Set(
    sourceMappings
      .map((mapping) => {
        const data = (mapping.data ?? {}) as Partial<SourceMappingData>;
        return typeof data.issueId === "string" ? data.issueId : null;
      })
      .filter((issueId): issueId is string => Boolean(issueId)),
  );
  const handoffAnalytics = await buildHandoffState(ctx, companyId, issuesWithProjectName, agents);
  const accountabilityIssues = issuesWithProjectName.filter((issue) => hoursSinceTimestamp(issue.updatedAt, Date.parse(generatedAt)) <= 24);
  const accountabilityCommentsEntries = await Promise.all(
    accountabilityIssues.map(async (issue) => [issue.id, await listCommentsForIssue(ctx, companyId, issue.id)] as const),
  );
  const dailyAccountability = buildDailyAccountabilitySnapshot({
    generatedAt,
    issues: issuesWithProjectName,
    agents,
    issueCommentsById: Object.fromEntries(accountabilityCommentsEntries),
    routineHealth: routineHealth ?? {},
  });

  const snapshot = buildManagerStateSnapshot({
    generatedAt,
    chiefOfStaffAgentKey: chiefOfStaffKey,
    chiefOfStaffAgentId: chiefOfStaffAgent?.id ?? null,
    issues: issuesWithProjectName,
    agents,
    routineHealth: routineHealth ?? {},
    recentEvents: recentEvents ?? [],
    managedIssueIds,
    handoffAnalytics,
    dailyAccountability,
  });
  const founderVisibility = await buildFounderVisibility(
    ctx,
    companyId,
    config,
    snapshot,
    issuesWithProjectName,
    agents,
  );

  return {
    ...snapshot,
    founderVisibility,
  };
}

function classifyFounderLane(agentKey: string | null | undefined, title: string): FounderBusinessLane {
  const normalizedAgent = (agentKey ?? "").trim().toLowerCase();
  const normalizedTitle = title.trim().toLowerCase();

  if (
    normalizedAgent.includes("revenue-ops")
    || normalizedAgent.includes("investor")
    || normalizedAgent.includes("chief-of-staff")
    || normalizedAgent.includes("ceo")
    || normalizedAgent.includes("cto")
    || normalizedTitle.includes("founder")
    || normalizedTitle.includes("executive")
  ) {
    return "Executive";
  }
  if (
    normalizedAgent.includes("rights")
    || normalizedAgent.includes("security")
    || normalizedAgent.includes("finance-support")
    || normalizedTitle.includes("rights")
    || normalizedTitle.includes("privacy")
    || normalizedTitle.includes("provenance")
    || normalizedTitle.includes("security")
    || normalizedTitle.includes("payout")
  ) {
    return "Risk";
  }
  if (
    normalizedAgent.includes("buyer-solutions")
    || normalizedAgent.includes("buyer-success")
    || normalizedAgent.includes("solutions-engineering")
    || normalizedTitle.includes("buyer")
    || normalizedTitle.includes("proof")
    || normalizedTitle.includes("quote")
    || normalizedTitle.includes("deal")
  ) {
    return "Buyer";
  }
  if (
    normalizedAgent.includes("capturer")
    || normalizedAgent.includes("capture-qa")
    || normalizedTitle.includes("capturer")
    || normalizedTitle.includes("waitlist")
  ) {
    return "Capturer";
  }
  if (
    normalizedAgent.includes("conversion")
    || normalizedAgent.includes("analytics")
    || normalizedTitle.includes("experiment")
  ) {
    return "Experiment";
  }
  if (
    normalizedAgent.includes("growth")
    || normalizedAgent.includes("market-intel")
    || normalizedAgent.includes("demand-intel")
    || normalizedAgent.includes("outbound")
    || normalizedAgent.includes("community")
    || normalizedTitle.includes("growth")
    || normalizedTitle.includes("community")
  ) {
    return "Growth";
  }
  return "Ops";
}

function buildFounderIssueVisibility(
  issue: Issue & { projectName?: string | null },
  nowMs: number,
  agentKeyById: Map<string, string>,
  agentNameById: Map<string, string>,
): FounderVisibilityIssue {
  const ownerId = issue.assigneeAgentId ?? "";
  const ownerKey = issue.assigneeAgentId ? (agentKeyById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId) : null;
  const owner = issue.assigneeAgentId
    ? formatAgentName(agentNameById.get(issue.assigneeAgentId) ?? ownerKey ?? issue.assigneeAgentId)
    : "Unassigned";
  return {
    id: issue.id,
    title: issue.title,
    lane: classifyFounderLane(ownerKey, issue.title),
    owner,
    projectName: issue.projectName ?? null,
    priority: issue.priority,
    status: issue.status,
    hoursSinceUpdate: hoursSinceTimestamp(issue.updatedAt, nowMs),
  };
}

async function queryFounderExperimentOutcomes(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
): Promise<FounderExperimentOutcome[]> {
  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );
  if (!notionToken) return [];

  const notionClient = createNotionClient({ token: notionToken });
  const pages = await queryDatabase(notionClient, "knowledge", 100);
  return pages
    .filter((page: any) => page?.properties?.["Artifact Type"]?.select?.name === "Experiment Outcome")
    .filter((page: any) => {
      const lifecycleStage = asString(page?.properties?.["Lifecycle Stage"]?.select?.name)?.toLowerCase();
      return lifecycleStage === "keep" || lifecycleStage === "revert" || lifecycleStage === "inconclusive";
    })
    .map((page: any) => ({
      title: typeof page?.properties?.Title?.title?.[0]?.plain_text === "string"
        ? page.properties.Title.title[0].plain_text
        : "",
      lifecycleStage: asString(page?.properties?.["Lifecycle Stage"]?.select?.name) ?? "",
      url: asString(page?.url),
      lastReviewed: asString(page?.properties?.["Last Reviewed"]?.date?.start),
    }))
    .filter((entry) => entry.title.length > 0)
    .slice(0, 10);
}

async function queryNeedsFounderWorkQueue(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
): Promise<FounderVisibilityIssue[]> {
  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );
  if (!notionToken) return [];

  const notionClient = createNotionClient({ token: notionToken });
  const items = await queryWorkQueue(notionClient, { needsFounder: true });
  return items
    .filter((item) => item.lifecycleStage.toLowerCase() !== "done")
    .map((item) => ({
      id: item.id,
      title: item.title,
      lane: (asString(item.businessLane) as FounderBusinessLane | undefined) ?? "Executive",
      owner: item.ownerIds.length > 0 ? item.ownerIds.join(", ") : "Unassigned",
      projectName: null,
      priority: (
        item.priority === "P0"
          ? "critical"
          : item.priority === "P1"
            ? "high"
            : item.priority === "P2"
              ? "medium"
              : "low"
      ) as FounderVisibilityIssue["priority"],
      status: "todo" as Issue["status"],
      hoursSinceUpdate: hoursSinceTimestamp(item.lastStatusChange, Date.now()),
    }))
    .slice(0, 20);
}

async function buildFounderVisibility(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  managerSnapshot: ManagerStateSnapshot,
  issues: Array<Issue & { projectName?: string | null }>,
  agents: Agent[],
): Promise<FounderVisibilitySnapshot> {
  const nowMs = new Date(managerSnapshot.generatedAt).getTime();
  const openStatuses = new Set<Issue["status"]>(["backlog", "todo", "in_progress", "in_review", "blocked"]);
  const agentKeyById = new Map(
    agents.map((agent) => [agent.id, normalizedCandidates(agent as unknown as Record<string, unknown>)[0] ?? agent.id] as const),
  );
  const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name] as const));
  const openIssues = issues.filter((issue) => openStatuses.has(issue.status));
  const founderIssues = openIssues.map((issue) => buildFounderIssueVisibility(issue, nowMs, agentKeyById, agentNameById));
  const [queueAlerts, experimentOutcomes, needsFounderItems] = await Promise.all([
    collectFounderQueueAlerts(managerSnapshot.generatedAt),
    queryFounderExperimentOutcomes(ctx, config),
    queryNeedsFounderWorkQueue(ctx, config),
  ]);

  const blockedOver24h = founderIssues
    .filter((issue) => issue.status === "blocked" && issue.hoursSinceUpdate >= 24)
    .sort((left, right) => right.hoursSinceUpdate - left.hoursSinceUpdate)
    .slice(0, 20);

  const recentlyShipped = managerSnapshot.recentlyCompletedIssues
    .map((issue) => ({
      ...issue,
      lane: classifyFounderLane(issue.assigneeAgentId ? (agentKeyById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId) : null, issue.title),
      owner: issue.assigneeAgentId
        ? formatAgentName(agentNameById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId)
        : "Unassigned",
      projectName: issue.projectName ?? null,
    }))
    .slice(0, 10);

  const buyerRisks = founderIssues
    .filter((issue) => issue.lane === "Buyer" && (issue.status === "blocked" || (issue.priority !== "low" && issue.hoursSinceUpdate >= 48)))
    .sort((left, right) => right.hoursSinceUpdate - left.hoursSinceUpdate)
    .slice(0, 10);

  const capturerRisks = founderIssues
    .filter((issue) => issue.lane === "Capturer" && (issue.status === "blocked" || (issue.priority !== "low" && issue.hoursSinceUpdate >= 72)))
    .sort((left, right) => right.hoursSinceUpdate - left.hoursSinceUpdate)
    .slice(0, 10);

  const routineMisses = managerSnapshot.routineAlerts.map((alert) => ({
    routineKey: alert.routineKey,
    routineTitle: alert.routineTitle,
    agentKey: alert.agentKey,
    kind: alert.kind,
    detail: alert.detail,
    expectedIntervalHours: alert.expectedIntervalHours,
    lastIssueId: alert.lastIssueId,
  }));

  return {
    needsFounderItems,
    blockedOver24h,
    recentlyShipped,
    queueAlerts,
    routineMisses,
    buyerRisks,
    capturerRisks,
    experimentOutcomes,
  };
}

async function postFounderException(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  digest: FounderExceptionDigest,
) {
  return maybePostFounderExceptionDigest(digest, {
    readState: () => readState(ctx, companyId, STATE_KEYS.founderVisibility),
    writeState: (state) => writeState(ctx, companyId, STATE_KEYS.founderVisibility, state),
    resolveSlackTargets: () => resolveSlackTargets(ctx, config),
    postSlackDigest,
  });
}

const CHIEF_OF_STAFF_WAKEUP_COOLDOWN_MS = 5 * 60 * 1000;
const chiefOfStaffLastWakeupByCompany = new Map<string, number>();

async function wakeChiefOfStaff(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  input: {
    reason: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
    title: string;
    detail: string;
    slackChannel?: string;
    slackTitle?: string;
    slackSummary?: string[];
    postToSlack?: boolean;
    bypassCooldown?: boolean;
    suppressSlackIfSameTargetAsChannel?: string;
    eventIssueId?: string;
  },
) {
  if (!input.bypassCooldown) {
    const lastWakeup = chiefOfStaffLastWakeupByCompany.get(companyId) ?? 0;
    const elapsed = Date.now() - lastWakeup;
    if (elapsed < CHIEF_OF_STAFF_WAKEUP_COOLDOWN_MS) {
      ctx.logger.info("chief-of-staff wakeup suppressed by cooldown", {
        reason: input.reason,
        remainingMs: CHIEF_OF_STAFF_WAKEUP_COOLDOWN_MS - elapsed,
      });
      return null;
    }
  }

  const chiefOfStaffKey = getChiefOfStaffAgentKey(config);
  const agent = await resolveAgent(ctx, companyId, chiefOfStaffKey).catch(() => null);
  if (!agent) {
    await appendRecentEvent(ctx, companyId, {
      kind: "chief-of-staff-wakeup-skipped",
      title: `Skipped chief-of-staff wakeup: ${input.title}`,
      detail: `Agent ${chiefOfStaffKey} is not available.`,
    });
    return null;
  }

  const wakeResult = await ctx.agents.wakeup(agent.id, companyId, {
    source: "automation",
    triggerDetail: "system",
    reason: input.reason,
    payload: input.payload,
    idempotencyKey: input.idempotencyKey,
  });

  chiefOfStaffLastWakeupByCompany.set(companyId, Date.now());

  await appendRecentEvent(ctx, companyId, {
    kind: "chief-of-staff-wakeup",
    title: input.title,
    issueId:
      input.eventIssueId
      ?? (typeof input.payload.issueId === "string" ? input.payload.issueId : undefined),
    detail: input.detail,
  });

  if (input.postToSlack !== false) {
    const slackChannel = input.slackChannel ?? "#paperclip-manager";
    const slackTargets = await resolveSlackTargets(ctx, config);
    const skipMirrorPost = input.suppressSlackIfSameTargetAsChannel
      ? slackChannelsShareDestination(
        slackTargets,
        slackChannel,
        input.suppressSlackIfSameTargetAsChannel,
      )
      : false;
    if (!skipMirrorPost) {
      await postSlackDigest(slackTargets, {
        channel: slackChannel,
        title: input.slackTitle ?? input.title,
        sections: [{
          heading: "Update",
          items: (input.slackSummary ?? [input.detail]).filter((line) => line.trim().length > 0),
        }],
      }).catch(() => undefined);
    }
  }

  return wakeResult;
}

function shouldBindChiefOfStaffToIssue(
  chiefOfStaffAgentId: string | null | undefined,
  assigneeAgentId: string | null | undefined,
) {
  if (!assigneeAgentId) {
    return true;
  }
  return Boolean(chiefOfStaffAgentId) && assigneeAgentId === chiefOfStaffAgentId;
}

async function wakeAssignedAgent(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  input: {
    issue: Issue;
    assigneeKey: string;
    reason: string;
    detail: string;
  },
) {
  const issue = input.issue;
  if (!issueNeedsExecution(issue.status)) {
    return null;
  }

  const dispatchState =
    await readState<ExecutionDispatchState>(ctx, companyId, STATE_KEYS.executionDispatches) ?? {};
  const signature = issueDispatchSignature(issue);
  const existing = dispatchState[issue.id];
  const lastDispatchedAt = existing?.dispatchedAt ? Date.parse(existing.dispatchedAt) : Number.NaN;
  if (
    existing?.signature === signature
    && existing.assignee === input.assigneeKey
    && Number.isFinite(lastDispatchedAt)
    && Date.now() - lastDispatchedAt < EXECUTION_DISPATCH_COOLDOWN_MS
  ) {
    return null;
  }

  let resolution = await resolveAssignableAgent(ctx, companyId, config, input.assigneeKey).catch(() => null);
  let agent = resolution?.agent ?? null;
  if (!agent || !resolution) {
    return null;
  }
  if (isAgentUnavailable(agent) || !agentHasDesiredAdapter(agent, resolution.selectedKey)) {
    await healAgentExecutionTopology(ctx, companyId).catch(() => undefined);
    if (agent.status === "error") {
      await ctx.agents.resetRuntimeSession(agent.id, companyId, { taskKey: issue.id }).catch(() => undefined);
    }
    agent = await ctx.agents.get(agent.id, companyId).catch(() => agent);
    resolution = await resolveAssignableAgent(ctx, companyId, config, resolution.selectedKey).catch(() => resolution);
  }
  if (!agent || !resolution || isAgentUnavailable(agent) || !agentHasDesiredAdapter(agent, resolution.selectedKey)) {
    return null;
  }
  if (resolution.rerouted && issue.assigneeAgentId !== agent.id) {
    await ctx.issues.update(issue.id, { assigneeAgentId: agent.id }, companyId).catch(() => undefined);
    await ctx.issues.createComment(
      issue.id,
      [
        "Automation rerouted this execution issue because the preferred owner is currently unavailable.",
        `- Preferred owner: ${formatAgentName(resolution.preferredKey)}`,
        `- Current owner: ${formatAgentName(resolution.selectedKey)}`,
      ].join("\n"),
      companyId,
    ).catch(() => undefined);
  }

  const wakeResult = await ctx.agents.wakeup(agent.id, companyId, {
    source: "automation",
    triggerDetail: "system",
    reason: input.reason,
    payload: {
      issueId: issue.id,
      issueIdentifier: issue.identifier,
      issueTitle: issue.title,
      dispatchReason: input.reason,
    },
    idempotencyKey: `managed-issue-dispatch:${issue.id}:${signature}`,
    forceFreshSession: issue.status === "todo" || issue.status === "backlog" || agent.status === "error",
  });

  const nextState: ExecutionDispatchState = {
    ...dispatchState,
    [issue.id]: {
      signature,
      assignee: resolution.selectedKey,
      dispatchedAt: nowIso(),
      wakeupRunId: asString(wakeResult?.runId) ?? null,
    },
  };
  await writeState(ctx, companyId, STATE_KEYS.executionDispatches, nextState);
  await appendRecentEvent(ctx, companyId, {
    kind: "issue-dispatched",
    title: issue.title,
    issueId: issue.id,
    detail: input.detail,
  });
  return wakeResult;
}

async function healAgentExecutionTopology(
  ctx: PluginContext,
  companyId: string,
) {
  const agents = await listAgents(ctx, companyId);
  const cooldownState =
    await readState<WorkspaceAdapterCooldownState>(ctx, companyId, STATE_KEYS.workspaceAdapterCooldowns) ?? {};
  const repaired: string[] = [];

  for (const agent of agents) {
    const desired = buildDesiredAdapterDescriptor(agent);
    if (!desired) {
      continue;
    }
    const workspaceKey = getLocalAdapterWorkspaceKey(desired.adapterConfig);
    const activeCooldown = getActiveWorkspaceCooldown(
      cooldownState,
      workspaceKey,
      desired.adapterType,
      Date.now(),
    );
    if (activeCooldown && activeCooldown.fallbackAdapterType !== desired.adapterType) {
      continue;
    }

    const runtimeConfigRecord = asRecord(agent.runtimeConfig);
    const targetRuntimeConfig = syncExecutionPolicyToAdapter(
      runtimeConfigRecord,
      desired.adapterType,
    );
    const currentExecutionPolicyJson = JSON.stringify(asRecord(runtimeConfigRecord?.executionPolicy));
    const targetExecutionPolicyJson = JSON.stringify(asRecord(targetRuntimeConfig.executionPolicy));
    const adapterDrifted = agent.adapterType !== desired.adapterType;
    const executionPolicyDrifted = currentExecutionPolicyJson !== targetExecutionPolicyJson;
    const runtimeNeedsRecovery = agent.status === "error";

    if (!adapterDrifted && !executionPolicyDrifted && !runtimeNeedsRecovery) {
      continue;
    }

    if (adapterDrifted || executionPolicyDrifted) {
      await ctx.agents.update(
        agent.id,
        {
          adapterType: desired.adapterType,
          adapterConfig: desired.adapterConfig,
          runtimeConfig: targetRuntimeConfig,
        },
        companyId,
      );
    }
    await ctx.agents.resetRuntimeSession(agent.id, companyId);
    repaired.push(
      `${agent.urlKey}:${agent.adapterType}->${desired.adapterType}${runtimeNeedsRecovery ? `:recovered-${agent.status}` : ""}`,
    );
  }

  if (repaired.length > 0) {
    await appendRecentEvent(ctx, companyId, {
      kind: "agent-topology-repaired",
      title: "Reconciled live agent adapter drift",
      detail: repaired.join(", "),
    });
  }

  return repaired;
}

async function rerouteUnavailableIssueOwners(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
) {
  const [issues, agents, projects] = await Promise.all([
    listAllIssues(ctx, companyId),
    listAgents(ctx, companyId),
    listProjects(ctx, companyId),
  ]);
  const agentById = new Map(agents.map((agent) => [agent.id, agent] as const));
  const agentByKey = new Map(agents.map((agent) => [agent.urlKey, agent] as const));
  const projectNameById = new Map(projects.map((project) => [project.id, project.name] as const));
  const rerouted: string[] = [];

  for (const issue of issues) {
    if (!issue.assigneeAgentId || !issueNeedsExecution(issue.status)) {
      continue;
    }
    const assignee = agentById.get(issue.assigneeAgentId) ?? null;
    if (!assignee) {
      const fallbackCandidates = [
        preferredRepoAgentForIssue(
          issue,
          issue.projectId ? (projectNameById.get(issue.projectId) ?? null) : null,
          config,
        ),
        getChiefOfStaffAgentKey(config),
        "blueprint-cto",
      ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

      const fallback = fallbackCandidates
        .map((key) => agentByKey.get(key) ?? null)
        .find((candidate) => candidate && !isAgentUnavailable(candidate) && agentHasDesiredAdapter(candidate, candidate.urlKey ?? ""));

      if (!fallback) {
        continue;
      }

      await ctx.issues.update(
        issue.id,
        { assigneeAgentId: fallback.id },
        companyId,
      );
      await ctx.issues.createComment(
        issue.id,
        [
          "Automation reassigned this issue because its previous owner record is no longer available.",
          `- New owner: ${formatAgentName(fallback.urlKey)}`,
        ].join("\n"),
        companyId,
      );
      rerouted.push(`${issue.identifier}:missing-owner->${fallback.urlKey}`);
      continue;
    }
    if (!isAgentUnavailable(assignee) && agentHasDesiredAdapter(assignee, assignee.urlKey ?? "")) {
      continue;
    }

    const fallbackCandidates = [
      pickFallbackAgentKey(config, assignee.urlKey, issue),
      getChiefOfStaffAgentKey(config),
      "blueprint-cto",
    ].filter((value, index, all): value is string => Boolean(value) && all.indexOf(value) === index);

    const fallback = fallbackCandidates
      .map((key) => agentByKey.get(key) ?? null)
      .find((candidate) => candidate && !isAgentUnavailable(candidate) && agentHasDesiredAdapter(candidate, candidate.urlKey ?? ""));

    if (!fallback || fallback.id === assignee.id) {
      continue;
    }

    await ctx.issues.update(
      issue.id,
      { assigneeAgentId: fallback.id },
      companyId,
    );
    await ctx.issues.createComment(
      issue.id,
      [
        "Automation rerouted this issue because the current owner is unavailable for execution.",
        `- Previous owner: ${formatAgentName(assignee.urlKey)}`,
        `- New owner: ${formatAgentName(fallback.urlKey)}`,
        `- Reason: agent status=${assignee.status}${agentHasDesiredAdapter(assignee, assignee.urlKey ?? "") ? "" : ` and adapter drifted from configured ${desiredAdapterTypeForAgent(assignee.urlKey ?? "")}`}`,
      ].join("\n"),
      companyId,
    );
    rerouted.push(`${issue.identifier}:${assignee.urlKey}->${fallback.urlKey}`);
  }

  if (rerouted.length > 0) {
    await appendRecentEvent(ctx, companyId, {
      kind: "issue-owner-rerouted",
      title: "Rerouted issues away from unavailable agents",
      detail: rerouted.join(", "),
    });
  }

  return rerouted;
}

async function runExecutionDispatchJob(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
) {
  const issues = await listAllIssues(ctx, companyId);
  const dispatched: string[] = [];

  for (const issue of issues) {
    if (!issue.assigneeAgentId || !issueNeedsExecution(issue.status)) {
      continue;
    }
    if (hoursSinceTimestamp(issue.updatedAt, Date.now()) * 60 * 60 * 1000 < MEANINGFUL_PROGRESS_GRACE_MS) {
      continue;
    }

    const assignee = await ctx.agents.get(issue.assigneeAgentId, companyId).catch(() => null);
    if (!assignee || assignee.urlKey === getChiefOfStaffAgentKey(config)) {
      continue;
    }

    const wakeResult = await wakeAssignedAgent(ctx, companyId, config, {
      issue,
      assigneeKey: assignee.urlKey,
      reason: "execution_dispatch",
      detail: `${issue.title} re-dispatched to ${assignee.urlKey} for execution.`,
    }).catch(() => null);
    if (wakeResult) {
      dispatched.push(`${issue.identifier}:${assignee.urlKey}`);
    }
    if (dispatched.length >= 12) {
      break;
    }
  }

  if (dispatched.length > 0) {
    await appendRecentEvent(ctx, companyId, {
      kind: "execution-dispatch",
      title: "Execution dispatch completed",
      detail: dispatched.join(", "),
    });
  }

  return { dispatched: dispatched.length };
}

async function maybeCatchUpMissedRoutines(
  ctx: PluginContext,
  companyId: string,
) {
  type RoutineTrigger = {
    id: string;
    kind: string;
    enabled?: boolean | null;
    cronExpression?: string | null;
    timezone?: string | null;
    nextRunAt?: string | null;
    lastFiredAt?: string | null;
    updatedAt?: string | null;
    createdAt?: string | null;
  };
  type RoutineDetail = {
    id: string;
    title: string;
    status: string;
    assigneeAgentId?: string | null;
    concurrencyPolicy?: string | null;
    catchUpPolicy?: string | null;
    triggers?: RoutineTrigger[] | null;
    activeIssue?: { id: string; identifier?: string | null; status?: string | null; updatedAt?: string | null } | null;
  };

  const routines = await fetchPaperclipApiJson<RoutineDetail[]>(`/api/companies/${companyId}/routines`);
  const catchupState =
    await readState<RoutineCatchupState>(ctx, companyId, STATE_KEYS.routineCatchups) ?? {};
  const nextState: RoutineCatchupState = { ...catchupState };
  const caughtUp: string[] = [];
  const config = await getConfig(ctx);

  for (const routine of routines) {
    if (routine.status !== "active") {
      continue;
    }
    const detail = await fetchPaperclipApiJson<RoutineDetail>(`/api/routines/${routine.id}`);
    const configuredRoutine = getConfiguredRoutineMetadata(detail.title);
    const preferredAssigneeKey =
      configuredRoutine.agentKey
      ?? (
        detail.assigneeAgentId
          ? (await ctx.agents.get(detail.assigneeAgentId, companyId).catch(() => null))?.urlKey ?? null
          : null
      );
    if (preferredAssigneeKey) {
      const assigneeResolution = await resolveAssignableAgent(ctx, companyId, config, preferredAssigneeKey).catch(() => null);
      if (assigneeResolution && detail.assigneeAgentId !== assigneeResolution.agent.id) {
        await fetchPaperclipApiJson(`/api/routines/${routine.id}`, {
          method: "PATCH",
          body: JSON.stringify({ assigneeAgentId: assigneeResolution.agent.id }),
        });
      }
    }
    const desiredConcurrencyPolicy = configuredRoutine.concurrencyPolicy ?? recommendedRoutineExecutionPolicy().concurrencyPolicy;
    const desiredCatchUpPolicy = configuredRoutine.catchUpPolicy ?? recommendedRoutineExecutionPolicy().catchUpPolicy;
    if (
      detail.concurrencyPolicy !== desiredConcurrencyPolicy
      || detail.catchUpPolicy !== desiredCatchUpPolicy
    ) {
      await fetchPaperclipApiJson(`/api/routines/${routine.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          concurrencyPolicy: desiredConcurrencyPolicy,
          catchUpPolicy: desiredCatchUpPolicy,
        }),
      });
    }
    const scheduleTrigger = (detail.triggers ?? routine.triggers ?? []).find((trigger) =>
      trigger.kind === "schedule" && trigger.enabled !== false && asString(trigger.cronExpression),
    );
    const triggerUpdatedAt = asString(scheduleTrigger?.updatedAt) ?? asString(scheduleTrigger?.createdAt);
    const catchupWindowKey = buildRoutineCatchUpWindowKey(scheduleTrigger ?? {});
    if (!scheduleTrigger || !triggerUpdatedAt || !catchupWindowKey) {
      continue;
    }
    const catchupKey = `${routine.id}:${catchupWindowKey}`;
    if (nextState[catchupKey]) {
      continue;
    }
    const expectedIntervalHours = configuredRoutine.expectedIntervalHours;
    const fullActiveIssue = detail.activeIssue?.id
      ? await ctx.issues.get(detail.activeIssue.id, companyId).catch(() => null)
      : null;
    const shouldRecoverStaleExecution = Boolean(
      fullActiveIssue && isStaleRoutineExecutionIssue(
        {
          originKind: fullActiveIssue.originKind ?? null,
          executionRunId: fullActiveIssue.executionRunId ?? null,
          status: fullActiveIssue.status,
          updatedAt: toIsoTimestamp(fullActiveIssue.updatedAt),
        },
        expectedIntervalHours,
        Date.now(),
      ),
    );
    if (shouldRecoverStaleExecution && fullActiveIssue) {
      await ctx.issues.update(
        fullActiveIssue.id,
        { status: "cancelled" },
        companyId,
      );
      await ctx.issues.createComment(
        fullActiveIssue.id,
        [
          "Automation recovery cancelled this stale routine-execution issue.",
          `- Routine: ${detail.title}`,
          "- Reason: repeated coalescing into an old execution issue with no active execution run.",
          "- A fresh manual routine run will be triggered so execution can resume on a new issue.",
        ].join("\n"),
        companyId,
      );
    }
    if (asString(scheduleTrigger.lastFiredAt) && !shouldRecoverStaleExecution) {
      continue;
    }
    if (!shouldTriggerRoutineCatchUp(scheduleTrigger)) {
      continue;
    }
    const timezone = asString(scheduleTrigger.timezone) ?? "America/New_York";
    const updatedParts = getTimezoneParts(new Date(triggerUpdatedAt), timezone);
    const nowParts = getTimezoneParts(new Date(), timezone);
    if (
      updatedParts.year !== nowParts.year
      || updatedParts.month !== nowParts.month
      || updatedParts.day !== nowParts.day
    ) {
      continue;
    }

    await fetchPaperclipApiJson(`/api/routines/${routine.id}/run`, {
      method: "POST",
      body: JSON.stringify({
        source: "manual",
        payload: {
          reason: "blueprint-automation-routine-catchup",
          triggerUpdatedAt,
        },
        idempotencyKey: `blueprint-routine-catchup:${catchupKey}`,
      }),
    });
    nextState[catchupKey] = {
      triggerUpdatedAt,
      lastManualRunAt: nowIso(),
    };
    caughtUp.push(routine.title);
  }

  if (caughtUp.length > 0) {
    await writeState(ctx, companyId, STATE_KEYS.routineCatchups, nextState);
    await appendRecentEvent(ctx, companyId, {
      kind: "routine-catchup",
      title: "Manually caught up missed routine windows",
      detail: caughtUp.join(", "),
    });
  }

  return caughtUp;
}

async function finalizeIssueWithProof(
  ctx: PluginContext,
  companyId: string,
  input: {
    issueId?: string | null;
    issueComment: string;
    outcome: "done" | "blocked";
  },
) {
  const issueId = asString(input.issueId);
  if (!issueId) {
    return;
  }

  await ctx.issues.createComment(issueId, input.issueComment, companyId);
  await ctx.issues.update(issueId, { status: input.outcome }, companyId);
}

async function handleChiefOfStaffIssueSignal(
  ctx: PluginContext,
  event: { eventId: string; companyId: string; entityId: string; type: "issue.created" | "issue.updated" },
) {
  const config = await getConfig(ctx);
  const [issue, chiefOfStaffAgent, agents] = await Promise.all([
    ctx.issues.get(event.entityId, event.companyId),
    resolveAgent(ctx, event.companyId, getChiefOfStaffAgentKey(config)).catch(() => null),
    listAgents(ctx, event.companyId).catch(() => [] as Agent[]),
  ]);
  if (!issue) return;

  const shouldWake = shouldWakeChiefOfStaffForIssueEvent({
    eventType: event.type,
    issue,
    chiefOfStaffAgentId: chiefOfStaffAgent?.id ?? null,
  });
  if (!shouldWake) return;

  const agentById = new Map(agents.map((agent) => [agent.id, agent] as const));
  const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name] as const));
  const agentKeyById = new Map(
    agents.map((agent) => [agent.id, normalizedCandidates(agent as unknown as Record<string, unknown>)[0] ?? agent.id] as const),
  );
  const owner = issue.assigneeAgentId
    ? formatOwnerLabel(
      preferredAgentDisplayName(
        agentById.get(issue.assigneeAgentId),
        agentNameById.get(issue.assigneeAgentId) ?? agentKeyById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId,
      ),
    )
    : "Unassigned";
  const shouldPostSlack = shouldPostManagerIssueEventToSlack({
    eventType: event.type,
    status: issue.status,
    priority: issue.priority,
    assigneeAgentId: issue.assigneeAgentId ?? null,
  });
  const managerSlackCopy = buildManagerIssueSlackCopy({
    eventType: event.type,
    issueTitle: issue.title,
    status: issue.status,
    priority: issue.priority,
    owner,
  });
  const bindChiefToIssue = shouldBindChiefOfStaffToIssue(
    chiefOfStaffAgent?.id ?? null,
    issue.assigneeAgentId ?? null,
  );

  await wakeChiefOfStaff(ctx, event.companyId, config, {
    reason: event.type,
    idempotencyKey: `chief-of-staff:${event.type}:${event.eventId}`,
    payload: {
      signalType: event.type,
      ...(bindChiefToIssue ? { issueId: issue.id } : { signalIssueId: issue.id }),
      status: issue.status,
      priority: issue.priority,
      assigneeAgentId: issue.assigneeAgentId ?? null,
    },
    eventIssueId: issue.id,
    title: `Chief of Staff wakeup from ${event.type}`,
    detail: `${issue.title} (${issue.id}) is now ${issue.status}${issue.assigneeAgentId ? ` and assigned to ${issue.assigneeAgentId}` : " and unassigned"}.`,
    slackChannel: "#paperclip-manager",
    slackTitle: managerSlackCopy.title,
    slackSummary: managerSlackCopy.summary,
    postToSlack: shouldPostSlack,
  }).catch(() => undefined);

  const lane = classifyFounderLane(issue.assigneeAgentId ? (agentKeyById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId) : null, issue.title);
  const founderDigest = buildFounderIssueExceptionDigest(issue, owner, lane);
  if (founderDigest) {
    await postFounderException(ctx, event.companyId, config, founderDigest).catch(() => undefined);
  }
}

async function handleChiefOfStaffRunFailureSignal(
  ctx: PluginContext,
  event: { eventId: string; companyId: string; payload: unknown },
) {
  const config = await getConfig(ctx);
  const payload = asRecord(event.payload);
  const failedAgentId = asString(payload?.agentId);
  const chiefOfStaffKey = getChiefOfStaffAgentKey(config);
  const chiefOfStaffAgent = await resolveAgent(ctx, event.companyId, chiefOfStaffKey).catch(() => null);
  if (!failedAgentId || failedAgentId === chiefOfStaffAgent?.id) {
    return;
  }

  const error = asString(payload?.error) ?? null;
  const issueId = asString(payload?.issueId) ?? null;
  const slackCopy = buildAgentRunFailureSlackCopy({
    failedAgentId,
    issueId,
    error,
  });

  await wakeChiefOfStaff(ctx, event.companyId, config, {
    reason: "agent.run.failed",
    idempotencyKey: `chief-of-staff:agent-run-failed:${event.eventId}`,
    payload: {
      signalType: "agent.run.failed",
      failedAgentId,
      runId: asString(payload?.runId) ?? null,
      issueId,
      error,
    },
    title: "Chief of Staff wakeup from agent failure",
    detail: `${failedAgentId} failed on run ${asString(payload?.runId) ?? "unknown"}${issueId ? ` for issue ${issueId}` : ""}.`,
    slackChannel: "#paperclip-manager",
    slackTitle: slackCopy.title,
    slackSummary: slackCopy.summary,
  }).catch(() => undefined);
}

async function handleChiefOfStaffActivitySignal(
  ctx: PluginContext,
  event: { eventId: string; companyId: string; payload: unknown },
) {
  const payload = asRecord(event.payload);
  const action = asString(payload?.action);
  if (action !== "routine.run_triggered") {
    return;
  }

  const details = asRecord(payload?.details);
  const config = await getConfig(ctx);
  await wakeChiefOfStaff(ctx, event.companyId, config, {
    reason: "routine.run_triggered",
    idempotencyKey: `chief-of-staff:routine-run-triggered:${event.eventId}`,
    payload: {
      signalType: "routine.run_triggered",
      routineId: asString(details?.routineId) ?? null,
      runStatus: asString(details?.status) ?? null,
      source: asString(details?.source) ?? null,
    },
    title: "Chief of Staff routine trigger wakeup",
    detail: `Routine ${asString(details?.routineId) ?? "unknown"} triggered via ${asString(details?.source) ?? "unknown"} with status ${asString(details?.status) ?? "unknown"}.`,
    slackChannel: "#paperclip-manager",
    slackTitle: "Manager update: routine triggered",
    slackSummary: [
      `What happened: A scheduled routine started running.`,
      `Routine: ${asString(details?.routineId) ?? "unknown"}`,
      `Source: ${asString(details?.source) ?? "unknown"}`,
      `Status: ${asString(details?.status) ?? "unknown"}`,
    ],
  }).catch(() => undefined);
}

async function handleRoutineExecutionSignal(
  ctx: PluginContext,
  event: { eventId: string; companyId: string; payload: unknown },
) {
  const payload = asRecord(event.payload);
  if (asString(payload?.action) !== "routine.run_triggered") {
    return;
  }

  const details = asRecord(payload?.details);
  const routineId = asString(details?.routineId);
  if (!routineId) {
    return;
  }

  type RoutineExecutionDetail = {
    id: string;
    title: string;
    status: string;
    assigneeAgentId?: string | null;
    activeIssue?: Issue | null;
  };

  const routine = await fetchPaperclipApiJson<RoutineExecutionDetail>(`/api/routines/${routineId}`);
  if (routine.status !== "active" || !routine.assigneeAgentId) {
    return;
  }

  const config = await getConfig(ctx);
  const currentAssignee = await ctx.agents.get(routine.assigneeAgentId, event.companyId).catch(() => null);
  const preferredAssigneeKey =
    currentAssignee?.urlKey
    ?? getConfiguredRoutineMetadata(routine.title).agentKey
    ?? null;
  if (!preferredAssigneeKey) {
    return;
  }
  const assigneeResolution = await resolveAssignableAgent(
    ctx,
    event.companyId,
    config,
    preferredAssigneeKey,
  ).catch(() => null);
  const assignee = assigneeResolution?.agent ?? null;
  if (!assignee || isAgentUnavailable(assignee)) {
    return;
  }
  if (routine.assigneeAgentId !== assignee.id) {
    await fetchPaperclipApiJson(`/api/routines/${routine.id}`, {
      method: "PATCH",
      body: JSON.stringify({ assigneeAgentId: assignee.id }),
    }).catch(() => undefined);
    if (routine.activeIssue?.id) {
      await ctx.issues.update(routine.activeIssue.id, { assigneeAgentId: assignee.id }, event.companyId).catch(() => undefined);
    }
  }

  await ctx.agents.wakeup(assignee.id, event.companyId, {
    source: "automation",
    triggerDetail: "system",
    reason: "routine.run_triggered",
    payload: {
      routineId: routine.id,
      routineTitle: routine.title,
      issueId: routine.activeIssue?.id ?? null,
      issueIdentifier: routine.activeIssue?.identifier ?? null,
    },
    idempotencyKey: `routine-run-dispatch:${event.eventId}`,
    forceFreshSession: true,
  });

  await appendRecentEvent(ctx, event.companyId, {
    kind: "routine-dispatched",
    title: routine.title,
    issueId: routine.activeIssue?.id,
    detail: `${routine.title} triggered execution for ${assignee.urlKey}.`,
  });
}

function preferredAgentChannelKey(agent: Agent | null | undefined): string | null {
  if (!agent) return null;
  const record = agent as unknown as Record<string, unknown>;
  return (
    asString(record.urlKey) ??
    asString(record.slug) ??
    asString(record.key) ??
    asString(record.name) ??
    asString(record.title) ??
    asString(record.id)
  ) ?? null;
}

function isAutomationCommentNoise(bodySnippet: string) {
  const normalized = bodySnippet.trim().toLowerCase();
  return normalized.startsWith("automation refresh")
    || normalized.startsWith("## automation trace")
    || normalized.startsWith("detected a claude quota/rate-limit failure")
    || normalized.startsWith("detected a codex quota/rate-limit failure")
    || normalized.startsWith("detected a hermes quota/rate-limit failure")
    || normalized.startsWith("stuck handoff escalated by blueprint automation");
}

async function handleAgentConversationActivitySignal(
  ctx: PluginContext,
  event: { companyId: string; payload: unknown },
) {
  const payload = asRecord(event.payload);
  const action = asString(payload?.action);
  const actorType = asString(payload?.actorType);
  if (action !== "issue.comment_added" || actorType !== "agent") {
    return;
  }

  const actorId = asString(payload?.actorId);
  const issueId = asString(payload?.entityId);
  const details = asRecord(payload?.details);
  const commentId = asString(details?.commentId);
  const bodySnippet = asString(details?.bodySnippet);
  const issueTitle = asString(details?.issueTitle);
  const issueIdentifier = asString(details?.identifier);

  if (!actorId || !issueId || !bodySnippet || isAutomationCommentNoise(bodySnippet)) {
    return;
  }

  const [config, issue, actorAgent] = await Promise.all([
    getConfig(ctx),
    ctx.issues.get(issueId, event.companyId),
    ctx.agents.get(actorId, event.companyId).catch(() => null),
  ]);

  if (!issue || !actorAgent) {
    return;
  }

  const assigneeAgent = issue.assigneeAgentId
    ? await ctx.agents.get(issue.assigneeAgentId, event.companyId).catch(() => null)
    : null;

  const actorKey = preferredAgentChannelKey(actorAgent) ?? actorId;
  const assigneeKey = preferredAgentChannelKey(assigneeAgent);
  const fallbackIssueTitle = issueTitle ?? issue.title;

  let slackCopy = buildAgentConversationSlackCopy({
    kind: "comment",
    actor: actorKey,
    target: assigneeKey,
    issueIdentifier,
    issueTitle: fallbackIssueTitle,
    bodySnippet,
  });
  let channels = [
    slackChannelForAgent(actorKey),
    assigneeKey ? slackChannelForAgent(assigneeKey) : null,
    "#paperclip-manager",
  ];
  let recentEventKind = "agent-comment";

  if (commentId) {
    const comments = await listCommentsForIssue(ctx, event.companyId, issueId).catch(() => []);
    const comment = comments.find((entry) => entry.id === commentId);
    const parsed = comment ? parseHandoffComment(comment.body) : null;

    if (parsed?.kind === "request") {
      slackCopy = buildAgentConversationSlackCopy({
        kind: "handoff_request",
        actor: parsed.data.from,
        target: parsed.data.to,
        issueIdentifier,
        issueTitle: fallbackIssueTitle,
        summary: parsed.data.context.summary,
        expectedOutcome: parsed.data.expectedOutcome,
        priority: parsed.data.priority,
      });
      channels = [
        slackChannelForAgent(parsed.data.from),
        slackChannelForAgent(parsed.data.to),
        "#paperclip-manager",
      ];
      recentEventKind = "handoff-comment";
    } else if (parsed?.kind === "response") {
      slackCopy = buildAgentConversationSlackCopy({
        kind: "handoff_response",
        actor: parsed.data.from,
        target: parsed.data.to,
        issueIdentifier,
        issueTitle: fallbackIssueTitle,
        outcome: parsed.data.outcome,
        followUpReason: parsed.data.followUpReason,
        proofLinkCount: parsed.data.proofLinks?.length ?? 0,
      });
      channels = [
        slackChannelForAgent(parsed.data.from),
        slackChannelForAgent(parsed.data.to),
        "#paperclip-manager",
      ];
      recentEventKind = "handoff-response";
    }
  }

  await appendRecentEvent(ctx, event.companyId, {
    kind: recentEventKind,
    title: slackCopy.title,
    issueId,
    detail: slackCopy.summary.join(" "),
  });

  await postSlackActivityFanout(ctx, config, {
    channels,
    title: slackCopy.title,
    summary: slackCopy.summary,
  }).catch(() => undefined);
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

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) return value;
  return new Date(0).toISOString();
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

async function listSourceMappings(
  ctx: PluginContext,
  companyId: string,
): Promise<PluginEntityRecord[]> {
  const rows: PluginEntityRecord[] = [];
  const limit = 200;
  let offset = 0;

  while (true) {
    const batch = await ctx.entities.list({
      entityType: ENTITY_TYPES.sourceMapping,
      scopeKind: "company",
      scopeId: companyId,
      limit,
      offset,
    });
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += batch.length;
  }

  return rows;
}

function toNotionQueueDuplicateCandidate(
  mapping: PluginEntityRecord,
  issue: Issue | null,
): NotionQueueDuplicateCandidate | null {
  if (!issue) return null;

  const data = (mapping.data ?? {}) as Partial<SourceMappingData>;
  if (data.sourceType !== "notion-work-queue") return null;

  const title = typeof mapping.title === "string" ? mapping.title.trim() : "";
  const queueTitle = title.startsWith("Notion Work Queue: ")
    ? title.slice("Notion Work Queue: ".length).trim()
    : title;
  if (!queueTitle) return null;

  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const queueKey = canonicalWorkQueueScanKey({
    title: queueTitle,
    system: typeof metadata.system === "string" ? metadata.system : "",
    workType: typeof metadata.workType === "string" ? metadata.workType : "",
    naturalKey: typeof data.sourceId === "string" && data.sourceId.includes("::")
      ? data.sourceId
      : "",
  });

  return {
    mapping,
    data: data as SourceMappingData,
    issue,
    queueKey,
    queueTitle,
  };
}

function notionQueueIssueStatusRank(status: string) {
  switch (status) {
    case "in_progress":
      return 6;
    case "in_review":
      return 5;
    case "todo":
      return 4;
    case "backlog":
      return 3;
    case "blocked":
      return 2;
    case "done":
      return 1;
    case "cancelled":
      return 0;
    default:
      return 0;
  }
}

function notionQueueIssuePriorityRank(priority: string) {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function compareNotionQueueDuplicateCandidates(
  left: NotionQueueDuplicateCandidate,
  right: NotionQueueDuplicateCandidate,
) {
  const leftResolved = left.issue.status === "done" || left.issue.status === "cancelled" ? 1 : 0;
  const rightResolved = right.issue.status === "done" || right.issue.status === "cancelled" ? 1 : 0;
  if (leftResolved !== rightResolved) return leftResolved - rightResolved;

  const statusDelta =
    notionQueueIssueStatusRank(right.issue.status) - notionQueueIssueStatusRank(left.issue.status);
  if (statusDelta !== 0) return statusDelta;

  const priorityDelta =
    notionQueueIssuePriorityRank(right.issue.priority) - notionQueueIssuePriorityRank(left.issue.priority);
  if (priorityDelta !== 0) return priorityDelta;

  const hitsDelta = (right.data.hits ?? 0) - (left.data.hits ?? 0);
  if (hitsDelta !== 0) return hitsDelta;

  const updatedDelta =
    new Date(right.issue.updatedAt).getTime() - new Date(left.issue.updatedAt).getTime();
  if (updatedDelta !== 0) return updatedDelta;

  return left.issue.id.localeCompare(right.issue.id);
}

function buildNotionQueueAliasMap(
  sourceMappings: PluginEntityRecord[],
  issues: Issue[],
) {
  const issueById = new Map(issues.map((issue) => [issue.id, issue] as const));
  const groups = new Map<string, NotionQueueDuplicateCandidate[]>();

  for (const mapping of sourceMappings) {
    const data = (mapping.data ?? {}) as Partial<SourceMappingData>;
    const issueId = typeof data.issueId === "string" ? data.issueId : null;
    const issue = issueId ? (issueById.get(issueId) ?? null) : null;
    const candidate = toNotionQueueDuplicateCandidate(mapping, issue);
    if (!candidate) {
      continue;
    }
    const existing = groups.get(candidate.queueKey) ?? [];
    existing.push(candidate);
    groups.set(candidate.queueKey, existing);
  }

  const aliases = new Map<string, NotionQueueDuplicateCandidate>();
  for (const [queueKey, candidates] of groups.entries()) {
    const canonical = [...candidates].sort(compareNotionQueueDuplicateCandidates)[0];
    if (canonical) {
      aliases.set(queueKey, canonical);
    }
  }
  return aliases;
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

function slackChannelForAgent(agentKey: string | null | undefined): string {
  const normalized = (agentKey ?? "").trim().toLowerCase();
  if (!normalized) return "#paperclip-manager";
  if (normalized === "blueprint-chief-of-staff") return "#paperclip-manager";
  if (normalized === "blueprint-ceo" || normalized === "blueprint-cto") return "#paperclip-exec";
  if (
    normalized.startsWith("webapp-")
    || normalized.startsWith("pipeline-")
    || normalized.startsWith("capture-")
  ) {
    return "#paperclip-eng";
  }
  if (
    normalized === "ops-lead"
    || normalized === "intake-agent"
    || normalized === "capture-qa-agent"
    || normalized === "field-ops-agent"
    || normalized === "finance-support-agent"
  ) {
    return "#paperclip-ops";
  }
  if (
    normalized === "growth-lead"
    || normalized === "conversion-agent"
    || normalized === "analytics-agent"
    || normalized === "community-updates-agent"
    || normalized === "market-intel-agent"
    || normalized === "supply-intel-agent"
    || normalized === "capturer-growth-agent"
    || normalized === "city-launch-agent"
    || normalized === "demand-intel-agent"
    || normalized === "robot-team-growth-agent"
    || normalized === "site-operator-partnership-agent"
    || normalized === "city-demand-agent"
  ) {
    return "#paperclip-growth";
  }
  return "#paperclip-manager";
}

function getCommunityUpdatesAgentKey(config: BlueprintAutomationConfig) {
  return config.growthDepartment?.agents.communityUpdates ?? "community-updates-agent";
}

async function postSlackActivity(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  input: {
    channel: string;
    title: string;
    summary: string[];
  },
) {
  const targets = await resolveSlackTargets(ctx, config);
  if (
    !targets.default
    && !targets.ops
    && !targets.growth
    && !targets.exec
    && !targets.engineering
    && !targets.manager
  ) {
    return;
  }

  await postSlackDigest(targets, {
    channel: input.channel,
    title: input.title,
    sections: [{ heading: "Update", items: input.summary }],
  });
}

async function postSlackActivityFanout(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  input: {
    channels: Array<string | null | undefined>;
    title: string;
    summary: string[];
  },
) {
  const uniqueChannels = [...new Set(
    input.channels
      .map((channel) => channel?.trim())
      .filter((channel): channel is string => Boolean(channel)),
  )];

  for (const channel of uniqueChannels) {
    await postSlackActivity(ctx, config, {
      channel,
      title: input.title,
      summary: input.summary,
    }).catch(() => undefined);
  }
}

async function postHandoffSlackActivity(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  input: {
    title: string;
    handoff: HandoffSnapshot;
    extraLines?: string[];
    includeManager?: boolean;
  },
) {
  const channels = [
    slackChannelForAgent(input.handoff.from),
    slackChannelForAgent(input.handoff.to),
    input.includeManager === false ? null : "#paperclip-manager",
  ];
  await postSlackActivityFanout(ctx, config, {
    channels,
    title: input.title,
    summary: [
      `What happened: ${formatAgentName(input.handoff.from)} handed work to ${formatAgentName(input.handoff.to)}.`,
      `Task: ${cleanIssueTitle(input.handoff.title)}`,
      `Status: ${formatIssueStatus(input.handoff.status) ?? input.handoff.status}`,
      `Priority: ${formatIssuePriority(input.handoff.priority) ?? input.handoff.priority}`,
      ...(input.handoff.projectName ? [`Project: ${input.handoff.projectName}`] : []),
      ...(input.handoff.stuckReason ? [`Why it is stuck: ${input.handoff.stuckReason}`] : []),
      ...(input.handoff.latencyHours !== null ? [`Open for: ${input.handoff.latencyHours.toFixed(1)}h`] : []),
      ...(input.extraLines ?? []),
    ],
  });
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
  if (!isQuotaOrRateLimitFailure(payload.error) && !isModelNotFoundFailure(payload.error)) {
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

  const desired = buildDesiredAdapterDescriptor(agent);
  const fallback = buildQuotaFallbackDescriptor(
    agent.adapterType,
    asRecord(agent.adapterConfig),
    desired,
  );
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
    const agentById = new Map(allAgents.map((entry) => [entry.id, entry]));
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
      const targetAgent = target.id === agent.id ? agent : agentById.get(target.id) ?? null;
      const targetFallback = buildQuotaFallbackDescriptor(
        target.adapterType,
        asRecord(target.adapterConfig),
        targetAgent ? buildDesiredAdapterDescriptor(targetAgent) : null,
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
      && (agent.adapterType === "claude_local" ||
        agent.adapterType === "codex_local" ||
        agent.adapterType === "hermes_local")
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
      title: `Retried ${agent.name} on ${fallback.adapterType} after quota failure`,
      issueId: payload.issueId ?? undefined,
      detail: payload.issueId
        ? `Issue ${payload.issueId} retried from failed run ${payload.runId}; switched ${workspaceTargets.length} same-workspace agent(s) to ${fallback.adapterType}${fallback.adapterType !== agent.adapterType ? ` until ${cooldownUntil}` : ""}.`
        : `Task ${retryTaskKey} retried from failed run ${payload.runId}; switched ${workspaceTargets.length} same-workspace agent(s) to ${fallback.adapterType}${fallback.adapterType !== agent.adapterType ? ` until ${cooldownUntil}` : ""}.`,
    });

    if (payload.issueId) {
      const fallbackLabel =
        fallback.adapterType === "hermes_local"
          ? `hermes_local (${asString(fallback.adapterConfig.model) ?? "next free model"})`
          : fallback.adapterType;
      await ctx.issues.createComment(
        payload.issueId,
        `Detected a ${agent.adapterType} quota/rate-limit failure on run ${payload.runId}. Switched ${agent.name} and ${Math.max(workspaceTargets.length - 1, 0)} same-workspace peer(s) to ${fallbackLabel}${fallback.adapterType !== agent.adapterType ? ` until ${cooldownUntil}` : ""}, then requeued the work once.`,
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
  const config = await getConfig(ctx);
  const routedAssignee = routeManagedIssueAssignee(
    {
      projectName: input.projectName,
      title: input.title,
      description: input.description,
      assignee: input.assignee,
    },
    config,
  );
  const assigneeResolution = await resolveAssignableAgent(ctx, input.companyId, config, routedAssignee);
  const assignee = assigneeResolution.agent;
  const { mapping, issue } = await getManagedIssue(ctx, input.companyId, fingerprint);
  const existingData = (mapping?.data ?? {}) as Partial<SourceMappingData>;
  const hits = (existingData.hits ?? 0) + 1;
  const desiredStatus = normalizeIssueStatus(input.status, "todo");
  const desiredPriority = normalizeIssuePriority(input.priority, "medium");
  let currentIssue = issue;
  const isNewIssue = !currentIssue;
  const previousIssueSnapshot = currentIssue
    ? {
      status: currentIssue.status,
      priority: currentIssue.priority,
      assigneeAgentId: currentIssue.assigneeAgentId ?? null,
    }
    : null;

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
    assignee: assigneeResolution.selectedKey,
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
    detail: `${input.projectName} -> ${routedAssignee}`,
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
      assignee: assigneeResolution.selectedKey,
      preferredAssignee: routedAssignee,
      requestedAssignee: input.assignee,
      hits,
    },
  });

  if (isNewIssue && desiredPriority && ["critical", "high"].includes(desiredPriority)) {
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

  const meaningfulUpdate =
    isNewIssue
    || !previousIssueSnapshot
    || previousIssueSnapshot.status !== currentIssue.status
    || previousIssueSnapshot.priority !== currentIssue.priority
    || previousIssueSnapshot.assigneeAgentId !== (currentIssue.assigneeAgentId ?? null);
  if (meaningfulUpdate) {
    const assigneeLabel = preferredAgentDisplayName(assignee, assigneeResolution.selectedKey);
    const directChiefOfStaffWake = routedAssignee === getChiefOfStaffAgentKey(config);
    const slackCopy = buildManagedIssueSlackCopy({
      event: isNewIssue ? "opened" : "updated",
      sourceType: input.sourceType,
      issueTitle: currentIssue.title,
      projectName: input.projectName,
      assignee: assigneeLabel,
      priority: currentIssue.priority,
      status: currentIssue.status,
      signalUrl: input.signalUrl,
    });
    const slackAlertSignature = buildManagedIssueSlackAlertSignature({
      sourceType: input.sourceType,
      projectName: input.projectName,
      title: currentIssue.title,
      status: currentIssue.status,
      priority: currentIssue.priority,
    });
    const suppressManagedSlackAlert = await shouldSuppressManagedIssueSlackAlert(ctx, input.companyId, {
      fingerprint,
      sourceType: input.sourceType,
      signature: slackAlertSignature,
    });
    if (!suppressManagedSlackAlert) {
      await postSlackActivity(ctx, config, {
        channel: slackChannelForAgent(assigneeResolution.selectedKey),
        title: slackCopy.title,
        summary: slackCopy.summary,
      }).catch(() => undefined);
      const chiefOfStaffKey = getChiefOfStaffAgentKey(config);
      const chiefOfStaffAgent = await resolveAgent(ctx, input.companyId, chiefOfStaffKey).catch(() => null);
      const bindChiefToIssue = directChiefOfStaffWake || shouldBindChiefOfStaffToIssue(
        chiefOfStaffAgent?.id ?? null,
        currentIssue.assigneeAgentId ?? null,
      );
      await wakeChiefOfStaff(ctx, input.companyId, config, {
        reason: isNewIssue ? "managed_issue_created" : "managed_issue_updated",
        idempotencyKey: `chief-of-staff:managed-issue:${fingerprint}:${currentIssue.status}:${currentIssue.assigneeAgentId ?? "unassigned"}`,
        payload: {
          signalType: isNewIssue ? "managed_issue_created" : "managed_issue_updated",
          ...(bindChiefToIssue ? { issueId: currentIssue.id } : { signalIssueId: currentIssue.id }),
          fingerprint,
          status: currentIssue.status,
          assigneeAgentId: currentIssue.assigneeAgentId ?? null,
          projectName: input.projectName,
        },
        eventIssueId: currentIssue.id,
        title: isNewIssue
          ? "Chief of Staff wakeup from managed issue creation"
          : "Chief of Staff wakeup from managed issue update",
        detail: `${currentIssue.title} (${currentIssue.id}) is ${currentIssue.status} in ${input.projectName}.`,
        slackChannel: "#paperclip-manager",
        slackTitle: `Manager update: ${slackCopy.title}`,
        slackSummary: slackCopy.summary,
        // Concrete manager-owned follow-through should not be swallowed by the generic wakeup cooldown.
        bypassCooldown: directChiefOfStaffWake,
        suppressSlackIfSameTargetAsChannel: slackChannelForAgent(assigneeResolution.selectedKey),
      }).catch(() => undefined);
      await recordManagedIssueSlackAlert(ctx, input.companyId, {
        fingerprint,
        sourceType: input.sourceType,
        signature: slackAlertSignature,
      });
    }
    await wakeAssignedAgent(ctx, input.companyId, config, {
      issue: currentIssue,
      assigneeKey: assigneeResolution.selectedKey,
      reason: isNewIssue ? "managed_issue_created" : "managed_issue_updated",
      detail: `${currentIssue.title} dispatched to ${assigneeResolution.selectedKey} for execution.`,
    }).catch(() => undefined);
  }

  if (
    assigneeResolution.rerouted
    && (!previousIssueSnapshot || previousIssueSnapshot.assigneeAgentId !== (currentIssue.assigneeAgentId ?? null))
  ) {
    await ctx.issues.createComment(
      currentIssue.id,
      [
        "Automation rerouted this issue because the preferred owner is currently unavailable.",
        `- Preferred owner: ${formatAgentName(assigneeResolution.preferredKey)}`,
        `- Current owner: ${formatAgentName(assigneeResolution.selectedKey)}`,
        `- Attempted failover chain: ${assigneeResolution.attempted.join(" -> ")}`,
      ].join("\n"),
      input.companyId,
    ).catch(() => undefined);
  }

  return { fingerprint, issue: currentIssue, hits };
}

async function resolveManagedIssue(ctx: PluginContext, input: ResolveManagedIssueInput) {
  const fingerprint = makeFingerprint(input.sourceType, input.sourceId);
  const { mapping, issue } = await getManagedIssue(ctx, input.companyId, fingerprint);
  if (!mapping || !issue) {
    return { fingerprint, issue: null };
  }

  const existingData = (mapping.data ?? {}) as Partial<SourceMappingData>;
  const alreadyResolved =
    issue.status === input.resolutionStatus
    && existingData.resolutionStatus === input.resolutionStatus;
  if (alreadyResolved) {
    await upsertMapping(ctx, input.companyId, fingerprint, mapping.title ?? issue.title, input.resolutionStatus, {
      fingerprint,
      issueId: issue.id,
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
    return { fingerprint, issue };
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
  await clearManagedIssueSlackAlert(ctx, input.companyId, fingerprint);

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

  const config = await getConfig(ctx);
  const slackCopy = buildManagedIssueSlackCopy({
    event: "resolved",
    sourceType: input.sourceType,
    issueTitle: updatedIssue.title,
    projectName: existingData.projectName ?? "unknown",
    assignee: existingData.assignee ?? "unknown",
    priority: updatedIssue.priority,
    status: updatedIssue.status,
    signalUrl: existingData.signalUrl,
  });
  await postSlackActivity(ctx, config, {
    channel: slackChannelForAgent(existingData.assignee ?? getChiefOfStaffAgentKey(config)),
    title: slackCopy.title,
    summary: slackCopy.summary,
  }).catch(() => undefined);
  await wakeChiefOfStaff(ctx, input.companyId, config, {
    reason: "managed_issue_resolved",
    idempotencyKey: `chief-of-staff:managed-issue-resolved:${fingerprint}:${input.resolutionStatus}`,
    payload: {
      signalType: "managed_issue_resolved",
      issueId: updatedIssue.id,
      fingerprint,
      status: input.resolutionStatus,
    },
    title: "Chief of Staff wakeup from managed issue resolution",
    detail: `${updatedIssue.title} (${updatedIssue.id}) moved to ${input.resolutionStatus}.`,
    slackChannel: "#paperclip-manager",
    slackTitle: `Manager update: ${slackCopy.title}`,
    slackSummary: slackCopy.summary,
    suppressSlackIfSameTargetAsChannel: slackChannelForAgent(
      existingData.assignee ?? getChiefOfStaffAgentKey(config),
    ),
  }).catch(() => undefined);

  return { fingerprint, issue: updatedIssue };
}

function managedIssueMutationSignature(issue: Issue | null | undefined) {
  if (!issue) return "missing";
  return [
    issue.id,
    issue.title,
    issue.status,
    issue.priority,
    issue.assigneeAgentId ?? "unassigned",
  ].join("|");
}

async function upsertManagedIssueWithEvidence(
  ctx: PluginContext,
  input: UpsertManagedIssueInput,
) {
  const fingerprint = makeFingerprint(input.sourceType, input.sourceId);
  const before = await getManagedIssue(ctx, input.companyId, fingerprint);
  const beforeSignature = managedIssueMutationSignature(before.issue);
  const result = await upsertManagedIssue(ctx, input);
  const afterSignature = managedIssueMutationSignature(result.issue);
  const mutated = before.issue === null || beforeSignature !== afterSignature;

  return {
    ...result,
    mutated,
    evidenceKey: mutated ? `managed:${fingerprint}:${afterSignature}` : null,
  };
}

async function readFounderRemediationState(ctx: PluginContext, companyId: string) {
  return await readState<FounderRemediationState>(
    ctx,
    companyId,
    STATE_KEYS.founderRemediation,
  ) ?? {};
}

async function writeFounderRemediationState(
  ctx: PluginContext,
  companyId: string,
  state: FounderRemediationState,
) {
  await writeState(ctx, companyId, STATE_KEYS.founderRemediation, state);
}

async function readManagerAlertState(ctx: PluginContext, companyId: string) {
  const state = await readState<ManagerAlertState>(ctx, companyId, STATE_KEYS.managerAlerts);
  return state ? {
    routineHealth: state.routineHealth ?? null,
    issueAlerts: state.issueAlerts ?? {},
  } : {
    routineHealth: null,
    issueAlerts: {},
  };
}

async function writeManagerAlertState(
  ctx: PluginContext,
  companyId: string,
  state: ManagerAlertState,
) {
  await writeState(ctx, companyId, STATE_KEYS.managerAlerts, state);
}

const MANAGED_ISSUE_SLACK_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function shouldApplyManagedIssueSlackCooldown(sourceType: string) {
  return sourceType === "repo-dirty" || sourceType === "repo-branch-drift";
}

function buildManagedIssueSlackAlertSignature(input: {
  sourceType: string;
  projectName: string;
  title: string;
  status: string;
  priority: string | null | undefined;
}) {
  return stableDigest({
    sourceType: input.sourceType,
    projectName: input.projectName,
    title: input.title,
    status: input.status,
    priority: input.priority ?? null,
  });
}

async function shouldSuppressManagedIssueSlackAlert(
  ctx: PluginContext,
  companyId: string,
  input: {
    fingerprint: string;
    sourceType: string;
    signature: string;
  },
) {
  if (!shouldApplyManagedIssueSlackCooldown(input.sourceType)) {
    return false;
  }

  const state = await readManagerAlertState(ctx, companyId);
  const existing = state.issueAlerts[input.fingerprint];
  if (!existing) {
    return false;
  }

  const sentAt = Date.parse(existing.sentAt);
  return Number.isFinite(sentAt)
    && existing.signature === input.signature
    && Date.now() - sentAt < MANAGED_ISSUE_SLACK_COOLDOWN_MS;
}

async function recordManagedIssueSlackAlert(
  ctx: PluginContext,
  companyId: string,
  input: {
    fingerprint: string;
    sourceType: string;
    signature: string;
  },
) {
  if (!shouldApplyManagedIssueSlackCooldown(input.sourceType)) {
    return;
  }

  const state = await readManagerAlertState(ctx, companyId);
  const issueAlerts = {
    ...state.issueAlerts,
    [input.fingerprint]: {
      signature: input.signature,
      sentAt: nowIso(),
    },
  };
  const prunedIssueAlerts = Object.fromEntries(
    Object.entries(issueAlerts)
      .sort((left, right) => Date.parse(right[1].sentAt) - Date.parse(left[1].sentAt))
      .slice(0, 300),
  );
  await writeManagerAlertState(ctx, companyId, {
    ...state,
    issueAlerts: prunedIssueAlerts,
  });
}

async function clearManagedIssueSlackAlert(
  ctx: PluginContext,
  companyId: string,
  fingerprint: string,
) {
  const state = await readManagerAlertState(ctx, companyId);
  if (!state.issueAlerts[fingerprint]) {
    return;
  }

  const issueAlerts = { ...state.issueAlerts };
  delete issueAlerts[fingerprint];
  await writeManagerAlertState(ctx, companyId, {
    ...state,
    issueAlerts,
  });
}

function latestCommentTimestamp(comments: IssueComment[]) {
  return comments.reduce<string | null>((latest, comment) => {
    const createdAt = toIsoTimestamp(comment.createdAt);
    if (!latest) return createdAt;
    return Date.parse(createdAt) > Date.parse(latest) ? createdAt : latest;
  }, null);
}

function hasMeaningfulSourceProgressSince(
  issue: Issue,
  comments: IssueComment[],
  sinceIso: string,
) {
  const sinceMs = Date.parse(sinceIso);
  if (!Number.isFinite(sinceMs)) return false;
  const candidates = [
    toIsoTimestamp(issue.updatedAt),
    latestCommentTimestamp(comments),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  return candidates.some((value) => Date.parse(value) - sinceMs > MEANINGFUL_PROGRESS_GRACE_MS);
}

function hasIssueCommentContaining(
  comments: IssueComment[],
  needle: string,
  sinceIso?: string | null,
) {
  const sinceMs = sinceIso ? Date.parse(sinceIso) : Number.NEGATIVE_INFINITY;
  return comments.some((comment) => {
    if (typeof comment.body !== "string" || !comment.body.includes(needle)) {
      return false;
    }
    const createdAt = Date.parse(toIsoTimestamp(comment.createdAt));
    return !Number.isFinite(sinceMs) || createdAt + MEANINGFUL_PROGRESS_GRACE_MS >= sinceMs;
  });
}

function reconcileRoutineHealthState(routineHealth: RoutineHealthState) {
  let changed = false;
  const nextState: RoutineHealthState = {};

  for (const [key, entry] of Object.entries(routineHealth)) {
    const configured = getConfiguredRoutineMetadata(entry.routineKey || key);
    const nextEntry: ManagerRoutineHealthEntry = {
      ...entry,
      expectedIntervalHours: configured.expectedIntervalHours ?? entry.expectedIntervalHours,
      routineStatus: configured.routineStatus ?? entry.routineStatus ?? "active",
    };
    if (
      nextEntry.expectedIntervalHours !== entry.expectedIntervalHours
      || nextEntry.routineStatus !== entry.routineStatus
    ) {
      changed = true;
    }
    nextState[key] = nextEntry;
  }

  return { changed, state: nextState };
}

async function nudgeBuyerRiskOwner(
  ctx: PluginContext,
  companyId: string,
  risk: FounderVisibilityIssue,
) {
  const now = nowIso();
  const body = [
    "Manager escalation: buyer-risk checkpoint required.",
    `- This buyer path has been idle for ${risk.hoursSinceUpdate.toFixed(1)}h.`,
    `- Owner: ${risk.owner}.`,
    `- Required next step: leave a concrete next checkpoint or request a reroute within ${BUYER_RISK_OWNER_RESPONSE_GRACE_HOURS}h.`,
    "- If the thread stays silent after that window, automation will reroute or escalate it.",
  ].join("\n");
  await ctx.issues.createComment(risk.id, body, companyId);
  return {
    stage: "owner_nudged" as const,
    updatedAt: now,
    evidenceKey: `buyer-risk:${risk.id}:owner-nudged`,
  };
}

async function rerouteBuyerRiskIssue(
  ctx: PluginContext,
  companyId: string,
  issue: Issue,
  route: NonNullable<ReturnType<typeof inferChiefOfStaffRoute>>,
) {
  const assignee = await resolveAgent(ctx, companyId, route.assigneeKey);
  await (ctx.issues.update as any)(
    issue.id,
    {
      assigneeAgentId: assignee.id,
      ...(route.status ? { status: route.status } : {}),
    },
    companyId,
  );
  await ctx.issues.createComment(
    issue.id,
    `${route.comment}\nManager escalation: this buyer path stayed idle after the owner checkpoint window, so it was rerouted for recovery.`,
    companyId,
  );
  return {
    stage: "rerouted" as const,
    updatedAt: nowIso(),
    evidenceKey: `buyer-risk:${issue.id}:rerouted:${route.assigneeKey}`,
  };
}

async function ensureBuyerRiskRemediation(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  risk: FounderVisibilityIssue,
) {
  const state = await readFounderRemediationState(ctx, companyId);
  const remediationKey = `buyer-risk:${risk.id}`;
  const issue = await ctx.issues.get(risk.id, companyId);
  if (!issue) {
    return { notifyFounder: false, evidenceKey: null };
  }

  const comments = await listCommentsForIssue(ctx, companyId, issue.id).catch(() => []);
  let existing: FounderRemediationEntry | undefined = state[remediationKey];
  const escalationFingerprint = makeFingerprint("founder-buyer-risk", issue.id);
  const escalationManagedIssue = existing?.stage === "managed_escalation"
    ? await getManagedIssue(ctx, companyId, escalationFingerprint)
    : null;
  if (
    existing?.stage === "managed_escalation"
    && (!escalationManagedIssue?.issue || ["done", "cancelled"].includes(escalationManagedIssue.issue.status))
  ) {
    delete state[remediationKey];
    await writeFounderRemediationState(ctx, companyId, state);
    existing = undefined;
  }

  if (
    existing?.stage === "owner_nudged"
    && !hasIssueCommentContaining(comments, "Manager escalation: buyer-risk checkpoint required.", existing.updatedAt)
  ) {
    state[remediationKey] = await nudgeBuyerRiskOwner(ctx, companyId, risk);
    await writeFounderRemediationState(ctx, companyId, state);
    return { notifyFounder: false, evidenceKey: null };
  }

  if (existing && hasMeaningfulSourceProgressSince(issue, comments, existing.updatedAt)) {
    delete state[remediationKey];
    await writeFounderRemediationState(ctx, companyId, state);
    return { notifyFounder: false, evidenceKey: null };
  }

  if (!existing) {
    state[remediationKey] = await nudgeBuyerRiskOwner(ctx, companyId, risk);
    await writeFounderRemediationState(ctx, companyId, state);
    return { notifyFounder: false, evidenceKey: null };
  }

  if (
    existing.stage === "owner_nudged"
    && hoursSinceTimestamp(existing.updatedAt, Date.now()) >= BUYER_RISK_OWNER_RESPONSE_GRACE_HOURS
  ) {
    const route = inferChiefOfStaffRoute({
      title: issue.title,
      status: issue.status,
      project: { name: risk.projectName ?? EXECUTIVE_OPS_PROJECT },
    });
    const agents = await listAgents(ctx, companyId).catch(() => [] as Agent[]);
    const ownerKeyById = new Map(
      agents.map((agent) => [
        agent.id,
        normalizedCandidates(agent as unknown as Record<string, unknown>)[0] ?? agent.id,
      ] as const),
    );
    const currentOwnerKey = issue.assigneeAgentId
      ? (ownerKeyById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId)
      : null;

    if (route && route.assigneeKey !== currentOwnerKey) {
      state[remediationKey] = await rerouteBuyerRiskIssue(ctx, companyId, issue, route);
      await writeFounderRemediationState(ctx, companyId, state);
      return { notifyFounder: true, evidenceKey: state[remediationKey]?.evidenceKey ?? null };
    }

    const escalation = await upsertManagedIssueWithEvidence(ctx, {
      companyId,
      sourceType: "founder-buyer-risk",
      sourceId: issue.id,
      title: `Buyer-risk escalation: ${issue.title}`,
      description: [
        `${issue.title} remained stale after the owner checkpoint window.`,
        `Lane: ${risk.lane}`,
        `Owner at escalation: ${risk.owner}`,
        `Idle time: ${risk.hoursSinceUpdate.toFixed(1)}h`,
      ].join("\n"),
      projectName: EXECUTIVE_OPS_PROJECT,
      assignee: getGrowthRoutingConfig(config).growthLead,
      priority: "high",
      status: "todo",
      metadata: {
        sourceIssueId: issue.id,
        lane: risk.lane,
      },
      suppressRefreshComment: true,
    });

    if (escalation.mutated) {
      await ctx.issues.createComment(
        issue.id,
        "Manager escalation: no safe owner reroute was available after the checkpoint window, so a follow-through issue was opened for Growth Lead.",
        companyId,
      );
      state[remediationKey] = {
        stage: "managed_escalation",
        updatedAt: nowIso(),
        evidenceKey: escalation.evidenceKey ?? `buyer-risk:${issue.id}:managed-escalation`,
      };
      await writeFounderRemediationState(ctx, companyId, state);
      return { notifyFounder: true, evidenceKey: state[remediationKey]?.evidenceKey ?? null };
    }
  }

  return { notifyFounder: false, evidenceKey: null };
}

async function ensureQueueAlertRemediation(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  alert: FounderQueueAlert,
) {
  const escalation = await upsertManagedIssueWithEvidence(ctx, {
    companyId,
    sourceType: "founder-queue-alert",
    sourceId: alert.queue,
    title: `Queue threshold: ${alert.queue}`,
    description: [
      `${alert.queue} crossed a founder-visibility threshold.`,
      alert.detail,
      "Ops Lead should confirm the routing checkpoint and either reduce queue pressure or explain the blocker.",
    ].join("\n"),
    projectName: EXECUTIVE_OPS_PROJECT,
    assignee: getOpsRoutingConfig(config).opsLead,
    priority: "high",
    status: "todo",
    metadata: {
      queue: alert.queue,
      lane: alert.lane,
    },
    suppressRefreshComment: true,
  });

  return {
    notifyFounder: escalation.mutated,
    evidenceKey: escalation.evidenceKey,
  };
}

async function ensureExperimentOutcomeRemediation(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  outcome: FounderExperimentOutcome,
) {
  const escalation = await upsertManagedIssueWithEvidence(ctx, {
    companyId,
    sourceType: "founder-experiment-regression",
    sourceId: outcome.url ?? outcome.title,
    title: `Experiment regression: ${outcome.title}`,
    description: [
      `${outcome.title} landed as REVERT and needs a clean lesson plus next-step decision.`,
      `Lifecycle stage: ${outcome.lifecycleStage}`,
      ...(outcome.url ? [`Source: ${outcome.url}`] : []),
    ].join("\n"),
    projectName: EXECUTIVE_OPS_PROJECT,
    assignee: getGrowthRoutingConfig(config).growthLead,
    priority: "high",
    status: "todo",
    metadata: {
      lifecycleStage: outcome.lifecycleStage,
      url: outcome.url ?? null,
    },
    suppressRefreshComment: true,
  });

  return {
    notifyFounder: escalation.mutated,
    evidenceKey: escalation.evidenceKey,
  };
}

function shouldResetStaleRoutineExecutionIssue(
  issue: Issue | null,
  alert: FounderVisibilitySnapshot["routineMisses"][number],
  nowMs: number,
) {
  if (!issue) return false;
  const record = issue as unknown as Record<string, unknown>;
  if (record.originKind !== "routine_execution") return false;
  if (typeof record.executionRunId === "string" && record.executionRunId.length > 0) return false;
  if (issue.status === "done" || issue.status === "cancelled") return false;
  const resetThresholdHours = Math.max((alert.expectedIntervalHours ?? 1) * 2, 6);
  return hoursSinceTimestamp(issue.updatedAt, nowMs) >= resetThresholdHours;
}

async function ensureRoutineMissRemediation(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  alert: FounderVisibilitySnapshot["routineMisses"][number],
) {
  const evidenceKeys: string[] = [];
  if (alert.lastIssueId) {
    const routineIssue = await ctx.issues.get(alert.lastIssueId, companyId).catch(() => null);
    if (shouldResetStaleRoutineExecutionIssue(routineIssue, alert, Date.now())) {
      await ctx.issues.update(
        alert.lastIssueId,
        { status: "cancelled" },
        companyId,
      );
      await ctx.issues.createComment(
        alert.lastIssueId,
        [
          "Automation recovery cancelled this stale routine-execution issue.",
          `- Routine: ${alert.routineTitle}`,
          `- Reason: ${alert.detail}`,
          "- The next scheduled trigger can now open a fresh execution issue instead of coalescing into stale state.",
        ].join("\n"),
        companyId,
      );
      evidenceKeys.push(`routine-reset:${alert.lastIssueId}`);
    }
  }

  const escalation = await upsertManagedIssueWithEvidence(ctx, {
    companyId,
    sourceType: "founder-routine-miss",
    sourceId: `${alert.routineKey}:${alert.kind}`,
    title: `Routine follow-through: ${alert.routineTitle}`,
    description: [
      `${alert.routineTitle} is ${alert.kind}.`,
      alert.detail,
      `Assigned agent: ${alert.agentKey}`,
      "This issue exists so the stale lane gets a concrete owner, reroute, or closure decision in Paperclip before founder visibility is sent.",
    ].join("\n"),
    projectName: EXECUTIVE_OPS_PROJECT,
    assignee: alert.agentKey === getChiefOfStaffAgentKey(config)
      ? "blueprint-cto"
      : getChiefOfStaffAgentKey(config),
    priority: "high",
    status: alert.kind === "blocked" ? "blocked" : "todo",
    metadata: {
      routineKey: alert.routineKey,
      routineKind: alert.kind,
      sourceIssueId: alert.lastIssueId,
    },
    suppressRefreshComment: true,
  });

  if (escalation.evidenceKey) {
    evidenceKeys.push(escalation.evidenceKey);
  }

  return {
    notifyFounder: evidenceKeys.length > 0,
    evidenceKey: evidenceKeys.length > 0 ? evidenceKeys.join("|") : null,
  };
}

async function syncNotionDriftAssessment(
  ctx: PluginContext,
  companyId: string,
  assessment: NotionDriftAssessment,
) {
  for (const signal of assessment.open) {
    await upsertManagedIssue(ctx, {
      companyId,
      sourceType: "notion-drift",
      sourceId: signal.sourceId,
      title: signal.title,
      description: signal.description,
      projectName: EXECUTIVE_OPS_PROJECT,
      assignee: NOTION_MANAGER_AGENT,
      priority: signal.priority,
      status: "todo",
      signalUrl: signal.pageUrl,
      metadata: {
        pageId: signal.pageId,
        database: signal.database,
        driftKind: signal.driftKind,
        ...(signal.metadata ?? {}),
      },
      suppressRefreshComment: true,
    });
  }

  for (const resolution of assessment.resolve) {
    await resolveManagedIssue(ctx, {
      companyId,
      sourceType: "notion-drift",
      sourceId: resolution.sourceId,
      resolutionStatus: "done",
      comment: resolution.comment,
    });
  }
}

async function syncHandoffCollaboration(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  handoffAnalytics: HandoffAnalytics,
) {
  const previousState = await readState<HandoffMonitorState>(ctx, companyId, STATE_KEYS.handoffMonitor) ?? {};
  const nextState: HandoffMonitorState = { ...previousState };
  const currentSnapshots = [
    ...handoffAnalytics.openHandoffs,
    ...handoffAnalytics.recentResolvedHandoffs,
  ];
  const seenIds = new Set<string>();

  for (const handoff of currentSnapshots) {
    seenIds.add(handoff.id);
    const previous = previousState[handoff.id] ?? {
      requestCommentId: null,
      responseCommentId: null,
      escalatedAt: null,
      escalatedIssueId: null,
      resolvedAt: null,
    };
    const entry: HandoffMonitorEntry = { ...previous };

    if (handoff.requestCommentId && handoff.requestCommentId !== previous.requestCommentId) {
      await appendRecentEvent(ctx, companyId, {
        kind: "handoff-opened",
        title: handoff.title,
        issueId: handoff.id,
        detail: `${handoff.from} delegated ${handoff.type} to ${handoff.to}.`,
      });
      await postHandoffSlackActivity(ctx, config, {
        title: `New handoff for ${formatAgentName(handoff.to)}`,
        handoff,
        extraLines: [`Handoff type: ${handoff.type}`],
      });
      entry.requestCommentId = handoff.requestCommentId;
    }

    if (handoff.responseCommentId && handoff.responseCommentId !== previous.responseCommentId) {
      await appendRecentEvent(ctx, companyId, {
        kind: "handoff-responded",
        title: handoff.title,
        issueId: handoff.id,
        detail: `${handoff.responseFrom ?? handoff.to} responded with ${handoff.outcome ?? handoff.status}.`,
      });
      await postHandoffSlackActivity(ctx, config, {
        title: handoff.outcome === "blocked"
          ? `Handoff is blocked with ${formatAgentName(handoff.to)}`
          : `Handoff updated by ${formatAgentName(handoff.to)}`,
        handoff,
        extraLines: [
          `Outcome: ${handoff.outcome ?? handoff.status}`,
          ...(handoff.followUpReason ? [`Next step: ${handoff.followUpReason}`] : []),
          `Proof shared: ${handoff.proofLinkCount} link${handoff.proofLinkCount === 1 ? "" : "s"}`,
        ],
      });
      entry.responseCommentId = handoff.responseCommentId;
    }

    if (handoff.isStuck && !previous.escalatedAt) {
      const escalation = await upsertManagedIssue(ctx, {
        companyId,
        sourceType: "handoff-escalation",
        sourceId: handoff.id,
        title: `Handoff escalation: ${handoff.title}`,
        description: [
          "Blueprint automation escalated a stuck structured handoff.",
          "",
          `- Handoff issue: ${handoff.id}`,
          `- Route: ${handoff.from} -> ${handoff.to}`,
          `- Status: ${handoff.status}`,
          `- Priority: ${handoff.priority}`,
          `- Reason: ${handoff.stuckReason ?? "stalled"}`,
          `- Blocked depth: ${handoff.blockedDepth}`,
        ].join("\n"),
        projectName: handoff.projectName ?? "blueprint-executive-ops",
        assignee: getChiefOfStaffAgentKey(config),
        priority: handoff.priority,
        status: "todo",
        metadata: {
          handoffIssueId: handoff.id,
          from: handoff.from,
          to: handoff.to,
          blockedDepth: handoff.blockedDepth,
          bounce: handoff.isBounced,
        },
        comment: "Stuck handoff escalated by Blueprint automation.",
        suppressRefreshComment: true,
      });
      entry.escalatedAt = nowIso();
      entry.escalatedIssueId = escalation.issue.id;
      await appendRecentEvent(ctx, companyId, {
        kind: "handoff-escalated",
        title: handoff.title,
        issueId: handoff.id,
        detail: handoff.stuckReason ?? "Structured handoff stalled.",
      });
      await postHandoffSlackActivity(ctx, config, {
        title: `Stuck handoff escalated to ${getChiefOfStaffAgentKey(config)}`,
        handoff,
        extraLines: [
          `Escalation issue: ${escalation.issue.id}`,
          `Blocked depth: ${handoff.blockedDepth}`,
          `Bounce: ${handoff.isBounced ? "yes" : "no"}`,
        ],
      });
    }

    if (!handoff.isStuck && previous.escalatedAt && !previous.resolvedAt) {
      await resolveManagedIssue(ctx, {
        companyId,
        sourceType: "handoff-escalation",
        sourceId: handoff.id,
        resolutionStatus: "done",
        comment: `Handoff no longer looks stuck. Current status: ${handoff.status}.`,
      }).catch(() => undefined);
      entry.resolvedAt = nowIso();
      await appendRecentEvent(ctx, companyId, {
        kind: "handoff-escalation-resolved",
        title: handoff.title,
        issueId: handoff.id,
        detail: `Recovered to ${handoff.status}.`,
      });
      await postHandoffSlackActivity(ctx, config, {
        title: `Handoff recovered: ${handoff.to}`,
        handoff,
        extraLines: [`Recovery status: ${handoff.status}`],
      });
    }

    if (!entry.resolvedAt && (handoff.status === "done" || handoff.status === "cancelled")) {
      entry.resolvedAt = nowIso();
    }

    nextState[handoff.id] = entry;
  }

  for (const [handoffId, entry] of Object.entries(previousState)) {
    if (seenIds.has(handoffId)) continue;
    nextState[handoffId] = entry;
  }

  await writeState(ctx, companyId, STATE_KEYS.handoffMonitor, nextState);
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

function normalizeCommunityUpdatesStructuredReport(
  params: Record<string, unknown>,
): { report: CommunityUpdatesStructuredReport; validationErrors: string[] } {
  const report: CommunityUpdatesStructuredReport = {
    headline: asString(params.headline) ?? "",
    shippedThisWeek: coerceStringArray(params.shippedThisWeek),
    byTheNumbers: coerceStringArray(params.byTheNumbers),
    whatWeLearned: coerceStringArray(params.whatWeLearned),
    whatIsNext: coerceStringArray(params.whatIsNext),
  };

  const validationErrors: string[] = [];
  if (!report.headline) {
    validationErrors.push("Missing headline for community updates report.");
  }
  if (report.shippedThisWeek.length === 0) {
    validationErrors.push("Missing shippedThisWeek items for community updates report.");
  }
  if (report.whatWeLearned.length === 0) {
    validationErrors.push("Missing whatWeLearned items for community updates report.");
  }
  if (report.whatIsNext.length === 0) {
    validationErrors.push("Missing whatIsNext items for community updates report.");
  }

  return { report, validationErrors };
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

function normalizeAnalyticsFollowUpIssues(
  params: Record<string, unknown>,
): { followUpIssues: AnalyticsFollowUpIssue[]; validationErrors: string[] } {
  const items = Array.isArray(params.followUpIssues) ? params.followUpIssues : [];
  const validationErrors: string[] = [];
  const followUpIssues: AnalyticsFollowUpIssue[] = [];

  for (const [index, item] of items.entries()) {
    if (!item || typeof item !== "object") {
      validationErrors.push(`followUpIssues[${index}] must be an object.`);
      continue;
    }
    const entry = item as Record<string, unknown>;
    const kind = asString(entry.kind);
    const title = asString(entry.title);
    const description = asString(entry.description);
    const projectName = asString(entry.projectName);
    const assignee = asString(entry.assignee);
    const priority = asString(entry.priority);

    if (kind !== "blocker" && kind !== "owner_ready") {
      validationErrors.push(`followUpIssues[${index}] kind must be blocker or owner_ready.`);
      continue;
    }
    if (!title || !description || !projectName || !assignee) {
      validationErrors.push(
        `followUpIssues[${index}] must include title, description, projectName, and assignee.`,
      );
      continue;
    }

    followUpIssues.push({
      kind,
      title,
      description,
      projectName,
      assignee,
      priority,
    });
  }

  return { followUpIssues, validationErrors };
}

function buildAnalyticsReportKey(cadence: AnalyticsReportCadence, reportDate: string) {
  return `analytics:${cadence}:${reportDate}`;
}

function buildMarketIntelReportKey(cadence: MarketIntelReportCadence, reportDate: string) {
  return `market-intel:${cadence}:${reportDate}`;
}

function stableDigest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function pruneAnalyticsReportRunState(state: AnalyticsReportRunState) {
  return Object.fromEntries(
    Object.entries(state)
      .sort((left, right) => new Date(right[1].lastRunAt).getTime() - new Date(left[1].lastRunAt).getTime())
      .slice(0, 90),
  );
}

function pruneMarketIntelReportRunState(state: MarketIntelReportRunState) {
  return Object.fromEntries(
    Object.entries(state)
      .sort((left, right) => new Date(right[1].lastRunAt).getTime() - new Date(left[1].lastRunAt).getTime())
      .slice(0, 90),
  );
}

function pruneContentAssetRunState(state: ContentAssetRunState) {
  return Object.fromEntries(
    Object.entries(state)
      .sort((left, right) => new Date(right[1].lastRunAt).getTime() - new Date(left[1].lastRunAt).getTime())
      .slice(0, 180),
  );
}

async function persistContentAssetRun(
  ctx: PluginContext,
  companyId: string,
  record: ContentAssetRunState[string],
) {
  const existing = await readState<ContentAssetRunState>(ctx, companyId, STATE_KEYS.contentAssetRuns) ?? {};
  existing[record.assetKey] = record;
  await writeState(ctx, companyId, STATE_KEYS.contentAssetRuns, pruneContentAssetRunState(existing));
}

async function persistContentOutcomeReview(
  ctx: PluginContext,
  companyId: string,
  review: ContentOutcomeReview,
) {
  const state = await readState<ContentOutcomeReviewState>(ctx, companyId, STATE_KEYS.contentOutcomeReviews) ?? {};
  const existing = state[review.assetKey] ?? [];
  const next = [review, ...existing.filter((entry) => entry.id !== review.id)].slice(0, 20);
  state[review.assetKey] = next;
  await writeState(ctx, companyId, STATE_KEYS.contentOutcomeReviews, state);
}

type ShipBroadcastAutoQueueDecision = {
  eligible: boolean;
  reason: string;
};

function evaluateOperatorReadyShipBroadcast(
  asset: ContentAssetRunState[string],
  campaign: Record<string, unknown> | null,
  now: number,
): ShipBroadcastAutoQueueDecision {
  if (asset.assetType !== "ship_broadcast") {
    return { eligible: false, reason: "asset is not a ship broadcast" };
  }
  if (asset.outcome !== "done") {
    return { eligible: false, reason: "asset output is not complete" };
  }
  if (!asset.growthCampaignDraftId) {
    return { eligible: false, reason: "missing SendGrid draft id" };
  }
  const generatedAt = Date.parse(asset.generatedAt);
  if (!Number.isFinite(generatedAt) || now - generatedAt > 48 * 60 * 60 * 1000) {
    return { eligible: false, reason: "asset is older than the 48h approval window" };
  }
  if (asset.proofLinks.length < 2) {
    return { eligible: false, reason: "missing durable proof artifacts" };
  }
  if (asset.sourceEvidence.length < 2) {
    return { eligible: false, reason: "insufficient source evidence" };
  }
  if (!asset.reportHeadline || asset.reportHeadline.trim().length < 12) {
    return { eligible: false, reason: "headline is too weak for queueing" };
  }
  if (!campaign) {
    return { eligible: false, reason: "campaign draft record not found" };
  }
  const sendStatus = asString(campaign.send_status) ?? "draft";
  if (sendStatus !== "draft") {
    return { eligible: false, reason: `campaign is already ${sendStatus}` };
  }
  const recipientCount = asNumber(campaign.recipient_count) ?? 0;
  if (recipientCount <= 0) {
    return { eligible: false, reason: "campaign has no recipients" };
  }
  return { eligible: true, reason: "meets operator-ready auto-queue rules" };
}

async function queueOperatorReadyShipBroadcasts(
  ctx: PluginContext,
  companyId: string,
  limit = 10,
) {
  const assetState = await readState<ContentAssetRunState>(ctx, companyId, STATE_KEYS.contentAssetRuns) ?? {};
  const now = Date.now();
  const operatorEmail =
    getConfiguredEnvValue("BLUEPRINT_SUPPORT_EMAIL")
    || "ops@tryblueprint.io";
  const results: Array<Record<string, unknown>> = [];

  for (const asset of Object.values(assetState)
    .sort((left, right) => new Date(right.lastRunAt).getTime() - new Date(left.lastRunAt).getTime())
    .slice(0, limit * 3)) {
    if (results.length >= limit) {
      break;
    }

    const campaign = asset.growthCampaignDraftId
      ? await getGrowthCampaignRecord(asset.growthCampaignDraftId).catch(() => null)
      : null;
    const decision = evaluateOperatorReadyShipBroadcast(asset, campaign, now);

    if (!decision.eligible) {
      results.push({
        assetKey: asset.assetKey,
        campaignId: asset.growthCampaignDraftId ?? null,
        status: "skipped",
        reason: decision.reason,
      });
      continue;
    }

    const queueResult = await queueGrowthCampaignSend({
      campaignId: asset.growthCampaignDraftId!,
      operatorEmail,
    });

    results.push({
      assetKey: asset.assetKey,
      campaignId: asset.growthCampaignDraftId,
      status: queueResult.state,
      ledgerDocId: queueResult.ledgerDocId,
    });
  }

  return {
    count: results.length,
    results,
    ruleSummary: [
      "asset type must be ship_broadcast",
      "asset outcome must be done",
      "asset must be <= 48h old",
      "proofLinks >= 2 and sourceEvidence >= 2",
      "headline must be non-trivial",
      "campaign send_status must still be draft",
      "recipient_count must be > 0",
    ],
  };
}

function formatAnalyticsIssueComment(result: {
  outcome: "done" | "blocked";
  report: AnalyticsStructuredReport;
  cadence: AnalyticsReportCadence;
  notion?: AnalyticsOutputProof["notion"];
  slack?: AnalyticsOutputProof["slack"];
  followUpIssues?: AnalyticsOutputProof["followUpIssues"];
  failureReason?: string;
}) {
  const slackStatus = result.slack?.ok
    ? result.slack.deduped
      ? `already delivered to ${result.slack.routedChannel} at ${result.slack.deliveredAt ?? "an earlier run"}`
      : `delivered to ${result.slack.routedChannel} (HTTP ${result.slack.statusCode ?? "unknown"}${result.slack.responseBody ? `, body: ${result.slack.responseBody}` : ""})`
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
    `- Follow-up triage: ${result.followUpIssues && result.followUpIssues.length > 0 ? result.followUpIssues.map((entry) => `${entry.title} (${entry.kind}, ${entry.status})`).join("; ") : "no blocker-level or owner-ready follow-ups created"}`,
  ];
  return lines.join("\n");
}

function formatCommunityUpdatesIssueComment(result: CommunityUpdatesOutputProof) {
  const cadenceLabel = result.cadence === "weekly" ? "Weekly" : "Ad hoc";
  const slackStatus = !result.slack?.configured
    ? "not configured"
    : result.slack.ok
      ? `delivered to ${result.slack.routedChannel ?? "unknown"} (HTTP ${result.slack.statusCode ?? "unknown"}${result.slack.responseBody ? `, body: ${result.slack.responseBody}` : ""})`
      : `missing or failed${result.slack?.statusCode ? ` (HTTP ${result.slack.statusCode})` : ""}${result.slack?.responseBody ? `: ${result.slack.responseBody}` : ""}`;

  const lines = [
    result.outcome === "done"
      ? `${cadenceLabel} community update draft delivered.`
      : `${cadenceLabel} community update draft blocked.`,
    `- Asset key: ${result.assetKey}`,
    `- Asset type: ${result.assetType}`,
    `- Channels: ${result.channels.join(", ") || "unspecified"}`,
    `- Headline: ${result.report.headline}`,
    ...(result.failureReason ? [`- Failure reason: ${result.failureReason}`] : []),
    `- Notion Work Queue: ${result.notion?.workQueuePageUrl ?? result.notion?.workQueuePageId ?? "missing"}`,
    `- Notion Knowledge: ${result.notion?.knowledgePageUrl ?? result.notion?.knowledgePageId ?? "missing"}`,
    `- SendGrid draft: ${result.growthCampaignDraft ? `${result.growthCampaignDraft.id} (${result.growthCampaignDraft.recipientCount} recipients)` : "not created"}`,
    `- Slack digest: ${slackStatus}`,
  ];
  return lines.join("\n");
}

function normalizeContentAssetTypeForCommunityUpdate(value: unknown): ContentAssetType {
  const normalized = asString(value)?.toLowerCase();
  switch (normalized) {
    case "ship_broadcast":
    case "ship-broadcast":
      return "ship_broadcast";
    case "campaign_bundle":
    case "campaign-bundle":
      return "campaign_bundle";
    case "newsletter":
      return "newsletter";
    case "blog_post":
    case "blog-post":
      return "blog_post";
    case "social_draft":
    case "social-draft":
      return "social_draft";
    default:
      return "community_update";
  }
}

async function buildCommunityUpdatesOutputProof(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<CommunityUpdatesOutputProof> {
  const cadence: CommunityUpdatesCadence = asString(params.cadence) === "ad_hoc" ? "ad_hoc" : "weekly";
  const generatedAt = nowIso();
  const issueId = asString(params.issueId);
  const assetKey =
    asString(params.assetKey)
    ?? (cadence === "weekly"
      ? `community-update:weekly:${generatedAt.slice(0, 10)}`
      : `community-update:ad-hoc:${generatedAt.slice(0, 10)}:${stableDigest(params).slice(0, 8)}`);
  const assetType = normalizeContentAssetTypeForCommunityUpdate(params.assetType);
  const topLevelBriefInput = {
    wedge: params.wedge,
    audience: params.audience,
    channels: params.channels,
    sourceEvidence: params.sourceEvidence,
    proofLinks: params.proofLinks,
    allowedClaims: params.allowedClaims,
    blockedClaims: params.blockedClaims,
    callToAction: params.callToAction,
    owner: params.owner,
  };
  const briefInput =
    params.contentBrief && typeof params.contentBrief === "object" && !Array.isArray(params.contentBrief)
      ? params.contentBrief as Record<string, unknown>
      : topLevelBriefInput;
  const brief = normalizeContentBrief(briefInput, getCommunityUpdatesAgentKey(config));
  const channels = brief.channels;
  const sourceIssueIds = toStringArray(params.sourceIssueIds);
  const sourceEvidence = [...new Set([
    ...brief.sourceEvidence,
    ...toStringArray(params.sourceEvidence),
  ])];
  const { report, validationErrors } = normalizeCommunityUpdatesStructuredReport(params);
  const title = `Community Update ${cadence === "weekly" ? "Weekly" : "Ad Hoc"} Draft - ${generatedAt.slice(0, 10)}`;
  const errors: string[] = [];

  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );
  const slackTargets = await resolveSlackTargets(ctx, config);
  const slackConfigured = Boolean(slackTargets.default || slackTargets.growth || slackTargets.ops);

  const reportLines = [
    `Generated at: ${generatedAt}`,
    `Cadence: ${cadence}`,
    "",
    "## Headline",
    report.headline,
    "",
    "## Shipped This Week",
    ...report.shippedThisWeek.map((line) => `- ${line}`),
  ];
  if (report.byTheNumbers.length > 0) {
    reportLines.push("", "## By The Numbers", ...report.byTheNumbers.map((line) => `- ${line}`));
  }
  reportLines.push(
    "",
    "## What We Learned",
    ...report.whatWeLearned.map((line) => `- ${line}`),
    "",
    "## What Is Next",
    ...report.whatIsNext.map((line) => `- ${line}`),
  );
  if (validationErrors.length > 0) {
    reportLines.push("", "## Validation Errors", ...validationErrors.map((line) => `- ${line}`));
  }

  const emailDraftSubject = report.headline;
  const emailDraftBody = reportLines.slice(4).join("\n");
  const draftRecipients = normalizeEmailRecipients(
    process.env.BLUEPRINT_SHIP_BROADCAST_RECIPIENTS
      || process.env.BLUEPRINT_AUTONOMOUS_OUTBOUND_RECIPIENTS
      || "",
  );

  const result: CommunityUpdatesOutputProof = {
    success: false,
    outcome: "blocked",
    cadence,
    generatedAt,
    assetKey,
    assetType,
    channels,
    brief,
    sourceIssueIds,
    sourceEvidence,
    title,
    report,
    slack: {
      configured: slackConfigured,
    },
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
        priority: "P1",
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

  if (validationErrors.length === 0 && slackConfigured) {
    try {
      const slackResult = await postSlackDigest(
        {
          default: slackTargets.default,
          growth: slackTargets.growth,
          ops: slackTargets.ops,
        },
        {
          channel: "#growth",
          title,
          sections: [
            { heading: "Headline", items: [report.headline] },
            { heading: "Shipped This Week", items: report.shippedThisWeek },
            ...(report.byTheNumbers.length > 0 ? [{ heading: "By The Numbers", items: report.byTheNumbers }] : []),
            { heading: "What We Learned", items: report.whatWeLearned },
            { heading: "What Is Next", items: report.whatIsNext },
          ],
        },
      );
      result.slack = {
        configured: true,
        ok: slackResult.ok,
        routedChannel: slackResult.routedChannel,
        target: slackResult.target,
        statusCode: slackResult.statusCode,
        responseBody: slackResult.responseBody,
      };
      if (!slackResult.ok) {
        errors.push(`Slack digest failed with HTTP ${slackResult.statusCode ?? "unknown"}: ${slackResult.responseBody ?? "no response body"}`);
      }
    } catch (error) {
      errors.push(`Slack digest failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const shouldCreateGrowthCampaignDraft = assetType === "ship_broadcast";
  if (validationErrors.length === 0 && shouldCreateGrowthCampaignDraft) {
    try {
      const campaign = await createGrowthCampaignDraft({
        name: title,
        subject: emailDraftSubject,
        body: emailDraftBody,
        audienceQuery: `asset-key:${assetKey}`,
        channel: "sendgrid",
        recipientEmails: draftRecipients,
        automationContext: {
          asset_key: assetKey,
          asset_type: assetType,
          source_issue_ids: sourceIssueIds,
          proof_links: result.proofLinks,
          source_evidence: sourceEvidence,
          created_by: "community-updates-agent",
        },
      });
      result.growthCampaignDraft = {
        id: campaign.id,
        channel: "sendgrid",
        recipientCount: draftRecipients.length,
      };
    } catch (error) {
      errors.push(`SendGrid draft creation failed: ${error instanceof Error ? error.message : String(error)}`);
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
  if (shouldCreateGrowthCampaignDraft && !result.growthCampaignDraft?.id) {
    failureReasons.push("Missing SendGrid growth campaign draft.");
  }
  if (result.slack?.configured && !result.slack.ok) {
    failureReasons.push(
      result.slack.statusCode
        ? `Slack digest failed (HTTP ${result.slack.statusCode})`
        : "Missing Slack digest artifact.",
    );
  }

  result.proofLinks = [
    ...brief.proofLinks,
    result.notion?.workQueuePageUrl,
    result.notion?.knowledgePageUrl,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  result.failureReason = [...failureReasons, ...errors].join(" ");
  result.success = failureReasons.length === 0 && errors.length === 0;
  result.outcome = result.success ? "done" : "blocked";
  result.issueComment = formatCommunityUpdatesIssueComment(result);

  await persistContentAssetRun(ctx, companyId, {
    assetKey,
    assetType,
    channels,
    issueId,
    title,
    reportHeadline: report.headline,
    brief,
    sourceIssueIds,
    sourceEvidence,
    generatedAt,
    lastRunAt: generatedAt,
    outcome: result.outcome,
    proofLinks: result.proofLinks,
    growthCampaignDraftId: result.growthCampaignDraft?.id ?? null,
  });

  await updateRoutineHealth(
    ctx,
    companyId,
    cadence === "weekly" ? "community-updates-weekly" : "community-updates-ad-hoc",
    cadence === "weekly" ? "Community Updates Weekly" : "Community Updates Ad Hoc",
    "community-updates-agent",
    result.outcome,
    result.failureReason,
    asString(params.issueId),
  );
  await trackAgentRun(ctx, companyId, "community-updates-agent");
  await updatePhaseMetrics(ctx, companyId, "community-updates-agent", result.outcome);

  return result;
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
  const { expectedIntervalHours, routineStatus } = getConfiguredRoutineMetadata(routineKey);
  state[key] = {
    routineKey,
    routineTitle,
    agentKey,
    routineStatus,
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
  await healAgentExecutionTopology(ctx, companyId);
  await rerouteUnavailableIssueOwners(ctx, companyId, config);
  await maybeCatchUpMissedRoutines(ctx, companyId).catch(() => undefined);
  await revalidateCityLaunchDoneIssues(ctx, companyId, config);

  const storedHealthState = await readState<RoutineHealthState>(ctx, companyId, STATE_KEYS.routineHealth) ?? {};
  const reconciledHealthState = reconcileRoutineHealthState(storedHealthState);
  if (reconciledHealthState.changed) {
    await writeState(ctx, companyId, STATE_KEYS.routineHealth, reconciledHealthState.state);
  }

  const generatedAt = nowIso();
  const routineAlerts = collectRoutineHealthAlerts(reconciledHealthState.state, generatedAt);
  const managerAlertState = await readManagerAlertState(ctx, companyId);
  const routineAlertSignature = buildRoutineHealthAlertSignature(routineAlerts);
  const shouldPostManagerRoutineAlert =
    routineAlerts.length > 0 && managerAlertState.routineHealth?.signature !== routineAlertSignature;
  const alerts = routineAlerts.map((entry) =>
    entry.kind === "blocked"
      ? `:warning: *Routine Alert: ${entry.routineTitle}*\nStatus: blocked\nLast failure: ${entry.detail}\nConsecutive failures: ${entry.consecutiveFailures}\nAgent: ${entry.agentKey}\nIssue: ${entry.lastIssueId ?? "unknown"}`
      : `:warning: *Routine Alert: ${entry.routineTitle}*\nStatus: stale\nLast success: ${entry.lastSuccessAt ?? "never"}\nExpected interval: ${entry.expectedIntervalHours ?? "unknown"}h\nAgent: ${entry.agentKey}\nIssue: ${entry.lastIssueId ?? "unknown"}`,
  );

  if (alerts.length === 0 && managerAlertState.routineHealth) {
    await writeManagerAlertState(ctx, companyId, {
      ...managerAlertState,
      routineHealth: null,
    });
  }

  if (alerts.length > 0 && shouldPostManagerRoutineAlert) {
    const slackTargets = await resolveSlackTargets(ctx, config);
    if (slackTargets.default || slackTargets.ops || slackTargets.growth || slackTargets.exec || slackTargets.engineering || slackTargets.manager) {
      await postSlackDigest(
        slackTargets,
        {
          channel: "#paperclip-manager",
          title: `Routine Health Alert \u2014 ${alerts.length} issue(s)`,
          sections: [{ heading: "Alerts", items: alerts }],
        },
      );
    }

    await wakeChiefOfStaff(ctx, companyId, config, {
      reason: "routine_health_alert",
      idempotencyKey: `chief-of-staff:routine-health:${alerts.join("|")}`,
      payload: {
        signalType: "routine-health-alert",
        routineAlerts,
      },
      title: "Chief of Staff routine health wakeup",
      detail: `${routineAlerts.length} routine alert(s) need follow-through.`,
      slackChannel: "#paperclip-manager",
    }).catch(() => undefined);

    await writeManagerAlertState(ctx, companyId, {
      ...managerAlertState,
      routineHealth: {
        signature: routineAlertSignature,
        sentAt: generatedAt,
      },
    });
  }

  const founderSnapshot = await buildChiefOfStaffState(ctx, companyId, config);
  for (const alert of founderSnapshot.founderVisibility.queueAlerts) {
    const remediation = await ensureQueueAlertRemediation(ctx, companyId, config, alert);
    if (!remediation.notifyFounder || !remediation.evidenceKey) {
      continue;
    }
    await postFounderException(ctx, companyId, config, {
      fingerprint: `founder-exception:queue:${alert.queue}`,
      category: "Queue Threshold",
      lane: alert.lane,
      title: `Founder Exception | Queue Threshold | ${alert.lane}`,
      evidenceKey: remediation.evidenceKey,
      requireEvidence: true,
      sections: [
        { heading: "What Changed", items: [`${alert.queue} crossed a configured founder visibility threshold.`] },
        { heading: "Why It Matters Now", items: [alert.detail] },
        { heading: "Owner + Next Checkpoint", items: [`ops-lead owns the queue response and should confirm the next routing checkpoint.`] },
        { heading: "Founder Decision Needed", items: [`None yet unless the queue cannot be stabilized through normal routing and human review capacity.`] },
      ],
    }).catch(() => undefined);
  }

  for (const alert of founderSnapshot.founderVisibility.routineMisses) {
    const remediation = await ensureRoutineMissRemediation(ctx, companyId, config, alert);
    if (!remediation.notifyFounder || !remediation.evidenceKey) {
      continue;
    }
    await postFounderException(ctx, companyId, config, {
      fingerprint: `founder-exception:routine:${alert.routineTitle}:${alert.kind}`,
      category: "Routine Silent Failure",
      lane: "Executive",
      title: `Founder Exception | Routine Silent Failure | Executive`,
      evidenceKey: remediation.evidenceKey,
      requireEvidence: true,
      sections: [
        { heading: "What Changed", items: [`${alert.routineTitle} is ${alert.kind}.`] },
        { heading: "Why It Matters Now", items: [alert.detail] },
        { heading: "Owner + Next Checkpoint", items: [`blueprint-chief-of-staff owns the follow-through and should either reroute or close the stale lane.`] },
        { heading: "Founder Decision Needed", items: [`None yet unless repeated misses point to a staffing, priority, or policy change.`] },
      ],
    }).catch(() => undefined);
  }

  for (const risk of founderSnapshot.founderVisibility.buyerRisks.filter((entry) => entry.priority === "critical" || entry.priority === "high")) {
    const remediation = await ensureBuyerRiskRemediation(ctx, companyId, config, risk);
    if (!remediation.notifyFounder || !remediation.evidenceKey) {
      continue;
    }
    await postFounderException(ctx, companyId, config, {
      fingerprint: `founder-exception:buyer-risk:${risk.id}`,
      category: "Buyer Deal Risk",
      lane: "Buyer",
      title: `Founder Exception | Buyer Deal Risk | Buyer`,
      evidenceKey: remediation.evidenceKey,
      requireEvidence: true,
      sections: [
        { heading: "What Changed", items: [`Buyer-facing work is at risk: ${cleanIssueTitle(risk.title)}.`] },
        { heading: "Why It Matters Now", items: [`This thread has been blocked or idle for ${risk.hoursSinceUpdate.toFixed(1)}h and could slip buyer confidence.`] },
        { heading: "Owner + Next Checkpoint", items: [`${risk.owner} owns the next checkpoint on this buyer path.`] },
        { heading: "Founder Decision Needed", items: [`Step in only if the owner cannot recover the buyer path by the next checkpoint.`] },
      ],
    }).catch(() => undefined);
  }

  for (const outcome of founderSnapshot.founderVisibility.experimentOutcomes.filter((entry) => entry.lifecycleStage.toLowerCase() === "revert")) {
    const remediation = await ensureExperimentOutcomeRemediation(ctx, companyId, config, outcome);
    if (!remediation.notifyFounder || !remediation.evidenceKey) {
      continue;
    }
    await postFounderException(ctx, companyId, config, {
      fingerprint: `founder-exception:experiment:${outcome.title}:revert`,
      category: "Experiment Regression",
      lane: "Experiment",
      title: `Founder Exception | Experiment Regression | Experiment`,
      evidenceKey: remediation.evidenceKey,
      requireEvidence: true,
      sections: [
        { heading: "What Changed", items: [`An experiment outcome landed as REVERT: ${outcome.title}.`] },
        { heading: "Why It Matters Now", items: [`A guardrail or primary metric failed, so the change should not remain the operating default.`] },
        { heading: "Owner + Next Checkpoint", items: [`growth-lead and conversion-agent own the next checkpoint and should document the lesson cleanly.`] },
        { heading: "Founder Decision Needed", items: [`None yet unless repeated reversions point to a strategy or instrumentation gap.`] },
      ],
    }).catch(() => undefined);
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
  const reportDate = formatDateInTimeZone(new Date(generatedAt), "America/New_York");
  const title = `${cadence === "daily" ? "Analytics Daily" : "Analytics Weekly"} Snapshot - ${reportDate}`;
  const { report, validationErrors } = normalizeAnalyticsStructuredReport(params, cadence);
  const { followUpIssues: explicitFollowUpIssues, validationErrors: followUpValidationErrors } = normalizeAnalyticsFollowUpIssues(params);
  const followUpIssues = buildAnalyticsFollowUpIssues(
    report.recommendedFollowUps,
    explicitFollowUpIssues,
    {
      repoCatalog: config.repoCatalog ?? DEFAULT_REPO_CATALOG,
      opsAgents: getOpsRoutingConfig(config),
      growthAgents: getGrowthRoutingConfig(config),
      executiveOpsProjectName: EXECUTIVE_OPS_PROJECT,
    },
  );
  const errors: string[] = [];
  const reportKey = buildAnalyticsReportKey(cadence, reportDate);
  const reportSignature = stableDigest({
    cadence,
    title,
    report,
  });
  const storedRuns = await readState<AnalyticsReportRunState>(ctx, companyId, STATE_KEYS.analyticsReportRuns) ?? {};
  const existingRun = storedRuns[reportKey];

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
  const priorRunMatches = existingRun?.signature === reportSignature;

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

  if (priorRunMatches && existingRun?.notion?.knowledgePageId && existingRun?.notion?.workQueuePageId) {
    result.notion = existingRun.notion;
  } else if (validationErrors.length === 0 && followUpValidationErrors.length === 0 && notionToken) {
    try {
      const notionClient = createNotionClient({ token: notionToken });
      const knowledgeEntry = await upsertKnowledgeEntry(notionClient, {
        title,
        type: "Reference",
        system: "WebApp",
        content: reportLines.join("\n"),
      }, { archiveDuplicates: true });
      const workQueueEntry = await upsertWorkQueueItem(notionClient, {
        title,
        priority: cadence === "daily" ? "P2" : "P1",
        system: "WebApp",
        lifecycleStage: "Done",
        workType: "Refresh",
        lastStatusChange: generatedAt,
        substage: [
          report.headline,
          knowledgeEntry.pageUrl ? `Knowledge page: ${knowledgeEntry.pageUrl}` : `Knowledge page ID: ${knowledgeEntry.pageId}`,
        ].join(" "),
      }, { archiveDuplicates: true });
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

  if (existingRun?.slackDeliveredAt && existingRun?.slack?.routedChannel) {
    result.slack = {
      ok: true,
      routedChannel: existingRun.slack.routedChannel,
      target: existingRun.slack.target,
      statusCode: existingRun.slack.statusCode,
      responseBody: existingRun.slack.responseBody,
      deduped: true,
      deliveredAt: existingRun.slackDeliveredAt,
    };
  } else if (validationErrors.length === 0 && followUpValidationErrors.length === 0 && (slackGrowthWebhookUrl || slackOpsWebhookUrl)) {
    try {
      const slackResult = await postSlackDigest(
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
      result.slack = {
        ...slackResult,
        deliveredAt: slackResult.ok ? generatedAt : undefined,
      };
      if (!slackResult.ok) {
        errors.push(`Slack digest failed with HTTP ${slackResult.statusCode ?? "unknown"}: ${slackResult.responseBody ?? "no response body"}`);
      }
    } catch (error) {
      errors.push(`Slack digest failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length > 0) {
    errors.push(...validationErrors);
  }
  if (followUpValidationErrors.length > 0) {
    errors.push(...followUpValidationErrors);
  }

  if (followUpIssues.length > 0) {
    const parentIssueId = asString(params.issueId);
    const createdFollowUps: NonNullable<AnalyticsOutputProof["followUpIssues"]> = [];
    for (const followUp of followUpIssues) {
      try {
        const sourceId = stableDigest({
          kind: followUp.kind,
          title: followUp.title,
          projectName: followUp.projectName,
          assignee: followUp.assignee,
        });
        const upsertResult = await upsertManagedIssue(ctx, {
          companyId,
          sourceType: "analytics-report-triage",
          sourceId,
          title: followUp.title,
          description: followUp.description,
          projectName: followUp.projectName,
          assignee: followUp.assignee,
          priority: normalizeIssuePriority(followUp.priority, followUp.kind === "blocker" ? "high" : "medium"),
          status: "todo",
          parentIssueId,
          metadata: {
            reportKey,
            followUpKind: followUp.kind,
            cadence,
            title,
          },
        });
        createdFollowUps.push({
          id: upsertResult.issue.id,
          title: upsertResult.issue.title,
          kind: followUp.kind,
          status: upsertResult.issue.status,
        });
        if (parentIssueId) {
          await ctx.issues.createComment(
            parentIssueId,
            `${followUp.kind === "blocker" ? "Blocked work" : "Owner-ready follow-up"} routed to ${followUp.assignee}: ${followUp.title}`,
            companyId,
          ).catch(() => undefined);
        }
      } catch (error) {
        errors.push(`Follow-up triage failed for ${followUp.title}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (createdFollowUps.length > 0) {
      result.followUpIssues = createdFollowUps;
    }
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
  const nextRunState = pruneAnalyticsReportRunState({
    ...storedRuns,
    [reportKey]: {
      reportKey,
      cadence,
      title,
      signature: reportSignature,
      firstRunAt: existingRun?.firstRunAt ?? generatedAt,
      lastRunAt: generatedAt,
      issueId: asString(params.issueId) ?? existingRun?.issueId,
      notion: result.notion ?? existingRun?.notion,
      slackDeliveredAt: result.slack?.ok
        ? (result.slack.deduped ? existingRun?.slackDeliveredAt : result.slack.deliveredAt)
        : existingRun?.slackDeliveredAt,
      slack: result.slack?.ok
        ? {
          routedChannel: result.slack.routedChannel,
          target: result.slack.target,
          statusCode: result.slack.statusCode,
          responseBody: result.slack.responseBody,
        }
        : existingRun?.slack,
      followUpIssueIds: result.followUpIssues?.map((entry) => entry.id) ?? existingRun?.followUpIssueIds,
    },
  });
  await writeState(ctx, companyId, STATE_KEYS.analyticsReportRuns, nextRunState);
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
  const config = await getConfig(ctx);
  const routedAssignee = routeManagedIssueAssignee(
    {
      projectName: input.projectName,
      title: input.title,
      description: input.description,
      assignee: input.assignee,
    },
    config,
  );
  const assigneeResolution = await resolveAssignableAgent(ctx, companyId, config, routedAssignee);
  const assignee = assigneeResolution.agent;
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
  await sendNotification(ctx, config, companyId, {
    headline: "Blueprint automation created a blocker follow-up issue.",
    issueTitle: followUp.title,
    issueId: followUp.id,
    projectName: input.projectName,
    priority: followUp.priority,
    status: followUp.status,
    detail: `Parent issue ${input.parentIssueId}`,
  });
  await postSlackActivity(ctx, config, {
    channel: slackChannelForAgent(assigneeResolution.selectedKey),
    title: `Blocked work handed to ${formatAgentName(assigneeResolution.selectedKey)}`,
    summary: [
      `What happened: A blocked task was handed to ${formatAgentName(assigneeResolution.selectedKey)} for follow-through.`,
      `Task: ${followUp.title}`,
      `Parent issue: ${input.parentIssueId}`,
      `Project: ${input.projectName}`,
      `Priority: ${formatIssuePriority(followUp.priority) ?? followUp.priority}`,
    ],
  }).catch(() => undefined);
  await wakeChiefOfStaff(ctx, companyId, config, {
    reason: "blocker_follow_up_created",
    idempotencyKey: `chief-of-staff:blocker-follow-up:${followUp.id}`,
    payload: {
      signalType: "blocker_follow_up_created",
      issueId: followUp.id,
      parentIssueId: input.parentIssueId,
      assignee: assigneeResolution.selectedKey,
      projectName: input.projectName,
    },
    title: "Chief of Staff wakeup from blocker follow-up",
    detail: `${followUp.title} (${followUp.id}) was delegated to ${assigneeResolution.selectedKey}.`,
    slackChannel: "#paperclip-manager",
    slackTitle: "Manager update: blocked work was delegated",
    slackSummary: [
      `What happened: A blocked task was handed to ${formatAgentName(assigneeResolution.selectedKey)} for follow-through.`,
      `Task: ${followUp.title}`,
      `Project: ${input.projectName}`,
    ],
    suppressSlackIfSameTargetAsChannel: slackChannelForAgent(assigneeResolution.selectedKey),
  }).catch(() => undefined);
  if (assigneeResolution.rerouted) {
    await ctx.issues.createComment(
      followUp.id,
      [
        "Automation rerouted this blocker follow-up because the preferred owner is currently unavailable.",
        `- Preferred owner: ${formatAgentName(assigneeResolution.preferredKey)}`,
        `- Current owner: ${formatAgentName(assigneeResolution.selectedKey)}`,
      ].join("\n"),
      companyId,
    ).catch(() => undefined);
  }
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

function getCityLaunchRoutineType(issue: Pick<Issue, "title" | "originKind">): CityLaunchRoutineType | null {
  if (issue.originKind !== "routine_execution") return null;
  const normalized = issue.title.trim().toLowerCase();
  if (normalized === "city launch weekly") return "weekly";
  if (normalized === "city launch refresh") return "refresh";
  return null;
}

function normalizeArtifactPath(artifactRef: string) {
  return artifactRef.trim().replace(/^`|`$/g, "").replace(/^\/+/, "");
}

function formatCityLaunchCompletionRejection(errors: string[]) {
  return [
    "City launch completion rejected.",
    "",
    "This routine cannot count as done yet because:",
    ...errors.map((error) => `- ${error}`),
    "",
    "Required closeout format:",
    "- Selected city: <City, ST>",
    "- Artifact: <repo path or issue-document:key>",
    "- Evidence: <why this city now> for weekly runs",
    "- Outcome: updated | no_change for refresh runs",
    "- Evidence delta: <what changed or none> for refresh runs",
    "- Other cities touched: none",
  ].join("\n");
}

async function resolveCityLaunchArtifactExists(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  artifactRef: string,
) {
  const normalizedArtifact = normalizeArtifactPath(artifactRef);
  if (!normalizedArtifact.startsWith("ops/paperclip/playbooks/city-launch-")) {
    return false;
  }

  const repoConfig = (config.repoCatalog ?? DEFAULT_REPO_CATALOG).find((entry) =>
    entry.key === "webapp" || entry.githubRepo === "Blueprint-WebApp" || entry.projectName === "blueprint-webapp",
  );
  if (!repoConfig) return false;

  try {
    const { workspace } = await getPrimaryWorkspaceForRepo(ctx, companyId, repoConfig);
    const workspacePath = await resolveRepoWorkspacePath(ctx, companyId, repoConfig, workspace);
    const candidatePath = path.resolve(workspacePath, normalizedArtifact);
    const normalizedWorkspacePath = path.resolve(workspacePath);
    if (!candidatePath.startsWith(`${normalizedWorkspacePath}${path.sep}`) && candidatePath !== normalizedWorkspacePath) {
      return false;
    }
    return existsSync(candidatePath);
  } catch {
    return false;
  }
}

async function validateCityLaunchIssueCompletion(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  issueId: string,
) {
  const issue = await ctx.issues.get(issueId, companyId);
  if (!issue || issue.status !== "done") return;

  const routineType = getCityLaunchRoutineType(issue);
  if (!routineType) return;

  const comments = await ctx.issues.listComments(issue.id, companyId);
  const closeout = findLatestCityLaunchCloseout(comments);
  const currentSelection = await readState<CityLaunchSelectionState>(ctx, companyId, STATE_KEYS.cityLaunchSelection) ?? null;
  const artifactExists = closeout
    ? await resolveCityLaunchArtifactExists(ctx, companyId, config, closeout.artifactRef)
    : false;

  const assessment = assessCityLaunchCompletion({
    routineType,
    comments,
    documentKeys: [],
    artifactExists,
    currentSelection,
    issueId: issue.id,
    nowIso: nowIso(),
  });

  if (!assessment.ok) {
    await ctx.issues.update(issue.id, { status: "blocked" }, companyId);
    await ctx.issues.createComment(
      issue.id,
      formatCityLaunchCompletionRejection(assessment.errors),
      companyId,
    );
    return;
  }

  if (assessment.nextSelection) {
    await writeState(ctx, companyId, STATE_KEYS.cityLaunchSelection, assessment.nextSelection);
  }
}

async function revalidateCityLaunchDoneIssues(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
) {
  const cityLaunchAgent = await resolveAgent(ctx, companyId, "city-launch-agent").catch(() => null);
  if (!cityLaunchAgent) return;

  const issues = await ctx.issues.list({
    companyId,
    assigneeAgentId: cityLaunchAgent.id,
    status: "done",
    limit: 100,
  });

  for (const issue of issues) {
    if (getCityLaunchRoutineType(issue)) {
      await validateCityLaunchIssueCompletion(ctx, companyId, config, issue.id);
    }
  }
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
        `Treat this as managed execution risk: route new work into clean execution sessions where possible, and triage the drift without freezing the entire lane.`,
      projectName: repoConfig.projectName,
      assignee: repoConfig.implementationAgent,
      priority: "medium",
      status: "backlog",
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
        `Treat this as managed execution risk: review and normalize the branch, but do not collapse unrelated execution if a clean workspace or reroute path exists.`,
      projectName: repoConfig.projectName,
      assignee: repoConfig.reviewAgent,
      priority: "high",
      status: "backlog",
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
  if (!config.enableGithubPolling || !config.githubOwner) {
    return { polled: 0 };
  }

  const token = config.githubTokenRef
    ? await ctx.secrets.resolve(config.githubTokenRef).catch(() => null)
    : null;
  let polled = 0;
  const errors: string[] = [];

  for (const repoConfig of config.repoCatalog ?? DEFAULT_REPO_CATALOG) {
    const url = `https://api.github.com/repos/${config.githubOwner}/${repoConfig.githubRepo}/actions/runs?per_page=3`;
    let response: Record<string, unknown>;
    try {
      response = await fetchJson(ctx, url, token ?? undefined);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (token && /HTTP 401|HTTP 403/i.test(message)) {
        response = await fetchJson(ctx, url);
        errors.push(`${repoConfig.projectName}: retried GitHub workflow polling without token after auth failure.`);
      } else {
        throw error;
      }
    }
    const workflowRuns = Array.isArray(response.workflow_runs)
      ? response.workflow_runs.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      : [];
    if (workflowRuns[0]) {
      await syncGithubWorkflowRun(ctx, config, companyId, repoConfig, workflowRuns[0]);
      polled += 1;
    }
  }

  return { polled, errors };
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
  if (Array.isArray((githubSummary as { errors?: string[] }).errors)) {
    errors.push(...((githubSummary as { errors?: string[] }).errors ?? []));
  }
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
    ? result.slack.deduped
      ? `already delivered to ${result.slack.routedChannel} at ${result.slack.deliveredAt ?? "an earlier run"}`
      : `delivered to ${result.slack.routedChannel} (HTTP ${result.slack.statusCode ?? "unknown"})`
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
      const slackResult = await postSlackDigest(
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
      result.slack = slackResult;
      if (!slackResult.ok) {
        errors.push(`Slack digest failed with HTTP ${slackResult.statusCode ?? "unknown"}`);
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

function formatCustomerResearchIssueComment(result: CustomerResearchOutputProof) {
  const slackStatus = result.slack?.ok
    ? `delivered to ${result.slack.routedChannel} (HTTP ${result.slack.statusCode ?? "unknown"})`
    : `missing or failed${result.slack?.statusCode ? ` (HTTP ${result.slack.statusCode})` : ""}`;
  return [
    result.outcome === "done"
      ? "Customer research report delivered."
      : "Customer research report blocked.",
    `- Topic: ${result.topic}`,
    `- Lane: ${result.lane}`,
    `- Headline: ${result.headline}`,
    `- Evidence items: ${result.synthesis.evidence.length}`,
    `- JTBD items: ${result.synthesis.jtbd.length}`,
    `- Personas: ${result.synthesis.personas.length}`,
    `- Confidence: ${result.synthesis.confidence}`,
    ...(result.failureReason ? [`- Failure reason: ${result.failureReason}`] : []),
    `- Notion Work Queue: ${result.notion?.workQueuePageUrl ?? result.notion?.workQueuePageId ?? "missing"}`,
    `- Notion Knowledge: ${result.notion?.knowledgePageUrl ?? result.notion?.knowledgePageId ?? "missing"}`,
    `- Slack digest: ${slackStatus}`,
  ].join("\n");
}

async function buildCustomerResearchOutputProof(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<CustomerResearchOutputProof> {
  const cadence = normalizeCustomerResearchCadence(params.cadence);
  const generatedAt = nowIso();
  const topic = asString(params.topic) ?? asString(params.researchGoal) ?? "Customer research";
  const lane = asString(params.lane) ?? "cross-lane";
  const headline = asString(params.headline) ?? "";
  const synthesis = synthesizeCustomerResearch(params.evidence);
  const recommendedActions = coerceStringArray(params.recommendedActions);
  const title = `Customer Research ${generatedAt.slice(0, 10)} - ${topic}`;
  const errors: string[] = [];

  if (!headline) errors.push("Missing headline for customer research report.");
  if (synthesis.evidence.length === 0) errors.push("Missing evidence for customer research report.");
  if (synthesis.jtbd.length === 0) errors.push("Missing JTBD findings for customer research report.");
  if (synthesis.personas.length === 0) errors.push("Missing personas for customer research report.");
  if (recommendedActions.length === 0) errors.push("Missing recommendedActions for customer research report.");

  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );
  const slackGrowthWebhookUrl = await resolveOptionalSecret(
    ctx,
    config.secrets?.slackGrowthWebhookUrlRef,
    "SLACK_GROWTH_WEBHOOK_URL",
  );

  const reportLines = [
    `Generated at: ${generatedAt}`,
    `Cadence: ${cadence}`,
    "",
    "## Headline",
    headline,
    "",
    "## Scope",
    `- Topic: ${topic}`,
    `- Lane: ${lane}`,
    `- Confidence: ${synthesis.confidence}`,
    `- Source coverage: ${synthesis.sourceCoverage.join(", ") || "none"}`,
    "",
    "## Evidence",
    ...synthesis.evidence.map((entry) =>
      `- [${entry.label}] ${entry.source}: ${entry.summary}${entry.url ? ` (${entry.url})` : ""}`,
    ),
    "",
    "## JTBD",
    ...synthesis.jtbd.map((entry) =>
      `- ${entry.job} | Pain: ${entry.pain} | Desired outcome: ${entry.desiredOutcome} | Evidence count: ${entry.evidenceCount}`,
    ),
    "",
    "## Personas",
    ...synthesis.personas.map((entry) =>
      `- ${entry.role} | Goals: ${entry.goals.join("; ") || "n/a"} | Pains: ${entry.pains.join("; ") || "n/a"} | Objections: ${entry.objections.join("; ") || "n/a"} | Evidence count: ${entry.evidenceCount}`,
    ),
    "",
    "## Objections",
    ...synthesis.objections.map((entry) => `- ${entry}`),
    "",
    "## Open Questions",
    ...synthesis.openQuestions.map((entry) => `- ${entry}`),
    "",
    "## Recommended Actions",
    ...recommendedActions.map((entry) => `- ${entry}`),
  ];

  const result: CustomerResearchOutputProof = {
    success: false,
    outcome: "blocked",
    cadence,
    generatedAt,
    title,
    topic,
    lane,
    headline,
    synthesis: {
      ...synthesis,
      recommendedActions,
    },
    proofLinks: [],
    issueComment: "",
    errors,
  };

  if (errors.length === 0 && notionToken) {
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
        priority: cadence === "weekly" ? "P1" : "P2",
        system: "Cross-System",
        lifecycleStage: "Open",
        workType: "Research",
        substage: [
          `Lane: ${lane}.`,
          `Confidence: ${synthesis.confidence}.`,
          `JTBD: ${synthesis.jtbd.length}.`,
          `Personas: ${synthesis.personas.length}.`,
          `Evidence items: ${synthesis.evidence.length}.`,
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
      result.errors.push(`Notion write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length === 0 && slackGrowthWebhookUrl) {
    try {
      const slackResult = await postSlackDigest(
        {
          default: slackGrowthWebhookUrl,
          growth: slackGrowthWebhookUrl,
        },
        {
          channel: "#research",
          title,
          sections: [
            { heading: "Headline", items: [headline] },
            { heading: "JTBD", items: synthesis.jtbd.slice(0, 5).map((entry) => `${entry.job} -> ${entry.desiredOutcome}`) },
            { heading: "Personas", items: synthesis.personas.slice(0, 5).map((entry) => `${entry.role}: ${entry.goals[0] ?? "goal unknown"}`) },
            { heading: "Recommended Actions", items: recommendedActions.slice(0, 5) },
          ],
        },
      );
      result.slack = slackResult;
      if (!slackResult.ok) {
        result.errors.push(`Slack digest failed with HTTP ${slackResult.statusCode ?? "unknown"}`);
      }
    } catch (error) {
      result.errors.push(`Slack digest failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const failureReasons: string[] = [];
  if (!result.notion?.workQueuePageId) failureReasons.push("Missing Notion Work Queue artifact.");
  if (!result.notion?.knowledgePageId) failureReasons.push("Missing Notion Knowledge artifact.");
  if (!result.slack?.ok) {
    failureReasons.push(result.slack ? `Slack digest failed (HTTP ${result.slack.statusCode ?? "unknown"})` : "Missing Slack digest artifact.");
  }

  result.proofLinks = [result.notion?.workQueuePageUrl, result.notion?.knowledgePageUrl]
    .filter((value): value is string => typeof value === "string" && value.length > 0);
  result.failureReason = [...failureReasons, ...result.errors].join(" ");
  result.success = failureReasons.length === 0 && result.errors.length === 0;
  result.outcome = result.success ? "done" : "blocked";
  result.issueComment = formatCustomerResearchIssueComment(result);

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
    ? result.slack.deduped
      ? `already delivered to ${result.slack.routedChannel} at ${result.slack.deliveredAt ?? "an earlier run"}`
      : `delivered to ${result.slack.routedChannel} (HTTP ${result.slack.statusCode ?? "unknown"})`
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
  const reportDate = formatDateInTimeZone(new Date(generatedAt), "America/New_York");
  const title = `Market Intel ${cadence === "daily" ? "Daily" : "Weekly"} Digest - ${reportDate}`;
  const { report, validationErrors } = normalizeMarketIntelReport(params);
  const errors: string[] = [];
  const reportKey = buildMarketIntelReportKey(cadence, reportDate);
  const reportSignature = stableDigest({
    cadence,
    title,
    report,
  });
  const storedRuns =
    await readState<MarketIntelReportRunState>(ctx, companyId, STATE_KEYS.marketIntelReportRuns) ?? {};
  const existingRun = storedRuns[reportKey];
  const priorRunMatches = existingRun?.signature === reportSignature;

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

  if (priorRunMatches && existingRun?.notion?.knowledgePageId && existingRun?.notion?.workQueuePageId) {
    result.notion = existingRun.notion;
  } else if (validationErrors.length === 0 && notionToken) {
    try {
      const notionClient = createNotionClient({ token: notionToken });
      const knowledgeEntry = await upsertKnowledgeEntry(notionClient, {
        title,
        type: "Reference",
        system: "Cross-System",
        content: reportLines.join("\n"),
      }, { archiveDuplicates: true });
      const workQueueEntry = await upsertWorkQueueItem(notionClient, {
        title,
        priority: cadence === "daily" ? "P2" : "P1",
        system: "Cross-System",
        lifecycleStage: "Open",
        workType: "Refresh",
        substage: [
          report.headline,
          knowledgeEntry.pageUrl ? `Knowledge page: ${knowledgeEntry.pageUrl}` : `Knowledge page ID: ${knowledgeEntry.pageId}`,
        ].join(" "),
      }, { archiveDuplicates: true });
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

  if (priorRunMatches && existingRun?.slackDeliveredAt && existingRun?.slack?.routedChannel) {
    result.slack = {
      ok: true,
      routedChannel: existingRun.slack.routedChannel,
      target: existingRun.slack.target,
      statusCode: existingRun.slack.statusCode,
      responseBody: existingRun.slack.responseBody,
      deduped: true,
      deliveredAt: existingRun.slackDeliveredAt,
    };
  } else if (validationErrors.length === 0 && (slackGrowthWebhookUrl || slackOpsWebhookUrl)) {
    try {
      const slackResult = await postSlackDigest(
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
      result.slack = {
        ...slackResult,
        deliveredAt: slackResult.ok ? generatedAt : undefined,
      };
      if (!slackResult.ok) {
        errors.push(`Slack digest failed with HTTP ${slackResult.statusCode ?? "unknown"}`);
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
  const nextRunState = pruneMarketIntelReportRunState({
    ...storedRuns,
    [reportKey]: {
      reportKey,
      cadence,
      title,
      signature: reportSignature,
      firstRunAt: existingRun?.firstRunAt ?? generatedAt,
      lastRunAt: generatedAt,
      issueId: asString(params.issueId) ?? existingRun?.issueId,
      notion: result.notion ?? existingRun?.notion,
      slackDeliveredAt: result.slack?.ok
        ? (result.slack.deduped ? existingRun?.slackDeliveredAt : result.slack.deliveredAt)
        : existingRun?.slackDeliveredAt,
      slack: result.slack?.ok
        ? {
          routedChannel: result.slack.routedChannel,
          target: result.slack.target,
          statusCode: result.slack.statusCode,
          responseBody: result.slack.responseBody,
        }
        : existingRun?.slack,
    },
  });
  await writeState(ctx, companyId, STATE_KEYS.marketIntelReportRuns, nextRunState);
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

interface PlatformDoctrineDoc {
  title: string;
  naturalKey: string;
  type: string;
  fileContent: string;
}

interface SyncPlatformDoctrineResult {
  success: boolean;
  outcome: string;
  synced: Array<{ title: string; pageId: string; pageUrl: string }>;
  skipped: Array<{ title: string; reason: string }>;
  errors: string[];
  issueComment: string;
  data?: Record<string, unknown>;
}

async function syncPlatformDoctrineToKnowledge(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  _companyId: string,
  _params: Record<string, unknown>,
): Promise<SyncPlatformDoctrineResult> {
  const repoPath = typeof _params.repoPath === "string" ? _params.repoPath : "/Users/nijelhunt_1/workspace/Blueprint-WebApp";

  const docs: PlatformDoctrineDoc[] = [
    {
      title: "Platform Context — System Framing & Product Doctrine",
      naturalKey: "platform-context-doctrine",
      type: "Platform Doctrine",
      fileContent: "",
    },
    {
      title: "World Model Strategy — Core Strategy Document",
      naturalKey: "world-model-strategy-doctrine",
      type: "Platform Doctrine",
      fileContent: "",
    },
  ];

  // Read from disk
  const fs = await import("fs");
  for (const d of docs) {
    const fp = d.naturalKey.includes("platform-context")
      ? `${repoPath}/PLATFORM_CONTEXT.md`
      : `${repoPath}/WORLD_MODEL_STRATEGY_CONTEXT.md`;
    try {
      d.fileContent = fs.readFileSync(fp, "utf-8");
    } catch (err) {
      d.fileContent = `[File not found: ${fp}]\n${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const result: SyncPlatformDoctrineResult = {
    success: true,
    outcome: "done",
    synced: [],
    skipped: [],
    errors: [],
    issueComment: "",
  };

  // Resolve Notion token and upsert into Knowledge DB
  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );
  if (notionToken) {
    const notionClient = createNotionClient({ token: notionToken });
    for (const d of docs) {
      try {
        const upsertResult = await upsertKnowledgeEntry(notionClient, {
          title: d.title,
          naturalKey: d.naturalKey,
          type: "Reference",
          content: d.fileContent,
          system: "Cross-System",
          lifecycleStage: "Active",
        });
        result.synced.push({
          title: d.title,
          pageId: upsertResult.pageId,
          pageUrl: upsertResult.pageUrl ?? "",
        });
      } catch (err) {
        const msg = `Failed to upsert "${d.title}": ${err instanceof Error ? err.message : String(err)}`;
        result.errors.push(msg);
        result.skipped.push({ title: d.title, reason: msg });
      }
    }
  } else {
    result.errors.push("NOTION_API_TOKEN secret not resolved — cannot sync to Notion Knowledge DB.");
  }

  const syncedCount = result.synced.length;
  const errorCount = result.errors.length;
  result.data = {
    syncedCount,
    errorCount,
    documentsRead: docs.map((d) => ({ title: d.title, contentLength: d.fileContent.length })),
    syncedDetails: result.synced,
  };

  const summaryParts: string[] = [];
  if (syncedCount > 0) {
    summaryParts.push(`Successfully synced ${syncedCount} platform doctrine document(s) to Notion Knowledge DB:`);
    summaryParts.push(result.synced.map((s) => `- **${s.title}**: ${s.pageUrl || s.pageId}`).join("\n"));
  }
  if (errorCount > 0) {
    summaryParts.push(`Errors (${errorCount}):`);
    summaryParts.push(result.errors.join("\n"));
  }
  if (summaryParts.length === 0) {
    summaryParts.push("No documents synced — check NOTION_API_TOKEN secret configuration.");
    summaryParts.push(`Read ${docs.length} document(s) from repo:`);
    summaryParts.push(docs.map((d) => `- **${d.title}**: ${d.fileContent.length} chars`).join("\n"));
  }
  result.issueComment = summaryParts.join("\n\n");
  result.outcome = errorCount === 0 ? "done" : "partial";
  result.success = syncedCount > 0;
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

  if (event === "push") {
    const ref = asString(payload.ref) ?? "";
    const branch = ref.replace("refs/heads/", "");
    const deleted = Boolean(payload.deleted);
    const afterSha = asString(payload.after) ?? "";
    const zeroSha = /^0+$/.test(afterSha);
    const headCommit = payload.head_commit && typeof payload.head_commit === "object"
      ? payload.head_commit as Record<string, unknown>
      : null;
    const compareUrl = asString(payload.compare);
    const commitRecords = Array.isArray(payload.commits)
      ? payload.commits.filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === "object")
      : [];
    const commitMessages = commitRecords
      .map((entry) => asString(entry.message)?.split("\n")[0] ?? null)
      .filter((entry): entry is string => Boolean(entry));
    const changedFiles = [...new Set(
      commitRecords.flatMap((entry) => [
        ...toStringArray(entry.added),
        ...toStringArray(entry.modified),
        ...toStringArray(entry.removed),
      ]),
    )];

    if (!deleted && !zeroSha && branch === repoConfig.defaultBranch && (headCommit || commitMessages.length > 0)) {
      const shipSpec = buildShipBroadcastIssueSpec({
        repoKey: repoConfig.key,
        repoName: repoConfig.githubRepo,
        projectName: repoConfig.projectName,
        branch,
        afterSha,
        compareUrl,
        headCommitMessage: asString(headCommit?.message) ?? null,
        commitMessages,
        changedFiles,
        owner: getCommunityUpdatesAgentKey(config),
      });

      await upsertManagedIssue(ctx, {
        companyId,
        sourceType: "github-ship-broadcast",
        sourceId: shipSpec.sourceId,
        title: shipSpec.title,
        description: shipSpec.description,
        projectName: "blueprint-webapp",
        assignee: getCommunityUpdatesAgentKey(config),
        priority: "high",
        status: "todo",
        signalUrl: compareUrl ?? undefined,
        metadata: {
          kind: "ship_broadcast",
          repoKey: repoConfig.key,
          repoName: repoConfig.githubRepo,
          sourceProjectName: repoConfig.projectName,
          branch,
          afterSha,
          compareUrl,
          commitMessages,
          changedFiles: changedFiles.slice(0, 50),
          assetKey: shipSpec.assetKey,
          contentBrief: shipSpec.brief,
          channels: shipSpec.channels,
        },
        comment: "Draft the ship broadcast package and keep the claims anchored to the merged proof only.",
      });

      await appendRecentEvent(ctx, companyId, {
        kind: "github-ship-broadcast",
        title: `Ship broadcast opened for ${repoConfig.githubRepo}`,
        detail: shipSpec.title,
      });
      return { handled: true, event, repoName };
    }
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
  const [allIssues, agents, projects] = await Promise.all([
    listAllIssues(ctx, companyId),
    listAgents(ctx, companyId),
    listProjects(ctx, companyId),
  ]);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
  const issuesWithProjectName = allIssues.map((issue) => ({
    ...issue,
    projectName: issue.projectId ? (projectNameById.get(issue.projectId) ?? null) : null,
  }));
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
  const handoffAnalytics = await buildHandoffState(ctx, companyId, issuesWithProjectName, agents);

  return {
    companyId,
    companyName: (company as unknown as Record<string, unknown>).name as string,
    pluginId: PLUGIN_ID,
    lastScan,
    recentEvents,
    handoffAnalytics,
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

  ctx.actions.register(ACTION_KEYS.repairRouting, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await repairManagedIssueRouting(ctx, company.id, config);
  });

  ctx.actions.register(ACTION_KEYS.managerState, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await buildChiefOfStaffState(ctx, company.id, config);
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

  ctx.actions.register(ACTION_KEYS.communityUpdatesReport, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await buildCommunityUpdatesOutputProof(ctx, config, company.id, params);
  });

  ctx.actions.register(ACTION_KEYS.customerResearchReport, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await buildCustomerResearchOutputProof(ctx, config, company.id, params);
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

  ctx.actions.register(ACTION_KEYS.syncPlatformDoctrine, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await syncPlatformDoctrineToKnowledge(ctx, config, company.id, params);
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
    TOOL_NAMES.managerState,
    {
      displayName: "Blueprint Manager State",
      description:
        "Read the current chief-of-staff operating snapshot across issue state, recent completions, stale work, routine health, and active agent status.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
        },
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const snapshot = await buildChiefOfStaffState(ctx, company.id, config);
      const classificationLine = snapshot.runClassification === "no_op"
        ? "RUN CLASSIFICATION: NO-OP. No actionable work found. End this run without heavyweight processing."
        : snapshot.runClassification === "low_value"
          ? "RUN CLASSIFICATION: LOW-VALUE. Only maintenance items present. Keep processing lightweight."
          : "RUN CLASSIFICATION: ACTIONABLE. Real work available — proceed with full processing.";
      return {
        content: [
          classificationLine,
          `Chief of staff state: ${snapshot.summary.openIssueCount} open issues, ${snapshot.summary.blockedIssueCount} blocked, ${snapshot.summary.staleIssueCount} stale, ${snapshot.summary.recentlyCompletedCount} recently completed, ${snapshot.summary.routineAlertCount} routine alerts.`,
          `Daily accountability: ${snapshot.dailyAccountability.materiallyActiveAgentCount} materially active agent(s), ${snapshot.dailyAccountability.lowValueAgentCount} low/no-value agent(s), ${snapshot.dailyAccountability.agentsRan.length} agent(s) with issue/comment evidence in the last 24h.`,
          `Founder visibility: ${snapshot.founderVisibility.needsFounderItems.length} waiting on founder, ${snapshot.founderVisibility.blockedOver24h.length} blocked >24h, ${snapshot.founderVisibility.queueAlerts.length} queue alert(s), ${snapshot.founderVisibility.experimentOutcomes.length} recent experiment outcome(s).`,
          ...snapshot.nextActionHints.slice(0, 5).map((hint) => `- ${hint}`),
        ].join("\n"),
        data: snapshot,
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
          issueId: { type: "string" },
          sourceType: { type: "string" },
          sourceId: { type: "string" },
          resolutionStatus: { type: "string" },
          comment: { type: "string" },
        },
        required: ["resolutionStatus", "comment"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      const issueId = asString((params as Record<string, unknown>).issueId);
      if (issueId) {
        const resolutionStatus =
          asString((params as Record<string, unknown>).resolutionStatus) === "cancelled"
            ? "cancelled"
            : asString((params as Record<string, unknown>).resolutionStatus) === "blocked"
              ? "blocked"
              : "done";
        const issue = await ctx.issues.get(issueId, company.id);
        if (!issue) {
          return {
            content: `No issue found for ${issueId}.`,
            data: { issueId, resolved: false },
          };
        }
        await ctx.issues.createComment(
          issue.id,
          asString((params as Record<string, unknown>).comment) ?? "Resolved by Blueprint automation tool.",
          company.id,
        );
        if (issue.status !== resolutionStatus) {
          await ctx.issues.update(issue.id, { status: resolutionStatus }, company.id);
        }
        return {
          content: `Resolved issue ${issue.id} by direct issue reference.`,
          data: { issueId: issue.id, resolved: true, resolutionStatus },
        };
      }
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
          followUpIssues: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["blocker", "owner_ready"] },
                title: { type: "string" },
                description: { type: "string" },
                projectName: { type: "string" },
                assignee: { type: "string" },
                priority: { type: "string" },
              },
              required: ["kind", "title", "description", "projectName", "assignee"],
            },
          },
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
      const issueId = asString((params as Record<string, unknown>).issueId);
      if (issueId) {
        try {
          await finalizeIssueWithProof(ctx, company.id, {
            issueId,
            issueComment: report.issueComment,
            outcome: report.outcome,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          report.errors.push(`Issue finalization failed: ${message}`);
          report.success = false;
          report.outcome = "blocked";
          report.failureReason = [report.failureReason, message].filter(Boolean).join(" ");
        }
      }
      return {
        content: report.success
          ? `Generated ${cadence} analytics report with Notion and Slack outputs.`
          : `Analytics report writer blocked: ${report.failureReason || report.errors.join("; ") || "unknown error"}.`,
        data: report,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.communityUpdatesReport,
    {
      displayName: "Generate Community Updates Report",
      description:
        "Create a deterministic Blueprint community update draft, write required proof artifacts, and return the issue closeout payload.",
      parametersSchema: {
        type: "object",
        properties: {
          cadence: { type: "string", enum: ["weekly", "ad_hoc"] },
          companyName: { type: "string" },
          issueId: { type: "string" },
          assetKey: { type: "string" },
          assetType: { type: "string" },
          channels: { type: "array", items: { type: "string" } },
          contentBrief: { type: "object" },
          sourceIssueIds: { type: "array", items: { type: "string" } },
          sourceEvidence: { type: "array", items: { type: "string" } },
          proofLinks: { type: "array", items: { type: "string" } },
          allowedClaims: { type: "array", items: { type: "string" } },
          blockedClaims: { type: "array", items: { type: "string" } },
          callToAction: { type: "string" },
          audience: { type: "string" },
          wedge: { type: "string" },
          owner: { type: "string" },
          headline: { type: "string" },
          shippedThisWeek: { type: "array", items: { type: "string" } },
          byTheNumbers: { type: "array", items: { type: "string" } },
          whatWeLearned: { type: "array", items: { type: "string" } },
          whatIsNext: { type: "array", items: { type: "string" } },
        },
        required: [
          "cadence",
          "headline",
          "shippedThisWeek",
          "whatWeLearned",
          "whatIsNext",
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
        asString((params as Record<string, unknown>).cadence) === "ad_hoc"
          ? "ad_hoc"
          : "weekly";
      const report = await buildCommunityUpdatesOutputProof(
        ctx,
        config,
        company.id,
        params as Record<string, unknown>,
      );
      const issueId = asString((params as Record<string, unknown>).issueId);
      if (issueId) {
        try {
          await finalizeIssueWithProof(ctx, company.id, {
            issueId,
            issueComment: report.issueComment,
            outcome: report.outcome,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          report.errors.push(`Issue finalization failed: ${message}`);
          report.success = false;
          report.outcome = "blocked";
          report.failureReason = [report.failureReason, message].filter(Boolean).join(" ");
        }
      }
      return {
        content: report.success
          ? `Generated ${cadence === "weekly" ? "weekly" : "ad hoc"} community update draft with proof artifacts.`
          : `Community update writer blocked: ${report.failureReason || report.errors.join("; ") || "unknown error"}.`,
        data: report,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.recordContentOutcomeReview,
    {
      displayName: "Record Content Outcome Review",
      description:
        "Store a structured outcome review for a content asset, attach it to the linked Paperclip issue, and keep the learning available for future growth and creative cycles.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          issueId: { type: "string" },
          assetKey: { type: "string" },
          assetType: { type: "string" },
          channels: { type: "array", items: { type: "string" } },
          summary: { type: "string" },
          whatWorked: { type: "array", items: { type: "string" } },
          whatDidNot: { type: "array", items: { type: "string" } },
          nextRecommendation: { type: "string" },
          evidenceSource: { type: "string" },
          confidence: { type: "number" },
          recordedBy: { type: "string" },
        },
        required: [
          "assetKey",
          "summary",
          "evidenceSource",
        ],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const recordedAt = nowIso();
      const review = normalizeContentOutcomeReview(
        params as Record<string, unknown>,
        recordedAt,
      );
      await persistContentOutcomeReview(ctx, company.id, review);

      const issueId = asString((params as Record<string, unknown>).issueId);
      if (issueId) {
        await ctx.issues.createComment(
          issueId,
          formatContentOutcomeReviewIssueComment(review),
          company.id,
        ).catch(() => undefined);
      }

      return {
        content: `Recorded content outcome review for ${review.assetKey}.`,
        data: review,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.queueOperatorReadyShipBroadcasts,
    {
      displayName: "Queue Operator-Ready Ship Broadcasts",
      description:
        "Queue fresh SendGrid ship-broadcast drafts for human approval when they meet the narrow operator-ready rule set.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          limit: { type: "number" },
        },
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const limit = Math.max(
        1,
        Math.min(asNumber((params as Record<string, unknown>).limit) ?? 10, 25),
      );
      const result = await queueOperatorReadyShipBroadcasts(ctx, company.id, limit);
      return {
        content: `Evaluated ${result.count} ship-broadcast assets for operator-ready queueing.`,
        data: result,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.customerResearchSearch,
    {
      displayName: "Customer Research Search",
      description:
        "Run source-targeted customer research search queries for transcripts, reviews, forums, and community evidence.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
        },
        required: ["query"],
      },
    },
    async (params): Promise<ToolResult> => {
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
      if (!searchApiKey) {
        throw new Error("Customer research search requires SEARCH_API_KEY to be configured.");
      }
      const searchTools = buildWebSearchToolHandler({
        apiKey: searchApiKey,
        provider: searchApiProvider,
      });
      const result = await runCustomerResearchSearch(
        asString((params as Record<string, unknown>).query) ?? "",
        Array.isArray((params as Record<string, unknown>).sources)
          ? ((params as Record<string, unknown>).sources as string[])
          : undefined,
        async (query) => await searchTools[TOOL_NAMES.webSearch]({ query }),
      );
      return {
        content: `Customer research search completed across ${result.results.length} source-specific queries.`,
        data: result,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.customerResearchSynthesize,
    {
      displayName: "Customer Research Synthesize",
      description:
        "Normalize customer research evidence into JTBD, personas, objections, and confidence without writing artifacts.",
      parametersSchema: {
        type: "object",
        properties: {
          evidence: { type: "array", items: { type: "object" } },
        },
        required: ["evidence"],
      },
    },
    async (params): Promise<ToolResult> => {
      const synthesis = synthesizeCustomerResearch(
        (params as Record<string, unknown>).evidence,
      );
      return {
        content: `Synthesized ${synthesis.evidence.length} evidence items into ${synthesis.jtbd.length} JTBD items and ${synthesis.personas.length} personas.`,
        data: synthesis,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.customerResearchReport,
    {
      displayName: "Generate Customer Research Report",
      description:
        "Write a customer research artifact to Notion, post the Slack digest, and return the proof/comment payload for issue completion.",
      parametersSchema: {
        type: "object",
        properties: {
          cadence: { type: "string", enum: ["daily", "weekly", "ad_hoc"] },
          companyName: { type: "string" },
          issueId: { type: "string" },
          topic: { type: "string" },
          lane: { type: "string" },
          headline: { type: "string" },
          evidence: { type: "array", items: { type: "object" } },
          recommendedActions: { type: "array", items: { type: "string" } },
        },
        required: ["topic", "headline", "evidence", "recommendedActions"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const report = await buildCustomerResearchOutputProof(
        ctx,
        config,
        company.id,
        params as Record<string, unknown>,
      );
      const issueId = asString((params as Record<string, unknown>).issueId);
      if (issueId) {
        try {
          await finalizeIssueWithProof(ctx, company.id, {
            issueId,
            issueComment: report.issueComment,
            outcome: report.outcome,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          report.errors.push(`Issue finalization failed: ${message}`);
          report.success = false;
          report.outcome = "blocked";
          report.failureReason = [report.failureReason, message].filter(Boolean).join(" ");
        }
      }
      return {
        content: report.success
          ? "Generated customer research report with Notion and Slack outputs."
          : `Customer research report blocked: ${report.failureReason || report.errors.join("; ") || "unknown error"}.`,
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
      const issueId = asString((params as Record<string, unknown>).issueId);
      if (issueId) {
        try {
          await finalizeIssueWithProof(ctx, company.id, {
            issueId,
            issueComment: report.issueComment,
            outcome: report.outcome,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          report.errors.push(`Issue finalization failed: ${message}`);
          report.success = false;
          report.outcome = "blocked";
          report.failureReason = [report.failureReason, message].filter(Boolean).join(" ");
        }
      }
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
      const issueId = asString((params as Record<string, unknown>).issueId);
      if (issueId) {
        try {
          await finalizeIssueWithProof(ctx, company.id, {
            issueId,
            issueComment: report.issueComment,
            outcome: report.outcome,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          report.errors.push(`Issue finalization failed: ${message}`);
          report.success = false;
          report.outcome = "blocked";
          report.failureReason = [report.failureReason, message].filter(Boolean).join(" ");
        }
      }
      return {
        content: report.success
          ? `Generated ${cadence} market intel report with Notion and Slack outputs.`
          : `Market intel report writer blocked: ${report.failureReason || report.errors.join("; ") || "unknown error"}.`,
        data: report,
      };
    },
  );


  ctx.tools.register(
    TOOL_NAMES.firehoseReadSignals,
    {
      displayName: "Firehose Read Signals",
      description: "Read, normalize, dedupe, and cache Firehose signals through the Blueprint ingest bridge.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          topics: { type: "array", items: { type: "string" } },
          limit: { type: "number" },
          since: { type: "string" },
        },
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      const firehoseConfig = await resolveFirehoseConfig(ctx, config);
      if (!firehoseConfig) {
        throw new Error("Firehose adapter is not configured. Set firehoseBaseUrl and firehoseApiTokenRef.");
      }
      const result = await fetchFirehoseSignals(firehoseConfig, {
        query: asString((params as Record<string, unknown>).query),
        topics: Array.isArray((params as Record<string, unknown>).topics)
          ? ((params as Record<string, unknown>).topics as string[])
          : undefined,
        limit: asNumber((params as Record<string, unknown>).limit),
        since: asString((params as Record<string, unknown>).since),
      });
      const existing = await readState<FirehoseSignalCacheState>(
        ctx,
        company.id,
        STATE_KEYS.firehoseSignalCache,
      );
      const cache = mergeFirehoseSignalCache(
        existing,
        result.signals,
        firehoseConfig.maxSignalsPerRead ?? 100,
      );
      await writeState(ctx, company.id, STATE_KEYS.firehoseSignalCache, cache);
      return {
        content: `Loaded ${result.count} Firehose signals and updated the Blueprint cache.`,
        data: { ...result, cacheUpdatedAt: cache.updatedAt },
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.firehoseReadBrief,
    {
      displayName: "Firehose Read Brief",
      description: "Read a summarized brief from cached or freshly fetched Firehose signals.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          topics: { type: "array", items: { type: "string" } },
          limit: { type: "number" },
          since: { type: "string" },
          refresh: { type: "boolean" },
        },
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      const firehoseConfig = await resolveFirehoseConfig(ctx, config);
      if (!firehoseConfig) {
        throw new Error("Firehose adapter is not configured. Set firehoseBaseUrl and firehoseApiTokenRef.");
      }
      const query = asString((params as Record<string, unknown>).query);
      const shouldRefresh = (params as Record<string, unknown>).refresh === true;
      const existing = await readState<FirehoseSignalCacheState>(
        ctx,
        company.id,
        STATE_KEYS.firehoseSignalCache,
      );
      let signals = existing?.signals ?? [];
      if (shouldRefresh || signals.length === 0) {
        const refreshed = await fetchFirehoseSignals(firehoseConfig, {
          query,
          topics: Array.isArray((params as Record<string, unknown>).topics)
            ? ((params as Record<string, unknown>).topics as string[])
            : undefined,
          limit: asNumber((params as Record<string, unknown>).limit),
          since: asString((params as Record<string, unknown>).since),
        });
        const cache = mergeFirehoseSignalCache(
          existing,
          refreshed.signals,
          firehoseConfig.maxSignalsPerRead ?? 100,
        );
        await writeState(ctx, company.id, STATE_KEYS.firehoseSignalCache, cache);
        signals = cache.signals;
      }
      const brief = buildFirehoseBrief(signals, query);
      return {
        content: brief.headline,
        data: brief,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.introwSearchPartners,
    {
      displayName: "Introw Search Partners",
      description: "Search Introw partners through the Blueprint-owned adapter.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          workspace: { type: "string" },
        },
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const introwConfig = await resolveIntrowConfig(ctx, config);
      if (!introwConfig) {
        throw new Error("Introw adapter is not configured. Set introwBaseUrl and introwApiTokenRef.");
      }
      const result = await searchIntrowPartners(
        introwConfig,
        params as Record<string, unknown>,
      );
      return {
        content: `Loaded ${result.count} Introw partner matches.`,
        data: result,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.introwReadAccount,
    {
      displayName: "Introw Read Account",
      description: "Read an Introw account through the Blueprint-owned adapter.",
      parametersSchema: {
        type: "object",
        properties: {
          accountId: { type: "string" },
        },
        required: ["accountId"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const introwConfig = await resolveIntrowConfig(ctx, config);
      if (!introwConfig) {
        throw new Error("Introw adapter is not configured. Set introwBaseUrl and introwApiTokenRef.");
      }
      const account = await readIntrowAccount(
        introwConfig,
        asString((params as Record<string, unknown>).accountId) ?? "",
      );
      return {
        content: `Loaded Introw account ${account.name} (${account.id}).`,
        data: account,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.introwCreatePartnerDraft,
    {
      displayName: "Introw Create Partner Draft",
      description: "Create a draft partner record in Introw. Live partner activation is blocked centrally.",
      parametersSchema: {
        type: "object",
        properties: {
          name: { type: "string" },
          workspace: { type: "string" },
          notes: { type: "string" },
          accountId: { type: "string" },
          status: { type: "string" },
        },
        required: ["name"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const introwConfig = await resolveIntrowConfig(ctx, config);
      if (!introwConfig) {
        throw new Error("Introw adapter is not configured. Set introwBaseUrl and introwApiTokenRef.");
      }
      const partner = await createIntrowPartnerDraft(
        introwConfig,
        params as Record<string, unknown>,
      );
      return {
        content: `Created Introw partner draft ${partner.name} (${partner.id}).`,
        data: partner,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.introwUpdatePartnerDraft,
    {
      displayName: "Introw Update Partner Draft",
      description: "Update a draft partner record in Introw. Live partner activation is blocked centrally.",
      parametersSchema: {
        type: "object",
        properties: {
          partnerId: { type: "string" },
          workspace: { type: "string" },
          notes: { type: "string" },
          accountId: { type: "string" },
          status: { type: "string" },
        },
        required: ["partnerId"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const introwConfig = await resolveIntrowConfig(ctx, config);
      if (!introwConfig) {
        throw new Error("Introw adapter is not configured. Set introwBaseUrl and introwApiTokenRef.");
      }
      const partner = await updateIntrowPartnerDraft(
        introwConfig,
        asString((params as Record<string, unknown>).partnerId) ?? "",
        params as Record<string, unknown>,
      );
      return {
        content: `Updated Introw partner draft ${partner.name} (${partner.id}).`,
        data: partner,
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
    const company = await findCompany(ctx, config.companyName);
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
              businessLane: { type: "string" },
              needsFounder: { type: "boolean" },
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
              businessLane: { type: "string" },
              lifecycleStage: { type: "string" },
              workType: { type: "string" },
              substage: { type: "string" },
              needsFounder: { type: "boolean" },
              lastStatusChange: { type: "string" },
              escalateAfter: { type: "string" },
            },
            required: ["title", "priority", "system"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionWriteWorkQueue](params as any);
          await syncNotionDriftAssessment(
            ctx,
            company.id,
            assessNotionDrift(TOOL_NAMES.notionWriteWorkQueue, params as Record<string, unknown>, result as Record<string, unknown>),
          );
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
              artifactType: { type: "string" },
              lifecycleStage: { type: "string" },
              agentSurfaces: { type: "array", items: { type: "string" } },
            },
            required: ["title", "type", "content"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionWriteKnowledge](params as any);
          await syncNotionDriftAssessment(
            ctx,
            company.id,
            assessNotionDrift(TOOL_NAMES.notionWriteKnowledge, params as Record<string, unknown>, result as Record<string, unknown>),
          );
          return { content: `Created knowledge entry ${result.pageId}.`, data: result };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionSearchPages,
        {
          displayName: "Search Notion Pages",
          description: "Search Blueprint-managed Notion pages, optionally within a Hub database or for stale knowledge entries.",
          parametersSchema: {
            type: "object",
            properties: {
              database: { type: "string", enum: ["work_queue", "knowledge", "skills"] },
              query: { type: "string" },
              title: { type: "string" },
              limit: { type: "number" },
              staleOnly: { type: "boolean" },
            },
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionSearchPages](params as any);
          return { content: `Found ${result.count} matching Notion pages.`, data: result };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionFetchPage,
        {
          displayName: "Fetch Notion Page",
          description: "Fetch a Blueprint-managed Notion page with metadata and a short block preview.",
          parametersSchema: {
            type: "object",
            properties: {
              pageId: { type: "string" },
            },
            required: ["pageId"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionFetchPage](params as any);
          return { content: `Fetched Notion page ${(result as any).page.id}.`, data: result };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionUpsertKnowledge,
        {
          displayName: "Upsert Notion Knowledge",
          description: "Create or update a Blueprint Knowledge page using a stable natural key and optional duplicate archival.",
          parametersSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              type: { type: "string" },
              system: { type: "string" },
              artifactType: { type: "string" },
              content: { type: "string" },
              canonicalSource: { type: "string" },
              lastReviewed: { type: "string" },
              reviewCadence: { type: "string" },
              lifecycleStage: { type: "string" },
              substage: { type: "string" },
              sourceOfTruth: { type: "string" },
              naturalKey: { type: "string" },
              archiveDuplicates: { type: "boolean" },
              ownerIds: { type: "array", items: { type: "string" } },
              relatedWorkPageIds: { type: "array", items: { type: "string" } },
              relatedWorkPageUrls: { type: "array", items: { type: "string" } },
              relatedSkillPageIds: { type: "array", items: { type: "string" } },
              relatedSkillPageUrls: { type: "array", items: { type: "string" } },
              agentSurfaces: { type: "array", items: { type: "string" } },
            },
            required: ["title", "type", "content"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionUpsertKnowledge](params as any);
          await syncNotionDriftAssessment(
            ctx,
            company.id,
            assessNotionDrift(TOOL_NAMES.notionUpsertKnowledge, params as Record<string, unknown>, result as Record<string, unknown>),
          );
          return {
            content: `${result.status === "created" ? "Created" : "Updated"} knowledge entry ${result.pageId}.`,
            data: result,
          };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionUpsertWorkQueue,
        {
          displayName: "Upsert Notion Work Queue",
          description: "Create or update a Blueprint Work Queue page using a stable natural key and optional duplicate archival.",
          parametersSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              priority: { type: "string" },
              system: { type: "string" },
              businessLane: { type: "string" },
              lifecycleStage: { type: "string" },
              workType: { type: "string" },
              substage: { type: "string" },
              outputLocation: { type: "string" },
              executionSurface: { type: "string" },
              dueDate: { type: "string" },
              needsFounder: { type: "boolean" },
              lastStatusChange: { type: "string" },
              escalateAfter: { type: "string" },
              naturalKey: { type: "string" },
              archiveDuplicates: { type: "boolean" },
              ownerIds: { type: "array", items: { type: "string" } },
              requestedByIds: { type: "array", items: { type: "string" } },
              relatedDocPageIds: { type: "array", items: { type: "string" } },
              relatedDocPageUrls: { type: "array", items: { type: "string" } },
              relatedSkillPageIds: { type: "array", items: { type: "string" } },
              relatedSkillPageUrls: { type: "array", items: { type: "string" } },
            },
            required: ["title", "priority", "system"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionUpsertWorkQueue](params as any);
          await syncNotionDriftAssessment(
            ctx,
            company.id,
            assessNotionDrift(TOOL_NAMES.notionUpsertWorkQueue, params as Record<string, unknown>, result as Record<string, unknown>),
          );
          return {
            content: `${result.status === "created" ? "Created" : "Updated"} work queue item ${result.pageId}.`,
            data: result,
          };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionUpdatePageMetadata,
        {
          displayName: "Update Notion Page Metadata",
          description: "Repair metadata, ownership, freshness fields, and relations on a Blueprint-managed Notion page.",
          parametersSchema: {
            type: "object",
            properties: {
              pageId: { type: "string" },
              database: { type: "string", enum: ["work_queue", "knowledge", "skills"] },
              businessLane: { type: "string" },
              needsFounder: { type: "boolean" },
              lastStatusChange: { type: "string" },
              escalateAfter: { type: "string" },
              artifactType: { type: "string" },
              agentSurfaces: { type: "array", items: { type: "string" } },
              lifecycleStage: { type: "string" },
              substage: { type: "string" },
              outputLocation: { type: "string" },
              executionSurface: { type: "string" },
              dueDate: { type: "string" },
              ownerIds: { type: "array", items: { type: "string" } },
              requestedByIds: { type: "array", items: { type: "string" } },
              relatedDocPageIds: { type: "array", items: { type: "string" } },
              relatedDocPageUrls: { type: "array", items: { type: "string" } },
              relatedSkillPageIds: { type: "array", items: { type: "string" } },
              relatedSkillPageUrls: { type: "array", items: { type: "string" } },
              relatedWorkPageIds: { type: "array", items: { type: "string" } },
              relatedWorkPageUrls: { type: "array", items: { type: "string" } },
              reviewCadence: { type: "string" },
              lastReviewed: { type: "string" },
              canonicalSource: { type: "string" },
              sourceOfTruth: { type: "string" },
            },
            required: ["pageId", "database"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionUpdatePageMetadata](params as any);
          await syncNotionDriftAssessment(
            ctx,
            company.id,
            assessNotionDrift(TOOL_NAMES.notionUpdatePageMetadata, params as Record<string, unknown>, result as Record<string, unknown>),
          );
          return { content: `Updated metadata for Notion page ${result.pageId}.`, data: result };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionMovePage,
        {
          displayName: "Move Notion Page",
          description: "Move a Blueprint-managed page into the correct Hub database by recreating it there and optionally archiving the source page.",
          parametersSchema: {
            type: "object",
            properties: {
              pageId: { type: "string" },
              targetDatabase: { type: "string", enum: ["work_queue", "knowledge", "skills"] },
              archiveOriginal: { type: "boolean" },
              preserveContent: { type: "boolean" },
              metadata: { type: "object" },
            },
            required: ["pageId", "targetDatabase"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionMovePage](params as any);
          return { content: `Moved Notion page to ${result.targetPageId}.`, data: result };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionArchivePage,
        {
          displayName: "Archive Notion Page",
          description: "Archive a Blueprint-managed Notion page when a duplicate or obsolete page is safe to retire.",
          parametersSchema: {
            type: "object",
            properties: {
              pageId: { type: "string" },
            },
            required: ["pageId"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionArchivePage](params as any);
          return { content: `Archived Notion page ${result.pageId}.`, data: result };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionCommentPage,
        {
          displayName: "Comment On Notion Page",
          description: "Leave a reconciliation or escalation comment on a Blueprint-managed Notion page.",
          parametersSchema: {
            type: "object",
            properties: {
              pageId: { type: "string" },
              comment: { type: "string" },
            },
            required: ["pageId", "comment"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionCommentPage](params as any);
          return { content: `Commented on Notion page ${(params as any).pageId}.`, data: result };
        },
      );

      ctx.tools.register(
        TOOL_NAMES.notionReconcileRelations,
        {
          displayName: "Reconcile Notion Relations",
          description: "Repair related work, related docs, related skills, ownership, and freshness metadata on a Blueprint-managed Notion page.",
          parametersSchema: {
            type: "object",
            properties: {
              pageId: { type: "string" },
              database: { type: "string", enum: ["work_queue", "knowledge", "skills"] },
              ownerIds: { type: "array", items: { type: "string" } },
              requestedByIds: { type: "array", items: { type: "string" } },
              relatedWorkPageIds: { type: "array", items: { type: "string" } },
              relatedWorkPageUrls: { type: "array", items: { type: "string" } },
              relatedDocPageIds: { type: "array", items: { type: "string" } },
              relatedDocPageUrls: { type: "array", items: { type: "string" } },
              relatedSkillPageIds: { type: "array", items: { type: "string" } },
              relatedSkillPageUrls: { type: "array", items: { type: "string" } },
              reviewCadence: { type: "string" },
              lastReviewed: { type: "string" },
              canonicalSource: { type: "string" },
              sourceOfTruth: { type: "string" },
              lifecycleStage: { type: "string" },
              outputLocation: { type: "string" },
              executionSurface: { type: "string" },
              substage: { type: "string" },
            },
            required: ["pageId", "database"],
          },
        },
        async (params): Promise<ToolResult> => {
          const result = await notionTools[TOOL_NAMES.notionReconcileRelations](params as any);
          await syncNotionDriftAssessment(
            ctx,
            company.id,
            assessNotionDrift(TOOL_NAMES.notionReconcileRelations, params as Record<string, unknown>, result as Record<string, unknown>),
          );
          return { content: `Reconciled relations for Notion page ${result.pageId}.`, data: result };
        },
      );
    }
  } catch {
    // Notion token not configured — tools will not be available
  }

  // ── Slack Tools ───────────────────────────────────────
  try {
    const config = await getConfig(ctx);
    const slackTargets = await resolveSlackTargets(ctx, config);
    if (
      slackTargets.default
      || slackTargets.ops
      || slackTargets.growth
      || slackTargets.exec
      || slackTargets.engineering
      || slackTargets.manager
    ) {
      const slackTools = buildSlackToolHandler(slackTargets);
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
  const preReconcileResult = await runNotionQueueReconcileJob(ctx, companyId);
  const workQueueItems = collapseWorkQueueItemsByNaturalKey(
    await queryWorkQueue(notionClient, {}),
  );
  const [sourceMappings, issues] = await Promise.all([
    listSourceMappings(ctx, companyId),
    listAllIssues(ctx, companyId),
  ]);
  const notionQueueAliases = buildNotionQueueAliasMap(sourceMappings, issues);
  let synced = 0;

  for (const item of workQueueItems) {
    const queueKey = canonicalWorkQueueScanKey(item);
    const mappedAlias = notionQueueAliases.get(queueKey);
    const assignee = routeWorkQueueAssignee(item, config);
    const sourceId = mappedAlias?.data.sourceId ?? queueKey;
    const issueStatus = mapWorkQueueLifecycleStageToIssueStatus(item.lifecycleStage);

    if (isStaleAnalyticsSnapshotQueueItem(item)) {
      const snapshot = extractAnalyticsSnapshotDate(item.title);
      await resolveManagedIssue(ctx, {
        companyId,
        sourceType: "notion-work-queue",
        sourceId,
        resolutionStatus: "done",
        comment: snapshot
          ? `Notion queue scan closed this stale analytics snapshot thread because ${snapshot.date} is before the current local queue date.`
          : "Notion queue scan closed this stale analytics snapshot thread.",
      });
      continue;
    }

    if (issueStatus === "done") {
      await resolveManagedIssue(ctx, {
        companyId,
        sourceType: "notion-work-queue",
        sourceId,
        resolutionStatus: "done",
        comment: `Notion queue scan closed this work item because its Lifecycle Stage is ${item.lifecycleStage || "Done"}.`,
      });
      continue;
    }

    await upsertManagedIssue(ctx, {
      companyId,
      sourceType: "notion-work-queue",
      sourceId,
      title: `Notion Work Queue: ${item.title}`,
      description: [
        "Blueprint automation synced this Notion Work Queue item into Paperclip for active triage.",
        "",
        `- Notion page: ${item.url ?? item.id}`,
        `- Canonical queue key: ${sourceId}`,
        `- System: ${item.system}`,
        `- Priority: ${item.priority}`,
        `- Lifecycle Stage: ${item.lifecycleStage || "unknown"}`,
        `- Work Type: ${item.workType || "unknown"}`,
      ].join("\n"),
      projectName: mapQueueSystemToProject(item.system),
      assignee,
      priority: mapQueuePriority(item.priority),
      status: issueStatus,
      signalUrl: item.url,
      metadata: {
        system: item.system,
        priority: item.priority,
        lifecycleStage: item.lifecycleStage,
        workType: item.workType,
      },
      comment: `Synced from Notion Work Queue scan and routed to ${assignee}.`,
      suppressRefreshComment: true,
    });
    synced += 1;
  }

  await appendRecentEvent(ctx, companyId, {
    kind: "ops-queue-scan",
    title: "Ops queue scan completed",
    detail: `Synced ${synced} Notion work queue items after cancelling ${preReconcileResult.cancelledCount} duplicate queue issues at ${nowIso()}`,
  });

  return {
    synced,
    skipped: false,
    reconciledDuplicateIssues: preReconcileResult.cancelledCount,
  };
}

async function runNotionQueueReconcileJob(
  ctx: PluginContext,
  companyId: string,
) {
  const sourceMappings = await listSourceMappings(ctx, companyId);
  const candidates = (
    await Promise.all(sourceMappings.map(async (mapping) => {
      const data = (mapping.data ?? {}) as Partial<SourceMappingData>;
      const issueId = typeof data.issueId === "string" ? data.issueId : null;
      const issue = issueId ? await ctx.issues.get(issueId, companyId).catch(() => null) : null;
      return toNotionQueueDuplicateCandidate(mapping, issue);
    }))
  ).filter((value): value is NotionQueueDuplicateCandidate => Boolean(value));

  const groups = new Map<string, NotionQueueDuplicateCandidate[]>();
  for (const candidate of candidates) {
    const existing = groups.get(candidate.queueKey) ?? [];
    existing.push(candidate);
    groups.set(candidate.queueKey, existing);
  }

  let cancelledCount = 0;
  const keptIssueIds: string[] = [];
  const cancelledIssueIds: string[] = [];

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const ranked = [...group].sort(compareNotionQueueDuplicateCandidates);
    const keeper = ranked[0];
    if (!keeper) continue;

    const duplicates = ranked.slice(1).filter((entry) => entry.issue.status !== "cancelled");
    if (duplicates.length === 0) continue;

    keptIssueIds.push(keeper.issue.id);

    for (const duplicate of duplicates) {
      await ctx.issues.update(
        duplicate.issue.id,
        { status: "cancelled" },
        companyId,
      );
      await ctx.issues.createComment(
        duplicate.issue.id,
        [
          "One-time Notion queue reconciliation cancelled this duplicate Paperclip issue.",
          `- Canonical issue: ${keeper.issue.id}`,
          `- Canonical queue key: ${keeper.queueKey}`,
          `- Duplicate source id: ${duplicate.data.sourceId}`,
          `- Canonical source id: ${keeper.data.sourceId}`,
        ].join("\n"),
        companyId,
      ).catch(() => undefined);

      await upsertMapping(
        ctx,
        companyId,
        duplicate.data.fingerprint,
        duplicate.mapping.title ?? duplicate.issue.title,
        "cancelled",
        {
          ...duplicate.data,
          resolutionStatus: "cancelled",
          lastSeenAt: nowIso(),
        },
      );

      cancelledCount += 1;
      cancelledIssueIds.push(duplicate.issue.id);
    }

    await ctx.issues.createComment(
      keeper.issue.id,
      [
        "One-time Notion queue reconciliation kept this Paperclip issue as the canonical queue thread.",
        `- Canonical queue key: ${keeper.queueKey}`,
        `- Cancelled duplicates: ${duplicates.map((entry) => entry.issue.id).join(", ")}`,
      ].join("\n"),
      companyId,
    ).catch(() => undefined);
  }

  await appendRecentEvent(ctx, companyId, {
    kind: "notion-queue-reconcile",
    title: "Notion queue reconciliation completed",
    detail: `Cancelled ${cancelledCount} duplicate issues across ${keptIssueIds.length} canonical queue threads.`,
  });

  return {
    cancelledCount,
    canonicalIssueCount: keptIssueIds.length,
    cancelledIssueIds,
    keptIssueIds,
  };
}

async function runHandoffMonitorJob(ctx: PluginContext, companyId: string, config: BlueprintAutomationConfig) {
  await healAgentExecutionTopology(ctx, companyId);
  await rerouteUnavailableIssueOwners(ctx, companyId, config);
  await maybeCatchUpMissedRoutines(ctx, companyId).catch(() => undefined);
  const [issues, agents] = await Promise.all([
    listAllIssues(ctx, companyId),
    listAgents(ctx, companyId),
  ]);
  const handoffAnalytics = await buildHandoffState(ctx, companyId, issues, agents);
  await syncHandoffCollaboration(ctx, companyId, config, handoffAnalytics);

  return handoffAnalytics.summary;
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
      try {
        await handleChiefOfStaffRunFailureSignal(ctx, event);
      } catch (error) {
        ctx.logger.warn("agent.run.failed chief-of-staff wakeup failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
    });
    ctx.events.on("issue.created", async (event) => {
      if (!event.entityId) return;
      try {
        await handleChiefOfStaffIssueSignal(ctx, {
          eventId: event.eventId,
          companyId: event.companyId,
          entityId: event.entityId,
          type: "issue.created",
        });
      } catch (error) {
        ctx.logger.warn("issue.created chief-of-staff wakeup failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            issueId: event.entityId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
    });
    ctx.events.on("issue.updated", async (event) => {
      if (!event.entityId) return;
      try {
        const config = await getConfig(ctx);
        await validateCityLaunchIssueCompletion(ctx, event.companyId, config, event.entityId);
      } catch (error) {
        ctx.logger.warn("issue.updated city-launch completion validation failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            issueId: event.entityId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
      try {
        await handleChiefOfStaffIssueSignal(ctx, {
          eventId: event.eventId,
          companyId: event.companyId,
          entityId: event.entityId,
          type: "issue.updated",
        });
      } catch (error) {
        ctx.logger.warn("issue.updated chief-of-staff wakeup failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            issueId: event.entityId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
    });
    ctx.events.on("activity.logged", async (event) => {
      try {
        await handleAgentConversationActivitySignal(ctx, event);
      } catch (error) {
        ctx.logger.warn("activity.logged comment mirror failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
      try {
        await handleRoutineExecutionSignal(ctx, event);
      } catch (error) {
        ctx.logger.warn("activity.logged routine execution dispatch failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
      try {
        await handleChiefOfStaffActivitySignal(ctx, event);
      } catch (error) {
        ctx.logger.warn("activity.logged chief-of-staff wakeup failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
    });
    ctx.events.on("agent.updated", async (event) => {
      if (!event.entityId) return;
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
      if (!event.entityId) return;
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
    ctx.jobs.register(JOB_KEYS.notionQueueReconcile, async () => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await runNotionQueueReconcileJob(ctx, company.id);
    });
    ctx.jobs.register(JOB_KEYS.routineHealthCheck, async () => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await runRoutineHealthCheck(ctx, company.id, config);
    });
    ctx.jobs.register(JOB_KEYS.handoffMonitor, async () => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await runHandoffMonitorJob(ctx, company.id, config);
    });
    ctx.jobs.register(JOB_KEYS.quotaCooldownEnforcer, async () => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await enforceWorkspaceAdapterCooldowns(ctx, company.id);
    });
    ctx.jobs.register(JOB_KEYS.executionDispatch, async () => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await runExecutionDispatchJob(ctx, company.id, config);
    });
    try {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await enforceWorkspaceAdapterCooldowns(ctx, company.id);
      await healAgentExecutionTopology(ctx, company.id);
    } catch (error) {
      ctx.logger.warn("startup automation maintenance failed", {
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
