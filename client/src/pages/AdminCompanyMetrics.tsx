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

type CaptureToHostedReviewLifecycleRow = {
  captureId: string;
  city: string | null;
  citySlug: string | null;
  currentStage: string;
  completedStages: string[];
  nextMissingStage: string | null;
  latestEvidenceAtIso: string | null;
  sourceRepos: string[];
  evidenceRefs: string[];
  packageRunIds: string[];
  hostedReviewRunIds: string[];
  nextAction: {
    id: string;
    owner: string | null;
    status?: string | null;
    summary: string;
    sourceRef?: string | null;
  } | null;
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
  captureToHostedReviewLifecycle: {
    summary: {
      uploadedCaptures: number;
      packageReadyCaptures: number;
      hostedReviewReadyCaptures: number;
      hostedReviewStartedCaptures: number;
      currentStageCounts: Record<string, number>;
    };
    rows: CaptureToHostedReviewLifecycleRow[];
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

const truthBoundaryCards = [
  {
    label: "Repo doctrine",
    detail: "Defines product meaning, org contracts, metric definitions, and claim rules.",
  },
  {
    label: "Paperclip execution",
    detail: "Owns issue state, routine movement, blocker ownership, and proof-bearing closeouts.",
  },
  {
    label: "Notion visibility",
    detail: "Mirrors workspace review and operator visibility; it is not the execution record.",
  },
  {
    label: "Firestore, Stripe, Render runtime",
    detail: "Own live request, entitlement, payment, deployment, and hosted-session facts.",
  },
];

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
  if (status === "truthful" || status === "ready_to_execute") return "runway-chip runway-chip-live";
  if (status === "partial" || status.includes("external")) return "runway-chip runway-chip-open";
  return "runway-chip runway-chip-fail";
}

function metricValue(metric: CompanyMetricResult) {
  if (metric.value === null) return "blocked";
  if (metric.value <= 1 && metric.value >= 0) return `${Math.round(metric.value * 100)}%`;
  return Number.isInteger(metric.value) ? String(metric.value) : metric.value.toFixed(2);
}

function metricAuthority(metricKey: string) {
  if (metricKey.includes("blocker") || metricKey.includes("human_interrupt")) {
    return "Paperclip and founder inbox projection";
  }
  if (metricKey.includes("hosted_review") || metricKey.includes("package")) {
    return "Firestore operating graph and hosted-session records";
  }
  if (metricKey.includes("city_launch")) {
    return "WebApp city-launch ledgers and spend artifacts";
  }
  if (metricKey.includes("buyer") || metricKey.includes("commercial")) {
    return "WebApp buyer outcome and Paperclip next-action projection";
  }
  return "Capture, Pipeline, and WebApp operating graph projection";
}

function lifecycleStageClass(stage: string) {
  if (stage === "hosted_review_started") return "runway-chip runway-chip-live";
  if (stage === "hosted_review_ready" || stage === "package_ready") return "runway-chip runway-chip-open";
  return "runway-chip runway-chip-quiet";
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
  const captureLifecycle = screen?.captureToHostedReviewLifecycle;

  return (
    <main className="min-h-screen bg-runway-deep px-4 py-8 text-runway-text">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="grid gap-6 border-b border-runway-line pb-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="runway-eyebrow-muted">
              CEO Operating Screen
            </p>
            <h1 className="mt-3 max-w-4xl font-display uppercase text-4xl font-semibold tracking-[0.005em] text-runway-text md:text-6xl">
              What is moving, what is blocked, and what needs one human answer.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-runway-mute">
              First-party company metrics projected from capture, package, hosted-review, buyer-outcome, and founder-inbox truth.
            </p>
          </div>
          <div className="flex flex-col justify-end gap-3 text-sm text-runway-mute">
            <div className="border-l border-runway-line pl-4">
              <p>Generated {formatDate(screen?.generatedAt)}</p>
              <p>Operator {metricsQuery.data?.operatorEmail || "unknown"}</p>
            </div>
            <div className="flex gap-3">
              <button
                className="runway-cta"
                onClick={() => metricsQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <Link
                href="/admin/leads"
                className="runway-cta-ghost"
              >
                Admin queue
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        {metricsQuery.isLoading ? (
          <div className="runway-panel p-8 text-runway-mute">Loading company truth...</div>
        ) : metricsQuery.isError || !screen ? (
          <div className="border border-runway-red-dim bg-runway-panel p-8 text-runway-red">
            Failed to load the CEO operating screen.
          </div>
        ) : (
          <>
            <section className="runway-panel grid gap-4 p-5 md:p-6 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="runway-eyebrow-muted">
                  Founder/operator truth map
                </p>
                <p className="mt-3 max-w-md text-sm leading-6 text-runway-mute">
                  Local checks do not prove Operational Launch Ready. This screen separates
                  repo definitions, Paperclip execution state, Notion visibility, and live runtime truth.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {truthBoundaryCards.map((card) => (
                  <div key={card.label} className="border-t border-runway-line pt-3">
                    <p className="text-sm font-semibold text-runway-text">{card.label}</p>
                    <p className="mt-1 text-sm leading-6 text-runway-mute">{card.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="border border-runway-line bg-runway-black p-6 text-runway-text md:p-8">
                <p className="runway-eyebrow-muted">Active city</p>
                <h2 className="mt-4 font-display uppercase text-4xl font-semibold tracking-[0.005em] text-runway-text">
                  {screen.activeCity?.city || "No active city"}
                </h2>
                <p className="mt-5 max-w-xl text-lg leading-7 text-runway-body">
                  {screen.lifecycleStop.summary}
                </p>
                <div className="mt-8 grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="runway-meta">Stage</p>
                    <p className="runway-num mt-2 text-lg text-runway-text">{screen.lifecycleStop.stage}</p>
                  </div>
                  <div>
                    <p className="runway-meta">Blockers</p>
                    <p className="runway-num mt-2 text-lg text-runway-text">{screen.lifecycleStop.blockers.length}</p>
                  </div>
                  <div>
                    <p className="runway-meta">Next Actions</p>
                    <p className="runway-num mt-2 text-lg text-runway-text">{screen.activeCity?.nextActionCount || 0}</p>
                  </div>
                </div>
              </div>

              <div className="runway-panel p-6 md:p-8">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-runway-signal" />
                  <h2 className="font-display uppercase text-2xl font-semibold tracking-[0.005em] text-runway-text">Needs Attention</h2>
                </div>
                <div className="mt-6 space-y-4">
                  {screen.lifecycleStop.blockers.slice(0, 5).map((blocker) => (
                    <div key={blocker.id} className="border-t border-runway-line-soft pt-4">
                      <p className={statusClass(blocker.status)}>
                        {blocker.status}
                      </p>
                      <p className="mt-2 text-runway-text">{blocker.summary}</p>
                      <p className="mt-1 text-sm text-runway-faint">Owner: {blocker.owner || "unassigned"}</p>
                    </div>
                  ))}
                  {screen.lifecycleStop.blockers.length === 0 && (
                    <p className="text-runway-mute">No active blocker projected for the current city.</p>
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Human-gated blockers
                </p>
                <div className="mt-5 space-y-4">
                  {screen.needsFounder.slice(0, 5).map((item) => (
                    <div key={item.id} className="border-t border-runway-line-soft pt-4">
                      <p className="font-semibold text-runway-text">{item.title || item.id}</p>
                      <p className="mt-1 text-sm leading-6 text-runway-mute">{item.reason}</p>
                      <p className="mt-2 break-all text-xs text-runway-faint">
                        Source: {item.source || "founder inbox projection"}
                      </p>
                    </div>
                  ))}
                  {screen.needsFounder.length === 0 && (
                    <p className="border-t border-runway-line-soft pt-4 text-sm text-runway-mute">
                      No founder-only decision is projected from the current founder-inbox window.
                    </p>
                  )}
                </div>
              </div>
              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Blocked or partial metrics
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-runway-red">Blocked</p>
                    <p className="runway-num mt-2 text-3xl font-semibold text-runway-text">{screen.metricHealth.weekly.blocked}</p>
                    <p className="mt-1 text-sm text-runway-mute">
                      Missing source or projection path; no trustworthy number is claimed.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-runway-signal">Partial</p>
                    <p className="runway-num mt-2 text-3xl font-semibold text-runway-text">{screen.metricHealth.weekly.partial}</p>
                    <p className="mt-1 text-sm text-runway-mute">
                      Evidence exists, with coverage gaps disclosed instead of smoothed over.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-3">
              <div className="border-t border-runway-line pt-5">
                <p className="runway-eyebrow-muted">
                  Last 24 Hours
                </p>
                <p className="runway-num mt-3 text-4xl font-semibold text-runway-text">{screen.recentChangeSummary.operatingGraphEvents}</p>
                <p className="mt-2 text-sm text-runway-mute">operating graph events</p>
              </div>
              <div className="border-t border-runway-line pt-5">
                <p className="runway-eyebrow-muted">
                  Founder Needs
                </p>
                <p className="runway-num mt-3 text-4xl font-semibold text-runway-text">{screen.needsFounder.length}</p>
                <p className="mt-2 text-sm text-runway-mute">valid founder-inbox or decision items</p>
              </div>
              <div className="border-t border-runway-line pt-5">
                <p className="runway-eyebrow-muted">
                  Weekly Metrics
                </p>
                <p className="runway-num mt-3 text-4xl font-semibold text-runway-text">{screen.metricHealth.weekly.truthful}</p>
                <p className="mt-2 text-sm text-runway-mute">
                  truthful / {screen.metricHealth.weekly.partial} partial / {screen.metricHealth.weekly.blocked} blocked
                </p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <h2 className="font-display uppercase text-2xl font-semibold tracking-[0.005em] text-runway-text">Next Autonomous Actions</h2>
                {screen.nextAutonomousActions.slice(0, 7).map((action) => (
                  <div key={action.id} className="border-t border-runway-line py-4">
                    <p className="text-sm font-semibold text-runway-green">{action.owner || "unassigned"}</p>
                    <p className="mt-1 text-runway-text">{action.summary}</p>
                  </div>
                ))}
                {screen.nextAutonomousActions.length === 0 && (
                  <p className="border-t border-runway-line py-4 text-runway-mute">No ready-to-execute action projected.</p>
                )}
              </div>
              <div className="space-y-4">
                <h2 className="font-display uppercase text-2xl font-semibold tracking-[0.005em] text-runway-text">Metric Truth</h2>
                {weeklyMetrics.slice(0, 8).map((metric) => (
                  <div key={metric.key} className="grid grid-cols-[1fr_auto] gap-4 border-t border-runway-line py-4">
                    <div>
                      <p className="font-medium text-runway-text">{metric.label}</p>
                      <p className="mt-1 text-sm text-runway-mute">{metric.note}</p>
                      <p className="mt-1 text-xs text-runway-faint">
                        Authority: {metricAuthority(metric.key)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end text-right">
                      <p className={statusClass(metric.status)}>{metric.status}</p>
                      <p className="runway-num mt-2 text-lg font-semibold text-runway-text">{metricValue(metric)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-runway-line pt-6">
              <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
                <div>
                  <p className="runway-eyebrow-muted">
                    Operating Graph
                  </p>
                  <h2 className="mt-2 font-display uppercase text-2xl font-semibold tracking-[0.005em] text-runway-text">
                    Capture To Hosted Review
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <div>
                    <p className="runway-meta">uploaded</p>
                    <p className="runway-num mt-1 text-xl font-semibold text-runway-text">{captureLifecycle?.summary.uploadedCaptures || 0}</p>
                  </div>
                  <div>
                    <p className="runway-meta">package_ready</p>
                    <p className="runway-num mt-1 text-xl font-semibold text-runway-text">{captureLifecycle?.summary.packageReadyCaptures || 0}</p>
                  </div>
                  <div>
                    <p className="runway-meta">hosted_ready</p>
                    <p className="runway-num mt-1 text-xl font-semibold text-runway-text">{captureLifecycle?.summary.hostedReviewReadyCaptures || 0}</p>
                  </div>
                  <div>
                    <p className="runway-meta">started</p>
                    <p className="runway-num mt-1 text-xl font-semibold text-runway-text">{captureLifecycle?.summary.hostedReviewStartedCaptures || 0}</p>
                  </div>
                </div>
              </div>
              <div className="mt-5 divide-y divide-runway-line-soft">
                {(captureLifecycle?.rows || []).slice(0, 8).map((row) => (
                  <div key={row.captureId} className="grid gap-4 py-5 lg:grid-cols-[180px_170px_1fr_1.2fr]">
                    <div>
                      <p className="runway-num text-[13px] font-semibold text-runway-text">{row.captureId}</p>
                      <p className="mt-1 text-sm text-runway-faint">{row.city || "unknown city"}</p>
                    </div>
                    <div>
                      <p className={lifecycleStageClass(row.currentStage)}>
                        {row.currentStage}
                      </p>
                      <p className="mt-2 text-sm text-runway-faint">
                        Next {row.nextMissingStage || "none"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-runway-body">{row.completedStages.join(" -> ")}</p>
                      <p className="mt-1 text-sm text-runway-faint">
                        Latest {formatDate(row.latestEvidenceAtIso)}
                      </p>
                      <p className="mt-1 text-xs text-runway-faint">
                        Source repos: {row.sourceRepos.length ? row.sourceRepos.join(", ") : "unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-runway-text">
                        {row.nextAction?.owner || "no next action"}
                      </p>
                      <p className="mt-1 text-sm text-runway-mute">
                        {row.nextAction?.summary || "Reached hosted_review_started."}
                      </p>
                      <div className="mt-2 space-y-1">
                        {row.evidenceRefs.slice(0, 3).map((ref) => (
                          <p key={ref} className="runway-num break-all text-xs text-runway-faint">{ref}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {(captureLifecycle?.rows || []).length === 0 && (
                  <p className="py-5 text-runway-mute">No uploaded capture rows are projected into this view.</p>
                )}
              </div>
            </section>

            <section className="border-t border-runway-line pt-6">
              <h2 className="font-display uppercase text-2xl font-semibold tracking-[0.005em] text-runway-text">Recent State Changes</h2>
              <div className="mt-4 divide-y divide-runway-line-soft">
                {screen.recentChangeSummary.latestEvents.map((event) => (
                  <div key={event.id} className="grid gap-2 py-4 md:grid-cols-[160px_180px_1fr]">
                    <p className="runway-num text-sm text-runway-faint">{formatDate(event.recordedAtIso)}</p>
                    <p className="font-medium text-runway-text">{event.stage}</p>
                    <p className="text-runway-body">{event.summary}</p>
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
