import { useMemo, useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet";
import { useLocation, useSearch } from "wouter";
import {
  environmentPolicies,
  marketplaceScenes,
  trainingDatasets,
  type MarketplaceScene,
  type TrainingDataset,
} from "@/data/content";
import { MarketplaceCard } from "@/components/site/MarketplaceCard";
import { analyticsEvents } from "@/components/Analytics";
import { useAuth } from "@/contexts/AuthContext";
import { useMarketplacePersonalization } from "@/hooks/useMarketplacePersonalization";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import {
  Search,
  Filter,
  MapPin,
  Box,
  Shield,
  Database,
  Calendar,
  Layers,
  CheckCircle,
  XCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
} from "lucide-react";

// --- Types ---

type MarketplaceItemType = "all" | "scenes" | "training";

type MarketplaceItem =
  | { type: "scene"; data: MarketplaceScene }
  | { type: "training"; data: TrainingDataset };

// --- Configuration ---

const sortOptions = [
  { label: "Newest drops", value: "newest" },
  { label: "Price: Low → High", value: "price-asc" },
  { label: "Price: High → Low", value: "price-desc" },
  { label: "Most scenes", value: "scene-desc" },
];

const itemTypeOptions: Array<{ label: string; value: MarketplaceItemType }> = [
  { label: "All Items", value: "all" },
  { label: "Scene Library", value: "scenes" },
  { label: "Dataset Packs", value: "training" },
];

// Combine location types from all item types
const locationOptions = Array.from(
  new Set([
    ...marketplaceScenes.map((s) => s.locationType),
    ...trainingDatasets.map((t) => t.locationType),
  ])
).sort();

const objectOptions = Array.from(
  new Set([
    ...marketplaceScenes.flatMap((s) => s.objectTags),
    ...trainingDatasets.flatMap((t) => t.objectTags),
  ])
).sort();

const policyFilters = environmentPolicies.map((policy) => ({
  label: policy.title,
  value: policy.slug,
}));

// Calculate stats
const newestRelease = [...marketplaceScenes, ...trainingDatasets].reduce<
  string | null
>((latest, item) => {
  if (!latest) return item.releaseDate;
  return new Date(item.releaseDate) > new Date(latest)
    ? item.releaseDate
    : latest;
}, null);

const totalScenes = marketplaceScenes.length;

const totalEpisodes = trainingDatasets.reduce(
  (sum, dataset) => sum + dataset.episodeCount,
  0
);

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

// --- Checkout Notification Component ---
function CheckoutNotification({
  type,
  onClose,
}: {
  type: "success" | "cancel";
  onClose: () => void;
}) {
  const isSuccess = type === "success";

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4 rounded-xl border shadow-lg backdrop-blur-sm ${
        isSuccess
          ? "bg-emerald-50/95 border-emerald-200"
          : "bg-amber-50/95 border-amber-200"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 rounded-full p-1 ${
              isSuccess ? "bg-emerald-100" : "bg-amber-100"
            }`}
          >
            {isSuccess ? (
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            ) : (
              <XCircle className="h-5 w-5 text-amber-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className={`text-sm font-semibold ${
                isSuccess ? "text-emerald-900" : "text-amber-900"
              }`}
            >
              {isSuccess ? "Purchase Successful!" : "Checkout Cancelled"}
            </h3>
            <p
              className={`mt-1 text-sm ${
                isSuccess ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {isSuccess
                ? "Thank you for your purchase! You will receive a confirmation email with download instructions shortly."
                : "Your checkout was cancelled. No charges were made. Feel free to browse and try again when you're ready."}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`flex-shrink-0 rounded-lg p-1 transition-colors ${
              isSuccess
                ? "hover:bg-emerald-100 text-emerald-500"
                : "hover:bg-amber-100 text-amber-500"
            }`}
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

const ITEMS_PER_PAGE = 12;

// --- Personalized Welcome Banner ---
function PersonalizedWelcomeBanner({
  firstName,
  welcomeMessage,
  onDismiss,
  onExplore,
}: {
  firstName: string;
  welcomeMessage: string | null;
  onDismiss: () => void;
  onExplore: () => void;
}) {
  if (!welcomeMessage) return null;

  return (
    <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 rounded-full bg-emerald-100 p-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-medium text-emerald-900">
              Hi {firstName || "there"}!
            </h3>
            <p className="mt-0.5 text-sm text-emerald-700">{welcomeMessage}</p>
            <button
              onClick={onExplore}
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              View Recommended
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded-lg p-1 text-emerald-400 hover:bg-emerald-100 hover:text-emerald-600"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function Environments() {
  // --- State ---
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [checkoutStatus, setCheckoutStatus] = useState<"success" | "cancel" | null>(null);

  // --- Personalization ---
  const { currentUser } = useAuth();
  const { personalization, dismissWelcomeBanner } = useMarketplacePersonalization();
  const { markStepComplete } = useOnboardingProgress();

  // Track marketplace exploration on mount
  useEffect(() => {
    if (currentUser?.uid) {
      markStepComplete("exploreMarketplace").catch(console.error);
    }
  }, [currentUser?.uid, markStepComplete]);

  // Handle welcome banner dismiss
  const handleDismissWelcome = useCallback(() => {
    dismissWelcomeBanner();
  }, [dismissWelcomeBanner]);

  // Handle explore recommended click
  const handleExploreRecommended = useCallback(() => {
    dismissWelcomeBanner();
    // Scroll to results
    window.scrollTo({ top: 400, behavior: "smooth" });
  }, [dismissWelcomeBanner]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemTypeFilter, setItemTypeFilter] =
    useState<MarketplaceItemType>("all");
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [policyFilter, setPolicyFilter] = useState<string | null>(null);
  const [objectFiltersSelection, setObjectFiltersSelection] = useState<
    string[]
  >([]);
  const [sortOption, setSortOption] = useState<string>("newest");
  const [searchQuery, setSearchQuery] = useState("");

  // --- Initialize filters from URL ---
  useEffect(() => {
    const params = new URLSearchParams(searchString);

    const type = params.get("type");
    // Redirect old benchmark packs URL to benchmarks page
    if (type === "datasets") {
      window.location.href = "/benchmarks";
      return;
    }
    if (type === "scenes" || type === "training") {
      setItemTypeFilter(type);
    }

    const location = params.get("location");
    if (location) {
      setLocationFilter(location);
    }

    const policy = params.get("policy");
    if (policy) {
      setPolicyFilter(policy);
    }

    const sort = params.get("sort");
    if (sort && ["newest", "price-asc", "price-desc", "scene-desc"].includes(sort)) {
      setSortOption(sort);
    }

    const q = params.get("q");
    if (q) {
      setSearchQuery(q);
    }

    const page = params.get("page");
    if (page) {
      const pageNum = parseInt(page, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        setCurrentPage(pageNum);
      }
    }
  }, []); // Only run once on mount

  // --- Sync filters to URL ---
  const updateUrlWithFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchString);

    // Preserve checkout status if present
    const checkout = params.get("checkout");

    // Clear existing filter params
    params.delete("type");
    params.delete("location");
    params.delete("policy");
    params.delete("sort");
    params.delete("q");
    params.delete("page");

    // Restore checkout if needed
    if (checkout) {
      params.set("checkout", checkout);
    }

    // Apply current state
    if (itemTypeFilter !== "all") params.set("type", itemTypeFilter);
    if (locationFilter) params.set("location", locationFilter);
    if (policyFilter) params.set("policy", policyFilter);
    if (sortOption !== "newest") params.set("sort", sortOption);
    if (searchQuery) params.set("q", searchQuery);
    if (currentPage > 1) params.set("page", String(currentPage));

    // Apply updates
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    const newSearch = params.toString();
    setLocation(`/marketplace${newSearch ? `?${newSearch}` : ""}`, { replace: true });
  };

  // Filter change handlers with URL sync
  const handleTypeFilterChange = (type: MarketplaceItemType) => {
    setItemTypeFilter(type);
    setCurrentPage(1);
    updateUrlWithFilters({ type: type === "all" ? null : type, page: null });
  };

  const handleLocationFilterChange = (location: string | null) => {
    setLocationFilter(location);
    setCurrentPage(1);
    updateUrlWithFilters({ location, page: null });
  };

  const handlePolicyFilterChange = (policy: string | null) => {
    setPolicyFilter(policy);
    setCurrentPage(1);
    updateUrlWithFilters({ policy, page: null });
  };

  const handleSortChange = (sort: string) => {
    setSortOption(sort);
    updateUrlWithFilters({ sort: sort === "newest" ? null : sort });
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
    // Debounce URL update for search
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateUrlWithFilters({ page: page === 1 ? null : String(page) });
    // Scroll to top of results
    window.scrollTo({ top: 400, behavior: "smooth" });
  };

  // --- Handle Checkout Redirect ---
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const checkout = params.get("checkout");

    if (checkout === "success" || checkout === "cancel") {
      setCheckoutStatus(checkout);

      // Track analytics
      if (checkout === "success") {
        analyticsEvents.completeCheckout("marketplace", 0);
      }

      // Clear the query param from URL without page reload
      params.delete("checkout");
      const newSearch = params.toString();
      setLocation(`/marketplace${newSearch ? `?${newSearch}` : ""}`, { replace: true });

      // Auto-dismiss after 10 seconds for success, 8 for cancel
      const timeout = setTimeout(() => {
        setCheckoutStatus(null);
      }, checkout === "success" ? 10000 : 8000);

      return () => clearTimeout(timeout);
    }
  }, [searchString, setLocation]);

  // --- Logic ---

  // Combine scenes and training datasets into unified marketplace items
  const allMarketplaceItems = useMemo<MarketplaceItem[]>(() => {
    const items: MarketplaceItem[] = [];

    marketplaceScenes.forEach((scene) => {
      items.push({ type: "scene", data: scene });
    });

    trainingDatasets.forEach((training) => {
      items.push({ type: "training", data: training });
    });

    return items;
  }, []);

  const filteredItems = useMemo(() => {
    let result = allMarketplaceItems.slice();

    // Filter by item type
    if (itemTypeFilter === "scenes") {
      result = result.filter((item) => item.type === "scene");
    } else if (itemTypeFilter === "training") {
      result = result.filter((item) => item.type === "training");
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
          const priceA = a.data.price;
          const priceB = b.data.price;
          return priceA - priceB;
        });
        break;
      case "price-desc":
        result.sort((a, b) => {
          const priceA = a.data.price;
          const priceB = b.data.price;
          return priceB - priceA;
        });
        break;
      case "scene-desc":
        result.sort((a, b) => {
          const countA =
            a.type === "training" ? (a.data as TrainingDataset).episodeCount / 1000 : 1;
          const countB =
            b.type === "training" ? (b.data as TrainingDataset).episodeCount / 1000 : 1;
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
      .filter((item) => item.data.isFeatured)
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

  // --- Pagination ---
  const totalPages = Math.ceil(regularItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return regularItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [regularItems, currentPage]);

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

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
        price: item.data.price,
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
      },
    }));

    return {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Blueprint Marketplace",
      description: "SimReady scenes and training datasets for robotics. Isaac-ready USD packages with randomizers and task logic.",
      url: "https://tryblueprint.io/marketplace",
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
      {/* Checkout Notification */}
      {checkoutStatus && (
        <CheckoutNotification
          type={checkoutStatus}
          onClose={() => setCheckoutStatus(null)}
        />
      )}

      <Helmet>
        <title>Marketplace | Blueprint - Scene Library & Dataset Packs</title>
        <meta
          name="description"
          content="Browse SimReady scenes and training datasets for robotics. Isaac-ready USD packages with physics, articulation, and task logic for policy training."
        />
        <meta name="robots" content="index, follow" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://tryblueprint.io/marketplace" />
        <meta property="og:title" content="Marketplace | Blueprint" />
        <meta
          property="og:description"
          content="SimReady scenes and training datasets for robotics. Isaac-ready USD packages with physics and articulation."
        />
        <meta property="og:image" content="https://tryblueprint.io/images/Gemini_EnvironentsBanner.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Marketplace | Blueprint" />
        <meta
          name="twitter:description"
          content="SimReady scenes and datasets for robotics. Isaac-ready USD packages for policy training."
        />
        <meta name="twitter:image" content="https://tryblueprint.io/images/Gemini_EnvironentsBanner.png" />
        <link rel="canonical" href="https://tryblueprint.io/marketplace" />
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
              Marketplace
            </div>

            <div className="max-w-4xl">
              <h1 className="text-4xl font-bold tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                Scene Library & Dataset Packs
              </h1>
              <p className="mt-6 max-w-2xl text-lg text-zinc-600">
                SimReady scenes and training datasets for robotics policy development.
                Each item includes physics-accurate USD scenes with articulation, collision
                meshes, and domain randomization. Browse scenes for custom training pipelines
                or grab dataset packs with pre-generated trajectories.
              </p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center gap-6 rounded-xl border border-zinc-200 bg-white/50 px-6 py-4 text-sm text-zinc-600 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </div>
              <span className="font-medium text-zinc-900">
                {marketplaceScenes.length}
              </span>
              scenes
            </div>
            <div className="h-4 w-px bg-zinc-300" />
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-zinc-400" />
              <span className="font-medium text-zinc-900">
                {trainingDatasets.length}
              </span>
              dataset packs
            </div>
            <div className="h-4 w-px bg-zinc-300" />
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-zinc-400" />
              <span className="font-medium text-zinc-900">
                {(totalEpisodes / 1000).toFixed(0)}K
              </span>
              episodes
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

        {/* --- Personalized Welcome Banner --- */}
        {personalization.showWelcomeBanner && (
          <PersonalizedWelcomeBanner
            firstName={personalization.firstName}
            welcomeMessage={personalization.welcomeMessage}
            onDismiss={handleDismissWelcome}
            onExplore={handleExploreRecommended}
          />
        )}

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
          {/* Results count and pagination info */}
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <p>
              {regularItems.length > ITEMS_PER_PAGE ? (
                <>
                  Showing{" "}
                  <span className="font-medium text-zinc-900">
                    {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, regularItems.length)}
                  </span>
                  {" - "}
                  <span className="font-medium text-zinc-900">
                    {Math.min(currentPage * ITEMS_PER_PAGE, regularItems.length)}
                  </span>
                  {" of "}
                  <span className="font-medium text-zinc-900">
                    {regularItems.length}
                  </span>{" "}
                </>
              ) : (
                <>
                  Showing{" "}
                  <span className="font-medium text-zinc-900">
                    {filteredItems.length}
                  </span>{" "}
                </>
              )}
              {itemTypeFilter === "all"
                ? "items"
                : itemTypeFilter === "training"
                ? "dataset packs"
                : "scenes"}
            </p>
            {totalPages > 1 && (
              <p className="text-zinc-400">
                Page {currentPage} of {totalPages}
              </p>
            )}
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
                      Featured Items
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
                  {paginatedItems.map((item) => (
                    <MarketplaceCard
                      key={item.data.slug}
                      item={item.data}
                      type={item.type}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <nav
                    className="flex items-center justify-center gap-2 pt-8"
                    aria-label="Pagination"
                  >
                    {/* Previous Button */}
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        currentPage === 1
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-300"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300"
                      }`}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </button>

                    {/* Page Numbers */}
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          // Show first, last, current, and pages around current
                          if (page === 1 || page === totalPages) return true;
                          if (Math.abs(page - currentPage) <= 1) return true;
                          return false;
                        })
                        .map((page, index, arr) => {
                          // Add ellipsis between gaps
                          const prevPage = arr[index - 1];
                          const showEllipsis = prevPage && page - prevPage > 1;

                          return (
                            <span key={page} className="flex items-center">
                              {showEllipsis && (
                                <span className="px-2 text-zinc-400">...</span>
                              )}
                              <button
                                onClick={() => handlePageChange(page)}
                                className={`min-w-[40px] rounded-lg px-3 py-2 text-sm font-medium transition ${
                                  currentPage === page
                                    ? "bg-zinc-900 text-white"
                                    : "text-zinc-600 hover:bg-zinc-100"
                                }`}
                                aria-label={`Page ${page}`}
                                aria-current={currentPage === page ? "page" : undefined}
                              >
                                {page}
                              </button>
                            </span>
                          );
                        })}
                    </div>

                    {/* Next Button */}
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                        currentPage === totalPages
                          ? "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-300"
                          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300"
                      }`}
                      aria-label="Next page"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </nav>
                )}
              </section>
            </>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
