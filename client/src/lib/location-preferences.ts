/** Preferences affect suggestion order, never the selected place's country. */
export interface LocationOrigin { lat: number; lng: number }

export const NEARBY_RADIUS_METERS = 50_000;
export const US_LOCATION_BIAS = { west: -125, east: -66, south: 24, north: 49 };

interface RankedLocation {
  label: string;
  mainText?: string;
  secondaryText?: string;
  countryCode: string | null;
  distanceMeters?: number | null;
}

const streetWords: Record<string, string> = {
  st: "street", rd: "road", ave: "avenue", av: "avenue", ln: "lane",
  dr: "drive", ct: "court", blvd: "boulevard", pl: "place", cir: "circle",
  pkwy: "parkway", hwy: "highway", ter: "terrace",
};
const suffixes = new Set(Object.values(streetWords));
const usStates = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));

function words(text: string): string[] {
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)?.map((word) => streetWords[word] ?? word) ?? [];
}

function relevance(input: string[], location: RankedLocation): number {
  const address = words(location.label);
  // A real street-name match matters more than a common number or suffix.
  // Include the whole label so a typed city/country beats our preferences.
  return input.reduce((score, word, index) => {
    const weight = /^\d+$/.test(word) || suffixes.has(word) ? 1 : 3;
    const exact = address.includes(word);
    const prefix = index === input.length - 1 && address.some((part) => part.startsWith(word));
    return score + weight * (exact ? 2 : prefix ? 1 : 0);
  }, 0);
}

function preference(location: RankedLocation, nearby: boolean): number {
  if (nearby && typeof location.distanceMeters === "number" && location.distanceMeters >= 0 && location.distanceMeters <= NEARBY_RADIUS_METERS) return 3;
  // Google omits the US country suffix when region='us'. Use display text
  // only for ordering; submission still requires authoritative country details.
  const parts = (location.secondaryText || location.label).split(",").map((part) => part.trim());
  const country = parts.at(-1) ?? "";
  const explicitUS = /^(USA|US|United States(?: of America)?)$/i.test(country);
  const state = explicitUS ? parts.at(-2) ?? "" : country;
  const us = location.countryCode ? location.countryCode === "US" : explicitUS || usStates.has(state);
  if (!us) return 0;
  return /^(CA|TX|California|Texas)$/i.test(state) ? 2 : 1;
}

/** Keep every provider option; geography breaks ties after text relevance. */
export function rankLocations<T extends RankedLocation>(input: string, locations: T[], nearby = false): T[] {
  const query = words(input);
  return locations.map((location, index) => ({ location, index, relevance: relevance(query, location), preference: preference(location, nearby) }))
    .sort((a, b) => b.relevance - a.relevance || b.preference - a.preference ||
      (a.preference === 3 && b.preference === 3 ? (a.location.distanceMeters ?? 0) - (b.location.distanceMeters ?? 0) : 0) || a.index - b.index)
    .map(({ location }) => location);
}
