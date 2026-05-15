import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialMetricStrip,
  EditorialSectionIntro,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { SiteWorldGraphic } from "@/components/site/SiteWorldGraphic";
import { categoryFilters, siteWorldCards, type SiteCategory } from "@/data/siteWorlds";
import { publicDemoHref } from "@/lib/marketingProof";
import { publicCaptureLocationTypes } from "@/lib/proofEvidence";
import {
  getEditorialFeaturedSites,
  getEditorialSiteLocation,
} from "@/lib/siteEditorialContent";
import {
  getSiteWorldCatalogPriority,
  getSiteWorldCommercialStatus,
  getSiteWorldFreshnessSummary,
  getSiteWorldHostedAccessDisclosure,
  getSiteWorldPackageAccessSummary,
  getSiteWorldPlainEnglishStatus,
  getSiteWorldProofDepth,
  getSiteWorldPublicProofSummary,
  getSiteWorldStatusBadges,
  getSiteWorldVisualDisclosure,
  isPlannedCatalogSiteWorld,
  siteWorldStatusLegend,
} from "@/lib/siteWorldCommercialStatus";
import { fetchSiteWorldCatalog } from "@/lib/siteWorldsApi";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import {
  ArrowRight,
  Box,
  Camera,
  ListFilter,
  MapPinned,
  Route,
  Search,
  SlidersHorizontal,
  Smartphone,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SiteWorld = (typeof siteWorldCards)[number];
type AvailabilityFilter = "All" | "Sample" | "Access-reviewed" | "Planned" | "Proof visible";

const availabilityFilters: AvailabilityFilter[] = [
  "All",
  "Sample",
  "Access-reviewed",
  "Planned",
  "Proof visible",
];

function sortCatalog(sites: SiteWorld[]) {
  return [...sites].sort((left, right) => {
    const priorityDelta = getSiteWorldCatalogPriority(left) - getSiteWorldCatalogPriority(right);
    if (priorityDelta !== 0) return priorityDelta;
    return left.siteName.localeCompare(right.siteName);
  });
}

function hasPublicProof(site: SiteWorld) {
  const proofSummary = getSiteWorldPublicProofSummary(site);
  return (
    proofSummary !== "Metadata preview only"
    && !proofSummary.toLowerCase().includes("planned profile")
  );
}

function getCatalogStateLabel(site: SiteWorld) {
  const status = getSiteWorldCommercialStatus(site);
  if (status.id === "public_demo_sample") return "Sample";
  if (status.id === "planned_catalog_profile") return "Planned";
  return "Access-reviewed";
}

function matchesAvailabilityFilter(site: SiteWorld, filter: AvailabilityFilter) {
  if (filter === "All") return true;
  if (filter === "Sample") return getSiteWorldCommercialStatus(site).id === "public_demo_sample";
  if (filter === "Planned") return isPlannedCatalogSiteWorld(site);
  if (filter === "Proof visible") return hasPublicProof(site);
  return getCatalogStateLabel(site) === "Access-reviewed";
}

function SiteCard({
  site,
  large = false,
}: {
  site: SiteWorld;
  large?: boolean;
}) {
  const badges = getSiteWorldStatusBadges(site).slice(0, 3);
  const commercialStatus = getSiteWorldCommercialStatus(site);
  const hostedDisclosure = getSiteWorldHostedAccessDisclosure(site);
  const visualDisclosure = getSiteWorldVisualDisclosure(site);
  const scenePackage = site.packages[0];
  const proofSummary = getSiteWorldPublicProofSummary(site);
  const freshnessSummary = getSiteWorldFreshnessSummary(site);
  const packageSummary = getSiteWorldPackageAccessSummary(site);
  const catalogState = getCatalogStateLabel(site);
  const planned = isPlannedCatalogSiteWorld(site);
  const factRows = [
    ["State", commercialStatus.label],
    ["Proof", large ? getSiteWorldProofDepth(site) : proofSummary],
    ["Freshness", freshnessSummary],
    ["Hosted", hostedDisclosure.label],
  ];
  const primaryCta = planned ? "Scope this site" : "Review proof and access";
  const packageCta = planned ? "Scope package" : "Request package access";

  return (
    <article
      className={`group grid overflow-hidden border border-black/10 bg-white shadow-[0_22px_60px_-48px_rgba(15,23,42,0.38)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-52px_rgba(15,23,42,0.42)] ${
        large ? "lg:grid-cols-[0.46fr_0.54fr]" : ""
      }`}
    >
      <a
        href={`/world-models/${site.id}`}
        className="block bg-[#f5f3ef] p-3 transition group-hover:bg-[#efebe2]"
        aria-label={`Open ${site.siteName} world model`}
      >
        <SiteWorldGraphic site={site} />
      </a>
      <div className="flex min-h-full flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ProofChip className="border-black/10 bg-[#f5f3ef] text-slate-700">
            {catalogState}
          </ProofChip>
          <ProofChip className="border-black/10 bg-[#f5f3ef] text-slate-700">
            {visualDisclosure.label}
          </ProofChip>
          {hasPublicProof(site) ? (
            <ProofChip className="border-black/10 bg-[#f5f3ef] text-slate-700">
              Proof visible
            </ProofChip>
          ) : null}
        </div>
        <p className="mt-5 text-[11px] uppercase tracking-[0.22em] text-slate-500">
          {getEditorialSiteLocation(site)} / {site.industry}
        </p>
        <h3 className={`mt-2 font-medium tracking-tight text-slate-950 ${large ? "text-[2rem]" : "text-[1.6rem]"}`}>
          <a href={`/world-models/${site.id}`} className="transition hover:text-slate-700">
            {site.siteName}
          </a>
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-700">{site.summary}</p>
        <div className="mt-4 grid gap-2 text-sm leading-5 text-slate-700 sm:grid-cols-2">
          <p>
            <span className="font-semibold text-slate-950">Workflow:</span> {site.taskLane}
          </p>
          <p>
            <span className="font-semibold text-slate-950">Robot fit:</span> {site.bestFor}
          </p>
        </div>

        <div className="mt-5 grid gap-px bg-black/10 sm:grid-cols-2">
          {factRows.map(([label, value]) => (
            <div key={label} className="min-h-[5.6rem] bg-[#f8f6f1] p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
              <p className="mt-2 text-sm leading-5 text-slate-800">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-2">
          {badges.map((badge) => (
            <div key={badge.id} className={`border px-3 py-2 text-xs leading-5 ${badge.tone}`}>
              <span className="font-semibold">
                {badge.id === "hosted_request_gated" ? hostedDisclosure.label : badge.label}
              </span>
              <span className="ml-1 opacity-80">{badge.summary}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 border-t border-black/10 pt-4 text-xs leading-5 text-slate-600">
          <p>{visualDisclosure.summary}</p>
          <p className="mt-2">{packageSummary}</p>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row sm:flex-wrap">
          <a
            href={planned ? scenePackage?.actionHref || "/contact?persona=robot-team" : `/world-models/${site.id}`}
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
              Check hosted review
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
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("All");
  const [query, setQuery] = useState("");

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

  const sortedCatalog = useMemo(() => sortCatalog(catalog), [catalog]);
  const featuredSites = useMemo(() => getEditorialFeaturedSites(sortedCatalog, 4), [sortedCatalog]);
  const heroSite = featuredSites[0] || sortedCatalog[0];
  const normalizedQuery = query.trim().toLowerCase();
  const catalogSites = useMemo(
    () =>
      sortedCatalog.filter((site) => {
        const matchesCategory = categoryFilter === "All" || site.category === categoryFilter;
        const matchesAvailability = matchesAvailabilityFilter(site, availabilityFilter);
        const searchable = [
          site.siteName,
          site.siteCode,
          site.industry,
          site.taskLane,
          site.bestFor,
          site.sampleRobot,
          getCatalogStateLabel(site),
        ]
          .join(" ")
          .toLowerCase();
        const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery);
        return matchesCategory && matchesAvailability && matchesQuery;
      }),
    [availabilityFilter, categoryFilter, normalizedQuery, sortedCatalog],
  );
  const activeFilterCount =
    (categoryFilter === "All" ? 0 : 1)
    + (availabilityFilter === "All" ? 0 : 1)
    + (normalizedQuery ? 1 : 0);
  const catalogStats = useMemo(() => {
    const sampleCount = sortedCatalog.filter(
      (site) => getSiteWorldCommercialStatus(site).id === "public_demo_sample",
    ).length;
    const plannedCount = sortedCatalog.filter((site) => isPlannedCatalogSiteWorld(site)).length;
    const proofCount = sortedCatalog.filter((site) => hasPublicProof(site)).length;
    return {
      sampleCount,
      plannedCount,
      proofCount,
      requestGatedCount: Math.max(sortedCatalog.length - sampleCount - plannedCount, 0),
    };
  }, [sortedCatalog]);
  const clearFilters = () => {
    setCategoryFilter("All");
    setAvailabilityFilter("All");
    setQuery("");
  };

  const heroImageSrc = "/generated/editorial/world-models-hero.png";

  const metrics = useMemo(
    () => [
      {
        label: "Catalog records",
        detail: `${sortedCatalog.length} visible profiles across sample, access-reviewed, and planned exact-site world categories.`,
      },
      {
        label: "Sample proof",
        detail: `${catalogStats.sampleCount} public sample profile${catalogStats.sampleCount === 1 ? "" : "s"} show proof shape without becoming customer proof.`,
      },
      {
        label: "Access review",
        detail: `${catalogStats.requestGatedCount} profile${catalogStats.requestGatedCount === 1 ? "" : "s"} keep package and hosted access behind buyer/site review.`,
      },
      {
        label: "Planned supply",
        detail: `${catalogStats.plannedCount} planned profile${catalogStats.plannedCount === 1 ? "" : "s"} show the catalog vision without claiming cleared live supply.`,
      },
    ],
    [catalogStats, sortedCatalog.length],
  );

  if (!heroSite) {
    return null;
  }

  return (
    <>
      <SEO
        title="World Models | Blueprint"
        description="Browse Blueprint's exact-site world-model catalog for robot training, hosted review, package requests, and proof-led evaluation."
        canonical="/world-models"
        jsonLd={[
          webPageJsonLd({
            path: "/world-models",
            name: "Blueprint World Models",
            description:
              "Exact-site world-model catalog for robot teams, with package requests, hosted review paths, proof, access, freshness, and provenance labels.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "World models", path: "/world-models" },
          ]),
        ]}
      />

      <div className="bg-[#f5f3ef] text-slate-950">
        <section className="relative border-b border-black/10">
          <MonochromeMedia
            src={heroImageSrc}
            alt={heroSite.siteName}
            className="min-h-[36rem] rounded-none lg:min-h-[41rem]"
            loading="eager"
            imageClassName="min-h-[36rem] lg:min-h-[41rem]"
            overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.68))]"
          >
            <RouteTraceOverlay className="opacity-90" />
            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[88rem] px-5 pb-12 sm:px-8 lg:px-10 lg:pb-14">
              <div className="max-w-[34rem]">
                <h1 className="font-editorial text-[3.4rem] leading-[0.94] tracking-[-0.05em] text-white sm:text-[4.7rem]">
                  Browse exact-site world models.
                </h1>
                <p className="mt-4 max-w-[32rem] text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
                  Browse site-specific packages for robot evaluation, hosted review, and package requests. Each listing keeps proof depth, access state, and availability labels visible.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <ProofChip light>Capture-backed catalog</ProofChip>
                  <ProofChip light>Site packages</ProofChip>
                  <ProofChip light>Hosted review paths</ProofChip>
                </div>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a
                    href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=world-models-hero"
                    className="inline-flex w-full items-center justify-center bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:w-auto"
                  >
                    Request world model
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                  <a
                    href="#catalog"
                    className="inline-flex w-full items-center justify-center border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10 sm:w-auto"
                  >
                    Jump to catalog
                  </a>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <EditorialSectionIntro
              eyebrow="Featured sites"
              title="Start with a site, not an abstract demo."
              description="The top row anchors the catalog: public sample proof, request-reviewed exemplar framing, and planned example profiles are separated before a buyer clicks."
              className="max-w-3xl"
            />
            <a
              href="#catalog"
              className="hidden items-center text-sm font-semibold text-slate-700 transition hover:text-slate-950 lg:inline-flex"
            >
              Browse all world models
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            {featuredSites.map((site) => (
              <SiteCard key={site.id} site={site} />
            ))}
          </div>
        </section>

        <section className="border-y border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-6 px-5 py-10 sm:px-8 lg:grid-cols-[0.34fr_0.66fr] lg:px-10 lg:py-12">
            <EditorialSectionIntro
              eyebrow="Catalog states"
              title="Sample, access-reviewed, and planned listings mean different things."
              description="Blueprint can sell the catalog vision confidently while keeping public proof, hosted availability, package access, and future supply labels separate."
            />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {siteWorldStatusLegend.map((item) => (
                <div key={item.id} className={`border px-4 py-4 ${item.tone}`}>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 opacity-80">{item.summary}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-black/10 bg-white">
          <div className="mx-auto grid max-w-[88rem] gap-px px-5 py-10 sm:px-8 lg:grid-cols-[0.36fr_0.64fr] lg:px-10 lg:py-12">
            <div className="bg-[#f5f3ef] p-6 lg:p-8">
              <EditorialSectionIntro
                eyebrow="Capture app"
                title="Blueprint is not warehouse-only."
                description="Grocery stores, retail floors, lobbies, malls, museums, and other everyday places can become useful robot-team training and eval evidence when capture is lawful, privacy-safe, and reviewed."
              />
              <a
                href="/capture"
                className="mt-7 inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                See capture rules
                <Smartphone className="ml-2 h-4 w-4" />
              </a>
            </div>
            <div className="grid gap-px bg-black/10 md:grid-cols-3">
              {publicCaptureLocationTypes.map((item) => (
                <div key={item.label} className="bg-white p-5">
                  <MapPinned className="h-5 w-5 text-slate-950" />
                  <p className="mt-4 text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-4 sm:px-8 lg:px-10 lg:py-6">
          <div className="grid overflow-hidden rounded-[2.2rem] border border-black/10 bg-slate-950 lg:grid-cols-[0.42fr_0.58fr]">
            <div className="px-7 py-8 text-white sm:px-8 lg:px-10 lg:py-10">
              <EditorialSectionIntro
                eyebrow="Inside the world"
                title="Built from real capture."
                description="Every site-specific world model stays grounded to one place, one proof chain, and buyer-readable limits."
                light
              />
              <div className="mt-8 space-y-5">
                {[
                  {
                    icon: Box,
                    title: "Site-tied structure",
                    body: "Walls, aisles, fixtures, and navigable cues tie back to the site record when the package supports them.",
                  },
                  {
                    icon: Camera,
                    title: "Capture-backed views",
                    body: "Imagery and hosted-evaluation stills stay labeled instead of standing in as unsupported proof.",
                  },
                  {
                    icon: Route,
                    title: "Navigable cues",
                    body: "Route traces and traversal cues point back to the same exact-site capture basis.",
                  },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-4">
                      <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10">
                        <Icon className="h-5 w-5 text-white/70" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-white/60">{item.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative min-h-[24rem] border-t border-white/10 lg:border-l lg:border-t-0">
              <MonochromeMedia
                src={heroImageSrc}
                alt={`${heroSite.siteName} hosted-evaluation reference`}
                className="h-full rounded-none"
                imageClassName="h-full"
                overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.35))]"
              >
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:52px_52px] opacity-35" />
                <RouteTraceOverlay className="opacity-90" />
              </MonochromeMedia>
            </div>
          </div>
        </section>

        <section id="catalog" className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <EditorialSectionIntro
              eyebrow="Full catalog"
              title="Scan every listing by proof, access, and freshness."
              description={`${getSiteWorldPlainEnglishStatus(heroSite)} Filters are built around buyer questions: site type, state, visible proof, and whether access is still gated.`}
              className="max-w-3xl"
            />
            <a
              href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=world-models-section"
              className="hidden items-center text-sm font-semibold text-slate-700 transition hover:text-slate-950 lg:inline-flex"
            >
              Request access
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>

          <div className="mb-5 border border-black/10 bg-white p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-black/10 bg-[#f5f3ef]">
                  <SlidersHorizontal className="h-4 w-4 text-slate-700" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">Catalog filters</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Showing {catalogSites.length} of {sortedCatalog.length}; {catalogStats.proofCount} with public proof visible.
                  </p>
                </div>
              </div>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center justify-center border border-black/10 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Clear filters
                  <X className="ml-2 h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.72fr_1fr_1fr]">
              <label className="flex min-h-[2.75rem] items-center gap-2 border border-black/10 bg-[#f8f6f1] px-3 text-sm text-slate-700">
                <Search className="h-4 w-4 shrink-0 text-slate-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search site, workflow, robot"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-500"
                />
              </label>

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
                <SiteCard key={site.id} site={site} large={index < 2} />
              ))}
            </div>
          ) : (
            <div className="border border-black/10 bg-white px-6 py-10 sm:px-8">
              <ListFilter className="h-6 w-6 text-slate-950" />
              <h3 className="font-editorial mt-5 text-[2.5rem] leading-none tracking-[-0.05em] text-slate-950">
                No exact-site profile matches this view.
              </h3>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                Request the site, workflow, and robot class you need. Blueprint can route it through capture, package review, hosted evaluation, and rights/privacy checks before access is represented as available.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=world-models-empty"
                  className="inline-flex items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Request world model
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

        <section className="mx-auto max-w-[88rem] px-5 py-4 sm:px-8 lg:px-10 lg:py-6">
          <EditorialMetricStrip items={metrics} />
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pb-20">
          <EditorialCtaBand
            eyebrow="Evaluate a world"
            title="Ask for the exact site your robot team needs."
            description="Open the public sample for shape, then request package access, hosted evaluation, or a new capture-backed profile when the catalog does not yet show the site you need."
            imageSrc="/generated/editorial/cross-dock.png"
            imageAlt={heroSite.siteName}
            primaryHref="/contact?persona=robot-team&buyerType=robot_team&interest=world-model&path=world-model&source=site-worlds"
            primaryLabel="Request world model"
            secondaryHref={publicDemoHref}
            secondaryLabel="Open sample world model"
          />
        </section>
      </div>
    </>
  );
}
