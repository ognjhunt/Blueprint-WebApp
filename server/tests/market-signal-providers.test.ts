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
    vi.stubEnv("SEARCH_API_PROVIDER", "parallel_mcp");
    vi.stubEnv("SEARCH_API_KEY", "");
    vi.stubEnv("PARALLEL_API_KEY", "");

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          structuredContent: {
            results: [
              {
                title: "Warehouse automation teams narrow pilot sites",
                url: "https://example.com/post-1",
                excerpts: [
                  "Operators are selecting exact facilities earlier.",
                  "Travel-heavy reviews are being compressed.",
                ],
              },
              {
                title: "Field robotics deployments favor exact-site validation",
                url: "https://example.com/post-2",
                excerpts: ["Teams want grounded site evidence before expansion."],
              },
            ],
          },
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
        source: "web_search:parallel_mcp",
      }),
    );
    expect(result.signals[0]?.summary).toContain("Operators are selecting exact facilities earlier.");
  });

  it("prefers web search over Firehose when both are configured", () => {
    vi.stubEnv("SEARCH_API_PROVIDER", "parallel_mcp");
    vi.stubEnv("SEARCH_API_KEY", "");
    vi.stubEnv("PARALLEL_API_KEY", "");
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
