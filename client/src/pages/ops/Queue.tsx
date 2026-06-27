import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, AlertOctagon } from "lucide-react";

import {
  MetricStat,
  ProofBoundary,
  StatusChip,
} from "@/components/blueprint";
import { OpsShell } from "@/components/blueprint/ops/OpsShell";
import {
  QUEUE_METRICS,
  QUEUE_REQUESTS,
  QUEUE_BLOCKER,
} from "@/components/blueprint/ops/mockData";

/**
 * Queue — OPS CONSOLE landing surface (/ops).
 *
 * 4 MetricStat tiles in a hairline grid → a blocker ProofBoundary (block) →
 * the request table (ID mono · Site/task · Status chip · Owner · Cost ·
 * next-action link that routes to the relevant ops screen).
 *
 * Mock/illustrative data only — no backend. Values are realistic but clearly
 * synthetic so the queue renders the full spec without implying real supply,
 * readiness, or operational state.
 */
export default function Queue() {
  return (
    <OpsShell
      active="queue"
      title="Queue"
      sub="blueprint / ops / queue · 18 open requests"
    >
      <Helmet>
        <title>Queue · Blueprint Ops</title>
        <meta
          name="description"
          content="Internal ops queue — open capture, review, and handoff requests with next-action routing. Illustrative data, not live operational state."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-8">
        {/* Summary tiles — hairline grid */}
        <section
          aria-label="Queue summary"
          className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
        >
          {QUEUE_METRICS.map((metric) => (
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

        {/* Headline blocker */}
        <ProofBoundary
          level="block"
          title={QUEUE_BLOCKER.title}
          icon={AlertOctagon}
        >
          {QUEUE_BLOCKER.body}
        </ProofBoundary>

        {/* Request table */}
        <section aria-label="Open requests">
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[56rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Request
                  </th>
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
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Owner
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Cost
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Next action
                  </th>
                </tr>
              </thead>
              <tbody>
                {QUEUE_REQUESTS.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-line-soft last:border-b-0 transition-colors hover:bg-inset"
                  >
                    <td className="px-4 py-3.5 align-middle font-mono text-[13px] text-ink-900">
                      {req.id}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-body-s font-semibold text-ink-900">
                          {req.site}
                        </span>
                        <span className="text-caption text-ink-500">
                          {req.task}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <StatusChip tone={req.statusTone} square>
                        {req.statusLabel}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-body-s text-ink-700">
                      {req.owner}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-900">
                      {req.cost}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      <Link
                        href={req.nextAction.href}
                        className="inline-flex items-center gap-1.5 text-body-s font-semibold text-info-fg transition-colors hover:text-info-600"
                      >
                        {req.nextAction.label}
                        <ArrowRight
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-[0.65rem] leading-[1.5] text-ink-400">
            Illustrative queue — not live supply or readiness. Next-action links
            route to the relevant ops surface.
          </p>
        </section>
      </div>
    </OpsShell>
  );
}
