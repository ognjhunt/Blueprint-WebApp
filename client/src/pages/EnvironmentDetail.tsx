import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  scenes,
  syntheticDatasets,
  marketplaceScenes,
  type SyntheticDataset,
  type MarketplaceScene,
} from "@/data/content";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { InteractionBadges } from "@/components/site/InteractionBadges";
import { SpecList } from "@/components/site/SpecList";
import { SceneCard } from "@/components/site/SceneCard";
import {
  ArrowLeft,
  Box,
  Calendar,
  Layers,
  Package,
  Shield,
  ShoppingCart,
  Sparkles,
  Tag,
  TrendingUp,
} from "lucide-react";

interface EnvironmentDetailProps {
  params: {
    slug: string;
  };
}

export default function EnvironmentDetail({ params }: EnvironmentDetailProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { currentUser, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const hasResumedCheckoutRef = useRef(false);

  const marketplaceDataset = syntheticDatasets.find(
    (item) => item.slug === params.slug,
  );
  const marketplaceScene = marketplaceScenes.find(
    (item) => item.slug === params.slug,
  );

  const marketplaceItem: (SyntheticDataset | MarketplaceScene) | undefined =
    marketplaceDataset || marketplaceScene;

  const isDataset = Boolean(marketplaceDataset);
  const detailSlug = marketplaceItem?.slug;

  const formattedReleaseDate = useMemo(() => {
    if (!marketplaceItem) return null;
    return new Intl.DateTimeFormat("en", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(new Date(marketplaceItem.releaseDate));
  }, [marketplaceItem]);

  const handleCheckout = useCallback(async () => {
    if (!marketplaceItem || isRedirecting) return;

    if (!currentUser) {
      if (!authLoading) {
        const pendingRedirectPath = (() => {
          if (typeof window === "undefined") {
            return `/environments/${detailSlug}?checkout=pending`;
          }

          const currentUrl = new URL(window.location.href);
          currentUrl.searchParams.set("checkout", "pending");
          return `${currentUrl.pathname}${currentUrl.search}`;
        })();

        try {
          sessionStorage.setItem(
            "redirectAfterAuth",
            pendingRedirectPath,
          );
        } catch (storageError) {
          console.error(
            "Unable to set redirectAfterAuth in sessionStorage:",
            storageError,
          );
        }
        navigate("/login");
      }
      return;
    }

    const checkoutItem = isDataset
      ? {
          sku: marketplaceDataset!.slug,
          title: marketplaceDataset!.title,
          description: marketplaceDataset!.description,
          price: marketplaceDataset!.pricePerScene,
          quantity: marketplaceDataset!.sceneCount || 1,
          itemType: "dataset" as const,
        }
      : {
          sku: marketplaceScene!.slug,
          title: marketplaceScene!.title,
          description: marketplaceScene!.description,
          price: marketplaceScene!.price,
          quantity: 1,
          itemType: "scene" as const,
        };

    setIsRedirecting(true);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionType: "marketplace",
          successPath: `/environments/${detailSlug}?checkout=success`,
          cancelPath: `/environments/${detailSlug}?checkout=cancel`,
          marketplaceItem: checkoutItem,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.sessionId) {
        throw new Error(
          data?.error || "We couldn't start checkout just yet. Please try again.",
        );
      }

      const sessionUrl =
        typeof data.sessionUrl === "string" && data.sessionUrl.length > 0
          ? data.sessionUrl
          : undefined;

      const publishableKey =
        import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ||
        import.meta.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
        "pk_test_51ODuefLAUkK46LtZQ7o2si0POvd89pgNhE8pRcCCqMmmp9z534veOOiz81xMZcjZuEDK2CkdQnE9NhRy4WEoqWJG00ErDRTYlA";

      if (sessionUrl) {
        window.location.href = sessionUrl;
        return;
      }

      const stripe = await loadStripe(publishableKey);
      if (!stripe) {
        throw new Error("Stripe failed to initialize");
      }

      const result = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });

      if (result.error) {
        throw result.error;
      }
    } catch (error) {
      console.error("Unable to start Stripe checkout", error);
      const message =
        error instanceof Error
          ? error.message
          : "We couldn't start checkout just yet. Please try again.";
      alert(message);
    } finally {
      setIsRedirecting(false);
    }
  }, [authLoading, currentUser, detailSlug, isDataset, isRedirecting, marketplaceDataset, marketplaceItem, marketplaceScene, navigate]);

  useEffect(() => {
    if (hasResumedCheckoutRef.current) return;
    if (!currentUser || authLoading || isRedirecting) return;

    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("checkout") === "pending") {
      hasResumedCheckoutRef.current = true;
      handleCheckout();
    }
  }, [authLoading, currentUser, handleCheckout, isRedirecting]);

  if (marketplaceItem) {
    const heroImage = isDataset
      ? (marketplaceDataset as SyntheticDataset).heroImage
      : (marketplaceScene as MarketplaceScene).thumbnail;
    const frameCount = isDataset
      ? (marketplaceDataset as SyntheticDataset).frameCount
      : (marketplaceScene as MarketplaceScene).frameCount;
    const deliverables = marketplaceItem.deliverables || [];
    const randomizers = (marketplaceDataset as SyntheticDataset | undefined)
      ?.randomizerScripts;
    const interactions = (marketplaceScene as MarketplaceScene | undefined)
      ?.interactions;
    const quantityLabel = isDataset
      ? `${(marketplaceDataset as SyntheticDataset).sceneCount} scenes`
      : `${(frameCount ?? 1)} frames`;
    const priceLabel = isDataset ? "/scene" : "";
    const bundleTotal = isDataset
      ? ((marketplaceDataset as SyntheticDataset).pricePerScene || 0) *
        ((marketplaceDataset as SyntheticDataset).sceneCount || 1)
      : null;

    return (
      <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
        <a
          href="/environments"
          className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to marketplace
        </a>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                <Package className="h-3 w-3" />
                {isDataset ? "Dataset Bundle" : "Single Scene"}
              </span>
              {marketplaceItem.isNew && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                  <Sparkles className="h-3 w-3" /> New drop
                </span>
              )}
              {isDataset && (marketplaceDataset as SyntheticDataset).isTrending && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                  <TrendingUp className="h-3 w-3" /> Trending
                </span>
              )}
              {marketplaceItem.isFeatured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  ⭐ Featured
                </span>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-400">
                {marketplaceItem.locationType}
              </p>
              <h1 className="text-4xl font-semibold text-zinc-900">
                {marketplaceItem.title}
              </h1>
              <p className="text-lg text-zinc-600">{marketplaceItem.description}</p>
            </div>

            <div className="overflow-hidden rounded-3xl border border-zinc-200">
              <img
                src={heroImage}
                alt={marketplaceItem.title}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <Calendar className="h-4 w-4" /> Release
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900">
                  {formattedReleaseDate || marketplaceItem.releaseDate}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <Layers className="h-4 w-4" /> Coverage
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900">
                  {quantityLabel}
                </div>
                {frameCount ? (
                  <div className="text-xs text-zinc-500">{frameCount} frames</div>
                ) : null}
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <Box className="h-4 w-4" /> Deliverables
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900">
                  {deliverables.length ? deliverables.join(", ") : "Contact for formats"}
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-500">Pricing</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-zinc-900">
                      ${isDataset
                        ? (marketplaceDataset as SyntheticDataset).pricePerScene
                        : (marketplaceScene as MarketplaceScene).price}
                    </span>
                    {priceLabel ? (
                      <span className="text-sm text-zinc-500">{priceLabel}</span>
                    ) : null}
                    {isDataset && (marketplaceDataset as SyntheticDataset).standardPricePerScene ? (
                      <span className="text-xs text-zinc-400 line-through">
                        ${(marketplaceDataset as SyntheticDataset).standardPricePerScene}
                      </span>
                    ) : null}
                  </div>
                {isDataset ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    {`${quantityLabel} • bundle total $${
                      bundleTotal ? bundleTotal.toLocaleString() : "0"
                    }`}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-emerald-600">
                    {(marketplaceScene as MarketplaceScene).inStock
                      ? "Available for immediate access"
                      : "Join the waitlist"}
                  </p>
                  )}
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {(marketplaceItem.policySlugs || []).slice(0, 1).join(" ") || "SimReady"}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Object coverage</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    {marketplaceItem.objectTags.slice(0, 3).join(", ") || "On request"}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                  <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Policies</p>
                  <p className="mt-1 text-sm font-semibold text-zinc-900">
                    {marketplaceItem.policySlugs.slice(0, 2).join(", ") || "Custom"}
                  </p>
                </div>
              </div>

              <button
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-600 disabled:opacity-60"
                onClick={handleCheckout}
                disabled={isRedirecting}
              >
                <ShoppingCart className="h-4 w-4" />
                {isRedirecting
                  ? "Redirecting..."
                  : isDataset
                  ? "Buy bundle"
                  : "Buy this scene"}
              </button>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Shield className="h-4 w-4" /> SimReady checklist
              </div>
              <ul className="space-y-2 text-sm text-zinc-600">
                <li>• Validated articulation for doors, drawers, and mechanical limits.</li>
                <li>• Semantic labels aligned with policies: {marketplaceItem.policySlugs.join(", ") || "customizable"}.</li>
                <li>
                  • Delivered formats: {deliverables.join(", ") || "USD / on request"}. Randomizers tuned for domain gaps.
                </li>
              </ul>
              <div className="flex flex-wrap gap-2">
                {marketplaceItem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700"
                  >
                    <Tag className="h-3 w-3" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <Box className="h-4 w-4" /> Deliverables & formats
            </div>
            <div className="grid gap-2 text-sm text-zinc-600">
              {deliverables.map((deliverable) => (
                <div key={deliverable} className="flex items-center gap-2 rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                  <span>{deliverable}</span>
                </div>
              ))}
              {deliverables.length === 0 ? (
                <p className="text-sm text-zinc-500">Formats available on request.</p>
              ) : null}
            </div>

            {randomizers && randomizers.length ? (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Randomizers</h3>
                <div className="flex flex-wrap gap-2">
                  {randomizers.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
              <Layers className="h-4 w-4" /> Policy + object coverage
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Policies</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {marketplaceItem.policySlugs.map((policy) => (
                    <span
                      key={policy}
                      className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                    >
                      {policy}
                    </span>
                  ))}
                  {marketplaceItem.policySlugs.length === 0 ? (
                    <span className="text-sm text-zinc-500">Custom policy support on request.</span>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Objects & interactions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {marketplaceItem.objectTags.map((object) => (
                    <span
                      key={object}
                      className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700"
                    >
                      {object}
                    </span>
                  ))}
                </div>
              </div>

              {interactions && interactions.length ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">Interaction notes</p>
                  <ul className="space-y-2 text-sm text-zinc-600">
                    {interactions.map((interaction) => (
                      <li key={interaction} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-3">
                        {interaction}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const scene = scenes.find((item) => item.slug === params.slug);

  if (!scene) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h1 className="text-3xl font-semibold text-slate-900">
          Scene not found
        </h1>
        <p className="mt-4 text-sm text-slate-600">
          The environment you are looking for isn’t in our network yet. Browse other scenes or contact us to request a custom build.
        </p>
        <a
          href="/environments"
          className="mt-6 inline-flex rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
        >
          Back to environments
        </a>
      </div>
    );
  }

  const related = scenes
    .filter((item) => item.slug !== scene.slug && item.categories.some((category) => scene.categories.includes(category)))
    .slice(0, 3);

  const specItems = [
    { label: "USD version", value: scene.usdVersion },
    { label: "Units", value: scene.units },
    { label: "Material model", value: scene.materials },
    { label: "Tested with", value: scene.testedWith },
    { label: "Lead time", value: scene.leadTime },
    { label: "Colliders", value: scene.colliders },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
      <header className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            {scene.tags.join(" • ")}
          </p>
          <h1 className="text-4xl font-semibold text-slate-900">{scene.title}</h1>
          <p className="text-sm text-slate-600">{scene.seo}</p>
          <div className="space-y-4">
            <h2 className="text-xs uppercase tracking-[0.3em] text-slate-400">
              Interaction coverage
            </h2>
            <InteractionBadges
              types={scene.interactions.map((interaction) => interaction.type)}
            />
            <div className="grid gap-3 text-sm text-slate-600">
              {scene.interactions.map((interaction) => (
                <div key={interaction.component} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">
                      {interaction.component}
                    </span>
                    <span className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      {interaction.type}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Axis {interaction.axis || "—"} • Limits {interaction.limits || "N/A"}
                  </p>
                  {interaction.notes ? (
                    <p className="mt-2 text-xs text-slate-500">{interaction.notes}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="/contact"
              className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              {scene.ctaText}
            </a>
            {scene.download ? (
              <a
                href={scene.download}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
              >
                Download sample
              </a>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4">
          {scene.gallery.map((src) => (
            <div key={src} className="overflow-hidden rounded-3xl border border-slate-200">
              <img src={src} alt="Scene preview" className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </header>

      <section className="grid gap-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">What’s included</h2>
          <ul className="space-y-3 text-sm text-slate-600">
            <li>USD stage referencing articulated assets with validated limits.</li>
            <li>Texture set (albedo, normal, roughness) and OpenPBR material definitions.</li>
            <li>Collision package ({scene.colliders}) tuned for robotics simulation.</li>
            <li>Optional annotation bundles: {scene.replicator ?? "available on request"}.</li>
          </ul>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            <h3 className="text-sm font-semibold text-slate-900">Access</h3>
            <p className="mt-2">
              Standard lead time: {scene.leadTime}. Expedited turnaround is available pending scope. Scenes are provided via secure download with release notes and simulation validation checklists.
            </p>
          </div>
        </div>
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">Specs</h2>
          <SpecList items={specItems} />
        </div>
      </section>

      {related.length ? (
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-slate-900">
            Related environments
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <SceneCard key={item.slug} scene={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
