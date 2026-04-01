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

export type LocalQuotaFallbackAdapterType = "claude_local" | "codex_local" | "opencode_local" | "hermes_local";

export type LocalAdapterSnapshot = {
  id: string;
  adapterType: string;
  adapterConfig?: Record<string, unknown> | null;
};

export type WorkspaceAdapterCooldownRecord = {
  workspaceKey: string;
  unavailableAdapterType: LocalQuotaFallbackAdapterType;
  fallbackAdapterType: LocalQuotaFallbackAdapterType;
  cooldownUntil: string;
  recordedAt: string;
  reason: string;
  sourceRunId?: string | null;
  sourceAgentId?: string | null;
  note?: string | null;
};

export type WorkspaceAdapterCooldownState = Record<string, WorkspaceAdapterCooldownRecord>;

const QUOTA_OR_RATE_LIMIT_RE =
  /(?:resource_exhausted|quota|rate[-\s]?limit|too many requests|\b429\b|billing details|you['’]ve hit your limit|hit your limit|limit[^.\n]*reset)/i;
const MODEL_NOT_FOUND_RE = /model.*not.*found|model.*404|invalid.*model|unknown.*model|gpt-5-4-mini|http.*404|not_found_error/i;
const MONTH_INDEX: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

export function isQuotaOrRateLimitFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return QUOTA_OR_RATE_LIMIT_RE.test(message);
}

export function isModelNotFoundFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return MODEL_NOT_FOUND_RE.test(message);
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
    model: options?.model ?? "gpt-5.4-mini",
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

export function buildOpenCodeFallbackAdapterConfig(
  adapterConfig: Record<string, unknown> | null | undefined,
  options?: {
    model?: string;
    cwd?: string;
  },
): Record<string, unknown> {
  const next = { ...(adapterConfig ?? {}) };
  delete next.dangerouslySkipPermissions;
  delete next.dangerouslyBypassApprovalsAndSandbox;
  delete next.modelReasoningEffort;

  return {
    ...next,
    model: options?.model ?? "opencode/minimax-m2.5-free",
    cwd: options?.cwd ?? next.cwd ?? "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
    timeoutSec: next.timeoutSec ?? 1800,
  };
}

export function buildHermesFallbackAdapterConfig(
  adapterConfig: Record<string, unknown> | null | undefined,
  options?: {
    model?: string;
    cwd?: string;
  },
): Record<string, unknown> {
  const next = { ...(adapterConfig ?? {}) };
  delete next.dangerouslySkipPermissions;
  delete next.dangerouslyBypassApprovalsAndSandbox;

  return {
    ...next,
    model: options?.model ?? process.env.BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL ?? "qwen/qwen3.6-plus-preview:free",
    modelReasoningEffort: next.modelReasoningEffort ?? "xhigh",
    cwd: options?.cwd ?? next.cwd ?? "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
    timeoutSec: next.timeoutSec ?? 1800,
  };
}

export function getLocalAdapterWorkspaceKey(
  adapterConfig: Record<string, unknown> | null | undefined,
): string | null {
  const cwd = typeof adapterConfig?.cwd === "string" ? adapterConfig.cwd.trim() : "";
  return cwd.length > 0 ? cwd : null;
}

export function selectWorkspaceQuotaFallbackTargets(
  failedAgent: LocalAdapterSnapshot,
  agents: LocalAdapterSnapshot[],
): LocalAdapterSnapshot[] {
  const workspaceKey = getLocalAdapterWorkspaceKey(failedAgent.adapterConfig);
  const fallbackCandidates = new Map<string, LocalAdapterSnapshot>();

  for (const agent of agents) {
    if (agent.adapterType !== failedAgent.adapterType) {
      continue;
    }
    if (workspaceKey && getLocalAdapterWorkspaceKey(agent.adapterConfig) !== workspaceKey) {
      continue;
    }
    fallbackCandidates.set(agent.id, agent);
  }

  if (!fallbackCandidates.has(failedAgent.id)) {
    fallbackCandidates.set(failedAgent.id, failedAgent);
  }

  return [...fallbackCandidates.values()];
}

export function getWorkspaceAdapterCooldownKey(
  workspaceKey: string,
  unavailableAdapterType: LocalQuotaFallbackAdapterType,
): string {
  return `${workspaceKey}::${unavailableAdapterType}`;
}

export function parseQuotaResetAt(message: string | null | undefined, now = new Date()): string | null {
  if (!message) return null;

  const resetMatch =
    /resets?\s+([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:\((UTC)\)|UTC)/i.exec(
      message,
    );
  if (!resetMatch) {
    return null;
  }

  const [, monthToken, dayToken, hourToken, minuteToken, ampmToken] = resetMatch;
  const monthIndex = MONTH_INDEX[monthToken.slice(0, 3).toLowerCase()];
  if (monthIndex === undefined) {
    return null;
  }

  const day = Number(dayToken);
  const hour12 = Number(hourToken);
  const minute = minuteToken ? Number(minuteToken) : 0;
  if (!Number.isFinite(day) || !Number.isFinite(hour12) || !Number.isFinite(minute)) {
    return null;
  }

  let hour24 = hour12 % 12;
  if (ampmToken.toLowerCase() === "pm") {
    hour24 += 12;
  }

  let year = now.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, monthIndex, day, hour24, minute, 0, 0));
  if (candidate.getTime() < now.getTime() - 60_000) {
    year += 1;
    candidate = new Date(Date.UTC(year, monthIndex, day, hour24, minute, 0, 0));
  }

  return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString();
}

export function resolveQuotaCooldownUntil(
  message: string | null | undefined,
  options?: {
    now?: Date;
    defaultCooldownMs?: number;
  },
): string {
  const now = options?.now ?? new Date();
  const parsedReset = parseQuotaResetAt(message, now);
  if (parsedReset) {
    return parsedReset;
  }

  const fallbackMs = Math.max(60_000, options?.defaultCooldownMs ?? 6 * 60 * 60 * 1000);
  return new Date(now.getTime() + fallbackMs).toISOString();
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
