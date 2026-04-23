import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

type CompanyMetricStatus = "truthful" | "partial" | "blocked";

type CompanyMetricResult = {
  key: string;
  label: string;
  status: CompanyMetricStatus;
  value: number | null;
  note: string | null;
};

type CeoOperatingScreen = {
  generatedAt: string;
  activeCity: {
    city: string;
    citySlug: string;
    currentStage: string;
    latestSummary: string;
    latestEventAtIso: string;
    blockers: Array<{ id: string; status: string; summary: string; owner: string | null }>;
    nextActionCount: number;
  } | null;
  lifecycleStop: {
    stage: string;
    summary: string;
    blockers: Array<{ id: string; status: string; summary: string; owner: string | null }>;
    waitingActions: Array<{
      id: string;
      owner: string | null;
      status: string | null;
      summary: string;
    }>;
  };
  needsFounder: Array<{ id: string; title: string | null; reason: string; source: string | null }>;
  nextAutonomousActions: Array<{
    id: string;
    owner: string | null;
    summary: string;
    sourceRef: string | null;
  }>;
  recentChangeSummary: {
    operatingGraphEvents: number;
    buyerOutcomes: number;
    founderThreads: number;
    latestEvents: Array<{
      id: string;
      city: string;
      stage: string;
      summary: string;
      sourceRepo: string;
      recordedAtIso: string;
    }>;
  };
  metricHealth: {
    daily: {
      truthful: number;
      partial: number;
      blocked: number;
      blockedMetrics: Array<{ key: string; label: string; note: string | null }>;
      partialMetrics: Array<{ key: string; label: string; note: string | null }>;
    };
    weekly: {
      truthful: number;
      partial: number;
      blocked: number;
      blockedMetrics: Array<{ key: string; label: string; note: string | null }>;
      partialMetrics: Array<{ key: string; label: string; note: string | null }>;
    };
  };
};

type CompanyMetricsResponse = {
  ok: boolean;
  operatorEmail: string | null;
  scoreboard: {
    generatedAt: string;
    ceoOperatingScreen: CeoOperatingScreen;
    views: {
      daily: { metrics: CompanyMetricResult[] };
      weekly: { metrics: CompanyMetricResult[] };
    };
  };
};

function formatDate(value: string | null | undefined) {
  if (!value) return "unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function statusClass(status: string) {
  if (status === "truthful" || status === "ready_to_execute") return "text-emerald-700";
  if (status === "partial" || status.includes("external")) return "text-amber-700";
  return "text-rose-700";
}

function metricValue(metric: CompanyMetricResult) {
  if (metric.value === null) return "blocked";
  if (metric.value <= 1 && metric.value >= 0) return `${Math.round(metric.value * 100)}%`;
  return Number.isInteger(metric.value) ? String(metric.value) : metric.value.toFixed(2);
}

export default function AdminCompanyMetrics() {
  const { currentUser } = useAuth();
  const metricsQuery = useQuery<CompanyMetricsResponse>({
    queryKey: ["admin-company-metrics-ceo-screen"],
    queryFn: async () => {
      const response = await fetch("/api/admin/company-metrics?daily_days=1&weekly_days=7", {
        headers: await withFirebaseAuthHeaders(currentUser, await withCsrfHeader({})),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch company metrics");
      return response.json();
    },
    enabled: Boolean(currentUser),
  });

  const screen = metricsQuery.data?.scoreboard.ceoOperatingScreen;
  const weeklyMetrics = metricsQuery.data?.scoreboard.views.weekly.metrics || [];

  return (
    <main className="min-h-screen bg-[#f5f1e9] px-4 py-8 text-stone-950">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="grid gap-6 border-b border-stone-300 pb-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-stone-500">
              CEO Operating Screen
            </p>
            <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.04em] md:text-6xl">
              What is moving, what is blocked, and what needs one human answer.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">
              First-party company metrics projected from capture, package, hosted-review, buyer-outcome, and founder-inbox truth.
            </p>
          </div>
          <div className="flex flex-col justify-end gap-3 text-sm text-stone-600">
            <div className="border-l border-stone-300 pl-4">
              <p>Generated {formatDate(screen?.generatedAt)}</p>
              <p>Operator {metricsQuery.data?.operatorEmail || "unknown"}</p>
            </div>
            <div className="flex gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white"
                onClick={() => metricsQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <Link
                href="/admin/leads"
                className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
              >
                Admin queue
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        {metricsQuery.isLoading ? (
          <div className="border border-stone-300 bg-white/70 p-8">Loading company truth...</div>
        ) : metricsQuery.isError || !screen ? (
          <div className="border border-rose-300 bg-rose-50 p-8 text-rose-800">
            Failed to load the CEO operating screen.
          </div>
        ) : (
          <>
            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="bg-stone-950 p-6 text-white md:p-8">
                <p className="text-sm uppercase tracking-[0.24em] text-stone-400">Active city</p>
                <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
                  {screen.activeCity?.city || "No active city"}
                </h2>
                <p className="mt-5 max-w-xl text-lg leading-7 text-stone-300">
                  {screen.lifecycleStop.summary}
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Stage</p>
                    <p className="mt-2 text-lg">{screen.lifecycleStop.stage}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Blockers</p>
                    <p className="mt-2 text-lg">{screen.lifecycleStop.blockers.length}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-500">Next Actions</p>
                    <p className="mt-2 text-lg">{screen.activeCity?.nextActionCount || 0}</p>
                  </div>
                </div>
              </div>

              <div className="border border-stone-300 bg-white/75 p-6 md:p-8">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                  <h2 className="text-2xl font-semibold tracking-[-0.03em]">Needs Attention</h2>
                </div>
                <div className="mt-6 space-y-4">
                  {screen.lifecycleStop.blockers.slice(0, 5).map((blocker) => (
                    <div key={blocker.id} className="border-t border-stone-200 pt-4">
                      <p className={`text-sm font-semibold ${statusClass(blocker.status)}`}>
                        {blocker.status}
                      </p>
                      <p className="mt-1 text-stone-900">{blocker.summary}</p>
                      <p className="mt-1 text-sm text-stone-500">Owner: {blocker.owner || "unassigned"}</p>
                    </div>
                  ))}
                  {screen.lifecycleStop.blockers.length === 0 && (
                    <p className="text-stone-600">No active blocker projected for the current city.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="border-t border-stone-300 pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Last 24 Hours
                </p>
                <p className="mt-3 text-4xl font-semibold">{screen.recentChangeSummary.operatingGraphEvents}</p>
                <p className="mt-2 text-sm text-stone-600">operating graph events</p>
              </div>
              <div className="border-t border-stone-300 pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Founder Needs
                </p>
                <p className="mt-3 text-4xl font-semibold">{screen.needsFounder.length}</p>
                <p className="mt-2 text-sm text-stone-600">valid founder-inbox or decision items</p>
              </div>
              <div className="border-t border-stone-300 pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
                  Weekly Metrics
                </p>
                <p className="mt-3 text-4xl font-semibold">{screen.metricHealth.weekly.truthful}</p>
                <p className="mt-2 text-sm text-stone-600">
                  truthful / {screen.metricHealth.weekly.partial} partial / {screen.metricHealth.weekly.blocked} blocked
                </p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">Next Autonomous Actions</h2>
                {screen.nextAutonomousActions.slice(0, 7).map((action) => (
                  <div key={action.id} className="border-t border-stone-300 py-4">
                    <p className="text-sm font-semibold text-emerald-700">{action.owner || "unassigned"}</p>
                    <p className="mt-1 text-stone-900">{action.summary}</p>
                  </div>
                ))}
                {screen.nextAutonomousActions.length === 0 && (
                  <p className="border-t border-stone-300 py-4 text-stone-600">No ready-to-execute action projected.</p>
                )}
              </div>
              <div className="space-y-4">
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">Metric Truth</h2>
                {weeklyMetrics.slice(0, 8).map((metric) => (
                  <div key={metric.key} className="grid grid-cols-[1fr_auto] gap-4 border-t border-stone-300 py-4">
                    <div>
                      <p className="font-medium">{metric.label}</p>
                      <p className="mt-1 text-sm text-stone-600">{metric.note}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${statusClass(metric.status)}`}>{metric.status}</p>
                      <p className="mt-1 text-lg font-semibold">{metricValue(metric)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-stone-300 pt-6">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">Recent State Changes</h2>
              <div className="mt-4 divide-y divide-stone-300">
                {screen.recentChangeSummary.latestEvents.map((event) => (
                  <div key={event.id} className="grid gap-2 py-4 md:grid-cols-[160px_180px_1fr]">
                    <p className="text-sm text-stone-500">{formatDate(event.recordedAtIso)}</p>
                    <p className="font-medium">{event.stage}</p>
                    <p className="text-stone-700">{event.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
