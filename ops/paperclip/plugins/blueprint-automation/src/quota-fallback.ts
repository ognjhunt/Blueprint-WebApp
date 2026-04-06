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

export const DEFAULT_HERMES_FALLBACK_MODEL = "qwen/qwen3.6-plus:free";
export const DEFAULT_HERMES_FALLBACK_MODELS = [
  "qwen/qwen3.6-plus:free",
  "openrouter/free",
  "stepfun/step-3.5-flash:free",
  "nvidia/nemotron-3-super:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "arcee-ai/trinity-large-preview:free",
] as const;
export const HERMES_MODEL_LADDER_CONFIG_KEY = "blueprintHermesModelLadder";
export const FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY = "blueprintFallbackOriginAdapterType";
const LOCAL_EXECUTION_POLICY_ADAPTERS: LocalQuotaFallbackAdapterType[] = [
  "claude_local",
  "codex_local",
  "hermes_local",
  "opencode_local",
];

export type LocalQuotaFallbackDescriptor = {
  adapterType: LocalQuotaFallbackAdapterType;
  reason: string;
  adapterConfig: Record<string, unknown>;
};

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

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeModelList(values: Iterable<string>): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

function normalizeExecutionPolicyAdapterList(
  values: unknown,
  targetAdapterType: LocalQuotaFallbackAdapterType,
): LocalQuotaFallbackAdapterType[] {
  const source = Array.isArray(values) && values.length > 0
    ? values
    : LOCAL_EXECUTION_POLICY_ADAPTERS;
  const normalized: LocalQuotaFallbackAdapterType[] = [];
  const seen = new Set<LocalQuotaFallbackAdapterType>();

  for (const candidate of [targetAdapterType, ...source, ...LOCAL_EXECUTION_POLICY_ADAPTERS]) {
    if (
      candidate !== "claude_local" &&
      candidate !== "codex_local" &&
      candidate !== "hermes_local" &&
      candidate !== "opencode_local"
    ) {
      continue;
    }
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    normalized.push(candidate);
  }

  return normalized;
}

function parseModelList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return normalizeModelList(
      value
        .map((entry) => (typeof entry === "string" ? entry : ""))
        .filter((entry) => entry.length > 0),
    );
  }

  if (typeof value === "string") {
    return normalizeModelList(value.split(","));
  }

  return [];
}

/**
 * Model ids that belong to Codex / Claude / ChatGPT-style lanes and must not
 * be carried onto Hermes free (OpenRouter) routing — e.g. when falling back
 * from codex_local and copying adapterConfig.
 */
export function isIncompatibleHermesFreeRoutingModel(model: string | null | undefined): boolean {
  const m = (model ?? "").trim().toLowerCase();
  if (!m) return false;
  if (m.includes("claude")) return true;
  if (/^o[0-9]/.test(m)) return true;
  if (/^gpt-/.test(m)) return true;
  return false;
}

function filterCompatibleHermesLadderModels(models: string[]): string[] {
  return models.filter((id) => !isIncompatibleHermesFreeRoutingModel(id));
}

export function resolveHermesFallbackModels(
  adapterConfig: Record<string, unknown> | null | undefined,
  options?: {
    includeCurrentModel?: boolean;
  },
): string[] {
  const includeCurrentModel = options?.includeCurrentModel !== false;
  const currentModel = asTrimmedString(adapterConfig?.model);
  const configuredLadder = filterCompatibleHermesLadderModels(
    parseModelList(adapterConfig?.[HERMES_MODEL_LADDER_CONFIG_KEY]),
  );
  const envLadder = filterCompatibleHermesLadderModels(
    parseModelList(process.env.BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODELS),
  );
  const singleEnvRaw = asTrimmedString(process.env.BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL);
  const singleEnvModel =
    singleEnvRaw && !isIncompatibleHermesFreeRoutingModel(singleEnvRaw) ? singleEnvRaw : null;

  const includeCurrent =
    includeCurrentModel
    && currentModel
    && !isIncompatibleHermesFreeRoutingModel(currentModel);

  return normalizeModelList([
    ...(includeCurrent ? [currentModel] : []),
    ...configuredLadder,
    ...envLadder,
    ...(singleEnvModel ? [singleEnvModel] : []),
    ...DEFAULT_HERMES_FALLBACK_MODELS,
  ]);
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
  delete next.model;
  const ladder = resolveHermesFallbackModels(adapterConfig, { includeCurrentModel: false });
  const optionModel = asTrimmedString(options?.model as string | undefined);
  const chosen =
    optionModel && !isIncompatibleHermesFreeRoutingModel(optionModel) ? optionModel : null;
  const envFallback = asTrimmedString(process.env.BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL);
  const envPrimary =
    envFallback && !isIncompatibleHermesFreeRoutingModel(envFallback) ? envFallback : null;
  const model =
    chosen
    ?? ladder[0]
    ?? envPrimary
    ?? DEFAULT_HERMES_FALLBACK_MODEL;

  return {
    ...next,
    model,
    [HERMES_MODEL_LADDER_CONFIG_KEY]: ladder.length > 0 ? ladder : [...DEFAULT_HERMES_FALLBACK_MODELS],
    modelReasoningEffort: next.modelReasoningEffort ?? "xhigh",
    cwd: options?.cwd ?? next.cwd ?? "/Users/nijelhunt_1/workspace/Blueprint-WebApp",
    timeoutSec: next.timeoutSec ?? 1800,
  };
}

export function buildNextHermesFallbackAdapterConfig(
  adapterConfig: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  const currentModel = asTrimmedString(adapterConfig?.model);
  const ladder = resolveHermesFallbackModels(adapterConfig, { includeCurrentModel: false });
  if (ladder.length === 0) {
    return null;
  }

  const routableCurrent =
    currentModel && !isIncompatibleHermesFreeRoutingModel(currentModel) ? currentModel : null;
  const currentIndex = routableCurrent ? ladder.indexOf(routableCurrent) : -1;
  const nextModel = currentIndex >= 0 ? ladder[currentIndex + 1] : ladder[0];
  if (!nextModel || nextModel === currentModel) {
    return null;
  }

  return buildHermesFallbackAdapterConfig(adapterConfig, {
    model: nextModel,
    cwd: asTrimmedString(adapterConfig?.cwd) ?? undefined,
  });
}

export function syncExecutionPolicyToAdapter(
  runtimeConfig: Record<string, unknown> | null | undefined,
  targetAdapterType: LocalQuotaFallbackAdapterType,
): Record<string, unknown> {
  const nextRuntimeConfig = { ...(runtimeConfig ?? {}) };
  const currentExecutionPolicy =
    nextRuntimeConfig.executionPolicy && typeof nextRuntimeConfig.executionPolicy === "object"
      ? nextRuntimeConfig.executionPolicy as Record<string, unknown>
      : {};

  nextRuntimeConfig.executionPolicy = {
    ...currentExecutionPolicy,
    mode:
      currentExecutionPolicy.mode === "fixed" || currentExecutionPolicy.mode === "prefer_available"
        ? currentExecutionPolicy.mode
        : "prefer_available",
    compatibleAdapterTypes: normalizeExecutionPolicyAdapterList(
      currentExecutionPolicy.compatibleAdapterTypes,
      targetAdapterType,
    ),
    preferredAdapterTypes: normalizeExecutionPolicyAdapterList(
      currentExecutionPolicy.preferredAdapterTypes,
      targetAdapterType,
    ),
  };

  return nextRuntimeConfig;
}

function withFallbackOrigin(
  adapterConfig: Record<string, unknown>,
  originAdapterType: LocalQuotaFallbackAdapterType,
): Record<string, unknown> {
  return {
    ...adapterConfig,
    [FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY]: originAdapterType,
  };
}

export function buildLocalQuotaFallbackDescriptor(input: {
  currentAdapterType: string;
  currentAdapterConfig: Record<string, unknown> | null | undefined;
  desiredAdapterType?: string | null;
  desiredAdapterConfig?: Record<string, unknown> | null | undefined;
}): LocalQuotaFallbackDescriptor | null {
  const currentAdapterType = input.currentAdapterType;
  const currentAdapterConfig = input.currentAdapterConfig ?? {};
  const desiredAdapterType = input.desiredAdapterType ?? null;
  const desiredAdapterConfig = input.desiredAdapterConfig ?? currentAdapterConfig;
  const originAdapterType =
    asTrimmedString(currentAdapterConfig[FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY])
    ?? (desiredAdapterType === "hermes_local" ? "hermes_local" : null);

  if (currentAdapterType === "claude_local") {
    if (originAdapterType === "hermes_local") {
      return {
        adapterType: "codex_local",
        reason: "quota_fallback_to_codex_local",
        adapterConfig: withFallbackOrigin(
          buildCodexFallbackAdapterConfig(desiredAdapterConfig, {
            model: "gpt-5.4-mini",
            modelReasoningEffort: "xhigh",
          }),
          "hermes_local",
        ),
      };
    }

    return {
      adapterType: "hermes_local",
      reason: "quota_fallback_to_hermes_free",
      adapterConfig: buildHermesFallbackAdapterConfig(desiredAdapterConfig),
    };
  }

  if (currentAdapterType === "codex_local") {
    if (originAdapterType === "hermes_local") {
      return {
        adapterType: "opencode_local",
        reason: "quota_fallback_to_opencode",
        adapterConfig: withFallbackOrigin(
          buildOpenCodeFallbackAdapterConfig(desiredAdapterConfig, {
            cwd: asTrimmedString(desiredAdapterConfig?.cwd) ?? undefined,
          }),
          "hermes_local",
        ),
      };
    }

    return {
      adapterType: "hermes_local",
      reason: "quota_fallback_to_hermes_free",
      adapterConfig: buildHermesFallbackAdapterConfig(desiredAdapterConfig),
    };
  }

  if (currentAdapterType === "hermes_local") {
    const nextHermesConfig = buildNextHermesFallbackAdapterConfig(currentAdapterConfig);
    if (nextHermesConfig) {
      return {
        adapterType: "hermes_local",
        reason: "quota_fallback_to_next_hermes_free_model",
        adapterConfig: nextHermesConfig,
      };
    }

    if (desiredAdapterType === "hermes_local" || originAdapterType === "hermes_local") {
      return {
        adapterType: "claude_local",
        reason: "quota_fallback_to_claude_local",
        adapterConfig: withFallbackOrigin(
          buildClaudeFallbackAdapterConfig(desiredAdapterConfig),
          "hermes_local",
        ),
      };
    }

    return {
      adapterType: "opencode_local",
      reason: "quota_fallback_to_opencode",
      adapterConfig: buildOpenCodeFallbackAdapterConfig(currentAdapterConfig, {
        cwd: asTrimmedString(currentAdapterConfig.cwd) ?? undefined,
      }),
    };
  }

  if (currentAdapterType === "opencode_local" && originAdapterType === "hermes_local") {
    return null;
  }

  return null;
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
