import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, PackageCheck, Plus, ShieldCheck } from "lucide-react";

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
import {
  useTaskEvaluationResults,
  type TaskEvaluationResultSiteRecord,
} from "@/lib/taskEvaluationResults";

function SealedResults({ results }: { results: TaskEvaluationResultSiteRecord[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {results.map((result) => {
        const delivery = result.publication.result_delivery;
        return (
          <Card key={result.record_id} pad="md" className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="runway-meta">Sealed result</p>
                <h3 className="mt-1 text-body-l font-semibold text-ink-900">{result.publication.decision_envelope.decision_question || result.publication.run_id}</h3>
                <p className="runway-num mt-1 text-[0.68rem] text-ink-400">{result.publication.run_id}</p>
              </div>
              <StatusChip tone={delivery?.status === "ready" ? "proof" : delivery?.status === "blocked" ? "block" : "neutral"} square>
                {delivery?.status === "ready" ? "Media ready" : delivery?.status === "blocked" ? "Evidence blocked" : "Legacy result"}
              </StatusChip>
            </div>
            {delivery ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-inset p-2"><p className="runway-num text-body-l font-semibold text-ink-900">{delivery.summary.episode_count}</p><p className="runway-meta">Episodes</p></div>
                <div className="bg-inset p-2"><p className="runway-num text-body-l font-semibold text-ink-900">{delivery.summary.learned_candidate_episode_count}</p><p className="runway-meta">Policy</p></div>
                <div className="bg-inset p-2"><p className="runway-num text-body-l font-semibold text-ink-900">{delivery.summary.successful_episode_count}</p><p className="runway-meta">Complete</p></div>
              </div>
            ) : null}
            <Button asChild variant="secondary" size="sm" iconRight={<ArrowRight />} className="w-fit">
              <Link href={`/app/results/${encodeURIComponent(result.record_id)}`}>Review result and videos</Link>
            </Button>
          </Card>
        );
      })}
    </div>
  );
}

function RunsTable({ runs }: { runs: BuyerRunRecord[] }) {
  return (
    <div className="runway-panel overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-line">
            <th className="runway-meta px-4 py-3">
              Run
            </th>
            <th className="runway-meta px-4 py-3">
              Status
            </th>
            <th className="runway-meta px-4 py-3">
              Pipeline
            </th>
            <th className="runway-meta px-4 py-3">
              Created
            </th>
            <th className="runway-meta px-4 py-3 text-right">
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
                  <span className="runway-num text-[0.7rem] text-ink-400">
                    {run.job_id}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3.5 align-middle">
                <StatusChip tone={runStatusTone(run.status)} square>
                  {runStatusLabel(run.status)}
                </StatusChip>
              </td>
              <td className="runway-num px-4 py-3.5 align-middle text-[0.72rem] text-ink-600">
                {run.pipeline_status || "—"}
              </td>
              <td className="runway-num px-4 py-3.5 align-middle text-[0.72rem] text-ink-700">
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
  const { results, scope, isLoading: resultsLoading, error: resultsError } = useTaskEvaluationResults();
  const { entitlements, isLoading: entitlementsLoading } = useBuyerAppEntitlements();

  const isLoading = runsLoading || entitlementsLoading || resultsLoading;
  const loadError = runsError || resultsError;

  return (
    <AppShell active="runs" breadcrumb="runs">
      <Helmet>
        <title>Task Evaluation Runs · Blueprint</title>
        <meta
          name="description"
          content="Buyer evaluation run records for authenticated Blueprint accounts."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Task Evaluation Runs
            </Eyebrow>
            <h1 className="font-display text-[1.65rem] font-semibold uppercase leading-tight tracking-[0.005em] text-ink-900">
              Task Evaluation Runs
            </h1>
            <p className="text-body-s text-ink-500">
              Decision requests and Pipeline-owned results for this authenticated account.
            </p>
          </div>
          <Button asChild variant="action" iconLeft={<Plus />}>
            <Link href="/app/runs/new">Request a Task Evaluation Run</Link>
          </Button>
        </header>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {!isLoading && loadError ? <BuyerAppErrorState message={loadError.message} /> : null}
        {!isLoading && !loadError ? (
          <>
            {results.length ? (
              <section className="flex flex-col gap-3" aria-label="Sealed evaluation results">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900"><PackageCheck className="size-5" />Results ready for review</h2>
                  <p className="mt-1 text-body-s text-ink-500">Private {scope === "blueprint_operations" ? "Blueprint operations" : scope === "organization" ? "verified-team" : "owner"} results. Teams are isolated; this is not a cross-team leaderboard.</p>
                </div>
                <SealedResults results={results} />
              </section>
            ) : null}
            {runs.length ? (
              <section className="flex flex-col gap-3" aria-label="Evaluation runs">
                <h2 className="font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">
                  Run records
                </h2>
                <RunsTable runs={runs} />
              </section>
            ) : (
              <Card pad="lg" className="flex flex-col gap-4">
                <ProofBoundary level="info" title="No evaluation runs yet" icon={ShieldCheck}>
                  Runs appear here as soon as a decision request is durably accepted.
                  Authorization, planning, evidence collection, decisions, and
                  abstentions remain distinct states.
                </ProofBoundary>
                <Button asChild variant="secondary" className="w-fit">
                  <Link href="/app/runs/new">Request a Task Evaluation Run</Link>
                </Button>
              </Card>
            )}

            {entitlements.length ? (
              <section
                className="flex flex-col gap-3"
                aria-label="Entitlements available for runs"
              >
                <h2 className="font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">
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
