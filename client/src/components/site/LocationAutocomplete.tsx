/** Google Places (New), using a browser Maps key or a private server credential. */
import { useCallback, useEffect, useRef, useState } from "react";
import { getGoogleMapsApiKey } from "@/lib/client-env";
import { NEARBY_RADIUS_METERS, US_LOCATION_BIAS, rankLocations, type LocationOrigin } from "@/lib/location-preferences";

interface Suggestion {
  label: string;
  /** ISO 3166-1 alpha-2, upper case, when the provider knows it. */
  countryCode: string | null;
  placeId?: string;
  mainText?: string;
  secondaryText?: string;
  distanceMeters?: number | null;
  googlePrediction?: google.maps.places.PlacePrediction;
}

/** What the form is told when a suggestion is picked. */
export interface ChosenPlace {
  label: string;
  countryCode: string | null;
}

/** Build one readable line from a Photon feature's address parts. */
function photonLabel(props: Record<string, unknown>): string {
  const str = (key: string) => (typeof props[key] === "string" ? (props[key] as string) : "");
  const street = [str("housenumber"), str("street")].filter(Boolean).join(" ");
  const name = [street, str("street")].includes(str("name")) ? "" : str("name");
  const parts = [name, street, str("city"), str("state"), str("country")].filter(Boolean);
  // Drop an immediate duplicate (name === city is common for a city result).
  return parts.filter((part, index) => part !== parts[index - 1]).join(", ");
}

async function photonSuggestions(query: string, signal: AbortSignal, origin: LocationOrigin | null): Promise<Suggestion[]> {
  const params = new URLSearchParams({ q: query, limit: "5" });
  if (origin) { params.set("lat", String(origin.lat)); params.set("lon", String(origin.lng)); }
  const url = `https://photon.komoot.io/api/?${params}`;
  const response = await fetch(url, { signal });
  if (!response.ok) return [];
  const data = (await response.json()) as { features?: { properties?: Record<string, unknown> }[] };
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const feature of data.features ?? []) {
    const properties = feature.properties ?? {};
    const label = photonLabel(properties);
    if (label && !seen.has(label)) {
      seen.add(label);
      const code = typeof properties.countrycode === "string" ? properties.countrycode.trim().toUpperCase() : "";
      out.push({ label, countryCode: /^[A-Z]{2}$/.test(code) ? code : null });
    }
  }
  return out;
}

let googleMapsLoad: Promise<boolean> | null = null;

function googlePlaces() {
  return typeof window !== "undefined" ? window.google?.maps?.places : undefined;
}

function loadGoogleMaps(key: string): Promise<boolean> {
  if (googlePlaces()?.AutocompleteSuggestion) return Promise.resolve(true);
  // Share the loader's script with other map components using the same key.
  googleMapsLoad ??= import("@googlemaps/js-api-loader")
    .then(({ Loader }) => new Loader({ apiKey: key, version: "weekly", libraries: ["places"] }).load())
    .then(() => Boolean(googlePlaces()?.AutocompleteSuggestion))
    .catch(() => false);
  return googleMapsLoad;
}

async function browserSuggestions(input: string, sessionToken: google.maps.places.AutocompleteSessionToken, origin: LocationOrigin | null): Promise<Suggestion[] | null> {
  const places = googlePlaces();
  if (!places?.AutocompleteSuggestion) return null;
  const result = await within(places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input, sessionToken, region: "us",
    locationBias: origin ? { center: origin, radius: NEARBY_RADIUS_METERS } : US_LOCATION_BIAS,
    ...(origin ? { origin } : {}),
  }), 1200, null);
  return result?.suggestions.flatMap(({ placePrediction }) => placePrediction ? [{
    label: placePrediction.text.toString(),
    mainText: placePrediction.mainText?.toString(),
    secondaryText: placePrediction.secondaryText?.toString(),
    distanceMeters: placePrediction.distanceMeters,
    countryCode: null,
    googlePrediction: placePrediction,
  }] : []).slice(0, 5) ?? null;
}

async function browserCountryCode(prediction: google.maps.places.PlacePrediction): Promise<string | null> {
  try {
    const result = await within(prediction.toPlace().fetchFields({ fields: ["addressComponents"] }), 1500, null);
    const country = result?.place.addressComponents?.find((part) => part.types.includes("country"));
    const code = country?.shortText?.trim().toUpperCase() ?? "";
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch { return null; }
}

/** Resolve the clicked position once, keeping structured country data. */
async function currentAddress(origin: LocationOrigin, browserKey: string | null, signal: AbortSignal): Promise<(ChosenPlace & { source: "google" | "photon" }) | null> {
  if (browserKey) {
    const place = await within((async () => {
      try {
        await loadGoogleMaps(browserKey);
        if (signal.aborted || !window.google?.maps?.importLibrary) return null;
        const { Geocoder } = await google.maps.importLibrary("geocoding") as google.maps.GeocodingLibrary;
        const response = await new Geocoder().geocode({ location: origin });
        const result = response.results.find((item) => !item.types.includes("plus_code"));
        if (!result?.formatted_address) return null;
        const code = result.address_components.find((part) => part.types.includes("country"))?.short_name?.toUpperCase() ?? "";
        return { label: result.formatted_address, countryCode: /^[A-Z]{2}$/.test(code) ? code : null, source: "google" as const };
      } catch { return null; }
    })(), 1500, null);
    if (place || signal.aborted) return place;
  }
  // The existing keyless provider also supports reverse lookup. A denied Maps
  // geocoding key must not turn a successful GPS result into an empty field.
  return within((async () => {
    try {
      const params = new URLSearchParams({ lat: String(origin.lat), lon: String(origin.lng), limit: "5", radius: "0.2", lang: "en" });
      const response = await fetch(`https://photon.komoot.io/reverse?${params}`, { signal, cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json() as { features?: { properties?: Record<string, unknown> }[] };
      const candidates: Record<string, unknown>[] = (data.features ?? []).map(({ properties = {} }) => ({
        ...properties,
        street: properties.street || (properties.type === "street" ? properties.name : undefined),
        city: properties.city || (properties.type === "city" ? properties.name : undefined),
      }));
      const hasText = (properties: Record<string, unknown>, key: string) => typeof properties[key] === "string" && Boolean((properties[key] as string).trim());
      const properties = candidates.find((item) => hasText(item, "housenumber") && hasText(item, "street"))
        ?? candidates.find((item) => hasText(item, "street"))
        ?? candidates.find((item) => hasText(item, "city"));
      if (!properties) return null;
      // A nearby bus stop or business can be the first result. Fill address
      // parts, without importing that point of interest's display name.
      const label = photonLabel({ ...properties, name: "" });
      const code = typeof properties.countrycode === "string" ? properties.countrycode.trim().toUpperCase() : "";
      return label ? { label, countryCode: /^[A-Z]{2}$/.test(code) ? code : null, source: "photon" as const } : null;
    } catch { return null; }
  })(), 2000, null);
}

/** Bound provider latency; clear the timer when the request finishes. */
function within<T>(request: Promise<T>, milliseconds: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), milliseconds);
    request.then(resolve, () => resolve(fallback)).finally(() => window.clearTimeout(timer));
  });
}

async function googleSuggestions(
  input: string,
  sessionToken: string,
  signal: AbortSignal,
  origin: LocationOrigin | null,
): Promise<Suggestion[] | null> {
  try {
    const query = new URLSearchParams({ input, sessionToken });
    if (origin) { query.set("lat", String(origin.lat)); query.set("lng", String(origin.lng)); }
    const result = await within((async () => {
      const response = await fetch(`/api/location-autocomplete?${query}`, { signal, cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json() as { suggestions?: Omit<Suggestion, "countryCode">[] };
      return Array.isArray(data.suggestions)
        ? data.suggestions.map((suggestion) => ({ ...suggestion, countryCode: null })).slice(0, 5)
        : null;
    })(), 1500, null);
    return result;
  } catch {
    return null;
  }
}

/** The selected place's details terminate the same Google billing session. */
async function googleCountryCode(placeId: string, sessionToken: string): Promise<string | null> {
  const controller = new AbortController();
  try {
    return await within((async () => {
      const query = new URLSearchParams({ placeId, sessionToken });
      const response = await fetch(`/api/location-autocomplete/country?${query}`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) return null;
      const data = await response.json() as { countryCode?: string };
      const code = data.countryCode?.trim().toUpperCase() ?? "";
      return /^[A-Z]{2}$/.test(code) ? code : null;
    })(), 1500, null);
  } catch {
    return null;
  } finally {
    controller.abort();
  }
}

export function LocationAutocomplete(props: {
  id: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  defaultValue?: string;
  /** Called when a suggestion is picked, never on plain typing. */
  onSelect?: (place: ChosenPlace) => void;
  /** Reports both a picked place and its later invalidation by manual editing. */
  onSelectionChange?: (place: ChosenPlace | null) => void;
  /** Reports plain typing after invalidating any earlier picked place. */
  onInputChange?: (text: string) => void;
}) {
  const [value, setValue] = useState(props.defaultValue ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounce = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const selectionGeneration = useRef(0);
  const sessionToken = useRef<string | null>(null);
  const browserSessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const focused = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const locationButton = useRef<HTMLButtonElement>(null);
  const allowRefresh = useRef(false);
  const nearbyOrigin = useRef<LocationOrigin | null>(null);
  const locationGeneration = useRef(0);
  const locationFillGeneration = useRef(0);
  const addressAbort = useRef<AbortController | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "resolving" | "nearby" | "denied" | "unavailable">("idle");
  const [locationFeedback, setLocationFeedback] = useState<"nearby" | "filled" | "not-found">("nearby");
  const [addressSource, setAddressSource] = useState<"google" | "photon" | null>(null);
  const browserKey = getGoogleMapsApiKey();

  useEffect(() => {
    if (browserKey) void loadGoogleMaps(browserKey);
  }, [browserKey]);

  function cancelQuery() {
    if (debounce.current !== null) window.clearTimeout(debounce.current);
    debounce.current = null;
    abort.current?.abort();
  }

  const query = useCallback(
    async (text: string) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      try {
        let results: Suggestion[] | null = null;
        if (browserKey) {
          if (!googlePlaces()?.AutocompleteSuggestion) await within(loadGoogleMaps(browserKey), 800, false);
          if (controller.signal.aborted) return;
          const places = googlePlaces();
          if (places?.AutocompleteSuggestion) {
            browserSessionToken.current ??= new places.AutocompleteSessionToken();
            results = await browserSuggestions(text, browserSessionToken.current, nearbyOrigin.current);
          }
        } else {
          sessionToken.current ??= crypto.randomUUID();
          results = await googleSuggestions(text, sessionToken.current, controller.signal, nearbyOrigin.current);
        }
        if (controller.signal.aborted) return;
        // A denied or unavailable Google lookup must leave suggestions usable.
        if (results === null) {
          results = await photonSuggestions(text, controller.signal, nearbyOrigin.current);
        }
        if (!controller.signal.aborted) {
          setSuggestions(rankLocations(text, results, Boolean(nearbyOrigin.current)));
          setOpen(focused.current && results.length > 0);
          setActive(-1);
        }
      } catch {
        // A geocoder that is slow, blocked, or down must not break the field.
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setOpen(false);
        }
      }
    },
    [browserKey],
  );

  function refreshSuggestions() {
    cancelQuery();
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
    const text = inputRef.current?.value.trim() ?? "";
    if (document.activeElement === locationButton.current) {
      allowRefresh.current = true;
      inputRef.current?.focus();
    }
    if (text.length >= 2 && focused.current && allowRefresh.current) void query(text);
  }

  function useMyLocation() {
    if (!navigator.geolocation) { setLocationStatus("unavailable"); return; }
    const generation = ++locationGeneration.current;
    const fillGeneration = locationFillGeneration.current;
    addressAbort.current?.abort();
    cancelQuery();
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
    // Clicking after a scroll is a fresh request even if the input kept focus.
    allowRefresh.current = true;
    inputRef.current?.focus();
    setLocationStatus("loading");
    // Ask only after this click. Use the precise position only for this reverse
    // lookup; keep a rounded search preference in memory, never in a draft.
    try {
      navigator.geolocation.getCurrentPosition(async (position) => {
        if (generation !== locationGeneration.current) return;
        const { latitude, longitude } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          setLocationStatus("unavailable"); return;
        }
        nearbyOrigin.current = { lat: Math.round(latitude * 1000) / 1000, lng: Math.round(longitude * 1000) / 1000 };
        if (fillGeneration === locationFillGeneration.current) {
          setLocationStatus("resolving");
          const controller = new AbortController();
          addressAbort.current = controller;
          const place = await currentAddress({ lat: latitude, lng: longitude }, browserKey, controller.signal);
          controller.abort();
          if (generation !== locationGeneration.current) return;
          if (fillGeneration === locationFillGeneration.current && place) {
            selectionGeneration.current += 1;
            cancelQuery();
            allowRefresh.current = false;
            sessionToken.current = null;
            browserSessionToken.current = null;
            setValue(place.label);
            setSuggestions([]);
            setOpen(false);
            setActive(-1);
            setLocationFeedback("filled");
            setAddressSource(place.source);
            setLocationStatus("nearby");
            const chosen = { label: place.label, countryCode: place.countryCode };
            props.onSelect?.(chosen);
            props.onSelectionChange?.(chosen);
            return;
          }
          setLocationFeedback(fillGeneration === locationFillGeneration.current ? "not-found" : "nearby");
        } else setLocationFeedback("nearby");
        setLocationStatus("nearby");
        // A click can scroll the page before the asynchronous GPS callback.
        // Resume after that scroll, but respect a later Escape or selection.
        if (fillGeneration === locationFillGeneration.current) allowRefresh.current = true;
        refreshSuggestions();
      }, (error) => {
        if (generation === locationGeneration.current) setLocationStatus(error.code === 1 ? "denied" : "unavailable");
      }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 });
    } catch { setLocationStatus("unavailable"); }
  }

  function clearMyLocation() {
    locationGeneration.current += 1;
    addressAbort.current?.abort();
    nearbyOrigin.current = null;
    setLocationFeedback("nearby");
    allowRefresh.current = true;
    setLocationStatus("idle");
    refreshSuggestions();
  }

  function onChange(text: string) {
    locationFillGeneration.current += 1;
    setAddressSource(null);
    setLocationFeedback("nearby");
    selectionGeneration.current += 1;
    cancelQuery();
    focused.current = true;
    allowRefresh.current = true;
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
    setValue(text);
    props.onSelectionChange?.(null);
    props.onInputChange?.(text);
    if (text.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounce.current = window.setTimeout(() => void query(text.trim()), 150);
  }

  async function choose(suggestion: Suggestion) {
    locationFillGeneration.current += 1;
    setAddressSource(null);
    setLocationFeedback("nearby");
    const generation = ++selectionGeneration.current;
    allowRefresh.current = false;
    cancelQuery();
    const pickedSession = sessionToken.current;
    sessionToken.current = null;
    browserSessionToken.current = null;
    setValue(suggestion.label);
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
    let countryCode = suggestion.countryCode;
    if (suggestion.googlePrediction || (suggestion.placeId && pickedSession)) {
      // The visible location has already changed. Clear the prior inferred
      // country while structured details are pending, including on failure.
      props.onSelectionChange?.({ label: suggestion.label, countryCode: null });
      countryCode = suggestion.googlePrediction
        ? await browserCountryCode(suggestion.googlePrediction)
        : await googleCountryCode(suggestion.placeId!, pickedSession!);
      if (selectionGeneration.current !== generation) return;
    }
    const place = { label: suggestion.label, countryCode };
    props.onSelect?.(place);
    props.onSelectionChange?.(place);
  }

  useEffect(() => {
    return () => {
      selectionGeneration.current += 1;
      locationGeneration.current += 1;
      addressAbort.current?.abort();
      cancelQuery();
    };
  }, []);

  // The list is absolutely positioned, so it does not scroll with the page:
  // leaving it open while the operator scrolls parks it over whichever field —
  // often the submit button — scrolled beneath it. Closing on any scroll costs
  // one refocus and keeps the form readable; the text stays in the input.
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      // Scrolling the options must not dismiss them.
      if (event.target instanceof Element && document.getElementById(`${props.id}-options`)?.contains(event.target)) return;
      cancelQuery();
      allowRefresh.current = false;
      setOpen(false);
    };
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open, props.id]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      locationFillGeneration.current += 1;
      cancelQuery();
      allowRefresh.current = false;
      setOpen(false);
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      // Enter picks the highlighted suggestion, or the first one when none is
      // highlighted: "type, press Enter, done". Falling through to the form's
      // submit here was how the open list ended up covering the button being
      // submitted to.
      event.preventDefault();
      void choose(suggestions[active >= 0 ? active : 0]);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        id={props.id}
        name={props.name}
        type="text"
        required={props.required}
        maxLength={props.maxLength}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-describedby={`${props.id}-location-hint`}
        aria-controls={open ? `${props.id}-options` : undefined}
        aria-activedescendant={open && active >= 0 ? `${props.id}-option-${active}` : undefined}
        placeholder={props.placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          focused.current = false;
          allowRefresh.current = false;
          cancelQuery();
          setOpen(false);
        }}
        onFocus={() => {
          focused.current = true;
          allowRefresh.current = true;
          if (suggestions.length > 0) setOpen(true);
        }}
        style={{ width: "100%" }}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, right: 0 }}>
          <ul
            id={`${props.id}-options`}
            role="listbox"
            aria-label="Location suggestions"
            style={{
              margin: "4px 0 0",
              padding: 0,
              listStyle: "none",
              background: "var(--ms-surface, #fff)",
              border: "1px solid var(--ms-border, #d1d5db)",
              borderRadius: "8px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
              maxHeight: "240px",
              overflowY: "auto",
            }}
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion.label}
                id={`${props.id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                // Keep focus until a click/tap; a touch scroll must not pick.
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => void choose(suggestion)}
                onMouseEnter={() => setActive(index)}
                style={{
                  padding: "10px 12px",
                  cursor: "pointer",
                  background: index === active ? "var(--ms-hover, #f3f4f6)" : "transparent",
                }}
              >
                {suggestion.mainText ? (
                  <>
                    <span style={{ display: "block", fontWeight: 500 }}>{suggestion.mainText}</span>
                    <span style={{ display: "block", fontSize: "0.85em", color: "var(--ms-muted, #667085)", marginTop: "3px" }}>
                      {suggestion.secondaryText}
                    </span>
                  </>
                ) : suggestion.label}
              </li>
            ))}
          </ul>
          {suggestions.some((suggestion) => suggestion.placeId || suggestion.googlePrediction) && (
            <div style={{ padding: "8px 12px", background: "var(--ms-surface, #fff)", textAlign: "right", borderRadius: "0 0 8px 8px" }}>
              <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" width={120} height={14} />
            </div>
          )}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "6px 12px", marginTop: "8px", fontSize: "0.85em" }}>
        <button ref={locationButton} type="button" className="ms-text-link" disabled={locationStatus === "loading" || locationStatus === "resolving"}
          onPointerDown={(event) => event.preventDefault()}
          onClick={locationStatus === "nearby" ? clearMyLocation : useMyLocation}
          style={{ background: "none", border: 0, padding: "4px 0", cursor: locationStatus === "loading" || locationStatus === "resolving" ? "wait" : "pointer", font: "inherit" }}>
          {locationStatus === "nearby" ? "Clear location preference" : locationStatus === "loading" ? "Finding your location…" : locationStatus === "resolving" ? "Finding your address…" : "Use my location"}
        </button>
        <span id={`${props.id}-location-hint`} role="status" aria-label="Location preference" style={{ color: "var(--ms-muted, #667085)" }}>
          {locationStatus === "nearby" ? locationFeedback === "filled" ? "Current address filled. Check it before continuing." :
            locationFeedback === "not-found" ? "Couldn’t fill your address. Type an address; nearby matches come first." : "Nearby matches first. You can still choose any address." :
            locationStatus === "loading" || locationStatus === "resolving" ? "You can keep typing while we look it up." :
            locationStatus === "denied" ? "Location permission is off. You can still type any address." :
            locationStatus === "unavailable" ? "Couldn’t find your location. You can still type any address." :
            "Optional · Fill your current address"}
        </span>
        {addressSource === "google" && <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" width={120} height={14} />}
        {addressSource === "photon" && <a href="https://www.openstreetmap.org/copyright" style={{ color: "var(--ms-muted, #667085)", fontSize: "0.85em" }}>© OpenStreetMap</a>}
      </div>
    </div>
  );
}
