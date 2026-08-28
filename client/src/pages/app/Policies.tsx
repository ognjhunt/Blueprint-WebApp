import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { Button, Card, Eyebrow, ProofBoundary } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppEmptyState,
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import { EntitlementAccessTable } from "@/components/blueprint/app/EntitlementAccessTable";
import { useBuyerAppEntitlements } from "@/lib/buyerAppData";

export default function Policies() {
  const { entitlements, isLoading, error } = useBuyerAppEntitlements();

  return (
    <AppShell active="policies" breadcrumb="policies">
      <Helmet>
        <title>Policy references · Blueprint</title>
        <meta
          name="description"
          content="Protected Blueprint buyer policy submission and entitlement context."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Compatibility view
            </Eyebrow>
            <h1 className="font-display text-[1.65rem] font-semibold uppercase leading-tight tracking-[0.005em] text-ink-900">
              Policy and candidate references
            </h1>
            <p className="text-body-s text-ink-500">
              Saved policy references remain readable. New candidates are scoped
              to the Task Evaluation Run that evaluates them.
            </p>
          </div>
          <Button asChild variant="action" iconRight={<ArrowRight />}>
            <Link href="/app/runs/new">Request a Task Evaluation Run</Link>
          </Button>
        </header>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error ? (
          <>
            <Card pad="lg">
              <ProofBoundary
                level="info"
                title="Legacy route retained"
                icon={ShieldCheck}
              >
                This bookmarked route remains available for historical records.
                Blueprint does not market policy submission as a separate product;
                references and exact artifacts belong to a testbed or run.
              </ProofBoundary>
            </Card>

            {entitlements.length ? (
              <section aria-label="Entitlement context for policy submissions" className="flex flex-col gap-3">
                <h2 className="font-display text-title-m font-semibold uppercase tracking-[0.005em] text-ink-900">
                  Existing access records
                </h2>
                <EntitlementAccessTable entitlements={entitlements} />
              </section>
            ) : (
              <BuyerAppEmptyState
                title="No legacy access records"
                body="Start a Task Evaluation Run to submit candidates and the decision they should inform."
              />
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
