import { Helmet } from "@/lib/helmet";

import { Eyebrow, MetricStat, ProofBoundary } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppEmptyState,
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import { EntitlementAccessTable } from "@/components/blueprint/app/EntitlementAccessTable";
import { useBuyerAppEntitlements } from "@/lib/buyerAppData";

export default function Entitlements() {
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
      label: "Total",
      value: String(entitlements.length),
      caption: "Records returned for this buyer",
    },
    {
      label: "Provisioned",
      value: String(provisionedEntitlements.length),
      caption: "Openable access links",
    },
    {
      label: "Review",
      value: String(reviewEntitlements.length),
      caption: "Awaiting manual release",
      deltaTone: reviewEntitlements.length ? ("warn" as const) : undefined,
    },
    {
      label: "Revoked",
      value: String(revokedEntitlements.length),
      caption: "Removed or expired access",
      deltaTone: revokedEntitlements.length ? ("block" as const) : undefined,
    },
  ];

  return (
    <AppShell active="entitlements" breadcrumb="entitlements">
      <Helmet>
        <title>Entitlements · Blueprint</title>
        <meta
          name="description"
          content="Stripe-backed Blueprint marketplace entitlements for the authenticated buyer."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-1.5">
          <Eyebrow tone="brass" rule>
            License &amp; access
          </Eyebrow>
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
            Entitlements
          </h1>
          <p className="text-body-s text-ink-500">
            Marketplace access records written for this authenticated buyer.
          </p>
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
              <section aria-label="Buyer entitlements" className="flex flex-col gap-3">
                <h2 className="text-title-m font-semibold tracking-tight text-ink-900">
                  Access ledger
                </h2>
                <EntitlementAccessTable entitlements={entitlements} />
              </section>
            ) : (
              <BuyerAppEmptyState />
            )}
          </>
        ) : null}

        <ProofBoundary level="info" title="Entitlement source">
          Rows on this page come from Firestore marketplace entitlements keyed to
          the authenticated Firebase user id. They are not static buyer app mock
          data.
        </ProofBoundary>
      </div>
    </AppShell>
  );
}
