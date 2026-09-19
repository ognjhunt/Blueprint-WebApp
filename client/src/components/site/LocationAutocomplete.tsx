/**
 * The location field, with suggestions — and a floor of "just type it".
 *
 * ## Three providers, in order of preference
 *
 * 1. **Google Places**, when `VITE_GOOGLE_MAPS_API_KEY` is set. The best
 *    suggestions, and the one most sites will recognise.
 * 2. **Photon** (photon.komoot.io), a free, keyless geocoder built for
 *    autocomplete, used when there is no Google key or Google errors out
 *    (over quota, request denied). This is the "free alternative".
 * 3. **Plain typing**, always. The field is a real text input; suggestions are
 *    an overlay on top of it. If every provider is down, or the network is, or
 *    the person just wants to type "Durham, NC", nothing is in their way.
 *
 * Nothing here is required for the form to submit: the input carries the same
 * `name` it always did, so whatever is typed or picked is what gets posted. A
 * geocoder being slow or blocked degrades to typing, never to a broken field.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface Suggestion {
  label: string;
}

/** Build one readable line from a Photon feature's address parts. */
function photonLabel(props: Record<string, unknown>): string {
  const str = (key: string) => (typeof props[key] === "string" ? (props[key] as string) : "");
  const street = [str("street"), str("housenumber")].filter(Boolean).join(" ");
  const parts = [str("name"), street, str("city"), str("state"), str("country")].filter(Boolean);
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
    const label = photonLabel(feature.properties ?? {});
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push({ label });
    }
  }
  return out;
}

let googleMapsLoad: Promise<boolean> | null = null;

/** Load the Google Maps Places SDK once, resolving false if it cannot. */
function loadGoogleMaps(key: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const existing = (window as unknown as { google?: { maps?: { places?: unknown } } }).google;
  if (existing?.maps?.places) return Promise.resolve(true);
  if (googleMapsLoad) return googleMapsLoad;

  googleMapsLoad = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
    // Do not hang the field on a slow SDK; fall back to typing/Photon.
    window.setTimeout(() => resolve(Boolean((window as unknown as { google?: { maps?: { places?: unknown } } }).google?.maps?.places)), 6000);
  });
  return googleMapsLoad;
}

async function googleSuggestions(query: string, key: string): Promise<Suggestion[] | null> {
  const loaded = await loadGoogleMaps(key);
  if (!loaded) return null; // signal the caller to fall back
  const places = (window as unknown as {
    google: { maps: { places: { AutocompleteService: new () => {
      getPlacePredictions: (
        request: { input: string },
        callback: (predictions: { description: string }[] | null, status: string) => void,
      ) => void;
    } } } };
  }).google.maps.places;

  return new Promise<Suggestion[] | null>((resolve) => {
    try {
      new places.AutocompleteService().getPlacePredictions({ input: query }, (predictions, status) => {
        if (status !== "OK" || !predictions) {
          // Over quota / request denied / zero results: let the caller decide
          // whether to fall back (non-OK) or just show nothing (zero results).
          resolve(status === "ZERO_RESULTS" ? [] : null);
          return;
        }
        resolve(predictions.map((prediction) => ({ label: prediction.description })));
      });
    } catch {
      resolve(null);
    }
  });
}

export function LocationAutocomplete(props: {
  id: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(props.defaultValue ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const debounce = useRef<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const googleKey =
    (import.meta.env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || "";

  const query = useCallback(
    async (text: string) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      try {
        let results: Suggestion[] | null = null;
        if (googleKey) {
          results = await googleSuggestions(text, googleKey);
        }
        // No Google key, or Google could not answer: the free provider.
        if (results === null) {
          results = await photonSuggestions(text, controller.signal);
        }
        if (!controller.signal.aborted) {
          setSuggestions(results);
          setOpen(results.length > 0);
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
    setValue(text);
    if (debounce.current) window.clearTimeout(debounce.current);
    if (text.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounce.current = window.setTimeout(() => void query(text), 250);
  }

  function choose(label: string) {
    setValue(label);
    setSuggestions([]);
    setOpen(false);
    setActive(-1);
  }

  useEffect(() => {
    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
      abort.current?.abort();
    };
  }, []);

  // The list is absolutely positioned, so it does not scroll with the page:
  // leaving it open while the operator scrolls parks it over whichever field —
  // often the submit button — scrolled beneath it. Closing on any scroll costs
  // one refocus and keeps the form readable; the text stays in the input.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
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
      choose(suggestions[active >= 0 ? active : 0].label);
    } else if (event.key === "Escape") {
      setOpen(false);
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
        placeholder={props.placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        // Let a click on a suggestion register before the blur closes the list.
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        style={{ width: "100%" }}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            left: 0,
            right: 0,
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
              role="option"
              aria-selected={index === active}
              // onMouseDown, not onClick: it fires before the input's blur.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(suggestion.label);
              }}
              onMouseEnter={() => setActive(index)}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                background: index === active ? "var(--ms-hover, #f3f4f6)" : "transparent",
              }}
            >
              {suggestion.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
