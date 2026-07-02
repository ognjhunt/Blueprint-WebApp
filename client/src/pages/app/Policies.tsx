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

export default function Policies() {
  const { entitlements, isLoading, error } = useBuyerAppEntitlements();

  return (
    <AppShell active="policies" breadcrumb="policies">
      <Helmet>
        <title>Policies · Blueprint</title>
        <meta
          name="description"
          content="Protected Blueprint buyer policy submission and entitlement context."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Policy registry
            </Eyebrow>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
              Policies
            </h1>
            <p className="text-body-s text-ink-500">
              Policy submissions and evaluation status require a buyer-owned
              policy record.
            </p>
          </div>
          <Button asChild variant="action" iconLeft={<Plus />}>
            <Link href="/contact/robot-team?path=policy-submission">Submit a policy</Link>
          </Button>
        </header>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error ? (
          <>
            <Card pad="lg">
              <ProofBoundary
                level="info"
                title="No buyer policy records exposed yet"
                icon={ShieldCheck}
              >
                Blueprint is not showing placeholder policies, endpoint refs, or
                score history in the buyer app. Policy rows require records owned
                by this authenticated buyer.
              </ProofBoundary>
            </Card>

            {entitlements.length ? (
              <section aria-label="Entitlement context for policy submissions" className="flex flex-col gap-3">
                <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
                  Licensed access available for policy work
                </h2>
                <EntitlementAccessTable entitlements={entitlements} />
              </section>
            ) : (
              <BuyerAppEmptyState
                title="No licensed access for policy work"
                body="Policy submission and evaluation workflows require a marketplace entitlement or approved buyer access record."
              />
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
