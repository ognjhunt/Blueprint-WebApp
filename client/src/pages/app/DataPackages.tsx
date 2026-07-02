import { Helmet } from "@/lib/helmet";
import { Download, ShieldCheck } from "lucide-react";

import { Eyebrow, ProofBoundary } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppEmptyState,
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import { EntitlementAccessTable } from "@/components/blueprint/app/EntitlementAccessTable";
import {
  useBuyerAppEntitlements,
  type BuyerEntitlement,
} from "@/lib/buyerAppData";

export default function DataPackages() {
  const { entitlements, isLoading, error } = useBuyerAppEntitlements();
  const packageEntitlements = entitlements.filter(isDataPackageEntitlement);

  return (
    <AppShell active="data" breadcrumb="data">
      <Helmet>
        <title>Data Packages · Blueprint</title>
        <meta
          name="description"
          content="Protected Blueprint buyer data package access backed by marketplace entitlements."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-1.5">
          <Eyebrow tone="brass" rule>
            Exports
          </Eyebrow>
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
            Data packages
          </h1>
          <p className="text-body-s text-ink-500">
            Download and dataset access appears after the marketplace entitlement
            service returns a provisioned package link.
          </p>
        </header>

        <ProofBoundary
          level="info"
          title="Export scope"
          icon={ShieldCheck}
        >
          Package access is scoped to the buyer entitlement and delivery mode on
          file. This page does not invent package sizes, episode counts, or
          export status.
        </ProofBoundary>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error ? (
          packageEntitlements.length ? (
            <section aria-label="Data package entitlements" className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-title-m font-semibold tracking-tight text-ink-900">
                <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Package access
              </h2>
              <EntitlementAccessTable
                entitlements={packageEntitlements}
                actionLabel="Open package"
              />
            </section>
          ) : entitlements.length ? (
            <BuyerAppEmptyState
              title="No data package entitlement yet"
              body="This account has marketplace access, but none of the current entitlements are marked as dataset or download package delivery."
            />
          ) : (
            <BuyerAppEmptyState
              title="No data packages yet"
              body="Data package rows appear after Stripe-backed marketplace entitlements are provisioned for this buyer account."
            />
          )
        ) : null}
      </div>
    </AppShell>
  );
}

function isDataPackageEntitlement(entitlement: BuyerEntitlement) {
  const text = [
    entitlement.item_type,
    entitlement.delivery_mode,
    entitlement.access?.kind,
    entitlement.access?.label,
    entitlement.title,
    entitlement.sku,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return /(dataset|package|download|export|file transfer|api access)/.test(text);
}
