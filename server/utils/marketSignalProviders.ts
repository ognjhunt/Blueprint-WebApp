import { getConfiguredEnvValue } from "../config/env";
import { createFirehoseMarketSignalProvider } from "./marketSignalProviderFirehose";
import {
  createWebSearchMarketSignalProvider,
  fetchWebSearchSignals,
} from "./marketSignalProviderWebSearch";

export type MarketSignalProviderKey = "web_search" | "firehose";

export interface MarketSignalRecord {
  id: string;
  topic: string;
  title: string;
  summary: string;
  url?: string | null;
  source?: string | null;
  publishedAt?: string | null;
}

export interface MarketSignalFetchOptions {
  limit?: number;
  since?: string;
}

export interface MarketSignalFetchResult {
  providerKey: MarketSignalProviderKey;
  signals: MarketSignalRecord[];
}

export interface MarketSignalProvider {
  key: MarketSignalProviderKey;
  fetchSignals(topic: string, options?: MarketSignalFetchOptions): Promise<MarketSignalFetchResult>;
}

export interface MarketSignalProviderStatus {
  configured: boolean;
  optional: boolean;
  providerKey: MarketSignalProviderKey | null;
  availableProviderKeys: MarketSignalProviderKey[];
  note: string;
}

function normalizeProviderPreference(value: string | null) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");
  return normalized === "web_search" || normalized === "firehose"
    ? normalized
    : null;
}

function listAvailableProviders() {
  return [
    createWebSearchMarketSignalProvider(),
    createFirehoseMarketSignalProvider(),
  ].filter((provider): provider is MarketSignalProvider => Boolean(provider));
}

function selectProvider() {
  const availableProviders = listAvailableProviders();
  const explicitPreference = normalizeProviderPreference(
    getConfiguredEnvValue("BLUEPRINT_MARKET_SIGNAL_PROVIDER"),
  );

  if (explicitPreference) {
    return {
      selectedProvider:
        availableProviders.find((provider) => provider.key === explicitPreference) || null,
      availableProviders,
      explicitPreference,
    };
  }

  return {
    selectedProvider:
      availableProviders.find((provider) => provider.key === "web_search")
      || availableProviders.find((provider) => provider.key === "firehose")
      || null,
    availableProviders,
    explicitPreference: null,
  };
}

export function resolveMarketSignalProvider(): MarketSignalProvider | null {
  return selectProvider().selectedProvider;
}

export function hasConfiguredMarketSignalProvider() {
  return Boolean(resolveMarketSignalProvider());
}

export function getMarketSignalProviderStatus(): MarketSignalProviderStatus {
  const { selectedProvider, availableProviders, explicitPreference } = selectProvider();
  const availableProviderKeys = availableProviders.map((provider) => provider.key);

  if (selectedProvider?.key === "web_search") {
    return {
      configured: true,
      optional: true,
      providerKey: selectedProvider.key,
      availableProviderKeys,
      note: availableProviderKeys.includes("firehose")
        ? "Deterministic web search is the default market-signal provider. Firehose remains an optional adapter."
        : "Deterministic web search is configured for scheduled market-signal discovery.",
    };
  }

  if (selectedProvider?.key === "firehose") {
    return {
      configured: true,
      optional: true,
      providerKey: selectedProvider.key,
      availableProviderKeys,
      note: "Firehose is configured as an optional market-signal adapter. Deterministic web search is not currently configured.",
    };
  }

  return {
    configured: false,
    optional: true,
    providerKey: null,
    availableProviderKeys,
    note: explicitPreference
      ? `Requested market-signal provider "${explicitPreference}" is not configured.`
      : "No market-signal provider is configured. Use SEARCH_API_KEY with SEARCH_API_PROVIDER=brave for deterministic web search, or configure the optional Firehose adapter.",
  };
}

export { fetchWebSearchSignals };
