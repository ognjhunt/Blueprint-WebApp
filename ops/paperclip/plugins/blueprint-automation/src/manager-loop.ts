import type { Agent, Issue, IssueComment } from "@paperclipai/plugin-sdk";
import { ORIGIN_KIND } from "./constants.js";
import type { HandoffAnalytics, HandoffSnapshot } from "./handoffs.js";

export type ManagerRoutineHealthEntry = {
  routineKey: string;
  routineTitle: string;
  agentKey: string;
  routineStatus?: string | null;
  lastOutcome: "done" | "blocked" | "unknown";
  lastRunAt: string;
  lastSuccessAt: string | null;
  lastFailureReason: string | null;
  consecutiveFailures: number;
  expectedIntervalHours: number | null;
  lastIssueId: string | null;
};

export type ManagerRecentEvent = {
  id: string;
  kind: string;
  title: string;
  fingerprint?: string;
  issueId?: string;
  createdAt: string;
  detail?: string;
};

export type ManagerIssueSnapshot = {
  id: string;
  title: string;
  projectName: string | null;
  status: Issue["status"];
  priority: Issue["priority"];
  assigneeAgentId: string | null;
  updatedAt: string;
  hoursSinceUpdate: number;
};

export type ManagerRoutineAlert = {
  routineKey: string;
  routineTitle: string;
  agentKey: string;
  kind: "blocked" | "stale";
  detail: string;
  lastRunAt: string;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  expectedIntervalHours: number | null;
  lastIssueId: string | null;
};

export function buildRoutineHealthAlertSignature(alerts: ManagerRoutineAlert[]): string {
  return JSON.stringify(
    [...alerts]
      .map((alert) => ({
        routineKey: alert.routineKey,
        kind: alert.kind,
        agentKey: alert.agentKey,
        lastSuccessAt: alert.lastSuccessAt,
        expectedIntervalHours: alert.expectedIntervalHours,
        consecutiveFailures: alert.consecutiveFailures,
        lastIssueId: alert.lastIssueId,
      }))
      .sort((left, right) =>
        left.routineKey.localeCompare(right.routineKey)
        || left.kind.localeCompare(right.kind)
        || left.agentKey.localeCompare(right.agentKey),
      ),
  );
}

export type ManagerAgentStatusSnapshot = {
  id: string;
  name: string;
  role: string | null;
  status: string | null;
};

export type ManagerAgentAccountabilityEntry = {
  agentId: string;
  agentKey: string;
  agentName: string;
  role: string | null;
  status: string | null;
  runEvidenceCount: number;
  completedCount: number;
  movedCount: number;
  blockedCount: number;
  proofCount: number;
  narrationOnlyCount: number;
  lastActiveAt: string | null;
  completed: string[];
  moved: string[];
  blocked: string[];
  proofSignals: string[];
  narrationOnlySignals: string[];
  assessment: "material" | "low_value";
};

export type ManagerDailyAccountabilitySnapshot = {
  windowStart: string;
  windowEnd: string;
  evidenceBasis: "issue_state_and_comments";
  materiallyActiveAgentCount: number;
  lowValueAgentCount: number;
  agentsRan: ManagerAgentAccountabilityEntry[];
};

export type ManagerHandoffSummary = HandoffAnalytics["summary"];
export type ManagerHandoffSnapshot = HandoffSnapshot;

export type RunClassification = "actionable" | "low_value" | "no_op";

export type ManagerStateSnapshot = {
  generatedAt: string;
  chiefOfStaffAgentKey: string;
  runClassification: RunClassification;
  hasActionableWork: boolean;
  summary: {
    openIssueCount: number;
    blockedIssueCount: number;
    staleIssueCount: number;
    recentlyCompletedCount: number;
    unassignedIssueCount: number;
    routineAlertCount: number;
    managedOpenIssueCount: number;
    activeAgentCount: number;
    openHandoffCount: number;
    stuckHandoffCount: number;
  };
  handoffSummary: ManagerHandoffSummary;
  openIssues: ManagerIssueSnapshot[];
  blockedIssues: ManagerIssueSnapshot[];
  staleIssues: ManagerIssueSnapshot[];
  recentlyCompletedIssues: ManagerIssueSnapshot[];
  unassignedIssues: ManagerIssueSnapshot[];
  stuckHandoffs: ManagerHandoffSnapshot[];
  recentResolvedHandoffs: ManagerHandoffSnapshot[];
  routineAlerts: ManagerRoutineAlert[];
  managedOpenIssues: ManagerIssueSnapshot[];
  activeAgentStatuses: ManagerAgentStatusSnapshot[];
  dailyAccountability: ManagerDailyAccountabilitySnapshot;
  recentEvents: ManagerRecentEvent[];
  nextActionHints: string[];
};

type BuildManagerStateInput = {
  generatedAt: string;
  chiefOfStaffAgentKey: string;
  chiefOfStaffAgentId: string | null;
  issues: Array<Issue & { projectName?: string | null }>;
  agents: Agent[];
  routineHealth: Record<string, ManagerRoutineHealthEntry>;
  recentEvents: ManagerRecentEvent[];
  managedIssueIds: Set<string>;
  handoffAnalytics?: HandoffAnalytics;
  dailyAccountability?: ManagerDailyAccountabilitySnapshot;
};

const RESOLVED_STATUSES = new Set<Issue["status"]>(["done", "cancelled"]);
const OPEN_STATUSES = new Set<Issue["status"]>(["backlog", "todo", "in_progress", "in_review", "blocked"]);
const RECENT_COMPLETION_WINDOW_HOURS = 12;
const DAILY_ACCOUNTABILITY_WINDOW_HOURS = 24;
const MAX_ACCOUNTABILITY_ITEMS = 4;

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) return value;
  return new Date(0).toISOString();
}

function hoursSince(value: unknown, nowMs: number): number {
  const timestamp = new Date(toIsoString(value)).getTime();
  if (Number.isNaN(timestamp)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.round((((nowMs - timestamp) / (1000 * 60 * 60)) + Number.EPSILON) * 10) / 10);
}

function compactSummary(value: string | null | undefined, maxLength = 140) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function hasProofSignal(body: string) {
  return /https?:\/\/|www\.|notion\.so|github\.com|collection:\/\/|view:\/\//i.test(body);
}

function pushUnique(target: string[], value: string, limit = MAX_ACCOUNTABILITY_ITEMS) {
  const normalized = compactSummary(value);
  if (!normalized || target.includes(normalized)) return;
  if (target.length < limit) target.push(normalized);
}

function latestIso(current: string | null, candidate: unknown) {
  const candidateIso = toIsoString(candidate);
  if (!candidateIso || candidateIso === new Date(0).toISOString()) return current;
  if (!current) return candidateIso;
  return new Date(candidateIso).getTime() > new Date(current).getTime() ? candidateIso : current;
}

function emptyDailyAccountability(generatedAt: string): ManagerDailyAccountabilitySnapshot {
  const end = new Date(generatedAt);
  const start = new Date(end.getTime() - DAILY_ACCOUNTABILITY_WINDOW_HOURS * 60 * 60 * 1000);
  return {
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    evidenceBasis: "issue_state_and_comments",
    materiallyActiveAgentCount: 0,
    lowValueAgentCount: 0,
    agentsRan: [],
  };
}

type BuildDailyAccountabilityInput = {
  generatedAt: string;
  issues: Array<Issue & { projectName?: string | null }>;
  agents: Agent[];
  issueCommentsById: Record<string, IssueComment[]>;
  routineHealth?: Record<string, ManagerRoutineHealthEntry>;
};

function staleThresholdHours(priority: Issue["priority"]): number {
  switch (priority) {
    case "critical":
      return 1;
    case "high":
      return 4;
    case "medium":
      return 24;
    case "low":
      return 72;
    default:
      return 24;
  }
}

function toManagerIssueSnapshot(issue: Issue & { projectName?: string | null }, nowMs: number): ManagerIssueSnapshot {
  return {
    id: issue.id,
    title: issue.title,
    projectName: issue.projectName ?? null,
    status: issue.status,
    priority: issue.priority,
    assigneeAgentId: issue.assigneeAgentId ?? null,
    updatedAt: toIsoString(issue.updatedAt),
    hoursSinceUpdate: hoursSince(issue.updatedAt, nowMs),
  };
}

function isChiefOfStaffInternalIssue(
  issue: Issue,
  chiefOfStaffAgentId: string | null,
): boolean {
  if (!chiefOfStaffAgentId) return false;
  return issue.assigneeAgentId === chiefOfStaffAgentId || issue.createdByAgentId === chiefOfStaffAgentId;
}

export function collectRoutineHealthAlerts(
  routineHealth: Record<string, ManagerRoutineHealthEntry>,
  generatedAt: string,
): ManagerRoutineAlert[] {
  const nowMs = new Date(generatedAt).getTime();
  const alerts: ManagerRoutineAlert[] = [];

  for (const entry of Object.values(routineHealth)) {
    if (entry.routineStatus === "paused" || entry.routineStatus === "archived") {
      continue;
    }

    if (entry.consecutiveFailures >= 2) {
      alerts.push({
        routineKey: entry.routineKey,
        routineTitle: entry.routineTitle,
        agentKey: entry.agentKey,
        kind: "blocked",
        detail: entry.lastFailureReason ?? "unknown failure",
        lastRunAt: entry.lastRunAt,
        lastSuccessAt: entry.lastSuccessAt,
        consecutiveFailures: entry.consecutiveFailures,
        expectedIntervalHours: entry.expectedIntervalHours,
        lastIssueId: entry.lastIssueId,
      });
      continue;
    }

    if (entry.expectedIntervalHours && entry.expectedIntervalHours > 0) {
      const staleAnchor = entry.lastSuccessAt ?? entry.lastRunAt;
      const ageHours = hoursSince(staleAnchor, nowMs);
      if (ageHours >= entry.expectedIntervalHours * 2) {
        alerts.push({
          routineKey: entry.routineKey,
          routineTitle: entry.routineTitle,
          agentKey: entry.agentKey,
          kind: "stale",
          detail: `Last healthy run is ${ageHours.toFixed(1)}h old against a ${entry.expectedIntervalHours}h cadence.`,
          lastRunAt: entry.lastRunAt,
          lastSuccessAt: entry.lastSuccessAt,
          consecutiveFailures: entry.consecutiveFailures,
          expectedIntervalHours: entry.expectedIntervalHours,
          lastIssueId: entry.lastIssueId,
        });
      }
    }
  }

  return alerts;
}

export function buildDailyAccountabilitySnapshot(
  input: BuildDailyAccountabilityInput,
): ManagerDailyAccountabilitySnapshot {
  const nowMs = new Date(input.generatedAt).getTime();
  const windowStartMs = nowMs - DAILY_ACCOUNTABILITY_WINDOW_HOURS * 60 * 60 * 1000;
  const agentById = new Map(input.agents.map((agent) => [agent.id, agent] as const));
  const agentKeyById = new Map(
    input.agents.map((agent) => {
      const fallbackKey = agent.name.trim().toLowerCase().replace(/\s+/g, "-");
      return [agent.id, fallbackKey || agent.id] as const;
    }),
  );
  const entries = new Map<string, ManagerAgentAccountabilityEntry>();

  const ensureEntry = (agentId: string) => {
    const agent = agentById.get(agentId);
    if (!agent) return null;
    if (!entries.has(agentId)) {
      entries.set(agentId, {
        agentId,
        agentKey: agentKeyById.get(agentId) ?? agentId,
        agentName: agent.name,
        role: agent.role ?? null,
        status: agent.status ?? null,
        runEvidenceCount: 0,
        completedCount: 0,
        movedCount: 0,
        blockedCount: 0,
        proofCount: 0,
        narrationOnlyCount: 0,
        lastActiveAt: null,
        completed: [],
        moved: [],
        blocked: [],
        proofSignals: [],
        narrationOnlySignals: [],
        assessment: "material",
      });
    }
    return entries.get(agentId) ?? null;
  };

  for (const issue of input.issues) {
    const issueUpdatedAt = new Date(toIsoString(issue.updatedAt)).getTime();
    if (!Number.isFinite(issueUpdatedAt) || issueUpdatedAt < windowStartMs) continue;

    const recentComments = (input.issueCommentsById[issue.id] ?? []).filter((comment) => {
      const createdAt = new Date(toIsoString(comment.createdAt)).getTime();
      return Number.isFinite(createdAt) && createdAt >= windowStartMs;
    });
    const recentCommentAuthors = new Set(
      recentComments
        .map((comment) => comment.authorAgentId)
        .filter((agentId): agentId is string => typeof agentId === "string" && agentId.length > 0),
    );

    const relevantAgents = new Set<string>();
    if (typeof issue.assigneeAgentId === "string" && issue.assigneeAgentId.length > 0) {
      relevantAgents.add(issue.assigneeAgentId);
    }
    for (const authorId of recentCommentAuthors) relevantAgents.add(authorId);

    const issueLabel = issue.projectName ? `${issue.title} (${issue.projectName})` : issue.title;
    const isCompleted = RESOLVED_STATUSES.has(issue.status);
    const isBlocked = issue.status === "blocked";
    const isMoved = OPEN_STATUSES.has(issue.status) && !isBlocked;

    for (const agentId of relevantAgents) {
      const entry = ensureEntry(agentId);
      if (!entry) continue;
      entry.runEvidenceCount += 1;
      entry.lastActiveAt = latestIso(entry.lastActiveAt, issue.updatedAt);

      if (isCompleted) {
        entry.completedCount += 1;
        pushUnique(entry.completed, issueLabel);
      } else if (isBlocked) {
        entry.blockedCount += 1;
        pushUnique(entry.blocked, issueLabel);
      } else if (isMoved) {
        entry.movedCount += 1;
        pushUnique(entry.moved, issueLabel);
      }
    }

    for (const comment of recentComments) {
      if (!comment.authorAgentId) continue;
      const entry = ensureEntry(comment.authorAgentId);
      if (!entry) continue;
      entry.lastActiveAt = latestIso(entry.lastActiveAt, comment.createdAt);
      const summary = compactSummary(comment.body);
      if (!summary) continue;
      if (hasProofSignal(comment.body)) {
        entry.proofCount += 1;
        pushUnique(entry.proofSignals, `${issue.title}: ${summary}`);
      } else {
        entry.narrationOnlyCount += 1;
        pushUnique(entry.narrationOnlySignals, `${issue.title}: ${summary}`);
      }
    }
  }

  for (const health of Object.values(input.routineHealth ?? {})) {
    const lastRunMs = new Date(toIsoString(health.lastRunAt)).getTime();
    if (!Number.isFinite(lastRunMs) || lastRunMs < windowStartMs || health.lastOutcome !== "blocked") continue;
    const agent = input.agents.find((candidate) => {
      const normalizedName = candidate.name.trim().toLowerCase().replace(/\s+/g, "-");
      return normalizedName === health.agentKey || candidate.id === health.agentKey;
    });
    if (!agent) continue;
    const entry = ensureEntry(agent.id);
    if (!entry) continue;
    entry.runEvidenceCount += 1;
    entry.blockedCount += 1;
    entry.lastActiveAt = latestIso(entry.lastActiveAt, health.lastRunAt);
    pushUnique(
      entry.blocked,
      `${health.routineTitle}: ${health.lastFailureReason ?? "routine blocked"}`,
    );
  }

  const agentsRan = [...entries.values()]
    .map((entry) => ({
      ...entry,
      assessment: (
        entry.completedCount === 0
        && entry.proofCount === 0
        && entry.blockedCount === 0
        && entry.movedCount <= 1
        && entry.narrationOnlyCount > 0
          ? "low_value"
          : "material"
      ) as ManagerAgentAccountabilityEntry["assessment"],
    }))
    .sort((left, right) => {
      const leftScore = (left.completedCount * 4) + (left.proofCount * 3) + (left.movedCount * 2) + left.blockedCount;
      const rightScore = (right.completedCount * 4) + (right.proofCount * 3) + (right.movedCount * 2) + right.blockedCount;
      if (rightScore !== leftScore) return rightScore - leftScore;
      return (right.lastActiveAt ?? "").localeCompare(left.lastActiveAt ?? "");
    });

  return {
    windowStart: new Date(windowStartMs).toISOString(),
    windowEnd: input.generatedAt,
    evidenceBasis: "issue_state_and_comments",
    materiallyActiveAgentCount: agentsRan.filter((entry) => entry.assessment === "material").length,
    lowValueAgentCount: agentsRan.filter((entry) => entry.assessment === "low_value").length,
    agentsRan,
  };
}

function buildNextActionHints(input: {
  routineAlerts: ManagerRoutineAlert[];
  blockedIssues: ManagerIssueSnapshot[];
  unassignedIssues: ManagerIssueSnapshot[];
  staleIssues: ManagerIssueSnapshot[];
  recentlyCompletedIssues: ManagerIssueSnapshot[];
  stuckHandoffs: ManagerHandoffSnapshot[];
}): string[] {
  const hints: string[] = [];

  for (const alert of input.routineAlerts.slice(0, 4)) {
    hints.push(
      alert.kind === "blocked"
        ? `Review ${alert.routineTitle}; it has ${alert.consecutiveFailures} consecutive failures and needs an owner or escalation.`
        : `Follow up on ${alert.routineTitle}; it is stale against its expected cadence and needs a fresh run or a closure decision.`,
    );
  }

  for (const issue of input.blockedIssues.slice(0, 4)) {
    hints.push(
      `Unblock ${issue.title}${issue.projectName ? ` in ${issue.projectName}` : ""}; confirm whether it needs a new follow-up issue or a founder escalation.`,
    );
  }

  for (const issue of input.unassignedIssues.slice(0, 3)) {
    hints.push(
      `Assign a real owner to ${issue.title}${issue.projectName ? ` in ${issue.projectName}` : ""}; do not leave it unowned.`,
    );
  }

  for (const issue of input.staleIssues.slice(0, 3)) {
    hints.push(
      `Follow up on stale issue ${issue.title}; it has been idle for ${issue.hoursSinceUpdate.toFixed(1)}h and needs a concrete next step.`,
    );
  }

  for (const handoff of input.stuckHandoffs.slice(0, 4)) {
    hints.push(
      `Unstick handoff ${handoff.title}; ${handoff.stuckReason ?? "it needs escalation"} between ${handoff.from} and ${handoff.to}.`,
    );
  }

  for (const issue of input.recentlyCompletedIssues.slice(0, 3)) {
    hints.push(
      `Check whether completed issue ${issue.title} needs closure proof, a linked follow-on issue, or a parent issue update.`,
    );
  }

  return [...new Set(hints)].slice(0, 12);
}

export function buildManagerStateSnapshot(input: BuildManagerStateInput): ManagerStateSnapshot {
  const nowMs = new Date(input.generatedAt).getTime();
  const handoffAnalytics = input.handoffAnalytics ?? {
    summary: {
      openCount: 0,
      stuckCount: 0,
      resolvedCount: 0,
      avgLatencyHours: null,
      bounceRate: 0,
      maxBlockedDepth: 0,
    },
    openHandoffs: [],
    stuckHandoffs: [],
    recentResolvedHandoffs: [],
  };
  const relevantIssues = input.issues.filter((issue) => !isChiefOfStaffInternalIssue(issue, input.chiefOfStaffAgentId));
  const openIssues = relevantIssues
    .filter((issue) => OPEN_STATUSES.has(issue.status))
    .map((issue) => toManagerIssueSnapshot(issue, nowMs));
  const blockedIssues = openIssues.filter((issue) => issue.status === "blocked");
  const staleIssues = openIssues.filter(
    (issue) => issue.status !== "blocked" && issue.hoursSinceUpdate >= staleThresholdHours(issue.priority),
  );
  const unassignedIssues = openIssues.filter((issue) => !issue.assigneeAgentId);
  const recentlyCompletedIssues = relevantIssues
    .filter((issue) => RESOLVED_STATUSES.has(issue.status))
    .map((issue) => toManagerIssueSnapshot(issue, nowMs))
    .filter((issue) => issue.hoursSinceUpdate <= RECENT_COMPLETION_WINDOW_HOURS)
    .sort((a, b) => a.hoursSinceUpdate - b.hoursSinceUpdate)
    .slice(0, 20);
  const routineAlerts = collectRoutineHealthAlerts(input.routineHealth, input.generatedAt);
  const managedOpenIssues = openIssues.filter((issue) => input.managedIssueIds.has(issue.id));
  const activeAgentStatuses = input.agents
    .filter((agent) => agent.id !== input.chiefOfStaffAgentId)
    .filter((agent) => agent.status && agent.status !== "idle")
    .map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role ?? null,
      status: agent.status ?? null,
    }));
  const nextActionHints = buildNextActionHints({
    routineAlerts,
    blockedIssues,
    unassignedIssues,
    staleIssues,
    recentlyCompletedIssues,
    stuckHandoffs: handoffAnalytics.stuckHandoffs,
  });

  const hasActionableWork =
    blockedIssues.length > 0
    || staleIssues.length > 0
    || unassignedIssues.length > 0
    || routineAlerts.length > 0
    || handoffAnalytics.stuckHandoffs.length > 0
    || nextActionHints.length > 0;

  const runClassification: RunClassification =
    hasActionableWork
      ? "actionable"
      : recentlyCompletedIssues.length > 0 || managedOpenIssues.length > 0
        ? "low_value"
        : "no_op";

  return {
    generatedAt: input.generatedAt,
    chiefOfStaffAgentKey: input.chiefOfStaffAgentKey,
    runClassification,
    hasActionableWork,
    summary: {
      openIssueCount: openIssues.length,
      blockedIssueCount: blockedIssues.length,
      staleIssueCount: staleIssues.length,
      recentlyCompletedCount: recentlyCompletedIssues.length,
      unassignedIssueCount: unassignedIssues.length,
      routineAlertCount: routineAlerts.length,
      managedOpenIssueCount: managedOpenIssues.length,
      activeAgentCount: activeAgentStatuses.length,
      openHandoffCount: handoffAnalytics.summary.openCount,
      stuckHandoffCount: handoffAnalytics.summary.stuckCount,
    },
    handoffSummary: handoffAnalytics.summary,
    openIssues: openIssues.slice(0, 100),
    blockedIssues: blockedIssues.slice(0, 20),
    staleIssues: staleIssues.slice(0, 20),
    recentlyCompletedIssues,
    unassignedIssues: unassignedIssues.slice(0, 20),
    stuckHandoffs: handoffAnalytics.stuckHandoffs.slice(0, 20),
    recentResolvedHandoffs: handoffAnalytics.recentResolvedHandoffs.slice(0, 10),
    routineAlerts: routineAlerts.slice(0, 20),
    managedOpenIssues: managedOpenIssues.slice(0, 20),
    activeAgentStatuses,
    dailyAccountability: input.dailyAccountability ?? emptyDailyAccountability(input.generatedAt),
    recentEvents: input.recentEvents.slice(0, 20),
    nextActionHints,
  };
}

export function shouldWakeChiefOfStaffForIssueEvent(input: {
  eventType: "issue.created" | "issue.updated";
  issue: Pick<Issue, "status" | "priority" | "assigneeAgentId" | "createdByAgentId" | "originKind">;
  chiefOfStaffAgentId: string | null;
}): boolean {
  const { issue, chiefOfStaffAgentId, eventType } = input;
  if (chiefOfStaffAgentId && issue.createdByAgentId === chiefOfStaffAgentId) {
    return false;
  }

  if (eventType === "issue.created") {
    if (issue.originKind === ORIGIN_KIND) {
      return false;
    }
    return !RESOLVED_STATUSES.has(issue.status);
  }

  if (issue.status === "blocked" || RESOLVED_STATUSES.has(issue.status)) {
    return true;
  }

  if (!issue.assigneeAgentId) {
    return true;
  }

  return issue.priority === "critical" || issue.priority === "high";
}
