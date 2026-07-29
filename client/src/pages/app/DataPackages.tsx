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
        <title>Evidence exports · Blueprint</title>
        <meta
          name="description"
          content="Historical evidence-export compatibility access backed by existing entitlements."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-1.5">
          <Eyebrow tone="brass" rule>
            Compatibility view
          </Eyebrow>
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
            Evidence exports
          </h1>
          <p className="text-body-s text-ink-500">
            Historical export entitlements remain readable. New evidence and
            download eligibility are displayed inside the relevant run.
          </p>
        </header>

        <ProofBoundary
          level="info"
          title="Evidence use is not a separate product"
          icon={ShieldCheck}
        >
          An export may be eligible for evaluation or post-training use only when
          the Pipeline result says so. Export access does not prove that training
          happened or that a policy improved.
        </ProofBoundary>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error ? (
          packageEntitlements.length ? (
            <section aria-label="Historical evidence export entitlements" className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-title-m font-semibold tracking-tight text-ink-900">
                <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Historical export access
              </h2>
              <EntitlementAccessTable
                entitlements={packageEntitlements}
                actionLabel="Open historical export"
              />
            </section>
          ) : entitlements.length ? (
            <BuyerAppEmptyState
              title="No legacy evidence export entitlement"
              body="This account has access records, but none currently point to a historical export. Check the relevant Task Evaluation Run for evidence-use eligibility."
            />
          ) : (
            <BuyerAppEmptyState
              title="No evidence exports yet"
              body="Eligible evidence artifacts appear inside a Task Evaluation Run result, with exact versions, digests, and permitted uses."
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
  return /(dataset|package|download|export|file transfer|api access|task eval|eval run|post-training|post training|robot eval)/.test(text);
}
