import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { withCsrfHeader } from "@/lib/csrf";

type GrowthScorecardResponse = {
  window: {
    days: number;
    from: string;
    to: string;
  };
  funnel: {
    exactSiteViews: number;
    exactSiteContactStarts: number;
    exactSiteContactSubmissions: number;
    exactSiteContactCompleted: number;
    voiceStarts: number;
    voiceCompleted: number;
  };
  queue: {
    currentHostedReviewItems: number;
    newHostedReviewLast7d: number;
    highPriorityHostedReview: number;
    exactSiteRequiredSubmitted: number;
  };
  experiments: Array<{
    experimentKey: string;
    exposures: number;
    variants: Record<string, number>;
  }>;
  campaigns: Array<{
    campaignName: string;
    views: number;
    contactStarts: number;
    contactSubmissions: number;
    contactCompleted: number;
  }>;
  eventsByDay: Array<{
    date: string;
    views: number;
    contactStarts: number;
    contactSubmissions: number;
    contactCompleted: number;
    voiceStarts: number;
    voiceCompleted: number;
  }>;
  operatorStatus: {
    providers: {
      analytics?: {
        firstPartyIngest?: {
          enabled?: boolean;
          persisted?: boolean;
          error?: string | null;
        };
        ga4?: {
          configured?: boolean;
          measurementConfigured?: boolean;
          liveAccessConfigured?: boolean;
          propertyIdConfigured?: boolean;
          credentialsConfigured?: boolean;
          note?: string;
        };
        posthog?: { configured?: boolean };
      };
      runway?: { configured?: boolean };
      elevenlabs?: { configured?: boolean; agentConfigured?: boolean };
      telephony?: { configured?: boolean; forwardNumberConfigured?: boolean };
      researchOutbound?: {
        configured?: boolean;
        topicsConfigured?: boolean;
        recipientsConfigured?: boolean;
      };
      sendgrid?: { configured?: boolean; provider?: string | null };
      sendgridWebhook?: { configured?: boolean };
      googleImage?: {
        configured?: boolean;
        executionState?: string;
      };
    };
    agentRuntime?: {
      configured?: boolean;
      provider?: string | null;
    };
    lastIntegrationVerification?: {
      id: string;
      verifiedAt: string | null;
    } | null;
    recentCreativeRuns?: Array<{
      id: string;
      status: string;
      skuName: string;
      createdAt: string | null;
      storageUri: string | null;
    }>;
    launchReadiness?: {
      status: "ready" | "not_ready";
      blockers: string[];
      warnings: string[];
      checks: Record<string, boolean>;
      launchChecks: Record<
        string,
        | { required: boolean; ready: boolean; detail: string }
        | Record<string, boolean>
      >;
    };
    workers: Array<{
      workerKey: string;
      enabled: boolean;
      status: string;
      intervalMs: number | null;
      batchSize: number | null;
      startupDelayMs: number | null;
      lastRunNumber: number | null;
      lastRunStartedAt: string | null;
      lastRunCompletedAt: string | null;
      lastRunDurationMs: number | null;
      lastProcessedCount: number | null;
      lastFailedCount: number | null;
      lastError: string | null;
    }>;
  };
};

function conversionRate(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatDurationMs(value: number | null | undefined) {
  if (!value || value < 1000) return value ? `${value} ms` : "n/a";
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

function humanizeKey(value: string) {
  return value.replace(/_/g, " ");
}

function statusTone(status: string, enabled: boolean) {
  if (!enabled) return "text-zinc-500";
  if (status === "idle" || status === "scheduled") return "text-emerald-700";
  if (status === "running") return "text-sky-700";
  if (status === "failed") return "text-rose-700";
  return "text-amber-700";
}

export default function AdminGrowthOpsScorecard() {
  const scorecardQuery = useQuery<GrowthScorecardResponse>({
    queryKey: ["admin-growth-ops-scorecard"],
    queryFn: async () => {
      const response = await fetch("/api/admin/leads/growth-scorecard?days=30", {
        headers: await withCsrfHeader({}),
      });
      if (!response.ok) throw new Error("Failed to fetch growth scorecard");
      return response.json();
    },
  });

  const scorecard = scorecardQuery.data;
  const blockers = scorecard?.operatorStatus.launchReadiness?.blockers || [];
  const warnings = scorecard?.operatorStatus.launchReadiness?.warnings || [];

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Growth Ops
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950">
              Exact-site hosted-review scorecard
            </h1>
            <p className="mt-2 text-zinc-600">
              First-party wedge metrics from the `growth_events` stream and the hosted-review admin queue.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/city-launch/austin"
              className="inline-flex rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
            >
              Austin launch
            </Link>
            <Link
              href="/admin/leads"
              className="inline-flex rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-700"
            >
              Back to admin queue
            </Link>
          </div>
        </div>

        {scorecardQuery.isLoading ? (
          <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
            Loading scorecard...
          </div>
        ) : scorecardQuery.isError || !scorecard ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
            Failed to load the growth scorecard.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <p className="text-sm text-zinc-500">Exact-site views</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950">
                  {scorecard.funnel.exactSiteViews}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <p className="text-sm text-zinc-500">Contact submissions</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950">
                  {scorecard.funnel.exactSiteContactSubmissions}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {conversionRate(
                    scorecard.funnel.exactSiteContactSubmissions,
                    scorecard.funnel.exactSiteViews,
                  )} view → submit
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <p className="text-sm text-zinc-500">Current queue</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950">
                  {scorecard.queue.currentHostedReviewItems}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                <p className="text-sm text-zinc-500">High priority queue</p>
                <p className="mt-2 text-3xl font-semibold text-zinc-950">
                  {scorecard.queue.highPriorityHostedReview}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Immediate blockers
              </p>
              <div className="mt-4 space-y-3 text-sm">
                {blockers.length === 0 ? (
                  <p className="text-emerald-700">No launch blockers detected from the current provider and worker snapshot.</p>
                ) : (
                  blockers.map((blocker) => (
                    <div key={blocker} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
                      {blocker}
                    </div>
                  ))
                )}
                {warnings.map((warning) => (
                  <div key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                    {warning}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  30-day wedge trend
                </p>
                <div className="mt-4 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scorecard.eventsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="views" stroke="#18181b" strokeWidth={2} />
                      <Line
                        type="monotone"
                        dataKey="contactSubmissions"
                        stroke="#2563eb"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="voiceCompleted"
                        stroke="#059669"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Funnel
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-zinc-700">
                    <div className="flex items-center justify-between">
                      <span>Views</span>
                      <strong>{scorecard.funnel.exactSiteViews}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Contact starts</span>
                      <strong>{scorecard.funnel.exactSiteContactStarts}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Contact submissions</span>
                      <strong>{scorecard.funnel.exactSiteContactSubmissions}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Contact completed</span>
                      <strong>{scorecard.funnel.exactSiteContactCompleted}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Voice starts</span>
                      <strong>{scorecard.funnel.voiceStarts}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Voice completed</span>
                      <strong>{scorecard.funnel.voiceCompleted}</strong>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Queue quality
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-zinc-700">
                    <div className="flex items-center justify-between">
                      <span>New last 7d</span>
                      <strong>{scorecard.queue.newHostedReviewLast7d}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Exact-site required</span>
                      <strong>{scorecard.queue.exactSiteRequiredSubmitted}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>High-priority queue share</span>
                      <strong>
                        {conversionRate(
                          scorecard.queue.highPriorityHostedReview,
                          scorecard.queue.currentHostedReviewItems,
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Provider health
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-950">Analytics</p>
                    <p className="mt-2">First-party ingest: {String(Boolean(scorecard.operatorStatus.providers.analytics?.firstPartyIngest?.enabled))}</p>
                    <p>GA4 live access: {String(Boolean(scorecard.operatorStatus.providers.analytics?.ga4?.liveAccessConfigured))}</p>
                    <p>GA4 measurement: {String(Boolean(scorecard.operatorStatus.providers.analytics?.ga4?.configured))}</p>
                    <p>PostHog: {String(Boolean(scorecard.operatorStatus.providers.analytics?.posthog?.configured))}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-950">Email and outbound</p>
                    <p>SendGrid: {String(Boolean(scorecard.operatorStatus.providers.sendgrid?.configured))}</p>
                    <p>SendGrid webhook: {String(Boolean(scorecard.operatorStatus.providers.sendgridWebhook?.configured))}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-950">Creative</p>
                    <p>Google image: {String(Boolean(scorecard.operatorStatus.providers.googleImage?.configured))}</p>
                    <p>Google image state: {scorecard.operatorStatus.providers.googleImage?.executionState || "unknown"}</p>
                    <p>OpenRouter video: {String(Boolean(scorecard.operatorStatus.providers.runway?.configured))}</p>
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-700">
                    <p className="font-medium text-zinc-950">Voice and agent runtime</p>
                    <p>ElevenLabs: {String(Boolean(scorecard.operatorStatus.providers.elevenlabs?.configured))}</p>
                    <p>Telephony: {String(Boolean(scorecard.operatorStatus.providers.telephony?.configured))}</p>
                    <p>Agent runtime: {scorecard.operatorStatus.agentRuntime?.provider || "unconfigured"}</p>
                    <p>
                      Last verify: {formatDateTime(scorecard.operatorStatus.lastIntegrationVerification?.verifiedAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Automation workers
                </p>
                <div className="mt-4 space-y-3">
                  {scorecard.operatorStatus.workers.map((worker) => (
                    <div key={worker.workerKey} className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-700">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-zinc-950">{humanizeKey(worker.workerKey)}</strong>
                        <span className={statusTone(worker.status, worker.enabled)}>
                          {worker.enabled ? worker.status : "disabled"}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 md:grid-cols-2">
                        <p>Interval: {worker.intervalMs ? formatDurationMs(worker.intervalMs) : "n/a"}</p>
                        <p>Batch: {worker.batchSize ?? "n/a"}</p>
                        <p>Last start: {formatDateTime(worker.lastRunStartedAt)}</p>
                        <p>Last finish: {formatDateTime(worker.lastRunCompletedAt)}</p>
                        <p>Processed: {worker.lastProcessedCount ?? 0}</p>
                        <p>Failed: {worker.lastFailedCount ?? 0}</p>
                      </div>
                      {worker.lastError ? (
                        <p className="mt-2 text-rose-700">Last error: {worker.lastError}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Recent creative runs
                </p>
                <div className="mt-4 space-y-3">
                  {(scorecard.operatorStatus.recentCreativeRuns || []).length === 0 ? (
                    <p className="text-sm text-zinc-500">No durable creative runs yet.</p>
                  ) : (
                    (scorecard.operatorStatus.recentCreativeRuns || []).map((run) => (
                      <div key={run.id} className="rounded-xl border border-zinc-200 p-4 text-sm text-zinc-700">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-zinc-950">{run.skuName}</strong>
                          <span className="text-zinc-500">{run.status}</span>
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">{formatDateTime(run.createdAt)}</p>
                        {run.storageUri ? (
                          <p className="mt-2 break-all font-mono text-[11px] text-zinc-600">{run.storageUri}</p>
                        ) : (
                          <p className="mt-2 text-xs text-zinc-500">No durable reel URI recorded.</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Campaigns
                </p>
                <div className="mt-4 space-y-3">
                  {scorecard.campaigns.length === 0 ? (
                    <p className="text-sm text-zinc-500">No campaign data yet.</p>
                  ) : (
                    scorecard.campaigns.map((campaign) => (
                      <div key={campaign.campaignName} className="rounded-xl border border-zinc-200 p-4 text-sm">
                        <div className="flex items-center justify-between">
                          <strong className="text-zinc-950">{campaign.campaignName}</strong>
                          <span className="text-zinc-500">
                            {conversionRate(campaign.contactSubmissions, campaign.views)} submit rate
                          </span>
                        </div>
                        <div className="mt-2 grid gap-2 text-zinc-600 md:grid-cols-2">
                          <p>Views: {campaign.views}</p>
                          <p>Starts: {campaign.contactStarts}</p>
                          <p>Submissions: {campaign.contactSubmissions}</p>
                          <p>Completed: {campaign.contactCompleted}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Experiments
                </p>
                <div className="mt-4 space-y-3">
                  {scorecard.experiments.length === 0 ? (
                    <p className="text-sm text-zinc-500">No experiment exposure data yet.</p>
                  ) : (
                    scorecard.experiments.map((experiment) => (
                      <div key={experiment.experimentKey} className="rounded-xl border border-zinc-200 p-4 text-sm">
                        <div className="flex items-center justify-between">
                          <strong className="text-zinc-950">{experiment.experimentKey}</strong>
                          <span className="text-zinc-500">{experiment.exposures} exposures</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(experiment.variants).map(([variant, count]) => (
                            <span
                              key={variant}
                              className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700"
                            >
                              {variant}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
