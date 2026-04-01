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
APPLY=0

for arg in "$@"; do
  if [ "$arg" = "--apply" ]; then
    APPLY=1
  fi
done

export PAPERCLIP_API_URL COMPANY_NAME APPLY REPO_ROOT

node --input-type=module <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const paperclipApiUrl = process.env.PAPERCLIP_API_URL;
const companyName = process.env.COMPANY_NAME;
const apply = process.env.APPLY === "1";
const repoRoot = process.env.REPO_ROOT;
const requireFromRepo = createRequire(pathToFileURL(path.join(repoRoot, "package.json")).href);
const yaml = requireFromRepo("js-yaml");

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

const ROUTINE_TITLE_OVERRIDES = {
  "ceo-daily-review": "CEO Daily Review",
  "chief-of-staff-continuous-loop": "Chief of Staff Continuous Loop",
  "cto-cross-repo-triage": "CTO Cross-Repo Triage",
  "webapp-autonomy-loop": "WebApp Autonomy Loop",
  "webapp-claude-review-loop": "WebApp Claude Review Loop",
  "pipeline-autonomy-loop": "Pipeline Autonomy Loop",
  "pipeline-claude-review-loop": "Pipeline Claude Review Loop",
  "capture-autonomy-loop": "Capture Autonomy Loop",
  "capture-claude-review-loop": "Capture Claude Review Loop",
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
  "solutions-engineering-active-delivery-review": "Solutions Engineering Active Delivery Review",
  "security-procurement-active-reviews": "Security Procurement Active Reviews",
  "revenue-ops-pricing-weekly": "Revenue Ops Pricing Weekly",
};

function titleizeToken(token) {
  const overrides = { ceo: "CEO", cto: "CTO", qa: "QA", webapp: "WebApp" };
  return overrides[token] ?? `${token.charAt(0).toUpperCase()}${token.slice(1)}`;
}

function titleizeRoutineKey(routineKey) {
  return ROUTINE_TITLE_OVERRIDES[routineKey]
    ?? routineKey.split("-").map(titleizeToken).join(" ");
}

function countEnabledScheduleTriggers(routine) {
  return (routine.triggers ?? []).filter(
    (trigger) => trigger.kind === "schedule" && trigger.enabled !== false,
  ).length;
}

function pickPreferredRoutine(rows) {
  return [...rows].sort((left, right) => {
    const leftActive = left.status === "active" ? 1 : 0;
    const rightActive = right.status === "active" ? 1 : 0;
    if (leftActive !== rightActive) return rightActive - leftActive;

    const leftEnabledSchedules = countEnabledScheduleTriggers(left);
    const rightEnabledSchedules = countEnabledScheduleTriggers(right);
    if (leftEnabledSchedules !== rightEnabledSchedules) return leftEnabledSchedules - rightEnabledSchedules;

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  })[0] ?? null;
}

function archivedDuplicateRoutineTitle(title, routineId) {
  return `Archived Duplicate | ${title} | ${routineId.slice(0, 8)}`;
}

const companies = await fetchJson("/api/companies");
const company = companies.find((entry) => entry.name === companyName);
if (!company) {
  throw new Error(`Company not found: ${companyName}`);
}

const managedConfig = yaml.load(
  fs.readFileSync(path.join(repoRoot, "ops/paperclip/blueprint-company/.paperclip.yaml"), "utf8"),
);

const [agents, projects, routines, issues, openRoutineIssues] = await Promise.all([
  fetchJson(`/api/companies/${company.id}/agents`),
  fetchJson(`/api/companies/${company.id}/projects`),
  fetchJson(`/api/companies/${company.id}/routines`),
  fetchJson(`/api/companies/${company.id}/issues?limit=200`),
  fetchJson(`/api/companies/${company.id}/issues?originKind=routine_execution&status=todo,in_progress,blocked`),
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

const managedRoutineTitles = new Set(
  Object.keys(managedConfig?.routines ?? {}).map((routineKey) => titleizeRoutineKey(routineKey)),
);

const routineGroups = new Map();
for (const routine of routines.filter((row) => managedRoutineTitles.has(row.title))) {
  const group = routineGroups.get(routine.title) ?? [];
  group.push(routine);
  routineGroups.set(routine.title, group);
}

const duplicateRoutineRepairs = [];
for (const [title, rows] of routineGroups.entries()) {
  if (rows.length <= 1) continue;
  const keep = pickPreferredRoutine(rows);
  if (!keep) continue;
  const duplicates = rows.filter((row) => row.id !== keep.id);
  duplicateRoutineRepairs.push({
    title,
    keepRoutineId: keep.id,
    duplicateRoutineIds: duplicates.map((row) => row.id),
  });
}

const openRoutineIssueGroups = new Map();
for (const issue of openRoutineIssues) {
  const key = issue.originId || issue.id;
  const group = openRoutineIssueGroups.get(key) ?? [];
  group.push(issue);
  openRoutineIssueGroups.set(key, group);
}

const routineIssueRepairs = [];
for (const [originId, group] of openRoutineIssueGroups.entries()) {
  if (group.length <= 1) continue;
  const sorted = [...group].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
  const routineId = originId;
  const latestOpenIssue = sorted[0];
  const routineDetail = await fetchJson(`/api/routines/${routineId}`).catch(() => null);
  const hasCompletedRunAfterLatestOpen = Boolean(
    routineDetail?.recentRuns?.some(
      (run) =>
        typeof run.completedAt === "string"
        && run.linkedIssue
        && ["done", "cancelled"].includes(run.linkedIssue.status)
        && new Date(run.completedAt).getTime() >= new Date(latestOpenIssue.createdAt).getTime(),
    ),
  );
  routineIssueRepairs.push({
    routineId,
    title: latestOpenIssue.title,
    keepIssueId: hasCompletedRunAfterLatestOpen ? null : latestOpenIssue.id,
    cancelIssueIds: sorted
      .filter((issue) => issue.id !== latestOpenIssue.id || hasCompletedRunAfterLatestOpen)
      .map((issue) => issue.id),
  });
}

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
  duplicateRoutineRepairs,
  routineIssueRepairs,
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

for (const repair of duplicateRoutineRepairs) {
  for (const routineId of repair.duplicateRoutineIds) {
    await fetchJson(`/api/routines/${routineId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "paused",
        title: archivedDuplicateRoutineTitle(repair.title, routineId),
        description: `Archived duplicate of ${repair.title}. Canonical routine: ${repair.keepRoutineId}.`,
      }),
    });
    const detail = await fetchJson(`/api/routines/${routineId}`).catch(() => null);
    for (const trigger of detail?.triggers ?? []) {
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
}

for (const repair of routineIssueRepairs) {
  for (const issueId of repair.cancelIssueIds) {
    await fetchJson(`/api/issues/${issueId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "cancelled",
        comment:
          repair.keepIssueId
            ? `Cancelled by Blueprint routine repair because a newer open execution issue (${repair.keepIssueId}) already owns this routine.`
            : "Cancelled by Blueprint routine repair because a newer completed routine run already produced the authoritative outcome.",
      }),
    });
  }
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
