import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { withCsrfHeader } from "@/lib/csrf";

type ScoreMetric = {
  key: string;
  label: string;
  actual: number | null;
  targetMin: number;
  targetMax: number | null;
  tracked: boolean;
  status: "not_tracked" | "blocked" | "at_risk" | "on_track";
  note: string | null;
};

type AustinLaunchScorecardResponse = {
  city: {
    key: "austin";
    label: "Austin, TX";
  };
  generatedAt: string;
  supply: ScoreMetric[];
  demand: ScoreMetric[];
  warnings: string[];
  dataSources: string[];
};

function formatTarget(metric: ScoreMetric) {
  return metric.targetMax ? `${metric.targetMin}-${metric.targetMax}` : `${metric.targetMin}+`;
}

function tone(metric: ScoreMetric) {
  switch (metric.status) {
    case "on_track":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "at_risk":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "blocked":
      return "border-rose-200 bg-rose-50 text-rose-900";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}

function sectionTone(metric: ScoreMetric) {
  return metric.status === "on_track" ? "text-emerald-700" : metric.status === "at_risk" ? "text-amber-700" : metric.status === "blocked" ? "text-rose-700" : "text-zinc-500";
}

function MetricCard({ metric }: { metric: ScoreMetric }) {
  return (
    <div className={`rounded-2xl border p-5 ${tone(metric)}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
            {metric.tracked ? metric.status.replace(/_/g, " ") : "not tracked"}
          </p>
          <h3 className="mt-2 text-base font-semibold">{metric.label}</h3>
        </div>
        <div className="text-right">
          <p className="text-3xl font-semibold">
            {metric.actual === null ? "N/A" : metric.actual}
          </p>
          <p className="text-xs opacity-70">Target {formatTarget(metric)}</p>
        </div>
      </div>
      {metric.note ? <p className="mt-3 text-sm opacity-80">{metric.note}</p> : null}
    </div>
  );
}

export default function AdminAustinLaunchScorecard() {
  const scorecardQuery = useQuery<AustinLaunchScorecardResponse>({
    queryKey: ["admin-austin-launch-scorecard"],
    queryFn: async () => {
      const response = await fetch("/api/admin/leads/city-launch-scorecard", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch Austin launch scorecard");
      }
      return response.json();
    },
  });

  const scorecard = scorecardQuery.data;

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              City Launch
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
              Austin execution scorecard
            </h1>
            <p className="mt-2 max-w-3xl text-zinc-600">
              Austin launch progress from repo-truth sources only. Metrics that do not yet have a canonical source stay explicitly untracked.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/growth-ops-scorecard"
              className="inline-flex rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
            >
              Growth scorecard
            </Link>
            <Link
              href="/admin/leads"
              className="inline-flex rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
            >
              Admin queue
            </Link>
          </div>
        </div>

        {scorecardQuery.isLoading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
            Loading Austin scorecard...
          </div>
        ) : scorecardQuery.isError || !scorecard ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
            Failed to load the Austin scorecard.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    City
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
                    {scorecard.city.label}
                  </h2>
                </div>
                <div className="text-sm text-zinc-500">
                  Generated {new Date(scorecard.generatedAt).toLocaleString()}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {scorecard.dataSources.map((source) => (
                  <span
                    key={source}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Supply loop
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                    Austin capturer activation
                  </h2>
                </div>
                <div className="grid gap-4">
                  {scorecard.supply.map((metric) => (
                    <MetricCard key={metric.key} metric={metric} />
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Demand loop
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                    Austin proof-led buyer motion
                  </h2>
                </div>
                <div className="grid gap-4">
                  {scorecard.demand.map((metric) => (
                    <MetricCard key={metric.key} metric={metric} />
                  ))}
                </div>
              </section>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Warnings
              </p>
              <div className="mt-4 space-y-3">
                {scorecard.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Quick read
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[...scorecard.supply, ...scorecard.demand].map((metric) => (
                  <div key={`summary-${metric.key}`} className="flex items-center justify-between rounded-xl border border-zinc-200 px-4 py-3 text-sm">
                    <span className="text-zinc-700">{metric.label}</span>
                    <span className={sectionTone(metric)}>
                      {metric.actual === null ? "N/A" : metric.actual} / {formatTarget(metric)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
