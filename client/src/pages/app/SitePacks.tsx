import { useEffect, useState } from "react";
import { Helmet } from "@/lib/helmet";
import { Link } from "wouter";
import { ArrowRight, Plus, ShieldCheck } from "lucide-react";

import { Button, Eyebrow, ProofBoundary, StatusChip } from "@/components/blueprint";
import { AppShell } from "@/components/blueprint/app/AppShell";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  fetchAuthenticatedConfiguredSceneThumbnail,
  type ConfiguredSceneOfferingCard,
} from "@/lib/configuredSceneOffering";
import { withFirebaseAuthHeaders } from "@/lib/firebaseAuthHeaders";

function OfferingThumbnail({
  offering,
  currentUser,
}: {
  offering: ConfiguredSceneOfferingCard;
  currentUser: Parameters<typeof withFirebaseAuthHeaders>[0];
}) {
  const [source, setSource] = useState("");
  useEffect(() => {
    if (!currentUser) return undefined;
    let objectUrl = "";
    let cancelled = false;
    void withFirebaseAuthHeaders(currentUser)
      .then((headers) => fetchAuthenticatedConfiguredSceneThumbnail(
        offering.presentation.thumbnail_url,
        headers,
      ))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => setSource(""));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [currentUser, offering.presentation.thumbnail_url]);
  return source ? (
    <img
      src={source}
      alt={`Selected configured-scene view for ${offering.scene_identity.id}`}
      className="aspect-video w-full bg-ink-50 object-cover"
    />
  ) : (
    <div className="flex aspect-video items-center justify-center bg-ink-50 text-caption text-ink-400">
      Loading private thumbnail…
    </div>
  );
}

export default function SitePacks() {
  const { entitlements, isLoading, error } = useBuyerAppEntitlements();
  const { currentUser } = useAuth();
  const [offerings, setOfferings] = useState<ConfiguredSceneOfferingCard[]>([]);
  const [offeringError, setOfferingError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    void withFirebaseAuthHeaders(currentUser)
      .then((headers) => fetch("/api/configured-scene-offerings", {
        headers,
        credentials: "include",
      }))
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Configured scene offerings are unavailable");
        setOfferings(payload.offerings || []);
      })
      .catch((reason) => setOfferingError(reason instanceof Error ? reason.message : String(reason)));
  }, [currentUser]);

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
            <h1 className="font-display text-[1.65rem] font-semibold uppercase leading-tight tracking-[0.005em] text-ink-900">
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

        {offerings.length ? (
          <section aria-label="Configured site-task testbeds" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {offerings.map((offering) => {
              const controlsPending = offering.status === "configured_controls_pending";
              const appearanceUngraded = offering.presentation.appearance_review_status
                === "paused_ungraded";
              return <article key={offering.offering_digest} className="runway-panel overflow-hidden">
                <OfferingThumbnail offering={offering} currentUser={currentUser} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="runway-num font-semibold text-ink-900">{offering.scene_identity.id}</h2>
                      <p className="runway-num mt-1 text-caption text-ink-500">
                        {offering.task.identity.id} · {offering.task.strategy.replaceAll("_", " ")}
                      </p>
                    </div>
                    <StatusChip tone={controlsPending ? "warn" : "proof"} square>
                      {controlsPending ? "Controls pending" : "Evaluation ready"}
                    </StatusChip>
                  </div>
                  <p className="mt-3 text-caption leading-5 text-ink-500">
                    Exact configured revision and bundle. The thumbnail is one unchanged frame selected from
                    digest-bound renders; it is derived appearance evidence, not physical proof.
                  </p>
                  {appearanceUngraded ? (
                    <p className="mt-3 border border-runway-signal/40 bg-runway-signal/[0.08] px-3 py-2 text-caption font-semibold text-runway-signal">
                      Visual review paused — appearance ungraded
                    </p>
                  ) : null}
                  {controlsPending ? (
                    <Button asChild variant="action" className="mt-4 w-full">
                      <Link href={`/app/packs/${encodeURIComponent(offering.source_launch_id)}/policy-canary`}>
                        Run policy canary <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="action" className="mt-4 w-full">
                      <Link href={`/app/packs/${encodeURIComponent(offering.source_launch_id)}/evaluate`}>
                        Configure evaluation <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  )}
                  <p className="mt-2 text-[0.7rem] leading-4 text-ink-400">
                    {controlsPending
                      ? "Run real learned policies now. Results will be marked unqualified until controls pass."
                      : "Choose episode depth, review the exact two-policy matrix, and start. No JSON upload, provider choice, payment, or team field is required."}
                  </p>
                </div>
              </article>;
            })}
          </section>
        ) : null}
        {offeringError ? <BuyerAppErrorState message={offeringError} /> : null}

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
                  className="runway-panel flex flex-col p-5 transition-colors hover:border-runway-line-strong"
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
                    <div className="runway-num flex flex-col gap-1 text-[0.72rem] text-ink-500">
                      <span>{entitlement.id}</span>
                      <span>{entitlement.sku || "sku pending"}</span>
                    </div>
                  </div>

                  <dl className="my-4 flex flex-col gap-2 border-y border-line-soft py-3 text-caption">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="runway-meta">Delivery</dt>
                      <dd className="runway-num text-ink-700">
                        {entitlement.delivery_mode || "manual review"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="runway-meta">Granted</dt>
                      <dd className="runway-num text-ink-700">
                        {formatEntitlementDate(entitlement.granted_at)}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="runway-meta">Scope</dt>
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
