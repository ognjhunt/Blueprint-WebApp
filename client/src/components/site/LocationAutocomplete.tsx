/** Google Places (New), with keyless suggestions and manual entry as fallbacks. */
import { useCallback, useEffect, useRef, useState } from "react";
import { getGoogleMapsApiKey } from "@/lib/client-env";

interface Suggestion {
  label: string;
  /** ISO 3166-1 alpha-2, upper case, when the provider knows it. */
  countryCode: string | null;
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

async function photonSuggestions(query: string, signal: AbortSignal): Promise<Suggestion[]> {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
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

// Places loads when the field mounts, before the user starts typing. The SDK's
// loader is shared with other Maps consumers, avoiding duplicate script loads.
let googleMapsLoad: Promise<boolean> | null = null;

function googlePlaces() {
  return typeof window !== "undefined" ? window.google?.maps?.places : undefined;
}

function loadGoogleMaps(key: string): Promise<boolean> {
  if (googlePlaces()?.AutocompleteSuggestion) return Promise.resolve(true);
  if (!googleMapsLoad) {
    googleMapsLoad = import("@googlemaps/js-api-loader")
      .then(({ Loader }) => new Loader({ apiKey: key, version: "weekly", libraries: ["places"] }).load())
      .then(() => Boolean(googlePlaces()?.AutocompleteSuggestion))
      .catch(() => false);
  }
  return googleMapsLoad;
}

/** Bound provider latency; clear the timer when the request finishes. */
function within<T>(request: Promise<T>, milliseconds: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), milliseconds);
    request.then(resolve, () => resolve(fallback)).finally(() => window.clearTimeout(timer));
  });
}

async function googleSuggestions(
  query: string,
  sessionToken: google.maps.places.AutocompleteSessionToken,
): Promise<Suggestion[] | null> {
  const places = googlePlaces();
  if (!places?.AutocompleteSuggestion) return null;
  try {
    const result = await within(
      places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: query, sessionToken }),
      1200,
      null,
    );
    return result?.suggestions.flatMap(({ placePrediction }) => placePrediction ? [{
      label: placePrediction.text.toString(),
      countryCode: null,
      googlePrediction: placePrediction,
    }] : []).slice(0, 5) ?? null;
  } catch {
    return null;
  }
}

/** Details use the prediction's billing session and authoritative country. */
async function googleCountryCode(prediction: google.maps.places.PlacePrediction): Promise<string | null> {
  try {
    const place = prediction.toPlace();
    const result = await within(place.fetchFields({ fields: ["addressComponents"] }), 1500, null);
    const country = result?.place.addressComponents?.find((part) => part.types.includes("country"));
    const code = country?.shortText?.trim().toUpperCase() ?? "";
    return /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
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
  const sessionToken = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const focused = useRef(false);
  const googleKey = getGoogleMapsApiKey();

  useEffect(() => {
    if (googleKey) void loadGoogleMaps(googleKey);
  }, [googleKey]);

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
        if (googleKey && !googlePlaces()?.AutocompleteSuggestion) {
          await within(loadGoogleMaps(googleKey), 800, false);
          if (controller.signal.aborted) return;
        }
        const places = googleKey ? googlePlaces() : undefined;
        if (places?.AutocompleteSuggestion) {
          sessionToken.current ??= new places.AutocompleteSessionToken();
          results = await googleSuggestions(text, sessionToken.current);
        }
        if (controller.signal.aborted) return;
        // No Google key, or Google could not answer: the free provider.
        if (results === null) {
          results = await photonSuggestions(text, controller.signal);
        }
        if (!controller.signal.aborted) {
          setSuggestions(results);
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
    [googleKey],
  );

  function onChange(text: string) {
    selectionGeneration.current += 1;
    cancelQuery();
    focused.current = true;
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
    const generation = ++selectionGeneration.current;
    cancelQuery();
    sessionToken.current = null;
    setValue(suggestion.label);
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
    let countryCode = suggestion.countryCode;
    if (suggestion.googlePrediction) {
      // The visible location has already changed. Clear the prior inferred
      // country while structured details are pending, including on failure.
      props.onSelectionChange?.({ label: suggestion.label, countryCode: null });
      countryCode = await googleCountryCode(suggestion.googlePrediction);
      if (selectionGeneration.current !== generation) return;
    }
    const place = { label: suggestion.label, countryCode };
    props.onSelect?.(place);
    props.onSelectionChange?.(place);
  }

  useEffect(() => {
    return () => {
      selectionGeneration.current += 1;
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
      setOpen(false);
    };
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open, props.id]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      cancelQuery();
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
        aria-controls={open ? `${props.id}-options` : undefined}
        aria-activedescendant={open && active >= 0 ? `${props.id}-option-${active}` : undefined}
        placeholder={props.placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => {
          focused.current = false;
          cancelQuery();
          setOpen(false);
        }}
        onFocus={() => {
          focused.current = true;
          if (suggestions.length > 0) setOpen(true);
        }}
        style={{ width: "100%" }}
      />
      {open && suggestions.length > 0 && (
        <div style={{ position: "absolute", zIndex: 20, left: 0, right: 0 }}>
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
                {suggestion.googlePrediction?.mainText ? (
                  <>
                    <span style={{ display: "block", fontWeight: 500 }}>{suggestion.googlePrediction.mainText.toString()}</span>
                    <span style={{ display: "block", fontSize: "0.85em", color: "var(--ms-muted, #667085)", marginTop: "3px" }}>
                      {suggestion.googlePrediction.secondaryText?.toString()}
                    </span>
                  </>
                ) : suggestion.label}
              </li>
            ))}
          </ul>
          {suggestions.some((suggestion) => suggestion.googlePrediction) && (
            <div style={{ padding: "8px 12px", background: "var(--ms-surface, #fff)", textAlign: "right", borderRadius: "0 0 8px 8px" }}>
              <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" width={120} height={14} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
