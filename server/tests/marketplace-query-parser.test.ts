import { describe, it, expect } from "vitest";

import {
  parseMarketplaceQuery,
  type MarketplaceQueryParserContext,
} from "../utils/marketplaceQueryParser";

function ctx(locationTypes: string[]): MarketplaceQueryParserContext {
  return {
    knownLocationTypes: locationTypes,
    knownPolicies: [],
    knownObjectTags: [],
  };
}

describe("marketplace query parser — Factory / Manufacturing facet (R070)", () => {
  const withFactory = ctx([
    "Kitchens",
    "Warehouses",
    "Factory / Manufacturing",
    "Labs",
  ]);

  it("resolves factory/manufacturing/assembly terms to the Factory facet", () => {
    for (const q of [
      "assembly line captures",
      "manufacturing plant scenes",
      "factory floor",
      "production line episodes",
      "line-side kitting",
    ]) {
      const parsed = parseMarketplaceQuery(q, withFactory);
      expect(parsed.hard.locationType).toBe("Factory / Manufacturing");
    }
  });

  it("no longer mislabels 'assembly' as Labs when only Labs is available", () => {
    // Regression guard for the prior bug where 'assembly' matched the Labs facet.
    const labsOnly = ctx(["Kitchens", "Labs"]);
    const parsed = parseMarketplaceQuery("assembly line", labsOnly);
    expect(parsed.hard.locationType).toBeUndefined();
  });

  it("still resolves a genuine lab query to Labs", () => {
    const parsed = parseMarketplaceQuery("lab bench manipulation", withFactory);
    expect(parsed.hard.locationType).toBe("Labs");
  });

  it("does not surface the Factory facet when no factory inventory exists", () => {
    // Honest supply: the facet is gated on real inventory (available.has), so a
    // factory query returns no location facet until factory captures are listed.
    const noFactory = ctx(["Kitchens", "Warehouses", "Labs"]);
    const parsed = parseMarketplaceQuery("factory floor", noFactory);
    expect(parsed.hard.locationType).toBeUndefined();
  });

  it("keeps the existing Warehouses facet working", () => {
    const parsed = parseMarketplaceQuery("warehouse pallet racking", withFactory);
    expect(parsed.hard.locationType).toBe("Warehouses");
  });
});
