import { describe, expect, it } from "vitest";
import { siteWorldCards } from "@/data/siteWorlds";
import {
  buildCatalogRequestCandidate,
  buildCatalogSearchSuggestions,
  classifyCatalogSearch,
} from "@/lib/siteWorldCatalogSearch";

describe("siteWorldCatalogSearch", () => {
  it("generates suggestions from site names, codes, addresses, cities, aliases, workflows, and object tags", () => {
    expect(
      buildCatalogSearchSuggestions(siteWorldCards, "Harborview").some(
        (suggestion) => suggestion.kind === "site" && suggestion.label === "Harborview Grocery Distribution Annex",
      ),
    ).toBe(true);
    expect(
      buildCatalogSearchSuggestions(siteWorldCards, "SW-CHI").some(
        (suggestion) => suggestion.kind === "site_code" && suggestion.label === "SW-CHI-01",
      ),
    ).toBe(true);
    expect(
      buildCatalogSearchSuggestions(siteWorldCards, "1847 W Fulton").some(
        (suggestion) => suggestion.kind === "address",
      ),
    ).toBe(true);
    expect(
      buildCatalogSearchSuggestions(siteWorldCards, "Chicago").some(
        (suggestion) => suggestion.kind === "city" && suggestion.label === "Chicago, IL",
      ),
    ).toBe(true);
    expect(
      buildCatalogSearchSuggestions(siteWorldCards, "Whole Foods").some(
        (suggestion) => suggestion.kind === "alias" && suggestion.label === "whole foods",
      ),
    ).toBe(true);
    expect(
      buildCatalogSearchSuggestions(siteWorldCards, "replenishment").some(
        (suggestion) => suggestion.kind === "workflow",
      ),
    ).toBe(true);
    expect(
      buildCatalogSearchSuggestions(siteWorldCards, "tote").some(
        (suggestion) => suggestion.kind === "object",
      ),
    ).toBe(true);
  });

  it("separates exact, nearby, category, and request-candidate behavior", () => {
    const exact = classifyCatalogSearch(siteWorldCards, "Harborview Grocery Distribution Annex");
    expect(exact.primaryResultType).toBe("exact");
    expect(exact.exactMatches[0].id).toBe("sw-chi-01");
    expect(exact.requestCandidate).toBeNull();

    const nearby = classifyCatalogSearch(siteWorldCards, "Chicago");
    expect(nearby.primaryResultType).toBe("nearby");
    expect(nearby.nearbyMatches.some((site) => site.id === "sw-chi-01")).toBe(true);
    expect(nearby.requestCandidate?.headline).toMatch(/No scanned package/i);

    const category = classifyCatalogSearch(siteWorldCards, "Whole Foods");
    expect(category.primaryResultType).toBe("category");
    expect(category.categoryMatches[0].category).toBe("Retail");
    expect(category.requestCandidate?.href).toContain("buyerType=robot_team");
    expect(category.requestCandidate?.href).toContain("source=site-worlds");
  });

  it("builds a truthful prefilled request candidate for unknown free-text locations", () => {
    const candidate = buildCatalogRequestCandidate("123 New Robot Ave, Austin, TX");
    const url = new URL(candidate?.href || "", "https://tryblueprint.local");

    expect(candidate?.headline).toBe("No scanned package for this exact place yet");
    expect(candidate?.href).toContain("path=new-capture");
    expect(candidate?.href).toContain("buyerType=robot_team");
    expect(candidate?.href).toContain("source=site-worlds");
    expect(url.searchParams.get("location")).toBe("123 New Robot Ave, Austin, TX");
    expect(url.searchParams.get("siteLocation")).toBe("123 New Robot Ave, Austin, TX");
    expect(url.searchParams.get("taskStatement")).toContain("Request an exact-site readiness evaluation");
  });
});
