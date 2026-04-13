import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

type CityLaunchScorecardResponse = {
  city: {
    key: string;
    label: string;
  };
  generatedAt: string;
  supply: ScoreMetric[];
  demand: ScoreMetric[];
  budget: {
    tier: string | null;
    totalRecordedSpendUsd: number;
    withinPolicySpendUsd: number;
    outsidePolicySpendUsd: number;
  };
  activation: {
    founderApproved: boolean;
    status: string | null;
    wideningAllowed: boolean;
    wideningReasons: string[];
    rootIssueId: string | null;
    cityThesis: string | null;
    primarySiteLane: string | null;
    primaryWorkflowLane: string | null;
    primaryBuyerProofPath: string | null;
    lawfulAccessModes: string[];
    validationBlockers: Array<{
      key: string;
      summary: string;
      severity: string;
      validationRequired: boolean;
      ownerLane: string | null;
    }>;
    metricsDependencies: Array<{
      key: string;
      kind: string;
      status: "required_not_tracked" | "tracked_not_verified" | "verified";
      actualCount: number;
      ownerLane: string | null;
      notes: string | null;
    }>;
    sourceActivationPayloadPath: string | null;
  };
  warnings: string[];
  dataSources: string[];
};

type ActivationResponse = {
  ok: boolean;
  result?: {
    city: string;
    budgetTier: string;
    status: string;
    paperclip?: {
      rootIssueId: string | null;
      rootIssueIdentifier: string | null;
      dispatched: Array<{ key: string; issueId: string }>;
      error?: string | null;
    };
  };
  error?: string;
};

type Props = {
  params?: {
    citySlug?: string;
  };
};

function cityFromSlug(slug?: string) {
  const normalized = String(slug || "austin").trim().replace(/^\/+|\/+$/g, "");
  const humanized = normalized
    .split("-")
    .map((entry) => (entry.length <= 2 ? entry.toUpperCase() : `${entry.charAt(0).toUpperCase()}${entry.slice(1)}`))
    .join(" ");

  if (normalized === "austin") return "Austin, TX";
  if (normalized === "austin-tx") return "Austin, TX";
  if (normalized === "san-francisco") return "San Francisco, CA";
  if (normalized === "san-francisco-ca") return "San Francisco, CA";
  return humanized;
}

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
  return metric.status === "on_track"
    ? "text-emerald-700"
    : metric.status === "at_risk"
      ? "text-amber-700"
      : metric.status === "blocked"
        ? "text-rose-700"
        : "text-zinc-500";
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

export default function AdminAustinLaunchScorecard({ params }: Props) {
  const queryClient = useQueryClient();
  const [cityInput, setCityInput] = useState(cityFromSlug(params?.citySlug));
  const [budgetTier, setBudgetTier] = useState("zero_budget");
  const [founderApproved, setFounderApproved] = useState(false);
  const [activationNotice, setActivationNotice] = useState("");
  const [activationError, setActivationError] = useState("");

  useEffect(() => {
    setCityInput(cityFromSlug(params?.citySlug));
  }, [params?.citySlug]);

  const scorecardQuery = useQuery<CityLaunchScorecardResponse>({
    queryKey: ["admin-city-launch-scorecard", cityInput],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/leads/city-launch-scorecard?city=${encodeURIComponent(cityInput)}`,
        {
          headers: await withCsrfHeader({}),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch city launch scorecard");
      }
      return response.json();
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/growth/city-launch/activate", {
        method: "POST",
        headers: await withCsrfHeader({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          city: cityInput,
          budgetTier,
          founderApproved,
        }),
      });
      const payload = (await response.json()) as ActivationResponse;
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Failed to activate city launch");
      }
      return payload;
    },
    onSuccess: async (payload) => {
      setActivationError("");
      setActivationNotice(
        [
          `Refreshed ${payload.result?.city || cityInput}.`,
          `Budget tier: ${payload.result?.budgetTier || budgetTier}.`,
          payload.result?.paperclip?.rootIssueIdentifier
            ? `Root issue: ${payload.result.paperclip.rootIssueIdentifier}.`
            : payload.result?.paperclip?.rootIssueId
              ? `Root issue id: ${payload.result.paperclip.rootIssueId}.`
              : "Paperclip root issue unavailable.",
        ].join(" "),
      );
      await queryClient.invalidateQueries({
        queryKey: ["admin-city-launch-scorecard", cityInput],
      });
    },
    onError: (error) => {
      setActivationNotice("");
      setActivationError(error instanceof Error ? error.message : "Failed to activate city launch");
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
              Generic city launcher scorecard
            </h1>
            <p className="mt-2 max-w-3xl text-zinc-600">
              Run the bounded city launcher, inspect the live issue tree, and verify that supply, demand, and spend are grounded in canonical launch ledgers.
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

        <div className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium">City</span>
              <input
                value={cityInput}
                onChange={(event) => setCityInput(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
                placeholder="Chicago, IL"
              />
            </label>
            <label className="space-y-2 text-sm text-zinc-700">
              <span className="font-medium">Budget Tier</span>
              <select
                value={budgetTier}
                onChange={(event) => setBudgetTier(event.target.value)}
                className="w-full rounded-xl border border-zinc-300 px-3 py-2"
              >
                <option value="zero_budget">Zero budget</option>
                <option value="low_budget">Low budget</option>
                <option value="funded">Funded</option>
              </select>
            </label>
            <label className="flex items-center gap-3 rounded-xl border border-zinc-200 px-4 py-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={founderApproved}
                onChange={(event) => setFounderApproved(event.target.checked)}
              />
              <span>Founder approved</span>
            </label>
            <button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {activateMutation.isPending ? "Refreshing…" : "Refresh launch"}
            </button>
          </div>
          {activationNotice ? (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {activationNotice}
            </div>
          ) : null}
          {activationError ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {activationError}
            </div>
          ) : null}
        </div>

        {scorecardQuery.isLoading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
            Loading city launch scorecard...
          </div>
        ) : scorecardQuery.isError || !scorecard ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
            Failed to load the city launch scorecard.
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

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Activation
                </p>
                <div className="mt-4 space-y-2 text-sm text-zinc-700">
                  <div>Founder approved: {scorecard.activation.founderApproved ? "Yes" : "No"}</div>
                  <div>Status: {scorecard.activation.status || "Not activated yet"}</div>
                  <div>Widening allowed: {scorecard.activation.wideningAllowed ? "Yes" : "No"}</div>
                  <div>Root issue: {scorecard.activation.rootIssueId || "Not created"}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Budget
                </p>
                <div className="mt-4 space-y-2 text-sm text-zinc-700">
                  <div>Tier: {scorecard.budget.tier || "Unknown"}</div>
                  <div>Total recorded: ${scorecard.budget.totalRecordedSpendUsd.toLocaleString()}</div>
                  <div>Within policy: ${scorecard.budget.withinPolicySpendUsd.toLocaleString()}</div>
                  <div>Outside policy: ${scorecard.budget.outsidePolicySpendUsd.toLocaleString()}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Expansion Guard
                </p>
                <div className="mt-4 space-y-2 text-sm text-zinc-700">
                  {scorecard.activation.wideningReasons.length > 0 ? (
                    scorecard.activation.wideningReasons.map((reason) => (
                      <div key={reason} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                        {reason}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                      Current city has met the widening threshold.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Activation Payload
                </p>
                <div className="mt-4 space-y-3 text-sm text-zinc-700">
                  <div>
                    <span className="font-medium text-zinc-900">City thesis:</span>{" "}
                    {scorecard.activation.cityThesis || "Missing"}
                  </div>
                  <div>
                    <span className="font-medium text-zinc-900">Primary site lane:</span>{" "}
                    {scorecard.activation.primarySiteLane || "Missing"}
                  </div>
                  <div>
                    <span className="font-medium text-zinc-900">Primary workflow lane:</span>{" "}
                    {scorecard.activation.primaryWorkflowLane || "Missing"}
                  </div>
                  <div>
                    <span className="font-medium text-zinc-900">Primary proof path:</span>{" "}
                    {scorecard.activation.primaryBuyerProofPath || "Missing"}
                  </div>
                  <div>
                    <span className="font-medium text-zinc-900">Lawful access modes:</span>{" "}
                    {scorecard.activation.lawfulAccessModes.length > 0
                      ? scorecard.activation.lawfulAccessModes.join(", ")
                      : "Missing"}
                  </div>
                  <div>
                    <span className="font-medium text-zinc-900">Activation payload source:</span>{" "}
                    {scorecard.activation.sourceActivationPayloadPath || "Unavailable"}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Validation Blockers
                </p>
                <div className="mt-4 space-y-3">
                  {scorecard.activation.validationBlockers.length > 0 ? (
                    scorecard.activation.validationBlockers.map((blocker) => (
                      <div
                        key={blocker.key}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                      >
                        <div className="font-medium">
                          {blocker.severity.toUpperCase()} · {blocker.summary}
                        </div>
                        <div className="mt-1 text-xs opacity-80">
                          owner: {blocker.ownerLane || "none"} · validation required: {blocker.validationRequired ? "yes" : "no"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                      No activation-payload validation blockers recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Supply loop
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-zinc-950">
                    Capturer activation
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
                    Proof-led buyer motion
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
                Metrics Readiness
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {scorecard.activation.metricsDependencies.map((dependency) => (
                  <div
                    key={dependency.key}
                    className={`rounded-xl border px-4 py-3 text-sm ${
                      dependency.status === "verified"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                        : dependency.status === "tracked_not_verified"
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : "border-rose-200 bg-rose-50 text-rose-900"
                    }`}
                  >
                    <div className="font-medium">{dependency.key}</div>
                    <div className="mt-1 text-xs opacity-80">
                      status: {dependency.status} · count: {dependency.actualCount} · owner: {dependency.ownerLane || "none"}
                    </div>
                    {dependency.notes ? (
                      <div className="mt-2 text-xs opacity-80">{dependency.notes}</div>
                    ) : null}
                  </div>
                ))}
              </div>
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
