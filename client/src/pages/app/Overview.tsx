import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";

import { Button, Eyebrow, MetricStat, ProofBoundary } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppEmptyState,
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import { EntitlementAccessTable } from "@/components/blueprint/app/EntitlementAccessTable";
import { useBuyerAppEntitlements } from "@/lib/buyerAppData";
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
    provisionedEntitlements,
    reviewEntitlements,
    revokedEntitlements,
    isLoading,
    error,
  } = useBuyerAppEntitlements();

  const metrics = [
    {
      label: "Entitlements",
      value: String(entitlements.length),
      caption: "Stripe webhook records visible to this buyer",
    },
    {
      label: "Provisioned",
      value: String(provisionedEntitlements.length),
      caption: "Access links available now",
    },
    {
      label: "Access review",
      value: String(reviewEntitlements.length),
      caption: "Manual review required before release",
      deltaTone: reviewEntitlements.length ? ("warn" as const) : undefined,
    },
    {
      label: "Revoked",
      value: String(revokedEntitlements.length),
      caption: "Removed from buyer access",
      deltaTone: revokedEntitlements.length ? ("block" as const) : undefined,
    },
  ];

  return (
    <AppShell active="overview" breadcrumb="overview">
      <Helmet>
        <title>Overview · Blueprint</title>
        <meta
          name="description"
          content="Buyer overview for Stripe-backed Blueprint marketplace entitlements, access links, and delivery states."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-8 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Buyer overview
            </Eyebrow>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
              Licensed Blueprint access
            </h1>
            <p className="text-body-s text-ink-500">
              Entitlements provisioned for this account after payment and access
              review.
            </p>
          </div>
          <Button asChild variant="action" iconLeft={<Plus />}>
            <Link href="/pricing">Add access</Link>
          </Button>
        </header>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error ? (
          <>
            <section
              aria-label="Entitlement summary"
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

            {entitlements.length ? (
              <section aria-label="Current licensed access" className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
                    Current licensed access
                  </h2>
                  <Link
                    href="/app/entitlements"
                    className="inline-flex items-center gap-1.5 text-body-s font-semibold text-info-fg transition-colors hover:text-info-700"
                  >
                    Entitlements
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </Link>
                </div>
                <EntitlementAccessTable entitlements={entitlements.slice(0, 5)} />
              </section>
            ) : (
              <BuyerAppEmptyState />
            )}
          </>
        ) : null}

        <ProofBoundary
          level="info"
          title="App data source"
          icon={ShieldCheck}
        >
          This app reads marketplace entitlements written by the server after
          Stripe checkout or webhook processing. Evaluation runs, exports, and
          policy results appear only after their owning systems write records for
          this buyer.
        </ProofBoundary>
      </div>
    </AppShell>
  );
}
