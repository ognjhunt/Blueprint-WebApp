import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";

import {
  Button,
  Eyebrow,
  MetricStat,
  ProofBoundary,
  StatusChip,
} from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { MonochromeMedia } from "@/components/site/editorial";
import {
  greeting,
  overviewMetrics,
  overviewSitePacks,
  recentRuns,
  statusToneForRun,
} from "@/components/blueprint/app/mockData";

/**
 * Overview / Dashboard — buyer-app landing surface (/app).
 *
 * Greeting + request-a-run CTA → 4 MetricStat tiles (hairline grid) → recent
 * runs table (rows route to Run detail) → a Site & Task Packs mini-grid (cards
 * route to Site detail) → a proof boundary on what predicted success means.
 *
 * Mock/illustrative data only — no backend. Values are realistic but clearly
 * synthetic. Predicted success is framed as rank fidelity, never a guarantee.
 */
export default function Overview() {
  return (
    <AppShell active="overview" breadcrumb="overview">
      <Helmet>
        <title>Overview · Blueprint</title>
        <meta
          name="description"
          content="Buyer overview — evaluation runs in flight, predicted success rank fidelity, episodes, and spend. Illustrative data, not live operational state."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-8 px-4 py-8 lg:px-8">
        {/* Greeting + request a run */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Buyer overview
            </Eyebrow>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
              {greeting.hello}
            </h1>
            <p className="text-body-s text-ink-500">{greeting.sub}</p>
          </div>
          <Button asChild variant="action" iconLeft={<Plus />}>
            <Link href="/app/packs">Request a run</Link>
          </Button>
        </header>

        {/* Metric tiles — hairline grid */}
        <section
          aria-label="Account summary"
          className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
        >
          {overviewMetrics.map((metric) => (
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

        {/* Recent runs */}
        <section aria-label="Recent evaluation runs" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
              Recent runs
            </h2>
            <Link
              href="/app/runs"
              className="inline-flex items-center gap-1.5 text-body-s font-semibold text-info-fg transition-colors hover:text-info-700"
            >
              All runs
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>

          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[48rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Site / task
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Success
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Episodes
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.map((run) => (
                  <tr
                    key={run.id}
                    className="group border-b border-line-soft transition-colors last:border-b-0 hover:bg-inset"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <Link
                        href={`/app/runs/${run.id}`}
                        className="flex flex-col gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
                      >
                        <span className="text-body-s font-semibold text-ink-900 group-hover:text-info-fg">
                          {run.site}
                        </span>
                        <span className="text-caption text-ink-500">{run.task}</span>
                        <span className="font-mono text-[0.7rem] text-ink-400">
                          {run.id}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <StatusChip tone={statusToneForRun(run.status)} square>
                        {run.status}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-900">
                      {run.success != null ? run.success.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-700">
                      {run.episodes}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-900">
                      {run.cost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Site & task packs mini-grid */}
        <section aria-label="Site and task packs" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
              Site &amp; task packs
            </h2>
            <Link
              href="/app/packs"
              className="inline-flex items-center gap-1.5 text-body-s font-semibold text-info-fg transition-colors hover:text-info-700"
            >
              All packs
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {overviewSitePacks.map((pack) => (
              <Link
                key={pack.id}
                href={`/app/packs/${pack.id}`}
                className="group flex flex-col overflow-hidden rounded-md border border-line bg-white transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
              >
                <MonochromeMedia
                  src={`/redesign/pov/${pack.povId}.jpg`}
                  alt={`${pack.name} — capture point of view`}
                  radius="none"
                  overlay="soft"
                  className="aspect-[16/10] w-full"
                >
                  <span className="absolute left-3 top-3">
                    <StatusChip tone={pack.status.tone} square>
                      {pack.status.label}
                    </StatusChip>
                  </span>
                </MonochromeMedia>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-body-s font-semibold leading-snug text-ink-900 group-hover:text-info-fg">
                      {pack.name}
                    </span>
                    <span className="font-mono text-[0.72rem] text-ink-500">
                      {pack.task}
                    </span>
                  </div>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    {pack.attributes.map((attr) => (
                      <span
                        key={attr}
                        className="rounded-xs border border-line bg-sunken px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.06em] text-ink-600"
                      >
                        {attr}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Proof boundary */}
        <ProofBoundary
          level="info"
          title="What predicted success means"
          icon={ShieldCheck}
        >
          Predicted success reflects rank fidelity against prior validated runs —
          it orders policies and sites by likely outcome, not a guarantee of
          field performance. Any preview clips are generated or simulated review
          support, never real-world proof.
        </ProofBoundary>
      </div>
    </AppShell>
  );
}
