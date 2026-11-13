/**
 * Anthropic's published list prices per million tokens (first-party API, as
 * listed 2026-11-03), for every model id the adapter can send. They estimate
 * what a request cost and reserve what one could cost at most; they are a
 * provider's prices, not a cap or a budget. A model without a row is never sent.
 *
 * Cache writes are the 5-minute rate (1.25x input); cache reads are the listed
 * rate where one is listed, otherwise 0.1x input. The small model's rates are
 * 5x when one request's prompt is above 100,000 tokens: the tier applies to a
 * request, never to a sum of requests. Matched on the exact model id: one id
 * is a prefix of another.
 */
export type AnthropicModelPricing = {
  cacheHitInput: number;
  cacheMissInput: number;
  cacheWriteInput: number;
  output: number;
  longContextThreshold?: number;
  longContextInputMultiplier?: number;
  longContextOutputMultiplier?: number;
};

const ANTHROPIC_LIST_PRICING: Record<string, AnthropicModelPricing> = {
  "claude-opus-5-5": { cacheMissInput: 4, cacheWriteInput: 5, cacheHitInput: 0.2, output: 20 },
  "claude-opus-5": { cacheMissInput: 5, cacheWriteInput: 6.25, cacheHitInput: 0.5, output: 25 },
  "claude-opus-4-8": { cacheMissInput: 5, cacheWriteInput: 6.25, cacheHitInput: 0.5, output: 25 },
  "claude-sonnet-5-5": { cacheMissInput: 2, cacheWriteInput: 2.5, cacheHitInput: 0.1, output: 10 },
  "claude-sonnet-5": { cacheMissInput: 2, cacheWriteInput: 2.5, cacheHitInput: 0.2, output: 10 },
  "claude-fable-5-2": { cacheMissInput: 8, cacheWriteInput: 10, cacheHitInput: 0.2, output: 40 },
  "claude-haiku-5-5": {
    cacheMissInput: 0.1, cacheWriteInput: 0.125, cacheHitInput: 0.01, output: 0.5,
    longContextThreshold: 100_000, longContextInputMultiplier: 5, longContextOutputMultiplier: 5,
  },
};

export function anthropicPricingForModel(model: string | null | undefined): AnthropicModelPricing | null {
  return ANTHROPIC_LIST_PRICING[String(model || "").trim().toLowerCase()] ?? null;
}

export type AnthropicRequestCost = {
  uncached_input_cost_usd: number;
  cache_write_cost_usd: number;
  cached_read_cost_usd: number;
  output_cost_usd: number;
  estimated_total_cost_usd: number;
  estimated_cost_without_caching_usd: number;
  estimated_savings_usd: number;
};

export const ANTHROPIC_COST_FIELDS = [
  "uncached_input_cost_usd", "cache_write_cost_usd", "cached_read_cost_usd", "output_cost_usd",
  "estimated_total_cost_usd", "estimated_cost_without_caching_usd", "estimated_savings_usd",
] as const;

/**
 * The cost of ONE request from its own counters (Anthropic's `input_tokens`
 * excludes cache reads and writes). Null when the model has no price row.
 */
export function anthropicRequestCost(model: string | null | undefined, usage: {
  input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number;
}): AnthropicRequestCost | null {
  const pricing = anthropicPricingForModel(model);
  if (!pricing) return null;
  const prompt = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens;
  const longContext = Boolean(pricing.longContextThreshold && prompt > pricing.longContextThreshold);
  const inputMultiplier = longContext ? pricing.longContextInputMultiplier ?? 1 : 1;
  const outputMultiplier = longContext ? pricing.longContextOutputMultiplier ?? 1 : 1;
  const perMillion = (tokens: number, rate: number, multiplier: number) => tokens / 1_000_000 * rate * multiplier;
  const uncached = perMillion(usage.input_tokens, pricing.cacheMissInput, inputMultiplier);
  const written = perMillion(usage.cache_creation_input_tokens, pricing.cacheWriteInput, inputMultiplier);
  const read = perMillion(usage.cache_read_input_tokens, pricing.cacheHitInput, inputMultiplier);
  const output = perMillion(usage.output_tokens, pricing.output, outputMultiplier);
  const total = uncached + written + read + output;
  const withoutCaching = perMillion(prompt, pricing.cacheMissInput, inputMultiplier) + output;
  const round = (value: number) => Number(value.toFixed(12));
  return {
    uncached_input_cost_usd: round(uncached), cache_write_cost_usd: round(written), cached_read_cost_usd: round(read),
    output_cost_usd: round(output), estimated_total_cost_usd: round(total),
    estimated_cost_without_caching_usd: round(withoutCaching), estimated_savings_usd: round(withoutCaching - total),
  };
}

/**
 * The most one request can cost: every input token up to the ceiling at the
 * dearest input rate, every output token up to `max_tokens` billed, at the
 * long-prompt tier when the ceiling crosses it. Null when the model has no row.
 */
export function anthropicWorstCaseRequestUsd(model: string, inputTokenCeiling: number, maxOutputTokens: number): number | null {
  const pricing = anthropicPricingForModel(model);
  if (!pricing) return null;
  const longContext = Boolean(pricing.longContextThreshold && inputTokenCeiling > pricing.longContextThreshold);
  const inputMultiplier = longContext ? pricing.longContextInputMultiplier ?? 1 : 1;
  const outputMultiplier = longContext ? pricing.longContextOutputMultiplier ?? 1 : 1;
  const inputRate = Math.max(pricing.cacheMissInput, pricing.cacheWriteInput, pricing.cacheHitInput);
  return inputTokenCeiling / 1_000_000 * inputRate * inputMultiplier
    + maxOutputTokens / 1_000_000 * pricing.output * outputMultiplier;
}
