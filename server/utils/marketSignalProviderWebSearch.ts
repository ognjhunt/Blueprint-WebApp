import { createHash } from "node:crypto";

import { webSearch, type WebSearchConfig } from "../../ops/paperclip/plugins/blueprint-automation/src/web-search";
import { getConfiguredEnvValue } from "../config/env";
import type {
  MarketSignalFetchResult,
  MarketSignalProvider,
  MarketSignalRecord,
} from "./marketSignalProviders";

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

function normalizeProviderPreference(value: string | null) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return normalized === "brave" ||
    normalized === "parallel_mcp" ||
    normalized === "parallel" ||
    normalized === "perplexity"
    ? normalized
    : null;
}

function buildWebSearchConfig(): WebSearchConfig | null {
  const provider = normalizeProviderPreference(getConfiguredEnvValue("SEARCH_API_PROVIDER")) || "brave";

  if (provider === "parallel_mcp" || provider === "parallel") {
    return {
      provider,
      apiKey: getConfiguredEnvValue("PARALLEL_API_KEY") || undefined,
    };
  }

  const apiKey = getConfiguredEnvValue("SEARCH_API_KEY");
  if (!apiKey) {
    return null;
  }

  return {
    provider,
    apiKey,
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

function parseWebSearchSignals(
  topic: string,
  provider: string,
  answer: string,
  citations: string[],
): MarketSignalRecord[] {
  const lines = answer
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const signals = lines
    .map((line, index): MarketSignalRecord | null => {
      const body = line.replace(/^-\s*/, "");
      const citation = citations[index] ? canonicalizeUrl(citations[index]) : null;

      let title = "";
      let summary = "";
      let url = citation;

      const parallelMatch = body.match(/^(.+?)\s+\((https?:\/\/[^)]+)\):\s*(.+)$/);
      if (parallelMatch) {
        title = parallelMatch[1] ?? "";
        url = canonicalizeUrl(parallelMatch[2] ?? "");
        summary = parallelMatch[3] ?? "";
      } else {
        const colonIndex = body.indexOf(": ");
        if (colonIndex >= 0) {
          title = body.slice(0, colonIndex).trim();
          summary = body.slice(colonIndex + 2).trim();
        } else {
          title = body.trim();
          summary = body.trim();
        }
      }

      title = stripHtml(normalizeString(title));
      summary = stripHtml(normalizeString(summary));

      if (!title || !summary) {
        return null;
      }

      return {
        id: buildStableSignalId(topic, url, title),
        topic,
        title,
        summary,
        url,
        source: `web_search:${provider}`,
        publishedAt: null,
      };
    })
    .filter((signal): signal is MarketSignalRecord => Boolean(signal));

  return dedupeSignals(signals);
}

export async function fetchWebSearchSignals(input: {
  topic: string;
  limit?: number;
  since?: string;
}): Promise<MarketSignalFetchResult> {
  const config = buildWebSearchConfig();
  if (!config) {
    throw new Error("Deterministic web search is not configured");
  }

  const result = await webSearch(config, input.topic);
  const signals = parseWebSearchSignals(
    input.topic,
    config.provider,
    result.answer || "",
    result.citations || [],
  );

  return {
    providerKey: "web_search",
    signals,
  };
}

export function createWebSearchMarketSignalProvider(): MarketSignalProvider | null {
  if (!buildWebSearchConfig()) {
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
