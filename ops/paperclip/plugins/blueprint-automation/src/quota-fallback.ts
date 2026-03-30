export type QuotaFallbackRetryRecord = {
  attemptedAt: string;
  status: "retried" | "skipped" | "failed";
  agentId: string;
  issueId: string | null;
  taskKey: string | null;
  reason: string;
  fallbackAdapterType?: string | null;
  wakeupRunId?: string | null;
  note?: string | null;
};

export type QuotaFallbackRetryState = Record<string, QuotaFallbackRetryRecord>;

export type LocalQuotaFallbackAdapterType = "claude_local" | "codex_local";

const QUOTA_OR_RATE_LIMIT_RE =
  /(?:resource_exhausted|quota|rate[-\s]?limit|too many requests|\b429\b|billing details|you['’]ve hit your limit|hit your limit|limit[^.\n]*reset)/i;

export function isQuotaOrRateLimitFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return QUOTA_OR_RATE_LIMIT_RE.test(message);
}

export function buildCodexFallbackAdapterConfig(
  adapterConfig: Record<string, unknown> | null | undefined,
  options?: {
    model?: string;
    modelReasoningEffort?: string;
  },
): Record<string, unknown> {
  const next = { ...(adapterConfig ?? {}) };
  delete next.dangerouslySkipPermissions;
  delete next.model;
  delete next.modelReasoningEffort;

  return {
    ...next,
    model: options?.model ?? "gpt-5.4",
    modelReasoningEffort: options?.modelReasoningEffort ?? "high",
    dangerouslyBypassApprovalsAndSandbox: true,
  };
}

export function buildClaudeFallbackAdapterConfig(
  adapterConfig: Record<string, unknown> | null | undefined,
  options?: {
    model?: string;
  },
): Record<string, unknown> {
  const next = { ...(adapterConfig ?? {}) };
  delete next.dangerouslyBypassApprovalsAndSandbox;
  delete next.model;
  delete next.modelReasoningEffort;

  return {
    ...next,
    model: options?.model ?? "claude-sonnet-4-6",
    dangerouslySkipPermissions: true,
  };
}

export function buildQuotaFallbackRetryRecord(input: {
  attemptedAt: string;
  status: QuotaFallbackRetryRecord["status"];
  agentId: string;
  issueId?: string | null;
  taskKey?: string | null;
  reason: string;
  fallbackAdapterType?: string | null;
  wakeupRunId?: string | null;
  note?: string | null;
}): QuotaFallbackRetryRecord {
  return {
    attemptedAt: input.attemptedAt,
    status: input.status,
    agentId: input.agentId,
    issueId: input.issueId ?? null,
    taskKey: input.taskKey ?? null,
    reason: input.reason,
    fallbackAdapterType: input.fallbackAdapterType ?? null,
    wakeupRunId: input.wakeupRunId ?? null,
    note: input.note ?? null,
  };
}
