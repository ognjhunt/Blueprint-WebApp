import { describe, expect, it } from "vitest";

import {
  extractAgentCostTelemetry,
  summarizeAgentCostTelemetry,
  summarizeRollingAgentSpend,
} from "../utils/agentCostTelemetry";
import fixtureRuns from "./fixtures/agent-cost-cache-runs.json";

/*
 * History cases: runs stored by the removed providers (DeepSeek direct,
 * DeepSeek through OpenRouter, Z.ai). They can no longer be called, but what
 * they cost does not change. Every expected value below was computed by
 * running the telemetry module at a8815c4a7 (before the removal) on these
 * exact runs; the current module must give the same cost, tokens, route and
 * model.
 */
// Stored-run shapes the removed adapter wrote, beyond the four fixture rows.
const historyRuns = [
  {
    id: "history-direct-deepseek",
    session_id: "history-session",
    task_kind: "support_triage",
    provider: "deepseek_chat",
    model: "deepseek-v4-pro",
    created_at: "2026-05-05T15:50:00.000Z",
    artifacts: {
      provider: "deepseek_chat",
      model: "deepseek-v4-pro",
      prompt_tokens: 12_000,
      completion_tokens: 800,
      total_tokens: 12_800,
      prompt_cache_hit_tokens: 9_000,
      prompt_cache_miss_tokens: 3_000,
      reasoning_tokens: 300,
      cost_usd: null,
    },
  },
  {
    id: "history-openrouter-usage",
    session_id: "history-session",
    task_kind: "operator_thread",
    provider: "deepseek_chat",
    model: "deepseek/deepseek-v4-flash",
    created_at: "2026-05-05T15:40:00.000Z",
    artifacts: {
      provider: "deepseek_chat",
      model: "deepseek/deepseek-v4-flash",
      openrouter_model: "deepseek/deepseek-v4-pro",
      openrouter_provider_preferences: { order: ["DeepSeek", "Fireworks"], allow_fallbacks: false },
      openrouter_usage: {
        prompt_tokens: 20_000,
        completion_tokens: 1_200,
        total_tokens: 21_200,
        prompt_tokens_details: { cached_tokens: 15_000, cache_write_tokens: 0 },
        completion_tokens_details: { reasoning_tokens: 400 },
      },
    },
  },
  {
    id: "history-openrouter-routed",
    session_id: "history-session",
    task_kind: "operator_thread",
    provider: "deepseek_chat",
    model: "deepseek/deepseek-v4-pro",
    created_at: "2026-05-05T15:58:00.000Z",
    artifacts: {
      route: "deepseek_via_openrouter",
      openrouter_model: "deepseek/deepseek-v4-pro",
      openrouter_provider_routing: { order: ["DeepSeek"] },
      openrouter_usage: { prompt_tokens: 4_000, completion_tokens: 200, cost: 0.0019 },
    },
  },
  {
    id: "history-zai",
    session_id: "history-session",
    task_kind: "support_triage",
    provider: "zai_glm",
    model: "glm-5.3",
    created_at: "2026-05-05T12:00:00.000Z",
    artifacts: {
      provider: "zai_glm",
      model: "glm-5.3",
      route: "deepseek_official_direct",
      prompt_tokens: 6_000,
      completion_tokens: 500,
      total_tokens: 6_500,
      cached_tokens: 2_000,
      cost_usd: null,
    },
  },
];

const expectedAtA8815c4a7 = [
  { run_id: "fixture-openrouter-nested", provider: "deepseek_chat", route: "deepseek_via_openrouter", model: "deepseek/deepseek-v4-flash", upstream_provider: "DeepSeek", provider_route: "DeepSeek", prompt_tokens: 1800, completion_tokens: 120, cached_tokens: 300, cache_write_tokens: 80, reasoning_tokens: 30, cost_usd: 0.021, cost_estimate_usd: 0.021, conservative_spend_usd: 0.021, cost_status: "model_pricing_estimate_not_official_billing" },
  { run_id: "fixture-direct-cache", provider: "deepseek_chat", route: "deepseek_official_direct", model: "deepseek-v4-flash", upstream_provider: "unknown", provider_route: "unknown", prompt_tokens: 900, completion_tokens: 90, cached_tokens: 760, cache_write_tokens: 0, reasoning_tokens: 0, cost_usd: 0, cost_estimate_usd: 4.6928e-05, conservative_spend_usd: 4.6928e-05, cost_status: "model_pricing_estimate_not_official_billing" },
  { run_id: "fixture-no-change", provider: "deepseek_chat", route: "deepseek_via_openrouter", model: "deepseek/deepseek-v4-flash", upstream_provider: "unknown", provider_route: "unknown", prompt_tokens: 2400, completion_tokens: 140, cached_tokens: 120, cache_write_tokens: 0, reasoning_tokens: 0, cost_usd: 0.032, cost_estimate_usd: 0.032, conservative_spend_usd: 0.032, cost_status: "model_pricing_estimate_not_official_billing" },
  { run_id: "fixture-duplicate-suppressed", provider: "deepseek_chat", route: "deepseek_via_openrouter", model: "deepseek/deepseek-v4-flash", upstream_provider: "unknown", provider_route: "unknown", prompt_tokens: 0, completion_tokens: 0, cached_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0, cost_usd: 0, cost_estimate_usd: 0, conservative_spend_usd: 0, cost_status: "model_pricing_estimate_not_official_billing" },
  { run_id: "history-direct-deepseek", provider: "deepseek_chat", route: "deepseek_official_direct", model: "deepseek-v4-pro", upstream_provider: "unknown", provider_route: "unknown", prompt_tokens: 12000, completion_tokens: 800, cached_tokens: 9000, cache_write_tokens: 0, reasoning_tokens: 300, cost_usd: null, cost_estimate_usd: 0.002033625, conservative_spend_usd: 0.002033625, cost_status: "model_pricing_estimate_not_official_billing" },
  { run_id: "history-openrouter-usage", provider: "deepseek_chat", route: "deepseek_via_openrouter", model: "deepseek/deepseek-v4-pro", upstream_provider: "unknown", provider_route: "DeepSeek>Fireworks", prompt_tokens: 20000, completion_tokens: 1200, cached_tokens: 15000, cache_write_tokens: 0, reasoning_tokens: 400, cost_usd: 0, cost_estimate_usd: 0.003273375, conservative_spend_usd: 0.003273375, cost_status: "model_pricing_estimate_not_official_billing" },
  { run_id: "history-openrouter-routed", provider: "deepseek_chat", route: "deepseek_via_openrouter", model: "deepseek/deepseek-v4-pro", upstream_provider: "unknown", provider_route: "DeepSeek", prompt_tokens: 4000, completion_tokens: 200, cached_tokens: 0, cache_write_tokens: 0, reasoning_tokens: 0, cost_usd: 0.0019, cost_estimate_usd: 0.0019, conservative_spend_usd: 0.0019, cost_status: "model_pricing_estimate_not_official_billing" },
  { run_id: "history-zai", provider: "zai_glm", route: "deepseek_official_direct", model: "glm-5.3", upstream_provider: "unknown", provider_route: "unknown", prompt_tokens: 6000, completion_tokens: 500, cached_tokens: 2000, cache_write_tokens: 0, reasoning_tokens: 0, cost_usd: null, cost_estimate_usd: 0.00195, conservative_spend_usd: 0.00195, cost_status: "model_pricing_unknown" },
];

describe("stored runs of removed providers keep their cost (history)", () => {
  const runs = [...(fixtureRuns as Array<Record<string, unknown>>), ...historyRuns] as never[];

  it("computes the same cost, tokens, route and model as before the removal", () => {
    const keys = Object.keys(expectedAtA8815c4a7[0]);
    const actual = runs.map((run) => {
      const telemetry = extractAgentCostTelemetry(run) as unknown as Record<string, unknown>;
      return Object.fromEntries(keys.map((key) => [key, telemetry[key]]));
    });
    expect(actual).toEqual(expectedAtA8815c4a7);
  });

  it("keeps the rolling spend totals over windows that contain those runs", () => {
    const pick = (nowIso: string) => Object.fromEntries(Object.entries(
      summarizeRollingAgentSpend(runs, { nowMs: Date.parse(nowIso) }).windows,
    ).map(([window, value]) => [window, { runs: value.runs, cost_usd: value.cost_usd, prompt_tokens: value.prompt_tokens }]));
    expect(pick("2026-05-05T16:05:00.000Z")).toEqual({ last15m: { runs: 2, cost_usd: 0.003933625, prompt_tokens: 16000 }, lastHour: { runs: 3, cost_usd: 0.007207, prompt_tokens: 36000 }, lastDay: { runs: 4, cost_usd: 0.009157, prompt_tokens: 42000 } });
    expect(pick("2026-05-15T12:30:00.000Z")).toEqual({ last15m: { runs: 0, cost_usd: 0, prompt_tokens: 0 }, lastHour: { runs: 4, cost_usd: 0.053046928, prompt_tokens: 5100 }, lastDay: { runs: 4, cost_usd: 0.053046928, prompt_tokens: 5100 } });
  });

  it("keeps the summary rows those runs fall into", () => {
    const rows = summarizeAgentCostTelemetry(runs).rows.map((row) => `${row.provider}|${row.route}|${row.model}`).sort();
    expect(rows).toEqual(["deepseek_chat|deepseek_official_direct|deepseek-v4-flash", "deepseek_chat|deepseek_official_direct|deepseek-v4-pro", "deepseek_chat|deepseek_via_openrouter|deepseek/deepseek-v4-flash", "deepseek_chat|deepseek_via_openrouter|deepseek/deepseek-v4-flash", "deepseek_chat|deepseek_via_openrouter|deepseek/deepseek-v4-pro", "deepseek_chat|deepseek_via_openrouter|deepseek/deepseek-v4-pro", "zai_glm|deepseek_official_direct|glm-5.3"]);
  });

  it("is history only: nothing in it is exported, so provider selection cannot reach it", async () => {
    // Selection refusing the removed ids is covered by provider-removal-resolution.test.ts.
    const exported = Object.keys(await import("../utils/agentCostTelemetry"));
    expect(exported.filter((name) => /deepseek|openrouter|zai|glm/i.test(name))).toEqual([]);
  });
});
