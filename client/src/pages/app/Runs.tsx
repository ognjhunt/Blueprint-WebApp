import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { Plus, ShieldCheck } from "lucide-react";

import { Button, Card, Eyebrow, ProofBoundary } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppEmptyState,
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import { EntitlementAccessTable } from "@/components/blueprint/app/EntitlementAccessTable";
import { useBuyerAppEntitlements } from "@/lib/buyerAppData";

export default function Runs() {
  const { entitlements, isLoading, error } = useBuyerAppEntitlements();

  return (
    <AppShell active="runs" breadcrumb="runs">
      <Helmet>
        <title>Evaluation Runs · Blueprint</title>
        <meta
          name="description"
          content="Buyer evaluation run access for authenticated Blueprint accounts."
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
              Owned run records appear here after Blueprint provisions an
              evaluation against one of your licensed capture or package records.
            </p>
          </div>
          <Button asChild variant="action" iconLeft={<Plus />}>
            <Link href="/app/packs">Request a run</Link>
          </Button>
        </header>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error ? (
          <>
            <Card pad="lg" className="flex flex-col gap-4">
              <ProofBoundary
                level="info"
                title="No owned run records exposed yet"
                icon={ShieldCheck}
              >
                This route is protected and connected to buyer access, but it
                does not synthesize evaluation results. Run rows require a real
                run record owned by this buyer.
              </ProofBoundary>
              <Button asChild variant="secondary" className="w-fit">
                <Link href="/app/entitlements">Review entitlements</Link>
              </Button>
            </Card>

            {entitlements.length ? (
              <section className="flex flex-col gap-3" aria-label="Entitlements available for runs">
                <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
                  Entitlements available for run requests
                </h2>
                <EntitlementAccessTable
                  entitlements={entitlements}
                  actionLabel="Open entitlement"
                />
              </section>
            ) : (
              <BuyerAppEmptyState
                title="No licensed access for runs"
                body="Run requests require a marketplace entitlement or approved capture package for this buyer account."
              />
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
