// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  docs: [] as Array<{ id: string; data: () => Record<string, unknown> }>,
}));

vi.mock("../../client/src/lib/firebaseAdmin", () => ({
  dbAdmin: {
    collection: (name: string) => {
      if (name === "marketplace_items") {
        return {
          limit: () => ({
            get: async () => ({ docs: state.docs }),
          }),
        };
      }
      return {
        findNearest: undefined,
      };
    },
  },
}));

vi.mock("../retrieval/embeddings", () => ({
  embedTexts: async (texts: string[]) => texts.map(() => [1, 0, 0]),
}));

describe("marketplace live inventory fallback", () => {
  beforeEach(() => {
    state.docs = [];
  });

  it("prefers published Firestore inventory over the static catalog when available", async () => {
    state.docs = [
      {
        id: "scene-live-1",
        data: () => ({
          sku: "scene-live-1",
          type: "scene",
          status: "published",
          title: "Live Warehouse Scene",
          description: "Published from live Firestore inventory.",
          thumbnail: "https://example.com/thumb.png",
          locationType: "Warehouses",
          policySlugs: ["case-picking"],
          objectTags: ["tote", "shelf"],
          price: 1200,
          releaseDate: "2026-03-20",
          tags: ["live"],
          deliverables: ["scene package"],
          searchDoc: "Live Warehouse Scene Warehouses tote shelf",
        }),
      },
    ];

    const { __resetMarketplaceSearchCacheForTests, searchMarketplace } = await import(
      "../retrieval/marketplaceSearch"
    );
    __resetMarketplaceSearchCacheForTests();

    const response = await searchMarketplace({
      query: "warehouse tote scene",
      limit: 10,
      filters: { itemType: "all", sort: "relevance" },
      hard: {},
      soft: {},
    });

    expect(response.meta.backend).toBe("firestore-live");
    expect(response.results[0]?.item.slug).toBe("scene-live-1");
    expect(response.results[0]?.item.title).toBe("Live Warehouse Scene");
  });
});
