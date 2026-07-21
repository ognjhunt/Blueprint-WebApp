import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button, DataField, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import {
  runDisplayName,
  runStatusLabel,
  runStatusTone,
  useBuyerAppRunDetail,
  type BuyerRunDetail,
} from "@/lib/buyerAppData";

function stringEntries(value: Record<string, unknown> | undefined) {
  return Object.entries(value || {}).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].trim().length > 0,
  );
}

function booleanEntries(value: Record<string, unknown> | undefined) {
  return Object.entries(value || {}).filter(
    (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
  );
}

function fieldLabel(key: string) {
  return key.replace(/_/g, " ");
}

function RunRecord({ run }: { run: BuyerRunDetail }) {
  const artifactEntries = stringEntries(run.result_artifacts);
  const proofBoundaryEntries = booleanEntries(run.proof_boundary);

  return (
    <>
      <section className="rounded-md border border-line bg-white px-4">
        <DataField label="Run id" value={run.job_id} />
        <DataField
          label="Status"
          value={runStatusLabel(run.status)}
          mono={false}
          trailing={
            <StatusChip tone={runStatusTone(run.status)} square>
              {runStatusLabel(run.status)}
            </StatusChip>
          }
        />
        <DataField
          label="Pipeline status"
          value={run.pipeline_status || "Not reported yet"}
        />
        {run.site_slug ? <DataField label="Site" value={run.site_slug} /> : null}
        {run.site_submission_id ? (
          <DataField label="Site submission" value={run.site_submission_id} />
        ) : null}
        {run.capture_job_id ? (
          <DataField label="Capture job" value={run.capture_job_id} />
        ) : null}
        {run.capture_id ? <DataField label="Capture" value={run.capture_id} /> : null}
        {run.entitlement_id ? (
          <DataField label="Entitlement" value={run.entitlement_id} />
        ) : null}
        {run.entitlement_sku ? (
          <DataField label="Entitlement SKU" value={run.entitlement_sku} />
        ) : null}
        <DataField label="Created" value={run.created_at_iso || "Not recorded"} />
        <DataField
          label="Last update"
          value={run.updated_at_iso || "Not recorded"}
          border={Boolean(run.error)}
        />
        {run.error ? (
          <DataField label="Error" value={String(run.error)} border={false} />
        ) : null}
      </section>

      {artifactEntries.length ? (
        <section className="flex flex-col gap-3" aria-label="Result artifacts">
          <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
            Result artifacts
          </h2>
          <div className="rounded-md border border-line bg-white px-4">
            {artifactEntries.map(([key, value], index) => (
              <DataField
                key={key}
                label={fieldLabel(key)}
                value={value}
                border={index < artifactEntries.length - 1}
              />
            ))}
          </div>
        </section>
      ) : null}

      {proofBoundaryEntries.length ? (
        <section className="flex flex-col gap-3" aria-label="Proof boundary">
          <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
            Proof boundary
          </h2>
          <div className="rounded-md border border-line bg-white px-4">
            {proofBoundaryEntries.map(([key, value], index) => (
              <DataField
                key={key}
                label={fieldLabel(key)}
                value={value ? "true" : "false"}
                border={index < proofBoundaryEntries.length - 1}
              />
            ))}
          </div>
        </section>
      ) : null}

      <ProofBoundary level="info" title="Run record source" icon={ShieldCheck}>
        Every field on this page is read from the stored run record owned by
        this authenticated buyer. Blueprint does not synthesize progress,
        rankings, or operational results for display.
      </ProofBoundary>
    </>
  );
}

function RunNotFound({ runId }: { runId: string }) {
  return (
    <>
      <section className="rounded-md border border-line bg-white px-4">
        <DataField label="Requested run id" value={runId} />
        <DataField
          label="Result status"
          value="No owned run record returned"
          mono={false}
          border={false}
        />
      </section>

      <ProofBoundary level="block" title="Run record not available" icon={ShieldAlert}>
        Blueprint did not find an evaluation run record owned by this buyer for
        this id. This page does not show sample policy rankings, simulated
        success, or research correlations in place of a real run record.
      </ProofBoundary>

      <Button asChild variant="secondary" className="w-fit">
        <Link href="/app/runs">Return to runs</Link>
      </Button>
    </>
  );
}

export default function RunDetail() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId || "";
  const { run, notFound, isLoading, error } = useBuyerAppRunDetail(runId);

  const title = run ? runDisplayName(run) : "Run record not available";

  return (
    <AppShell active="runs" breadcrumb={`runs / ${runId || "unknown"}`}>
      <Helmet>
        <title>{`${runId || "unknown"} · Run detail · Blueprint`}</title>
        <meta
          name="description"
          content="Protected Blueprint run detail route for buyer-owned evaluation records."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <Link
          href="/app/runs"
          className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 transition-colors hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
          All runs
        </Link>

        <header className="flex flex-col gap-2 border-b border-line pb-6">
          <h1 className="text-[1.55rem] font-semibold leading-tight tracking-tight text-ink-900">
            {title}
          </h1>
          <p className="text-body-s text-ink-500">
            {run
              ? "Stored evaluation run record for this authenticated buyer."
              : "Blueprint renders run details only from a buyer-owned stored run record."}
          </p>
        </header>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {!isLoading && error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error && run ? <RunRecord run={run} /> : null}
        {!isLoading && !error && !run && notFound ? <RunNotFound runId={runId} /> : null}
      </div>
    </AppShell>
  );
}
