/**
 * The city, state and two-letter country of a place the site picked on the start form, read from the location
 * provider's own structured parts (Google's address components, Photon's properties). Never a street, a formatted
 * address, a postal code, a place id or coordinates: the form asks for a city or region, and a company is shown at most
 * the city and state (`companyPlaceOf`). Typed text is never read here.
 */

/** What the start form sends as `siteLocationMetadata`: these four keys and nothing else. */
export interface SiteLocationParts {
  source: "google_places" | "photon";
  city?: string;
  state?: string;
  country?: string;
}

export interface PlaceParts {
  city: string | null;
  state: string | null;
  /** ISO 3166-1 alpha-2, upper case. */
  country: string | null;
}

const text = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed && trimmed.length <= 100 ? trimmed : null;
};
const countryCode = (value: unknown): string | null => {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z]{2}$/.test(code) ? code : null;
};

/** One address component as Places (New) (`longText`/`shortText`) or the Geocoder (`long_name`/`short_name`) gives it. */
export interface GoogleAddressPart {
  types?: readonly string[] | null;
  longText?: string | null;
  shortText?: string | null;
  long_name?: string | null;
  short_name?: string | null;
}

/** The city's component types, the most usual first: a town, a UK post town, then a borough such as Brooklyn. */
const GOOGLE_CITY_TYPES = ["locality", "postal_town", "sublocality_level_1", "sublocality"] as const;

/**
 * City, state and country from Google's address components. A state or a county has no locality among its parts, so it
 * gives the state alone. The postal code and every street-level part are never read.
 */
export function googlePlaceParts(parts: readonly GoogleAddressPart[] | null | undefined): PlaceParts {
  const list = Array.isArray(parts) ? parts : [];
  const find = (type: string) => list.find((part) => Array.isArray(part?.types) && part.types.includes(type));
  const long = (part: GoogleAddressPart | undefined) => text(part?.longText ?? part?.long_name);
  const short = (part: GoogleAddressPart | undefined) => part?.shortText ?? part?.short_name;
  const city = GOOGLE_CITY_TYPES.map((type) => long(find(type))).find(Boolean) ?? null;
  return { city, state: long(find("administrative_area_level_1")), country: countryCode(short(find("country"))) };
}

/** Photon's types for a region with no city of its own. */
const PHOTON_REGION_TYPES = new Set(["state", "county"]);
/** Photon's types whose own name is the city. */
const PHOTON_CITY_TYPES = new Set(["city", "locality"]);

/**
 * City, state and country from a Photon feature's properties. A feature's own name is read only when the feature is
 * itself a city or a state, never a point of interest's or a street's name.
 */
export function photonPlaceParts(properties: Record<string, unknown> | null | undefined): PlaceParts {
  const props = properties ?? {};
  const type = typeof props.type === "string" ? props.type : "";
  const city = PHOTON_REGION_TYPES.has(type) ? null
    : text(props.city) ?? (PHOTON_CITY_TYPES.has(type) ? text(props.name) : null);
  const state = text(props.state) ?? (type === "state" ? text(props.name) : null);
  return { city, state, country: countryCode(props.countrycode) };
}

/** The `siteLocationMetadata` the start form sends for a picked place, or null when the provider gave no parts. */
export function siteLocationParts(place: { source?: SiteLocationParts["source"] | null; city?: string | null;
  state?: string | null; countryCode?: string | null } | null | undefined): SiteLocationParts | null {
  if (!place?.source) return null;
  const city = text(place.city), state = text(place.state), country = countryCode(place.countryCode);
  if (!city && !state && !country) return null;
  return { source: place.source, ...(city ? { city } : {}), ...(state ? { state } : {}), ...(country ? { country } : {}) };
}

/** A saved draft's parts, kept only when they have exactly this shape (an older or altered draft gives none). */
export function validSiteLocationParts(value: unknown): SiteLocationParts | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => !["source", "city", "state", "country"].includes(key))) return null;
  if (record.source !== "google_places" && record.source !== "photon") return null;
  for (const key of ["city", "state"] as const) {
    if (record[key] !== undefined && text(record[key]) !== record[key]) return null;
  }
  if (record.country !== undefined && countryCode(record.country) !== record.country) return null;
  return siteLocationParts({ source: record.source, city: record.city as string | undefined,
    state: record.state as string | undefined, countryCode: record.country as string | undefined });
}
