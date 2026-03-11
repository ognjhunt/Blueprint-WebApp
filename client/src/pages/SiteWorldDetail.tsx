import { useEffect, useMemo, useState } from "react";
import { SEO } from "@/components/SEO";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { getSiteWorldById, siteWorldCards } from "@/data/siteWorlds";
import { ArrowLeft, Braces, Database, Play, TimerReset, X } from "lucide-react";

interface SiteWorldDetailProps {
  params: {
    slug: string;
  };
}

const sdkSnippet = `session = blueprint.site_worlds.create(
  site_id="sw-chi-01",
  robot="humanoid_v2",
  task="case_pick"
)

session.reset()
session.step(action)
session.export(format="rlds")`;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function SiteWorldDetail({ params }: SiteWorldDetailProps) {
  const site = getSiteWorldById(params.slug);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [params.slug]);

  useEffect(() => {
    if (!site) return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("start") === "1") {
      setSessionStartedAt(Date.now());
    } else {
      setSessionStartedAt(null);
      setElapsedSeconds(0);
    }
  }, [site]);

  useEffect(() => {
    if (!sessionStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setElapsedSeconds(Math.floor((Date.now() - sessionStartedAt) / 1000));
    };

    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 1000);
    return () => window.clearInterval(intervalId);
  }, [sessionStartedAt]);

  const relatedSites = useMemo(() => {
    if (!site) return [];
    return siteWorldCards.filter((item) => item.id !== site.id).slice(0, 3);
  }, [site]);

  if (!site) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900">Site world not found</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          The site world you are looking for does not exist in this placeholder catalog.
        </p>
        <a
          href="/site-worlds"
          className="mt-6 inline-flex items-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Back to Site Worlds
        </a>
      </div>
    );
  }

  const estimatedSpend = (site.hourlyRate * elapsedSeconds) / 3600;
  const sessionIsLive = sessionStartedAt !== null;

  return (
    <>
      <SEO
        title={`${site.siteName} | Site Worlds | Blueprint`}
        description={`${site.siteName} is a hosted site world for ${site.taskLane.toLowerCase()}. Start a billed session, inspect the runtime, and export the rollout data.`}
        canonical={`/site-worlds/${site.id}`}
      />

      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <a
            href="/site-worlds"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Site Worlds
          </a>

          <header className="mt-6 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {site.industry}
              </p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                {site.siteName}
              </h1>
              <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
                {site.summary}
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
                  {site.taskLane}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                  Starts now
                </span>
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">Session access</p>
              <p className="mt-2 text-3xl font-bold text-slate-900">
                {formatCurrency(site.hourlyRate)} / session-hour
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Billing starts when the environment launches. Exports are separate if your team
                wants a packaged delivery.
              </p>
              <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">Runtime</span>
                  <span className="font-medium text-slate-900">{site.runtime}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">Export</span>
                  <span className="font-medium text-slate-900">{site.exportFormat}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-500">Site code</span>
                  <span className="font-medium text-slate-900">{site.siteCode}</span>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                <a
                  href={`/site-worlds/${site.id}?start=1`}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Start billed session
                </a>
                <a
                  href="#runtime"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  See runtime details
                </a>
              </div>
            </aside>
          </header>

          <section className="mt-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <SiteWorldGraphic site={site} />
            </article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Standard starts
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Three clean ways to enter this environment.
              </h2>
              <div className="mt-5 space-y-3">
                {site.startStates.map((state) => (
                  <div key={state} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">{state}</p>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="mt-10 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <article className="rounded-3xl border border-slate-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                What exports
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                This page should tell the team exactly what it gets back.
              </h2>
              <div className="mt-5 space-y-3">
                {site.exportNotes.map((note) => (
                  <div key={note} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <Database className="mt-0.5 h-4 w-4 shrink-0 text-slate-900" />
                    <span>{note}</span>
                  </div>
                ))}
              </div>
            </article>

            <article id="runtime" className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <div className="flex items-center gap-2">
                <Braces className="h-5 w-5 text-slate-700" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Runtime shape
                </p>
              </div>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Start a session here. Use the runtime from your own stack.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                The point of the detail page is clarity. A team should see the rate, the start
                states, the runtime shape, and the export path in one place before it launches.
              </p>
              <pre className="mt-5 overflow-x-auto rounded-2xl bg-slate-950 p-5 text-sm leading-6 text-slate-100">
                <code>{sdkSnippet}</code>
              </pre>
            </article>
          </section>

          <section className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Related site worlds
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {relatedSites.map((relatedSite) => (
                <a
                  key={relatedSite.id}
                  href={`/site-worlds/${relatedSite.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {relatedSite.industry}
                  </p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{relatedSite.siteName}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{relatedSite.taskLane}</p>
                </a>
              ))}
            </div>
          </section>
        </div>

        {sessionIsLive ? (
          <div className="sticky bottom-4 z-30 mx-auto max-w-6xl px-4 pb-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-emerald-200 bg-white shadow-2xl shadow-emerald-100">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Session live
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{site.siteName}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Metered at {formatCurrency(site.hourlyRate)} per session-hour. Billing started
                    at launch.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 sm:items-center">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Elapsed
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatElapsed(elapsedSeconds)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Estimated spend
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatCurrency(estimatedSpend)}
                    </p>
                  </div>
                  <a
                    href={`/site-worlds/${site.id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    <X className="h-4 w-4" />
                    Stop session
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
