import { Helmet } from "@/lib/helmet";

import { MetricStat, StatusChip } from "@/components/blueprint";
import { OpsShell } from "@/components/blueprint/ops/OpsShell";
import {
  CAPTURER_ROSTER,
  CAPTURE_SUPPLY_METRICS,
} from "@/components/blueprint/ops/mockData";

/**
 * Capture supply — OPS CONSOLE capturer roster (/ops/supply).
 *
 * A summary tile strip → the capturer roster table: availability (StatusChip),
 * current assignment, rating, and capture count (mono numerics).
 *
 * Mock/illustrative data only — no backend. Values are realistic but clearly
 * synthetic so the roster renders the full spec without implying real supply or
 * operational state.
 */
export default function CaptureSupply() {
  return (
    <OpsShell
      active="supply"
      title="Capture supply"
      sub="blueprint / ops / supply · 6 active capturers"
    >
      <Helmet>
        <title>Capture supply · Blueprint Ops</title>
        <meta
          name="description"
          content="Internal capturer roster — availability, current assignment, rating, and capture count. Illustrative data, not live supply."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-8">
        {/* Summary tiles — hairline grid */}
        <section
          aria-label="Supply summary"
          className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
        >
          {CAPTURE_SUPPLY_METRICS.map((metric) => (
            <div key={metric.label} className="bg-white p-5">
              <MetricStat
                label={metric.label}
                value={metric.value}
                unit={metric.unit}
                caption={metric.caption}
              />
            </div>
          ))}
        </section>

        {/* Roster table */}
        <section aria-label="Capturer roster">
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[56rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Capturer
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Availability
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Current assignment
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Rating
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Captures
                  </th>
                </tr>
              </thead>
              <tbody>
                {CAPTURER_ROSTER.map((cap) => (
                  <tr
                    key={cap.id}
                    className="border-b border-line-soft last:border-b-0 transition-colors hover:bg-inset"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-body-s font-semibold text-ink-900">
                          {cap.name}
                        </span>
                        <span className="font-mono text-caption text-ink-500">
                          {cap.id} · {cap.city}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <StatusChip tone={cap.availabilityTone} square>
                        {cap.availabilityLabel}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-body-s text-ink-700">
                      {cap.assignment ?? (
                        <span className="text-ink-400">Idle</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-900">
                      {cap.rating}
                      <span className="text-ink-400"> / 5</span>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-900">
                      {cap.captures}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-[0.65rem] leading-[1.5] text-ink-400">
            Illustrative roster — not live supply. Ratings and capture counts are
            synthetic placeholders.
          </p>
        </section>
      </div>
    </OpsShell>
  );
}
