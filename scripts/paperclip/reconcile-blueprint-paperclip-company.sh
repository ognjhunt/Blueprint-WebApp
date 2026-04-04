#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_ROOT="/Users/nijelhunt_1/workspace"
PAPERCLIP_ENV_FILE="${PAPERCLIP_ENV_FILE:-$WORKSPACE_ROOT/.paperclip-blueprint.env}"

if [ -f "$PAPERCLIP_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$PAPERCLIP_ENV_FILE"
  set +a
fi

PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://127.0.0.1:3100}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"

export PAPERCLIP_API_URL COMPANY_NAME

node <<'NODE'
const paperclipApiUrl = process.env.PAPERCLIP_API_URL;
const companyName = process.env.COMPANY_NAME;

async function fetchJson(path, init = {}) {
  const response = await fetch(`${paperclipApiUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
  }
  const text = await response.text();
  return text.length > 0 ? JSON.parse(text) : null;
}

function hasSuffix(value) {
  return typeof value === "string" && /(?:-\d+| \d+)$/.test(value);
}

function pickCanonical(rows, exactKey) {
  const matches = rows.filter((row) => {
    const urlKey = typeof row.urlKey === "string" ? row.urlKey : "";
    return urlKey === exactKey || (!hasSuffix(urlKey) && !hasSuffix(row.name) && urlKey.startsWith(exactKey));
  });
  const preferred = matches.find((row) => row.urlKey === exactKey);
  return preferred ?? matches.find((row) => !hasSuffix(row.urlKey) && !hasSuffix(row.name)) ?? matches[0] ?? null;
}

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

const desiredAgents = {
  "blueprint-ceo": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "blueprint-cto": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "webapp-codex": {
    adapterType: "codex_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "gpt-5.3-codex",
      timeoutSec: 1800,
      dangerouslyBypassApprovalsAndSandbox: true,
    },
  },
  "webapp-claude": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "pipeline-codex": {
    adapterType: "codex_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline",
      model: "gpt-5.3-codex",
      timeoutSec: 1800,
      dangerouslyBypassApprovalsAndSandbox: true,
    },
  },
  "pipeline-claude": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "capture-codex": {
    adapterType: "codex_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/BlueprintCapture",
      model: "gpt-5.3-codex",
      timeoutSec: 1800,
      dangerouslyBypassApprovalsAndSandbox: true,
    },
  },
  "capture-claude": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/BlueprintCapture",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  // ── Ops Department ────────────────────────────────────
  "ops-lead": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "intake-agent": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "capture-qa-agent": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "field-ops-agent": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/BlueprintCapture",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "finance-support-agent": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  // ── Growth Department ─────────────────────────────────
  "growth-lead": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "conversion-agent": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "analytics-agent": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
  "market-intel-agent": {
    adapterType: "claude_local",
    adapterConfig: {
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
      model: "claude-sonnet-4-6",
      timeoutSec: 1800,
      dangerouslySkipPermissions: true,
    },
  },
};

for (const [agentKey, desired] of Object.entries(desiredAgents)) {
  const agent = pickCanonical(agents, agentKey);
  if (!agent) continue;
  await fetchJson(`/api/agents/${agent.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      adapterType: desired.adapterType,
      replaceAdapterConfig: true,
      adapterConfig: desired.adapterConfig,
    }),
  });
  if (agent.status === "paused") {
    await fetchJson(`/api/agents/${agent.id}/resume`, { method: "POST" });
  }
}

const canonicalProjects = {
  "blueprint-executive-ops": pickCanonical(projects, "blueprint-executive-ops"),
  "blueprint-webapp": pickCanonical(projects, "blueprint-webapp"),
  "blueprint-capture-pipeline": pickCanonical(projects, "blueprint-capture-pipeline"),
  "blueprint-capture": pickCanonical(projects, "blueprint-capture"),
};

const canonicalAgents = {
  "blueprint-ceo": pickCanonical(agents, "blueprint-ceo"),
  "blueprint-cto": pickCanonical(agents, "blueprint-cto"),
  "webapp-codex": pickCanonical(agents, "webapp-codex"),
  "webapp-claude": pickCanonical(agents, "webapp-claude"),
  "pipeline-codex": pickCanonical(agents, "pipeline-codex"),
  "pipeline-claude": pickCanonical(agents, "pipeline-claude"),
  "capture-codex": pickCanonical(agents, "capture-codex"),
  "capture-claude": pickCanonical(agents, "capture-claude"),
  "ops-lead": pickCanonical(agents, "ops-lead"),
  "intake-agent": pickCanonical(agents, "intake-agent"),
  "capture-qa-agent": pickCanonical(agents, "capture-qa-agent"),
  "field-ops-agent": pickCanonical(agents, "field-ops-agent"),
  "finance-support-agent": pickCanonical(agents, "finance-support-agent"),
  "growth-lead": pickCanonical(agents, "growth-lead"),
  "conversion-agent": pickCanonical(agents, "conversion-agent"),
  "analytics-agent": pickCanonical(agents, "analytics-agent"),
  "market-intel-agent": pickCanonical(agents, "market-intel-agent"),
};

const desiredRoutines = [
  {
    title: "CEO Daily Review",
    project: canonicalProjects["blueprint-executive-ops"] ?? canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["blueprint-ceo"],
    cronExpression: "0 8 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "CTO Cross-Repo Triage",
    project: canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["blueprint-cto"],
    cronExpression: "30 8,14 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "WebApp Autonomy Loop",
    project: canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["webapp-codex"],
    cronExpression: "0 9,15 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "WebApp Claude Review Loop",
    project: canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["webapp-claude"],
    cronExpression: "30 9,15 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Pipeline Autonomy Loop",
    project: canonicalProjects["blueprint-capture-pipeline"],
    agent: canonicalAgents["pipeline-codex"],
    cronExpression: "0 10,16 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Pipeline Claude Review Loop",
    project: canonicalProjects["blueprint-capture-pipeline"],
    agent: canonicalAgents["pipeline-claude"],
    cronExpression: "30 10,16 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Capture Autonomy Loop",
    project: canonicalProjects["blueprint-capture"],
    agent: canonicalAgents["capture-codex"],
    cronExpression: "0 11,17 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Capture Claude Review Loop",
    project: canonicalProjects["blueprint-capture"],
    agent: canonicalAgents["capture-claude"],
    cronExpression: "30 11,17 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Ops Lead Morning",
    project: canonicalProjects["blueprint-executive-ops"] ?? canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["ops-lead"],
    cronExpression: "30 8 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Ops Lead Afternoon",
    project: canonicalProjects["blueprint-executive-ops"] ?? canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["ops-lead"],
    cronExpression: "30 14 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Intake Agent Hourly",
    project: canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["intake-agent"],
    cronExpression: "0 * * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Capture QA Daily",
    project: canonicalProjects["blueprint-capture-pipeline"],
    agent: canonicalAgents["capture-qa-agent"],
    cronExpression: "0 9 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Field Ops Daily",
    project: canonicalProjects["blueprint-capture"],
    agent: canonicalAgents["field-ops-agent"],
    cronExpression: "0 7 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Finance Support Daily",
    project: canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["finance-support-agent"],
    cronExpression: "0 10 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Growth Lead Daily",
    project: canonicalProjects["blueprint-executive-ops"] ?? canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["growth-lead"],
    cronExpression: "0 9 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Growth Lead Weekly",
    project: canonicalProjects["blueprint-executive-ops"] ?? canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["growth-lead"],
    cronExpression: "0 10 * * 1",
    timezone: "America/New_York",
  },
  {
    title: "Analytics Daily",
    project: canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["analytics-agent"],
    cronExpression: "0 6 * * *",
    timezone: "America/New_York",
  },
  {
    title: "Analytics Weekly",
    project: canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["analytics-agent"],
    cronExpression: "0 23 * * 0",
    timezone: "America/New_York",
  },
  {
    title: "Conversion Weekly",
    project: canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["conversion-agent"],
    cronExpression: "0 11 * * 1",
    timezone: "America/New_York",
  },
  {
    title: "Market Intel Daily",
    project: canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["market-intel-agent"],
    cronExpression: "0 7 * * 1-5",
    timezone: "America/New_York",
  },
  {
    title: "Market Intel Weekly",
    project: canonicalProjects["blueprint-webapp"],
    agent: canonicalAgents["market-intel-agent"],
    cronExpression: "0 15 * * 5",
    timezone: "America/New_York",
  },
];

const desiredRoutinePolicies = {
  concurrencyPolicy: "coalesce_if_active",
  catchUpPolicy: "skip_missed",
};

for (const desired of desiredRoutines) {
  const { title, project, agent, cronExpression, timezone } = desired;
  if (!project || !agent) continue;
  const matching = routines.filter((routine) => routine.title === title);
  const preferred =
    matching.find((routine) => routine.projectId === project.id && routine.assigneeAgentId === agent.id) ??
    matching.find((routine) => !hasSuffix(routine.id)) ??
    matching[0] ??
    await fetchJson(`/api/companies/${company.id}/routines`, {
      method: "POST",
      body: JSON.stringify({
        projectId: project.id,
        title,
        assigneeAgentId: agent.id,
        priority: "medium",
        status: "active",
        concurrencyPolicy: "coalesce_if_active",
        catchUpPolicy: "skip_missed",
      }),
    });

  const updated = await fetchJson(`/api/routines/${preferred.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      projectId: project.id,
      assigneeAgentId: agent.id,
      status: "active",
      priority: preferred.priority ?? "medium",
      concurrencyPolicy: desiredRoutinePolicies.concurrencyPolicy,
      catchUpPolicy: desiredRoutinePolicies.catchUpPolicy,
    }),
  });

  const scheduleTrigger = (updated.triggers ?? []).find((trigger) => trigger.kind === "schedule");
  if (!scheduleTrigger) {
    await fetchJson(`/api/routines/${preferred.id}/triggers`, {
      method: "POST",
      body: JSON.stringify({
        kind: "schedule",
        cronExpression,
        timezone,
      }),
    });
  } else {
    await fetchJson(`/api/routine-triggers/${scheduleTrigger.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cronExpression,
        timezone,
        enabled: true,
      }),
    });
  }

  for (const routine of matching) {
    if (routine.id === preferred.id) continue;
    await fetchJson(`/api/routines/${routine.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    });
  }
}
NODE
