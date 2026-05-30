#!/usr/bin/env tsx
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const DEFAULT_COMPANY_CONFIG = path.resolve("ops/paperclip/blueprint-company/.paperclip.yaml");
const DEFAULT_COMPANY_SKILLS_ROOT = path.resolve("ops/paperclip/blueprint-company/skills");
const DEFAULT_REPO_SKILLS_ROOT = path.resolve("ops/paperclip/skills");
const DEFAULT_REPO_AGENT_SKILLS_ROOT = path.resolve(".agents/skills");
const DEFAULT_GLOBAL_SKILL_ROOTS = [
  path.join(os.homedir(), ".agents/skills"),
  path.join(os.homedir(), ".codex/skills"),
  path.join(os.homedir(), ".claude/skills"),
];
const DEFAULT_PLUGIN_SKILL_ROOTS = [
  path.join(os.homedir(), ".codex/plugins/cache/openai-curated"),
  path.join(os.homedir(), ".codex/plugins/cache/openai-bundled"),
  path.join(os.homedir(), ".codex/plugins/cache/openai-primary-runtime"),
];
const MAX_SKILL_SCAN_DEPTH = 8;
const DESIRED_SKILL_RESOLUTION_POLICY_EVIDENCE = "ops/paperclip/control-room-map.md#desired-skill-resolution-policy";
const COMPANY_LIBRARY_REASON =
  "Intentional Paperclip company-library skill. The local inventory records the assignment without requiring live Paperclip verification.";
const RUNTIME_COMMAND_REASON =
  "Intentional non-local runtime/tooling command used by agent instructions. Keep it classified separately from repo/plugin SKILL.md files.";
const READINESS_CLASSES = [
  "blocked-by-env",
  "needs-human",
  "recommended-missing",
  "required-ready",
] as const;

type OperatorReadinessClass = typeof READINESS_CLASSES[number];
type DesiredSkillAliasDefinition = {
  resolvedAs: readonly string[];
  source: string;
  evidence: string;
};

const DESIRED_SKILL_ALIASES = {
  browse: {
    resolvedAs: ["control-in-app-browser", "browser"],
    source: "local-skill-alias",
    evidence: "Browser plugin exposes control-in-app-browser; Paperclip frontmatter uses the shorter browse verb.",
  },
  "vercel-react-best-practices": {
    resolvedAs: ["react-best-practices"],
    source: "plugin-skill-alias",
    evidence: "Vercel plugin cache exposes react-best-practices; Blueprint keeps a provider-qualified desiredSkill alias.",
  },
} satisfies Record<string, DesiredSkillAliasDefinition>;

const COMPANY_LIBRARY_DESIRED_SKILLS = new Set([
  "ab-testing",
  "ad-creative",
  "ads",
  "ai-seo",
  "analytics",
  "churn-prevention",
  "co-marketing",
  "cold-email",
  "community-marketing",
  "competitor-profiling",
  "competitors",
  "content-strategy",
  "copy-editing",
  "copywriting",
  "cro",
  "customer-research",
  "directory-submissions",
  "emails",
  "launch",
  "marketing-ideas",
  "marketing-psychology",
  "onboarding",
  "paywalls",
  "popups",
  "pricing",
  "product-marketing",
  "programmatic-seo",
  "referrals",
  "revops",
  "sales-enablement",
  "schema",
  "seo-audit",
  "signup",
  "site-architecture",
  "social",
  "web-design-guidelines",
]);

const RUNTIME_TOOLING_DESIRED_SKILLS: Record<string, {
  category: "runtime-command" | "tooling-contract";
  reason: string;
}> = {
  benchmark: {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  careful: {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  cso: {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  "design-review": {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  "find-skills": {
    category: "tooling-contract",
    reason: "Intentional Paperclip skill-discovery helper; preserve separately from company-library skills and local SKILL.md files.",
  },
  "gh-cli": {
    category: "tooling-contract",
    reason: "Intentional GitHub CLI/tooling contract for agents that diagnose issues and CI without requiring a SKILL.md file.",
  },
  investigate: {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  "land-and-deploy": {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  "office-hours": {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  "plan-ceo-review": {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  "plan-eng-review": {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  qa: {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  retro: {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  review: {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
  ship: {
    category: "runtime-command",
    reason: RUNTIME_COMMAND_REASON,
  },
};

type PaperclipAgentConfig = {
  role?: string;
  capabilities?: string;
  adapter?: {
    type?: string;
    config?: {
      cwd?: string;
      model?: string;
      modelReasoningEffort?: string;
      timeoutSec?: number;
      paperclipGoalPromptEnabled?: boolean;
      paperclipSkillSync?: {
        desiredSkills?: string[];
      };
    };
  };
  budgetMonthlyCents?: number;
};

type PaperclipRoutineConfig = {
  agent?: string;
  status?: string;
  priority?: string;
  paused?: boolean;
  enabled?: boolean;
  concurrencyPolicy?: string;
  catchUpPolicy?: string;
  triggers?: Array<{
    kind?: string;
    cronExpression?: string;
    timezone?: string;
  }>;
};

type PaperclipCompanyConfig = {
  agents?: Record<string, PaperclipAgentConfig>;
  routines?: Record<string, PaperclipRoutineConfig>;
};

export type ControlRoomInventory = {
  agentCount: number;
  adapterCounts: Record<string, number>;
  totalAgentBudgetCents: number;
  codexGoalEnabledAgents: string[];
  codexGoalDisabledAgents: string[];
  agentsWithoutDesiredSkills: string[];
  desiredSkillAliasMappings: Array<{
    skill: string;
    resolvedAs: string;
    source: string;
    count: number;
    agents: string[];
    evidence: string;
  }>;
  intentionalDesiredSkillDeferrals: Array<{
    skill: string;
    category: "company-library" | "runtime-command" | "tooling-contract";
    count: number;
    agents: string[];
    reason: string;
    evidence: string;
  }>;
  trueMissingDesiredSkills: Array<{
    skill: string;
    count: number;
    agents: string[];
    nextAction: string;
  }>;
  desiredSkillCandidateGaps: string[];
  readinessClassCounts: Record<OperatorReadinessClass, number>;
  routineReadinessRows: Array<{
    slug: string;
    agent: string;
    readinessClass: OperatorReadinessClass;
    detail: string;
    cadence: string;
  }>;
  workerReadinessFindings: Array<{
    label: string;
    readinessClass: OperatorReadinessClass;
    detail: string;
  }>;
  routineCount: number;
  routineStatusCounts: Record<string, number>;
  routineConcurrencyCounts: Record<string, number>;
  routineCatchUpCounts: Record<string, number>;
  routineRows: Array<{
    slug: string;
    agent: string;
    status: "active" | "paused";
    priority: string;
    concurrencyPolicy: string;
    catchUpPolicy: string;
    cadence: string;
  }>;
  agentRows: Array<{
    slug: string;
    adapter: string;
    cwd: string;
    model: string;
    budgetMonthlyCents: number;
    goalEnabled: boolean;
    desiredSkillCount: number;
  }>;
  suppressionSignals: Array<{
    signal: string;
    evidence: string;
  }>;
};

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function emptyReadinessClassCounts() {
  return READINESS_CLASSES.reduce<Record<OperatorReadinessClass, number>>((acc, value) => {
    acc[value] = 0;
    return acc;
  }, {} as Record<OperatorReadinessClass, number>);
}

function countReadinessClasses(values: OperatorReadinessClass[]) {
  const counts = emptyReadinessClassCounts();
  for (const value of values) {
    counts[value] += 1;
  }
  return counts;
}

function readYamlConfig(configPath: string): PaperclipCompanyConfig {
  return yaml.load(fs.readFileSync(configPath, "utf8")) as PaperclipCompanyConfig;
}

function formatCadence(routine: PaperclipRoutineConfig) {
  const triggers = Array.isArray(routine.triggers) ? routine.triggers : [];
  if (triggers.length === 0) return "manual/event";
  return triggers
    .map((trigger) => {
      const expression = trigger.cronExpression || trigger.kind || "event";
      const timezone = trigger.timezone ? ` ${trigger.timezone}` : "";
      return `${expression}${timezone}`;
    })
    .join("; ");
}

function isRoutinePaused(routine: PaperclipRoutineConfig) {
  return routine.status === "paused" || routine.paused === true || routine.enabled === false;
}

function collectSkillSlugsFromRoot(root: string, slugs: Set<string>, depth = 0) {
  if (depth > MAX_SKILL_SCAN_DEPTH || !fs.existsSync(root)) return;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(path.join(fullPath, "SKILL.md"))) {
        slugs.add(entry.name);
      }
      collectSkillSlugsFromRoot(fullPath, slugs, depth + 1);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      slugs.add(entry.name.replace(/\.md$/, ""));
    }
  }
}

function listLocalSkillSlugs(skillRoots: string[]) {
  const slugs = new Set<string>();

  for (const root of skillRoots) {
    collectSkillSlugsFromRoot(root, slugs);
  }

  return slugs;
}

function desiredSkillReferenceRows(
  counts: Map<string, number>,
  agentsBySkill: Map<string, string[]>,
) {
  return [...counts.keys()].sort().map((skill) => ({
    skill,
    count: counts.get(skill) ?? 0,
    agents: (agentsBySkill.get(skill) ?? []).sort(),
  }));
}

function resolveDesiredSkillAlias(skill: string, localSkills: Set<string>) {
  const alias = DESIRED_SKILL_ALIASES[skill];
  if (!alias) return null;

  const resolvedAs = alias.resolvedAs.find((candidate) => localSkills.has(candidate));
  if (!resolvedAs) return null;

  return {
    resolvedAs,
    source: alias.source,
    evidence: alias.evidence,
  };
}

export function buildControlRoomInventory(options: {
  configPath?: string;
  skillRoots?: string[];
} = {}): ControlRoomInventory {
  const config = readYamlConfig(options.configPath ?? DEFAULT_COMPANY_CONFIG);
  const agents = config.agents ?? {};
  const routines = config.routines ?? {};
  const localSkills = listLocalSkillSlugs(options.skillRoots ?? [
    DEFAULT_COMPANY_SKILLS_ROOT,
    DEFAULT_REPO_SKILLS_ROOT,
    DEFAULT_REPO_AGENT_SKILLS_ROOT,
    ...DEFAULT_GLOBAL_SKILL_ROOTS,
    ...DEFAULT_PLUGIN_SKILL_ROOTS,
  ]);
  const desiredSkillCounts = new Map<string, number>();
  const agentsByDesiredSkill = new Map<string, string[]>();
  const agentsWithoutDesiredSkills: string[] = [];
  const agentRows = Object.entries(agents)
    .map(([slug, agent]) => {
      const adapter = agent.adapter?.type || "unknown";
      const desiredSkills = agent.adapter?.config?.paperclipSkillSync?.desiredSkills ?? [];
      if (desiredSkills.length === 0) {
        agentsWithoutDesiredSkills.push(slug);
      }
      for (const skill of desiredSkills) {
        desiredSkillCounts.set(skill, (desiredSkillCounts.get(skill) ?? 0) + 1);
        if (!agentsByDesiredSkill.has(skill)) {
          agentsByDesiredSkill.set(skill, []);
        }
        agentsByDesiredSkill.get(skill)?.push(slug);
      }
      return {
        slug,
        adapter,
        cwd: agent.adapter?.config?.cwd || "",
        model: agent.adapter?.config?.model || agent.adapter?.config?.modelReasoningEffort || "",
        budgetMonthlyCents: agent.budgetMonthlyCents ?? 0,
        goalEnabled: agent.adapter?.config?.paperclipGoalPromptEnabled === true,
        desiredSkillCount: desiredSkills.length,
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));

  const routineRows = Object.entries(routines)
    .map(([slug, routine]) => {
      const status = isRoutinePaused(routine) ? "paused" : "active";
      return {
        slug,
        agent: routine.agent || "default",
        status,
        priority: routine.priority || "normal",
        concurrencyPolicy: routine.concurrencyPolicy || "unspecified",
        catchUpPolicy: routine.catchUpPolicy || "unspecified",
        cadence: formatCadence(routine),
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));

  const desiredSkillAliasMappings: ControlRoomInventory["desiredSkillAliasMappings"] = [];
  const intentionalDesiredSkillDeferrals: ControlRoomInventory["intentionalDesiredSkillDeferrals"] = [];
  const trueMissingDesiredSkills: ControlRoomInventory["trueMissingDesiredSkills"] = [];

  for (const reference of desiredSkillReferenceRows(desiredSkillCounts, agentsByDesiredSkill)) {
    if (localSkills.has(reference.skill)) continue;

    const alias = resolveDesiredSkillAlias(reference.skill, localSkills);
    if (alias) {
      desiredSkillAliasMappings.push({
        ...reference,
        resolvedAs: alias.resolvedAs,
        source: alias.source,
        evidence: alias.evidence,
      });
      continue;
    }

    if (COMPANY_LIBRARY_DESIRED_SKILLS.has(reference.skill)) {
      intentionalDesiredSkillDeferrals.push({
        ...reference,
        category: "company-library",
        reason: COMPANY_LIBRARY_REASON,
        evidence: DESIRED_SKILL_RESOLUTION_POLICY_EVIDENCE,
      });
      continue;
    }

    const runtimeDeferral = RUNTIME_TOOLING_DESIRED_SKILLS[reference.skill];
    if (runtimeDeferral) {
      intentionalDesiredSkillDeferrals.push({
        ...reference,
        category: runtimeDeferral.category,
        reason: runtimeDeferral.reason,
        evidence: DESIRED_SKILL_RESOLUTION_POLICY_EVIDENCE,
      });
      continue;
    }

    trueMissingDesiredSkills.push({
      ...reference,
      nextAction:
        "Add a repo skill, map it to a local/plugin alias, or explicitly classify it as an intentional company-library/runtime deferral.",
    });
  }

  const desiredSkillCandidateGaps: string[] = [];
  const routineReadinessRows = routineRows.map((row) => ({
    slug: row.slug,
    agent: row.agent,
    readinessClass: row.status === "active"
      ? ("required-ready" as const)
      : ("blocked-by-env" as const),
    detail: row.status === "active"
      ? "active in local Paperclip config"
      : "paused or disabled in local Paperclip config",
    cadence: row.cadence,
  }));
  const workerReadinessFindings: ControlRoomInventory["workerReadinessFindings"] = [
    ...agentsWithoutDesiredSkills.sort().map((agent) => ({
      label: agent,
      readinessClass: "recommended-missing" as const,
      detail: "agent has no desiredSkills in local Paperclip config",
    })),
    ...trueMissingDesiredSkills.map((missing) => ({
      label: missing.skill,
      readinessClass: "needs-human" as const,
      detail: missing.nextAction,
    })),
  ].sort((left, right) => left.label.localeCompare(right.label));
  const readinessClassCounts = countReadinessClasses([
    ...routineReadinessRows.map((row) => row.readinessClass),
    ...workerReadinessFindings.map((finding) => finding.readinessClass),
  ]);

  return {
    agentCount: agentRows.length,
    adapterCounts: countBy(agentRows.map((row) => row.adapter)),
    totalAgentBudgetCents: agentRows.reduce((sum, row) => sum + row.budgetMonthlyCents, 0),
    codexGoalEnabledAgents: agentRows
      .filter((row) => row.adapter === "codex_local" && row.goalEnabled)
      .map((row) => row.slug),
    codexGoalDisabledAgents: agentRows
      .filter((row) => row.adapter === "codex_local" && !row.goalEnabled)
      .map((row) => row.slug),
    agentsWithoutDesiredSkills: agentsWithoutDesiredSkills.sort(),
    desiredSkillAliasMappings,
    intentionalDesiredSkillDeferrals,
    trueMissingDesiredSkills,
    desiredSkillCandidateGaps,
    readinessClassCounts,
    routineReadinessRows,
    workerReadinessFindings,
    routineCount: routineRows.length,
    routineStatusCounts: countBy(routineRows.map((row) => row.status)),
    routineConcurrencyCounts: countBy(routineRows.map((row) => row.concurrencyPolicy)),
    routineCatchUpCounts: countBy(routineRows.map((row) => row.catchUpPolicy)),
    routineRows,
    agentRows,
    suppressionSignals: [
      {
        signal: "routine coalesce_if_active",
        evidence: "ops/paperclip/blueprint-company/.paperclip.yaml routines[].concurrencyPolicy",
      },
      {
        signal: "routine skip_missed catch-up",
        evidence: "ops/paperclip/blueprint-company/.paperclip.yaml routines[].catchUpPolicy",
      },
      {
        signal: "duplicate active run suppression",
        evidence: "server/agents/runtime.ts duplicate_active_run branch",
      },
      {
        signal: "no_change and duplicate_suppressed waste signals",
        evidence: "server/utils/agentCostTelemetry.ts summarizeAgentCostWaste",
      },
      {
        signal: "recursive improvement no-change repeat suppression",
        evidence: "ops/paperclip/blueprint-company/tasks/recursive-agent-improvement-loop/TASK.md no_change_report_only closeout rule",
      },
      {
        signal: "blocked follow-up duplicate merge",
        evidence: "ops/paperclip/plugins/blueprint-automation/src/worker.ts findDuplicateBlockedFollowUpCanonical",
      },
    ],
  };
}

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function renderCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts).sort((left, right) => left[0].localeCompare(right[0]));
  return entries.length === 0 ? "none" : entries.map(([key, value]) => `${key}: ${value}`).join(", ");
}

export function renderControlRoomInventoryMarkdown(inventory: ControlRoomInventory) {
  const lines = [
    "# Blueprint Paperclip Control-Room Inventory",
    "",
    "## Summary",
    "",
    `- Agents: ${inventory.agentCount}`,
    `- Agents by adapter: ${renderCounts(inventory.adapterCounts)}`,
    `- Declared monthly agent budget: ${formatUsd(inventory.totalAgentBudgetCents)}`,
    `- Routines: ${inventory.routineCount}`,
    `- Routines by status: ${renderCounts(inventory.routineStatusCounts)}`,
    `- Routine concurrency policies: ${renderCounts(inventory.routineConcurrencyCounts)}`,
    `- Routine catch-up policies: ${renderCounts(inventory.routineCatchUpCounts)}`,
    `- Codex /goal enabled: ${inventory.codexGoalEnabledAgents.join(", ") || "none"}`,
    `- Codex /goal disabled: ${inventory.codexGoalDisabledAgents.join(", ") || "none"}`,
    `- Agents missing desiredSkills: ${inventory.agentsWithoutDesiredSkills.join(", ") || "none"}`,
    `- Desired skill aliases resolved locally: ${inventory.desiredSkillAliasMappings.length}`,
    `- Intentional non-local desiredSkills: ${inventory.intentionalDesiredSkillDeferrals.length}`,
    `- True missing desiredSkills: ${inventory.trueMissingDesiredSkills.length}`,
    `- Ambiguous desired-skill candidate gaps: ${inventory.desiredSkillCandidateGaps.length || "none"}`,
    "",
    "## Goal-Enabled Codex Lanes",
    "",
    "| agent | adapter | cwd | monthly budget | goal | desired skills |",
    "|---|---|---|---:|---|---:|",
  ];

  for (const row of inventory.agentRows.filter((agent) => agent.adapter === "codex_local")) {
    lines.push(
      `| ${row.slug} | ${row.adapter} | ${row.cwd || "n/a"} | ${formatUsd(row.budgetMonthlyCents)} | ${row.goalEnabled ? "yes" : "no"} | ${row.desiredSkillCount} |`,
    );
  }

  lines.push(
    "",
    "## Operator Worker Readiness",
    "",
    "Local-only classification from the checked-in Paperclip company config. This does not prove a routine has run or that live Paperclip is healthy.",
    "",
    `Readiness classes: ${renderCounts(inventory.readinessClassCounts)}`,
    "",
    "| routine | agent | readiness | detail | cadence |",
    "|---|---|---|---|---|",
  );

  for (const row of inventory.routineReadinessRows) {
    lines.push(`| ${row.slug} | ${row.agent} | ${row.readinessClass} | ${row.detail} | ${row.cadence} |`);
  }

  lines.push("", "### Worker Follow-Up Classifications", "");
  if (inventory.workerReadinessFindings.length === 0) {
    lines.push("No worker readiness follow-ups are classified from local config.");
  } else {
    for (const finding of inventory.workerReadinessFindings) {
      lines.push(`- ${finding.label}: ${finding.readinessClass} - ${finding.detail}`);
    }
  }

  lines.push(
    "",
    "## Routine Cadence",
    "",
    "| routine | agent | status | priority | concurrency | catch-up | cadence |",
    "|---|---|---|---|---|---|---|",
  );

  for (const row of inventory.routineRows) {
    lines.push(
      `| ${row.slug} | ${row.agent} | ${row.status} | ${row.priority} | ${row.concurrencyPolicy} | ${row.catchUpPolicy} | ${row.cadence} |`,
    );
  }

  lines.push(
    "",
    "## Desired Skill Resolution",
    "",
    inventory.desiredSkillCandidateGaps.length === 0
      ? "No ambiguous desiredSkill candidate gaps."
      : "Ambiguous desiredSkill candidate gaps need classification.",
    "",
    "### Local Alias Mappings",
    "",
  );
  if (inventory.desiredSkillAliasMappings.length === 0) {
    lines.push("No desiredSkill aliases were needed for the scanned local skill roots.");
  } else {
    lines.push("| desiredSkill | resolves to | source | assignments | agents | evidence |");
    lines.push("|---|---|---|---:|---|---|");
    for (const mapping of inventory.desiredSkillAliasMappings) {
      lines.push(
        `| ${mapping.skill} | ${mapping.resolvedAs} | ${mapping.source} | ${mapping.count} | ${mapping.agents.join(", ")} | ${mapping.evidence} |`,
      );
    }
  }

  lines.push("", "### Intentional Non-Local Desired Skills", "");
  if (inventory.intentionalDesiredSkillDeferrals.length === 0) {
    lines.push("No intentional company-library or runtime/tooling desiredSkills are deferred from local SKILL.md scanning.");
  } else {
    lines.push(
      `These are documented in ${DESIRED_SKILL_RESOLUTION_POLICY_EVIDENCE}; live company-library verification is intentionally outside this local inventory command.`,
      "",
      "| desiredSkill | category | assignments | agents |",
      "|---|---|---:|---|",
    );
    for (const deferral of inventory.intentionalDesiredSkillDeferrals) {
      lines.push(
        `| ${deferral.skill} | ${deferral.category} | ${deferral.count} | ${deferral.agents.join(", ")} |`,
      );
    }
  }

  lines.push("", "### True Missing Desired Skills", "");
  if (inventory.trueMissingDesiredSkills.length === 0) {
    lines.push("No true missing desiredSkills remain.");
  } else {
    lines.push("| desiredSkill | assignments | agents | next action |");
    lines.push("|---|---:|---|---|");
    for (const missing of inventory.trueMissingDesiredSkills) {
      lines.push(
        `| ${missing.skill} | ${missing.count} | ${missing.agents.join(", ")} | ${missing.nextAction} |`,
      );
    }
  }

  if (inventory.desiredSkillCandidateGaps.length > 0) {
    lines.push("", "### Ambiguous Candidate Gaps", "");
    for (const skill of inventory.desiredSkillCandidateGaps) {
      lines.push(`- ${skill}`);
    }
  }

  lines.push("", "## Cost And Suppression Signals", "");
  for (const signal of inventory.suppressionSignals) {
    lines.push(`- ${signal.signal}: ${signal.evidence}`);
  }

  return `${lines.join("\n")}\n`;
}

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function main() {
  const configPath = path.resolve(readArg("--config") || DEFAULT_COMPANY_CONFIG);
  const inventory = buildControlRoomInventory({ configPath });
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(inventory, null, 2));
    return;
  }
  console.log(renderControlRoomInventoryMarkdown(inventory));
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const currentPath = fileURLToPath(import.meta.url);

if (invokedPath === currentPath) {
  main();
}
