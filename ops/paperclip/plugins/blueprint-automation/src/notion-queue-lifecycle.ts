export type QueueResolutionStatus = "done" | "cancelled" | "blocked";

export function workQueueIssueTitle(issueTitle: string) {
  const prefix = "Notion Work Queue: ";
  return issueTitle.startsWith(prefix) ? issueTitle.slice(prefix.length).trim() : issueTitle.trim();
}

export function workQueueLifecycleStageForResolution(resolutionStatus: QueueResolutionStatus) {
  if (resolutionStatus === "blocked") {
    return "Blocked";
  }
  return "Done";
}

function timestampRank(value: string | Date | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function queueActivityTimestamp(item: {
  lastStatusChange?: string;
  lastEditedTime?: string;
}) {
  return Math.max(timestampRank(item.lastStatusChange), timestampRank(item.lastEditedTime));
}

export function shouldPreserveResolvedNotionQueueIssue(
  issue: {
    status: string;
    updatedAt?: string | Date;
  },
  mapping: {
    lastSeenAt?: string;
    resolutionStatus?: string | null;
  },
  item: {
    lastStatusChange?: string;
    lastEditedTime?: string;
  },
) {
  if (issue.status !== "done" && issue.status !== "cancelled") {
    return false;
  }

  const resolvedAt = Math.max(timestampRank(issue.updatedAt), timestampRank(mapping.lastSeenAt));
  const queueUpdatedAt = queueActivityTimestamp(item);
  if (!Number.isFinite(resolvedAt)) {
    return false;
  }
  if (!Number.isFinite(queueUpdatedAt)) {
    return true;
  }
  return resolvedAt >= queueUpdatedAt;
}
