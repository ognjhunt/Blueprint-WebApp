import { SEO } from "@/components/SEO";
import {
  EditorialCtaBand,
  EditorialMetricStrip,
  EditorialSectionIntro,
  MonochromeMedia,
  ProofChip,
  RouteTraceOverlay,
} from "@/components/site/editorial";
import { siteWorldCards } from "@/data/siteWorlds";
import { publicDemoHref } from "@/lib/marketingProof";
import { publicCaptureLocationTypes } from "@/lib/proofEvidence";
import {
  getEditorialFeaturedSites,
  getEditorialMoreSites,
  getEditorialSiteImage,
  getEditorialSiteLocation,
} from "@/lib/siteEditorialContent";
import {
  getSiteWorldCatalogPriority,
  getSiteWorldPlainEnglishStatus,
  getSiteWorldStatusBadges,
  siteWorldStatusLegend,
} from "@/lib/siteWorldCommercialStatus";
import { fetchSiteWorldCatalog } from "@/lib/siteWorldsApi";
import { ArrowRight, Box, Camera, MapPinned, Route, Smartphone } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SiteWorld = (typeof siteWorldCards)[number];

function isHostedReady(site: SiteWorld) {
  return (
    Boolean(site.deploymentReadiness?.native_world_model_primary)
    || Boolean(site.worldLabsPreview?.launchUrl)
  );
}

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

  return (
    <a
      href={`/world-models/${site.id}`}
      className={`group relative overflow-hidden rounded-[1.8rem] border border-black/10 bg-slate-950 shadow-[0_22px_60px_-44px_rgba(15,23,42,0.38)] ${
        large ? "min-h-[21rem]" : "min-h-[15.5rem]"
      }`}
    >
      <MonochromeMedia
        src={getEditorialSiteImage(site)}
        alt={site.siteName}
        className="h-full rounded-none"
        imageClassName="h-full transition duration-700 group-hover:scale-[1.03]"
        overlayClassName="bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.82))]"
      />
      <div className="absolute inset-x-0 bottom-0 p-5">
        <p className="text-[11px] uppercase tracking-[0.22em] text-white/60">
          {getEditorialSiteLocation(site)}
        </p>
        <h3 className={`mt-2 font-medium tracking-tight text-white ${large ? "text-[2rem]" : "text-[1.6rem]"}`}>
          {site.siteName}
        </h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <ProofChip light className="border-white/20 bg-black/30 text-white/80">
            Exact site
          </ProofChip>
          {badges.map((badge) => (
            <ProofChip key={badge.id} light className="border-white/20 bg-black/30 text-white/80">
              {isHostedReady(site) && badge.id === "hosted_request_gated" ? "Hosted available" : badge.label}
            </ProofChip>
          ))}
        </div>
      </div>
    </a>
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
const moreSites = useMemo(
    () => getEditorialMoreSites(sortedCatalog, 5, featuredSites.map((site) => site.id)),
    [featuredSites, sortedCatalog],
  );

  const heroImageSrc = "/generated/editorial/world-models-hero.png";

  const metrics = useMemo(
    () => [
      {
        label: "Public catalog",
        detail: `${sortedCatalog.length} current listings visible in the buyer-facing world-model catalog.`,
      },
      {
        label: "Buying paths",
        detail: "Every listing keeps the package path and the hosted-evaluation path legible.",
      },
      {
        label: "Proof posture",
        detail: "Public proof depth and commercial status stay attached to each exact-site card.",
      },
      {
        label: "Trust boundary",
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
        title="World Models | Blueprint"
        description="Browse exact-site world models built from real capture, with clear paths into site packages or hosted evaluation."
        canonical="/world-models"
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
                  Exact-site worlds.
                </h1>
                <p className="mt-3 text-lg text-white/90">
                  Browse real facilities.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <ProofChip light>Exact site</ProofChip>
                  <ProofChip light>{isHostedReady(heroSite) ? "Hosted available" : "Request-scoped review"}</ProofChip>
                </div>
              </div>
            </div>
          </MonochromeMedia>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-10 sm:px-8 lg:px-10 lg:py-12">
          <div className="mb-5 flex items-center justify-between gap-4">
            <EditorialSectionIntro
              eyebrow="Featured sites"
              title="Real facilities, presented as worlds."
              description="The listings with the clearest current proof come first, followed by the broader exact-site catalog."
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
              description="Every listing keeps public proof, request gates, package access, and hosted availability separate so broad catalog coverage does not pretend every page has the same proof depth."
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
                eyebrow="Capture app supply"
                title="Most future worlds start as public-facing captures."
                description="The catalog should not feel warehouse-only. Blueprint can source proof from grocery stores, retail floors, lobbies, malls, museums, and other everyday locations when the capturer stays inside public-facing areas and review rules."
              />
              <a
                href="/capture-app"
                className="mt-7 inline-flex items-center justify-center bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open capture app
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
                description="Every world model stays grounded to one facility, one proof chain, and trust details your team can inspect."
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
                    body: "Capture-backed imagery and runtime stills instead of generic synthetic polish.",
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
                alt={`${heroSite.siteName} runtime reference`}
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
              eyebrow="More real sites"
              title="The catalog expands from the same visual language."
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

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            {moreSites[0] ? <SiteCard site={moreSites[0]} large /> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              {moreSites.slice(1).map((site) => (
                <SiteCard key={site.id} site={site} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-5 py-4 sm:px-8 lg:px-10 lg:py-6">
          <EditorialMetricStrip items={metrics} />
        </section>

        <section className="mx-auto max-w-[88rem] px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pb-20">
          <EditorialCtaBand
            eyebrow="See a site for yourself"
            title="Start with the exact site that matters."
            description="Inspect the strongest current public sample, then move into package access or hosted evaluation only after the site is legible."
            imageSrc="/generated/editorial/cross-dock.png"
            imageAlt={heroSite.siteName}
            primaryHref={publicDemoHref}
            primaryLabel="Inspect a real site"
            secondaryHref="/contact?persona=robot-team&interest=evaluation-package"
            secondaryLabel="Request access"
          />
        </section>
      </div>
    </>
  );
}
