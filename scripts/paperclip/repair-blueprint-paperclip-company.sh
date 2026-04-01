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

PAPERCLIP_HOST="${PAPERCLIP_HOST:-127.0.0.1}"
PAPERCLIP_PORT="${PAPERCLIP_PORT:-3100}"
PAPERCLIP_API_URL="${PAPERCLIP_API_URL:-http://${PAPERCLIP_HOST}:${PAPERCLIP_PORT}}"
COMPANY_NAME="${COMPANY_NAME:-Blueprint Autonomous Operations}"
APPLY=0

for arg in "$@"; do
  if [ "$arg" = "--apply" ]; then
    APPLY=1
  fi
done

export PAPERCLIP_API_URL COMPANY_NAME APPLY

node <<'NODE'
const paperclipApiUrl = process.env.PAPERCLIP_API_URL;
const companyName = process.env.COMPANY_NAME;
const apply = process.env.APPLY === "1";

async function fetchJson(path, init = {}) {
  const attempts = Number(process.env.PAPERCLIP_FETCH_ATTEMPTS || "3");
  const delayMs = Number(process.env.PAPERCLIP_FETCH_DELAY_MS || "500");
  let lastError = `Empty response for ${path}`;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${paperclipApiUrl}${path}`, {
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
        ...init,
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
      }
      const text = await response.text();
      if (text.length > 0) {
        return JSON.parse(text);
      }
      lastError = `Empty response for ${path}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error(`Blueprint Paperclip API unavailable at ${paperclipApiUrl}${path}: ${lastError}`);
}

function hasNumericSuffix(value) {
  return typeof value === "string" && /(?:-\d+| \d+)$/.test(value);
}

function stripNumericSuffix(value) {
  return typeof value === "string" ? value.replace(/(?:-\d+| \d+)$/, "") : "";
}

function sortByPreference(rows, primary) {
  return [...rows].sort((left, right) => {
    const leftPrimary = primary(left) ? 1 : 0;
    const rightPrimary = primary(right) ? 1 : 0;
    if (leftPrimary !== rightPrimary) return rightPrimary - leftPrimary;

    const leftSuffix = hasNumericSuffix(left.urlKey ?? left.name) ? 1 : 0;
    const rightSuffix = hasNumericSuffix(right.urlKey ?? right.name) ? 1 : 0;
    if (leftSuffix !== rightSuffix) return leftSuffix - rightSuffix;

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

const companies = await fetchJson("/api/companies");
const company = companies.find((entry) => entry.name === companyName);
if (!company) {
  throw new Error(`Company not found: ${companyName}`);
}

const [agents, projects, routines, issues] = await Promise.all([
  fetchJson(`/api/companies/${company.id}/agents`),
  fetchJson(`/api/companies/${company.id}/projects`),
  fetchJson(`/api/companies/${company.id}/routines`),
  fetchJson(`/api/companies/${company.id}/issues?limit=200`),
]);

const projectGroups = new Map();
for (const project of projects) {
  const repoUrl = project.codebase?.repoUrl ?? project.primaryWorkspace?.repoUrl ?? project.name;
  const key = `${repoUrl}::${stripNumericSuffix(project.urlKey ?? project.name)}`;
  const group = projectGroups.get(key) ?? [];
  group.push(project);
  projectGroups.set(key, group);
}

const keepProjectIds = new Set();
const staleProjectIds = new Set();
for (const group of projectGroups.values()) {
  const sorted = sortByPreference(
    group,
    (project) => Boolean(project.codebase?.localFolder || project.primaryWorkspace?.cwd),
  );
  const keep = sorted[0];
  keepProjectIds.add(keep.id);
  for (const project of sorted.slice(1)) {
    staleProjectIds.add(project.id);
  }
}

const agentGroups = new Map();
for (const agent of agents) {
  const key = stripNumericSuffix(agent.urlKey ?? agent.name);
  const group = agentGroups.get(key) ?? [];
  group.push(agent);
  agentGroups.set(key, group);
}

const keepAgentIds = new Set();
const staleAgentIds = new Set();
for (const group of agentGroups.values()) {
  const sorted = sortByPreference(
    group,
    (agent) => Boolean(agent.adapterConfig?.cwd) && !hasNumericSuffix(agent.urlKey ?? agent.name),
  );
  const keep = sorted[0];
  keepAgentIds.add(keep.id);
  for (const agent of sorted.slice(1)) {
    staleAgentIds.add(agent.id);
  }
}

const staleRoutineIds = routines
  .filter((routine) => staleProjectIds.has(routine.projectId) || staleAgentIds.has(routine.assigneeAgentId))
  .filter((routine) => routine.status !== "paused")
  .map((routine) => routine.id);

const staleIssueIds = issues
  .filter(
    (issue) =>
      (staleProjectIds.has(issue.projectId) || staleAgentIds.has(issue.assigneeAgentId)) &&
      !["done", "cancelled"].includes(issue.status),
  )
  .map((issue) => issue.id);

const summary = {
  keepProjects: projects.filter((project) => keepProjectIds.has(project.id)).map((project) => project.name),
  staleProjects: projects
    .filter((project) => staleProjectIds.has(project.id))
    .filter((project) => !project.archivedAt)
    .map((project) => project.name),
  keepAgents: agents.filter((agent) => keepAgentIds.has(agent.id)).map((agent) => agent.name),
  staleAgents: agents
    .filter((agent) => staleAgentIds.has(agent.id))
    .filter((agent) => agent.status !== "terminated")
    .map((agent) => agent.name),
  staleRoutineIds,
  staleIssueIds,
  apply,
};

console.log(JSON.stringify(summary, null, 2));

if (!apply) {
  process.exit(0);
}

for (const routine of routines.filter((row) => staleRoutineIds.includes(row.id))) {
  await fetchJson(`/api/routines/${routine.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "paused" }),
  });
}

for (const issue of issues.filter((row) => staleIssueIds.includes(row.id))) {
  await fetchJson(`/api/issues/${issue.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "cancelled",
      comment: "Cancelled by Blueprint duplicate-import repair because the issue belonged to a stale duplicate project or agent.",
    }),
  });
}

for (const agentId of staleAgentIds) {
  await fetchJson(`/api/agents/${agentId}/terminate`, { method: "POST" });
}

for (const projectId of staleProjectIds) {
  await fetchJson(`/api/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ archivedAt: new Date().toISOString() }),
  });
}
NODE
