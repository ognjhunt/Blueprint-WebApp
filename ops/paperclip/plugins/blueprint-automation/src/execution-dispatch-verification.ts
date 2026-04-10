import type { RuntimeSessionStatus } from "./runtime/types.js";

const NON_ACTIONABLE_RUNTIME_SESSION_STATUSES = new Set<RuntimeSessionStatus>([
  "failed",
  "cancelled",
  "archived",
]);

function toTimestamp(value: string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

export function verifyDispatchWake(input: {
  wakeRunId?: string | null;
  expectedAssigneeKey: string;
  issueExecutionRunId?: string | null;
  issueExecutionAgentNameKey?: string | null;
  runtimeSession?: {
    agentKey: string;
    status: RuntimeSessionStatus;
    updatedAt: string;
  } | null;
  dispatchedAt: string;
}) {
  if (input.wakeRunId?.trim()) {
    return { verified: true, evidence: "wake_run" as const };
  }

  if (
    input.issueExecutionRunId?.trim()
    && input.issueExecutionAgentNameKey?.trim() === input.expectedAssigneeKey
    && input.runtimeSession
    && input.runtimeSession.agentKey === input.expectedAssigneeKey
    && !NON_ACTIONABLE_RUNTIME_SESSION_STATUSES.has(input.runtimeSession.status)
    && toTimestamp(input.runtimeSession.updatedAt) >= toTimestamp(input.dispatchedAt)
  ) {
    return { verified: true, evidence: "issue_execution_lock" as const };
  }

  if (
    input.runtimeSession
    && input.runtimeSession.agentKey === input.expectedAssigneeKey
    && !NON_ACTIONABLE_RUNTIME_SESSION_STATUSES.has(input.runtimeSession.status)
    && toTimestamp(input.runtimeSession.updatedAt) >= toTimestamp(input.dispatchedAt)
  ) {
    return { verified: true, evidence: "runtime_session" as const };
  }

  return { verified: false, evidence: "missing_execution_proof" as const };
}
