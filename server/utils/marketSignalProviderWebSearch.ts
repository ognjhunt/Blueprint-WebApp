import { createHash } from "node:crypto";

import { getConfiguredEnvValue } from "../config/env";
import type {
  MarketSignalFetchOptions,
  MarketSignalFetchResult,
  MarketSignalProvider,
  MarketSignalRecord,
} from "./marketSignalProviders";

type BraveSearchResult = {
  title?: string;
  url?: string;
  description?: string;
  extra_snippets?: string[];
  age?: string;
  page_age?: string;
};

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function canonicalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^utm_/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return value.trim();
  }
}

function buildStableSignalId(topic: string, url: string | null, title: string) {
  const hash = createHash("sha1");
  hash.update(topic);
  hash.update("|");
  hash.update(url || "");
  hash.update("|");
  hash.update(title);
  return `web-search:${hash.digest("hex")}`;
}

function lookbackDaysFrom(options?: MarketSignalFetchOptions) {
  if (typeof options?.since === "string" && options.since.trim()) {
    const ms = Date.now() - Date.parse(options.since);
    if (Number.isFinite(ms) && ms > 0) {
      return Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    }
  }
  return Math.max(
    1,
    Number(getConfiguredEnvValue("BLUEPRINT_MARKET_SIGNAL_LOOKBACK_DAYS") || "7"),
  );
}

function freshnessFromLookbackDays(days: number) {
  if (days <= 1) return "pd";
  if (days <= 7) return "pw";
  if (days <= 31) return "pm";
  return "py";
}

function normalizePublishedAt(result: BraveSearchResult) {
  const raw = normalizeString(result.age) || normalizeString(result.page_age);
  return raw || null;
}

function normalizeWebSearchSignal(topic: string, result: BraveSearchResult): MarketSignalRecord | null {
  const title = stripHtml(normalizeString(result.title));
  const rawUrl = normalizeString(result.url);
  const url = rawUrl ? canonicalizeUrl(rawUrl) : null;
  const description = stripHtml(normalizeString(result.description));
  const extras = Array.isArray(result.extra_snippets)
    ? result.extra_snippets.map((entry) => stripHtml(normalizeString(entry))).filter(Boolean)
    : [];
  const summary = [description, ...extras].filter(Boolean).join(" ").trim();

  if (!title || !summary || !url) {
    return null;
  }

  return {
    id: buildStableSignalId(topic, url, title),
    topic,
    title,
    summary,
    url,
    source: "web_search:brave",
    publishedAt: normalizePublishedAt(result),
  };
}

function dedupeSignals(signals: MarketSignalRecord[]) {
  const deduped = new Map<string, MarketSignalRecord>();
  for (const signal of signals) {
    if (!deduped.has(signal.id)) {
      deduped.set(signal.id, signal);
    }
  }
  return [...deduped.values()];
}

function getWebSearchProviderConfig() {
  const apiKey = getConfiguredEnvValue("SEARCH_API_KEY");
  const provider = (getConfiguredEnvValue("SEARCH_API_PROVIDER") || "brave").toLowerCase();
  const configured = Boolean(apiKey) && provider === "brave";

  return {
    apiKey,
    provider,
    configured,
  };
}

export async function fetchWebSearchSignals(input: {
  topic: string;
  limit?: number;
  since?: string;
  fetchImpl?: typeof fetch;
}): Promise<MarketSignalFetchResult> {
  const config = getWebSearchProviderConfig();
  if (!config.configured || !config.apiKey) {
    throw new Error("Deterministic web search is not configured");
  }

  const count = Math.min(
    Math.max(1, Number(input.limit || getConfiguredEnvValue("BLUEPRINT_MARKET_SIGNAL_LIMIT") || "6")),
    20,
  );
  const freshness = freshnessFromLookbackDays(lookbackDaysFrom({ since: input.since }));
  const params = new URLSearchParams({
    q: input.topic,
    freshness,
    count: String(count),
    extra_snippets: "true",
    country: "US",
    search_lang: "en",
  });

  const response = await (input.fetchImpl || fetch)(
    `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "X-Subscription-Token": config.apiKey,
        Accept: "application/json",
      },
    },
  );

  const payload = (await response.json()) as {
    web?: {
      results?: BraveSearchResult[];
    };
  };

  if (!response.ok) {
    throw new Error(`Web search ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`);
  }

  const signals = dedupeSignals(
    (payload.web?.results || [])
      .map((result) => normalizeWebSearchSignal(input.topic, result))
      .filter((signal): signal is MarketSignalRecord => Boolean(signal)),
  );

  return {
    providerKey: "web_search",
    signals,
  };
}

export function createWebSearchMarketSignalProvider(): MarketSignalProvider | null {
  const config = getWebSearchProviderConfig();
  if (!config.configured || !config.apiKey) {
    return null;
  }

  return {
    key: "web_search",
    fetchSignals(topic, options) {
      return fetchWebSearchSignals({
        topic,
        limit: options?.limit,
        since: options?.since,
      });
    },
  };
}
