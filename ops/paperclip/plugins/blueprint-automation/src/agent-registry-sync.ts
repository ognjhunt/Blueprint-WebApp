import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Client } from "@notionhq/client";
import yaml from "js-yaml";
import {
  archivePage,
  createAgentRegistryEntry,
  queryDatabase,
  replacePageBlocks,
  updatePageMetadata,
  type AgentRegistryEntry,
  type SimpleTextBlock,
} from "./notion.js";

const REPO_ROOT = fileURLToPath(new URL("../../../../../", import.meta.url));
const PAPERCLIP_CONFIG_PATH = path.join(REPO_ROOT, "ops/paperclip/blueprint-company/.paperclip.yaml");
const AGENT_KITS_ROOT = path.join(REPO_ROOT, "ops/paperclip/blueprint-company/agents");
const GITHUB_BLOB_BASE = "https://github.com/ognjhunt/Blueprint-WebApp/blob/main";

const HUB_URL = "https://www.notion.so/16d80154161d80db869bcfba4fe70be3";
const WORK_QUEUE_URL = "https://www.notion.so/f83b6c53a33a47909ca4786dddadad46";
const KNOWLEDGE_URL = "https://www.notion.so/7c729783c3774342bf005555b88a2ec6";
const SKILLS_URL = "https://www.notion.so/4e37bd7ae4484f81aa3eb8860826e98c";
const AGENTS_URL = "https://www.notion.so/c6021156679642c5bef458d2eb12d6ab";
const AGENT_RUNS_URL = "https://www.notion.so/bce59b924cf6446d9e07e026c824563b";
const FOUNDER_OS_URL = "https://www.notion.so/33580154161d817f8f95d31a1e5afea9";
const GROWTH_STUDIO_URL = "https://www.notion.so/33880154161d81b18c27c3ceb14bd2a3";

const PILOT_AGENT_KEYS = new Set([
  "notion-reconciler",
  "metrics-reporter",
  "workspace-digest-publisher",
]);

const LEGACY_AGENT_ALIASES: Record<string, string> = {
  "capture-claude": "capture-review",
  "documentation-agent": "docs-agent",
  "pipeline-claude": "pipeline-review",
  "webapp-claude": "webapp-review",
};

const EXECUTIVE_AGENT_KEYS = new Set([
  "blueprint-ceo",
  "blueprint-chief-of-staff",
  "blueprint-cto",
  "investor-relations-agent",
  "notion-manager-agent",
  "notion-reconciler",
  "revenue-ops-pricing-agent",
]);

const ENGINEERING_AGENT_KEYS = new Set([
  "beta-launch-commander",
  "capture-ci-watch",
  "capture-codex",
  "capture-review",
  "docs-agent",
  "documentation-agent",
  "pipeline-ci-watch",
  "pipeline-codex",
  "pipeline-review",
  "webapp-ci-watch",
  "webapp-claude",
  "pipeline-claude",
  "capture-claude",
  "webapp-codex",
  "webapp-review",
]);

const KNOWLEDGE_PUBLISHER_KEYS = new Set([
  "analytics-agent",
  "community-updates-agent",
  "docs-agent",
  "documentation-agent",
  "demand-intel-agent",
  "investor-relations-agent",
  "market-intel-agent",
  "metrics-reporter",
  "notion-manager-agent",
  "notion-reconciler",
  "revenue-ops-pricing-agent",
  "supply-intel-agent",
  "workspace-digest-publisher",
]);

const FOUNDER_FEED_KEYS = new Set([
  "analytics-agent",
  "blueprint-ceo",
  "blueprint-chief-of-staff",
  "blueprint-cto",
  "growth-lead",
  "metrics-reporter",
  "notion-manager-agent",
  "notion-reconciler",
  "ops-lead",
  "workspace-digest-publisher",
]);

const MAIL_AGENT_KEYS = new Set([
  "buyer-success-agent",
  "community-updates-agent",
  "investor-relations-agent",
  "outbound-sales-agent",
]);

const CALENDAR_AGENT_KEYS = new Set([
  "buyer-solutions-agent",
  "field-ops-agent",
]);

const NEEDS_ACCESS_REVIEW_KEYS = new Set([
  "buyer-solutions-agent",
  "buyer-success-agent",
  "finance-support-agent",
  "investor-relations-agent",
  "outbound-sales-agent",
  "revenue-ops-pricing-agent",
  "rights-provenance-agent",
  "security-procurement-agent",
  "site-operator-partnership-agent",
]);

const ROUTINE_AGENT_FALLBACKS: Record<string, string> = {
  "ceo-daily-review": "blueprint-ceo",
  "capture-autonomy-loop": "capture-codex",
  "capture-review-loop": "capture-review",
  "cto-cross-repo-triage": "blueprint-cto",
  "pipeline-autonomy-loop": "pipeline-codex",
  "pipeline-review-loop": "pipeline-review",
  "webapp-autonomy-loop": "webapp-codex",
  "webapp-review-loop": "webapp-review",
};

type PaperclipYamlAgentConfig = {
  capabilities?: string;
  adapter?: {
    type?: string;
    config?: {
      instructionsFilePath?: string;
      paperclipSkillSync?: {
        desiredSkills?: string[];
      };
    };
  };
};

type PaperclipYamlRoutineConfig = {
  agent?: string;
  status?: string;
  triggers?: Array<{
    kind?: string;
    cronExpression?: string;
    timezone?: string;
  }>;
};

type PaperclipYamlConfig = {
  agents?: Record<string, PaperclipYamlAgentConfig>;
  routines?: Record<string, PaperclipYamlRoutineConfig>;
};

type AgentFrontmatter = {
  name?: string;
  reportsTo?: string;
  skills?: string[];
  title?: string;
};

export type LiveAgentRecord = {
  adapterType?: string | null;
  createdAt?: string | null;
  id: string;
  name?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  urlKey?: string | null;
};

type CanonicalAgentSpec = {
  desiredSkills: string[];
  instructionsFilePath?: string;
  key: string;
  metadataSourceKey: string;
  capabilities?: string;
  name: string;
  reportsToKey?: string;
  roleTitle?: string;
  runtimeAdapterType?: string;
};

type SkillPageRecord = {
  id: string;
  title: string;
  url?: string;
  canonicalSkillFile?: string;
};

type RunPageRecord = {
  agentKey?: string;
  createdTime?: string;
  endedAt?: string;
  id: string;
  startedAt?: string;
  status?: string;
  title: string;
  url?: string;
};

type AgentPageRecord = {
  canonicalKey?: string;
  id: string;
  lastEditedTime?: string;
  paperclipKey?: string;
  title: string;
  url?: string;
};

type SyncedRegistryRow = {
  bodyBlocks: SimpleTextBlock[];
  directReportKeys: string[];
  entry: AgentRegistryEntry;
  latestRunPageId?: string;
  latestRunPageUrl?: string;
  pageId: string;
  pageUrl?: string;
  reportsToKey?: string;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function unique(values: Array<string | undefined | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function titleCaseFromKey(value: string) {
  const acronymMap: Record<string, string> = {
    ceo: "CEO",
    ci: "CI",
    cto: "CTO",
    ops: "Ops",
    qa: "QA",
  };

  return value
    .split("-")
    .map((part) => acronymMap[part] ?? `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function normalizeText(value: string | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function safeDateRank(value: string | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function readPaperclipYamlConfig(): PaperclipYamlConfig {
  const raw = fs.readFileSync(PAPERCLIP_CONFIG_PATH, "utf8");
  return (yaml.load(raw) as PaperclipYamlConfig | undefined) ?? {};
}

function readAgentFrontmatters() {
  const frontmatters = new Map<string, AgentFrontmatter>();
  for (const entry of fs.readdirSync(AGENT_KITS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const agentsPath = path.join(AGENT_KITS_ROOT, entry.name, "AGENTS.md");
    if (!fs.existsSync(agentsPath)) {
      continue;
    }
    const raw = fs.readFileSync(agentsPath, "utf8");
    const match = raw.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match?.[1]) {
      continue;
    }
    const frontmatter = (yaml.load(match[1]) as AgentFrontmatter | undefined) ?? {};
    frontmatters.set(entry.name, frontmatter);
  }
  return frontmatters;
}

function githubBlobUrlForPath(filePath: string | undefined) {
  const absolutePath = asString(filePath);
  if (!absolutePath) {
    return undefined;
  }

  const relativePath = path.relative(REPO_ROOT, absolutePath);
  if (relativePath.startsWith("..")) {
    return undefined;
  }

  return `${GITHUB_BLOB_BASE}/${relativePath.replaceAll(path.sep, "/")}`;
}

function relativeRepoPath(filePath: string | undefined) {
  const absolutePath = asString(filePath);
  if (!absolutePath) {
    return undefined;
  }
  const relativePath = path.relative(REPO_ROOT, absolutePath);
  return relativePath.startsWith("..") ? absolutePath : relativePath.replaceAll(path.sep, "/");
}

function loadCanonicalAgentSpecs() {
  const config = readPaperclipYamlConfig();
  const frontmatters = readAgentFrontmatters();
  const specs = new Map<string, CanonicalAgentSpec>();

  for (const [key, agentConfig] of Object.entries(config.agents ?? {})) {
    const frontmatter = frontmatters.get(key);
    const fallbackInstructionsPath = path.join(AGENT_KITS_ROOT, key, "AGENTS.md");
    const instructionsFilePath =
      asString(agentConfig.adapter?.config?.instructionsFilePath)
      ?? (fs.existsSync(fallbackInstructionsPath) ? fallbackInstructionsPath : undefined);

    specs.set(key, {
      key,
      metadataSourceKey: key,
      capabilities: asString(agentConfig.capabilities),
      desiredSkills: unique([
        ...((agentConfig.adapter?.config?.paperclipSkillSync?.desiredSkills ?? []).map((value) => asString(value))),
        ...((frontmatter?.skills ?? []).map((value) => asString(value))),
      ]),
      instructionsFilePath,
      name: asString(frontmatter?.name) ?? titleCaseFromKey(key),
      reportsToKey: asString(frontmatter?.reportsTo),
      roleTitle: asString(frontmatter?.title),
      runtimeAdapterType: asString(agentConfig.adapter?.type),
    });
  }

  return { config, specs };
}

function agentKeyForRoutine(routineKey: string, routine: PaperclipYamlRoutineConfig) {
  return asString(routine.agent) ?? ROUTINE_AGENT_FALLBACKS[routineKey];
}

function deriveDepartment(key: string, reportsToKey: string | undefined): AgentRegistryEntry["department"] {
  if (EXECUTIVE_AGENT_KEYS.has(key)) return "Executive";
  if (ENGINEERING_AGENT_KEYS.has(key)) return "Engineering";
  if (reportsToKey === "growth-lead" || key === "growth-lead") return "Growth";
  if (reportsToKey === "ops-lead" || key === "ops-lead") return "Ops";
  if (key === "growth-lead") return "Growth";
  return "Ops";
}

function deriveRole(key: string): AgentRegistryEntry["role"] {
  if (key.endsWith("-ci-watch")) return "CI Watch";
  if (
    key === "beta-launch-commander"
    || key === "notion-manager-agent"
    || key === "notion-reconciler"
  ) {
    return "Coordinator";
  }
  if (
    key === "blueprint-ceo"
    || key === "blueprint-chief-of-staff"
    || key === "blueprint-cto"
    || key === "growth-lead"
    || key === "ops-lead"
    || key === "revenue-ops-pricing-agent"
  ) {
    return "Lead";
  }
  if (
    key.endsWith("-codex")
    || key === "conversion-agent"
    || key === "docs-agent"
    || key === "documentation-agent"
  ) {
    return "Implementer";
  }
  if (
    key.endsWith("-review")
    || key.endsWith("-claude")
  ) {
    return "Reviewer";
  }
  return "Specialist";
}

function derivePrimaryRuntime(
  adapterType: string | undefined,
): AgentRegistryEntry["primaryRuntime"] {
  if (adapterType === "codex_local") return "Paperclip/Codex";
  if (adapterType === "hermes_local") return "Paperclip/Hermes";
  return "External Coding Agent";
}

function deriveRegistryStatus(key: string, liveAgent: LiveAgentRecord | undefined): AgentRegistryEntry["status"] {
  if (PILOT_AGENT_KEYS.has(key)) {
    return "Pilot";
  }
  if (!liveAgent) {
    return "Disabled";
  }
  return "Active";
}

function deriveLastRunStatus(
  liveAgent: LiveAgentRecord | undefined,
  latestRunStatus: string | undefined,
): AgentRegistryEntry["lastRunStatus"] {
  switch (latestRunStatus) {
    case "Running":
    case "Waiting on Human":
    case "Blocked":
    case "Failed":
    case "Done":
      return latestRunStatus;
    case "Queued":
      return "Ready";
    default:
      break;
  }

  switch (asString(liveAgent?.status)) {
    case "running":
      return "Running";
    case "error":
      return "Failed";
    case "idle":
      return "Ready";
    default:
      return liveAgent ? "Ready" : "Unknown";
  }
}

function deriveNotionSurfaces(
  key: string,
  department: AgentRegistryEntry["department"],
): string[] {
  const surfaces = new Set<string>(["Hub Card"]);
  if (department !== "Engineering" || key === "docs-agent" || key === "documentation-agent") {
    surfaces.add("Work Queue Assignee");
  }
  if (KNOWLEDGE_PUBLISHER_KEYS.has(key)) {
    surfaces.add("Knowledge Publisher");
  }
  if (FOUNDER_FEED_KEYS.has(key)) {
    surfaces.add("Founder OS Feed");
  }
  if (department === "Engineering") {
    surfaces.add("External Coding Surface");
  }
  return [...surfaces];
}

function deriveReadableSurfaces(
  key: string,
  department: AgentRegistryEntry["department"],
  desiredSkills: string[],
): string[] {
  const surfaces = new Set<string>(["Hub", "Knowledge"]);
  if (department !== "Engineering" || key === "docs-agent" || key === "documentation-agent") {
    surfaces.add("Work Queue");
  }
  if (department === "Growth" || key === "conversion-agent" || key === "community-updates-agent") {
    surfaces.add("Growth Studio");
  }
  if (
    department === "Executive"
    || key === "analytics-agent"
    || key === "metrics-reporter"
    || key === "workspace-digest-publisher"
  ) {
    surfaces.add("Founder OS");
  }
  if (desiredSkills.length > 0 || department === "Engineering" || key.startsWith("notion-")) {
    surfaces.add("Skills");
  }
  return [...surfaces];
}

function deriveWritableSurfaces(
  key: string,
  department: AgentRegistryEntry["department"],
): string[] {
  if (department === "Engineering" && key !== "docs-agent" && key !== "documentation-agent") {
    return ["Task Comments"];
  }

  const surfaces = new Set<string>(["Work Queue"]);
  if (KNOWLEDGE_PUBLISHER_KEYS.has(key) || key === "docs-agent" || key === "documentation-agent") {
    surfaces.add("Knowledge");
  }
  if (key === "notion-manager-agent" || key === "notion-reconciler") {
    surfaces.add("Skills");
  }
  if (
    key === "blueprint-chief-of-staff"
    || key === "blueprint-ceo"
    || key === "growth-lead"
    || key === "ops-lead"
  ) {
    surfaces.add("Founder OS Comments");
  }
  if (department !== "Engineering") {
    surfaces.add("Task Comments");
  }
  return [...surfaces];
}

function deriveToolAccess(
  key: string,
  department: AgentRegistryEntry["department"],
  desiredSkills: string[],
  runtime: AgentRegistryEntry["primaryRuntime"],
): string[] {
  const tools = new Set<string>();
  const normalizedSkills = new Set(desiredSkills.map((value) => normalizeText(value)));

  if (department !== "Engineering" || KNOWLEDGE_PUBLISHER_KEYS.has(key) || key.startsWith("notion-")) {
    tools.add("Notion");
  }
  if (
    normalizedSkills.has("gh-cli")
    || desiredSkills.some((value) => value.includes("repo-operations"))
    || desiredSkills.includes("cross-repo-operations")
    || key.endsWith("-ci-watch")
    || key.endsWith("-codex")
    || key.endsWith("-review")
    || key.endsWith("-claude")
    || key === "docs-agent"
    || key === "documentation-agent"
    || key === "beta-launch-commander"
  ) {
    tools.add("GitHub");
    tools.add("Repo");
  }
  if (
    normalizedSkills.has("agent-browser")
    || normalizedSkills.has("browse")
    || normalizedSkills.has("design-review")
    || normalizedSkills.has("benchmark")
    || normalizedSkills.has("page-cro")
    || normalizedSkills.has("web-design-guidelines")
  ) {
    tools.add("Browser");
  }
  if (MAIL_AGENT_KEYS.has(key)) {
    tools.add("Mail");
  }
  if (CALENDAR_AGENT_KEYS.has(key)) {
    tools.add("Calendar");
  }
  if (department !== "Engineering" || key.endsWith("-ci-watch") || key === "docs-agent") {
    tools.add("Slack");
  }
  if (
    runtime === "Paperclip/Codex"
    || runtime === "Paperclip/Hermes"
    || key.startsWith("notion-")
  ) {
    tools.add("MCP");
  }
  return [...tools];
}

function deriveHumanGates(
  key: string,
  role: AgentRegistryEntry["role"],
  department: AgentRegistryEntry["department"],
): string[] {
  if (key === "blueprint-ceo") return ["Founder"];
  if (key === "blueprint-chief-of-staff") return ["Founder", "CEO", "Rights/Privacy", "Legal"];
  if (key === "blueprint-cto") return ["Founder", "CEO"];
  if (key === "ops-lead" || key === "growth-lead" || key === "analytics-agent") return ["None"];
  if (key === "notion-manager-agent" || key === "notion-reconciler") return ["Chief of Staff", "Rights/Privacy"];
  if (key === "investor-relations-agent") return ["Chief of Staff", "Founder"];
  if (key === "revenue-ops-pricing-agent") return ["Chief of Staff", "Finance"];
  if (key === "rights-provenance-agent") return ["Ops Lead", "Rights/Privacy", "Legal"];
  if (key === "security-procurement-agent") return ["Ops Lead", "Legal"];
  if (key === "finance-support-agent") return ["Ops Lead", "Finance"];
  if (key === "site-operator-partnership-agent") return ["Growth Lead", "Rights/Privacy", "Legal"];
  if (key === "outbound-sales-agent") return ["Growth Lead", "Finance", "Legal"];
  if (role === "Lead") return ["Chief of Staff"];
  if (ENGINEERING_AGENT_KEYS.has(key)) return ["CTO"];
  if (department === "Growth") return ["Growth Lead"];
  return ["Ops Lead"];
}

function deriveDefaultTriggers(
  key: string,
  routines: Array<{ title: string; status: string; cronExpression: string; timezone: string }>,
  role: AgentRegistryEntry["role"],
): string[] {
  const triggers = new Set<string>(["Manual"]);
  if (routines.length > 0) {
    triggers.add("Schedule");
  }
  if (key === "notion-manager-agent" || key === "notion-reconciler") {
    triggers.add("Database Trigger");
    triggers.add("Page Update");
    triggers.add("Comment Mention");
  } else if (role === "Implementer" || role === "Reviewer" || role === "CI Watch" || key === "beta-launch-commander") {
    triggers.add("Webhook");
  }
  return [...triggers];
}

function deriveNeedsAccessReview(key: string, toolAccess: string[]) {
  return NEEDS_ACCESS_REVIEW_KEYS.has(key) || toolAccess.some((value) => value === "Mail" || value === "Calendar");
}

function deriveRoutineLines(
  key: string,
  routines: Array<{ title: string; status: string; cronExpression: string; timezone: string }>,
  defaultTriggers: string[],
  aliasTargetKey: string | undefined,
) {
  const lines = routines.map((routine) =>
    `Schedule: ${routine.title} (${routine.status}) — ${routine.cronExpression} ${routine.timezone}`,
  );

  if (key === "notion-manager-agent" || key === "notion-reconciler") {
    lines.push("Workspace events: Blueprint automation can wake this agent on Notion page updates, database-triggered drift, and comment mentions.");
  } else if (defaultTriggers.includes("Webhook")) {
    lines.push("Event wakes: Paperclip issue assignment, repo/CI signals, and related automation webhooks.");
  } else if (routines.length === 0) {
    lines.push("Manual wake only: no canonical schedule is declared in the repo config.");
  }

  if (aliasTargetKey) {
    lines.push(`Legacy live agent: repo metadata is sourced from ${aliasTargetKey} until the live alias is retired.`);
  }

  return lines;
}

function titleizeRoutineKey(routineKey: string) {
  const overrides: Record<string, string> = {
    ceo: "CEO",
    cto: "CTO",
    qa: "QA",
    webapp: "WebApp",
  };
  return routineKey
    .split("-")
    .map((part) => overrides[part] ?? `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function routineTitle(routineKey: string) {
  return titleizeRoutineKey(routineKey);
}

function normalizeRelativePath(value: string | undefined) {
  return normalizeText(value?.replaceAll("\\", "/"));
}

function readSkillPageRecords(pages: any[]): SkillPageRecord[] {
  return pages.map((page) => ({
    id: page.id,
    url: asString(page.url),
    title: page.properties?.Title?.title?.map((entry: any) => entry.plain_text ?? "").join("") ?? "",
    canonicalSkillFile:
      page.properties?.["Canonical Skill File"]?.rich_text?.map((entry: any) => entry.plain_text ?? "").join("")
      ?? "",
  }));
}

function readRunPageRecords(pages: any[]): RunPageRecord[] {
  return pages.map((page) => ({
    id: page.id,
    url: asString(page.url),
    title: page.properties?.Run?.title?.map((entry: any) => entry.plain_text ?? "").join("") ?? "",
    agentKey:
      page.properties?.["Agent Key"]?.rich_text?.map((entry: any) => entry.plain_text ?? "").join("")
      ?? "",
    status: page.properties?.Status?.select?.name ?? "",
    startedAt: page.properties?.["Started At"]?.date?.start ?? "",
    endedAt: page.properties?.["Ended At"]?.date?.start ?? "",
    createdTime: page.created_time ?? "",
  }));
}

function readAgentPageRecords(pages: any[]): AgentPageRecord[] {
  return pages.map((page) => ({
    id: page.id,
    url: asString(page.url),
    title: page.properties?.Agent?.title?.map((entry: any) => entry.plain_text ?? "").join("") ?? "",
    canonicalKey:
      page.properties?.["Canonical Key"]?.rich_text?.map((entry: any) => entry.plain_text ?? "").join("")
      ?? "",
    paperclipKey:
      page.properties?.["Paperclip Agent Key"]?.rich_text?.map((entry: any) => entry.plain_text ?? "").join("")
      ?? "",
    lastEditedTime: page.last_edited_time ?? "",
  }));
}

function matchExistingAgentPage(
  pages: AgentPageRecord[],
  key: string,
  title: string,
) {
  return [...pages]
    .filter((page) =>
      normalizeText(page.canonicalKey) === normalizeText(key)
      || normalizeText(page.paperclipKey) === normalizeText(key)
      || (
        !asString(page.canonicalKey)
        && !asString(page.paperclipKey)
        && normalizeText(page.title) === normalizeText(title)
      ),
    )
    .sort((left, right) => safeDateRank(right.lastEditedTime) - safeDateRank(left.lastEditedTime))[0];
}

async function archiveDuplicateAgentPages(
  notionClient: Client,
  preferredPageIdsByKey: Map<string, string>,
) {
  const pages = readAgentPageRecords(await queryDatabase(notionClient, "agents", 200));
  const grouped = new Map<string, AgentPageRecord[]>();
  for (const page of pages) {
    const key = asString(page.canonicalKey) ?? asString(page.paperclipKey);
    if (!key) {
      continue;
    }
    const entries = grouped.get(key) ?? [];
    entries.push(page);
    grouped.set(key, entries);
  }

  for (const [key, entries] of grouped.entries()) {
    if (entries.length <= 1) {
      continue;
    }
    const keepId =
      preferredPageIdsByKey.get(key)
      ?? [...entries].sort((left, right) => safeDateRank(right.lastEditedTime) - safeDateRank(left.lastEditedTime))[0]?.id;
    for (const entry of entries) {
      if (!keepId || entry.id === keepId) {
        continue;
      }
      await archivePage(notionClient, entry.id);
    }
  }
}

function latestRunsByAgentKey(runPages: RunPageRecord[]) {
  const latest = new Map<string, RunPageRecord>();
  for (const runPage of runPages) {
    const agentKey = asString(runPage.agentKey);
    if (!agentKey) {
      continue;
    }
    const existing = latest.get(agentKey);
    const currentRank = Math.max(
      safeDateRank(runPage.endedAt),
      safeDateRank(runPage.startedAt),
      safeDateRank(runPage.createdTime),
    );
    const existingRank = existing
      ? Math.max(safeDateRank(existing.endedAt), safeDateRank(existing.startedAt), safeDateRank(existing.createdTime))
      : Number.NEGATIVE_INFINITY;
    if (!existing || currentRank >= existingRank) {
      latest.set(agentKey, runPage);
    }
  }
  return latest;
}

function matchSkillPages(
  skillPages: SkillPageRecord[],
  agentKey: string,
  metadataSourceKey: string,
  displayName: string,
) {
  const titleCandidates = new Set<string>([
    normalizeText(displayName),
    normalizeText(titleCaseFromKey(agentKey)),
    normalizeText(titleCaseFromKey(metadataSourceKey)),
  ]);
  const canonicalPathCandidates = new Set<string>([
    normalizeRelativePath(`ops/paperclip/skills/${agentKey}.md`),
    normalizeRelativePath(`ops/paperclip/skills/${metadataSourceKey}.md`),
  ]);

  return skillPages
    .filter((page) =>
      canonicalPathCandidates.has(normalizeRelativePath(page.canonicalSkillFile))
      || titleCandidates.has(normalizeText(page.title)),
    )
    .map((page) => ({ id: page.id, url: page.url }));
}

function notionSurfaceLinks(readableSurfaces: string[]) {
  const links: Array<{ label: string; url: string }> = [];
  for (const surface of readableSurfaces) {
    switch (surface) {
      case "Hub":
        links.push({ label: "Blueprint Hub", url: HUB_URL });
        break;
      case "Work Queue":
        links.push({ label: "Blueprint Work Queue", url: WORK_QUEUE_URL });
        break;
      case "Knowledge":
        links.push({ label: "Blueprint Knowledge", url: KNOWLEDGE_URL });
        break;
      case "Skills":
        links.push({ label: "Blueprint Skills", url: SKILLS_URL });
        break;
      case "Founder OS":
        links.push({ label: "Founder OS", url: FOUNDER_OS_URL });
        break;
      case "Growth Studio":
        links.push({ label: "Growth Studio", url: GROWTH_STUDIO_URL });
        break;
      default:
        break;
    }
  }
  links.push({ label: "Blueprint Agents", url: AGENTS_URL });
  links.push({ label: "Blueprint Agent Runs", url: AGENT_RUNS_URL });
  return links;
}

function relatedRepoFiles(
  agentKey: string,
  metadataSourceKey: string,
  instructionsFilePath: string | undefined,
) {
  const files = new Set<string>();
  if (instructionsFilePath) {
    files.add(instructionsFilePath);
  }

  const candidateRoots = unique([
    path.join(AGENT_KITS_ROOT, metadataSourceKey),
    path.join(AGENT_KITS_ROOT, agentKey),
  ]);
  for (const root of candidateRoots) {
    for (const fileName of ["AGENTS.md", "Heartbeat.md", "Soul.md", "Tools.md"]) {
      const filePath = path.join(root, fileName);
      if (fs.existsSync(filePath)) {
        files.add(filePath);
      }
    }
  }

  files.add(PAPERCLIP_CONFIG_PATH);
  files.add(path.join(REPO_ROOT, "AUTONOMOUS_ORG.md"));

  return [...files];
}

function buildBodyBlocks(input: {
  defaultTriggers: string[];
  department: AgentRegistryEntry["department"];
  directReportNames: string[];
  displayName: string;
  instructionsFilePath?: string;
  key: string;
  latestRunPageUrl?: string;
  metadataSourceKey: string;
  notionSurfaces: string[];
  paperclipAgentKey: string;
  primaryRuntime: AgentRegistryEntry["primaryRuntime"];
  purposeSummary: string;
  readableSurfaces: string[];
  relatedFiles: string[];
  reportsToLabel: string;
  reportsToKey?: string;
  role: AgentRegistryEntry["role"];
  routineLines: string[];
  status: AgentRegistryEntry["status"];
  writableSurfaces: string[];
}) {
  const instructionsRepoUrl = githubBlobUrlForPath(input.instructionsFilePath);
  const blocks: SimpleTextBlock[] = [
    { type: "heading_1", text: input.displayName },
    { type: "paragraph", text: input.purposeSummary },
  ];

  if (input.metadataSourceKey !== input.key) {
    blocks.push({
      type: "paragraph",
      text: `This page tracks a live Paperclip agent key that currently resolves through canonical repo metadata from ${input.metadataSourceKey}.`,
    });
  }

  blocks.push({ type: "heading_2", text: "Registry" });
  blocks.push({ type: "bulleted_list_item", text: `Paperclip agent key: ${input.paperclipAgentKey}` });
  blocks.push({ type: "bulleted_list_item", text: `Canonical key: ${input.key}` });
  blocks.push({ type: "bulleted_list_item", text: `Department / role: ${input.department} / ${input.role}` });
  blocks.push({ type: "bulleted_list_item", text: `Runtime / status: ${input.primaryRuntime} / ${input.status}` });
  blocks.push({ type: "bulleted_list_item", text: `Default triggers: ${input.defaultTriggers.join(", ") || "Manual"}` });

  blocks.push({ type: "heading_2", text: "Reporting Line" });
  blocks.push({
    type: "bulleted_list_item",
    text: input.reportsToKey
      ? `Reports to: ${input.reportsToLabel} (${input.reportsToKey})`
      : `Reports to: ${input.reportsToLabel}`,
  });
  blocks.push({
    type: "bulleted_list_item",
    text: `Direct reports: ${input.directReportNames.length > 0 ? input.directReportNames.join(", ") : "None"}`,
  });

  blocks.push({ type: "heading_2", text: "Repo Sources" });
  if (input.instructionsFilePath) {
    blocks.push({
      type: "bulleted_list_item",
      text: `Instructions file: ${relativeRepoPath(input.instructionsFilePath) ?? input.instructionsFilePath}`,
    });
  }
  if (instructionsRepoUrl) {
    blocks.push({ type: "bulleted_list_item", text: `Instructions link: ${instructionsRepoUrl}` });
  }
  for (const filePath of input.relatedFiles.slice(0, 6)) {
    blocks.push({
      type: "bulleted_list_item",
      text: `Related file: ${relativeRepoPath(filePath) ?? filePath}`,
    });
  }

  blocks.push({ type: "heading_2", text: "Trigger Pattern" });
  for (const line of input.routineLines) {
    blocks.push({ type: "bulleted_list_item", text: line });
  }

  blocks.push({ type: "heading_2", text: "Notion Surfaces" });
  blocks.push({ type: "bulleted_list_item", text: `Registry surfaces: ${input.notionSurfaces.join(", ") || "Hub Card"}` });
  blocks.push({ type: "bulleted_list_item", text: `Readable surfaces: ${input.readableSurfaces.join(", ") || "Hub"}` });
  blocks.push({ type: "bulleted_list_item", text: `Writable surfaces: ${input.writableSurfaces.join(", ") || "None"}` });
  for (const link of notionSurfaceLinks(input.readableSurfaces)) {
    blocks.push({ type: "bulleted_list_item", text: `${link.label}: ${link.url}` });
  }

  blocks.push({ type: "heading_2", text: "Current Links" });
  blocks.push({
    type: "bulleted_list_item",
    text: input.latestRunPageUrl ? `Latest run: ${input.latestRunPageUrl}` : "Latest run: no Notion run row linked yet.",
  });

  return blocks;
}

function buildCanonicalRoutinesByAgent(config: PaperclipYamlConfig) {
  const routinesByAgent = new Map<string, Array<{ title: string; status: string; cronExpression: string; timezone: string }>>();

  for (const [routineKey, routine] of Object.entries(config.routines ?? {})) {
    const agentKey = agentKeyForRoutine(routineKey, routine);
    if (!agentKey) {
      continue;
    }
    const scheduleTriggers = (routine.triggers ?? []).filter(
      (trigger) => trigger.kind === "schedule" && asString(trigger.cronExpression),
    );
    if (scheduleTriggers.length === 0) {
      continue;
    }
    const existing = routinesByAgent.get(agentKey) ?? [];
    for (const trigger of scheduleTriggers) {
      existing.push({
        title: routineTitle(routineKey),
        status: asString(routine.status) ?? "active",
        cronExpression: asString(trigger.cronExpression) ?? "",
        timezone: asString(trigger.timezone) ?? "America/New_York",
      });
    }
    routinesByAgent.set(agentKey, existing);
  }

  return routinesByAgent;
}

function buildSpecForKey(
  key: string,
  canonicalSpec: CanonicalAgentSpec | undefined,
  liveAgent: LiveAgentRecord | undefined,
) {
  const metadataSourceKey = canonicalSpec?.metadataSourceKey ?? LEGACY_AGENT_ALIASES[key] ?? key;
  const aliasSource = key !== metadataSourceKey ? metadataSourceKey : undefined;
  const fallbackInstructionsPath = path.join(AGENT_KITS_ROOT, metadataSourceKey, "AGENTS.md");

  return {
    capabilities: canonicalSpec?.capabilities,
    desiredSkills: canonicalSpec?.desiredSkills ?? [],
    displayName:
      (aliasSource
        ? (asString(liveAgent?.name) ?? titleCaseFromKey(key))
        : canonicalSpec?.name)
      ?? asString(liveAgent?.name)
      ?? titleCaseFromKey(key),
    instructionsFilePath:
      canonicalSpec?.instructionsFilePath
      ?? (fs.existsSync(fallbackInstructionsPath) ? fallbackInstructionsPath : undefined),
    key,
    metadataSourceKey,
    purposeSummary:
      canonicalSpec?.capabilities
      ?? canonicalSpec?.roleTitle
      ?? `${titleCaseFromKey(key)} is a Paperclip-managed Blueprint agent.`,
    reportsToKey: canonicalSpec?.reportsToKey,
    runtimeAdapterType:
      asString(liveAgent?.adapterType)
      ?? canonicalSpec?.runtimeAdapterType
      ?? undefined,
    roleTitle: canonicalSpec?.roleTitle,
    aliasSourceKey: aliasSource,
  };
}

export async function syncBlueprintAgentRegistry(input: {
  archiveDuplicates?: boolean;
  liveAgents: LiveAgentRecord[];
  notionClient: Client;
  skipBody?: boolean;
}) {
  const { config, specs } = loadCanonicalAgentSpecs();
  const liveAgentsByKey = new Map<string, LiveAgentRecord>();
  for (const agent of input.liveAgents) {
    const key = asString(agent.urlKey);
    if (key) {
      liveAgentsByKey.set(key, agent);
    }
  }

  const canonicalRoutinesByAgent = buildCanonicalRoutinesByAgent(config);
  const [skillPagesRaw, agentRunPagesRaw, agentPagesRaw] = await Promise.all([
    queryDatabase(input.notionClient, "skills", 200),
    queryDatabase(input.notionClient, "agent_runs", 200),
    queryDatabase(input.notionClient, "agents", 200),
  ]);
  const skillPages = readSkillPageRecords(skillPagesRaw);
  const latestRunByAgentKey = latestRunsByAgentKey(readRunPageRecords(agentRunPagesRaw));
  const existingAgentPages = readAgentPageRecords(agentPagesRaw);

  const targetKeys = [...new Set([
    ...specs.keys(),
    ...liveAgentsByKey.keys(),
  ])].sort();

  const syncedRows = new Map<string, SyncedRegistryRow>();

  for (const key of targetKeys) {
    const liveAgent = liveAgentsByKey.get(key);
    const canonicalSpec = specs.get(key) ?? specs.get(LEGACY_AGENT_ALIASES[key] ?? "");
    const spec = buildSpecForKey(key, canonicalSpec, liveAgent);
    const department = deriveDepartment(key, spec.reportsToKey);
    const role = deriveRole(key);
    const primaryRuntime = derivePrimaryRuntime(spec.runtimeAdapterType);
    const routines = canonicalRoutinesByAgent.get(key) ?? [];
    const latestRun = latestRunByAgentKey.get(key);
    const notionSurfaces = deriveNotionSurfaces(key, department);
    const readableSurfaces = deriveReadableSurfaces(key, department, spec.desiredSkills);
    const writableSurfaces = deriveWritableSurfaces(key, department);
    const toolAccess = deriveToolAccess(key, department, spec.desiredSkills, primaryRuntime);
    const defaultTriggers = deriveDefaultTriggers(key, routines, role);
    const linkedSkills = matchSkillPages(skillPages, key, spec.metadataSourceKey, spec.displayName);
    const status = deriveRegistryStatus(key, liveAgent);
    const entry: AgentRegistryEntry = {
      title: spec.displayName,
      canonicalKey: key,
      defaultTriggers,
      department,
      humanGates: deriveHumanGates(key, role, department),
      instructionsSource: githubBlobUrlForPath(spec.instructionsFilePath),
      lastActive: asString(liveAgent?.updatedAt) ?? asString(liveAgent?.createdAt),
      lastPermissionReview: undefined,
      lastRunStatus: deriveLastRunStatus(liveAgent, latestRun?.status),
      linkedSkillPageIds: linkedSkills.map((page) => page.id),
      linkedSkillPageUrls: linkedSkills
        .map((page) => page.url)
        .filter((value): value is string => Boolean(value)),
      needsAccessReview: deriveNeedsAccessReview(key, toolAccess),
      notionAgentUrl: undefined,
      notionSurfaces,
      ownerIds: [],
      paperclipAgentKey: key,
      primaryRuntime,
      readableSurfaces,
      role,
      status,
      toolAccess,
      writableSurfaces,
    };

    const existingPage = matchExistingAgentPage(existingAgentPages, key, entry.title);
    const upserted = existingPage
      ? await updatePageMetadata(input.notionClient, existingPage.id, "agents", entry)
      : await createAgentRegistryEntry(input.notionClient, entry);
    syncedRows.set(key, {
      bodyBlocks: [],
      directReportKeys: [],
      entry,
      latestRunPageId: latestRun?.id,
      latestRunPageUrl: latestRun?.url,
      pageId: upserted.pageId,
      pageUrl: upserted.pageUrl,
      reportsToKey: spec.reportsToKey,
    });
  }

  for (const [key, row] of syncedRows.entries()) {
    if (row.reportsToKey && syncedRows.has(row.reportsToKey)) {
      const managerRow = syncedRows.get(row.reportsToKey);
      if (managerRow) {
        managerRow.directReportKeys.push(key);
      }
    }
  }

  for (const [key, row] of syncedRows.entries()) {
    const reportsToRow = row.reportsToKey ? syncedRows.get(row.reportsToKey) : undefined;
    const directReports = row.directReportKeys
      .map((directReportKey) => syncedRows.get(directReportKey))
      .filter((value): value is SyncedRegistryRow => Boolean(value))
      .sort((left, right) => left.entry.title.localeCompare(right.entry.title));
    const spec = buildSpecForKey(key, specs.get(key) ?? specs.get(LEGACY_AGENT_ALIASES[key] ?? ""), liveAgentsByKey.get(key));
    const routines = canonicalRoutinesByAgent.get(key) ?? [];
    const routineLines = deriveRoutineLines(
      key,
      routines,
      row.entry.defaultTriggers ?? [],
      spec.aliasSourceKey,
    );

    await updatePageMetadata(input.notionClient, row.pageId, "agents", {
      linkedSkillPageIds: row.entry.linkedSkillPageIds,
      latestRunPageIds: row.latestRunPageId ? [row.latestRunPageId] : [],
      reportsToPageIds: reportsToRow ? [reportsToRow.pageId] : [],
      directReportPageIds: directReports.map((directReport) => directReport.pageId),
    });

    row.bodyBlocks = buildBodyBlocks({
      defaultTriggers: row.entry.defaultTriggers ?? [],
      department: row.entry.department ?? "Ops",
      directReportNames: directReports.map((directReport) => directReport.entry.title),
      displayName: row.entry.title,
      instructionsFilePath: spec.instructionsFilePath,
      key,
      latestRunPageUrl: row.latestRunPageUrl,
      metadataSourceKey: spec.metadataSourceKey,
      notionSurfaces: row.entry.notionSurfaces ?? [],
      paperclipAgentKey: row.entry.paperclipAgentKey ?? key,
      primaryRuntime: row.entry.primaryRuntime ?? "Paperclip/Hermes",
      purposeSummary: spec.purposeSummary,
      readableSurfaces: row.entry.readableSurfaces ?? [],
      relatedFiles: relatedRepoFiles(key, spec.metadataSourceKey, spec.instructionsFilePath),
      reportsToKey: row.reportsToKey,
      reportsToLabel: reportsToRow?.entry.title ?? "Board / human founder",
      role: row.entry.role ?? "Specialist",
      routineLines,
      status: row.entry.status ?? "Active",
      writableSurfaces: row.entry.writableSurfaces ?? [],
    });
    if (!input.skipBody) {
      await replacePageBlocks(input.notionClient, row.pageId, row.bodyBlocks);
    }
  }

  await archiveDuplicateAgentPages(
    input.notionClient,
    new Map([...syncedRows.entries()].map(([key, row]) => [key, row.pageId])),
  );

  return {
    count: syncedRows.size,
    rows: [...syncedRows.entries()].map(([key, row]) => ({
      key,
      pageId: row.pageId,
      pageUrl: row.pageUrl,
      title: row.entry.title,
    })),
  };
}

function isRetryableNotionError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as Record<string, unknown>;
  const code = asString(record.code);
  const status = typeof record.status === "number" ? record.status : undefined;
  return (
    code === "notionhq_client_request_timeout"
    || (code === "notionhq_client_response_error" && (status === 502 || status === 503 || status === 504))
  );
}

export async function syncBlueprintAgentRegistryWithRetries(
  input: Parameters<typeof syncBlueprintAgentRegistry>[0] & {
    delayMs?: number;
    maxAttempts?: number;
  },
) {
  const maxAttempts = Math.max(1, input.maxAttempts ?? 3);
  const delayMs = Math.max(2500, input.delayMs ?? 5000);
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await syncBlueprintAgentRegistry(input);
    } catch (error) {
      lastError = error;
      if (!isRetryableNotionError(error) || attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
