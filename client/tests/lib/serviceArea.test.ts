import { describe, expect, it } from "vitest";

import {
  filterToServedCities,
  isServedCitySlug,
  serviceArea,
  servedCitySlugs,
} from "@/data/serviceArea";

/**
 * Blueprint operates in one metro, and the whole point of this module is that
 * exactly one place in the codebase says so. These tests guard the two ways
 * that could quietly stop being true: a second city creeping into the constant,
 * and a backend record widening the public claim on its own.
 */
describe("serviceArea", () => {
  it("declares exactly one metro", () => {
    // If this fails because Blueprint genuinely opened a second metro, update
    // the constant and the copy that reads it — do not just raise the number.
    expect(servedCitySlugs).toHaveLength(1);
    expect(servedCitySlugs[0]).toBe(serviceArea.citySlug);
  });

  it("never softens the limit into an implied footprint", () => {
    const copy = `${serviceArea.claim} ${serviceArea.detail} ${serviceArea.outside}`;
    expect(copy).not.toMatch(/select other markets|and more|nationwide|across the (US|country)/i);
    // The limit is stated, and so is what happens if you sit outside it.
    expect(serviceArea.detail).toMatch(/Austin metro/i);
    expect(serviceArea.outside).toMatch(/outside the metro/i);
  });

  it("recognises its own slug regardless of casing or padding", () => {
    expect(isServedCitySlug("austin-tx")).toBe(true);
    expect(isServedCitySlug("  Austin-TX  ")).toBe(true);
    expect(isServedCitySlug(null)).toBe(false);
    expect(isServedCitySlug(undefined)).toBe(false);
    expect(isServedCitySlug("")).toBe(false);
  });

  it("filters out metros the backend lists but Blueprint does not serve", () => {
    // cityLaunchCoverageExpansion carries prepared coverage policies for
    // several metros. Those are expansion groundwork, not a claim that a city
    // is open, and a public surface must not read them as one.
    const fromBackend = [
      { citySlug: "austin-tx", displayName: "Austin, TX" },
      { citySlug: "durham-nc", displayName: "Durham, NC" },
      { citySlug: "sacramento-ca", displayName: "Sacramento, CA" },
      { citySlug: "chicago-il", displayName: "Chicago, IL" },
    ];
    const served = filterToServedCities(fromBackend);
    expect(served).toHaveLength(1);
    expect(served[0].citySlug).toBe("austin-tx");
  });

  it("returns nothing rather than guessing when the backend returns nothing", () => {
    expect(filterToServedCities([])).toEqual([]);
  });
});
