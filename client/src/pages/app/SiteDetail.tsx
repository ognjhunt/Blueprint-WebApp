import { Helmet } from "@/lib/helmet";
import { Link, useParams } from "wouter";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, ShieldAlert, ShieldCheck } from "lucide-react";

import {
  Button,
  DataField,
  Eyebrow,
  ProofBoundary,
  StatusChip,
} from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import {
  BuyerAppEmptyState,
  BuyerAppErrorState,
  BuyerAppLoadingState,
} from "@/components/blueprint/app/BuyerAppStates";
import {
  entitlementDisplayName,
  entitlementScope,
  entitlementStateLabel,
  entitlementStateTone,
  formatEntitlementDate,
  useBuyerAppEntitlements,
  type BuyerEntitlement,
} from "@/lib/buyerAppData";

interface SiteDetailProps {
  params?: { siteId?: string };
}

export default function SiteDetail({ params }: SiteDetailProps) {
  const routeParams = useParams<{ siteId?: string }>();
  const rawSiteId = params?.siteId || routeParams.siteId || "";
  const siteId = decodeURIComponent(rawSiteId);
  const { entitlements, isLoading, error } = useBuyerAppEntitlements();
  const entitlement = findEntitlement(entitlements, siteId);

  return (
    <AppShell active="packs" breadcrumb={`packs / ${siteId || "unknown"}`}>
      <Helmet>
        <title>{`${siteId || "Pack"} · Blueprint buyer access`}</title>
        <meta
          name="description"
          content="Protected Blueprint buyer access detail backed by marketplace entitlements."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[72rem] flex-col gap-6 px-4 py-8 lg:px-8">
        <Link
          href="/app/packs"
          className="inline-flex w-fit items-center gap-1.5 text-body-s font-semibold text-ink-500 transition-colors hover:text-ink-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          All packs
        </Link>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error ? (
          entitlement ? (
            <SiteDetailBody entitlement={entitlement} />
          ) : entitlements.length ? (
            <ProofBoundary
              level="block"
              title="Access record not found"
              icon={ShieldAlert}
            >
              The requested pack id is not in this buyer account's marketplace
              entitlements.
            </ProofBoundary>
          ) : (
            <BuyerAppEmptyState
              title="No buyer access on file"
              body="Pack details require a marketplace entitlement owned by this authenticated buyer."
            />
          )
        ) : null}
      </div>
    </AppShell>
  );
}

function SiteDetailBody({ entitlement }: { entitlement: BuyerEntitlement }) {
  return (
    <>
      <header className="flex flex-col gap-3 border-b border-line pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
            {entitlementDisplayName(entitlement)}
          </h1>
          <StatusChip tone={entitlementStateTone(entitlement.access_state)} square>
            {entitlementStateLabel(entitlement.access_state)}
          </StatusChip>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[0.78rem] text-ink-500">
          <span>{entitlement.id}</span>
          <span className="text-ink-300">·</span>
          <span>{entitlement.sku || "sku pending"}</span>
          <span className="text-ink-300">·</span>
          <span>{entitlement.item_type || "item type pending"}</span>
        </div>
      </header>

      <section aria-label="Access record" className="rounded-md border border-line bg-white">
        <DataField label="Entitlement id" value={entitlement.id} />
        <DataField label="Order id" value={entitlement.order_id || "Pending"} />
        <DataField label="Buyer" value={entitlement.buyer_email || "Account user"} mono={false} />
        <DataField label="Delivery mode" value={entitlement.delivery_mode || "Manual review"} />
        <DataField
          label="License tier"
          value={entitlement.license_tier || "Recorded on order"}
          mono={false}
        />
        <DataField
          label="Scope"
          value={entitlementScope(entitlement)}
          mono={false}
        />
        <DataField
          label="Granted"
          value={formatEntitlementDate(entitlement.granted_at)}
          border={false}
        />
      </section>

      <section className="flex flex-col gap-3">
        <Eyebrow tone="brass" rule>
          Access
        </Eyebrow>
        {entitlement.access?.url ? (
          <div className="flex flex-col gap-4 rounded-md border border-line bg-white p-5">
            <ProofBoundary
              level="proof"
              title="Provisioned access"
              icon={ShieldCheck}
            >
              This entitlement has an access target returned by the marketplace
              entitlement service.
            </ProofBoundary>
            <Button asChild variant="action" className="w-fit" iconRight={<ArrowRight />}>
              <AccessLink href={entitlement.access.url}>
                {entitlement.access.label || "Open access"}
              </AccessLink>
            </Button>
          </div>
        ) : (
          <ProofBoundary
            level="warn"
            title="Access pending review"
            icon={ShieldAlert}
          >
            The entitlement is visible to this buyer, but the backend has not
            returned a provisioned access URL yet.
          </ProofBoundary>
        )}
      </section>

      <ProofBoundary level="info" title="No simulated run configuration">
        This page shows only the owned entitlement record. Run configuration,
        policy comparison, and export status require operational records from
        their source systems.
      </ProofBoundary>
    </>
  );
}

function findEntitlement(entitlements: BuyerEntitlement[], id: string) {
  const normalized = id.trim().toLowerCase();
  return entitlements.find((entitlement) => {
    const entitlementId = entitlement.id.trim().toLowerCase();
    const sku = String(entitlement.sku || "").trim().toLowerCase();
    return entitlementId === normalized || sku === normalized;
  });
}

function AccessLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return <Link href={href}>{children}</Link>;
}
