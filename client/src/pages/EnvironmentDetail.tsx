import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { loadStripe } from "@stripe/stripe-js";
import {
  scenes,
  syntheticDatasets,
  marketplaceScenes,
  premiumCapabilities,
  type SyntheticDataset,
  type MarketplaceScene,
  type PremiumCapability,
} from "@/data/content";
import { InteractionBadges } from "@/components/site/InteractionBadges";
import { SpecList } from "@/components/site/SpecList";
import { SceneCard } from "@/components/site/SceneCard";
import {
  ArrowLeft,
  BarChart3,
  Box,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Globe,
  Hand,
  Layers,
  MessageSquare,
  Move,
  Package,
  Plus,
  Shield,
  ShoppingCart,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Play,
  Cpu,
  Check,
  Users,
  Zap,
  Info,
} from "lucide-react";

// Icon mapping for premium capabilities
const capabilityIconMap: Record<string, React.ReactNode> = {
  brain: <Brain className="h-5 w-5" />,
  "message-square": <MessageSquare className="h-5 w-5" />,
  "check-circle": <CheckCircle2 className="h-5 w-5" />,
  target: <Target className="h-5 w-5" />,
  hand: <Hand className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
  layers: <Layers className="h-5 w-5" />,
  cpu: <Cpu className="h-5 w-5" />,
  move: <Move className="h-5 w-5" />,
  "bar-chart": <BarChart3 className="h-5 w-5" />,
  globe: <Globe className="h-5 w-5" />,
};

interface EnvironmentDetailProps {
  params: {
    slug: string;
  };
}

type PurchaseOption = 'bundle' | 'scene' | 'episodes';

export default function EnvironmentDetail({ params }: EnvironmentDetailProps) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<PurchaseOption>('bundle');
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());
  const [showAddons, setShowAddons] = useState(true);

  // Scroll to top when navigating to this page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Helper to check if an add-on is compatible with the selected purchase option
  const isAddonCompatible = useCallback((addon: PremiumCapability): boolean => {
    if (selectedOption === 'scene' && addon.requiresEpisodes) return false;
    if (selectedOption === 'episodes' && addon.requiresScene) return false;
    return true;
  }, [selectedOption]);

  // Toggle add-on selection
  const toggleAddon = useCallback((slug: string) => {
    setSelectedAddons(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }, []);

  // Clear incompatible add-ons when purchase option changes
  useEffect(() => {
    setSelectedAddons(prev => {
      const next = new Set<string>();
      prev.forEach(slug => {
        const addon = premiumCapabilities.find(c => c.slug === slug);
        if (addon && isAddonCompatible(addon)) {
          next.add(slug);
        }
      });
      return next;
    });
  }, [selectedOption, isAddonCompatible]);

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

  // Calculate total add-ons price
  const addonsTotal = useMemo(() => {
    return Array.from(selectedAddons).reduce((sum, slug) => {
      const addon = premiumCapabilities.find(c => c.slug === slug);
      return sum + (addon?.price || 0);
    }, 0);
  }, [selectedAddons]);

  // Get base price based on selected option
  const getBasePrice = useCallback(() => {
    if (!marketplaceItem) return 0;
    if (isDataset) {
      const ds = marketplaceDataset!;
      switch (selectedOption) {
        case 'bundle': return ds.bundlePrice;
        case 'scene': return ds.sceneOnlyPrice;
        case 'episodes': return ds.episodesOnlyPrice;
      }
    } else {
      const sc = marketplaceScene!;
      switch (selectedOption) {
        case 'bundle': return sc.bundlePrice || sc.price;
        case 'scene': return sc.sceneOnlyPrice || Math.round(sc.price * 0.45);
        case 'episodes': return sc.episodesOnlyPrice || Math.round(sc.price * 0.65);
      }
    }
  }, [isDataset, marketplaceDataset, marketplaceItem, marketplaceScene, selectedOption]);

  const basePrice = getBasePrice();
  const totalPrice = basePrice + addonsTotal;

  const handleCheckout = useCallback(async () => {
    if (!marketplaceItem || isRedirecting) return;

    const optionLabels: Record<PurchaseOption, string> = {
      bundle: 'Scene + Episodes Bundle',
      scene: 'Scene Only',
      episodes: 'Episodes Only',
    };

    // Build add-on descriptions for the checkout
    const selectedAddonsList = Array.from(selectedAddons)
      .map(slug => premiumCapabilities.find(c => c.slug === slug))
      .filter((a): a is PremiumCapability => a !== undefined);

    const addonNames = selectedAddonsList.map(a => a.shortTitle).join(', ');
    const titleSuffix = selectedAddonsList.length > 0 ? ` + ${selectedAddonsList.length} add-on${selectedAddonsList.length > 1 ? 's' : ''}` : '';

    const checkoutItem = isDataset
      ? {
          sku: `${marketplaceDataset!.slug}-${selectedOption}${selectedAddons.size > 0 ? '-addons' : ''}`,
          title: `${marketplaceDataset!.title} (${optionLabels[selectedOption]})${titleSuffix}`,
          description: addonNames ? `${marketplaceDataset!.description} | Add-ons: ${addonNames}` : marketplaceDataset!.description,
          price: totalPrice,
          quantity: 1,
          itemType: "dataset" as const,
          addons: Array.from(selectedAddons),
        }
      : {
          sku: `${marketplaceScene!.slug}-${selectedOption}${selectedAddons.size > 0 ? '-addons' : ''}`,
          title: `${marketplaceScene!.title} (${optionLabels[selectedOption]})${titleSuffix}`,
          description: addonNames ? `${marketplaceScene!.description} | Add-ons: ${addonNames}` : marketplaceScene!.description,
          price: totalPrice,
          quantity: 1,
          itemType: "scene" as const,
          addons: Array.from(selectedAddons),
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
          successPath: `/marketplace/${detailSlug}?checkout=success`,
          cancelPath: `/marketplace/${detailSlug}?checkout=cancel`,
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
  }, [detailSlug, isDataset, isRedirecting, marketplaceDataset, marketplaceItem, marketplaceScene, selectedOption, selectedAddons, totalPrice]);

  if (marketplaceItem) {
    const heroImage = isDataset
      ? (marketplaceDataset as SyntheticDataset).heroImage
      : (marketplaceScene as MarketplaceScene).thumbnail;
    const variationCount = isDataset
      ? (marketplaceDataset as SyntheticDataset).variationCount
      : (marketplaceScene as MarketplaceScene).variationCount || 500;
    const episodeCount = isDataset
      ? (marketplaceDataset as SyntheticDataset).episodeCount
      : (marketplaceScene as MarketplaceScene).episodeCount || 5000;
    const deliverables = marketplaceItem.deliverables || [];
    const randomizers = (marketplaceDataset as SyntheticDataset | undefined)
      ?.randomizerScripts;
    const interactions = (marketplaceScene as MarketplaceScene | undefined)
      ?.interactions;

    // Pricing data
    const bundlePrice = isDataset
      ? (marketplaceDataset as SyntheticDataset).bundlePrice
      : (marketplaceScene as MarketplaceScene).bundlePrice || (marketplaceScene as MarketplaceScene).price;
    const sceneOnlyPrice = isDataset
      ? (marketplaceDataset as SyntheticDataset).sceneOnlyPrice
      : (marketplaceScene as MarketplaceScene).sceneOnlyPrice || Math.round(((marketplaceScene as MarketplaceScene).price) * 0.45);
    const episodesOnlyPrice = isDataset
      ? (marketplaceDataset as SyntheticDataset).episodesOnlyPrice
      : (marketplaceScene as MarketplaceScene).episodesOnlyPrice || Math.round(((marketplaceScene as MarketplaceScene).price) * 0.65);

    // Calculate savings for bundle
    const separateTotal = sceneOnlyPrice + episodesOnlyPrice;
    const bundleSavings = separateTotal - bundlePrice;
    const bundleSavingsPercent = Math.round((bundleSavings / separateTotal) * 100);

    const productStructuredData = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: marketplaceItem.title,
      description: marketplaceItem.description,
      image: heroImage.startsWith("/") ? `https://tryblueprint.io${heroImage}` : heroImage,
      offers: {
        "@type": "Offer",
        price: isDataset
          ? (marketplaceDataset as SyntheticDataset).pricePerScene * (marketplaceDataset as SyntheticDataset).sceneCount
          : (marketplaceScene as MarketplaceScene).price,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
      category: marketplaceItem.locationType,
      brand: {
        "@type": "Brand",
        name: "Blueprint",
      },
    };

    return (
      <>
        <Helmet>
          <title>{marketplaceItem.title} | Blueprint Marketplace</title>
          <meta
            name="description"
            content={marketplaceItem.description}
          />
          <meta name="robots" content="index, follow" />
          <meta property="og:type" content="product" />
          <meta property="og:url" content={`https://tryblueprint.io/marketplace/${detailSlug}`} />
          <meta property="og:title" content={`${marketplaceItem.title} | Blueprint`} />
          <meta property="og:description" content={marketplaceItem.description} />
          <meta
            property="og:image"
            content={heroImage.startsWith("/") ? `https://tryblueprint.io${heroImage}` : heroImage}
          />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={`${marketplaceItem.title} | Blueprint`} />
          <meta name="twitter:description" content={marketplaceItem.description} />
          <link rel="canonical" href={`https://tryblueprint.io/marketplace/${detailSlug}`} />
          <script type="application/ld+json">
            {JSON.stringify(productStructuredData)}
          </script>
        </Helmet>
        <div className="mx-auto max-w-6xl space-y-12 px-4 pb-24 pt-16 sm:px-6">
          <a
            href="/marketplace"
            className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Marketplace
          </a>

        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1 text-xs font-semibold text-white">
                <Package className="h-3 w-3" />
                {isDataset ? "Benchmark Pack" : "Scene Library"}
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

            <div className="grid gap-4 md:grid-cols-4">
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
                  <Layers className="h-4 w-4" /> Variations
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900">
                  {variationCount?.toLocaleString()} layouts
                </div>
                <div className="text-xs text-zinc-500">Domain randomization</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  <Play className="h-4 w-4" /> Episodes
                </div>
                <div className="mt-2 text-sm font-medium text-zinc-900">
                  {episodeCount?.toLocaleString()} trajectories
                </div>
                <div className="text-xs text-zinc-500">AI-generated (Gemini)</div>
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
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-zinc-900">Choose Your Package</p>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                  {(marketplaceItem.policySlugs || []).slice(0, 1).join(" ") || "SimReady"}
                </span>
              </div>

              {/* Purchase Options */}
              <div className="space-y-2">
                {/* Bundle Option - Best Value */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('bundle')}
                  className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                    selectedOption === 'bundle'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        selectedOption === 'bundle' ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-300'
                      }`}>
                        {selectedOption === 'bundle' && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="font-medium text-zinc-900 text-sm">Scene + Episodes</span>
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        SAVE {bundleSavingsPercent}%
                      </span>
                    </div>
                    <span className="font-bold text-zinc-900">${bundlePrice?.toLocaleString()}</span>
                  </div>
                </button>

                {/* Scene Only Option */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('scene')}
                  className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                    selectedOption === 'scene'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        selectedOption === 'scene' ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-300'
                      }`}>
                        {selectedOption === 'scene' && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="font-medium text-zinc-900 text-sm">Scene Only</span>
                    </div>
                    <span className="font-bold text-zinc-900">${sceneOnlyPrice?.toLocaleString()}</span>
                  </div>
                </button>

                {/* Episodes Only Option */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('episodes')}
                  className={`w-full rounded-xl border-2 p-3 text-left transition-all ${
                    selectedOption === 'episodes'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                        selectedOption === 'episodes' ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-300'
                      }`}>
                        {selectedOption === 'episodes' && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="font-medium text-zinc-900 text-sm">Episodes Only</span>
                    </div>
                    <span className="font-bold text-zinc-900">${episodesOnlyPrice?.toLocaleString()}</span>
                  </div>
                </button>
              </div>

              {/* Premium Add-ons Section */}
              <div className="mt-4 border-t border-zinc-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddons(!showAddons)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span className="text-sm font-semibold text-zinc-900">Add-ons</span>
                    {selectedAddons.size > 0 && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {selectedAddons.size} selected
                      </span>
                    )}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-zinc-400 transition-transform ${showAddons ? 'rotate-180' : ''}`} />
                </button>

                {showAddons && (
                  <div className="mt-3 space-y-2">
                    {premiumCapabilities.map((addon) => {
                      const isCompatible = isAddonCompatible(addon);
                      const isSelected = selectedAddons.has(addon.slug);

                      return (
                        <button
                          key={addon.slug}
                          type="button"
                          onClick={() => isCompatible && toggleAddon(addon.slug)}
                          disabled={!isCompatible}
                          className={`w-full rounded-lg border p-2.5 text-left transition-all ${
                            !isCompatible
                              ? 'cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-50'
                              : isSelected
                              ? 'border-amber-400 bg-amber-50'
                              : 'border-zinc-200 hover:border-amber-300 hover:bg-amber-50/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                                isSelected ? 'border-amber-500 bg-amber-500' : 'border-zinc-300'
                              }`}>
                                {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                              </div>
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-zinc-100 text-zinc-500">
                                {capabilityIconMap[addon.icon] ? (
                                  <div className="scale-75">{capabilityIconMap[addon.icon]}</div>
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                              </div>
                              <span className="text-xs font-medium text-zinc-800 truncate">{addon.shortTitle}</span>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 shrink-0">{addon.priceDisplay}</span>
                          </div>
                          {!isCompatible && (
                            <p className="mt-1 ml-6 flex items-center gap-1 text-[10px] text-zinc-400">
                              <Info className="h-3 w-3" />
                              {addon.requiresScene && selectedOption === 'episodes' && 'Requires scene purchase'}
                              {addon.requiresEpisodes && selectedOption === 'scene' && 'Requires episodes purchase'}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Order Summary */}
              <div className="mt-4 border-t border-zinc-100 pt-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600">
                    {selectedOption === 'bundle' ? 'Scene + Episodes' : selectedOption === 'scene' ? 'Scene Only' : 'Episodes Only'}
                  </span>
                  <span className="font-medium text-zinc-900">${basePrice?.toLocaleString()}</span>
                </div>
                {selectedAddons.size > 0 && (
                  <>
                    {Array.from(selectedAddons).map(slug => {
                      const addon = premiumCapabilities.find(c => c.slug === slug);
                      if (!addon) return null;
                      return (
                        <div key={slug} className="flex items-center justify-between text-sm">
                          <span className="text-zinc-600">{addon.shortTitle}</span>
                          <span className="font-medium text-zinc-900">+${addon.price.toLocaleString()}</span>
                        </div>
                      );
                    })}
                    <div className="border-t border-zinc-100 pt-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-zinc-900">Total</span>
                        <span className="text-xl font-bold text-zinc-900">${totalPrice?.toLocaleString()}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-600 disabled:opacity-60"
                onClick={handleCheckout}
                disabled={isRedirecting}
              >
                <ShoppingCart className="h-4 w-4" />
                {isRedirecting
                  ? "Redirecting..."
                  : `Buy Now — $${totalPrice?.toLocaleString()}`}
              </button>
            </div>

            {/* What's Included Card */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                {selectedOption === 'bundle' ? 'Bundle includes' : selectedOption === 'scene' ? 'Scene includes' : 'Episodes include'}
              </p>
              <div className="space-y-1.5">
                {(selectedOption === 'bundle' || selectedOption === 'scene') && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span>{variationCount?.toLocaleString()} scene variations</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span>USD format with physics metadata</span>
                    </div>
                  </>
                )}
                {(selectedOption === 'bundle' || selectedOption === 'episodes') && (
                  <>
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span>{episodeCount?.toLocaleString()} AI-generated episodes</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-600">
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span>LeRobot-compatible format</span>
                    </div>
                  </>
                )}
                {selectedAddons.size > 0 && (
                  <div className="border-t border-zinc-100 pt-2 mt-2 space-y-1.5">
                    {Array.from(selectedAddons).map(slug => {
                      const addon = premiumCapabilities.find(c => c.slug === slug);
                      if (!addon) return null;
                      return (
                        <div key={slug} className="flex items-start gap-2 text-xs text-zinc-600">
                          <Check className="h-3 w-3 text-amber-500 mt-0.5" />
                          <span>{addon.title}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <Shield className="h-4 w-4" /> SimReady checklist
              </div>
              <ul className="space-y-1.5 text-xs text-zinc-600">
                <li>• Validated articulation for doors, drawers, and mechanical limits.</li>
                <li>• Semantic labels aligned with policies: {marketplaceItem.policySlugs.join(", ") || "customizable"}.</li>
                <li>
                  • Delivered formats: {deliverables.join(", ") || "USD / on request"}.
                </li>
              </ul>
              <div className="flex flex-wrap gap-1.5">
                {marketplaceItem.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700"
                  >
                    <Tag className="h-2.5 w-2.5" /> {tag}
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
      </>
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
          The environment you are looking for isn't in our network yet. Browse other scenes or contact us to request a custom build.
        </p>
        <a
          href="/marketplace"
          className="mt-6 inline-flex rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
        >
          Back to Marketplace
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

  const sceneImage = scene.thumb.startsWith("/") ? `https://tryblueprint.io${scene.thumb}` : scene.thumb;

  return (
    <>
      <Helmet>
        <title>{scene.title} | Blueprint Marketplace</title>
        <meta name="description" content={scene.seo} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={`https://tryblueprint.io/marketplace/${scene.slug}`} />
        <meta property="og:title" content={`${scene.title} | Blueprint`} />
        <meta property="og:description" content={scene.seo} />
        <meta property="og:image" content={sceneImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${scene.title} | Blueprint`} />
        <meta name="twitter:description" content={scene.seo} />
        <link rel="canonical" href={`https://tryblueprint.io/marketplace/${scene.slug}`} />
      </Helmet>
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
    </>
  );
}
