import type { BandComparison } from "./capabilityBands";

export const legacyDeploymentGeographies = ["yes", "right_opportunity", "size_dependent", "no"] as const;

export interface DeploymentLocation {
  country?: string | null;
  state?: string | null;
  city?: string | null;
  label?: string | null;
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
const states = "AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming|DC:District of Columbia".split("|");
const stateCodes = new Map(states.flatMap((entry) => {
  const [code, name] = entry.split(":");
  return [[normalize(code), code], [normalize(name), code]];
}));
const countries = new Map<string, string>([["usa", "US"], ["united states of america", "US"], ["uk", "GB"]]);
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b);
  const canonical = new Intl.Locale(`und-${code}`).region ?? code;
  const name = countryNames.of(canonical);
  if (name && name !== canonical && !["ZZ", "EU", "UN", "EZ", "QO", "XA", "XB"].includes(canonical)) {
    countries.set(normalize(code), canonical);
    countries.set(normalize(name), canonical);
  }
}

/** Explicit declarations only: ambiguous prose remains provisional. */
export function compareDeploymentCoverage(
  serviceArea: string | null,
  location: DeploymentLocation,
  geography: string | null,
  regions: string | null,
): BandComparison {
  const parts = (location.label ?? "").split(",").map(normalize);
  const lastPart = parts.at(-1) ?? "";
  const country = location.country ? countries.get(normalize(location.country))
    : stateCodes.has(lastPart) ? undefined : countries.get(lastPart);
  const addressState = countries.has(lastPart) && !stateCodes.has(lastPart)
    ? parts.length >= 3 ? parts.at(-2) : undefined
    : parts.length >= 2 ? lastPart : undefined;
  const state = location.state ? stateCodes.get(normalize(location.state))
    : country === "US" && addressState ? stateCodes.get(addressState.replace(/\s+\d{5}(?:-\d{4})?$/, "")) : undefined;
  const austin = serviceArea === "austin_metro"
    || (country === "US" && state === "TX" && normalize(location.city ?? "") === "austin");
  // Historical answers were specifically about Austin. They are never widened.
  if (legacyDeploymentGeographies.includes(geography as typeof legacyDeploymentGeographies[number])) {
    return austin ? geography === "no" ? "short" : "clears" : "unknown";
  }
  if (geography === "not_deploying") return "short";
  if (geography === "us_national") return country ? country === "US" ? "clears" : "short" : "unknown";
  if (geography !== "specific_regions" || !regions?.trim()) return "unknown";
  if (/\b(except|excluding|but not|only if|only above|subject to)\b/i.test(regions)) return "unknown";

  const comparisons = regions.split(/[;\n]/).filter((region) => region.trim()).map((region): BandComparison => {
    const token = normalize(region);
    const coveredCountry = countries.get(token);
    const coveredState = stateCodes.get(token);
    // "Georgia" and "CA" name different places depending on context.
    if (coveredCountry && coveredState) return "unknown";
    if (coveredCountry) return country ? country === coveredCountry ? "clears" : "short" : "unknown";
    if (coveredState) return country && country !== "US" ? "short" : country === "US" && state ? state === coveredState ? "clears" : "short" : "unknown";
    // A city must include its state/country; a bare city name is ambiguous.
    const cityParts = token.split(",").map(normalize);
    if (cityParts.length === 2) {
      const cityState = stateCodes.get(cityParts[1]);
      const siteCity = location.city ? normalize(location.city) : parts.length === 2 ? parts[0] : undefined;
      if (cityState) {
        if (country && country !== "US") return "short";
        if (country === "US" && state && siteCity) return cityState === state && cityParts[0] === siteCity ? "clears" : "short";
      }
      const regionCountry = countries.get(cityParts[1]);
      if (regionCountry && country) {
        if (regionCountry !== country) return "short";
        const regionState = regionCountry === "US" ? stateCodes.get(cityParts[0]) : undefined;
        if (regionState && state) return regionState === state ? "clears" : "short";
        if (siteCity) return cityParts[0] === siteCity ? "clears" : "short";
      }
    }
    return "unknown";
  });
  return comparisons.includes("clears") ? "clears" : comparisons.length && comparisons.every((value) => value === "short") ? "short" : "unknown";
}
