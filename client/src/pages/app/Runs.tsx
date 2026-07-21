import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";

import { Button, Card, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import { EntitlementAccessTable } from "@/components/blueprint/app/EntitlementAccessTable";
import {
  formatEntitlementDate,
  runDisplayName,
  runStatusLabel,
  runStatusTone,
  useBuyerAppEntitlements,
  useBuyerAppRuns,
  type BuyerRunRecord,
} from "@/lib/buyerAppData";

function RunsTable({ runs }: { runs: BuyerRunRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-white">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              Run
            </th>
            <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              Status
            </th>
            <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              Pipeline
            </th>
            <th className="px-4 py-3 text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              Created
            </th>
            <th className="px-4 py-3 text-right text-micro font-semibold uppercase tracking-eyebrow text-ink-400">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.job_id}
              className="border-b border-line-soft transition-colors last:border-b-0 hover:bg-inset"
            >
              <td className="px-4 py-3.5 align-middle">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body-s font-semibold text-ink-900">
                    {runDisplayName(run)}
                  </span>
                  <span className="font-mono text-[0.7rem] text-ink-400">
                    {run.job_id}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5 align-middle">
                <StatusChip tone={runStatusTone(run.status)} square>
                  {runStatusLabel(run.status)}
                </StatusChip>
              </td>
              <td className="px-4 py-3.5 align-middle font-mono text-[0.72rem] text-ink-600">
                {run.pipeline_status || "—"}
              </td>
              <td className="px-4 py-3.5 align-middle font-mono text-[0.72rem] text-ink-700">
                {formatEntitlementDate(run.created_at_iso)}
              </td>
              <td className="px-4 py-3.5 text-right align-middle">
                <Button asChild variant="secondary" size="sm" iconRight={<ArrowRight />}>
                  <Link href={`/app/runs/${encodeURIComponent(run.job_id)}`}>
                    View run
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Runs() {
  const { runs, isLoading: runsLoading, error: runsError } = useBuyerAppRuns();
  const { entitlements, isLoading: entitlementsLoading } = useBuyerAppEntitlements();

  const isLoading = runsLoading || entitlementsLoading;

  return (
    <AppShell active="runs" breadcrumb="runs">
      <Helmet>
        <title>Evaluation Runs · Blueprint</title>
        <meta
          name="description"
          content="Buyer evaluation run records for authenticated Blueprint accounts."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Evaluation runs
            </Eyebrow>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
              Runs
            </h1>
            <p className="text-body-s text-ink-500">
              Evaluation job requests submitted by this buyer account, read from
              Blueprint&apos;s durable run store.
            </p>
          </div>
          <Button asChild variant="action" iconLeft={<Plus />}>
            <Link href="/app/packs">Request a run</Link>
          </Button>
        </header>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {!isLoading && runsError ? <BuyerAppErrorState message={runsError.message} /> : null}
        {!isLoading && !runsError ? (
          <>
            {runs.length ? (
              <section className="flex flex-col gap-3" aria-label="Evaluation runs">
                <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
                  Run records
                </h2>
                <RunsTable runs={runs} />
              </section>
            ) : (
              <Card pad="lg" className="flex flex-col gap-4">
                <ProofBoundary level="info" title="No evaluation runs yet" icon={ShieldCheck}>
                  Runs appear here after a paid evaluation request for one of
                  your licensed sites is accepted. Nothing is simulated on this
                  page — each row is a stored run record owned by this account.
                </ProofBoundary>
                <Button asChild variant="action" className="w-fit">
                  <Link href="/sites">Browse sites</Link>
                </Button>
              </Card>
            )}

            {entitlements.length ? (
              <section
                className="flex flex-col gap-3"
                aria-label="Entitlements available for runs"
              >
                <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
                  Entitlements available for run requests
                </h2>
                <EntitlementAccessTable
                  entitlements={entitlements}
                  actionLabel="Open entitlement"
                />
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
