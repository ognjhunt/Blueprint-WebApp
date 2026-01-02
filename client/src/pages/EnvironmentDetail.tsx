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
} from "@/data/content";
import { InteractionBadges } from "@/components/site/InteractionBadges";
import { SpecList } from "@/components/site/SpecList";
import { SceneCard } from "@/components/site/SceneCard";
import {
  ArrowLeft,
  Box,
  Brain,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Hand,
  Layers,
  MessageSquare,
  Move,
  Package,
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

  // Scroll to top when navigating to this page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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

    // Get pricing based on selected option
    const getPriceForOption = () => {
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
    };

    const optionLabels: Record<PurchaseOption, string> = {
      bundle: 'Scene + Episodes Bundle',
      scene: 'Scene Only',
      episodes: 'Episodes Only',
    };

    const checkoutItem = isDataset
      ? {
          sku: `${marketplaceDataset!.slug}-${selectedOption}`,
          title: `${marketplaceDataset!.title} (${optionLabels[selectedOption]})`,
          description: marketplaceDataset!.description,
          price: getPriceForOption(),
          quantity: 1,
          itemType: "dataset" as const,
        }
      : {
          sku: `${marketplaceScene!.slug}-${selectedOption}`,
          title: `${marketplaceScene!.title} (${optionLabels[selectedOption]})`,
          description: marketplaceScene!.description,
          price: getPriceForOption(),
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
  }, [detailSlug, isDataset, isRedirecting, marketplaceDataset, marketplaceItem, marketplaceScene, selectedOption]);

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
          <title>{marketplaceItem.title} | Blueprint Environments</title>
          <meta
            name="description"
            content={marketplaceItem.description}
          />
          <meta name="robots" content="index, follow" />
          <meta property="og:type" content="product" />
          <meta property="og:url" content={`https://tryblueprint.io/environments/${detailSlug}`} />
          <meta property="og:title" content={`${marketplaceItem.title} | Blueprint`} />
          <meta property="og:description" content={marketplaceItem.description} />
          <meta
            property="og:image"
            content={heroImage.startsWith("/") ? `https://tryblueprint.io${heroImage}` : heroImage}
          />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={`${marketplaceItem.title} | Blueprint`} />
          <meta name="twitter:description" content={marketplaceItem.description} />
          <link rel="canonical" href={`https://tryblueprint.io/environments/${detailSlug}`} />
          <script type="application/ld+json">
            {JSON.stringify(productStructuredData)}
          </script>
        </Helmet>
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
              <div className="space-y-3">
                {/* Bundle Option - Best Value */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('bundle')}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    selectedOption === 'bundle'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          selectedOption === 'bundle' ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-300'
                        }`}>
                          {selectedOption === 'bundle' && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <span className="font-semibold text-zinc-900">Scene + Episodes Bundle</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          SAVE {bundleSavingsPercent}%
                        </span>
                      </div>
                      <p className="mt-1 ml-7 text-xs text-zinc-500">
                        Complete training package: {variationCount?.toLocaleString()} variations + {episodeCount?.toLocaleString()} AI-generated episodes
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-zinc-900">${bundlePrice?.toLocaleString()}</span>
                      <p className="text-xs text-zinc-400 line-through">${separateTotal.toLocaleString()}</p>
                    </div>
                  </div>
                </button>

                {/* Scene Only Option */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('scene')}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    selectedOption === 'scene'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          selectedOption === 'scene' ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-300'
                        }`}>
                          {selectedOption === 'scene' && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <Layers className="h-4 w-4 text-zinc-400" />
                        <span className="font-semibold text-zinc-900">Scene Only</span>
                      </div>
                      <p className="mt-1 ml-7 text-xs text-zinc-500">
                        {variationCount?.toLocaleString()} variations • Generate your own episodes
                      </p>
                    </div>
                    <span className="text-xl font-bold text-zinc-900">${sceneOnlyPrice?.toLocaleString()}</span>
                  </div>
                </button>

                {/* Episodes Only Option */}
                <button
                  type="button"
                  onClick={() => setSelectedOption('episodes')}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    selectedOption === 'episodes'
                      ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/20'
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                          selectedOption === 'episodes' ? 'border-indigo-500 bg-indigo-500' : 'border-zinc-300'
                        }`}>
                          {selectedOption === 'episodes' && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <Play className="h-4 w-4 text-zinc-400" />
                        <span className="font-semibold text-zinc-900">Episodes Only</span>
                      </div>
                      <p className="mt-1 ml-7 text-xs text-zinc-500">
                        {episodeCount?.toLocaleString()} AI-generated trajectories • Requires scene ownership
                      </p>
                    </div>
                    <span className="text-xl font-bold text-zinc-900">${episodesOnlyPrice?.toLocaleString()}</span>
                  </div>
                </button>
              </div>

              {/* What's Included */}
              <div className="mt-4 rounded-xl bg-zinc-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
                  {selectedOption === 'bundle' ? 'Bundle includes' : selectedOption === 'scene' ? 'Scene includes' : 'Episodes include'}
                </p>
                <div className="space-y-1.5">
                  {(selectedOption === 'bundle' || selectedOption === 'scene') && (
                    <>
                      <div className="flex items-center gap-2 text-xs text-zinc-600">
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span>{variationCount?.toLocaleString()} scene variations (domain randomization)</span>
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
                        <span>{episodeCount?.toLocaleString()} AI-generated episodes (Gemini)</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-600">
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span>LeRobot-compatible trajectory format</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <button
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-600 disabled:opacity-60"
                onClick={handleCheckout}
                disabled={isRedirecting}
              >
                <ShoppingCart className="h-4 w-4" />
                {isRedirecting
                  ? "Redirecting..."
                  : `Buy ${selectedOption === 'bundle' ? 'Bundle' : selectedOption === 'scene' ? 'Scene' : 'Episodes'} — $${
                      selectedOption === 'bundle' ? bundlePrice?.toLocaleString() :
                      selectedOption === 'scene' ? sceneOnlyPrice?.toLocaleString() :
                      episodesOnlyPrice?.toLocaleString()
                    }`}
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

        {/* Premium Add-ons Section */}
        <section className="space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              <h2 className="text-2xl font-semibold text-zinc-900">Premium Add-ons</h2>
            </div>
            <p className="text-zinc-600">
              Enhance your training data with these optional capabilities. Contact us to add any of these to your order.
            </p>
          </div>

          {/* High-Impact Add-ons */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                High-Impact
              </span>
              <span className="text-sm text-zinc-500">Immediate value upgrades</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {premiumCapabilities
                .filter((c) => c.tier === "immediate")
                .map((capability) => (
                  <div
                    key={capability.slug}
                    className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                          {capabilityIconMap[capability.icon] || <Sparkles className="h-5 w-5" />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-zinc-900">{capability.title}</h3>
                          <p className="text-sm font-medium text-emerald-600">{capability.priceRange}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-zinc-600">{capability.description}</p>
                    <ul className="space-y-1.5">
                      {capability.benefits.slice(0, 3).map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2 text-xs text-zinc-600">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>

          {/* Strategic Capabilities */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                Strategic
              </span>
              <span className="text-sm text-zinc-500">Advanced training features</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
              {premiumCapabilities
                .filter((c) => c.tier === "strategic")
                .map((capability) => (
                  <div
                    key={capability.slug}
                    className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
                      {capabilityIconMap[capability.icon] || <Sparkles className="h-4 w-4" />}
                    </div>
                    <h3 className="font-semibold text-zinc-900 text-sm">{capability.shortTitle}</h3>
                    <p className="text-xs font-medium text-emerald-600">{capability.priceRange}</p>
                    <p className="text-xs text-zinc-500 line-clamp-3">{capability.description}</p>
                  </div>
                ))}
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-center">
            <p className="text-sm text-zinc-600 mb-3">
              Interested in adding premium capabilities to this scene?
            </p>
            <a
              href={`/contact?scene=${detailSlug}&interest=premium-addons`}
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Contact Us About Add-ons
              <ChevronRight className="h-4 w-4" />
            </a>
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

  const sceneImage = scene.thumb.startsWith("/") ? `https://tryblueprint.io${scene.thumb}` : scene.thumb;

  return (
    <>
      <Helmet>
        <title>{scene.title} | Blueprint Environments</title>
        <meta name="description" content={scene.seo} />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="product" />
        <meta property="og:url" content={`https://tryblueprint.io/environments/${scene.slug}`} />
        <meta property="og:title" content={`${scene.title} | Blueprint`} />
        <meta property="og:description" content={scene.seo} />
        <meta property="og:image" content={sceneImage} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${scene.title} | Blueprint`} />
        <meta name="twitter:description" content={scene.seo} />
        <link rel="canonical" href={`https://tryblueprint.io/environments/${scene.slug}`} />
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
