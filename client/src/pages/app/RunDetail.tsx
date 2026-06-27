import * as React from "react";
import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";
import { ArrowLeft, Download, Film, Plus, ShieldAlert, ShieldCheck } from "lucide-react";

import {
  Button,
  Card,
  DataField,
  MetricStat,
  PolicyRankBar,
  ProofBoundary,
  StatusChip,
  Tabs,
} from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { MonochromeMedia } from "@/components/site/editorial";
import {
  failureClusters,
  findSitePack,
  policyComparison,
  rankFidelity,
  rightsPrivacyItems,
  runDetailMetrics,
  runManifest,
  runs,
  type RightsItem,
} from "@/components/blueprint/app/mockData";

type RunTab = "summary" | "failures" | "manifest" | "rights";

/** ProofBoundary level for each rights item is carried on the data. */
const rightsLevelIcon = {
  proof: ShieldCheck,
  info: ShieldCheck,
  warn: ShieldAlert,
  block: ShieldAlert,
} as const;

/**
 * Run detail — buyer-app evaluation result (/app/runs/:runId).
 *
 * Topbar (title + Complete StatusChip + mono run meta + Export / Request
 * actions) → 4-tile MetricStat strip (Predicted success 0.72 +0.08 / Cycle time
 * / OOD flags 14 (block) / Episodes) → controlled Tabs: Run summary
 * (PolicyRankBar comparison + review-media panel + missing-evidence
 * ProofBoundary) · Failure clusters (count rows) · Manifest (DataField list) ·
 * Rights & privacy (proof + block ProofBoundaries).
 *
 * Mock/illustrative data only — no backend. Predicted success is a rank-fidelity
 * estimate, never a guarantee. Any preview media is generated/simulated review
 * support, never real-world proof.
 */
export default function RunDetail() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId ?? "RUN-2049";

  // Resolve the run row for the topbar meta; fall back to the canonical
  // Aurora run that the detail mock data describes.
  const run = runs.find((r) => r.id === runId) ?? runs[0];
  const pack = findSitePack(run.packId);

  const [tab, setTab] = React.useState<RunTab>("summary");

  return (
    <AppShell active="runs" breadcrumb={`runs / ${run.id}`}>
      <Helmet>
        <title>{`${run.id} · Run detail · Blueprint`}</title>
        <meta
          name="description"
          content="Evaluation run detail — predicted success rank fidelity, failure clusters, eval-card manifest, and rights & privacy boundaries. Illustrative data, not live operational state."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        {/* Back link */}
        <Link
          href="/app/runs"
          className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 transition-colors hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          All runs
        </Link>

        {/* Topbar: title + status + mono meta + actions */}
        <header className="flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[1.55rem] font-semibold leading-tight tracking-tight text-ink-900">
                {run.site}
              </h1>
              <StatusChip tone="proof" square>
                Complete
              </StatusChip>
            </div>
            <p className="text-body-s text-ink-500">{run.task}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.72rem] text-ink-400">
              <span className="text-ink-700">{run.id}</span>
              <span aria-hidden="true">·</span>
              <span>{run.packId}</span>
              <span aria-hidden="true">·</span>
              <span>{run.robotProfile}</span>
              <span aria-hidden="true">·</span>
              <span>{run.started}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="secondary" size="md" iconLeft={<Download />}>
              Export data
            </Button>
            <Button asChild variant="action" size="md" iconLeft={<Plus />}>
              <Link href={`/app/packs/${run.packId}`}>Request a run</Link>
            </Button>
          </div>
        </header>

        {/* Metric strip — hairline grid */}
        <section
          aria-label="Run results summary"
          className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
        >
          {runDetailMetrics.map((metric) => (
            <div key={metric.label} className="bg-white p-5">
              <MetricStat
                label={metric.label}
                value={metric.value}
                unit={metric.unit}
                delta={metric.delta}
                deltaTone={metric.deltaTone}
                caption={metric.caption}
              />
            </div>
          ))}
        </section>

        {/* Tabs */}
        <Tabs
          aria-label="Run detail sections"
          value={tab}
          onChange={(value) => setTab(value as RunTab)}
          items={[
            { value: "summary", label: "Run summary" },
            { value: "failures", label: "Failure clusters", count: failureClusters.length },
            { value: "manifest", label: "Manifest" },
            { value: "rights", label: "Rights & privacy" },
          ]}
        />

        {/* Tab panels */}
        {tab === "summary" ? (
          <RunSummaryPanel pack={pack} />
        ) : null}
        {tab === "failures" ? <FailureClustersPanel /> : null}
        {tab === "manifest" ? <ManifestPanel /> : null}
        {tab === "rights" ? <RightsPanel /> : null}
      </div>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Run summary                                                               */
/* -------------------------------------------------------------------------- */

function RunSummaryPanel({
  pack,
}: {
  pack: ReturnType<typeof findSitePack>;
}) {
  const povId = pack?.povId ?? "factory-conveyor";
  return (
    <div
      role="tabpanel"
      aria-label="Run summary"
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]"
    >
      {/* Policy comparison */}
      <Card
        tone="card"
        eyebrow="Policy comparison"
        title="Predicted success by policy"
        headerRight={
          <StatusChip tone="info" square dot={false}>
            Rank fidelity
          </StatusChip>
        }
      >
        <div className="flex flex-col gap-4">
          {policyComparison.map((policy) => (
            <PolicyRankBar
              key={policy.label}
              label={policy.label}
              value={policy.value}
              scale="ratio"
              rank={policy.rank}
              winner={policy.winner}
              metric={policy.metric}
            />
          ))}
          <div className="mt-1 flex items-start gap-3 border-t border-line-soft pt-4">
            <span className="font-mono text-[1.1rem] font-medium leading-none text-ink-900">
              r={rankFidelity.correlation}
            </span>
            <p className="text-caption leading-[1.55] text-ink-500">
              {rankFidelity.caption}
            </p>
          </div>
        </div>
      </Card>

      {/* Review-media panel + missing-evidence boundary */}
      <div className="flex flex-col gap-4">
        <Card tone="card" pad="none">
          <MonochromeMedia
            src={`/redesign/pov/${povId}.jpg`}
            alt="Evaluation episode preview — review support, not real-world proof"
            radius="none"
            overlay="soft"
            className="aspect-[16/10] w-full rounded-t-md"
          >
            <span className="absolute left-3 top-3">
              <StatusChip tone="warn" square>
                Review media
              </StatusChip>
            </span>
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 font-mono text-[0.65rem] text-[#f3efe6]/85">
              <Film className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
              episode-clip · proxy
            </span>
          </MonochromeMedia>
          <div className="flex flex-col gap-1 p-4">
            <span className="text-body-s font-semibold text-ink-900">
              Episode review clip
            </span>
            <p className="text-caption leading-[1.55] text-ink-500">
              Generated / simulated proxy for review only. Not real-world proof of
              field performance.
            </p>
          </div>
        </Card>

        <ProofBoundary
          level="warn"
          title="Missing evidence"
          icon={ShieldAlert}
        >
          14 out-of-distribution episodes lack matching capture coverage. Their
          outcomes are excluded from the rank-fidelity estimate above until a
          recapture closes the gap.
        </ProofBoundary>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Failure clusters                                                         */
/* -------------------------------------------------------------------------- */

function FailureClustersPanel() {
  return (
    <div role="tabpanel" aria-label="Failure clusters" className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-md border border-line bg-white">
        {failureClusters.map((cluster, index) => (
          <div
            key={cluster.id}
            className={`flex items-start gap-4 px-4 py-4 ${
              index !== failureClusters.length - 1 ? "border-b border-line-soft" : ""
            }`}
          >
            <span className="mt-0.5 shrink-0 font-mono text-[0.7rem] text-ink-400">
              {cluster.id}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body-s font-semibold text-ink-900">
                  {cluster.label}
                </span>
                <StatusChip tone={cluster.tone} square>
                  {cluster.tone === "block" ? "Blocker" : "Caution"}
                </StatusChip>
              </div>
              <p className="text-caption leading-[1.55] text-ink-500">{cluster.note}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="font-mono text-[1.1rem] font-medium leading-none text-ink-900">
                {cluster.count}
              </span>
              <span className="font-mono text-[0.68rem] text-ink-400">
                {cluster.share}% of fails
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="font-mono text-[0.65rem] leading-[1.5] text-ink-400">
        Failure clusters are illustrative groupings of failed episodes — not a
        live diagnostic feed.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Manifest                                                                  */
/* -------------------------------------------------------------------------- */

function ManifestPanel() {
  return (
    <div role="tabpanel" aria-label="Eval card manifest">
      <Card tone="card" eyebrow="Eval card" title="Run manifest">
        <div className="flex flex-col">
          {runManifest.map((row, index) => (
            <DataField
              key={row.label}
              label={row.label}
              value={row.value}
              mono={row.mono ?? true}
              border={index !== runManifest.length - 1}
              trailing={
                row.badge ? (
                  <StatusChip tone={row.badge.tone} square dot={false}>
                    {row.badge.label}
                  </StatusChip>
                ) : undefined
              }
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rights & privacy                                                          */
/* -------------------------------------------------------------------------- */

function RightsPanel() {
  return (
    <div role="tabpanel" aria-label="Rights and privacy" className="flex flex-col gap-3">
      {rightsPrivacyItems.map((item: RightsItem) => (
        <ProofBoundary
          key={item.label}
          level={item.level}
          title={item.label}
          icon={rightsLevelIcon[item.level]}
        >
          {item.detail}
        </ProofBoundary>
      ))}
    </div>
  );
}
