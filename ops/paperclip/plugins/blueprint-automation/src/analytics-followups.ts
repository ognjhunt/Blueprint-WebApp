import { inferChiefOfStaffRoute } from "../../../chief-of-staff-routing.js";
import {
  preferredQueueRepoAgent,
  type RepoAgentConfig,
} from "./queue-routing.js";

export type AnalyticsFollowUpKind = "blocker" | "owner_ready";

export type AnalyticsFollowUpIssue = {
  kind: AnalyticsFollowUpKind;
  title: string;
  description: string;
  projectName: string;
  assignee: string;
  priority?: string;
};

type AnalyticsFollowUpRoutingConfig = {
  repoCatalog: Array<RepoAgentConfig & { projectName: string }>;
  opsAgents: {
    opsLead: string;
    financeSupportAgent: string;
  };
  growthAgents: {
    conversionOptimizer: string;
  };
  executiveOpsProjectName?: string;
};

const EXECUTIVE_OPS_PROJECT = "blueprint-executive-ops";

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeRecommendationLine(value: string) {
  return normalizeWhitespace(
    value
      .replace(/^[\s*-]+/, "")
      .replace(/[.;:\s]+$/, ""),
  ).toLowerCase();
}

function capitalizeSentence(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildIssueTitle(value: string) {
  const normalized = normalizeWhitespace(
    value
      .replace(/^[\s*-]+/, "")
      .replace(/[.;\s]+$/, ""),
  );
  return capitalizeSentence(normalized);
}

function buildDescription(line: string) {
  return [
    normalizeWhitespace(line),
    "",
    "Auto-generated from the analytics snapshot recommended follow-ups.",
  ].join("\n");
}

function inferProjectName(line: string, executiveOpsProjectName: string) {
  const normalized = normalizeRecommendationLine(line);
  if (
    /\bpipeline\b|pipeline[- ]routes|blueprintcapturepipeline/.test(normalized)
  ) {
    return "blueprint-capture-pipeline";
  }
  if (
    /\bcapture\b|bundle|manifest|ingest/.test(normalized)
    && !/\bpipeline\b/.test(normalized)
  ) {
    return "blueprint-capture";
  }
  if (
    /ga4|stripe|firestore|notion|slack|env var|environment variable|measurement id|secret key|credentials|runtime/.test(normalized)
  ) {
    return executiveOpsProjectName;
  }
  return "blueprint-webapp";
}

function inferPriority(line: string) {
  const normalized = normalizeRecommendationLine(line);
  if (
    /blocked|blocker|failing|failure|missing|restore|fix|broken|red\b|ci|e2e|type error|credentials|env var|environment variable|production/.test(normalized)
  ) {
    return "high";
  }
  return "medium";
}

function inferKind(line: string, priority: string): AnalyticsFollowUpKind {
  const normalized = normalizeRecommendationLine(line);
  if (
    priority === "high"
    && /blocked|blocker|failing|failure|missing|restore|fix|broken|red\b/.test(normalized)
  ) {
    return "blocker";
  }
  return "owner_ready";
}

function mapProjectNameToQueueSystem(projectName: string) {
  switch (projectName) {
    case "blueprint-webapp":
      return "webapp";
    case "blueprint-capture-pipeline":
      return "pipeline";
    case "blueprint-capture":
      return "capture";
    default:
      return "cross-system";
  }
}

function inferAssignee(
  title: string,
  description: string,
  projectName: string,
  config: AnalyticsFollowUpRoutingConfig,
) {
  const normalized = `${title} ${description}`.toLowerCase();
  if (/env var|environment variable|measurement id|credentials|secret key|runtime/.test(normalized)) {
    return config.opsAgents.opsLead;
  }
  if (/payout|refund|dispute|support/.test(normalized)) {
    return config.opsAgents.financeSupportAgent;
  }
  if (/conversion|experiment|cro/.test(normalized)) {
    return config.growthAgents.conversionOptimizer;
  }

  const queueSystem = mapProjectNameToQueueSystem(projectName);
  const repoAssignee = preferredQueueRepoAgent(queueSystem, title, config.repoCatalog);
  if (repoAssignee) {
    return repoAssignee;
  }

  const chiefRoute = inferChiefOfStaffRoute({
    title,
    status: "todo",
    project: { name: projectName },
  });
  if (chiefRoute?.assigneeKey) {
    return chiefRoute.assigneeKey;
  }

  return config.opsAgents.opsLead;
}

function explicitIssueCoversRecommendation(
  recommendationLine: string,
  explicitIssues: AnalyticsFollowUpIssue[],
) {
  const normalizedLine = normalizeRecommendationLine(recommendationLine);
  return explicitIssues.some((issue) => {
    const normalizedTitle = normalizeRecommendationLine(issue.title);
    const normalizedDescription = normalizeRecommendationLine(issue.description);
    return (
      normalizedTitle.includes(normalizedLine)
      || normalizedDescription.includes(normalizedLine)
      || normalizedLine.includes(normalizedTitle)
      || (normalizedDescription.length > 0 && normalizedLine.includes(normalizedDescription))
    );
  });
}

function dedupeIssues(issues: AnalyticsFollowUpIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = [
      normalizeRecommendationLine(issue.title),
      issue.projectName,
      issue.assignee,
      issue.kind,
    ].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildAnalyticsFollowUpIssues(
  recommendedFollowUps: string[],
  explicitIssues: AnalyticsFollowUpIssue[],
  config: AnalyticsFollowUpRoutingConfig,
) {
  const executiveOpsProjectName = config.executiveOpsProjectName ?? EXECUTIVE_OPS_PROJECT;
  const autoIssues = recommendedFollowUps
    .filter((line) => !explicitIssueCoversRecommendation(line, explicitIssues))
    .map((line) => {
      const title = buildIssueTitle(line);
      const description = buildDescription(line);
      const projectName = inferProjectName(line, executiveOpsProjectName);
      const priority = inferPriority(line);
      return {
        kind: inferKind(line, priority),
        title,
        description,
        projectName,
        assignee: inferAssignee(title, description, projectName, config),
        priority,
      } satisfies AnalyticsFollowUpIssue;
    });

  return dedupeIssues([...explicitIssues, ...autoIssues]);
}
