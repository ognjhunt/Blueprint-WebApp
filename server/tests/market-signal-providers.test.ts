// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchWebSearchSignals,
  resolveMarketSignalProvider,
} from "../utils/marketSignalProviders";

describe("market signal providers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("normalizes deterministic web-search results into stable market signals", async () => {
    vi.stubEnv("SEARCH_API_KEY", "search-key");
    vi.stubEnv("SEARCH_API_PROVIDER", "brave");

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        web: {
          results: [
            {
              title: "Warehouse automation teams narrow pilot sites",
              url: "https://example.com/post-1",
              description: "Operators are selecting exact facilities earlier.",
              extra_snippets: ["Travel-heavy reviews are being compressed."],
            },
            {
              title: "Warehouse automation teams narrow pilot sites",
              url: "https://example.com/post-1?utm_source=test",
              description: "Duplicate result with tracking params.",
            },
            {
              title: "Field robotics deployments favor exact-site validation",
              url: "https://example.com/post-2",
              description: "Teams want grounded site evidence before expansion.",
            },
          ],
        },
      }),
    } as Response);

    const result = await fetchWebSearchSignals({
      topic: "warehouse robotics",
    });

    expect(result.providerKey).toBe("web_search");
    expect(result.signals).toHaveLength(2);
    expect(result.signals[0]).toEqual(
      expect.objectContaining({
        topic: "warehouse robotics",
        title: "Warehouse automation teams narrow pilot sites",
        url: "https://example.com/post-1",
        source: "web_search:brave",
      }),
    );
    expect(result.signals[0]?.summary).toContain("Operators are selecting exact facilities earlier.");
  });

  it("prefers web search over Firehose when both are configured", () => {
    vi.stubEnv("SEARCH_API_KEY", "search-key");
    vi.stubEnv("SEARCH_API_PROVIDER", "brave");
    vi.stubEnv("FIREHOSE_API_TOKEN", "fh-token");
    vi.stubEnv("FIREHOSE_BASE_URL", "https://firehose.test");

    const provider = resolveMarketSignalProvider();

    expect(provider?.key).toBe("web_search");
  });

  it("supports explicitly selecting the optional Firehose adapter", () => {
    vi.stubEnv("BLUEPRINT_MARKET_SIGNAL_PROVIDER", "firehose");
    vi.stubEnv("SEARCH_API_KEY", "search-key");
    vi.stubEnv("SEARCH_API_PROVIDER", "brave");
    vi.stubEnv("FIREHOSE_API_TOKEN", "fh-token");
    vi.stubEnv("FIREHOSE_BASE_URL", "https://firehose.test");

    const provider = resolveMarketSignalProvider();

    expect(provider?.key).toBe("firehose");
  });
});
