import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialSectionIntro,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { PlaceAutocompleteInput } from "@/components/site/PlaceAutocompleteInput";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import {
  categoryFilters,
  siteWorldCards,
  type SiteCategory,
} from "@/data/siteWorlds";
import {
  buildCatalogSearchSuggestions,
  CATALOG_EXAMPLE_QUERIES,
  classifyCatalogSearch,
  getCatalogLocationLabel,
  type CatalogResultType,
  type CatalogSearchClassification,
  type CatalogSearchSuggestion,
} from "@/lib/siteWorldCatalogSearch";
import {
  getSiteWorldCatalogPriority,
  getSiteWorldCommercialStatus,
  getSiteWorldFreshnessSummary,
  getSiteWorldHostedAccessDisclosure,
  getSiteWorldPackageAccessSummary,
  getSiteWorldProofDepth,
  getSiteWorldPublicProofSummary,
  getSiteWorldStatusBadges,
  getSiteWorldVisualDisclosure,
  isPlannedCatalogSiteWorld,
  siteWorldStatusLegend,
} from "@/lib/siteWorldCommercialStatus";
import {
  fetchSiteWorldCatalog,
  searchSiteWorldCatalog,
} from "@/lib/siteWorldsApi";
import { publicDemoHref } from "@/lib/marketingProof";
import { captureGroundedPublicCopy } from "@/lib/captureGroundedLanguage";
import { humanoidReadinessAssets } from "@/lib/editorialGeneratedAssets";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import {
  ArrowRight,
  ChevronDown,
  ListFilter,
  LocateFixed,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SiteWorld = (typeof siteWorldCards)[number];
type AvailabilityFilter =
  | "All"
  | "Sample"
  | "Access-reviewed"
  | "Planned"
  | "Proof visible";

const availabilityFilters: AvailabilityFilter[] = [
  "All",
  "Sample",
  "Access-reviewed",
  "Planned",
  "Proof visible",
];

const resultTypeCopy: Record<
  CatalogResultType,
  { label: string; tone: string }
> = {
  exact: {
    label: "Exact catalog match",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  nearby: {
    label: "Nearby/closest catalog match",
    tone: "border-blue-200 bg-blue-50 text-blue-900",
  },
  category: {
    label: "Category/workflow match",
    tone: "border-amber-200 bg-amber-50 text-amber-950",
  },
  request: {
    label: "Request candidate",
    tone: "border-slate-200 bg-slate-50 text-slate-800",
  },
};

function uniqueSites(sites: SiteWorld[]) {
  const seen = new Set<string>();
  const result: SiteWorld[] = [];
  for (const site of sites) {
    if (seen.has(site.id)) continue;
    seen.add(site.id);
    result.push(site);
  }
  return result;
}

function sortCatalog(sites: SiteWorld[]) {
  return [...sites].sort((left, right) => {
    const priorityDelta =
      getSiteWorldCatalogPriority(left) - getSiteWorldCatalogPriority(right);
    if (priorityDelta !== 0) return priorityDelta;
    return left.siteName.localeCompare(right.siteName);
  });
}

function hasPublicProof(site: SiteWorld) {
  const proofSummary = getSiteWorldPublicProofSummary(site);
  return (
    proofSummary !== "Metadata preview only" &&
    !proofSummary.toLowerCase().includes("planned profile")
  );
}

function getCatalogStateLabel(site: SiteWorld) {
  const status = getSiteWorldCommercialStatus(site);
  if (status.id === "public_demo_sample") return "Sample";
  if (status.id === "planned_catalog_profile") return "Planned";
  return "Access-reviewed";
}

function matchesAvailabilityFilter(
  site: SiteWorld,
  filter: AvailabilityFilter,
) {
  if (filter === "All") return true;
  if (filter === "Sample")
    return getSiteWorldCommercialStatus(site).id === "public_demo_sample";
  if (filter === "Planned") return isPlannedCatalogSiteWorld(site);
  if (filter === "Proof visible") return hasPublicProof(site);
  return getCatalogStateLabel(site) === "Access-reviewed";
}

function getResultTypeForSite(
  site: SiteWorld,
  classification: CatalogSearchClassification,
): CatalogResultType | null {
  if (!classification.query) return null;
  if (classification.exactMatches.some((match) => match.id === site.id))
    return "exact";
  if (classification.nearbyMatches.some((match) => match.id === site.id))
    return "nearby";
  if (classification.categoryMatches.some((match) => match.id === site.id))
    return "category";
  return null;
}

function suggestionKindLabel(kind: CatalogSearchSuggestion["kind"]) {
  return kind.replaceAll("_", " ");
}

function SearchSuggestionButton({
  suggestion,
  onSelect,
}: {
  suggestion: CatalogSearchSuggestion;
  onSelect: (suggestion: CatalogSearchSuggestion) => void;
}) {
  const copy = resultTypeCopy[suggestion.resultType];
  return (
    <button
      type="button"
      role="option"
      className="grid w-full gap-2 border-b border-black/10 px-4 py-3 text-left transition last:border-b-0 hover:bg-[#f5f3ef] focus:bg-[#f5f3ef] focus:outline-none sm:grid-cols-[1fr_auto]"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(suggestion)}
    >
      <span>
        <span className="block text-sm font-semibold text-slate-950">
          {suggestion.label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-slate-600">
          {suggestion.description}
        </span>
      </span>
      <span className="flex flex-wrap items-start gap-2 sm:justify-end">
        <span className="border border-black/10 bg-white px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">
          {suggestionKindLabel(suggestion.kind)}
        </span>
        <span
          className={`border px-2 py-1 text-[10px] font-semibold uppercase ${copy.tone}`}
        >
          {copy.label}
        </span>
      </span>
    </button>
  );
}

function SiteCard({
  site,
  resultType,
  large = false,
}: {
  site: SiteWorld;
  resultType?: CatalogResultType | null;
  large?: boolean;
}) {
  const badges = getSiteWorldStatusBadges(site).slice(0, 2);
  const commercialStatus = getSiteWorldCommercialStatus(site);
  const hostedDisclosure = getSiteWorldHostedAccessDisclosure(site);
  const visualDisclosure = getSiteWorldVisualDisclosure(site);
  const scenePackage = site.packages[0];
  const proofSummary = getSiteWorldPublicProofSummary(site);
  const freshnessSummary = getSiteWorldFreshnessSummary(site);
  const packageSummary = getSiteWorldPackageAccessSummary(site);
  const catalogState = getCatalogStateLabel(site);
  const planned = isPlannedCatalogSiteWorld(site);
  const primaryCta = planned
    ? "Scope this site/task"
    : "Review readiness inputs";
  const packageCta = planned
    ? "Scope site package"
    : "Request readiness report";

  return (
    <article
      className={`group grid overflow-hidden border border-black/10 bg-white shadow-[0_22px_60px_-48px_rgba(15,23,42,0.38)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-52px_rgba(15,23,42,0.42)] ${
        large ? "lg:grid-cols-[0.38fr_0.62fr]" : ""
      }`}
    >
      <a
        href={`/world-models/${site.id}`}
        className="block bg-[#f5f3ef] p-3 transition group-hover:bg-[#efebe2]"
        aria-label={`Open ${site.siteName} site package`}
      >
        <SiteWorldGraphic site={site} />
      </a>
      <div className="flex min-h-full flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {resultType ? (
            <ProofChip className={resultTypeCopy[resultType].tone}>
              {resultTypeCopy[resultType].label}
            </ProofChip>
          ) : null}
          <ProofChip className="border-black/10 bg-[#f5f3ef] text-slate-700">
            {catalogState}
          </ProofChip>
          <ProofChip className="border-black/10 bg-[#f5f3ef] text-slate-700">
            {hasPublicProof(site) ? "Proof visible" : "Proof summary"}
          </ProofChip>
        </div>

        <p className="mt-5 text-[11px] uppercase tracking-[0.18em] text-slate-500">
          {getCatalogLocationLabel(site)} / {site.industry}
        </p>
        <h3
          className={`mt-2 font-medium text-slate-950 ${large ? "text-[2rem] leading-[1.02]" : "text-[1.55rem] leading-[1.08]"}`}
        >
          <a
            href={`/world-models/${site.id}`}
            className="transition hover:text-slate-700"
          >
            {site.siteName}
          </a>
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-700">{site.summary}</p>

        <div className="mt-4 grid gap-3 border-y border-black/10 py-4 text-sm leading-5 text-slate-700 sm:grid-cols-2">
          <p>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Readiness workflow
            </span>
            <span className="mt-1 block font-medium text-slate-950">
              {site.taskLane}
            </span>
          </p>
          <p>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Robot fit
            </span>
            <span className="mt-1 block font-medium text-slate-950">
              {site.bestFor}
            </span>
          </p>
        </div>

        <details className="mt-4 border border-black/10 bg-[#f8f6f1]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-950">
            Proof, access, freshness
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          </summary>
          <div className="grid gap-px border-t border-black/10 bg-black/10 sm:grid-cols-2">
            {[
              ["State", commercialStatus.label],
              ["Proof", getSiteWorldProofDepth(site) || proofSummary],
              ["Freshness", freshnessSummary],
              ["Hosted", hostedDisclosure.label],
            ].map(([label, value]) => (
              <div key={label} className="bg-white p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-sm leading-5 text-slate-800">{value}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-black/10 bg-white px-4 py-3 text-xs leading-5 text-slate-600">
            <p>{visualDisclosure.summary}</p>
            <p>{packageSummary}</p>
            {badges.map((badge) => (
              <p key={badge.id} className="border-t border-black/10 pt-2">
                <span className="font-semibold text-slate-800">
                  {badge.id === "hosted_request_gated"
                    ? hostedDisclosure.label
                    : badge.label}
                  :
                </span>{" "}
                {badge.summary}
              </p>
            ))}
          </div>
        </details>

        <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row sm:flex-wrap">
          <a
            href={
              planned
                ? scenePackage?.actionHref || "/contact?persona=robot-team"
                : `/world-models/${site.id}`
            }
            className="inline-flex w-full items-center justify-center bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
          >
            {primaryCta}
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
          {!planned ? (
            <a
              href={`/world-models/${site.id}/start`}
              className="inline-flex w-full items-center justify-center border border-black/10 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
            >
              Check hosted evaluation
            </a>
          ) : null}
          <a
            href={scenePackage?.actionHref || "/contact?persona=robot-team"}
            className="inline-flex w-full items-center justify-center border border-black/10 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
          >
            {packageCta}
          </a>
        </div>
      </div>
    </article>
  );
}

export default function SiteWorlds() {
  const [catalog, setCatalog] = useState(siteWorldCards);
  const [categoryFilter, setCategoryFilter] = useState<SiteCategory>("All");
  const [availabilityFilter, setAvailabilityFilter] =
    useState<AvailabilityFilter>("All");
  const [query, setQuery] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] =
    useState<CatalogSearchSuggestion | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [apiResultIds, setApiResultIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchSiteWorldCatalog()
      .then((items) => {
        if (!cancelled && items.length > 0) {
          setCatalog(items as typeof siteWorldCards);
        }
      })
      .catch(() => {
        // Keep the static fallback catalog when live inventory is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setApiResultIds([]);
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(() => {
      searchSiteWorldCatalog(trimmedQuery, 12)
        .then((payload) => {
          if (!cancelled) {
            setApiResultIds(
              payload.results.map((result) => result.siteWorld.id),
            );
          }
        })
        .catch(() => {
          if (!cancelled) setApiResultIds([]);
        });
    }, 160);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [query]);

  const sortedCatalog = useMemo(() => sortCatalog(catalog), [catalog]);
  const heroSite = sortedCatalog[0];
  const searchClassification = useMemo(
    () => classifyCatalogSearch(sortedCatalog, query, selectedSuggestion),
    [query, selectedSuggestion, sortedCatalog],
  );
  const suggestions = useMemo(
    () => buildCatalogSearchSuggestions(sortedCatalog, query, 8),
    [query, sortedCatalog],
  );
  const normalizedQuery = query.trim();
  const filteredCatalog = useMemo(
    () =>
      sortedCatalog.filter((site) => {
        const matchesCategory =
          categoryFilter === "All" || site.category === categoryFilter;
        const matchesAvailability = matchesAvailabilityFilter(
          site,
          availabilityFilter,
        );
        return matchesCategory && matchesAvailability;
      }),
    [availabilityFilter, categoryFilter, sortedCatalog],
  );
  const catalogSites = useMemo(() => {
    if (!normalizedQuery) return filteredCatalog;

    const localMatches = uniqueSites([
      ...searchClassification.exactMatches,
      ...searchClassification.nearbyMatches,
      ...searchClassification.categoryMatches,
    ]).filter((site) => filteredCatalog.some((item) => item.id === site.id));
    const apiMatches = apiResultIds
      .map((id) => filteredCatalog.find((site) => site.id === id))
      .filter((site): site is SiteWorld => Boolean(site));

    return uniqueSites([...apiMatches, ...localMatches]);
  }, [apiResultIds, filteredCatalog, normalizedQuery, searchClassification]);
  const activeFilterCount =
    (categoryFilter === "All" ? 0 : 1) +
    (availabilityFilter === "All" ? 0 : 1) +
    (normalizedQuery ? 1 : 0);
  const catalogStats = useMemo(() => {
    const sampleCount = sortedCatalog.filter(
      (site) => getSiteWorldCommercialStatus(site).id === "public_demo_sample",
    ).length;
    const plannedCount = sortedCatalog.filter((site) =>
      isPlannedCatalogSiteWorld(site),
    ).length;
    const proofCount = sortedCatalog.filter((site) =>
      hasPublicProof(site),
    ).length;
    return {
      sampleCount,
      plannedCount,
      proofCount,
      requestGatedCount: Math.max(
        sortedCatalog.length - sampleCount - plannedCount,
        0,
      ),
    };
  }, [sortedCatalog]);

  const clearFilters = () => {
    setCategoryFilter("All");
    setAvailabilityFilter("All");
    setQuery("");
    setLocationQuery("");
    setSelectedSuggestion(null);
    setSuggestionsOpen(false);
  };

  const applySuggestion = (suggestion: CatalogSearchSuggestion) => {
    setQuery(suggestion.value);
    setSelectedSuggestion(suggestion);
    if (suggestion.kind === "address" || suggestion.kind === "city") {
      setLocationQuery(suggestion.value);
    }
    setSuggestionsOpen(false);
  };

  const handleSearchChange = (value: string) => {
    setQuery(value);
    setSelectedSuggestion(null);
    setSuggestionsOpen(true);
  };

  const handleLocationChange = (value: string) => {
    setLocationQuery(value);
    setQuery(value);
    setSelectedSuggestion(
      value.trim()
        ? {
            id: `manual-location:${value.trim()}`,
            kind: "address",
            resultType: "request",
            label: value.trim(),
            value: value.trim(),
            description: "Free-text location request",
            matchedField: "manual_location",
            siteLocation: value.trim(),
          }
        : null,
    );
  };

  const requestCandidate = searchClassification.requestCandidate;
  const heroImageSrc = humanoidReadinessAssets.warehouseHero;
  const resultHeading = !normalizedQuery
    ? "Browse catalog listings"
    : searchClassification.exactMatches.length > 0
      ? "Exact catalog match"
      : searchClassification.closestMatches.length > 0
        ? "Closest relevant catalog matches"
        : "No catalog match yet";
  const resultDescription = !normalizedQuery
    ? `Showing ${catalogSites.length} of ${sortedCatalog.length} profiles across sample, access-reviewed, and planned catalog states.`
    : searchClassification.noExactMatch
      ? `No scanned package is labeled as the exact place for "${normalizedQuery}". Blueprint can still compare nearby/category matches and route a request.`
      : `Showing exact catalog matches for "${normalizedQuery}" with proof and access labels kept visible.`;

  if (!heroSite) {
    return null;
  }

  return (
    <>
      <SEO
        title="Site Packages | Blueprint"
        description="Search Blueprint's indoor exact-site package catalog by address, city, site type, workflow, robot fit, proof posture, and request locations that need readiness evaluation."
        canonical="/world-models"
        jsonLd={[
          webPageJsonLd({
            path: "/world-models",
            name: "Blueprint Site Packages",
            description:
              "Search-first indoor exact-site package catalog with capture-grounded proof, request-gated readiness reports, hosted review checks, access, freshness, and provenance labels.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Site packages", path: "/world-models" },
          ]),
        ]}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="relative border-b border-black/10">
          <MonochromeMedia
            src={heroImageSrc}
            alt={heroSite.siteName}
            className="min-h-[44rem] rounded-none lg:min-h-[46rem]"
            loading="eager"
            imageClassName="min-h-[44rem] lg:min-h-[46rem]"
            overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.78))]"
          >
            <RouteTraceOverlay className="opacity-90" />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[88rem] px-5 pb-8 sm:px-8 lg:px-10 lg:pb-10">
              <div className="max-w-[52rem]">
                <h1 className="font-editorial text-[3.15rem] leading-[0.94] tracking-[-0.04em] text-white sm:text-[5.1rem] sm:tracking-[-0.06em]">
                  Browse site packages for readiness evaluation.
                </h1>
                <p className="mt-4 max-w-[40rem] text-base leading-7 text-white/85 sm:text-lg sm:leading-8">
                  Search by address, site, city, category, workflow, or robot
                  task. If Blueprint has not scanned the exact place yet,
                  request the site/task without turning a match into readiness,
                  rights, or hosted-access proof.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <a
                    href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-worlds-hero"
                    className="inline-flex w-full items-center justify-center bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
                  >
                    Request readiness evaluation
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="#catalog"
                    className="inline-flex w-full items-center justify-center border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                  >
                    Jump to catalog
                  </a>
                </div>
              </div>

              <div className="mt-7 border border-white/18 bg-white/95 p-4 text-slate-950 shadow-[0_32px_90px_-52px_rgba(0,0,0,0.62)] backdrop-blur sm:p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_0.42fr]">
                  <div className="relative">
                    <label
                      htmlFor="world-model-catalog-search"
                      className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                    >
                      Search site packages
                    </label>
                    <div className="flex min-h-14 items-center gap-3 border border-black/10 bg-[#f8f6f1] px-4">
                      <Search className="h-5 w-5 shrink-0 text-slate-500" />
                      <input
                        id="world-model-catalog-search"
                        value={query}
                        onChange={(event) =>
                          handleSearchChange(event.target.value)
                        }
                        onFocus={() => setSuggestionsOpen(true)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") setSuggestionsOpen(false);
                          if (event.key === "Enter") setSuggestionsOpen(false);
                        }}
                        placeholder="Search an address, site, city, store type, workflow, or robot task"
                        className="min-w-0 flex-1 bg-transparent text-base font-medium text-slate-950 outline-none placeholder:text-slate-500"
                        aria-autocomplete="list"
                        aria-expanded={
                          suggestionsOpen && suggestions.length > 0
                        }
                        aria-controls="world-model-catalog-search-options"
                      />
                    </div>

                    {suggestionsOpen && suggestions.length > 0 ? (
                      <div
                        id="world-model-catalog-search-options"
                        role="listbox"
                        className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-40 max-h-[22rem] overflow-auto border border-black/10 bg-white shadow-[0_28px_80px_-50px_rgba(15,23,42,0.6)]"
                      >
                        {suggestions.map((suggestion) => (
                          <SearchSuggestionButton
                            key={suggestion.id}
                            suggestion={suggestion}
                            onSelect={applySuggestion}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <PlaceAutocompleteInput
                    id="world-model-location-search"
                    label="Exact address or city"
                    value={locationQuery}
                    onChange={handleLocationChange}
                    onPlaceSelect={(metadata) => {
                      const formatted =
                        metadata.formattedAddress || locationQuery.trim();
                      if (!formatted) return;
                      setSelectedSuggestion({
                        id: `place:${metadata.placeId || formatted}`,
                        kind: "address",
                        resultType: "request",
                        label: formatted,
                        value: formatted,
                        description: "Address selected for a request candidate",
                        matchedField: "google_places",
                        siteLocation: formatted,
                      });
                    }}
                    placeholder="Optional address or city"
                    wrapperClassName="min-w-0"
                    labelClassName="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                    inputClassName="min-h-14 w-full border border-black/10 bg-[#f8f6f1] px-4 text-base font-medium text-slate-950 outline-none placeholder:text-slate-500"
                  />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {CATALOG_EXAMPLE_QUERIES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => {
                        setQuery(example);
                        setSelectedSuggestion(null);
                        setSuggestionsOpen(false);
                      }}
                      className="border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-950 hover:text-white"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px bg-black/10 px-5 py-6 sm:px-8 lg:grid-cols-4 lg:px-10">
            {[
              [
                "Exact catalog match",
                searchClassification.exactMatches.length || "Ask",
              ],
              [
                "Nearby/closest match",
                searchClassification.nearbyMatches.length || "Compare",
              ],
              [
                "Category/workflow match",
                searchClassification.categoryMatches.length || "Browse",
              ],
              ["Request candidate", requestCandidate ? "Draft" : "Ask"],
            ].map(([label, value]) => (
              <div key={label} className="bg-[#f8f6f1] px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </section>

        {requestCandidate ? (
          <section className="border-b border-black/10 bg-[#f8f6f1]">
            <div className="mx-auto grid max-w-[88rem] gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[0.7fr_auto] lg:items-center lg:px-10">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-black/10 bg-white">
                  <LocateFixed className="h-5 w-5 text-slate-950" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {requestCandidate.headline}
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                    {requestCandidate.body}
                  </p>
                  {searchClassification.closestMatches.length > 0 ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Showing{" "}
                      {Math.min(
                        searchClassification.closestMatches.length,
                        catalogSites.length,
                      )}{" "}
                      closest relevant catalog match
                      {Math.min(
                        searchClassification.closestMatches.length,
                        catalogSites.length,
                      ) === 1
                        ? ""
                        : "es"}{" "}
                      below.
                    </p>
                  ) : null}
                </div>
              </div>
              <a
                href={requestCandidate.href}
                className="inline-flex w-full items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 lg:w-auto"
              >
                Request this location
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </section>
        ) : null}

        <section
          id="catalog"
          className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12"
        >
          <div className="mb-5 grid gap-5 lg:grid-cols-[0.62fr_0.38fr] lg:items-end">
            <EditorialSectionIntro
              eyebrow="Catalog"
              title={resultHeading}
              description={resultDescription}
              className="max-w-3xl"
            />
            <div className="flex flex-col gap-2 lg:items-end">
              <a
                href={
                  requestCandidate?.href ||
                  "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-worlds"
                }
                className="inline-flex w-full items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 sm:w-auto"
              >
                {requestCandidate
                  ? "Request this location"
                  : "Request readiness evaluation"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
              <p className="text-xs leading-5 text-slate-500">
                Requests do not charge, clear rights, start providers, validate
                safety, or open hosted access.
              </p>
            </div>
          </div>

          <div className="mb-5 border border-black/10 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/10 bg-[#f5f3ef]">
                  <SlidersHorizontal className="h-4 w-4 text-slate-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Refine visible matches
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Showing {catalogSites.length} of {sortedCatalog.length};{" "}
                    {catalogStats.proofCount} with public proof visible.
                  </p>
                </div>
              </div>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center border border-black/10 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Clear search and filters
                  <X className="ml-2 h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="min-w-0">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Site type
                </p>
                <div className="flex flex-wrap gap-2 pb-1">
                  {categoryFilters.map((filter) => {
                    const active = categoryFilter === filter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setCategoryFilter(filter)}
                        aria-pressed={active}
                        className={`shrink-0 border px-3 py-2 text-xs font-semibold transition ${
                          active
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-black/10 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {filter}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="min-w-0">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Catalog state
                </p>
                <div className="flex flex-wrap gap-2 pb-1">
                  {availabilityFilters.map((filter) => {
                    const active = availabilityFilter === filter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setAvailabilityFilter(filter)}
                        aria-pressed={active}
                        className={`shrink-0 border px-3 py-2 text-xs font-semibold transition ${
                          active
                            ? "border-slate-950 bg-slate-950 text-white"
                            : "border-black/10 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {filter}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {catalogSites.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {catalogSites.map((site, index) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  resultType={getResultTypeForSite(site, searchClassification)}
                  large={Boolean(normalizedQuery) && index < 2}
                />
              ))}
            </div>
          ) : (
            <div className="border border-black/10 bg-white px-6 py-10 sm:px-8">
              <ListFilter className="h-6 w-6 text-slate-950" />
              <h3 className="font-editorial mt-5 text-[2.5rem] leading-none tracking-[-0.04em] text-slate-950">
                No exact-site profile matches this view.
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                Request the site, workflow, and robot class you need. Blueprint
                can route it through capture, package review, hosted evaluation,
                and rights/privacy checks before access is represented as
                supported.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={
                    requestCandidate?.href ||
                    "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-worlds-empty"
                  }
                  className="inline-flex items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {requestCandidate
                    ? "Request this location"
                    : "Request readiness evaluation"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center border border-black/10 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  Show all profiles
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-5 px-5 py-8 sm:px-8 lg:grid-cols-[0.36fr_0.64fr] lg:px-10">
            <EditorialSectionIntro
              eyebrow="Truth labels"
              title="Proof stays visible. Details open when needed."
              description={captureGroundedPublicCopy.catalogBoundary}
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {siteWorldStatusLegend.map((item) => (
                <div key={item.id} className={`border px-4 py-4 ${item.tone}`}>
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-2 text-sm leading-6 opacity-80">
                        {item.summary}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {requestCandidate ? (
          <div className="sticky bottom-0 z-30 border-t border-black/10 bg-white/95 px-4 py-3 shadow-[0_-18px_48px_-36px_rgba(15,23,42,0.55)] backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-[88rem] items-center gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-slate-700" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">
                  No exact scanned package yet
                </p>
                <p className="truncate text-xs text-slate-500">
                  {normalizedQuery}
                </p>
              </div>
              <a
                href={requestCandidate.href}
                className="inline-flex shrink-0 items-center justify-center bg-slate-950 px-3 py-2 text-xs font-semibold text-white"
              >
                Request
              </a>
            </div>
          </div>
        ) : null}

        <section className="mx-auto max-w-[88rem] px-5 pb-16 pt-10 sm:px-8 lg:px-10 lg:pb-20">
          <EditorialCtaBand
            eyebrow="Need a different place?"
            title="Request the exact site instead of guessing from a dense catalog."
            description="Start from the public sample for shape, then request a readiness report, hosted evaluation, or a new capture-backed profile when the catalog does not show the site/task your robot team needs."
            imageSrc={humanoidReadinessAssets.loadingDock}
            imageAlt={heroSite.siteName}
            primaryHref={
              requestCandidate?.href ||
              "/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-worlds"
            }
            primaryLabel={
              requestCandidate
                ? "Request this location"
                : "Request readiness evaluation"
            }
            secondaryHref={publicDemoHref}
            secondaryLabel="Open sample site package"
          />
        </section>
      </div>
    </>
  );
}
