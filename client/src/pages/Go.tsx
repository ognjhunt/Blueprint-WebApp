import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const APP_STORE_URL =
  import.meta.env.VITE_APP_STORE_URL ??
  "https://apps.apple.com/app/idYOUR_APP_ID";
const PLAY_STORE_URL =
  import.meta.env.VITE_PLAY_STORE_URL ??
  "https://play.google.com/store/apps/details?id=io.tryblueprint.app";

type Platform = "ios" | "android" | "other";

type Phase = "boot" | "requestingLocation" | "locating" | "ready" | "error";

type Coordinates = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
};

interface NearbyVenue {
  id: string;
  slug: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  distanceMeters: number | null;
}

interface NearbyVenuesResponse {
  venues?: NearbyVenue[];
}

const STORAGE_KEY = "blueprint:pendingSession";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") {
    return "other";
  }

  const ua = navigator.userAgent || navigator.vendor || "";

  if (/android/i.test(ua)) {
    return "android";
  }

  if (/iPad|iPhone|iPod/.test(ua)) {
    return "ios";
  }

  return "other";
}

function formatDistance(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters)) {
    return null;
  }

  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km >= 10 ? Math.round(km) : km.toFixed(1)} km away`;
  }

  if (meters < 50) {
    return "right here";
  }

  return `${Math.max(1, Math.round(meters))} m away`;
}

function generateToken(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function persistContext(
  token: string,
  intent: string,
  version: string | null,
  venue: NearbyVenue,
  coordinates: Coordinates | null,
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = {
    token,
    intent,
    version,
    venue,
    coordinates,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Unable to persist session context to localStorage", error);
  }

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Unable to persist session context to sessionStorage", error);
  }

  try {
    document.cookie = `bp_pending=${token}; path=/; max-age=86400; SameSite=Lax`;
  } catch (error) {
    console.warn("Unable to set pending session cookie", error);
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("pending", token);
    if (venue.slug) {
      url.searchParams.set("venue", venue.slug);
      url.searchParams.delete("venueId");
    } else {
      url.searchParams.set("venueId", venue.id);
      url.searchParams.delete("venue");
    }
    window.history.replaceState({}, "", url.toString());
  } catch (error) {
    console.warn("Unable to update URL with pending session token", error);
  }
}

async function createPendingSession(
  body: Record<string, unknown>,
): Promise<{ token: string | null }> {
  try {
    const response = await fetch("/api/qr/pending-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to create pending session (${response.status})`);
    }

    const data = (await response.json()) as { token?: string };
    return { token: typeof data.token === "string" ? data.token : null };
  } catch (error) {
    console.warn("Pending session creation failed", error);
    return { token: null };
  }
}

async function fetchNearbyVenues(
  coordinates: Coordinates | null,
): Promise<NearbyVenue[] | null> {
  try {
    const params = new URLSearchParams();
    params.set("limit", "5");
    if (coordinates) {
      params.set("lat", coordinates.latitude.toString());
      params.set("lng", coordinates.longitude.toString());
    }

    const response = await fetch(`/api/qr/nearby?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Failed to load venues (${response.status})`);
    }

    const data = (await response.json()) as NearbyVenuesResponse;
    if (!Array.isArray(data.venues)) {
      return [];
    }

    return data.venues;
  } catch (error) {
    console.warn("Failed to fetch nearby venues", error);
    return null;
  }
}

function buildDeepLink(
  intent: string,
  version: string | null,
  platform: Platform,
  venue: NearbyVenue,
  token: string,
) {
  const params = new URLSearchParams();
  params.set("intent", intent);
  if (version) {
    params.set("v", version);
  }
  params.set("pending", token);
  if (venue.slug) {
    params.set("venue", venue.slug);
  } else {
    params.set("venueId", venue.id);
  }
  params.set("platformHint", platform);
  return `blueprint://enter?${params.toString()}`;
}

export default function Go() {
  const { intent, version, existingToken } = useMemo(() => {
    if (typeof window === "undefined") {
      return { intent: "welcome", version: "3", existingToken: null };
    }

    const params = new URLSearchParams(window.location.search);
    return {
      intent: params.get("intent") ?? "welcome",
      version: params.get("v"),
      existingToken: params.get("pending"),
    };
  }, []);

  const [platform, setPlatform] = useState<Platform>(() => detectPlatform());
  const [phase, setPhase] = useState<Phase>("boot");
  const [statusMessage, setStatusMessage] = useState(
    "Preparing your Blueprint experience…",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [venues, setVenues] = useState<NearbyVenue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(
    existingToken,
  );
  const [hasAutoLaunched, setHasAutoLaunched] = useState(false);
  const [deepLinkAttempted, setDeepLinkAttempted] = useState(false);
  const [showStorePrompt, setShowStorePrompt] = useState(false);
  const promptFallbackRef = useRef<number | null>(null);
  const storeRedirectRef = useRef<number | null>(null);
  const [isFetchingVenues, setIsFetchingVenues] = useState(false);

  const selectedVenue = useMemo(
    () => venues.find((venue) => venue.id === selectedVenueId) ?? null,
    [venues, selectedVenueId],
  );

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  useEffect(() => {
    return () => {
      if (promptFallbackRef.current !== null) {
        window.clearTimeout(promptFallbackRef.current);
        promptFallbackRef.current = null;
      }
      if (storeRedirectRef.current !== null) {
        window.clearTimeout(storeRedirectRef.current);
        storeRedirectRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (promptFallbackRef.current !== null) {
          window.clearTimeout(promptFallbackRef.current);
          promptFallbackRef.current = null;
        }
        if (storeRedirectRef.current !== null) {
          window.clearTimeout(storeRedirectRef.current);
          storeRedirectRef.current = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const loadVenues = useCallback(async (coords: Coordinates | null) => {
    setIsFetchingVenues(true);
    const results = await fetchNearbyVenues(coords);
    setIsFetchingVenues(false);

    if (results === null) {
      setErrorMessage(
        "We couldn't reach Blueprint to look up nearby locations. You can still open the app below.",
      );
      setPhase("error");
      setShowStorePrompt(true);
      return;
    }

    if (results.length === 0) {
      setErrorMessage(
        "Blueprint is coming soon to this area. We'll open the welcome screen so you can get started.",
      );
      setVenues([]);
      setPhase("ready");
      setShowStorePrompt(true);
      return;
    }

    setVenues(results);
    setSelectedVenueId((current) => current ?? results[0]?.id ?? null);
    setPhase("ready");
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErrorMessage(
        "Location access is turned off in your browser. We'll open Blueprint, but tap “Allow” inside the app for full context.",
      );
      setPhase("ready");
      setShowStorePrompt(true);
      void loadVenues(null);
      return;
    }

    setPhase("requestingLocation");
    setStatusMessage("Checking your location to find the right Blueprint…");

    const timeoutId = window.setTimeout(() => {
      setStatusMessage("Still working on locating you…");
    }, 3000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(timeoutId);
        const coords: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
        };
        setCoordinates(coords);
        setPhase("locating");
        setStatusMessage("Found you—connecting to the nearest Blueprint…");
        void loadVenues(coords);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMessage(
            "We can't access your location yet. The Blueprint app will still open, but grant location permissions inside the app for the immersive version.",
          );
        } else {
          setErrorMessage(
            "We couldn't determine your location. Pick your Blueprint below and continue.",
          );
        }
        setPhase("ready");
        setShowStorePrompt(true);
        void loadVenues(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [loadVenues]);

  const handleLaunch = useCallback(
    (
      venue: NearbyVenue,
      token: string,
      { manual }: { manual?: boolean } = {},
    ) => {
      if (!token) {
        return;
      }

      persistContext(token, intent, version ?? null, venue, coordinates);
      setShowStorePrompt(false);
      setDeepLinkAttempted(true);
      setStatusMessage(
        manual ? "Opening the Blueprint app…" : "Connecting you to Blueprint…",
      );

      if (promptFallbackRef.current !== null) {
        window.clearTimeout(promptFallbackRef.current);
        promptFallbackRef.current = null;
      }
      if (storeRedirectRef.current !== null) {
        window.clearTimeout(storeRedirectRef.current);
        storeRedirectRef.current = null;
      }

      const timeoutId = window.setTimeout(
        () => {
          setShowStorePrompt(true);
          setStatusMessage(
            "If the Blueprint app didn't open, install it below or tap the button to try again after install.",
          );

          if (storeRedirectRef.current !== null) {
            window.clearTimeout(storeRedirectRef.current);
            storeRedirectRef.current = null;
          }

          if (platform === "ios" || platform === "android") {
            const storeUrl =
              platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
            const storeTimeoutId = window.setTimeout(() => {
              if (document.visibilityState === "visible") {
                window.location.href = storeUrl;
              }
            }, 1200);
            storeRedirectRef.current = storeTimeoutId;
          }
        },
        manual ? 1500 : 2200,
      );

      promptFallbackRef.current = timeoutId;

      const deepLink = buildDeepLink(
        intent,
        version ?? null,
        platform,
        venue,
        token,
      );
      window.location.href = deepLink;
    },
    [coordinates, intent, platform, version],
  );

  const prepareAndLaunch = useCallback(
    async (
      venue: NearbyVenue,
      { manualLaunch }: { manualLaunch?: boolean } = {},
    ) => {
      const token =
        sessionToken ??
        (
          await createPendingSession({
            intent,
            version,
            platform,
            venueId: venue.id,
            venueName: venue.name,
            venueSlug: venue.slug ?? undefined,
            coordinates: coordinates
              ? {
                  lat: coordinates.latitude,
                  lng: coordinates.longitude,
                  accuracy: coordinates.accuracy ?? undefined,
                }
              : undefined,
            distanceMeters: venue.distanceMeters ?? undefined,
          })
        ).token ??
        generateToken();

      setSessionToken(token);
      handleLaunch(venue, token, { manual: manualLaunch });
    },
    [coordinates, handleLaunch, intent, platform, sessionToken, version],
  );

  useEffect(() => {
    if (
      !selectedVenue ||
      hasAutoLaunched ||
      isFetchingVenues ||
      phase !== "ready"
    ) {
      return;
    }

    let cancelled = false;

    (async () => {
      await prepareAndLaunch(selectedVenue, { manualLaunch: false });
      if (!cancelled) {
        setHasAutoLaunched(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hasAutoLaunched,
    isFetchingVenues,
    phase,
    prepareAndLaunch,
    selectedVenue,
  ]);

  const storeLinks = useMemo(() => {
    const links: Array<{
      label: string;
      href: string;
      platform: Platform;
    } | null> = [
      {
        label: "Download on the App Store",
        href: APP_STORE_URL,
        platform: "ios",
      },
      {
        label: "Get it on Google Play",
        href: PLAY_STORE_URL,
        platform: "android",
      },
    ];

    const currentPlatform = platform;
    return links
      .filter(Boolean)
      .filter(
        (link) =>
          link &&
          (currentPlatform === "other" || link.platform === currentPlatform),
      ) as Array<{
      label: string;
      href: string;
      platform: Platform;
    }>;
  }, [platform]);

  const selectedDistance = formatDistance(
    selectedVenue?.distanceMeters ?? null,
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 pb-16 pt-12">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-300">
            Blueprint Link
          </p>
          <h1 className="text-3xl font-semibold text-white md:text-4xl">
            We’re loading your Blueprint experience
          </h1>
          <p className="max-w-xl text-base text-slate-300">{statusMessage}</p>
        </header>

        {errorMessage && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
            {errorMessage}
          </div>
        )}

        <section className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-white">
              Nearest Blueprint
            </h2>
            <p className="text-sm text-slate-300">
              {phase === "requestingLocation" && "Requesting location…"}
              {phase === "locating" && "Finding a match near you…"}
              {phase === "ready" &&
                (selectedVenue
                  ? "Confirm the Blueprint you want to open."
                  : "Blueprint will open to the welcome screen.")}
              {phase === "error" &&
                "We’ll open Blueprint without a specific location."}
            </p>
          </div>

          <div className="grid gap-3">
            {isFetchingVenues && (
              <div className="animate-pulse rounded-xl border border-white/5 bg-white/10 p-4 text-sm text-slate-200/80">
                Looking up nearby Blueprints…
              </div>
            )}

            {venues.map((venue) => {
              const isSelected = venue.id === selectedVenueId;
              return (
                <button
                  key={venue.id}
                  type="button"
                  onClick={() => setSelectedVenueId(venue.id)}
                  className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                    isSelected
                      ? "border-blue-400/70 bg-blue-500/15 text-white"
                      : "border-white/10 bg-white/5 text-slate-200 hover:border-blue-400/40 hover:bg-blue-500/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">{venue.name}</p>
                      <p className="text-sm text-slate-300">
                        {[venue.address, venue.city, venue.state]
                          .filter(Boolean)
                          .join(", ") || "Blueprint location"}
                      </p>
                    </div>
                    {formatDistance(venue.distanceMeters ?? null) && (
                      <span className="text-xs font-medium uppercase tracking-wide text-blue-200">
                        {formatDistance(venue.distanceMeters)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

            {phase === "ready" && venues.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                No specific Blueprint detected nearby. We’ll route you to the
                welcome screen so you can choose inside the app.
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-white">
                {selectedVenue ? selectedVenue.name : "Blueprint Welcome"}
              </p>
              <p className="text-xs text-slate-300">
                {selectedVenue
                  ? (selectedDistance ?? "Close by")
                  : "We’ll start you on the welcome screen."}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() =>
                  selectedVenue &&
                  prepareAndLaunch(selectedVenue, { manualLaunch: true })
                }
                className="inline-flex items-center justify-center rounded-full bg-blue-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Open Blueprint App
              </button>
              <a
                href="https://blueprint.tryblueprint.io/help/mobile"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Need help?
              </a>
            </div>
          </div>
        </section>

        {(showStorePrompt || !deepLinkAttempted) && (
          <section className="space-y-3 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold text-white">
              Install or reopen the Blueprint app
            </h2>
            <p className="text-sm text-slate-300">
              If the app didn’t open automatically, install it for your device
              and then tap “Open Blueprint App” again.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              {storeLinks.map((link) => (
                <a
                  key={link.platform}
                  href={link.href}
                  className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/10 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </section>
        )}

        <footer className="mt-auto space-y-2 border-t border-white/10 pt-6 text-xs text-slate-400">
          <p>
            Once inside the Blueprint app, we’ll pair with your Meta glasses and
            continue the experience with camera, mic, and spatial context.
          </p>
          <p>
            Questions? Email{" "}
            <a
              href="mailto:hello@tryblueprint.io"
              className="text-blue-300 underline"
            >
              hello@tryblueprint.io
            </a>
            .
          </p>
        </footer>
      </div>
    </div>
  );
}
