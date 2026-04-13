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
    ciWatchAgent: { type: "string" },
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
    "events.subscribe",
    "projects.read",
    "project.workspaces.read",
    "issues.read",
    "issues.create",
    "issues.update",
    "issue.comments.read",
    "issue.comments.create",
    "agents.read",
    "agents.update",
    "agents.invoke",
    "agents.runtime.write",
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
      opsDepartment: {
        type: "object",
        title: "Ops Department",
        properties: {
          enabled: { type: "boolean", default: true },
          agents: {
            type: "object",
            properties: {
              opsLead: { type: "string" },
              intake: { type: "string" },
              captureQa: { type: "string" },
              fieldOps: { type: "string" },
              financeSupport: { type: "string" },
            },
          },
        },
      },
      growthDepartment: {
        type: "object",
        title: "Growth Department",
        properties: {
          enabled: { type: "boolean", default: true },
          agents: {
            type: "object",
            properties: {
              growthLead: { type: "string" },
              conversionOptimizer: { type: "string" },
              analytics: { type: "string" },
              metricsReporter: { type: "string" },
              communityUpdates: { type: "string" },
              workspaceDigestPublisher: { type: "string" },
              marketIntel: { type: "string" },
              demandIntel: { type: "string" },
              capturerGrowth: { type: "string" },
              robotTeamGrowth: { type: "string" },
              siteOperatorPartnership: { type: "string" },
              cityDemand: { type: "string" },
            },
          },
        },
      },
      management: {
        type: "object",
        title: "Management",
        properties: {
          chiefOfStaffAgent: { type: "string", default: "blueprint-chief-of-staff" },
          notionReconcilerAgent: { type: "string", default: "notion-reconciler" },
        },
      },
      secrets: {
        type: "object",
        title: "Automation Secret Refs",
        properties: {
          notionApiTokenRef: { type: "string", format: "secret-ref" },
          slackOpsWebhookUrlRef: { type: "string", format: "secret-ref" },
          slackGrowthWebhookUrlRef: { type: "string", format: "secret-ref" },
          slackExecWebhookUrlRef: { type: "string", format: "secret-ref" },
          slackEngineeringWebhookUrlRef: { type: "string", format: "secret-ref" },
          slackManagerWebhookUrlRef: { type: "string", format: "secret-ref" },
          searchApiKeyRef: { type: "string", format: "secret-ref" },
          searchApiProviderRef: { type: "string", format: "secret-ref" },
          firehoseApiTokenRef: { type: "string", format: "secret-ref" },
          introwApiTokenRef: { type: "string", format: "secret-ref" },
        },
      },
      marketingCapabilities: {
        type: "object",
        title: "Marketing Capability Integrations",
        properties: {
          firehoseBaseUrl: { type: "string", title: "Firehose Adapter Base URL" },
          introwBaseUrl: { type: "string", title: "Introw Adapter Base URL" },
          firehoseDefaultTopics: {
            type: "array",
            title: "Firehose Default Topics",
            items: { type: "string" },
          },
          firehoseMaxSignalsPerRead: {
            type: "number",
            title: "Firehose Max Signals Per Read",
            default: 20,
          },
          introwDefaultWorkspace: {
            type: "string",
            title: "Introw Default Workspace",
          },
        },
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
      jobKey: JOB_KEYS.agentRegistrySync,
      displayName: "Blueprint Agent Registry Sync",
      description:
        "Reconciles Blueprint Agents registry metadata and generated page bodies against repo truth and live Paperclip state.",
      schedule: "30 */6 * * *",
    },
    {
      jobKey: JOB_KEYS.repoScan,
      displayName: "Blueprint Repo Scan",
      description:
        "Scans Blueprint repos for local drift and optionally polls GitHub workflow state to keep Paperclip issues current.",
      schedule: "*/30 * * * *",
    },
    {
      jobKey: JOB_KEYS.opsQueueScan,
      displayName: "Ops Queue Scan",
      description: "Periodic scan of Notion Work Queue to detect stale or unassigned items and reconcile duplicate queue issues.",
      schedule: "0 */2 * * *",
    },
    {
      jobKey: JOB_KEYS.notionQueueReconcile,
      displayName: "Notion Queue Reconcile",
      description:
        "Manual one-time reconciliation of historical duplicate Notion Work Queue issues already synced into Paperclip.",
      schedule: "0 0 1 1 *",
    },
    {
      jobKey: JOB_KEYS.routineHealthCheck,
      displayName: "Routine Health Check",
      description:
        "Monitors routine outcomes, checks budget limits, and evaluates phase graduation eligibility.",
      schedule: "0 */2 * * *",
    },
    {
      jobKey: JOB_KEYS.handoffMonitor,
      displayName: "Handoff Monitor",
      description:
        "Scans structured handoff issues, tracks collaboration metrics, and escalates stuck handoffs into Slack and Paperclip.",
      schedule: "*/5 * * * *",
    },
    {
      jobKey: JOB_KEYS.quotaCooldownEnforcer,
      displayName: "Quota Cooldown Enforcer",
      description:
        "Keeps workspace agents on the healthy lane while a Claude or Codex quota cooldown is active, then restores configured defaults after expiry.",
      schedule: "*/5 * * * *",
    },
    {
      jobKey: JOB_KEYS.executionDispatch,
      displayName: "Execution Dispatch",
      description:
        "Wakes assigned agents for stale actionable issues so work is executed instead of remaining passive queue state.",
      schedule: "*/15 * * * *",
    },
    {
      jobKey: JOB_KEYS.localHeadroomCheck,
      displayName: "Local Headroom Check",
      description:
        "Checks local trusted-host disk headroom and opens a concrete Paperclip issue before low-storage conditions degrade the control plane.",
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
    {
      endpointKey: WEBHOOK_KEYS.opsFirestore,
      displayName: "Firestore Ops Events",
      description: "Receives Firestore triggers for new signups, requests, and capture completions.",
    },
    {
      endpointKey: WEBHOOK_KEYS.opsStripe,
      displayName: "Stripe Ops Events",
      description: "Receives forwarded Stripe webhook events for payout and dispute triage.",
    },
    {
      endpointKey: WEBHOOK_KEYS.opsSupport,
      displayName: "Support Inbox",
      description: "Receives support tickets from email forward or contact form.",
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
      name: TOOL_NAMES.managerState,
      displayName: "Blueprint Manager State",
      description:
        "Read the chief-of-staff operating snapshot across issue state, routine health, active agents, and recent automation events.",
      parametersSchema: {
        type: "object",
        properties: {
          companyName: { type: "string" },
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
      name: TOOL_NAMES.dispatchHumanBlocker,
      displayName: "Blueprint Dispatch Human Blocker",
      description:
        "Queue or send a standard human-blocker packet for any true human gate, with optional chief-of-staff review before delivery.",
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
    {
      name: TOOL_NAMES.analyticsReport,
      displayName: "Generate Analytics Report",
      description:
        "Write a deterministic Blueprint analytics report from agent-supplied findings, then return proof artifacts for issue completion.",
      parametersSchema: {
        type: "object",
        properties: {
          cadence: { type: "string", enum: ["daily", "weekly"] },
          companyName: { type: "string" },
          issueId: { type: "string" },
          headline: { type: "string" },
          summaryBullets: {
            type: "array",
            items: { type: "string" },
          },
          workflowFindings: {
            type: "array",
            items: { type: "string" },
          },
          risks: {
            type: "array",
            items: { type: "string" },
          },
          recommendedFollowUps: {
            type: "array",
            items: { type: "string" },
          },
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
    {
      name: TOOL_NAMES.communityUpdatesReport,
      displayName: "Generate Community Updates Report",
      description:
        "Write a deterministic Blueprint community update draft from agent-supplied findings, then return proof artifacts for issue completion.",
      parametersSchema: {
        type: "object",
        properties: {
          cadence: { type: "string", enum: ["weekly", "ad_hoc"] },
          companyName: { type: "string" },
          issueId: { type: "string" },
          headline: { type: "string" },
          shippedThisWeek: {
            type: "array",
            items: { type: "string" },
          },
          byTheNumbers: {
            type: "array",
            items: { type: "string" },
          },
          whatWeLearned: {
            type: "array",
            items: { type: "string" },
          },
          whatIsNext: {
            type: "array",
            items: { type: "string" },
          },
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
    {
      name: TOOL_NAMES.metricsReporterReport,
      displayName: "Generate Metrics Reporter Output",
      description:
        "Write a deterministic Blueprint internal metrics report from agent-supplied findings, then return proof artifacts for issue completion.",
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
    {
      name: TOOL_NAMES.workspaceDigestReport,
      displayName: "Generate Workspace Digest",
      description:
        "Write a deterministic Blueprint workspace digest draft from agent-supplied findings, then return proof artifacts for issue completion.",
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
        },
        required: ["cadence", "headline", "roundup", "highlights", "nextActions"],
      },
    },
    {
      name: TOOL_NAMES.notionReconcilerRun,
      displayName: "Record Notion Reconciler Run",
      description:
        "Record the outcome of a Notion Reconciler sweep so Blueprint Agent Runs and the pilot registry stay current.",
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
    {
      name: TOOL_NAMES.notionReadWorkQueue,
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
    {
      name: TOOL_NAMES.notionWriteWorkQueue,
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
    {
      name: TOOL_NAMES.notionWriteKnowledge,
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
    {
      name: TOOL_NAMES.notionSearchPages,
      displayName: "Search Notion Pages",
      description: "Search Blueprint-managed Notion pages, optionally within a specific Hub database or for stale knowledge entries.",
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
    {
      name: TOOL_NAMES.notionFetchPage,
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
    {
      name: TOOL_NAMES.notionUpsertKnowledge,
      displayName: "Upsert Notion Knowledge",
      description: "Create or update a Blueprint Knowledge page using a stable natural key and optional duplicate archival.",
      parametersSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          type: { type: "string" },
          system: { type: "string" },
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
    {
      name: TOOL_NAMES.notionUpsertWorkQueue,
      displayName: "Upsert Notion Work Queue",
      description: "Create or update a Blueprint Work Queue page using a stable natural key and optional duplicate archival.",
      parametersSchema: {
        type: "object",
        properties: {
          title: { type: "string" },
          priority: { type: "string" },
          system: { type: "string" },
          lifecycleStage: { type: "string" },
          workType: { type: "string" },
          substage: { type: "string" },
          outputLocation: { type: "string" },
          executionSurface: { type: "string" },
          dueDate: { type: "string" },
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
    {
      name: TOOL_NAMES.notionUpdatePageMetadata,
      displayName: "Update Notion Page Metadata",
      description: "Repair metadata, ownership, freshness fields, and relations on a Blueprint-managed Notion page.",
      parametersSchema: {
        type: "object",
        properties: {
          pageId: { type: "string" },
          database: { type: "string", enum: ["work_queue", "knowledge", "skills", "agents", "agent_runs"] },
        },
        required: ["pageId", "database"],
      },
    },
    {
      name: TOOL_NAMES.notionMovePage,
      displayName: "Move Notion Page",
      description: "Move a Blueprint-managed page into the correct Hub database by recreating it there, optionally preserving content and archiving the source page.",
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
    {
      name: TOOL_NAMES.notionArchivePage,
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
    {
      name: TOOL_NAMES.notionCommentPage,
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
    {
      name: TOOL_NAMES.notionReconcileRelations,
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
    {
      name: TOOL_NAMES.webSearch,
      displayName: "Web Search",
      description:
        "Search the web for market intelligence, competitor info, technology trends, and research papers using Perplexity.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
        },
        required: ["query"],
      },
    },
    {
      name: TOOL_NAMES.slackPostDigest,
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
    {
      name: TOOL_NAMES.marketIntelReport,
      displayName: "Generate Market Intel Report",
      description:
        "Write a deterministic market intelligence report from agent-supplied findings, then return proof artifacts for issue completion.",
      parametersSchema: {
        type: "object",
        properties: {
          cadence: { type: "string", enum: ["daily", "weekly"] },
          companyName: { type: "string" },
          issueId: { type: "string" },
          headline: { type: "string" },
          signals: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                source: { type: "string" },
                relevanceScore: { type: "number" },
                urgencyScore: { type: "number" },
                actionabilityScore: { type: "number" },
                combinedScore: { type: "number" },
                summary: { type: "string" },
              },
            },
          },
          competitorUpdates: { type: "array", items: { type: "string" } },
          technologyFindings: { type: "array", items: { type: "string" } },
          recommendedActions: { type: "array", items: { type: "string" } },
        },
        required: [
          "cadence",
          "headline",
          "signals",
          "competitorUpdates",
          "technologyFindings",
          "recommendedActions",
        ],
      },
    },
    {
      name: TOOL_NAMES.budgetStatus,
      displayName: "Budget Status",
      description:
        "Query current budget status for an agent including run count, estimated spend, and budget limit.",
      parametersSchema: {
        type: "object",
        properties: {
          agentKey: { type: "string", description: "The agent key to check budget for" },
        },
        required: ["agentKey"],
      },
    },
    {
      name: TOOL_NAMES.phaseStatus,
      displayName: "Phase Status",
      description:
        "Query current phase, graduation metrics, and eligibility for a given agent.",
      parametersSchema: {
        type: "object",
        properties: {
          agentKey: { type: "string", description: "The agent key to check phase for" },
        },
        required: ["agentKey"],
      },
    },
    {
      name: TOOL_NAMES.recordOverride,
      displayName: "Record Override",
      description:
        "Record when a human or lead agent overrides a subordinate agent decision. Updates phase tracking metrics.",
      parametersSchema: {
        type: "object",
        properties: {
          agentKey: { type: "string", description: "The agent whose decision was overridden" },
          issueId: { type: "string", description: "The issue where the override occurred" },
          reason: { type: "string", description: "Why the decision was overridden" },
        },
        required: ["agentKey", "issueId", "reason"],
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
