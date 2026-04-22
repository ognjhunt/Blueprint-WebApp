import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
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
  analyzeWorkQueueItemsForScan,
  canonicalWorkQueueScanKey,
  buildNotionToolHandlers,
  createAgentRunEntry,
  createKnowledgeEntry,
  createNotionClient,
  createWorkQueueItem,
  extractAnalyticsSnapshotDate,
  findWorkQueueItemPage,
  isStaleAnalyticsSnapshotQueueItem,
  mapWorkQueueLifecycleStageToIssueStatus,
  queryDatabase,
  queryWorkQueue,
  normalizeWorkQueueItem,
  type WorkQueueItem,
  updatePageMetadata,
  upsertAgentRegistryEntry,
  upsertKnowledgeEntry,
  upsertWorkQueueItem,
} from "./notion.js";
import { syncBlueprintAgentRegistryWithRetries, type LiveAgentRecord } from "./agent-registry-sync.js";
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
  loadPlatformDoctrineDocs,
  resolveConfiguredRepoRoot,
} from "./repo-root.js";
import {
  pollGithubWorkflows as pollGithubWorkflowsHelper,
} from "./github-workflow-polling.js";
import {
  buildLocalQuotaFallbackDescriptor,
  buildClaudeFallbackAdapterConfig,
  buildCodexFallbackAdapterConfig,
  buildQuotaFallbackRetryRecord,
  FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY,
  getLocalAdapterWorkspaceKey,
  getWorkspaceAdapterCooldownKey,
  isProviderAuthFailure,
  isQuotaOrRateLimitFailure,
  isProviderCreditFailure,
  isProcessLossFailure,
  isProviderTimeoutFailure,
  resolveQuotaCooldownUntil,
  selectWorkspaceQuotaFallbackTargets,
  type LocalQuotaFallbackAdapterType,
  type QuotaFallbackRetryState,
  type WorkspaceAdapterCooldownRecord,
  type WorkspaceAdapterCooldownState,
  buildHermesFallbackAdapterConfig,
  extractLogicalSucceededRunFailure,
  inferFailedLocalAdapterType,
  isFreshSessionRetryableFailure,
  isDisallowedHermesFallbackModel,
  isIncompatibleHermesFreeRoutingModel,
  isModelNotFoundFailure,
  syncExecutionPolicyToAdapter,
  upsertWorkspaceAdapterCooldownState,
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
  findStaleHeartbeatRuns,
  findStaleRunningHeartbeatRun,
  getHeartbeatRunTaskKey,
  groupStaleRunsByAgent,
  type HeartbeatRunLike,
  type StaleRunEntry,
} from "./stale-run-recovery.js";
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
import {
  shouldPreserveResolvedNotionQueueIssue,
  workQueueIssueTitle,
  workQueueLifecycleStageForResolution,
} from "./notion-queue-lifecycle.js";
import {
  normalizeMaintenanceState,
  ROUTING_MAINTENANCE_STALE_MS,
} from "./maintenance-guard.js";
import {
  blockedFollowUpFamilyKey,
  isHumanGatedBlockedIssue,
  isBlockedFollowUpTitle,
  planBlockedIssueFollowUp,
} from "./blocked-followups.js";
import {
  inferExecutionOwnerFromContext,
  planChiefOwnedBacklogDelegation,
  planParentParkingRecovery,
  shouldQuarantineSmokeArtifact,
} from "./delegation-scaffolding.js";
import { findAutoResolvableCloseoutComment } from "./managed-closeout.js";
import { verifyDispatchWake } from "./execution-dispatch-verification.js";
import {
  inferChiefOfStaffRoute,
  isNotionManagerRegistryWorkTitle,
} from "../../../chief-of-staff-routing.js";
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
  shouldPreservePreferredExecutionLane,
} from "./preferred-execution-lane.js";
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
import { ensureKbReportArtifact } from "./kb-artifacts.js";
import { loadEnvironmentProfile } from "./runtime/environment-profiles.js";
import {
  listMemoryStoreRecords,
  readMemoryRecord,
  syncDoctrineMemoryStore,
  writeMemoryRecord,
} from "./runtime/memory.js";
import {
  addRuntimeSessionArtifacts,
  createRuntimeCheckpoint,
  ensureRuntimeSession,
  getLatestSessionForIssue,
  getRuntimeSession,
  listRecentRuntimeSessions,
  updateRuntimeSession,
  updateRuntimeSessionStatus,
} from "./runtime/sessions.js";
import {
  createRuntimeSubagent,
  listRuntimeSubagentsForParent,
  updateRuntimeSubagentStatus,
} from "./runtime/subagents.js";
import { appendRuntimeTraceEvent, readRuntimeTrace } from "./runtime/tracing.js";
import {
  isTerminalRuntimeSessionStatus,
  issueStatusToRuntimeSessionStatus,
  type RuntimeSession,
  type RuntimeSessionStatus,
} from "./runtime/types.js";
import { buildBlueprintRuntimeMetadata } from "./runtime/versioning.js";

const execFileAsync = promisify(execFile);
const HEADROOM_WARNING_BYTES = 30 * 1024 * 1024 * 1024;
const HEADROOM_CRITICAL_BYTES = 15 * 1024 * 1024 * 1024;
const HEADROOM_WARNING_USED_PERCENT = 90;
const HEADROOM_CRITICAL_USED_PERCENT = 95;

type DiskHeadroomCheck = {
  filesystem: string;
  mountedOn: string;
  targetPath: string;
  totalBytes: number;
  availableBytes: number;
  usedPercent: number;
};
const BLUEPRINT_WEBAPP_REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const GIT_BIN = process.env.BLUEPRINT_PAPERCLIP_GIT_BIN || "/usr/bin/git";
const EXECUTION_DISPATCH_MAX_RUNTIME_MS = 45 * 1000;
const CODEX_FALLBACK_MODEL =
  process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL || "gpt-5.4-mini";
const CODEX_FALLBACK_REASONING_EFFORT =
  process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT || "medium";
const WORKSPACE_QUOTA_COOLDOWN_MS =
  Number(process.env.BLUEPRINT_PAPERCLIP_WORKSPACE_QUOTA_COOLDOWN_MS || "") || 6 * 60 * 60 * 1000;
const LOGICAL_SUCCEEDED_RUN_RECOVERY_INTERVAL_MS =
  Number(process.env.BLUEPRINT_PAPERCLIP_LOGICAL_SUCCEEDED_RUN_RECOVERY_INTERVAL_MS || "") || 2 * 60 * 1000;
const LOGICAL_SUCCEEDED_RUN_LOOKBACK_MS =
  Number(process.env.BLUEPRINT_PAPERCLIP_LOGICAL_SUCCEEDED_RUN_LOOKBACK_MS || "") || 2 * 60 * 60 * 1000;
const LOGICAL_SUCCEEDED_RUN_SCAN_LIMIT =
  Number(process.env.BLUEPRINT_PAPERCLIP_LOGICAL_SUCCEEDED_RUN_SCAN_LIMIT || "") || 80;
const ENTITY_TYPES = {
  sourceMapping: "source-mapping",
} as const;
const EXECUTIVE_OPS_PROJECT = "blueprint-executive-ops";
const NOTION_MANAGER_AGENT = "notion-manager-agent";
const BUYER_RISK_OWNER_RESPONSE_GRACE_HOURS = 12;
const MEANINGFUL_PROGRESS_GRACE_MS = 5 * 60 * 1000;
const EXECUTION_DISPATCH_COOLDOWN_MS = 15 * 60 * 1000;
// STATE_KEYS imported from ./constants.js

const PILOT_AGENT_TITLES = {
  "notion-reconciler": "Notion Reconciler",
  "metrics-reporter": "Metrics Reporter",
  "workspace-digest-publisher": "Workspace Digest Publisher",
} as const;

type PilotAgentKey = keyof typeof PILOT_AGENT_TITLES;

type PilotRunStatus = "Queued" | "Running" | "Waiting on Human" | "Blocked" | "Failed" | "Done" | "Canceled";

type PilotRunMirror = {
  notionClient: ReturnType<typeof createNotionClient>;
  agentPageId: string;
  runPageId: string;
  runPageUrl?: string;
  runId: string;
};

type PilotRunFinalizeInput = {
  status: PilotRunStatus;
  startedAt: string;
  endedAt?: string;
  triggerSource: "Schedule" | "Webhook" | "Manual" | "Comment Mention" | "Database Update" | "Task Assignment";
  issueId?: string;
  outputDocPageId?: string;
  outputDocPageUrl?: string;
  artifactUrl?: string;
  errorSummary?: string;
  requiresHumanReview?: boolean;
  notes?: string;
};

function isPilotAgentKey(value: string | null | undefined): value is PilotAgentKey {
  return typeof value === "string" && value in PILOT_AGENT_TITLES;
}

function pilotAgentTitle(agentKey: PilotAgentKey) {
  return PILOT_AGENT_TITLES[agentKey];
}

function pilotAgentDepartment(agentKey: PilotAgentKey) {
  return agentKey === "notion-reconciler" ? "Executive" : "Growth";
}

function pilotAgentRole(agentKey: PilotAgentKey) {
  return agentKey === "notion-reconciler" ? "Coordinator" : "Specialist";
}

function pilotAgentRuntime(agentKey: PilotAgentKey): "Paperclip/Hermes" | "Paperclip/Codex" {
  const adapterType = getConfiguredAgent(agentKey)?.adapter?.type;
  return adapterType === "codex_local" ? "Paperclip/Codex" : "Paperclip/Hermes";
}

function pilotAgentNotionSurfaces(agentKey: PilotAgentKey) {
  if (agentKey === "notion-reconciler") {
    return [
      "Blueprint Agents",
      "Blueprint Agent Runs",
      "Blueprint Work Queue",
      "Blueprint Knowledge",
      "Blueprint Skills",
    ];
  }
  return ["Blueprint Agents", "Blueprint Agent Runs", "Blueprint Knowledge", "Blueprint Work Queue"];
}

function pilotAgentReadableSurfaces(agentKey: PilotAgentKey) {
  if (agentKey === "notion-reconciler") {
    return ["Blueprint Work Queue", "Blueprint Knowledge", "Blueprint Skills", "Blueprint Agents"];
  }
  return ["Blueprint Knowledge", "Blueprint Work Queue", "Growth Studio mirror"];
}

function pilotAgentWritableSurfaces(agentKey: PilotAgentKey) {
  if (agentKey === "notion-reconciler") {
    return ["Blueprint Work Queue", "Blueprint Knowledge", "Blueprint Skills", "Blueprint Agents", "Blueprint Agent Runs"];
  }
  return ["Blueprint Knowledge", "Blueprint Work Queue", "Blueprint Agent Runs"];
}

function pilotAgentToolAccess(agentKey: PilotAgentKey) {
  if (agentKey === "notion-reconciler") {
    return [
      "notion-search-pages",
      "notion-fetch-page",
      "notion-update-page-metadata",
      "notion-reconcile-relations",
      "notion-comment-page",
      "notion-archive-page",
    ];
  }
  return ["notion-upsert-knowledge", "notion-upsert-work-queue"];
}

function pilotAgentHumanGates(agentKey: PilotAgentKey) {
  if (agentKey === "notion-reconciler") {
    return ["Ambiguous workspace mutation", "Rights or privacy-sensitive cleanup"];
  }
  if (agentKey === "metrics-reporter") {
    return ["Human review before external reuse of material metric claims"];
  }
  return ["Human review before turning internal draft language into public copy"];
}

function mapPilotRunStatusToRegistryStatus(status: PilotRunStatus) {
  switch (status) {
    case "Running":
      return "Running";
    case "Waiting on Human":
      return "Waiting on Human";
    case "Blocked":
      return "Blocked";
    case "Failed":
      return "Failed";
    case "Done":
      return "Done";
    default:
      return "Ready";
  }
}

function resolvePaperclipIssueUrl(issueId: string | undefined) {
  const baseUrl =
    asString(process.env.PAPERCLIP_APP_URL)
    ?? asString(process.env.BLUEPRINT_PAPERCLIP_APP_URL);
  if (!baseUrl || !issueId) {
    return undefined;
  }
  return `${baseUrl.replace(/\/$/, "")}/issues/${issueId}`;
}

function firstHttpUrl(values: Array<string | undefined | null>) {
  return values.find((value) => typeof value === "string" && /^https?:\/\//i.test(value)) ?? undefined;
}

type GrowthOpsModule = typeof import("../../../../../server/utils/growth-ops.js");

let growthOpsModulePromise: Promise<GrowthOpsModule> | null = null;
const resolvedSecretCache = new Map<string, string | null>();

function loadGrowthOpsModule() {
  if (!growthOpsModulePromise) {
    growthOpsModulePromise = import("../../../../../server/utils/growth-ops.js");
  }
  return growthOpsModulePromise;
}

type RepoConfig = {
  key: string;
  projectName: string;
  githubRepo: string;
  defaultBranch: string;
  ciWatchAgent?: string;
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
    metricsReporter: string;
    communityUpdates: string;
    workspaceDigestPublisher: string;
    marketIntel: string;
    demandIntel: string;
    capturerGrowth: string;
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
  stripeSecretKeyRef?: string;
  stripeConnectAccountIdRef?: string;
  stripeWebhookSecretRef?: string;
};

type ManagementConfig = {
  chiefOfStaffAgent: string;
  notionReconcilerAgent: string;
};

type MarketingCapabilitiesConfig = {
  firehoseBaseUrl?: string;
  introwBaseUrl?: string;
  firehoseDefaultTopics?: string[];
  firehoseMaxSignalsPerRead?: number;
  introwDefaultWorkspace?: string;
};

type BlueprintAutomationConfig = {
  companyId?: string;
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
  errorCode: string | null;
};

type HeartbeatRunRecord = {
  agentId: string;
  contextSnapshot?: Record<string, unknown> | null;
  createdAt?: string | null;
  id: string;
  status?: string | null;
};

type HeartbeatRunDetail = HeartbeatRunRecord & {
  error?: string | null;
  errorCode?: string | null;
  finishedAt?: string | null;
  resultJson?: Record<string, unknown> | null;
  startedAt?: string | null;
  stderrExcerpt?: string | null;
  stdoutExcerpt?: string | null;
  updatedAt?: string | null;
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
  kbArtifact?: {
    path: string;
    generated: boolean;
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
  kbArtifact?: {
    path: string;
    generated: boolean;
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
  kbArtifact?: {
    path: string;
    generated: boolean;
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
  kbArtifact?: {
    path: string;
    generated: boolean;
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
type MaintenanceState = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  lastResult: Record<string, unknown> | null;
};

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
  kbArtifact?: {
    path: string;
    generated: boolean;
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
let toolRegistrationStarted = false;
let toolRegistrationReady = false;
let toolRegistrationError: string | null = null;
let startupMaintenancePromise: Promise<void> | null = null;
let logicalSucceededRunRecoveryStarted = false;
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

function preferredAgentKey(agent: Agent | null | undefined) {
  return (
    asString((agent as Record<string, unknown> | null)?.urlKey)
    ?? asString((agent as Record<string, unknown> | null)?.slug)
    ?? asString((agent as Record<string, unknown> | null)?.key)
    ?? asString((agent as Record<string, unknown> | null)?.name)
    ?? asString((agent as Record<string, unknown> | null)?.title)
    ?? asString((agent as Record<string, unknown> | null)?.id)
  ) ?? null;
}

function extractUrls(value: string | null | undefined) {
  if (!value) {
    return [];
  }
  return [...value.matchAll(/https?:\/\/[^\s)\]]+/gi)].map((match) => match[0]);
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
    errorCode: asString(payload.errorCode) ?? null,
  };
}

function isToolRuntimeFailure(errorCode: string | null | undefined, error: string | null | undefined) {
  if (errorCode === "tool_runtime_unavailable") return true;
  const message = (error ?? "").trim();
  return /(?:CreateProcess .*No such file or directory|Failed to create unified exec process|exec_command failed|write_stdin failed: stdin is closed|rerun exec_command with tty=true to keep stdin open)/i.test(message);
}

function shouldForceFreshSessionForAutomationWake(reason: string) {
  return reason === "fresh_session_retry_after_context_failure";
}

function buildQuotaFallbackDescriptor(
  adapterType: string,
  adapterConfig: Record<string, unknown> | null | undefined,
  desired?: {
    adapterType: string;
    adapterConfig: Record<string, unknown> | null | undefined;
  } | null,
  failureReason?: string | null,
) {
  if (isOrgForcedCodexMode()) {
    if (adapterType === "codex_local") {
      return null;
    }
    if (adapterType === "claude_local" || adapterType === "hermes_local") {
      return {
        adapterType: "codex_local",
        reason: "org_forced_codex_mode",
        adapterConfig: buildCodexFallbackAdapterConfig(
          asRecord(desired?.adapterConfig) ?? asRecord(adapterConfig),
          {
            model: "gpt-5.4-mini",
            modelReasoningEffort: "medium",
          },
        ),
      };
    }
  }

  return buildLocalQuotaFallbackDescriptor({
    currentAdapterType: adapterType,
    currentAdapterConfig: asRecord(adapterConfig),
    desiredAdapterType: desired?.adapterType ?? null,
    desiredAdapterConfig: asRecord(desired?.adapterConfig),
    failureReason,
  });
}

function buildDesiredAdapterDescriptor(agent: Agent): {
  adapterType: LocalQuotaFallbackAdapterType;
  adapterConfig: Record<string, unknown>;
} | null {
  const requestedMode = (process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE ?? "").trim().toLowerCase();
  const configuredAgent = getConfiguredAgent(agent.urlKey);
  const configuredAdapterType = configuredAgent?.adapter?.type;
  const configuredAdapterConfig = asRecord(configuredAgent?.adapter?.config);
  if (
    (configuredAdapterType !== "claude_local" &&
      configuredAdapterType !== "codex_local" &&
      configuredAdapterType !== "hermes_local") ||
    !configuredAdapterConfig
  ) {
    return null;
  }

  if (requestedMode === "codex") {
    return {
      adapterType: "codex_local",
      adapterConfig: buildCodexFallbackAdapterConfig(configuredAdapterConfig, {
        model: "gpt-5.4-mini",
        modelReasoningEffort: "medium",
      }),
    };
  }

  if (configuredAdapterType === "hermes_local") {
    return {
      adapterType: "hermes_local",
      adapterConfig: buildHermesFallbackAdapterConfig(configuredAdapterConfig),
    };
  }

  if (configuredAdapterType === "claude_local") {
    return {
      adapterType: "hermes_local",
      adapterConfig: buildHermesFallbackAdapterConfig(configuredAdapterConfig),
    };
  }

  return {
    adapterType: configuredAdapterType,
    adapterConfig: configuredAdapterConfig,
  };
}

function resolveAdapterConfigForType(
  agent: Agent,
  desired: {
    adapterType: LocalQuotaFallbackAdapterType;
    adapterConfig: Record<string, unknown>;
  } | null,
  adapterType: LocalQuotaFallbackAdapterType | null,
): Record<string, unknown> | null {
  if (!adapterType) {
    return asRecord(agent.adapterConfig) ?? desired?.adapterConfig ?? null;
  }

  const runtimeConfigRecord = asRecord(agent.runtimeConfig);
  const executionPolicy = asRecord(runtimeConfigRecord?.executionPolicy);
  const perAdapterConfig = asRecord(executionPolicy?.perAdapterConfig);
  const policyConfig = asRecord(perAdapterConfig?.[adapterType]);
  if (policyConfig) {
    return adapterType === "hermes_local" ? buildHermesFallbackAdapterConfig(policyConfig) : policyConfig;
  }

  if (desired?.adapterType === adapterType) {
    return desired.adapterConfig;
  }
  if (agent.adapterType === adapterType) {
    const rawConfig = asRecord(agent.adapterConfig) ?? desired?.adapterConfig ?? null;
    return adapterType === "hermes_local" ? buildHermesFallbackAdapterConfig(rawConfig) : rawConfig;
  }

  return asRecord(agent.adapterConfig) ?? desired?.adapterConfig ?? null;
}

async function resolveFailedAdapterSnapshot(
  agent: Agent,
  payload: AgentRunFailurePayload,
  desired: {
    adapterType: LocalQuotaFallbackAdapterType;
    adapterConfig: Record<string, unknown>;
  } | null,
) {
  const run = payload.runId
    ? await fetchPaperclipApiJson<HeartbeatRunDetail>(`/api/heartbeat-runs/${payload.runId}`).catch(() => null)
    : null;
  const runContext = asRecord(run?.contextSnapshot);
  const inferredAdapterType = inferFailedLocalAdapterType({
    currentAdapterType: agent.adapterType,
    error: payload.error,
    wakeReason: asString(runContext?.wakeReason) ?? null,
    resultJson: asRecord(run?.resultJson),
  });
  const failedAdapterType =
    inferredAdapterType === "claude_local" || inferredAdapterType === "codex_local" || inferredAdapterType === "hermes_local"
      ? inferredAdapterType
      : agent.adapterType === "claude_local" || agent.adapterType === "codex_local" || agent.adapterType === "hermes_local"
        ? agent.adapterType
        : null;
  const failedAdapterConfig =
    resolveAdapterConfigForType(agent, desired, failedAdapterType)
    ?? asRecord(agent.adapterConfig)
    ?? desired?.adapterConfig
    ?? {};

  return {
    failedAdapterType,
    failedAdapterConfig,
    run,
  };
}

function isOrgForcedCodexMode() {
  return (process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE ?? "").trim().toLowerCase() === "codex";
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
  const nextState = upsertWorkspaceAdapterCooldownState(state, record);
  await writeState(ctx, companyId, STATE_KEYS.workspaceAdapterCooldowns, nextState);
}

async function clearWorkspaceCooldownsIfForcedCodexMode(
  ctx: PluginContext,
  companyId: string,
) {
  if (!isOrgForcedCodexMode()) {
    return false;
  }
  const currentState =
    await readState<WorkspaceAdapterCooldownState>(ctx, companyId, STATE_KEYS.workspaceAdapterCooldowns) ?? {};
  if (Object.keys(currentState).length === 0) {
    return false;
  }
  await writeState(ctx, companyId, STATE_KEYS.workspaceAdapterCooldowns, {});
  await appendRecentEvent(ctx, companyId, {
    kind: "workspace-cooldowns-cleared",
    title: "Cleared workspace adapter cooldowns for codex mode",
    detail: `Removed ${Object.keys(currentState).length} persisted workspace cooldown override(s).`,
  });
  return true;
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
    const cooldown =
      isOrgForcedCodexMode() && desired.adapterType === "codex_local"
        ? null
        : getActiveWorkspaceCooldown(activeState, workspaceKey, desired.adapterType, now);
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
    companyId: asString(rawConfig.companyId) ?? asString(process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID),
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
        ciWatchAgent: asString((entry as Record<string, unknown>).ciWatchAgent) ?? undefined,
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
        metricsReporter: asString(growthAgents.metricsReporter) ?? "metrics-reporter",
        communityUpdates: asString(growthAgents.communityUpdates) ?? "community-updates-agent",
        workspaceDigestPublisher: asString(growthAgents.workspaceDigestPublisher) ?? "workspace-digest-publisher",
        marketIntel: asString(growthAgents.marketIntel) ?? "market-intel-agent",
        demandIntel: asString(growthAgents.demandIntel) ?? "demand-intel-agent",
        capturerGrowth: asString(growthAgents.capturerGrowth) ?? "capturer-growth-agent",
        robotTeamGrowth: asString(growthAgents.robotTeamGrowth) ?? "robot-team-growth-agent",
        siteOperatorPartnership: asString(growthAgents.siteOperatorPartnership) ?? "site-operator-partnership-agent",
        cityDemand: asString(growthAgents.cityDemand) ?? "city-demand-agent",
      },
    },
    management: {
      chiefOfStaffAgent: asString(management.chiefOfStaffAgent) ?? "blueprint-chief-of-staff",
      notionReconcilerAgent: asString(management.notionReconcilerAgent) ?? "notion-reconciler",
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
      stripeSecretKeyRef: asString(secrets.stripeSecretKeyRef) ?? asString(secrets.stripeSecretKey),
      stripeConnectAccountIdRef: asString(secrets.stripeConnectAccountIdRef) ?? asString(secrets.stripeConnectAccountId),
      stripeWebhookSecretRef: asString(secrets.stripeWebhookSecretRef) ?? asString(secrets.stripeWebhookSecret),
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
    if (resolvedSecretCache.has(ref)) {
      return resolvedSecretCache.get(ref) ?? null;
    }
    const resolved = await ctx.secrets.resolve(ref);
    resolvedSecretCache.set(ref, resolved ?? null);
    if (resolved) return resolved;
  }
  if (fallbackName) {
    if (resolvedSecretCache.has(fallbackName)) {
      return resolvedSecretCache.get(fallbackName) ?? null;
    }
    const resolved = await ctx.secrets.resolve(fallbackName);
    resolvedSecretCache.set(fallbackName, resolved ?? null);
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

function resolveHumanBlockerDispatchBaseUrl() {
  return firstHttpUrl([
    asString(process.env.BLUEPRINT_INTERNAL_APP_URL),
    asString(process.env.APP_URL),
    asString(process.env.VITE_PUBLIC_APP_URL),
    "http://127.0.0.1:5000",
  ]);
}

function normalizeAgentKey(agentKey: string | null | undefined) {
  return (agentKey ?? "").trim().toLowerCase();
}

function isEngineeringAgentKey(agentKey: string | null | undefined) {
  const normalized = normalizeAgentKey(agentKey);
  return normalized === "blueprint-cto"
    || normalized.startsWith("webapp-")
    || normalized.startsWith("pipeline-")
    || normalized.startsWith("capture-");
}

function isOpsAgentKey(agentKey: string | null | undefined) {
  const normalized = normalizeAgentKey(agentKey);
  return normalized === "ops-lead"
    || normalized === "intake-agent"
    || normalized === "capture-qa-agent"
    || normalized === "field-ops-agent"
    || normalized === "finance-support-agent"
    || normalized === "buyer-solutions-agent"
    || normalized === "buyer-success-agent"
    || normalized === "rights-provenance-agent"
    || normalized === "revenue-ops-pricing-agent"
    || normalized === "security-procurement-agent"
    || normalized === "site-catalog-agent"
    || normalized === "capturer-success-agent"
    || normalized === "solutions-engineering-agent";
}

function isGrowthAgentKey(agentKey: string | null | undefined) {
  const normalized = normalizeAgentKey(agentKey);
  return normalized === "growth-lead"
    || normalized === "conversion-agent"
    || normalized === "analytics-agent"
    || normalized === "community-updates-agent"
    || normalized === "market-intel-agent"
    || normalized === "metrics-reporter"
    || normalized === "workspace-digest-publisher"
    || normalized === "capturer-growth-agent"
    || normalized === "robot-team-growth-agent"
    || normalized === "site-operator-partnership-agent"
    || normalized === "city-demand-agent"
    || normalized === "city-launch-agent"
    || normalized === "demand-intel-agent"
    || normalized === "supply-intel-agent";
}

function inferHumanBlockerKindForOwner(agentKey: string | null | undefined): "technical" | "ops_commercial" {
  return isEngineeringAgentKey(agentKey) ? "technical" : "ops_commercial";
}

function selectHumanBlockerSlackWebhook(
  targets: Awaited<ReturnType<typeof resolveSlackTargets>>,
  ownerKey: string | null | undefined,
) {
  if (isEngineeringAgentKey(ownerKey)) {
    return targets.engineering ?? targets.exec ?? targets.manager ?? targets.default;
  }
  if (isGrowthAgentKey(ownerKey)) {
    return targets.growth ?? targets.manager ?? targets.default;
  }
  if (isOpsAgentKey(ownerKey)) {
    return targets.ops ?? targets.manager ?? targets.default;
  }
  if (normalizeAgentKey(ownerKey) === "blueprint-chief-of-staff") {
    return targets.manager ?? targets.exec ?? targets.default;
  }
  return targets.default;
}

async function postInternalHumanBlockerDispatch(
  body: Record<string, unknown>,
) {
  const token = asString(process.env.BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN);
  if (!token) {
    throw new Error("BLUEPRINT_HUMAN_REPLY_INGEST_TOKEN is not configured.");
  }
  const baseUrl = resolveHumanBlockerDispatchBaseUrl();
  if (!baseUrl) {
    throw new Error("Could not resolve a base URL for internal human blocker dispatch.");
  }

  const response = await fetch(
    `${baseUrl.replace(/\/$/, "")}/api/internal/human-blockers/dispatch`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Blueprint-Human-Reply-Token": token,
      },
      body: JSON.stringify(body),
    },
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(asString((payload as Record<string, unknown>).error) ?? "Human blocker dispatch failed.");
  }
  return payload as {
    ok: boolean;
    result: {
      blocker_id: string;
      dispatch_id: string;
      email_sent: boolean;
      slack_sent: boolean;
      email_subject?: string;
      packet_text?: string;
      delivery_mode?: string;
      delivery_status?: string;
    };
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
    analytics: agents?.analytics ?? "analytics-agent",
    communityUpdates: agents?.communityUpdates ?? "community-updates-agent",
    marketIntel: agents?.marketIntel ?? "market-intel-agent",
    demandIntel: agents?.demandIntel ?? "demand-intel-agent",
    capturerGrowth: agents?.capturerGrowth ?? "capturer-growth-agent",
    robotTeamGrowth: agents?.robotTeamGrowth ?? "robot-team-growth-agent",
    siteOperatorPartnership: agents?.siteOperatorPartnership ?? "site-operator-partnership-agent",
    cityDemand: agents?.cityDemand ?? "city-demand-agent",
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

  if (isNotionManagerRegistryWorkTitle(item.title)) {
    return NOTION_MANAGER_AGENT;
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
  options?: {
    allowFallback?: boolean;
    revivePreferredAgent?: boolean;
    taskKey?: string | null;
  },
) {
  let agents = await listAgents(ctx, companyId);
  const target = preferredAgentKey.trim().toLowerCase();
  let preferredAgent = [...agents]
    .map((entry) => ({ entry, score: scoreAgentMatch(entry, target) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.entry;

  if (!preferredAgent) {
    throw new Error(`Agent not found for Blueprint automation: ${preferredAgentKey}`);
  }

  let preferredKey = normalizedCandidates(preferredAgent as unknown as Record<string, unknown>)[0] ?? target;

  if (
    options?.revivePreferredAgent
    && (isAgentUnavailable(preferredAgent) || !agentHasDesiredAdapter(preferredAgent, preferredKey))
  ) {
    const desired = buildDesiredAdapterDescriptor(preferredAgent);
    if (desired) {
      const runtimeConfigRecord = asRecord(preferredAgent.runtimeConfig);
      const targetRuntimeConfig = syncExecutionPolicyToAdapter(
        runtimeConfigRecord,
        desired.adapterType,
      );
      await ctx.agents.update(
        preferredAgent.id,
        {
          adapterType: desired.adapterType,
          adapterConfig: desired.adapterConfig,
          runtimeConfig: targetRuntimeConfig,
        },
        companyId,
      ).catch(() => undefined);
    }
    await ctx.agents.resetRuntimeSession(
      preferredAgent.id,
      companyId,
      options.taskKey ? { taskKey: options.taskKey } : undefined,
    ).catch(() => undefined);
    agents = await listAgents(ctx, companyId);
    preferredAgent = [...agents]
      .map((entry) => ({ entry, score: scoreAgentMatch(entry, target) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)[0]?.entry ?? preferredAgent;
    preferredKey = normalizedCandidates(preferredAgent as unknown as Record<string, unknown>)[0] ?? target;
  }

  if (options?.allowFallback === false) {
    return {
      agent: preferredAgent,
      preferredKey,
      selectedKey: preferredKey,
      rerouted: false,
      attempted: [preferredKey],
    };
  }

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

async function cancelIssueExecutionRunIfNeeded(
  issue: Pick<Issue, "executionRunId" | "executionAgentNameKey">,
  nextAssigneeKey: string,
) {
  if (!issue.executionRunId) {
    return false;
  }
  if (
    issue.executionAgentNameKey
    && issue.executionAgentNameKey.trim().toLowerCase() === nextAssigneeKey.trim().toLowerCase()
  ) {
    return false;
  }
  await fetchPaperclipApiJson(`/api/heartbeat-runs/${issue.executionRunId}/cancel`, {
    method: "POST",
  }).catch(() => null);
  return true;
}

function boundIssueIdFromRunContext(
  context: Record<string, unknown> | null | undefined,
): string | null {
  const taskId = asString(context?.taskId);
  if (taskId) return taskId;
  return asString(context?.issueId);
}

function isTerminalHeartbeatRunStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "failed"
    || normalized === "cancelled"
    || normalized === "timed_out"
    || normalized === "succeeded";
}

async function recoverIssueExecutionLockIfNeeded(
  ctx: PluginContext,
  companyId: string,
  issue: Pick<Issue, "id" | "identifier" | "title" | "executionRunId" | "updatedAt">,
  options?: {
    staleAfterMs?: number;
    commentPrefix?: string;
  },
) {
  if (!issue.executionRunId) {
    return { recovered: false, reason: null as string | null };
  }

  const run = await fetchPaperclipApiJson<HeartbeatRunDetail>(`/api/heartbeat-runs/${issue.executionRunId}`).catch(() => null);
  const runIssues = await fetchPaperclipApiJson<Array<{ issueId?: string | null }>>(
    `/api/heartbeat-runs/${issue.executionRunId}/issues`,
  ).catch(() => []);

  const boundIssueId = boundIssueIdFromRunContext(run?.contextSnapshot ?? null);
  const linkedIssueIds = new Set(
    runIssues
      .map((entry) => asString(entry.issueId))
      .filter((value): value is string => Boolean(value)),
  );
  const staleAfterMs = Math.max(5 * 60 * 1000, options?.staleAfterMs ?? (15 * 60 * 1000));
  const issueUpdatedAtMs = Date.parse(asString(issue.updatedAt) ?? "");
  const runUpdatedAtMs = Date.parse(asString(run?.updatedAt ?? run?.startedAt ?? run?.createdAt) ?? "");
  const newestActivityMs = Math.max(
    Number.isFinite(issueUpdatedAtMs) ? issueUpdatedAtMs : Number.NEGATIVE_INFINITY,
    Number.isFinite(runUpdatedAtMs) ? runUpdatedAtMs : Number.NEGATIVE_INFINITY,
  );
  const isStaleRunningLock =
    Boolean(run)
    && !isTerminalHeartbeatRunStatus(run.status)
    && Number.isFinite(newestActivityMs)
    && (Date.now() - newestActivityMs) >= staleAfterMs;
  const isForeignLock =
    Boolean(boundIssueId && boundIssueId !== issue.id)
    || (linkedIssueIds.size > 0 && !linkedIssueIds.has(issue.id));
  const shouldRecover =
    !run
    || isTerminalHeartbeatRunStatus(run.status)
    || isForeignLock
    || isStaleRunningLock;

  if (!shouldRecover) {
    return { recovered: false, reason: null as string | null };
  }

  if (run) {
    await fetchPaperclipApiJson(`/api/heartbeat-runs/${issue.executionRunId}/cancel`, {
      method: "POST",
      body: JSON.stringify({}),
    }).catch(() => null);
  }

  const reason = !run
    ? "missing execution run record"
    : isForeignLock
      ? `execution run is bound to ${boundIssueId ?? "a different issue"}`
      : isTerminalHeartbeatRunStatus(run.status)
        ? `execution run is already terminal (${run.status})`
        : `execution run went stale without fresh activity for ${Math.round(staleAfterMs / 60000)} minutes`;

  await ctx.issues.createComment(
    issue.id,
    [
      options?.commentPrefix ?? "Automation cleared a stale execution lock before the next step.",
      `- Issue: ${issue.identifier ?? issue.id} (${issue.title})`,
      `- Cleared run: ${issue.executionRunId}`,
      `- Reason: ${reason}`,
    ].join("\n"),
    companyId,
  ).catch(() => undefined);

  await appendRecentEvent(ctx, companyId, {
    kind: "execution-lock-recovered",
    title: `Recovered stale execution lock for ${issue.title}`,
    issueId: issue.id,
    detail: `${issue.executionRunId}: ${reason}`,
  });

  return { recovered: true, reason };
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

async function ensureKbArtifactForReport(input: {
  params: Record<string, unknown>;
  generatedAt: string;
  title: string;
  defaultCategory: string;
  owner: string;
  summary: string;
  evidence: string[];
  recommendedFollowUp: string[];
}) {
  const result = await ensureKbReportArtifact({
    repoRoot: BLUEPRINT_WEBAPP_REPO_ROOT,
    requestedPath: asString(input.params.kbArtifactPath),
    defaultCategory: input.defaultCategory,
    title: input.title,
    generatedAt: input.generatedAt,
    owner: input.owner,
    summary: input.summary,
    evidence: input.evidence,
    recommendedFollowUp: input.recommendedFollowUp,
    linkedKbPages: coerceStringArray(input.params.kbLinkedPages),
    issueId: asString(input.params.issueId),
  });

  return {
    path: result.repoRelativePath,
    generated: result.generated,
  };
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

function safeDateRank(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

async function fetchHeartbeatRuns(companyId: string, limit = LOGICAL_SUCCEEDED_RUN_SCAN_LIMIT) {
  return await fetchPaperclipApiJson<HeartbeatRunRecord[]>(
    `/api/companies/${companyId}/heartbeat-runs?limit=${Math.max(1, limit)}`,
  );
}

async function fetchHeartbeatRunLog(runId: string, limitBytes = 16384) {
  try {
    const payload = await fetchPaperclipApiJson<{ content?: string | null }>(
      `/api/heartbeat-runs/${runId}/log?offset=0&limitBytes=${Math.max(1024, limitBytes)}`,
    );
    return asString(payload.content) ?? "";
  } catch {
    return "";
  }
}

function buildLogicalSucceededRunFailurePayload(
  run: HeartbeatRunRecord,
  logText: string,
): AgentRunFailurePayload | null {
  if ((asString(run.status) ?? "").trim().toLowerCase() !== "succeeded") {
    return null;
  }
  const error = extractLogicalSucceededRunFailure(logText);
  if (!error) {
    return null;
  }
  const context = asRecord(run.contextSnapshot);
  return {
    agentId: asString(run.agentId) ?? null,
    runId: asString(run.id) ?? null,
    issueId: asString(context?.issueId) ?? null,
    taskId: asString(context?.taskId) ?? null,
    taskKey: asString(context?.taskKey) ?? null,
    error,
  };
}

async function findCompany(
  ctx: PluginContext,
  companyName?: string,
  companyId?: string | null,
): Promise<Company> {
  const companies = await ctx.companies.list({ limit: 100, offset: 0 });
  const normalizedId = (companyId ?? process.env.BLUEPRINT_PAPERCLIP_COMPANY_ID ?? "").trim();
  if (normalizedId) {
    const byId = companies.find((entry) => entry.id === normalizedId);
    if (!byId) {
      throw new Error(`Blueprint company not found for id: ${normalizedId}`);
    }
    return byId;
  }
  const target = (companyName ?? DEFAULT_COMPANY_NAME).trim().toLowerCase();
  const matches = companies.filter((entry) => {
    const record = entry as unknown as Record<string, unknown>;
    return normalizedCandidates(record).includes(target);
  });
  if (matches.length === 0) {
    throw new Error(`Blueprint company not found: ${companyName ?? DEFAULT_COMPANY_NAME}`);
  }
  if (matches.length > 1) {
    throw new Error(
      `Blueprint company name is ambiguous: ${companyName ?? DEFAULT_COMPANY_NAME}. Set BLUEPRINT_PAPERCLIP_COMPANY_ID to pin the org harness to one company.`,
    );
  }
  return matches[0]!;
}

async function listProjects(ctx: PluginContext, companyId: string) {
  return await ctx.projects.list({ companyId, limit: 200, offset: 0 });
}

async function listAgents(ctx: PluginContext, companyId: string) {
  return await ctx.agents.list({ companyId, limit: 200, offset: 0 });
}

function toLiveAgentRegistryRecord(agent: Agent): LiveAgentRecord | null {
  const key = preferredAgentKey(agent);
  if (!key) {
    return null;
  }

  const record = agent as unknown as Record<string, unknown>;
  return {
    adapterType: asString(record.adapterType) ?? asString(record.adapter?.type) ?? null,
    createdAt: asString(record.createdAt) ?? null,
    id: agent.id,
    name: asString(agent.name) ?? asString(record.title) ?? key,
    status: asString(record.status) ?? null,
    updatedAt: asString(record.updatedAt) ?? null,
    urlKey: key,
  };
}

async function syncAllAgentRegistryRows(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  agents?: Agent[],
) {
  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );
  if (!notionToken) {
    return null;
  }

  const liveAgents = (agents ?? await listAgents(ctx, companyId))
    .map((agent) => toLiveAgentRegistryRecord(agent))
    .filter((agent): agent is LiveAgentRecord => Boolean(agent));
  const notionClient = createNotionClient({ token: notionToken });
  return await syncBlueprintAgentRegistryWithRetries({
    archiveDuplicates: true,
    liveAgents,
    notionClient,
  });
}

async function syncSingleAgentRegistryRow(
  ctx: PluginContext,
  companyId: string,
  agent: Agent,
) {
  const config = await getConfig(ctx);
  return await syncAllAgentRegistryRows(ctx, config, companyId, [agent]);
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

    const preservePreferredLane = shouldPreservePreferredExecutionLane({
      title: issue.title,
      preferredAssignee: routedAssignee,
      parentId: issue.parentId ?? null,
    });
    const assigneeResolution = await resolveAssignableAgent(
      ctx,
      companyId,
      config,
      routedAssignee,
      {
        allowFallback: !preservePreferredLane,
        revivePreferredAgent: preservePreferredLane,
        taskKey: issue.id,
      },
    ).catch(() => null);
    if (!assigneeResolution || issue.assigneeAgentId === assigneeResolution.agent.id) {
      continue;
    }

    await cancelIssueExecutionRunIfNeeded(issue, assigneeResolution.selectedKey).catch(() => undefined);
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

async function autoResolveManagedIssuesFromCloseoutComments(
  ctx: PluginContext,
  companyId: string,
  options?: {
    deadlineMs?: number;
    maxIssues?: number;
  },
) {
  const [issues, sourceMappings] = await Promise.all([
    listAllIssues(ctx, companyId),
    listSourceMappings(ctx, companyId),
  ]);
  const resolved: string[] = [];
  const deadlineMs = options?.deadlineMs ?? Number.POSITIVE_INFINITY;
  const maxIssues = options?.maxIssues ?? Number.POSITIVE_INFINITY;
  const candidates = issues
    .filter((issue) => !["done", "cancelled"].includes(issue.status))
    .sort((left, right) => Date.parse(toIsoTimestamp(right.updatedAt)) - Date.parse(toIsoTimestamp(left.updatedAt)))
    .slice(0, maxIssues);

  for (const issue of candidates) {
    if (Date.now() >= deadlineMs) {
      break;
    }
    const sourceMapping = findSourceMappingRecordByIssueId(sourceMappings, issue.id);
    if (!sourceMapping) {
      continue;
    }

    const comments = await listCommentsForIssue(ctx, companyId, issue.id).catch(() => [] as IssueComment[]);
    const closeoutComment = findAutoResolvableCloseoutComment(comments, {
      issueUpdatedAt: toIsoTimestamp(issue.updatedAt),
      assigneeAgentId: issue.assigneeAgentId,
    });
    if (!closeoutComment) {
      continue;
    }

    await resolveManagedIssue(ctx, {
      companyId,
      sourceType: sourceMapping.data.sourceType,
      sourceId: sourceMapping.data.sourceId,
      resolutionStatus: "done",
      comment: [
        "Manager enforcement resolved this managed issue from a proof-bearing closeout comment.",
        `- Source comment at: ${toIsoTimestamp(closeoutComment.createdAt)}`,
        "",
        (closeoutComment.body ?? "").trim(),
      ].join("\n"),
    }).catch(() => undefined);
    resolved.push(issue.identifier ?? issue.id);
  }

  if (resolved.length > 0) {
    await appendRecentEvent(ctx, companyId, {
      kind: "managed-closeout-enforced",
      title: "Manager closeout enforcement resolved managed issues",
      detail: resolved.join(", "),
    });
  }

  return resolved;
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
const CHIEF_OF_STAFF_STALE_RUNNING_IDLE_MS = 12 * 60 * 1000;
const CHIEF_OF_STAFF_RUN_RECOVERY_LIMIT = 50;
const STALE_RUN_RECOVERY_IDLE_MS = 20 * 60 * 1000;
const STALE_RUN_RECOVERY_BATCH_LIMIT = 200;
const STALE_RUN_RECOVERY_MAX_CANCELS_PER_AGENT = 10;
const chiefOfStaffLastWakeupByCompany = new Map<string, number>();

async function recoverStaleAgentRuns(
  ctx: PluginContext,
  companyId: string,
): Promise<string[]> {
  const recovered: string[] = [];
  const allRuns = await fetchPaperclipApiJson<HeartbeatRunLike[]>(
    `/api/companies/${companyId}/heartbeat-runs?limit=${STALE_RUN_RECOVERY_BATCH_LIMIT}`,
  );
  const staleEntries = findStaleHeartbeatRuns(allRuns, Date.now(), STALE_RUN_RECOVERY_IDLE_MS);
  if (staleEntries.length === 0) {
    return recovered;
  }

  const byAgent = groupStaleRunsByAgent(staleEntries);
  const agents = await listAgents(ctx, companyId);
  const agentById = new Map(agents.map((a) => [a.id, a]));

  for (const [agentId, entries] of byAgent) {
    const agent = agentById.get(agentId);
    const agentKey = agent?.urlKey ?? agentId;
    const toCancel = entries.slice(0, STALE_RUN_RECOVERY_MAX_CANCELS_PER_AGENT);

    for (const entry of toCancel) {
      await fetchPaperclipApiJson(`/api/heartbeat-runs/${entry.run.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      }).catch(() => undefined);

      const taskKey = getHeartbeatRunTaskKey(entry.run);
      if (agent) {
        if (taskKey) {
          await ctx.agents.resetRuntimeSession(agent.id, companyId, { taskKey }).catch(() => undefined);
        } else {
          await ctx.agents.resetRuntimeSession(agent.id, companyId).catch(() => undefined);
        }
      }

      const idleMinutes = Math.max(1, Math.round(entry.idleMs / (1000 * 60)));
      recovered.push(
        `${agentKey}:${entry.staleKind}:${entry.run.id}:${idleMinutes}m`,
      );
    }
  }

  if (recovered.length > 0) {
    await appendRecentEvent(ctx, companyId, {
      kind: "stale-run-recovery",
      title: "Recovered stale agent runs",
      detail: `Cancelled ${recovered.length} stale run(s): ${recovered.join(", ")}`,
    });
  }

  return recovered;
}

async function recoverStaleChiefOfStaffRunIfNeeded(
  ctx: PluginContext,
  companyId: string,
  agent: Agent,
  issueId?: string,
) {
  const runs = await fetchPaperclipApiJson<HeartbeatRunLike[]>(
    `/api/companies/${companyId}/heartbeat-runs?agentId=${agent.id}&limit=${CHIEF_OF_STAFF_RUN_RECOVERY_LIMIT}`,
  );
  const staleRun = findStaleRunningHeartbeatRun(runs, Date.now(), CHIEF_OF_STAFF_STALE_RUNNING_IDLE_MS);
  if (!staleRun) {
    return null;
  }

  await fetchPaperclipApiJson(`/api/heartbeat-runs/${staleRun.run.id}/cancel`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const taskKey = getHeartbeatRunTaskKey(staleRun.run);
  if (taskKey) {
    await ctx.agents.resetRuntimeSession(agent.id, companyId, { taskKey }).catch(() => undefined);
  } else {
    await ctx.agents.resetRuntimeSession(agent.id, companyId).catch(() => undefined);
  }

  const idleMinutes = Math.max(1, Math.round(staleRun.idleMs / (1000 * 60)));
  await appendRecentEvent(ctx, companyId, {
    kind: "chief-of-staff-wakeup-skipped",
    title: "Recovered stale chief-of-staff run before wake",
    issueId,
    detail: `Cancelled stale running run ${staleRun.run.id} after ${idleMinutes} minutes without updates, then reset the chief-of-staff runtime session.`,
  });

  return staleRun.run.id;
}

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
      await appendRecentEvent(ctx, companyId, {
        kind: "chief-of-staff-wakeup-skipped",
        title: `Skipped chief-of-staff wakeup: ${input.title}`,
        issueId:
          input.eventIssueId
          ?? (typeof input.payload.issueId === "string" ? input.payload.issueId : undefined),
        detail: `Suppressed by cooldown with ${CHIEF_OF_STAFF_WAKEUP_COOLDOWN_MS - elapsed}ms remaining.`,
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

  await recoverStaleChiefOfStaffRunIfNeeded(
    ctx,
    companyId,
    agent,
    input.eventIssueId
      ?? (typeof input.payload.issueId === "string" ? input.payload.issueId : undefined),
  ).catch(async (error) => {
    ctx.logger.warn("chief-of-staff stale-run recovery failed", {
      companyId,
      agentId: agent.id,
      error: error instanceof Error ? error.message : String(error),
    });
    await appendRecentEvent(ctx, companyId, {
      kind: "chief-of-staff-wakeup-skipped",
      title: `Failed stale-run recovery before chief-of-staff wake: ${input.title}`,
      issueId:
        input.eventIssueId
        ?? (typeof input.payload.issueId === "string" ? input.payload.issueId : undefined),
      detail: error instanceof Error ? error.message : String(error),
    });
  });

  await appendRecentEvent(ctx, companyId, {
    kind: "chief-of-staff-wakeup",
    title: input.title,
    issueId:
      input.eventIssueId
      ?? (typeof input.payload.issueId === "string" ? input.payload.issueId : undefined),
    detail: input.detail,
  });

  let wakeResult: Awaited<ReturnType<typeof ctx.agents.wakeup>> | null = null;
  try {
    wakeResult = await ctx.agents.wakeup(agent.id, companyId, {
      source: "automation",
      triggerDetail: "system",
      reason: input.reason,
      payload: input.payload,
      idempotencyKey: input.idempotencyKey,
    });
    chiefOfStaffLastWakeupByCompany.set(companyId, Date.now());
  } catch (error) {
    await appendRecentEvent(ctx, companyId, {
      kind: "chief-of-staff-wakeup-failed",
      title: `Failed chief-of-staff wakeup: ${input.title}`,
      issueId:
        input.eventIssueId
        ?? (typeof input.payload.issueId === "string" ? input.payload.issueId : undefined),
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

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
  await recoverIssueExecutionLockIfNeeded(ctx, companyId, issue, {
    commentPrefix: "Automation cleared a stale execution lock before dispatching this issue again.",
  }).catch(() => undefined);
  const dispatchedAt = nowIso();

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

  const preservePreferredLane = shouldPreservePreferredExecutionLane({
    title: issue.title,
    preferredAssignee: input.assigneeKey,
    parentId: issue.parentId ?? null,
  });
  let resolution = await resolveAssignableAgent(
    ctx,
    companyId,
    config,
    input.assigneeKey,
    {
      allowFallback: !preservePreferredLane,
      revivePreferredAgent: true,
      taskKey: issue.id,
    },
  ).catch(() => null);
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
    resolution = await resolveAssignableAgent(
      ctx,
      companyId,
      config,
      resolution.selectedKey,
      {
        allowFallback: !preservePreferredLane,
        revivePreferredAgent: preservePreferredLane,
        taskKey: issue.id,
      },
    ).catch(() => resolution);
  }
  if (!agent || !resolution || isAgentUnavailable(agent) || !agentHasDesiredAdapter(agent, resolution.selectedKey)) {
    return null;
  }
  if (!preservePreferredLane && resolution.rerouted && issue.assigneeAgentId !== agent.id) {
    await cancelIssueExecutionRunIfNeeded(issue, resolution.selectedKey).catch(() => undefined);
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
  });

  const [refreshedIssue, runtimeSession] = await Promise.all([
    ctx.issues.get(issue.id, companyId).catch(() => issue),
    getLatestSessionForIssue(ctx, companyId, issue.id).catch(() => null),
  ]);
  const dispatchVerification = verifyDispatchWake({
    wakeRunId: asString(wakeResult?.runId) ?? null,
    expectedAssigneeKey: resolution.selectedKey,
    issueExecutionRunId: refreshedIssue?.executionRunId ?? null,
    issueExecutionAgentNameKey: refreshedIssue?.executionAgentNameKey ?? null,
    runtimeSession: runtimeSession
      ? {
        agentKey: runtimeSession.agentKey,
        status: runtimeSession.status,
        updatedAt: runtimeSession.updatedAt,
      }
      : null,
    dispatchedAt,
  });
  if (!dispatchVerification.verified) {
    await ctx.issues.createComment(
      issue.id,
      [
        "Automation wakeup verification failed for this execution issue.",
        `- Expected owner: ${formatAgentName(resolution.selectedKey)}`,
        "- Wakeup was requested, but Paperclip did not expose a fresh run/session proof yet.",
        "- Next move: inspect the runtime lane before assuming the issue is actively executing.",
      ].join("\n"),
      companyId,
    ).catch(() => undefined);
    await appendRecentEvent(ctx, companyId, {
      kind: "issue-dispatch-unverified",
      title: issue.title,
      issueId: issue.id,
      detail: `${resolution.selectedKey} wakeup lacked execution proof.`,
    });
    return null;
  }

  const nextState: ExecutionDispatchState = {
    ...dispatchState,
    [issue.id]: {
      signature,
      assignee: resolution.selectedKey,
      dispatchedAt,
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
    if (agent.adapterType === "hermes_local") {
      const cfg = asRecord(agent.adapterConfig) ?? {};
      const modelStr = typeof cfg.model === "string" ? cfg.model.trim() : "";
      if (
        modelStr
        && (isIncompatibleHermesFreeRoutingModel(modelStr) || isDisallowedHermesFallbackModel(modelStr))
      ) {
        await ctx.agents.update(
          agent.id,
          { adapterConfig: buildHermesFallbackAdapterConfig(cfg) },
          companyId,
        );
        await ctx.agents.resetRuntimeSession(agent.id, companyId);
        repaired.push(
          `${agent.urlKey}:hermes_local:repaired-invalid-model:${modelStr}`,
        );
        continue;
      }
    }

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

  const staleRecovered = await recoverStaleAgentRuns(ctx, companyId).catch(() => [] as string[]);
  repaired.push(...staleRecovered);

  if (repaired.length > 0) {
    await appendRecentEvent(ctx, companyId, {
      kind: "agent-topology-repaired",
      title: "Reconciled live agent adapter drift",
      detail: repaired.join(", "),
    });
  }

  return repaired;
}

function ensureStartupMaintenance(ctx: PluginContext) {
  if (startupMaintenancePromise) {
    return startupMaintenancePromise;
  }

  startupMaintenancePromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      void (async () => {
        try {
          const config = await getConfig(ctx);
          const company = await findCompany(ctx, config.companyName);
          await syncDoctrineMemoryStore(ctx, company.id);
          await clearWorkspaceCooldownsIfForcedCodexMode(ctx, company.id);
          await enforceWorkspaceAdapterCooldowns(ctx, company.id);
          await healAgentExecutionTopology(ctx, company.id);
          await syncAgentRuntimeMetadata(ctx, company.id);
          await syncAllAgentRegistryRows(ctx, config, company.id);
        } catch (error) {
          ctx.logger.warn("startup automation maintenance failed", {
            meta: {
              stack: error instanceof Error ? error.stack : undefined,
            },
          });
        } finally {
          resolve();
        }
      })();
    }, 0);
  });

  return startupMaintenancePromise;
}

async function recoverLogicalSucceededRunFailures(
  ctx: PluginContext,
  companyId: string,
) {
  const runs = await fetchHeartbeatRuns(companyId, LOGICAL_SUCCEEDED_RUN_SCAN_LIMIT).catch(() => []);
  const cutoff = Date.now() - LOGICAL_SUCCEEDED_RUN_LOOKBACK_MS;
  const recentSucceededRuns = (Array.isArray(runs) ? runs : [])
    .filter((run) => (asString(run.status) ?? "").trim().toLowerCase() === "succeeded")
    .filter((run) => safeDateRank(run.createdAt) >= cutoff)
    .sort((left, right) => safeDateRank(right.createdAt) - safeDateRank(left.createdAt));

  for (const run of recentSucceededRuns) {
    const logText = await fetchHeartbeatRunLog(run.id);
    const payload = buildLogicalSucceededRunFailurePayload(run, logText);
    if (!payload?.agentId || !payload.runId || !payload.error) {
      continue;
    }
    await handleAgentRunFailureQuotaFallback(ctx, {
      companyId,
      payload,
    });
  }
}

function ensureLogicalSucceededRunRecovery(ctx: PluginContext) {
  if (logicalSucceededRunRecoveryStarted) {
    return;
  }
  logicalSucceededRunRecoveryStarted = true;

  const runRecovery = async () => {
    try {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await recoverLogicalSucceededRunFailures(ctx, company.id);
    } catch (error) {
      ctx.logger.warn("logical succeeded-run recovery failed", {
        meta: {
          stack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
  };

  setTimeout(() => {
    void runRecovery();
  }, 0);
  setInterval(() => {
    void runRecovery();
  }, LOGICAL_SUCCEEDED_RUN_RECOVERY_INTERVAL_MS);
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

    const preservePreferredLane = shouldPreservePreferredExecutionLane({
      title: issue.title,
      preferredAssignee: assignee.urlKey,
      parentId: issue.parentId ?? null,
    });
    if (preservePreferredLane) {
      await resolveAssignableAgent(
        ctx,
        companyId,
        config,
        assignee.urlKey ?? "",
        {
          allowFallback: false,
          revivePreferredAgent: true,
          taskKey: issue.id,
        },
      ).catch(() => undefined);
      const refreshedAssignee = await ctx.agents.get(assignee.id, companyId).catch(() => assignee);
      if (!isAgentUnavailable(refreshedAssignee) && agentHasDesiredAdapter(refreshedAssignee, refreshedAssignee.urlKey ?? "")) {
        continue;
      }
      await appendRecentEvent(ctx, companyId, {
        kind: "issue-owner-recovery-pending",
        title: `Recovery pending for ${issue.title}`,
        issueId: issue.id,
        detail: `${issue.identifier}:${assignee.urlKey} remains unavailable after an automatic recovery attempt; preserving specialist ownership.`,
      });
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

    await cancelIssueExecutionRunIfNeeded(issue, fallback.urlKey ?? fallback.id).catch(() => undefined);
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
  options?: {
    skipScaffolding?: boolean;
    deadlineMs?: number;
    skipRoutingRepairs?: boolean;
  },
) {
  const deadlineMs = options?.deadlineMs ?? (Date.now() + EXECUTION_DISPATCH_MAX_RUNTIME_MS);
  const hasTimeLeft = () => Date.now() < deadlineMs;
  const enforcedCloseouts = await autoResolveManagedIssuesFromCloseoutComments(ctx, companyId, {
    deadlineMs,
    maxIssues: 20,
  }).catch(() => [] as string[]);
  const collapsedBlockedFollowUps = await collapseRecursiveBlockedFollowUps(ctx, companyId, {
    deadlineMs,
    maxIssues: 20,
  }).catch(() => [] as string[]);
  if (!hasTimeLeft()) {
    await appendRecentEvent(ctx, companyId, {
      kind: "execution-dispatch-budget-exhausted",
      title: "Execution dispatch exited early after exhausting its runtime budget",
      detail: `Budget: ${EXECUTION_DISPATCH_MAX_RUNTIME_MS}ms`,
    }).catch(() => undefined);
    return {
      dispatched: 0,
      enforcedCloseouts,
      collapsedBlockedFollowUps,
    };
  }
  if (!options?.skipRoutingRepairs) {
    await healAgentExecutionTopology(ctx, companyId).catch(() => undefined);
    await rerouteUnavailableIssueOwners(ctx, companyId, config).catch(() => undefined);
    await repairManagedIssueRouting(ctx, companyId, config).catch(() => undefined);
  }
  if (!options?.skipScaffolding) {
    await runDelegationScaffoldingPass(ctx, companyId);
  }
  const issues = await listAllIssues(ctx, companyId);
  const sourceMappings = await listSourceMappings(ctx, companyId).catch(() => []);
  const sourceMappingByIssueId = buildSourceMappingIndexByIssueId(sourceMappings);
  const dispatched: string[] = [];

  for (const issue of issues) {
    if (!hasTimeLeft()) {
      await appendRecentEvent(ctx, companyId, {
        kind: "execution-dispatch-budget-exhausted",
        title: "Execution dispatch exited early after exhausting its runtime budget",
        detail: `Dispatched ${dispatched.length} issue(s) before hitting the ${EXECUTION_DISPATCH_MAX_RUNTIME_MS}ms budget.`,
      }).catch(() => undefined);
      break;
    }
    if (!issue.assigneeAgentId || !issueNeedsExecution(issue.status)) {
      continue;
    }
    if (isReferenceNotionBacklogIssue(issue, sourceMappingByIssueId)) {
      continue;
    }
    if (hoursSinceTimestamp(issue.updatedAt, Date.now()) * 60 * 60 * 1000 < MEANINGFUL_PROGRESS_GRACE_MS) {
      continue;
    }

    const assignee = await ctx.agents.get(issue.assigneeAgentId, companyId).catch(() => null);
    if (!assignee) {
      continue;
    }
    if (assignee.urlKey === getChiefOfStaffAgentKey(config) && !isDelegatedExecutionIssue(issue)) {
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

  return {
    dispatched: dispatched.length,
    enforcedCloseouts,
    collapsedBlockedFollowUps,
  };
}

async function runRoutingMaintenanceAction(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
) {
  const healedAgents = await healAgentExecutionTopology(ctx, companyId);
  const syncedRuntimeMetadata = await syncAgentRuntimeMetadata(ctx, companyId);
  const unavailableOwnerReroutes = await rerouteUnavailableIssueOwners(ctx, companyId, config);
  const routingRepair = await repairManagedIssueRouting(ctx, companyId, config);
  const scaffolding = await runDelegationScaffoldingPass(ctx, companyId);
  const dispatch = await runExecutionDispatchJob(ctx, companyId, config, { skipScaffolding: true });

  await appendRecentEvent(ctx, companyId, {
    kind: "routing-maintenance",
    title: "Routing maintenance completed",
    detail: [
      healedAgents.length > 0 ? `healed agents: ${healedAgents.join(", ")}` : null,
      syncedRuntimeMetadata.length > 0 ? `runtime sync: ${syncedRuntimeMetadata.join(", ")}` : null,
      unavailableOwnerReroutes.length > 0 ? `unavailable reroutes: ${unavailableOwnerReroutes.join(", ")}` : null,
      routingRepair.repaired.length > 0 ? `routing repairs: ${routingRepair.repaired.map((entry) => `${entry.issueId}:${entry.from}->${entry.to}`).join(", ")}` : null,
      scaffolding.quarantined.length > 0 ? `quarantined smoke: ${scaffolding.quarantined.join(", ")}` : null,
      scaffolding.delegated.length > 0 ? `delegated backlog: ${scaffolding.delegated.join(", ")}` : null,
      scaffolding.corrected.length > 0 ? `corrected delegated routing: ${scaffolding.corrected.join(", ")}` : null,
      scaffolding.recoveredParents.length > 0 ? `cleared parent parking: ${scaffolding.recoveredParents.join(", ")}` : null,
      dispatch.enforcedCloseouts.length > 0 ? `enforced closeouts: ${dispatch.enforcedCloseouts.join(", ")}` : null,
      dispatch.collapsedBlockedFollowUps.length > 0 ? `collapsed blocker chains: ${dispatch.collapsedBlockedFollowUps.join(", ")}` : null,
      dispatch.dispatched > 0 ? `execution dispatches: ${dispatch.dispatched}` : null,
    ].filter(Boolean).join(" | "),
  });

  return {
    healedAgents,
    syncedRuntimeMetadata,
    unavailableOwnerReroutes,
    routingRepair,
    scaffolding,
    dispatch,
  };
}

async function readMaintenanceState(ctx: PluginContext, companyId: string): Promise<MaintenanceState> {
  const state = await readState<MaintenanceState>(ctx, companyId, STATE_KEYS.maintenance) ?? {
    running: false,
    startedAt: null,
    finishedAt: null,
    lastError: null,
    lastResult: null,
  };
  const normalized = normalizeMaintenanceState(state, nowIso());
  if (normalized.changed) {
    await writeState(ctx, companyId, STATE_KEYS.maintenance, normalized.state).catch(() => undefined);
  }
  return normalized.state;
}

async function writeMaintenanceState(
  ctx: PluginContext,
  companyId: string,
  value: MaintenanceState,
) {
  await writeState(ctx, companyId, STATE_KEYS.maintenance, value);
}

function summarizeMaintenanceResult(result: Awaited<ReturnType<typeof runRoutingMaintenanceAction>>) {
  return {
    healedAgents: result.healedAgents.length,
    syncedRuntimeMetadata: result.syncedRuntimeMetadata.length,
    unavailableOwnerReroutes: result.unavailableOwnerReroutes.length,
    routingRepairs: result.routingRepair.repaired.length,
    quarantinedSmoke: result.scaffolding.quarantined.length,
    delegatedBacklog: result.scaffolding.delegated.length,
    correctedDelegations: result.scaffolding.corrected.length,
    recoveredParentParking: result.scaffolding.recoveredParents.length,
    enforcedCloseouts: result.dispatch.enforcedCloseouts.length,
    collapsedBlockedFollowUps: result.dispatch.collapsedBlockedFollowUps.length,
    executionDispatches: result.dispatch.dispatched,
  };
}

function startRoutingMaintenanceRun(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
) {
  setTimeout(() => {
    void (async () => {
      const existing = await readMaintenanceState(ctx, companyId);
      if (existing.running) {
        return;
      }
      const startedAt = nowIso();
      await writeMaintenanceState(ctx, companyId, {
        running: true,
        startedAt,
        finishedAt: null,
        lastError: null,
        lastResult: null,
      });

      try {
        const result = await runRoutingMaintenanceAction(ctx, companyId, config);
        await writeMaintenanceState(ctx, companyId, {
          running: false,
          startedAt,
          finishedAt: nowIso(),
          lastError: null,
          lastResult: summarizeMaintenanceResult(result),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await appendRecentEvent(ctx, companyId, {
          kind: "routing-maintenance-failed",
          title: "Routing maintenance failed",
          detail: message,
        }).catch(() => undefined);
        await writeMaintenanceState(ctx, companyId, {
          running: false,
          startedAt,
          finishedAt: nowIso(),
          lastError: message,
          lastResult: null,
        });
      }
    })();
  }, 0);
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
  const session = await getLatestSessionForIssue(ctx, companyId, issueId).catch(() => null);
  if (session) {
    await traceSessionArtifactsFromComment(
      ctx,
      companyId,
      session.id,
      input.issueComment,
      "Captured proof links from issue finalization.",
    ).catch(() => undefined);
    await createRuntimeCheckpoint(
      ctx,
      companyId,
      session.id,
      `issue-finalized:${input.outcome}`,
    ).catch(() => undefined);
    await updateRuntimeSessionStatus(
      ctx,
      companyId,
      session.id,
      input.outcome === "done" ? "completed" : "blocked",
      `Issue finalized with outcome ${input.outcome}.`,
    ).catch(() => undefined);
  }
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
  await wakeChiefOfStaff(ctx, event.companyId, config, {
    reason: event.type,
    idempotencyKey: `chief-of-staff:${event.type}:${event.eventId}`,
    payload: {
      signalType: event.type,
      issueId: issue.id,
      signalIssueId: issue.id,
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

function latestSubstantiveBlockedComment(comments: IssueComment[]) {
  const ignoredPrefixes = [
    "automation refresh",
    "automation rerouted this issue",
    "automation rerouted this execution issue",
    "created follow-up blocker issue",
    "repo scan cleared",
  ];

  const ordered = [...comments].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
  return ordered.find((comment) => {
    const body = comment.body.trim().toLowerCase();
    if (!body) return false;
    return !ignoredPrefixes.some((prefix) => body.startsWith(prefix));
  }) ?? null;
}

function findNearestBlockedFollowUpAncestor(
  issue: Issue,
  issuesById: Map<string, Issue>,
) {
  const familyKey = blockedFollowUpFamilyKey(issue.title);
  let currentParentId = issue.parentId;
  while (currentParentId) {
    const parent = issuesById.get(currentParentId) ?? null;
    if (!parent) {
      break;
    }
    if (
      !["done", "cancelled"].includes(parent.status)
      && isBlockedFollowUpTitle(parent.title)
      && blockedFollowUpFamilyKey(parent.title) === familyKey
    ) {
      return parent;
    }
    currentParentId = parent.parentId;
  }
  return null;
}

async function collapseRecursiveBlockedFollowUps(
  ctx: PluginContext,
  companyId: string,
  options?: {
    deadlineMs?: number;
    maxIssues?: number;
  },
) {
  const issues = await listAllIssues(ctx, companyId);
  const issuesById = new Map(issues.map((issue) => [issue.id, issue] as const));
  const collapsed: string[] = [];
  const deadlineMs = options?.deadlineMs ?? Number.POSITIVE_INFINITY;
  const maxIssues = options?.maxIssues ?? Number.POSITIVE_INFINITY;
  const candidates = issues
    .filter((issue) => !["done", "cancelled"].includes(issue.status) && isBlockedFollowUpTitle(issue.title))
    .sort((left, right) => Date.parse(toIsoTimestamp(right.updatedAt)) - Date.parse(toIsoTimestamp(left.updatedAt)))
    .slice(0, maxIssues);

  for (const issue of candidates) {
    if (Date.now() >= deadlineMs) {
      break;
    }
    const ancestor = findNearestBlockedFollowUpAncestor(issue, issuesById);
    if (!ancestor) {
      continue;
    }

    await ctx.issues.createComment(
      ancestor.id,
      `Automation merged recursive blocker follow-up ${issue.id} back into this canonical unblock thread.`,
      companyId,
    ).catch(() => undefined);
    await ctx.issues.update(issue.id, { status: "cancelled" }, companyId).catch(() => undefined);
    await ctx.issues.createComment(
      issue.id,
      `Automation cancelled this recursive blocker follow-up because ancestor ${ancestor.id} already owns the same unblock path.`,
      companyId,
    ).catch(() => undefined);
    collapsed.push(`${issue.identifier ?? issue.id}->${ancestor.identifier ?? ancestor.id}`);
  }

  if (collapsed.length > 0) {
    await appendRecentEvent(ctx, companyId, {
      kind: "blocked-follow-ups-collapsed",
      title: "Collapsed recursive blocker follow-ups",
      detail: collapsed.join(", "),
    });
  }

  return collapsed;
}

async function maybeCreateBlockedIssueFollowUp(
  ctx: PluginContext,
  companyId: string,
  issueId: string,
) {
  const issue = await ctx.issues.get(issueId, companyId);
  if (!issue || issue.status !== "blocked") {
    return null;
  }

  const executionRecovered = await recoverIssueExecutionLockIfNeeded(ctx, companyId, issue, {
    commentPrefix: "Automation cleared a stale execution lock instead of creating another unblock child.",
  }).catch(() => ({ recovered: false, reason: null as string | null }));
  if (executionRecovered.recovered) {
    return null;
  }

  const [config, issues, agents, projects, comments] = await Promise.all([
    getConfig(ctx),
    listAllIssues(ctx, companyId),
    listAgents(ctx, companyId),
    listProjects(ctx, companyId),
    listCommentsForIssue(ctx, companyId, issueId).catch(() => [] as IssueComment[]),
  ]);

  const activeChildren = issues.filter((candidate) =>
    candidate.parentId === issue.id && !["done", "cancelled"].includes(candidate.status),
  );
  if (activeChildren.length > 0) {
    return null;
  }

  const projectNameById = new Map(projects.map((project) => [project.id, project.name] as const));
  const agentKeyById = new Map(
    agents.map((agent) => [
      agent.id,
      normalizedCandidates(agent as unknown as Record<string, unknown>)[0] ?? agent.id,
    ] as const),
  );

  const followUpPlan = planBlockedIssueFollowUp(
    {
      identifier: issue.identifier,
      title: issue.title,
      status: issue.status,
      description: issue.description ?? null,
      projectName: issue.projectId ? (projectNameById.get(issue.projectId) ?? null) : null,
      currentAssignee: issue.assigneeAgentId ? (agentKeyById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId) : null,
      blockerSummary: latestSubstantiveBlockedComment(comments)?.body ?? null,
      hasOpenChild: activeChildren.length > 0,
    },
    {
      chiefOfStaffAgent: getChiefOfStaffAgentKey(config),
      ctoAgent: "blueprint-cto",
      executiveOpsProjectName: EXECUTIVE_OPS_PROJECT,
      repoCatalog: config.repoCatalog ?? DEFAULT_REPO_CATALOG,
      opsAgents: {
        opsLead: getOpsRoutingConfig(config).opsLead,
        intake: getOpsRoutingConfig(config).intakeAgent,
        captureQa: getOpsRoutingConfig(config).captureQaAgent,
        fieldOps: getOpsRoutingConfig(config).fieldOpsAgent,
        financeSupport: getOpsRoutingConfig(config).financeSupportAgent,
      },
      growthAgents: {
        growthLead: getGrowthRoutingConfig(config).growthLead,
        conversionOptimizer: getGrowthRoutingConfig(config).conversionOptimizer,
        analytics: "analytics-agent",
        communityUpdates: "community-updates-agent",
        marketIntel: "market-intel-agent",
        demandIntel: "demand-intel-agent",
        robotTeamGrowth: "robot-team-growth-agent",
        siteOperatorPartnership: "site-operator-partnership-agent",
        cityDemand: "city-demand-agent",
      },
    },
  );

  if (!followUpPlan) {
    return null;
  }

  return await createFollowUpIssue(ctx, companyId, {
    parentIssueId: issue.id,
    title: followUpPlan.title,
    description: followUpPlan.description,
    projectName: followUpPlan.projectName,
    assignee: followUpPlan.assignee,
    priority: issue.priority,
  });
}

function buildDelegationScaffoldingConfig(config: BlueprintAutomationConfig) {
  const opsAgents = config.opsDepartment?.agents;
  const growthAgents = config.growthDepartment?.agents;
  return {
    chiefOfStaffAgent: getChiefOfStaffAgentKey(config),
    ctoAgent: "blueprint-cto",
    executiveOpsProjectName: EXECUTIVE_OPS_PROJECT,
    repoCatalog: config.repoCatalog ?? DEFAULT_REPO_CATALOG,
    opsAgents: {
      opsLead: opsAgents?.opsLead ?? "ops-lead",
      intake: opsAgents?.intake ?? "intake-agent",
      captureQa: opsAgents?.captureQa ?? "capture-qa-agent",
      fieldOps: opsAgents?.fieldOps ?? "field-ops-agent",
      financeSupport: opsAgents?.financeSupport ?? "finance-support-agent",
    },
    growthAgents: {
      growthLead: growthAgents?.growthLead ?? "growth-lead",
      conversionOptimizer: growthAgents?.conversionOptimizer ?? "conversion-agent",
      analytics: growthAgents?.analytics ?? "analytics-agent",
      communityUpdates: growthAgents?.communityUpdates ?? "community-updates-agent",
      marketIntel: growthAgents?.marketIntel ?? "market-intel-agent",
      demandIntel: growthAgents?.demandIntel ?? "demand-intel-agent",
      robotTeamGrowth: growthAgents?.robotTeamGrowth ?? "robot-team-growth-agent",
      siteOperatorPartnership: growthAgents?.siteOperatorPartnership ?? "site-operator-partnership-agent",
      cityDemand: growthAgents?.cityDemand ?? "city-demand-agent",
      capturerGrowth: growthAgents?.capturerGrowth ?? "capturer-growth-agent",
    },
  };
}

function isOversightIssueOwnerKey(
  assigneeKey: string | null | undefined,
  config: BlueprintAutomationConfig,
) {
  const normalizedAssignee = (assigneeKey ?? "").trim().toLowerCase();
  if (!normalizedAssignee) {
    return false;
  }

  const opsRouting = getOpsRoutingConfig(config);
  const growthRouting = getGrowthRoutingConfig(config);
  const oversightOwners = new Set([
    getChiefOfStaffAgentKey(config),
    "blueprint-cto",
    opsRouting.opsLead,
    growthRouting.growthLead,
    NOTION_MANAGER_AGENT,
  ]);
  return oversightOwners.has(normalizedAssignee);
}

function isDelegatedExecutionIssue(issue: Issue) {
  if (!issue.parentId || !issueNeedsExecution(issue.status)) {
    return false;
  }

  const originId = asString((issue as unknown as Record<string, unknown>).originId);
  return Boolean(
    (originId && (originId.startsWith("delegation:") || originId.startsWith("blocker:")))
      || /^follow through:/i.test(issue.title)
      || /unblock path/i.test(issue.title),
  );
}

async function repairDelegatedExecutionRouting(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  issues: Issue[],
  agents: Agent[],
  projects: Project[],
) {
  const delegationConfig = buildDelegationScaffoldingConfig(config);
  const projectNameById = new Map(projects.map((project) => [project.id, project.name] as const));
  const agentKeyById = new Map(
    agents.map((agent) => [
      agent.id,
      normalizedCandidates(agent as unknown as Record<string, unknown>)[0] ?? agent.id,
    ] as const),
  );

  const corrected: Array<{ issueId: string; from: string; to: string }> = [];

  for (const issue of issues) {
    if (!isDelegatedExecutionIssue(issue)) {
      continue;
    }

    const currentAssignee = issue.assigneeAgentId
      ? (agentKeyById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId)
      : null;
    if (!currentAssignee || !isOversightIssueOwnerKey(currentAssignee, config)) {
      continue;
    }

    const projectName = issue.projectId ? (projectNameById.get(issue.projectId) ?? null) : null;
    const preferredAssignee = inferExecutionOwnerFromContext(
      {
        title: issue.title,
        description: issue.description,
        projectName,
      },
      delegationConfig,
    );
    if (!preferredAssignee || preferredAssignee === currentAssignee) {
      continue;
    }

    const assigneeResolution = await resolveAssignableAgent(
      ctx,
      companyId,
      config,
      preferredAssignee,
      {
        allowFallback: false,
        revivePreferredAgent: true,
        taskKey: issue.id,
      },
    ).catch(() => null);
    if (!assigneeResolution || issue.assigneeAgentId === assigneeResolution.agent.id) {
      continue;
    }

    await cancelIssueExecutionRunIfNeeded(issue, assigneeResolution.selectedKey).catch(() => undefined);
    await ctx.issues.update(issue.id, { assigneeAgentId: assigneeResolution.agent.id }, companyId);
    await ctx.issues.createComment(
      issue.id,
      [
        "Automation corrected this delegated execution issue so it sits in the owning lane instead of an oversight lane.",
        `- Previous owner: ${formatAgentName(currentAssignee)}`,
        `- Preferred owner: ${formatAgentName(preferredAssignee)}`,
        `- Current owner: ${formatAgentName(assigneeResolution.selectedKey)}`,
      ].join("\n"),
      companyId,
    ).catch(() => undefined);
    corrected.push({
      issueId: issue.identifier ?? issue.id,
      from: currentAssignee,
      to: assigneeResolution.selectedKey,
    });
  }

  return corrected;
}

async function repairParkedParentOwnership(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
  issues: Issue[],
  agents: Agent[],
) {
  const delegationConfig = buildDelegationScaffoldingConfig(config);
  const agentKeyById = new Map(
    agents.map((agent) => [
      agent.id,
      normalizedCandidates(agent as unknown as Record<string, unknown>)[0] ?? agent.id,
    ] as const),
  );

  const recovered: Array<{ issueId: string; from: string; to: string }> = [];

  for (const issue of issues) {
    const currentAssignee = issue.assigneeAgentId
      ? (agentKeyById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId)
      : null;
    if (!currentAssignee || !isOversightIssueOwnerKey(currentAssignee, config)) {
      continue;
    }

    const activeChild = issues.find((candidate) =>
      candidate.parentId === issue.id
      && !["done", "cancelled"].includes(candidate.status)
      && isDelegatedExecutionIssue(candidate),
    );
    if (!activeChild || !activeChild.assigneeAgentId) {
      continue;
    }

    const childAssignee = agentKeyById.get(activeChild.assigneeAgentId) ?? activeChild.assigneeAgentId;
    const recoveryPlan = planParentParkingRecovery(
      {
        status: issue.status,
        currentAssignee,
        childAssignee,
        childStatus: activeChild.status,
      },
      delegationConfig,
    );
    if (!recoveryPlan) {
      continue;
    }

    const assigneeResolution = await resolveAssignableAgent(
      ctx,
      companyId,
      config,
      recoveryPlan.assignee,
    ).catch(() => null);
    if (!assigneeResolution || issue.assigneeAgentId === assigneeResolution.agent.id) {
      continue;
    }
    if (isOversightIssueOwnerKey(assigneeResolution.selectedKey, config)) {
      continue;
    }

    await ctx.issues.update(issue.id, { assigneeAgentId: assigneeResolution.agent.id }, companyId);
    await ctx.issues.createComment(
      issue.id,
      [
        "Automation cleared temporary oversight parking on this parent issue.",
        `- Previous owner: ${formatAgentName(currentAssignee)}`,
        `- Active execution child: ${activeChild.identifier ?? activeChild.id} (${activeChild.title})`,
        `- New owner: ${formatAgentName(assigneeResolution.selectedKey)}`,
        `- Reason: ${recoveryPlan.reason}`,
      ].join("\n"),
      companyId,
    ).catch(() => undefined);

    recovered.push({
      issueId: issue.identifier ?? issue.id,
      from: currentAssignee,
      to: assigneeResolution.selectedKey,
    });
  }

  return recovered;
}

async function createDelegatedFollowUpIssue(
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
  const assigneeResolution = await resolveAssignableAgent(
    ctx,
    companyId,
    config,
    routedAssignee,
    {
      allowFallback: false,
      revivePreferredAgent: true,
      taskKey: input.parentIssueId,
    },
  );
  const assignee = assigneeResolution.agent;
  const followUp = await (ctx.issues.create as any)({
    companyId,
    projectId: project.id,
    parentId: input.parentIssueId,
    title: input.title,
    description: `${input.description}\n\n## Delegation Trace\n- Parent issue: ${input.parentIssueId}`,
    priority: normalizeIssuePriority(input.priority, "high"),
    assigneeAgentId: assignee.id,
    status: "todo",
    originKind: ORIGIN_KIND,
    originId: `delegation:${input.parentIssueId}:${input.projectName}:${input.title}`,
  });
  await ctx.issues.createComment(
    input.parentIssueId,
    `Created delegated follow-up issue ${followUp.id}: ${followUp.title}`,
    companyId,
  );
  await appendRecentEvent(ctx, companyId, {
    kind: "delegation-follow-up",
    title: input.title,
    issueId: followUp.id,
    detail: `Parent issue ${input.parentIssueId}`,
  });
  await postSlackActivity(ctx, config, {
    channel: slackChannelForAgent(assigneeResolution.selectedKey),
    title: `Delegated follow-through handed to ${formatAgentName(assigneeResolution.selectedKey)}`,
    summary: [
      `What happened: A chief-owned backlog thread was delegated to ${formatAgentName(assigneeResolution.selectedKey)} for execution.`,
      `Task: ${followUp.title}`,
      `Parent issue: ${input.parentIssueId}`,
      `Project: ${input.projectName}`,
      `Priority: ${formatIssuePriority(followUp.priority) ?? followUp.priority}`,
    ],
  }).catch(() => undefined);
  return followUp;
}

async function maybeCreateChiefOwnedBacklogFollowUp(
  ctx: PluginContext,
  companyId: string,
  issueId: string,
) {
  const [config, issue, issues, agents, projects, sourceMappings] = await Promise.all([
    getConfig(ctx),
    ctx.issues.get(issueId, companyId),
    listAllIssues(ctx, companyId),
    listAgents(ctx, companyId),
    listProjects(ctx, companyId),
    listSourceMappings(ctx, companyId),
  ]);
  if (!issue) {
    return null;
  }

  const activeChildren = issues.filter((candidate) =>
    candidate.parentId === issue.id && !["done", "cancelled"].includes(candidate.status),
  );
  if (activeChildren.length > 0) {
    return null;
  }

  const projectNameById = new Map(projects.map((project) => [project.id, project.name] as const));
  const agentKeyById = new Map(
    agents.map((agent) => [
      agent.id,
      normalizedCandidates(agent as unknown as Record<string, unknown>)[0] ?? agent.id,
    ] as const),
  );
  const mappingByIssueId = buildSourceMappingIndexByIssueId(sourceMappings);
  const source = mappingByIssueId.get(issue.id);
  const plan = planChiefOwnedBacklogDelegation(
    {
      identifier: issue.identifier,
      title: issue.title,
      status: issue.status,
      projectName: issue.projectId ? (projectNameById.get(issue.projectId) ?? null) : null,
      currentAssignee: issue.assigneeAgentId ? (agentKeyById.get(issue.assigneeAgentId) ?? issue.assigneeAgentId) : null,
      hasOpenChild: activeChildren.length > 0,
      source: source
        ? {
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          metadata: (source.metadata ?? {}) as Record<string, unknown>,
        }
        : null,
    },
    buildDelegationScaffoldingConfig(config),
  );

  if (!plan) {
    return null;
  }

  return await createDelegatedFollowUpIssue(ctx, companyId, {
    parentIssueId: issue.id,
    title: plan.title,
    description: plan.description,
    projectName: plan.projectName,
    assignee: plan.assignee,
    priority: issue.priority,
  });
}

async function runDelegationScaffoldingPass(
  ctx: PluginContext,
  companyId: string,
) {
  const [config, issues, sourceMappings] = await Promise.all([
    getConfig(ctx),
    listAllIssues(ctx, companyId),
    listSourceMappings(ctx, companyId),
  ]);
  const mappingByIssueId = buildSourceMappingIndexByIssueId(sourceMappings);
  const quarantined: string[] = [];
  const delegated: string[] = [];
  const corrected: string[] = [];
  const recoveredParents: string[] = [];
  const now = nowIso();

  for (const issue of issues) {
    const source = mappingByIssueId.get(issue.id);
    const parent = issue.parentId ? issues.find((candidate) => candidate.id === issue.parentId) ?? null : null;
    if (shouldQuarantineSmokeArtifact(
      {
        title: issue.title,
        status: issue.status,
        updatedAt: toIsoTimestamp(issue.updatedAt),
        parentStatus: parent?.status ?? null,
        source: source
          ? {
            sourceType: source.sourceType,
            sourceId: source.sourceId,
            metadata: (source.metadata ?? {}) as Record<string, unknown>,
          }
          : null,
      },
      now,
    )) {
      await ctx.issues.update(issue.id, { status: "cancelled" }, companyId).catch(() => undefined);
      await ctx.issues.createComment(
        issue.id,
        "Automation quarantined this smoke-test artifact so test traffic does not stay mixed into the real execution queue.",
        companyId,
      ).catch(() => undefined);
      quarantined.push(issue.identifier);
    }
  }

  const refreshedIssues = quarantined.length > 0
    ? await listAllIssues(ctx, companyId)
    : issues;
  for (const issue of refreshedIssues) {
    const followUp = await maybeCreateChiefOwnedBacklogFollowUp(ctx, companyId, issue.id).catch(() => null);
    if (followUp?.identifier) {
      delegated.push(`${issue.identifier}->${followUp.identifier}`);
    }
  }

  const executionIssues = delegated.length > 0
    ? await listAllIssues(ctx, companyId)
    : refreshedIssues;
  const [agents, projects] = await Promise.all([
    listAgents(ctx, companyId),
    listProjects(ctx, companyId),
  ]);
  const correctedIssues = await repairDelegatedExecutionRouting(
    ctx,
    companyId,
    config,
    executionIssues,
    agents,
    projects,
  );
  corrected.push(
    ...correctedIssues.map((entry) => `${entry.issueId}:${entry.from}->${entry.to}`),
  );
  const parentRecovery = await repairParkedParentOwnership(
    ctx,
    companyId,
    config,
    executionIssues,
    agents,
  );
  recoveredParents.push(
    ...parentRecovery.map((entry) => `${entry.issueId}:${entry.from}->${entry.to}`),
  );

  if (quarantined.length > 0 || delegated.length > 0 || corrected.length > 0 || recoveredParents.length > 0) {
    await appendRecentEvent(ctx, companyId, {
      kind: "delegation-scaffolding",
      title: "Delegation scaffolding maintenance completed",
      detail: [
        quarantined.length > 0 ? `quarantined smoke: ${quarantined.join(", ")}` : null,
        delegated.length > 0 ? `delegated backlog: ${delegated.join(", ")}` : null,
        corrected.length > 0 ? `corrected delegated routing: ${corrected.join(", ")}` : null,
        recoveredParents.length > 0 ? `cleared parent parking: ${recoveredParents.join(", ")}` : null,
      ].filter(Boolean).join(" | "),
    });
  }

  return {
    quarantined,
    delegated,
    corrected,
    recoveredParents,
  };
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

  const assigneeKey = preferredAgentKey(assignee) ?? preferredAssigneeKey;
  const runtimeSession = await ensureRuntimeSession(ctx, event.companyId, {
    issueId: routine.activeIssue?.id ?? null,
    agentKey: assigneeKey,
    status: "starting",
    wakeReason: "routine.run_triggered",
    summary: routine.title,
  });
  await appendRuntimeTraceEvent(ctx, event.companyId, runtimeSession.id, {
    type: "session.resumed",
    actor: "runtime",
    summary: `Routine ${routine.title} triggered execution.`,
    detail: {
      routineId: routine.id,
      issueId: routine.activeIssue?.id ?? null,
      assigneeAgentId: assignee.id,
    },
  });
  await createRuntimeCheckpoint(
    ctx,
    event.companyId,
    runtimeSession.id,
    `routine:${routine.id}:dispatch`,
  );

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
    detail: `${routine.title} triggered execution for ${assignee.urlKey}. Runtime session: ${runtimeSession.id}.`,
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
  const runtimeSession = await ensureRuntimeSession(ctx, event.companyId, {
    issueId,
    agentKey: actorKey,
    status: "running",
    wakeReason: "issue.comment_added",
    summary: fallbackIssueTitle,
  });
  await appendRuntimeTraceEvent(ctx, event.companyId, runtimeSession.id, {
    type: "model.turn_completed",
    actor: "agent",
    summary: `Agent comment added on ${issueIdentifier ?? issueId}.`,
    detail: {
      commentId,
      actorId,
      assigneeAgentId: issue.assigneeAgentId ?? null,
      bodySnippet,
    },
  });
  await traceSessionArtifactsFromComment(
    ctx,
    event.companyId,
    runtimeSession.id,
    bodySnippet,
    `Captured links from ${actorKey} comment.`,
  );

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
      await appendRuntimeTraceEvent(ctx, event.companyId, runtimeSession.id, {
        type: "handoff.created",
        actor: "agent",
        summary: `Structured handoff requested from ${parsed.data.from} to ${parsed.data.to}.`,
        detail: {
          to: parsed.data.to,
          type: parsed.data.type,
          priority: parsed.data.priority,
          expectedOutcome: parsed.data.expectedOutcome,
        },
      });
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
      await appendRuntimeTraceEvent(ctx, event.companyId, runtimeSession.id, {
        type: "subagent.completed",
        actor: "subagent",
        summary: `Structured handoff response returned from ${parsed.data.from}.`,
        detail: {
          to: parsed.data.to,
          outcome: parsed.data.outcome,
          proofLinkCount: parsed.data.proofLinks?.length ?? 0,
        },
      });
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

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

async function readDiskHeadroom(targetPath: string): Promise<DiskHeadroomCheck | null> {
  try {
    const { stdout } = await execFileAsync("df", ["-Pk", targetPath], {
      cwd: process.cwd(),
      timeout: 5_000,
      maxBuffer: 1024 * 1024,
    });
    const lines = stdout.trim().split(/\r?\n/);
    const line = lines[lines.length - 1]?.trim();
    if (!line) return null;
    const parts = line.split(/\s+/);
    if (parts.length < 6) return null;
    const availableBlocks = Number(parts[3] ?? "0");
    const capacityToken = parts[4] ?? "0%";
    const mountedOn = parts.slice(5).join(" ");
    const usedPercent = Number(capacityToken.replace(/%$/, ""));
    const totalBlocks = Number(parts[1] ?? "0");
    return {
      filesystem: parts[0] ?? targetPath,
      mountedOn,
      targetPath,
      totalBytes: totalBlocks * 1024,
      availableBytes: availableBlocks * 1024,
      usedPercent: Number.isFinite(usedPercent) ? usedPercent : 0,
    };
  } catch {
    return null;
  }
}

function classifyDiskHeadroom(check: DiskHeadroomCheck) {
  if (
    check.availableBytes <= HEADROOM_CRITICAL_BYTES
    || check.usedPercent >= HEADROOM_CRITICAL_USED_PERCENT
  ) {
    return "critical" as const;
  }
  if (
    check.availableBytes <= HEADROOM_WARNING_BYTES
    || check.usedPercent >= HEADROOM_WARNING_USED_PERCENT
  ) {
    return "warning" as const;
  }
  return "ok" as const;
}

async function runLocalHeadroomCheckJob(
  ctx: PluginContext,
  companyId: string,
  config: BlueprintAutomationConfig,
) {
  const configuredTargets = [
    process.env.PAPERCLIP_HOME
      ? path.resolve(process.env.PAPERCLIP_HOME)
      : path.resolve(process.cwd(), "..", ".paperclip-blueprint"),
    path.resolve(process.cwd()),
  ];
  const seenTargets = new Set<string>();
  const checks: DiskHeadroomCheck[] = [];
  for (const target of configuredTargets) {
    const resolved = path.resolve(target);
    if (seenTargets.has(resolved)) continue;
    seenTargets.add(resolved);
    const check = await readDiskHeadroom(resolved);
    if (check) checks.push(check);
  }

  if (checks.length === 0) {
    await appendRecentEvent(ctx, companyId, {
      kind: "local-headroom-check",
      title: "Local headroom check skipped",
      detail: "Could not read local disk headroom from any configured target path.",
    });
    return { status: "skipped" as const, checks: [] };
  }

  const uniqueChecks = new Map<string, DiskHeadroomCheck>();
  for (const check of checks) {
    const key = `${check.filesystem}::${check.mountedOn}`;
    if (!uniqueChecks.has(key)) {
      uniqueChecks.set(key, check);
    }
  }

  const normalizedChecks = [...uniqueChecks.values()];
  const statuses = normalizedChecks.map(classifyDiskHeadroom);
  const overallStatus = statuses.includes("critical")
    ? "critical"
    : statuses.includes("warning")
      ? "warning"
      : "ok";
  const chiefOfStaffAgent = config.management?.chiefOfStaffAgent ?? "blueprint-chief-of-staff";

  for (const check of normalizedChecks) {
    const status = classifyDiskHeadroom(check);
    const sourceId = `${check.filesystem}:${check.mountedOn}`;
    const detail = [
      `- Target path: ${check.targetPath}`,
      `- Filesystem: ${check.filesystem}`,
      `- Mount: ${check.mountedOn}`,
      `- Available: ${formatBytes(check.availableBytes)}`,
      `- Total: ${formatBytes(check.totalBytes)}`,
      `- Used: ${check.usedPercent}%`,
    ].join("\n");

    if (status === "ok") {
      await resolveManagedIssue(ctx, {
        companyId,
        sourceType: "local-disk-headroom",
        sourceId,
        resolutionStatus: "done",
        comment: `Local disk headroom recovered.\n${detail}`,
      });
      continue;
    }

    await upsertManagedIssue(ctx, {
      companyId,
      sourceType: "local-disk-headroom",
      sourceId,
      title: `Local disk headroom ${status}: ${check.mountedOn}`,
      description: [
        "Local trusted-host disk headroom is below the configured safety threshold.",
        "",
        detail,
        "",
        "This issue exists so the chief of staff or operator reduces storage pressure before Paperclip logging, backups, or worker IPC degrade again.",
      ].join("\n"),
      projectName: EXECUTIVE_OPS_PROJECT,
      assignee: chiefOfStaffAgent,
      priority: status === "critical" ? "critical" : "high",
      status: "todo",
      metadata: {
        mount: check.mountedOn,
        filesystem: check.filesystem,
        targetPath: check.targetPath,
        availableBytes: check.availableBytes,
        totalBytes: check.totalBytes,
        usedPercent: check.usedPercent,
        severity: status,
      },
      comment: `Local headroom check recorded ${status} disk pressure.\n${detail}`,
      suppressRefreshComment: true,
    });
  }

  await appendRecentEvent(ctx, companyId, {
    kind: "local-headroom-check",
    title: `Local headroom check ${overallStatus}`,
    detail: normalizedChecks
      .map((check) =>
        `${check.mountedOn}: ${formatBytes(check.availableBytes)} free, ${check.usedPercent}% used (${classifyDiskHeadroom(check)})`,
      )
      .join(" | "),
  });
  await writeHealth(
    ctx,
    companyId,
    overallStatus === "ok" ? "ok" : "degraded",
    overallStatus === "ok"
      ? "Local disk headroom is within the configured operating window."
      : "Local disk headroom is below the configured operating window.",
  );

  return {
    status: overallStatus,
    checks: normalizedChecks.map((check) => ({
      ...check,
      severity: classifyDiskHeadroom(check),
    })),
  };
}

function mergeBlueprintRuntimeConfig(
  runtimeConfig: Record<string, unknown> | null,
  agentKey: string,
) {
  const metadata = buildBlueprintRuntimeMetadata(agentKey);
  if (!metadata) {
    return runtimeConfig;
  }
  const environmentProfile = loadEnvironmentProfile(metadata.version.environment_profile);
  return {
    ...(runtimeConfig ?? {}),
    blueprintRuntime: {
      agentKey,
      channelRef: metadata.channelRef,
      agentVersionRef: metadata.agentVersionRef,
      environmentProfileKey: metadata.version.environment_profile,
      memoryBindings: [
        ...(metadata.manifest.memory_bindings ?? []),
        ...(metadata.version.memory_bindings ?? []),
        ...(environmentProfile?.memory?.bind ?? []),
      ].filter((value, index, all) => value && all.indexOf(value) === index),
      vaultPolicy: {
        defaultScope: metadata.version.vault?.default_scope ?? environmentProfile?.vault?.default_scope ?? "session",
        allowedRefs: [
          ...(metadata.version.vault?.allowed_refs ?? []),
          ...(environmentProfile?.vault?.allowed_refs ?? []),
        ].filter((value, index, all) => value && all.indexOf(value) === index),
        allowedTools: [
          ...(metadata.version.vault?.allowed_tools ?? []),
          ...(environmentProfile?.vault?.allowed_tools ?? []),
        ].filter((value, index, all) => value && all.indexOf(value) === index),
      },
      syncedAt: nowIso(),
    },
  };
}

async function syncAgentRuntimeMetadata(
  ctx: PluginContext,
  companyId: string,
  agents?: Agent[],
) {
  const targetAgents = agents ?? await listAgents(ctx, companyId);
  const synced: string[] = [];

  for (const agent of targetAgents) {
    const agentKey = preferredAgentKey(agent);
    if (!agentKey) {
      continue;
    }
    const nextRuntimeConfig = mergeBlueprintRuntimeConfig(asRecord(agent.runtimeConfig), agentKey);
    if (!nextRuntimeConfig) {
      continue;
    }
    const currentJson = JSON.stringify(asRecord(agent.runtimeConfig) ?? {});
    const nextJson = JSON.stringify(nextRuntimeConfig);
    if (currentJson === nextJson) {
      continue;
    }
    await ctx.agents.update(agent.id, { runtimeConfig: nextRuntimeConfig }, companyId);
    synced.push(agentKey);
  }

  if (synced.length > 0) {
    await appendRecentEvent(ctx, companyId, {
      kind: "runtime-version-sync",
      title: "Synced file-backed runtime metadata",
      detail: synced.join(", "),
    }).catch(() => undefined);
  }

  return synced;
}

async function startPilotAgentRunMirror(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  input: {
    agentKey: PilotAgentKey;
    title: string;
    triggerSource: PilotRunFinalizeInput["triggerSource"];
    issueId?: string;
    startedAt: string;
    notes?: string;
  },
): Promise<PilotRunMirror | null> {
  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );
  if (!notionToken) {
    return null;
  }

  const notionClient = createNotionClient({ token: notionToken });
  const registryEntry = await upsertAgentRegistryEntry(
    notionClient,
    {
      title: pilotAgentTitle(input.agentKey),
      canonicalKey: input.agentKey,
      department: pilotAgentDepartment(input.agentKey),
      role: pilotAgentRole(input.agentKey),
      primaryRuntime: pilotAgentRuntime(input.agentKey),
      notionSurfaces: pilotAgentNotionSurfaces(input.agentKey),
      status: "Pilot",
      humanGates: pilotAgentHumanGates(input.agentKey),
      readableSurfaces: pilotAgentReadableSurfaces(input.agentKey),
      writableSurfaces: pilotAgentWritableSurfaces(input.agentKey),
      toolAccess: pilotAgentToolAccess(input.agentKey),
      paperclipAgentKey: input.agentKey,
      defaultTriggers: ["Schedule", "Manual Wakeup"],
      lastActive: input.startedAt,
      lastRunStatus: "Running",
    },
    { archiveDuplicates: true },
  );

  const runId = randomUUID();
  const runEntry = await createAgentRunEntry(notionClient, {
    title: input.title,
    runId,
    agentPageIds: [registryEntry.pageId],
    agentKey: input.agentKey,
    runtime: pilotAgentRuntime(input.agentKey),
    status: "Running",
    triggerSource: input.triggerSource,
    startedAt: input.startedAt,
    paperclipUrl: resolvePaperclipIssueUrl(input.issueId),
    costClass: input.agentKey === "notion-reconciler" ? "Low" : "Medium",
    notes: input.notes,
  });

  await updatePageMetadata(notionClient, registryEntry.pageId, "agents", {
    latestRunPageIds: [runEntry.pageId],
    lastActive: input.startedAt,
    lastRunStatus: "Running",
  });

  return {
    notionClient,
    agentPageId: registryEntry.pageId,
    runPageId: runEntry.pageId,
    runPageUrl: runEntry.pageUrl,
    runId,
  };
}

async function finalizePilotAgentRunMirror(
  mirror: PilotRunMirror | null,
  input: PilotRunFinalizeInput,
) {
  if (!mirror) {
    return;
  }

  await updatePageMetadata(mirror.notionClient, mirror.runPageId, "agent_runs", {
    runId: mirror.runId,
    status: input.status,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    outputDocPageIds: input.outputDocPageId ? [input.outputDocPageId] : [],
    outputDocPageUrls: input.outputDocPageUrl ? [input.outputDocPageUrl] : [],
    artifactUrl: input.artifactUrl,
    paperclipUrl: resolvePaperclipIssueUrl(input.issueId),
    errorSummary: input.errorSummary,
    requiresHumanReview: input.requiresHumanReview,
    notes: input.notes,
  });

  await updatePageMetadata(mirror.notionClient, mirror.agentPageId, "agents", {
    latestRunPageIds: [mirror.runPageId],
    lastActive: input.endedAt ?? input.startedAt,
    lastRunStatus: mapPilotRunStatusToRegistryStatus(input.status),
  });
}

async function syncPilotAgentRegistryRow(
  ctx: PluginContext,
  companyId: string,
  agent: Agent,
) {
  const agentKey = preferredAgentKey(agent);
  if (!isPilotAgentKey(agentKey)) {
    return;
  }

  const config = await getConfig(ctx);
  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );
  if (!notionToken) {
    return;
  }

  const status = asString((agent as unknown as Record<string, unknown>).status);
  const lastRunStatus =
    status === "running"
      ? "Running"
      : status === "paused"
        ? "Ready"
        : status === "error"
          ? "Failed"
          : "Unknown";

  const notionClient = createNotionClient({ token: notionToken });
  await upsertAgentRegistryEntry(
    notionClient,
    {
      title: pilotAgentTitle(agentKey),
      canonicalKey: agentKey,
      department: pilotAgentDepartment(agentKey),
      role: pilotAgentRole(agentKey),
      primaryRuntime: pilotAgentRuntime(agentKey),
      notionSurfaces: pilotAgentNotionSurfaces(agentKey),
      status: "Pilot",
      humanGates: pilotAgentHumanGates(agentKey),
      readableSurfaces: pilotAgentReadableSurfaces(agentKey),
      writableSurfaces: pilotAgentWritableSurfaces(agentKey),
      toolAccess: pilotAgentToolAccess(agentKey),
      paperclipAgentKey: agentKey,
      defaultTriggers: ["Schedule", "Manual Wakeup"],
      lastRunStatus,
    },
    { archiveDuplicates: true },
  );
}

async function traceSessionArtifactsFromComment(
  ctx: PluginContext,
  companyId: string,
  sessionId: string,
  body: string | null | undefined,
  summary?: string,
) {
  const proofLinks = extractUrls(body);
  if (proofLinks.length === 0) {
    return;
  }
  await addRuntimeSessionArtifacts(ctx, companyId, sessionId, {
    proofLinks,
    summary: summary ?? "Captured proof links from agent comment.",
  });
}

async function syncIssueRuntimeSession(
  ctx: PluginContext,
  companyId: string,
  issueId: string,
) {
  const issue = await ctx.issues.get(issueId, companyId).catch(() => null);
  if (!issue) {
    return null;
  }

  const existing = await getLatestSessionForIssue(ctx, companyId, issue.id);
  if (!issue.assigneeAgentId) {
    if (existing && !isTerminalRuntimeSessionStatus(existing.status)) {
      await updateRuntimeSessionStatus(
        ctx,
        companyId,
        existing.id,
        issueStatusToRuntimeSessionStatus(issue.status, "queued"),
        `Issue ${issue.id} changed without an assignee.`,
      );
    }
    return existing;
  }

  const assignee = await ctx.agents.get(issue.assigneeAgentId, companyId).catch(() => null);
  const agentKey = preferredAgentKey(assignee);
  if (!agentKey) {
    return existing;
  }

  if (
    existing
    && existing.agentKey !== agentKey
    && !isTerminalRuntimeSessionStatus(existing.status)
  ) {
    await updateRuntimeSessionStatus(
      ctx,
      companyId,
      existing.id,
      "cancelled",
      `Runtime ownership moved from ${existing.agentKey} to ${agentKey}.`,
    );
  }

  const session = await ensureRuntimeSession(ctx, companyId, {
    issueId: issue.id,
    agentKey,
    status: issueStatusToRuntimeSessionStatus(issue.status, "queued"),
    summary: issue.title,
    wakeReason: "issue.sync",
  });
  if (session.status !== issueStatusToRuntimeSessionStatus(issue.status, "queued")) {
    await updateRuntimeSessionStatus(
      ctx,
      companyId,
      session.id,
      issueStatusToRuntimeSessionStatus(issue.status, "queued"),
      `Issue ${issue.identifier ?? issue.id} moved to ${issue.status}.`,
    );
  }
  return session;
}

async function traceAgentRunFailureSession(
  ctx: PluginContext,
  companyId: string,
  payload: AgentRunFailurePayload,
) {
  const agent = payload.agentId ? await ctx.agents.get(payload.agentId, companyId).catch(() => null) : null;
  const agentKey = preferredAgentKey(agent) ?? "unknown-agent";
  const session =
    payload.issueId
      ? await ensureRuntimeSession(ctx, companyId, {
        issueId: payload.issueId,
        agentKey,
        status: "failed",
        wakeReason: "agent.run.failed",
        summary: payload.error ?? "Agent run failed.",
      })
      : null;
  if (session) {
    await appendRuntimeTraceEvent(ctx, companyId, session.id, {
      type: "session.failed",
      actor: "runtime",
      summary: payload.error ?? "Agent run failed.",
      detail: {
        runId: payload.runId,
        taskId: payload.taskId,
        taskKey: payload.taskKey,
      },
    });
    await updateRuntimeSessionStatus(
      ctx,
      companyId,
      session.id,
      "failed",
      payload.error ?? "Agent run failed.",
    );
  }
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

function buildSourceMappingIndexByIssueId(
  mappings: PluginEntityRecord[],
): Map<string, SourceMappingData> {
  const index = new Map<string, SourceMappingData>();
  for (const mapping of mappings) {
    const data = (mapping.data ?? {}) as Partial<SourceMappingData>;
    if (typeof data.issueId !== "string" || data.issueId.length === 0) continue;
    if (typeof data.sourceType !== "string" || typeof data.sourceId !== "string") continue;
    index.set(data.issueId, data as SourceMappingData);
  }
  return index;
}

function findSourceMappingRecordByIssueId(
  mappings: PluginEntityRecord[],
  issueId: string,
): { mapping: PluginEntityRecord; data: SourceMappingData } | null {
  for (const mapping of mappings) {
    const data = (mapping.data ?? {}) as Partial<SourceMappingData>;
    if (data.issueId !== issueId) {
      continue;
    }
    if (typeof data.sourceType !== "string" || typeof data.sourceId !== "string") {
      continue;
    }
    return { mapping, data: data as SourceMappingData };
  }
  return null;
}

function buildResolvedWorkQueueItem(
  issueTitle: string,
  mapping: SourceMappingData,
  resolutionStatus: "done" | "cancelled",
): WorkQueueItem | null {
  if (mapping.sourceType !== "notion-work-queue") {
    return null;
  }

  const title = workQueueIssueTitle(issueTitle);
  if (!title) {
    return null;
  }

  const metadata = (mapping.metadata ?? {}) as Record<string, unknown>;
  return normalizeWorkQueueItem(
    {
      title,
      priority: typeof metadata.priority === "string" ? metadata.priority : undefined,
      system: typeof metadata.system === "string" ? metadata.system : undefined,
      businessLane: typeof metadata.businessLane === "string" ? metadata.businessLane : undefined,
      lifecycleStage: workQueueLifecycleStageForResolution(resolutionStatus),
      workType: typeof metadata.workType === "string" ? metadata.workType : undefined,
      substage: typeof metadata.substage === "string" ? metadata.substage : undefined,
      lastStatusChange: nowIso(),
      naturalKey: mapping.sourceId.includes("::") ? mapping.sourceId : undefined,
    },
    true,
  );
}

async function syncResolvedNotionWorkQueuePage(
  ctx: PluginContext,
  mapping: SourceMappingData,
  issueTitle: string,
  resolutionStatus: "done" | "cancelled",
) {
  const queueItem = buildResolvedWorkQueueItem(issueTitle, mapping, resolutionStatus);
  if (!queueItem) {
    return null;
  }

  const config = await getConfig(ctx);
  const notionToken = await resolveOptionalSecret(
    ctx,
    config.secrets?.notionApiTokenRef,
    "NOTION_API_TOKEN",
  );
  if (!notionToken) {
    return null;
  }

  const notionClient = createNotionClient({ token: notionToken });
  const page = await findWorkQueueItemPage(notionClient, queueItem);
  if (!page) {
    return null;
  }

  await updatePageMetadata(notionClient, page.pageId, "work_queue", {
    lifecycleStage: queueItem.lifecycleStage,
    lastStatusChange: queueItem.lastStatusChange,
  });
  return page;
}

function isReferenceNotionBacklogIssue(
  issue: Pick<Issue, "id" | "status">,
  mappingByIssueId: Map<string, SourceMappingData>,
) {
  if (issue.status !== "backlog") return false;
  const mapping = mappingByIssueId.get(issue.id);
  if (!mapping || mapping.sourceType !== "notion-work-queue") return false;
  const metadata = (mapping.metadata ?? {}) as Record<string, unknown>;
  const workType = typeof metadata.workType === "string" ? metadata.workType.trim().toLowerCase() : "";
  return workType === "refresh" || mapping.sourceId.includes("::cross-system::refresh");
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

function notionQueueConflictSourceId(queueKey: string) {
  return `queue-conflict:${queueKey}`;
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

function makeTraceBlock(input: UpsertManagedIssueInput, resolvedAssignee?: string) {
  const lines = [
    "## Automation Trace",
    `- Source type: ${input.sourceType}`,
    `- Source id: ${input.sourceId}`,
    `- Project: ${input.projectName}`,
    `- Assignee: ${resolvedAssignee ?? input.assignee}`,
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

  const companyLabel = config.companyId
    ? `${config.companyName ?? DEFAULT_COMPANY_NAME} (${config.companyId})`
    : (config.companyName ?? DEFAULT_COMPANY_NAME);

  await postSlackDigest(targets, {
    channel: input.channel,
    title: input.title,
    sections: [{ heading: "Update", items: [`Company: ${companyLabel}`, ...input.summary] }],
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
  if (isToolRuntimeFailure(payload.errorCode, payload.error)) {
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
  const failedAdapter = await resolveFailedAdapterSnapshot(agent, payload, desired);
  const hermesProviderAuthFailure =
    failedAdapter.failedAdapterType === "hermes_local" && isProviderAuthFailure(payload.error);
  const localProviderAuthFailure =
    (failedAdapter.failedAdapterType === "claude_local"
     || failedAdapter.failedAdapterType === "codex_local"
     || failedAdapter.failedAdapterType === "hermes_local")
    && isProviderAuthFailure(payload.error);
  if (
    !isQuotaOrRateLimitFailure(payload.error)
    && !isModelNotFoundFailure(payload.error)
    && !hermesProviderAuthFailure
    && !localProviderAuthFailure
  ) {
    return;
  }
  const providerCreditFailure =
    failedAdapter.failedAdapterType === "hermes_local" && isProviderCreditFailure(payload.error);
  const fallback = (hermesProviderAuthFailure || providerCreditFailure)
    ? buildQuotaFallbackDescriptor(
      failedAdapter.failedAdapterType ?? agent.adapterType,
      failedAdapter.failedAdapterConfig,
      desired,
      payload.error,
    )
    : buildQuotaFallbackDescriptor(
      failedAdapter.failedAdapterType ?? agent.adapterType,
      failedAdapter.failedAdapterConfig,
      desired,
      payload.error,
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
  const workspaceKey = getLocalAdapterWorkspaceKey(failedAdapter.failedAdapterConfig);
  const cooldownUntil = resolveQuotaCooldownUntil(payload.error, {
    defaultCooldownMs: WORKSPACE_QUOTA_COOLDOWN_MS,
  });

  try {
    const allAgents = await listAgents(ctx, event.companyId).catch(() => []);
    const agentById = new Map(allAgents.map((entry) => [entry.id, entry]));
    const workspaceTargets = selectWorkspaceQuotaFallbackTargets(
      {
        id: agent.id,
        adapterType: failedAdapter.failedAdapterType ?? agent.adapterType,
        adapterConfig: failedAdapter.failedAdapterConfig,
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
        target.id === agent.id
          ? failedAdapter.failedAdapterType ?? target.adapterType
          : target.adapterType,
        target.id === agent.id
          ? failedAdapter.failedAdapterConfig
          : asRecord(target.adapterConfig),
        targetAgent ? buildDesiredAdapterDescriptor(targetAgent) : null,
        payload.error,
      );
      if (!targetFallback) {
        continue;
      }

      try {
        const targetRuntimeConfig = syncExecutionPolicyToAdapter(
          asRecord(targetAgent?.runtimeConfig),
          targetFallback.adapterType,
        );
        await ctx.agents.update(
          target.id,
          {
            adapterType: targetFallback.adapterType,
            adapterConfig: targetFallback.adapterConfig,
            runtimeConfig: targetRuntimeConfig,
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
      && (failedAdapter.failedAdapterType === "claude_local" ||
        failedAdapter.failedAdapterType === "codex_local" ||
        failedAdapter.failedAdapterType === "hermes_local")
      && fallback.adapterType !== failedAdapter.failedAdapterType
    ) {
      await setWorkspaceCooldown(ctx, event.companyId, {
        workspaceKey,
        unavailableAdapterType: failedAdapter.failedAdapterType,
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
        forceFreshSession: shouldForceFreshSessionForAutomationWake(fallback.reason),
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
        ? `Issue ${payload.issueId} retried from failed run ${payload.runId}; switched ${workspaceTargets.length} same-workspace agent(s) to ${fallback.adapterType}${fallback.adapterType !== failedAdapter.failedAdapterType ? ` until ${cooldownUntil}` : ""}.`
        : `Task ${retryTaskKey} retried from failed run ${payload.runId}; switched ${workspaceTargets.length} same-workspace agent(s) to ${fallback.adapterType}${fallback.adapterType !== failedAdapter.failedAdapterType ? ` until ${cooldownUntil}` : ""}.`,
    });

    if (payload.issueId) {
      const fallbackLabel =
        fallback.adapterType === "hermes_local"
          ? `hermes_local (${asString(fallback.adapterConfig.model) ?? "next free model"})`
          : fallback.adapterType;
      await ctx.issues.createComment(
        payload.issueId,
        `Detected a ${failedAdapter.failedAdapterType ?? agent.adapterType} quota/rate-limit failure on run ${payload.runId}. Switched ${agent.name} and ${Math.max(workspaceTargets.length - 1, 0)} same-workspace peer(s) to ${fallbackLabel}${fallback.adapterType !== failedAdapter.failedAdapterType ? ` until ${cooldownUntil}` : ""}, then requeued the work once.`,
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

async function handleAgentRunFailureFreshSessionRetry(
  ctx: PluginContext,
  event: { companyId: string; payload: unknown },
) {
  const payload = parseAgentRunFailurePayload(event.payload);
  if (!payload.agentId || !payload.runId || !payload.error) {
    return;
  }
  if (isToolRuntimeFailure(payload.errorCode, payload.error)) {
    return;
  }
  if (
    isQuotaOrRateLimitFailure(payload.error)
    || isModelNotFoundFailure(payload.error)
    || !isFreshSessionRetryableFailure(payload.error)
  ) {
    return;
  }

  const existingState =
    await readState<QuotaFallbackRetryState>(ctx, event.companyId, STATE_KEYS.freshSessionRetries) ?? {};
  if (existingState[payload.runId]) {
    return;
  }

  const markAttempt = async (record: ReturnType<typeof buildQuotaFallbackRetryRecord>) => {
    await writeState(ctx, event.companyId, STATE_KEYS.freshSessionRetries, {
      ...existingState,
      [payload.runId as string]: record,
    });
  };

  const agent = await ctx.agents.get(payload.agentId, event.companyId).catch(() => null);
  if (!agent) {
    await markAttempt(
      buildQuotaFallbackRetryRecord({
        attemptedAt: nowIso(),
        status: "skipped",
        agentId: payload.agentId,
        issueId: payload.issueId,
        taskKey: payload.taskKey ?? payload.taskId,
        reason: "fresh_session_retry_skipped",
        note: "Agent not found.",
      }),
    );
    return;
  }

  const retryTaskKey =
    payload.taskKey
    ?? payload.taskId
    ?? payload.issueId
    ?? `fresh-session-retry:${agent.id}:${payload.runId}`;

  try {
    await ctx.agents.resetRuntimeSession(agent.id, event.companyId, {
      taskKey: retryTaskKey,
    }).catch(() => undefined);

    const wakePayload: Record<string, unknown> = {
      retryOfRunId: payload.runId,
      taskKey: retryTaskKey,
    };
    if (payload.issueId) wakePayload.issueId = payload.issueId;
    if (payload.taskId) wakePayload.taskId = payload.taskId;

    const wakeResult = await ctx.agents.wakeup(agent.id, event.companyId, {
      source: "automation",
      triggerDetail: "system",
      reason: "fresh_session_retry_after_context_failure",
      payload: wakePayload,
      idempotencyKey: `fresh-session-retry:${payload.runId}`,
      forceFreshSession: shouldForceFreshSessionForAutomationWake("fresh_session_retry_after_context_failure"),
    });

    await markAttempt(
      buildQuotaFallbackRetryRecord({
        attemptedAt: nowIso(),
        status: "retried",
        agentId: agent.id,
        issueId: payload.issueId,
        taskKey: retryTaskKey,
        reason: "fresh_session_retry_after_context_failure",
        wakeupRunId: asString(wakeResult?.runId) ?? null,
        note: payload.error,
      }),
    );

    await appendRecentEvent(ctx, event.companyId, {
      kind: "fresh-session-retry",
      title: `Retried ${agent.name} on a fresh session after context/output overflow`,
      issueId: payload.issueId ?? undefined,
      detail: payload.issueId
        ? `Issue ${payload.issueId} retried from failed run ${payload.runId} with a fresh session.`
        : `Task ${retryTaskKey} retried from failed run ${payload.runId} with a fresh session.`,
    });

    if (payload.issueId) {
      await ctx.issues.createComment(
        payload.issueId,
        `Detected a context/output-limit failure on run ${payload.runId}. Cleared the runtime session and requeued the work once on a fresh session.`,
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
        reason: "fresh_session_retry_failed",
        note: errorMessage,
      }),
    );

    await appendRecentEvent(ctx, event.companyId, {
      kind: "fresh-session-retry-error",
      title: `Fresh-session retry failed for ${agent.name}`,
      issueId: payload.issueId ?? undefined,
      detail: errorMessage,
    });
  }
}

async function handleAgentRunFailureRuntimeFallback(
  ctx: PluginContext,
  event: { companyId: string; payload: unknown },
) {
  const payload = parseAgentRunFailurePayload(event.payload);
  if (!payload.agentId || !payload.runId || !payload.error) {
    return;
  }
  if (isToolRuntimeFailure(payload.errorCode, payload.error)) {
    return;
  }
  if (!isProviderTimeoutFailure(payload.error) && !isProcessLossFailure(payload.error)) {
    return;
  }

  const existingState =
    await readState<QuotaFallbackRetryState>(ctx, event.companyId, STATE_KEYS.runtimeFailureRetries) ?? {};
  if (existingState[payload.runId]) {
    return;
  }

  const markAttempt = async (record: ReturnType<typeof buildQuotaFallbackRetryRecord>) => {
    await writeState(ctx, event.companyId, STATE_KEYS.runtimeFailureRetries, {
      ...existingState,
      [payload.runId as string]: record,
    });
  };

  const agent = await ctx.agents.get(payload.agentId, event.companyId).catch(() => null);
  if (!agent || agent.adapterType !== "hermes_local") {
    await markAttempt(
      buildQuotaFallbackRetryRecord({
        attemptedAt: nowIso(),
        status: "skipped",
        agentId: payload.agentId,
        issueId: payload.issueId,
        taskKey: payload.taskKey ?? payload.taskId,
        reason: "runtime_failure_fallback_skipped",
        note: !agent ? "Agent not found." : `Adapter ${agent.adapterType} is not hermes_local.`,
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
        reason: "runtime_failure_fallback_skipped",
        note: "No configured runtime fallback for hermes_local.",
      }),
    );
    return;
  }

  const retryTaskKey =
    payload.taskKey ??
    payload.taskId ??
    payload.issueId ??
    `runtime-fallback:${agent.id}:${payload.runId}`;
  const cooldownUntil = resolveQuotaCooldownUntil(payload.error, {
    defaultCooldownMs: 2 * 60 * 60 * 1000,
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

    const agentById = new Map(allAgents.map((entry) => [entry.id, entry]));
    for (const target of workspaceTargets) {
      const targetAgent = target.id === agent.id ? agent : agentById.get(target.id) ?? null;
      const targetRuntimeConfig = syncExecutionPolicyToAdapter(
        asRecord(targetAgent?.runtimeConfig),
        fallback.adapterType,
      );
      await ctx.agents.update(
        target.id,
        {
          adapterType: fallback.adapterType,
          adapterConfig: fallback.adapterConfig,
          runtimeConfig: targetRuntimeConfig,
        },
        event.companyId,
      );
      await ctx.agents.resetRuntimeSession(
        target.id,
        event.companyId,
        target.id === agent.id
          ? {
            taskKey: retryTaskKey,
          }
          : undefined,
      ).catch(() => undefined);
    }

    const workspaceKey = getLocalAdapterWorkspaceKey(asRecord(agent.adapterConfig));
    if (workspaceKey && fallback.adapterType !== agent.adapterType) {
      await setWorkspaceCooldown(ctx, event.companyId, {
        workspaceKey,
        unavailableAdapterType: agent.adapterType,
        fallbackAdapterType: fallback.adapterType,
        cooldownUntil,
        recordedAt: nowIso(),
        reason: isProcessLossFailure(payload.error)
          ? "runtime_process_loss_fallback"
          : "runtime_timeout_fallback",
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

    const wakeResult = await ctx.agents.wakeup(agent.id, event.companyId, {
      source: "automation",
      triggerDetail: "system",
      reason: isProcessLossFailure(payload.error)
        ? "runtime_process_loss_fallback_retry"
        : "runtime_timeout_fallback_retry",
      payload: wakePayload,
      idempotencyKey: `runtime-fallback:${payload.runId}`,
      forceFreshSession: shouldForceFreshSessionForAutomationWake(
        isProcessLossFailure(payload.error)
          ? "runtime_process_loss_fallback_retry"
          : "runtime_timeout_fallback_retry",
      ),
    });

    await markAttempt(
      buildQuotaFallbackRetryRecord({
        attemptedAt: nowIso(),
        status: "retried",
        agentId: agent.id,
        issueId: payload.issueId,
        taskKey: retryTaskKey,
        reason: isProcessLossFailure(payload.error)
          ? "runtime_process_loss_fallback_retry"
          : "runtime_timeout_fallback_retry",
        fallbackAdapterType: fallback.adapterType,
        wakeupRunId: asString(wakeResult?.runId) ?? null,
        note: payload.error,
      }),
    );

    await appendRecentEvent(ctx, event.companyId, {
      kind: "runtime-fallback-retry",
      title: `Retried ${agent.name} on ${fallback.adapterType} after Hermes runtime failure`,
      issueId: payload.issueId ?? undefined,
      detail: payload.issueId
        ? `Issue ${payload.issueId} retried from failed run ${payload.runId}; switched ${workspaceTargets.length} same-workspace agent(s) to ${fallback.adapterType}${fallback.adapterType !== agent.adapterType ? ` until ${cooldownUntil}` : ""}.`
        : `Task ${retryTaskKey} retried from failed run ${payload.runId}; switched ${workspaceTargets.length} same-workspace agent(s) to ${fallback.adapterType}${fallback.adapterType !== agent.adapterType ? ` until ${cooldownUntil}` : ""}.`,
    });

    if (payload.issueId) {
      const fallbackLabel =
        fallback.adapterType === "hermes_local"
          ? `hermes_local (${asString(fallback.adapterConfig.model) ?? "next ladder model"})`
          : fallback.adapterType;
      await ctx.issues.createComment(
        payload.issueId,
        `Detected a Hermes runtime failure on run ${payload.runId}. Switched ${agent.name} and ${Math.max(workspaceTargets.length - 1, 0)} same-workspace peer(s) to ${fallbackLabel}${fallback.adapterType !== agent.adapterType ? ` until ${cooldownUntil}` : ""}, then requeued the work once on a fresh session.`,
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
        reason: "runtime_failure_fallback_failed",
        note: errorMessage,
      }),
    );

    await appendRecentEvent(ctx, event.companyId, {
      kind: "runtime-fallback-error",
      title: `Runtime fallback failed for ${agent.name}`,
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
  const preservePreferredLane = shouldPreservePreferredExecutionLane({
    title: input.title,
    preferredAssignee: routedAssignee,
    sourceType: input.sourceType,
    parentId: input.parentIssueId ?? null,
  });
  const assigneeResolution = await resolveAssignableAgent(
    ctx,
    input.companyId,
    config,
    routedAssignee,
    {
      allowFallback: !preservePreferredLane,
      revivePreferredAgent: preservePreferredLane,
      taskKey: `${input.sourceType}:${input.sourceId}`,
    },
  );
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
    await recoverIssueExecutionLockIfNeeded(ctx, input.companyId, currentIssue, {
      commentPrefix: "Automation cleared a stale execution lock before refreshing this managed issue.",
    }).catch(() => undefined);
    currentIssue = await ctx.issues.get(currentIssue.id, input.companyId).catch(() => currentIssue);
  }

  if (currentIssue) {
    const nextStatus =
      currentIssue.status === "done" || currentIssue.status === "cancelled"
        ? desiredStatus
        : desiredStatus === "todo"
          ? currentIssue.status
          : desiredStatus;

    if (currentIssue.assigneeAgentId !== assignee.id) {
      await cancelIssueExecutionRunIfNeeded(currentIssue, assigneeResolution.selectedKey).catch(() => undefined);
    }

    const updatedIssue = await (ctx.issues.update as any)(
      currentIssue.id,
      {
        title: input.title,
        description: makeTraceBlock(input, assigneeResolution.selectedKey),
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
      description: makeTraceBlock(input, assigneeResolution.selectedKey),
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

  const runtimeSession = await syncIssueRuntimeSession(ctx, input.companyId, currentIssue.id).catch(() => null);
  if (runtimeSession) {
    await appendRuntimeTraceEvent(ctx, input.companyId, runtimeSession.id, {
      type: "session.status_changed",
      actor: "runtime",
      summary: isNewIssue
        ? `Managed issue created for ${input.sourceType}:${input.sourceId}.`
        : `Managed issue refreshed for ${input.sourceType}:${input.sourceId}.`,
      detail: {
        fingerprint,
        desiredStatus,
        currentStatus: currentIssue.status,
        assigneeAgentId: currentIssue.assigneeAgentId ?? null,
      },
    }).catch(() => undefined);
  }

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
      await recordManagedIssueSlackAlert(ctx, input.companyId, {
        fingerprint,
        sourceType: input.sourceType,
        signature: slackAlertSignature,
      });
    }

    await wakeChiefOfStaff(ctx, input.companyId, config, {
      reason: isNewIssue ? "managed_issue_created" : "managed_issue_updated",
      idempotencyKey: `chief-of-staff:managed-issue:${fingerprint}:${currentIssue.status}:${currentIssue.assigneeAgentId ?? "unassigned"}`,
      payload: {
        signalType: isNewIssue ? "managed_issue_created" : "managed_issue_updated",
        issueId: currentIssue.id,
        signalIssueId: currentIssue.id,
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
      // Slack dedupe is handled separately from the wakeup itself.
      postToSlack: !suppressManagedSlackAlert,
    }).catch(() => undefined);

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

  if (existingData.sourceType === "notion-work-queue") {
    await syncResolvedNotionWorkQueuePage(
      ctx,
      {
        ...existingData,
        fingerprint,
        issueId: updatedIssue.id,
        sourceType: existingData.sourceType ?? input.sourceType,
        sourceId: existingData.sourceId ?? input.sourceId,
        projectName: existingData.projectName ?? "unknown",
        assignee: existingData.assignee ?? "unknown",
        hits: existingData.hits ?? 1,
        firstSeenAt: existingData.firstSeenAt ?? nowIso(),
        lastSeenAt: nowIso(),
        resolutionStatus: input.resolutionStatus,
        metadata: existingData.metadata,
      },
      updatedIssue.title,
      input.resolutionStatus,
    ).catch(() => undefined);
  }

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
  return sourceType === "repo-dirty"
    || sourceType === "repo-branch-drift"
    || sourceType === "notion-work-queue";
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
      agentKey: alert.agentKey,
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

type MetricsReporterCadence = "daily" | "weekly";

type MetricsReporterStructuredReport = {
  headline: string;
  executiveSummary: string[];
  metricHighlights: string[];
  anomalies: string[];
  recommendedFollowUps: string[];
  growthStudioLinks: string[];
  sourceEvidence: string[];
};

type MetricsReporterOutputProof = {
  success: boolean;
  outcome: "done" | "blocked";
  cadence: MetricsReporterCadence;
  generatedAt: string;
  title: string;
  report: MetricsReporterStructuredReport;
  proofLinks: string[];
  issueComment: string;
  errors: string[];
  failureReason?: string;
  kbArtifact?: { path?: string; linkedPages?: string[] };
  notion?: {
    knowledgePageId?: string;
    knowledgePageUrl?: string;
    workQueuePageId?: string;
    workQueuePageUrl?: string;
  };
};

type WorkspaceDigestCadence = "weekly" | "ad_hoc";

type WorkspaceDigestStructuredReport = {
  headline: string;
  roundup: string;
  highlights: string[];
  risks: string[];
  nextActions: string[];
  sourceEvidence: string[];
};

type WorkspaceDigestFollowUpItem = {
  title: string;
  priority: string;
  system: string;
  businessLane?: string;
  lifecycleStage?: string;
  workType?: string;
  substage?: string;
};

type WorkspaceDigestOutputProof = {
  success: boolean;
  outcome: "done" | "blocked";
  cadence: WorkspaceDigestCadence;
  generatedAt: string;
  title: string;
  report: WorkspaceDigestStructuredReport;
  proofLinks: string[];
  issueComment: string;
  errors: string[];
  failureReason?: string;
  kbArtifact?: { path?: string; linkedPages?: string[] };
  notion?: {
    knowledgePageId?: string;
    knowledgePageUrl?: string;
  };
  followUpWorkQueueItems?: Array<{ pageId: string; pageUrl?: string; title: string }>;
};

type NotionReconcilerRunProof = {
  success: boolean;
  outcome: "done" | "blocked";
  mode: "daily" | "weekly" | "manual";
  generatedAt: string;
  title: string;
  summary: string;
  counts: {
    metadataCleanups: number;
    staleFlags: number;
    doctrineRepairs: number;
    relationRepairs: number;
    duplicatesArchived: number;
  };
  touchedPages: string[];
  escalations: string[];
  proofLinks: string[];
  issueComment: string;
  errors: string[];
  failureReason?: string;
};

function normalizeMetricsReporterStructuredReport(
  params: Record<string, unknown>,
  cadence: MetricsReporterCadence,
): { report: MetricsReporterStructuredReport; validationErrors: string[] } {
  const report: MetricsReporterStructuredReport = {
    headline: asString(params.headline) ?? "",
    executiveSummary: coerceStringArray(params.executiveSummary ?? params.summaryBullets),
    metricHighlights: coerceStringArray(params.metricHighlights ?? params.workflowFindings),
    anomalies: coerceStringArray(params.anomalies ?? params.risks),
    recommendedFollowUps: coerceStringArray(params.recommendedFollowUps),
    growthStudioLinks: coerceStringArray(params.growthStudioLinks),
    sourceEvidence: coerceStringArray(params.sourceEvidence),
  };

  const validationErrors: string[] = [];
  if (!report.headline) {
    validationErrors.push(`Missing headline for ${cadence} metrics reporter output.`);
  }
  if (report.executiveSummary.length === 0) {
    validationErrors.push("Missing executiveSummary items for metrics reporter output.");
  }
  if (report.metricHighlights.length === 0) {
    validationErrors.push("Missing metricHighlights for metrics reporter output.");
  }
  if (report.anomalies.length === 0) {
    validationErrors.push("Missing anomalies for metrics reporter output.");
  }
  if (report.recommendedFollowUps.length === 0) {
    validationErrors.push("Missing recommendedFollowUps for metrics reporter output.");
  }

  return { report, validationErrors };
}

function normalizeWorkspaceDigestStructuredReport(
  params: Record<string, unknown>,
  cadence: WorkspaceDigestCadence,
): { report: WorkspaceDigestStructuredReport; validationErrors: string[] } {
  const report: WorkspaceDigestStructuredReport = {
    headline: asString(params.headline) ?? "",
    roundup: asString(params.roundup) ?? "",
    highlights: coerceStringArray(params.highlights),
    risks: coerceStringArray(params.risks),
    nextActions: coerceStringArray(params.nextActions),
    sourceEvidence: coerceStringArray(params.sourceEvidence),
  };

  const validationErrors: string[] = [];
  if (!report.headline) {
    validationErrors.push(`Missing headline for ${cadence} workspace digest.`);
  }
  if (!report.roundup) {
    validationErrors.push("Missing roundup for workspace digest.");
  }
  if (report.highlights.length === 0) {
    validationErrors.push("Missing highlights for workspace digest.");
  }
  if (report.nextActions.length === 0) {
    validationErrors.push("Missing nextActions for workspace digest.");
  }

  return { report, validationErrors };
}

function normalizeWorkspaceDigestFollowUpItems(
  params: Record<string, unknown>,
): { items: WorkspaceDigestFollowUpItem[]; validationErrors: string[] } {
  const rawItems = Array.isArray(params.followUpWorkItems) ? params.followUpWorkItems : [];
  const validationErrors: string[] = [];
  const items: WorkspaceDigestFollowUpItem[] = [];

  for (const [index, item] of rawItems.entries()) {
    if (!item || typeof item !== "object") {
      validationErrors.push(`followUpWorkItems[${index}] must be an object.`);
      continue;
    }
    const entry = item as Record<string, unknown>;
    const title = asString(entry.title);
    const priority = asString(entry.priority) ?? "P2";
    const system = asString(entry.system) ?? "WebApp";
    if (!title) {
      validationErrors.push(`followUpWorkItems[${index}] must include a title.`);
      continue;
    }
    items.push({
      title,
      priority,
      system,
      businessLane: asString(entry.businessLane),
      lifecycleStage: asString(entry.lifecycleStage) ?? "Open",
      workType: asString(entry.workType) ?? "Task",
      substage: asString(entry.substage),
    });
  }

  return { items, validationErrors };
}

function formatMetricsReporterIssueComment(result: MetricsReporterOutputProof) {
  const proofLinks = result.proofLinks.length > 0 ? result.proofLinks.join(", ") : "none";
  const lines = [
    `Outcome: ${result.outcome.toUpperCase()}`,
    `Headline: ${result.report.headline}`,
    `Knowledge artifact: ${result.notion?.knowledgePageUrl ?? "missing"}`,
    `Work Queue breadcrumb: ${result.notion?.workQueuePageUrl ?? "not created"}`,
    `Proof links: ${proofLinks}`,
  ];
  if (result.failureReason) {
    lines.push(`Failure reason: ${result.failureReason}`);
  }
  if (result.errors.length > 0) {
    lines.push(`Errors: ${result.errors.join(" | ")}`);
  }
  return lines.join("\n");
}

function formatWorkspaceDigestIssueComment(result: WorkspaceDigestOutputProof) {
  const proofLinks = result.proofLinks.length > 0 ? result.proofLinks.join(", ") : "none";
  const followUps = result.followUpWorkQueueItems?.length
    ? result.followUpWorkQueueItems.map((item) => item.title).join(", ")
    : "none";
  const lines = [
    `Outcome: ${result.outcome.toUpperCase()}`,
    `Headline: ${result.report.headline}`,
    `Knowledge artifact: ${result.notion?.knowledgePageUrl ?? "missing"}`,
    `Follow-up work items: ${followUps}`,
    `Proof links: ${proofLinks}`,
  ];
  if (result.failureReason) {
    lines.push(`Failure reason: ${result.failureReason}`);
  }
  if (result.errors.length > 0) {
    lines.push(`Errors: ${result.errors.join(" | ")}`);
  }
  return lines.join("\n");
}

function formatNotionReconcilerIssueComment(result: NotionReconcilerRunProof) {
  const lines = [
    `Outcome: ${result.outcome.toUpperCase()}`,
    `Summary: ${result.summary}`,
    `Repairs: metadata=${result.counts.metadataCleanups}, stale=${result.counts.staleFlags}, doctrine=${result.counts.doctrineRepairs}, relations=${result.counts.relationRepairs}, duplicates=${result.counts.duplicatesArchived}`,
    `Touched pages: ${result.touchedPages.length > 0 ? result.touchedPages.join(", ") : "none"}`,
    `Escalations: ${result.escalations.length > 0 ? result.escalations.join(" | ") : "none"}`,
  ];
  if (result.failureReason) {
    lines.push(`Failure reason: ${result.failureReason}`);
  }
  if (result.errors.length > 0) {
    lines.push(`Errors: ${result.errors.join(" | ")}`);
  }
  return lines.join("\n");
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

    const growthOpsModule = asset.growthCampaignDraftId
      ? await loadGrowthOpsModule()
      : null;
    const campaign = asset.growthCampaignDraftId
      ? await growthOpsModule?.getGrowthCampaignRecord(asset.growthCampaignDraftId).catch(() => null)
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

    const growthOps = await loadGrowthOpsModule();
    const queueResult = await growthOps.queueGrowthCampaignSend({
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
    `- KB artifact: ${result.kbArtifact ? `${result.kbArtifact.path}${result.kbArtifact.generated ? " (generated)" : ""}` : "missing"}`,
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
    `- KB artifact: ${result.kbArtifact ? `${result.kbArtifact.path}${result.kbArtifact.generated ? " (generated)" : ""}` : "missing"}`,
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

  if (validationErrors.length === 0) {
    try {
      result.kbArtifact = await ensureKbArtifactForReport({
        params,
        generatedAt,
        title,
        defaultCategory: "community-updates",
        owner: "community-updates-agent",
        summary: report.headline,
        evidence: [
          ...report.shippedThisWeek,
          ...report.byTheNumbers,
          ...report.whatWeLearned,
        ],
        recommendedFollowUp: report.whatIsNext,
      });
    } catch (error) {
      errors.push(`KB artifact failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length === 0 && result.kbArtifact && notionToken) {
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

  if (validationErrors.length === 0 && result.kbArtifact && slackConfigured) {
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
      const growthOps = await loadGrowthOpsModule();
      const campaign = await growthOps.createGrowthCampaignDraft({
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
  if (!result.kbArtifact?.path) {
    failureReasons.push("Missing KB artifact.");
  }
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
    result.kbArtifact?.path,
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

async function buildMetricsReporterOutputProof(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<MetricsReporterOutputProof> {
  const owningAgentKey = "analytics-agent";
  const cadence = asString(params.cadence) === "weekly" ? "weekly" : "daily";
  const generatedAt = nowIso();
  const reportDate = formatDateInTimeZone(new Date(generatedAt), "America/New_York");
  const title = `Analytics Internal Metrics ${cadence === "weekly" ? "Weekly" : "Daily"} Report - ${reportDate}`;
  const triggerSource = asString(params.issueId) ? "Task Assignment" : "Manual";
  const runMirror = await startPilotAgentRunMirror(ctx, config, companyId, {
    agentKey: owningAgentKey,
    title,
    triggerSource,
    issueId: asString(params.issueId),
    startedAt: generatedAt,
    notes: `Cadence: ${cadence}. Legacy metrics-reporter action executed under analytics-agent ownership.`,
  });
  const notionClient = runMirror?.notionClient ?? null;
  const { report, validationErrors } = normalizeMetricsReporterStructuredReport(params, cadence);
  const errors: string[] = [];

  const result: MetricsReporterOutputProof = {
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

  const reportLines = [
    `Generated at: ${generatedAt}`,
    `Cadence: ${cadence}`,
    "",
    "## Headline",
    report.headline,
    "",
    "## Executive Summary",
    ...report.executiveSummary.map((line) => `- ${line}`),
    "",
    "## Metric Highlights",
    ...report.metricHighlights.map((line) => `- ${line}`),
    "",
    "## Anomalies And Risks",
    ...report.anomalies.map((line) => `- ${line}`),
    "",
    "## Recommended Follow-Ups",
    ...report.recommendedFollowUps.map((line) => `- ${line}`),
    "",
    "## Growth Studio Links",
    ...(report.growthStudioLinks.length > 0 ? report.growthStudioLinks.map((line) => `- ${line}`) : ["- none"]),
    "",
    "## Source Evidence",
    ...(report.sourceEvidence.length > 0 ? report.sourceEvidence.map((line) => `- ${line}`) : ["- none"]),
  ];
  if (validationErrors.length > 0) {
    reportLines.push("", "## Validation Errors", ...validationErrors.map((line) => `- ${line}`));
  }

  if (validationErrors.length === 0) {
    try {
      result.kbArtifact = await ensureKbArtifactForReport({
        params,
        generatedAt,
        title,
        defaultCategory: owningAgentKey,
        owner: owningAgentKey,
        summary: report.headline,
        evidence: [
          ...report.executiveSummary,
          ...report.metricHighlights,
          ...report.anomalies,
          ...report.sourceEvidence,
        ],
        recommendedFollowUp: report.recommendedFollowUps,
      });
    } catch (error) {
      errors.push(`KB artifact failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length === 0 && notionClient) {
    try {
      const knowledgeEntry = await upsertKnowledgeEntry(
        notionClient,
        {
          title,
          type: "Reference",
          system: "WebApp",
          content: reportLines.join("\n"),
          sourceOfTruth: "Repo",
          canonicalSource: result.kbArtifact?.path,
          agentSurfaces: ["Analytics Agent"],
          lifecycleStage: "Done",
        },
        { archiveDuplicates: true },
      );
      result.notion = {
        knowledgePageId: knowledgeEntry.pageId,
        knowledgePageUrl: knowledgeEntry.pageUrl,
      };

      if (params.createWorkQueueBreadcrumb !== false) {
        const breadcrumb = await upsertWorkQueueItem(
          notionClient,
          {
            title,
            priority: cadence === "weekly" ? "P1" : "P2",
            system: "WebApp",
            businessLane: "Growth",
            lifecycleStage: "Done",
            workType: "Refresh",
            lastStatusChange: generatedAt,
            substage: [
              report.headline,
              knowledgeEntry.pageUrl ? `Knowledge page: ${knowledgeEntry.pageUrl}` : null,
              report.recommendedFollowUps.length > 0 ? `Follow-ups: ${report.recommendedFollowUps.join("; ")}` : null,
            ].filter(Boolean).join(" "),
          },
          { archiveDuplicates: true },
        );
        result.notion.workQueuePageId = breadcrumb.pageId;
        result.notion.workQueuePageUrl = breadcrumb.pageUrl;
      }
    } catch (error) {
      errors.push(`Notion write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const failureReasons: string[] = [];
  if (validationErrors.length > 0) {
    errors.push(...validationErrors);
  }
  if (!result.kbArtifact?.path) {
    failureReasons.push("Missing KB artifact.");
  }
  if (!result.notion?.knowledgePageId) {
    failureReasons.push("Missing Notion Knowledge artifact.");
  }

  result.proofLinks = [
    result.kbArtifact?.path,
    result.notion?.knowledgePageUrl,
    result.notion?.workQueuePageUrl,
    ...report.growthStudioLinks,
    ...report.sourceEvidence,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  result.failureReason = [...failureReasons, ...errors].join(" ");
  result.success = failureReasons.length === 0 && errors.length === 0;
  result.outcome = result.success ? "done" : "blocked";
  result.issueComment = formatMetricsReporterIssueComment(result);

  await updateRoutineHealth(
    ctx,
    companyId,
    `metrics-reporter-${cadence}`,
    `Metrics Reporter ${cadence.charAt(0).toUpperCase()}${cadence.slice(1)}`,
    owningAgentKey,
    result.outcome,
    result.failureReason,
    asString(params.issueId),
  );
  await trackAgentRun(ctx, companyId, owningAgentKey);
  await updatePhaseMetrics(ctx, companyId, owningAgentKey, result.outcome);
  await finalizePilotAgentRunMirror(runMirror, {
    status: result.outcome === "done" ? "Done" : "Blocked",
    startedAt: generatedAt,
    endedAt: nowIso(),
    triggerSource,
    issueId: asString(params.issueId),
    outputDocPageId: result.notion?.knowledgePageId,
    outputDocPageUrl: result.notion?.knowledgePageUrl,
    artifactUrl: firstHttpUrl([result.notion?.knowledgePageUrl, ...report.growthStudioLinks]),
    errorSummary: result.outcome === "blocked" ? result.failureReason : undefined,
    notes: `Legacy metrics-reporter shim under analytics-agent ownership. Highlights: ${report.metricHighlights.length}; anomalies: ${report.anomalies.length}; follow-ups: ${report.recommendedFollowUps.length}.`,
  });

  return result;
}

async function buildWorkspaceDigestOutputProof(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<WorkspaceDigestOutputProof> {
  const cadence = asString(params.cadence) === "ad_hoc" ? "ad_hoc" : "weekly";
  const generatedAt = nowIso();
  const reportDate = formatDateInTimeZone(new Date(generatedAt), "America/New_York");
  const title = `Workspace Digest ${cadence === "weekly" ? "Weekly" : "Ad Hoc"} Draft - ${reportDate}`;
  const triggerSource = asString(params.issueId) ? "Task Assignment" : "Manual";
  const runMirror = await startPilotAgentRunMirror(ctx, config, companyId, {
    agentKey: "workspace-digest-publisher",
    title,
    triggerSource,
    issueId: asString(params.issueId),
    startedAt: generatedAt,
    notes: `Cadence: ${cadence}`,
  });
  const notionClient = runMirror?.notionClient ?? null;
  const { report, validationErrors } = normalizeWorkspaceDigestStructuredReport(params, cadence);
  const { items: followUpItems, validationErrors: followUpValidationErrors } =
    normalizeWorkspaceDigestFollowUpItems(params);
  const errors: string[] = [];

  const result: WorkspaceDigestOutputProof = {
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

  const reportLines = [
    `Generated at: ${generatedAt}`,
    `Cadence: ${cadence}`,
    "",
    "## Headline",
    report.headline,
    "",
    "## Roundup",
    report.roundup,
    "",
    "## Highlights",
    ...report.highlights.map((line) => `- ${line}`),
    "",
    "## Risks",
    ...(report.risks.length > 0 ? report.risks.map((line) => `- ${line}`) : ["- none"]),
    "",
    "## Next Actions",
    ...report.nextActions.map((line) => `- ${line}`),
    "",
    "## Source Evidence",
    ...(report.sourceEvidence.length > 0 ? report.sourceEvidence.map((line) => `- ${line}`) : ["- none"]),
  ];
  if (validationErrors.length > 0 || followUpValidationErrors.length > 0) {
    reportLines.push(
      "",
      "## Validation Errors",
      ...[...validationErrors, ...followUpValidationErrors].map((line) => `- ${line}`),
    );
  }

  if (validationErrors.length === 0 && followUpValidationErrors.length === 0) {
    try {
      result.kbArtifact = await ensureKbArtifactForReport({
        params,
        generatedAt,
        title,
        defaultCategory: "workspace-digest",
        owner: "workspace-digest-publisher",
        summary: report.headline,
        evidence: [...report.highlights, ...report.risks, ...report.sourceEvidence],
        recommendedFollowUp: report.nextActions,
      });
    } catch (error) {
      errors.push(`KB artifact failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length === 0 && followUpValidationErrors.length === 0 && notionClient) {
    try {
      const knowledgeEntry = await upsertKnowledgeEntry(
        notionClient,
        {
          title,
          type: "Reference",
          system: "WebApp",
          content: reportLines.join("\n"),
          sourceOfTruth: "Repo",
          canonicalSource: result.kbArtifact?.path,
          agentSurfaces: ["Workspace Digest Publisher"],
          lifecycleStage: "Draft",
        },
        { archiveDuplicates: true },
      );
      result.notion = {
        knowledgePageId: knowledgeEntry.pageId,
        knowledgePageUrl: knowledgeEntry.pageUrl,
      };

      const createdFollowUps: Array<{ pageId: string; pageUrl?: string; title: string }> = [];
      for (const item of followUpItems) {
        const workQueueEntry = await upsertWorkQueueItem(
          notionClient,
          {
            title: item.title,
            priority: item.priority as "P0" | "P1" | "P2" | "P3",
            system: item.system as "Cross-System" | "WebApp" | "Capture" | "Pipeline" | "Validation",
            businessLane: item.businessLane as WorkQueueItem["businessLane"] | undefined,
            lifecycleStage: item.lifecycleStage ?? "Open",
            workType: (item.workType ?? "Task") as WorkQueueItem["workType"],
            substage: item.substage ?? (knowledgeEntry.pageUrl ? `Digest: ${knowledgeEntry.pageUrl}` : undefined),
            relatedDocPageUrls: knowledgeEntry.pageUrl ? [knowledgeEntry.pageUrl] : undefined,
          },
          { archiveDuplicates: true },
        );
        createdFollowUps.push({
          pageId: workQueueEntry.pageId,
          pageUrl: workQueueEntry.pageUrl,
          title: item.title,
        });
      }
      if (createdFollowUps.length > 0) {
        result.followUpWorkQueueItems = createdFollowUps;
      }
    } catch (error) {
      errors.push(`Notion write failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const failureReasons: string[] = [];
  if (validationErrors.length > 0) {
    errors.push(...validationErrors);
  }
  if (followUpValidationErrors.length > 0) {
    errors.push(...followUpValidationErrors);
  }
  if (!result.kbArtifact?.path) {
    failureReasons.push("Missing KB artifact.");
  }
  if (!result.notion?.knowledgePageId) {
    failureReasons.push("Missing Notion Knowledge artifact.");
  }

  result.proofLinks = [
    result.kbArtifact?.path,
    result.notion?.knowledgePageUrl,
    ...(result.followUpWorkQueueItems ?? []).map((item) => item.pageUrl),
    ...report.sourceEvidence,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  result.failureReason = [...failureReasons, ...errors].join(" ");
  result.success = failureReasons.length === 0 && errors.length === 0;
  result.outcome = result.success ? "done" : "blocked";
  result.issueComment = formatWorkspaceDigestIssueComment(result);

  await updateRoutineHealth(
    ctx,
    companyId,
    cadence === "weekly" ? "workspace-digest-weekly" : "workspace-digest-ad-hoc",
    cadence === "weekly" ? "Workspace Digest Weekly" : "Workspace Digest Ad Hoc",
    "workspace-digest-publisher",
    result.outcome,
    result.failureReason,
    asString(params.issueId),
  );
  await trackAgentRun(ctx, companyId, "workspace-digest-publisher");
  await updatePhaseMetrics(ctx, companyId, "workspace-digest-publisher", result.outcome);
  await finalizePilotAgentRunMirror(runMirror, {
    status: result.outcome === "done" ? "Done" : "Blocked",
    startedAt: generatedAt,
    endedAt: nowIso(),
    triggerSource,
    issueId: asString(params.issueId),
    outputDocPageId: result.notion?.knowledgePageId,
    outputDocPageUrl: result.notion?.knowledgePageUrl,
    artifactUrl: firstHttpUrl([result.notion?.knowledgePageUrl, ...(result.followUpWorkQueueItems ?? []).map((item) => item.pageUrl)]),
    errorSummary: result.outcome === "blocked" ? result.failureReason : undefined,
    notes: `Highlights: ${report.highlights.length}; risks: ${report.risks.length}; follow-up work items: ${result.followUpWorkQueueItems?.length ?? 0}.`,
  });

  return result;
}

async function recordNotionReconcilerRun(
  ctx: PluginContext,
  config: BlueprintAutomationConfig,
  companyId: string,
  params: Record<string, unknown>,
): Promise<NotionReconcilerRunProof> {
  const owningAgentKey = "notion-manager-agent";
  const mode = asString(params.mode) === "weekly"
    ? "weekly"
    : asString(params.mode) === "manual"
      ? "manual"
      : "daily";
  const generatedAt = nowIso();
  const reportDate = formatDateInTimeZone(new Date(generatedAt), "America/New_York");
  const title = `Notion Manager ${mode === "weekly" ? "Weekly" : mode === "manual" ? "Manual" : "Daily"} Reconcile Run - ${reportDate}`;
  const triggerSource = asString(params.issueId) ? "Task Assignment" : "Manual";
  const runMirror = await startPilotAgentRunMirror(ctx, config, companyId, {
    agentKey: owningAgentKey,
    title,
    triggerSource,
    issueId: asString(params.issueId),
    startedAt: generatedAt,
    notes: `Mode: ${mode}. Legacy notion-reconciler action executed under notion-manager-agent ownership.`,
  });

  const summary = asString(params.summary) ?? "";
  const touchedPages = coerceStringArray(params.touchedPages);
  const escalations = coerceStringArray(params.escalations);
  const blockedReason = asString(params.blockedReason);
  const counts = {
    metadataCleanups: asNumber(params.metadataCleanups) ?? 0,
    staleFlags: asNumber(params.staleFlags) ?? 0,
    doctrineRepairs: asNumber(params.doctrineRepairs) ?? 0,
    relationRepairs: asNumber(params.relationRepairs) ?? 0,
    duplicatesArchived: asNumber(params.duplicatesArchived) ?? 0,
  };
  const errors: string[] = [];
  if (!summary) {
    errors.push("Missing summary for notion reconciler run.");
  }

  const result: NotionReconcilerRunProof = {
    success: false,
    outcome: blockedReason ? "blocked" : "done",
    mode,
    generatedAt,
    title,
    summary,
    counts,
    touchedPages,
    escalations,
    proofLinks: touchedPages,
    issueComment: "",
    errors,
  };

  if (errors.length > 0) {
    result.outcome = "blocked";
  }
  result.failureReason = [blockedReason, ...errors].filter(Boolean).join(" ");
  result.success = result.outcome === "done" && errors.length === 0;
  result.issueComment = formatNotionReconcilerIssueComment(result);

  await updateRoutineHealth(
    ctx,
    companyId,
    mode === "weekly" ? "notion-reconciler-weekly" : "notion-reconciler-daily",
    mode === "weekly" ? "Notion Reconciler Weekly" : mode === "manual" ? "Notion Reconciler Manual" : "Notion Reconciler Daily",
    owningAgentKey,
    result.outcome,
    result.failureReason,
    asString(params.issueId),
  );
  await trackAgentRun(ctx, companyId, owningAgentKey);
  await updatePhaseMetrics(ctx, companyId, owningAgentKey, result.outcome);
  await finalizePilotAgentRunMirror(runMirror, {
    status: result.outcome === "done" ? "Done" : "Blocked",
    startedAt: generatedAt,
    endedAt: nowIso(),
    triggerSource,
    issueId: asString(params.issueId),
    artifactUrl: firstHttpUrl(touchedPages),
    errorSummary: result.outcome === "blocked" ? result.failureReason : undefined,
    requiresHumanReview: escalations.length > 0 || result.outcome === "blocked",
    notes: `Legacy notion-reconciler shim under notion-manager-agent ownership. metadata=${counts.metadataCleanups}; stale=${counts.staleFlags}; doctrine=${counts.doctrineRepairs}; relations=${counts.relationRepairs}; duplicates=${counts.duplicatesArchived}.`,
  });

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

function estimateModelCostUsd(model: string | null | undefined) {
  const normalized = typeof model === "string" ? model.trim() : "";
  if (!normalized) return MODEL_COST_ESTIMATES.default;
  if (normalized.includes(":free")) return 0;
  return MODEL_COST_ESTIMATES[normalized] ?? MODEL_COST_ESTIMATES.default;
}

async function trackAgentRun(ctx: PluginContext, companyId: string, agentKey: string, model?: string) {
  const period = currentBudgetPeriod();
  const state = await readState<BudgetTrackingState>(ctx, companyId, STATE_KEYS.budgetTracking) ?? { period, agents: {} };

  if (state.period !== period) {
    state.period = period;
    state.agents = {};
  }

  const configuredModel = model ?? getConfiguredAgent(agentKey)?.adapter?.config?.model;
  const costPerRun = estimateModelCostUsd(configuredModel);
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
    const limitCents = getBudgetLimit(agentKey);
    const limitUsd = limitCents / 100;
    if (limitUsd <= 0) continue;
    const pct = (entry.estimatedCostUsd / limitUsd) * 100;
    if (pct >= 100) {
      alerts.push(`:rotating_light: *${agentKey}* exceeded monthly budget ($${entry.estimatedCostUsd.toFixed(2)} / $${limitUsd.toFixed(2)} \u2014 ${pct.toFixed(0)}%, ${entry.runs} runs)`);
    } else if (pct >= 80) {
      alerts.push(`:warning: *${agentKey}* at ${pct.toFixed(0)}% of monthly budget ($${entry.estimatedCostUsd.toFixed(2)} / $${limitUsd.toFixed(2)}, ${entry.runs} runs)`);
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
  const stripeSecretKey = await resolveOptionalSecret(
    ctx,
    config.secrets?.stripeSecretKeyRef,
    "STRIPE_SECRET_KEY",
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
      Boolean(process.env.VITE_GA_MEASUREMENT_ID || process.env.VITE_FIREBASE_MEASUREMENT_ID),
      "GA measurement ID is present in the runtime environment via the GA or Firebase alias.",
      "GA measurement ID is not present in the Paperclip runtime environment, and no Firebase fallback alias is set.",
    ),
    configuredSourceStatus(
      "Stripe revenue feed",
      Boolean(stripeSecretKey),
      "Stripe secret key is present in the runtime environment or a resolved Paperclip secret ref.",
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

  if (validationErrors.length === 0 && followUpValidationErrors.length === 0) {
    try {
      result.kbArtifact = await ensureKbArtifactForReport({
        params,
        generatedAt,
        title,
        defaultCategory: "analytics",
        owner: "analytics-agent",
        summary: report.headline,
        evidence: [
          ...report.summaryBullets,
          ...report.workflowFindings,
          ...report.risks,
        ],
        recommendedFollowUp: report.recommendedFollowUps,
      });
    } catch (error) {
      errors.push(`KB artifact failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (priorRunMatches && existingRun?.notion?.knowledgePageId && existingRun?.notion?.workQueuePageId) {
    result.notion = existingRun.notion;
  } else if (validationErrors.length === 0 && followUpValidationErrors.length === 0 && result.kbArtifact && notionToken) {
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
  } else if (validationErrors.length === 0 && followUpValidationErrors.length === 0 && result.kbArtifact && (slackGrowthWebhookUrl || slackOpsWebhookUrl)) {
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
  if (!result.kbArtifact?.path) {
    failureReasons.push("Missing KB artifact.");
  }
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
    result.kbArtifact?.path,
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
    allowHumanGatedParentFollowUp?: boolean;
  },
) {
  if (!input.allowHumanGatedParentFollowUp) {
    const [parentIssue, parentComments] = await Promise.all([
      ctx.issues.get(input.parentIssueId, companyId).catch(() => null),
      listCommentsForIssue(ctx, companyId, input.parentIssueId).catch(() => [] as IssueComment[]),
    ]);
    if (
      parentIssue
      && isHumanGatedBlockedIssue({
        identifier: parentIssue.identifier,
        title: parentIssue.title,
        description: parentIssue.description ?? null,
        status: parentIssue.status,
        projectName: null,
        currentAssignee: null,
        blockerSummary: latestSubstantiveBlockedComment(parentComments)?.body ?? null,
        hasOpenChild: false,
      })
    ) {
      throw new Error(`Refusing to create follow-up blocker for human-gated parent issue ${input.parentIssueId}`);
    }
  }

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

function extractGitStatusPath(entry: string) {
  const raw = entry.slice(3).trim();
  if (!raw) return "";
  const renameParts = raw.split(" -> ");
  return (renameParts[renameParts.length - 1] ?? raw).trim();
}

function hasGitSubmoduleMapping(workspacePath: string, targetPath: string) {
  const gitmodulesPath = path.join(workspacePath, ".gitmodules");
  if (!existsSync(gitmodulesPath)) {
    return false;
  }
  const contents = readFileSync(gitmodulesPath, "utf8");
  return contents.includes(`path = ${targetPath}`);
}

function shouldIgnoreGitStatusEntry(workspacePath: string, entry: string) {
  const entryPath = extractGitStatusPath(entry).replace(/\\/g, "/").replace(/\/+$/, "");
  if (!entryPath) return false;

  if (entryPath === "paperclip-desktop" && !hasGitSubmoduleMapping(workspacePath, entryPath)) {
    return true;
  }

  if (entryPath.endsWith("-drift-backup") || entryPath.includes("-drift-backup/")) {
    return true;
  }

  return false;
}

function parseGitStatus(output: string, workspacePath: string) {
  const lines = output.split("\n").filter(Boolean);
  const branchLine = lines[0] ?? "";
  const branch = branchLine.replace(/^##\s*/, "").split("...")[0] ?? "unknown";
  const changedEntries = lines
    .slice(1)
    .filter((entry) => !shouldIgnoreGitStatusEntry(workspacePath, entry));
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
  return parseGitStatus(result.stdout, workspacePath);
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

function projectPrefersIsolatedRepoExecution(project: Project) {
  const policy = asRecord((project as unknown as Record<string, unknown>).executionWorkspacePolicy);
  if (!policy || !asBoolean(policy.enabled, false)) {
    return false;
  }

  const defaultMode = asString(policy.defaultMode) ?? "shared_workspace";
  if (defaultMode === "isolated_workspace") {
    return true;
  }

  const strategy = asRecord(policy.workspaceStrategy);
  return asString(strategy?.type) === "git_worktree";
}

async function selectRepoWorkspaceForScan(
  ctx: PluginContext,
  companyId: string,
  repoConfig: RepoConfig,
  project: Project,
  workspace: PluginWorkspace,
) {
  const primaryWorkspacePath = await resolveRepoWorkspacePath(ctx, companyId, repoConfig, workspace);
  const primaryStatus = await scanRepoWorkspace(primaryWorkspacePath);
  if (!projectPrefersIsolatedRepoExecution(project) || primaryStatus.changedFiles === 0) {
    return {
      workspacePath: primaryWorkspacePath,
      status: primaryStatus,
      source: "primary_workspace" as const,
    };
  }

  const implementationAgent = await resolveAgent(ctx, companyId, repoConfig.implementationAgent).catch(() => null);
  const reviewAgent = await resolveAgent(ctx, companyId, repoConfig.reviewAgent).catch(() => null);
  const seenPaths = new Set([path.resolve(primaryWorkspacePath)]);
  const candidates = [
    { source: "implementation_agent" as const, path: implementationAgent ? agentCwd(implementationAgent) : null },
    { source: "review_agent" as const, path: reviewAgent ? agentCwd(reviewAgent) : null },
  ];

  for (const candidate of candidates) {
    if (!candidate.path || !existsSync(candidate.path)) {
      continue;
    }
    const normalizedPath = path.resolve(candidate.path);
    if (seenPaths.has(normalizedPath)) {
      continue;
    }
    seenPaths.add(normalizedPath);

    const candidateStatus = await scanRepoWorkspace(candidate.path).catch(() => null);
    if (!candidateStatus || candidateStatus.changedFiles > 0) {
      continue;
    }

    return {
      workspacePath: candidate.path,
      status: candidateStatus,
      source: candidate.source,
    };
  }

  return {
    workspacePath: primaryWorkspacePath,
    status: primaryStatus,
    source: "primary_workspace" as const,
  };
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
  const project = await resolveProject(ctx, companyId, repoConfig.projectName);
  const { workspace } = await getPrimaryWorkspaceForRepo(ctx, companyId, repoConfig);
  const selection = await selectRepoWorkspaceForScan(ctx, companyId, repoConfig, project, workspace);
  const status = selection.status;

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

  const branchDrift = selection.source === "primary_workspace"
    && (status.branch !== repoConfig.defaultBranch || status.ahead > 0 || status.behind > 0);
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
  const fingerprint = makeFingerprint("github-workflow", sourceId);

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

  const { mapping, issue } = await getManagedIssue(ctx, companyId, fingerprint);
  const existingData = (mapping?.data ?? {}) as Partial<SourceMappingData>;
  const existingMetadata =
    existingData.metadata && typeof existingData.metadata === "object"
      ? existingData.metadata as Record<string, unknown>
      : {};
  const existingRunId = typeof existingMetadata.runId === "string" ? existingMetadata.runId : null;
  const existingConclusion =
    typeof existingMetadata.conclusion === "string" ? existingMetadata.conclusion : null;
  const existingSignalUrl = typeof existingData.signalUrl === "string" ? existingData.signalUrl : null;
  const issueStatus = typeof issue?.status === "string" ? issue.status : null;
  const isOpenIssue =
    issueStatus !== null && issueStatus !== "done" && issueStatus !== "cancelled";

  if (
    issue &&
    isOpenIssue &&
    existingRunId === runId &&
    existingConclusion === conclusion &&
    existingSignalUrl === (htmlUrl ?? null)
  ) {
    return;
  }

  await upsertManagedIssue(ctx, {
    companyId,
    sourceType: "github-workflow",
    sourceId,
    title: `${repoConfig.projectName} CI failure: ${workflowName}`,
    description:
      `GitHub Actions reported ${conclusion} for ${workflowName} on branch ${branch}. Do one fast recovered-yet check first; if no newer successful ${repoConfig.defaultBranch} run exists, inspect the failing step/log class and either create or refresh the concrete engineering unblock issue in the same heartbeat. Do not leave this as monitor-only while the failure is still active.`,
    projectName: repoConfig.projectName,
    assignee: repoConfig.ciWatchAgent ?? repoConfig.implementationAgent,
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
  return pollGithubWorkflowsHelper(
    config,
    (url, token) => fetchJson(ctx, url, token),
    (secretRef) => ctx.secrets.resolve(secretRef).catch(() => null),
    async (repoConfig, workflowRun) => {
      await syncGithubWorkflowRun(ctx, config, companyId, repoConfig as RepoConfig, workflowRun);
    },
  );
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
    `- KB artifact: ${result.kbArtifact ? `${result.kbArtifact.path}${result.kbArtifact.generated ? " (generated)" : ""}` : "missing"}`,
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

  if (validationErrors.length === 0) {
    try {
      result.kbArtifact = await ensureKbArtifactForReport({
        params,
        generatedAt,
        title,
        defaultCategory: "demand-intel",
        owner: "demand-intel-agent",
        summary: report.headline,
        evidence: [
          ...scopeLines,
          ...report.signals,
          ...report.proofRequirements,
          ...report.channelFindings,
          ...report.partnershipFindings,
        ],
        recommendedFollowUp: report.recommendedActions,
      });
    } catch (error) {
      errors.push(`KB artifact failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (validationErrors.length === 0 && result.kbArtifact && notionToken) {
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

  if (validationErrors.length === 0 && result.kbArtifact && (slackGrowthWebhookUrl || slackOpsWebhookUrl)) {
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
  if (!result.kbArtifact?.path) failureReasons.push("Missing KB artifact.");
  if (!result.notion?.workQueuePageId) failureReasons.push("Missing Notion Work Queue artifact.");
  if (!result.notion?.knowledgePageId) failureReasons.push("Missing Notion Knowledge artifact.");
  if (!result.slack?.ok) {
    failureReasons.push(result.slack ? `Slack digest failed (HTTP ${result.slack.statusCode ?? "unknown"})` : "Missing Slack digest artifact.");
  }

  result.proofLinks = [result.kbArtifact?.path, result.notion?.workQueuePageUrl, result.notion?.knowledgePageUrl]
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
    `- KB artifact: ${result.kbArtifact ? `${result.kbArtifact.path}${result.kbArtifact.generated ? " (generated)" : ""}` : "missing"}`,
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

  if (errors.length === 0) {
    try {
      result.kbArtifact = await ensureKbArtifactForReport({
        params,
        generatedAt,
        title,
        defaultCategory: "customer-research",
        owner: "demand-intel-agent",
        summary: headline,
        evidence: synthesis.evidence.map((entry) =>
          `[${entry.label}] ${entry.source}: ${entry.summary}${entry.url ? ` (${entry.url})` : ""}`,
        ),
        recommendedFollowUp: recommendedActions,
      });
    } catch (error) {
      result.errors.push(`KB artifact failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length === 0 && result.kbArtifact && notionToken) {
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

  if (errors.length === 0 && result.kbArtifact && slackGrowthWebhookUrl) {
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
  if (!result.kbArtifact?.path) failureReasons.push("Missing KB artifact.");
  if (!result.notion?.workQueuePageId) failureReasons.push("Missing Notion Work Queue artifact.");
  if (!result.notion?.knowledgePageId) failureReasons.push("Missing Notion Knowledge artifact.");
  if (!result.slack?.ok) {
    failureReasons.push(result.slack ? `Slack digest failed (HTTP ${result.slack.statusCode ?? "unknown"})` : "Missing Slack digest artifact.");
  }

  result.proofLinks = [result.kbArtifact?.path, result.notion?.workQueuePageUrl, result.notion?.knowledgePageUrl]
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
    `- KB artifact: ${result.kbArtifact ? `${result.kbArtifact.path}${result.kbArtifact.generated ? " (generated)" : ""}` : "missing"}`,
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

  if (validationErrors.length === 0) {
    try {
      result.kbArtifact = await ensureKbArtifactForReport({
        params,
        generatedAt,
        title,
        defaultCategory: "market-intel",
        owner: "market-intel-agent",
        summary: report.headline,
        evidence: [
          ...signalLines,
          ...report.competitorUpdates,
          ...report.technologyFindings,
        ],
        recommendedFollowUp: report.recommendedActions,
      });
    } catch (error) {
      errors.push(`KB artifact failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (priorRunMatches && existingRun?.notion?.knowledgePageId && existingRun?.notion?.workQueuePageId) {
    result.notion = existingRun.notion;
  } else if (validationErrors.length === 0 && result.kbArtifact && notionToken) {
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
  } else if (validationErrors.length === 0 && result.kbArtifact && (slackGrowthWebhookUrl || slackOpsWebhookUrl)) {
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
  if (!result.kbArtifact?.path) failureReasons.push("Missing KB artifact.");
  if (!result.notion?.workQueuePageId) failureReasons.push("Missing Notion Work Queue artifact.");
  if (!result.notion?.knowledgePageId) failureReasons.push("Missing Notion Knowledge artifact.");
  if (!result.slack?.ok) {
    failureReasons.push(result.slack ? `Slack digest failed (HTTP ${result.slack.statusCode ?? "unknown"})` : "Missing Slack digest artifact.");
  }

  result.proofLinks = [result.kbArtifact?.path, result.notion?.workQueuePageUrl, result.notion?.knowledgePageUrl]
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
  const repoRoot = resolveConfiguredRepoRoot(
    typeof _params.repoPath === "string" ? _params.repoPath : null,
    BLUEPRINT_WEBAPP_REPO_ROOT,
  );
  const docs = loadPlatformDoctrineDocs(repoRoot);

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
      allowHumanGatedParentFollowUp: true,
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
  const sourceMappings = (
    await ctx.entities.list({
      entityType: ENTITY_TYPES.sourceMapping,
      scopeKind: "company",
      scopeId: companyId,
      limit: 1000,
      offset: 0,
    })
  ).sort((left, right) => {
    const leftData = (left.data ?? {}) as Partial<SourceMappingData>;
    const rightData = (right.data ?? {}) as Partial<SourceMappingData>;
    return Date.parse(toIsoTimestamp(rightData.lastSeenAt))
      - Date.parse(toIsoTimestamp(leftData.lastSeenAt));
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
  ctx.actions.register(ACTION_KEYS.agentRegistrySync, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await syncAllAgentRegistryRows(ctx, config, company.id);
  });

  ctx.actions.register(ACTION_KEYS.scanNow, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await runFullRepoScan(ctx, company.id, config, "manual-action");
  });

  ctx.actions.register(ACTION_KEYS.repairRouting, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    const maintenance = await readMaintenanceState(ctx, company.id);
    if (maintenance.running) {
      return {
        queued: false,
        running: true,
        maintenance,
      };
    }

    startRoutingMaintenanceRun(ctx, company.id, config);
    return {
      queued: true,
      running: false,
      startedAt: nowIso(),
      maintenance,
    };
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
      allowHumanGatedParentFollowUp: true,
    });
  });

  ctx.actions.register(ACTION_KEYS.resolveWorkItem, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    const issueId = asString(params.issueId);
    const resolutionStatus =
      asString(params.resolutionStatus) === "cancelled"
        ? "cancelled"
        : asString(params.resolutionStatus) === "blocked"
          ? "blocked"
          : "done";
    if (issueId && resolutionStatus !== "blocked") {
      const mappings = await listSourceMappings(ctx, company.id);
      const sourceMapping = findSourceMappingRecordByIssueId(mappings, issueId);
      if (sourceMapping) {
        return await resolveManagedIssue(ctx, {
          companyId: company.id,
          sourceType: sourceMapping.data.sourceType,
          sourceId: sourceMapping.data.sourceId,
          resolutionStatus,
          comment: asString(params.comment) ?? "Resolved by Blueprint automation action.",
        });
      }
    }
    return await resolveManagedIssue(ctx, {
      companyId: company.id,
      sourceType: asString(params.sourceType) ?? "manual-signal",
      sourceId: asString(params.sourceId) ?? "",
      resolutionStatus,
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

  ctx.actions.register(ACTION_KEYS.metricsReporterReport, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await buildMetricsReporterOutputProof(ctx, config, company.id, params);
  });

  ctx.actions.register(ACTION_KEYS.workspaceDigestReport, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await buildWorkspaceDigestOutputProof(ctx, config, company.id, params);
  });

  ctx.actions.register(ACTION_KEYS.notionReconcilerRun, async (params) => {
    const config = await getConfig(ctx);
    const company = await findCompany(ctx, asString(params.companyName) ?? config.companyName);
    return await recordNotionReconcilerRun(ctx, config, company.id, params);
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
        allowHumanGatedParentFollowUp: true,
      });
      return {
        content: `Created blocker follow-up issue ${followUp.id}.`,
        data: followUp,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.dispatchHumanBlocker,
    {
      displayName: "Blueprint Dispatch Human Blocker",
      description: "Queue or send a standard human-blocker packet for a true human gate.",
      parametersSchema: {
        type: "object",
        properties: {
          issueId: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          recommendedAnswer: { type: "string" },
          exactResponseNeeded: { type: "string" },
          whyBlocked: { type: "string" },
          alternatives: { type: "array", items: { type: "string" } },
          risk: { type: "string" },
          immediateNextAction: { type: "string" },
          deadline: { type: "string" },
          evidence: { type: "array", items: { type: "string" } },
          nonScope: { type: "string" },
          blockerKind: { type: "string", enum: ["technical", "ops_commercial"] },
          executionOwner: { type: "string" },
          routingOwner: { type: "string" },
          escalationOwner: { type: "string" },
          reviewRequired: { type: "boolean" },
          reviewOwner: { type: "string" },
          senderOwner: { type: "string" },
          emailTarget: { type: "string" },
          mirrorToSlack: { type: "boolean" },
          reportPaths: { type: "array", items: { type: "string" } },
          deliveryMode: { type: "string", enum: ["send_now", "review_required", "send_saved_draft"] },
          dispatchId: { type: "string" },
        },
        required: ["issueId"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      const issueId = asString((params as Record<string, unknown>).issueId);
      if (!issueId) {
        throw new Error("issueId is required.");
      }

      const issue = await ctx.issues.get(issueId, company.id).catch(() => null);
      if (!issue) {
        throw new Error(`Issue ${issueId} was not found.`);
      }

      const assigneeAgent = issue.assigneeAgentId
        ? await ctx.agents.get(issue.assigneeAgentId, company.id).catch(() => null)
        : null;
      const assigneeKey = preferredAgentChannelKey(assigneeAgent);
      const routingOwner = asString((params as Record<string, unknown>).routingOwner) ?? getChiefOfStaffAgentKey(config);
      const executionOwner =
        asString((params as Record<string, unknown>).executionOwner)
        ?? assigneeKey
        ?? routingOwner;
      const blockerKindRaw = asString((params as Record<string, unknown>).blockerKind);
      const blockerKind =
        blockerKindRaw === "technical" || blockerKindRaw === "ops_commercial"
          ? blockerKindRaw
          : inferHumanBlockerKindForOwner(executionOwner);
      const requestedDeliveryMode = asString((params as Record<string, unknown>).deliveryMode);
      const reviewRequired =
        (params as Record<string, unknown>).reviewRequired === true
        || requestedDeliveryMode === "review_required";
      const reviewOwner =
        asString((params as Record<string, unknown>).reviewOwner)
        ?? (reviewRequired ? getChiefOfStaffAgentKey(config) : null);
      const senderOwner =
        asString((params as Record<string, unknown>).senderOwner)
        ?? (reviewRequired ? reviewOwner : executionOwner);
      const reportPaths = Array.isArray((params as Record<string, unknown>).reportPaths)
        ? ((params as Record<string, unknown>).reportPaths as unknown[])
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];

      const deliveryMode =
        requestedDeliveryMode === "send_saved_draft"
          ? "send_saved_draft"
          : reviewRequired
            ? "review_required"
            : "send_now";
      if (deliveryMode !== "send_saved_draft") {
        const requiredTextFields = [
          "title",
          "summary",
          "recommendedAnswer",
          "exactResponseNeeded",
          "whyBlocked",
          "risk",
          "immediateNextAction",
          "deadline",
          "nonScope",
        ];
        for (const key of requiredTextFields) {
          if (!asString((params as Record<string, unknown>)[key])) {
            throw new Error(`${key} is required when sending or queueing a new human-blocker packet.`);
          }
        }
        const alternatives = (params as Record<string, unknown>).alternatives;
        const evidence = (params as Record<string, unknown>).evidence;
        if (!Array.isArray(alternatives) || alternatives.length === 0) {
          throw new Error("alternatives must contain at least one option when sending or queueing a new human-blocker packet.");
        }
        if (!Array.isArray(evidence) || evidence.length === 0) {
          throw new Error("evidence must contain at least one item when sending or queueing a new human-blocker packet.");
        }
      }
      const mirrorToSlack = (params as Record<string, unknown>).mirrorToSlack === true;
      const slackTargets = mirrorToSlack ? await resolveSlackTargets(ctx, config) : null;
      const slackWebhookUrl = mirrorToSlack
        ? selectHumanBlockerSlackWebhook(slackTargets!, reviewRequired ? reviewOwner : executionOwner)
        : undefined;

      const payload: Record<string, unknown> = {
        delivery_mode: deliveryMode,
        dispatch_id: asString((params as Record<string, unknown>).dispatchId) ?? undefined,
        blocker_kind: deliveryMode === "send_saved_draft" ? undefined : blockerKind,
        packet: deliveryMode === "send_saved_draft"
          ? undefined
          : {
              title: asString((params as Record<string, unknown>).title) ?? "Blueprint human blocker",
              summary: asString((params as Record<string, unknown>).summary) ?? "",
              recommendedAnswer: asString((params as Record<string, unknown>).recommendedAnswer) ?? "",
              exactResponseNeeded: asString((params as Record<string, unknown>).exactResponseNeeded) ?? "",
              whyBlocked: asString((params as Record<string, unknown>).whyBlocked) ?? "",
              alternatives: Array.isArray((params as Record<string, unknown>).alternatives)
                ? ((params as Record<string, unknown>).alternatives as unknown[])
                    .filter((value): value is string => typeof value === "string")
                    .map((value) => value.trim())
                    .filter(Boolean)
                : [],
              risk: asString((params as Record<string, unknown>).risk) ?? "",
              executionOwner,
              immediateNextAction: asString((params as Record<string, unknown>).immediateNextAction) ?? "",
              deadline: asString((params as Record<string, unknown>).deadline) ?? "",
              evidence: Array.isArray((params as Record<string, unknown>).evidence)
                ? ((params as Record<string, unknown>).evidence as unknown[])
                    .filter((value): value is string => typeof value === "string")
                    .map((value) => value.trim())
                    .filter(Boolean)
                : [],
              nonScope: asString((params as Record<string, unknown>).nonScope) ?? "",
            },
        email_target: asString((params as Record<string, unknown>).emailTarget) ?? undefined,
        mirror_to_slack: mirrorToSlack,
        slack_webhook_url: slackWebhookUrl,
        routing_owner: routingOwner,
        execution_owner: executionOwner,
        escalation_owner: asString((params as Record<string, unknown>).escalationOwner) ?? undefined,
        review_owner: reviewOwner ?? undefined,
        sender_owner: senderOwner ?? undefined,
        report_paths: reportPaths,
        paperclip_issue_id: issue.id,
      };

      const dispatch = await postInternalHumanBlockerDispatch(payload);
      const result = dispatch.result;

      let reviewIssueId: string | null = null;
      if (reviewRequired && deliveryMode === "review_required" && reviewOwner) {
        const reviewIssue = await createFollowUpIssue(ctx, company.id, {
          parentIssueId: issue.id,
          title: `Review human-blocker packet for ${issue.title}`,
          description: [
            `A true human gate was reached and the blocker packet is queued for review before delivery.`,
            ``,
            `- Blocker id: ${result.blocker_id}`,
            `- Dispatch id: ${result.dispatch_id}`,
            `- Requested by issue: ${issue.id}`,
            `- Execution owner after reply: ${executionOwner}`,
            `- Routing owner: ${routingOwner}`,
            `- Sender owner after review: ${senderOwner}`,
            ``,
            `## Packet`,
            result.packet_text ?? "Packet text unavailable.",
          ].join("\n"),
          projectName: EXECUTIVE_OPS_PROJECT,
          assignee: reviewOwner,
          priority: "high",
          allowHumanGatedParentFollowUp: true,
        });
        reviewIssueId = reviewIssue.id;
      }

      const commentLines = reviewRequired && deliveryMode === "review_required"
        ? [
            `Queued human-blocker packet \`${result.blocker_id}\` for review before delivery.`,
            `- Dispatch id: \`${result.dispatch_id}\``,
            reviewIssueId ? `- Review issue: \`${reviewIssueId}\`` : null,
            `- Review owner: \`${reviewOwner}\``,
            `- Execution owner after reply: \`${executionOwner}\``,
          ]
        : [
            `Dispatched human-blocker packet \`${result.blocker_id}\`.`,
            `- Dispatch id: \`${result.dispatch_id}\``,
            result.email_subject ? `- Subject: ${result.email_subject}` : null,
            `- Email sent: ${result.email_sent ? "yes" : "no"}`,
            `- Slack mirrored: ${result.slack_sent ? "yes" : mirrorToSlack ? "attempted but not sent" : "no"}`,
            `- Execution owner after reply: \`${executionOwner}\``,
          ];
      await ctx.issues.createComment(issue.id, commentLines.filter(Boolean).join("\n"), company.id);

      return {
        content: reviewRequired && deliveryMode === "review_required"
          ? `Queued human-blocker packet ${result.blocker_id} for review${reviewIssueId ? ` in issue ${reviewIssueId}` : ""}.`
          : `Dispatched human-blocker packet ${result.blocker_id}.`,
        data: {
          issueId: issue.id,
          blockerId: result.blocker_id,
          dispatchId: result.dispatch_id,
          reviewIssueId,
          executionOwner,
          routingOwner,
          reviewOwner,
          senderOwner,
          deliveryMode: result.delivery_mode,
          deliveryStatus: result.delivery_status,
          emailSent: result.email_sent,
          slackSent: result.slack_sent,
        },
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
      const resolutionStatus =
        asString((params as Record<string, unknown>).resolutionStatus) === "cancelled"
          ? "cancelled"
          : asString((params as Record<string, unknown>).resolutionStatus) === "blocked"
            ? "blocked"
            : "done";
      if (issueId && resolutionStatus !== "blocked") {
        const mappings = await listSourceMappings(ctx, company.id);
        const sourceMapping = findSourceMappingRecordByIssueId(mappings, issueId);
        if (sourceMapping) {
          const result = await resolveManagedIssue(ctx, {
            companyId: company.id,
            sourceType: sourceMapping.data.sourceType,
            sourceId: sourceMapping.data.sourceId,
            resolutionStatus,
            comment: asString((params as Record<string, unknown>).comment) ?? "Resolved by Blueprint automation tool.",
          });
          return {
            content: result.issue ? `Resolved managed issue ${result.issue.id} by issue reference.` : "No matching managed issue found for that issue id.",
            data: result,
          };
        }
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
    TOOL_NAMES.runtimeSessionStatus,
    {
      displayName: "Blueprint Runtime Session Status",
      description:
        "Inspect Blueprint runtime sessions, their trace summaries, checkpoints, and linked subagents by session or issue.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          sessionId: { type: "string" },
          issueId: { type: "string" },
          recentLimit: { type: "number" },
        },
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const sessionId = asString((params as Record<string, unknown>).sessionId);
      const issueId = asString((params as Record<string, unknown>).issueId);
      const recentLimit = Math.max(1, Math.min(asNumber((params as Record<string, unknown>).recentLimit) ?? 5, 20));
      const session =
        sessionId
          ? await getRuntimeSession(ctx, company.id, sessionId)
          : issueId
            ? await getLatestSessionForIssue(ctx, company.id, issueId)
            : null;
      if (session) {
        const [trace, subagents] = await Promise.all([
          readRuntimeTrace(ctx, company.id, session.id),
          listRuntimeSubagentsForParent(ctx, company.id, session.id),
        ]);
        return {
          content: [
            `Session ${session.id} is ${session.status} for ${session.agentKey}.`,
            `Version: ${session.agentVersionRef}${session.channelRef ? ` (${session.channelRef})` : ""}`,
            `Environment: ${session.environmentProfileKey}`,
            `Trace events: ${trace.length}`,
            `Subagents: ${subagents.length}`,
          ].join("\n"),
          data: {
            session,
            trace: trace.slice(-25),
            subagents,
          },
        };
      }

      const recent = await listRecentRuntimeSessions(ctx, company.id, recentLimit);
      return {
        content: `Loaded ${recent.length} recent runtime session(s).`,
        data: { recent },
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.runtimeSessionCheckpoint,
    {
      displayName: "Blueprint Runtime Session Checkpoint",
      description: "Create a lightweight workflow checkpoint for a runtime session.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          sessionId: { type: "string" },
          reason: { type: "string" },
        },
        required: ["sessionId", "reason"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const checkpoint = await createRuntimeCheckpoint(
        ctx,
        company.id,
        asString((params as Record<string, unknown>).sessionId) ?? "",
        asString((params as Record<string, unknown>).reason) ?? "manual-checkpoint",
      );
      return {
        content: `Created runtime checkpoint ${checkpoint.id}.`,
        data: checkpoint,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.runtimeMemoryRead,
    {
      displayName: "Blueprint Runtime Memory Read",
      description: "Read one runtime memory record or list a memory store.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          storeKey: { type: "string" },
          path: { type: "string" },
        },
        required: ["storeKey"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const storeKey = asString((params as Record<string, unknown>).storeKey) ?? "";
      const memoryPath = asString((params as Record<string, unknown>).path);
      if (memoryPath) {
        const record = await readMemoryRecord(ctx, company.id, storeKey, memoryPath);
        return {
          content: record ? `Loaded ${storeKey}${memoryPath} (v${record.version}).` : `No memory found for ${storeKey}${memoryPath}.`,
          data: record,
        };
      }
      const records = await listMemoryStoreRecords(ctx, company.id, storeKey);
      return {
        content: `Loaded ${records.length} record(s) from ${storeKey}.`,
        data: records,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.runtimeMemoryWrite,
    {
      displayName: "Blueprint Runtime Memory Write",
      description: "Write a scoped runtime memory record with durability and approval metadata.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          storeKey: { type: "string" },
          path: { type: "string" },
          scope: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          labels: { type: "array", items: { type: "string" } },
          sourceSessionId: { type: "string" },
          sourceIssueId: { type: "string" },
          authority: { type: "string" },
          durability: { type: "string" },
          approvalEvidence: { type: "string" },
        },
        required: ["storeKey", "path", "scope", "title", "content", "authority"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const record = await writeMemoryRecord(ctx, company.id, {
        storeKey: asString((params as Record<string, unknown>).storeKey) ?? "",
        path: asString((params as Record<string, unknown>).path) ?? "",
        scope: (asString((params as Record<string, unknown>).scope) ?? "session_scratch") as any,
        title: asString((params as Record<string, unknown>).title) ?? "",
        content: asString((params as Record<string, unknown>).content) ?? "",
        labels: Array.isArray((params as Record<string, unknown>).labels) ? ((params as Record<string, unknown>).labels as string[]) : [],
        sourceSessionId: asString((params as Record<string, unknown>).sourceSessionId) ?? null,
        sourceIssueId: asString((params as Record<string, unknown>).sourceIssueId) ?? null,
        authority: (asString((params as Record<string, unknown>).authority) ?? "agent_candidate") as any,
        durability: (asString((params as Record<string, unknown>).durability) ?? "candidate_durable") as any,
        approvalEvidence: asString((params as Record<string, unknown>).approvalEvidence) ?? null,
      });
      if (record.sourceSessionId) {
        await appendRuntimeTraceEvent(ctx, company.id, record.sourceSessionId, {
          type: "memory.write",
          actor: "agent",
          summary: `Wrote memory ${record.storeKey}${record.path} v${record.version}.`,
          detail: {
            scope: record.scope,
            authority: record.authority,
            durability: record.durability,
          },
        }).catch(() => undefined);
      }
      return {
        content: `Wrote ${record.storeKey}${record.path} as v${record.version}.`,
        data: record,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.runtimeSpawnSubagent,
    {
      displayName: "Blueprint Runtime Spawn Subagent",
      description:
        "Create a bounded runtime subagent, attach it to a parent session, and wake the target agent with the required context.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          parentSessionId: { type: "string" },
          issueId: { type: "string" },
          assignedAgentKey: { type: "string" },
          purpose: { type: "string" },
          expectedOutput: { type: "string" },
          environmentProfileKey: { type: "string" },
        },
        required: ["assignedAgentKey", "purpose", "expectedOutput"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const parentSessionId =
        asString((params as Record<string, unknown>).parentSessionId)
        ?? (asString((params as Record<string, unknown>).issueId)
          ? (await getLatestSessionForIssue(
            ctx,
            company.id,
            asString((params as Record<string, unknown>).issueId) ?? "",
          ))?.id ?? null
          : null);
      if (!parentSessionId) {
        throw new Error("runtime_spawn_subagent requires parentSessionId or an issueId with an existing runtime session.");
      }
      const parentSession = await getRuntimeSession(ctx, company.id, parentSessionId);
      if (!parentSession) {
        throw new Error(`Parent runtime session not found: ${parentSessionId}`);
      }
      const assignedAgentKey = asString((params as Record<string, unknown>).assignedAgentKey) ?? "";
      const childSession = await ensureRuntimeSession(ctx, company.id, {
        issueId: parentSession.issueId,
        parentSessionId: parentSession.id,
        agentKey: assignedAgentKey,
        environmentProfileKey: asString((params as Record<string, unknown>).environmentProfileKey) ?? null,
        status: "queued",
        wakeReason: "runtime.subagent.spawned",
        summary: asString((params as Record<string, unknown>).purpose) ?? "",
      });
      const subagent = await createRuntimeSubagent(ctx, company.id, {
        parentSessionId: parentSession.id,
        childSessionId: childSession.id,
        requestedByAgentKey: parentSession.agentKey,
        assignedAgentKey,
        purpose: asString((params as Record<string, unknown>).purpose) ?? "",
        expectedOutput: asString((params as Record<string, unknown>).expectedOutput) ?? "",
        status: "queued",
        environmentProfileKey: childSession.environmentProfileKey,
        memoryBindings: childSession.memoryBindings,
        vaultGrantIds: childSession.vaultGrantIds,
      });
      await appendRuntimeTraceEvent(ctx, company.id, parentSession.id, {
        type: "subagent.spawned",
        actor: "runtime",
        summary: `Spawned ${assignedAgentKey} as a runtime subagent.`,
        detail: {
          subagentId: subagent.id,
          childSessionId: childSession.id,
          purpose: subagent.purpose,
          expectedOutput: subagent.expectedOutput,
        },
      });
      const assigneeResolution = await resolveAssignableAgent(ctx, company.id, config, assignedAgentKey);
      await ctx.agents.wakeup(assigneeResolution.agent.id, company.id, {
        source: "automation",
        triggerDetail: "system",
        reason: "runtime.subagent.spawned",
        payload: {
          parentSessionId: parentSession.id,
          childSessionId: childSession.id,
          issueId: parentSession.issueId ?? null,
          purpose: subagent.purpose,
          expectedOutput: subagent.expectedOutput,
        },
        idempotencyKey: `runtime-subagent:${subagent.id}`,
        forceFreshSession: true,
      });
      await updateRuntimeSubagentStatus(ctx, company.id, subagent.id, "running");
      await updateRuntimeSessionStatus(ctx, company.id, childSession.id, "running", subagent.purpose);
      return {
        content: `Spawned runtime subagent ${subagent.id} for ${assignedAgentKey}.`,
        data: {
          subagent,
          childSessionId: childSession.id,
        },
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.analyticsReport,
    {
      displayName: "Generate Analytics Report",
      description:
        "Create a truthful Blueprint analytics snapshot, require or generate a repo KB artifact, write the resulting Notion artifacts, and post the companion Slack digest.",
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
          kbArtifactPath: { type: "string" },
          kbLinkedPages: { type: "array", items: { type: "string" } },
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
        "Create a deterministic Blueprint community update draft, require or generate a repo KB artifact, write required proof artifacts, and return the issue closeout payload.",
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
          kbArtifactPath: { type: "string" },
          kbLinkedPages: { type: "array", items: { type: "string" } },
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
    TOOL_NAMES.metricsReporterReport,
    {
      displayName: "Generate Metrics Reporter Output",
      description:
        "Create a Blueprint Notion-facing metrics report, require a repo KB artifact, mirror the report into Notion Knowledge, and optionally leave a Work Queue breadcrumb.",
      parametersSchema: {
        type: "object",
        properties: {
          cadence: { type: "string", enum: ["daily", "weekly"] },
          companyName: { type: "string" },
          issueId: { type: "string" },
          headline: { type: "string" },
          executiveSummary: { type: "array", items: { type: "string" } },
          metricHighlights: { type: "array", items: { type: "string" } },
          anomalies: { type: "array", items: { type: "string" } },
          recommendedFollowUps: { type: "array", items: { type: "string" } },
          growthStudioLinks: { type: "array", items: { type: "string" } },
          sourceEvidence: { type: "array", items: { type: "string" } },
          createWorkQueueBreadcrumb: { type: "boolean" },
          kbArtifactPath: { type: "string" },
          kbLinkedPages: { type: "array", items: { type: "string" } },
        },
        required: [
          "cadence",
          "headline",
          "executiveSummary",
          "metricHighlights",
          "anomalies",
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
      const report = await buildMetricsReporterOutputProof(
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
          ? `Generated ${cadence} metrics report with Notion artifacts.`
          : `Metrics reporter blocked: ${report.failureReason || report.errors.join("; ") || "unknown error"}.`,
        data: report,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.workspaceDigestReport,
    {
      displayName: "Generate Workspace Digest",
      description:
        "Create a Blueprint workspace roundup draft, require a repo KB artifact, mirror it into Notion Knowledge, and optionally create follow-up Work Queue items.",
      parametersSchema: {
        type: "object",
        properties: {
          cadence: { type: "string", enum: ["weekly", "ad_hoc"] },
          companyName: { type: "string" },
          issueId: { type: "string" },
          headline: { type: "string" },
          roundup: { type: "string" },
          highlights: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          nextActions: { type: "array", items: { type: "string" } },
          sourceEvidence: { type: "array", items: { type: "string" } },
          followUpWorkItems: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                priority: { type: "string" },
                system: { type: "string" },
                businessLane: { type: "string" },
                lifecycleStage: { type: "string" },
                workType: { type: "string" },
                substage: { type: "string" },
              },
              required: ["title"],
            },
          },
          kbArtifactPath: { type: "string" },
          kbLinkedPages: { type: "array", items: { type: "string" } },
        },
        required: ["cadence", "headline", "roundup", "highlights", "nextActions"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const report = await buildWorkspaceDigestOutputProof(
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
          ? `Generated ${report.cadence === "weekly" ? "weekly" : "ad hoc"} workspace digest with Notion artifacts.`
          : `Workspace digest publisher blocked: ${report.failureReason || report.errors.join("; ") || "unknown error"}.`,
        data: report,
      };
    },
  );

  ctx.tools.register(
    TOOL_NAMES.notionReconcilerRun,
    {
      displayName: "Record Notion Reconciler Run",
      description:
        "Mirror a Notion Reconciler sweep into Blueprint Agent Runs after the agent finishes metadata cleanup, stale-flagging, doctrine checks, and relation repair work.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          issueId: { type: "string" },
          mode: { type: "string", enum: ["daily", "weekly", "manual"] },
          summary: { type: "string" },
          metadataCleanups: { type: "number" },
          staleFlags: { type: "number" },
          doctrineRepairs: { type: "number" },
          relationRepairs: { type: "number" },
          duplicatesArchived: { type: "number" },
          touchedPages: { type: "array", items: { type: "string" } },
          escalations: { type: "array", items: { type: "string" } },
          blockedReason: { type: "string" },
        },
        required: ["summary"],
      },
    },
    async (params): Promise<ToolResult> => {
      const config = await getConfig(ctx);
      const company = await findCompany(
        ctx,
        asString((params as Record<string, unknown>).companyName) ?? config.companyName,
      );
      const result = await recordNotionReconcilerRun(
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
            issueComment: result.issueComment,
            outcome: result.outcome,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push(`Issue finalization failed: ${message}`);
          result.success = false;
          result.outcome = "blocked";
          result.failureReason = [result.failureReason, message].filter(Boolean).join(" ");
        }
      }
      return {
        content: result.success
          ? `Recorded notion reconciler ${result.mode} run with Agent Runs mirror.`
          : `Notion reconciler run recorder blocked: ${result.failureReason || result.errors.join("; ") || "unknown error"}.`,
        data: result,
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
        "Require or generate a repo KB artifact, write the mirrored customer research artifact to Notion, post the Slack digest, and return the proof/comment payload for issue completion.",
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
          kbArtifactPath: { type: "string" },
          kbLinkedPages: { type: "array", items: { type: "string" } },
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
        "Create a deterministic demand intelligence report from Blueprint demand-side research, require or generate a repo KB artifact, write Notion artifacts, and post the companion Slack digest.",
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
          kbArtifactPath: { type: "string" },
          kbLinkedPages: { type: "array", items: { type: "string" } },
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
        "Create a deterministic market intelligence report from agent-supplied findings, require or generate a repo KB artifact, write Notion artifacts, and post Slack digest.",
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
          kbArtifactPath: { type: "string" },
          kbLinkedPages: { type: "array", items: { type: "string" } },
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
              database: { type: "string", enum: ["work_queue", "knowledge", "skills", "agents", "agent_runs"] },
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
              database: { type: "string", enum: ["work_queue", "knowledge", "skills", "agents", "agent_runs"] },
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
              targetDatabase: { type: "string", enum: ["work_queue", "knowledge", "skills", "agents", "agent_runs"] },
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
              database: { type: "string", enum: ["work_queue", "knowledge", "skills", "agents", "agent_runs"] },
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
  const scannedQueueItems = await queryWorkQueue(notionClient, {});
  const {
    actionableItems: workQueueItems,
    conflicts: conflictingQueueGroups,
  } = analyzeWorkQueueItemsForScan(scannedQueueItems);
  const [sourceMappings, issues] = await Promise.all([
    listSourceMappings(ctx, companyId),
    listAllIssues(ctx, companyId),
  ]);
  const notionQueueAliases = buildNotionQueueAliasMap(sourceMappings, issues);
  let synced = 0;
  let suppressedConflicts = 0;

  for (const conflict of conflictingQueueGroups) {
    suppressedConflicts += 1;
    const canonicalItem = conflict.canonicalItem;
    const issueStatuses = conflict.issueStatuses.join(", ");
    const duplicatePages = conflict.entries
      .map((entry) => `- ${entry.url ?? entry.id} | lifecycle=${entry.lifecycleStage || "unknown"}`)
      .join("\n");

    await upsertManagedIssue(ctx, {
      companyId,
      sourceType: "notion-drift",
      sourceId: notionQueueConflictSourceId(conflict.key),
      title: `Notion drift: conflicting queue lifecycle for ${canonicalItem.title}`,
      description: [
        "Blueprint found multiple Notion Work Queue pages that collapse to the same queue key but disagree on lifecycle state.",
        "",
        `- Canonical queue key: ${conflict.key}`,
        `- Observed issue states: ${issueStatuses}`,
        `- Canonical page: ${canonicalItem.url ?? canonicalItem.id}`,
        "- Queue sync is suppressing the actionable Paperclip alert for this key until the duplicate lifecycle drift is resolved.",
        "",
        "## Duplicate pages",
        duplicatePages,
      ].join("\n"),
      projectName: EXECUTIVE_OPS_PROJECT,
      assignee: NOTION_MANAGER_AGENT,
      priority: "high",
      status: "todo",
      signalUrl: canonicalItem.url,
      metadata: {
        driftKind: "queue_lifecycle_conflict",
        queueKey: conflict.key,
        queueTitle: canonicalItem.title,
        queueSystem: canonicalItem.system,
        queueWorkType: canonicalItem.workType,
        queueLifecycleStage: canonicalItem.lifecycleStage,
        itemIds: conflict.entries.map((entry) => entry.id),
        lifecycleStages: conflict.entries.map((entry) => entry.lifecycleStage),
        issueStatuses: conflict.issueStatuses,
      },
      suppressRefreshComment: true,
    });

  }

  for (const item of workQueueItems) {
    const queueKey = canonicalWorkQueueScanKey(item);
    const mappedAlias = notionQueueAliases.get(queueKey);
    const assignee = routeWorkQueueAssignee(item, config);
    const sourceId = mappedAlias?.data.sourceId ?? queueKey;
    const issueStatus = mapWorkQueueLifecycleStageToIssueStatus(item.lifecycleStage);

    await resolveManagedIssue(ctx, {
      companyId,
      sourceType: "notion-drift",
      sourceId: notionQueueConflictSourceId(queueKey),
      resolutionStatus: "done",
      comment: `Notion queue scan no longer sees conflicting lifecycle drift for ${item.title}.`,
    });

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

    if (mappedAlias && shouldPreserveResolvedNotionQueueIssue(mappedAlias.issue, mappedAlias.data, item)) {
      await syncResolvedNotionWorkQueuePage(
        ctx,
        mappedAlias.data,
        mappedAlias.issue.title,
        mappedAlias.issue.status === "cancelled" ? "cancelled" : "done",
      ).catch(() => undefined);
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
    detail: `Synced ${synced} Notion work queue items after cancelling ${preReconcileResult.cancelledCount} duplicate queue issues and suppressing ${suppressedConflicts} conflicting queue keys at ${nowIso()}`,
  });

  return {
    synced,
    skipped: false,
    reconciledDuplicateIssues: preReconcileResult.cancelledCount,
    suppressedConflicts,
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
    if (!toolRegistrationStarted) {
      toolRegistrationStarted = true;
      setTimeout(() => {
        void registerToolHandlers(ctx)
          .then(() => {
            toolRegistrationReady = true;
            toolRegistrationError = null;
          })
          .catch((error) => {
            toolRegistrationReady = false;
            toolRegistrationError = error instanceof Error ? error.message : String(error);
            ctx.logger.warn("blueprint tool registration failed", {
              meta: {
                error: toolRegistrationError,
                stack: error instanceof Error ? error.stack : undefined,
              },
            });
          });
      }, 0);
    }
    ctx.events.on("agent.run.failed", async (event) => {
      try {
        await traceAgentRunFailureSession(ctx, event.companyId, parseAgentRunFailurePayload(event.payload));
      } catch (error) {
        ctx.logger.warn("agent.run.failed runtime session sync failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
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
        await handleAgentRunFailureRuntimeFallback(ctx, event);
      } catch (error) {
        ctx.logger.warn("agent.run.failed runtime fallback handler failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            runId: asString(asRecord(event.payload)?.runId) ?? null,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
      try {
        await handleAgentRunFailureFreshSessionRetry(ctx, event);
      } catch (error) {
        ctx.logger.warn("agent.run.failed fresh-session retry handler failed", {
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
        await syncIssueRuntimeSession(ctx, event.companyId, event.entityId);
      } catch (error) {
        ctx.logger.warn("issue.created runtime session sync failed", {
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
      try {
        await maybeCreateBlockedIssueFollowUp(ctx, event.companyId, event.entityId);
      } catch (error) {
        ctx.logger.warn("issue.created blocked follow-up synthesis failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            issueId: event.entityId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
      try {
        await maybeCreateChiefOwnedBacklogFollowUp(ctx, event.companyId, event.entityId);
      } catch (error) {
        ctx.logger.warn("issue.created backlog delegation synthesis failed", {
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
        await syncIssueRuntimeSession(ctx, event.companyId, event.entityId);
      } catch (error) {
        ctx.logger.warn("issue.updated runtime session sync failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            issueId: event.entityId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
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
      try {
        await maybeCreateBlockedIssueFollowUp(ctx, event.companyId, event.entityId);
      } catch (error) {
        ctx.logger.warn("issue.updated blocked follow-up synthesis failed", {
          meta: {
            companyId: event.companyId,
            eventId: event.eventId,
            issueId: event.entityId,
            stack: error instanceof Error ? error.stack : undefined,
          },
        });
      }
      try {
        await maybeCreateChiefOwnedBacklogFollowUp(ctx, event.companyId, event.entityId);
      } catch (error) {
        ctx.logger.warn("issue.updated backlog delegation synthesis failed", {
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
          await syncAgentRuntimeMetadata(ctx, event.companyId, [agent]);
          await syncSingleAgentRegistryRow(ctx, event.companyId, agent);
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
          await syncAgentRuntimeMetadata(ctx, event.companyId, [agent]);
          await syncSingleAgentRegistryRow(ctx, event.companyId, agent);
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
    ctx.jobs.register(JOB_KEYS.agentRegistrySync, async () => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await syncAllAgentRegistryRows(ctx, config, company.id);
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
      await runExecutionDispatchJob(ctx, company.id, config, {
        skipScaffolding: true,
        skipRoutingRepairs: true,
        deadlineMs: Date.now() + EXECUTION_DISPATCH_MAX_RUNTIME_MS,
      });
    });
    ctx.jobs.register(JOB_KEYS.localHeadroomCheck, async () => {
      const config = await getConfig(ctx);
      const company = await findCompany(ctx, config.companyName);
      await runLocalHeadroomCheckJob(ctx, company.id, config);
    });
    setTimeout(() => {
      void ensureStartupMaintenance(ctx);
      ensureLogicalSucceededRunRecovery(ctx);
    }, 0);
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
        message: toolRegistrationError
          ? `Blueprint automation is ready with deferred tool-registration errors: ${toolRegistrationError}`
          : toolRegistrationReady
            ? (asString(health?.message) ?? "Blueprint automation is ready.")
            : "Blueprint automation is ready; tool registration is still warming in the background.",
        details: {
          companyId: company.id,
          updatedAt: health?.updatedAt ?? null,
          toolRegistrationReady,
          toolRegistrationError,
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
