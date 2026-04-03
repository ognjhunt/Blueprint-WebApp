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
PAPERCLIP_HOME="${PAPERCLIP_HOME:-$WORKSPACE_ROOT/.paperclip-blueprint}"
PAPERCLIP_INSTANCE_ID="${PAPERCLIP_INSTANCE_ID:-default}"
PAPERCLIP_REPO_ROOT="${PAPERCLIP_REPO_ROOT:-$WORKSPACE_ROOT/paperclip}"
APPLY=0

for arg in "$@"; do
  if [ "$arg" = "--apply" ]; then
    APPLY=1
  fi
done

export PAPERCLIP_API_URL COMPANY_NAME APPLY REPO_ROOT PAPERCLIP_HOME PAPERCLIP_INSTANCE_ID PAPERCLIP_REPO_ROOT

node --input-type=module <<'NODE'
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const paperclipApiUrl = process.env.PAPERCLIP_API_URL;
const companyName = process.env.COMPANY_NAME;
const apply = process.env.APPLY === "1";
const repoRoot = process.env.REPO_ROOT;
const paperclipHome = process.env.PAPERCLIP_HOME;
const paperclipInstanceId = process.env.PAPERCLIP_INSTANCE_ID || "default";
const paperclipRepoRoot = process.env.PAPERCLIP_REPO_ROOT;
const requireFromRepo = createRequire(pathToFileURL(path.join(repoRoot, "package.json")).href);
const yaml = requireFromRepo("js-yaml");

function requirePostgresDriver() {
  const pnpmRoot = path.join(paperclipRepoRoot, "node_modules/.pnpm");
  const entry = fs.readdirSync(pnpmRoot).find((name) => name.startsWith("postgres@"));
  if (!entry) {
    throw new Error(`Could not locate postgres package under ${pnpmRoot}`);
  }
  const driverPath = path.join(pnpmRoot, entry, "node_modules/postgres/cjs/src/index.js");
  return createRequire(pathToFileURL(path.join(paperclipRepoRoot, "package.json")).href)(driverPath);
}

const postgres = requirePostgresDriver();

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

function isUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function quoteLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function uuidArraySql(values) {
  const unique = [...new Set(values)].filter(Boolean);
  if (unique.length === 0) return null;
  for (const value of unique) {
    if (!isUuid(value)) {
      throw new Error(`Unsafe UUID in repair set: ${value}`);
    }
  }
  return `array[${unique.map((value) => quoteLiteral(value)).join(", ")}]::uuid[]`;
}

function resolveDbConnectionString() {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) return envUrl;

  const configPath = path.join(paperclipHome, "instances", paperclipInstanceId, "config.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`Paperclip config not found at ${configPath}`);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  if (config?.database?.mode === "postgres" && typeof config.database.connectionString === "string") {
    return config.database.connectionString;
  }

  const port = Number(config?.database?.embeddedPostgresPort ?? 54329);
  return `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
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
  if (typeof routine.enabledScheduleTriggerCount === "number") {
    return routine.enabledScheduleTriggerCount;
  }
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

const dbUrl = resolveDbConnectionString();
const sql = postgres(dbUrl, {
  max: 1,
  connect_timeout: 5,
  onnotice: () => undefined,
});

const managedConfig = yaml.load(
  fs.readFileSync(path.join(repoRoot, "ops/paperclip/blueprint-company/.paperclip.yaml"), "utf8"),
);

const [agents, projects, routines, issues] = await Promise.all([
  fetchJson(`/api/companies/${company.id}/agents`),
  fetchJson(`/api/companies/${company.id}/projects`),
  sql.unsafe(`
    select r.id,
           r.project_id as "projectId",
           r.title,
           r.assignee_agent_id as "assigneeAgentId",
           r.status,
           r.description,
           r.created_at as "createdAt",
           r.updated_at as "updatedAt",
           coalesce(sum(case when rt.kind = 'schedule' and rt.enabled = true then 1 else 0 end), 0)::int as "enabledScheduleTriggerCount"
    from routines r
    left join routine_triggers rt on rt.routine_id = r.id
    where r.company_id = ${quoteLiteral(company.id)}
    group by r.id
  `),
  sql.unsafe(`
    select id,
           project_id as "projectId",
           assignee_agent_id as "assigneeAgentId",
           title,
           status,
           origin_kind as "originKind",
           origin_id as "originId",
           created_at as "createdAt"
    from issues
    where company_id = ${quoteLiteral(company.id)}
  `),
]);

const openRoutineIssues = issues.filter(
  (issue) =>
    issue.originKind === "routine_execution"
    && ["backlog", "todo", "in_progress", "in_review", "blocked"].includes(issue.status),
);

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

const staleOwnedRoutineIds = routines
  .filter((routine) => staleProjectIds.has(routine.projectId) || staleAgentIds.has(routine.assigneeAgentId))
  .map((routine) => routine.id);

const staleRoutineIds = routines
  .filter((routine) => staleOwnedRoutineIds.includes(routine.id))
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

const duplicateRoutineIds = duplicateRoutineRepairs.flatMap((repair) => repair.duplicateRoutineIds);
const managedRoutineIds = routines
  .filter((routine) => managedRoutineTitles.has(routine.title))
  .map((routine) => routine.id);
const triggerResetRoutineIds = [...new Set([...managedRoutineIds, ...staleOwnedRoutineIds])];

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
  const completionRows = isUuid(routineId)
    ? await sql.unsafe(`
      select 1
      from routine_runs rr
      left join issues i on i.id = rr.linked_issue_id
      where rr.routine_id = ${quoteLiteral(routineId)}
        and rr.completed_at is not null
        and rr.completed_at >= ${quoteLiteral(latestOpenIssue.createdAt)}
        and i.status in ('done', 'cancelled')
      limit 1
    `)
    : [];
  const hasCompletedRunAfterLatestOpen = completionRows.length > 0;
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
  triggerResetRoutineCount: triggerResetRoutineIds.length,
  duplicateRoutineRepairs,
  routineIssueRepairs,
  apply,
};

console.log(JSON.stringify(summary, null, 2));

if (!apply) {
  await sql.end({ timeout: 5 }).catch(() => undefined);
  process.exit(0);
}

try {
  await sql.begin(async (tx) => {
    const staleRoutineSql = uuidArraySql(staleRoutineIds);
    if (staleRoutineSql) {
      await tx.unsafe(`
        update routines
        set status = 'paused',
            updated_at = now()
        where id = any(${staleRoutineSql})
      `);
    }

    const duplicateRoutineSql = uuidArraySql(duplicateRoutineIds);
    if (duplicateRoutineSql) {
      await tx.unsafe(`
        update routines
        set status = 'paused',
            updated_at = now()
        where id = any(${duplicateRoutineSql})
      `);
    }

    for (const repair of duplicateRoutineRepairs) {
      const duplicateSql = uuidArraySql(repair.duplicateRoutineIds);
      if (!duplicateSql) continue;
      await tx.unsafe(`
        update routines
        set title = 'Archived Duplicate | ' || ${quoteLiteral(repair.title)} || ' | ' || left(id::text, 8),
            description = 'Archived duplicate of ' || ${quoteLiteral(repair.title)} || '. Canonical routine: ' || ${quoteLiteral(repair.keepRoutineId)} || '.',
            updated_at = now()
        where id = any(${duplicateSql})
      `);
    }

    const triggerResetSql = uuidArraySql(triggerResetRoutineIds);
    if (triggerResetSql) {
      await tx.unsafe(`
        delete from routine_triggers
        where kind = 'schedule'
          and routine_id = any(${triggerResetSql})
      `);
    }

    const disableTriggerSql = uuidArraySql([...staleOwnedRoutineIds, ...duplicateRoutineIds]);
    if (disableTriggerSql) {
      await tx.unsafe(`
        update routine_triggers
        set enabled = false,
            updated_at = now()
        where kind <> 'schedule'
          and enabled = true
          and routine_id = any(${disableTriggerSql})
      `);
    }

    const staleIssueSql = uuidArraySql(staleIssueIds);
    if (staleIssueSql) {
      await tx.unsafe(`
        update issues
        set status = 'cancelled',
            cancelled_at = coalesce(cancelled_at, now()),
            updated_at = now()
        where id = any(${staleIssueSql})
      `);
    }

    for (const repair of routineIssueRepairs) {
      const cancelSql = uuidArraySql(repair.cancelIssueIds);
      if (!cancelSql) continue;
      await tx.unsafe(`
        update issues
        set status = 'cancelled',
            cancelled_at = coalesce(cancelled_at, now()),
            updated_at = now()
        where id = any(${cancelSql})
      `);
    }

    const staleAgentSql = uuidArraySql([...staleAgentIds]);
    if (staleAgentSql) {
      await tx.unsafe(`
        update agents
        set status = 'terminated',
            updated_at = now()
        where id = any(${staleAgentSql})
      `);
    }

    const staleProjectSql = uuidArraySql([...staleProjectIds]);
    if (staleProjectSql) {
      await tx.unsafe(`
        update projects
        set archived_at = coalesce(archived_at, now()),
            updated_at = now()
        where id = any(${staleProjectSql})
      `);
    }
  });
} finally {
  await sql.end({ timeout: 5 }).catch(() => undefined);
}
NODE
