import { Helmet } from "@/lib/helmet";
import { Plus } from "lucide-react";

import { Button, Eyebrow, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { policies } from "@/components/blueprint/app/mockData";

/**
 * Policies — buyer-app policy registry (/app/policies).
 *
 * Header + "Submit a policy" CTA → registry table: Policy · Type
 * (checkpoint / API runner / VLA) · Endpoint/ref (mono) · Last eval · Best
 * (mono, right) · Status (StatusChip).
 *
 * Mock/illustrative data only — no backend. "Best" is a predicted-success
 * rank-fidelity estimate from prior runs, never a guarantee.
 */
export default function Policies() {
  return (
    <AppShell active="policies" breadcrumb="policies">
      <Helmet>
        <title>Policies · Blueprint</title>
        <meta
          name="description"
          content="Policy registry — checkpoints, API runners, and VLAs with endpoint refs, last evaluation, and best predicted-success rank fidelity. Illustrative data, not live operational state."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Policy registry
            </Eyebrow>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
              Policies
            </h1>
            <p className="text-body-s text-ink-500">
              Checkpoints, API runners, and VLAs you evaluate against captured
              sites. Best is a rank-fidelity estimate, not a guarantee.
            </p>
          </div>
          <Button variant="action" iconLeft={<Plus />}>
            Submit a policy
          </Button>
        </header>

        {/* Registry table */}
        <section aria-label="Policy registry">
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[58rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Policy
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Type
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Endpoint / ref
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Last eval
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Best
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {policies.map((policy) => (
                  <tr
                    key={policy.id}
                    className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-inset"
                  >
                    <td className="px-4 py-3.5 align-middle">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-body-s font-semibold text-ink-900">
                          {policy.name}
                        </span>
                        <span className="font-mono text-[0.7rem] text-ink-400">
                          {policy.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <span className="rounded-xs border border-line bg-sunken px-1.5 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.06em] text-ink-600">
                        {policy.type}
                      </span>
                    </td>
                    <td className="max-w-[20rem] truncate px-4 py-3.5 align-middle font-mono text-[0.72rem] text-ink-700">
                      {policy.ref}
                    </td>
                    <td className="px-4 py-3.5 align-middle font-mono text-[13px] text-ink-600">
                      {policy.lastEval}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-900">
                      {policy.best > 0 ? policy.best.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3.5 align-middle">
                      <StatusChip tone={policy.status.tone} square>
                        {policy.status.label}
                      </StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-[0.65rem] leading-[1.5] text-ink-400">
            Illustrative registry — not live policy state. Best values are
            rank-fidelity estimates, not guaranteed field performance.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
