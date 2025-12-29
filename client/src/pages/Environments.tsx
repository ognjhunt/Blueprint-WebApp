import { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import {
  environmentPolicies,
  syntheticDatasets,
  marketplaceScenes,
  type SyntheticDataset,
  type MarketplaceScene,
} from "@/data/content";
import { MarketplaceCard } from "@/components/site/MarketplaceCard";
import {
  Search,
  Filter,
  MapPin,
  Box,
  Shield,
  Database,
  Calendar,
  Layers,
} from "lucide-react";

// --- Types ---

type MarketplaceItemType = "all" | "datasets" | "scenes";

type MarketplaceItem =
  | { type: "dataset"; data: SyntheticDataset }
  | { type: "scene"; data: MarketplaceScene };

// --- Configuration ---

const sortOptions = [
  { label: "Newest drops", value: "newest" },
  { label: "Price: Low → High", value: "price-asc" },
  { label: "Price: High → Low", value: "price-desc" },
  { label: "Most scenes", value: "scene-desc" },
];

const itemTypeOptions: Array<{ label: string; value: MarketplaceItemType }> = [
  { label: "All Items", value: "all" },
  { label: "Dataset Bundles", value: "datasets" },
  { label: "Single Scenes", value: "scenes" },
];

// Combine location types from both datasets and scenes
const locationOptions = Array.from(
  new Set([
    ...syntheticDatasets.map((d) => d.locationType),
    ...marketplaceScenes.map((s) => s.locationType),
  ])
).sort();

const objectOptions = Array.from(
  new Set([
    ...syntheticDatasets.flatMap((d) => d.objectTags),
    ...marketplaceScenes.flatMap((s) => s.objectTags),
  ])
).sort();

const policyFilters = environmentPolicies.map((policy) => ({
  label: policy.title,
  value: policy.slug,
}));

// Calculate stats
const newestRelease = [...syntheticDatasets, ...marketplaceScenes].reduce<
  string | null
>((latest, item) => {
  if (!latest) return item.releaseDate;
  return new Date(item.releaseDate) > new Date(latest)
    ? item.releaseDate
    : latest;
}, null);

const totalScenes = syntheticDatasets.reduce(
  (sum, dataset) => sum + dataset.sceneCount,
  0
) + marketplaceScenes.length;

// --- Visual Helpers ---

function DotPattern() {
  return (
    <svg
      className="absolute inset-0 -z-10 h-full w-full stroke-zinc-200 [mask-image:radial-gradient(100%_100%_at_top_right,white,transparent)]"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="grid-pattern"
          width={40}
          height={40}
          x="50%"
          y={-1}
          patternUnits="userSpaceOnUse"
        >
          <path d="M.5 40V.5H40" fill="none" />
        </pattern>
      </defs>
      <rect
        width="100%"
        height="100%"
        strokeWidth={0}
        fill="url(#grid-pattern)"
      />
    </svg>
  );
}

export default function Environments() {
  // --- State ---
  const [itemTypeFilter, setItemTypeFilter] =
    useState<MarketplaceItemType>("all");
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [policyFilter, setPolicyFilter] = useState<string | null>(null);
  const [objectFiltersSelection, setObjectFiltersSelection] = useState<
    string[]
  >([]);
  const [sortOption, setSortOption] = useState<string>("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [bannerLoaded, setBannerLoaded] = useState(false);

  // --- Logic ---

  // Combine datasets and scenes into unified marketplace items
  const allMarketplaceItems = useMemo<MarketplaceItem[]>(() => {
    const items: MarketplaceItem[] = [];

    syntheticDatasets.forEach((dataset) => {
      items.push({ type: "dataset", data: dataset });
    });

    marketplaceScenes.forEach((scene) => {
      items.push({ type: "scene", data: scene });
    });

    return items;
  }, []);

  const filteredItems = useMemo(() => {
    let result = allMarketplaceItems.slice();

    // Filter by item type
    if (itemTypeFilter === "datasets") {
      result = result.filter((item) => item.type === "dataset");
    } else if (itemTypeFilter === "scenes") {
      result = result.filter((item) => item.type === "scene");
    }

    // Filter by location
    if (locationFilter) {
      result = result.filter(
        (item) => item.data.locationType === locationFilter
      );
    }

    // Filter by policy
    if (policyFilter) {
      result = result.filter((item) =>
        item.data.policySlugs.includes(policyFilter)
      );
    }

    // Filter by objects
    if (objectFiltersSelection.length > 0) {
      result = result.filter((item) =>
        objectFiltersSelection.every((objectTag) =>
          item.data.objectTags.includes(objectTag)
        )
      );
    }

    // Search filter
    const normalizedSearchQuery = searchQuery.trim().toLowerCase();
    if (normalizedSearchQuery) {
      result = result.filter((item) => {
        const searchableString = [
          item.data.title,
          item.data.description,
          item.data.locationType,
          item.data.objectTags.join(" "),
          item.data.policySlugs.join(" "),
          item.data.tags.join(" "),
        ]
          .join(" ")
          .toLowerCase();

        return searchableString.includes(normalizedSearchQuery);
      });
    }

    // Sort
    switch (sortOption) {
      case "price-asc":
        result.sort((a, b) => {
          const priceA =
            a.type === "dataset" ? a.data.pricePerScene : a.data.price;
          const priceB =
            b.type === "dataset" ? b.data.pricePerScene : b.data.price;
          return priceA - priceB;
        });
        break;
      case "price-desc":
        result.sort((a, b) => {
          const priceA =
            a.type === "dataset" ? a.data.pricePerScene : a.data.price;
          const priceB =
            b.type === "dataset" ? b.data.pricePerScene : b.data.price;
          return priceB - priceA;
        });
        break;
      case "scene-desc":
        result.sort((a, b) => {
          const countA =
            a.type === "dataset" ? a.data.sceneCount : 1;
          const countB =
            b.type === "dataset" ? b.data.sceneCount : 1;
          return countB - countA;
        });
        break;
      case "newest":
      default:
        result.sort(
          (a, b) =>
            new Date(b.data.releaseDate).getTime() -
            new Date(a.data.releaseDate).getTime()
        );
        break;
    }

    return result;
  }, [
    allMarketplaceItems,
    itemTypeFilter,
    locationFilter,
    policyFilter,
    objectFiltersSelection,
    sortOption,
    searchQuery,
  ]);

  // Featured items (show at top)
  const featuredItems = useMemo(() => {
    return filteredItems
      .filter((item) => item.data.isFeatured && item.type === "dataset")
      .slice(0, 3);
  }, [filteredItems]);

  const regularItems = useMemo(() => {
    // Show all items if featured section is hidden (due to filters)
    if (featuredItems.length === 0) {
      return filteredItems;
    }
    // Otherwise show non-featured items
    return filteredItems.filter(
      (item) => !featuredItems.some((f) => f.data.slug === item.data.slug)
    );
  }, [filteredItems, featuredItems]);

  const handleObjectToggle = (objectTag: string) => {
    setObjectFiltersSelection((prev) =>
      prev.includes(objectTag)
        ? prev.filter((tag) => tag !== objectTag)
        : [...prev, objectTag]
    );
  };

  // --- Structured Data for SEO ---
  const structuredData = useMemo(() => {
    const products = allMarketplaceItems.slice(0, 10).map((item) => ({
      "@type": "Product",
      name: item.data.title,
      description: item.data.description,
      offers: {
        "@type": "Offer",
        price: item.type === "dataset"
          ? (item.data as SyntheticDataset).pricePerScene * (item.data as SyntheticDataset).sceneCount
          : (item.data as MarketplaceScene).price,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    }));

    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Blueprint Environments Marketplace",
      description: "SimReady synthetic datasets and scenes for robotics training. Isaac-ready USD packages with randomizers and task logic.",
      url: "https://tryblueprint.io/environments",
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: allMarketplaceItems.length,
        itemListElement: products,
      },
    };
  }, [allMarketplaceItems]);

  // --- Render ---
  return (
    <>
      <Helmet>
        <title>Environments Marketplace | Blueprint - SimReady Datasets for Robotics</title>
        <meta
          name="description"
          content="Browse SimReady synthetic datasets and individual scenes for robotics training. Isaac-ready USD packages with randomizers, task logic, and validation notes."
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://tryblueprint.io/environments" />
        <meta property="og:title" content="Environments Marketplace | Blueprint" />
        <meta
          property="og:description"
          content="Browse SimReady synthetic datasets and individual scenes for robotics training. Daily drops with Isaac-ready USD packages."
        />
        <meta property="og:image" content="https://tryblueprint.io/images/Gemini_EnvironentsBanner.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Environments Marketplace | Blueprint" />
        <meta
          name="twitter:description"
          content="SimReady synthetic datasets for robotics. Isaac-ready USD packages with randomizers and task logic."
        />
        <meta name="twitter:image" content="https://tryblueprint.io/images/Gemini_EnvironentsBanner.png" />
        <link rel="canonical" href="https://tryblueprint.io/environments" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>
      <div className="relative min-h-screen bg-white font-sans text-zinc-900 selection:bg-indigo-100 selection:text-indigo-900">
        <DotPattern />

      <div className="mx-auto max-w-7xl space-y-12 px-4 pb-24 pt-16 sm:px-6 lg:px-8">
        {/* --- Header Section --- */}
        <header className="space-y-8">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50/50 px-3 py-1 text-xs font-medium uppercase tracking-wider text-indigo-600 backdrop-blur-sm">
              <Database className="h-3 w-3" />
              Synthetic Marketplace
            </div>

            <div className="max-w-4xl">
              <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                Plug-and-play SimReady datasets.
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-zinc-600">
                Daily drops of synthetic scenes authored for Isaac-ready
                training. Each dataset includes randomizer scripts, USD
                packages, task logic (actions, observations, rewards, resets,
                parallel env defaults), and validation notes so you can train
                without touching the pipeline.
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white/70 shadow-sm">
            {/* Skeleton loader for banner */}
            {!bannerLoaded && (
              <div className="aspect-[3/1] w-full animate-pulse bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 bg-[length:200%_100%]" />
            )}
            <img
              src="/images/Gemini_EnvironentsBanner.png"
              alt="SimReady marketplace archetypes mosaic"
              className={`w-full object-cover transition-opacity duration-300 ${
                bannerLoaded ? "opacity-100" : "opacity-0 absolute inset-0"
              }`}
              loading="lazy"
              onLoad={() => setBannerLoaded(true)}
            />
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center gap-6 rounded-xl border border-zinc-200 bg-white/50 px-6 py-4 text-sm text-zinc-600 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <span className="font-medium text-zinc-900">
                {syntheticDatasets.length}
              </span>
              active families
            </div>
            <div className="h-4 w-px bg-zinc-300" />
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-zinc-400" />
              <span className="font-medium text-zinc-900">
                {totalScenes.toLocaleString()}
              </span>
              total scenes
            </div>
            <div className="h-4 w-px bg-zinc-300" />
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-zinc-400" />
              <span className="font-medium text-zinc-900">
                {marketplaceScenes.length}
              </span>
              individual scenes
            </div>
            {newestRelease && (
              <>
                <div className="h-4 w-px bg-zinc-300" />
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-zinc-400" />
                  Latest drop:
                  <span className="font-medium text-zinc-900">
                    {new Date(newestRelease).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </>
            )}
          </div>
        </header>

        {/* --- Control Panel (Filters) --- */}
        <section className="rounded-3xl border border-zinc-200 bg-white/80 shadow-sm backdrop-blur-xl">
          <div className="border-b border-zinc-100 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* Search */}
              <div className="relative w-full md:max-w-sm">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search name, policy, or object..."
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
              </div>

              {/* Sort Options */}
              <div className="flex gap-1 rounded-lg border border-zinc-200 p-1">
                {sortOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSortOption(option.value)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      sortOption === option.value
                        ? "bg-zinc-900 text-white shadow-sm"
                        : "text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Item Type Filter */}
          <div className="border-b border-zinc-100 bg-zinc-50/50 px-6 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 mr-2">
                Type:
              </span>
              {itemTypeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setItemTypeFilter(option.value)}
                  className={`rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                    itemTypeFilter === option.value
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-px bg-zinc-100 md:grid-cols-3">
            {/* Location Filter */}
            <div className="bg-white p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                <MapPin className="h-3.5 w-3.5" />
                Archetype
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setLocationFilter(null)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    locationFilter === null
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-transparent bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                >
                  All
                </button>
                {locationOptions.map((location) => (
                  <button
                    key={location}
                    onClick={() => setLocationFilter(location)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      locationFilter === location
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300"
                    }`}
                  >
                    {location}
                  </button>
                ))}
              </div>
            </div>

            {/* Policy Filter */}
            <div className="bg-white p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-600">
                <Shield className="h-3.5 w-3.5" />
                Policy Target
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setPolicyFilter(null)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    policyFilter === null
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200"
                  }`}
                >
                  All
                </button>
                {policyFilters.map((policy) => (
                  <button
                    key={policy.value}
                    onClick={() =>
                      setPolicyFilter((prev) =>
                        prev === policy.value ? null : policy.value
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      policyFilter === policy.value
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-emerald-100 bg-emerald-50 text-emerald-700 hover:border-emerald-200"
                    }`}
                  >
                    {policy.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Object Filter */}
            <div className="bg-white p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400">
                <Box className="h-3.5 w-3.5" />
                Objects
              </div>
              <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-200">
                {objectOptions.map((objectTag) => (
                  <button
                    key={objectTag}
                    onClick={() => handleObjectToggle(objectTag)}
                    className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
                      objectFiltersSelection.includes(objectTag)
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300"
                    }`}
                  >
                    {objectTag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --- Results --- */}
        <div className="space-y-12">
          {/* Results count */}
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <p>
              Showing{" "}
              <span className="font-medium text-zinc-900">
                {filteredItems.length}
              </span>{" "}
              {itemTypeFilter === "all"
                ? "items"
                : itemTypeFilter === "datasets"
                ? "dataset bundles"
                : "individual scenes"}
            </p>
          </div>

          {filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 p-20 text-center">
              <div className="rounded-full bg-zinc-100 p-4 mb-4">
                <Filter className="h-6 w-6 text-zinc-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900">
                No items found
              </h3>
              <p className="mt-2 max-w-sm text-sm text-zinc-600">
                Try adjusting your filters or search query. Can't find what you
                need?
                <a
                  href="/contact"
                  className="ml-1 text-indigo-600 hover:underline"
                >
                  Request a custom capture.
                </a>
              </p>
            </div>
          ) : (
            <>
              {/* Featured Section */}
              {featuredItems.length > 0 && (
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-zinc-900">
                      ⭐ Featured Dataset Bundles
                    </h2>
                    <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                      Best Value
                    </span>
                  </div>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {featuredItems.map((item) => (
                      <MarketplaceCard
                        key={item.data.slug}
                        item={item.data}
                        type={item.type}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* All Items Grid */}
              <section className="space-y-6">
                {featuredItems.length > 0 && (
                  <h2 className="text-2xl font-bold text-zinc-900">
                    All Marketplace Items
                  </h2>
                )}
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {regularItems.map((item) => (
                    <MarketplaceCard
                      key={item.data.slug}
                      item={item.data}
                      type={item.type}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
