import type { Issue, IssueComment } from "@paperclipai/plugin-sdk";

export type HandoffRequest = {
  version: string;
  from: string;
  to: string;
  type: "work-request" | "escalation" | "information-request" | "status-update";
  priority: "critical" | "high" | "medium" | "low";
  context: {
    summary: string;
    sourceIssueId?: string | null;
    relatedArtifacts?: Array<{ type: string; path: string }>;
  };
  expectedOutcome: string;
  deadline?: string;
  responseSchema?: Record<string, unknown>;
};

export type HandoffResponse = {
  version: string;
  from: string;
  to: string;
  sourceHandoffIssueId: string;
  outcome: "done" | "blocked";
  result?: Record<string, unknown>;
  proofLinks?: string[];
  followUpNeeded?: boolean;
  followUpReason?: string | null;
};

export type HandoffCommentParseResult =
  | { kind: "request"; data: HandoffRequest }
  | { kind: "response"; data: HandoffResponse };

export type HandoffSnapshot = {
  id: string;
  title: string;
  projectName: string | null;
  parentId: string | null;
  status: Issue["status"];
  priority: Issue["priority"];
  assigneeAgentId: string | null;
  assigneeAgentKey: string | null;
  from: string;
  to: string;
  type: HandoffRequest["type"];
  requestCommentId: string;
  responseCommentId: string | null;
  requestAt: string;
  responseAt: string | null;
  responseFrom: string | null;
  responseTo: string | null;
  outcome: HandoffResponse["outcome"] | null;
  followUpNeeded: boolean;
  followUpReason: string | null;
  proofLinkCount: number;
  updatedAt: string;
  hoursSinceUpdate: number;
  latencyHours: number | null;
  blockedDepth: number;
  isBounced: boolean;
  isStuck: boolean;
  stuckReason: string | null;
};

export type HandoffAnalytics = {
  summary: {
    openCount: number;
    stuckCount: number;
    resolvedCount: number;
    avgLatencyHours: number | null;
    bounceRate: number;
    maxBlockedDepth: number;
  };
  openHandoffs: HandoffSnapshot[];
  stuckHandoffs: HandoffSnapshot[];
  recentResolvedHandoffs: HandoffSnapshot[];
};

function extractJsonCandidate(body: string): string | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (!fenced || typeof fenced[1] !== "string") return null;
  const candidate = fenced[1].trim();
  return candidate.length > 0 ? candidate : null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeKey(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value.length > 0) return value;
  return new Date(0).toISOString();
}

function hoursBetween(from: string, to: string) {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) return null;
  return Math.max(0, Math.round((((toMs - fromMs) / (1000 * 60 * 60)) + Number.EPSILON) * 10) / 10);
}

function hoursSince(value: unknown, nowIso: string) {
  return hoursBetween(toIsoString(value), nowIso) ?? Number.POSITIVE_INFINITY;
}

function isOpenStatus(status: Issue["status"]) {
  return status === "backlog" || status === "todo" || status === "in_progress" || status === "in_review" || status === "blocked";
}

function stuckThresholdHours(priority: Issue["priority"]) {
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

export function isHandoffIssueTitle(title: string | null | undefined) {
  return /^\s*\[handoff\]/i.test(title ?? "");
}

export function parseHandoffComment(body: string): HandoffCommentParseResult | null {
  const candidate = extractJsonCandidate(body);
  if (!candidate) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return null;
  }

  const record = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  if (!record) return null;

  const request = record.handoff;
  if (request && typeof request === "object") {
    const handoff = request as Record<string, unknown>;
    if (
      isNonEmptyString(handoff.version) &&
      isNonEmptyString(handoff.from) &&
      isNonEmptyString(handoff.to) &&
      isNonEmptyString(handoff.type) &&
      isNonEmptyString(handoff.priority) &&
      handoff.context &&
      typeof handoff.context === "object" &&
      isNonEmptyString((handoff.context as Record<string, unknown>).summary) &&
      isNonEmptyString(handoff.expectedOutcome)
    ) {
      return {
        kind: "request",
        data: {
          version: handoff.version,
          from: handoff.from,
          to: handoff.to,
          type: handoff.type as HandoffRequest["type"],
          priority: handoff.priority as HandoffRequest["priority"],
          context: handoff.context as HandoffRequest["context"],
          expectedOutcome: handoff.expectedOutcome,
          deadline: isNonEmptyString(handoff.deadline) ? handoff.deadline : undefined,
          responseSchema: handoff.responseSchema && typeof handoff.responseSchema === "object"
            ? handoff.responseSchema as Record<string, unknown>
            : undefined,
        },
      };
    }
  }

  const response = record.handoff_response;
  if (response && typeof response === "object") {
    const handoffResponse = response as Record<string, unknown>;
    if (
      isNonEmptyString(handoffResponse.version) &&
      isNonEmptyString(handoffResponse.from) &&
      isNonEmptyString(handoffResponse.to) &&
      isNonEmptyString(handoffResponse.sourceHandoffIssueId) &&
      (handoffResponse.outcome === "done" || handoffResponse.outcome === "blocked")
    ) {
      return {
        kind: "response",
        data: {
          version: handoffResponse.version,
          from: handoffResponse.from,
          to: handoffResponse.to,
          sourceHandoffIssueId: handoffResponse.sourceHandoffIssueId,
          outcome: handoffResponse.outcome,
          result: handoffResponse.result && typeof handoffResponse.result === "object"
            ? handoffResponse.result as Record<string, unknown>
            : undefined,
          proofLinks: Array.isArray(handoffResponse.proofLinks)
            ? handoffResponse.proofLinks.filter(isNonEmptyString)
            : undefined,
          followUpNeeded: Boolean(handoffResponse.followUpNeeded),
          followUpReason: isNonEmptyString(handoffResponse.followUpReason)
            ? handoffResponse.followUpReason
            : null,
        },
      };
    }
  }

  return null;
}

function computeBlockedDepth(
  issue: Issue,
  handoffIssueIds: Set<string>,
  issueById: Map<string, Issue>,
) {
  let depth = issue.status === "blocked" ? 1 : 0;
  let cursorId = issue.parentId ?? null;
  while (cursorId) {
    const parent = issueById.get(cursorId);
    if (!parent || !handoffIssueIds.has(parent.id)) break;
    if (parent.status === "blocked") depth += 1;
    cursorId = parent.parentId ?? null;
  }
  return depth;
}

function sortNewest<T extends { updatedAt: string }>(rows: T[]) {
  return [...rows].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function sortOldest<T extends { hoursSinceUpdate: number }>(rows: T[]) {
  return [...rows].sort((left, right) => right.hoursSinceUpdate - left.hoursSinceUpdate);
}

export function buildHandoffAnalytics(input: {
  issues: Array<Issue & { projectName?: string | null }>;
  commentsByIssueId: Map<string, IssueComment[]>;
  agentKeyById: Map<string, string>;
  generatedAt: string;
}): HandoffAnalytics {
  const issueById = new Map(input.issues.map((issue) => [issue.id, issue]));
  const handoffIssues = input.issues.filter((issue) => {
    if (isHandoffIssueTitle(issue.title)) return true;
    const comments = input.commentsByIssueId.get(issue.id) ?? [];
    return comments.some((comment) => parseHandoffComment(comment.body)?.kind === "request");
  });
  const handoffIssueIds = new Set(handoffIssues.map((issue) => issue.id));

  const snapshots: HandoffSnapshot[] = [];

  for (const issue of handoffIssues) {
    const comments = input.commentsByIssueId.get(issue.id) ?? [];
    const parsedComments = comments
      .map((comment) => ({ comment, parsed: parseHandoffComment(comment.body) }))
      .filter((entry) => entry.parsed);

    const requestEntry = parsedComments.find(
      (entry): entry is { comment: IssueComment; parsed: { kind: "request"; data: HandoffRequest } } =>
        entry.parsed?.kind === "request",
    );
    if (!requestEntry) continue;

    const responseEntry = [...parsedComments]
      .reverse()
      .find(
        (entry): entry is { comment: IssueComment; parsed: { kind: "response"; data: HandoffResponse } } =>
          entry.parsed?.kind === "response",
      ) ?? null;

    const request = requestEntry.parsed.data;
    const response = responseEntry?.parsed.data ?? null;
    const requestAt = toIsoString(requestEntry.comment.createdAt);
    const responseAt = responseEntry ? toIsoString(responseEntry.comment.createdAt) : null;
    const updatedAt = toIsoString(issue.updatedAt);
    const latencyHours = responseAt
      ? hoursBetween(requestAt, responseAt)
      : !isOpenStatus(issue.status)
        ? hoursBetween(requestAt, updatedAt)
        : null;
    const assigneeAgentKey = issue.assigneeAgentId ? input.agentKeyById.get(issue.assigneeAgentId) ?? null : null;
    const blockedDepth = computeBlockedDepth(issue, handoffIssueIds, issueById);
    const deadlineHours = request.deadline ? hoursBetween(request.deadline, input.generatedAt) : null;
    const assigneeMismatch = assigneeAgentKey ? normalizeKey(assigneeAgentKey) !== normalizeKey(request.to) : false;
    const responseMismatch = response ? normalizeKey(response.from) !== normalizeKey(request.to) : false;
    const isBounced = assigneeMismatch || responseMismatch || Boolean(response?.followUpNeeded);

    let isStuck = false;
    let stuckReason: string | null = null;
    if (issue.status === "blocked") {
      isStuck = true;
      stuckReason = blockedDepth > 1
        ? `Blocked handoff chain depth ${blockedDepth}.`
        : "Receiver marked the handoff blocked.";
    } else if (isOpenStatus(issue.status)) {
      const ageHours = hoursSince(issue.updatedAt, input.generatedAt);
      if (deadlineHours !== null && deadlineHours >= 0.5) {
        isStuck = true;
        stuckReason = `Deadline missed by ${deadlineHours.toFixed(1)}h.`;
      } else if (ageHours >= stuckThresholdHours(issue.priority)) {
        isStuck = true;
        stuckReason = `Idle for ${ageHours.toFixed(1)}h at ${issue.priority} priority.`;
      }
    }

    snapshots.push({
      id: issue.id,
      title: issue.title,
      projectName: issue.projectName ?? null,
      parentId: issue.parentId ?? null,
      status: issue.status,
      priority: issue.priority,
      assigneeAgentId: issue.assigneeAgentId ?? null,
      assigneeAgentKey,
      from: request.from,
      to: request.to,
      type: request.type,
      requestCommentId: requestEntry.comment.id,
      responseCommentId: responseEntry?.comment.id ?? null,
      requestAt,
      responseAt,
      responseFrom: response?.from ?? null,
      responseTo: response?.to ?? null,
      outcome: response?.outcome ?? (issue.status === "done" ? "done" : issue.status === "blocked" ? "blocked" : null),
      followUpNeeded: Boolean(response?.followUpNeeded),
      followUpReason: response?.followUpReason ?? null,
      proofLinkCount: response?.proofLinks?.length ?? 0,
      updatedAt,
      hoursSinceUpdate: hoursSince(issue.updatedAt, input.generatedAt),
      latencyHours,
      blockedDepth,
      isBounced,
      isStuck,
      stuckReason,
    });
  }

  const openHandoffs = sortNewest(snapshots.filter((snapshot) => isOpenStatus(snapshot.status)));
  const stuckHandoffs = sortOldest(openHandoffs.filter((snapshot) => snapshot.isStuck));
  const resolvedHandoffs = sortNewest(
    snapshots.filter((snapshot) => snapshot.status === "done" || snapshot.status === "cancelled"),
  );
  const latencySamples = snapshots
    .filter((snapshot) => snapshot.latencyHours !== null)
    .map((snapshot) => snapshot.latencyHours ?? 0);
  const avgLatencyHours = latencySamples.length > 0
    ? Math.round(((latencySamples.reduce((sum, sample) => sum + sample, 0) / latencySamples.length) + Number.EPSILON) * 10) / 10
    : null;
  const bounceCount = snapshots.filter((snapshot) => snapshot.isBounced).length;
  const maxBlockedDepth = snapshots.reduce((max, snapshot) => Math.max(max, snapshot.blockedDepth), 0);

  return {
    summary: {
      openCount: openHandoffs.length,
      stuckCount: stuckHandoffs.length,
      resolvedCount: resolvedHandoffs.length,
      avgLatencyHours,
      bounceRate: snapshots.length > 0 ? Math.round(((bounceCount / snapshots.length) + Number.EPSILON) * 1000) / 1000 : 0,
      maxBlockedDepth,
    },
    openHandoffs,
    stuckHandoffs,
    recentResolvedHandoffs: resolvedHandoffs.slice(0, 10),
  };
}
