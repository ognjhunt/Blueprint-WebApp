import type { AgentTaskKind } from "../agents/types";

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
};

export type AgentTelemetrySummaryRow = {
  task_kind: string;
  provider: string;
  route: string;
  model: string;
  provider_route: string;
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  cost_usd: number;
  cache_hit_ratio: number;
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
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  cost_usd: number;
  cost_estimate_usd: number;
  cache_hit_ratio: number;
  created_at_ms: number | null;
};

export type AgentWasteSignalRow = {
  signal: "low_cache_high_prompt" | "no_change_completed" | "duplicate_suppressed";
  runs: number;
  prompt_tokens: number;
  cached_tokens: number;
  cost_estimate_usd: number;
  run_ids: string[];
  recommendation: string;
};

export type AgentCostWasteSummary = {
  totals: {
    runs: number;
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    cached_tokens: number;
    cache_hit_ratio: number;
    cost_estimate_usd: number;
  };
  signals: AgentWasteSignalRow[];
  top_prompt_rows: AgentTelemetrySummaryRow[];
  recommendations: string[];
};

type SpendWindowKey = "last15m" | "lastHour" | "lastDay";

export type AgentSpendWindow = {
  runs: number;
  cost_usd: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
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
  const artifactUsage = usageSourceFromArtifacts(artifacts);
  const usageFallback = usageSourceFromLogs(run);
  const usageValue = (key: string) => artifacts[key] ?? artifactUsage[key] ?? usageFallback[key];
  const promptTokens = asNumber(usageValue("prompt_tokens"));
  const directHitTokens = asNumber(usageValue("prompt_cache_hit_tokens"));
  const cachedTokens = asNumber(usageValue("cached_tokens"), directHitTokens);
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
    completion_tokens: asNumber(usageValue("completion_tokens")),
    total_tokens: asNumber(
      usageValue("total_tokens"),
      promptTokens + asNumber(usageValue("completion_tokens")),
    ),
    cached_tokens: cachedTokens,
    cache_write_tokens: asNumber(usageValue("cache_write_tokens")),
    reasoning_tokens: asNumber(usageValue("reasoning_tokens")),
    cost_usd: asNumber(usageValue("cost_usd")),
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

function estimateCostPerMillionTokens(model: string) {
  const normalized = model.trim().toLowerCase();
  if (!normalized || normalized === "unknown") return 0;
  if (normalized.includes(":free")) return 0;
  if (normalized.includes("deepseek-v4-pro")) return 0.75;
  if (normalized.includes("deepseek-v4-flash")) return 0.13;
  if (normalized.includes("gemini-3-flash")) return 0.6;
  if (normalized.includes("gpt-5.4-mini")) return 0.3;
  if (normalized.includes("gpt-5.4")) return 0.4;
  if (normalized.includes("claude")) return 0.25;
  return 0.3;
}

export function extractAgentCostTelemetry(run: AgentTelemetryRun): AgentCostTelemetryRecord {
  const artifacts = asRecord(run.artifacts) || {};
  const row = readUsageArtifacts(run);
  const totalTokens =
    row.total_tokens || row.prompt_tokens + row.completion_tokens + row.reasoning_tokens;
  const costEstimateUsd = Number(
    ((totalTokens / 1_000_000) * estimateCostPerMillionTokens(row.model)).toFixed(12),
  );
  const costUsd = Number(row.cost_usd.toFixed(12));
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
    cost_estimate_usd: costUsd > 0 ? costUsd : costEstimateUsd,
    cache_hit_ratio: row.prompt_tokens > 0 ? row.cached_tokens / row.prompt_tokens : 0,
    created_at_ms: asTimestampMs(run.created_at ?? run.updated_at),
  };
}

function summaryKey(row: Omit<AgentTelemetrySummaryRow, "cache_hit_ratio">) {
  return [
    row.task_kind,
    row.provider,
    row.route,
    row.model,
    row.provider_route,
  ].join("\u001f");
}

export function summarizeAgentCostTelemetry(runs: AgentTelemetryRun[]) {
  const rowsByKey = new Map<string, Omit<AgentTelemetrySummaryRow, "cache_hit_ratio">>();

  for (const run of runs) {
    const row = readUsageArtifacts(run);
    const key = summaryKey(row);
    const previous = rowsByKey.get(key);
    if (!previous) {
      rowsByKey.set(key, row);
      continue;
    }
    rowsByKey.set(key, {
      ...previous,
      calls: previous.calls + row.calls,
      prompt_tokens: previous.prompt_tokens + row.prompt_tokens,
      completion_tokens: previous.completion_tokens + row.completion_tokens,
      total_tokens: previous.total_tokens + row.total_tokens,
      cached_tokens: previous.cached_tokens + row.cached_tokens,
      cache_write_tokens: previous.cache_write_tokens + row.cache_write_tokens,
      reasoning_tokens: previous.reasoning_tokens + row.reasoning_tokens,
      cost_usd: Number((previous.cost_usd + row.cost_usd).toFixed(12)),
    });
  }

  const rows: AgentTelemetrySummaryRow[] = [...rowsByKey.values()]
    .map((row) => ({
      ...row,
      cache_hit_ratio:
        row.prompt_tokens > 0 ? row.cached_tokens / row.prompt_tokens : 0,
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
  window.cost_usd = Number((window.cost_usd + telemetry.cost_estimate_usd).toFixed(12));
  window.prompt_tokens += telemetry.prompt_tokens;
  window.completion_tokens += telemetry.completion_tokens;
  window.cached_tokens += telemetry.cached_tokens;
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

function buildWasteSignalRow(
  signal: AgentWasteSignalRow["signal"],
  records: AgentCostTelemetryRecord[],
  recommendation: string,
): AgentWasteSignalRow {
  return {
    signal,
    runs: records.length,
    prompt_tokens: records.reduce((sum, record) => sum + record.prompt_tokens, 0),
    cached_tokens: records.reduce((sum, record) => sum + record.cached_tokens, 0),
    cost_estimate_usd: Number(
      records.reduce((sum, record) => sum + record.cost_estimate_usd, 0).toFixed(12),
    ),
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
      record.prompt_tokens >= lowCachePromptTokenFloor &&
      record.cache_hit_ratio < lowCacheHitRatioCeiling,
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

  const totals = records.reduce(
    (acc, record) => ({
      runs: acc.runs + 1,
      calls: acc.calls + record.calls,
      prompt_tokens: acc.prompt_tokens + record.prompt_tokens,
      completion_tokens: acc.completion_tokens + record.completion_tokens,
      cached_tokens: acc.cached_tokens + record.cached_tokens,
      cost_estimate_usd: Number((acc.cost_estimate_usd + record.cost_estimate_usd).toFixed(12)),
    }),
    {
      runs: 0,
      calls: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cached_tokens: 0,
      cost_estimate_usd: 0,
    },
  );
  const topPromptRows = summarizeAgentCostTelemetry(runs).rows
    .slice()
    .sort((left, right) => right.prompt_tokens - left.prompt_tokens)
    .slice(0, 5);
  const recommendations = [
    "Preserve high-quality routing; reduce prompt/context churn, cache misses, and duplicate/no-change execution before changing core model families.",
    ...signals.map((signal) => signal.recommendation),
  ];

  return {
    totals: {
      ...totals,
      cache_hit_ratio:
        totals.prompt_tokens > 0 ? totals.cached_tokens / totals.prompt_tokens : 0,
    },
    signals,
    top_prompt_rows: topPromptRows,
    recommendations,
  };
}
