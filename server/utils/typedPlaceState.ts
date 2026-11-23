/**
 * The United States state of a job whose place was typed, not picked from a suggestion. Only the state is ever read
 * from free text, never a city: typed text can hold a site's name or street, and a company must never be shown those.
 * The state is taken only when the typed place ends with a state's name or its two-letter code as a whole
 * comma-separated part, optionally followed by a country part ("Austin, Texas", "Austin, TX", "Austin, TX, USA",
 * "Texas"). A closed list; nothing else matches.
 */
import type { PlaceLocationMetadata } from "../types/inbound-request";

export const US_STATES: Readonly<Record<string, string>> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const STATE_BY_NAME = new Map<string, string>([
  ...Object.values(US_STATES).map((name) => [name.toLowerCase(), name] as [string, string]),
  ["washington dc", "District of Columbia"], ["washington d.c.", "District of Columbia"],
  ["d.c.", "District of Columbia"],
]);
const COUNTRY_PARTS = new Set(["us", "u.s.", "usa", "u.s.a.", "united states", "united states of america"]);

/**
 * The state the typed place ends with, or null. "Washington" alone gives nothing: it names the state and the capital
 * alike, and the two are different states. After another part ("Seattle, Washington") it is the state.
 */
export function usStateFromTypedPlace(typed: unknown): string | null {
  if (typeof typed !== "string" || typed.length > 300) return null;
  const parts = typed.split(",").map((part) => part.trim().replace(/\s+/g, " ")).filter(Boolean);
  if (parts.length > 1 && COUNTRY_PARTS.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  const last = parts[parts.length - 1];
  if (!last) return null;
  const state = /^[A-Za-z]{2}$/.test(last) ? US_STATES[last.toUpperCase()] ?? null : STATE_BY_NAME.get(last.toLowerCase()) ?? null;
  if (state === "Washington" && parts.length === 1 && !/^WA$/i.test(last)) return null;
  return state;
}

/**
 * The stored place for a job in the United States that arrived with no structured state: the state the typed place
 * ends with (`usStateFromTypedPlace`), and nothing else from the text. A job is in the United States when its structured
 * country says so, or, with no structured country, when the site chose the United States. Anything else is unchanged.
 */
export function withTypedUsState(metadata: PlaceLocationMetadata | null, typedPlace: string,
  captureRegion: unknown): PlaceLocationMetadata | null {
  const country = typeof metadata?.country === "string" ? metadata.country.trim().toUpperCase() : "";
  const inUnitedStates = country ? country === "US" : captureRegion === "us";
  if (!inUnitedStates || metadata?.state) return metadata;
  const state = usStateFromTypedPlace(typedPlace);
  if (!state) return metadata;
  return { ...(metadata ?? { source: "typed_state" }), state };
}
