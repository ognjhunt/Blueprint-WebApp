import type { AgentTaskKind } from "../agents/types";
import { pricingForOpenAIModel } from "./openaiPromptCache";

export type AgentTelemetryRun = {
  id?: string | null;
  session_id?: string | null;
  task_kind?: string | null;
  provider?: string | null;
  model?: string | null;
  status?: string | null;
  artifacts?: Record<string, unknown> | null;
  logs?: Array<Record<string, unknown>> | null;
  metadata?: Record<string, unknown> | null;
  output?: unknown;
  input?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  agent_evidence_ref?: unknown;
  agent_evidence_accounting_sha256?: unknown;
  agent_evidence_accounting_identity?: unknown;
  agent_accounting_incomplete?: unknown;
};

export type AgentTelemetrySummaryRow = {
  task_kind: string;
  provider: string;
  route: string;
  model: string;
  provider_route: string;
  calls: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cached_tokens: number | null;
  cache_write_tokens: number | null;
  reasoning_tokens: number | null;
  uncached_input_tokens: number | null;
  cost_usd: number | null;
  uncached_input_cost_usd: number | null;
  cache_write_cost_usd: number | null;
  cached_read_cost_usd: number | null;
  output_cost_usd: number | null;
  estimated_cost_without_caching_usd: number | null;
  estimated_savings_usd: number | null;
  cache_hit_ratio: number | null;
  cache_family: string;
  prompt_contract_version: string;
  processing_region: string;
  cache_decision: string;
};

export type AgentCostTelemetryRecord = {
  run_id: string | null;
  session_id: string | null;
  issue_id: string | null;
  agent_key: string;
  task_kind: string;
  provider: string;
  route: string;
  model: string;
  upstream_provider: string;
  provider_route: string;
  calls: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cached_tokens: number | null;
  cache_write_tokens: number | null;
  reasoning_tokens: number | null;
  uncached_input_tokens: number | null;
  cost_usd: number | null;
  cost_estimate_usd: number | null;
  uncached_input_cost_usd: number | null;
  cache_write_cost_usd: number | null;
  cached_read_cost_usd: number | null;
  output_cost_usd: number | null;
  estimated_cost_without_caching_usd: number | null;
  estimated_savings_usd: number | null;
  cache_hit_ratio: number | null;
  cache_family: string;
  cache_key_digest: string | null;
  prompt_contract_version: string;
  stable_prefix_digest: string | null;
  privacy_scope: string;
  processing_region: string;
  cache_decision: string;
  cache_decision_reason: string;
  reusable_prefix_tokens: number;
  dynamic_suffix_tokens: number | null;
  usage_detail_status: string;
  cost_status: string;
  provider_response_id: string | null;
  known_usage_subtotals?: Record<string, number>;
  conservative_spend_usd?: number | null;
  spend_reservation?: { known_reported_cost_usd: number; unknown_usage_reserved_cost_usd: number;
    projected_max_cost_per_call_usd: number; unknown_calls: number; reserved_max_costs_usd?: number[] } | null;
  spend_accounting_status?: "complete" | "reserved_unknown" | "unresolved";
  created_at_ms: number | null;
};

export type AgentWasteSignalRow = {
  signal:
    | "low_cache_high_prompt"
    | "no_change_completed"
    | "duplicate_suppressed"
    | "CACHE_WRITE_WITHOUT_REUSE"
    | "RUN_SCOPED_CACHE_KEY_FRAGMENTATION"
    | "DYNAMIC_CONTENT_BEFORE_BREAKPOINT"
    | "CACHE_CONTRACT_CHURN"
    | "MODEL_PRICING_UNKNOWN"
    | "USAGE_DETAIL_MISSING";
  runs: number;
  prompt_tokens: number | null;
  cached_tokens: number | null;
  cache_write_tokens: number | null;
  cost_estimate_usd: number | null;
  run_ids: string[];
  recommendation: string;
};

export type AgentCostWasteSummary = {
  totals: {
    runs: number;
    calls: number;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    cached_tokens: number | null;
    cache_write_tokens: number | null;
    cache_hit_ratio: number | null;
    write_to_read_ratio: number | null;
    cache_families: number;
    cache_families_with_writes_without_reads: number;
    cost_estimate_usd: number | null;
    estimated_cost_without_caching_usd: number | null;
    estimated_savings_usd: number | null;
  };
  signals: AgentWasteSignalRow[];
  top_prompt_rows: AgentTelemetrySummaryRow[];
  recommendations: string[];
};

type SpendWindowKey = "last15m" | "lastHour" | "lastDay";

export type AgentSpendWindow = {
  runs: number;
  cost_usd: number;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cached_tokens: number | null;
  status: "ok" | "warn" | "stop";
};

export type AgentSpendThresholds = Partial<Record<SpendWindowKey, number>>;

const SPEND_WINDOWS: Record<SpendWindowKey, number> = {
  last15m: 15 * 60 * 1000,
  lastHour: 60 * 60 * 1000,
  lastDay: 24 * 60 * 60 * 1000,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function optionalNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function asString(value: unknown, fallback = "unknown") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

function asNullableString(value: unknown) {
  const text = asString(value, "");
  return text || null;
}

function asTimestampMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  const record = asRecord(value);
  if (!record) return null;
  if (typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  const seconds = asNumber(record.seconds ?? record._seconds, Number.NaN);
  if (Number.isFinite(seconds)) {
    return seconds * 1000 + asNumber(record.nanoseconds ?? record._nanoseconds, 0) / 1_000_000;
  }
  return null;
}

function inferRoute(run: AgentTelemetryRun, artifacts: Record<string, unknown>) {
  const explicit = asString(artifacts.route, "");
  if (explicit) return explicit;
  const model = asString(artifacts.openrouter_model ?? run.model, "");
  if (/^deepseek\//i.test(model)) return "deepseek_via_openrouter";
  if (run.provider === "deepseek_chat" || /^deepseek/i.test(model)) {
    return "deepseek_official_direct";
  }
  return asString(run.provider, "unknown");
}

function readProviderRoute(artifacts: Record<string, unknown>) {
  const direct = asString(artifacts.openrouter_provider ?? artifacts.provider_route, "");
  if (direct) return direct;
  const providerRouting =
    asRecord(artifacts.openrouter_provider_routing) ||
    asRecord(artifacts.openrouter_provider_preferences);
  const order = providerRouting?.order;
  return Array.isArray(order) ? order.map((entry) => String(entry)).join(">") : "unknown";
}

function readUpstreamProvider(artifacts: Record<string, unknown>) {
  return asString(
    artifacts.openrouter_provider
      ?? artifacts.upstream_provider
      ?? artifacts.provider_route,
    "unknown",
  );
}

function usageSourceFromLogs(run: AgentTelemetryRun) {
  const logs = Array.isArray(run.logs) ? run.logs : [];
  const aggregateLog = logs.find((log) => log.event_type === "provider.telemetry.aggregated");
  const aggregateUsage = flattenUsageCounters(aggregateLog?.usage);
  if (Object.keys(aggregateUsage).length > 0) return aggregateUsage;
  const responseUsages = logs
    .filter((log) => log.event_type === "provider.response.created")
    .map((log) => flattenUsageCounters(log.usage))
    .filter((usage) => Object.keys(usage).length > 0);
  if (responseUsages.length === 0) return {};
  return responseUsages.reduce<Record<string, unknown>>((acc, usage) => {
    for (const key of [
      "prompt_tokens",
      "completion_tokens",
      "total_tokens",
      "prompt_cache_hit_tokens",
      "prompt_cache_miss_tokens",
      "cached_tokens",
      "cache_write_tokens",
      "reasoning_tokens",
      "cost_usd",
      "uncached_input_cost_usd",
      "cache_write_cost_usd",
      "cached_read_cost_usd",
      "output_cost_usd",
      "estimated_total_cost_usd",
      "estimated_cost_without_caching_usd",
      "estimated_savings_usd",
    ]) {
      acc[key] = asNumber(acc[key]) + asNumber(usage[key]);
    }
    return acc;
  }, {});
}

function assignUsageNumber(
  target: Record<string, unknown>,
  key: string,
  value: number | undefined,
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    target[key] = value;
  }
}

function flattenUsageCounters(value: unknown): Record<string, unknown> {
  const usage = asRecord(value);
  if (!usage) return {};
  const promptDetails =
    asRecord(usage.prompt_tokens_details) || asRecord(usage.input_tokens_details);
  const completionDetails =
    asRecord(usage.completion_tokens_details) || asRecord(usage.output_tokens_details);
  const costDetails = asRecord(usage.cost_details);
  const promptTokens = optionalNumber(usage.prompt_tokens, usage.input_tokens);
  const completionTokens = optionalNumber(usage.completion_tokens, usage.output_tokens);
  const totalTokens = optionalNumber(
    usage.total_tokens,
    promptTokens !== undefined || completionTokens !== undefined
      ? (promptTokens ?? 0) + (completionTokens ?? 0)
      : undefined,
  );
  const directHitTokens = optionalNumber(
    usage.prompt_cache_hit_tokens,
    usage.cache_hit_tokens,
  );
  const cachedTokens = optionalNumber(
    promptDetails?.cached_tokens,
    promptDetails?.cache_hit_tokens,
    usage.cached_tokens,
    usage.cached_input_tokens,
    directHitTokens,
  );
  const missTokens = optionalNumber(
    usage.prompt_cache_miss_tokens,
    promptDetails?.cache_miss_tokens,
    promptTokens !== undefined && cachedTokens !== undefined
      ? Math.max(promptTokens - cachedTokens, 0)
      : undefined,
  );
  const result: Record<string, unknown> = {};

  assignUsageNumber(result, "calls", optionalNumber(usage.calls));
  assignUsageNumber(result, "prompt_tokens", promptTokens);
  assignUsageNumber(result, "completion_tokens", completionTokens);
  assignUsageNumber(result, "total_tokens", totalTokens);
  assignUsageNumber(result, "prompt_cache_hit_tokens", directHitTokens ?? cachedTokens);
  assignUsageNumber(result, "prompt_cache_miss_tokens", missTokens);
  assignUsageNumber(result, "cached_tokens", cachedTokens);
  assignUsageNumber(
    result,
    "cache_write_tokens",
    optionalNumber(promptDetails?.cache_write_tokens, usage.cache_write_tokens),
  );
  for (const key of [
    "uncached_input_cost_usd",
    "cache_write_cost_usd",
    "cached_read_cost_usd",
    "output_cost_usd",
    "estimated_total_cost_usd",
    "estimated_cost_without_caching_usd",
    "estimated_savings_usd",
  ]) {
    assignUsageNumber(result, key, optionalNumber(usage[key]));
  }
  if (typeof usage.cost_status === "string") result.cost_status = usage.cost_status;
  assignUsageNumber(
    result,
    "reasoning_tokens",
    optionalNumber(completionDetails?.reasoning_tokens, usage.reasoning_tokens),
  );
  assignUsageNumber(
    result,
    "cost_usd",
    optionalNumber(
      usage.cost_usd,
      usage.cost,
      usage.costUsd,
      costDetails?.total_cost_usd,
      costDetails?.total_cost,
      costDetails?.cost_usd,
    ),
  );

  return result;
}

function usageSourceFromArtifacts(artifacts: Record<string, unknown>) {
  return [
    artifacts.usage,
    artifacts.openrouter_usage,
    artifacts.provider_usage,
    artifacts.raw_usage,
  ].reduce<Record<string, unknown>>(
    (acc, value) => ({ ...acc, ...flattenUsageCounters(value) }),
    {},
  );
}

function hasRuntimeSuppression(run: AgentTelemetryRun) {
  const metadata = asRecord(run.metadata);
  const artifacts = asRecord(run.artifacts);
  return Boolean(
    asRecord(metadata?.runtime_suppression) ||
      asRecord(artifacts?.runtime_suppression),
  );
}

function readUsageArtifacts(run: AgentTelemetryRun) {
  const artifacts = asRecord(run.artifacts) || {};
  const cachePolicy = asRecord(artifacts.cache_policy) || {};
  const artifactUsage = usageSourceFromArtifacts(artifacts);
  const usageFallback = usageSourceFromLogs(run);
  const rawUsageSources = [artifacts.usage, artifacts.openrouter_usage, artifacts.provider_usage, artifacts.raw_usage].map(asRecord);
  const aggregateLog = run.logs?.find(log => log.event_type === "provider.telemetry.aggregated");
  const aliases: Record<string, string[]> = { prompt_tokens: ["prompt_tokens", "input_tokens"],
    completion_tokens: ["completion_tokens", "output_tokens"], cost_usd: ["cost_usd", "cost", "costUsd"] };
  const usageValue = (key: string) => {
    for (const source of [artifacts, ...rawUsageSources, asRecord(aggregateLog?.usage)]) {
      for (const name of aliases[key] ?? [key]) {
        if (source && Object.prototype.hasOwnProperty.call(source, name)) return source[name];
      }
      const details = key === "cached_tokens" || key === "cache_write_tokens"
        ? [asRecord(source?.prompt_tokens_details), asRecord(source?.input_tokens_details)]
        : key === "reasoning_tokens" ? [asRecord(source?.completion_tokens_details), asRecord(source?.output_tokens_details)] : [];
      for (const detail of details) {
        if (detail && Object.prototype.hasOwnProperty.call(detail, key)) return detail[key];
      }
    }
    return artifactUsage[key] ?? usageFallback[key];
  };
  const usageNumber = (key: string, fallback: number | null = 0): number | null =>
    usageValue(key) === null ? null : optionalNumber(usageValue(key)) ?? fallback;
  const promptTokens = usageNumber("prompt_tokens");
  const directHitTokens = usageNumber("prompt_cache_hit_tokens");
  const cachedTokens = usageNumber("cached_tokens", directHitTokens);
  const cacheWriteTokens = usageNumber("cache_write_tokens");
  const uncachedInputTokens = usageNumber("uncached_input_tokens",
    promptTokens !== null && cachedTokens !== null && cacheWriteTokens !== null
      ? Math.max(0, promptTokens - cachedTokens - cacheWriteTokens) : null);
  const completionTokens = usageNumber("completion_tokens");
  const callsValue = usageValue("calls");
  return {
    task_kind: asString(run.task_kind, "unknown") as AgentTaskKind | "unknown",
    provider: asString(run.provider, "unknown"),
    route: inferRoute(run, artifacts),
    model: asString(artifacts.openrouter_model ?? run.model, "unknown"),
    provider_route: readProviderRoute(artifacts),
    calls:
      callsValue === undefined || callsValue === null
        ? hasRuntimeSuppression(run)
          ? 0
          : 1
        : Math.max(0, Math.floor(asNumber(callsValue))),
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: usageNumber("total_tokens", promptTokens !== null && completionTokens !== null
      ? promptTokens + completionTokens : null),
    cached_tokens: cachedTokens,
    cache_write_tokens: cacheWriteTokens,
    uncached_input_tokens: uncachedInputTokens,
    reasoning_tokens: usageNumber("reasoning_tokens"),
    cost_usd: usageNumber("cost_usd", artifacts.cost_status === "usage_partial" || artifacts.cost_status === "usage_missing" ? null : 0),
    cost_explicitly_unknown: usageValue("estimated_total_cost_usd") === null
      || ["prompt_tokens", "completion_tokens", "cached_tokens", "cache_write_tokens", "uncached_input_tokens"]
        .some(key => usageValue(key) === null),
    raw_cost_components: Object.fromEntries(["uncached_input_cost_usd", "cache_write_cost_usd", "cached_read_cost_usd", "output_cost_usd",
      "estimated_cost_without_caching_usd", "estimated_savings_usd"].map(key => [key, usageValue(key)])),
    cache_family: asString(artifacts.cache_family ?? cachePolicy.family, "unclassified"),
    cache_key_digest: asNullableString(
      artifacts.cache_key_digest ?? cachePolicy.cache_key_digest,
    ),
    prompt_contract_version: asString(
      artifacts.prompt_contract_version ?? cachePolicy.contract_version,
      "unclassified",
    ),
    stable_prefix_digest: asNullableString(
      artifacts.stable_prefix_digest ?? cachePolicy.stable_prefix_digest,
    ),
    privacy_scope: asString(
      artifacts.privacy_scope ?? cachePolicy.privacy_scope,
      "unclassified",
    ),
    processing_region: asString(
      artifacts.processing_region ?? cachePolicy.processing_region,
      "unclassified",
    ),
    cache_decision: asString(
      artifacts.cache_decision
        ?? (cachePolicy.status === "enabled" ? "reusable" : cachePolicy.status === "disabled" ? "one_off" : null),
      "unclassified",
    ),
    cache_decision_reason: asString(
      artifacts.cache_decision_reason ?? cachePolicy.decision_reason,
      "unclassified",
    ),
    reusable_prefix_tokens: asNumber(
      artifacts.reusable_prefix_tokens
        ?? nestedRecord(cachePolicy, "economics")?.stable_prefix_tokens,
    ),
    dynamic_suffix_tokens: artifacts.dynamic_suffix_tokens === null ? null : optionalNumber(artifacts.dynamic_suffix_tokens) ?? uncachedInputTokens,
    usage_detail_status: asString(
      artifacts.usage_detail_status,
      promptTokens !== null && promptTokens > 0 && (usageValue("cached_tokens") !== undefined)
        && (usageValue("cache_write_tokens") !== undefined)
        ? "complete"
        : "missing",
    ),
    cost_status: asString(artifacts.cost_status ?? usageValue("cost_status"), "unknown"),
    provider_response_id: asNullableString(
      artifacts.openai_response_id ?? usageValue("provider_response_id"),
    ),
    reported_uncached_input_cost_usd: optionalNumber(
      usageValue("uncached_input_cost_usd"),
    ),
    reported_cache_write_cost_usd: optionalNumber(
      usageValue("cache_write_cost_usd"),
    ),
    reported_cached_read_cost_usd: optionalNumber(
      usageValue("cached_read_cost_usd"),
    ),
    reported_output_cost_usd: optionalNumber(usageValue("output_cost_usd")),
    reported_estimated_total_cost_usd: optionalNumber(
      usageValue("estimated_total_cost_usd"),
    ),
    reported_estimated_cost_without_caching_usd: optionalNumber(
      usageValue("estimated_cost_without_caching_usd"),
    ),
    reported_estimated_savings_usd: optionalNumber(
      usageValue("estimated_savings_usd"),
    ),
  };
}

function nestedRecord(root: Record<string, unknown> | null, ...keys: string[]) {
  return keys.reduce<Record<string, unknown> | null>((current, key) => {
    if (!current) return null;
    return asRecord(current[key]);
  }, root);
}

function readIssueId(run: AgentTelemetryRun) {
  const metadata = asRecord(run.metadata);
  const artifacts = asRecord(run.artifacts) || {};
  const input = asRecord(run.input);
  const nestedInput = asRecord(input?.input);
  return asNullableString(
    artifacts.issue_id
      ?? artifacts.issueId
      ?? metadata?.issue_id
      ?? metadata?.issueId
      ?? metadata?.paperclip_issue_id
      ?? metadata?.paperclipIssueId
      ?? input?.issueId
      ?? input?.issue_id
      ?? nestedInput?.issueId
      ?? nestedInput?.issue_id,
  );
}

function readAgentKey(run: AgentTelemetryRun) {
  const metadata = asRecord(run.metadata);
  return asString(
    metadata?.agent_key
      ?? metadata?.agentKey
      ?? nestedRecord(metadata, "managedRuntime", "profileSnapshot")?.key
      ?? nestedRecord(metadata, "managed_runtime", "profile_snapshot")?.key
      ?? run.task_kind,
  );
}

type ModelPricing = {
  cacheHitInput: number;
  cacheMissInput: number;
  cacheWriteInput: number;
  output: number;
  longContextThreshold?: number;
  longContextInputMultiplier?: number;
  longContextOutputMultiplier?: number;
};

function deepSeekPricingForModel(model: string): ModelPricing | null {
  const normalized = model.trim().toLowerCase();
  if (normalized.includes("deepseek-v4-pro")) {
    return {
      cacheHitInput: 0.003625,
      cacheMissInput: 0.435,
      cacheWriteInput: 0.435,
      output: 0.87,
    };
  }
  if (normalized.includes("deepseek-v4-flash")) {
    return {
      cacheHitInput: 0.0028,
      cacheMissInput: 0.14,
      cacheWriteInput: 0.14,
      output: 0.28,
    };
  }
  return null;
}

function pricingForModel(model: string): ModelPricing | null {
  const deepSeek = deepSeekPricingForModel(model);
  if (deepSeek) return deepSeek;
  const openAI = pricingForOpenAIModel(model);
  if (!openAI) return null;
  return {
    cacheHitInput: openAI.cachedReadPerMillionUsd,
    cacheMissInput: openAI.uncachedInputPerMillionUsd,
    cacheWriteInput: openAI.cacheWritePerMillionUsd,
    output: openAI.outputPerMillionUsd,
    longContextThreshold: 272_000,
    longContextInputMultiplier: 2,
    longContextOutputMultiplier: 1.5,
  };
}

function estimateCostPerMillionTokens(model: string) {
  const normalized = model.trim().toLowerCase();
  if (!normalized || normalized === "unknown") return 0;
  if (normalized.includes(":free")) return 0;
  const deepSeekPricing = deepSeekPricingForModel(normalized);
  if (deepSeekPricing) return deepSeekPricing.output;
  if (normalized.includes("gemini-3-flash")) return 0.6;
  if (normalized.includes("gpt-5.4-mini")) return 0.3;
  if (normalized.includes("gpt-5.4")) return 0.4;
  if (normalized.includes("claude")) return 0.25;
  return 0.3;
}

function estimateUsageCost(row: ReturnType<typeof readUsageArtifacts>) {
  if (row.cost_explicitly_unknown) {
    const component = (key: string) => optionalNumber(row.raw_cost_components[key]) ?? null;
    return { estimatedTotalCostUsd: null, uncachedInputCostUsd: component("uncached_input_cost_usd"),
      cacheWriteCostUsd: component("cache_write_cost_usd"), cachedReadCostUsd: component("cached_read_cost_usd"),
      outputCostUsd: component("output_cost_usd"), estimatedCostWithoutCachingUsd: component("estimated_cost_without_caching_usd"),
      estimatedSavingsUsd: component("estimated_savings_usd"), costStatus: row.cost_status };
  }
  if (
    row.reported_uncached_input_cost_usd !== undefined
    && row.reported_cache_write_cost_usd !== undefined
    && row.reported_cached_read_cost_usd !== undefined
    && row.reported_output_cost_usd !== undefined
    && row.reported_estimated_total_cost_usd !== undefined
    && row.reported_estimated_cost_without_caching_usd !== undefined
    && row.reported_estimated_savings_usd !== undefined
  ) {
    return {
      estimatedTotalCostUsd: row.reported_estimated_total_cost_usd,
      uncachedInputCostUsd: row.reported_uncached_input_cost_usd,
      cacheWriteCostUsd: row.reported_cache_write_cost_usd,
      cachedReadCostUsd: row.reported_cached_read_cost_usd,
      outputCostUsd: row.reported_output_cost_usd,
      estimatedCostWithoutCachingUsd:
        row.reported_estimated_cost_without_caching_usd,
      estimatedSavingsUsd: row.reported_estimated_savings_usd,
      costStatus: row.cost_status,
    };
  }
  const pricing = pricingForModel(row.model);
  if (!pricing) {
    const totalTokens =
      asNumber(row.total_tokens) || asNumber(row.prompt_tokens) + asNumber(row.completion_tokens) + asNumber(row.reasoning_tokens);
    const fallback = Number(
      ((totalTokens / 1_000_000) * estimateCostPerMillionTokens(row.model)).toFixed(12),
    );
    return {
      estimatedTotalCostUsd: fallback,
      uncachedInputCostUsd: 0,
      cacheWriteCostUsd: 0,
      cachedReadCostUsd: 0,
      outputCostUsd: fallback,
      estimatedCostWithoutCachingUsd: fallback,
      estimatedSavingsUsd: 0,
      costStatus: "model_pricing_unknown",
    };
  }

  const cachedInputTokens = Math.max(0, Math.min(asNumber(row.cached_tokens), asNumber(row.prompt_tokens)));
  const cacheWriteTokens = Math.max(
    0,
    Math.min(asNumber(row.cache_write_tokens), asNumber(row.prompt_tokens) - cachedInputTokens),
  );
  const cacheMissInputTokens = Math.max(
    0,
    asNumber(row.prompt_tokens) - cachedInputTokens - cacheWriteTokens,
  );
  const outputTokens = Math.max(asNumber(row.completion_tokens), asNumber(row.reasoning_tokens));
  const longContext = Boolean(
    pricing.longContextThreshold && asNumber(row.prompt_tokens) > pricing.longContextThreshold,
  );
  const inputMultiplier = longContext ? pricing.longContextInputMultiplier ?? 1 : 1;
  const outputMultiplier = longContext ? pricing.longContextOutputMultiplier ?? 1 : 1;
  const uncachedInputCostUsd =
    cacheMissInputTokens / 1_000_000 * pricing.cacheMissInput * inputMultiplier;
  const cacheWriteCostUsd =
    cacheWriteTokens / 1_000_000 * pricing.cacheWriteInput * inputMultiplier;
  const cachedReadCostUsd =
    cachedInputTokens / 1_000_000 * pricing.cacheHitInput * inputMultiplier;
  const outputCostUsd = outputTokens / 1_000_000 * pricing.output * outputMultiplier;
  const estimatedTotalCostUsd =
    uncachedInputCostUsd + cacheWriteCostUsd + cachedReadCostUsd + outputCostUsd;
  const estimatedCostWithoutCachingUsd =
    asNumber(row.prompt_tokens) / 1_000_000 * pricing.cacheMissInput * inputMultiplier + outputCostUsd;
  return {
    estimatedTotalCostUsd: Number(estimatedTotalCostUsd.toFixed(12)),
    uncachedInputCostUsd: Number(uncachedInputCostUsd.toFixed(12)),
    cacheWriteCostUsd: Number(cacheWriteCostUsd.toFixed(12)),
    cachedReadCostUsd: Number(cachedReadCostUsd.toFixed(12)),
    outputCostUsd: Number(outputCostUsd.toFixed(12)),
    estimatedCostWithoutCachingUsd: Number(estimatedCostWithoutCachingUsd.toFixed(12)),
    estimatedSavingsUsd: Number(
      (estimatedCostWithoutCachingUsd - estimatedTotalCostUsd).toFixed(12),
    ),
    costStatus: "model_pricing_estimate_not_official_billing",
  };
}

/** Missing compact accounting is unknown, never evidence of zero spend. */
export class AgentCostEvidenceError extends Error {
  constructor(readonly runId: string | null, readonly field: string) {
    super(`agent_cost_evidence_unavailable: agentRuns/${runId ?? "unknown"} ${field}; hydrate the bound private evidence or restore canonical accounting`);
    this.name = "AgentCostEvidenceError";
  }
}

function compactAgentCostTelemetry(run: AgentTelemetryRun): AgentCostTelemetryRecord | null {
  if (!run.agent_evidence_ref) return null;
  // Hydrated/original provider usage takes precedence over a retained summary.
  if (asRecord(run.artifacts) || (Array.isArray(run.logs) && run.logs.length > 0)) return null;
  const fail = (field: string): never => { throw new AgentCostEvidenceError(asNullableString(run.id), field); };
  const ref = asRecord(run.agent_evidence_ref);
  if (!ref || ref.version !== 1 || ref.collection !== "agentRuns" || ref.id !== run.id
    || typeof ref.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(ref.sha256)
    || run.agent_evidence_accounting_sha256 !== ref.sha256
    || !Array.isArray(ref.fields) || !ref.fields.includes("metadata")
    || !ref.fields.some(field => field === "artifacts" || field === "logs")) fail("source_binding");
  const compact = asRecord(asRecord(run.metadata)?.cost_telemetry) ?? fail("metadata.cost_telemetry");
  const source = asRecord(run.agent_evidence_accounting_identity) ?? fail("accounting_identity");
  if (source.sha256 !== ref?.sha256 || source.requested_model !== run.model
    || typeof source.resolved_model !== "string" || !source.resolved_model) fail("model_source_binding");
  const identities = {
    run_id: run.id, session_id: run.session_id ?? null,
    task_kind: run.task_kind, provider: run.provider,
  };
  for (const [field, expected] of Object.entries(identities)) {
    if (compact[field] !== expected || source[field] !== expected
      || (field !== "session_id" && (typeof expected !== "string" || !expected))) fail(field);
  }
  if (compact.model !== source.resolved_model) fail("model");
  const counters = ["calls", "prompt_tokens", "completion_tokens", "total_tokens", "cached_tokens",
    "cache_write_tokens", "reasoning_tokens", "uncached_input_tokens", "reusable_prefix_tokens", "dynamic_suffix_tokens"];
  const costs = ["cost_usd", "cost_estimate_usd", "uncached_input_cost_usd", "cache_write_cost_usd",
    "cached_read_cost_usd", "output_cost_usd", "estimated_cost_without_caching_usd"];
  for (const field of [...counters, ...costs, "estimated_savings_usd", "cache_hit_ratio"]) {
    const value = compact[field];
    if (value === null && field !== "calls" && field !== "reusable_prefix_tokens"
      && (compact.usage_detail_status !== "complete" || ((costs.includes(field) || field === "estimated_savings_usd") && compact.cost_estimate_usd === null))) continue;
    if (typeof value !== "number" || !Number.isFinite(value)
      || (field !== "estimated_savings_usd" && value < 0)
      || (counters.includes(field) && !Number.isSafeInteger(value))) fail(field);
  }
  if ((typeof compact.cache_hit_ratio === "number" && compact.cache_hit_ratio > 1)
    || (typeof compact.prompt_tokens === "number" && typeof compact.cached_tokens === "number" && typeof compact.cache_write_tokens === "number"
      && compact.cached_tokens + compact.cache_write_tokens > compact.prompt_tokens)
    || (typeof compact.prompt_tokens === "number" && typeof compact.uncached_input_tokens === "number"
      && compact.uncached_input_tokens > compact.prompt_tokens)) fail("token_partition");
  if (compact.spend_accounting_status !== undefined || compact.conservative_spend_usd !== undefined || compact.known_usage_subtotals !== undefined) {
    const known = asRecord(compact.known_usage_subtotals) ?? fail("known_usage_subtotals");
    for (const [field, value] of Object.entries(known)) {
      if (typeof value !== "number" || !Number.isFinite(value) || (field !== "estimated_savings_usd" && value < 0)) fail("known_usage_subtotals");
    }
    const conservative = compact.conservative_spend_usd;
    if (compact.spend_accounting_status === "unresolved") {
      if (conservative !== null || compact.cost_estimate_usd !== null) fail("conservative_spend_usd");
    } else if (compact.spend_accounting_status === "reserved_unknown") {
      const bound = asRecord(compact.spend_reservation) ?? fail("spend_reservation");
      for (const field of ["known_reported_cost_usd", "unknown_usage_reserved_cost_usd", "projected_max_cost_per_call_usd", "unknown_calls"]) {
        if (typeof bound[field] !== "number" || !Number.isFinite(bound[field]) || Number(bound[field]) < 0) fail("spend_reservation");
      }
      if (compact.cost_estimate_usd !== null || typeof conservative !== "number" || !Number.isFinite(conservative)
        || conservative <= asNumber(known.estimated_total_cost_usd)) fail("conservative_spend_usd");
      const reservations = bound.reserved_max_costs_usd;
      if (reservations !== undefined && (!Array.isArray(reservations) || reservations.length !== bound.unknown_calls
        || reservations.some(value => typeof value !== "number" || !Number.isFinite(value) || value <= 0)
        || Math.abs(Math.max(...reservations) - Number(bound.projected_max_cost_per_call_usd)) > 1e-9)) fail("spend_reservation");
      const reserved = Array.isArray(reservations) ? reservations.reduce((sum: number, value: number) => sum + value, 0)
        : Number(bound.projected_max_cost_per_call_usd) * Number(bound.unknown_calls);
      if (!Number.isSafeInteger(bound.unknown_calls) || Number(bound.unknown_calls) < 1 || Number(bound.unknown_calls) > Number(compact.calls)
        || Number(bound.projected_max_cost_per_call_usd) <= 0
        || Math.abs(Number(bound.known_reported_cost_usd) - asNumber(known.estimated_total_cost_usd)) > 1e-9
        || Math.abs(Number(bound.unknown_usage_reserved_cost_usd) - reserved) > 1e-9
        || Math.abs(Number(conservative) - Number(bound.known_reported_cost_usd) - Number(bound.unknown_usage_reserved_cost_usd)) > 1e-9) fail("spend_reservation");
    } else if (compact.spend_accounting_status === "complete") {
      if (typeof conservative !== "number" || !Number.isFinite(conservative) || conservative < 0
        || conservative !== compact.cost_estimate_usd) fail("conservative_spend_usd");
    } else fail("spend_accounting_status");
  } else if (compact.cost_estimate_usd === null) fail("conservative_spend_usd");
  for (const field of ["agent_key", "route", "upstream_provider", "provider_route", "cache_family",
    "prompt_contract_version", "privacy_scope", "processing_region", "cache_decision", "cache_decision_reason",
    "usage_detail_status", "cost_status"]) {
    if (typeof compact[field] !== "string" || !compact[field]) fail(field);
  }
  for (const field of ["issue_id", "cache_key_digest", "stable_prefix_digest", "provider_response_id"]) {
    if (compact[field] !== null && (typeof compact[field] !== "string" || !compact[field])) fail(field);
  }
  if (compact.created_at_ms !== null && (typeof compact.created_at_ms !== "number" || !Number.isFinite(compact.created_at_ms))) fail("created_at_ms");
  // The protected Firestore timestamps remain the rolling-window source, as for
  // inline provider evidence; the retained pricing/status/counters are unchanged.
  return { ...compact, created_at_ms: asTimestampMs(run.created_at ?? run.updated_at) ?? compact.created_at_ms } as AgentCostTelemetryRecord;
}

function addReported(left: number | null, right: number | null): number | null {
  return left === null || right === null ? null : Number((left + right).toFixed(12));
}

function reportedRatio(numerator: number | null, denominator: number | null): number | null {
  return numerator === null || denominator === null ? null : denominator > 0 ? numerator / denominator : 0;
}

function readConservativeReservation(artifacts: Record<string, unknown>, known: Record<string, number>): NonNullable<AgentCostTelemetryRecord["spend_reservation"]> | null {
  const reservation = asRecord(artifacts.inference_reservation);
  if (!reservation || reservation.reconciled_cost_status !== "includes_worst_case_reservations") return null;
  const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const estimatedKnown = reservation.known_reported_cost_usd === null ? 0 : reservation.known_reported_cost_usd;
  const unknown = reservation.unknown_usage_reserved_cost_usd, total = reservation.reconciled_cost_usd;
  const maximum = reservation.projected_max_cost_per_call_usd;
  if (!finite(estimatedKnown) || !finite(unknown) || unknown <= 0 || !finite(total) || !finite(maximum) || maximum <= 0
    || Math.abs(estimatedKnown - (known.estimated_total_cost_usd ?? 0)) > 1e-9
    || Math.abs(total - estimatedKnown - unknown) > 1e-9) return null;
  const samples = artifacts.usage_samples;
  if (!Array.isArray(samples) || samples.length === 0) return null;
  const unknownSamples = samples.filter(sample => !finite(asRecord(sample)?.estimated_total_cost_usd));
  const unknownCalls = unknownSamples.length;
  const knownSampleCost = samples.reduce((sum, sample) => {
    const cost = asRecord(sample)?.estimated_total_cost_usd;
    return sum + (finite(cost) ? cost : 0);
  }, 0);
  if (Math.abs(estimatedKnown - knownSampleCost) > 1e-9) return null;
  const reservations = unknownSamples.map(sample => asRecord(sample)?.reserved_max_cost_usd);
  const hasVariableReservations = reservations.some(value => value !== undefined);
  if (hasVariableReservations && (!reservations.every(value => finite(value) && value > 0)
    || Math.abs(Math.max(...reservations as number[]) - maximum) > 1e-9)) return null;
  const reserved = hasVariableReservations ? (reservations as number[]).reduce((sum, value) => sum + value, 0) : maximum * unknownCalls;
  if (unknownCalls < 1 || Math.abs(unknown - reserved) > 1e-9) return null;
  return { known_reported_cost_usd: estimatedKnown, unknown_usage_reserved_cost_usd: unknown,
    projected_max_cost_per_call_usd: maximum, unknown_calls: unknownCalls,
    ...(hasVariableReservations ? { reserved_max_costs_usd: reservations as number[] } : {}) };
}

export function extractAgentCostTelemetry(run: AgentTelemetryRun): AgentCostTelemetryRecord {
  if (run.agent_accounting_incomplete === true) throw new AgentCostEvidenceError(asNullableString(run.id), "agent_accounting_incomplete");
  const compact = compactAgentCostTelemetry(run);
  if (compact) return compact;
  const artifacts = asRecord(run.artifacts) || {};
  const row = readUsageArtifacts(run);
  const totalTokens = row.total_tokens;
  const knownUsageSubtotals = Object.fromEntries(Object.entries(asRecord(artifacts.known_usage_subtotals) ?? {})
    .filter(([key, value]) => typeof value === "number" && Number.isFinite(value) && (key === "estimated_savings_usd" || value >= 0))) as Record<string, number>;
  const cost = estimateUsageCost(row);
  const costUsd = row.cost_explicitly_unknown || row.cost_usd === null ? null : Number(row.cost_usd.toFixed(12));
  const estimatedCost = row.cost_explicitly_unknown ? null : costUsd !== null && costUsd > 0 ? costUsd : cost.estimatedTotalCostUsd;
  const spendReservation = estimatedCost === null ? readConservativeReservation(artifacts, knownUsageSubtotals) : null;
  const conservativeSpend = estimatedCost ?? (spendReservation
    ? spendReservation.known_reported_cost_usd + spendReservation.unknown_usage_reserved_cost_usd : null);
  return {
    run_id: asNullableString(run.id),
    session_id: asNullableString(run.session_id),
    issue_id: readIssueId(run),
    agent_key: readAgentKey(run),
    task_kind: row.task_kind,
    provider: row.provider,
    route: row.route,
    model: row.model,
    upstream_provider: readUpstreamProvider(artifacts),
    provider_route: row.provider_route,
    calls: row.calls,
    prompt_tokens: row.prompt_tokens,
    completion_tokens: row.completion_tokens,
    total_tokens: totalTokens,
    cached_tokens: row.cached_tokens,
    cache_write_tokens: row.cache_write_tokens,
    reasoning_tokens: row.reasoning_tokens,
    cost_usd: costUsd,
    cost_estimate_usd: estimatedCost,
    uncached_input_tokens: row.uncached_input_tokens,
    uncached_input_cost_usd: cost.uncachedInputCostUsd,
    cache_write_cost_usd: cost.cacheWriteCostUsd,
    cached_read_cost_usd: cost.cachedReadCostUsd,
    output_cost_usd: cost.outputCostUsd,
    estimated_cost_without_caching_usd: cost.estimatedCostWithoutCachingUsd,
    estimated_savings_usd: cost.estimatedSavingsUsd,
    cache_hit_ratio: reportedRatio(row.cached_tokens, row.prompt_tokens),
    cache_family: row.cache_family,
    cache_key_digest: row.cache_key_digest,
    prompt_contract_version: row.prompt_contract_version,
    stable_prefix_digest: row.stable_prefix_digest,
    privacy_scope: row.privacy_scope,
    processing_region: row.processing_region,
    cache_decision: row.cache_decision,
    cache_decision_reason: row.cache_decision_reason,
    reusable_prefix_tokens: row.reusable_prefix_tokens,
    dynamic_suffix_tokens: row.dynamic_suffix_tokens,
    usage_detail_status: row.usage_detail_status,
    cost_status: row.cost_status !== "unknown" ? row.cost_status : cost.costStatus,
    provider_response_id: row.provider_response_id,
    known_usage_subtotals: knownUsageSubtotals,
    conservative_spend_usd: conservativeSpend,
    spend_reservation: spendReservation,
    spend_accounting_status: estimatedCost !== null ? "complete" : conservativeSpend !== null ? "reserved_unknown" : "unresolved",
    created_at_ms: asTimestampMs(run.created_at ?? run.updated_at),
  };
}

function summaryKey(row: AgentTelemetrySummaryRow) {
  return [
    row.task_kind,
    row.provider,
    row.route,
    row.model,
    row.provider_route,
    row.cache_family,
    row.prompt_contract_version,
    row.processing_region,
    row.cache_decision,
  ].join("\u001f");
}

export function summarizeAgentCostTelemetry(runs: AgentTelemetryRun[]) {
  const rowsByKey = new Map<string, AgentTelemetrySummaryRow>();

  for (const run of runs) {
    const record = extractAgentCostTelemetry(run);
    const row: AgentTelemetrySummaryRow = {
      task_kind: record.task_kind,
      provider: record.provider,
      route: record.route,
      model: record.model,
      provider_route: record.provider_route,
      calls: record.calls,
      prompt_tokens: record.prompt_tokens,
      completion_tokens: record.completion_tokens,
      total_tokens: record.total_tokens,
      cached_tokens: record.cached_tokens,
      cache_write_tokens: record.cache_write_tokens,
      uncached_input_tokens: record.uncached_input_tokens,
      reasoning_tokens: record.reasoning_tokens,
      cost_usd: record.cost_usd,
      uncached_input_cost_usd: record.uncached_input_cost_usd,
      cache_write_cost_usd: record.cache_write_cost_usd,
      cached_read_cost_usd: record.cached_read_cost_usd,
      output_cost_usd: record.output_cost_usd,
      estimated_cost_without_caching_usd: record.estimated_cost_without_caching_usd,
      estimated_savings_usd: record.estimated_savings_usd,
      cache_hit_ratio: record.cache_hit_ratio,
      cache_family: record.cache_family,
      prompt_contract_version: record.prompt_contract_version,
      processing_region: record.processing_region,
      cache_decision: record.cache_decision,
    };
    const key = summaryKey(row);
    const previous = rowsByKey.get(key);
    if (!previous) {
      rowsByKey.set(key, row);
      continue;
    }
    const merged = { ...previous, calls: previous.calls + row.calls };
    for (const field of ["prompt_tokens", "completion_tokens", "total_tokens", "cached_tokens", "cache_write_tokens",
      "uncached_input_tokens", "reasoning_tokens", "cost_usd", "uncached_input_cost_usd", "cache_write_cost_usd",
      "cached_read_cost_usd", "output_cost_usd", "estimated_cost_without_caching_usd", "estimated_savings_usd"] as const) {
      merged[field] = addReported(previous[field], row[field]);
    }
    rowsByKey.set(key, merged);
  }

  const rows: AgentTelemetrySummaryRow[] = [...rowsByKey.values()]
    .map((row) => ({
      ...row,
      cache_hit_ratio: reportedRatio(row.cached_tokens, row.prompt_tokens),
    }))
    .sort((a, b) =>
      a.task_kind.localeCompare(b.task_kind) ||
      a.provider.localeCompare(b.provider) ||
      a.route.localeCompare(b.route) ||
      a.model.localeCompare(b.model),
    );

  return { rows };
}

function emptySpendWindow(): AgentSpendWindow {
  return {
    runs: 0,
    cost_usd: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    cached_tokens: 0,
    status: "ok",
  };
}

function classifySpendWindow(
  window: AgentSpendWindow,
  windowKey: SpendWindowKey,
  warnUsd?: AgentSpendThresholds,
  stopUsd?: AgentSpendThresholds,
) {
  const stop = stopUsd?.[windowKey];
  const warn = warnUsd?.[windowKey];
  if (typeof stop === "number" && stop > 0 && window.cost_usd >= stop) return "stop";
  if (typeof warn === "number" && warn > 0 && window.cost_usd >= warn) return "warn";
  return "ok";
}

function addTelemetryToWindow(window: AgentSpendWindow, telemetry: AgentCostTelemetryRecord) {
  window.runs += 1;
  const spend = telemetry.conservative_spend_usd ?? telemetry.cost_estimate_usd;
  if (typeof spend !== "number" || !Number.isFinite(spend) || spend < 0) {
    throw new AgentCostEvidenceError(telemetry.run_id, "unresolved_usage_reservation");
  }
  window.cost_usd = Number((window.cost_usd + spend).toFixed(12));
  window.prompt_tokens = addReported(window.prompt_tokens, telemetry.prompt_tokens);
  window.completion_tokens = addReported(window.completion_tokens, telemetry.completion_tokens);
  window.cached_tokens = addReported(window.cached_tokens, telemetry.cached_tokens);
}

export function summarizeRollingAgentSpend(
  runs: AgentTelemetryRun[],
  options?: {
    nowMs?: number;
    warnUsd?: AgentSpendThresholds;
    stopUsd?: AgentSpendThresholds;
  },
) {
  const nowMs = options?.nowMs ?? Date.now();
  const telemetry = runs
    .map((run) => extractAgentCostTelemetry(run))
    .filter((record) => typeof record.created_at_ms === "number");
  const windows: Record<SpendWindowKey, AgentSpendWindow> = {
    last15m: emptySpendWindow(),
    lastHour: emptySpendWindow(),
    lastDay: emptySpendWindow(),
  };
  const byAgent: Record<string, Record<SpendWindowKey, AgentSpendWindow>> = {};

  for (const record of telemetry) {
    const ageMs = nowMs - (record.created_at_ms ?? 0);
    if (ageMs < 0) continue;
    for (const [windowKey, durationMs] of Object.entries(SPEND_WINDOWS) as Array<[SpendWindowKey, number]>) {
      if (ageMs > durationMs) continue;
      addTelemetryToWindow(windows[windowKey], record);
      byAgent[record.agent_key] ??= {
        last15m: emptySpendWindow(),
        lastHour: emptySpendWindow(),
        lastDay: emptySpendWindow(),
      };
      addTelemetryToWindow(byAgent[record.agent_key][windowKey], record);
    }
  }

  for (const windowKey of Object.keys(windows) as SpendWindowKey[]) {
    windows[windowKey].status = classifySpendWindow(
      windows[windowKey],
      windowKey,
      options?.warnUsd,
      options?.stopUsd,
    );
  }
  for (const agentWindows of Object.values(byAgent)) {
    for (const windowKey of Object.keys(agentWindows) as SpendWindowKey[]) {
      agentWindows[windowKey].status = classifySpendWindow(
        agentWindows[windowKey],
        windowKey,
        options?.warnUsd,
        options?.stopUsd,
      );
    }
  }

  return { windows, by_agent: byAgent, records: telemetry };
}

function textIndicatesNoChange(value: unknown) {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized === "no_change" ||
    normalized === "no change" ||
    normalized === "unchanged" ||
    normalized === "none" ||
    normalized.includes("movement: none") ||
    normalized.includes("no material movement")
  );
}

function isNoChangeRun(run: AgentTelemetryRun) {
  const artifacts = asRecord(run.artifacts) || {};
  const output = asRecord(run.output) || {};
  const metadata = asRecord(run.metadata) || {};
  return [
    artifacts.movement,
    artifacts.status,
    artifacts.state,
    artifacts.closeout_state,
    output.movement,
    output.status,
    output.state,
    output.summary,
    output.reply,
    metadata.movement,
    metadata.status,
  ].some(textIndicatesNoChange);
}

function sumReported(records: AgentCostTelemetryRecord[], field: "prompt_tokens" | "cached_tokens" | "cache_write_tokens" | "cost_estimate_usd"): number | null {
  return records.reduce<number | null>((sum, record) => addReported(sum, record[field]), 0);
}

function buildWasteSignalRow(
  signal: AgentWasteSignalRow["signal"],
  records: AgentCostTelemetryRecord[],
  recommendation: string,
): AgentWasteSignalRow {
  return {
    signal,
    runs: records.length,
    prompt_tokens: sumReported(records, "prompt_tokens"),
    cached_tokens: sumReported(records, "cached_tokens"),
    cache_write_tokens: sumReported(records, "cache_write_tokens"),
    cost_estimate_usd: sumReported(records, "cost_estimate_usd"),
    run_ids: records
      .map((record) => record.run_id)
      .filter((value): value is string => Boolean(value))
      .slice(0, 10),
    recommendation,
  };
}

export function summarizeAgentCostWaste(
  runs: AgentTelemetryRun[],
  options?: {
    lowCachePromptTokenFloor?: number;
    lowCacheHitRatioCeiling?: number;
  },
): AgentCostWasteSummary {
  const records = runs.map((run) => extractAgentCostTelemetry(run));
  const lowCachePromptTokenFloor = options?.lowCachePromptTokenFloor ?? 1_000;
  const lowCacheHitRatioCeiling = options?.lowCacheHitRatioCeiling ?? 0.5;
  const recordsByRunId = new Map(records.map((record, index) => [record.run_id ?? `index:${index}`, record]));
  const lowCacheHighPrompt = records.filter(
    (record) =>
      record.prompt_tokens !== null && record.cache_hit_ratio !== null &&
      record.prompt_tokens >= lowCachePromptTokenFloor && record.cache_hit_ratio < lowCacheHitRatioCeiling,
  );
  const noChangeRecords = runs
    .map((run, index) =>
      isNoChangeRun(run)
        ? recordsByRunId.get(asNullableString(run.id) ?? `index:${index}`)
        : null,
    )
    .filter((record): record is AgentCostTelemetryRecord => Boolean(record));
  const duplicateSuppressedRecords = runs
    .map((run, index) =>
      hasRuntimeSuppression(run)
        ? recordsByRunId.get(asNullableString(run.id) ?? `index:${index}`)
        : null,
    )
    .filter((record): record is AgentCostTelemetryRecord => Boolean(record));
  const byFamily = new Map<string, AgentCostTelemetryRecord[]>();
  for (const record of records) {
    const key = [record.model, record.cache_family, record.prompt_contract_version].join("\u001f");
    byFamily.set(key, [...(byFamily.get(key) ?? []), record]);
  }
  const writesWithoutReuse = [...byFamily.values()]
    .filter((family) =>
      (sumReported(family, "cache_write_tokens") ?? 0) > 0
      && sumReported(family, "cached_tokens") === 0)
    .flat();
  const fragmented = [...byFamily.values()]
    .filter((family) => new Set(family.map((record) => record.cache_key_digest).filter(Boolean)).size > 1)
    .flat();
  const familyVersions = new Map<string, Set<string>>();
  for (const record of records) {
    const versions = familyVersions.get(record.cache_family) ?? new Set<string>();
    versions.add(record.prompt_contract_version);
    familyVersions.set(record.cache_family, versions);
  }
  const contractChurn = records.filter(
    (record) => (familyVersions.get(record.cache_family)?.size ?? 0) > 1,
  );
  const dynamicBeforeBreakpoint = runs
    .map((run, index) =>
      asRecord(run.artifacts)?.dynamic_content_before_breakpoint === true ? records[index] : null)
    .filter((record): record is AgentCostTelemetryRecord => Boolean(record));
  const pricingUnknown = records.filter((record) => record.cost_status === "model_pricing_unknown");
  const usageMissing = records.filter((record) => record.usage_detail_status !== "complete");
  const signals: AgentWasteSignalRow[] = [];

  if (lowCacheHighPrompt.length > 0) {
    signals.push(
      buildWasteSignalRow(
        "low_cache_high_prompt",
        lowCacheHighPrompt,
        "Stabilize prompt prefixes and trim dynamic payloads before touching model quality.",
      ),
    );
  }
  if (noChangeRecords.length > 0) {
    signals.push(
      buildWasteSignalRow(
        "no_change_completed",
        noChangeRecords,
        "Suppress or coalesce repeated no-change checks instead of spending another full agent run.",
      ),
    );
  }
  if (duplicateSuppressedRecords.length > 0) {
    signals.push(
      buildWasteSignalRow(
        "duplicate_suppressed",
        duplicateSuppressedRecords,
        "Keep exact duplicate active-session messages suppressed and recorded as local runtime savings.",
      ),
    );
  }
  for (const [recordsForSignal, signal, recommendation] of [
    [
      writesWithoutReuse,
      "CACHE_WRITE_WITHOUT_REUSE",
      "Disable the family or fix reuse before another paid cache write.",
    ],
    [
      fragmented,
      "RUN_SCOPED_CACHE_KEY_FRAGMENTATION",
      "Derive the routing key only from stable capability and contract identity.",
    ],
    [
      dynamicBeforeBreakpoint,
      "DYNAMIC_CONTENT_BEFORE_BREAKPOINT",
      "Move run, timestamp, history, feedback, and image content after the last breakpoint.",
    ],
    [
      contractChurn,
      "CACHE_CONTRACT_CHURN",
      "Stabilize prompt contract versions within the supported cache lifetime.",
    ],
    [
      pricingUnknown,
      "MODEL_PRICING_UNKNOWN",
      "Register current model pricing before treating estimated cost as authoritative telemetry.",
    ],
    [
      usageMissing,
      "USAGE_DETAIL_MISSING",
      "Retain cached_tokens and cache_write_tokens from every provider response.",
    ],
  ] as const) {
    if (recordsForSignal.length > 0) {
      signals.push(buildWasteSignalRow(signal, [...recordsForSignal], recommendation));
    }
  }

  const totals = records.reduce<Pick<AgentCostWasteSummary["totals"], "runs" | "calls" | "prompt_tokens" | "completion_tokens" |
    "cached_tokens" | "cache_write_tokens" | "cost_estimate_usd" | "estimated_cost_without_caching_usd" | "estimated_savings_usd">>(
    (acc, record) => ({ runs: acc.runs + 1, calls: acc.calls + record.calls,
      prompt_tokens: addReported(acc.prompt_tokens, record.prompt_tokens),
      completion_tokens: addReported(acc.completion_tokens, record.completion_tokens),
      cached_tokens: addReported(acc.cached_tokens, record.cached_tokens),
      cache_write_tokens: addReported(acc.cache_write_tokens, record.cache_write_tokens),
      cost_estimate_usd: addReported(acc.cost_estimate_usd, record.cost_estimate_usd),
      estimated_cost_without_caching_usd: addReported(acc.estimated_cost_without_caching_usd, record.estimated_cost_without_caching_usd),
      estimated_savings_usd: addReported(acc.estimated_savings_usd, record.estimated_savings_usd),
    }),
    { runs: 0, calls: 0, prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, cache_write_tokens: 0,
      cost_estimate_usd: 0, estimated_cost_without_caching_usd: 0, estimated_savings_usd: 0 },
  );
  const topPromptRows = summarizeAgentCostTelemetry(runs).rows
    .slice()
    .sort((left, right) => (right.prompt_tokens ?? -1) - (left.prompt_tokens ?? -1))
    .slice(0, 5);
  const recommendations = [
    "Preserve high-quality routing; reduce prompt/context churn, cache misses, and duplicate/no-change execution before changing core model families.",
    ...signals.map((signal) => signal.recommendation),
  ];

  return {
    totals: {
      ...totals,
      cache_hit_ratio: reportedRatio(totals.cached_tokens, totals.prompt_tokens),
      write_to_read_ratio: totals.cached_tokens === null || totals.cache_write_tokens === null ? null
        : totals.cached_tokens > 0 ? totals.cache_write_tokens / totals.cached_tokens
          : totals.cache_write_tokens > 0 ? Number.POSITIVE_INFINITY : 0,
      cache_families: byFamily.size,
      cache_families_with_writes_without_reads: new Set(
        writesWithoutReuse.map((record) => record.cache_family),
      ).size,
    },
    signals,
    top_prompt_rows: topPromptRows,
    recommendations,
  };
}
