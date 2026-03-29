export const PLUGIN_ID = "blueprint.automation";
export const PLUGIN_VERSION = "0.1.0";
export const ORIGIN_KIND = "blueprint_automation";
export const PAGE_ROUTE = "blueprint-automation";
export const JOB_KEYS = {
  repoScan: "repo-scan",
  opsQueueScan: "ops-queue-scan",
  routineHealthCheck: "routine-health-check",
} as const;
export const WEBHOOK_KEYS = {
  github: "github",
  ci: "ci",
  intake: "intake",
  opsFirestore: "ops-firestore",
  opsStripe: "ops-stripe",
  opsSupport: "ops-support",
} as const;
export const TOOL_NAMES = {
  scanWork: "blueprint-scan-work",
  upsertWorkItem: "blueprint-upsert-work-item",
  reportBlocker: "blueprint-report-blocker",
  resolveWorkItem: "blueprint-resolve-work-item",
  analyticsReport: "blueprint-generate-analytics-report",
  notionReadWorkQueue: "notion-read-work-queue",
  notionWriteWorkQueue: "notion-write-work-queue",
  notionWriteKnowledge: "notion-write-knowledge",
  slackPostDigest: "slack-post-digest",
  webSearch: "web-search",
  marketIntelReport: "blueprint-generate-market-intel-report",
  budgetStatus: "blueprint-budget-status",
  phaseStatus: "blueprint-phase-status",
  recordOverride: "blueprint-record-override",
} as const;
export const ACTION_KEYS = {
  scanNow: "scan-now",
  simulateSignal: "simulate-signal",
  reportBlocker: "report-blocker",
  resolveWorkItem: "resolve-work-item",
  analyticsReport: "analytics-report",
  marketIntelReport: "market-intel-report",
} as const;
export const DATA_KEYS = {
  dashboard: "dashboard",
} as const;
export const SLOT_IDS = {
  page: "blueprint-automation-page",
  dashboardWidget: "blueprint-automation-dashboard-widget",
} as const;
export const EXPORT_NAMES = {
  page: "BlueprintAutomationPage",
  dashboardWidget: "BlueprintAutomationDashboardWidget",
} as const;
export const STATE_KEYS = {
  lastScan: "last-scan",
  recentEvents: "recent-events",
  health: "health",
  routineHealth: "routine-health",
  budgetTracking: "budget-tracking",
  phaseTracking: "phase-tracking",
} as const;
export const DEFAULT_COMPANY_NAME = "Blueprint Autonomous Operations";
export const DEFAULT_REPO_CATALOG = [
  {
    key: "webapp",
    projectName: "blueprint-webapp",
    githubRepo: "Blueprint-WebApp",
    defaultBranch: "main",
    implementationAgent: "webapp-codex",
    reviewAgent: "webapp-claude",
  },
  {
    key: "pipeline",
    projectName: "blueprint-capture-pipeline",
    githubRepo: "BlueprintCapturePipeline",
    defaultBranch: "main",
    implementationAgent: "pipeline-codex",
    reviewAgent: "pipeline-claude",
  },
  {
    key: "capture",
    projectName: "blueprint-capture",
    githubRepo: "BlueprintCapture",
    defaultBranch: "main",
    implementationAgent: "capture-codex",
    reviewAgent: "capture-claude",
  },
] as const;
