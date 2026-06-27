import { Helmet } from "@/lib/helmet";

import { Eyebrow, MetricStat, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  entitlementMetrics,
  licensedSites,
} from "@/components/blueprint/app/mockData";

/**
 * Entitlements — buyer-app license & access surface (/app/entitlements).
 *
 * 4-tile MetricStat strip (Plan / Active policies 3/5 / Licensed sites /
 * Spend MTD) → Licensed sites & access windows table: Site · Task · Access
 * (StatusChip) · Window (mono) · Scope.
 *
 * Mock/illustrative data only — no backend. Access windows govern what each
 * licensed site can be used for; scope limits stay visible.
 */
export default function Entitlements() {
  return (
    <AppShell active="entitlements" breadcrumb="entitlements">
      <Helmet>
        <title>Entitlements · Blueprint</title>
        <meta
          name="description"
          content="Entitlements — plan, active policy slots, licensed sites, spend MTD, and per-site access windows with usage scope. Illustrative data, not live operational state."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-1.5">
          <Eyebrow tone="brass" rule>
            License & access
          </Eyebrow>
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
            Entitlements
          </h1>
          <p className="text-body-s text-ink-500">
            What your plan covers, and the access window and scope on each
            licensed site.
          </p>
        </header>

        {/* Metric strip — hairline grid */}
        <section
          aria-label="Entitlement summary"
          className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
        >
          {entitlementMetrics.map((metric) => (
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

        {/* Licensed sites & access windows */}
        <section aria-label="Licensed sites and access windows" className="flex flex-col gap-3">
          <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
            Licensed sites &amp; access windows
          </h2>
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[60rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Site
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Task
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Access
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Window
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Scope
                  </th>
                </tr>
              </thead>
              <tbody>
                {licensedSites.map((site) => (
                  <tr
                    key={site.id}
                    className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-inset"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-body-s font-semibold text-ink-900">
                          {site.site}
                        </span>
                        <span className="font-mono text-[0.7rem] text-ink-400">
                          {site.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-body-s text-ink-700">
                      {site.task}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <StatusChip tone={site.access.tone} square>
                        {site.access.label}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-3.5 align-middle font-mono text-[0.72rem] text-ink-700">
                      {site.window}
                    </td>
                    <td className="px-4 py-3.5 align-middle text-body-s text-ink-600">
                      {site.scope}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="font-mono text-[0.65rem] leading-[1.5] text-ink-400">
            Illustrative entitlements — not live billing or license state. Scope
            limits define permitted use within each access window.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
