import { Helmet } from "@/lib/helmet";
import { Download, ShieldCheck } from "lucide-react";

import { Button, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  dataPackages,
  exportScopeNote,
  statusToneForPackage,
} from "@/components/blueprint/app/mockData";

/**
 * Data Packages — buyer-app export index (/app/data).
 *
 * Export-scope ProofBoundary (info) → table: Package (mono) · Source · Episodes ·
 * Format · Size · Status (Ready=proof / Building=warn / Queued=neutral) with an
 * Export action on Ready rows only.
 *
 * Mock/illustrative data only — no backend. Exports are scoped to the licensed
 * evaluation window; raw-capture redistribution stays out of scope.
 */
export default function DataPackages() {
  return (
    <AppShell active="data" breadcrumb="data">
      <Helmet>
        <title>Data Packages · Blueprint</title>
        <meta
          name="description"
          content="Data packages — RLDS / HDF5 exports per evaluation run with episode counts, format, size, and export status. Scoped to the licensed window. Illustrative data, not live operational state."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-1.5">
          <Eyebrow tone="brass" rule>
            Exports
          </Eyebrow>
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
            Data packages
          </h1>
          <p className="text-body-s text-ink-500">
            Episode datasets packaged from your evaluation runs, ready to export
            within your access window.
          </p>
        </header>

        {/* Export-scope boundary */}
        <ProofBoundary
          level="info"
          title="Export scope"
          icon={ShieldCheck}
        >
          {exportScopeNote}
        </ProofBoundary>

        {/* Packages table */}
        <section aria-label="Data packages">
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[62rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Package
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Source
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Episodes
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Format
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Size
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
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {dataPackages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-inset"
                  >
                    <td className="px-4 py-3.5 align-middle font-mono text-[0.78rem] font-medium text-ink-900">
                      {pkg.id}
                    </td>
                    <td className="px-4 py-3.5 align-middle text-body-s text-ink-700">
                      {pkg.source}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-700">
                      {pkg.episodes}
                    </td>
                    <td className="px-4 py-3.5 align-middle font-mono text-[0.72rem] text-ink-600">
                      {pkg.format}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-900">
                      {pkg.size}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <StatusChip tone={statusToneForPackage(pkg.status)} square>
                        {pkg.status}
                      </StatusChip>
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      {pkg.status === "Ready" ? (
                        <Button variant="secondary" size="sm" iconLeft={<Download />}>
                          Export
                        </Button>
                      ) : (
                        <span className="font-mono text-[0.7rem] text-ink-400">
                          {pkg.status === "Building" ? "Packaging" : "In queue"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-[0.65rem] leading-[1.5] text-ink-400">
            Illustrative packages — not live export state. Export availability is
            scoped to your licensed evaluation window.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
