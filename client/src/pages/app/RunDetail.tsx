import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { Button, DataField, ProofBoundary } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import { EntitlementAccessTable } from "@/components/blueprint/app/EntitlementAccessTable";
import { useBuyerAppEntitlements } from "@/lib/buyerAppData";

export default function RunDetail() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId || "unknown";
  const { entitlements, isLoading, error } = useBuyerAppEntitlements();

  return (
    <AppShell active="runs" breadcrumb={`runs / ${runId}`}>
      <Helmet>
        <title>{`${runId} · Run detail · Blueprint`}</title>
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
            Run record not available
          </h1>
          <p className="text-body-s text-ink-500">
            Blueprint did not find a buyer-owned operational run record for this
            route.
          </p>
        </header>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error ? (
          <>
            <section className="rounded-md border border-line bg-white">
              <DataField label="Requested run id" value={runId} />
              <DataField
                label="Access source"
                value="Marketplace entitlement endpoint"
                mono={false}
              />
              <DataField
                label="Result status"
                value="No owned run record returned"
                mono={false}
                border={false}
              />
            </section>

            <ProofBoundary
              level="block"
              title="Static run metrics are disabled"
              icon={ShieldAlert}
            >
              This page does not show sample policy rankings, simulated success,
              or research correlations as buyer operational results. A run detail
              view requires a real run record owned by this authenticated buyer.
            </ProofBoundary>

            {entitlements.length ? (
              <section className="flex flex-col gap-3" aria-label="Buyer entitlements">
                <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
                  Buyer access on file
                </h2>
                <EntitlementAccessTable entitlements={entitlements} />
              </section>
            ) : null}

            <Button asChild variant="secondary" className="w-fit">
              <Link href="/app/runs">Return to runs</Link>
            </Button>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
