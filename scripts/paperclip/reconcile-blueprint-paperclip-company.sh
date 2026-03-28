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

PAPERCLIP_PUBLIC_URL="${PAPERCLIP_PUBLIC_URL:-http://127.0.0.1:3100}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"

export PAPERCLIP_PUBLIC_URL COMPANY_NAME

node <<'NODE'
const paperclipPublicUrl = process.env.PAPERCLIP_PUBLIC_URL;
const companyName = process.env.COMPANY_NAME;

async function fetchJson(path, init = {}) {
  const response = await fetch(`${paperclipPublicUrl}${path}`, {
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
  "blueprint-ceo": "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
  "blueprint-cto": "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
  "webapp-claude": "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
  "pipeline-claude": "/Users/nijelhunt_1/workspace/BlueprintCapturePipeline",
  "capture-claude": "/Users/nijelhunt_1/workspace/BlueprintCapture",
};

for (const [agentKey, cwd] of Object.entries(desiredAgents)) {
  const agent = pickCanonical(agents, agentKey);
  if (!agent) continue;
  await fetchJson(`/api/agents/${agent.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      adapterType: "codex_local",
      replaceAdapterConfig: true,
      adapterConfig: {
        cwd,
        model: "gpt-5.3-codex",
        timeoutSec: 1800,
        dangerouslyBypassApprovalsAndSandbox: true,
      },
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
