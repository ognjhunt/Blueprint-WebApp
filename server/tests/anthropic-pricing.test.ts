// @vitest-environment node
import { describe, expect, it } from "vitest";

import { anthropicRequestCost } from "../utils/anthropicPricing";

/**
 * The published list prices, written out here as a second source, so a typo
 * in a price row fails. Per million tokens: input, output, cache read,
 * 5-minute cache write (Anthropic's model table, as listed 2026-11-03; cache
 * reads not listed are 0.1x input, cache writes 1.25x input).
 */
const PUBLISHED: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-fable-5-2": { input: 8, output: 40, cacheRead: 0.2, cacheWrite: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
};

const one = (field: "input_tokens" | "output_tokens" | "cache_read_input_tokens" | "cache_creation_input_tokens", tokens = 50_000) => ({
  input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, [field]: tokens,
});

describe("Anthropic price rows", () => {
  it.each(Object.entries(PUBLISHED))("%s is priced at its published rates", (model, rates) => {
    expect(anthropicRequestCost(model, one("input_tokens"))!.estimated_total_cost_usd).toBeCloseTo(0.05 * rates.input, 12);
    expect(anthropicRequestCost(model, one("output_tokens"))!.estimated_total_cost_usd).toBeCloseTo(0.05 * rates.output, 12);
    expect(anthropicRequestCost(model, one("cache_read_input_tokens"))!.estimated_total_cost_usd).toBeCloseTo(0.05 * rates.cacheRead, 12);
    expect(anthropicRequestCost(model, one("cache_creation_input_tokens"))!.estimated_total_cost_usd).toBeCloseTo(0.05 * rates.cacheWrite, 12);
  });

  it("charges the small model five times its rates above a 100,000-token prompt, per request, cached tokens included", () => {
    const under = anthropicRequestCost("claude-haiku-5-5", { input_tokens: 60_000, output_tokens: 1_000, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 0 })!;
    expect(under.estimated_total_cost_usd).toBeCloseTo((60_000 * 0.1 + 40_000 * 0.01 + 1_000 * 0.5) / 1e6, 12);
    const over = anthropicRequestCost("claude-haiku-5-5", { input_tokens: 60_001, output_tokens: 1_000, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 0 })!;
    expect(over.estimated_total_cost_usd).toBeCloseTo(5 * (60_001 * 0.1 + 40_000 * 0.01 + 1_000 * 0.5) / 1e6, 12);
  });

  it.each(Object.keys(PUBLISHED).filter((model) => model !== "claude-haiku-5-5"))("%s has no long-prompt premium", (model) => {
    const rates = PUBLISHED[model];
    expect(anthropicRequestCost(model, one("input_tokens", 900_000))!.estimated_total_cost_usd).toBeCloseTo(0.9 * rates.input, 12);
  });

  it("prices nothing it has no published row for", () => {
    expect(anthropicRequestCost("claude-sonnet-4-5", one("input_tokens"))).toBeNull();
  });
});
