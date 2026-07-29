import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";

import { Button, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
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
} from "@/lib/buyerAppData";

export default function SitePacks() {
  const { entitlements, isLoading, error } = useBuyerAppEntitlements();

  return (
    <AppShell active="packs" breadcrumb="packs">
      <Helmet>
        <title>Testbeds · Blueprint</title>
        <meta
          name="description"
          content="Protected buyer access to Blueprint site, task, scene, and dataset entitlements."
        />
      </Helmet>

      <div className="mx-auto flex max-w-[80rem] flex-col gap-8 px-4 py-8 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <Eyebrow tone="brass" rule>
              Maintained site-task substrate
            </Eyebrow>
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink-900">
              Testbeds
            </h1>
            <p className="max-w-[44rem] text-body-s text-ink-500">
              Existing site, task, scene, and access records remain readable here
              as compatibility-backed testbed references.
            </p>
          </div>
          <Button asChild variant="action" iconLeft={<Plus />}>
            <Link href="/app/runs/new">Request a Task Evaluation Run</Link>
          </Button>
        </header>

        {isLoading ? <BuyerAppLoadingState /> : null}
        {error ? <BuyerAppErrorState message={error.message} /> : null}
        {!isLoading && !error ? (
          entitlements.length ? (
            <section
              aria-label="Available testbed records"
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {entitlements.map((entitlement) => (
                <article
                  key={entitlement.id}
                  className="flex flex-col rounded-md border border-line bg-white p-5 transition-colors hover:border-line-strong"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-body font-semibold leading-snug text-ink-900">
                        {entitlementDisplayName(entitlement)}
                      </h2>
                      <StatusChip tone={entitlementStateTone(entitlement.access_state)} square>
                        {entitlementStateLabel(entitlement.access_state)}
                      </StatusChip>
                    </div>
                    <div className="flex flex-col gap-1 font-mono text-[0.72rem] text-ink-500">
                      <span>{entitlement.id}</span>
                      <span>{entitlement.sku || "sku pending"}</span>
                    </div>
                  </div>

                  <dl className="my-4 flex flex-col gap-2 border-y border-line-soft py-3 text-caption">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-ink-400">Delivery</dt>
                      <dd className="font-mono text-ink-700">
                        {entitlement.delivery_mode || "manual review"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-ink-400">Granted</dt>
                      <dd className="font-mono text-ink-700">
                        {formatEntitlementDate(entitlement.granted_at)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-ink-400">Scope</dt>
                      <dd className="max-w-[12rem] text-right text-ink-700">
                        {entitlementScope(entitlement)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Button
                      asChild
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      iconRight={<ArrowRight />}
                    >
                      <Link href={`/app/packs/${encodeURIComponent(entitlement.id)}`}>
                        View testbed record
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <BuyerAppEmptyState
              title="No testbed records yet"
              body="A maintained site-task testbed record appears here after its capture and access records are linked to this account."
            />
          )
        ) : null}

        <ProofBoundary
          level="info"
          title="Compatibility and access source"
          icon={ShieldCheck}
        >
          Legacy entitlement and pack records are retained without turning them
          into separate products. Task Evaluation Runs reference exact testbed
          versions and digests.
        </ProofBoundary>
      </div>
    </AppShell>
  );
}
