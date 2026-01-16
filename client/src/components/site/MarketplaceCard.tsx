import type { MouseEvent } from "react";
import { useState, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Shield, Package, Sparkles, TrendingUp, ShoppingCart, Loader2, Play, Layers, Database, GraduationCap, Building2, ChevronRight } from "lucide-react";
import type { SyntheticDataset, MarketplaceScene, TrainingDataset } from "@/data/content";
import { licenseTiers, calculateLicensePrice } from "@/data/content";
import { ProvenanceBadge } from "@/components/site/DatasheetPanel";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { withCsrfHeader } from "@/lib/csrf";

interface MarketplaceCardProps {
  item: SyntheticDataset | MarketplaceScene | TrainingDataset;
  type: "dataset" | "scene" | "training";
}

export function MarketplaceCard({ item, type }: MarketplaceCardProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const isDataset = type === "dataset";
  const isTraining = type === "training";
  const isScene = type === "scene";
  const dataset = isDataset ? (item as SyntheticDataset) : null;
  const scene = isScene ? (item as MarketplaceScene) : null;
  const training = isTraining ? (item as TrainingDataset) : null;
  const slug = item.slug;
  const detailBasePath = isTraining ? "/marketplace/datasets" : "/marketplace/scenes";
  const detailPath = `${detailBasePath}/${slug}`;

  // Calculate savings for datasets
  const savingsPercent = dataset?.standardPricePerScene
    ? Math.round(
        ((dataset.standardPricePerScene - dataset.pricePerScene) /
          dataset.standardPricePerScene) *
          100
      )
    : 0;

  const totalBundlePrice = dataset
    ? dataset.pricePerScene * dataset.sceneCount
    : 0;

  const mainPrice = isDataset ? dataset!.pricePerScene : isTraining ? training!.price : scene!.price;
  const title = item.title;
  const description = item.description;
  const thumbnail = isDataset ? dataset!.heroImage : isTraining ? training!.heroImage : scene!.thumbnail;
  const tags = item.tags;
  const exclusiveDatasetUrl = `/contact?interest=exclusive-dataset&product=${encodeURIComponent(slug)}`;

  const handleCheckout = useCallback(
    async (event?: MouseEvent<HTMLButtonElement>) => {
      event?.stopPropagation();
      if (isRedirecting) return;

      const checkoutItem = isDataset
        ? {
            sku: dataset!.slug,
            title: dataset!.title,
            description: dataset!.description,
            price: dataset!.pricePerScene,
            quantity: dataset!.sceneCount || 1,
            itemType: "dataset" as const,
          }
        : isTraining
        ? {
            sku: training!.slug,
            title: training!.title,
            description: training!.description,
            price: training!.price,
            quantity: 1,
            itemType: "training" as const,
          }
        : {
            sku: scene!.slug,
            title: scene!.title,
            description: scene!.description,
            price: scene!.price,
            quantity: 1,
            itemType: "scene" as const,
          };

      setIsRedirecting(true);
      try {
        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: await withCsrfHeader({ "Content-Type": "application/json" }),
          body: JSON.stringify({
            sessionType: "marketplace",
            successPath: `${detailPath}?checkout=success`,
            cancelPath: `${detailPath}?checkout=cancel`,
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
    },
    [dataset, detailPath, isDataset, isTraining, isRedirecting, scene, training],
  );

  const handleCardClick = useCallback(() => {
    if (!currentUser) {
      sessionStorage.setItem("redirectAfterAuth", detailPath);
      navigate("/login");
      return;
    }
    navigate(detailPath);
  }, [currentUser, detailPath, navigate]);

  return (
    <article
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-xl hover:border-zinc-300"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
        {/* Skeleton loader */}
        {!imageLoaded && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 bg-[length:200%_100%]" />
        )}
        <img
          src={thumbnail}
          alt={title}
          className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-110 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
        />

        {/* Overlay badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {item.isNew && (
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
              <Sparkles className="h-3 w-3" /> NEW
            </span>
          )}
          {isDataset && dataset!.isTrending && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
              <TrendingUp className="h-3 w-3" /> TRENDING
            </span>
          )}
          {item.isFeatured && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-bold text-white shadow-lg">
              ⭐ FEATURED
            </span>
          )}
        </div>

        {/* Savings badge for datasets */}
        {isDataset && savingsPercent > 0 && (
          <div className="absolute right-3 top-3">
            <div className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg">
              SAVE {savingsPercent}%
            </div>
          </div>
        )}

        {/* Type badge */}
        <div className="absolute bottom-3 left-3 flex gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {isTraining ? (
              <Database className="h-3 w-3" />
            ) : (
              <Package className="h-3 w-3" />
            )}
            {isDataset ? "Benchmark Pack" : isTraining ? "Dataset Pack" : "Scene Library"}
          </span>
          {!isTraining && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/80 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              <Play className="h-2.5 w-2.5" />
              + Episodes
            </span>
          )}
          {isTraining && (
            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/80 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              <Play className="h-2.5 w-2.5" />
              LeRobot
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        {/* Location type */}
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
          {item.locationType}
        </div>

        {/* Title */}
        <h3 className="mb-2 text-lg font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
          {title}
        </h3>

        {/* Description */}
        <p className="mb-4 text-sm text-zinc-600 line-clamp-2 flex-1">
          {description}
        </p>

        {/* Pricing */}
        <div className="mb-4 space-y-2">
          {isDataset ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900">
                  ${dataset!.bundlePrice?.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Scene + Episodes
                </span>
              </div>
              <div className="text-xs text-zinc-500">
                {dataset!.sceneCount} scenes • {dataset!.variationCount?.toLocaleString()} variations • {dataset!.episodeCount?.toLocaleString()} episodes
              </div>
              {/* License Tier Preview - Dataset */}
              <div className="mt-2 flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <GraduationCap className="h-3 w-3" />
                    <span>From ${calculateLicensePrice(dataset!.bundlePrice || 0, 'research').toLocaleString()}</span>
                  </div>
                  <div className="h-3 w-px bg-zinc-200" />
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-indigo-600">
                    <Building2 className="h-3 w-3" />
                    <span>Commercial</span>
                  </div>
                </div>
                <ProvenanceBadge />
              </div>
            </>
          ) : isTraining ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900">
                  ${training!.price.toLocaleString()}
                </span>
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                  {training!.dataFormat} Format
                </span>
              </div>
              <div className="text-xs text-zinc-500">
                {training!.episodeCount.toLocaleString()} episodes • {training!.trajectoryLength} per trajectory
              </div>
              {/* License Tier Preview - Training */}
              <div className="mt-2 flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                    <GraduationCap className="h-3 w-3" />
                    <span>From ${calculateLicensePrice(training!.price, 'research').toLocaleString()}</span>
                  </div>
                  <div className="h-3 w-px bg-zinc-200" />
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-indigo-600">
                    <Building2 className="h-3 w-3" />
                    <span>Commercial</span>
                  </div>
                </div>
                <ProvenanceBadge />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-zinc-900">
                  ${scene!.bundlePrice || scene!.price}
                </span>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Scene + Episodes
                </span>
              </div>
              <div className="text-xs text-zinc-500">
                {(scene!.variationCount || 500).toLocaleString()} variations • {(scene!.episodeCount || 5000).toLocaleString()} AI-generated episodes
              </div>
            </>
          )}

          {/* License Tier Preview - Hybrid Marketplace */}
          <div className="mt-3 flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                <GraduationCap className="h-3 w-3" />
                <span>From ${calculateLicensePrice(isDataset ? (dataset!.bundlePrice || 0) : isTraining ? training!.price : (scene!.bundlePrice || scene!.price), 'research').toLocaleString()}</span>
              </div>
              <div className="h-3 w-px bg-zinc-200" />
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-indigo-600">
                <Building2 className="h-3 w-3" />
                <span>Commercial</span>
              </div>
            </div>
            <ProvenanceBadge />
          </div>
        </div>

        {/* Stats Grid */}
        <div
          className={`mb-4 grid grid-cols-2 gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-3`}
        >
          {isDataset ? (
            <>
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  <Layers className="h-3 w-3" />
                  Variations
                </div>
                <div className="font-mono text-sm font-semibold text-zinc-900">
                  {dataset!.variationCount?.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  <Play className="h-3 w-3" />
                  Episodes
                </div>
                <div className="font-mono text-sm font-semibold text-zinc-900">
                  {dataset!.episodeCount?.toLocaleString()}
                </div>
              </div>
            </>
          ) : isTraining ? (
            <>
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  <Play className="h-3 w-3" />
                  Episodes
                </div>
                <div className="font-mono text-sm font-semibold text-zinc-900">
                  {training!.episodeCount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  <Database className="h-3 w-3" />
                  Modalities
                </div>
                <div className="font-mono text-sm font-semibold text-zinc-900">
                  {training!.sensorModalities.length}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  <Layers className="h-3 w-3" />
                  Variations
                </div>
                <div className="font-mono text-sm font-semibold text-zinc-900">
                  {(scene!.variationCount || 500).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
                  <Play className="h-3 w-3" />
                  Episodes
                </div>
                <div className="font-mono text-sm font-semibold text-zinc-900">
                  {(scene!.episodeCount || 5000).toLocaleString()}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Policy badges */}
        {item.policySlugs.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {item.policySlugs.slice(0, 2).map((slug) => (
              <span
                key={slug}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10"
              >
                <Shield className="h-2.5 w-2.5" />
                {slug.split("-").slice(0, 2).join(" ")}
              </span>
            ))}
            {item.policySlugs.length > 2 && (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                +{item.policySlugs.length - 2} more
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-600"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* CTA Button */}
        <button
          className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-indigo-600 hover:shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={handleCheckout}
          disabled={isRedirecting}
        >
          {isRedirecting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Redirecting...
            </>
          ) : (
            <>
              <ShoppingCart className="h-4 w-4" />
              {isDataset ? "Buy Bundle" : isTraining ? "Buy Dataset" : "Buy Now"}
            </>
          )}
        </button>
        {(isDataset || isTraining) && (
          <a
            href={exclusiveDatasetUrl}
            onClick={(event) => event.stopPropagation()}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-100"
          >
            Request Exclusive Dataset
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        )}
        {isScene && (
          <a
            href={exclusiveDatasetUrl}
            onClick={(event) => event.stopPropagation()}
            className="mt-3 inline-flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            Request Exclusive Dataset
            <ChevronRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </article>
  );
}
