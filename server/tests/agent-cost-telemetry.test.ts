// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  extractAgentCostTelemetry,
  summarizeAgentCostTelemetry,
  summarizeRollingAgentSpend,
} from "../utils/agentCostTelemetry";

describe("agent cost telemetry", () => {
  it("summarizes cache ratio and cost across direct DeepSeek and OpenRouter usage schemas", () => {
    const summary = summarizeAgentCostTelemetry([
      {
        task_kind: "support_triage",
        provider: "deepseek_chat",
        model: "deepseek-v4-flash",
        artifacts: {
          route: "deepseek_official_direct",
          prompt_tokens: 100,
          completion_tokens: 20,
          prompt_cache_hit_tokens: 70,
          prompt_cache_miss_tokens: 30,
        },
      },
      {
        task_kind: "support_triage",
        provider: "deepseek_chat",
        model: "deepseek/deepseek-v4-flash",
        artifacts: {
          route: "deepseek_via_openrouter",
          openrouter_provider: "DeepSeek",
          prompt_tokens: 200,
          completion_tokens: 50,
          cached_tokens: 120,
          cache_write_tokens: 40,
          reasoning_tokens: 9,
          cost_usd: 0.004,
        },
      },
    ]);

    expect(summary.rows).toEqual([
      expect.objectContaining({
        task_kind: "support_triage",
        provider: "deepseek_chat",
        route: "deepseek_official_direct",
        model: "deepseek-v4-flash",
        calls: 1,
        prompt_tokens: 100,
        cached_tokens: 70,
        cache_hit_ratio: 0.7,
        cost_usd: 0,
      }),
      expect.objectContaining({
        task_kind: "support_triage",
        provider: "deepseek_chat",
        route: "deepseek_via_openrouter",
        model: "deepseek/deepseek-v4-flash",
        provider_route: "DeepSeek",
        calls: 1,
        prompt_tokens: 200,
        cached_tokens: 120,
        cache_write_tokens: 40,
        reasoning_tokens: 9,
        cache_hit_ratio: 0.6,
        cost_usd: 0.004,
      }),
    ]);
  });

  it("extracts request-level cost telemetry with issue id, upstream provider, and estimates", () => {
    const telemetry = extractAgentCostTelemetry({
      id: "run-1",
      session_id: "session-1",
      task_kind: "operator_thread",
      provider: "deepseek_chat",
      model: "deepseek/deepseek-v4-pro",
      metadata: {
        issue_id: "BLU-123",
        managedRuntime: {
          profileSnapshot: {
            key: "blueprint-chief-of-staff",
          },
        },
      },
      artifacts: {
        route: "deepseek_via_openrouter",
        openrouter_provider: "DeepSeek",
        openrouter_model: "deepseek/deepseek-v4-pro",
        prompt_tokens: 32_000,
        completion_tokens: 500,
        cached_tokens: 24_000,
        cache_write_tokens: 6_000,
        reasoning_tokens: 200,
      },
      created_at: "2026-05-05T16:00:00.000Z",
    });

    expect(telemetry).toMatchObject({
      run_id: "run-1",
      session_id: "session-1",
      issue_id: "BLU-123",
      agent_key: "blueprint-chief-of-staff",
      task_kind: "operator_thread",
      provider: "deepseek_chat",
      route: "deepseek_via_openrouter",
      model: "deepseek/deepseek-v4-pro",
      upstream_provider: "DeepSeek",
      prompt_tokens: 32_000,
      completion_tokens: 500,
      cached_tokens: 24_000,
      cache_write_tokens: 6_000,
      reasoning_tokens: 200,
      cache_hit_ratio: 0.75,
      cost_usd: 0,
    });
    expect(telemetry.cost_estimate_usd).toBeGreaterThan(0);
  });

  it("summarizes rolling 15m/hour/day spend and classifies warn/stop thresholds", () => {
    const summary = summarizeRollingAgentSpend(
      [
        {
          id: "run-new",
          task_kind: "operator_thread",
          provider: "deepseek_chat",
          model: "deepseek/deepseek-v4-flash",
          artifacts: { cost_usd: 0.04, prompt_tokens: 1000 },
          created_at: "2026-05-05T16:00:00.000Z",
        },
        {
          id: "run-hour",
          task_kind: "operator_thread",
          provider: "deepseek_chat",
          model: "deepseek/deepseek-v4-flash",
          artifacts: { cost_usd: 0.03, prompt_tokens: 1000 },
          created_at: "2026-05-05T15:30:00.000Z",
        },
        {
          id: "run-day",
          task_kind: "support_triage",
          provider: "deepseek_chat",
          model: "deepseek/deepseek-v4-pro",
          artifacts: { cost_usd: 0.2, prompt_tokens: 1000 },
          created_at: "2026-05-05T08:00:00.000Z",
        },
      ],
      {
        nowMs: Date.parse("2026-05-05T16:05:00.000Z"),
        warnUsd: { last15m: 0.03, lastHour: 0.06, lastDay: 0.25 },
        stopUsd: { last15m: 0.05, lastHour: 0.1, lastDay: 0.3 },
      },
    );

    expect(summary.windows.last15m).toMatchObject({ runs: 1, cost_usd: 0.04, status: "warn" });
    expect(summary.windows.lastHour).toMatchObject({ runs: 2, cost_usd: 0.07, status: "warn" });
    expect(summary.windows.lastDay).toMatchObject({ runs: 3, cost_usd: 0.27, status: "warn" });
    expect(summary.by_agent["operator_thread"].lastHour).toMatchObject({
      runs: 2,
      cost_usd: 0.07,
      status: "warn",
    });
  });
});
