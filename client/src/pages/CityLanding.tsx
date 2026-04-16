import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { withCsrfHeader } from "@/lib/csrf";
import { analyticsEvents } from "@/lib/analytics";

type CityLandingData = {
  ok: boolean;
  city: string;
  citySlug: string;
  activation: {
    founderApproved: boolean;
    status: string | null;
    cityThesis: string | null;
    primarySiteLane: string | null;
    primaryWorkflowLane: string | null;
    lawfulAccessModes: string[];
  } | null;
  ledgerSummary: {
    trackedSupplyProspectsContacted: number;
    trackedBuyerTargetsResearched: number;
    trackedCityOpeningSendActionsReady: number;
    trackedCityOpeningSendActionsSent: number;
    trackedCityOpeningResponsesRecorded: number;
    wideningGuard: {
      wideningAllowed: boolean;
      reasons: string[];
    };
    onboardedCapturers: number;
  } | null;
};

export default function CityLanding() {
  const params = useParams<{ citySlug: string }>();
  const citySlug = params.citySlug || "";
  const [data, setData] = useState<CityLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [locationType, setLocationType] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!citySlug) {
      setError("City slug is required");
      setLoading(false);
      return;
    }

    async function fetchCityData() {
      try {
        const res = await fetch(
          `/api/city-launch/status?city=${encodeURIComponent(citySlug.replace(/-/g, " "))}`,
          {
            headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          },
        );
        if (!res.ok) {
          throw new Error(`Failed to load city data: ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load city data");
      } finally {
        setLoading(false);
      }
    }

    fetchCityData();
  }, [citySlug]);

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          email,
          locationType,
          role: "capturer",
          market: data?.city || citySlug.replace(/-/g, " "),
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        analyticsEvents.cityOpeningResponseReceived({
          city: data?.city || citySlug,
          citySlug,
          lane: "public-commercial-community",
          responseType: "waitlist_signup",
          routingTarget: "supply_qualification",
        });
      }
    } catch {
      // Best-effort
    }
  };

  const cityName = data?.city || citySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <p className="mt-4 text-sm text-slate-500">Loading {cityName}...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold text-slate-900">{cityName}</h1>
          <p className="mt-2 text-slate-600">
            {error || "This city is not yet active on Blueprint."}
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Sign up below to be notified when Blueprint launches in your area.
          </p>
          <form onSubmit={handleWaitlistSubmit} className="mt-6 flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              Notify me
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isActive = data.activation?.status && data.activation.status !== "planning";
  const thesis = data.activation?.cityThesis;
  const siteLane = data.activation?.primarySiteLane;
  const workflowLane = data.activation?.primaryWorkflowLane;
  const accessModes = data.activation?.lawfulAccessModes || [];
  const ledger = data.ledgerSummary;

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
            {isActive ? "Active City" : "Coming Soon"}
          </span>
          {data.activation?.status && (
            <span>{data.activation.status.replace(/_/g, " ")}</span>
          )}
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Blueprint in {cityName}
        </h1>
        {thesis && (
          <p className="mt-4 max-w-2xl text-lg text-slate-600">{thesis}</p>
        )}
        {isActive && (
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/api/waitlist"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Request site capture
            </a>
            <a
              href="/contact"
              className="inline-flex items-center rounded-full border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Contact ops team
            </a>
          </div>
        )}
      </section>

      {/* What we capture */}
      {isActive && (
        <section className="border-t border-slate-100 bg-slate-50 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl font-bold text-slate-900">
              What Blueprint captures in {cityName}
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {siteLane && (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="font-semibold text-slate-900">Site type</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {siteLane.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                </div>
              )}
              {workflowLane && (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="font-semibold text-slate-900">Workflow focus</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {workflowLane.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                </div>
              )}
              {accessModes.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                  <h3 className="font-semibold text-slate-900">Access modes</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {accessModes.join(", ").replace(/_/g, " ")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Progress indicators */}
      {isActive && ledger && (
        <section className="border-t border-slate-100 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="text-2xl font-bold text-slate-900">
              {cityName} launch progress
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">
                  {ledger.trackedCityOpeningSendActionsSent}
                </p>
                <p className="text-xs text-slate-500">Outreach sent</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">
                  {ledger.trackedCityOpeningResponsesRecorded}
                </p>
                <p className="text-xs text-slate-500">Responses received</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">
                  {ledger.onboardedCapturers}
                </p>
                <p className="text-xs text-slate-500">Capturers onboarded</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-center">
                <p className="text-2xl font-bold text-slate-900">
                  {ledger.trackedBuyerTargetsResearched}
                </p>
                <p className="text-xs text-slate-500">Buyer targets</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Signup form */}
      <section id="signup-form" className="border-t border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto max-w-lg px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            {isActive
              ? `Join the ${cityName} capture program`
              : `Get notified when Blueprint launches in ${cityName}`}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {isActive
              ? "Sign up to participate in site capture, hosted reviews, or buyer programs."
              : "Enter your email and we'll reach out when your city is active."}
          </p>

          {submitted ? (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
              Thanks for your interest! We'll be in touch soon.
            </div>
          ) : (
            <form onSubmit={handleWaitlistSubmit} className="mt-6 flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm"
              />
              <input
                value={locationType}
                onChange={(e) => setLocationType(e.target.value)}
                placeholder="e.g. Warehouse, grocery, manufacturing facility"
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm"
              />
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
              >
                {isActive ? "Request access" : "Notify me"}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-slate-400">
          Blueprint Capture — exact-site world models for robotics.
          <br />
          This city page is auto-generated from the city launch profile.
        </div>
      </footer>
    </div>
  );
}
