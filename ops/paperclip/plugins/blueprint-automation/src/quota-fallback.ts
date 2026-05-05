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

export type LocalQuotaFallbackAdapterType = "claude_local" | "codex_local" | "hermes_local";

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

export const DEFAULT_HERMES_FALLBACK_MODEL = "deepseek/deepseek-v4-flash";
export const DEFAULT_HERMES_FALLBACK_MODELS = [
  "deepseek/deepseek-v4-flash",
  "deepseek/deepseek-v4-pro",
] as const;
export const LEGACY_OPENROUTER_HERMES_FALLBACK_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "tencent/hy3-preview:free",
  "minimax/minimax-m2.5:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
  "qwen/qwen3-coder:free",
] as const;
export const HERMES_MODEL_LADDER_CONFIG_KEY = "blueprintHermesModelLadder";
export const FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY = "blueprintFallbackOriginAdapterType";
const DEFAULT_HERMES_DEEPSEEK_PROVIDER = "anthropic";
const DEFAULT_HERMES_DEEPSEEK_BASE_URL = "https://api.deepseek.com/anthropic";
const DEFAULT_HERMES_OPENROUTER_PROVIDER = "openrouter";
export const DEFAULT_HERMES_OPENROUTER_PROVIDER_ORDER = [
  "deepseek",
  "atlas-cloud/fp8",
  "novita",
  "siliconflow/fp8",
] as const;
export const DEFAULT_HERMES_OPENROUTER_PROVIDER_IGNORE = [
  "parasail",
  "parasail/fp8",
  "akashml",
  "akashml/fp8",
  "deepinfra",
  "deepinfra/fp4",
] as const;
const LOCAL_EXECUTION_POLICY_ADAPTERS: LocalQuotaFallbackAdapterType[] = [
  "codex_local",
  "hermes_local",
];

const HERMES_EXECUTION_POLICY_ADAPTERS: LocalQuotaFallbackAdapterType[] = [
  "hermes_local",
  "codex_local",
];

export type LocalQuotaFallbackDescriptor = {
  adapterType: LocalQuotaFallbackAdapterType;
  reason: string;
  adapterConfig: Record<string, unknown>;
};

const QUOTA_OR_RATE_LIMIT_RE =
  /(?:resource_exhausted|quota|rate[-\s]?limit|too many requests|\b429\b|\b402\b|billing details|insufficient credits|spend(?:ing)? limit exceeded|you['’]ve hit your limit|hit your limit|limit[^.\n]*reset)/i;
const PROVIDER_CAPACITY_RE =
  /(?:internalservererror\s*\[http 503\]|http\s+503:\s*provider returned error|provider returned error|model_execution_failed)/i;
const PROVIDER_CREDIT_RE =
  /(?:\b402\b|insufficient credits|api key usd spend limit exceeded|usd spend(?:ing)? limit exceeded|spend(?:ing)? limit exceeded|hit your usage limit|hit your limit[^.\n]*purchase)/i;
const MODEL_NOT_FOUND_RE = /model.*not.*found|model.*404|invalid.*model|unknown.*model|gpt-5-4-mini|http.*404|not_found_error/i;
const FRESH_SESSION_RETRYABLE_RE =
  /(?:context window|ran out of room|clear earlier history|start a new thread|max[_ ]output[_ ]tokens|incomplete response returned|stream disconnected before completion)/i;
const PROVIDER_TIMEOUT_RE =
  /(?:timed out while running|^\s*timed out\s*$|provider=.*openrouter|via openrouter|request timed out|deadline exceeded)/i;
const PROCESS_LOSS_RE =
  /(?:process lost --|child pid .* no longer running|server may have restarted)/i;
const PROVIDER_AUTH_RE =
  /(?:unauthorized|forbidden|auth(?:entication)?(?:orization)?[^.\n]*failed|failed to authenticate|invalid api key|invalid authentication credentials|missing api key|login is required|not logged in|authentication_error)/i;
const CLAUDE_PROVIDER_RE =
  /(?:claude run failed.*failed to authenticate|api error: 401.*authentication_error|invalid authentication credentials)/i;
const DISALLOWED_HERMES_FALLBACK_MODEL_RE =
  /^(?:openrouter\/free|(?:openrouter\/)?arcee-ai\/trinity-large-preview(?::free)?|(?:openrouter\/)?nvidia\/nemotron-3-super(?::free)?|(?:openrouter\/)?(?:qwen\/)?qwen3\.6-plus(?:-preview)?(?::free)?|(?:openrouter\/)?inclusionai\/ling-2\.6-(?:flash|1t)(?::free)?|(?:openrouter\/)?stepfun\/step-3\.5-flash(?::free)?)$/i;
const OPENROUTER_SHARED_FREE_POOL_LIMIT_RE =
  /(?:free-models-per-(?:min|day(?:-high-balance)?)|limit_rpm\/[^\s]+|high demand for [^.\n]+:free on openrouter|limited to \d+ requests per minute)/i;
const TERMINAL_LOGICAL_FAILURE_PATTERNS = [
  /api call failed after \d+ retries:\s*(http \d+:[^\n]+)/i,
  /final error:\s*(http \d+:[^\n]+)/i,
  /http 404:\s*no endpoints found for[^\n]+/i,
  /rate limit exceeded:[^\n]+/i,
] as const;
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
  return QUOTA_OR_RATE_LIMIT_RE.test(message) || PROVIDER_CAPACITY_RE.test(message);
}

export function isProviderCreditFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return PROVIDER_CREDIT_RE.test(message);
}

export function isSharedOpenRouterFreePoolRateLimitFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return OPENROUTER_SHARED_FREE_POOL_LIMIT_RE.test(message);
}

export function isModelNotFoundFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return MODEL_NOT_FOUND_RE.test(message);
}

export function isFreshSessionRetryableFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return FRESH_SESSION_RETRYABLE_RE.test(message);
}

export function isProviderTimeoutFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return PROVIDER_TIMEOUT_RE.test(message);
}

export function isProcessLossFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return PROCESS_LOSS_RE.test(message);
}

export function isProviderAuthFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return PROVIDER_AUTH_RE.test(message);
}

export function isClaudeProviderAuthFailure(message: string | null | undefined): boolean {
  if (!message) return false;
  return PROVIDER_AUTH_RE.test(message) && CLAUDE_PROVIDER_RE.test(message);
}

export function extractLogicalSucceededRunFailure(message: string | null | undefined): string | null {
  if (!message) return null;
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  for (const pattern of TERMINAL_LOGICAL_FAILURE_PATTERNS) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const candidate = (match[1] ?? match[0] ?? "").replace(/\s+/g, " ").trim();
    if (
      isQuotaOrRateLimitFailure(candidate) ||
      isProviderAuthFailure(candidate) ||
      isProviderCreditFailure(candidate) ||
      isModelNotFoundFailure(candidate)
    ) {
      return candidate;
    }
  }

  if (
    isQuotaOrRateLimitFailure(normalized) ||
    isProviderAuthFailure(normalized) ||
    isProviderCreditFailure(normalized) ||
    isModelNotFoundFailure(normalized)
  ) {
    return normalized.slice(0, 400);
  }

  return null;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseEnvList(envKey: string, fallback: readonly string[]): string[] {
  const raw = process.env[envKey];
  if (!raw || raw.trim().length === 0) return [...fallback];
  const parsed = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return parsed.length > 0 ? parsed : [...fallback];
}

function parseEnvBoolean(envKey: string, fallback: boolean): boolean {
  const raw = process.env[envKey];
  if (!raw || raw.trim().length === 0) return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

export function buildOpenRouterProviderRouting(): Record<string, unknown> {
  const order = parseEnvList(
    "BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_ORDER",
    DEFAULT_HERMES_OPENROUTER_PROVIDER_ORDER,
  );
  return {
    only: parseEnvList("BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_ONLY", order),
    order,
    ignore: parseEnvList(
      "BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_PROVIDER_IGNORE",
      DEFAULT_HERMES_OPENROUTER_PROVIDER_IGNORE,
    ),
    allow_fallbacks: parseEnvBoolean(
      "BLUEPRINT_PAPERCLIP_HERMES_OPENROUTER_ALLOW_FALLBACKS",
      true,
    ),
  };
}

function withOpenRouterProviderEnv(existingEnv: Record<string, unknown>, routing: Record<string, unknown>) {
  const only = Array.isArray(routing.only) ? routing.only.filter((entry): entry is string => typeof entry === "string") : [];
  const order = Array.isArray(routing.order) ? routing.order.filter((entry): entry is string => typeof entry === "string") : [];
  const ignore = Array.isArray(routing.ignore) ? routing.ignore.filter((entry): entry is string => typeof entry === "string") : [];
  return {
    ...existingEnv,
    OPENROUTER_PROVIDER_ONLY: only.join(","),
    OPENROUTER_PROVIDER_ORDER: order.join(","),
    OPENROUTER_PROVIDER_IGNORE: ignore.join(","),
    OPENROUTER_ALLOW_FALLBACKS: routing.allow_fallbacks === false ? "0" : "1",
  };
}

function arePaidHermesModelsAllowed(): boolean {
  return /^(1|true|yes)$/i.test(process.env.BLUEPRINT_PAPERCLIP_HERMES_ALLOW_PAID_MODELS ?? "");
}

function shouldIncludeLegacyOpenRouterHermesFallbacks(): boolean {
  return /^(1|true|yes)$/i.test(
    process.env.BLUEPRINT_PAPERCLIP_HERMES_INCLUDE_OPENROUTER_FALLBACKS ?? "",
  );
}

function isHermesDeepSeekDirectModel(model: string | null | undefined): boolean {
  const trimmed = (model ?? "").trim().toLowerCase();
  return /^deepseek-v4-(?:flash|pro)(?:\[[^\]]+\])?$/.test(trimmed)
    || trimmed === "deepseek-chat"
    || trimmed === "deepseek-reasoner";
}

function isHermesOpenRouterDeepSeekModel(model: string | null | undefined): boolean {
  const trimmed = (model ?? "").trim().toLowerCase();
  return /^deepseek\/deepseek-v4-(?:flash|pro)$/.test(trimmed);
}

function isHermesFreeRoutingModel(model: string | null | undefined): boolean {
  const trimmed = (model ?? "").trim().toLowerCase();
  return trimmed.endsWith(":free");
}

function isApprovedHermesRoutingModel(model: string | null | undefined): boolean {
  return isHermesOpenRouterDeepSeekModel(model)
    || isHermesDeepSeekDirectModel(model)
    || (shouldIncludeLegacyOpenRouterHermesFallbacks() && isHermesFreeRoutingModel(model))
    || arePaidHermesModelsAllowed();
}

function providerForHermesModel(model: string): string {
  if (isHermesOpenRouterDeepSeekModel(model)) {
    return DEFAULT_HERMES_OPENROUTER_PROVIDER;
  }
  if (isHermesDeepSeekDirectModel(model)) {
    const configuredProvider = process.env.BLUEPRINT_PAPERCLIP_HERMES_PROVIDER?.trim();
    return configuredProvider && configuredProvider.toLowerCase() !== DEFAULT_HERMES_OPENROUTER_PROVIDER
      ? configuredProvider
      : DEFAULT_HERMES_DEEPSEEK_PROVIDER;
  }
  return DEFAULT_HERMES_OPENROUTER_PROVIDER;
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
  const defaultAdapters =
    targetAdapterType === "hermes_local"
      ? HERMES_EXECUTION_POLICY_ADAPTERS
      : LOCAL_EXECUTION_POLICY_ADAPTERS;
  const source = Array.isArray(values) && values.length > 0
    ? values
    : defaultAdapters;
  const normalized: LocalQuotaFallbackAdapterType[] = [];
  const seen = new Set<LocalQuotaFallbackAdapterType>();

  for (const candidate of [targetAdapterType, ...source, ...defaultAdapters]) {
    if (
      candidate !== "codex_local" &&
      candidate !== "hermes_local"
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

export function isDisallowedHermesFallbackModel(model: string | null | undefined): boolean {
  const m = (model ?? "").trim();
  if (!m) return false;
  return DISALLOWED_HERMES_FALLBACK_MODEL_RE.test(m);
}

function filterCompatibleHermesLadderModels(models: string[]): string[] {
  return models.filter(
    (id) =>
      !isIncompatibleHermesFreeRoutingModel(id)
      && !isDisallowedHermesFallbackModel(id)
      && isApprovedHermesRoutingModel(id),
  );
}

function readApprovedHermesEnvModel(envKey: string): string | null {
  const raw = asTrimmedString(process.env[envKey]);
  return raw
    && !isIncompatibleHermesFreeRoutingModel(raw)
    && !isDisallowedHermesFallbackModel(raw)
    && isApprovedHermesRoutingModel(raw)
    ? raw
    : null;
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
  const envPrimaryModel = readApprovedHermesEnvModel("BLUEPRINT_PAPERCLIP_HERMES_PRIMARY_MODEL");
  const envFallbackModel = readApprovedHermesEnvModel("BLUEPRINT_PAPERCLIP_HERMES_FALLBACK_MODEL");

  const includeCurrent =
    includeCurrentModel
    && currentModel
    && !isIncompatibleHermesFreeRoutingModel(currentModel)
    && isApprovedHermesRoutingModel(currentModel);

  return normalizeModelList([
    ...(includeCurrent ? [currentModel] : []),
    ...configuredLadder,
    ...envLadder,
    ...(envPrimaryModel ? [envPrimaryModel] : []),
    ...(envFallbackModel ? [envFallbackModel] : []),
    ...DEFAULT_HERMES_FALLBACK_MODELS,
    ...(shouldIncludeLegacyOpenRouterHermesFallbacks()
      ? LEGACY_OPENROUTER_HERMES_FALLBACK_MODELS
      : []),
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
    modelReasoningEffort: options?.modelReasoningEffort ?? "medium",
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
  delete next.provider;
  delete next.base_url;
  delete next.baseUrl;
  delete next.api_key;
  delete next.api_key_env;
  const ladder = resolveHermesFallbackModels(adapterConfig, { includeCurrentModel: false });
  const optionModel = asTrimmedString(options?.model as string | undefined);
  const chosen =
    optionModel
      && !isIncompatibleHermesFreeRoutingModel(optionModel)
      && !isDisallowedHermesFallbackModel(optionModel)
      && isApprovedHermesRoutingModel(optionModel)
      ? optionModel
      : null;
  const configuredModel = asTrimmedString(adapterConfig?.model);
  const configured =
    configuredModel
      && !isIncompatibleHermesFreeRoutingModel(configuredModel)
      && !isDisallowedHermesFallbackModel(configuredModel)
      && isApprovedHermesRoutingModel(configuredModel)
      ? configuredModel
      : null;
  const envPrimary = readApprovedHermesEnvModel("BLUEPRINT_PAPERCLIP_HERMES_PRIMARY_MODEL");
  const model =
    chosen
    ?? configured
    ?? envPrimary
    ?? ladder[0]
    ?? DEFAULT_HERMES_FALLBACK_MODEL;
  const provider = providerForHermesModel(model);
  const existingEnv =
    next.env && typeof next.env === "object" && !Array.isArray(next.env)
      ? next.env as Record<string, unknown>
      : {};
  const openRouterProviderRouting =
    provider === DEFAULT_HERMES_OPENROUTER_PROVIDER ? buildOpenRouterProviderRouting() : null;
  const hermesEnv = provider === DEFAULT_HERMES_DEEPSEEK_PROVIDER
    ? {
        ...existingEnv,
        ANTHROPIC_BASE_URL:
          process.env.BLUEPRINT_PAPERCLIP_HERMES_BASE_URL?.trim()
          || DEFAULT_HERMES_DEEPSEEK_BASE_URL,
      }
    : openRouterProviderRouting
      ? withOpenRouterProviderEnv(existingEnv, openRouterProviderRouting)
    : existingEnv;

  return {
    ...next,
    provider,
    model,
    [HERMES_MODEL_LADDER_CONFIG_KEY]: ladder.length > 0 ? ladder : [...DEFAULT_HERMES_FALLBACK_MODELS],
    ...(openRouterProviderRouting
      ? {
          providerRouting: openRouterProviderRouting,
          openrouterProviderRouting: openRouterProviderRouting,
          openrouterProviderStrategy: "cache_read_cost_primary_avoid_parasail",
        }
      : {}),
    modelReasoningEffort: next.modelReasoningEffort ?? "max",
    ...(Object.keys(hermesEnv).length > 0 ? { env: hermesEnv } : {}),
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
    currentModel
    && !isIncompatibleHermesFreeRoutingModel(currentModel)
    && !isDisallowedHermesFallbackModel(currentModel)
    && isApprovedHermesRoutingModel(currentModel)
      ? currentModel
      : null;
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
  const currentPerAdapterConfig = currentExecutionPolicy.perAdapterConfig
    && typeof currentExecutionPolicy.perAdapterConfig === "object"
      ? currentExecutionPolicy.perAdapterConfig as Record<string, unknown>
      : {};
  const normalizedPerAdapterConfig = Object.fromEntries(
    Object.entries(currentPerAdapterConfig)
      .filter((entry): entry is [string, Record<string, unknown>] =>
        typeof entry[1] === "object" && entry[1] !== null && !Array.isArray(entry[1]),
      )
      .map(([adapterType, config]) => {
        if (adapterType !== "hermes_local") {
          return [adapterType, config];
        }
        return [adapterType, buildHermesFallbackAdapterConfig(config)];
      }),
  );

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
    ...(Object.keys(normalizedPerAdapterConfig).length > 0
      ? { perAdapterConfig: normalizedPerAdapterConfig }
      : {}),
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
  failureReason?: string | null;
}): LocalQuotaFallbackDescriptor | null {
  const currentAdapterType = input.currentAdapterType;
  const currentAdapterConfig = input.currentAdapterConfig ?? {};
  const desiredAdapterType = input.desiredAdapterType ?? null;
  const desiredAdapterConfig = input.desiredAdapterConfig ?? currentAdapterConfig;
  const failureReason = input.failureReason ?? null;
  const originAdapterType =
    asTrimmedString(currentAdapterConfig[FALLBACK_ORIGIN_ADAPTER_CONFIG_KEY])
    ?? (desiredAdapterType === "hermes_local" ? "hermes_local" : null);

  if (currentAdapterType === "claude_local") {
    if (isProviderAuthFailure(failureReason)) {
      return {
        adapterType: "hermes_local",
        reason: "quota_fallback_to_hermes_free_after_claude_auth_failure",
        adapterConfig: buildHermesFallbackAdapterConfig(desiredAdapterConfig),
      };
    }

    if (originAdapterType === "hermes_local") {
      return {
        adapterType: "codex_local",
        reason: "quota_fallback_to_codex_local",
        adapterConfig: withFallbackOrigin(
          buildCodexFallbackAdapterConfig(desiredAdapterConfig, {
            model: "gpt-5.4-mini",
            modelReasoningEffort: "medium",
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
    if (isProviderAuthFailure(failureReason) && originAdapterType !== "hermes_local") {
      return {
        adapterType: "hermes_local",
        reason: "quota_fallback_to_hermes_free_after_codex_auth_failure",
        adapterConfig: buildHermesFallbackAdapterConfig(desiredAdapterConfig),
      };
    }

    if (originAdapterType === "hermes_local") {
      if (isProviderAuthFailure(failureReason)) {
        return null;
      }
      const nextHermesConfig = buildNextHermesFallbackAdapterConfig(
        buildHermesFallbackAdapterConfig(desiredAdapterConfig),
      );
      if (nextHermesConfig) {
        return {
          adapterType: "hermes_local",
          reason: "quota_fallback_to_next_hermes_free_model_after_codex_credit_exhaustion",
          adapterConfig: nextHermesConfig,
        };
      }
      return null;
    }

    return {
      adapterType: "hermes_local",
      reason: "quota_fallback_to_hermes_free",
      adapterConfig: buildHermesFallbackAdapterConfig(desiredAdapterConfig),
    };
  }

  if (currentAdapterType === "hermes_local") {
    if (isProviderAuthFailure(failureReason)) {
      const rebuiltHermesConfig = buildHermesFallbackAdapterConfig(desiredAdapterConfig);
      if (
        asTrimmedString(rebuiltHermesConfig.provider) === "openrouter"
        && !isIncompatibleHermesFreeRoutingModel(asTrimmedString(rebuiltHermesConfig.model))
      ) {
        return {
          adapterType: "hermes_local",
          reason: "quota_fallback_to_hermes_openrouter_after_provider_auth_failure",
          adapterConfig: rebuiltHermesConfig,
        };
      }
      return {
        adapterType: "codex_local",
        reason: "quota_fallback_to_codex_local_after_provider_auth_failure",
        adapterConfig: withFallbackOrigin(
          buildCodexFallbackAdapterConfig(desiredAdapterConfig, {
            model: "gpt-5.4-mini",
            modelReasoningEffort: "medium",
          }),
          "hermes_local",
        ),
      };
    }

    if (isSharedOpenRouterFreePoolRateLimitFailure(failureReason)) {
      return {
        adapterType: "codex_local",
        reason: "quota_fallback_to_codex_local_after_shared_openrouter_free_pool_limit",
        adapterConfig: withFallbackOrigin(
          buildCodexFallbackAdapterConfig(desiredAdapterConfig, {
            model: "gpt-5.4-mini",
            modelReasoningEffort: "medium",
          }),
          "hermes_local",
        ),
      };
    }

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
        adapterType: "codex_local",
        reason: "quota_fallback_to_codex_local",
        adapterConfig: withFallbackOrigin(
          buildCodexFallbackAdapterConfig(desiredAdapterConfig, {
            model: "gpt-5.4-mini",
            modelReasoningEffort: "medium",
          }),
          "hermes_local",
        ),
      };
    }

    if (desiredAdapterType === "claude_local") {
      return {
        adapterType: "codex_local",
        reason: "quota_fallback_to_codex_local",
        adapterConfig: withFallbackOrigin(
          buildCodexFallbackAdapterConfig(desiredAdapterConfig, {
            model: "gpt-5.4-mini",
            modelReasoningEffort: "medium",
          }),
          "hermes_local",
        ),
      };
    }

    return {
      adapterType: "codex_local",
      reason: "quota_fallback_to_codex_local",
      adapterConfig: withFallbackOrigin(
        buildCodexFallbackAdapterConfig(desiredAdapterConfig, {
          model: "gpt-5.4-mini",
          modelReasoningEffort: "medium",
        }),
        "hermes_local",
      ),
    };
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

export function upsertWorkspaceAdapterCooldownState(
  state: WorkspaceAdapterCooldownState,
  record: WorkspaceAdapterCooldownRecord,
): WorkspaceAdapterCooldownState {
  const nextState: WorkspaceAdapterCooldownState = {};

  for (const [key, value] of Object.entries(state)) {
    if (value.workspaceKey === record.workspaceKey) {
      continue;
    }
    nextState[key] = value;
  }

  nextState[getWorkspaceAdapterCooldownKey(record.workspaceKey, record.unavailableAdapterType)] = record;
  return nextState;
}

export function inferFailedLocalAdapterType(input: {
  currentAdapterType: string | null | undefined;
  error?: string | null | undefined;
  wakeReason?: string | null | undefined;
  resultJson?: Record<string, unknown> | null | undefined;
}): LocalQuotaFallbackAdapterType | null {
  const wakeReason = (input.wakeReason ?? "").trim().toLowerCase();
  if (wakeReason === "quota_fallback_to_hermes_free" || wakeReason === "quota_fallback_to_next_hermes_free_model" || wakeReason === "quota_fallback_to_hermes_openrouter_after_provider_auth_failure") {
    return "hermes_local";
  }
  if (
    wakeReason === "quota_fallback_to_codex_local"
    || wakeReason === "quota_fallback_to_codex_local_after_provider_credit_failure"
    || wakeReason === "quota_fallback_to_codex_local_after_shared_openrouter_free_pool_limit"
  ) {
    return "codex_local";
  }

  const resultJson = input.resultJson ?? null;
  const attemptedModels = Array.isArray(resultJson?.attempted_models) ? resultJson.attempted_models : [];
  const failedAttempts = Array.isArray(resultJson?.failed_attempts) ? resultJson.failed_attempts : [];
  if (attemptedModels.length > 0 || failedAttempts.length > 0) {
    return "hermes_local";
  }

  const error = (input.error ?? "").trim();
  if (error.length > 0) {
    if (/provider:\s*openrouter/i.test(error) && /model:\s*[^\\n]+:free/i.test(error)) {
      return "hermes_local";
    }
    if (/hermes timed out while running/i.test(error) || /via openrouter/i.test(error)) {
      return "hermes_local";
    }
  }

  if (
    input.currentAdapterType === "claude_local"
    || input.currentAdapterType === "codex_local"
    || input.currentAdapterType === "hermes_local"
  ) {
    return input.currentAdapterType;
  }

  return null;
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

export function hasQuotaFallbackRetryForTask(
  state: QuotaFallbackRetryState | null | undefined,
  taskKey: string | null | undefined,
): boolean {
  const normalizedTaskKey = asTrimmedString(taskKey);
  if (!normalizedTaskKey || !state) {
    return false;
  }

  return Object.values(state).some((record) => {
    if (!record || record.status === "skipped") {
      return false;
    }
    return asTrimmedString(record.taskKey) === normalizedTaskKey;
  });
}
