import type { AgentProvider } from "./types";

/**
 * Providers that recently answered "no funds", kept for a short cool-down so a
 * lane does not call them on every task. Held in this process only: the web
 * service and the worker each learn it from their own first failed call.
 * Nothing here changes any cap or price.
 */
const DEFAULT_NO_FUNDS_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_NO_FUNDS_COOLDOWN_MS = 24 * 60 * 60 * 1000;

type OutOfFunds = { since_ms: number; until_ms: number; error_type: string | null; error_code: string | null; http_status: number | null };
const outOfFunds = new Map<AgentProvider, OutOfFunds>();

export function getNoFundsCooldownMs(): number {
  const parsed = Number(process.env.BLUEPRINT_PROVIDER_NO_FUNDS_COOLDOWN_MS ?? DEFAULT_NO_FUNDS_COOLDOWN_MS);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, MAX_NO_FUNDS_COOLDOWN_MS) : DEFAULT_NO_FUNDS_COOLDOWN_MS;
}

export function markProviderOutOfFunds(provider: AgentProvider,
  detail: { type: string | null; code: string | null; status: number | null }, nowMs = Date.now()) {
  outOfFunds.set(provider, { since_ms: nowMs, until_ms: nowMs + getNoFundsCooldownMs(),
    error_type: detail.type, error_code: detail.code, http_status: detail.status });
}

export function isProviderCoolingDown(provider: AgentProvider, nowMs = Date.now()): boolean {
  const entry = outOfFunds.get(provider);
  if (!entry) return false;
  if (entry.until_ms <= nowMs) {
    outOfFunds.delete(provider);
    return false;
  }
  return true;
}

/** For the connectivity view: which providers said "no funds", since when, and until when they are skipped. */
export function listProvidersOutOfFunds(nowMs = Date.now()) {
  return [...outOfFunds.keys()].filter((provider) => isProviderCoolingDown(provider, nowMs)).map((provider) => {
    const entry = outOfFunds.get(provider)!;
    return { provider, since: new Date(entry.since_ms).toISOString(), retry_after: new Date(entry.until_ms).toISOString(),
      error_type: entry.error_type, error_code: entry.error_code, http_status: entry.http_status };
  });
}

export function resetProviderFundsStateForTests() {
  outOfFunds.clear();
}
