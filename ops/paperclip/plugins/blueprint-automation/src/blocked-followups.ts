import { inferChiefOfStaffRoute } from "../../../chief-of-staff-routing.js";
import {
  inferRepoAgentForTask,
  type RepoAgentConfig,
} from "./queue-routing.js";

export type BlockedFollowUpRoutingConfig = {
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
  };
};

export type BlockedFollowUpPlan = {
  title: string;
  description: string;
  projectName: string;
  assignee: string;
};

type BlockedIssueContext = {
  identifier?: string | null;
  title: string;
  status: string;
  description?: string | null;
  projectName?: string | null;
  currentAssignee?: string | null;
  blockerSummary?: string | null;
  hasOpenChild?: boolean;
};

function normalize(value?: string | null) {
  return (value ?? "").trim().toLowerCase();
}

function baseBlockedTitle(title: string) {
  return title
    .trim()
    .replace(/^implement unblock path for\s+/i, "")
    .replace(/^review unblock path for\s+/i, "")
    .replace(/^route unblock path for\s+/i, "")
    .replace(/^escalate unblock path for\s+/i, "")
    .replace(/^unblock\s+/i, "");
}

const HUMAN_GATED_BLOCKED_RE = [
  /founder approval required/i,
  /founder-gated/i,
  /founder gate/i,
  /`human gate`/i,
  /\bhuman gate\b/i,
  /must not be closed autonomously/i,
  /do not create follow-up issues/i,
  /authorized human/i,
];

export function isHumanGatedBlockedIssue(input: BlockedIssueContext) {
  const evidence = [
    input.title,
    input.description ?? "",
    input.blockerSummary ?? "",
  ].join("\n");
  return HUMAN_GATED_BLOCKED_RE.some((pattern) => pattern.test(evidence));
}

export function isBlockedFollowUpTitle(title: string) {
  return baseBlockedTitle(title) !== title.trim();
}

export function blockedFollowUpFamilyKey(title: string) {
  return normalize(baseBlockedTitle(title));
}

function repoConfigForProject(
  projectName: string | null | undefined,
  repoCatalog: ReadonlyArray<RepoAgentConfig>,
) {
  const normalizedProjectName = normalize(projectName);
  if (!normalizedProjectName) return null;

  return repoCatalog.find((entry) => {
    return [
      entry.key,
      entry.projectName,
      entry.githubRepo,
    ].map((value) => normalize(value)).includes(normalizedProjectName);
  }) ?? null;
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

function growthSpecialists(config: BlockedFollowUpRoutingConfig) {
  const agents = config.growthAgents ?? {};
  return new Set(
    [
      agents.conversionOptimizer,
      agents.analytics,
      agents.communityUpdates,
      agents.marketIntel,
      agents.demandIntel,
      agents.robotTeamGrowth,
      agents.siteOperatorPartnership,
      agents.cityDemand,
    ]
      .map((value) => normalize(value))
      .filter((value) => value.length > 0),
  );
}

function opsSpecialists(config: BlockedFollowUpRoutingConfig) {
  const agents = config.opsAgents ?? {};
  return new Set(
    [
      agents.intake,
      agents.captureQa,
      agents.fieldOps,
      agents.financeSupport,
    ]
      .map((value) => normalize(value))
      .filter((value) => value.length > 0),
  );
}

export function planBlockedIssueFollowUp(
  input: BlockedIssueContext,
  config: BlockedFollowUpRoutingConfig,
): BlockedFollowUpPlan | null {
  if (normalize(input.status) !== "blocked") {
    return null;
  }
  if (isBlockedFollowUpTitle(input.title)) {
    return null;
  }
  if (input.hasOpenChild) {
    return null;
  }
  if (isHumanGatedBlockedIssue(input)) {
    return null;
  }

  const currentAssignee = normalize(input.currentAssignee);
  const chiefOfStaffAgent = normalize(config.chiefOfStaffAgent) || "blueprint-chief-of-staff";
  const ctoAgent = normalize(config.ctoAgent) || "blueprint-cto";
  const opsLead = normalize(config.opsAgents?.opsLead);
  const growthLead = normalize(config.growthAgents?.growthLead);

  const repoByProject = repoConfigForProject(input.projectName, config.repoCatalog);
  const repoByAssignee = repoConfigForAgent(input.currentAssignee, config.repoCatalog);
  const hintedRepoAgent = inferRepoAgentForTask(
    {
      projectName: input.projectName,
      title: input.title,
      description: input.blockerSummary,
    },
    config.repoCatalog,
  );
  const repoByHint = repoConfigForAgent(hintedRepoAgent, config.repoCatalog);
  const repoConfig = repoByProject ?? repoByAssignee ?? repoByHint;

  const chiefRoute = inferChiefOfStaffRoute({
    title: input.title,
    status: "blocked",
    project: input.projectName ? { name: input.projectName } : null,
  });

  let assignee = "";
  let projectName =
    input.projectName?.trim()
    || repoConfig?.projectName
    || config.executiveOpsProjectName
    || "";

  if (repoConfig) {
    if (currentAssignee === normalize(repoConfig.ciWatchAgent)) {
      assignee = repoConfig.implementationAgent;
    } else if (currentAssignee === normalize(repoConfig.reviewAgent)) {
      assignee = repoConfig.implementationAgent;
    } else if (currentAssignee === normalize(repoConfig.implementationAgent)) {
      assignee = repoConfig.reviewAgent;
    } else if (hintedRepoAgent && normalize(hintedRepoAgent) !== currentAssignee) {
      assignee = hintedRepoAgent;
    }
  }

  if (!assignee && chiefRoute?.assigneeKey && normalize(chiefRoute.assigneeKey) !== currentAssignee) {
    assignee = chiefRoute.assigneeKey;
  }

  if (!assignee && currentAssignee) {
    if (growthSpecialists(config).has(currentAssignee) && growthLead && growthLead !== currentAssignee) {
      assignee = growthLead;
    } else if (opsSpecialists(config).has(currentAssignee) && opsLead && opsLead !== currentAssignee) {
      assignee = opsLead;
    } else if ((currentAssignee === growthLead || currentAssignee === opsLead) && chiefOfStaffAgent !== currentAssignee) {
      assignee = chiefOfStaffAgent;
    } else if (currentAssignee === chiefOfStaffAgent && ctoAgent !== currentAssignee) {
      assignee = ctoAgent;
    }
  }

  if (!assignee && hintedRepoAgent && normalize(hintedRepoAgent) !== currentAssignee) {
    assignee = hintedRepoAgent;
  }

  if (!assignee) {
    assignee = currentAssignee === chiefOfStaffAgent ? ctoAgent : chiefOfStaffAgent;
  }

  const assigneeRepo = repoConfigForAgent(assignee, config.repoCatalog);
  if (assigneeRepo) {
    projectName = assigneeRepo.projectName;
  }

  if (!projectName) {
    return null;
  }

  if (normalize(assignee) === currentAssignee && normalize(projectName) === normalize(input.projectName)) {
    return null;
  }

  const baseTitle = baseBlockedTitle(input.title);
  const followUpTitle =
    assigneeRepo && normalize(assignee) === normalize(assigneeRepo.implementationAgent)
      ? `Implement unblock path for ${baseTitle}`
      : assigneeRepo && normalize(assignee) === normalize(assigneeRepo.reviewAgent)
        ? `Review unblock path for ${baseTitle}`
        : normalize(assignee) === chiefOfStaffAgent
          ? `Route unblock path for ${baseTitle}`
          : normalize(assignee) === ctoAgent
            ? `Escalate unblock path for ${baseTitle}`
            : `Unblock ${baseTitle}`;

  const summary = input.blockerSummary?.trim() || "Blocked issue requires an explicit unblock path.";
  const issueLabel = input.identifier?.trim() ? `${input.identifier} (${input.title})` : input.title;

  return {
    title: followUpTitle,
    description: [
      "Auto-created from a blocked issue so the failure turns into tracked follow-through instead of stopping at manager state.",
      "",
      `Parent issue: ${issueLabel}`,
      `Blocked owner: ${input.currentAssignee?.trim() || "Unassigned"}`,
      `Blocked project: ${projectName}`,
      "",
      "## Blocker Summary",
      summary,
    ].join("\n"),
    projectName,
    assignee,
  };
}
