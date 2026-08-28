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
      return "border-runway-green-dim";
    case "at_risk":
      return "border-runway-signal-dim";
    case "blocked":
      return "border-runway-red-dim";
    default:
      return "border-runway-line";
  }
}

function chipTone(metric: ScoreMetric) {
  switch (metric.status) {
    case "on_track":
      return "runway-chip runway-chip-live";
    case "at_risk":
      return "runway-chip runway-chip-open";
    case "blocked":
      return "runway-chip runway-chip-fail";
    default:
      return "runway-chip runway-chip-quiet";
  }
}

function sectionTone(metric: ScoreMetric) {
  return metric.status === "on_track"
    ? "runway-num text-runway-green"
    : metric.status === "at_risk"
      ? "runway-num text-runway-signal"
      : metric.status === "blocked"
        ? "runway-num text-runway-red"
        : "runway-num text-runway-faint";
}

function MetricCard({ metric }: { metric: ScoreMetric }) {
  return (
    <div className={`rounded-none border bg-runway-panel p-5 ${tone(metric)}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={metric.tracked ? chipTone(metric) : "runway-chip runway-chip-quiet"}>
            {metric.tracked ? metric.status.replace(/_/g, " ") : "not tracked"}
          </p>
          <h3 className="mt-3 text-base font-semibold text-runway-text">{metric.label}</h3>
        </div>
        <div className="text-right">
          <p className="runway-num text-3xl font-semibold text-runway-text">
            {metric.actual === null ? "N/A" : metric.actual}
          </p>
          <p className="runway-meta mt-1">Target {formatTarget(metric)}</p>
        </div>
      </div>
      {metric.note ? <p className="mt-3 text-sm text-runway-mute">{metric.note}</p> : null}
    </div>
  );
}

export default function AdminAustinLaunchScorecard({ params }: Props) {
  const queryClient = useQueryClient();
  const [cityInput, setCityInput] = useState(cityFromSlug(params?.citySlug));
  const [budgetTier, setBudgetTier] = useState("lean");
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
    <div className="min-h-screen bg-runway-deep px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="runway-eyebrow-muted">
              City Launch
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-[0.005em] text-runway-text">
              Generic city launcher scorecard
            </h1>
            <p className="mt-2 max-w-3xl text-runway-mute">
              Run the bounded city launcher, inspect the live issue tree, and verify that supply, demand, and spend are grounded in canonical launch ledgers.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/growth-ops-scorecard"
              className="runway-cta-ghost"
            >
              Growth scorecard
            </Link>
            <Link
              href="/admin/leads"
              className="runway-cta-ghost"
            >
              Admin queue
            </Link>
          </div>
        </div>

        <div className="runway-panel p-6">
          <div className="grid items-end gap-4 lg:grid-cols-[2fr_1fr_1fr_auto]">
            <label className="block">
              <span className="runway-label">City</span>
              <input
                value={cityInput}
                onChange={(event) => setCityInput(event.target.value)}
                className="runway-input"
                placeholder="Chicago, IL"
              />
            </label>
            <label className="block">
              <span className="runway-label">Budget Tier</span>
              <select
                value={budgetTier}
                onChange={(event) => setBudgetTier(event.target.value)}
                className="runway-input"
              >
                <option value="lean">Lean</option>
                <option value="standard">Standard</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </label>
            <label className="flex min-h-[3.25rem] items-center gap-3 border border-runway-line-strong px-4 py-2 text-sm text-runway-body">
              <input
                type="checkbox"
                className="accent-runway-signal"
                checked={founderApproved}
                onChange={(event) => setFounderApproved(event.target.checked)}
              />
              <span>Founder approved</span>
            </label>
            <button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="runway-cta disabled:opacity-60"
            >
              {activateMutation.isPending ? "Refreshing…" : "Refresh launch"}
            </button>
          </div>
          {activationNotice ? (
            <div className="mt-4 border border-runway-green-dim px-4 py-3 text-sm text-runway-green">
              {activationNotice}
            </div>
          ) : null}
          {activationError ? (
            <div className="mt-4 border border-runway-red-dim px-4 py-3 text-sm text-runway-red">
              {activationError}
            </div>
          ) : null}
        </div>

        {scorecardQuery.isLoading ? (
          <div className="runway-panel p-6 text-runway-mute">
            Loading city launch scorecard...
          </div>
        ) : scorecardQuery.isError || !scorecard ? (
          <div className="rounded-none border border-runway-red-dim bg-runway-panel p-6 text-runway-red">
            Failed to load the city launch scorecard.
          </div>
        ) : (
          <>
            <div className="runway-panel p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="runway-eyebrow-muted">
                    City
                  </p>
                  <h2 className="mt-2 font-display text-2xl font-semibold uppercase tracking-[0.005em] text-runway-text">
                    {scorecard.city.label}
                  </h2>
                </div>
                <div className="runway-num text-sm text-runway-faint">
                  Generated {new Date(scorecard.generatedAt).toLocaleString()}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {scorecard.dataSources.map((source) => (
                  <span
                    key={source}
                    className="runway-chip runway-chip-quiet"
                  >
                    {source}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Activation
                </p>
                <div className="mt-4 space-y-2 text-sm text-runway-body">
                  <div>Founder approved: {scorecard.activation.founderApproved ? "Yes" : "No"}</div>
                  <div>Status: {scorecard.activation.status || "Not activated yet"}</div>
                  <div>Widening allowed: {scorecard.activation.wideningAllowed ? "Yes" : "No"}</div>
                  <div>Root issue: {scorecard.activation.rootIssueId || "Not created"}</div>
                </div>
              </div>

              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Budget
                </p>
                <div className="mt-4 space-y-2 text-sm text-runway-body">
                  <div>Tier: {scorecard.budget.tier || "Unknown"}</div>
                  <div>Total recorded: <span className="runway-num">${scorecard.budget.totalRecordedSpendUsd.toLocaleString()}</span></div>
                  <div>Within policy: <span className="runway-num">${scorecard.budget.withinPolicySpendUsd.toLocaleString()}</span></div>
                  <div>Outside policy: <span className="runway-num">${scorecard.budget.outsidePolicySpendUsd.toLocaleString()}</span></div>
                </div>
              </div>

              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Expansion Guard
                </p>
                <div className="mt-4 space-y-2 text-sm text-runway-body">
                  {scorecard.activation.wideningReasons.length > 0 ? (
                    scorecard.activation.wideningReasons.map((reason) => (
                      <div key={reason} className="border border-runway-signal-dim px-3 py-2 text-runway-signal">
                        {reason}
                      </div>
                    ))
                  ) : (
                    <div className="border border-runway-green-dim px-3 py-2 text-runway-green">
                      Current city has met the widening threshold.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Activation Payload
                </p>
                <div className="mt-4 space-y-3 text-sm text-runway-body">
                  <div>
                    <span className="font-medium text-runway-text">City thesis:</span>{" "}
                    {scorecard.activation.cityThesis || "Missing"}
                  </div>
                  <div>
                    <span className="font-medium text-runway-text">Primary site lane:</span>{" "}
                    {scorecard.activation.primarySiteLane || "Missing"}
                  </div>
                  <div>
                    <span className="font-medium text-runway-text">Primary workflow lane:</span>{" "}
                    {scorecard.activation.primaryWorkflowLane || "Missing"}
                  </div>
                  <div>
                    <span className="font-medium text-runway-text">Primary proof path:</span>{" "}
                    {scorecard.activation.primaryBuyerProofPath || "Missing"}
                  </div>
                  <div>
                    <span className="font-medium text-runway-text">Lawful access modes:</span>{" "}
                    {scorecard.activation.lawfulAccessModes.length > 0
                      ? scorecard.activation.lawfulAccessModes.join(", ")
                      : "Missing"}
                  </div>
                  <div>
                    <span className="font-medium text-runway-text">Activation payload source:</span>{" "}
                    {scorecard.activation.sourceActivationPayloadPath || "Unavailable"}
                  </div>
                </div>
              </div>

              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Validation Blockers
                </p>
                <div className="mt-4 space-y-3">
                  {scorecard.activation.validationBlockers.length > 0 ? (
                    scorecard.activation.validationBlockers.map((blocker) => (
                      <div
                        key={blocker.key}
                        className="border border-runway-signal-dim px-4 py-3 text-sm text-runway-body"
                      >
                        <div className="font-medium text-runway-signal">
                          {blocker.severity.toUpperCase()} · {blocker.summary}
                        </div>
                        <div className="mt-1 text-xs text-runway-faint">
                          owner: {blocker.ownerLane || "none"} · validation required: {blocker.validationRequired ? "yes" : "no"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="border border-runway-green-dim px-4 py-3 text-sm text-runway-green">
                      No activation-payload validation blockers recorded.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-4">
                <div>
                  <p className="runway-eyebrow-muted">
                    Supply loop
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold uppercase tracking-[0.005em] text-runway-text">
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
                  <p className="runway-eyebrow-muted">
                    Demand loop
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold uppercase tracking-[0.005em] text-runway-text">
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

            <div className="runway-panel p-6">
              <p className="runway-eyebrow-muted">
                Metrics Readiness
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {scorecard.activation.metricsDependencies.map((dependency) => (
                  <div
                    key={dependency.key}
                    className={`border px-4 py-3 text-sm ${
                      dependency.status === "verified"
                        ? "border-runway-green-dim"
                        : dependency.status === "tracked_not_verified"
                          ? "border-runway-signal-dim"
                          : "border-runway-red-dim"
                    }`}
                  >
                    <div className="font-medium text-runway-text">{dependency.key}</div>
                    <div className="mt-1 text-xs text-runway-faint">
                      status: {dependency.status} · count: {dependency.actualCount} · owner: {dependency.ownerLane || "none"}
                    </div>
                    {dependency.notes ? (
                      <div className="mt-2 text-xs text-runway-mute">{dependency.notes}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="runway-panel p-6">
              <p className="runway-eyebrow-muted">
                Warnings
              </p>
              <div className="mt-4 space-y-3">
                {scorecard.warnings.map((warning) => (
                  <div
                    key={warning}
                    className="border border-runway-signal-dim px-4 py-3 text-sm text-runway-signal"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            </div>

            <div className="runway-panel p-6">
              <p className="runway-eyebrow-muted">
                Quick read
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[...scorecard.supply, ...scorecard.demand].map((metric) => (
                  <div key={`summary-${metric.key}`} className="flex items-center justify-between border border-runway-line px-4 py-3 text-sm">
                    <span className="text-runway-body">{metric.label}</span>
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
