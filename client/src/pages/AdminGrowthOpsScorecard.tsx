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
    homeRobotTeamViews: number;
    homeRobotTeamSectionViews: number;
    homeRobotTeamCtaClicks: number;
    homeRobotTeamContactStarts: number;
    homeRobotTeamContactSubmissions: number;
    homeRobotTeamContactCompleted: number;
    voiceStarts: number;
    voiceCompleted: number;
  };
  homeRobotTeamLanding?: {
    experimentKey: string;
    conversionGoal: string;
    variants: Array<{
      variant: string;
      views: number;
      sectionViews: number;
      ctaClicks: number;
      contactStarts: number;
      contactSubmissions: number;
      contactCompleted: number;
    }>;
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
  if (!enabled) return "runway-chip runway-chip-quiet";
  if (status === "idle" || status === "scheduled") return "runway-chip runway-chip-live";
  if (status === "running") return "runway-chip runway-chip-neutral";
  if (status === "failed") return "runway-chip runway-chip-fail";
  return "runway-chip runway-chip-open";
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
  const homeRobotTeamLanding = scorecard?.homeRobotTeamLanding ?? {
    experimentKey: "home_robot_team_conversion_v1",
    conversionGoal: "structured_robot_team_intake",
    variants: [],
  };

  return (
    <div className="min-h-screen bg-runway-deep px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="runway-eyebrow-muted">
              Growth Ops
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold uppercase tracking-[0.005em] text-runway-text">
              Exact-site hosted-review scorecard
            </h1>
            <p className="mt-2 text-runway-mute">
              First-party wedge metrics from the `growth_events` stream and the hosted-review admin queue.
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/city-launch/austin"
              className="runway-cta-ghost"
            >
              Austin launch
            </Link>
            <Link
              href="/admin/leads"
              className="runway-cta-ghost"
            >
              Back to admin queue
            </Link>
          </div>
        </div>

        {scorecardQuery.isLoading ? (
          <div className="runway-panel p-6 text-runway-mute">
            Loading scorecard...
          </div>
        ) : scorecardQuery.isError || !scorecard ? (
          <div className="rounded-none border border-runway-red-dim bg-runway-panel p-6 text-runway-red">
            Failed to load the growth scorecard.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="runway-panel p-5">
                <p className="runway-meta">Home landing views</p>
                <p className="runway-num mt-2 text-3xl font-semibold text-runway-text">
                  {scorecard.funnel.homeRobotTeamViews}
                </p>
              </div>
              <div className="runway-panel p-5">
                <p className="runway-meta">Home CTA clicks</p>
                <p className="runway-num mt-2 text-3xl font-semibold text-runway-text">
                  {scorecard.funnel.homeRobotTeamCtaClicks}
                </p>
                <p className="runway-num mt-2 text-xs text-runway-faint">
                  {conversionRate(
                    scorecard.funnel.homeRobotTeamCtaClicks,
                    scorecard.funnel.homeRobotTeamViews,
                  )} view → click
                </p>
              </div>
              <div className="runway-panel p-5">
                <p className="runway-meta">Current queue</p>
                <p className="runway-num mt-2 text-3xl font-semibold text-runway-text">
                  {scorecard.queue.currentHostedReviewItems}
                </p>
              </div>
              <div className="runway-panel p-5">
                <p className="runway-meta">High priority queue</p>
                <p className="runway-num mt-2 text-3xl font-semibold text-runway-text">
                  {scorecard.queue.highPriorityHostedReview}
                </p>
              </div>
            </div>

            <div className="runway-panel p-6">
              <p className="runway-eyebrow-muted">
                Immediate blockers
              </p>
              <div className="mt-4 space-y-3 text-sm">
                {blockers.length === 0 ? (
                  <p className="text-runway-green">No launch blockers detected from the current provider and worker snapshot.</p>
                ) : (
                  blockers.map((blocker) => (
                    <div key={blocker} className="border border-runway-red-dim px-4 py-3 text-runway-red">
                      {blocker}
                    </div>
                  ))
                )}
                {warnings.map((warning) => (
                  <div key={warning} className="border border-runway-signal-dim px-4 py-3 text-runway-signal">
                    {warning}
                  </div>
                ))}
              </div>
            </div>

            <div className="runway-panel p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="runway-eyebrow-muted">
                    Homepage robot-team experiment
                  </p>
                  <h2 className="runway-num mt-2 text-xl font-semibold text-runway-text">
                    {homeRobotTeamLanding.experimentKey}
                  </h2>
                  <p className="mt-1 text-sm text-runway-faint">
                    Goal: {humanizeKey(homeRobotTeamLanding.conversionGoal)}
                  </p>
                </div>
                <div className="runway-num text-sm text-runway-mute">
                  {conversionRate(
                    scorecard.funnel.homeRobotTeamContactCompleted,
                    scorecard.funnel.homeRobotTeamViews,
                  )} view → completed intake
                </div>
              </div>
              <div className="mt-5 border border-runway-line">
                <div className="grid grid-cols-6 bg-runway-black px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-runway-faint">
                  <span>Variant</span>
                  <span>Views</span>
                  <span>Clicks</span>
                  <span>Starts</span>
                  <span>Submits</span>
                  <span>Completed</span>
                </div>
                {homeRobotTeamLanding.variants.length === 0 ? (
                  <p className="border-t border-runway-line px-4 py-5 text-sm text-runway-faint">No homepage experiment data yet.</p>
                ) : (
                  homeRobotTeamLanding.variants.map((variant) => (
                    <div
                      key={variant.variant}
                      className="grid grid-cols-6 border-t border-runway-line-soft px-4 py-3 text-[13px] text-runway-body transition-colors hover:bg-runway-raised"
                    >
                      <strong className="text-runway-text">{humanizeKey(variant.variant)}</strong>
                      <span className="runway-num">{variant.views}</span>
                      <span className="runway-num">
                        {variant.ctaClicks}{" "}
                        <span className="text-xs text-runway-faint">
                          ({conversionRate(variant.ctaClicks, variant.views)})
                        </span>
                      </span>
                      <span className="runway-num">{variant.contactStarts}</span>
                      <span className="runway-num">{variant.contactSubmissions}</span>
                      <span className="runway-num">{variant.contactCompleted}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  30-day wedge trend
                </p>
                <div className="mt-4 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={scorecard.eventsByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a302d" />
                      <XAxis dataKey="date" stroke="#6a716b" tick={{ fontSize: 12, fill: "#9ba19a" }} />
                      <YAxis stroke="#6a716b" tick={{ fontSize: 12, fill: "#9ba19a" }} />
                      <Tooltip
                        contentStyle={{
                          background: "#141816",
                          border: "1px solid #2a302d",
                          borderRadius: 0,
                          color: "#e8e6dd",
                        }}
                        labelStyle={{ color: "#9ba19a" }}
                        itemStyle={{ color: "#e8e6dd" }}
                        cursor={{ stroke: "#3a423e" }}
                      />
                      <Line type="monotone" dataKey="views" stroke="#e8e6dd" strokeWidth={2} />
                      <Line
                        type="monotone"
                        dataKey="contactSubmissions"
                        stroke="#6fc3d4"
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="voiceCompleted"
                        stroke="#46b96c"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-6">
                <div className="runway-panel p-6">
                  <p className="runway-eyebrow-muted">
                    Funnel
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-runway-body">
                    <div className="flex items-center justify-between">
                      <span>Views</span>
                      <strong className="runway-num text-runway-text">{scorecard.funnel.exactSiteViews}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Contact starts</span>
                      <strong className="runway-num text-runway-text">{scorecard.funnel.exactSiteContactStarts}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Contact submissions</span>
                      <strong className="runway-num text-runway-text">{scorecard.funnel.exactSiteContactSubmissions}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Contact completed</span>
                      <strong className="runway-num text-runway-text">{scorecard.funnel.exactSiteContactCompleted}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Voice starts</span>
                      <strong className="runway-num text-runway-text">{scorecard.funnel.voiceStarts}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Voice completed</span>
                      <strong className="runway-num text-runway-text">{scorecard.funnel.voiceCompleted}</strong>
                    </div>
                  </div>
                </div>

                <div className="runway-panel p-6">
                  <p className="runway-eyebrow-muted">
                    Queue quality
                  </p>
                  <div className="mt-4 space-y-3 text-sm text-runway-body">
                    <div className="flex items-center justify-between">
                      <span>New last 7d</span>
                      <strong className="runway-num text-runway-text">{scorecard.queue.newHostedReviewLast7d}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Exact-site required</span>
                      <strong className="runway-num text-runway-text">{scorecard.queue.exactSiteRequiredSubmitted}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>High-priority queue share</span>
                      <strong className="runway-num text-runway-text">
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
              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Provider health
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="border border-runway-line p-4 text-sm text-runway-body">
                    <p className="font-medium text-runway-text">Analytics</p>
                    <p className="mt-2">First-party ingest: {String(Boolean(scorecard.operatorStatus.providers.analytics?.firstPartyIngest?.enabled))}</p>
                    <p>GA4 live access: {String(Boolean(scorecard.operatorStatus.providers.analytics?.ga4?.liveAccessConfigured))}</p>
                    <p>GA4 measurement: {String(Boolean(scorecard.operatorStatus.providers.analytics?.ga4?.configured))}</p>
                    <p>PostHog: {String(Boolean(scorecard.operatorStatus.providers.analytics?.posthog?.configured))}</p>
                  </div>
                  <div className="border border-runway-line p-4 text-sm text-runway-body">
                    <p className="font-medium text-runway-text">Email and outbound</p>
                    <p>SendGrid: {String(Boolean(scorecard.operatorStatus.providers.sendgrid?.configured))}</p>
                    <p>SendGrid webhook: {String(Boolean(scorecard.operatorStatus.providers.sendgridWebhook?.configured))}</p>
                  </div>
                  <div className="border border-runway-line p-4 text-sm text-runway-body">
                    <p className="font-medium text-runway-text">Creative</p>
                    <p>Google image: {String(Boolean(scorecard.operatorStatus.providers.googleImage?.configured))}</p>
                    <p>Google image state: {scorecard.operatorStatus.providers.googleImage?.executionState || "unknown"}</p>
                    <p>OpenRouter video: {String(Boolean(scorecard.operatorStatus.providers.runway?.configured))}</p>
                  </div>
                  <div className="border border-runway-line p-4 text-sm text-runway-body">
                    <p className="font-medium text-runway-text">Voice and agent runtime</p>
                    <p>ElevenLabs: {String(Boolean(scorecard.operatorStatus.providers.elevenlabs?.configured))}</p>
                    <p>Telephony: {String(Boolean(scorecard.operatorStatus.providers.telephony?.configured))}</p>
                    <p>Agent runtime: {scorecard.operatorStatus.agentRuntime?.provider || "unconfigured"}</p>
                    <p>
                      Last verify: {formatDateTime(scorecard.operatorStatus.lastIntegrationVerification?.verifiedAt)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Automation workers
                </p>
                <div className="mt-4 space-y-3">
                  {scorecard.operatorStatus.workers.map((worker) => (
                    <div key={worker.workerKey} className="border border-runway-line p-4 text-sm text-runway-body">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-runway-text">{humanizeKey(worker.workerKey)}</strong>
                        <span className={statusTone(worker.status, worker.enabled)}>
                          {worker.enabled ? worker.status : "disabled"}
                        </span>
                      </div>
                      <div className="runway-num mt-3 grid gap-2 text-xs md:grid-cols-2">
                        <p>Interval: {worker.intervalMs ? formatDurationMs(worker.intervalMs) : "n/a"}</p>
                        <p>Batch: {worker.batchSize ?? "n/a"}</p>
                        <p>Last start: {formatDateTime(worker.lastRunStartedAt)}</p>
                        <p>Last finish: {formatDateTime(worker.lastRunCompletedAt)}</p>
                        <p>Processed: {worker.lastProcessedCount ?? 0}</p>
                        <p>Failed: {worker.lastFailedCount ?? 0}</p>
                      </div>
                      {worker.lastError ? (
                        <p className="mt-2 text-runway-red">Last error: {worker.lastError}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Recent creative runs
                </p>
                <div className="mt-4 space-y-3">
                  {(scorecard.operatorStatus.recentCreativeRuns || []).length === 0 ? (
                    <p className="text-sm text-runway-faint">No durable creative runs yet.</p>
                  ) : (
                    (scorecard.operatorStatus.recentCreativeRuns || []).map((run) => (
                      <div key={run.id} className="border border-runway-line p-4 text-sm text-runway-body">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-runway-text">{run.skuName}</strong>
                          <span className="runway-chip runway-chip-quiet">{run.status}</span>
                        </div>
                        <p className="runway-num mt-2 text-xs text-runway-faint">{formatDateTime(run.createdAt)}</p>
                        {run.storageUri ? (
                          <p className="mt-2 break-all font-mono text-[11px] text-runway-mute">{run.storageUri}</p>
                        ) : (
                          <p className="mt-2 text-xs text-runway-faint">No durable reel URI recorded.</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Campaigns
                </p>
                <div className="mt-4 space-y-3">
                  {scorecard.campaigns.length === 0 ? (
                    <p className="text-sm text-runway-faint">No campaign data yet.</p>
                  ) : (
                    scorecard.campaigns.map((campaign) => (
                      <div key={campaign.campaignName} className="border border-runway-line p-4 text-sm">
                        <div className="flex items-center justify-between">
                          <strong className="text-runway-text">{campaign.campaignName}</strong>
                          <span className="runway-num text-runway-faint">
                            {conversionRate(campaign.contactSubmissions, campaign.views)} submit rate
                          </span>
                        </div>
                        <div className="runway-num mt-2 grid gap-2 text-runway-mute md:grid-cols-2">
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

              <div className="runway-panel p-6">
                <p className="runway-eyebrow-muted">
                  Experiments
                </p>
                <div className="mt-4 space-y-3">
                  {scorecard.experiments.length === 0 ? (
                    <p className="text-sm text-runway-faint">No experiment exposure data yet.</p>
                  ) : (
                    scorecard.experiments.map((experiment) => (
                      <div key={experiment.experimentKey} className="border border-runway-line p-4 text-sm">
                        <div className="flex items-center justify-between">
                          <strong className="runway-num text-runway-text">{experiment.experimentKey}</strong>
                          <span className="runway-num text-runway-faint">{experiment.exposures} exposures</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {Object.entries(experiment.variants).map(([variant, count]) => (
                            <span
                              key={variant}
                              className="runway-chip runway-chip-quiet"
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
