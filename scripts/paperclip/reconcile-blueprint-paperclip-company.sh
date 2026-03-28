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
      cwd: "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
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
  ["CEO Daily Review", canonicalProjects["blueprint-webapp"], canonicalAgents["blueprint-ceo"]],
  ["CTO Cross-Repo Triage", canonicalProjects["blueprint-webapp"], canonicalAgents["blueprint-cto"]],
  ["WebApp Autonomy Loop", canonicalProjects["blueprint-webapp"], canonicalAgents["webapp-codex"]],
  ["WebApp Claude Review Loop", canonicalProjects["blueprint-webapp"], canonicalAgents["webapp-claude"]],
  ["Pipeline Autonomy Loop", canonicalProjects["blueprint-capture-pipeline"], canonicalAgents["pipeline-codex"]],
  ["Pipeline Claude Review Loop", canonicalProjects["blueprint-capture-pipeline"], canonicalAgents["pipeline-claude"]],
  ["Capture Autonomy Loop", canonicalProjects["blueprint-capture"], canonicalAgents["capture-codex"]],
  ["Capture Claude Review Loop", canonicalProjects["blueprint-capture"], canonicalAgents["capture-claude"]],
  // Ops Department routines
  ["Ops Morning Review", canonicalProjects["blueprint-webapp"], canonicalAgents["ops-lead"]],
  ["Ops Afternoon Review", canonicalProjects["blueprint-webapp"], canonicalAgents["ops-lead"]],
  ["Ops Queue Monitor", canonicalProjects["blueprint-webapp"], canonicalAgents["ops-lead"]],
  ["Intake Queue Processor", canonicalProjects["blueprint-webapp"], canonicalAgents["intake-agent"]],
  ["QA Pipeline Review", canonicalProjects["blueprint-capture-pipeline"], canonicalAgents["capture-qa-agent"]],
  ["Daily Calendar Review", canonicalProjects["blueprint-webapp"], canonicalAgents["field-ops-agent"]],
  ["Stripe Ledger Reconciliation", canonicalProjects["blueprint-webapp"], canonicalAgents["finance-support-agent"]],
  // Growth Department routines
  ["Growth Strategy Sync", canonicalProjects["blueprint-webapp"], canonicalAgents["growth-lead"]],
  ["Weekly Growth Report", canonicalProjects["blueprint-webapp"], canonicalAgents["growth-lead"]],
  ["Conversion Optimization Cycle", canonicalProjects["blueprint-webapp"], canonicalAgents["conversion-agent"]],
  ["Daily Analytics Pull", canonicalProjects["blueprint-webapp"], canonicalAgents["analytics-agent"]],
  ["Weekly Analytics Report", canonicalProjects["blueprint-webapp"], canonicalAgents["analytics-agent"]],
  ["Market Intelligence Scan", canonicalProjects["blueprint-webapp"], canonicalAgents["market-intel-agent"]],
];

for (const [title, project, agent] of desiredRoutines) {
  if (!project || !agent) continue;
  const matching = routines.filter((routine) => routine.title === title);
  const preferred =
    matching.find((routine) => routine.projectId === project.id && routine.assigneeAgentId === agent.id) ??
    matching.find((routine) => !hasSuffix(routine.id)) ??
    matching[0];

  if (!preferred) continue;

  await fetchJson(`/api/routines/${preferred.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      projectId: project.id,
      assigneeAgentId: agent.id,
      status: "active",
    }),
  });

  for (const routine of matching) {
    if (routine.id === preferred.id) continue;
    await fetchJson(`/api/routines/${routine.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "paused" }),
    });
  }
}
NODE
