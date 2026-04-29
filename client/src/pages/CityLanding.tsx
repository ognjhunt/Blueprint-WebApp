import { useMemo, useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowRight, CheckCircle2, Clock3, MapPinned } from "lucide-react";
import { SEO } from "@/components/SEO";
import {
  EditorialSectionLabel,
  MonochromeMedia,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { analyticsEvents } from "@/lib/analytics";
import { withCsrfHeader } from "@/lib/csrf";
import { editorialRefreshAssets } from "@/lib/editorialRefreshAssets";
import { publicCaptureGeneratedAssets } from "@/lib/publicCaptureGeneratedAssets";
import type { PublicLaunchCity, PublicLaunchCityStatus } from "@/lib/publicLaunchStatus";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";
import { useAuth } from "@/contexts/AuthContext";

function humanizeCitySlug(citySlug: string) {
  return citySlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const captureRules = [
  {
    title: "Infrastructure readiness",
    body:
      "Industrial density, road coverage, and permitting conditions should support high-quality, repeatable capture before the city reads as open.",
    icon: CheckCircle2,
  },
  {
    title: "Operational variance",
    body:
      "A launch city should have enough varied facilities and workflows that the capture program becomes useful beyond one single pilot lane.",
    icon: Clock3,
  },
  {
    title: "Partner network",
    body:
      "Local operators and reviewers need to be in place to support safety, compliance, and review quality before public availability opens.",
    icon: MapPinned,
  },
];

type CityPresentation = {
  heroImage: string;
  detailImage: string;
  latitude?: number;
  longitude?: number;
};

const cityPresentationBySlug: Record<string, CityPresentation> = {
  "austin-tx": {
    heroImage: editorialRefreshAssets.cityAustinHero,
    detailImage: editorialRefreshAssets.cityMapBoard,
    latitude: 30.2672,
    longitude: -97.7431,
  },
  "durham-nc": {
    heroImage: publicCaptureGeneratedAssets.everydayPlacesCollage,
    detailImage: publicCaptureGeneratedAssets.hostedReviewPublicRoute,
    latitude: 35.994,
    longitude: -78.8986,
  },
  "sacramento-ca": {
    heroImage: publicCaptureGeneratedAssets.harborMallCommonCorridor,
    detailImage: editorialRefreshAssets.cityMapBoard,
    latitude: 38.5816,
    longitude: -121.4944,
  },
  "san-diego-ca": {
    heroImage: publicCaptureGeneratedAssets.northlineHotelLobbyLoop,
    detailImage: publicCaptureGeneratedAssets.everydayPlacesCollage,
    latitude: 32.7157,
    longitude: -117.1611,
  },
  "san-francisco-ca": {
    heroImage: publicCaptureGeneratedAssets.atlasRetailServiceAisle,
    detailImage: editorialRefreshAssets.cityMapBoard,
    latitude: 37.7749,
    longitude: -122.4194,
  },
  "san-jose-ca": {
    heroImage: publicCaptureGeneratedAssets.cedarMarketAisleLoop,
    detailImage: publicCaptureGeneratedAssets.cedarMarketProofBoard,
    latitude: 37.3382,
    longitude: -121.8863,
  },
  "seattle-wa": {
    heroImage: publicCaptureGeneratedAssets.governancePublicCaptureExplainer,
    detailImage: editorialRefreshAssets.cityMapBoard,
    latitude: 47.6062,
    longitude: -122.3321,
  },
};

const defaultCityPresentation: CityPresentation = {
  heroImage: editorialRefreshAssets.cityMapBoard,
  detailImage: publicCaptureGeneratedAssets.everydayPlacesCollage,
};

function getCityPresentation(citySlug: string) {
  return cityPresentationBySlug[citySlug.toLowerCase()] || defaultCityPresentation;
}

function formatCoordinate(value: number, positiveDirection: string, negativeDirection: string) {
  const direction = value >= 0 ? positiveDirection : negativeDirection;
  return `${Math.abs(value).toFixed(4)}° ${direction}`;
}

function getCoordinateLines(
  city: PublicLaunchCity | null,
  presentation: CityPresentation,
) {
  const latitude = typeof city?.latitude === "number" ? city.latitude : presentation.latitude;
  const longitude = typeof city?.longitude === "number" ? city.longitude : presentation.longitude;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return ["Coordinates pending", "Launch record required"];
  }

  return [
    formatCoordinate(latitude, "N", "S"),
    formatCoordinate(longitude, "E", "W"),
  ];
}

function getCityStatusLabel(status: PublicLaunchCityStatus | null, fallback: "loading" | "error" | "untracked") {
  if (fallback === "loading") return "Checking";
  if (fallback === "error") return "Unverified";
  if (status === "live") return "Current";
  if (status === "planned") return "Planned";
  if (status === "under_review") return "In review";
  return "Future signal";
}

function getCityWindowLabel(status: PublicLaunchCityStatus | null, fallback: "loading" | "error" | "untracked") {
  if (fallback === "loading") return "Checking";
  if (fallback === "error") return "Verify first";
  if (status === "live") return "Current";
  if (status === "planned") return "Queued";
  if (status === "under_review") return "Review";
  return "TBD";
}

export default function CityLanding() {
  const params = useParams<{ citySlug: string }>();
  const citySlug = (params.citySlug || "").toLowerCase();
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const { data, loading, error } = usePublicLaunchStatus();

  useEffect(() => {
    // Per BLU-321: Keep Austin operator-facing only until live proof-motion path is verified
    const normalized = citySlug.toLowerCase().replace(/-/g, '');
    const isAustin = normalized === 'austin' || normalized === 'austintx';
    if (isAustin && !currentUser) {
      navigate(`/sign-in?redirect=/city/${citySlug}`);
    }
  }, [citySlug, currentUser, navigate]);
  const [email, setEmail] = useState("");
  const [locationType, setLocationType] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const supportedCities = data?.supportedCities ?? [];
  const publicCities = data?.cities ?? [];
  const supportedCity = useMemo(
    () => supportedCities.find((city) => city.citySlug === citySlug) || null,
    [citySlug, supportedCities],
  );
  const trackedCity = useMemo(
    () => publicCities.find((city) => city.citySlug === citySlug) || null,
    [citySlug, publicCities],
  );
  const cityRecord = trackedCity || supportedCity;
  const cityName = cityRecord?.displayName || humanizeCitySlug(citySlug);
  const isSupported = Boolean(supportedCity || trackedCity?.status === "live");
  const cityStatus = trackedCity?.status ?? (isSupported ? "live" : null);
  const fallbackState: "loading" | "error" | "untracked" = loading
    ? "loading"
    : error
      ? "error"
      : "untracked";
  const statusLabel = getCityStatusLabel(cityStatus, fallbackState);
  const windowLabel = getCityWindowLabel(cityStatus, fallbackState);
  const cityPresentation = getCityPresentation(citySlug);
  const coordinateLines = getCoordinateLines(trackedCity, cityPresentation);
  const rosterCities = publicCities.slice(0, 8);

  const handleWaitlistSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) {
      return;
    }

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          email: email.trim(),
          locationType: locationType.trim() || "City capture interest",
          role: "capturer",
          market: cityName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit city waitlist: ${response.status}`);
      }

      setSubmitted(true);
      analyticsEvents.cityOpeningResponseReceived({
        city: cityName,
        citySlug,
        lane: isSupported ? "public-commercial-community" : "future-city-interest",
        responseType: isSupported ? "capturer_application" : "future_city_waitlist",
        routingTarget: isSupported ? "capturer_review" : "city_launch_queue",
      });
    } catch {
      // Best-effort public intake.
    }
  };

  return (
    <>
      <SEO
        title={`${cityName} | Capture Rollout | Blueprint`}
        description={`Blueprint capture rollout status and future-city signal path for ${cityName}.`}
        canonical={`/city/${citySlug}`}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-px lg:grid-cols-[0.42fr_0.58fr]">
            <div className="bg-[#f5f3ef] px-8 py-10 lg:px-12 lg:py-14">
              <EditorialSectionLabel>
                {loading
                  ? "Launch status check"
                  : isSupported
                    ? "Current capture rollout"
                    : "Future-city interest"}
              </EditorialSectionLabel>
              <h1 className="font-editorial mt-6 text-[4.2rem] leading-[0.88] tracking-[-0.08em] text-slate-950 sm:text-[5.8rem]">
                {cityName}
              </h1>
              <p className="mt-4 text-[1.9rem] leading-tight tracking-[-0.03em] text-slate-900">
                {isSupported ? "Current capture rollout" : "Future-city review"}
              </p>
              <div className="mt-6 h-1 w-12 bg-slate-950" />
              <p className="mt-6 max-w-[28rem] text-base leading-8 text-slate-700">
                {loading
                  ? "Checking current launch-city support."
                  : error
                    ? `Blueprint could not verify current launch status for ${cityName}. This page will not treat the city as open from cached copy.`
                  : isSupported
                    ? `${cityName} is in current launch-approved capture routing. Field teams and partner reviewers still go through the approved city window for this market.`
                    : `${cityName} is not in Blueprint's current capture rollout. You can still leave a signal here, but public capture access stays locked until the launch org approves the city.`}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href={isSupported && !loading && !error ? "/signup/capturer" : "#city-waitlist"}
                  className="inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {isSupported && !loading && !error
                    ? "Apply for capturer access"
                    : "Join future-city waitlist"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href={isSupported && !loading && !error ? "/capture-app" : "/capture"}
                  className="inline-flex items-center justify-center border border-black/10 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  {isSupported && !loading && !error ? "Open capture app" : "Read capture basics"}
                </a>
              </div>
              <div className="mt-8 grid max-w-[30rem] grid-cols-3 gap-4 border-t border-black/10 pt-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Status</p>
                  <p className="mt-2 text-sm text-slate-900">{statusLabel}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Launch window
                  </p>
                  <p className="mt-2 text-sm text-slate-900">{windowLabel}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Capture partner
                  </p>
                  <p className="mt-2 text-sm text-slate-900">
                    {isSupported ? "Vetted network" : "Signal needed"}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative min-h-[38rem]">
              <MonochromeMedia
                src={cityPresentation.heroImage}
                alt={`${cityName} launch planning visual`}
                className="min-h-[38rem] rounded-none"
                loading="eager"
                imageClassName="min-h-[38rem]"
                overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.08))]"
              />
              <div className="absolute right-8 top-8 text-right text-[12px] uppercase tracking-[0.18em] text-slate-900">
                <div>{coordinateLines[0]}</div>
                <div className="mt-1">{coordinateLines[1]}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10">
          <div className="grid gap-4 lg:grid-cols-3">
            {captureRules.map((rule, index) => {
              const Icon = rule.icon;
              return (
                <article key={rule.title} className="border border-black/10 bg-white">
                  <div className="px-6 py-5">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      Launch logic
                    </p>
                    <div className="mt-5 flex items-start gap-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-[#f5f3ef] text-slate-700">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                          0{index + 1}
                        </p>
                        <h2 className="mt-2 text-[1.8rem] leading-[0.95] tracking-[-0.04em] text-slate-950">
                          {rule.title}
                        </h2>
                        <p className="mt-4 text-sm leading-7 text-slate-700">{rule.body}</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-black/10 bg-[#f5f3ef] p-4">
                    <MonochromeMedia
                      src={
                        index === 0
                          ? editorialRefreshAssets.cityMapBoard
                          : cityPresentation.detailImage
                      }
                      alt={rule.title}
                      className="aspect-[4/3] rounded-none"
                      imageClassName={
                        index === 0
                          ? "aspect-[4/3] object-cover"
                          : index === 1
                            ? "aspect-[4/3] object-cover object-bottom"
                            : "aspect-[4/3] object-cover object-left"
                      }
                      overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0.08))]"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[96rem] gap-px px-5 py-10 lg:grid-cols-[0.4fr_0.6fr] sm:px-8 lg:px-10">
            <div className="border border-black/10 bg-[#f5f3ef]">
              <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                <span>City status roster</span>
                <span>Capture availability overview</span>
              </div>
              <div className="divide-y divide-black/10">
                {rosterCities.map((city) => {
                  const active = city.citySlug === citySlug;
                  const rowStatus = getCityStatusLabel(city.status, "untracked");
                  const rowWindow = getCityWindowLabel(city.status, "untracked");
                  return (
                    <a
                      key={city.citySlug}
                      href={`/city/${city.citySlug}`}
                      className={`grid grid-cols-[1.3fr_0.7fr_0.8fr_auto] items-center gap-3 px-5 py-4 text-sm transition ${
                        active
                          ? "bg-slate-950 text-white"
                          : "bg-white text-slate-800 hover:bg-[#f8f6f1]"
                      }`}
                    >
                      <span>{city.displayName}</span>
                      <span>{rowStatus}</span>
                      <span>{rowWindow}</span>
                      <ArrowRight className="h-4 w-4" />
                    </a>
                  );
                })}
                {!rosterCities.length && !loading ? (
                  <div className="px-5 py-6 text-sm text-slate-600">
                    No launch cities are currently visible in the public roster.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="relative overflow-hidden border border-black/10 bg-[#f5f3ef]">
              <MonochromeMedia
                src={editorialRefreshAssets.cityMapBoard}
                alt={`${cityName} review map`}
                className="min-h-[26rem] rounded-none"
                imageClassName="min-h-[26rem] object-cover"
                overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.16),rgba(255,255,255,0.02))]"
              >
                <RouteTraceOverlay light={false} className="opacity-40" />
              </MonochromeMedia>
            </div>
          </div>
        </section>

        <section id="city-waitlist" className="mx-auto max-w-[96rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="grid gap-6 lg:grid-cols-[0.52fr_0.48fr]">
            <div className="bg-white p-8">
              <EditorialSectionLabel>
                {isSupported ? "Capturer access" : "Future-city access"}
              </EditorialSectionLabel>
              <h2 className="font-editorial mt-5 max-w-[24rem] text-[3rem] leading-[0.92] tracking-[-0.05em] text-slate-950">
                {isSupported ? `Apply for ${cityName} access.` : "Join the future-city waitlist."}
              </h2>
              <div className="mt-5 h-1 w-12 bg-slate-950" />
              <p className="mt-6 max-w-[28rem] text-sm leading-7 text-slate-700">
                {isSupported
                  ? `Field access still routes through review. Use this path if you want to capture in ${cityName} inside the current launch-approved window.`
                  : `Get notified when ${cityName} enters review or opens publicly. Early access goes to operators, owners, and independent capturers once the city actually qualifies.`}
              </p>

              {submitted ? (
                <div className="mt-6 border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                  Thanks. Blueprint has your city interest and will route it through the launch
                  workflow.
                </div>
              ) : (
                <form onSubmit={handleWaitlistSubmit} className="mt-8 flex max-w-[26rem] flex-col gap-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                  />
                  <input
                    value={locationType}
                    onChange={(event) => setLocationType(event.target.value)}
                    placeholder="Organization or facility type"
                    className="border border-black/10 bg-[#f8f6f1] px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                  />
                  <button
                    type="submit"
                    className="mt-2 inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {isSupported ? "Request capturer review" : "Join future-city waitlist"}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </form>
              )}
            </div>

            <div className="grid gap-4 lg:grid-rows-[1fr_auto]">
              <MonochromeMedia
                src={cityPresentation.detailImage}
                alt={`${cityName} launch packet`}
                className="min-h-[22rem] border border-black/10 rounded-none"
                imageClassName="min-h-[22rem] object-cover object-right"
                overlayClassName="bg-[linear-gradient(180deg,rgba(255,255,255,0.24),rgba(255,255,255,0.02))]"
              >
                <div className="absolute right-6 top-6 max-w-[14rem] border border-black/10 bg-white/90 p-5 text-slate-900 backdrop-blur-sm">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    Launch review
                  </p>
                  <p className="mt-3 text-2xl tracking-[-0.05em]">{cityName}</p>
                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <div>Status: {statusLabel}</div>
                    <div>Priority zones: city-approved only</div>
                    <div>Notes: field teams follow the launch packet</div>
                  </div>
                </div>
              </MonochromeMedia>
              <div className="border border-black/10 bg-slate-950 px-6 py-5 text-white">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">
                  Why this page exists
                </p>
                <p className="mt-4 max-w-[32rem] text-sm leading-7 text-white/70">
                  The city page should never imply generic public capture availability. It exists
                  to show whether the city is open right now or still in review, and to capture the
                  next durable signal if it is not.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
