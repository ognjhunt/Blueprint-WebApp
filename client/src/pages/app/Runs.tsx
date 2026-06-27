import * as React from "react";
import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { Plus } from "lucide-react";

import { Button, Eyebrow, StatusChip, Tabs } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  runs,
  runTabCounts,
  statusToneForRun,
  type RunStatus,
} from "@/components/blueprint/app/mockData";

type RunFilter = "all" | "running" | "complete" | "blocked";

const FILTER_STATUS: Record<Exclude<RunFilter, "all">, RunStatus> = {
  running: "Running",
  complete: "Complete",
  blocked: "Blocked",
};

/**
 * Evaluation Runs — buyer-app run index (/app/runs).
 *
 * Header + request-a-run CTA → underline Tabs (All / Running / Complete /
 * Blocked, each with a mono count) filter a single run table: Site/task (with
 * mono run_id) · Status (StatusChip) · Robot profile · Success (mono, right) ·
 * Episodes · Cost. Rows route to Run detail.
 *
 * Mock/illustrative data only — no backend. Success is a rank-fidelity estimate,
 * never a guarantee.
 */
export default function Runs() {
  const [filter, setFilter] = React.useState<RunFilter>("all");

  const visibleRuns = React.useMemo(() => {
    if (filter === "all") return runs;
    return runs.filter((run) => run.status === FILTER_STATUS[filter]);
  }, [filter]);

  return (
    <AppShell active="runs" breadcrumb="runs">
      <Helmet>
        <title>Evaluation Runs · Blueprint</title>
        <meta
          name="description"
          content="Evaluation runs — status, robot profile, predicted success rank fidelity, episodes, and cost across sites. Illustrative data, not live operational state."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Evaluation runs
            </Eyebrow>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
              Runs
            </h1>
            <p className="text-body-s text-ink-500">
              Every evaluation paired to a captured site. Predicted success is a
              rank-fidelity estimate, not a guarantee.
            </p>
          </div>
          <Button asChild variant="action" iconLeft={<Plus />}>
            <Link href="/app/packs">Request a Run</Link>
          </Button>
        </header>

        {/* Tabs */}
        <Tabs
          aria-label="Filter runs by status"
          value={filter}
          onChange={(value) => setFilter(value as RunFilter)}
          items={[
            { value: "all", label: "All", count: runTabCounts.all },
            { value: "running", label: "Running", count: runTabCounts.running },
            { value: "complete", label: "Complete", count: runTabCounts.complete },
            { value: "blocked", label: "Blocked", count: runTabCounts.blocked },
          ]}
        />

        {/* Run table */}
        <section aria-label="Evaluation runs">
          <div className="overflow-x-auto rounded-md border border-line bg-white">
            <table className="w-full min-w-[60rem] border-collapse text-left">
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
                    className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400"
                  >
                    Robot profile
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
                {visibleRuns.map((run) => (
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
                    <td className="px-4 py-3.5 align-middle text-body-s text-ink-700">
                      {run.robotProfile}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle">
                      {run.success != null ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-mono text-[13px] text-ink-900">
                            {run.success.toFixed(2)}
                          </span>
                          {run.successDelta ? (
                            <span
                              className={`font-mono text-[0.7rem] ${
                                run.successDelta.startsWith("-")
                                  ? "text-block-fg"
                                  : "text-proof-fg"
                              }`}
                            >
                              {run.successDelta}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="font-mono text-[13px] text-ink-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-700">
                      {run.episodes}
                    </td>
                    <td className="px-4 py-3.5 text-right align-middle font-mono text-[13px] text-ink-900">
                      {run.cost}
                    </td>
                  </tr>
                ))}
                {visibleRuns.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-body-s text-ink-500"
                    >
                      No runs in this state.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="mt-3 font-mono text-[0.65rem] leading-[1.5] text-ink-400">
            Illustrative runs — not live evaluation state. Success values are
            rank-fidelity estimates, not guaranteed field performance.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
