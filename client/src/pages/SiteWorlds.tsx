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
import { siteWorldCards } from "@/data/siteWorlds";
import { publicDemoHref } from "@/lib/marketingProof";
import { publicCaptureLocationTypes } from "@/lib/proofEvidence";
import {
  getEditorialFeaturedSites,
  getEditorialSiteLocation,
} from "@/lib/siteEditorialContent";
import {
  getSiteWorldCatalogPriority,
  getSiteWorldFreshnessSummary,
  getSiteWorldHostedAccessDisclosure,
  getSiteWorldPackageAccessSummary,
  getSiteWorldPlainEnglishStatus,
  getSiteWorldPublicProofSummary,
  getSiteWorldStatusBadges,
  getSiteWorldVisualDisclosure,
  siteWorldStatusLegend,
} from "@/lib/siteWorldCommercialStatus";
import { fetchSiteWorldCatalog } from "@/lib/siteWorldsApi";
import { breadcrumbJsonLd, webPageJsonLd } from "@/lib/seoStructuredData";
import { ArrowRight, Box, Camera, MapPinned, Route, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SiteWorld = (typeof siteWorldCards)[number];

function sortCatalog(sites: SiteWorld[]) {
  return [...sites].sort((left, right) => {
    const priorityDelta = getSiteWorldCatalogPriority(left) - getSiteWorldCatalogPriority(right);
    if (priorityDelta !== 0) return priorityDelta;
    return left.siteName.localeCompare(right.siteName);
  });
}

function SiteCard({
  site,
  large = false,
}: {
  site: SiteWorld;
  large?: boolean;
}) {
  const badges = getSiteWorldStatusBadges(site).slice(0, 3);
  const hostedDisclosure = getSiteWorldHostedAccessDisclosure(site);
  const visualDisclosure = getSiteWorldVisualDisclosure(site);
  const scenePackage = site.packages[0];
  const proofSummary = getSiteWorldPublicProofSummary(site);
  const freshnessSummary = getSiteWorldFreshnessSummary(site);
  const packageSummary = getSiteWorldPackageAccessSummary(site);
  const factRows = [
    ["Proof", proofSummary],
    ["Freshness", freshnessSummary],
    ["Hosted", hostedDisclosure.label],
  ];

  return (
    <article
      className={`group grid overflow-hidden border border-black/10 bg-white shadow-[0_22px_60px_-48px_rgba(15,23,42,0.38)] ${
        large ? "lg:grid-cols-[0.46fr_0.54fr]" : ""
      }`}
    >
      <a
        href={`/world-models/${site.id}`}
        className="block bg-[#f5f3ef] p-3 transition group-hover:bg-[#efebe2]"
        aria-label={`Inspect ${site.siteName}`}
      >
        <SiteWorldGraphic site={site} />
      </a>
      <div className="flex min-h-full flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <ProofChip className="border-black/10 bg-[#f5f3ef] text-slate-700">
            Exact site
          </ProofChip>
          <ProofChip className="border-black/10 bg-[#f5f3ef] text-slate-700">
            {visualDisclosure.label}
          </ProofChip>
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

        <div className="mt-5 grid gap-px bg-black/10 sm:grid-cols-3">
          {factRows.map(([label, value]) => (
            <div key={label} className="min-h-[5rem] bg-[#f8f6f1] p-3">
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

        <div className="mt-auto flex flex-wrap gap-2 pt-5">
          <a
            href={`/world-models/${site.id}`}
            className="inline-flex items-center justify-center bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Inspect listing
            <ArrowRight className="ml-2 h-4 w-4" />
          </a>
          <a
            href={`/world-models/${site.id}/start`}
            className="inline-flex items-center justify-center border border-black/10 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Hosted setup
          </a>
          <a
            href={scenePackage?.actionHref || "/contact?persona=robot-team"}
            className="inline-flex items-center justify-center border border-black/10 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
          >
            Package access
          </a>
        </div>
      </div>
    </article>
  );
}

export default function SiteWorlds() {
  const [catalog, setCatalog] = useState(siteWorldCards);

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
  const catalogSites = sortedCatalog;

  const heroImageSrc = "/generated/editorial/world-models-hero.png";

  const metrics = useMemo(
    () => [
      {
        label: "Public catalog",
        detail: `${sortedCatalog.length} current listings visible in the buyer-facing world-model catalog.`,
      },
      {
        label: "Buying paths",
        detail: "Every listing keeps the package path and the hosted-evaluation request path legible.",
      },
      {
        label: "Proof shown",
        detail: "Public proof depth and commercial status stay attached to each exact-site card.",
      },
      {
        label: "Access limits",
        detail: "Rights, freshness, and hosted-access limits remain visible instead of implied.",
      },
    ],
    [sortedCatalog.length],
  );

  if (!heroSite) {
    return null;
  }

  return (
    <>
      <SEO
        title="Sites To Inspect | Blueprint"
        description="Browse real captured sites robot teams can inspect, request, or use to understand Blueprint's package and hosted-review paths."
        canonical="/world-models"
        jsonLd={[
          webPageJsonLd({
            path: "/world-models",
            name: "Blueprint Sites To Inspect",
            description:
              "Real captured sites, site-specific world models, package paths, hosted review, and provenance review for robot teams.",
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Sites to inspect", path: "/world-models" },
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
                  Sites your robot team can inspect.
                </h1>
                <p className="mt-3 text-lg text-white/90">
                  Browse current samples and request the place you need.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <ProofChip light>Exact site</ProofChip>
                  <ProofChip light>{getSiteWorldHostedAccessDisclosure(heroSite).label}</ProofChip>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <EditorialSectionIntro
              eyebrow="Featured sites"
              title="Start with a place, not an abstract demo."
              description="The clearest listings come first. Each card keeps proof, access, freshness, and hosted-review state separate."
              className="max-w-3xl"
            />
            <a
              href="#catalog"
              className="hidden items-center text-sm font-semibold text-slate-700 transition hover:text-slate-950 lg:inline-flex"
            >
                Explore all sites
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
	              eyebrow="Status legend"
	              title="Know what is visible now."
	              description="Every listing keeps public proof, request gates, package access, and hosted availability separate so broad catalog coverage does not pretend every site has the same proof depth."
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
                description="Grocery stores, retail floors, lobbies, malls, museums, and other everyday places can become useful robot-team evidence when capture is lawful, privacy-safe, and reviewed."
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
                description="Every site-specific world model stays grounded to one place, one proof chain, and trust details your team can inspect."
                light
              />
              <div className="mt-8 space-y-5">
                {[
                  {
                    icon: Box,
                    title: "True-to-site geometry",
                    body: "Walls, aisles, fixtures, and navigable structure tied back to the site record.",
                  },
                  {
                    icon: Camera,
                    title: "Photoreal textures",
                    body: "Capture-backed imagery and hosted-review stills instead of generic synthetic polish.",
                  },
                  {
                    icon: Route,
                    title: "Navigable graphs",
                    body: "Route traces and traversal cues built from the same exact-site ground truth.",
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
                alt={`${heroSite.siteName} hosted-review reference`}
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
              description={getSiteWorldPlainEnglishStatus(heroSite)}
              className="max-w-3xl"
            />
            <a
              href="/contact?persona=robot-team&interest=evaluation-package"
              className="hidden items-center text-sm font-semibold text-slate-700 transition hover:text-slate-950 lg:inline-flex"
            >
              Request access
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {catalogSites.map((site, index) => (
              <SiteCard key={site.id} site={site} large={index < 2} />
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-4 sm:px-8 lg:px-10 lg:py-6">
          <EditorialMetricStrip items={metrics} />
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pb-20">
          <EditorialCtaBand
            eyebrow="See a site for yourself"
            title="Start with the site that matters."
            description="Inspect the strongest current public sample, then request package access, hosted review, or capture only after the site is legible."
            imageSrc="/generated/editorial/cross-dock.png"
            imageAlt={heroSite.siteName}
            primaryHref={publicDemoHref}
            primaryLabel="Inspect a real site"
            secondaryHref="/contact?persona=robot-team&buyerType=robot_team&interest=evaluation-package&path=request-capture&source=site-worlds"
            secondaryLabel="Request site review"
          />
        </section>
      </div>
    </>
  );
}
