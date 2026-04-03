#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
REPO_ROOT="$WORKSPACE_ROOT/Blueprint-WebApp"
PAPERCLIP_ENV_FILE="${PAPERCLIP_ENV_FILE:-$WORKSPACE_ROOT/.paperclip-blueprint.env}"

if [ -f "$PAPERCLIP_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$PAPERCLIP_ENV_FILE"
  set +a
fi

PAPERCLIP_HOST="${PAPERCLIP_HOST:-127.0.0.1}"
PAPERCLIP_PORT="${PAPERCLIP_PORT:-3100}"
PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://${PAPERCLIP_HOST}:${PAPERCLIP_PORT}}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE="${BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE:-auto}"
BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES="${BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES:-0}"
BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL="${BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL:-gpt-5.4-mini}"
BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT="${BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT:-xhigh}"
BLUEPRINT_PAPERCLIP_OPENCODE_PRIMARY_MODEL="${BLUEPRINT_PAPERCLIP_OPENCODE_PRIMARY_MODEL:-google/gemini-2.5-flash}"
BLUEPRINT_PAPERCLIP_OPENCODE_FALLBACK_MODEL="${BLUEPRINT_PAPERCLIP_OPENCODE_FALLBACK_MODEL:-openrouter/qwen/qwen3-coder-480b:free}"
BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL="${BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL:-qwen/qwen3.6-plus:free}"
OPENCODE_NO_TTY="${OPENCODE_NO_TTY:-1}"

export \
  PAPERCLIP_API_URL \
  PAPERCLIP_HOST \
  PAPERCLIP_PORT \
  COMPANY_NAME \
  REPO_ROOT \
  BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE \
  BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES \
  BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL \
  BLUEPRINT_PAPERCLIP_OPENCODE_PRIMARY_MODEL \
  BLUEPRINT_PAPERCLIP_OPENCODE_FALLBACK_MODEL \
  BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL \
  OPENCODE_NO_TTY \
  BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT

node --input-type=module <<'NODE'
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const paperclipApiUrl = process.env.PAPERCLIP_API_URL;
const companyName = process.env.COMPANY_NAME;
const repoRoot = process.env.REPO_ROOT;
const require = createRequire(pathToFileURL(path.join(repoRoot, "package.json")).href);
const yaml = require("js-yaml");
const requestedClaudeLaneMode = normalizeClaudeLaneMode(
  process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE,
);
const forceCodexClaudeLanes = /^(1|true|yes)$/i.test(
  process.env.BLUEPRINT_PAPERCLIP_FORCE_CODEX_CLAUDE_LANES ?? "",
);
const fallbackCodexModel =
  process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_MODEL ?? "gpt-5.4-mini";
const fallbackCodexReasoningEffort =
  process.env.BLUEPRINT_PAPERCLIP_CLAUDE_LANE_FALLBACK_REASONING_EFFORT ?? "xhigh";
const opencodeModel =
  process.env.BLUEPRINT_PAPERCLIP_OPENCODE_PRIMARY_MODEL ?? "google/gemini-2.5-flash";
const opencodeFallbackModel =
  process.env.BLUEPRINT_PAPERCLIP_OPENCODE_FALLBACK_MODEL ?? "openrouter/qwen/qwen3-coder-480b:free";
const hermesFallbackModel =
  process.env.BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL ?? "qwen/qwen3.6-plus:free";
const forceAdapterSync = /^(1|true|yes)$/i.test(
  process.env.BLUEPRINT_PAPERCLIP_FORCE_ADAPTER_SYNC ?? "",
);
const hermesFallbackModels = normalizeModelList([
  ...parseModelList(process.env.BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODELS),
  hermesFallbackModel,
  "openrouter/free",
  "stepfun/step-3.5-flash:free",
  "nvidia/nemotron-3-super:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "arcee-ai/trinity-large-preview:free",
]);
const legacyHermesModel = "gpt-5.4-mini";
const HERMES_MODEL_LADDER_CONFIG_KEY = "blueprintHermesModelLadder";
const paperclipConfigPath = path.join(
  repoRoot,
  "ops/paperclip/blueprint-company/.paperclip.yaml",
);

function normalizeClaudeLaneMode(value) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "claude":
    case "primary":
      return "claude";
    case "codex":
    case "fallback":
      return "codex";
    case "openrouter":
      return "openrouter";
    case "hermes":
      return "hermes";
    case "auto":
    case "":
      return "auto";
    default:
      console.warn(
        `Unknown BLUEPRINT_PAPERCLIP_CLAUDE_LANE_MODE=${value}; defaulting to auto`,
      );
      return "auto";
  }
}

function parseModelList(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function normalizeModelList(values) {
  const seen = new Set();
  const normalized = [];
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

async function fetchJson(resourcePath, init = {}) {
  const attempts = Number(process.env.PAPERCLIP_FETCH_ATTEMPTS || "3");
  const delayMs = Number(process.env.PAPERCLIP_FETCH_DELAY_MS || "500");
  let lastError = `Empty response for ${resourcePath}`;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${paperclipApiUrl}${resourcePath}`, {
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
        ...init,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${init.method ?? "GET"} ${resourcePath} failed: ${response.status} ${text}`);
      }
      const text = await response.text();
      if (text.length > 0) {
        return JSON.parse(text);
      }
      lastError = `Empty response for ${resourcePath}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Blueprint Paperclip API unavailable at ${paperclipApiUrl}${resourcePath}: ${lastError}`);
}

function hasSuffix(value) {
  return typeof value === "string" && /(?:-\d+| \d+)$/.test(value);
}

function pickCanonical(rows, exactKey) {
  const aliasMap = {
    "docs-agent": ["documentation-agent"],
  };
  const aliases = aliasMap[exactKey] ?? [];
  const matches = rows.filter((row) => {
    const urlKey = typeof row.urlKey === "string" ? row.urlKey : "";
    return urlKey === exactKey
      || aliases.includes(urlKey)
      || (!hasSuffix(urlKey) && !hasSuffix(row.name) && urlKey.startsWith(exactKey));
  });
  const preferred = matches.find((row) => row.urlKey === exactKey);
  const aliasPreferred = matches.find((row) => aliases.includes(row.urlKey));
  return preferred
    ?? aliasPreferred
    ?? matches.find((row) => !hasSuffix(row.urlKey) && !hasSuffix(row.name))
    ?? matches[0]
    ?? null;
}

function pickMatching(rows, exactKey) {
  return rows.filter((row) => {
    const urlKey = typeof row.urlKey === "string" ? row.urlKey : "";
    return urlKey === exactKey || urlKey.startsWith(`${exactKey}-`);
  });
}

function toPaperclipAgentKey(agentKey) {
  return agentKey;
}

function titleizeToken(token) {
  const overrides = {
    ceo: "CEO",
    cto: "CTO",
    qa: "QA",
    webapp: "WebApp",
  };
  return overrides[token] ?? `${token.charAt(0).toUpperCase()}${token.slice(1)}`;
}

const ROUTINE_TITLE_OVERRIDES = {
  "ceo-daily-review": "CEO Daily Review",
  "chief-of-staff-continuous-loop": "Chief of Staff Continuous Loop",
  "cto-cross-repo-triage": "CTO Cross-Repo Triage",
  "webapp-autonomy-loop": "WebApp Autonomy Loop",
  "webapp-review-loop": "WebApp Review Loop",
  "pipeline-autonomy-loop": "Pipeline Autonomy Loop",
  "pipeline-review-loop": "Pipeline Review Loop",
  "capture-autonomy-loop": "Capture Autonomy Loop",
  "capture-review-loop": "Capture Review Loop",
  "ops-lead-morning": "Ops Lead Morning",
  "ops-lead-afternoon": "Ops Lead Afternoon",
  "intake-agent-hourly": "Intake Agent Hourly",
  "capture-qa-daily": "Capture QA Daily",
  "field-ops-daily": "Field Ops Daily",
  "finance-support-daily": "Finance Support Daily",
  "growth-lead-daily": "Growth Lead Daily",
  "growth-lead-weekly": "Growth Lead Weekly",
  "analytics-daily": "Analytics Daily",
  "analytics-weekly": "Analytics Weekly",
  "founder-morning-brief": "Founder Morning Brief",
  "founder-daily-accountability-report": "Founder Daily Accountability Report",
  "founder-eod-brief": "Founder EoD Brief",
  "founder-friday-operating-recap": "Founder Friday Operating Recap",
  "founder-weekly-gaps-report": "Founder Weekly Gaps Report",
  "notion-manager-reconcile-sweep": "Notion Manager Reconcile Sweep",
  "notion-manager-stale-audit": "Notion Manager Stale Audit",
  "notion-manager-weekly-structure-sweep": "Notion Manager Weekly Structure Sweep",
  "investor-relations-monthly": "Investor Relations Monthly",
  "community-updates-weekly": "Community Updates Weekly",
  "conversion-weekly": "Conversion Weekly",
  "market-intel-daily": "Market Intel Daily",
  "market-intel-weekly": "Market Intel Weekly",
  "supply-intel-daily": "Supply Intel Daily",
  "supply-intel-weekly": "Supply Intel Weekly",
  "capturer-growth-weekly": "Capturer Growth Weekly",
  "capturer-growth-refresh": "Capturer Growth Refresh",
  "city-launch-weekly": "City Launch Weekly",
  "city-launch-refresh": "City Launch Refresh",
  "demand-intel-daily": "Demand Intel Daily",
  "demand-intel-weekly": "Demand Intel Weekly",
  "robot-team-growth-weekly": "Robot Team Growth Weekly",
  "robot-team-growth-refresh": "Robot Team Growth Refresh",
  "site-operator-partnership-weekly": "Site Operator Partnership Weekly",
  "site-operator-partnership-refresh": "Site Operator Partnership Refresh",
  "city-demand-weekly": "City Demand Weekly",
  "city-demand-refresh": "City Demand Refresh",
};

function titleizeRoutineKey(routineKey) {
  return ROUTINE_TITLE_OVERRIDES[routineKey]
    ?? routineKey.split("-").map(titleizeToken).join(" ");
}

function countEnabledScheduleTriggers(routine) {
  return (routine.triggers ?? []).filter(
    (trigger) => trigger.kind === "schedule" && trigger.enabled !== false,
  ).length;
}

function pickPreferredRoutine(matching, projectId, agentId) {
  if (!matching.length) return null;
  return [...matching].sort((left, right) => {
    const leftProjectAgent = left.projectId === projectId && left.assigneeAgentId === agentId ? 1 : 0;
    const rightProjectAgent = right.projectId === projectId && right.assigneeAgentId === agentId ? 1 : 0;
    if (leftProjectAgent !== rightProjectAgent) return rightProjectAgent - leftProjectAgent;

    const leftActive = left.status === "active" ? 1 : 0;
    const rightActive = right.status === "active" ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;

    const leftEnabledSchedules = countEnabledScheduleTriggers(left);
    const rightEnabledSchedules = countEnabledScheduleTriggers(right);
    if (leftEnabledSchedules !== rightEnabledSchedules) return leftEnabledSchedules - rightEnabledSchedules;

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  })[0] ?? null;
}

function inferRoutineAgentKey(routineKey, routineConfig) {
  if (typeof routineConfig.agent === "string" && routineConfig.agent.length > 0) {
    return toPaperclipAgentKey(routineConfig.agent);
  }

  const mappings = [
    [/^ceo-/, "blueprint-ceo"],
    [/^cto-/, "blueprint-cto"],
    [/^webapp-autonomy-loop$/, "webapp-codex"],
    [/^webapp-review-loop$/, "webapp-review"],
    [/^pipeline-autonomy-loop$/, "pipeline-codex"],
    [/^pipeline-review-loop$/, "pipeline-review"],
    [/^capture-autonomy-loop$/, "capture-codex"],
    [/^capture-review-loop$/, "capture-review"],
  ];

  const match = mappings.find(([pattern]) => pattern.test(routineKey));
  return match ? match[1] : null;
}

const AGENT_DEFAULT_PROJECT_KEYS = {
  "blueprint-ceo": "blueprint-executive-ops",
  "blueprint-chief-of-staff": "blueprint-executive-ops",
  "notion-manager-agent": "blueprint-executive-ops",
  "blueprint-cto": "blueprint-webapp",
  "webapp-codex": "blueprint-webapp",
  "webapp-review": "blueprint-webapp",
  "pipeline-codex": "blueprint-capture-pipeline",
  "pipeline-review": "blueprint-capture-pipeline",
  "capture-codex": "blueprint-capture",
  "capture-review": "blueprint-capture",
  "ops-lead": "blueprint-executive-ops",
  "intake-agent": "blueprint-webapp",
  "capture-qa-agent": "blueprint-capture-pipeline",
  "field-ops-agent": "blueprint-capture",
  "finance-support-agent": "blueprint-webapp",
  "growth-lead": "blueprint-executive-ops",
  "conversion-agent": "blueprint-webapp",
  "analytics-agent": "blueprint-webapp",
  "investor-relations-agent": "blueprint-executive-ops",
  "community-updates-agent": "blueprint-webapp",
  "market-intel-agent": "blueprint-webapp",
  "supply-intel-agent": "blueprint-executive-ops",
  "capturer-growth-agent": "blueprint-webapp",
  "city-launch-agent": "blueprint-executive-ops",
  "demand-intel-agent": "blueprint-executive-ops",
  "robot-team-growth-agent": "blueprint-webapp",
  "site-operator-partnership-agent": "blueprint-executive-ops",
  "city-demand-agent": "blueprint-executive-ops",
  "buyer-solutions-agent": "blueprint-webapp",
  "solutions-engineering-agent": "blueprint-webapp",
  "rights-provenance-agent": "blueprint-capture-pipeline",
  "security-procurement-agent": "blueprint-executive-ops",
  "capturer-success-agent": "blueprint-capture",
  "site-catalog-agent": "blueprint-webapp",
  "outbound-sales-agent": "blueprint-webapp",
  "buyer-success-agent": "blueprint-webapp",
  "revenue-ops-pricing-agent": "blueprint-executive-ops",
  "docs-agent": "blueprint-executive-ops",
};

function resolveInstructionSource(agentKey) {
  const agentPath = path.join(repoRoot, "ops/paperclip/blueprint-company/agents", agentKey, "AGENTS.md");
  const skillAgentKey = agentKey.replace(/^blueprint-/, "");
  const skillPath = path.join(repoRoot, "ops/paperclip/skills", `${skillAgentKey}.md`);
  return fs.access(agentPath).then(() => agentPath).catch(() => fs.access(skillPath).then(() => skillPath).catch(() => null));
}

async function ensureCanonicalProject(companyId, projects, projectKey, projectConfig) {
  const existing = pickCanonical(projects, projectKey);
  if (existing) {
    return existing;
  }

  const workspaceEntries = Object.entries(projectConfig?.workspaces ?? {});
  const primaryWorkspace = workspaceEntries.find(([, workspace]) => workspace?.isPrimary)
    ?? workspaceEntries[0]
    ?? null;
  const workspaceConfig = primaryWorkspace?.[1] ?? null;
  const projectName =
    (typeof workspaceConfig?.name === "string" && workspaceConfig.name.trim().length > 0
      ? workspaceConfig.name.trim()
      : projectKey.split("-").map(titleizeToken).join(" "));
  const normalizedProjectStatus =
    projectConfig?.status === "active"
      ? "in_progress"
      : projectConfig?.status ?? "in_progress";

  const created = await fetchJson(`/api/companies/${companyId}/projects`, {
    method: "POST",
    body: JSON.stringify({
      name: projectName,
      status: normalizedProjectStatus,
      color: projectConfig?.color ?? "blue",
      workspace: workspaceConfig ? {
        name: workspaceConfig.name ?? projectName,
        sourceType: workspaceConfig.sourceType ?? "git_repo",
        cwd: workspaceConfig.cwd,
        repoUrl: workspaceConfig.repoUrl,
        repoRef: workspaceConfig.repoRef,
        defaultRef: workspaceConfig.defaultRef,
        visibility: workspaceConfig.visibility,
        setupCommand: workspaceConfig.setupCommand,
        isPrimary: workspaceConfig.isPrimary !== false,
      } : undefined,
    }),
  });
  projects.push(created);
  console.log(`[paperclip] Created missing canonical project ${projectKey}`);
  return created;
}

function buildAnalyticsRoutineDescription(cadence) {
  return [
    "Investigate repo, CI, and Blueprint plugin state first, then synthesize the findings into headline, summaryBullets, workflowFindings, risks, and recommendedFollowUps.",
    "Every recommendedFollowUp will be turned into a routed Paperclip follow-up issue by the deterministic writer, so keep those items concrete and owner-ready.",
    "Use structured followUpIssues only when you need to override the default title, assignee, project, priority, or blocker-vs-owner_ready classification.",
    "Do not place monitor-only or informational notes in recommendedFollowUps; keep those in summaryBullets, workflowFindings, or risks instead.",
    `Call POST ${paperclipApiUrl}/api/plugins/blueprint.automation/actions/analytics-report with JSON body {"params":{"cadence":"${cadence}"...}}.`,
    "On this local trusted Paperclip host, call the plugin action route directly by plugin key and X-Paperclip-Run-Id. Do not waste time resolving the plugin id. Do not send the agent bearer token to the plugin action route if it returns Board access required.",
    "After the action returns, PATCH the current issue to done when data.outcome is done; otherwise PATCH it to blocked.",
    "Use data.issueComment as the issue comment so the final state always contains proof links or the exact failure reason.",
  ].join(" ");
}

function buildMarketIntelRoutineDescription(cadence) {
  return [
    "Read the steering file at ops/paperclip/programs/market-intel-program.md for current research priorities.",
    "Scan web sources using the web-search tool for competitor, technology, market, and regulatory signals.",
    "Score each signal using the relevance/urgency/actionability formula from the contract.",
    "Synthesize findings into headline, signals, competitorUpdates, technologyFindings, and recommendedActions.",
    `Call POST ${paperclipApiUrl}/api/plugins/blueprint.automation/actions/market-intel-report with JSON body {"params":{"cadence":"${cadence}"...}}.`,
    "On this local trusted Paperclip host, call the plugin action route directly by plugin key and X-Paperclip-Run-Id.",
    "After the action returns, PATCH the current issue to done when data.outcome is done; otherwise PATCH it to blocked.",
    "Use data.issueComment as the issue comment so the final state always contains proof links or the exact failure reason.",
  ].join(" ");
}

function buildInvestorRelationsRoutineDescription() {
  return [
    "Read ops/paperclip/programs/investor-relations-agent-program.md and the humanizer skill before drafting.",
    "Ground on the current issue and gather real month-over-month metrics from Stripe, Firestore, analytics, Paperclip, and Firehose where relevant.",
    "Draft the full investor update with notion-write-knowledge and create the tracking artifact with notion-write-work-queue.",
    "When Nitrosend is configured, maintain a draft-only Blueprint Investors audience and create the monthly draft campaign. Do not live send or publish.",
    "When Slack is configured, post an internal #paperclip-exec digest announcing the draft is ready for review.",
    "PATCH the current issue to done only when the metrics are sourced, the draft artifacts exist, and the copy has passed the humanizer anti-AI pass. Otherwise PATCH it to blocked with the exact missing artifact or source-of-truth failure.",
  ].join(" ");
}

function buildCommunityUpdatesRoutineDescription() {
  return [
    "Read ops/paperclip/programs/community-updates-agent-program.md and the humanizer skill before drafting.",
    "Investigate the just-finished week first, then synthesize the findings into headline, shippedThisWeek, byTheNumbers, whatWeLearned, and whatIsNext.",
    `Call POST ${paperclipApiUrl}/api/plugins/blueprint.automation/actions/community-updates-report with JSON body {"params":{"cadence":"weekly"...}}.`,
    "On this local trusted Paperclip host, call the plugin action route directly by plugin key and X-Paperclip-Run-Id. Do not waste time resolving the plugin id. Do not send the agent bearer token to the plugin action route if it returns Board access required.",
    "After the action returns, PATCH the current issue to done when data.outcome is done; otherwise PATCH it to blocked.",
    "Use data.issueComment as the issue comment so the final state always contains proof links or the exact failure reason.",
  ].join(" ");
}

function buildRoutineDescription(routineKey) {
  if (routineKey === "analytics-daily") return buildAnalyticsRoutineDescription("daily");
  if (routineKey === "analytics-weekly") return buildAnalyticsRoutineDescription("weekly");
  if (routineKey === "investor-relations-monthly") return buildInvestorRelationsRoutineDescription();
  if (routineKey === "community-updates-weekly") return buildCommunityUpdatesRoutineDescription();
  if (routineKey === "market-intel-daily") return buildMarketIntelRoutineDescription("daily");
  if (routineKey === "market-intel-weekly") return buildMarketIntelRoutineDescription("weekly");
  return undefined;
}

function buildClaudeProbeConfigs(yamlAgents) {
  const seen = new Set();
  return Object.values(yamlAgents).flatMap((agentConfig) => {
    if (agentConfig?.adapter?.type !== "claude_local" || !agentConfig?.adapter?.config) {
      return [];
    }

    const adapterConfig = agentConfig.adapter.config;
    const probeConfig = {
      cwd: adapterConfig.cwd,
      model: adapterConfig.model || "claude-sonnet-4-6",
      dangerouslySkipPermissions:
        adapterConfig.dangerouslySkipPermissions !== false,
    };
    const fingerprint = JSON.stringify(probeConfig);
    if (seen.has(fingerprint)) {
      return [];
    }
    seen.add(fingerprint);
    return [probeConfig];
  });
}

function buildCodexProbeConfigs(yamlAgents) {
  const seen = new Set();
  return Object.values(yamlAgents).flatMap((agentConfig) => {
    if (agentConfig?.adapter?.type !== "codex_local" || !agentConfig?.adapter?.config) {
      return [];
    }

    const adapterConfig = agentConfig.adapter.config;
    const probeConfig = {
      cwd: adapterConfig.cwd,
      model: adapterConfig.model || fallbackCodexModel,
      modelReasoningEffort:
        adapterConfig.modelReasoningEffort || fallbackCodexReasoningEffort,
      dangerouslyBypassApprovalsAndSandbox:
        adapterConfig.dangerouslyBypassApprovalsAndSandbox !== false,
    };
    const fingerprint = JSON.stringify(probeConfig);
    if (seen.has(fingerprint)) {
      return [];
    }
    seen.add(fingerprint);
    return [probeConfig];
  });
}

function buildHermesProbeConfig(adapterConfig) {
  const normalized = buildHermesAdapterConfig(adapterConfig);
  return {
    cwd: normalized.cwd,
    ...(typeof normalized.instructionsFilePath === "string"
      && normalized.instructionsFilePath.trim().length > 0
      ? { instructionsFilePath: normalized.instructionsFilePath }
      : {}),
    ...(typeof normalized.model === "string" && normalized.model.trim().length > 0
      ? { model: normalized.model }
      : {}),
    ...(typeof normalized.timeoutSec === "number" ? { timeoutSec: normalized.timeoutSec } : {}),
  };
}

function buildOpencodeProbeConfig(cwd) {
  return {
    cwd,
    model: opencodeModel,
  };
}

function buildClaudeAdapterConfig(adapterConfig) {
  const next = { ...(adapterConfig ?? {}) };
  delete next.dangerouslyBypassApprovalsAndSandbox;
  delete next.modelReasoningEffort;
  return {
    ...next,
    model:
      typeof adapterConfig?.model === "string" && adapterConfig.model.trim().length > 0
        ? adapterConfig.model
        : "claude-sonnet-4-6",
    dangerouslySkipPermissions: adapterConfig?.dangerouslySkipPermissions !== false,
  };
}

function buildCodexAdapterConfig(adapterConfig) {
  const next = { ...(adapterConfig ?? {}) };
  delete next.dangerouslySkipPermissions;
  return {
    ...next,
    model:
      typeof adapterConfig?.model === "string" && adapterConfig.model.trim().length > 0
        ? adapterConfig.model
        : fallbackCodexModel,
    modelReasoningEffort:
      typeof adapterConfig?.modelReasoningEffort === "string" && adapterConfig.modelReasoningEffort.trim().length > 0
        ? adapterConfig.modelReasoningEffort
        : fallbackCodexReasoningEffort,
    dangerouslyBypassApprovalsAndSandbox:
      adapterConfig?.dangerouslyBypassApprovalsAndSandbox !== false,
  };
}

function buildHermesAdapterConfig(adapterConfig) {
  const next = { ...(adapterConfig ?? {}) };
  const configuredModel =
    typeof adapterConfig?.model === "string" && adapterConfig.model.trim().length > 0
      ? adapterConfig.model.trim()
      : "";
  const ladder = normalizeModelList([
    ...(configuredModel.length > 0 && configuredModel !== legacyHermesModel ? [configuredModel] : []),
    ...parseModelList(adapterConfig?.[HERMES_MODEL_LADDER_CONFIG_KEY]),
    ...hermesFallbackModels,
  ]);
  const model =
    configuredModel.length > 0 && configuredModel !== legacyHermesModel
      ? configuredModel
      : ladder[0] ?? hermesFallbackModel;

  return {
    ...next,
    model,
    [HERMES_MODEL_LADDER_CONFIG_KEY]: ladder,
    modelReasoningEffort:
      typeof adapterConfig?.modelReasoningEffort === "string" && adapterConfig.modelReasoningEffort.trim().length > 0
        ? adapterConfig.modelReasoningEffort
        : "xhigh",
    timeoutSec: typeof adapterConfig?.timeoutSec === "number" ? adapterConfig.timeoutSec : 1800,
  };
}

function tertiaryOpencodeFallbackFor(desired, baseAdapterConfig = desired.adapterConfig ?? {}) {
  const adapterConfig = baseAdapterConfig ?? {};
  const next = { ...adapterConfig };
  const cwd = typeof adapterConfig.cwd === "string" ? adapterConfig.cwd : "";
  if (!cwd) return null;
  delete next.dangerouslySkipPermissions;
  delete next.dangerouslyBypassApprovalsAndSandbox;
  delete next.modelReasoningEffort;
  return {
    adapterType: "opencode_local",
    adapterConfig: {
      ...next,
      cwd,
      model: opencodeModel,
      fallbackModel: opencodeFallbackModel,
      timeoutSec: typeof adapterConfig.timeoutSec === "number" ? adapterConfig.timeoutSec : 1800,
    },
  };
}

function hermesFreeFallbackFor(desired, baseAdapterConfig = desired.adapterConfig ?? {}) {
  const adapterConfig = buildHermesAdapterConfig(baseAdapterConfig ?? {});
  const cwd = typeof adapterConfig.cwd === "string" ? adapterConfig.cwd : "";
  if (!cwd) return null;
  return {
    adapterType: "hermes_local",
    adapterConfig: {
      ...adapterConfig,
      cwd,
    },
  };
}

function summarizeProbeFailure(result, fallbackMessage) {
  return result?.checks?.map?.((check) => check.message).filter(Boolean).join("; ") || fallbackMessage;
}

async function probeAdapter(companyId, adapterType, adapterConfig) {
  try {
    const result = await fetchJson(
      `/api/companies/${companyId}/adapters/${adapterType}/test-environment`,
      {
        method: "POST",
        body: JSON.stringify({ adapterConfig }),
      },
    );
    return {
      status:
        result?.status === "pass"
          ? "pass"
          : result?.status === "warn"
            ? "warn"
            : "fail",
      reason:
        result?.status === "pass"
          ? `${adapterType} probe passed`
          : result?.status === "warn"
            ? summarizeProbeFailure(result, `${adapterType} probe warned`)
          : summarizeProbeFailure(result, `${adapterType} probe failed`),
    };
  } catch (error) {
    return {
      status: "fail",
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

function buildWorkspaceProbeMatrix(yamlAgents) {
  const byCwd = new Map();
  for (const agentConfig of Object.values(yamlAgents)) {
    const adapterType = agentConfig?.adapter?.type;
    const adapterConfig = agentConfig?.adapter?.config;
    const cwd = typeof adapterConfig?.cwd === "string" ? adapterConfig.cwd : "";
    if (!cwd) continue;
    if (!byCwd.has(cwd)) {
      byCwd.set(cwd, {});
    }
    const entry = byCwd.get(cwd);
    if (adapterType === "claude_local" && !entry.claude_local) {
      entry.claude_local = {
        cwd,
        model: adapterConfig.model || "claude-sonnet-4-6",
        dangerouslySkipPermissions: adapterConfig.dangerouslySkipPermissions !== false,
      };
    }
    if (adapterType === "codex_local" && !entry.codex_local) {
      entry.codex_local = {
        cwd,
        model: adapterConfig.model || fallbackCodexModel,
        modelReasoningEffort:
          adapterConfig.modelReasoningEffort || fallbackCodexReasoningEffort,
        dangerouslyBypassApprovalsAndSandbox:
          adapterConfig.dangerouslyBypassApprovalsAndSandbox !== false,
      };
    }
    if (adapterType === "hermes_local" && !entry.hermes_local) {
      entry.hermes_local = buildHermesProbeConfig(adapterConfig);
    }
    // Probe hermes_local for every cwd — it is the secondary-free fallback for claude/codex agents
    if (!entry.hermes_local) {
      entry.hermes_local = { cwd };
    }
    // Probe opencode_local for every cwd that has any adapter — it is the tertiary fallback for all
    if (!entry.opencode_local) {
      entry.opencode_local = buildOpencodeProbeConfig(cwd);
    }
  }
  return byCwd;
}

async function resolveWorkspaceAvailability(companyId, yamlAgents) {
  const workspaceMatrix = buildWorkspaceProbeMatrix(yamlAgents);
  const availability = {};
  for (const [cwd, probeConfigs] of workspaceMatrix.entries()) {
    availability[cwd] = {};
    if (probeConfigs.claude_local) {
      availability[cwd].claude_local = await probeAdapter(
        companyId,
        "claude_local",
        probeConfigs.claude_local,
      );
    }
    if (probeConfigs.codex_local) {
      availability[cwd].codex_local = await probeAdapter(
        companyId,
        "codex_local",
        probeConfigs.codex_local,
      );
    }
    if (probeConfigs.hermes_local) {
      availability[cwd].hermes_local = await probeAdapter(
        companyId,
        "hermes_local",
        probeConfigs.hermes_local,
      );
    }
    if (probeConfigs.opencode_local) {
      availability[cwd].opencode_local = await probeAdapter(
        companyId,
        "opencode_local",
        probeConfigs.opencode_local,
      );
    }
  }
  return availability;
}

function fallbackAdapterFor(desired) {
  const adapterConfig = desired.adapterConfig ?? {};
  if (desired.adapterType === "claude_local") {
    return {
      adapterType: "codex_local",
      adapterConfig: buildCodexAdapterConfig({
        ...adapterConfig,
        model: fallbackCodexModel,
        modelReasoningEffort: fallbackCodexReasoningEffort,
      }),
    };
  }

  if (desired.adapterType === "hermes_local") {
    // hermes has no tier-2 equivalent; direct tertiary fallback is handled in chooseAdapterForAgent
    return null;
  }

  if (desired.adapterType !== "codex_local") {
    return null;
  }

  return {
    adapterType: "claude_local",
    adapterConfig: buildClaudeAdapterConfig({
      ...adapterConfig,
      model: "claude-sonnet-4-6",
    }),
  };
}

function buildExecutionPolicyForAgent(agentConfig) {
  const authoredAdapterType = agentConfig?.adapter?.type;
  const authoredAdapterConfig = agentConfig?.adapter?.config ?? {};
  if (!authoredAdapterType || !authoredAdapterConfig) {
    return {};
  }

  const perAdapterConfig = {
    claude_local: buildClaudeAdapterConfig(authoredAdapterConfig),
    codex_local: buildCodexAdapterConfig({
      ...authoredAdapterConfig,
      model: fallbackCodexModel,
      modelReasoningEffort: fallbackCodexReasoningEffort,
    }),
    hermes_local:
      authoredAdapterType === "hermes_local"
        ? buildHermesAdapterConfig(authoredAdapterConfig)
        : hermesFreeFallbackFor(
          { adapterType: authoredAdapterType, adapterConfig: authoredAdapterConfig },
          authoredAdapterConfig,
        )?.adapterConfig ?? undefined,
    opencode_local: tertiaryOpencodeFallbackFor(
      { adapterType: authoredAdapterType, adapterConfig: authoredAdapterConfig },
      authoredAdapterConfig,
    )?.adapterConfig ?? undefined,
  };

  if (authoredAdapterType === "claude_local") {
    return {
      mode: "prefer_available",
      compatibleAdapterTypes: ["claude_local", "hermes_local", "opencode_local", "codex_local"],
      preferredAdapterTypes: ["claude_local", "hermes_local", "opencode_local", "codex_local"],
      perAdapterConfig,
    };
  }

  if (authoredAdapterType === "codex_local") {
    return {
      mode: "prefer_available",
      compatibleAdapterTypes: ["codex_local", "claude_local", "hermes_local", "opencode_local"],
      preferredAdapterTypes: ["codex_local", "claude_local", "hermes_local", "opencode_local"],
      perAdapterConfig,
    };
  }

  if (authoredAdapterType === "hermes_local") {
    return {
      mode: "prefer_available",
      compatibleAdapterTypes: ["hermes_local", "opencode_local", "claude_local", "codex_local"],
      preferredAdapterTypes: ["hermes_local", "claude_local", "codex_local", "opencode_local"],
      perAdapterConfig,
    };
  }

  if (authoredAdapterType === "opencode_local") {
    return {
      mode: "prefer_available",
      compatibleAdapterTypes: ["opencode_local", "hermes_local"],
      preferredAdapterTypes: ["opencode_local", "hermes_local"],
      perAdapterConfig,
    };
  }

  return {};
}

function chooseAdapterForAgent(desired, requestedMode, workspaceAvailability) {
  // openrouter mode: force all agents immediately to opencode_local (no probing)
  if (requestedMode === "openrouter") {
    return tertiaryOpencodeFallbackFor(desired) ?? desired;
  }

  // hermes mode: force all agents to hermes_local (skip claude/codex), fall to opencode if hermes fails
  if (requestedMode === "hermes") {
    const hermesFree = hermesFreeFallbackFor(desired);
    if (hermesFree && workspaceAvailability?.hermes_local?.status === "pass") return hermesFree;
    const opencode = tertiaryOpencodeFallbackFor(desired);
    if (opencode && workspaceAvailability?.opencode_local?.status === "pass") return opencode;
    return hermesFree ?? desired;
  }

  // hermes_local: no tier-2 equivalent — probe hermes, fall to opencode on failure
  if (desired.adapterType === "hermes_local") {
    const hermesStatus = workspaceAvailability?.hermes_local?.status;
    if (hermesStatus === "pass") return desired;
    const opencode = tertiaryOpencodeFallbackFor(desired);
    if (opencode && workspaceAvailability?.opencode_local?.status === "pass") return opencode;
    return desired;
  }

  // claude_local and codex_local only from here
  if (desired.adapterType !== "claude_local" && desired.adapterType !== "codex_local") {
    return desired;
  }

  const fallback = fallbackAdapterFor(desired);

  if (requestedMode === "claude") {
    return desired.adapterType === "claude_local" ? desired : (fallback ?? desired);
  }
  if (requestedMode === "codex") {
    return desired.adapterType === "codex_local" ? desired : (fallback ?? desired);
  }

  // auto mode: 3-tier probe chain
  const desiredStatus = workspaceAvailability?.[desired.adapterType]?.status;
  if (desiredStatus === "pass") return desired;

  if (fallback) {
    const fallbackStatus = workspaceAvailability?.[fallback.adapterType]?.status;
    if (fallbackStatus === "pass") return fallback;
  }

  // Tier 3: hermes_local with free OpenRouter model (before terminal opencode fallback)
  const hermesFree = hermesFreeFallbackFor(desired);
  if (hermesFree && workspaceAvailability?.hermes_local?.status === "pass") return hermesFree;

  // Tier 4: opencode_local (free, auto-activates when all other tiers fail)
  const opencode = tertiaryOpencodeFallbackFor(desired);
  if (opencode && workspaceAvailability?.opencode_local?.status === "pass") return opencode;

  return desired;
}

function asPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function shouldPreserveFixedLiveAdapter(agent, workspaceAvailability) {
  if (forceAdapterSync) return false;
  const runtimeConfig = asPlainObject(agent?.runtimeConfig);
  const executionPolicy = asPlainObject(runtimeConfig.executionPolicy);
  if (executionPolicy.mode !== "fixed") return false;

  const adapterType = typeof agent?.adapterType === "string" ? agent.adapterType : "";
  if (!adapterType) return false;

  const availability = workspaceAvailability?.[adapterType];
  if (!availability) return true;
  return availability.status === "pass" || availability.status === "warn";
}

const config = yaml.load(await fs.readFile(paperclipConfigPath, "utf8")) ?? {};
const yamlAgents = config.agents ?? {};
const yamlRoutines = config.routines ?? {};
const yamlProjects = config.projects ?? {};

const companies = await fetchJson("/api/companies");
const company = companies.find((entry) => entry.name === companyName);
if (!company) {
  throw new Error(`Company not found: ${companyName}`);
}

const [agents, projects, routines] = await Promise.all([
  fetchJson(`/api/companies/${company.id}/agents`),
  fetchJson(`/api/companies/${company.id}/projects`),
  fetchJson(`/api/companies/${company.id}/routines`),
]);
const effectiveRequestedMode = forceCodexClaudeLanes ? "codex" : requestedClaudeLaneMode;
const workspaceAvailability = await resolveWorkspaceAvailability(company.id, yamlAgents);
for (const [cwd, adapters] of Object.entries(workspaceAvailability)) {
  const claudeReason = adapters.claude_local?.reason ?? "not configured";
  const codexReason = adapters.codex_local?.reason ?? "not configured";
  const hermesReason = adapters.hermes_local?.reason ?? "not configured";
  const opencodeReason = adapters.opencode_local?.reason ?? "not configured";
  console.log(
    `[paperclip] ${cwd} -> claude=${adapters.claude_local?.status ?? "n/a"} (${claudeReason}) | codex=${adapters.codex_local?.status ?? "n/a"} (${codexReason}) | hermes=${adapters.hermes_local?.status ?? "n/a"} (${hermesReason}) | opencode=${adapters.opencode_local?.status ?? "n/a"} (${opencodeReason})`,
  );
}

const desiredAgents = Object.fromEntries(
  Object.entries(yamlAgents).flatMap(([yamlAgentKey, agentConfig]) => {
    const paperclipAgentKey = toPaperclipAgentKey(yamlAgentKey);
    const adapterType = agentConfig?.adapter?.type;
    const authoredAdapterConfig = agentConfig?.adapter?.config;
    const adapterConfig =
      adapterType === "hermes_local"
        ? buildHermesAdapterConfig(authoredAdapterConfig)
        : authoredAdapterConfig;
    if (!adapterType || !adapterConfig) {
      console.warn(`Skipping ${paperclipAgentKey}: missing adapter config in .paperclip.yaml`);
      return [];
    }
    return [[
      paperclipAgentKey,
      chooseAdapterForAgent(
        { adapterType, adapterConfig },
        effectiveRequestedMode,
        workspaceAvailability[adapterConfig.cwd] ?? {},
      ),
    ]];
  }),
);

for (const [agentKey, desired] of Object.entries(desiredAgents)) {
  const agent = pickCanonical(agents, agentKey);
  const yamlAgentConfig = yamlAgents[agentKey];
  if (!agent) {
    console.warn(`Agent not found in Paperclip: ${agentKey}`);
    continue;
  }
  const currentAdapterConfig = asPlainObject(agent.adapterConfig);
  const existingRuntimeConfig = asPlainObject(agent.runtimeConfig);
  const preserveFixedLiveAdapter = shouldPreserveFixedLiveAdapter(
    agent,
    workspaceAvailability[currentAdapterConfig.cwd ?? desired.adapterConfig.cwd] ?? {},
  );
  const effectiveDesired = preserveFixedLiveAdapter
    ? {
      adapterType: agent.adapterType,
      adapterConfig: currentAdapterConfig,
    }
    : desired;

  const nextRuntimeConfig = preserveFixedLiveAdapter
    ? existingRuntimeConfig
    : {
      ...existingRuntimeConfig,
      executionPolicy: buildExecutionPolicyForAgent(yamlAgentConfig),
    };
  if (!preserveFixedLiveAdapter) {
    delete nextRuntimeConfig.executionProfile;
  }

  const agentNeedsPatch =
    agent.adapterType !== effectiveDesired.adapterType
    || stableStringify(currentAdapterConfig) !== stableStringify(effectiveDesired.adapterConfig)
    || stableStringify(existingRuntimeConfig) !== stableStringify(nextRuntimeConfig);

  if (agentNeedsPatch) {
    await fetchJson(`/api/agents/${agent.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        adapterType: effectiveDesired.adapterType,
        replaceAdapterConfig: true,
        adapterConfig: effectiveDesired.adapterConfig,
        runtimeConfig: nextRuntimeConfig,
      }),
    });
  } else if (preserveFixedLiveAdapter) {
    console.log(
      `[paperclip] Preserved fixed live adapter override for ${agentKey} -> ${agent.adapterType}`,
    );
  }

  if (agentNeedsPatch && agent.adapterType !== effectiveDesired.adapterType) {
    await fetchJson(`/api/agents/${agent.id}/runtime-state/reset-session`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  }
  if (agent.status === "paused") {
    await fetchJson(`/api/agents/${agent.id}/resume`, { method: "POST" });
  }
}

const canonicalProjectEntries = await Promise.all(
  Object.entries(yamlProjects).map(async ([projectKey, projectConfig]) => [
    projectKey,
    await ensureCanonicalProject(company.id, projects, projectKey, projectConfig),
  ]),
);
const canonicalProjects = Object.fromEntries(canonicalProjectEntries);

const canonicalAgents = Object.fromEntries(
  Object.keys(desiredAgents).map((agentKey) => [agentKey, pickCanonical(agents, agentKey)]),
);

async function syncAgentInstructions(agent, sourcePath) {
  if (!agent || !sourcePath) return;
  const sourceDir = path.dirname(sourcePath);
  const sourceBase = path.basename(sourcePath);
  const bundleFiles = [];

  if (sourceBase === "AGENTS.md") {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    const markdownFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => entry.name)
      .sort((a, b) => {
        if (a === "AGENTS.md") return -1;
        if (b === "AGENTS.md") return 1;
        return a.localeCompare(b);
      });

    for (const filename of markdownFiles) {
      bundleFiles.push({
        path: filename,
        content: await fs.readFile(path.join(sourceDir, filename), "utf8"),
      });
    }
  } else {
    bundleFiles.push({
      path: "AGENTS.md",
      content: await fs.readFile(sourcePath, "utf8"),
    });
  }

  await fetchJson(`/api/agents/${agent.id}/instructions-bundle`, {
    method: "PATCH",
    body: JSON.stringify({
      mode: "managed",
      entryFile: "AGENTS.md",
      clearLegacyPromptTemplate: true,
    }),
  });

  for (const file of bundleFiles) {
    await fetchJson(`/api/agents/${agent.id}/instructions-bundle/file`, {
      method: "PUT",
      body: JSON.stringify({
        path: file.path,
        content: file.content,
        clearLegacyPromptTemplate: true,
      }),
    });
  }
}

const instructionSourceEntries = await Promise.all(
  Object.keys(desiredAgents).map(async (agentKey) => [agentKey, await resolveInstructionSource(agentKey)]),
);
const instructionSources = Object.fromEntries(
  instructionSourceEntries.filter(([, sourcePath]) => Boolean(sourcePath)),
);

const desiredRoutines = Object.entries(yamlRoutines).flatMap(([routineKey, routineConfig]) => {
  const scheduleTrigger = Array.isArray(routineConfig?.triggers)
    ? routineConfig.triggers.find((trigger) => trigger.kind === "schedule" && typeof trigger.cronExpression === "string")
    : null;
  const agentKey = inferRoutineAgentKey(routineKey, routineConfig);
  const projectKey = agentKey ? AGENT_DEFAULT_PROJECT_KEYS[agentKey] : null;
  if (!scheduleTrigger || !agentKey || !projectKey) {
    console.warn(`Skipping routine ${routineKey}: missing schedule, agent inference, or project mapping`);
    return [];
  }

  return [{
    routineKey,
    title: titleizeRoutineKey(routineKey),
    project: canonicalProjects[projectKey] ?? null,
    agent: canonicalAgents[agentKey] ?? null,
    cronExpression: scheduleTrigger.cronExpression,
    timezone: scheduleTrigger.timezone ?? "America/New_York",
    description: buildRoutineDescription(routineKey),
    priority: routineConfig.priority ?? "medium",
    desiredStatus: routineConfig.status === "paused" ? "paused" : "active",
  }];
});

for (const desired of desiredRoutines) {
  const {
    routineKey,
    title,
    project,
    agent,
    cronExpression,
    timezone,
    description,
    priority,
    desiredStatus,
  } = desired;
  if (!project || !agent) {
    console.warn(`Skipping routine ${title}: missing canonical project or agent`);
    continue;
  }

  const matching = routines.filter((routine) => routine.title === title);
  const preferred =
    pickPreferredRoutine(matching, project.id, agent.id) ??
    await fetchJson(`/api/companies/${company.id}/routines`, {
      method: "POST",
      body: JSON.stringify({
        projectId: project.id,
        title,
        description,
        assigneeAgentId: agent.id,
        priority,
        status: desiredStatus,
        concurrencyPolicy: "coalesce_if_active",
        catchUpPolicy: "skip_missed",
      }),
    });

  const updated = await fetchJson(`/api/routines/${preferred.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      projectId: project.id,
      assigneeAgentId: agent.id,
      description,
      status: desiredStatus,
      priority,
      concurrencyPolicy: preferred.concurrencyPolicy ?? "coalesce_if_active",
      catchUpPolicy: preferred.catchUpPolicy ?? "skip_missed",
    }),
  });

  const allScheduleTriggers = (updated.triggers ?? []).filter((trigger) => trigger.kind === "schedule");
  const scheduleTrigger = allScheduleTriggers[0] ?? null;
  if (!scheduleTrigger) {
    await fetchJson(`/api/routines/${preferred.id}/triggers`, {
      method: "POST",
      body: JSON.stringify({
        kind: "schedule",
        cronExpression,
        timezone,
        enabled: desiredStatus === "active",
      }),
    });
  } else {
    await fetchJson(`/api/routine-triggers/${scheduleTrigger.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cronExpression,
        timezone,
        enabled: desiredStatus === "active",
      }),
    });
  }

  const preferredDetail = await fetchJson(`/api/routines/${preferred.id}`);
  const preferredScheduleTriggers = (preferredDetail.triggers ?? []).filter(
    (trigger) => trigger.kind === "schedule",
  );
  const canonicalTrigger = preferredScheduleTriggers[0] ?? null;
  if (!canonicalTrigger) {
    throw new Error(`Routine ${title} is missing a schedule trigger after reconcile`);
  }
  const shouldEnable = desiredStatus === "active";
  if (
    canonicalTrigger.cronExpression !== cronExpression
    || canonicalTrigger.timezone !== timezone
    || canonicalTrigger.enabled !== shouldEnable
  ) {
    await fetchJson(`/api/routine-triggers/${canonicalTrigger.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cronExpression,
        timezone,
        enabled: shouldEnable,
      }),
    });
  }
  for (const duplicateTrigger of preferredScheduleTriggers.slice(1)) {
    await fetchJson(`/api/routine-triggers/${duplicateTrigger.id}`, { method: "DELETE" }).catch(() => undefined);
  }

  for (const routine of matching) {
    if (routine.id === preferred.id) continue;
    await fetchJson(`/api/routines/${routine.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    });
    const duplicateDetail = await fetchJson(`/api/routines/${routine.id}`);
    for (const trigger of duplicateDetail.triggers ?? []) {
      if (trigger.kind === "schedule") {
        await fetchJson(`/api/routine-triggers/${trigger.id}`, { method: "DELETE" }).catch(() => undefined);
      } else if (trigger.enabled !== false) {
        await fetchJson(`/api/routine-triggers/${trigger.id}`, {
          method: "PATCH",
          body: JSON.stringify({ enabled: false }),
        }).catch(() => undefined);
      }
    }
  }

  console.log(
    `Reconciled routine ${routineKey} -> ${title} (${preferred.id}) [${desiredStatus}] ${cronExpression} ${timezone}`,
  );
}

for (const [agentKey, sourcePath] of Object.entries(instructionSources)) {
  const matchingAgents = pickMatching(agents, agentKey);
  for (const agent of matchingAgents) {
    await syncAgentInstructions(agent, sourcePath);
  }
}

console.log(
  `Reconciled ${Object.keys(desiredAgents).length} agents and ${desiredRoutines.length} routines from .paperclip.yaml (requested mode: ${effectiveRequestedMode})`,
);
NODE
