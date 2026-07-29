import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";

import { Button, Eyebrow, MetricStat, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppEmptyState,
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import { EntitlementAccessTable } from "@/components/blueprint/app/EntitlementAccessTable";
import {
  runDisplayName,
  runStatusLabel,
  runStatusTone,
  useBuyerAppEntitlements,
  useBuyerAppRuns,
} from "@/lib/buyerAppData";
import { useAuth } from "@/contexts/AuthContext";
import OperatorOverview from "./OperatorOverview";

export default function Overview() {
  const { userData } = useAuth();
  if (userData?.buyerType === "site_operator") {
    return <OperatorOverview />;
  }
  return <BuyerOverview />;
}

function BuyerOverview() {
  const {
    entitlements,
    isLoading,
    error,
  } = useBuyerAppEntitlements();
  const { runs, isLoading: runsLoading, error: runsError } = useBuyerAppRuns();

  const activeRuns = runs.filter((run) =>
    ["submitted", "accepted", "planning", "awaiting_authorization", "running", "aggregating"].includes(
      String(run.status),
    ),
  );
  const completedDecisions = runs.filter((run) => run.status === "decision_available");
  const abstainedRuns = runs.filter((run) => run.status === "abstained");

  const metrics = [
    {
      label: "Runs",
      value: String(runs.length),
      caption: "Owner-scoped decision records",
    },
    {
      label: "Active",
      value: String(activeRuns.length),
      caption: "Authorization through aggregation",
    },
    {
      label: "Decisions",
      value: String(completedDecisions.length),
      caption: "Pipeline decision envelopes available",
    },
    {
      label: "Abstained",
      value: String(abstainedRuns.length),
      caption: "Evidence could not support the decision",
      deltaTone: abstainedRuns.length ? ("warn" as const) : undefined,
    },
  ];

  return (
    <AppShell active="overview" breadcrumb="overview">
      <Helmet>
        <title>Overview · Blueprint</title>
        <meta
          name="description"
          content="Buyer overview for maintained testbeds, Task Evaluation Runs, decisions, abstentions, and compatibility access."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-8 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Decision workspace
            </Eyebrow>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
              Task Evaluation Runs
            </h1>
            <p className="text-body-s text-ink-500">
              Start with a maintained testbed and decision request; inspect the
              Pipeline-owned result and evidence limits in the run record.
            </p>
          </div>
          <Button asChild variant="action" iconLeft={<Plus />}>
            <Link href="/app/runs/new">Request a Task Evaluation Run</Link>
          </Button>
        </header>

        {isLoading || runsLoading ? <BuyerAppLoadingState /> : null}
        {error || runsError ? <BuyerAppErrorState message={(error || runsError)!.message} /> : null}
        {!isLoading && !runsLoading && !error && !runsError ? (
          <>
            <section
              aria-label="Task Evaluation Run summary"
              className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2 lg:grid-cols-4"
            >
              {metrics.map((metric) => (
                <div key={metric.label} className="bg-white p-5">
                  <MetricStat
                    label={metric.label}
                    value={metric.value}
                    caption={metric.caption}
                    deltaTone={metric.deltaTone}
                  />
                </div>
              ))}
            </section>

            {runs.length ? (
              <section aria-label="Recent Task Evaluation Runs" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
                    Recent Task Evaluation Runs
                  </h2>
                  <Link
                    href="/app/runs"
                    className="inline-flex items-center gap-1.5 text-body-s font-semibold text-info-fg transition-colors hover:text-info-700"
                  >
                    All runs
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                </div>
                <div className="divide-y divide-line-soft rounded-md border border-line bg-white">
                  {runs.slice(0, 5).map((run) => (
                    <Link key={run.job_id} href={`/app/runs/${encodeURIComponent(run.job_id)}`} className="flex items-center justify-between gap-4 p-4 hover:bg-inset">
                      <span className="text-body-s font-semibold text-ink-900">{runDisplayName(run)}</span>
                      <StatusChip tone={runStatusTone(run.status)} square>{runStatusLabel(run.status)}</StatusChip>
                    </Link>
                  ))}
                </div>
              </section>
            ) : (
              <BuyerAppEmptyState title="No Task Evaluation Runs yet" body="Create a decision-oriented request. Authorization, planning, evidence collection, decisions, and abstentions remain distinct states." />
            )}

            {entitlements.length ? (
              <section aria-label="Historical compatibility access" className="flex flex-col gap-3">
                <h2 className="text-title-m font-semibold tracking-tight text-ink-900">Historical compatibility access</h2>
                <EntitlementAccessTable entitlements={entitlements.slice(0, 5)} />
              </section>
            ) : null}
          </>
        ) : null}

        <ProofBoundary
          level="info"
          title="App data source"
          icon={ShieldCheck}
        >
          Run state and result content come from owner-scoped durable records.
          Pipeline owns method qualification and scientific verdicts. Historical
          entitlements remain readable without becoming current products.
        </ProofBoundary>
      </div>
    </AppShell>
  );
}
