import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";
import {
  DEFAULT_COMPANY_NAME,
  DEFAULT_REPO_CATALOG,
  EXPORT_NAMES,
  JOB_KEYS,
  PAGE_ROUTE,
  PLUGIN_ID,
  PLUGIN_VERSION,
  SLOT_IDS,
  TOOL_NAMES,
  WEBHOOK_KEYS,
} from "./constants.js";

const repoCatalogSchemaItem = {
  type: "object",
  properties: {
    key: { type: "string" },
    projectName: { type: "string" },
    githubRepo: { type: "string" },
    defaultBranch: { type: "string" },
    implementationAgent: { type: "string" },
    reviewAgent: { type: "string" },
  },
  required: [
    "key",
    "projectName",
    "githubRepo",
    "defaultBranch",
    "implementationAgent",
    "reviewAgent",
  ],
} as const;

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Blueprint Automation",
  description:
    "Business automation layer for Blueprint that ingests repo and external signals, opens deduped Paperclip issues, and exposes operator visibility.",
  author: "Blueprint",
  categories: ["automation", "connector", "ui", "workspace"],
  capabilities: [
    "companies.read",
    "projects.read",
    "project.workspaces.read",
    "issues.read",
    "issues.create",
    "issues.update",
    "issue.comments.read",
    "issue.comments.create",
    "agents.read",
    "plugin.state.read",
    "plugin.state.write",
    "jobs.schedule",
    "webhooks.receive",
    "http.outbound",
    "secrets.read-ref",
    "agent.tools.register",
    "activity.log.write",
    "ui.page.register",
    "ui.dashboardWidget.register"
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      companyName: {
        type: "string",
        title: "Target Company Name",
        default: DEFAULT_COMPANY_NAME,
      },
      githubOwner: {
        type: "string",
        title: "GitHub Owner",
        default: "ognjhunt",
      },
      githubTokenRef: {
        type: "string",
        title: "GitHub Token Secret Ref",
        format: "secret-ref",
      },
      githubWebhookSecretRef: {
        type: "string",
        title: "GitHub Webhook Secret Ref",
        format: "secret-ref",
      },
      ciSharedSecretRef: {
        type: "string",
        title: "Generic CI Webhook Secret Ref",
        format: "secret-ref",
      },
      intakeSharedSecretRef: {
        type: "string",
        title: "Operator Intake Secret Ref",
        format: "secret-ref",
      },
      notificationWebhookUrlRef: {
        type: "string",
        title: "Outbound Notification Webhook URL Ref",
        format: "secret-ref",
      },
      enableGitRepoScanning: {
        type: "boolean",
        title: "Enable Local Git Repo Scanning",
        default: true,
      },
      enableGithubPolling: {
        type: "boolean",
        title: "Enable GitHub Workflow Polling",
        default: true,
      },
      enableOutboundNotifications: {
        type: "boolean",
        title: "Enable Outbound Notifications",
        default: false,
      },
      repoCatalog: {
        type: "array",
        title: "Repo Catalog",
        default: DEFAULT_REPO_CATALOG,
        items: repoCatalogSchemaItem,
      },
    },
  },
  jobs: [
    {
      jobKey: JOB_KEYS.repoScan,
      displayName: "Blueprint Repo Scan",
      description:
        "Scans Blueprint repos for local drift and optionally polls GitHub workflow state to keep Paperclip issues current.",
      schedule: "*/30 * * * *",
    },
  ],
  webhooks: [
    {
      endpointKey: WEBHOOK_KEYS.github,
      displayName: "GitHub Intake",
      description:
        "Consumes GitHub workflow and review events and turns them into deduped Blueprint Paperclip issues.",
    },
    {
      endpointKey: WEBHOOK_KEYS.ci,
      displayName: "Generic CI Intake",
      description:
        "Consumes generic CI failure and recovery webhooks and maps them to existing Blueprint Paperclip issues.",
    },
    {
      endpointKey: WEBHOOK_KEYS.intake,
      displayName: "Operator Intake",
      description:
        "Accepts normalized operator signals, including Slack workflow and email-forward payloads, and turns them into Paperclip issues.",
    },
  ],
  tools: [
    {
      name: TOOL_NAMES.scanWork,
      displayName: "Blueprint Scan Work",
      description:
        "Scan Blueprint repos and external workflow state, then create or update deduped Paperclip issues for newly discovered work.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
          applyChanges: { type: "boolean" },
        },
      },
    },
    {
      name: TOOL_NAMES.upsertWorkItem,
      displayName: "Blueprint Upsert Work Item",
      description:
        "Create or update a Blueprint Paperclip issue with stable dedupe keys, assignment, and provenance metadata.",
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
    {
      name: TOOL_NAMES.reportBlocker,
      displayName: "Blueprint Report Blocker",
      description:
        "Create a follow-up Paperclip blocker issue linked to an existing issue so cross-repo problems do not disappear in comments.",
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
    {
      name: TOOL_NAMES.resolveWorkItem,
      displayName: "Blueprint Resolve Work Item",
      description:
        "Mark a deduped Blueprint automation issue as done or cancelled with an explicit trace comment when the triggering condition clears.",
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
  ],
  ui: {
    slots: [
      {
        type: "page",
        id: SLOT_IDS.page,
        displayName: "Blueprint Automation",
        exportName: EXPORT_NAMES.page,
        routePath: PAGE_ROUTE,
      },
      {
        type: "dashboardWidget",
        id: SLOT_IDS.dashboardWidget,
        displayName: "Blueprint Automation",
        exportName: EXPORT_NAMES.dashboardWidget,
      },
    ],
  },
};

export default manifest;
