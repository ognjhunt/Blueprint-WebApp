import {
  fetchFirehoseSignals as fetchNormalizedFirehoseSignals,
  type FirehoseConfig,
} from "../../ops/paperclip/plugins/blueprint-automation/src/marketing-integrations";
import { getConfiguredEnvValue } from "../config/env";
import type {
  MarketSignalFetchResult,
  MarketSignalProvider,
  MarketSignalRecord,
} from "./marketSignalProviders";

export function buildFirehoseConfig(): FirehoseConfig | null {
  const apiToken = getConfiguredEnvValue("FIREHOSE_API_TOKEN");
  const baseUrl = getConfiguredEnvValue("FIREHOSE_BASE_URL");

  if (!apiToken || !baseUrl) {
    return null;
  }

  return {
    apiToken,
    baseUrl,
  };
}

export async function fetchFirehoseMarketSignals(input: {
  topic: string;
  limit?: number;
  since?: string;
}): Promise<MarketSignalFetchResult> {
  const config = buildFirehoseConfig();
  if (!config) {
    // Return empty result instead of throwing to allow Analytics Daily to proceed with other sources
    console.warn("Firehose is not configured: missing FIREHOSE_API_TOKEN or FIREHOSE_BASE_URL. Skipping Firehose signals.");
    return {
      providerKey: "firehose",
      signals: [],
    };
  }

  try {
    const result = await fetchNormalizedFirehoseSignals(config, {
      query: input.topic,
      topics: [input.topic],
      limit: input.limit,
      since: input.since,
    });

    const signals: MarketSignalRecord[] = result.signals.map((signal) => ({
      id: signal.id,
      topic: signal.topic || input.topic,
      title: signal.title,
      summary: signal.summary,
      url: signal.url || null,
      source: signal.source || "firehose",
      publishedAt: signal.publishedAt || null,
    }));

    return {
      providerKey: "firehose",
      signals,
    };
  } catch (error) {
    console.error("Firehose signal fetch failed:", error);
    return {
      providerKey: "firehose",
      signals: [],
    };
  }
}

export function createFirehoseMarketSignalProvider(): MarketSignalProvider | null {
  if (!buildFirehoseConfig()) {
    return null;
  }

  return {
    key: "firehose",
    fetchSignals(topic, options) {
      return fetchFirehoseMarketSignals({
        topic,
        limit: options?.limit,
        since: options?.since,
      });
    },
  };
}
