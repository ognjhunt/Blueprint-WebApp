import { useCallback, useEffect, useRef, useState } from "react";
import { getGoogleMapsApiKey } from "@/lib/client-env";
import type { PlaceLocationMetadata } from "@/types/inbound-request";
import type { ReactNode } from "react";

type Prediction = google.maps.places.AutocompletePrediction;
type GoogleMapsLoaderModule = typeof import("@googlemaps/js-api-loader") & {
  default?: typeof import("@googlemaps/js-api-loader");
};

interface PlaceAutocompleteInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (metadata: PlaceLocationMetadata) => void;
  label?: string;
  placeholder?: string;
  wrapperClassName?: string;
  labelClassName?: string;
  inputWrapperClassName?: string;
  inputClassName?: string;
  icon?: ReactNode;
  country?: string;
  required?: boolean;
}

let googleMapsLoadPromise: Promise<typeof google> | null = null;

function loadGooglePlaces(apiKey: string) {
  if (!googleMapsLoadPromise) {
    googleMapsLoadPromise = import("@googlemaps/js-api-loader").then((loaderModule) => {
      const mapsLoaderModule = loaderModule as GoogleMapsLoaderModule;
      const LoaderConstructor =
        mapsLoaderModule.Loader || mapsLoaderModule.default?.Loader;

      if (!LoaderConstructor) {
        throw new Error("Google Maps JS API loader is unavailable.");
      }

      return new LoaderConstructor({
        apiKey,
        version: "weekly",
        libraries: ["places"],
      }).load();
    });
  }

  return googleMapsLoadPromise;
}

function getAddressComponent(
  place: google.maps.places.PlaceResult,
  type: string,
  name: "long_name" | "short_name" = "long_name",
) {
  return (
    place.address_components?.find((component) => component.types.includes(type))?.[name] ??
    null
  );
}

function getCity(place: google.maps.places.PlaceResult) {
  return (
    getAddressComponent(place, "locality") ||
    getAddressComponent(place, "postal_town") ||
    getAddressComponent(place, "administrative_area_level_2") ||
    getAddressComponent(place, "sublocality")
  );
}

function placeToMetadata(place: google.maps.places.PlaceResult): PlaceLocationMetadata {
  const location = place.geometry?.location;

  return {
    source: "google_places",
    placeId: place.place_id ?? null,
    formattedAddress: place.formatted_address ?? place.name ?? null,
    lat: location ? location.lat() : null,
    lng: location ? location.lng() : null,
    city: getCity(place),
    state: getAddressComponent(place, "administrative_area_level_1", "short_name"),
    country: getAddressComponent(place, "country", "short_name"),
    postalCode: getAddressComponent(place, "postal_code"),
  };
}

export function resolvePlaceLocationMetadata(
  value: string,
  metadata?: PlaceLocationMetadata | null,
): PlaceLocationMetadata | undefined {
  const hasStructuredMetadata = Boolean(
    metadata &&
      (metadata.placeId ||
        metadata.formattedAddress ||
        metadata.city ||
        metadata.state ||
        metadata.country ||
        metadata.postalCode ||
        typeof metadata.lat === "number" ||
        typeof metadata.lng === "number"),
  );

  if (hasStructuredMetadata) {
    return metadata || undefined;
  }

  const formattedAddress = value.trim();
  return formattedAddress
    ? {
        source: "manual",
        formattedAddress,
      }
    : undefined;
}

export function PlaceAutocompleteInput({
  id,
  value,
  onChange,
  onPlaceSelect,
  label,
  placeholder,
  wrapperClassName = "",
  labelClassName = "mb-1 block text-sm font-medium text-zinc-700",
  inputWrapperClassName = "relative",
  inputClassName = "w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm",
  icon,
  country = "us",
  required = false,
}: PlaceAutocompleteInputProps) {
  const apiKey = getGoogleMapsApiKey();
  const autocompleteServiceRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const placesServiceRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [autocompleteReady, setAutocompleteReady] = useState(false);

  useEffect(() => {
    if (!apiKey || typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    let isMounted = true;

    loadGooglePlaces(apiKey)
      .then((maps) => {
        if (!isMounted || !maps.maps?.places) {
          return;
        }

        autocompleteServiceRef.current = new maps.maps.places.AutocompleteService();
        sessionTokenRef.current = new maps.maps.places.AutocompleteSessionToken();
        const placesNode = document.createElement("div");
        placesServiceRef.current = new maps.maps.places.PlacesService(placesNode);
        setAutocompleteReady(true);
      })
      .catch(() => {
        if (isMounted) {
          setAutocompleteReady(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [apiKey]);

  useEffect(() => {
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    const query = value.trim();
    if (!autocompleteReady || !autocompleteServiceRef.current || query.length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }

    debounceTimerRef.current = window.setTimeout(() => {
      autocompleteServiceRef.current?.getPlacePredictions(
        {
          input: query,
          componentRestrictions: country ? { country } : undefined,
          sessionToken: sessionTokenRef.current ?? undefined,
        },
        (nextPredictions, status) => {
          if (
            status !== google.maps.places.PlacesServiceStatus.OK ||
            !nextPredictions?.length
          ) {
            setPredictions([]);
            setIsOpen(false);
            return;
          }

          setPredictions(nextPredictions.slice(0, 5));
          setIsOpen(true);
        },
      );
    }, 180);

    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [autocompleteReady, country, value]);

  const handleManualChange = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      onPlaceSelect?.({
        source: "manual",
        formattedAddress: nextValue.trim() || null,
      });
    },
    [onChange, onPlaceSelect],
  );

  const handlePredictionSelect = useCallback(
    (prediction: Prediction) => {
      const placesService = placesServiceRef.current;
      if (!placesService) {
        handleManualChange(prediction.description);
        setPredictions([]);
        setIsOpen(false);
        return;
      }

      placesService.getDetails(
        {
          placeId: prediction.place_id,
          fields: [
            "place_id",
            "formatted_address",
            "geometry",
            "address_components",
            "name",
          ],
          sessionToken: sessionTokenRef.current ?? undefined,
        },
        (place, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
            handleManualChange(prediction.description);
            return;
          }

          const metadata = placeToMetadata(place);
          onChange(metadata.formattedAddress || prediction.description);
          onPlaceSelect?.(metadata);
          sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        },
      );

      setPredictions([]);
      setIsOpen(false);
    },
    [handleManualChange, onChange, onPlaceSelect],
  );

  return (
    <div className={wrapperClassName}>
      {label ? (
        <label htmlFor={id} className={labelClassName}>
          {label}
        </label>
      ) : null}
      <div className={inputWrapperClassName}>
        {icon}
        <input
          id={id}
          className={inputClassName}
          placeholder={placeholder}
          value={value}
          required={required}
          autoComplete="off"
          aria-autocomplete={autocompleteReady ? "list" : "none"}
          aria-expanded={autocompleteReady ? isOpen : undefined}
          aria-controls={isOpen ? `${id}-place-options` : undefined}
          onChange={(event) => handleManualChange(event.target.value)}
          onFocus={() => {
            if (predictions.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
        />
        {isOpen && predictions.length > 0 ? (
          <div
            id={`${id}-place-options`}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-30 overflow-hidden rounded-xl border border-zinc-200 bg-white text-left shadow-lg"
          >
            {predictions.map((prediction) => (
              <button
                key={prediction.place_id}
                type="button"
                role="option"
                className="block w-full px-4 py-3 text-left text-sm text-zinc-800 transition hover:bg-zinc-50 focus:bg-zinc-50 focus:outline-none"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handlePredictionSelect(prediction)}
              >
                <span className="block font-medium">
                  {prediction.structured_formatting?.main_text || prediction.description}
                </span>
                {prediction.structured_formatting?.secondary_text ? (
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {prediction.structured_formatting.secondary_text}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
