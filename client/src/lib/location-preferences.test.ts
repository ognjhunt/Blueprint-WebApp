import { describe, expect, it } from "vitest";
import { rankLocations } from "./location-preferences";

const place = (mainText: string, secondaryText: string, distanceMeters?: number, countryCode: string | null = null) => ({
  label: `${mainText}, ${secondaryText}`, mainText, secondaryText, countryCode, distanceMeters,
});

describe("address preferences", () => {
  it("puts a real street match ahead of favored-state fuzzy matches", () => {
    const durham = place("1005 Crete Street", "Durham, NC");
    const texas = place("1005 Crete Lane", "Pflugerville, TX");
    const canada = place("1005 Centre Street North", "Whitby, ON, Canada");
    expect(rankLocations("1005 Crete Street", [canada, texas, durham])).toEqual([durham, texas, canada]);
  });

  it("favors CA/TX, then other US addresses, while keeping every international option", () => {
    const canada = place("1005 Crete Street", "Whitby, ON, Canada");
    const texas = place("1005 Crete Street", "Dallas, TX");
    const california = place("1005 Crete Street", "Roseville, CA, USA");
    const northCarolina = place("1005 Crete Street", "Durham, NC");
    expect(rankLocations("1005 ", [canada, northCarolina, texas, california])).toEqual([texas, california, northCarolina, canada]);
  });

  it("prioritizes nearby matches before CA/TX, including nearby international addresses", () => {
    const texas = place("1005 Crete Street", "Dallas, TX", 1900000);
    const nearbyCanada = place("1005 Crete Street", "Toronto, ON, Canada", 8000);
    const nearerCanada = place("1005 Crete Street", "Toronto, ON, Canada", 2000);
    expect(rankLocations("1005 Crete", [texas, nearbyCanada, nearerCanada], true)).toEqual([nearerCanada, nearbyCanada, texas]);
    expect(rankLocations("1005 Crete", [nearbyCanada, texas])).toEqual([texas, nearbyCanada]);
  });

  it.each(["1005 Crete Street Canada", "1005 Crete Street Whitby"])("respects an explicitly typed location (%s)", (query) => {
    const texas = place("1005 Crete Street", "Dallas, TX", 2000);
    const canada = place("1005 Crete Street", "Whitby, ON, Canada", 2000000);
    expect(rankLocations(query, [texas, canada], true)).toEqual([canada, texas]);
  });

  it("treats common street abbreviations as equivalent and preserves provider order for ties", () => {
    const northCarolina = place("1005 Crete Street", "Durham, NC");
    const texas = place("1005 Crete St.", "Dallas, Texas, United States");
    const california = place("1005 Crete Street", "Roseville, California, United States");
    expect(rankLocations("1005 Crete St", [northCarolina, texas, california])).toEqual([texas, california, northCarolina]);
  });

  it("does not treat Canada's country code CA as California, or override known foreign countries", () => {
    const canada = place("1005 Crete Street", "Whitby, ON, Canada", undefined, "CA");
    const foreign = place("1005 Crete Street", "Ambiguous, CA", undefined, "DE");
    const us = place("1005 Crete Street", "Durham, NC", undefined, "US");
    expect(rankLocations("1005 Crete", [canada, foreign, us])).toEqual([us, canada, foreign]);
  });
});
