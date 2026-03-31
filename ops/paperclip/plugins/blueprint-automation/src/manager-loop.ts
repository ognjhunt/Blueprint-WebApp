import type { Agent, Issue } from "@paperclipai/plugin-sdk";
import type { HandoffAnalytics, HandoffSnapshot } from "./handoffs.js";

export type ManagerRoutineHealthEntry = {
  routineKey: string;
  routineTitle: string;
  agentKey: string;
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

export type ManagerAgentStatusSnapshot = {
  id: string;
  name: string;
  role: string | null;
  status: string | null;
};

export type ManagerHandoffSummary = HandoffAnalytics["summary"];
export type ManagerHandoffSnapshot = HandoffSnapshot;

export type ManagerStateSnapshot = {
  generatedAt: string;
  chiefOfStaffAgentKey: string;
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
  blockedIssues: ManagerIssueSnapshot[];
  staleIssues: ManagerIssueSnapshot[];
  recentlyCompletedIssues: ManagerIssueSnapshot[];
  unassignedIssues: ManagerIssueSnapshot[];
  stuckHandoffs: ManagerHandoffSnapshot[];
  recentResolvedHandoffs: ManagerHandoffSnapshot[];
  routineAlerts: ManagerRoutineAlert[];
  managedOpenIssues: ManagerIssueSnapshot[];
  activeAgentStatuses: ManagerAgentStatusSnapshot[];
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
};

const RESOLVED_STATUSES = new Set<Issue["status"]>(["done", "cancelled"]);
const OPEN_STATUSES = new Set<Issue["status"]>(["backlog", "todo", "in_progress", "in_review", "blocked"]);
const RECENT_COMPLETION_WINDOW_HOURS = 12;

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

  return {
    generatedAt: input.generatedAt,
    chiefOfStaffAgentKey: input.chiefOfStaffAgentKey,
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
    blockedIssues: blockedIssues.slice(0, 20),
    staleIssues: staleIssues.slice(0, 20),
    recentlyCompletedIssues,
    unassignedIssues: unassignedIssues.slice(0, 20),
    stuckHandoffs: handoffAnalytics.stuckHandoffs.slice(0, 20),
    recentResolvedHandoffs: handoffAnalytics.recentResolvedHandoffs.slice(0, 10),
    routineAlerts: routineAlerts.slice(0, 20),
    managedOpenIssues: managedOpenIssues.slice(0, 20),
    activeAgentStatuses,
    recentEvents: input.recentEvents.slice(0, 20),
    nextActionHints,
  };
}

export function shouldWakeChiefOfStaffForIssueEvent(input: {
  eventType: "issue.created" | "issue.updated";
  issue: Pick<Issue, "status" | "priority" | "assigneeAgentId" | "createdByAgentId">;
  chiefOfStaffAgentId: string | null;
}): boolean {
  const { issue, chiefOfStaffAgentId, eventType } = input;
  if (
    chiefOfStaffAgentId
    && (issue.assigneeAgentId === chiefOfStaffAgentId || issue.createdByAgentId === chiefOfStaffAgentId)
  ) {
    return false;
  }

  if (eventType === "issue.created") {
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
