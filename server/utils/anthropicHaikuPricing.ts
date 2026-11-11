/** Native Claude API prices verified 2026-10-07; estimates are not invoices. */
export const HAIKU_MODEL = "claude-haiku-5-5";
export const ANTHROPIC_BASE_URL = "https://api.anthropic.com";
export function isNativeAnthropicConfigured() {
  const base = process.env.ANTHROPIC_BASE_URL?.trim().replace(/\/$/, "");
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim()) && (!base || base === ANTHROPIC_BASE_URL);
}
export function isGpt6Luna(model: string) {
  return /^gpt-6-luna(?:-\d{4}-\d{2}-\d{2})?$/.test(model.trim());
}
function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
/** Each response has its own long-context tier, even in a multi-turn task. */
export function haikuUsageCost(usage: Record<string, unknown>) {
  const input = count(usage.input_tokens), output = count(usage.output_tokens);
  const read = count(usage.cache_read_input_tokens ?? 0), write = count(usage.cache_creation_input_tokens ?? 0);
  if (input === null || output === null || read === null || write === null) return null;
  const creation = usage.cache_creation as Record<string, unknown> | undefined;
  const hour = count(creation?.ephemeral_1h_input_tokens ?? 0);
  const five = count(creation?.ephemeral_5m_input_tokens ?? write);
  if (hour === null || five === null || hour + five !== write) return null;
  const multiplier = (input + read + write > 100_000 ? 5 : 1)
    * (usage.inference_geo === "global" ? 1 : 1.1);
  const uncachedInputCost = multiplier * input * 0.10 / 1_000_000;
  const cachedReadCost = multiplier * read * 0.01 / 1_000_000;
  const cacheWriteCost = multiplier * (five * 0.125 + hour * 0.20) / 1_000_000;
  const outputCost = multiplier * output * 0.50 / 1_000_000;
  const withoutCachingCost = multiplier * ((input + read + write) * 0.10 + output * 0.50) / 1_000_000;
  return { uncachedInputCost, cachedReadCost, cacheWriteCost, outputCost,
    withoutCachingCost, totalCost: uncachedInputCost + cachedReadCost + cacheWriteCost + outputCost };
}
