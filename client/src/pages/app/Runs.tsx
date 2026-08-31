import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";

import { Button, Card, Eyebrow, MetricStat, ProofBoundary, StatusChip } from "@/components/blueprint";
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
import { runSummaryMetrics } from "@/lib/runSummaryMetrics";
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
                <h3 className="mt-1 text-body-l font-semibold text-ink-900">{result.publication.decision_envelope?.decision_question || result.publication.task?.label || result.publication.run_id}</h3>
                <p className="runway-num mt-1 text-[0.68rem] text-ink-400">{result.publication.run_id}</p>
              </div>
              <StatusChip tone={delivery?.status === "ready" ? "proof" : delivery?.status === "blocked" ? "block" : "neutral"} square>
                {delivery?.status === "ready" ? "Media ready" : delivery?.status === "blocked" ? "Evidence blocked" : "Legacy result"}
              </StatusChip>
            </div>
            {delivery ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-inset p-2"><p className="runway-num text-body-l font-semibold text-ink-900">{delivery.summary.episode_count.toLocaleString()}</p><p className="runway-meta">Episodes</p></div>
                <div className="bg-inset p-2"><p className="runway-num text-body-l font-semibold text-ink-900">{delivery.summary.learned_candidate_episode_count.toLocaleString()}</p><p className="runway-meta">Policy</p></div>
                <div className="bg-inset p-2"><p className="runway-num text-body-l font-semibold text-ink-900">{delivery.summary.successful_episode_count.toLocaleString()}</p><p className="runway-meta">Complete</p></div>
              </div>
            ) : null}
            <Button asChild variant="secondary" size="sm" className="w-fit">
              <Link href={`/app/results/${encodeURIComponent(result.record_id)}`}>
                Review result and videos
                <ArrowRight strokeWidth={1.75} aria-hidden="true" />
              </Link>
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
          <tr className="border-b border-line bg-runway-black">
            <th className="runway-meta px-3.5 py-3 font-semibold tracking-[0.12em]">
              Run
            </th>
            <th className="runway-meta px-3.5 py-3 font-semibold tracking-[0.12em]">
              Status
            </th>
            <th className="runway-meta px-3.5 py-3 font-semibold tracking-[0.12em]">
              Pipeline
            </th>
            <th className="runway-meta px-3.5 py-3 font-semibold tracking-[0.12em]">
              Created
            </th>
            <th className="runway-meta px-3.5 py-3 text-right font-semibold tracking-[0.12em]">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={run.job_id}
              className="border-b border-line-soft transition-colors duration-150 last:border-b-0 hover:bg-inset"
            >
              <td className="px-3.5 py-3.5 align-middle">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body-s font-semibold text-ink-900">
                    {runDisplayName(run)}
                  </span>
                  <span className="runway-num text-[0.7rem] text-ink-400">
                    {run.job_id}
                  </span>
                </div>
              </td>
              <td className="px-3.5 py-3.5 align-middle">
                <StatusChip tone={runStatusTone(run.status)} square>
                  {runStatusLabel(run.status)}
                </StatusChip>
              </td>
              <td className="runway-num px-3.5 py-3.5 align-middle text-[0.72rem] text-ink-600">
                {run.pipeline_status || "—"}
              </td>
              <td className="runway-num px-3.5 py-3.5 align-middle text-[0.72rem] text-ink-700">
                {formatEntitlementDate(run.created_at_iso)}
              </td>
              <td className="px-3.5 py-3.5 text-right align-middle">
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/app/runs/${encodeURIComponent(run.job_id)}`}>
                    View run
                    <ArrowRight strokeWidth={1.75} aria-hidden="true" />
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
  const metrics = runSummaryMetrics(runs);

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
            <p className="max-w-[62ch] text-body-s text-ink-500">
              Decision requests and Pipeline-owned results for this authenticated account.
            </p>
          </div>
          <Button asChild variant="action">
            <Link href="/app/runs/new">
              <Plus strokeWidth={1.75} aria-hidden="true" />
              Request a Task Evaluation Run
            </Link>
          </Button>
        </header>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {!isLoading && loadError ? <BuyerAppErrorState message={loadError.message} /> : null}
        {!isLoading && !loadError ? (
          <>
            <section
              aria-label="Task Evaluation Run summary"
              className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
            >
              {metrics.map((metric) => (
                <div key={metric.label} className="bg-paper-0 p-5">
                  <MetricStat
                    label={metric.label}
                    value={metric.value}
                    caption={metric.caption}
                    deltaTone={metric.deltaTone}
                  />
                </div>
              ))}
            </section>

            {results.length ? (
              <section className="flex flex-col gap-3" aria-label="Sealed evaluation results">
                <div>
                  <h2 className="font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">Results ready for review</h2>
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
