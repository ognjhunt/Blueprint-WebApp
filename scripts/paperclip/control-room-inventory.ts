#!/usr/bin/env tsx
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import yaml from "js-yaml";

const DEFAULT_COMPANY_CONFIG = path.resolve("ops/paperclip/blueprint-company/.paperclip.yaml");
const DEFAULT_COMPANY_SKILLS_ROOT = path.resolve("ops/paperclip/blueprint-company/skills");
const DEFAULT_REPO_SKILLS_ROOT = path.resolve("ops/paperclip/skills");
const DEFAULT_GLOBAL_SKILL_ROOTS = [
  path.join(os.homedir(), ".agents/skills"),
  path.join(os.homedir(), ".codex/skills"),
];
const DEFAULT_PLUGIN_SKILL_ROOTS = [
  path.join(os.homedir(), ".codex/plugins/cache/openai-curated"),
  path.join(os.homedir(), ".codex/plugins/cache/openai-bundled"),
  path.join(os.homedir(), ".codex/plugins/cache/openai-primary-runtime"),
];
const MAX_SKILL_SCAN_DEPTH = 8;

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
  desiredSkillCandidateGaps: string[];
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
  return routine.paused === true || routine.enabled === false;
}

function addSkillSlugAliases(slugs: Set<string>) {
  // `.paperclip.yaml` keeps a few Paperclip-facing skill names that map to
  // provider/plugin skill packages with shorter local directory names.
  if (slugs.has("react-best-practices")) {
    slugs.add("vercel-react-best-practices");
  }
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

  addSkillSlugAliases(slugs);
  return slugs;
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
    ...DEFAULT_GLOBAL_SKILL_ROOTS,
    ...DEFAULT_PLUGIN_SKILL_ROOTS,
  ]);
  const desiredSkillCounts = new Map<string, number>();
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

  const desiredSkillCandidateGaps = [...desiredSkillCounts.keys()]
    .filter((skill) => !localSkills.has(skill))
    .sort();

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
    desiredSkillCandidateGaps,
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

  lines.push("", "## Desired Skill Candidate Gaps", "");
  if (inventory.desiredSkillCandidateGaps.length === 0) {
    lines.push("No unresolved desiredSkill references detected in the scanned local skill roots.");
  } else {
    lines.push(
      "These desiredSkills did not resolve to a scanned company, repo, global, or plugin skill file. They may still be valid Paperclip company-library skills, but they need live company-library verification before treating them as present.",
    );
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
