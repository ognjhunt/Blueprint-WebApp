import {
  inferChiefOfStaffRoute,
  isNotionManagerRegistryWorkTitle,
} from "../../../chief-of-staff-routing.js";
import {
  inferRepoAgentForTask,
  type RepoAgentConfig,
} from "./queue-routing.js";

export type DelegationScaffoldingConfig = {
  chiefOfStaffAgent: string;
  ctoAgent?: string;
  executiveOpsProjectName?: string;
  repoCatalog: ReadonlyArray<RepoAgentConfig>;
  opsAgents?: {
    opsLead?: string;
    intake?: string;
    captureQa?: string;
    fieldOps?: string;
    financeSupport?: string;
  };
  growthAgents?: {
    growthLead?: string;
    conversionOptimizer?: string;
    analytics?: string;
    communityUpdates?: string;
    marketIntel?: string;
    demandIntel?: string;
    robotTeamGrowth?: string;
    siteOperatorPartnership?: string;
    cityDemand?: string;
    capturerGrowth?: string;
  };
};

export type DelegationSourceHint = {
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ChiefOwnedBacklogDelegationPlan = {
  title: string;
  description: string;
  projectName: string;
  assignee: string;
};

export type ParentParkingRecoveryPlan = {
  assignee: string;
  reason: string;
};

type ChiefOwnedBacklogContext = {
  identifier?: string | null;
  title: string;
  status: string;
  projectName?: string | null;
  currentAssignee?: string | null;
  source?: DelegationSourceHint | null;
  hasOpenChild?: boolean;
};

type SmokeArtifactContext = {
  title: string;
  status: string;
  updatedAt?: string | null;
  parentStatus?: string | null;
  source?: DelegationSourceHint | null;
};

type ParentParkingRecoveryContext = {
  status: string;
  currentAssignee?: string | null;
  childAssignee?: string | null;
  childStatus?: string | null;
};

export type ExecutionOwnerContext = {
  title: string;
  description?: string | null;
  projectName?: string | null;
  source?: DelegationSourceHint | null;
};

const NOTION_MANAGER_AGENT = "notion-manager-agent";

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeLoose(value?: string | null) {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function repoConfigForAgent(
  assignee: string | null | undefined,
  repoCatalog: ReadonlyArray<RepoAgentConfig>,
) {
  const normalizedAssignee = normalize(assignee);
  if (!normalizedAssignee) return null;

  return repoCatalog.find((entry) =>
    normalize(entry.implementationAgent) === normalizedAssignee
    || normalize(entry.reviewAgent) === normalizedAssignee,
  ) ?? null;
}

function repoConfigForProject(
  projectName: string | null | undefined,
  repoCatalog: ReadonlyArray<RepoAgentConfig>,
) {
  const normalizedProjectName = normalizeLoose(projectName);
  if (!normalizedProjectName) return null;

  return repoCatalog.find((entry) => (
    [
      entry.key,
      entry.projectName,
      entry.githubRepo,
    ]
      .map((value) => normalizeLoose(value))
      .includes(normalizedProjectName)
  )) ?? null;
}

function normalizeBacklogBaseTitle(title: string) {
  return title
    .trim()
    .replace(/^follow through:\s*/i, "")
    .replace(/^execute follow-through for\s+/i, "");
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function queueProjectNameForSystem(system: string | null | undefined) {
  const normalizedSystem = normalize(system);
  if (normalizedSystem === "webapp") return "blueprint-webapp";
  if (normalizedSystem === "pipeline") return "blueprint-capture-pipeline";
  if (normalizedSystem === "capture") return "blueprint-capture";
  return "Blueprint Executive Ops";
}

function isOversightOwner(
  assignee: string | null | undefined,
  config: DelegationScaffoldingConfig,
) {
  const normalizedAssignee = normalize(assignee);
  if (!normalizedAssignee) return false;

  const ops = config.opsAgents ?? {};
  const growth = config.growthAgents ?? {};
  const oversightOwners = new Set(
    [
      config.chiefOfStaffAgent,
      config.ctoAgent,
      ops.opsLead,
      growth.growthLead,
      NOTION_MANAGER_AGENT,
    ]
      .map((value) => normalize(value))
      .filter((value) => value.length > 0),
  );
  return oversightOwners.has(normalizedAssignee);
}

function specialistFromTitle(
  title: string,
  config: DelegationScaffoldingConfig,
) {
  const normalizedTitle = normalize(title);
  const ops = config.opsAgents ?? {};
  const growth = config.growthAgents ?? {};

  if (isNotionManagerRegistryWorkTitle(title)) return NOTION_MANAGER_AGENT;
  if (normalizedTitle.includes("market intel")) return growth.marketIntel ?? "market-intel-agent";
  if (normalizedTitle.includes("demand intel")) return growth.demandIntel ?? "demand-intel-agent";
  if (normalizedTitle.includes("analytics")) return growth.analytics ?? "analytics-agent";
  if (normalizedTitle.includes("community update")) return growth.communityUpdates ?? "community-updates-agent";
  if (normalizedTitle.includes("investor")) return "investor-relations-agent";
  if (normalizedTitle.includes("pricing")) return "revenue-ops-pricing-agent";
  if (normalizedTitle.includes("security") || normalizedTitle.includes("procurement")) return "security-procurement-agent";
  if (normalizedTitle.includes("city launch")) return "city-launch-agent";
  if (normalizedTitle.includes("city demand")) return growth.cityDemand ?? "city-demand-agent";
  if (normalizedTitle.includes("capturer growth")) return growth.capturerGrowth ?? "capturer-growth-agent";
  if (normalizedTitle.includes("robot team")) return growth.robotTeamGrowth ?? "robot-team-growth-agent";
  if (normalizedTitle.includes("site operator")) return growth.siteOperatorPartnership ?? "site-operator-partnership-agent";
  if (normalizedTitle.includes("support") || normalizedTitle.includes("finance")) return ops.financeSupport ?? "finance-support-agent";
  if (normalizedTitle.includes("intake") || normalizedTitle.includes("waitlist") || normalizedTitle.includes("inbound")) return ops.intake ?? "intake-agent";
  if (normalizedTitle.includes("schedule") || normalizedTitle.includes("field ops")) return ops.fieldOps ?? "field-ops-agent";
  if (normalizedTitle.includes("qa") || normalizedTitle.includes("quality")) return ops.captureQa ?? "capture-qa-agent";
  if (normalizedTitle.includes("conversion") || normalizedTitle.includes("cro") || normalizedTitle.includes("experiment")) return growth.conversionOptimizer ?? "conversion-agent";
  if (hasAny(normalizedTitle, ["blueprint knowledge", "repo-authoritative", "doc mirror"])) {
    return ops.opsLead ?? "ops-lead";
  }

  return null;
}

function queueExecutionOwner(
  title: string,
  projectName: string | null | undefined,
  config: DelegationScaffoldingConfig,
) {
  const repoProject = repoConfigForProject(projectName, config.repoCatalog);
  if (
    repoProject
    && hasAny(normalize(title), ["platform context", "gpu contract", "gpu contracts", "bridge"])
  ) {
    return repoProject.implementationAgent;
  }

  const repoAgent = inferRepoAgentForTask(
    {
      projectName,
      title,
    },
    config.repoCatalog,
  );
  return specialistFromTitle(title, config) ?? repoAgent;
}

function notionDriftExecutionOwner(
  input: ExecutionOwnerContext,
  config: DelegationScaffoldingConfig,
) {
  const metadata = input.source?.metadata ?? null;
  const driftKind = normalize(metadataString(metadata, "driftKind"));

  if (driftKind === "queue_lifecycle_conflict") {
    const queueTitle =
      metadataString(metadata, "queueTitle")
      ?? input.title
        .replace(/^follow through:\s*/i, "")
        .replace(/^notion drift:\s*conflicting queue lifecycle for\s*/i, "")
        .trim();
    const queueSystem = metadataString(metadata, "queueSystem");
    const queueProjectName = queueProjectNameForSystem(
      queueSystem ?? metadataString(metadata, "projectName"),
    );
    return queueExecutionOwner(queueTitle, queueProjectName, config);
  }
  return NOTION_MANAGER_AGENT;
}

export function inferExecutionOwnerFromContext(
  input: ExecutionOwnerContext,
  config: DelegationScaffoldingConfig,
) {
  const normalizedTitle = normalizeBacklogBaseTitle(input.title);
  const sourceType = normalize(input.source?.sourceType);
  const metadata = input.source?.metadata ?? null;

  if (sourceType === "founder-routine-miss") {
    const routineOwner =
      metadataString(metadata, "agentKey")
      ?? metadataString(metadata, "preferredAgentKey");
    if (routineOwner) {
      return routineOwner;
    }
  }

  if (sourceType === "notion-drift") {
    return notionDriftExecutionOwner(
      {
        ...input,
        title: normalizedTitle,
      },
      config,
    );
  }

  if (sourceType === "notion-work-queue") {
    const queueTitle =
      metadataString(metadata, "queueTitle")
      ?? normalizedTitle.replace(/^notion work queue:\s*/i, "");
    const queueSystem = metadataString(metadata, "system");
    return queueExecutionOwner(
      queueTitle,
      queueProjectNameForSystem(queueSystem ?? input.projectName),
      config,
    );
  }

  return queueExecutionOwner(
    normalizedTitle,
    input.projectName ?? metadataString(metadata, "projectName"),
    config,
  );
}

export function isLikelySmokeArtifact(input: {
  title: string;
  source?: DelegationSourceHint | null;
}) {
  const normalizedTitle = normalize(input.title);
  const sourceType = normalize(input.source?.sourceType);
  const sourceId = normalize(input.source?.sourceId);

  return hasAny(normalizedTitle, ["smoke ", " smoke", "smoke-", "smoke ci issue"])
    || normalizedTitle.includes("evt_smoke_")
    || normalizedTitle.includes("smoke support ticket")
    || normalizedTitle.includes("smoke blocker")
    || sourceType === "smoke-ci"
    || sourceId.includes("smoke-")
    || sourceId.includes("evt_smoke_");
}

export function shouldQuarantineSmokeArtifact(
  input: SmokeArtifactContext,
  nowIso: string,
  graceMinutes = 5,
) {
  if (!isLikelySmokeArtifact({ title: input.title, source: input.source })) {
    return false;
  }
  if (["done", "cancelled"].includes(normalize(input.status))) {
    return false;
  }
  if (["done", "cancelled"].includes(normalize(input.parentStatus))) {
    return true;
  }

  const updatedAtMs = Date.parse(input.updatedAt ?? "");
  if (!Number.isFinite(updatedAtMs)) {
    return true;
  }
  return Date.parse(nowIso) - updatedAtMs >= graceMinutes * 60 * 1000;
}

export function planChiefOwnedBacklogDelegation(
  input: ChiefOwnedBacklogContext,
  config: DelegationScaffoldingConfig,
): ChiefOwnedBacklogDelegationPlan | null {
  const status = normalize(input.status);
  if (!["backlog", "todo"].includes(status)) {
    return null;
  }
  if (input.hasOpenChild) {
    return null;
  }
  if (isLikelySmokeArtifact({ title: input.title, source: input.source })) {
    return null;
  }

  const currentAssignee = normalize(input.currentAssignee);
  if (!isOversightOwner(input.currentAssignee, config)) {
    return null;
  }

  const projectName = input.projectName?.trim() || config.executiveOpsProjectName || "";
  let assignee = inferExecutionOwnerFromContext(
    {
      title: input.title,
      projectName,
      source: input.source,
    },
    config,
  );

  if (!assignee) {
    const route = inferChiefOfStaffRoute({
      title: input.title,
      status: input.status,
      project: projectName ? { name: projectName } : null,
    });
    assignee = route?.assigneeKey ?? null;
  }

  if (!assignee || normalize(assignee) === currentAssignee) {
    return null;
  }

  const assigneeRepo = repoConfigForAgent(assignee, config.repoCatalog);
  const issueRepo = repoConfigForProject(projectName, config.repoCatalog);
  const childProjectName =
    assigneeRepo?.projectName
    ?? issueRepo?.projectName
    ?? projectName;

  if (!childProjectName) {
    return null;
  }

  const baseTitle = normalizeBacklogBaseTitle(input.title);
  return {
    title: `Follow through: ${baseTitle}`,
    description: [
      "Auto-created from a chief-of-staff owned backlog thread so execution moves into a concrete specialist lane.",
      "",
      `Parent issue: ${input.identifier?.trim() ? `${input.identifier} (${input.title})` : input.title}`,
      `Oversight owner: ${input.currentAssignee?.trim() || "Unassigned"}`,
      `Target owner: ${assignee}`,
      "",
      "This child issue is the execution lane. Automation may later clear temporary oversight parking on the parent once the specialist lane is healthy again.",
    ].join("\n"),
    projectName: childProjectName,
    assignee,
  };
}

export function planParentParkingRecovery(
  input: ParentParkingRecoveryContext,
  config: DelegationScaffoldingConfig,
): ParentParkingRecoveryPlan | null {
  const parentStatus = normalize(input.status);
  if (!["backlog", "todo", "in_progress", "in_review"].includes(parentStatus)) {
    return null;
  }

  if (!isOversightOwner(input.currentAssignee, config)) {
    return null;
  }

  const childStatus = normalize(input.childStatus);
  if (!["backlog", "todo", "in_progress", "in_review", "blocked"].includes(childStatus)) {
    return null;
  }

  const childAssignee = (input.childAssignee ?? "").trim();
  if (!childAssignee || isOversightOwner(childAssignee, config)) {
    return null;
  }

  return {
    assignee: childAssignee,
    reason: "delegated execution is active in a specialist lane, so the parked parent should stop sitting in oversight ownership.",
  };
}
