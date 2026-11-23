import { describe, expect, it } from "vitest";
import { googlePlaceParts, photonPlaceParts, siteLocationParts, validSiteLocationParts } from "@/lib/placeParts";

const google = (types: string[], longText: string, shortText = longText) => ({ types, longText, shortText });

describe("a picked place's structured parts", () => {
  it("reads Google's city, state and country, never the street or postal code", () => {
    const parts = googlePlaceParts([google(["street_number"], "12"), google(["route"], "Main Street"),
      google(["locality", "political"], "Austin"), google(["administrative_area_level_2", "political"], "Travis County"),
      google(["administrative_area_level_1", "political"], "Texas", "TX"), google(["country", "political"], "United States", "us"),
      google(["postal_code"], "78701")]);
    expect(parts).toEqual({ city: "Austin", state: "Texas", country: "US" });
  });

  it("takes a UK post town, then a borough, when Google gives no locality", () => {
    expect(googlePlaceParts([google(["postal_town"], "Reading"), google(["administrative_area_level_1"], "England"),
      google(["country"], "United Kingdom", "GB")])).toEqual({ city: "Reading", state: "England", country: "GB" });
    expect(googlePlaceParts([google(["sublocality_level_1", "sublocality", "political"], "Brooklyn"),
      google(["administrative_area_level_2"], "Kings County"), google(["administrative_area_level_1"], "New York", "NY"),
      google(["country"], "United States", "US")])).toEqual({ city: "Brooklyn", state: "New York", country: "US" });
  });

  it("gives a state or a county the state alone", () => {
    expect(googlePlaceParts([google(["administrative_area_level_1", "political"], "Texas", "TX"), google(["country"], "United States", "US")]))
      .toEqual({ city: null, state: "Texas", country: "US" });
    expect(googlePlaceParts([google(["administrative_area_level_2", "political"], "Travis County"),
      google(["administrative_area_level_1", "political"], "Texas", "TX"), google(["country"], "United States", "US")]))
      .toEqual({ city: null, state: "Texas", country: "US" });
  });

  it("reads the Geocoder's long_name and short_name the same way", () => {
    expect(googlePlaceParts([{ types: ["locality"], long_name: "Durham", short_name: "Durham" },
      { types: ["administrative_area_level_1"], long_name: "North Carolina", short_name: "NC" },
      { types: ["country"], long_name: "United States", short_name: "US" }])).toEqual({ city: "Durham", state: "North Carolina", country: "US" });
  });

  it("gives nothing for missing or malformed components", () => {
    expect(googlePlaceParts(undefined)).toEqual({ city: null, state: null, country: null });
    expect(googlePlaceParts([{ types: ["country"], shortText: "USA" }, { types: null, longText: "Austin" }]))
      .toEqual({ city: null, state: null, country: null });
  });

  it("reads Photon's city, state and country code, never a street, house number, postcode or a point's name", () => {
    expect(photonPlaceParts({ name: "Austin", type: "city", state: "Texas", countrycode: "us", postcode: "78701" }))
      .toEqual({ city: "Austin", state: "Texas", country: "US" });
    expect(photonPlaceParts({ name: "Acme Foods", type: "house", housenumber: "12", street: "Main Street", city: "Austin",
      state: "Texas", countrycode: "US" })).toEqual({ city: "Austin", state: "Texas", country: "US" });
    expect(photonPlaceParts({ name: "Acme Foods", type: "house", street: "Main Street", countrycode: "US" }))
      .toEqual({ city: null, state: null, country: "US" });
  });

  it("gives a Photon state or county the state alone", () => {
    expect(photonPlaceParts({ name: "Texas", type: "state", countrycode: "US" })).toEqual({ city: null, state: "Texas", country: "US" });
    expect(photonPlaceParts({ name: "Travis County", type: "county", city: "Austin", state: "Texas", countrycode: "US" }))
      .toEqual({ city: null, state: "Texas", country: "US" });
  });

  it("sends only the source, city, state and country", () => {
    expect(siteLocationParts({ source: "photon", city: " Austin ", state: "Texas", countryCode: "us" }))
      .toEqual({ source: "photon", city: "Austin", state: "Texas", country: "US" });
    expect(siteLocationParts({ source: "google_places", city: null, state: "Texas", countryCode: "US" }))
      .toEqual({ source: "google_places", state: "Texas", country: "US" });
    expect(siteLocationParts({ source: "google_places", city: null, state: null, countryCode: null })).toBeNull();
    expect(siteLocationParts({ city: "Austin", state: "Texas", countryCode: "US" })).toBeNull();
  });

  it("restores a saved draft's parts only in exactly that shape", () => {
    const saved = { source: "google_places", city: "Austin", state: "Texas", country: "US" };
    expect(validSiteLocationParts(saved)).toEqual(saved);
    for (const altered of [null, "Austin", [], { ...saved, source: "typed" }, { ...saved, postalCode: "78701" },
      { ...saved, lat: 30.2 }, { ...saved, country: "USA" }, { ...saved, city: 12 }, { ...saved, city: "A".repeat(101) }]) {
      expect(validSiteLocationParts(altered)).toBeNull();
    }
  });
});
