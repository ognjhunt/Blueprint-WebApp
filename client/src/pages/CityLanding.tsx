import { useMemo, useState } from "react";
import { useParams } from "wouter";
import { ArrowRight, CheckCircle2, Clock3, MapPinned } from "lucide-react";
import { analyticsEvents } from "@/lib/analytics";
import { withCsrfHeader } from "@/lib/csrf";
import { findLaunchCityBySlug } from "@/lib/publicLaunchStatus";
import { usePublicLaunchStatus } from "@/hooks/usePublicLaunchStatus";

function humanizeCitySlug(citySlug: string) {
  return citySlug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const captureRules = [
  {
    title: "Only approved targets open publicly",
    body: "Blueprint Capture shows research-backed, launch-approved capture opportunities. It does not open generic nearby discovery as a public card just because a place is close.",
    icon: CheckCircle2,
  },
  {
    title: "Nearby places can still enter review",
    body: "When someone opens the app, nearby places can be submitted into the city-launch research loop. Those places stay under review until the org qualifies and approves them.",
    icon: Clock3,
  },
  {
    title: "City support is explicit",
    body: "This page only claims current support when the launch-city system says the city is open. Everything else stays in future-city interest until the rollout changes.",
    icon: MapPinned,
  },
];

export default function CityLanding() {
  const params = useParams<{ citySlug: string }>();
  const citySlug = params.citySlug || "";
  const { data, loading } = usePublicLaunchStatus();
  const [email, setEmail] = useState("");
  const [locationType, setLocationType] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const supportedCities = data?.supportedCities ?? [];
  const supportedCity = useMemo(
    () => findLaunchCityBySlug(supportedCities, citySlug),
    [citySlug, supportedCities],
  );
  const cityName = supportedCity?.displayName || humanizeCitySlug(citySlug);
  const isSupported = Boolean(supportedCity);

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
    <div className="min-h-screen bg-stone-50 text-slate-950">
      <section className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,116,144,0.08),_transparent_42%),linear-gradient(180deg,_rgba(255,255,255,0.98),_rgba(248,250,252,0.98))]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
                <MapPinned className="h-3.5 w-3.5" />
                {isSupported ? "Current capture rollout" : "Future-city interest"}
              </div>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                Blueprint capture in {cityName}
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                {loading
                  ? "Checking current launch-city support."
                  : isSupported
                    ? `${cityName} is in Blueprint's current capture rollout. Public capture access, nearby review, and mobile onboarding all follow the approved launch-city state for this city.`
                    : `${cityName} is not in Blueprint's current capture rollout. You can still leave your interest here, but the capture app and public capture feed stay locked until the launch org approves this city.`}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {isSupported ? (
                  <>
                    <a
                      href="/signup/capturer"
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Apply for capturer access
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href="/capture-app"
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                    >
                      Open capture app
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      href="#city-waitlist"
                      className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Join future-city waitlist
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                    <a
                      href="/capture"
                      className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                    >
                      Read capture basics
                    </a>
                  </>
                )}
              </div>
            </div>

            <aside className="rounded-[1.8rem] border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Current launch cities
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-slate-950">
                Website messaging follows launch approval, not a generic city list.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                These are the only cities that should read as currently open for public capture. If a city is not listed here, the right message is interest and review, not live availability.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                {supportedCities.map((city) => (
                  <a
                    key={city.citySlug}
                    href={`/city/${city.citySlug}`}
                    className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      city.citySlug === citySlug
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {city.displayName}
                  </a>
                ))}
                {!supportedCities.length && !loading ? (
                  <span className="text-sm text-slate-500">No cities are currently marked supported.</span>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {captureRules.map((rule) => {
            const Icon = rule.icon;
            return (
              <article key={rule.title} className="rounded-[1.6rem] border border-slate-200 bg-white p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-950">{rule.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{rule.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="city-waitlist" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {isSupported ? "Capturer access" : "Future-city signal"}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {isSupported
              ? `Apply for capturer access in ${cityName}`
              : `Tell Blueprint to watch ${cityName}`}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {isSupported
              ? "Use this if you want to capture in this city. Approval is still invite- and code-gated, but this city is currently in rollout."
              : "Use this if you want Blueprint to track interest in this city. This does not mean the city is open yet."}
          </p>

          {submitted ? (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
              Thanks. Blueprint has your city interest and will route it through the launch workflow.
            </div>
          ) : (
            <form onSubmit={handleWaitlistSubmit} className="mt-6 flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
              <input
                value={locationType}
                onChange={(event) => setLocationType(event.target.value)}
                placeholder="e.g. Grocery, warehouse, manufacturing facility"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
              <button
                type="submit"
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {isSupported ? "Request capturer review" : "Join future-city waitlist"}
              </button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
